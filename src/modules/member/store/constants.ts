/**
 * 【原型说明】企业成员模块的存储键与规则常量，仅用于原型演示。
 * 规则取值对齐《产品需求文档-企业成员》v1.0 的业务规则。
 */

export const MEMBER_LIST_KEY = 'proto_member_list'
export const MEMBER_LOGS_KEY = 'proto_member_logs'
export const MEMBER_VERSION_KEY = 'proto_member_data_version'

/** 【原型说明】演示数据结构版本，调整演示数据时提升版本以清理旧数据 */
export const MEMBER_DATA_VERSION = '2'

/** 成员姓名长度（PRD F-MEM-02 业务规则） */
export const NAME_MIN = 2
export const NAME_MAX = 20
/** 初始密码长度，与认证模块的密码强度规则一致（8-20 位，中及以上） */
export const PASSWORD_MIN = 8
export const PASSWORD_MAX = 20
/** 搜索关键字长度上限（PRD F-MEM-01） */
export const SEARCH_MAX = 50
/** 单个成员最多可选的组织节点数量（PRD F-MEM-05 异常处理） */
export const SCOPE_NODE_LIMIT = 100

/**
 * 【原型说明】预置角色「企业超级管理员」的标识。
 * 与角色管理模块的预置角色保持一致；此处独立声明以避免
 * 「成员 → 角色（取角色清单）」与「角色 → 成员（统计成员数）」形成循环依赖。
 */
export const SUPER_ADMIN_ROLE_ID = 'ROLE-PRESET'

export const MEMBER_ALL_KEYS = [MEMBER_LIST_KEY, MEMBER_LOGS_KEY] as const
