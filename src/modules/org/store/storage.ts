/**
 * 【原型说明】组织架构模块的演示数据容器与版本迁移，仅用于原型演示。
 * 数据存于 localStorage；正式实现应为服务端存储，此处仅用于交互验证。
 *
 * 节点负责人所选成员统一来自「系统管理 › 企业成员」模块的演示数据容器
 * （见 `@/modules/member/store/storage`），组织架构模块不再单独维护成员数据。
 */

import { reactive } from 'vue'
import { readJSON, removeKeys, writeJSON } from '@/shared/utils/storage'
import { session } from '@/modules/auth/store'
import { createPresetNodes, ROOT_ID } from '../mock/seed'
import { ORG_ALL_KEYS, ORG_DATA_VERSION, ORG_LOGS_KEY, ORG_NODES_KEY, ORG_VERSION_KEY } from './constants'
import type { OrgChangeLog, OrgNode } from './types'

/** 演示数据结构升级时清理旧数据，避免历史结构格式不一致 */
function migrateOrgData() {
  if (localStorage.getItem(ORG_VERSION_KEY) === ORG_DATA_VERSION) return
  removeKeys(ORG_ALL_KEYS)
  localStorage.setItem(ORG_VERSION_KEY, ORG_DATA_VERSION)
}

migrateOrgData()

/** 根节点名称取当前登录企业名称，对齐「根节点由企业注册信息自动生成」的规则 */
const rootName = session.current?.orgName || '示例科技有限公司'

export const nodes = reactive<OrgNode[]>(readJSON(ORG_NODES_KEY, createPresetNodes(rootName)))
export const logs = reactive<OrgChangeLog[]>(readJSON(ORG_LOGS_KEY, []))

/** 企业名称变化时（如重新注册）同步根节点展示名 */
if (!nodes.some((node) => node.kind === 'root')) {
  nodes.push(...createPresetNodes(rootName))
} else if (session.current?.orgName) {
  const root = nodes.find((node) => node.id === ROOT_ID)
  if (root) root.name = session.current.orgName
}

export function persistNodes() {
  writeJSON(ORG_NODES_KEY, nodes)
}

export function persistLogs() {
  writeJSON(ORG_LOGS_KEY, logs)
}
