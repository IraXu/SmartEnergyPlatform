/**
 * 【原型说明】告警中心的业务逻辑，仅用于原型交互验证。
 * - 一条推送即一条告警，不做合并去重
 * - 单条删除与批量删除（跨页勾选、不设条数上限），彻底删除不可恢复
 * - 查询条件、排序与导出上限
 */

import { session } from '@/modules/auth/store'
import { maskIdentifier } from '@/shared/utils/mask'
import { getSubtreeIds } from '@/modules/org/store'
import type { OrgNode } from '@/modules/org/store'
import { EVENT_TYPES } from '../mock/seed'
import { alarms, logs, orgNodes, persistAlarms, persistLogs } from './storage'
import { EXPORT_LIMIT, RANGE_SPAN_MONTHS } from './constants'
import type { Alarm, AlarmFilters, DateRange, SortOrder } from './types'

/* ---------- 通用 ---------- */

/** 【原型说明】模拟异步耗时，无真实接口调用 */
function delay(ms = 360) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms)
  })
}

/** 输入内容按纯文本处理：合并连续空格并去除首尾空白，仅空格视为未填写 */
export function normalizeText(value: string) {
  return value.replace(/\s+/g, ' ').trim()
}

/** 当前操作账号展示名，用于变更记录 */
function currentOperator() {
  const current = session.current
  if (!current) return '未知账号'
  return current.contactName || maskIdentifier(current.identifier)
}

/* ---------- 时间展示 ---------- */

const pad2 = (value: number) => String(value).padStart(2, '0')

/** 时间统一格式 YYYY-MM-DD HH:mm */
export function formatTime(at: number) {
  const date = new Date(at)
  return `${formatDate(at)} ${pad2(date.getHours())}:${pad2(date.getMinutes())}`
}

/** 展示到日期，同时用于告警时间范围与导出文件名 */
export function formatDate(at: number) {
  const date = new Date(at)
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
}

/** 默认时间范围：今日（起止同一天） */
export function todayRange(): DateRange {
  const today = formatDate(Date.now())
  return [today, today]
}

/** 时间范围下限：告警日期为区间开始日当天 00:00 */
function rangeStart(filters: AlarmFilters): number {
  return new Date(`${filters.dateRange[0]}T00:00:00`).getTime()
}

/** 时间范围上限：告警日期为区间结束日当天 23:59:59 */
function rangeEnd(filters: AlarmFilters): number {
  return new Date(`${filters.dateRange[1]}T23:59:59.999`).getTime()
}

/** 时间范围校验：起止不倒置、跨度不超过 12 个月 */
export function validateRange(range: DateRange): string | null {
  const [start, end] = range
  if (!start || !end) return '请选择告警时间的开始与结束日期'
  const startAt = new Date(`${start}T00:00:00`).getTime()
  const endAt = new Date(`${end}T00:00:00`).getTime()
  if (startAt > endAt) return '开始时间不能晚于结束时间'
  const limit = new Date(startAt)
  limit.setMonth(limit.getMonth() + RANGE_SPAN_MONTHS)
  if (endAt > limit.getTime()) return `查询跨度不能超过 ${RANGE_SPAN_MONTHS} 个月`
  return null
}

/* ---------- 查询与排序 ---------- */

/** 用能单元范围：所选节点及其全部下级 */
export function unitScopeIds(unitId: string | null): string[] | null {
  if (!unitId) return null
  return getSubtreeIds(unitId)
}

/** 按条件查询告警；多个维度之间为「且」关系 */
export function filterAlarms(filters: AlarmFilters): Alarm[] {
  const start = rangeStart(filters)
  const end = rangeEnd(filters)
  const meterKeyword = normalizeText(filters.meterKeyword).toLowerCase()
  const scope = unitScopeIds(filters.unitId)

  return alarms.filter((alarm) => {
    if (alarm.reportAt < start || alarm.reportAt > end) return false
    if (filters.eventTypes.length && !filters.eventTypes.includes(alarm.eventType)) return false
    if (scope && !scope.includes(alarm.unitId)) return false
    if (meterKeyword) {
      const hit =
        alarm.meterName.toLowerCase().includes(meterKeyword) ||
        alarm.meterLicense.toLowerCase().includes(meterKeyword)
      if (!hit) return false
    }
    return true
  })
}

/** 排序：默认告警时间倒序（最新在最上方） */
export function sortAlarms(list: Alarm[], order: SortOrder): Alarm[] {
  const factor = order === 'ascend' ? 1 : -1
  return [...list].sort((a, b) => (a.reportAt - b.reportAt) * factor)
}

/* ---------- 查询辅助 ---------- */

export const getAlarm = (id: string) => alarms.find((alarm) => alarm.id === id) ?? null

/** 事件类型查询选项：按事件类别分组；类别内类型较多时按名称排序，便于查找 */
export function eventTypeGroups() {
  const groups = new Map<string, string[]>()
  EVENT_TYPES.forEach((item) => {
    const list = groups.get(item.category) ?? []
    list.push(item.name)
    groups.set(item.category, list)
  })
  return Array.from(groups.entries()).map(([category, names]) => ({
    label: category,
    options: names.map((name) => ({ label: name, value: name })),
  }))
}

/** 树选择数据：企业根节点 → 组织节点 → 用能单元 */
export function unitTreeData() {
  const childrenOf = (parentId: string | null) =>
    orgNodes
      .filter((node) => node.parentId === parentId)
      .sort((a, b) => a.order - b.order)

  const build = (parentId: string | null): Array<Record<string, unknown>> =>
    childrenOf(parentId).map((node: OrgNode) => {
      const children = build(node.id)
      return {
        value: node.id,
        title: node.name,
        children: children.length ? children : undefined,
      }
    })
  return build(null)
}

/* ---------- 删除告警 ---------- */

/** 删除单条告警，彻底删除不可恢复 */
export async function deleteAlarm(id: string): Promise<void> {
  await delay()
  const index = alarms.findIndex((alarm) => alarm.id === id)
  if (index < 0) throw new Error('该告警已被删除')
  const [removed] = alarms.splice(index, 1)
  persistAlarms()
  writeLog(`删除告警「${removed.id}」（${removed.eventType} / ${removed.meterId}）`)
}

export interface BatchDeleteResult {
  success: number
  skipped: number
}

/**
 * 批量删除告警（支持跨页勾选，不设条数上限）。
 * 提交时已被他人删除的条目跳过并计入 skipped。
 */
export async function deleteAlarms(ids: string[]): Promise<BatchDeleteResult> {
  await delay(460)
  let success = 0
  let skipped = 0
  ids.forEach((id) => {
    const index = alarms.findIndex((alarm) => alarm.id === id)
    if (index < 0) {
      skipped += 1
      return
    }
    alarms.splice(index, 1)
    success += 1
  })
  persistAlarms()
  writeLog(`批量删除告警 ${success} 条${skipped ? `（${skipped} 条已被删除被跳过）` : ''}`)
  return { success, skipped }
}

/* ---------- 变更记录（对应「系统管理 › 系统日志」） ---------- */

function writeLog(detail: string) {
  logs.unshift({
    id: `ALOG-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    at: Date.now(),
    account: currentOperator(),
    type: '删除告警',
    detail,
  })
  if (logs.length > 200) logs.splice(200)
  persistLogs()
}

/* ---------- 导出 ---------- */

export interface ExportResult {
  ok: boolean
  /** 阻止导出的原因，ok 为 true 时为空 */
  reason: string
  count: number
  fileName: string
  content: string
}

const EXPORT_HEADERS = [
  '告警编号',
  '告警时间',
  '所属用能单元',
  '设备名称',
  '设备编号',
  '设备 License',
  '事件类型',
  '告警内容',
]

/**
 * 【原型说明】生成导出文件内容（CSV 文本），仅用于演示导出行为与字段范围。
 * 正常实现应由服务端生成文件；原型内直接在前端拼装并触发下载。
 */
export function buildExport(list: Alarm[]): ExportResult {
  const empty = { ok: false, reason: '当前查询条件下没有可导出的告警', count: 0, fileName: '', content: '' }
  if (!list.length) return empty
  if (list.length > EXPORT_LIMIT) {
    return {
      ...empty,
      reason: `导出条数超过上限（${EXPORT_LIMIT} 条），请缩小时间范围或增加查询条件`,
    }
  }
  const rows = list.map((alarm) =>
    [
      alarm.id,
      formatTime(alarm.reportAt),
      alarm.unitPath || '—',
      alarm.meterName,
      alarm.meterId,
      alarm.meterLicense,
      alarm.eventType,
      alarm.content,
    ]
      .map((value) => `"${value.replace(/"/g, '""')}"`)
      .join(','),
  )
  const content = `\uFEFF${[EXPORT_HEADERS.join(','), ...rows].join('\n')}`
  return {
    ok: true,
    reason: '',
    count: list.length,
    fileName: `告警导出-${formatDate(Date.now())}.csv`,
    content,
  }
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
