/**
 * 【原型说明】企业成员模块的统一出口，仅用于原型交互验证，非生产代码。
 * 成员账号、角色分配、数据范围绑定与变更记录规则对齐《产品需求文档-企业成员》v1.0。
 */

import { MEMBER_ALL_KEYS } from './constants'
import { removeKeys } from '@/shared/utils/storage'
import { PRESET_MEMBERS } from '../mock/seed'
import { memberList, memberLogs } from './storage'

export * from './constants'
export * from './types'
export * from './member'

export { memberList, memberLogs, orgName } from './storage'
export { persistMemberLogs, persistMembers } from './storage'

/** 【原型调试】重置企业成员演示数据，便于反复验证各状态与异常分支 */
export function resetMemberData() {
  removeKeys(MEMBER_ALL_KEYS)
  memberList.splice(0, memberList.length, ...PRESET_MEMBERS.map((item) => ({ ...item })))
  memberLogs.splice(0, memberLogs.length)
}
