/**
 * 【原型说明】能源数据模块的统一出口与演示数据容器，仅用于原型交互验证。
 * 数据存于 localStorage；正式实现应为服务端存储。
 */

import { computed, reactive, ref } from 'vue'
import { readJSON, removeKeys, writeJSON } from '@/shared/utils/storage'
import {
  createDailySeries,
  createDetailRows,
  createMeterStats,
  createPowerSeries,
  createRankRows,
  createReports,
  METERS,
  SUB_ITEMS,
  TOU_ITEMS,
  UNITS,
} from '../mock/seed'
import {
  ENERGY_ALL_KEYS,
  ENERGY_DATA_VERSION,
  ENERGY_METERSTAT_KEY,
  ENERGY_REPORTS_KEY,
  ENERGY_VERSION_KEY,
} from './constants'
import type { MeterStatConfig, ReportVersion } from './types'

/** 演示数据结构升级时清理旧数据 */
function migrateEnergyData() {
  if (localStorage.getItem(ENERGY_VERSION_KEY) === ENERGY_DATA_VERSION) return
  removeKeys(ENERGY_ALL_KEYS)
  localStorage.setItem(ENERGY_VERSION_KEY, ENERGY_DATA_VERSION)
}

migrateEnergyData()

/** 用能单元与计量电表（演示数据） */
export const units = UNITS
export const meters = METERS

/** 图表与明细的演示数据 */
export const dailySeries = createDailySeries()
export const powerSeries = createPowerSeries()
export const detailRows = reactive(createDetailRows())
export const rankRows = computed(() => createRankRows())
export const subItems = SUB_ITEMS
export const touItems = TOU_ITEMS

/** 报告版本（localStorage 持久化：生成/重新生成后保留） */
export const reports = reactive<ReportVersion[]>(readJSON(ENERGY_REPORTS_KEY, createReports()))

/** 用电统计设置（按用能单元） */
export const meterStats = reactive<Record<string, MeterStatConfig>>(
  readJSON(ENERGY_METERSTAT_KEY, createMeterStats()),
)

export function persistReports() {
  writeJSON(ENERGY_REPORTS_KEY, reports)
}

export function persistMeterStats() {
  writeJSON(ENERGY_METERSTAT_KEY, meterStats)
}

/**
 * 【原型说明】演示用：加载时把遗留的「生成中」版本在短延时后置为「已生成」，
 * 避免演示数据里的生成中状态长期不收敛（真实实现由服务端异步任务回写）。
 */
window.setTimeout(() => {
  let changed = false
  reports.forEach((item) => {
    if (item.status === 'generating') {
      item.status = 'generated'
      if (item.sizeText === '—') item.sizeText = '1.8 MB'
      changed = true
    }
  })
  if (changed) persistReports()
}, 2500)

/** 【原型说明】模拟生成一份新版本报告：新增一行（旧版本不变） */
export function generateReport(period: 'monthly' | 'annual', periodText: string, scope = '') {
  const samePeriod = reports.filter((item) => item.period === period && item.periodText === periodText)
  const nextVersion = samePeriod.reduce((max, item) => Math.max(max, item.version), 0) + 1
  const name = period === 'monthly' ? `${periodText}用能月报` : `${periodText}用能年报`
  const report: ReportVersion = {
    id: `RPT-${Date.now()}`,
    name,
    period,
    periodText,
    scope,
    version: nextVersion,
    status: 'generating',
    generatedAt: formatNow(),
    sizeText: '—',
    operator: '徐志诚',
  }
  reports.unshift(report)
  persistReports()
  // 模拟异步生成完成
  window.setTimeout(() => {
    report.status = 'generated'
    report.sizeText = '1.9 MB'
    persistReports()
  }, 1800)
  return report
}

/** 【原型说明】保存用电统计设置（单点保存 + 系统日志留痕由页面提示） */
export function saveMeterStat(config: MeterStatConfig) {
  meterStats[config.unitId] = { ...config, effectiveAt: formatNow(), updatedBy: '徐志诚' }
  persistMeterStats()
}

/** 【原型说明】把演示数据恢复为初始状态 */
export function resetEnergyData() {
  reports.splice(0, reports.length, ...createReports())
  Object.keys(meterStats).forEach((key) => delete meterStats[key])
  Object.assign(meterStats, createMeterStats())
  persistReports()
  persistMeterStats()
}

function formatNow() {
  const now = new Date()
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`
}

/** 当前企业可用权限（原型固定为全部可见；正式实现由角色权限决定） */
export const grantedPermissions = ref<string[]>([
  'energy',
  'energy:monitor',
  'energy:analysis',
  'energy:report',
  'energy:report:generate',
  'energy:report:export',
  'energy:export',
  'system:org:unit:meterstat:edit',
])

export function hasPermission(key: string) {
  return grantedPermissions.value.includes(key)
}
