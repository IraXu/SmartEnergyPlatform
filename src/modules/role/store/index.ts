/**
 * 【原型说明】角色管理模块的统一出口，仅用于原型交互验证，非生产代码。
 * 角色、权限点与权限配置规则对齐《产品需求文档-角色管理》v1.0。
 */

import { removeKeys } from '@/shared/utils/storage'
import { ROLE_ALL_KEYS } from './constants'
import { PRESET_ROLES } from '../mock/seed'
import { roleList, roleLogs } from './storage'

export * from './constants'
export * from './types'
export * from './role'
export {
  ALL_CAPABILITY_KEYS,
  ALL_PERMISSION_KEYS,
  ALL_PERMISSION_NODES,
  PERMISSION_TREE,
  expandGrantKey,
  getAncestorKeys,
  getPermissionNode,
  getSubtreeKeys,
  hasMenuChildren,
  isCollapsible,
  isSelfCapability,
  permissionName,
  permissionPathText,
  subtreeCapabilityKeysOf,
} from '../mock/permissions'
export { PRESET_ROLE_ID } from '../mock/seed'

export { roleList, roleLogs } from './storage'
export { persistRoleLogs, persistRoles } from './storage'

/** 【原型调试】重置角色演示数据，便于反复验证各状态与异常分支 */
export function resetRoleData() {
  removeKeys(ROLE_ALL_KEYS)
  roleList.splice(
    0,
    roleList.length,
    ...PRESET_ROLES.map((role) => ({ ...role, permissions: [...role.permissions] })),
  )
  roleLogs.splice(0, roleLogs.length)
}
