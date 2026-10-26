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
  { id: 'U-A3', name: '三号车间（预留）', parentId: 'U-A', kind: 'unit' },
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
  const list: ReportVersion[] = [
    {
      id: 'RPT-SAFE-202610-2',
      name: '2026年10月安全报告',
      type: 'safety',
      period: 'monthly',
      periodText: '2026年10月',
      version: 2,
      status: 'generated',
      generatedAt: '2026-10-26 09:20',
      sizeText: '2.1 MB',
      operator: '徐志诚',
    },
    {
      id: 'RPT-SAFE-202610-1',
      name: '2026年10月安全报告',
      type: 'safety',
      period: 'monthly',
      periodText: '2026年10月',
      version: 1,
      status: 'generated',
      generatedAt: '2026-10-25 18:02',
      sizeText: '2.0 MB',
      operator: '徐志诚',
    },
    {
      id: 'RPT-SAFE-202609-1',
      name: '2026年9月安全报告',
      type: 'safety',
      period: 'monthly',
      periodText: '2026年9月',
      version: 1,
      status: 'generated',
      generatedAt: '2026-10-01 08:40',
      sizeText: '1.9 MB',
      operator: '徐志诚',
    },
    {
      id: 'RPT-SAFE-2025-1',
      name: '2025年安全报告',
      type: 'safety',
      period: 'annual',
      periodText: '2025年',
      version: 1,
      status: 'generated',
      generatedAt: '2026-01-12 10:05',
      sizeText: '5.6 MB',
      operator: '徐志诚',
    },
    {
      id: 'RPT-ENERGY-202610-2',
      name: '2026年10月用能报告',
      type: 'energy',
      period: 'monthly',
      periodText: '2026年10月',
      version: 2,
      status: 'generated',
      generatedAt: '2026-10-26 09:18',
      sizeText: '1.8 MB',
      operator: '徐志诚',
    },
    {
      id: 'RPT-ENERGY-202609-1',
      name: '2026年9月用能报告',
      type: 'energy',
      period: 'monthly',
      periodText: '2026年9月',
      version: 1,
      status: 'generated',
      generatedAt: '2026-10-01 08:35',
      sizeText: '1.9 MB',
      operator: '徐志诚',
    },
    {
      id: 'RPT-ENERGY-2025-1',
      name: '2025年用能报告',
      type: 'energy',
      period: 'annual',
      periodText: '2025年',
      version: 1,
      status: 'generated',
      generatedAt: '2026-01-12 09:48',
      sizeText: '4.8 MB',
      operator: '徐志诚',
    },
    {
      id: 'RPT-ENERGY-202608-1',
      name: '2026年8月用能报告',
      type: 'energy',
      period: 'monthly',
      periodText: '2026年8月',
      version: 1,
      status: 'failed',
      generatedAt: '2026-09-01 08:31',
      sizeText: '—',
      operator: '徐志诚',
    },
    {
      id: 'RPT-RUNTIME-202610-1',
      name: '2026年10月系统运行报告',
      type: 'runtime',
      period: 'monthly',
      periodText: '2026年10月',
      version: 1,
      status: 'generated',
      generatedAt: '2026-10-26 09:22',
      sizeText: '1.4 MB',
      operator: '徐志诚',
    },
    {
      id: 'RPT-RUNTIME-202609-1',
      name: '2026年9月系统运行报告',
      type: 'runtime',
      period: 'monthly',
      periodText: '2026年9月',
      version: 1,
      status: 'generated',
      generatedAt: '2026-10-01 08:45',
      sizeText: '1.3 MB',
      operator: '徐志诚',
    },
  ]
  // 历史演示报告均为企业级范围，补齐范围快照，保证同范围再次生成时版本号可累加
  return list.map((item) => ({ scope: '南京伊米特电子科技技术有限公司', scopeId: 'U-ENTERPRISE', ...item }))
}

/* ============================================================
 * 【原型说明】统计报表三类报告的演示数据
 * 仅用于原型展示，不代表真实客户数据；口径与 PRD F-RPT-07~09 对齐。
 * ============================================================ */

/** 安全报告演示数据 */
export const SAFETY_REPORT = {
  score: 30.7,
  level: '高风险',
  previousScore: 36.8,
  highRiskEvents: 7,
  midRiskEvents: 13,
  involvedDevices: 5,
  involvedUnits: 3,
  dataCoverage: 92.4,
  shouldCollectDevices: 7,
  validDays: 27,
  totalDays: 30,
  alarmDataText: '告警记录可用（38 类事件）',
  alarmRecordCount: 41,
  alarmDeviceCount: 5,
  eventCategories: [
    { name: '防窃电', high: 2, mid: 0 },
    { name: '温度类', high: 1, mid: 0 },
    { name: 'A 相事件', high: 2, mid: 4 },
    { name: 'B 相事件', high: 1, mid: 3 },
    { name: 'C 相事件', high: 0, mid: 4 },
    { name: '相序与不平衡', high: 1, mid: 2 },
    { name: '需量与功率', high: 0, mid: 3 },
  ],
  trend: [
    { label: '10/01', value: 3 },
    { label: '10/03', value: 5 },
    { label: '10/05', value: 2 },
    { label: '10/07', value: 4 },
    { label: '10/09', value: 6 },
    { label: '10/11', value: 3 },
    { label: '10/13', value: 5 },
    { label: '10/15', value: 4 },
    { label: '10/17', value: 7 },
    { label: '10/19', value: 3 },
    { label: '10/21', value: 2 },
    { label: '10/23', value: 4 },
    { label: '10/25', value: 3 },
  ],
  topDevices: [
    { name: '1 号总表', unit: '一号车间', unitId: 'U-A1', high: 3, mid: 2, lastAt: '2026-10-17 10:12', mainEvents: 'A相断相、B相失压' },
    { name: '中央空调机房总表', unit: '二号厂房', unitId: 'U-B', high: 1, mid: 3, lastAt: '2026-10-19 14:26', mainEvents: '过温、功率因数超下限' },
    { name: '临时施工用电表', unit: '一号车间', unitId: 'U-A1', high: 1, mid: 1, lastAt: '2026-10-18 21:40', mainEvents: '电流严重不平衡' },
    { name: '车间照明独立表', unit: '一号车间', unitId: 'U-A1', high: 1, mid: 4, lastAt: '2026-10-21 09:08', mainEvents: '开端钮盖、过流' },
    { name: '华东园区总配电表', unit: '二号厂房', unitId: 'U-B', high: 1, mid: 3, lastAt: '2026-10-22 16:32', mainEvents: '开表盖、潮流反向' },
  ],
  parameters: [
    { name: '剩余电流', extreme: '268 mA', average: '96 mA', threshold: '设备阈值 300 mA', overDevices: '0 台', availability: '3/5 台支持' },
    { name: '设备温度', extreme: '78 ℃', average: '52 ℃', threshold: '设备阈值 70 ℃', overDevices: '1 台', availability: '5/5 台' },
    { name: '电压偏差', extreme: '12.8%', average: '4.6%', threshold: '参考 ±7%', overDevices: '2 台', availability: '5/5 台' },
    { name: '三相电压不平衡', extreme: '3.4%', average: '1.2%', threshold: '参考 2%', overDevices: '1 台', availability: '5/5 台' },
    { name: '三相电流不平衡', extreme: '46%', average: '12%', threshold: '参考 10%', overDevices: '2 台', availability: '5/5 台' },
    { name: '总功率因数', extreme: '0.78（最低）', average: '0.91', threshold: '参考 ≥0.90', overDevices: '2 台', availability: '5/5 台' },
    { name: '负载率', extreme: '112%', average: '63%', threshold: '参考 >100% 过载', overDevices: '1 台', availability: '5/5 台' },
  ],
  deviceStatus: {
    onlineSnapshot: 6,
    offlineSnapshot: 1,
    offlineEverCount: 2,
    alarmDeviceCount: 5,
    highRiskDevices: 2,
    missingDevices: 1,
  },
  recommendations: [
    {
      level: '高',
      hazard: '1 号总表 A 相断相',
      evidence: 'A相断相 2 次（10-03、10-17），计分事件按日去重',
      scope: '一号厂房 / 一号车间 / 1 号总表',
      unitId: 'U-A1',
      action: '检查进线电源、断路器与熔断器，确认缺相原因后复电',
      recheck: '3 天内',
    },
    {
      level: '高',
      hazard: '中央空调机房总表过温',
      evidence: '过温 1 次，最高 78℃（设备阈值 70℃）',
      scope: '二号厂房 / 中央空调机房总表',
      unitId: 'U-B',
      action: '检查接线端子、开关触点与散热，评估负载并停电检修',
      recheck: '3 天内',
    },
    {
      level: '高',
      hazard: '临时施工用电表电流严重不平衡',
      evidence: '电流严重不平衡 1 次，最大偏差 46%',
      scope: '一号厂房 / 一号车间 / 临时施工用电表',
      unitId: 'U-A1',
      action: '调整三相负荷分配，核查大功率单相负荷接入',
      recheck: '7 天内',
    },
    {
      level: '中',
      hazard: '多台设备功率因数偏低',
      evidence: '2 台设备期间最低功率因数 0.78（参考 ≥0.90）',
      scope: '一号厂房 / 二号厂房',
      unitId: 'U-B',
      action: '评估无功补偿容量与投切策略',
      recheck: '30 天内',
    },
    {
      level: '中',
      hazard: '1 台设备数据缺失影响安全监测',
      evidence: '设备数据覆盖率 92.4%，1 台设备缺数',
      scope: '综合楼 / 办公照明独立表',
      unitId: 'U-C1',
      action: '检查设备供电、通信与采集链路',
      recheck: '7 天内',
    },
  ],
  comparison: {
    scoreDelta: -6.1,
    highDelta: 2,
    midDelta: 4,
    highRiskDevicesPrevious: 1,
    highRiskDevicesCurrent: 2,
    repeatedDevices: ['1 号总表'],
  },
}

/** 系统运行报告演示数据 */
export const RUNTIME_REPORT = {
  status: '关注',
  deviceTotal: 7,
  onlineSnapshot: 6,
  offlineSnapshot: 1,
  onlineRate: 97.6,
  completeness: 99.2,
  commSuccess: 98.8,
  availableComponents: 3,
  offlineEverCount: 2,
  offlineCount: 5,
  offlineDuration: '18.5 h',
  addedDevices: 1,
  removedDevices: 0,
  noOnlineFact: 0,
  topOffline: [
    { name: '临时施工用电表', unit: '一号车间', unitId: 'U-A1', count: 3, duration: '12.5 h', lastAt: '2026-10-18 21:40' },
    { name: '办公照明独立表', unit: '综合楼', unitId: 'U-C1', count: 2, duration: '6.0 h', lastAt: '2026-10-22 09:15' },
  ],
  dataQuality: {
    shouldPoints: 8640,
    validPoints: 8571,
    missingPoints: 42,
    estimatedPoints: 18,
    abnormalPoints: 9,
    delayAverage: '42 s',
    delayP95: '3.2 min',
    resendCount: 6,
    topMissing: [
      { name: '办公照明独立表', unit: '综合楼', unitId: 'U-C1', missing: 26 },
      { name: '临时施工用电表', unit: '一号车间', unitId: 'U-A1', missing: 16 },
    ],
    trend: [
      { label: '10/01', value: 99.6 },
      { label: '10/05', value: 99.4 },
      { label: '10/09', value: 99.1 },
      { label: '10/13', value: 98.8 },
      { label: '10/17', value: 99.2 },
      { label: '10/21', value: 98.9 },
      { label: '10/25', value: 99.2 },
    ],
  },
  communication: {
    messages: 128640,
    failed: 1544,
    successRate: 98.8,
    reconnects: 18,
    topFailures: [
      { name: '连接超时', ratio: '42%' },
      { name: '鉴权失败', ratio: '31%' },
      { name: '网络中断', ratio: '27%' },
    ],
    topDevices: [
      { name: '临时施工用电表', unit: '一号车间', unitId: 'U-A1', failed: 682, reconnects: 9 },
      { name: '办公照明独立表', unit: '综合楼', unitId: 'U-C1', failed: 401, reconnects: 5 },
    ],
  },
  alarmSummary: {
    records: 41,
    devices: 5,
    topTypes: [
      { name: '电流不平衡', count: 6 },
      { name: '过温', count: 4 },
      { name: 'A相断相', count: 3 },
      { name: '开表盖', count: 2 },
      { name: '需量超限', count: 2 },
    ],
    topDevices: [
      { name: '中央空调机房总表', unitId: 'U-B', count: 5 },
      { name: '1 号总表', unitId: 'U-A1', count: 4 },
      { name: '车间照明独立表', unitId: 'U-A1', count: 3 },
    ],
  },
  recommendations: [
    {
      level: '高',
      issue: '1 台设备期末离线',
      evidence: '临时施工用电表 10-18 起离线 3 次，累计 12.5 h',
      impact: '该设备用能与安全数据缺失',
      action: '检查设备供电、通信模块、天线与现场网络',
      recheck: '3 天内',
      unitId: 'U-A1',
    },
    {
      level: '高',
      issue: '数据延迟 P95 3.2 分钟',
      evidence: '上报延迟高于 1 分钟的设备 2 台',
      impact: '实时性下降，补传增多',
      action: '检查设备时钟、上报周期与网络质量',
      recheck: '7 天内',
      unitId: 'U-A1',
    },
    {
      level: '中',
      issue: '通信失败集中在 2 台设备',
      evidence: '失败 1544 条，成功率 98.8%',
      impact: '偶发缺数，影响完整率',
      action: '检查信号强度、MQTT 连接与鉴权配置',
      recheck: '7 天内',
      unitId: 'U-C1',
    },
  ],
  comparison: {
    onlineRatePrevious: 98.9,
    completenessPrevious: 99.6,
    commSuccessPrevious: 99.3,
    alarmRecordsPrevious: 28,
  },
}

/** 用能报告演示诊断与建议 */
export const ENERGY_DIAGNOSIS = [
  {
    level: '高',
    conclusion: '用能同比 +24.3%',
    evidence: '本期 23,430 kWh，去年同期 18,850 kWh',
    scope: '华东智造园区',
    action: '核查新增负荷、设备增减、生产/营业变化与计量口径变更',
  },
  {
    level: '中',
    conclusion: '峰段用电占比偏高',
    evidence: '尖 + 峰电量占比 52%（参考 <50%）',
    scope: '华东智造园区',
    action: '评估错峰生产、负荷转移与需量管理',
  },
  {
    level: '中',
    conclusion: '总功率因数偏低',
    evidence: '期间平均 0.88（参考 ≥0.90）',
    scope: '一号厂房 / 二号厂房',
    action: '评估无功补偿容量与投切策略',
  },
]

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
