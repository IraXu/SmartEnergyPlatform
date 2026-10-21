/**
 * 【原型说明】平台管理端模块的存储键与规则常量，仅用于原型演示。
 * 规则取值对齐平台管理端各 PRD v1.0 的业务规则。
 */

export const PLATFORM_MEMBER_KEY = 'proto_platform_members'
export const PLATFORM_ROLE_KEY = 'proto_platform_roles'
export const PLATFORM_VERSION_KEY = 'proto_platform_data_version'

/** 【原型说明】演示数据结构版本，调整演示数据时提升版本以清理旧数据 */
export const PLATFORM_DATA_VERSION = '1'

/** 成员姓名长度（对齐企业成员口径） */
export const PLATFORM_NAME_MIN = 2
export const PLATFORM_NAME_MAX = 20
/** 初始密码长度 */
export const PLATFORM_PASSWORD_MIN = 8
export const PLATFORM_PASSWORD_MAX = 20
/** 角色名称长度（对齐企业角色口径） */
export const PLATFORM_ROLE_NAME_MIN = 2
export const PLATFORM_ROLE_NAME_MAX = 20
export const PLATFORM_ROLE_DESC_MAX = 50
/** 搜索关键字长度上限 */
export const PLATFORM_SEARCH_MAX = 50

export const PLATFORM_ALL_KEYS = [PLATFORM_MEMBER_KEY, PLATFORM_ROLE_KEY] as const
