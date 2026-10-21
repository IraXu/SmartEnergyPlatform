/**
 * 【原型说明】平台管理端模块的演示数据容器与版本迁移，仅用于原型演示。
 * 数据存于 localStorage；正式实现应为服务端存储，此处仅用于交互验证。
 */

import { reactive } from 'vue'
import { readJSON, removeKeys, writeJSON } from '@/shared/utils/storage'
import { PRESET_PLATFORM_MEMBERS, PRESET_PLATFORM_ROLES } from '../mock/seed'
import { PLATFORM_ALL_KEYS, PLATFORM_DATA_VERSION, PLATFORM_MEMBER_KEY, PLATFORM_ROLE_KEY, PLATFORM_VERSION_KEY } from './constants'
import type { PlatformMember, PlatformRole } from './types'

function migratePlatformData() {
  if (localStorage.getItem(PLATFORM_VERSION_KEY) === PLATFORM_DATA_VERSION) return
  removeKeys(PLATFORM_ALL_KEYS)
  localStorage.setItem(PLATFORM_VERSION_KEY, PLATFORM_DATA_VERSION)
}

migratePlatformData()

export const platformMembers = reactive<PlatformMember[]>(
  readJSON(PLATFORM_MEMBER_KEY, PRESET_PLATFORM_MEMBERS),
)
export const platformRoles = reactive<PlatformRole[]>(
  readJSON(PLATFORM_ROLE_KEY, PRESET_PLATFORM_ROLES),
)

/** 本地存储缺失预置平台角色时补回，保证平台端始终具备可管理角色 */
if (!platformRoles.some((role) => role.source === 'preset')) {
  const preset = PRESET_PLATFORM_ROLES.find((role) => role.source === 'preset')
  if (preset) platformRoles.unshift(preset)
}

export function persistPlatformMembers() {
  writeJSON(PLATFORM_MEMBER_KEY, platformMembers)
}

export function persistPlatformRoles() {
  writeJSON(PLATFORM_ROLE_KEY, platformRoles)
}
