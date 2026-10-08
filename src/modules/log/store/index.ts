/**
 * 【原型说明】系统日志模块的统一出口，仅用于原型交互验证，非生产代码。
 * 业务规则对齐《产品需求文档-系统日志》v1.0。
 */

export * from './constants'
export * from './types'
export * from './log'

export { allLoginLogs, presetOperationLogs, resetLogData, runtimeLoginLogs } from './storage'
