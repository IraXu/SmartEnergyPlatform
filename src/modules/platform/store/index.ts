/**
 * 【原型说明】平台管理端模块的统一出口，仅用于原型交互验证，非生产代码。
 * 账号、角色、客户与概览指标规则对齐平台管理端各 PRD v1.0。
 */

import { removeKeys } from '@/shared/utils/storage'
import { PRESET_PLATFORM_MEMBERS, PRESET_PLATFORM_ROLES } from '../mock/seed'
import { platformMembers, platformRoles } from './storage'
import { PLATFORM_ALL_KEYS } from './constants'

export * from './constants'
export * from './types'
export * from './platform'
export * from './customer'
export {
  ALL_PLATFORM_CAPABILITY_KEYS,
  ALL_PLATFORM_PERMISSION_KEYS,
  PLATFORM_PERMISSION_TREE,
  getPlatformPermissionNode,
  hasPlatformMenuChildren,
  isPlatformCollapsible,
  isPlatformSelfCapability,
  platformSubtreeKeysOf,
} from '../mock/permissions'
export { platformMembers, platformRoles, persistPlatformMembers, persistPlatformRoles } from './storage'

/** 预置企业（用于客户&设备的「所属企业」筛选与统计口径） */
export { PRESET_ENTERPRISES } from '../mock/seed'
/** 预置平台概览指标（全平台口径） */
export { PRESET_OVERVIEW } from '../mock/seed'
/** 【原型调试】重置平台管理端演示数据，便于反复验证各状态与异常分支 */
export function resetPlatformData() {
  removeKeys([...PLATFORM_ALL_KEYS, 'proto_platform_customer_columns'])
  platformMembers.splice(0, platformMembers.length, ...PRESET_PLATFORM_MEMBERS.map((item) => ({ ...item })))
  platformRoles.splice(0, platformRoles.length, ...PRESET_PLATFORM_ROLES.map((item) => ({ ...item })))
}
