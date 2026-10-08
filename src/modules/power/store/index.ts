/**
 * 【原型说明】设备管理 › 设备用电管控 › 负荷策略 模块的统一出口，仅用于原型交互验证，非生产代码。
 * 业务规则对齐《产品需求文档-负荷策略》v0.1。
 *
 * 设备档案与用能单元取自「设备台账」与「组织架构」的演示数据容器，本模块不重复维护。
 */

export * from './constants'
export * from './types'
export * from './strategy'

/** 用能单元层级路径取设备台账的口径，避免同一展示规则在多处维护 */
export { unitPath } from '@/modules/device/store'

export { execBatches, latches, strategies, strategyLogs } from './storage'
export { persistExecBatches, persistLatches, persistStrategies, persistStrategyLogs } from './storage'
export { resetStrategyData } from './storage'
