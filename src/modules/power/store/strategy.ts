/**
 * 【原型说明】负荷策略的业务逻辑，仅用于原型交互验证。
 * 业务规则对齐《产品需求文档-负荷策略》v0.1：
 * - 触发方式两类：时控（按日 / 按周 / 一次性周期 + 时间点）与负控（复用告警中心事件类型）
 * - 作用用电单元必选（仅用能单元），作用设备选填；留空表示所选用电单元下的全部设备（动态范围）
 * - 生效期：开始日期必填、结束日期选填（留空即长期有效）；与启用状态正交
 * - 停用需二次确认、启用直接生效；拉合闸配置与设备控制的人工指令分开授权
 * - 多策略冲突采用「拉闸优先」固定裁决；本期不做保存期冲突拦截
 * - 负控按「事件 + 动作」成对配置，命中指定事件即执行对应动作（事件类型复用告警中心字典）
 *
 * 【原型模拟说明】策略触发与设备回执以内存规则模拟；离线设备记为「已跳过」，
 * 在线设备按小概率记为「失败」，用于验证记录中的失败与跳过路径。
 */

import { session } from '@/modules/auth/store'
import { maskIdentifier } from '@/shared/utils/mask'
import { devices, unitPath } from '@/modules/device/store'
import type { Device } from '@/modules/device/store'
import { getNode, getSubtreeIds, nodes as orgNodes } from '@/modules/org/store'
import {
  DELAY_MAX,
  DELAY_MIN,
  STRATEGY_NAME_MAX,
  STRATEGY_NAME_MIN,
} from './constants'
import { execBatches, latches, persistExecBatches, persistLatches, persistStrategies, persistStrategyLogs, strategies, strategyLogs } from './storage'
import type {
  ActionType,
  BatchResult,
  CycleType,
  EffectiveState,
  EventRule,
  ExecBatch,
  ExecDeviceResult,
  Strategy,
  StrategyChangeType,
  StrategyFilters,
  StrategyInput,
  TimePoint,
  TriggerType,
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

const pad2 = (value: number) => String(value).padStart(2, '0')

/** 时间统一格式 YYYY-MM-DD HH:mm */
export function formatTime(at: number | null) {
  if (!at) return '—'
  const date = new Date(at)
  return `${formatDate(at)} ${pad2(date.getHours())}:${pad2(date.getMinutes())}`
}

/** 展示到日期 YYYY-MM-DD */
export function formatDate(at: number) {
  const date = new Date(at)
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
}

/** 今天的日期字符串（YYYY-MM-DD） */
export function todayText() {
  return formatDate(Date.now())
}

/** 时刻（HH:mm） */
export function formatClock(time: string) {
  return time || '—'
}

/* ---------- 字典与选项 ---------- */

export const TRIGGER_TYPE_OPTIONS: TriggerType[] = ['时控', '负控']
export const CYCLE_TYPE_OPTIONS: CycleType[] = ['按日', '按周', '一次性']
export const ACTION_OPTIONS: ActionType[] = ['拉闸', '合闸']
export const STATUS_OPTIONS: Array<'启用' | '停用'> = ['启用', '停用']

/** 星期选项：值为 1-7（1 = 周一） */
export const WEEKDAY_OPTIONS: Array<{ label: string; value: number }> = [
  { label: '周一', value: 1 },
  { label: '周二', value: 2 },
  { label: '周三', value: 3 },
  { label: '周四', value: 4 },
  { label: '周五', value: 5 },
  { label: '周六', value: 6 },
  { label: '周日', value: 7 },
]

const WEEKDAY_NAMES = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']

/**
 * 星期摘要：连续星期压缩为区间（周一至周五），不连续以「、」连接（周一、周三、周五）。
 * 全部 7 天时展示「每天」。
 */
export function weekdayText(weekdays: number[]) {
  const sorted = [...weekdays].sort((a, b) => a - b)
  if (!sorted.length) return '—'
  if (sorted.length === 7) return '每天'

  const ranges: Array<[number, number]> = []
  let start = sorted[0]
  let prev = sorted[0]
  for (let index = 1; index < sorted.length; index += 1) {
    const current = sorted[index]
    if (current === prev + 1) {
      prev = current
      continue
    }
    ranges.push([start, prev])
    start = current
    prev = current
  }
  ranges.push([start, prev])

  return ranges
    .map(([from, to]) => {
      if (from === to) return WEEKDAY_NAMES[from - 1]
      if (to === from + 1) return `${WEEKDAY_NAMES[from - 1]}、${WEEKDAY_NAMES[to - 1]}`
      return `${WEEKDAY_NAMES[from - 1]}至${WEEKDAY_NAMES[to - 1]}`
    })
    .join('、')
}

/** 时间点摘要片段：超过 2 条时保留前 2 条并以「等 N 个时间点」收尾 */
function timePointSegments(points: TimePoint[], prefix: string): Array<{ text: string; action?: ActionType }> {
  const sorted = sortTimePoints(points)
  const shown = sorted.slice(0, 2)
  const segments: Array<{ text: string; action?: ActionType }> = []
  if (prefix) segments.push({ text: prefix })
  shown.forEach((item, index) => {
    if (index > 0) segments.push({ text: ' · ' })
    segments.push({ text: `${item.time} ` })
    segments.push({ text: item.action, action: item.action })
  })
  if (sorted.length > 2) segments.push({ text: ` 等 ${sorted.length} 个时间点` })
  return segments
}

/**
 * 列表「策略周期 / 触发条件」列的摘要片段。
 * 时控按周期类型给出周期前缀；负控给出「事件 → 动作」摘要。
 * 返回片段以便界面按动作着色（拉闸 / 合闸用不同颜色）。
 */
export function summarySegments(
  strategy: Pick<Strategy, 'triggerType' | 'cycleType' | 'weekdays' | 'onceDate' | 'timePoints' | 'eventRules'>,
): Array<{ text: string; action?: ActionType }> {
  if (strategy.triggerType === '负控') {
    const rules = strategy.eventRules
    if (!rules.length) return [{ text: '—' }]
    const segments: Array<{ text: string; action?: ActionType }> = []
    rules.slice(0, 2).forEach((rule, index) => {
      if (index > 0) segments.push({ text: ' · ' })
      segments.push({ text: `${rule.event} ` })
      segments.push({ text: rule.action, action: rule.action })
    })
    if (rules.length > 2) segments.push({ text: ` 等 ${rules.length} 条规则` })
    return segments
  }
  if (!strategy.timePoints.length) return [{ text: '—' }]
  if (strategy.cycleType === '按周') {
    return timePointSegments(strategy.timePoints, `${weekdayText(strategy.weekdays)} `)
  }
  if (strategy.cycleType === '一次性') {
    return timePointSegments(strategy.timePoints, `${strategy.onceDate || '—'} `)
  }
  return timePointSegments(strategy.timePoints, '每日 ')
}

/** 摘要纯文本（用于 title 提示与对比弹窗） */
export function summaryText(
  strategy: Pick<Strategy, 'triggerType' | 'cycleType' | 'weekdays' | 'onceDate' | 'timePoints' | 'eventRules'>,
) {
  return summarySegments(strategy)
    .map((segment) => segment.text)
    .join('')
}

/** 周期的完整描述（详情浮层使用，不摘要） */
export function cycleText(strategy: Pick<Strategy, 'triggerType' | 'cycleType' | 'weekdays' | 'onceDate'>) {
  if (strategy.triggerType === '负控') return '命中告警事件时触发'
  if (strategy.cycleType === '按周') return `按周 · ${weekdayText(strategy.weekdays)}`
  if (strategy.cycleType === '一次性') return `一次性 · ${strategy.onceDate || '—'}`
  return '按日'
}

/** 时间点按时刻升序排序（列表与详情统一按时间呈现） */
export function sortTimePoints(points: TimePoint[]) {
  return [...points].sort((a, b) => a.time.localeCompare(b.time))
}

/* ---------- 生效状态与生效期 ---------- */

/**
 * 生效状态：由「启用状态 + 生效期 + 当前时间」推导，不是人工状态（PRD 5.2）。
 * 停用 → 未生效；未到开始日期 → 待生效；超过结束日期 → 已过期；其余 → 生效中。
 */
export function effectiveStateOf(strategy: Strategy): EffectiveState {
  if (!strategy.enabled) return '未生效'
  const today = todayText()
  if (strategy.startDate && today < strategy.startDate) return '待生效'
  if (strategy.endDate && today > strategy.endDate) return '已过期'
  return '生效中'
}

/** 生效期展示文本 */
export function effectiveRangeText(strategy: Pick<Strategy, 'startDate' | 'endDate'>) {
  if (!strategy.startDate) return '—'
  return strategy.endDate ? `${strategy.startDate} ~ ${strategy.endDate}` : `${strategy.startDate} ~ 长期有效`
}

/** 策略是否参与触发与冲突裁决：仅「启用」且「生效中」参与（PRD 6.4） */
export function isActive(strategy: Strategy) {
  return effectiveStateOf(strategy) === '生效中'
}

/* ---------- 作用范围 ---------- */

/** 作用设备是否留空（留空 = 所选用电单元下的全部设备，动态范围） */
export const isWholeScope = (strategy: Pick<Strategy, 'deviceIds'>) => strategy.deviceIds.length === 0

/**
 * 解析作用范围内的目标设备清单。
 * 作用设备留空 → 所选用电单元（及其全部下级）下的全部设备（动态范围）；
 * 作用设备非空 → 仅显式选中的设备（静态范围，且须落在作用用电单元内）。
 */
export function resolveScopeDevices(strategy: Pick<Strategy, 'unitIds' | 'deviceIds'>): Device[] {
  const scopeUnitIds = new Set<string>()
  strategy.unitIds.forEach((unitId) => {
    getSubtreeIds(unitId).forEach((id) => scopeUnitIds.add(id))
  })
  if (!scopeUnitIds.size) return []

  if (isWholeScope(strategy)) {
    return devices.filter((device) => scopeUnitIds.has(device.unitId))
  }
  return devices.filter((device) => strategy.deviceIds.includes(device.id) && scopeUnitIds.has(device.unitId))
}

/** 作用范围的设备统计：总数与其中离线台数（用于保存前的范围回显） */
export function scopeStats(strategy: Pick<Strategy, 'unitIds' | 'deviceIds'>) {
  const list = resolveScopeDevices(strategy)
  return {
    total: list.length,
    offline: list.filter((device) => device.onlineStatus !== '在线').length,
  }
}

/**
 * 某台设备关联的负荷策略（设备台账详情页展示）。
 * 判定口径与作用范围解析一致：显式选中该设备，或在该策略作用用电单元下由动态范围覆盖。
 */
export function strategiesForDevice(deviceId: string): Strategy[] {
  return strategies.filter((strategy) =>
    resolveScopeDevices(strategy).some((device) => device.id === deviceId),
  )
}

/** 设备关联负荷策略的条数汇总（时控 / 负控分开统计），供设备台账列表按列展示 */
export interface DeviceStrategyCount {
  time: number
  load: number
}

/**
 * 全量设备的关联策略条数索引：设备 id → { 时控, 负控 }。
 * 一次性遍历全部策略解析作用范围，避免列表逐行调用时的重复计算。
 */
export function strategyCountsByDevice(): Map<string, DeviceStrategyCount> {
  const map = new Map<string, DeviceStrategyCount>()
  strategies.forEach((strategy) => {
    resolveScopeDevices(strategy).forEach((device) => {
      const entry = map.get(device.id) ?? { time: 0, load: 0 }
      if (strategy.triggerType === '时控') entry.time += 1
      else entry.load += 1
      map.set(device.id, entry)
    })
  })
  return map
}

/** 可在作用用电单元范围内选择的设备（作用设备选择器的选项来源） */
export function selectableDevices(unitIds: string[]): Device[] {
  const scopeUnitIds = new Set<string>()
  unitIds.forEach((unitId) => {
    getSubtreeIds(unitId).forEach((id) => scopeUnitIds.add(id))
  })
  if (!scopeUnitIds.size) return []
  return devices.filter((device) => scopeUnitIds.has(device.unitId))
}

/** 作用用电单元的完整层级路径（多选时返回全部） */
export function scopeUnitPaths(strategy: Pick<Strategy, 'unitIds'>) {
  return strategy.unitIds.map((unitId) => ({ unitId, path: unitPath(unitId) }))
}

/** 用能单元是否已失效（曾被选中但节点已被删除） */
export const isUnitInvalid = (unitId: string) => !getNode(unitId)

/**
 * 用能单元的简洁层级路径：去掉企业根节点，只保留园区 / 厂房 / 单元。
 * 企业名在全平台一致且冗长，分组标题这类空间受限的场景下省略它更利于扫读。
 */
export function unitShortPath(unitId: string) {
  const full = unitPath(unitId)
  const parts = full.split(' / ')
  return parts.length > 1 ? parts.slice(1).join(' / ') : full
}

/** 作用用电单元按所属组织节点分组后的结果 */
export interface ScopeUnitGroup {
  /** 分组键：所属组织节点标识；无归属时为固定键 */
  key: string
  /** 分组标题（所属组织节点的简洁层级路径） */
  path: string
  units: Array<{ unitId: string; name: string; invalid: boolean }>
}

/**
 * 作用用电单元按所属组织节点分组。
 * 作用几十个单元时，逐个展示完整路径会重复大量上级路径；分组后上级路径只出现一次，
 * 详情弹窗与作用对象抽屉共用本函数，保证两处呈现口径一致。
 */
export function groupScopeUnits(unitIds: string[]): ScopeUnitGroup[] {
  const groups = new Map<string, ScopeUnitGroup>()
  unitIds.forEach((unitId) => {
    const node = getNode(unitId)
    const parentId = node?.parentId ?? ''
    const key = parentId || 'SCOPE-UNIT-UNASSIGNED'
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        path: parentId ? unitShortPath(parentId) : '未归属组织节点',
        units: [],
      })
    }
    groups.get(key)!.units.push({
      unitId,
      name: node?.name ?? '未知单元',
      invalid: !node,
    })
  })
  return [...groups.values()]
}

/**
 * 作用用电单元的树选择数据（多选 + 勾选）。
 * **仅用能单元可勾选**：组织节点与企业根节点只作路径展示，其勾选框被禁用，
 * 因此选择结果中不会出现非用能单元的节点标识（与设备迁移的目标口径一致）。
 */
export function unitCheckTreeData() {
  const childrenOf = (parentId: string | null) =>
    orgNodes.filter((node) => node.parentId === parentId).sort((a, b) => a.order - b.order)

  const build = (parentId: string | null): Array<Record<string, unknown>> =>
    childrenOf(parentId).map((node) => {
      const children = build(node.id)
      const selectable = node.kind === 'unit'
      return {
        value: node.id,
        title: node.name,
        // 仅用能单元可勾选；组织节点仅用于展示层级路径
        disableCheckbox: !selectable,
        checkable: selectable,
        children: children.length ? children : undefined,
      }
    })
  return build(null)
}

/** 过滤出合法的用能单元标识（防止树联动带回非用能单元节点） */
export function sanitizeUnitIds(unitIds: string[]) {
  return unitIds.filter((unitId) => getNode(unitId)?.kind === 'unit')
}

/* ---------- 查询与排序 ---------- */

/** 按条件查询策略；多个维度之间为「且」关系 */
export function filterStrategies(filters: StrategyFilters): Strategy[] {
  const keyword = normalizeText(filters.keyword).toLowerCase()
  return strategies.filter((strategy) => {
    if (keyword && !strategy.name.toLowerCase().includes(keyword)) return false
    if (filters.triggerTypes.length && !filters.triggerTypes.includes(strategy.triggerType)) return false
    if (filters.statuses.length) {
      const status = strategy.enabled ? '启用' : '停用'
      if (!filters.statuses.includes(status)) return false
    }
    return true
  })
}

/** 列表顺序固定按创建时间倒序（最新创建的在前），不提供排序切换 */
export function sortStrategies(list: Strategy[]): Strategy[] {
  return [...list].sort((a, b) => b.createdAt - a.createdAt)
}

/** 企业是否已有任何策略：用于区分「暂无策略」与「查询无结果」 */
export const hasAnyStrategy = () => strategies.length > 0

export const getStrategy = (id: string) => strategies.find((strategy) => strategy.id === id) ?? null

/* ---------- 校验 ---------- */

export interface StrategyFormErrors {
  name?: string
  cycleType?: string
  weekdays?: string
  onceDate?: string
  timePoints?: string
  duplicatePoint?: string
  eventRules?: string
  duplicateEvent?: string
  delay?: string
  unitIds?: string
  dateRange?: string
}

/** 策略名称唯一性校验（企业内、不区分大小写） */
export function validateStrategyName(name: string, excludeId?: string): string | null {
  const value = normalizeText(name)
  if (!value) return '请输入策略名称'
  if (value.length < STRATEGY_NAME_MIN) return `策略名称至少 ${STRATEGY_NAME_MIN} 个字符`
  if (value.length > STRATEGY_NAME_MAX) return `策略名称最多 ${STRATEGY_NAME_MAX} 个字符`
  const duplicated = strategies.some(
    (strategy) => strategy.id !== excludeId && strategy.name.toLowerCase() === value.toLowerCase(),
  )
  return duplicated ? '该策略名称已存在，请修改后重试' : null
}

/** 时间点是否存在「时间 + 动作」完全相同的重复条目 */
export function hasDuplicateTimePoint(points: TimePoint[]) {
  const seen = new Set<string>()
  return points.some((item) => {
    const key = `${item.time}-${item.action}`
    if (seen.has(key)) return true
    seen.add(key)
    return false
  })
}

/** 负控规则中是否存在同一事件的重复条目（同一事件只能配置一条规则） */
export function hasDuplicateEventRule(rules: EventRule[]) {
  const seen = new Set<string>()
  return rules.some((item) => {
    if (seen.has(item.event)) return true
    seen.add(item.event)
    return false
  })
}

/** 延时校验：0-60 的整数分钟 */
export function validateDelay(value: number): string | null {
  if (value === null || value === undefined || Number.isNaN(value)) return '请输入 0-60 之间的整数分钟'
  if (!Number.isInteger(value) || value < DELAY_MIN || value > DELAY_MAX) return '请输入 0-60 之间的整数分钟'
  return null
}

/** 表单整体校验：一次性返回全部错误，界面统一展示 */
export function validateStrategy(input: StrategyInput, excludeId?: string): StrategyFormErrors {
  const errors: StrategyFormErrors = {}

  const nameError = validateStrategyName(input.name, excludeId)
  if (nameError) errors.name = nameError

  if (input.triggerType === '时控') {
    if (!input.cycleType) errors.cycleType = '请选择周期'
    if (input.cycleType === '按周' && !input.weekdays.length) errors.weekdays = '请至少选择一个星期'
    if (input.cycleType === '一次性' && !input.onceDate) errors.onceDate = '请选择执行日期'
    if (!input.timePoints.length) errors.timePoints = '请至少添加一个时间点'
    else if (hasDuplicateTimePoint(input.timePoints)) errors.duplicatePoint = '存在重复的时间点，请调整后再保存'
  } else {
    if (!input.eventRules.length) errors.eventRules = '请至少添加一条触发规则'
    else if (input.eventRules.some((rule) => !rule.event)) errors.eventRules = '请为每条规则选择触发事件'
    else if (hasDuplicateEventRule(input.eventRules)) errors.duplicateEvent = '同一事件只能配置一条规则，请调整后再保存'
    const delayError = validateDelay(input.delay)
    if (delayError) errors.delay = delayError
  }

  if (!input.unitIds.length) errors.unitIds = '请选择作用的用电单元'
  if (input.endDate && input.startDate && input.endDate < input.startDate) {
    errors.dateRange = '生效结束日期不能早于开始日期'
  }

  return errors
}

export const hasFormError = (errors: StrategyFormErrors) => Object.keys(errors).length > 0

/* ---------- 增删改 ---------- */

let strategySeq = 0
function buildStrategyId() {
  strategySeq += 1
  const max = strategies.reduce((acc, item) => {
    const matched = /^LST-(\d+)$/.exec(item.id)
    return matched ? Math.max(acc, Number(matched[1])) : acc
  }, 0)
  return `LST-${String(Math.max(max, strategySeq) + 1).padStart(4, '0')}`
}

/** 新建策略：默认启用（PRD 决策：配好即生效） */
export function createStrategy(input: StrategyInput): Strategy {
  const now = Date.now()
  const strategy: Strategy = {
    id: buildStrategyId(),
    name: normalizeText(input.name),
    triggerType: input.triggerType,
    enabled: input.enabled,
    cycleType: input.triggerType === '时控' ? input.cycleType : null,
    weekdays: input.triggerType === '时控' && input.cycleType === '按周' ? [...input.weekdays].sort((a, b) => a - b) : [],
    onceDate: input.triggerType === '时控' && input.cycleType === '一次性' ? input.onceDate : '',
    timePoints: input.triggerType === '时控' ? sortTimePoints(input.timePoints) : [],
    eventRules: input.triggerType === '负控' ? input.eventRules.map((rule) => ({ ...rule })) : [],
    delay: input.triggerType === '负控' ? input.delay : 0,
    unitIds: [...input.unitIds],
    deviceIds: [...input.deviceIds],
    startDate: input.startDate,
    endDate: input.endDate,
    remark: normalizeText(input.remark),
    createdAt: now,
    createdBy: currentOperator(),
    updatedAt: now,
    updatedBy: currentOperator(),
  }
  strategies.push(strategy)
  persistStrategies()
  writeLog('新建策略', strategy, `新建${strategy.triggerType}策略，作用于 ${scopeStats(strategy).total} 台设备`)
  return strategy
}

/** 编辑策略：不改变创建信息与启用状态；变更写入系统日志 */
export function updateStrategy(id: string, input: StrategyInput): Strategy {
  const strategy = getStrategy(id)
  if (!strategy) throw new Error('该策略已被删除')

  const before = `${strategy.triggerType} · ${summaryText(strategy)}`
  strategy.name = normalizeText(input.name)
  strategy.triggerType = input.triggerType
  strategy.cycleType = input.triggerType === '时控' ? input.cycleType : null
  strategy.weekdays = input.triggerType === '时控' && input.cycleType === '按周' ? [...input.weekdays].sort((a, b) => a - b) : []
  strategy.onceDate = input.triggerType === '时控' && input.cycleType === '一次性' ? input.onceDate : ''
  strategy.timePoints = input.triggerType === '时控' ? sortTimePoints(input.timePoints) : []
  strategy.eventRules = input.triggerType === '负控' ? input.eventRules.map((rule) => ({ ...rule })) : []
  strategy.delay = input.triggerType === '负控' ? input.delay : 0
  strategy.unitIds = [...input.unitIds]
  strategy.deviceIds = [...input.deviceIds]
  strategy.startDate = input.startDate
  strategy.endDate = input.endDate
  strategy.remark = normalizeText(input.remark)
  strategy.updatedAt = Date.now()
  strategy.updatedBy = currentOperator()
  persistStrategies()

  const after = `${strategy.triggerType} · ${summaryText(strategy)}`
  writeLog('编辑策略', strategy, `变更前：${before}；变更后：${after}`)
  return strategy
}

/** 启用 / 停用策略：状态变更写入系统日志 */
export function toggleStrategy(id: string, enabled: boolean): Strategy {
  const strategy = getStrategy(id)
  if (!strategy) throw new Error('该策略已被删除')
  strategy.enabled = enabled
  strategy.updatedAt = Date.now()
  strategy.updatedBy = currentOperator()
  persistStrategies()
  writeLog(enabled ? '启用策略' : '停用策略', strategy, enabled ? '启用策略' : '停用策略，不再自动拉合闸')
  return strategy
}

/** 删除策略：策略被移除，但已产生的执行记录保留 */
export function removeStrategy(id: string): Strategy {
  const index = strategies.findIndex((strategy) => strategy.id === id)
  if (index < 0) throw new Error('该策略已被删除')
  const [strategy] = strategies.splice(index, 1)
  persistStrategies()
  writeLog('删除策略', strategy, `删除${strategy.triggerType}策略，历史执行记录已保留`)
  return strategy
}

/** 该策略当前有设备处于「已拉闸且未合闸」状态（用于停用 / 删除的附加提示） */
export function latchedDevicesOf(strategyId: string) {
  return latches.filter((item) => item.latched && item.strategyId === strategyId)
}

/* ---------- 执行记录 ---------- */

/** 批次级结果：由批次内设备结果聚合 */
export function batchResultOf(batch: ExecBatch): BatchResult {
  const success = batch.devices.filter((item) => item.result === '成功').length
  const failed = batch.devices.filter((item) => item.result === '失败').length
  const skipped = batch.devices.filter((item) => item.result === '已跳过').length
  const total = batch.devices.length
  if (!total) return '已跳过'
  if (failed === 0 && skipped === 0) return '成功'
  if (success === 0 && skipped === 0) return '全部失败'
  if (success === 0 && failed === 0) return '已跳过'
  return '部分失败'
}

/** 批次结果汇总计数（用于详情与提示） */
export function countOfBatch(batch: ExecBatch) {
  return {
    success: batch.devices.filter((item) => item.result === '成功').length,
    failed: batch.devices.filter((item) => item.result === '失败').length,
    skipped: batch.devices.filter((item) => item.result === '已跳过').length,
    total: batch.devices.length,
  }
}

/** 全部执行批次：按执行时间倒序（最新在上） */
export function sortedBatches(): ExecBatch[] {
  return [...execBatches].sort((a, b) => b.at - a.at)
}

/** 单条批次的设备清单所属用能单元路径 */
export const deviceUnitPath = (unitId: string) => unitPath(unitId)

/* ---------- 设备闸位（用于冲突裁决与停用 / 删除提示） ---------- */

function setLatch(deviceId: string, latched: boolean, strategyId: string) {
  const existing = latches.find((item) => item.deviceId === deviceId)
  if (existing) {
    existing.latched = latched
    existing.strategyId = strategyId
    existing.at = Date.now()
  } else {
    latches.push({ deviceId, latched, strategyId, at: Date.now() })
  }
  persistLatches()
}

/** 某设备当前是否被其他启用中的策略要求保持拉闸（用于「拉闸优先」裁决） */
function blockedByOtherStrategy(deviceId: string, strategyId: string) {
  const latch = latches.find((item) => item.deviceId === deviceId && item.latched)
  if (!latch) return false
  if (latch.strategyId === strategyId) return false
  const other = strategies.find((item) => item.id === latch.strategyId)
  // 停用 / 过期 / 待生效的策略不参与裁决（PRD 6.4）
  return Boolean(other && isActive(other))
}

/* ---------- 策略执行（原型演示触发） ---------- */

let execSeq = 0

/** 批次的触发来源说明：时控给出周期与命中的时间点；负控给出命中的事件（合闸即事件解除） */
function triggerDetailOf(strategy: Strategy, action: ActionType) {
  if (strategy.triggerType === '负控') {
    const matched = strategy.eventRules.find((rule) => rule.action === action) ?? strategy.eventRules[0]
    if (!matched) return '—'
    return action === '合闸' ? `${matched.event} 解除` : matched.event
  }
  const points = sortTimePoints(strategy.timePoints)
  const point = points.find((item) => item.action === action) ?? points[0]
  if (!point) return '—'
  const prefix = strategy.cycleType === '按周' ? '按周' : strategy.cycleType === '一次性' ? '一次性' : '按日'
  return `${prefix} ${point.time}`
}

/** 生成一条执行批次：逐台判定可执行性，模拟回执结果 */
function buildBatch(strategy: Strategy, action: ActionType, targets: Device[]): ExecBatch {
  execSeq += 1
  const results: ExecDeviceResult[] = targets.map((device) => {
    if (device.onlineStatus !== '在线') {
      return {
        deviceId: device.id,
        deviceName: device.name,
        unitId: device.unitId,
        action,
        result: '已跳过',
        reason: '设备离线',
      }
    }
    // 【原型说明】小概率回执失败，用于验证失败提示与失败原因
    const failed = Math.random() < 0.12
    return {
      deviceId: device.id,
      deviceName: device.name,
      unitId: device.unitId,
      action,
      result: failed ? '失败' : '成功',
      reason: failed ? '设备离线或通信失败' : '',
    }
  })

  return {
    id: `EXB-${String(execSeq).padStart(4, '0')}-${Date.now().toString(36).slice(-4)}`,
    at: Date.now(),
    strategyId: strategy.id,
    strategyName: strategy.name,
    triggerType: strategy.triggerType,
    triggerDetail: triggerDetailOf(strategy, action),
    action,
    devices: results,
  }
}

/**
 * 策略触发：对作用范围内设备下发指定动作。
 * 时控由时间点给出动作；负控由命中的事件规则给出动作，未指定时取首条规则的动作。
 * 合闸请求先经过「拉闸优先」裁决：若其他启用中的策略仍要求拉闸，则拦截并返回原因。
 */
export async function executeStrategy(strategyId: string, action?: ActionType): Promise<ExecBatch | null> {
  const strategy = getStrategy(strategyId)
  if (!strategy) throw new Error('该策略已被删除')
  await delay(320)

  // 未指定动作时：时控取首个时间点的动作，负控取首条规则的动作
  const defaultAction: ActionType =
    strategy.triggerType === '负控'
      ? (strategy.eventRules[0]?.action ?? '拉闸')
      : (sortTimePoints(strategy.timePoints)[0]?.action ?? '拉闸')
  const finalAction: ActionType = action ?? defaultAction
  const targets = resolveScopeDevices(strategy)

  // 拉闸优先：合闸请求须通过裁决，全部拉闸条件解除后才下发
  if (finalAction === '合闸') {
    const blocked = targets.filter((device) => blockedByOtherStrategy(device.id, strategy.id))
    if (blocked.length === targets.length && targets.length > 0) return null
  }

  const batch = buildBatch(strategy, finalAction, targets)
  execBatches.unshift(batch)
  persistExecBatches()

  // 更新设备闸位：成功拉闸 → latched；成功合闸 → 解除
  batch.devices.forEach((item) => {
    if (item.result !== '成功') return
    setLatch(item.deviceId, item.action === '拉闸', strategy.id)
  })

  writeLog(
    '策略执行',
    strategy,
    `触发一次${strategy.triggerType}${finalAction}，共 ${batch.devices.length} 台设备`,
  )
  return batch
}

/* ---------- 变更记录 ---------- */

function writeLog(type: StrategyChangeType, strategy: Strategy, detail: string) {
  strategyLogs.unshift({
    id: `SLOG-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    at: Date.now(),
    account: currentOperator(),
    type,
    strategyId: strategy.id,
    target: strategy.name,
    detail,
  })
  if (strategyLogs.length > 300) strategyLogs.splice(300)
  persistStrategyLogs()
}
