/**
 * 【原型说明】平台管理端的业务逻辑，仅用于原型交互验证，非生产代码。
 * 业务规则对齐平台管理端各 PRD v1.0：
 * - 平台成员**不属任何企业**：新增时校验账号是否已归属企业，已归属则拦截；
 * - 内置平台超级管理员不可删除、不可修改、默认全量权限；
 * - 平台角色分预置（平台超级管理员，全量只读）与自定义；平台侧**不设数据范围**；
 * - 平台权限点使用独立的平台权限字典（标识前缀 `platform`）。
 */

import { findAccount, session } from '@/modules/auth/store'
import { detectAccountType, normalizeIdentifier } from '@/modules/auth/store/identifier'
import { checkPassword } from '@/modules/auth/utils/password'
import {
  ALL_PLATFORM_CAPABILITY_KEYS,
  ALL_PLATFORM_PERMISSION_KEYS,
  PLATFORM_PERMISSION_TREE,
  expandPlatformGrantKey,
  getPlatformAncestorKeys,
  getPlatformPermissionNode,
  isPlatformCollapsible,
  isPlatformSelfCapability,
  platformSubtreeKeysOf,
  platformPermissionPathText,
} from '../mock/permissions'
import {
  PLATFORM_NAME_MAX,
  PLATFORM_NAME_MIN,
  PLATFORM_PASSWORD_MAX,
  PLATFORM_PASSWORD_MIN,
  PLATFORM_ROLE_DESC_MAX,
  PLATFORM_ROLE_NAME_MAX,
  PLATFORM_ROLE_NAME_MIN,
} from './constants'
import { platformMembers, platformRoles, persistPlatformMembers, persistPlatformRoles } from './storage'
import type { PlatformMember, PlatformMemberInput, PlatformRole, PlatformRoleInput } from './types'

/* ---------- 通用 ---------- */

/** 【原型说明】模拟异步保存耗时，无真实接口调用 */
function delay(ms = 320) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms)
  })
}

export function platformNormalizeText(value: string) {
  return (value ?? '').replace(/\s+/g, ' ').trim()
}

/* ---------- 平台成员查询 ---------- */

export function getPlatformMember(id: string): PlatformMember | null {
  return platformMembers.find((member) => member.id === id) ?? null
}

export function findPlatformMember(identifier: string): PlatformMember | null {
  const value = (identifier ?? '').trim().toLowerCase()
  return platformMembers.find((member) => member.identifier.toLowerCase() === value) ?? null
}

/** 列表顺序：内置超管置顶 → 其余按创建时间倒序 */
export function sortedPlatformMembers(): PlatformMember[] {
  return [...platformMembers].sort((a, b) => {
    if (a.super !== b.super) return a.super ? -1 : 1
    return b.createdAt - a.createdAt
  })
}

export function searchPlatformMembers(keyword: string): PlatformMember[] {
  const value = keyword.trim().toLowerCase()
  return sortedPlatformMembers().filter((member) => {
    if (!value) return true
    return (
      member.name.toLowerCase().includes(value) ||
      member.identifier.toLowerCase().includes(value)
    )
  })
}

/* ---------- 平台成员校验 ---------- */

/** 账号标识格式校验：平台成员支持手机号与邮箱（由输入内容自动识别） */
export function validatePlatformIdentifierFormat(identifier: string): string | null {
  const value = platformNormalizeText(identifier)
  if (!value) return '请输入账号标识'
  if (!detectAccountType(value)) return '请输入正确的手机号或邮箱'
  return null
}

/**
 * 账号归属校验（Q-PA-02）：
 * - 账号已归属任何企业 → 拦截，提示更换账号或先使其脱离原企业；
 * - 账号已是平台成员 → 拦截。
 */
export function validatePlatformIdentifier(
  identifier: string,
  excludeId?: string,
): string | null {
  const formatError = validatePlatformIdentifierFormat(identifier)
  if (formatError) return formatError
  const value = normalizeIdentifier(identifier)
  // 已是平台成员
  const duplicated = platformMembers.some(
    (member) => member.id !== excludeId && normalizeIdentifier(member.identifier) === value,
  )
  if (duplicated) return '该账号已是平台成员'
  // 已归属企业
  const account = findAccount(value)
  if (account && account.memberships.length > 0) {
    return '该账号已归属企业，请更换账号或先使其脱离原企业'
  }
  return null
}

export function validatePlatformPassword(
  password: string,
  emptyMessage = '请设置初始密码',
): string | null {
  if (!password) return emptyMessage
  if (password.length < PLATFORM_PASSWORD_MIN || password.length > PLATFORM_PASSWORD_MAX) {
    return `密码长度需 ${PLATFORM_PASSWORD_MIN}-${PLATFORM_PASSWORD_MAX} 位`
  }
  const result = checkPassword(password)
  return result.valid ? null : (result.reason ?? '密码强度不足，请按提示增强')
}

/* ---------- 平台成员维护 ---------- */

export async function createPlatformMember(input: PlatformMemberInput): Promise<PlatformMember> {
  await delay()
  const name = platformNormalizeText(input.name)
  if (name.length < PLATFORM_NAME_MIN || name.length > PLATFORM_NAME_MAX) {
    throw new Error(`姓名需 ${PLATFORM_NAME_MIN}-${PLATFORM_NAME_MAX} 个字符`)
  }
  // 账号统一规范化：手机号去分隔符、邮箱转小写，保证与平台账号池一致
  const identifier = normalizeIdentifier(input.identifier)
  const identifierError = validatePlatformIdentifier(identifier)
  if (identifierError) throw new Error(identifierError)
  if (!input.roleIds.length) throw new Error('请至少选择一个平台角色')
  // 账号在平台不存在时需设置初始密码；已存在且未归属企业时免密沿用
  const existing = findAccount(identifier)
  if (!existing) {
    const pwdError = validatePlatformPassword(input.password ?? '')
    if (pwdError) throw new Error(pwdError)
  }
  const member: PlatformMember = {
    id: `PAL-MEM-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name,
    identifier,
    password: existing ? existing.password : (input.password ?? ''),
    super: false,
    status: 'normal',
    roleIds: [...input.roleIds],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    mustChangePassword: !existing,
  }
  platformMembers.push(member)
  persistPlatformMembers()
  return member
}

export async function updatePlatformMember(id: string, input: PlatformMemberInput): Promise<void> {
  await delay()
  const member = getPlatformMember(id)
  if (!member) throw new Error('平台成员不存在')
  if (member.super) throw new Error('系统内置平台超级管理员不可修改')
  const name = platformNormalizeText(input.name)
  if (name.length < PLATFORM_NAME_MIN || name.length > PLATFORM_NAME_MAX) {
    throw new Error(`姓名需 ${PLATFORM_NAME_MIN}-${PLATFORM_NAME_MAX} 个字符`)
  }
  if (!input.roleIds.length) throw new Error('请至少选择一个平台角色')
  member.name = name
  member.roleIds = [...input.roleIds]
  member.updatedAt = Date.now()
  persistPlatformMembers()
}

export async function togglePlatformMember(id: string, status: PlatformMember['status']): Promise<void> {
  await delay(200)
  const member = getPlatformMember(id)
  if (!member) throw new Error('平台成员不存在')
  if (member.super) throw new Error('系统内置平台超级管理员不可停用')
  member.status = status
  member.updatedAt = Date.now()
  persistPlatformMembers()
}

export async function deletePlatformMember(id: string): Promise<void> {
  await delay()
  const member = getPlatformMember(id)
  if (!member) throw new Error('平台成员不存在')
  if (member.super) throw new Error('系统内置平台超级管理员不可删除')
  const index = platformMembers.findIndex((item) => item.id === id)
  platformMembers.splice(index, 1)
  persistPlatformMembers()
}

export async function resetPlatformMemberPassword(id: string, password: string): Promise<void> {
  await delay()
  const member = getPlatformMember(id)
  if (!member) throw new Error('平台成员不存在')
  const pwdError = validatePlatformPassword(password)
  if (pwdError) throw new Error(pwdError)
  member.password = password
  member.mustChangePassword = true
  member.updatedAt = Date.now()
  persistPlatformMembers()
}

/* ---------- 平台角色查询 ---------- */

export const isPresetPlatformRole = (role: Pick<PlatformRole, 'source'>) => role.source === 'preset'

export function getPlatformRole(id: string): PlatformRole | null {
  return platformRoles.find((role) => role.id === id) ?? null
}

export function sortedPlatformRoles(): PlatformRole[] {
  return [...platformRoles].sort((a, b) => {
    if (isPresetPlatformRole(a) !== isPresetPlatformRole(b)) return isPresetPlatformRole(a) ? -1 : 1
    return b.createdAt - a.createdAt
  })
}

export function searchPlatformRoles(keyword: string): PlatformRole[] {
  const value = keyword.trim().toLowerCase()
  return sortedPlatformRoles().filter((role) => {
    if (!value) return true
    return role.name.toLowerCase().includes(value)
  })
}

/** 角色下的平台成员清单 */
export function platformRoleMembers(roleId: string): PlatformMember[] {
  return platformMembers.filter((member) => member.roleIds.includes(roleId))
}

export function platformRoleMemberCount(roleId: string): number {
  return platformMembers.filter((member) => member.roleIds.includes(roleId)).length
}

/* ---------- 平台权限授权计算 ---------- */

export function expandPlatformGrant(keys: string[]): string[] {
  const granted = new Set<string>()
  keys.forEach((key) => expandPlatformGrantKey(key).forEach((item) => granted.add(item)))
  return [...granted]
}

function platformAncestorEntryKeys(key: string): string[] {
  return getPlatformAncestorKeys(key).filter((item) => {
    const node = getPlatformPermissionNode(item)
    return node ? isPlatformSelfCapability(node) : false
  })
}

export function collapsePlatformPermissionKeys(keys: string[]): string[] {
  const granted = new Set(
    expandPlatformGrant(keys.filter((key) => ALL_PLATFORM_PERMISSION_KEYS.includes(key))),
  )
  const normalized = [...granted]
  normalized.forEach((key) => platformAncestorEntryKeys(key).forEach((item) => granted.add(item)))

  const emitted: string[] = []
  const walk = (node: typeof PLATFORM_PERMISSION_TREE[number]) => {
    const caps = platformSubtreeKeysOf(node)
    if (!caps.length) return
    if (isPlatformCollapsible(node) && caps.every((key) => granted.has(key))) {
      emitted.push(node.key)
      return
    }
    if (isPlatformSelfCapability(node) && granted.has(node.key)) emitted.push(node.key)
    node.children.forEach(walk)
  }
  PLATFORM_PERMISSION_TREE.forEach(walk)
  return ALL_PLATFORM_PERMISSION_KEYS.filter((key) => emitted.includes(key))
}

export function platformRoleGrantKeys(role: PlatformRole | null): string[] {
  if (!role) return []
  if (isPresetPlatformRole(role)) return allPlatformPermissions()
  return collapsePlatformPermissionKeys(role.permissions)
}

export const allPlatformPermissions = () => collapsePlatformPermissionKeys(ALL_PLATFORM_CAPABILITY_KEYS)

export function togglePlatformGrant(grantKeys: string[], key: string, checked: boolean): string[] {
  const node = getPlatformPermissionNode(key)
  if (!node) return grantKeys
  const caps = new Set(expandPlatformGrant(grantKeys))
  const target = platformSubtreeKeysOf(node)
  if (checked) {
    target.forEach((item) => caps.add(item))
    platformAncestorEntryKeys(key).forEach((item) => caps.add(item))
  } else {
    target.forEach((item) => caps.delete(item))
  }
  return collapsePlatformPermissionKeys([...caps])
}

/** 角色的生效能力集合（展开态），用于 RBAC 判定与数量统计 */
export function platformRolePermissions(role: PlatformRole | null): string[] {
  if (!role) return []
  return expandPlatformGrant(platformRoleGrantKeys(role))
}

/** 当前平台会话的权限集合：内置超管全量；其余为所拥有平台角色权限并集 */
export function currentPlatformPermissions(): string[] {
  const current = session.current
  if (!current || current.scope !== 'platform') return []
  if (current.platformSuper) return expandPlatformGrant(allPlatformPermissions())
  const set = new Set<string>()
  ;(current.platformRoleIds ?? []).forEach((roleId) => {
    platformRolePermissions(getPlatformRole(roleId)).forEach((key) => set.add(key))
  })
  return [...set]
}

export function platformHasPermission(permission: string): boolean {
  return currentPlatformPermissions().includes(permission)
}

/* ---------- 平台角色校验与维护 ---------- */

export function validatePlatformRoleName(name: string, excludeId?: string): string | null {
  const value = platformNormalizeText(name)
  if (!value) return '请输入角色名称'
  if (value.length < PLATFORM_ROLE_NAME_MIN || value.length > PLATFORM_ROLE_NAME_MAX) {
    return `角色名称需 ${PLATFORM_ROLE_NAME_MIN}-${PLATFORM_ROLE_NAME_MAX} 个字符`
  }
  const duplicated = platformRoles.some(
    (role) => role.id !== excludeId && role.name.toLowerCase() === value.toLowerCase(),
  )
  if (duplicated) return '角色名称已存在'
  return null
}

export function validatePlatformRoleDesc(desc: string): string | null {
  return platformNormalizeText(desc).length > PLATFORM_ROLE_DESC_MAX
    ? `最多输入 ${PLATFORM_ROLE_DESC_MAX} 个字符`
    : null
}

export async function createPlatformRole(input: PlatformRoleInput): Promise<PlatformRole> {
  await delay()
  const name = platformNormalizeText(input.name)
  const nameError = validatePlatformRoleName(name)
  if (nameError) throw new Error(nameError)
  const role: PlatformRole = {
    id: `PAL-ROLE-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name,
    desc: platformNormalizeText(input.desc),
    source: 'custom',
    permissions: [],
    createdAt: Date.now(),
  }
  platformRoles.push(role)
  persistPlatformRoles()
  return role
}

export async function updatePlatformRole(id: string, input: PlatformRoleInput): Promise<void> {
  await delay()
  const role = getPlatformRole(id)
  if (!role) throw new Error('平台角色不存在')
  if (isPresetPlatformRole(role)) throw new Error('预置平台角色不可修改')
  const name = platformNormalizeText(input.name)
  const nameError = validatePlatformRoleName(name, id)
  if (nameError) throw new Error(nameError)
  role.name = name
  role.desc = platformNormalizeText(input.desc)
  persistPlatformRoles()
}

export async function removePlatformRole(id: string): Promise<void> {
  await delay()
  const role = getPlatformRole(id)
  if (!role) throw new Error('平台角色不存在')
  if (isPresetPlatformRole(role)) throw new Error('预置平台角色不可删除')
  const memberCount = platformRoleMemberCount(id)
  if (memberCount > 0) throw new Error(`该角色下仍有 ${memberCount} 名成员，请先解除绑定后再删除`)
  const index = platformRoles.findIndex((item) => item.id === id)
  platformRoles.splice(index, 1)
  persistPlatformRoles()
}

export async function savePlatformRolePermissions(id: string, grantKeys: string[]): Promise<void> {
  await delay()
  const role = getPlatformRole(id)
  if (!role) throw new Error('平台角色不存在')
  if (isPresetPlatformRole(role)) throw new Error('预置平台角色权限不可修改')
  role.permissions = collapsePlatformPermissionKeys(grantKeys)
  persistPlatformRoles()
}

export { platformPermissionPathText }
