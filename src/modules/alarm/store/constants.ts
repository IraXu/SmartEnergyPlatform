/**
 * 【原型说明】告警中心模块的存储键与规则常量，仅用于原型演示。
 */

export const ALARM_LIST_KEY = 'proto_alarm_list'
export const ALARM_LOGS_KEY = 'proto_alarm_logs'
export const ALARM_VERSION_KEY = 'proto_alarm_data_version'

/** 【原型说明】演示数据结构版本，调整演示数据时提升版本以清理旧数据 */
export const ALARM_DATA_VERSION = '4'

/** 时间范围最大跨度：12 个月 */
export const RANGE_SPAN_MONTHS = 12

/** 导出单次上限 */
export const EXPORT_LIMIT = 10000

export const ALARM_ALL_KEYS = [ALARM_LIST_KEY, ALARM_LOGS_KEY] as const
