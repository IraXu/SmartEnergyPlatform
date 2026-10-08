/**
 * 【原型说明】企业成员模块的演示数据容器与版本迁移，仅用于原型演示。
 * 数据存于 localStorage；正式实现应为服务端存储，此处仅用于交互验证。
 */

import { reactive } from 'vue'
import { readJSON, removeKeys, writeJSON } from '@/shared/utils/storage'
import { session } from '@/modules/auth/store'
import { PRESET_MEMBERS } from '../mock/seed'
import { MEMBER_ALL_KEYS, MEMBER_DATA_VERSION, MEMBER_LIST_KEY, MEMBER_LOGS_KEY, MEMBER_VERSION_KEY } from './constants'
import type { Member, MemberChangeLog } from './types'

/** 演示数据结构升级时清理旧数据，避免历史结构格式不一致 */
function migrateMemberData() {
  if (localStorage.getItem(MEMBER_VERSION_KEY) === MEMBER_DATA_VERSION) return
  removeKeys(MEMBER_ALL_KEYS)
  localStorage.setItem(MEMBER_VERSION_KEY, MEMBER_DATA_VERSION)
}

migrateMemberData()

export const memberList = reactive<Member[]>(readJSON(MEMBER_LIST_KEY, PRESET_MEMBERS))
export const memberLogs = reactive<MemberChangeLog[]>(readJSON(MEMBER_LOGS_KEY, []))

/** 【原型说明】当前进入企业名称，用于说明多租户边界 */
export const orgName = session.current?.orgName || '示例科技有限公司'

export function persistMembers() {
  writeJSON(MEMBER_LIST_KEY, memberList)
}

export function persistMemberLogs() {
  writeJSON(MEMBER_LOGS_KEY, memberLogs)
}
