/**
 * 【原型说明】设备管理 › 设备台账模块的存储键与规则常量，仅用于原型演示。
 * 规则取值对齐《产品需求文档-设备台账》v1.0 与《产品交互设计文档-设备台账》v1.0。
 */

export const DEVICE_LIST_KEY = 'proto_device_list'
export const DEVICE_LOGS_KEY = 'proto_device_logs'
export const DEVICE_VERSION_KEY = 'proto_device_data_version'
/** MQTT 通讯日志本地存储键 */
export const DEVICE_MQTT_LOGS_KEY = 'proto_device_mqtt_logs'
/** 设备上下线记录本地存储键 */
export const DEVICE_SESSIONS_KEY = 'proto_device_sessions'
/** 列表列展示偏好（列顺序与隐藏项）本地存储键 */
export const DEVICE_COLUMN_PREFS_KEY = 'proto_device_column_prefs'
/** 列表 / 卡片展示方式偏好本地存储键 */
export const DEVICE_VIEW_KEY = 'proto_device_view_mode'

/** 【原型说明】演示数据结构版本，调整演示数据时提升版本以清理旧数据 */
export const DEVICE_DATA_VERSION = '20'

/** MQTT 通讯日志保留天数：仅保留最近 30 天，超出部分自动删除（PRD F-DEV-14） */
export const MQTT_LOG_KEEP_DAYS = 30

/** 上下线记录保留天数：与 MQTT 通讯日志保持同一口径，仅保留最近 30 天 */
export const SESSION_KEEP_DAYS = 30

/** 设备名称长度（PRD F-DEV-04 业务规则） */
export const NAME_MAX = 50
/** License 长度上限 */
export const CODE_MAX = 50
/** 卡号（ICCID）长度上限（服务端返回，仅用于展示截断） */
export const CARD_NO_MAX = 32
/** 安装位置描述与备注长度上限 */
export const INSTALL_POSITION_MAX = 100
export const REMARK_MAX = 200

/** 查询关键字长度上限（设备名称 / 设备识别码 / License / 表号 各输入框共用） */
export const SEARCH_MAX = 50

/** 批量导入：单次最大行数、文件大小上限、接受的扩展名 */
export const IMPORT_MAX_ROWS = 2000
export const IMPORT_FILE_MAX_MB = 10
export const IMPORT_ACCEPT_EXTS = ['.xlsx', '.xls', '.csv']

export const DEVICE_ALL_KEYS = [
  DEVICE_LIST_KEY,
  DEVICE_LOGS_KEY,
  DEVICE_MQTT_LOGS_KEY,
  DEVICE_SESSIONS_KEY,
  // 列展示偏好随演示数据一并重置，保证默认列顺序（所属用能单元置首）与默认隐藏列生效
  DEVICE_COLUMN_PREFS_KEY,
] as const
