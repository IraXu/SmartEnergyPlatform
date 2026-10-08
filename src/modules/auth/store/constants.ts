/**
 * 【原型说明】认证模块的存储键与规则常量。
 * 规则取值严格对齐 PRD《登录与注册》与交互设计文档的业务规则。
 */

export const ACCOUNTS_KEY = 'proto_accounts'
export const LOCK_KEY = 'proto_lock_map'
export const SESSION_KEY = 'proto_session'
export const CODE_KEY = 'proto_codes'
export const RECENT_ORG_KEY = 'proto_recent_org'
export const REMEMBER_ORG_KEY = 'proto_remember_org'
export const VERSION_KEY = 'proto_data_version'

/** 【原型说明】演示数据结构版本。新增预置账号「仅归属其他企业」（用于演示加入企业场景）后提升版本，旧数据自动清除 */
export const DATA_VERSION = '7'

/** 登录态有效期：未勾选记住登录状态 2 小时，勾选后 7 天 */
export const SESSION_TIMEOUT_MS = 2 * 60 * 60 * 1000
export const SESSION_REMEMBER_MS = 7 * 24 * 60 * 60 * 1000
/** 验证码有效期 5 分钟 */
export const CODE_TTL_MS = 5 * 60 * 1000
/** 验证码发送冷却 60 秒 */
export const CODE_COOLDOWN_MS = 60 * 1000
/** 单日验证码获取上限 */
export const CODE_DAILY_LIMIT = 10
/** 连续失败达到该次数后要求图形验证码 */
export const CAPTCHA_AFTER_FAILS = 3
/** 连续失败达到该次数后锁定账号 */
export const LOCK_AFTER_FAILS = 5
/** 账号锁定时长 15 分钟 */
export const LOCK_DURATION_MS = 15 * 60 * 1000

export const ALL_STORAGE_KEYS = [
  ACCOUNTS_KEY,
  LOCK_KEY,
  CODE_KEY,
  SESSION_KEY,
  RECENT_ORG_KEY,
  REMEMBER_ORG_KEY,
] as const
