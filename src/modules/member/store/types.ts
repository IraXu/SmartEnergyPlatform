/**
 * 【原型说明】企业成员模块的数据结构定义，仅用于原型交互验证。
 * 信息项对齐《产品需求文档-企业成员》v1.0 与《产品交互设计文档-企业成员》v1.0，
 * 不涉及数据库表、字段类型或接口设计。
 */

/** 成员业务状态：由管理员控制，与账号安全状态（ACTIVE / LOCKED / DISABLED）正交 */
export type MemberStatus = 'normal' | 'disabled'

/**
 * 企业成员：企业内可以使用本系统的账号对象。
 * 功能权限来自「角色」的权限点并集，数据可见范围来自「数据范围」绑定的组织节点（PRD 2.4 假设）。
 */
export interface Member {
  id: string
  name: string
  accountType: 'phone' | 'email'
  /** 账号标识：手机号为「国际区号 + 本地号码」，邮箱为完整地址；全平台唯一 */
  identifier: string
  /** 手机号账号所属国际区号，邮箱账号为空 */
  countryCode: string
  /** 角色 ID 集合；权限取并集（PRD F-MEM-04） */
  roleIds: string[]
  /** 数据范围：所选组织节点 ID 集合，范围含各节点全部下级（PRD F-MEM-05） */
  scopeIds: string[]
  status: MemberStatus
  /** 首次登录或重置后仍未修改密码时为 true，列表展示「待改密」 */
  mustChangePassword: boolean
  createdAt: number
  /** 最近一次信息变更时间（新增、编辑、启停用、重置密码均更新） */
  updatedAt: number
}

export type MemberChangeType =
  | '新增成员'
  | '编辑成员'
  | '账号变更'
  | '角色变更'
  | '数据范围变更'
  | '停用成员'
  | '启用成员'
  | '删除成员'
  | '重置密码'

/** 【原型说明】成员与权限变更记录，对应 PRD F-MEM-09（正式查看入口为「系统管理 › 系统日志」） */
export interface MemberChangeLog {
  id: string
  at: number
  account: string
  type: MemberChangeType
  /** 目标成员展示名（姓名 + 脱敏账号） */
  target: string
  detail: string
}

export interface MemberCreateInput {
  name: string
  accountType: 'phone' | 'email'
  identifier: string
  countryCode: string
  /** 初始密码；账号已存在于平台（进入「加入企业」语义）时为空，沿用该账号现有密码 */
  password: string
  roleIds: string[]
  scopeIds: string[]
}

export interface MemberUpdateInput {
  name: string
  accountType: 'phone' | 'email'
  identifier: string
  countryCode: string
  roleIds: string[]
  scopeIds: string[]
}
