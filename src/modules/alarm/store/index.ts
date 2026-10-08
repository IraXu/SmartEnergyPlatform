/**
 * 【原型说明】告警中心模块的统一出口，仅用于原型交互验证，非生产代码。
 */

export * from './constants'
export * from './types'
export * from './alarm'

export { alarms, logs, persistAlarms, persistLogs, resetAlarmData } from './storage'
