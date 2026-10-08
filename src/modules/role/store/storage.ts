/**
 * 【原型说明】角色管理模块的演示数据容器与版本迁移，仅用于原型演示。
 * 数据存于 localStorage；正式实现应为服务端存储，此处仅用于交互验证。
 */

import { reactive } from 'vue'
import { readJSON, removeKeys, writeJSON } from '@/shared/utils/storage'
import { PRESET_ROLES } from '../mock/seed'
import { ROLE_ALL_KEYS, ROLE_DATA_VERSION, ROLE_LIST_KEY, ROLE_LOGS_KEY, ROLE_VERSION_KEY } from './constants'
import type { Role, RoleChangeLog } from './types'

/** 演示数据结构升级时清理旧数据，避免历史结构格式不一致 */
function migrateRoleData() {
  if (localStorage.getItem(ROLE_VERSION_KEY) === ROLE_DATA_VERSION) return
  removeKeys(ROLE_ALL_KEYS)
  localStorage.setItem(ROLE_VERSION_KEY, ROLE_DATA_VERSION)
}

migrateRoleData()

export const roleList = reactive<Role[]>(readJSON(ROLE_LIST_KEY, PRESET_ROLES))
export const roleLogs = reactive<RoleChangeLog[]>(readJSON(ROLE_LOGS_KEY, []))

/** 本地存储缺失预置角色时补回，保证「企业始终具备完整管理能力」（PRD F-ROL-05） */
if (!roleList.some((role) => role.source === 'preset')) {
  const preset = PRESET_ROLES.find((role) => role.source === 'preset')
  if (preset) roleList.unshift(preset)
}

export function persistRoles() {
  writeJSON(ROLE_LIST_KEY, roleList)
}

export function persistRoleLogs() {
  writeJSON(ROLE_LOGS_KEY, roleLogs)
}
