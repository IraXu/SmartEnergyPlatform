/**
 * 【原型说明】组织架构模块的统一出口，仅用于原型交互验证，非生产代码。
 * 结构维护、属性编辑与变更记录规则对齐《产品需求文档-组织架构》v1.0。
 *
 * 节点负责人所选成员统一来自「系统管理 › 企业成员」模块的演示数据容器，
 * 组织架构模块不再单独维护成员数据（PRESET_MEMBERS 已迁移至 member 模块）。
 */

import { removeKeys } from '@/shared/utils/storage'
import { session } from '@/modules/auth/store'
import { ORG_ALL_KEYS } from './constants'
import { createPresetNodes, ROOT_ID } from '../mock/seed'
import { logs, nodes } from './storage'

export * from './constants'
export * from './types'
export * from './org'

export { logs, nodes } from './storage'
export { persistLogs, persistNodes } from './storage'

/** 【原型调试】重置组织架构演示数据，便于反复验证各状态与异常分支 */
export function resetOrgData() {
  removeKeys(ORG_ALL_KEYS)
  const rootName = session.current?.orgName || '示例科技有限公司'
  nodes.splice(0, nodes.length, ...createPresetNodes(rootName))
  logs.splice(0, logs.length)
}

export { ROOT_ID }
