/**
 * 【原型说明】系统日志模块的业务逻辑，仅用于原型交互验证。
 * 业务规则对齐《产品需求文档-系统日志》v0.1：
 * - 本页只读：仅提供查询、详情与导出，不提供编辑 / 删除 / 补录
 * - 时间范围必填、默认当日、单次跨度 ≤ 90 天
 * - 导出严格等于当前查询条件，单次上限 10000 行且超限不截断
 * - 查看对象以写入时固化的名称快照展示，对象删除后仍可追溯
 * - 会话日志记录本企业账号的「登录」与「退出登录」行为
 */

import { LOGIN_ACTION_OPTIONS, LOGIN_METHOD_OPTIONS, LOGIN_RESULT_OPTIONS, LOG_FEATURE_MAP, LOG_MODULE_OPTIONS } from '../mock/seed'
import { PRESET_MEMBERS } from '@/modules/member/mock/seed'
import { EXPORT_LIMIT, RANGE_SPAN_DAYS } from './constants'
import { allLoginLogs, persistRuntimeLoginLogs, presetOperationLogs, runtimeLoginLogs } from './storage'
import type {
  DateRange,
  LogFeature,
  LogModule,
  LoginFilters,
  LoginLog,
  LoginMethod,
  LoginResult,
  OperationFilters,
  OperationLog,
  SessionActionType,
} from './types'

/* ---------- 时间 ---------- */

const pad2 = (value: number) => String(value).padStart(2, '0')

/** 展示到秒：YYYY-MM-DD HH:mm:ss（PRD 6.2） */
export function formatTime(at: number) {
  const date = new Date(at)
  return `${formatDate(at)} ${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}`
}

/** 展示到日期：YYYY-MM-DD */
export function formatDate(at: number) {
  const date = new Date(at)
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
}

/** 默认时间范围：当日（进入本页数据压力最小） */
export function defaultRange(days = 1): DateRange {
  const end = Date.now()
  const start = end - (days - 1) * 24 * 60 * 60 * 1000
  return [formatDate(start), formatDate(end)]
}

/** 区间起点：开始日 00:00:00 */
function rangeStart(range: DateRange) {
  return new Date(`${range[0]}T00:00:00`).getTime()
}

/** 区间终点：结束日 23:59:59.999（左闭右闭按天） */
function rangeEnd(range: DateRange) {
  return new Date(`${range[1]}T23:59:59.999`).getTime()
}

/**
 * 时间范围校验（PRD F-LOG-01 / F-LOG-02 异常处理）：
 * 必填、起止不倒置、单次跨度 ≤ 90 天。返回错误文案，合法时返回 null。
 */
export function validateRange(range: DateRange): string | null {
  const [start, end] = range
  if (!start || !end) return '请选择时间范围'
  const startAt = new Date(`${start}T00:00:00`).getTime()
  const endAt = new Date(`${end}T00:00:00`).getTime()
  if (startAt > endAt) return '开始时间不能晚于结束时间'
  const days = Math.floor((endAt - startAt) / (24 * 60 * 60 * 1000)) + 1
  if (days > RANGE_SPAN_DAYS) return `单次查询时间范围不能超过 ${RANGE_SPAN_DAYS} 天`
  return null
}

/* ---------- 登录日志查询 ---------- */

const normalize = (value: string) => (value ?? '').trim().toLowerCase()

/**
 * 按条件查询会话日志（登录 + 退出登录）；多维度之间为「且」关系。
 * 「登录方式」只对「登录」记录生效：勾选登录方式后，退出登录记录会被排除
 * （退出登录没有登录方式，勾选方式即表示只看登录行为）。
 */
export function filterLoginLogs(filters: LoginFilters): LoginLog[] {
  const start = rangeStart(filters.dateRange)
  const end = rangeEnd(filters.dateRange)
  const keyword = normalize(filters.keyword)

  return allLoginLogs().filter((log) => {
    if (log.at < start || log.at > end) return false
    if (filters.actions.length && !filters.actions.includes(log.action)) return false
    if (filters.methods.length) {
      if (log.action !== '登录' || !filters.methods.includes(log.method as LoginMethod)) return false
    }
    if (filters.results.length && !filters.results.includes(log.result)) return false
    if (keyword) {
      const hit = normalize(log.account).includes(keyword) || normalize(log.accountName).includes(keyword)
      if (!hit) return false
    }
    return true
  })
}

/* ---------- 操作行为日志查询 ---------- */

/** 按条件查询操作行为日志；多维度之间为「且」关系 */
export function filterOperationLogs(filters: OperationFilters): OperationLog[] {
  const start = rangeStart(filters.dateRange)
  const end = rangeEnd(filters.dateRange)
  const keyword = normalize(filters.keyword)
  const search = normalize(filters.search)

  return presetOperationLogs.filter((log) => {
    if (log.at < start || log.at > end) return false
    if (filters.module && log.module !== filters.module) return false
    if (filters.feature && log.feature !== filters.feature) return false
    if (filters.changeType && log.changeType !== filters.changeType) return false
    if (keyword) {
      const hit = normalize(log.account).includes(keyword) || normalize(log.accountName).includes(keyword)
      if (!hit) return false
    }
    if (search) {
      const hit =
        normalize(log.objectName).includes(search) ||
        normalize(log.objectId).includes(search) ||
        normalize(log.summary).includes(search) ||
        normalize(log.account).includes(search)
      if (!hit) return false
    }
    return true
  })
}

/* ---------- 筛选联动 ---------- */

/** 「功能」选项：未选模块时展示全部功能；已选模块时仅展示该模块下的功能 */
export function featureOptionsOf(module: LogModule | '') {
  const modules = module ? [module] : LOG_MODULE_OPTIONS
  return modules.flatMap((item) =>
    LOG_FEATURE_MAP[item].map((entry) => ({ label: entry.feature as string, value: entry.feature as string })),
  )
}

/** 「变更类型」选项：未选功能时展示全部变更类型；已选功能时仅展示该功能下的类型 */
export function changeTypeOptionsOf(module: LogModule | '', feature: LogFeature | '') {
  const modules = module ? [module] : LOG_MODULE_OPTIONS
  const entries = modules.flatMap((item) => LOG_FEATURE_MAP[item])
  const scoped = feature ? entries.filter((entry) => entry.feature === feature) : entries
  return Array.from(new Set(scoped.flatMap((entry) => entry.changeTypes))).map((type) => ({
    label: type,
    value: type,
  }))
}

export { LOG_MODULE_OPTIONS, LOGIN_ACTION_OPTIONS, LOGIN_METHOD_OPTIONS, LOGIN_RESULT_OPTIONS }

/* ---------- 导出 ---------- */

export interface ExportResult {
  ok: boolean
  reason: string
  count: number
  fileName: string
  content: string
}

const toCsv = (headers: string[], rows: string[][], fileName: string): ExportResult => {
  const body = rows.map((row) => row.map((value) => `"${String(value ?? '').replace(/"/g, '""')}"`).join(','))
  return {
    ok: true,
    reason: '',
    count: rows.length,
    fileName,
    content: `\uFEFF${[headers.join(','), ...body].join('\n')}`,
  }
}

/** 变更明细转为可导出的一行文字（原型内用于导出，正式实现由服务端生成文件） */
function detailText(log: OperationLog): string {
  const detail = log.detail
  switch (detail.kind) {
    case 'field':
      return detail.rows.map((row) => `${row.field}：${row.before} → ${row.after}`).join('；')
    case 'permission':
      return [
        detail.added.length ? `新增：${detail.added.join('、')}` : '',
        detail.removed.length ? `移除：${detail.removed.join('、')}` : '',
      ]
        .filter(Boolean)
        .join('；')
    case 'state':
      return `${detail.before} → ${detail.after}`
    case 'ownership':
      return `${detail.before} → ${detail.after}`
    case 'objects':
      return detail.rows.map((row) => `${row.name}：${row.result}${row.note ? `（${row.note}）` : ''}`).join('；')
    default:
      return detail.text
  }
}

/** 导出会话日志：严格等于当前查询条件，超上限不截断 */
export function buildLoginExport(list: LoginLog[]): ExportResult {
  const empty: ExportResult = { ok: false, reason: '当前条件下没有可导出的记录', count: 0, fileName: '', content: '' }
  if (!list.length) return empty
  if (list.length > EXPORT_LIMIT) {
    return { ...empty, reason: `导出记录数超过上限（${EXPORT_LIMIT} 行），请缩小时间范围或增加筛选条件` }
  }
  return toCsv(
    ['操作时间', '操作类型', '操作账号', '账号姓名', '登录方式', '结果', '失败原因', '来源 IP', '来源终端'],
    list.map((log) => [
      formatTime(log.at),
      log.action,
      log.account,
      log.accountName || '—',
      log.method || '—',
      log.result,
      log.failReason || '—',
      log.ip,
      log.terminal,
    ]),
    `会话日志-${formatDate(Date.now())}.csv`,
  )
}

/** 导出操作行为日志：列表字段 + 关键明细字段 */
export function buildOperationExport(list: OperationLog[]): ExportResult {
  const empty: ExportResult = { ok: false, reason: '当前条件下没有可导出的操作记录', count: 0, fileName: '', content: '' }
  if (!list.length) return empty
  if (list.length > EXPORT_LIMIT) {
    return { ...empty, reason: `导出记录数超过上限（${EXPORT_LIMIT} 行），请缩小时间范围或增加筛选条件` }
  }
  return toCsv(
    ['操作时间', '操作账号', '账号姓名', '所属模块', '功能', '变更类型', '操作对象类型', '操作对象标识', '操作对象名称', '变更内容摘要', '变更明细'],
    list.map((log) => [
      formatTime(log.at),
      log.account,
      log.accountName || '—',
      log.module,
      log.feature,
      log.changeType,
      log.objectType,
      log.objectId,
      log.objectName,
      log.summary,
      detailText(log),
    ]),
    `操作行为日志-${formatDate(Date.now())}.csv`,
  )
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

/* ---------- 会话日志写入（供认证模块与顶栏在会话行为发生时调用） ---------- */

export interface SessionLogInput {
  identifier: string
  /** 操作类型：登录 / 退出登录 */
  action: SessionActionType
  /** 登录方式；退出登录不传 */
  method?: LoginMethod
  result: LoginResult
  failReason?: string
}

/**
 * 【原型说明】记录一次会话行为（登录尝试或退出登录），对应 PRD F-LOG-01。
 * 正式实现中由服务端在认证 / 退出流程内写入；原型内由登录页、选择登录企业页与顶栏退出调用，
 * 写入的记录与预置演示数据合并展示在同一会话日志中。
 */
export function recordSessionLog(input: SessionLogInput) {
  const at = Date.now()
  const date = new Date(at)
  const key = `${date.getFullYear()}${pad2(date.getMonth() + 1)}${pad2(date.getDate())}`
  runtimeLoginLogs.unshift({
    id: `LOGIN-${key}-NEW-${runtimeLoginLogs.length + 1}`,
    at,
    action: input.action,
    account: input.identifier,
    accountName: memberDisplayName(input.identifier),
    method: input.action === '退出登录' ? '' : (input.method ?? '密码登录'),
    result: input.result,
    failReason: input.action === '退出登录' ? '' : (input.failReason ?? ''),
    ip: '203.0.113.24',
    terminal: currentTerminal(),
  })
  persistRuntimeLoginLogs()
}

/** 【原型说明】当前浏览器与操作系统摘要（不含设备类型） */
function currentTerminal() {
  const ua = navigator.userAgent
  const browser = /Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : '其他浏览器'
  const os = /Windows/.test(ua) ? 'Windows' : /Mac OS X|Macintosh/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : '未知系统'
  return `${browser} / ${os}`
}

function memberDisplayName(identifier: string) {
  return PRESET_MEMBERS.find((member) => member.identifier === identifier)?.name ?? ''
}

