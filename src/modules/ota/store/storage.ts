/**
 * 【原型说明】设备管理 › 设备OTA 模块的演示数据容器与版本迁移，仅用于原型演示。
 * 数据存于 localStorage；正式实现应为服务端存储与真实固件通道，此处仅用于交互验证。
 *
 * 设备档案与设备类型取自「设备管理 › 设备台账」的演示数据容器，本模块不重复维护。
 */

import { reactive } from 'vue'
import { readJSON, removeKeys, writeJSON } from '@/shared/utils/storage'
import { createPresetOtaStates, createPresetTasks } from '../mock/seed'
import {
  OTA_ALL_KEYS,
  OTA_DATA_VERSION,
  OTA_LOG_KEY,
  OTA_STATE_KEY,
  OTA_TASK_KEY,
  OTA_VERSION_KEY,
} from './constants'
import type { OtaChangeLog, OtaState, UpgradeTask } from './types'

/** 演示数据结构升级时清理旧数据，避免历史结构格式不一致 */
function migrateOtaData() {
  if (localStorage.getItem(OTA_VERSION_KEY) === OTA_DATA_VERSION) return
  removeKeys(OTA_ALL_KEYS)
  localStorage.setItem(OTA_VERSION_KEY, OTA_DATA_VERSION)
}

migrateOtaData()

export const otaStates = reactive<OtaState[]>(readJSON(OTA_STATE_KEY, createPresetOtaStates()))
export const otaTasks = reactive<UpgradeTask[]>(readJSON(OTA_TASK_KEY, createPresetTasks()))
export const otaLogs = reactive<OtaChangeLog[]>(readJSON(OTA_LOG_KEY, []))

export function persistOtaStates() {
  writeJSON(OTA_STATE_KEY, otaStates)
}

export function persistOtaTasks() {
  writeJSON(OTA_TASK_KEY, otaTasks)
}

export function persistOtaLogs() {
  writeJSON(OTA_LOG_KEY, otaLogs)
}

/** 【原型说明】把设备OTA 恢复为初始演示数据，并清空任务与变更记录 */
export function resetOtaData() {
  otaStates.splice(0, otaStates.length, ...createPresetOtaStates())
  otaTasks.splice(0, otaTasks.length)
  otaLogs.splice(0, otaLogs.length)
  persistOtaStates()
  persistOtaTasks()
  persistOtaLogs()
}
