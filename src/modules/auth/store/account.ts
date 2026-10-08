/**
 * 【原型说明】原型账号池的查询与创建，以及账号↔企业归属关系的维护。
 * 账号与企业为多对多：一个账号可归属多个企业，同一账号在不同企业下可担任不同角色。
 */

import type { AccountSource, Membership, MembershipInput, MembershipStatus } from './types'
import type { PrototypeAccount } from '@/modules/auth/mock/seed'
import { accounts, persistAccounts } from './storage'
import { normalizeIdentifier } from './identifier'

export function findAccount(identifier: string): PrototypeAccount | undefined {
  return accounts.find((item) => item.identifier === normalizeIdentifier(identifier))
}

/** 账号是否已从平台登录注册页自助注册过（决定能否再次自助创建企业） */
export function isPlatformRegistered(identifier: string): boolean {
  return findAccount(identifier)?.source === 'platform'
}

/**
 * 账号当前可进入的企业列表，按加入时间正序（先加入的在前）。
 * 已剔除被所属企业停用的归属：这类归属仍保留在账号下，但不出现在选择页与企业切换菜单中。
 */
export function membershipsOf(account: PrototypeAccount | undefined): Membership[] {
  if (!account) return []
  return account.memberships
    .filter((item) => item.status !== 'disabled')
    .sort((a, b) => a.joinedAt - b.joinedAt)
}

/** 取账号在指定企业下的归属关系；未归属该企业时返回 undefined */
export function findMembership(
  account: PrototypeAccount | undefined,
  orgId: string,
): Membership | undefined {
  return account?.memberships.find((item) => item.orgId === orgId)
}

/** 账号归属的企业数量，用于判断登录后是否需要进入「选择登录企业」阶段 */
export function membershipCount(identifier: string): number {
  return findAccount(identifier)?.memberships.length ?? 0
}

/** 新建账号时的入参：账号凭证与企业归属关系分离传入 */
export interface CreateAccountInput {
  accountType: 'phone' | 'email'
  identifier: string
  countryCode: string
  password: string
  membership: MembershipInput
  /** 注册来源，默认 `platform`（注册页自助创建企业） */
  source?: AccountSource
}

export function createAccount(payload: CreateAccountInput): PrototypeAccount {
  const account: PrototypeAccount = {
    accountType: payload.accountType,
    identifier: normalizeIdentifier(payload.identifier),
    countryCode: payload.countryCode,
    password: payload.password,
    // 由注册页自助创建企业产生的账号，来源为平台
    source: payload.source ?? 'platform',
    id: `ACC-${1000 + accounts.length + 1}`,
    status: 'ACTIVE',
    memberships: [{ ...payload.membership, status: 'normal', joinedAt: Date.now() }],
  }
  accounts.push(account)
  persistAccounts()
  return account
}

/**
 * 【原型说明】由「企业成员」页新增成员时，把该账号写入平台账号池。
 *
 * - 平台不存在该账号：新建账号，来源为 `member`（本人从未自助注册），密码为管理员交付的初始密码；
 * - 平台已存在该账号：不新建、不改密码，仅返回已有账号，由调用方追加归属关系。
 *   这正是「加入企业」不需要输出密码的原因：账号已有平台级唯一密码。
 */
export function ensureAccountForMember(payload: {
  accountType: 'phone' | 'email'
  identifier: string
  countryCode: string
  password: string
}): { account: PrototypeAccount; created: boolean } {
  const existing = findAccount(payload.identifier)
  if (existing) return { account: existing, created: false }
  const account: PrototypeAccount = {
    accountType: payload.accountType,
    identifier: normalizeIdentifier(payload.identifier),
    countryCode: payload.countryCode,
    password: payload.password,
    source: 'member',
    id: `ACC-${1000 + accounts.length + 1}`,
    status: 'ACTIVE',
    memberships: [],
  }
  accounts.push(account)
  persistAccounts()
  return { account, created: true }
}

/**
 * 本人从注册页自助创建企业后，把账号来源升级为平台。
 * 此后该账号不可再次自助创建企业（一个账号最多自主创建一家企业）。
 */
export function markPlatformRegistered(account: PrototypeAccount) {
  if (account.source === 'platform') return
  account.source = 'platform'
  persistAccounts()
}

/**
 * 给已存在的账号新增一条企业归属（第二家及以后的企业注册）。
 * 【原型说明】密码为平台级唯一，此处只追加归属关系，不读写密码字段，
 * 因此 B 企业注册不会覆盖该账号在 A 企业下使用的密码。
 */
export function addMembership(
  account: PrototypeAccount,
  membership: MembershipInput,
): Membership {
  const created: Membership = { ...membership, status: 'normal', joinedAt: Date.now() }
  account.memberships.push(created)
  persistAccounts()
  return created
}

/**
 * 移除账号在本企业的归属关系。
 * 企业成员页「删除成员」只调用本函数：该账号在其他企业的归属与登录能力不受影响；
 * 若移除后已无任何归属，则该账号登录时进入「无可用企业」异常态。
 */
export function removeMembership(account: PrototypeAccount, orgId: string) {
  const index = account.memberships.findIndex((item) => item.orgId === orgId)
  if (index < 0) return
  account.memberships.splice(index, 1)
  persistAccounts()
}

/** 设置账号在某企业下的可用状态（企业成员页启停用，仅作用于该企业） */
export function setMembershipStatus(account: PrototypeAccount, orgId: string, status: MembershipStatus) {
  const membership = account.memberships.find((item) => item.orgId === orgId)
  if (!membership || membership.status === status) return
  membership.status = status
  persistAccounts()
}

/** 变更账号登录标识（企业成员页编辑成员账号时同步更新平台账号） */
export function updateAccountIdentifier(
  account: PrototypeAccount,
  payload: { identifier: string; accountType: 'phone' | 'email'; countryCode: string },
) {
  const identifier = normalizeIdentifier(payload.identifier)
  if (account.identifier === identifier) return
  account.identifier = identifier
  account.accountType = payload.accountType
  account.countryCode = payload.countryCode
  persistAccounts()
}

/** 变更账号的平台级密码（企业成员页重置密码时同步更新，保证新密码可登录） */
export function updateAccountPassword(account: PrototypeAccount, password: string) {
  account.password = password
  persistAccounts()
}
