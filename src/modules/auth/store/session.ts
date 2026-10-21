/**
 * 【原型说明】登录态管理：创建、校验、续期与清除，以及当前进入企业的上下文。
 *
 * 账号与企业为多对多，登录分两步：
 * 1. 凭证校验通过后先建立「待选企业」的登录态（enteringOrgId 为空）；
 * 2. 选定企业进入系统时，把该企业的归属信息写入会话上下文。
 * 单企业账号无需选择，凭证校验后直接进入其唯一企业。
 */

import type { PrototypeAccount } from '@/modules/auth/mock/seed'
import { SESSION_REMEMBER_MS, SESSION_TIMEOUT_MS } from './constants'
import { findAccount, findMembership } from './account'
import {
  persistRecentOrgs,
  persistRememberedOrgs,
  persistSession,
  recentOrgMap,
  rememberedOrgMap,
  session,
} from './storage'
import type { Membership } from './types'

export function isSessionValid(): boolean {
  const current = session.current
  if (!current) return false
  if (Date.now() >= current.expiresAt) {
    clearSession()
    return false
  }
  return true
}

/** 会话是否已进入某企业；未进入时需停留在「选择登录企业」阶段 */
export function hasEnteredOrg(): boolean {
  return Boolean(session.current?.orgId)
}

/** 有操作时刷新有效期，未勾选记住登录状态则维持 2 小时窗口 */
export function refreshSession() {
  if (!session.current) return
  const duration = session.current.remember ? SESSION_REMEMBER_MS : SESSION_TIMEOUT_MS
  session.current.expiresAt = Date.now() + duration
  persistSession()
}

/**
 * 凭证校验通过后建立登录态，此时尚未进入任何企业。
 * remember 控制登录态有效期，与「记住选择」（自动进入企业）相互独立。
 */
export function createSession(account: PrototypeAccount, remember: boolean) {
  const duration = remember ? SESSION_REMEMBER_MS : SESSION_TIMEOUT_MS
  session.current = {
    identifier: account.identifier,
    accountType: account.accountType,
    countryCode: account.countryCode,
    orgId: '',
    role: '',
    roleCode: '',
    orgName: '',
    industry: '',
    region: '',
    contactName: '',
    contactTitle: '',
    contactPhone: '',
    remember,
    expiresAt: Date.now() + duration,
  }
  persistSession()
}

/**
 * 进入指定企业：把该企业的归属信息写入会话，并记录「最近登录企业」。
 *
 * 「最近登录」与「记住选择」是两份记录：
 * - 最近登录：每次成功进入都会更新，用于选择页打标签与默认选中；
 * - 记住选择：仅在选择页明确勾选时写入（传 true），取消勾选时清除（传 false），
 *   是下次登录自动进入的唯一依据。不传时（顶栏切换企业、单企业直接进入）保持原样。
 */
export function enterOrg(orgId: string, rememberChoice?: boolean): Membership | null {
  const current = session.current
  if (!current) return null
  const membership = findMembership(findAccount(current.identifier), orgId)
  // 被本企业停用的归属不可进入（仅作用于该企业，不影响账号的其他企业）
  if (!membership || membership.status === 'disabled') return null

  current.orgId = membership.orgId
  current.role = membership.role
  current.roleCode = membership.roleCode
  current.orgName = membership.orgName
  current.industry = membership.industry
  current.region = membership.region
  current.contactName = membership.contactName
  current.contactTitle = membership.contactTitle
  current.contactPhone = membership.contactPhone
  persistSession()

  recentOrgMap[current.identifier] = { orgId: membership.orgId, at: Date.now() }
  persistRecentOrgs()

  if (rememberChoice === true) {
    rememberedOrgMap[current.identifier] = membership.orgId
    persistRememberedOrgs()
  } else if (rememberChoice === false) {
    delete rememberedOrgMap[current.identifier]
    persistRememberedOrgs()
  }
  return membership
}

/** 取账号的最近登录企业记录；无记录时返回 null */
export function getRecentOrg(identifier: string) {
  return recentOrgMap[identifier] ?? null
}

/** 取账号「记住选择」的企业标识；未勾选过时返回 null */
export function getRememberedOrg(identifier: string): string | null {
  return rememberedOrgMap[identifier] ?? null
}

/** 清除账号「记住选择」的企业（下次登录不再自动进入） */
export function clearRememberedOrg(identifier: string) {
  delete rememberedOrgMap[identifier]
  persistRememberedOrgs()
}

/** 凭证校验通过后的进入决策结果 */
export type EntryDecision =
  | { type: 'entered'; orgName: string }
  | { type: 'select-org' }
  | { type: 'no-org' }
  | { type: 'org-disabled' }

/**
 * 凭证校验通过后决定去向，规则：
 * - 账号无企业归属：异常路径，提示后停留登录页；
 * - 仅归属 1 家企业且该归属可用：直接进入，不展示选择页；
 * - 归属多家企业且「记住选择」指向的企业仍可用：自动进入该企业；
 * - 归属多家企业且无有效记住选择记录：进入「选择登录企业」；
 * - 全部归属均被所属企业停用：异常路径，提示后停留登录页。
 */
export function resolveEntry(account: PrototypeAccount): EntryDecision {
  const memberships = account.memberships.filter((item) => item.status !== 'disabled')
  if (!account.memberships.length) return { type: 'no-org' }
  if (!memberships.length) return { type: 'org-disabled' }
  if (memberships.length === 1) {
    const entered = enterOrg(memberships[0].orgId)
    return entered ? { type: 'entered', orgName: entered.orgName } : { type: 'no-org' }
  }
  const remembered = getRememberedOrg(account.identifier)
  if (remembered && memberships.some((item) => item.orgId === remembered)) {
    const entered = enterOrg(remembered)
    if (entered) return { type: 'entered', orgName: entered.orgName }
  }
  return { type: 'select-org' }
}

export function clearSession() {
  session.current = null
  persistSession()
}

/* ---------- 平台管理端会话 ---------- */

/**
 * 【原型说明】平台成员登录分流（F-PA-01）：
 * 凭证校验通过后，若该账号为平台成员，则建立**平台端会话**（不属任何企业），
 * 直接进入平台管理端，不出现「选择登录企业」页。
 * - 内置平台超级管理员：platformSuper = true，权限全量；
 * - 普通平台成员：按其平台角色计算权限。
 */
export function createPlatformSession(payload: {
  memberId: string
  name: string
  identifier: string
  accountType: 'phone' | 'email'
  countryCode: string
  super: boolean
  roleIds: string[]
  roleNames: string[]
  remember: boolean
}) {
  const duration = payload.remember ? SESSION_REMEMBER_MS : SESSION_TIMEOUT_MS
  session.current = {
    identifier: payload.identifier,
    accountType: payload.accountType,
    countryCode: payload.countryCode,
    orgId: '',
    role: payload.roleNames[0] ?? '',
    roleCode: '',
    orgName: '',
    industry: '',
    region: '',
    contactName: payload.name,
    contactTitle: '',
    contactPhone: '',
    remember: payload.remember,
    expiresAt: Date.now() + duration,
    scope: 'platform',
    platformMemberId: payload.memberId,
    platformName: payload.name,
    platformRoleIds: [...payload.roleIds],
    platformRoles: [...payload.roleNames],
    platformSuper: payload.super,
  }
  persistSession()
}

/** 当前会话是否为平台管理端会话 */
export function isPlatformSession(): boolean {
  return session.current?.scope === 'platform'
}
