/**
 * 【原型说明】企业成员的账号与权限归属维护逻辑，仅用于原型交互验证。
 * 业务规则对齐《产品需求文档-企业成员》v1.0：
 * - 账号标识（手机号 / 邮箱）全平台唯一；手机号需含国际区号
 * - 成员可多角色（权限取并集）、可绑定多个组织节点（范围为所选节点及其全部下级）
 * - 成员业务状态（正常 / 已停用）与账号安全状态（锁定）正交，锁定不由本页控制
 * - 最后一名超级管理员不可移除角色、不可停用、不可删除
 * - 删除不可恢复，需清空组织架构中的节点负责人引用
 * - 所有变更写入变更记录（对应 F-MEM-09）
 */

import {
  session,
  ensureAccountForMember,
  addMembership,
  findAccount,
  removeMembership,
  setMembershipStatus,
  updateAccountIdentifier,
  updateAccountPassword,
} from '@/modules/auth/store'
import { clearLock, isLocked, remainLockMinutes } from '@/modules/auth/store/lock'
import { checkPassword } from '@/modules/auth/utils/password'
import { isEmail } from '@/shared/utils/validate'
import { detectAccountType, normalizeIdentifier } from '@/modules/auth/store/identifier'
import { getNode, getPathText, getRoot, getSubtreeIds, nodes as orgNodes, persistNodes } from '@/modules/org/store'
import { roleList } from '@/modules/role/store/storage'
import { maskIdentifier } from '@/shared/utils/mask'
import {
  NAME_MAX,
  NAME_MIN,
  PASSWORD_MAX,
  PASSWORD_MIN,
  SUPER_ADMIN_ROLE_ID,
} from './constants'
import { memberList, memberLogs, persistMemberLogs, persistMembers } from './storage'
import type {
  Member,
  MemberChangeType,
  MemberCreateInput,
  MemberUpdateInput,
} from './types'
import type { Role } from '@/modules/role/store/types'
import type { PrototypeAccount } from '@/modules/auth/mock/seed'

/** 角色清单（只读引用）：成员的角色选择与角色名称展示均以此为准 */
export { roleList } from '@/modules/role/store/storage'
export type { Role }

/* ---------- 通用 ---------- */

/** 【原型说明】模拟异步保存耗时，无真实接口调用 */
function delay(ms = 320) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms)
  })
}

/** 当前操作账号展示名，用于变更记录 */
function currentOperator() {
  const current = session.current
  if (!current) return '未知账号'
  return current.contactName || maskIdentifier(current.identifier)
}

/** 输入内容按纯文本处理：去除首尾空格，仅空格视为未填写 */
export function normalizeText(value: string) {
  return (value ?? '').replace(/\s+/g, ' ').trim()
}

/* ---------- 查询 ---------- */

export const getMember = (id: string) => memberList.find((member) => member.id === id) ?? null

/** 列表默认顺序：超级管理员优先，其余按加入时间倒序（PRD F-MEM-01） */
export function sortedMembers(): Member[] {
  return [...memberList].sort((a, b) => {
    const aAdmin = isSuperAdmin(a)
    const bAdmin = isSuperAdmin(b)
    if (aAdmin !== bAdmin) return aAdmin ? -1 : 1
    return b.createdAt - a.createdAt
  })
}

export const isSuperAdmin = (member: Member) => member.roleIds.includes(SUPER_ADMIN_ROLE_ID)

/** 企业内超级管理员数量，用于「最后一名超级管理员保护」（PRD Q-MEM-05） */
export const superAdminCount = () => memberList.filter(isSuperAdmin).length

/** 是否为「最后一名超级管理员」：三种拦截动作（移除角色 / 停用 / 删除）共用同一判定 */
export const isLastSuperAdmin = (member: Member) => isSuperAdmin(member) && superAdminCount() <= 1

/* ---------- 角色与数据范围展示 ---------- */

/** 成员的角色名称列表；角色被删除后其绑定同步失效（PRD F-MEM-04） */
export function memberRoleNames(member: Member): string[] {
  return member.roleIds
    .map((id) => roleList.find((role: Role) => role.id === id)?.name)
    .filter((name): name is string => !!name)
}

/** 成员的有效角色 ID（剔除已被删除的角色） */
export function memberRoleIds(member: Member): string[] {
  return member.roleIds.filter((id) => roleList.some((role: Role) => role.id === id))
}

/** 无角色状态：角色被删除等原因导致成员失去全部角色（PRD 6.3） */
export const isNoRoleMember = (member: Member) => memberRoleIds(member).length === 0

/** 某角色下的成员数：由成员的 roleIds 反向统计 */
export function roleMemberCount(roleId: string) {
  return memberList.filter((member) => member.roleIds.includes(roleId)).length
}

/** 全部可选角色（含预置角色） */
export const roleOptions = () =>
  roleList.map((role: Role) => ({
    value: role.id,
    label: role.name,
    desc: role.desc,
    source: role.source,
  }))

/* ---------- 其他模块的成员选择器数据源 ---------- */

/**
 * 可选成员选项，供其他模块（组织架构节点负责人、告警接收人等）作为选择器数据源。
 * 已停用成员不出现在选项中，避免把任务派给无法登录的账号。
 */
export function memberOptions(): Array<{ value: string; label: string }> {
  return memberList
    .filter((member) => member.status === 'normal')
    .map((member) => ({ value: member.id, label: member.name }))
}

/** 按成员 ID 取姓名，供其他模块做展示回填 */
export function memberName(id: string | null): string {
  if (!id) return ''
  return memberList.find((member) => member.id === id)?.name ?? ''
}

/* ---------- 数据范围 ---------- */

/**
 * 数据范围的可选组织节点：企业根节点与全部组织节点。
 * 用能单元不作为数据范围选项（PRD F-MEM-05 业务规则：最小计量落位，选父级即可覆盖）。
 */
export interface ScopeNodeOption {
  id: string
  name: string
  parentId: string | null
  order: number
}

export function scopeNodeOptions(): ScopeNodeOption[] {
  return orgNodes
    .filter((node) => node.kind !== 'unit')
    .map((node) => ({ id: node.id, name: node.name, parentId: node.parentId, order: node.order }))
}

/** 数据范围是否等于「全部数据」（仅绑定了企业根节点，且未绑定其他节点） */
export function isFullScope(member: Member): boolean {
  const root = getRoot()
  if (!root) return false
  const valid = member.scopeIds.filter((id) => !!getNode(id))
  return valid.length === 1 && valid[0] === root.id
}

/**
 * 数据范围去重：父子节点同时被选中时按父节点覆盖，仅保留父节点（PRD F-MEM-05 业务规则）。
 * 返回按组织架构同级顺序排列的节点 ID 集合。
 */
export function dedupeScopeIds(ids: string[]): string[] {
  const valid = ids.filter((id) => !!getNode(id))
  const covered = new Set<string>()
  valid.forEach((id) => {
    if (covered.has(id)) return
    getSubtreeIds(id)
      .filter((subId) => subId !== id)
      .forEach((subId) => covered.add(subId))
  })
  return valid.filter((id) => !covered.has(id))
}

/** 数据范围展示文本 */
export function scopeText(member: Member): { text: string; type: 'full' | 'partial' | 'none' } {
  // 企业超级管理员的数据范围锁定为「全部数据」（PRD Q-MEM-08）
  if (isSuperAdmin(member)) return { text: '全部数据', type: 'full' }
  const valid = dedupeScopeIds(member.scopeIds)
  if (!valid.length) return { text: '未设置', type: 'none' }
  if (isFullScope(member)) return { text: '全部数据', type: 'full' }
  return { text: `${valid.length} 个组织节点`, type: 'partial' }
}

/** 数据范围对应的节点名称列表，用于悬停展示 */
export function scopeNames(member: Member): string[] {
  return dedupeScopeIds(member.scopeIds)
    .map((id) => getNode(id)?.name ?? '')
    .filter(Boolean)
}

/** 数据范围中的失效节点（组织架构中被删除的节点） */
export function scopeInvalidIds(member: Member): string[] {
  return member.scopeIds.filter((id) => !getNode(id))
}

/* ---------- 成员状态与附注 ---------- */

/** 账号处于登录失败锁定中（账号安全状态，本页只读展示；已停用成员不展示锁定附注） */
export function lockInfo(member: Member): { locked: boolean; minutes: number } {
  if (member.status !== 'normal') return { locked: false, minutes: 0 }
  const locked = isLocked(member.identifier)
  return { locked, minutes: locked ? remainLockMinutes(member.identifier) : 0 }
}

/* ---------- 校验 ---------- */

export function validateName(name: string): string | null {
  const value = normalizeText(name)
  if (!value) return '请输入成员姓名'
  if (value.length < NAME_MIN || value.length > NAME_MAX) {
    return `成员姓名需 ${NAME_MIN}-${NAME_MAX} 个字符`
  }
  return null
}

/**
 * 判断账号标识是否已是本企业成员。
 * 用于区分「本企业已有该成员」（拦截）与「账号在平台存在但本企业没有」（加入企业，免密）两种状态。
 */
export function identifierInOrg(identifier: string, excludeId?: string): boolean {
  const value = normalizeIdentifier(identifier)
  if (!value) return false
  return memberList.some(
    (member) => member.id !== excludeId && normalizeIdentifier(member.identifier) === value,
  )
}

/**
 * 账号标识校验：格式合法 + 不与本企业已有成员重复。
 * 账号与企业为多对多，平台已注册的账号允许加入本企业，
 * 因此仅当该标识已是本企业成员时才拦截。
 */
export function validateIdentifier(identifier: string, excludeId?: string): string | null {
  const value = normalizeIdentifier(identifier)
  if (!value) return '请输入账号标识'
  const type = detectAccountType(value)
  if (!type) {
    return isEmail(value) ? '请输入正确的邮箱地址' : '请输入正确的手机号'
  }
  if (identifierInOrg(value, excludeId)) return '该成员已存在，请勿重复添加'
  return null
}

/** 初始密码校验：8-20 位且强度达「中」及以上（复用认证模块规则） */
export function validatePassword(password: string, identifier = ''): string | null {
  const value = password ?? ''
  if (!value) return '请输入初始密码'
  if (value.length < PASSWORD_MIN || value.length > PASSWORD_MAX) {
    return `密码强度不足，请使用 ${PASSWORD_MIN}-${PASSWORD_MAX} 位且包含字母与数字的组合`
  }
  const result = checkPassword(value, normalizeIdentifier(identifier))
  if (!result.valid) {
    return `密码强度不足，请使用 ${PASSWORD_MIN}-${PASSWORD_MAX} 位且包含字母与数字的组合`
  }
  return null
}

export function validateConfirmPassword(password: string, confirm: string): string | null {
  if (!confirm) return '请再次输入密码'
  if (password !== confirm) return '两次输入的密码不一致'
  return null
}

/* ---------- 变更记录（F-MEM-09） ---------- */

/**
 * 【原型说明】记录成员与权限变更，对应 PRD F-MEM-09。
 * 正式实现中该记录写入「系统管理 › 系统日志」，本页不展示独立界面；
 * 日志中不记录任何密码内容。
 */
function writeMemberLog(type: MemberChangeType, member: Member, detail: string) {
  memberLogs.unshift({
    id: `MLOG-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    at: Date.now(),
    account: currentOperator(),
    type,
    target: `${member.name}（${maskIdentifier(member.identifier)}）`,
    detail,
  })
  if (memberLogs.length > 200) memberLogs.splice(200)
  persistMemberLogs()
}

/* ---------- 成员维护 ---------- */

/** 【原型说明】重置密码时随机生成满足强度要求的密码，仅用于演示一次性凭据交付 */
function generatePassword() {
  const chars = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ'
  const digits = '23456789'
  const pick = (source: string, count: number) =>
    Array.from({ length: count }, () => source[Math.floor(Math.random() * source.length)]).join('')
  return `${pick(chars, 5)}${pick(digits, 3)}`
}

/**
 * 判断账号标识在平台内是否已存在（已归属于其他企业或已被平台注册）。
 * 已存在的账号在新增成员时无需设置密码：沿用其平台级唯一密码。
 */
export function accountExistsInPlatform(identifier: string): boolean {
  return !!findAccount(identifier)
}

/**
 * 为新成员追加本企业归属关系（已归属本企业时不重复追加）。
 * 【原型说明】企业名称与当前会话一致；角色取成员首个角色的名称，用于「选择登录企业」展示。
 */
function appendMembershipIfAbsent(account: PrototypeAccount, input: MemberCreateInput) {
  const current = session.current
  const orgId = current?.orgId || 'ORG-1001'
  const orgName = current?.orgName || '示例科技有限公司'
  if (account.memberships.some((item) => item.orgId === orgId)) return
  const roleName = roleList.find((role: Role) => role.id === input.roleIds[0])?.name ?? '成员'
  addMembership(account, {
    orgId,
    orgName,
    industry: current?.industry ?? '',
    region: current?.region ?? '',
    role: roleName,
    roleCode: input.roleIds[0] ?? '',
    contactName: normalizeText(input.name),
    contactTitle: '',
    contactPhone: input.accountType === 'phone' ? normalizeIdentifier(input.identifier) : '',
  })
}

/**
 * 同步平台账号的登录凭据：编辑成员改了账号标识时，让新标识可登录、旧标识失效。
 * 【原型说明】账号标识是平台级登录凭据，跨企业共用一个账号，因此在任一企业内改标识都会全局生效。
 */
function syncAccountForMember(beforeIdentifier: string, member: Member) {
  const account = findAccount(beforeIdentifier)
  if (!account) return
  updateAccountIdentifier(account, {
    identifier: member.identifier,
    accountType: member.accountType,
    countryCode: member.countryCode,
  })
}

/**
 * 新增成员：一次配好账号、初始密码、角色与数据范围（PRD F-MEM-02）。
 *
 * 账号已存在时进入「加入企业」语义：**不要求设置密码**，只追加一条企业归属关系，
 * 沿用该账号既有的平台级密码，因此不会覆盖其在其他企业下使用的密码。
 * 【原型说明】`input.password` 在账号已存在时为空，且不会被写入账号池。
 */
export async function createMember(input: MemberCreateInput): Promise<Member> {
  await delay()
  if (!input.roleIds.length) throw new Error('请至少为一个成员选择一个角色')

  const identifier = normalizeIdentifier(input.identifier)
  // 打通平台账号池：不存在则按来源 member 建档；已存在则沿用，不改密码
  const { account, created } = ensureAccountForMember({
    accountType: input.accountType,
    identifier,
    countryCode: input.countryCode,
    password: input.password,
  })

  // 为该账号追加本企业归属，使其登录后可在「选择登录企业」看到本企业
  appendMembershipIfAbsent(account, input)

  const member: Member = {
    id: `MEM-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name: normalizeText(input.name),
    accountType: input.accountType,
    identifier,
    countryCode: input.countryCode,
    roleIds: [...input.roleIds],
    scopeIds: dedupeScopeIds(input.scopeIds),
    status: 'normal',
    // 已存在账号沿用既有密码，无需强制改密；新建账号首次登录需修改初始密码
    mustChangePassword: created,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
  memberList.push(member)
  persistMembers()
  writeMemberLog(
    '新增成员',
    member,
    `创建成员并分配 ${member.roleIds.length} 个角色、${member.scopeIds.length} 个数据范围节点；` +
      (created ? '初始密码一次性交付' : '账号已存在，沿用其现有密码、未设置新密码'),
  )
  return member
}

/** 编辑成员信息：姓名、账号标识、角色、数据范围（PRD F-MEM-03） */
export async function updateMember(id: string, input: MemberUpdateInput): Promise<void> {
  await delay()
  const member = getMember(id)
  if (!member) throw new Error('成员不存在')
  if (!input.roleIds.length) throw new Error('请至少为一个成员选择一个角色')

  const beforeRoles = memberRoleNames(member)
  const beforeScope = member.scopeIds.length
  const beforeIdentifier = member.identifier
  const beforeName = member.name

  // 账号标识是平台级登录凭据：改成本企业其他成员的标识会撞号，改成平台其他账号的标识会造成一号两账号
  const nextIdentifier = normalizeIdentifier(input.identifier)
  const owner = findAccount(beforeIdentifier)
  const target = findAccount(nextIdentifier)
  if (target && target !== owner) {
    throw new Error('该账号已存在于平台，请更换账号标识')
  }

  member.name = normalizeText(input.name)
  member.accountType = input.accountType
  member.identifier = normalizeIdentifier(input.identifier)
  member.countryCode = input.countryCode
  member.roleIds = [...input.roleIds]
  member.scopeIds = dedupeScopeIds(input.scopeIds)
  member.updatedAt = Date.now()
  persistMembers()

  // 同步平台账号：账号标识是登录凭据，改了标识后必须让新标识可登录、旧标识失效
  syncAccountForMember(beforeIdentifier, member)

  const changes: string[] = []
  if (beforeName !== member.name) changes.push(`姓名由「${beforeName}」改为「${member.name}」`)
  if (normalizeIdentifier(beforeIdentifier) !== member.identifier) {
    changes.push('变更账号标识（日志不记录新账号的完整值）')
    writeMemberLog('账号变更', member, changes.join('；'))
  }
  const afterRoles = memberRoleNames(member)
  if (beforeRoles.join('、') !== afterRoles.join('、')) {
    writeMemberLog(
      '角色变更',
      member,
      `角色由「${beforeRoles.join('、') || '无'}」改为「${afterRoles.join('、') || '无'}」`,
    )
  }
  if (beforeScope !== member.scopeIds.length || changes.length) {
    writeMemberLog(
      '数据范围变更',
      member,
      `数据范围节点数由 ${beforeScope} 个改为 ${member.scopeIds.length} 个`,
    )
  }
  if (normalizeIdentifier(beforeIdentifier) === member.identifier) {
    writeMemberLog('编辑成员', member, changes.join('；') || '更新成员信息')
  }
}

/** 启用 / 停用成员；最后一名超级管理员不可停用（PRD F-MEM-06） */
export async function toggleMember(id: string, enabled: boolean): Promise<void> {
  await delay()
  const member = getMember(id)
  if (!member) throw new Error('成员不存在')
  if (!enabled && isLastSuperAdmin(member)) {
    throw new Error('企业需至少保留 1 名超级管理员')
  }
  member.status = enabled ? 'normal' : 'disabled'
  member.updatedAt = Date.now()
  persistMembers()
  // 同步为账号在本企业下的可用状态（仅作用于本企业，不影响其在其他企业的登录）
  syncMembershipStatus(member)
  writeMemberLog(enabled ? '启用成员' : '停用成员', member, enabled ? '启用该成员账号' : '停用该成员账号')
}

/**
 * 同步账号在本企业下的可用状态。
 * 停用只作用于本企业：该账号在其他企业的归属与登录不受影响（PRD Q-MEM-06）。
 */
function syncMembershipStatus(member: Member) {
  const account = findAccount(member.identifier)
  if (!account) return
  setMembershipStatus(account, currentOrgId(), member.status === 'disabled' ? 'disabled' : 'normal')
}

/** 当前企业标识：企业成员页的所有账号同步动作都发生在当前登录企业内 */
function currentOrgId(): string {
  return session.current?.orgId || 'ORG-1001'
}

/** 重置密码：系统随机生成，一次性展示；重置同时解除登录失败锁定（PRD F-MEM-07） */
export async function resetMemberPassword(id: string): Promise<string> {
  await delay()
  const member = getMember(id)
  if (!member) throw new Error('成员不存在')
  if (member.status === 'disabled') throw new Error('请先启用该成员后再重置密码')
  const password = generatePassword()
  member.mustChangePassword = true
  member.updatedAt = Date.now()
  persistMembers()
  // 新密码必须写入平台账号，否则成员拿到的密码无法登录
  const account = findAccount(member.identifier)
  if (account) updateAccountPassword(account, password)
  // 重置后账号应立即可重新登录，锁定随之解除（账号安全状态由认证侧维护）
  if (isLocked(member.identifier)) clearLock(member.identifier)
  writeMemberLog('重置密码', member, '重置该成员密码（日志不记录密码内容）')
  return password
}

/**
 * 删除成员：不可恢复，需清空组织架构中的节点负责人引用（PRD F-MEM-08）。
 * 最后一名超级管理员与当前登录账号不可删除。
 * 删除只移除该账号在本企业的归属：其在其他企业仍可正常登录；
 * 若已无任何归属，则登录时进入「无可用企业」提示。
 */
export async function removeMember(id: string): Promise<void> {
  await delay()
  const member = getMember(id)
  if (!member) throw new Error('成员不存在')
  if (isLastSuperAdmin(member)) throw new Error('企业需至少保留 1 名超级管理员')
  if (session.current && normalizeIdentifier(session.current.identifier) === member.identifier) {
    throw new Error('不能删除当前登录账号')
  }

  const roleCount = memberRoleIds(member).length
  const scopeCount = member.scopeIds.length
  // 清空组织架构中该成员的节点负责人引用（PRD F-MEM-08 业务结果）
  const affectedNodes = clearNodeOwners(member.id)

  const account = findAccount(member.identifier)
  if (account) removeMembership(account, currentOrgId())

  const index = memberList.findIndex((item) => item.id === id)
  memberList.splice(index, 1)
  persistMembers()
  writeMemberLog(
    '删除成员',
    member,
    `删除成员「${member.name}」；删除前有 ${roleCount} 个角色、${scopeCount} 个数据范围节点` +
      (affectedNodes ? `；清空 ${affectedNodes} 个组织节点的负责人引用` : '') +
      '；该账号在平台与其他企业的归属不受影响',
  )
}

/** 删除成员时清空其在组织架构中的节点负责人引用，返回受影响的节点数量 */
function clearNodeOwners(memberId: string): number {
  const affected = orgNodes.filter((node) => node.ownerId === memberId)
  affected.forEach((node) => {
    node.ownerId = null
  })
  if (affected.length) persistNodes()
  return affected.length
}

/* ---------- 搜索与筛选 ---------- */

export interface MemberFilters {
  keyword: string
  roleIds: string[]
  /** 清空筛选时选择器会回传 undefined，统一按「全部」处理 */
  status: 'all' | 'normal' | 'disabled' | undefined
  scopeId: string | null | undefined
}

/** 检索与筛选（PRD F-MEM-01）：条件之间为「与」，同条件多选为「或」 */
export function filterMembers(filters: MemberFilters): Member[] {
  const keyword = filters.keyword.trim().slice(0, 50).toLowerCase()
  const scopeSubtree = filters.scopeId ? new Set(getSubtreeIds(filters.scopeId)) : null
  const status = filters.status ?? 'all'

  return sortedMembers().filter((member) => {
    if (keyword) {
      const haystack = `${member.name} ${normalizeIdentifier(member.identifier)}`.toLowerCase()
      if (!haystack.includes(keyword)) return false
    }
    if (filters.roleIds.length && !filters.roleIds.some((id) => member.roleIds.includes(id))) return false
    if (status !== 'all' && member.status !== status) return false
    if (scopeSubtree) {
      const inScope = member.scopeIds.some((id) => scopeSubtree.has(id))
      if (!inScope) return false
    }
    return true
  })
}

/* ---------- 组织架构（供数据范围选择与筛选使用） ---------- */

export { getPathText, getRoot, getSubtreeIds }

export type { Member, MemberCreateInput, MemberUpdateInput }
