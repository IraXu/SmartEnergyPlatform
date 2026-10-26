/**
 * 【原型说明】角色管理模块的存储键与规则常量，仅用于原型演示。
 * 规则取值对齐《产品需求文档-角色管理》v1.0 的业务规则。
 */

export const ROLE_LIST_KEY = 'proto_role_list'
export const ROLE_LOGS_KEY = 'proto_role_logs'
export const ROLE_VERSION_KEY = 'proto_role_data_version'

/** 【原型说明】演示数据结构版本，调整演示数据时提升版本以清理旧数据 */
export const ROLE_DATA_VERSION = '19'

/** 角色名称长度（PRD F-ROL-04 业务规则） */
export const ROLE_NAME_MIN = 2
export const ROLE_NAME_MAX = 20
/** 角色描述长度上限 */
export const ROLE_DESC_MAX = 100
/** 单企业自定义角色数量上限（不含预置角色，PRD F-ROL-01） */
export const ROLE_LIMIT = 50
/** 搜索关键字长度上限 */
export const SEARCH_MAX = 30

export const ROLE_ALL_KEYS = [ROLE_LIST_KEY, ROLE_LOGS_KEY] as const
