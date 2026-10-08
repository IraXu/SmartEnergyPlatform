/**
 * 【原型说明】系统日志模块的演示数据容器与版本迁移，仅用于原型演示。
 * 数据存于 localStorage；正式实现应为服务端存储，此处仅用于交互验证。
 *
 * 说明：两类日志在本页均为**只读**。操作行为日志的预置数据为静态演示数据；
 * 登录日志额外承载「原型内新产生的登录记录」，用于验证外部来源写入后的可见性。
 */

import { reactive } from 'vue'
import { readJSON, removeKeys, writeJSON } from '@/shared/utils/storage'
import { createPresetLoginLogs, createPresetOperationLogs } from '../mock/seed'
import { LOGIN_LOG_KEY, LOG_DATA_VERSION, LOG_VERSION_KEY } from './constants'
import type { LoginLog, OperationLog } from './types'

/** 演示数据结构升级时清理旧数据，避免历史结构格式不一致 */
function migrateLogData() {
  if (localStorage.getItem(LOG_VERSION_KEY) === LOG_DATA_VERSION) return
  removeKeys([LOGIN_LOG_KEY])
  localStorage.setItem(LOG_VERSION_KEY, LOG_DATA_VERSION)
}

migrateLogData()

/** 【原型说明】原型内新产生的登录记录（由登录页写入），与预置演示数据合并展示 */
export const runtimeLoginLogs = reactive<LoginLog[]>(readJSON(LOGIN_LOG_KEY, []))

/** 预置操作行为日志：静态演示数据，本页只读 */
export const presetOperationLogs: OperationLog[] = createPresetOperationLogs()

/** 全部登录日志：预置演示数据 + 原型内新产生的记录，按时间倒序 */
export function allLoginLogs(): LoginLog[] {
  return [...createPresetLoginLogs(), ...runtimeLoginLogs].sort((a, b) => b.at - a.at)
}

export function persistRuntimeLoginLogs() {
  writeJSON(LOGIN_LOG_KEY, runtimeLoginLogs)
}

/** 【原型调试】清空原型内新产生的登录记录 */
export function resetLogData() {
  removeKeys([LOGIN_LOG_KEY])
  runtimeLoginLogs.splice(0, runtimeLoginLogs.length)
}
