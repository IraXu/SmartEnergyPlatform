/**
 * 【原型说明】认证模块的数据结构定义。
 */

export interface LockState {
  /** 连续失败次数 */
  fails: number
  /** 锁定到期时间戳，0 表示未锁定 */
  lockedUntil: number
}

/**
 * 账号在某企业下的可用状态：由该企业管理员控制，仅作用于这一家企业。
 * 账号归属多家企业时，在 A 企业被停用不影响其进入 B 企业。
 */
export type MembershipStatus = 'normal' | 'disabled'

/**
 * 【原型说明】账号在某个企业下的归属关系（账号 ↔ 企业为多对多）。
 * 角色、联系人信息、可用状态均按企业维度维护：同一账号在不同企业可担任不同角色，
 * 因此这些字段不能再挂在账号上。
 */
export interface Membership {
  /** 企业标识，账号在不同企业下的唯一区分 */
  orgId: string
  orgName: string
  industry: string
  region: string
  /** 该账号在此企业下的角色 */
  role: string
  roleCode: string
  /** 该账号在此企业下登记的企业联系人信息 */
  contactName: string
  contactTitle: string
  /** 联系人电话，采用「国际区号 + 本地号码」标识 */
  contactPhone: string
  /** 企业级可用状态：被该企业停用后不可再进入该企业，但不影响其他企业 */
  status: MembershipStatus
  /** 加入该企业的时间戳 */
  joinedAt: number
}

/** 新增归属关系时的入参：可用状态默认 normal，由企业成员页的启停用控制 */
export type MembershipInput = Omit<Membership, 'joinedAt' | 'status'>

/**
 * 账号的注册来源，决定其在注册页与「企业成员」新增时的处理方式：
 * - `platform`：本人从平台登录注册页自助注册过，已设置自己的密码，因此不可再次自助创建企业；
 * - `member`：仅被某企业管理员在「企业成员」页新增，从未自助注册，密码由管理员交付的初始密码而来。
 *
 * 该维度用于区分「账号存在」的两种含义：账号存在但非自助注册时，本人仍可自助创建企业。
 */
export type AccountSource = 'platform' | 'member'

export interface SessionState {
  identifier: string
  accountType: 'phone' | 'email'
  /** 手机号账号的国际区号，邮箱账号为空 */
  countryCode: string
  /** 当前进入的企业：企业维度信息取自当前归属关系，切换企业后随之变化 */
  orgId: string
  role: string
  roleCode: string
  orgName: string
  industry: string
  region: string
  /** 联系人姓名 */
  contactName: string
  /** 联系人职务 */
  contactTitle: string
  /** 联系人电话，采用「国际区号 + 本地号码」标识 */
  contactPhone: string
  remember: boolean
  expiresAt: number
  /**
   * 【原型说明】控制台分流标记：
   * - `enterprise`（或缺省）：企业端会话，按企业边界访问业务模块；
   * - `platform`：平台管理端会话，账号不属任何企业，导航为「首页 / 客户&设备 / 平台管理」。
   * 平台成员为独立体系，其会话不复用企业上下文字段。
   */
  scope?: 'enterprise' | 'platform'
  /** 平台端会话：平台成员标识 */
  platformMemberId?: string
  /** 平台端会话：平台成员姓名 */
  platformName?: string
  /** 平台端会话：平台角色标识集合（用于权限计算） */
  platformRoleIds?: string[]
  /** 平台端会话：平台角色名称集合（用于顶栏展示） */
  platformRoles?: string[]
  /** 平台端会话：是否内置平台超级管理员 */
  platformSuper?: boolean
}

/**
 * 【原型说明】账号的「最近登录企业」记录。
 * 核心定义：最近登录 = 该账号最近一次「成功选择某企业并进入系统」的时间。
 * 该记录同时作为「记住选择」的下次自动进入依据，一套机制两个表现：
 * 选择页给对应企业打「最近登录」标签，登录时据此跳过选择页。
 */
export interface RecentOrgRecord {
  orgId: string
  /** 最近一次成功进入该企业的时间戳 */
  at: number
}

export interface CodeRecord {
  /** 用途：register / login / reset / join */
  scene: string
  code: string
  expiresAt: number
  /** 当日已发送次数 */
  sentCount: number
  sentDate: string
}
