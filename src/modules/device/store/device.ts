/**
 * 【原型说明】设备台账的业务逻辑，仅用于原型交互验证。
 * 业务规则对齐《产品需求文档-设备台账》v1.0：
 * - 设备识别码（IMEI）与 License 均必填且企业内唯一
 * - 两种建档方式收敛在「新增设备」弹窗内：手动录入 / 批量导入
 * - 设备类型与卡号（ICCID）由设备上云后服务端返回，不在新增表单中录入
 * - 批量添加为模板导入，只允许新增、部分成功语义
 * - 批量导入删除按文件中的 License 定位设备，仅删除命中设备
 * - 设备迁移的语义为改所属用能单元，不追溯历史数据；支持单条与批量
 * - 设备均可删除，彻底删除不可恢复；删除不影响历史告警
 * - 接入状态与在线状态由采集侧驱动，本模块只读；不设启用 / 停用
 */

import { session } from '@/modules/auth/store'
import { maskIdentifier } from '@/shared/utils/mask'
import { getNode, getPathText, getSubtreeIds, nodes as orgNodes } from '@/modules/org/store'
import type { OrgNode } from '@/modules/org/store'
import { DEVICE_TYPES } from '../mock/seed'
import { CODE_MAX, IMPORT_MAX_ROWS, NAME_MAX } from './constants'
import { devices, logs, persistDevices, persistLogs } from './storage'
import type {
  AccessStatus,
  Device,
  DeviceChangeType,
  DeviceFilters,
  DeviceInput,
  ImportDeleteRow,
  ImportRow,
  OnlineStatus,
  SortOrder,
} from './types'

/* ---------- 通用 ---------- */

/** 【原型说明】模拟异步耗时，无真实接口调用 */
function delay(ms = 360) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms)
  })
}

/** 输入内容按纯文本处理：合并连续空格并去除首尾空白，仅空格视为未填写 */
export function normalizeText(value: string) {
  return (value ?? '').replace(/\s+/g, ' ').trim()
}

/** 当前操作账号展示名，用于变更记录 */
function currentOperator() {
  const current = session.current
  if (!current) return '未知账号'
  return current.contactName || maskIdentifier(current.identifier)
}

/* ---------- 时间展示 ---------- */

const pad2 = (value: number) => String(value).padStart(2, '0')

/** 时间统一格式 YYYY-MM-DD HH:mm；空值展示占位符 */
export function formatTime(at: number | null) {
  if (!at) return '—'
  const date = new Date(at)
  return `${formatDate(at)} ${pad2(date.getHours())}:${pad2(date.getMinutes())}`
}

/** 展示到日期，同时用于导入报告与导出文件名 */
export function formatDate(at: number) {
  const date = new Date(at)
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
}

/** 今天的日期字符串（YYYY-MM-DD） */
export function todayText() {
  return formatDate(Date.now())
}

/* ---------- 字典与选项 ---------- */

export { DEVICE_TYPES } from '../mock/seed'

/** 设备类型查询选项：按归类分组 */
export function deviceTypeGroups() {
  const groups = new Map<string, string[]>()
  DEVICE_TYPES.forEach((item) => {
    const list = groups.get(item.category) ?? []
    list.push(item.name)
    groups.set(item.category, list)
  })
  return Array.from(groups.entries()).map(([category, names]) => ({
    label: category,
    options: names.map((name) => ({ label: name, value: name })),
  }))
}

/** 取某设备类型的详情页专属数据区分组 */
export function typeGroupsOf(type: string) {
  return DEVICE_TYPES.find((item) => item.name === type)?.groups ?? []
}

/** 树选择数据：企业根节点 → 组织节点 → 用能单元；仅用能单元可选为设备的归属 */
export function unitTreeData() {
  const childrenOf = (parentId: string | null) =>
    orgNodes.filter((node) => node.parentId === parentId).sort((a, b) => a.order - b.order)

  const build = (parentId: string | null): Array<Record<string, unknown>> =>
    childrenOf(parentId).map((node: OrgNode) => {
      const children = build(node.id)
      return {
        value: node.id,
        title: node.name,
        // 选中后回显完整层级路径（见 `tree-node-label-prop`），下拉内仍只显示节点名
        path: getPathText(node.id),
        // 仅用能单元可选：组织节点与企业根节点仅作路径展示
        selectable: node.kind === 'unit',
        children: children.length ? children : undefined,
      }
    })
  return build(null)
}

/**
 * 所属用能单元的完整层级路径（含用能单元自身名称）。
 * 与 PRD 示例一致：示例科技有限公司 / 华南园区 / A 栋 / 1 号车间。
 */
export function unitPath(unitId: string) {
  if (!unitId) return '—'
  const node = getNode(unitId)
  if (!node) return '—'
  return getPathText(unitId)
}

/** 设备的所属用能单元是否已失效（曾被绑定但节点已被删除） */
export const isUnitInvalid = (unitId: string) => Boolean(unitId) && !getNode(unitId)

/** 设备 GPS 坐标展示文本；未设置时返回占位符 */
export function formatCoordinate(lng: number | null, lat: number | null) {
  if (lng === null || lat === null) return '—'
  return `${lng.toFixed(6)}, ${lat.toFixed(6)}`
}

/** 所属用能单元的 GPS 坐标与详细地址（取自组织架构，本模块只读） */
export function unitLocation(unitId: string) {
  const node = getNode(unitId)
  if (!node) return { coordinate: '—', address: '—', lng: null as number | null, lat: null as number | null }
  return {
    coordinate: node.lng !== null && node.lat !== null ? `${node.lng.toFixed(6)}, ${node.lat.toFixed(6)}` : '—',
    address: node.address || '—',
    lng: node.lng,
    lat: node.lat,
  }
}

/** 归属查询范围：所选节点及其全部下级 */
function unitScopeIds(unitId: string | null): string[] | null {
  if (!unitId) return null
  return getSubtreeIds(unitId)
}

/* ---------- 查询与排序 ---------- */

/** 按条件查询设备；多个维度之间为「且」关系 */
export function filterDevices(filters: DeviceFilters): Device[] {
  const keyword = normalizeText(filters.keyword).toLowerCase()
  const scope = unitScopeIds(filters.unitId)

  return devices.filter((device) => {
    if (keyword) {
      const hit =
        device.name.toLowerCase().includes(keyword) ||
        device.imei.toLowerCase().includes(keyword) ||
        device.cardNo.toLowerCase().includes(keyword) ||
        device.license.toLowerCase().includes(keyword)
      if (!hit) return false
    }
    if (filters.types.length && !filters.types.includes(device.type)) return false
    if (scope && !scope.includes(device.unitId)) return false
    if (filters.accessStatuses.length && !filters.accessStatuses.includes(device.accessStatus)) return false
    // 未接入设备没有在线状态，不参与在线状态筛选（PRD F-DEV-02）
    if (filters.onlineStatuses.length) {
      if (!device.onlineStatus || !filters.onlineStatuses.includes(device.onlineStatus)) return false
    }
    return true
  })
}

/** 排序：仅按建档时间，默认降序（最新建档在前） */
export function sortDevices(list: Device[], order: SortOrder): Device[] {
  const factor = order === 'ascend' ? 1 : -1
  return [...list].sort((a, b) => (a.createdAt - b.createdAt) * factor)
}

/** 企业是否已有任何设备：用于区分「暂无设备」与「查询无结果」 */
export const hasAnyDevice = () => devices.length > 0

export const getDevice = (id: string) => devices.find((device) => device.id === id) ?? null

/* ---------- 校验 ---------- */

export interface DeviceFormErrors {
  name?: string
  license?: string
  unitId?: string
  lng?: string
}

/** License 冲突检测：全平台唯一，编辑时排除自身 */
export function findLicenseOwner(license: string, excludeId?: string) {
  const value = normalizeText(license).toLowerCase()
  return devices.find((device) => device.license.toLowerCase() === value && device.id !== excludeId) ?? null
}

/**
 * 【原型说明】按 License 查询平台侧的设备识别码（IMEI）。
 * 真实实现为调用平台接口按 License 反查设备；原型内以稳定的伪随机规则模拟：
 * 同一 License 始终返回同一 IMEI，前缀 8645 便于识别为演示数据。
 */
export function queryImeiByLicense(license: string) {
  const value = normalizeText(license)
  if (!value) return ''
  // 以 License 字符的累加哈希作为种子，保证结果稳定可复现
  let seed = 0
  for (let index = 0; index < value.length; index += 1) {
    seed = (seed * 31 + value.charCodeAt(index)) % 100000000
  }
  return `8645${String(seed).padStart(13, '0')}`
}

/** 校验新增 / 编辑设备的表单（PRD F-DEV-04 / F-DEV-11）；同一字段只返回一条提示 */
export function validateDevice(input: DeviceInput, excludeId?: string): DeviceFormErrors {
  const errors: DeviceFormErrors = {}
  const name = normalizeText(input.name)
  const license = normalizeText(input.license)

  if (!name) errors.name = '请输入设备名称'
  else if (name.length > NAME_MAX) errors.name = `设备名称最多 ${NAME_MAX} 个字符`

  if (!license) errors.license = '请输入 License'
  else if (license.length > CODE_MAX) errors.license = `License 最多 ${CODE_MAX} 个字符`
  else {
    const owner = findLicenseOwner(license, excludeId)
    // 原型内所有设备同属演示企业，因此统一按本企业冲突口径提示
    if (owner) errors.license = `该 License 已存在，请核对后重新填写（已存在：${owner.name}）`
  }

  if (!input.unitId) errors.unitId = '请选择所属用能单元'
  else if (!getNode(input.unitId)) errors.unitId = '所选用能单元已失效，请重新选择'

  // GPS 由所属用能单元带出或地图选点确定，不应出现只有经度没有纬度的情况
  if ((input.lng === null) !== (input.lat === null)) errors.lng = 'GPS 坐标不完整，请重新选点'

  return errors
}

export const hasFormError = (errors: DeviceFormErrors) => Object.keys(errors).length > 0

/* ---------- 新增 / 编辑 / 删除 ---------- */

/**
 * 新增设备（F-DEV-04）：建档后默认接入状态为「待接入」。
 * 设备类型、设备识别码（IMEI）、卡号与专属数据均为设备上云后由服务端 / 平台返回，建档时按 License 预查 IMEI。
 */
export async function createDevice(input: DeviceInput): Promise<Device> {
  await delay()
  const errors = validateDevice(input)
  if (hasFormError(errors)) throw new Error(Object.values(errors)[0])

  const license = normalizeText(input.license)
  const device: Device = {
    id: `DEV-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name: normalizeText(input.name),
    // IMEI 由平台按 License 反查得到；未上云时可能查不到
    imei: queryImeiByLicense(license),
    // 卡号（ICCID）与设备类型由服务端在设备上云后返回
    cardNo: '',
    license,
    type: '',
    model: normalizeText(input.model),
    factory: normalizeText(input.factory),
    factoryDate: normalizeText(input.factoryDate),
    unitId: input.unitId,
    installDate: normalizeText(input.installDate),
    installPosition: normalizeText(input.installPosition),
    lng: input.lng,
    lat: input.lat,
    gpsCustom: input.gpsCustom,
    commType: normalizeText(input.commType),
    protocol: normalizeText(input.protocol),
    gatewayImei: normalizeText(input.gatewayImei),
    accessStatus: '待接入',
    onlineStatus: null,
    accessedAt: null,
    lastReportAt: null,
    // 设备图片由「智慧物联生态平台」维护，建档时尚未维护，卡片展示兜底图
    imageUrl: '',
    metrics: {},
    remark: normalizeText(input.remark),
    createdAt: Date.now(),
  }
  devices.push(device)
  persistDevices()
  writeLog('新增设备', device, `新增设备「${device.name}」（License ${device.license}）`)
  return device
}

/** 编辑设备（F-DEV-11）：不含设备类型、IMEI、卡号、所属用能单元与状态字段 */
export async function updateDevice(id: string, input: DeviceInput): Promise<void> {
  await delay()
  const device = getDevice(id)
  if (!device) throw new Error('该设备已被删除')
  const errors = validateDevice(input, id)
  if (hasFormError(errors)) throw new Error(Object.values(errors)[0])

  const changes: string[] = []
  const name = normalizeText(input.name)
  const license = normalizeText(input.license)
  if (device.name !== name) changes.push(`名称由「${device.name}」改为「${name}」`)
  if (device.license !== license) {
    // License 变更后需重新按新 License 查询平台侧的 IMEI
    changes.push(`License 由「${device.license}」改为「${license}」`)
    device.imei = queryImeiByLicense(license)
  }
  if (device.model !== normalizeText(input.model)) changes.push('修改了规格型号')
  if (device.factory !== normalizeText(input.factory)) changes.push('修改了生产厂家')
  if (device.factoryDate !== normalizeText(input.factoryDate)) changes.push('修改了出厂日期')
  if (device.installDate !== normalizeText(input.installDate)) changes.push('修改了安装日期')
  if (device.installPosition !== normalizeText(input.installPosition)) changes.push('修改了安装位置描述')
  if (device.lng !== input.lng || device.lat !== input.lat) changes.push('调整了 GPS 位置')
  if (device.commType !== normalizeText(input.commType)) changes.push('修改了通信方式')
  if (device.protocol !== normalizeText(input.protocol)) changes.push('修改了采集协议')
  if (device.gatewayImei !== normalizeText(input.gatewayImei)) changes.push('修改了上级网关')
  if (device.remark !== normalizeText(input.remark)) changes.push('修改了备注')

  device.name = name
  device.license = license
  device.model = normalizeText(input.model)
  device.factory = normalizeText(input.factory)
  device.factoryDate = normalizeText(input.factoryDate)
  device.installDate = normalizeText(input.installDate)
  device.installPosition = normalizeText(input.installPosition)
  device.lng = input.lng
  device.lat = input.lat
  device.gpsCustom = input.gpsCustom
  device.commType = normalizeText(input.commType)
  device.protocol = normalizeText(input.protocol)
  device.gatewayImei = normalizeText(input.gatewayImei)
  device.remark = normalizeText(input.remark)
  persistDevices()
  if (changes.length) writeLog('编辑设备', device, changes.join('；'))
}

/** 删除单条设备（F-DEV-09）：彻底删除不可恢复；不影响历史告警 */
export async function deleteDevice(id: string): Promise<void> {
  await delay()
  const index = devices.findIndex((device) => device.id === id)
  if (index < 0) throw new Error('该设备已被删除')
  const [removed] = devices.splice(index, 1)
  persistDevices()
  writeLog(
    '删除设备',
    removed,
    `删除${removed.type}「${removed.name}」（识别码 ${removed.imei} / License ${removed.license}），原所属用能单元 ${unitPath(removed.unitId)}`,
  )
}

export interface BatchResult {
  success: number
  skipped: number
}

/** 批量删除设备（F-DEV-10）：跨页勾选累计，不设条数上限 */
export async function deleteDevices(ids: string[]): Promise<BatchResult> {
  await delay(460)
  let success = 0
  let skipped = 0
  ids.forEach((id) => {
    const index = devices.findIndex((device) => device.id === id)
    if (index < 0) {
      skipped += 1
      return
    }
    const [removed] = devices.splice(index, 1)
    pushLog('删除设备', removed, `批量删除${removed.type}「${removed.name}」（识别码 ${removed.imei}）`)
    success += 1
  })
  persistDevices()
  persistLogs()
  return { success, skipped }
}

/* ---------- 迁移（F-DEV-07 / F-DEV-08） ---------- */

/** 迁移目标校验：不可为空、不可指向已删除节点、不可与当前相同 */
export function validateMoveTarget(device: Device, targetUnitId: string): string | null {
  if (!targetUnitId) return '请选择目标用能单元'
  if (!getNode(targetUnitId)) return '所选用能单元已失效，请重新选择'
  if (device.unitId === targetUnitId) return '目标用能单元与当前相同，请重新选择'
  return null
}

/** 单条迁移（F-DEV-07）：只影响迁移之后的数据落位，历史数据不追溯 */
export async function moveDevice(id: string, targetUnitId: string): Promise<void> {
  await delay()
  const device = getDevice(id)
  if (!device) throw new Error('该设备已被删除')
  const issue = validateMoveTarget(device, targetUnitId)
  if (issue) throw new Error(issue)

  const fromPath = unitPath(device.unitId)
  const toPath = unitPath(targetUnitId)
  device.unitId = targetUnitId
  persistDevices()
  writeLog('迁移', device, `所属用能单元由「${fromPath}」迁移至「${toPath}」（历史数据不追溯）`)
}

/** 批量迁移（F-DEV-08）：已在目标单元下或已被删除的设备跳过 */
export async function moveDevices(ids: string[], targetUnitId: string): Promise<BatchResult> {
  await delay(460)
  if (!targetUnitId) throw new Error('请选择目标用能单元')
  if (!getNode(targetUnitId)) throw new Error('所选用能单元已失效，请重新选择')

  const targetPath = unitPath(targetUnitId)
  let success = 0
  let skipped = 0
  ids.forEach((id) => {
    const device = getDevice(id)
    if (!device || device.unitId === targetUnitId) {
      skipped += 1
      return
    }
    const fromPath = unitPath(device.unitId)
    device.unitId = targetUnitId
    pushLog('迁移', device, `批量迁移：所属用能单元由「${fromPath}」迁移至「${targetPath}」（历史数据不追溯）`)
    success += 1
  })
  persistDevices()
  persistLogs()
  return { success, skipped }
}

/* ---------- 批量导入（F-DEV-05） ---------- */

/** 导入模板列名；与「新增设备 › 手动录入」的填写项保持一致，设备类型、IMEI 与卡号由平台 / 服务端返回，不在模板列中 */
export const IMPORT_HEADERS = [
  '设备名称',
  'License',
  '所属用能单元编码',
  '安装位置描述',
  '备注',
]

/** 下载用的模板内容（含一行示例，便于用户对照填写） */
export function buildImportTemplate() {
  // 示例取自组织架构演示数据中的用能单元编码，便于用户直观对照
  const sample = [
    '1 号总表',
    'LIC-8F2A-1043-7C61',
    'UNIT-HN-A-001',
    'A 栋一层东侧配电间 1 号柜',
    '一层东侧主进线总表',
  ]
  const rows = [IMPORT_HEADERS.join(','), sample.map((value) => `"${value}"`).join(',')]
  return `\uFEFF${rows.join('\n')}`
}

/** 简易 CSV 行解析：支持双引号包裹与引号转义 */
function parseCsvLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let quoted = false
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index]
    if (quoted) {
      if (char === '"' && line[index + 1] === '"') {
        current += '"'
        index += 1
      } else if (char === '"') {
        quoted = false
      } else {
        current += char
      }
    } else if (char === '"') {
      quoted = true
    } else if (char === ',') {
      result.push(current)
      current = ''
    } else {
      current += char
    }
  }
  result.push(current)
  return result.map((value) => value.trim())
}

/** 按用能单元编码查找节点；编码不存在或匹配到多个时返回 null */
function findUnitByCode(codeText: string) {
  const value = normalizeText(codeText).toLowerCase()
  if (!value) return null
  const matched = orgNodes.filter((node) => node.kind === 'unit' && node.unitCode.toLowerCase() === value)
  return matched.length === 1 ? matched[0] : null
}

function rowToInput(raw: Record<string, string>): DeviceInput {
  const unit = findUnitByCode(normalizeText(raw['所属用能单元编码']))
  return {
    name: raw['设备名称'] ?? '',
    license: raw['License'] ?? '',
    unitId: unit?.id ?? '',
    // 模板不含安装日期、规格与通信信息，建档后可在编辑中补充
    model: '',
    factory: '',
    factoryDate: '',
    installDate: '',
    installPosition: raw['安装位置描述'] ?? '',
    // 导入时 GPS 默认取所属用能单元坐标
    lng: unit?.lng ?? null,
    lat: unit?.lat ?? null,
    gpsCustom: false,
    commType: '',
    protocol: '',
    gatewayImei: '',
    remark: raw['备注'] ?? '',
  }
}

function validateImportRow(raw: Record<string, string>): string {
  const name = normalizeText(raw['设备名称'])
  const license = normalizeText(raw['License'])
  const unitCode = normalizeText(raw['所属用能单元编码'])

  if (!name) return '缺少必填项：设备名称'
  if (!license) return '缺少必填项：License'
  if (!unitCode) return '缺少必填项：所属用能单元编码'
  if (!findUnitByCode(unitCode)) {
    const codeExists = orgNodes.some(
      (node) => node.kind === 'unit' && node.unitCode.toLowerCase() === unitCode.toLowerCase(),
    )
    return codeExists ? `所属用能单元编码不唯一：${unitCode}` : `所属用能单元编码不存在：${unitCode}`
  }
  if (findLicenseOwner(license)) return `License 已存在：${license}`
  return ''
}

/**
 * 解析并逐行校验导入内容（原型以 CSV 文本承载模板；真实实现读取 Excel 文件）。
 * 除库内冲突外，同时校验文件内部 License 重复的行。
 */
export function parseImportRows(content: string): ImportRow[] {
  const lines = content
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .filter((line) => line.trim())

  const rows: ImportRow[] = []
  const seenLicense = new Map<string, number>()
  // 第一行为表头
  lines.slice(1).forEach((line, index) => {
    const values = parseCsvLine(line)
    const raw: Record<string, string> = {}
    IMPORT_HEADERS.forEach((header, position) => {
      raw[header] = values[position] ?? ''
    })
    const lineNo = index + 2
    let error = validateImportRow(raw)
    const licenseKey = normalizeText(raw['License']).toLowerCase()
    if (!error && licenseKey) {
      const first = seenLicense.get(licenseKey)
      if (first !== undefined) error = `License 已存在：${raw['License']}（与第 ${first} 行重复）`
      else seenLicense.set(licenseKey, lineNo)
    }
    rows.push({ lineNo, raw, input: error ? null : rowToInput(raw), error })
  })
  return rows
}

/** 执行导入：只导入有效行（部分成功语义），失败行跳过；只新增、不更新已有设备 */
export async function importDevices(rows: ImportRow[]): Promise<{ success: number; failed: number }> {
  await delay(600)
  const valid = rows.filter((row) => row.input)
  if (valid.length > IMPORT_MAX_ROWS) throw new Error(`单次最多导入 ${IMPORT_MAX_ROWS} 条，请分批导入`)

  valid.forEach((row) => {
    const input = row.input as DeviceInput
    const license = normalizeText(input.license)
    const device: Device = {
      id: `DEV-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: normalizeText(input.name),
      // IMEI 由平台按 License 反查得到
      imei: queryImeiByLicense(license),
      // 卡号与设备类型由服务端在设备上云后返回
      cardNo: '',
      license,
      type: '',
      model: normalizeText(input.model),
      factory: normalizeText(input.factory),
      factoryDate: normalizeText(input.factoryDate),
      unitId: input.unitId,
      installDate: '',
      installPosition: normalizeText(input.installPosition),
      lng: input.lng,
      lat: input.lat,
      gpsCustom: input.gpsCustom,
      commType: normalizeText(input.commType),
      protocol: normalizeText(input.protocol),
      gatewayImei: normalizeText(input.gatewayImei),
      accessStatus: '待接入',
      onlineStatus: null,
      accessedAt: null,
      lastReportAt: null,
      // 设备图片由「智慧物联生态平台」维护，导入后由该平台补齐
      imageUrl: '',
      metrics: {},
      remark: normalizeText(input.remark),
      createdAt: Date.now(),
    }
    devices.push(device)
    pushLog('批量添加', device, `批量添加设备「${device.name}」（License ${device.license}）`)
  })
  persistDevices()
  persistLogs()
  return { success: valid.length, failed: rows.length - valid.length }
}

/** 生成失败行报告 */
export function buildFailedReport(rows: ImportRow[]) {
  const failed = rows.filter((row) => row.error)
  const header = ['行号', '失败原因', ...IMPORT_HEADERS]
  const body = failed.map((row) =>
    [String(row.lineNo), row.error, ...IMPORT_HEADERS.map((key) => row.raw[key] ?? '')]
      .map((value) => `"${value.replace(/"/g, '""')}"`)
      .join(','),
  )
  return `\uFEFF${[header.join(','), ...body].join('\n')}`
}

/* ---------- 批量导入删除（按 License 定位） ---------- */

/** 批量删除模板列名：仅需 License 即可唯一定位设备 */
export const IMPORT_DELETE_HEADERS = ['License']

/** 下载用的批量删除模板内容（含一行示例） */
export function buildImportDeleteTemplate() {
  const first = devices[0]
  const sample = [first ? first.license : 'LIC-8F2A-1043-7C61']
  const rows = [IMPORT_DELETE_HEADERS.join(','), sample.map((value) => `"${value}"`).join(',')]
  return `\uFEFF${rows.join('\n')}`
}

/**
 * 解析并逐行核对批量删除文件内容。
 * 命中：该 License 在本企业设备中存在，可被删除；
 * 未命中：库内不存在该 License（可能已被删除或填写有误），跳过并给出原因。
 */
export function parseImportDeleteRows(content: string): ImportDeleteRow[] {
  const lines = content
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .filter((line) => line.trim())

  const rows: ImportDeleteRow[] = []
  const seen = new Map<string, number>()
  lines.slice(1).forEach((line, index) => {
    const values = parseCsvLine(line)
    const license = normalizeText(values[0] ?? '')
    const lineNo = index + 2
    let error = ''
    if (!license) error = '缺少必填项：License'
    else {
      const key = license.toLowerCase()
      const first = seen.get(key)
      if (first !== undefined) error = `License 重复：${license}（与第 ${first} 行重复）`
      else seen.set(key, lineNo)
    }
    const device = error ? null : devices.find((item) => item.license.toLowerCase() === license.toLowerCase()) ?? null
    if (!error && !device) error = `设备不存在：${license}（可能已被删除或填写有误）`
    rows.push({ lineNo, license, device, error })
  })
  return rows
}

/** 执行批量删除：仅删除命中行，未命中行跳过；部分成功语义 */
export async function deleteDevicesByLicense(rows: ImportDeleteRow[]): Promise<BatchResult> {
  await delay(520)
  let success = 0
  let skipped = 0
  rows.forEach((row) => {
    const index = row.device ? devices.findIndex((item) => item.id === (row.device as Device).id) : -1
    if (index < 0) {
      skipped += 1
      return
    }
    const [removed] = devices.splice(index, 1)
    pushLog(
      '删除设备',
      removed,
      `批量导入删除设备「${removed.name}」（License ${removed.license}），原所属用能单元 ${unitPath(removed.unitId)}`,
    )
    success += 1
  })
  persistDevices()
  persistLogs()
  return { success, skipped }
}

/** 生成批量删除的未命中行报告 */
export function buildImportDeleteReport(rows: ImportDeleteRow[]) {
  const failed = rows.filter((row) => row.error)
  const header = ['行号', '原因', ...IMPORT_DELETE_HEADERS]
  const body = failed.map((row) =>
    [String(row.lineNo), row.error, row.license].map((value) => `"${value.replace(/"/g, '""')}"`).join(','),
  )
  return `\uFEFF${[header.join(','), ...body].join('\n')}`
}

/** 触发浏览器下载（仅原型演示用） */
export function downloadText(fileName: string, content: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.click()
  URL.revokeObjectURL(url)
}

/* ---------- 变更记录 ---------- */

function pushLog(type: DeviceChangeType, device: Device, detail: string) {
  logs.unshift({
    id: `DLOG-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    at: Date.now(),
    account: currentOperator(),
    type,
    deviceId: device.id,
    target: `${device.name}（${device.imei}）`,
    detail,
  })
  if (logs.length > 300) logs.splice(300)
}

function writeLog(type: DeviceChangeType, device: Device, detail: string) {
  pushLog(type, device, detail)
  persistLogs()
}

/** 某台设备的变更记录（详情页「变更记录」区块） */
export function deviceLogs(deviceId: string) {
  return logs.filter((log) => log.deviceId === deviceId)
}

/* ---------- 选项常量 ---------- */

export const ACCESS_STATUS_OPTIONS: AccessStatus[] = ['待接入', '已接入']
export const ONLINE_STATUS_OPTIONS: OnlineStatus[] = ['在线', '离线']
