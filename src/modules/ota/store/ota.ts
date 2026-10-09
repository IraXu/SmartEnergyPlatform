/**
 * 【原型说明】设备管理 › 设备OTA 的业务逻辑，仅用于原型交互验证。
 * 业务规则对齐《产品需求文档-设备OTA》v1.0：
 * - 固件包由平台运营方统一维护，企业侧只读；本模块不提供固件上传 / 编辑 / 删除
 * - 新固件标识由「设备当前版本」与「平台固件基线中该设备匹配的最新版本」比较自动得出
 * - 检测为只读性质的版本刷新；升级为对设备产生实质影响的操作，均按权限点渲染
 * - 本期仅支持手动即时升级，升级目标版本取自固件基线，不可人工指定；升级不可回滚
 * - 从未建连（无首次接入时间）的设备不具备通信能力，不可检测与升级
 * - 批量升级跳过「已是最新 / 从未建连 / 升级中」的设备
 *
 * 【原型模拟说明】检测与升级以定时器模拟设备回执；离线设备在演示中被判定为升级失败。
 */

import { session } from '@/modules/auth/store'
import { maskIdentifier } from '@/shared/utils/mask'
import { devices as ledgerDevices } from '@/modules/device/store'
import type { Device } from '@/modules/device/store'
import { getNode, getSubtreeIds } from '@/modules/org/store'
import { FIRMWARE_BASELINES } from '../mock/seed'
import { OTA_FAIL_AT, OTA_STEP_MAX, OTA_STEP_MIN, OTA_TICK_MS } from './constants'
import { otaLogs, otaStates, otaTasks, persistOtaLogs, persistOtaStates, persistOtaTasks } from './storage'
import type {
  DetectResult,
  FirmwareBaseline,
  FirmwareRelease,
  FirmwareState,
  OtaChangeType,
  OtaFilters,
  OtaState,
  UpgradeStatus,
  UpgradeTask,
  UpgradeTaskDevice,
  UpgradeTaskStatus,
} from './types'

/* ---------- 通用 ---------- */

/** 【原型说明】模拟异步耗时，无真实接口调用 */
function delay(ms = 420) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms)
  })
}

/** 输入内容按纯文本处理：合并连续空格并去除首尾空白 */
function normalizeText(value: string) {
  return (value ?? '').replace(/\s+/g, ' ').trim()
}

/** 当前操作账号展示名，用于变更记录 */
function currentOperator() {
  const current = session.current
  if (!current) return '未知账号'
  return current.contactName || maskIdentifier(current.identifier)
}

/* ---------- 固件基线（平台运营方维护，企业侧只读） ---------- */

/** 取设备匹配的固件基线；按「设备类型 + 规格型号」匹配（匹配维度由另一物联网平台维护） */
export function baselineOf(device: Device): FirmwareBaseline | null {
  if (!device.type || !device.model) return null
  return FIRMWARE_BASELINES.find((item) => item.type === device.type && item.model === device.model) ?? null
}

/** 设备匹配到的最新固件版本；未匹配到基线时返回 null */
export function latestReleaseOf(device: Device): FirmwareRelease | null {
  const baseline = baselineOf(device)
  if (!baseline || !baseline.releases.length) return null
  return baseline.releases[baseline.releases.length - 1]
}

/** 解析版本号 V{主}.{次}.{修订}；无法解析时返回 null */
function parseVersion(version: string): number[] | null {
  const matched = /^V(\d+)\.(\d+)\.(\d+)$/.exec(normalizeText(version))
  if (!matched) return null
  return [Number(matched[1]), Number(matched[2]), Number(matched[3])]
}

/** 版本比较：a > b 返回正数，a < b 返回负数，相等返回 0；无法解析返回 null */
function compareVersion(a: string, b: string): number | null {
  const left = parseVersion(a)
  const right = parseVersion(b)
  if (!left || !right) return null
  for (let index = 0; index < 3; index += 1) {
    if (left[index] !== right[index]) return left[index] - right[index]
  }
  return 0
}

/**
 * 计算新固件标识（PRD F-OTA-02）。
 * 判定顺序：从未建连 → 不可判断；未匹配基线 → 不可判断；
 * 版本无法解析 → 不可判断；当前版本未上报 → 待检测；最新 > 当前 → 有新固件；否则无新固件。
 */
export function computeFirmwareState(device: Device, currentVersion: string): FirmwareState {
  const release = latestReleaseOf(device)
  if (!release) return '不可判断'
  if (!currentVersion) return device.accessedAt !== null ? '待检测' : '不可判断'
  const compared = compareVersion(release.version, currentVersion)
  if (compared === null) return '不可判断'
  return compared > 0 ? '有新固件' : '无新固件'
}

/* ---------- OTA 状态（设备维度） ---------- */

/** 取某设备的 OTA 状态；未初始化时惰性创建（后续新增 / 导入的设备同样适用） */
export function otaStateOf(deviceId: string): OtaState {
  let state = otaStates.find((item) => item.deviceId === deviceId)
  if (!state) {
    state = {
      deviceId,
      currentVersion: '',
      detectedAt: null,
      upgradeStatus: '未升级',
      progress: 0,
      failReason: '',
      taskId: null,
      lastUpgradedAt: null,
    }
    otaStates.push(state)
    persistOtaStates()
  }
  return state
}

/* ---------- 列表行 ---------- */

/** 列表一行：设备档案 + 固件版本 + 新固件标识 + 升级状态 */
export interface OtaRow {
  /** 行标识（取自设备标识，供表格 row-key 使用） */
  id: string
  device: Device
  /** 当前固件版本；未上报 / 从未建连为空 */
  currentVersion: string
  /** 平台最新固件版本；未匹配到基线为空 */
  latestVersion: string
  firmwareState: FirmwareState
  upgradeStatus: UpgradeStatus
  progress: number
  failReason: string
  taskId: string | null
  /** 是否可检测：在线过且非升级中 */
  canDetect: boolean
  /** 是否可升级：有新固件、在线过且非升级中 */
  canUpgrade: boolean
  /** 是否有可查看的升级内容：匹配到基线且有比当前更高的版本 */
  hasUpgradeContent: boolean
}

/** 组装某设备的列表行 */
function buildRow(device: Device): OtaRow {
  const state = otaStateOf(device.id)
  const release = latestReleaseOf(device)
  const currentVersion = state.currentVersion
  const firmwareState = computeFirmwareState(device, currentVersion)
  const upgrading = state.upgradeStatus === '升级中'
  // 曾与平台建连（有首次接入时间）的设备才可进行 OTA 操作
  const connected = device.accessedAt !== null
  const compared = release && currentVersion ? compareVersion(release.version, currentVersion) : null
  const hasUpgradeContent = Boolean(release) && (currentVersion === '' || (compared !== null && compared > 0))
  return {
    id: device.id,
    device,
    currentVersion,
    latestVersion: release?.version ?? '',
    firmwareState,
    upgradeStatus: state.upgradeStatus,
    progress: state.progress,
    failReason: state.failReason,
    taskId: state.taskId,
    canDetect: connected && !upgrading,
    canUpgrade: firmwareState === '有新固件' && connected && !upgrading,
    hasUpgradeContent,
  }
}

/** 全部设备行（用于查询与统计） */
export function allRows(): OtaRow[] {
  return ledgerDevices.map(buildRow)
}

/** 按条件查询设备行；多个维度之间为「且」关系 */
export function filterRows(filters: OtaFilters): OtaRow[] {
  const keyword = normalizeText(filters.keyword).toLowerCase()
  const scope = filters.unitId ? getSubtreeIds(filters.unitId) : null

  return allRows().filter((row) => {
    const { device } = row
    if (keyword) {
      const hit =
        device.name.toLowerCase().includes(keyword) ||
        device.imei.toLowerCase().includes(keyword) ||
        device.license.toLowerCase().includes(keyword)
      if (!hit) return false
    }
    if (filters.types.length && !filters.types.includes(device.type)) return false
    if (scope && !scope.includes(device.unitId)) return false
    if (filters.firmwareStates.length && !filters.firmwareStates.includes(row.firmwareState as '有新固件' | '无新固件')) {
      return false
    }
    if (filters.upgradeStatuses.length && !filters.upgradeStatuses.includes(row.upgradeStatus)) return false
    return true
  })
}

/** 列表顺序固定按建档时间倒序（最新建档在前），不提供排序切换 */
export function sortRows(list: OtaRow[]): OtaRow[] {
  return [...list].sort((a, b) => b.device.createdAt - a.device.createdAt)
}

/** 企业是否已有任何设备：用于区分「暂无设备」与「查询无结果」 */
export const hasAnyDevice = () => ledgerDevices.length > 0

/* ---------- 检测（F-OTA-04 / F-OTA-05） ---------- */

/**
 * 【原型说明】模拟检测单台设备的固件版本。
 * 真实实现为向设备下发版本查询指令并等待回执；原型内以定时器模拟，回执结果取设备档案中登记的当前版本。
 */
export async function detectDevice(deviceId: string): Promise<DetectResult> {
  await delay(600)
  const device = ledgerDevices.find((item) => item.id === deviceId)
  if (!device) throw new Error('该设备已被删除')
  if (device.accessedAt === null) throw new Error('设备从未建连，无法进行 OTA 操作')
  const state = otaStateOf(deviceId)
  if (state.upgradeStatus === '升级中') throw new Error('设备升级中，请等待升级完成')
  // 【原型说明】离线设备检测失败，用于验证失败路径
  if (device.onlineStatus === '离线') {
    throw new Error('检测失败：设备离线或通信超时，请稍后重试')
  }
  state.detectedAt = Date.now()
  persistOtaStates()
  const firmwareState = computeFirmwareState(device, state.currentVersion)
  writeLog('检测设备', device, `检测设备固件版本，当前版本 ${state.currentVersion || '—'}（${firmwareState}）`)
  return { ok: true, state: firmwareState, version: state.currentVersion }
}

export interface DetectBatchResult {
  /** 检测成功且发现新固件的台数 */
  newFirmware: number
  /** 检测成功且已是最新的台数 */
  upToDate: number
  /** 检测失败的台数 */
  failed: number
  /** 提交时被跳过的台数（从未建连 / 升级中） */
  skipped: number
}

/** 设备是否可参与批量检测 */
export const isDetectable = (device: Device) =>
  device.accessedAt !== null && otaStateOf(device.id).upgradeStatus !== '升级中'

/** 设备是否可参与批量升级（有新固件 / 在线过 / 非升级中） */
export const isUpgradable = (device: Device) =>
  computeFirmwareState(device, otaStateOf(device.id).currentVersion) === '有新固件' &&
  device.accessedAt !== null &&
  otaStateOf(device.id).upgradeStatus !== '升级中'

/** 批量检测（F-OTA-05）：逐台下发版本查询，跳过不可检测的设备 */
export async function detectDevices(
  deviceIds: string[],
  onProgress?: (done: number, total: number) => void,
): Promise<DetectBatchResult> {
  const result: DetectBatchResult = { newFirmware: 0, upToDate: 0, failed: 0, skipped: 0 }
  const targets = deviceIds
    .map((id) => ledgerDevices.find((item) => item.id === id))
    .filter((item): item is Device => Boolean(item))
  const runnable = targets.filter(isDetectable)
  result.skipped = deviceIds.length - runnable.length

  for (let index = 0; index < runnable.length; index += 1) {
    const device = runnable[index]
    await delay(200)
    if (device.onlineStatus === '离线') {
      result.failed += 1
    } else {
      const state = otaStateOf(device.id)
      state.detectedAt = Date.now()
      persistOtaStates()
      if (computeFirmwareState(device, state.currentVersion) === '有新固件') result.newFirmware += 1
      else result.upToDate += 1
      writeLog('检测设备', device, `批量检测设备固件版本，当前版本 ${state.currentVersion || '—'}`)
    }
    onProgress?.(index + 1, runnable.length)
  }
  return result
}

/* ---------- 升级任务（F-OTA-07 / F-OTA-08 / F-OTA-09） ---------- */

/** 【原型说明】标记下一次创建的升级任务强制首台设备失败，用于验证失败路径 */
let forceNextFail = false
export function markNextUpgradeFail() {
  forceNextFail = true
}

const pad = (value: number) => String(value).padStart(2, '0')

/** 生成任务编号 OTA-YYYYMMDD-NNNN */
function buildTaskId() {
  const date = new Date()
  const datePart = `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`
  const todayCount = otaTasks.filter((task) => task.id.includes(`OTA-${datePart}-`)).length
  return `OTA-${datePart}-${String(todayCount + 1).padStart(4, '0')}`
}

/** 单台设备发起升级的设备条目 */
function buildTaskDevice(device: Device, willFail: boolean): UpgradeTaskDevice {
  const state = otaStateOf(device.id)
  const release = latestReleaseOf(device)
  return {
    deviceId: device.id,
    deviceName: device.name,
    deviceImei: device.imei,
    fromVersion: state.currentVersion || '—',
    toVersion: release?.version ?? '—',
    progress: 0,
    status: '排队中',
    failReason: '',
    willFail,
  }
}

/** 单台升级（F-OTA-07）：创建仅含一台设备的升级任务 */
export async function upgradeDevice(deviceId: string): Promise<UpgradeTask> {
  await delay(460)
  const device = ledgerDevices.find((item) => item.id === deviceId)
  if (!device) throw new Error('该设备已被删除')
  if (device.accessedAt === null) throw new Error('设备从未建连，无法进行 OTA 操作')
  const state = otaStateOf(deviceId)
  if (state.upgradeStatus === '升级中') throw new Error('该设备正在升级中')
  if (computeFirmwareState(device, state.currentVersion) !== '有新固件') throw new Error('该设备暂无可用升级内容')

  const willFail = device.onlineStatus === '离线' || forceNextFail
  forceNextFail = false
  return createTask([device], willFail ? [device.id] : [], true)
}

export interface UpgradeSubmitResult {
  task: UpgradeTask
  /** 可升级台数 */
  upgradeCount: number
  /** 被跳过的台数（已是最新 / 从未建连 / 升级中） */
  skipped: number
}

/** 批量升级（F-OTA-08）：提交前统计可升级与跳过条数；跳过无需升级的设备 */
export async function upgradeDevices(deviceIds: string[]): Promise<UpgradeSubmitResult> {
  await delay(520)
  const targets = deviceIds
    .map((id) => ledgerDevices.find((item) => item.id === id))
    .filter((item): item is Device => Boolean(item))
  const runnable = targets.filter(isUpgradable)
  const skipped = deviceIds.length - runnable.length
  if (!runnable.length) throw new Error('所选设备均无需升级')

  const failIds = runnable.filter((device) => device.onlineStatus === '离线').map((device) => device.id)
  if (forceNextFail && runnable[0]) failIds.push(runnable[0].id)
  forceNextFail = false
  const task = await createTask(runnable, failIds, false)
  return { task, upgradeCount: runnable.length, skipped }
}

/** 创建升级任务并把设备置为「排队中」 */
async function createTask(
  targets: Device[],
  failIds: string[],
  _single: boolean,
): Promise<UpgradeTask> {
  const task: UpgradeTask = {
    id: buildTaskId(),
    targetVersions: Array.from(new Set(targets.map((device) => latestReleaseOf(device)?.version ?? '—'))),
    account: currentOperator(),
    createdAt: Date.now(),
    status: '进行中',
    devices: targets.map((device) => buildTaskDevice(device, failIds.includes(device.id))),
  }
  otaTasks.unshift(task)
  targets.forEach((device) => {
    const state = otaStateOf(device.id)
    state.upgradeStatus = '升级中'
    state.progress = 0
    state.failReason = ''
    state.taskId = task.id
  })
  persistOtaTasks()
  persistOtaStates()
  targets.forEach((device) => {
    writeLog('设备OTA升级', device, `下发升级任务 ${task.id}，目标版本 ${latestReleaseOf(device)?.version ?? '—'}`)
  })
  return task
}

/** 取某任务（响应式对象，供进度浮层直接绑定） */
export const getTask = (taskId: string) => otaTasks.find((task) => task.id === taskId) ?? null

/** 正在进行中的任务 */
export const activeTasks = () => otaTasks.filter((task) => task.status === '进行中')

/** 进行中任务的汇总：升级中设备台数与已完成台数（列表提示条使用） */
export function runningSummary() {
  const tasks = activeTasks()
  let total = 0
  let done = 0
  tasks.forEach((task) => {
    task.devices.forEach((item) => {
      total += 1
      if (item.status === '升级成功' || item.status === '升级失败' || item.status === '已跳过') done += 1
    })
  })
  return { total, done }
}

/** 由任务内设备结果聚合任务状态 */
function computeTaskStatus(task: UpgradeTask): UpgradeTaskStatus {
  const success = task.devices.filter((item) => item.status === '升级成功').length
  const failed = task.devices.filter((item) => item.status === '升级失败').length
  const pending = task.devices.filter((item) => item.status === '排队中' || item.status === '升级中').length
  if (pending > 0) return '进行中'
  if (failed === 0) return '已完成'
  if (success === 0) return '全部失败'
  return '部分失败'
}

/** 【原型说明】推进一次升级进度：由页面定时器按节拍调用 */
export function advanceUpgradeTasks() {
  let changed = false
  otaTasks.forEach((task) => {
    if (task.status !== '进行中') return
    task.devices.forEach((item) => {
      if (item.status === '升级成功' || item.status === '升级失败' || item.status === '已跳过') return
      if (item.status === '排队中') {
        item.status = '升级中'
        changed = true
      }
      const step = OTA_STEP_MIN + Math.floor(Math.random() * (OTA_STEP_MAX - OTA_STEP_MIN + 1))
      item.progress = Math.min(100, item.progress + step)
      changed = true

      const state = otaStateOf(item.deviceId)
      state.progress = item.progress

      // 失败路径：达到阈值后判定失败
      if (item.willFail && item.progress >= OTA_FAIL_AT) {
        item.status = '升级失败'
        item.failReason = '设备离线或通信失败'
        state.upgradeStatus = '升级失败'
        state.failReason = item.failReason
        state.progress = 0
        state.lastUpgradedAt = Date.now()
        const device = ledgerDevices.find((entry) => entry.id === item.deviceId)
        if (device) writeLog('设备OTA升级', device, `升级任务 ${task.id} 失败：${item.failReason}`)
        return
      }

      if (item.progress >= 100) {
        item.status = '升级成功'
        state.upgradeStatus = '升级成功'
        state.currentVersion = item.toVersion
        state.progress = 100
        state.failReason = ''
        state.lastUpgradedAt = Date.now()
        const device = ledgerDevices.find((entry) => entry.id === item.deviceId)
        if (device) writeLog('设备OTA升级', device, `升级任务 ${task.id} 成功，固件由 ${item.fromVersion} 升级至 ${item.toVersion}`)
      }
    })

    const nextStatus = computeTaskStatus(task)
    if (nextStatus !== task.status) {
      task.status = nextStatus
      changed = true
    }
  })

  if (changed) {
    persistOtaTasks()
    persistOtaStates()
    persistOtaLogs()
  }
  return changed
}

/** 【原型说明】升级进度定时器：页面挂载时启动、卸载时停止 */
let ticker: number | null = null

export function startOtaTicker() {
  if (ticker !== null) return
  ticker = window.setInterval(() => {
    advanceUpgradeTasks()
  }, OTA_TICK_MS)
}

export function stopOtaTicker() {
  if (ticker === null) return
  window.clearInterval(ticker)
  ticker = null
}

/* ---------- 变更记录 ---------- */

function writeLog(type: OtaChangeType, device: Device, detail: string) {
  otaLogs.unshift({
    id: `OLOG-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    at: Date.now(),
    account: currentOperator(),
    type,
    deviceId: device.id,
    target: `${device.name}（${device.imei}）`,
    detail,
  })
  if (otaLogs.length > 300) otaLogs.splice(300)
  persistOtaLogs()
}

/** 某台设备的 OTA 变更记录 */
export const otaLogsOf = (deviceId: string) => otaLogs.filter((log) => log.deviceId === deviceId)

/* ---------- 选项常量 ---------- */

export const FIRMWARE_STATE_OPTIONS: Array<'有新固件' | '无新固件'> = ['有新固件', '无新固件']
export const UPGRADE_STATUS_OPTIONS: UpgradeStatus[] = ['未升级', '升级中', '升级成功', '升级失败']

/** 归属查询范围所用的节点是否存在（用于校验被删除的用能单元） */
export const unitExists = (unitId: string) => Boolean(getNode(unitId))
