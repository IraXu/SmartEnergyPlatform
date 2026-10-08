/**
 * 【原型说明】系统日志模块的存储键与规则常量，仅用于原型演示。
 * 规则取值对齐《产品需求文档-系统日志》v0.1 的业务规则。
 */

/** 独立存储键：仅存原型内「新产生」的登录记录，预置演示数据不入库 */
export const LOGIN_LOG_KEY = 'proto_login_logs'
export const LOG_VERSION_KEY = 'proto_log_data_version'

/** 【原型说明】演示数据结构版本，调整演示数据时提升版本以清理旧数据 */
export const LOG_DATA_VERSION = '2'

/** 单次查询时间范围跨度上限：90 天（PRD Q-LOG-04 待确认值） */
export const RANGE_SPAN_DAYS = 90

/** 导出单次上限：10000 行（PRD Q-LOG-04 待确认值） */
export const EXPORT_LIMIT = 10000

/** 日志留存周期：12 个月（PRD Q-LOG-01 待确认值） */
export const RETENTION_MONTHS = 12

/** 默认时间范围：当日（进入本页的数据压力最小，需要时再手动放宽） */
export const DEFAULT_RANGE_DAYS = 1

/** 对象清单类明细单次展示上限（交互文档 Q-IXD-LOG-01 倾向值） */
export const OBJECT_DETAIL_LIMIT = 200

/** 分页可选每页条数 */
export const PAGE_SIZE_OPTIONS = ['10', '20', '50', '100']
