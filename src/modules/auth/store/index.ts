/**
 * 【原型说明】认证模块的统一出口，仅用于原型交互验证，非生产代码。
 * 登录态、锁定、验证码规则严格对齐 PRD《登录与注册》与交互设计文档。
 *
 * 内部按职责拆分为 session / account / lock / code / identifier，
 * 页面与组件统一从本文件引入，避免感知内部文件结构。
 */

import { PRESET_ACCOUNTS } from '@/modules/auth/mock/seed'
import { ALL_STORAGE_KEYS } from './constants'
import { accounts, codeMap, lockMap, presetRecentOrgs, recentOrgMap, rememberedOrgMap, session } from './storage'
import { removeKeys } from '@/shared/utils/storage'

export * from './constants'
export * from './types'
export * from './identifier'
export * from './session'
export * from './account'
export * from './lock'
export * from './code'

export { accounts, codeMap, lockMap, recentOrgMap, rememberedOrgMap, session } from './storage'

/** 【原型调试】重置演示数据，便于反复验证流程 */
export function resetPrototypeData() {
  removeKeys(ALL_STORAGE_KEYS)
  accounts.splice(0, accounts.length, ...PRESET_ACCOUNTS)
  Object.keys(lockMap).forEach((key) => delete lockMap[key])
  Object.keys(codeMap).forEach((key) => delete codeMap[key])
  Object.keys(recentOrgMap).forEach((key) => delete recentOrgMap[key])
  Object.assign(recentOrgMap, presetRecentOrgs())
  Object.keys(rememberedOrgMap).forEach((key) => delete rememberedOrgMap[key])
  session.current = null
}
