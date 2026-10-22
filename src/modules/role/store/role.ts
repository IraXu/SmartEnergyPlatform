/**
 * 【原型说明】角色管理与权限配置逻辑，仅用于原型交互验证。
 * 业务规则对齐《产品需求文档-角色管理》v1.0：
 * - 预置角色（企业超级管理员）权限恒等于权限点字典全集，不可改权限、不可重命名、不可删除
 * - 自定义角色可改权限、可重命名、可删除（成员数为 0 时）
 * - 权限树的每一级都可独立授权：勾选上级即授予其下全部功能，可再取消下级做细化
 * - 权限最小颗粒度到按钮级；勾选任一操作类默认联动勾选该页面的查看类（Q-ROL-08）
 * - 角色名称企业内唯一、自定义角色数量上限 50
 * - 所有角色与权限变更写入变更记录（对应 F-ROL-09）
 */

import { session } from '@/modules/auth/store'
import { maskIdentifier } from '@/shared/utils/mask'
// 直接引用成员的演示数据容器，避免「角色 → 成员」与「成员 → 角色」形成循环依赖
import { memberList as members } from '@/modules/member/store/storage'
import { PRESET_ROLE_ID } from '../mock/seed'
import {
  ALL_CAPABILITY_KEYS,
  ALL_PERMISSION_KEYS,
  PERMISSION_TREE,
  expandGrantKey,
  getAncestorKeys,
  getPermissionNode,
  isCollapsible,
  isSelfCapability,
  permissionPathText,
  subtreeCapabilityKeysOf,
} from '../mock/permissions'
import { ROLE_DESC_MAX, ROLE_LIMIT, ROLE_NAME_MAX, ROLE_NAME_MIN } from './constants'
import { persistRoleLogs, persistRoles, roleList, roleLogs } from './storage'
import type { PermissionNode, Role, RoleChangeType, RoleInput } from './types'

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

export const isPresetRole = (role: Pick<Role, 'source'>) => role.source === 'preset'
/** 【原型说明】平台默认角色：由平台「企业角色管理」统一维护，企业侧只读、可分配给成员 */
export const isDefaultRole = (role: Pick<Role, 'source'>) => role.source === 'default'
/** 企业侧不可编辑的角色（预置 / 平台默认） */
export const isReadonlyRole = (role: Pick<Role, 'source'>) =>
  isPresetRole(role) || isDefaultRole(role)

export const getRole = (id: string) => roleList.find((role) => role.id === id) ?? null

/** 列表顺序：预置角色置顶 → 平台默认角色 → 自定义角色按创建时间倒序（PRD F-ROL-01） */
export function sortedRoles(): Role[] {
  const rank = (role: Role) => (isPresetRole(role) ? 0 : isDefaultRole(role) ? 1 : 2)
  return [...roleList].sort((a, b) => {
    if (rank(a) !== rank(b)) return rank(a) - rank(b)
    if (isDefaultRole(a) && isDefaultRole(b)) return b.createdAt - a.createdAt
    return b.createdAt - a.createdAt
  })
}

/** 自定义角色数量：平台默认角色不计入单企业上限 */
export const customRoleCount = () =>
  roleList.filter((role) => !isPresetRole(role) && !isDefaultRole(role)).length

export const isRoleLimitReached = () => customRoleCount() >= ROLE_LIMIT

/** 角色下的成员清单，用于「查看成员」浮层 */
export function roleMembers(roleId: string) {
  return members.filter((member) => member.roleIds.includes(roleId))
}

/** 角色下的成员数：由成员的 roleIds 反向统计（与成员模块共用同一份演示数据） */
export function roleMemberCount(roleId: string) {
  return members.filter((member) => member.roleIds.includes(roleId)).length
}

/** 企业内超级管理员数量，用于「最后一名超级管理员保护」 */
export const superAdminCount = () =>
  members.filter((member) => member.roleIds.includes(PRESET_ROLE_ID)).length

/* ---------- 权限授权计算 ---------- */

/**
 * 授权集合的展开：把「收敛态」的标识集合展开为**全部已授权能力标识**。
 * 用于 RBAC 判定：某个能力只要出现在该集合中即为已授权。
 * - `['system']` → 其下全部菜单的进入能力 + 全部按钮
 * - `['system:member']` → 仅该菜单的进入能力（只读进入，不含按钮）
 */
export function expandPermissionKeys(keys: string[]): string[] {
  const granted = new Set<string>()
  keys.forEach((key) => expandGrantKey(key).forEach((item) => granted.add(item)))
  return [...granted]
}

/**
 * 祖先中「自身即页面」的进入能力：授权某个按钮时需一并授予，
 * 保证「能用按钮 = 能进入该页面」。判定依据是祖先是否自身即页面，
 * 而不是它挂在哪一级导航——一级导航项也可能是页面（如「告警中心」）。
 * 多级菜单下会补齐全部上级页面。
 */
function ancestorEntryKeys(key: string): string[] {
  return getAncestorKeys(key).filter((item) => {
    const node = getPermissionNode(item)
    return node ? isSelfCapability(node) : false
  })
}

/**
 * 授权集合的收敛：把任意合法集合规整为最简的存储形态。
 * - 整个目录的能力齐备时，折叠为目录标识（如 `['system']`），后续字典在该目录下新增菜单可自动获得
 * - 菜单标识仅代表「可进入该页面」，因此「整块授权某菜单」会存为菜单标识 + 其下全部按钮标识，
 *   不会被折叠掉，从而与「只读进入」区分
 * - 补齐上级菜单的进入能力，保证「有按钮能力 ⇒ 能进入其所在菜单」的约束不被破坏
 */
export function collapsePermissionKeys(keys: string[]): string[] {
  const granted = new Set(
    expandPermissionKeys(keys.filter((key) => ALL_PERMISSION_KEYS.includes(key))),
  )
  // 归一化：有按钮能力时同步补齐其上级菜单的进入能力
  const normalized = [...granted]
  normalized.forEach((key) => ancestorEntryKeys(key).forEach((item) => granted.add(item)))

  const emitted: string[] = []
  const walk = (node: PermissionNode) => {
    const caps = subtreeCapabilityKeysOf(node)
    if (!caps.length) return
    // 整目录授权：用目录标识覆盖其下全部内容
    if (isCollapsible(node) && caps.every((key) => granted.has(key))) {
      emitted.push(node.key)
      return
    }
    // 菜单 / 无下级的目录：自身能力单独成项，其下再逐项判断
    if (isSelfCapability(node) && granted.has(node.key)) emitted.push(node.key)
    node.children.forEach(walk)
  }

  PERMISSION_TREE.forEach(walk)
  // 保持字典顺序，便于比较与展示
  return ALL_PERMISSION_KEYS.filter((key) => emitted.includes(key))
}

/**
 * 角色的授权集合（收敛态）：面板勾选状态与差异清单都以它为准。
 * 预置角色恒等于「全部能力」，因此后续字典新增节点会被自动覆盖（PRD 7.5）。
 */
export function roleGrantKeys(role: Role | null): string[] {
  if (!role) return []
  if (isPresetRole(role)) return allPermissions()
  return collapsePermissionKeys(role.permissions)
}

/** 全选：由「全部能力」收敛而来，因此不依赖顶层节点标识能否代表其整棵子树 */
export const allPermissions = () => collapsePermissionKeys(ALL_CAPABILITY_KEYS)

/**
 * 在授权集合上执行一次勾选 / 取消。
 * - 勾选：授予该节点整棵子树（含其自身能力）；若勾的是按钮，同时补齐上级菜单的进入能力
 * - 取消：摘除该节点整棵子树；取消单个按钮不影响菜单进入能力（仍可进页面，只是不能做该操作）
 * 返回收敛后的新集合。
 */
export function togglePermissionGrant(grantKeys: string[], key: string, checked: boolean): string[] {
  const node = getPermissionNode(key)
  if (!node) return grantKeys

  // 统一在「能力集合」上运算：先展开，避免父节点残留导致取消子项后又被子树重新授权回来
  const caps = new Set(expandPermissionKeys(grantKeys))
  const target = subtreeCapabilityKeysOf(node)

  if (checked) {
    target.forEach((item) => caps.add(item))
    ancestorEntryKeys(key).forEach((item) => caps.add(item))
  } else {
    target.forEach((item) => caps.delete(item))
  }

  return collapsePermissionKeys([...caps])
}

/** 角色的**生效**能力集合：展开后的全部已授权能力，用于 RBAC 判定与数量统计 */
export function rolePermissions(role: Role | null): string[] {
  if (!role) return []
  return expandPermissionKeys(roleGrantKeys(role))
}

/* ---------- 校验 ---------- */

/** 角色名称校验：必填、2-20 字符、企业内唯一（不区分大小写），且不得与平台默认角色 / 内置超管重名 */
export function validateRoleName(name: string, excludeId?: string): string | null {
  const value = normalizeText(name)
  if (!value) return '请输入角色名称'
  if (value.length < ROLE_NAME_MIN || value.length > ROLE_NAME_MAX) {
    return `角色名称需 ${ROLE_NAME_MIN}-${ROLE_NAME_MAX} 个字符`
  }
  if (value === '企业超级管理员') return '该角色名称已存在，请修改名称'
  const duplicated = roleList.some(
    (role) => role.id !== excludeId && role.name.toLowerCase() === value.toLowerCase(),
  )
  if (duplicated) return '该角色名称已存在，请修改名称'
  return null
}

export function validateRoleDesc(desc: string): string | null {
  return normalizeText(desc).length > ROLE_DESC_MAX ? `最多输入 ${ROLE_DESC_MAX} 个字符` : null
}

/* ---------- 变更记录（F-ROL-09） ---------- */

/**
 * 【原型说明】记录角色与权限变更，对应 PRD F-ROL-09。
 * 正式实现中该记录写入「系统管理 › 系统日志」，本页不展示独立界面。
 */
function writeRoleLog(type: RoleChangeType, roleName: string, detail: string) {
  roleLogs.unshift({
    id: `RLOG-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    at: Date.now(),
    account: currentOperator(),
    type,
    roleName,
    detail,
  })
  if (roleLogs.length > 200) roleLogs.splice(200)
  persistRoleLogs()
}

/* ---------- 角色维护 ---------- */

/**
 * 新增角色：只创建名称与描述，权限为空（PRD Q-ROL-06 名称与权限分两步保存）。
 * 创建后的角色自动选中，由管理员在权限面板勾选并保存。
 */
export async function createRole(input: RoleInput): Promise<Role> {
  await delay()
  if (isRoleLimitReached()) throw new Error('自定义角色数量已达上限')
  const name = normalizeText(input.name)
  if (validateRoleName(name)) throw new Error('角色名称不合法')
  const role: Role = {
    id: `ROLE-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name,
    desc: normalizeText(input.desc),
    source: 'custom',
    permissions: [],
    createdAt: Date.now(),
  }
  roleList.push(role)
  persistRoles()
  writeRoleLog('新增角色', name, `创建角色「${name}」；初始权限为空，待配置`)
  return role
}

/** 重命名角色与编辑描述；预置角色与平台默认角色不可编辑 */
export async function updateRole(id: string, input: RoleInput): Promise<void> {
  await delay()
  const role = getRole(id)
  if (!role) throw new Error('角色不存在')
  if (isDefaultRole(role)) throw new Error('平台默认角色由平台统一维护，不可修改')
  if (isPresetRole(role)) throw new Error('预置角色不可修改')
  const name = normalizeText(input.name)
  const before = role.name
  const beforeDesc = role.desc
  role.name = name
  role.desc = normalizeText(input.desc)
  persistRoles()
  const changes: string[] = []
  if (before !== role.name) changes.push(`名称由「${before}」改为「${role.name}」`)
  if (beforeDesc !== role.desc) changes.push('修改了角色描述')
  if (changes.length) writeRoleLog('重命名', role.name, changes.join('；'))
}

/** 删除角色：成员数为 0 才可删除，预置角色与平台默认角色不可删除 */
export async function removeRole(id: string): Promise<void> {
  await delay()
  const role = getRole(id)
  if (!role) throw new Error('角色不存在')
  if (isDefaultRole(role)) throw new Error('平台默认角色由平台统一维护，企业侧不可删除')
  if (isPresetRole(role)) throw new Error('预置角色不可删除')
  const memberCount = roleMemberCount(id)
  if (memberCount > 0) throw new Error(`该角色下有 ${memberCount} 名成员，请先解除绑定`)
  const index = roleList.findIndex((item) => item.id === id)
  const permissionCount = rolePermissions(role).length
  roleList.splice(index, 1)
  persistRoles()
  writeRoleLog(
    '删除角色',
    role.name,
    `删除角色「${role.name}」（删除前有 ${permissionCount} 项权限）`,
  )
}

/**
 * 保存角色的权限配置（PRD F-ROL-03：批量修改后点「保存」提交）。
 * 入参与存储均为「授权节点（收敛态）」集合；差异按操作级权限点展开后逐项写入系统日志，
 * 便于审计时看清具体影响到了哪些按钮级功能。预置角色不产生保存请求。
 */
export async function saveRolePermissions(id: string, grantKeys: string[]): Promise<void> {
  await delay()
  const role = getRole(id)
  if (!role) throw new Error('角色不存在')
  if (isDefaultRole(role)) throw new Error('平台默认角色由平台统一维护，权限不可修改')
  if (isPresetRole(role)) throw new Error('预置角色权限不可修改')

  const before = rolePermissions(role)
  const after = expandPermissionKeys(collapsePermissionKeys(grantKeys))
  const added = after.filter((key) => !before.includes(key))
  const removed = before.filter((key) => !after.includes(key))
  if (!added.length && !removed.length) return

  role.permissions = collapsePermissionKeys(grantKeys)
  persistRoles()

  const parts: string[] = []
  if (added.length) parts.push(`新增 ${added.length} 项：${added.map(permissionPathText).join('、')}`)
  if (removed.length) parts.push(`移除 ${removed.length} 项：${removed.map(permissionPathText).join('、')}`)
  writeRoleLog('权限配置', role.name, parts.join('；'))
}

/* ---------- 企业默认角色（平台端「企业角色管理」维护） ---------- */

/** 平台端企业角色管理列表：内置企业超级管理员（只读）+ 平台默认角色 */
export function builtinEnterpriseRoles(): Role[] {
  return sortedRoles().filter((role) => isPresetRole(role) || isDefaultRole(role))
}

export const getDefaultRole = (id: string) => {
  const role = getRole(id)
  return role && isDefaultRole(role) ? role : null
}

export function searchDefaultRoles(keyword: string): Role[] {
  const value = keyword.trim().toLowerCase()
  return builtinEnterpriseRoles().filter((role) => {
    if (!value) return true
    return role.name.toLowerCase().includes(value) || role.desc.toLowerCase().includes(value)
  })
}

/** 默认角色名称校验：全平台唯一，不得与内置角色或其他企业自定义角色重名 */
export function validateDefaultRoleName(name: string, excludeId?: string): string | null {
  return validateRoleName(name, excludeId)
}

/** 新增默认角色：只创建名称与描述，权限为空，创建后由右侧面板配置 */
export async function createDefaultRole(input: RoleInput): Promise<Role> {
  await delay()
  const name = normalizeText(input.name)
  const nameError = validateDefaultRoleName(name)
  if (nameError) throw new Error(nameError)
  const role: Role = {
    id: `ROLE-DEFAULT-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name,
    desc: normalizeText(input.desc),
    source: 'default',
    permissions: [],
    createdAt: Date.now(),
  }
  roleList.push(role)
  persistRoles()
  return role
}

/** 编辑默认角色：仅允许平台侧修改 */
export async function updateDefaultRole(id: string, input: RoleInput): Promise<void> {
  await delay()
  const role = getDefaultRole(id)
  if (!role) throw new Error('默认角色不存在')
  const name = normalizeText(input.name)
  const nameError = validateDefaultRoleName(name, id)
  if (nameError) throw new Error(nameError)
  role.name = name
  role.desc = normalizeText(input.desc)
  persistRoles()
}

/** 删除默认角色：全平台无成员绑定时才可删除 */
export async function removeDefaultRole(id: string): Promise<void> {
  await delay()
  const role = getDefaultRole(id)
  if (!role) throw new Error('默认角色不存在')
  const memberCount = roleMemberCount(id)
  if (memberCount > 0) {
    throw new Error(`该默认角色仍被 ${memberCount} 名成员使用，请先在企业成员中解除绑定后再删除`)
  }
  const index = roleList.findIndex((item) => item.id === id)
  if (index >= 0) roleList.splice(index, 1)
  persistRoles()
}

/** 保存默认角色权限：仅允许平台侧修改，保存后对所有企业立即生效 */
export async function saveDefaultRolePermissions(id: string, grantKeys: string[]): Promise<void> {
  await delay()
  const role = getDefaultRole(id)
  if (!role) throw new Error('默认角色不存在')
  role.permissions = collapsePermissionKeys(grantKeys)
  persistRoles()
}

/* ---------- 搜索与筛选 ---------- */

/** 按角色名称或描述模糊匹配（不区分大小写） */
export function searchRoles(keyword: string): Role[] {
  const value = keyword.trim().toLowerCase()
  return sortedRoles().filter((role) => {
    if (!value) return true
    return role.name.toLowerCase().includes(value) || role.desc.toLowerCase().includes(value)
  })
}

/* ---------- 当前账号的功能权限（RBAC 生效链路） ---------- */

/**
 * 【原型说明】当前登录账号的功能权限点集合 = 其所绑定角色权限点的并集（PRD 7.2 权限判定规则）。
 * 链路：会话账号标识 → 企业成员 → 成员角色 → 角色权限点并集。
 * - 平台运营管理员不属企业成员，按 PRD 3.1 的「平台级管理（只读）」给予查看类权限；
 * - 未在成员列表中找到对应成员的其它账号视为无业务权限，用于验证「无权限则入口不渲染」的表现。
 */
export function currentPermissions(): string[] {
  const current = session.current
  if (!current) return []
  if (current.roleCode === 'PLATFORM_ADMIN') {
    // 平台级只读：可进入各已定稿页面查看，但不含任何按钮级操作能力
    return [
      'dashboard',
      'alarm',
      'device:ledger',
      'system:org',
      'system:member',
      'system:role',
      'system:enterprise',
      'system:log',
    ]
  }
  const member = members.find((item) => item.identifier === current.identifier)
  if (!member) return []
  const set = new Set<string>()
  member.roleIds.forEach((roleId) => {
    const role = getRole(roleId)
    rolePermissions(role).forEach((key) => set.add(key))
  })
  return [...set]
}

/** 【原型说明】重置角色演示数据由 store/index.ts 统一提供 */
