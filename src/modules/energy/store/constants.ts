/**
 * 【原型说明】能源数据模块的权限点、存储键与规则常量，仅用于原型演示。
 * 权限点标识与《角色管理》权限字典、交互文档保持一致。
 */

/** 权限点：与《角色管理》权限字典一致 */
export const PERM = {
  /** 能源数据模块根权限（控制一级菜单可见） */
  energy: 'energy',
  /** 设备数据分析 */
  monitor: 'energy:monitor',
  /** 用能分析 */
  analysis: 'energy:analysis',
  /** 统计报表：查看/预览 */
  report: 'energy:report',
  /** 报表生成/重新生成 */
  reportGenerate: 'energy:report:generate',
  /** 报表 PDF 导出 */
  reportExport: 'energy:report:export',
  /** 数据导出（用能分析 / 设备数据分析共用） */
  export: 'energy:export',
  /** 用电统计设置（用能单元详情页签内编辑） */
  meterStatEdit: 'system:org:unit:meterstat:edit',
} as const

export const ENERGY_VERSION_KEY = 'proto_energy_version'
/** 【原型说明】演示数据结构版本，调整演示数据时提升版本以清理旧数据 */
export const ENERGY_DATA_VERSION = '4'

export const ENERGY_METERSTAT_KEY = 'proto_energy_meterstat'
export const ENERGY_REPORTS_KEY = 'proto_energy_reports'

/** 演示数据清理范围 */
export const ENERGY_ALL_KEYS = [ENERGY_METERSTAT_KEY, ENERGY_REPORTS_KEY] as const

/** 导出单次行数上限（标准档） */
export const EXPORT_ROW_LIMIT = 50000
/** 导出生成时效（秒），超时转异步 */
export const EXPORT_ASYNC_SECONDS = 60
/** 报表并发生成上限 */
export const REPORT_CONCURRENCY = 3

/** 时间范围最大跨度：12 个月 */
export const RANGE_SPAN_MONTHS = 12
/** 比较对象数量上限 */
export const COMPARE_OBJECT_LIMIT = 10
/** 排名默认展示条数 */
export const RANK_TOP_N = 10
/** 设备数据分析：单次最多对比设备数 */
export const DEVICE_COMPARE_LIMIT = 10
/** 设备数据分析：多设备对比曲线配色（按选择顺序分配） */
export const DEVICE_COMPARE_COLORS = [
  '#0f7b6c',
  '#1890ff',
  '#faad14',
  '#722ed1',
  '#13c2c2',
  '#eb2f96',
  '#52c41a',
  '#ff4d4f',
  '#2f54eb',
  '#8c8c8c',
]

/** 年报开放阈值：具备不少于 13 个月的日/月汇总 */
export const ANNUAL_MIN_MONTHS = 13

/** 报告类型标签（顺序与页面页签一致） */
export const REPORT_TYPE_LABELS = {
  safety: '安全报告',
  energy: '用能报告',
  runtime: '系统运行报告',
} as const

/** 时区与时间格式（沿用平台约定） */
export const TIME_FORMAT = 'YYYY-MM-DD HH:mm'
