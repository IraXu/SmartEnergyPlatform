/**
 * 【原型说明】能源数据模块的演示数据种子，仅用于原型展示，非真实数据。
 * 数据贴近 PRD 的页面信息项与业务规则（缺数、清零、分时、占比等口径）。
 */

import type { DetailRow, MeterDevice, MeterStatConfig, QualityMark, RankRow, ReportVersion, Series, SeriesPoint, SubItem } from '../store/types'

/** 用能单元（演示用组织树，与组织架构的业务层级一致） */
export interface UnitNode {
  id: string
  name: string
  parentId: string | null
  /** 企业根节点 / 组织节点（园区、厂房、楼宇）/ 最小计量落位用能单元 */
  kind: 'root' | 'org' | 'unit'
}

export const UNITS: UnitNode[] = [
  { id: 'U-ENTERPRISE', name: '南京伊米特电子科技技术有限公司', parentId: null, kind: 'root' },
  { id: 'U-ROOT', name: '华东智造园区', parentId: 'U-ENTERPRISE', kind: 'org' },
  { id: 'U-A', name: '一号厂房', parentId: 'U-ROOT', kind: 'org' },
  { id: 'U-A1', name: '一号车间', parentId: 'U-A', kind: 'unit' },
  { id: 'U-A2', name: '二号车间', parentId: 'U-A', kind: 'unit' },
  { id: 'U-B', name: '二号厂房', parentId: 'U-ROOT', kind: 'org' },
  { id: 'U-B1', name: '装配车间', parentId: 'U-B', kind: 'unit' },
  { id: 'U-C', name: '综合楼', parentId: 'U-ROOT', kind: 'org' },
  { id: 'U-C1', name: '办公楼', parentId: 'U-C', kind: 'unit' },
]

export const METERS: MeterDevice[] = [
  { id: 'D-1001', name: '一号厂房进线总表', license: 'LIC-9F2A-1001-7C61', imei: '864512030001001', role: '总表', isGateway: false, unitId: 'U-A1' },
  { id: 'D-1002', name: '车间照明独立表', license: 'LIC-9F2A-1002-7C62', imei: '864512030001002', role: '独立电表', isGateway: false, unitId: 'U-A1' },
  { id: 'D-1003', name: '空压机独立表', license: 'LIC-9F2A-1003-7C63', imei: '864512030001003', role: '独立电表', isGateway: false, unitId: 'U-A2' },
  { id: 'D-1004', name: '办公照明独立表', license: 'LIC-9F2A-1004-7C64', imei: '864512030001004', role: '独立电表', isGateway: false, unitId: 'U-C1' },
  { id: 'D-1005', name: '综合楼空调独立表', license: 'LIC-9F2A-1005-7C65', imei: '864512030001005', role: '独立电表', isGateway: false, unitId: 'U-C1' },
  { id: 'D-1006', name: '一号厂房采集网关', license: 'LIC-GW01-7788-11A2', imei: '864512039001001', role: '独立电表', isGateway: true, unitId: 'U-A' },
  { id: 'D-1007', name: '二号厂房进线总表', license: 'LIC-9F2A-1007-7C67', imei: '864512030001007', role: '总表', isGateway: false, unitId: 'U-B1' },
]

/** 线性同余伪随机：保证演示数据可复现 */
function makeRandom(seed: number) {
  let state = seed
  return () => {
    state = (state * 1103515245 + 12345) % 2147483648
    return state / 2147483648
  }
}

const QUALITY: QualityMark[] = ['valid', 'valid', 'valid', 'valid', 'valid', 'valid', 'estimated', 'missing', 'abnormal', 'valid']

/** 生成近 N 天日用电序列（含缺失/补齐/异常点，用于演示质量标记） */
export function createDailySeries(days = 30, seed = 20261016): Series {
  const rand = makeRandom(seed)
  const points: SeriesPoint[] = []
  const today = new Date('2026-10-16T00:00:00')
  for (let i = days - 1; i >= 0; i -= 1) {
    const date = new Date(today)
    date.setDate(today.getDate() - i)
    const label = `${date.getMonth() + 1}/${date.getDate()}`
    const quality = QUALITY[Math.floor(rand() * QUALITY.length)]
    const base = 1200 + Math.round(rand() * 600)
    const value = quality === 'missing' ? null : quality === 'estimated' ? base : Math.round(base * (0.9 + rand() * 0.3))
    points.push({ label, value, quality })
  }
  return { name: '用电量', color: '#0f7b6c', points }
}

/** 功率序列（与电量不共用纵轴） */
export function createPowerSeries(days = 30, seed = 777): Series {
  const rand = makeRandom(seed)
  const points: SeriesPoint[] = []
  const today = new Date('2026-10-16T00:00:00')
  for (let i = days - 1; i >= 0; i -= 1) {
    const date = new Date(today)
    date.setDate(today.getDate() - i)
    points.push({
      label: `${date.getMonth() + 1}/${date.getDate()}`,
      value: Math.round(180 + rand() * 90),
      quality: 'valid',
    })
  }
  return { name: '功率', color: '#1890ff', points }
}

/** 历史明细（含缺数、清零、换表分段提示） */
export function createDetailRows(): DetailRow[] {
  return [
    { id: 'DR-01', time: '2026-10-16 08:00', metric: '累计电量', value: '1,286.4', unit: 'kWh', quality: 'valid', remark: '—' },
    { id: 'DR-02', time: '2026-10-16 07:00', metric: '累计电量', value: '1,242.1', unit: 'kWh', quality: 'valid', remark: '—' },
    { id: 'DR-03', time: '2026-10-16 06:00', metric: '累计电量', value: '—', unit: 'kWh', quality: 'missing', remark: '该时段无采集数据，统计不完整' },
    { id: 'DR-04', time: '2026-10-16 05:00', metric: '累计电量', value: '1,198.7', unit: 'kWh', quality: 'estimated', remark: '展示补齐，非真实采集值' },
    { id: 'DR-05', time: '2026-10-16 04:00', metric: '累计电量', value: '1,176.2', unit: 'kWh', quality: 'valid', remark: '—' },
    { id: 'DR-06', time: '2026-10-15 23:00', metric: '累计电量', value: '0.0', unit: 'kWh', quality: 'abnormal', remark: '识别到清零事件，前后读数已分段' },
    { id: 'DR-07', time: '2026-10-15 22:00', metric: '累计电量', value: '1,152.9', unit: 'kWh', quality: 'valid', remark: '—' },
    { id: 'DR-08', time: '2026-10-15 21:00', metric: '累计电量', value: '1,131.5', unit: 'kWh', quality: 'valid', remark: '换表，本段统计不完整' },
  ]
}

/** 排名（Top10 → 全部） */
export function createRankRows(): RankRow[] {
  const raw: Array<[string, string, number, number]> = [
    ['U-A1', '一号车间', 4280, 4050],
    ['U-A2', '二号车间', 3960, 4120],
    ['U-B1', '装配车间', 3510, 3380],
    ['U-C1', '办公楼', 2980, 3010],
    ['U-A', '一号厂房', 2760, 2600],
    ['U-B', '二号厂房', 2540, 2610],
    ['U-C', '综合楼', 2180, 2090],
    ['U-ROOT', '华东智造园区', 1960, 1900],
    ['U-A1', '一号车间·动力', 1720, 1650],
    ['U-A2', '二号车间·照明', 1540, 1490],
    ['U-B1', '装配车间·空压', 1320, 1280],
    ['U-C1', '办公楼·空调', 1180, 1260],
  ]
  return raw.map(([unitId, name, current, previous], index) => {
    const delta = current - previous
    return {
      id: `RK-${index + 1}`,
      unitId,
      name,
      current,
      previous,
      delta,
      deltaRate: previous === 0 ? null : Number(((delta / previous) * 100).toFixed(1)),
      ratio: null,
    }
  })
}

/** 分项构成（占比）：总表 1000 → 分表 600 / 400 → 60% / 40% */
export const SUB_ITEMS: SubItem[] = [
  { name: '一号车间照明', value: 600, ratio: 60 },
  { name: '二号车间空压', value: 400, ratio: 40 },
]

/** 分时（尖峰平谷）用电 */
export const TOU_ITEMS = [
  { name: '尖', value: 186, color: '#ff4d4f' },
  { name: '峰', value: 402, color: '#faad14' },
  { name: '平', value: 638, color: '#0f7b6c' },
  { name: '谷', value: 224, color: '#52c41a' },
]

/** 报告版本列表：一行 = 一个版本 */
export function createReports(): ReportVersion[] {
  return [
    {
      id: 'RPT-202610-M-2',
      name: '2026年10月用能月报',
      period: 'monthly',
      periodText: '2026年10月',
      version: 2,
      status: 'generated',
      generatedAt: '2026-10-16 09:20',
      sizeText: '1.8 MB',
      operator: '徐志诚',
    },
    {
      id: 'RPT-202610-M-1',
      name: '2026年10月用能月报',
      period: 'monthly',
      periodText: '2026年10月',
      version: 1,
      status: 'generated',
      generatedAt: '2026-10-15 18:02',
      sizeText: '1.7 MB',
      operator: '徐志诚',
    },
    {
      id: 'RPT-202609-M-1',
      name: '2026年9月用能月报',
      period: 'monthly',
      periodText: '2026年9月',
      version: 1,
      status: 'generated',
      generatedAt: '2026-10-01 08:35',
      sizeText: '1.9 MB',
      operator: '徐志诚',
    },
    {
      id: 'RPT-202610-M-3',
      name: '2026年10月用能月报',
      period: 'monthly',
      periodText: '2026年10月',
      version: 3,
      status: 'generating',
      generatedAt: '2026-10-16 10:05',
      sizeText: '—',
      operator: '徐志诚',
    },
    {
      id: 'RPT-202608-M-1',
      name: '2026年8月用能月报',
      period: 'monthly',
      periodText: '2026年8月',
      version: 1,
      status: 'failed',
      generatedAt: '2026-09-01 08:31',
      sizeText: '—',
      operator: '徐志诚',
    },
  ]
}

/** 默认用电统计设置：一级单元以其进线表为统计口径；未配置电表的单元保持「未设置」 */
export function createMeterStats(): Record<string, MeterStatConfig> {
  return {
    'U-A': {
      unitId: 'U-A',
      mode: 'total',
      totalMeterId: 'D-1001',
      subMeterIds: ['D-1002', 'D-1003'],
      meterIds: ['D-1001', 'D-1002', 'D-1003'],
      effectiveAt: '2026-09-01 10:00',
      updatedBy: '徐志诚',
      confirmed: true,
    },
    'U-A1': {
      unitId: 'U-A1',
      mode: 'total',
      totalMeterId: 'D-1002',
      subMeterIds: [],
      meterIds: ['D-1002'],
      effectiveAt: '2026-09-01 10:00',
      updatedBy: '徐志诚',
      confirmed: true,
    },
    'U-A2': {
      unitId: 'U-A2',
      mode: 'total',
      totalMeterId: 'D-1003',
      subMeterIds: [],
      meterIds: ['D-1003'],
      effectiveAt: '2026-09-01 10:00',
      updatedBy: '徐志诚',
      confirmed: true,
    },
    'U-B': {
      unitId: 'U-B',
      mode: 'total',
      totalMeterId: 'D-1007',
      subMeterIds: [],
      meterIds: ['D-1007'],
      effectiveAt: '2026-09-01 10:00',
      updatedBy: '徐志诚',
      confirmed: true,
    },
    'U-C': {
      unitId: 'U-C',
      mode: 'total',
      totalMeterId: 'D-1005',
      subMeterIds: [],
      meterIds: ['D-1005'],
      effectiveAt: '2026-09-01 10:00',
      updatedBy: '徐志诚',
      confirmed: true,
    },
    'U-C1': {
      unitId: 'U-C1',
      mode: 'sum',
      totalMeterId: null,
      subMeterIds: [],
      meterIds: ['D-1004'],
      effectiveAt: '2026-09-01 10:00',
      updatedBy: '徐志诚',
      confirmed: true,
    },
  }
}
