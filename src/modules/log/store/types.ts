/**
 * 【原型说明】系统日志模块的数据结构定义，仅用于原型交互验证。
 * 信息项对齐《产品需求文档-系统日志》v1.0 与《产品交互设计文档-系统日志》v1.0，
 * 不涉及数据库表、字段类型或接口设计。
 */

/** 日志类型：登录日志 / 操作行为日志（单页双页签） */
export type LogTab = 'login' | 'operation'

/** 所属模块（一级导航项） */
export type LogModule = '系统管理' | '设备管理' | '告警中心'

/** 功能（二级及更深导航项） */
export type LogFeature =
  | '组织架构'
  | '企业成员'
  | '角色管理'
  | '企业中心'
  | '设备台账'
  | '设备OTA'
  | '设备用电管控 › 负荷策略'
  | '告警中心'

/** 登录方式（仅「登录」类型记录有值；退出登录为空） */
export type LoginMethod = '密码登录' | '验证码登录' | '注册后自动登录'

/**
 * 会话操作类型：登录 / 退出登录。
 * 本页记录账号的**会话行为**，因此登录与退出登录同属本页；退出登录的方式、结果与失败原因不适用。
 */
export type SessionActionType = '登录' | '退出登录'

/**
 * 会话结果（与《项目术语表》登录记录状态一致）：
 * 登录可为成功 / 失败 / 已锁定；退出登录恒为成功。
 */
export type LoginResult = '成功' | '失败' | '已锁定'

/** 账号数据范围说明：会话类日志只记录当前账号在本企业的行为，不跨企业 */
export interface LoginLog {
  id: string
  /** 操作时间 */
  at: number
  /** 操作类型：登录 / 退出登录 */
  action: SessionActionType
  /** 账号标识，按原值展示（不脱敏） */
  account: string
  /** 账号姓名快照；缺失展示 — */
  accountName: string
  /** 登录方式；仅「登录」记录有值 */
  method: LoginMethod | ''
  result: LoginResult
  /** 失败原因；仅「登录」的失败与锁定记录有值 */
  failReason: string
  /** 来源 IP，按原值展示 */
  ip: string
  /** 来源终端摘要：浏览器 + 操作系统 */
  terminal: string
}

/**
 * 变更明细的呈现形态（对齐交互文档 COMP-LOG-01 的五类形态 + 兜底文本）：
 * - field：字段级前后值表
 * - permission：权限点增删清单
 * - state：状态变更条（原状态 → 新状态）
 * - ownership：归属变更条（原归属 → 新归属）
 * - objects：对象清单表（批量 / 执行类）
 * - text：无结构化的文字说明
 */
export type ChangeDetail =
  | { kind: 'field'; rows: Array<{ field: string; before: string; after: string }> }
  | { kind: 'permission'; added: string[]; removed: string[] }
  | { kind: 'state'; before: string; after: string }
  | { kind: 'ownership'; before: string; after: string }
  | { kind: 'objects'; total: number; rows: Array<{ name: string; result: string; note: string }> }
  | { kind: 'text'; text: string }

/** 一条操作行为日志（统一形态：各业务模块日志按同一口径映射而来） */
export interface OperationLog {
  id: string
  /** 操作时间 */
  at: number
  /** 操作账号，按原值展示（不脱敏） */
  account: string
  /** 账号姓名快照 */
  accountName: string
  module: LogModule
  feature: LogFeature
  /** 变更类型（展示用名称） */
  changeType: string
  /** 操作对象类型，如「角色」「设备」 */
  objectType: string
  /** 操作对象标识，如节点层级路径、License */
  objectId: string
  /** 操作对象名称快照 */
  objectName: string
  /** 对象已被删除（以快照展示并标注） */
  objectDeleted?: boolean
  /** 变更内容摘要（列表单行展示） */
  summary: string
  detail: ChangeDetail
}

/** 时间范围：起止均为 `YYYY-MM-DD`，查询时左闭右闭（按天） */
export type DateRange = [string, string]

/** 登录日志查询条件 */
export interface LoginFilters {
  /** 时间范围，默认当日；跨度上限 90 天 */
  dateRange: DateRange
  /** 账号或姓名模糊匹配 */
  keyword: string
  /** 操作类型，空数组表示全部 */
  actions: SessionActionType[]
  /** 登录方式，空数组表示全部（退出登录记录不受此项影响） */
  methods: LoginMethod[]
  /** 结果，空数组表示全部 */
  results: LoginResult[]
}

/** 操作行为日志查询条件 */
export interface OperationFilters {
  dateRange: DateRange
  /** 操作账号或姓名模糊匹配 */
  keyword: string
  /** 所属模块；空表示全部 */
  module: LogModule | ''
  /** 功能；空表示全部 */
  feature: LogFeature | ''
  /** 变更类型；空表示全部 */
  changeType: string
  /** 关键字：匹配对象名称、变更内容摘要与账号 */
  search: string
}

/** 两类日志通用的筛选面板状态（页签各自保留） */
export interface LogPageState<T> {
  filters: T
  page: number
  pageSize: number
  loaded: boolean
}
