/**
 * 【原型说明】设备管理 › 设备OTA 模块的存储键与规则常量，仅用于原型演示。
 * 规则取值对齐《产品需求文档-设备OTA》v1.0 与《产品交互设计文档-设备OTA》v1.0。
 */

export const OTA_STATE_KEY = 'proto_ota_states'
export const OTA_TASK_KEY = 'proto_ota_tasks'
export const OTA_LOG_KEY = 'proto_ota_logs'
export const OTA_VERSION_KEY = 'proto_ota_data_version'

/** 【原型说明】演示数据结构版本，调整演示数据时提升版本以清理旧数据 */
export const OTA_DATA_VERSION = '1'

/** 查询关键字长度上限（设备名称 / 识别码 / License 共用同一输入框） */
export const OTA_SEARCH_MAX = 50

/** 【原型说明】升级进度模拟的推进节拍与步长 */
export const OTA_TICK_MS = 1200
export const OTA_STEP_MIN = 8
export const OTA_STEP_MAX = 18
/** 【原型说明】演示中判定升级失败的进度阈值 */
export const OTA_FAIL_AT = 55

export const OTA_ALL_KEYS = [OTA_STATE_KEY, OTA_TASK_KEY, OTA_LOG_KEY] as const
