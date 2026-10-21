/**
 * 【原型说明】平台「客户&设备」只读视图的业务逻辑，仅用于原型交互验证，非生产代码。
 * 业务规则对齐《产品需求文档-客户与设备》v1.0：
 * - 页面形态对齐企业端「设备台账」（查询条件区 + 列表容器），差异点见 PRD 6.2；
 * - 列表与查询条件均以「所属企业」为首项；仅列表样式、无操作项、无新增 / 导入 / 批量删除；
 * - 查询区上方提供规模统计区（企业总数 / 设备总数 / 在线设备数 / 在线率），随查询条件联动。
 */

import { computed, reactive, watch } from 'vue'
import { readJSON, writeJSON } from '@/shared/utils/storage'
import { PRESET_ENTERPRISES, PRESET_ENTERPRISE_UNITS, PRESET_PLATFORM_DEVICES, platformUnitPathText } from '../mock/seed'
import type {
  PlatformCustomerStats,
  PlatformDevice,
  PlatformDeviceFilters,
  PlatformEnterprise,
  PlatformMqttLog,
  PlatformSessionEvent,
  PlatformUnitNode,
} from './types'

/* ---------- 基础数据 ---------- */

/** 全部企业（用于「所属企业」筛选下拉） */
export function platformEnterprises(): PlatformEnterprise[] {
  return PRESET_ENTERPRISES
}

/** 全部设备（只读全量样本） */
export function platformDevices(): PlatformDevice[] {
  return PRESET_PLATFORM_DEVICES
}

export function getPlatformDevice(id: string): PlatformDevice | null {
  return PRESET_PLATFORM_DEVICES.find((device) => device.id === id) ?? null
}

/** 企业名称 → 企业 */
export function findEnterpriseByName(name: string): PlatformEnterprise | null {
  return PRESET_ENTERPRISES.find((item) => item.name === name) ?? null
}

/** 用能单元完整层级路径（只读展示口径） */
export const platformUnitPath = platformUnitPathText

/** 企业根节点 id（用于树选择的顶级 = 企业，也用于「所属企业」筛选口径） */
export const ENTERPRISE_ROOT_PREFIX = 'ENT-ROOT-'

/**
 * 某企业下的用能单元树（用于「所属用能单元」树选择）。
 * 顶级节点即为该企业本身（与列表「所属用能单元」路径最顶级一致），其下为其用能单元。
 * 未选企业时返回空（此时查询框为文本模糊匹配，不展示树）。
 */
export function enterpriseUnitTree(enterpriseId: string | null): PlatformUnitNode[] {
  if (!enterpriseId) return []
  const enterprise = PRESET_ENTERPRISES.find((item) => item.id === enterpriseId)
  if (!enterprise) return []
  const units = PRESET_ENTERPRISE_UNITS[enterpriseId] ?? []
  return [{ id: `${ENTERPRISE_ROOT_PREFIX}${enterpriseId}`, name: enterprise.name, children: units }]
}

/** 设备类型选项（去重） */
export function platformDeviceTypeOptions(): string[] {
  return [...new Set(PRESET_PLATFORM_DEVICES.map((device) => device.type).filter(Boolean))]
}

export const PLATFORM_LATCH_OPTIONS: Array<'合闸' | '分闸'> = ['合闸', '分闸']
export const PLATFORM_ONLINE_OPTIONS: Array<'在线' | '离线'> = ['在线', '离线']

/* ---------- 查询与统计 ---------- */

/** 判定设备是否落在某用能单元子树内（命中自身或其任一上级） */
function unitInScope(deviceUnitId: string, scopeUnitId: string): boolean {
  if (deviceUnitId === scopeUnitId) return true
  // 通过路径文本前缀匹配父子关系（演示数据同企业内路径唯一）
  const devicePath = platformUnitPathText(deviceUnitId)
  const scopePath = platformUnitPathText(scopeUnitId)
  return devicePath.startsWith(`${scopePath} /`)
}

function matchFilters(device: PlatformDevice, filters: PlatformDeviceFilters): boolean {
  if (filters.enterpriseId && device.enterpriseId !== filters.enterpriseId) return false
  if (filters.unitId && !unitInScope(device.unitId, filters.unitId)) return false
  if (filters.unitText) {
    const keyword = filters.unitText.trim().toLowerCase()
    if (!platformUnitPathText(device.unitId).toLowerCase().includes(keyword)) return false
  }
  if (filters.name && !device.name.includes(filters.name)) return false
  if (filters.imei && !device.imei.includes(filters.imei)) return false
  if (filters.license && !device.license.includes(filters.license)) return false
  if (filters.meterNo && !device.meterNo.includes(filters.meterNo)) return false
  if (filters.types.length && !filters.types.includes(device.type)) return false
  if (filters.latchStatuses.length) {
    if (!device.latchStatus || !filters.latchStatuses.includes(device.latchStatus)) return false
  }
  if (filters.onlineStatuses.length && !filters.onlineStatuses.includes(device.onlineStatus)) return false
  return true
}

export function filterPlatformDevices(filters: PlatformDeviceFilters): PlatformDevice[] {
  return PRESET_PLATFORM_DEVICES.filter((device) => matchFilters(device, filters))
}

/** 排序：仅按添加时间两态切换（默认倒序） */
export function sortPlatformDevices(list: PlatformDevice[], order: 'descend' | 'ascend'): PlatformDevice[] {
  return [...list].sort((a, b) => (order === 'descend' ? b.createdAt - a.createdAt : a.createdAt - b.createdAt))
}

/**
 * 规模统计区口径：
 * - 未按企业筛选时按**全平台**汇总（企业总数 = 全部企业；设备总数 / 在线数 = 各企业口径之和）；
 * - 选定「所属企业」后按该企业口径统计。
 */
export function platformCustomerStats(filters: PlatformDeviceFilters): PlatformCustomerStats {
  if (!filters.enterpriseId) {
    const deviceCount = PRESET_ENTERPRISES.reduce((total, item) => total + item.deviceCount, 0)
    const onlineDeviceCount = PRESET_ENTERPRISES.reduce((total, item) => total + item.onlineCount, 0)
    return {
      enterpriseCount: PRESET_ENTERPRISES.length,
      deviceCount,
      onlineDeviceCount,
      onlineRate: deviceCount > 0 ? Math.round((onlineDeviceCount / deviceCount) * 1000) / 10 : null,
    }
  }
  const enterprise = PRESET_ENTERPRISES.find((item) => item.id === filters.enterpriseId)
  if (!enterprise) {
    return { enterpriseCount: 0, deviceCount: 0, onlineDeviceCount: 0, onlineRate: null }
  }
  return {
    enterpriseCount: 1,
    deviceCount: enterprise.deviceCount,
    onlineDeviceCount: enterprise.onlineCount,
    onlineRate:
      enterprise.deviceCount > 0
        ? Math.round((enterprise.onlineCount / enterprise.deviceCount) * 1000) / 10
        : null,
  }
}

/* ---------- 设备 MQTT 通讯日志（只读，最近 30 天） ---------- */

const MINUTE = 60 * 1000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR
const KEEP_DAYS = 30

const UPLOAD_EVENTS = [
  { event: '数据上报', topic: 'up/data', payload: '{"voltage":220.4,"current":186.2,"power":41.02}' },
  { event: '心跳', topic: 'up/heartbeat', payload: '{"rssi":-68,"csq":21}' },
  { event: '数据上报', topic: 'up/data', payload: '{"energyTotal":128430.6,"energyForward":128430.6}' },
  { event: '参数回读', topic: 'up/param', payload: '{"reportInterval":300,"meterAddr":"000000000001"}' },
]
const DOWNLINK_EVENTS = [
  { event: '校时', topic: 'down/time-sync', payload: '{"serverTime":"2026-09-28 10:20:00","timezone":"UTC+8"}' },
  { event: '抄表', topic: 'down/read-meter', payload: '{"items":["energyTotal","voltage","current"]}' },
  { event: '合闸', topic: 'down/switch', payload: '{"action":"close","reason":"远程复电"}' },
  { event: '分闸', topic: 'down/switch', payload: '{"action":"open","reason":"欠费停电"}' },
  { event: '参数下发', topic: 'down/param', payload: '{"reportInterval":600,"freezeTime":"00:00"}' },
]
const FAIL_REASONS = ['设备响应超时（5s）', '信号强度不足，上行重传失败', '设备离线，指令下发失败', '报文校验失败']

/** 稳定伪随机：设备识别码作种子，保证同一设备每次生成的日志一致 */
function seeded(seed: number) {
  let value = seed % 2147483647
  if (value <= 0) value += 2147483646
  return () => {
    value = (value * 16807) % 2147483647
    return (value - 1) / 2147483646
  }
}
const seedOf = (text: string) => text.split('').reduce((total, char) => total + char.charCodeAt(0), 7)

/** 按需生成某平台设备最近 30 天的 MQTT 通讯日志（缓存，避免重复计算） */
const mqttCache = new Map<string, PlatformMqttLog[]>()

export function platformDeviceMqttLogs(deviceId: string): PlatformMqttLog[] {
  const cached = mqttCache.get(deviceId)
  if (cached) return cached
  const device = getPlatformDevice(deviceId)
  if (!device || !device.imei) {
    mqttCache.set(deviceId, [])
    return []
  }
  const random = seeded(seedOf(device.imei))
  const now = Date.now()
  const logs: PlatformMqttLog[] = []
  for (let day = KEEP_DAYS - 1; day >= 0; day -= 1) {
    if (device.onlineStatus === '离线' && day < 2) continue
    const count = 3 + Math.floor(random() * 4)
    for (let index = 0; index < count; index += 1) {
      const isDownlink = random() < 0.3
      const pool = isDownlink ? DOWNLINK_EVENTS : UPLOAD_EVENTS
      const picked = pool[Math.floor(random() * pool.length)]
      const failed = random() < 0.08
      const at = now - day * DAY - Math.floor(random() * 20) * HOUR - Math.floor(random() * 60) * MINUTE
      logs.push({
        id: `P-MQTT-${device.id}-${day}-${index}`,
        deviceId: device.id,
        at,
        direction: isDownlink ? '下行' : '上行',
        topic: `/esa/device/${device.imei}/${picked.topic}`,
        event: picked.event,
        result: failed ? '失败' : '成功',
        payload: failed ? '—' : picked.payload,
        cost: failed ? null : 60 + Math.floor(random() * 240),
        error: failed ? FAIL_REASONS[Math.floor(random() * FAIL_REASONS.length)] : '',
      })
    }
  }
  const sorted = logs.sort((a, b) => b.at - a.at)
  mqttCache.set(deviceId, sorted)
  return sorted
}

/** MQTT 日志概览：保留期内记录数、失败数、最早记录时间与保留天数 */
export function platformMqttSummary(deviceId: string) {
  const logs = platformDeviceMqttLogs(deviceId)
  return {
    total: logs.length,
    failed: logs.filter((log) => log.result === '失败').length,
    earliestAt: logs.length ? logs[logs.length - 1].at : null,
    keepDays: KEEP_DAYS,
  }
}

/* ---------- 设备上下线记录（只读，最近 30 天） ---------- */

const OFFLINE_GAP = 2 * DAY
const EVENT_LIMIT = 20
const OFFLINE_REASONS = ['设备主动断开（正常关机）', '现场断电，设备失联', '信号强度不足，连接中断', '心跳超时，平台判定离线', '设备重启']
const ONLINE_DETAILS = ['设备上电，建立连接', '信号恢复，重新接入平台', '心跳恢复正常，连接重建', '设备重启后重新接入']

interface RawSession {
  onlineAt: number
  offlineAt: number | null
}

const pick = (random: () => number, range: [number, number]) =>
  Math.floor(range[0] + random() * (range[1] - range[0]))

/** 离线设备的末段会话：已结束，且结束于至少 2 天前 */
function buildLatestSession(now: number, online: boolean, random: () => number, onlineRange: [number, number]): RawSession {
  if (online) {
    return { onlineAt: now - pick(random, onlineRange), offlineAt: null }
  }
  const offlineAt = now - OFFLINE_GAP - Math.floor(random() * 2 * DAY)
  return { onlineAt: offlineAt - pick(random, onlineRange), offlineAt }
}

/** 按需生成某平台设备最近 30 天的上下线事件流水（缓存，与 MQTT 日志同一保留口径） */
const sessionCache = new Map<string, PlatformSessionEvent[]>()

export function platformDeviceSessions(deviceId: string): PlatformSessionEvent[] {
  const cached = sessionCache.get(deviceId)
  if (cached) return cached
  const device = getPlatformDevice(deviceId)
  if (!device || !device.imei) {
    sessionCache.set(deviceId, [])
    return []
  }
  // 与 MQTT 日志使用不同乘数，拉开数据分布
  const random = seeded(device.imei.split('').reduce((total, char) => total + char.charCodeAt(0), 13))
  const now = Date.now()
  const windowStart = now - KEEP_DAYS * DAY
  const online = device.onlineStatus === '在线'
  const flapping = random() < 0.34
  const gapRange: [number, number] = flapping ? [2 * HOUR, 8 * HOUR] : [2 * DAY, 4 * DAY]
  const onlineRange: [number, number] = flapping ? [10 * MINUTE, 3 * HOUR] : [1 * HOUR, 20 * HOUR]

  const raw: RawSession[] = [buildLatestSession(now, online, random, onlineRange)]
  let count = online ? 1 : 2
  let cursor = raw[0].onlineAt - pick(random, gapRange)
  while (count + 2 <= EVENT_LIMIT) {
    const start = cursor - pick(random, onlineRange)
    if (start < windowStart) break
    raw.push({ onlineAt: start, offlineAt: cursor })
    count += 2
    cursor = start - pick(random, gapRange)
  }

  const events: PlatformSessionEvent[] = []
  raw
    .slice()
    .reverse()
    .forEach((item) => {
      events.push({
        id: `P-SESS-${device.id}-上线-${item.onlineAt}`,
        deviceId: device.id,
        at: item.onlineAt,
        type: '上线',
        detail: ONLINE_DETAILS[Math.floor(random() * ONLINE_DETAILS.length)],
      })
      if (item.offlineAt !== null) {
        events.push({
          id: `P-SESS-${device.id}-离线-${item.offlineAt}`,
          deviceId: device.id,
          at: item.offlineAt,
          type: '离线',
          detail: OFFLINE_REASONS[Math.floor(random() * OFFLINE_REASONS.length)],
        })
      }
    })
  const sorted = events.sort((a, b) => b.at - a.at)
  sessionCache.set(deviceId, sorted)
  return sorted
}

/** 上下线概览：保留期内全量口径（上线 / 掉线次数、最近掉线） */
export function platformSessionSummary(deviceId: string) {
  const list = platformDeviceSessions(deviceId)
  return {
    onlineCount: list.filter((item) => item.type === '上线').length,
    offlineCount: list.filter((item) => item.type === '离线').length,
    latestOfflineAt: list.find((item) => item.type === '离线')?.at ?? null,
    keepDays: KEEP_DAYS,
  }
}

/* ---------- 列设置（展示与顺序） ---------- */
/**
 * 客户&设备列表列元数据：key 与表格列一一对应。
 * 与企业端「设备台账」的列保持一致（仅去掉平台端不提供的「操作」列）；
 * 「所属企业」通过「所属用能单元」的顶级层级体现，不再单列。
 */
export interface PlatformColumnMeta {
  key: string
  title: string
  /** 列宽（px），同时用于表格 scroll.x 的计算 */
  width: number
  /** 核心列：常驻显示，不允许隐藏 */
  core?: boolean
  /** 固定列：'start' 锁定左侧；固定列不参与拖动排序 */
  fixed?: 'start'
  /** 默认隐藏：初始不在列表展示，可由用户在「列设置」中勾选显示 */
  hidden?: boolean
}

/**
 * 默认列清单与顺序（与企业端设备台账一致，去掉「操作」列）。
 * 列宽按「max(表头宽, 内容宽) + 一致留白」标定，使相邻列文字间距接近一致；
 * 路径类长文本列（用能单元、设备名称）仍走折行 / 省略。
 */
export const PLATFORM_COLUMNS: PlatformColumnMeta[] = [
  { key: 'unit', title: '所属用能单元', width: 248, fixed: 'start' },
  { key: 'name', title: '设备名称', width: 148, core: true, fixed: 'start' },
  { key: 'license', title: 'License', width: 128 },
  { key: 'imei', title: '设备识别码（IMEI）', width: 180 },
  { key: 'meterNo', title: '表号', width: 120 },
  { key: 'cardNo', title: '卡号', width: 192 },
  { key: 'type', title: '设备类型', width: 124 },
  { key: 'model', title: '规格型号', width: 140, hidden: true },
  { key: 'ratio', title: 'CT/PT 值', width: 124, hidden: true },
  { key: 'latchStatus', title: '拉合闸状态', width: 104, hidden: true },
  { key: 'strategy', title: '关联负荷策略', width: 152, hidden: true },
  { key: 'onlineStatus', title: '在线状态', width: 108 },
  { key: 'createdAt', title: '添加时间', width: 128 },
]

const columnMap = new Map(PLATFORM_COLUMNS.map((column) => [column.key, column]))

export const isPlatformCoreColumn = (key: string) => Boolean(columnMap.get(key)?.core)
export const isPlatformFixedColumn = (key: string) => Boolean(columnMap.get(key)?.fixed)

interface PlatformColumnPrefs {
  order: string[]
  hidden: string[]
}

const defaultHiddenKeys = () => PLATFORM_COLUMNS.filter((column) => column.hidden).map((column) => column.key)

const defaultPrefs = (): PlatformColumnPrefs => ({
  order: PLATFORM_COLUMNS.map((column) => column.key),
  hidden: defaultHiddenKeys(),
})

/** 归一化偏好：补全新列、剔除未知列、固定列回到左端、核心列与固定列不允许隐藏 */
function normalizePlatformPrefs(raw: Partial<PlatformColumnPrefs> | null): PlatformColumnPrefs {
  const stored = Array.isArray(raw?.order) ? raw.order : []
  const known = stored.filter((key) => columnMap.has(key))
  const missing = PLATFORM_COLUMNS.map((column) => column.key).filter((key) => !known.includes(key))
  const all = [...known, ...missing]
  const head = all.filter((key) => columnMap.get(key)?.fixed === 'start')
  const middle = all.filter((key) => !columnMap.get(key)?.fixed)
  const hidden = (Array.isArray(raw?.hidden) ? raw.hidden : []).filter(
    (key) => columnMap.has(key) && !isPlatformCoreColumn(key) && !isPlatformFixedColumn(key),
  )
  missing.forEach((key) => {
    if (columnMap.get(key)?.hidden && !hidden.includes(key)) hidden.push(key)
  })
  return { order: [...head, ...middle], hidden }
}

const platformColumnPrefsKey = 'proto_platform_customer_columns'
const prefs = reactive<PlatformColumnPrefs>(normalizePlatformPrefs(readJSON(platformColumnPrefsKey, null)))

watch(
  prefs,
  () => writeJSON(platformColumnPrefsKey, { order: prefs.order, hidden: prefs.hidden }),
  { deep: true },
)

export const orderedPlatformColumnMetas = computed(() =>
  prefs.order.map((key) => columnMap.get(key) as PlatformColumnMeta),
)

export const visiblePlatformColumnMetas = computed(() =>
  orderedPlatformColumnMetas.value.filter((column) => !prefs.hidden.includes(column.key)),
)

export const isPlatformColumnVisible = (key: string) => !prefs.hidden.includes(key)

/** 勾选 / 取消勾选某列；核心列与固定列不允许隐藏 */
export function setPlatformColumnVisible(key: string, visible: boolean) {
  if (isPlatformCoreColumn(key) || isPlatformFixedColumn(key)) return
  const hidden = new Set(prefs.hidden)
  if (visible) hidden.delete(key)
  else hidden.add(key)
  prefs.hidden = Array.from(hidden)
}

/** 拖动排序：把 dragKey 移动到 dropKey 所在位置（仅在非固定列之间生效） */
export function movePlatformColumn(dragKey: string, dropKey: string) {
  if (dragKey === dropKey) return
  if (isPlatformFixedColumn(dragKey) || isPlatformFixedColumn(dropKey)) return
  const movable = prefs.order.filter((key) => !isPlatformFixedColumn(key))
  const from = movable.indexOf(dragKey)
  const to = movable.indexOf(dropKey)
  if (from < 0 || to < 0) return
  movable.splice(to, 0, ...movable.splice(from, 1))
  const head = prefs.order.filter((key) => columnMap.get(key)?.fixed === 'start')
  prefs.order = [...head, ...movable]
}

/** 恢复默认列顺序与全部显示 */
export function resetPlatformColumnPrefs() {
  Object.assign(prefs, defaultPrefs())
}
