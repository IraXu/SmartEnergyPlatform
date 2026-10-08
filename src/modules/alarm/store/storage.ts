/**
 * 【原型说明】告警中心模块的演示数据容器与版本迁移，仅用于原型演示。
 * 数据存于 localStorage；正式实现应为服务端存储，此处仅用于交互验证。
 */

import { reactive } from 'vue'
import { readJSON, removeKeys, writeJSON } from '@/shared/utils/storage'
import { getNode, getPathText } from '@/modules/org/store'
import { nodes as orgNodes } from '@/modules/org/store/storage'
import { createPresetAlarms } from '../mock/seed'
import { ALARM_ALL_KEYS, ALARM_DATA_VERSION, ALARM_LIST_KEY, ALARM_LOGS_KEY, ALARM_VERSION_KEY } from './constants'
import type { Alarm, AlarmChangeLog } from './types'

/** 演示数据结构升级时清理旧数据，避免历史结构格式不一致 */
function migrateAlarmData() {
  if (localStorage.getItem(ALARM_VERSION_KEY) === ALARM_DATA_VERSION) return
  removeKeys(ALARM_ALL_KEYS)
  localStorage.setItem(ALARM_VERSION_KEY, ALARM_DATA_VERSION)
}

migrateAlarmData()

/**
 * 【原型说明】按组织架构中真实的用能单元节点解析告警的所属用能单元路径。
 * 这样告警列表里的层级路径与「组织架构」页维护的内容保持一致；
 * 节点被重命名或移动后，重置演示数据即可看到同步结果。
 */
function resolveUnitPath(unitId: string) {
  const node = getNode(unitId)
  if (!node) return '—'
  return node.parentId ? getPathText(node.parentId) : node.name
}

/** 组织架构的节点，供查询条件中的用能单元树选择使用 */
export { orgNodes }

export const alarms = reactive<Alarm[]>(readJSON(ALARM_LIST_KEY, createPresetAlarms(resolveUnitPath)))
export const logs = reactive<AlarmChangeLog[]>(readJSON(ALARM_LOGS_KEY, []))

export function persistAlarms() {
  writeJSON(ALARM_LIST_KEY, alarms)
}

export function persistLogs() {
  writeJSON(ALARM_LOGS_KEY, logs)
}

/** 【原型说明】把告警清单恢复为初始演示数据，并清空变更记录 */
export function resetAlarmData() {
  alarms.splice(0, alarms.length, ...createPresetAlarms(resolveUnitPath))
  logs.splice(0, logs.length)
  persistAlarms()
  persistLogs()
}
