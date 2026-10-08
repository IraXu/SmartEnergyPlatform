/**
 * 【原型说明】点位地图模块的统一出口，仅用于原型交互验证，非生产代码。
 *
 * 本模块为只读空间视图，**不维护任何演示数据**：用能单元取自组织架构（`@/modules/org`）、
 * 设备取自设备台账（`@/modules/device`），本模块只做加工与呈现，因此没有 storage / mock。
 */

export * from './constants'
export * from './types'
export * from './location'
