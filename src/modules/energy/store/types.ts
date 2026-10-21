/**
 * 【原型说明】能源数据模块的数据类型定义，仅用于原型交互验证。
 */

/** 数据质量标记：真实有效 / 缺失 / 估算·展示补齐 / 异常 */
export type QualityMark = 'valid' | 'missing' | 'estimated' | 'abnormal'

/** 用能分析方式 */
export type AnalysisMode = 'trend' | 'yoy' | 'compare' | 'tou'

/** 统计方式（用电统计设置） */
export type MeterStatMode = 'total' | 'sum'

/** 计量角色 */
export type MeterRole = '总表' | '分项表' | '独立电表'

/** 报告周期 */
export type ReportPeriod = 'monthly' | 'annual'

/** 报告状态 */
export type ReportStatus = 'generating' | 'generated' | 'failed'

/** 曲线/图表的一个数据点 */
export interface SeriesPoint {
  /** 时间标签（按粒度：日/周/月 或 采集时刻） */
  label: string
  /** 数值；缺失时为 null */
  value: number | null
  quality: QualityMark
}

/** 图表序列 */
export interface Series {
  name: string
  color: string
  /** 线型：同一设备多指标时用实线 / 虚线 / 点线区分 */
  dash?: 'solid' | 'dashed' | 'dotted'
  points: SeriesPoint[]
}

/** 历史明细行 */
export interface DetailRow {
  id: string
  time: string
  metric: string
  value: string
  unit: string
  quality: QualityMark
  remark: string
}

/** 排名行 */
export interface RankRow {
  id: string
  name: string
  current: number
  previous: number
  delta: number
  deltaRate: number | null
  ratio: number | null
  unitId: string
}

/** 报告版本（一行 = 一个版本） */
export interface ReportVersion {
  id: string
  name: string
  period: ReportPeriod
  periodText: string
  /** 报告范围（生成时的用能单元层级路径；历史版本保留生成时快照） */
  scope?: string
  version: number
  status: ReportStatus
  generatedAt: string
  sizeText: string
  operator: string
}

/** 用电统计设置（按用能单元） */
export interface MeterStatConfig {
  unitId: string
  mode: MeterStatMode
  totalMeterId: string | null
  subMeterIds: string[]
  meterIds: string[]
  effectiveAt: string
  updatedBy: string
  confirmed: boolean
}

/** 计量电表（设备） */
export interface MeterDevice {
  id: string
  name: string
  /** License：设备唯一标识 */
  license: string
  /** 设备识别码（IMEI） */
  imei: string
  role: MeterRole
  isGateway: boolean
  unitId: string
}

/** 分项构成（占比） */
export interface SubItem {
  name: string
  value: number
  ratio: number
}
