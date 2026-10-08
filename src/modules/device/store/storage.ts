/**
 * 【原型说明】设备台账模块的演示数据容器与版本迁移，仅用于原型演示。
 * 数据存于 localStorage；正式实现应为服务端存储，此处仅用于交互验证。
 *
 * 设备所属用能单元的层级路径由「系统管理 › 组织架构」的演示数据解析，
 * 本模块不重复维护组织架构数据。
 */

import { reactive } from 'vue'
import { readJSON, removeKeys, writeJSON } from '@/shared/utils/storage'
import { createPresetDevices } from '../mock/seed'
import { createPresetMqttLogs } from '../mock/mqttLogs'
import { createPresetSessions } from '../mock/sessions'
import {
  DEVICE_ALL_KEYS,
  DEVICE_DATA_VERSION,
  DEVICE_LIST_KEY,
  DEVICE_LOGS_KEY,
  DEVICE_MQTT_LOGS_KEY,
  DEVICE_SESSIONS_KEY,
  DEVICE_VERSION_KEY,
} from './constants'
import type { Device, DeviceChangeLog, DeviceSessionEvent, MqttLog } from './types'

/** 演示数据结构升级时清理旧数据，避免历史结构格式不一致 */
function migrateDeviceData() {
  if (localStorage.getItem(DEVICE_VERSION_KEY) === DEVICE_DATA_VERSION) return
  removeKeys(DEVICE_ALL_KEYS)
  localStorage.setItem(DEVICE_VERSION_KEY, DEVICE_DATA_VERSION)
}

migrateDeviceData()

export const devices = reactive<Device[]>(readJSON(DEVICE_LIST_KEY, createPresetDevices()))
export const logs = reactive<DeviceChangeLog[]>(readJSON(DEVICE_LOGS_KEY, []))
export const mqttLogs = reactive<MqttLog[]>(readJSON(DEVICE_MQTT_LOGS_KEY, createPresetMqttLogs(devices)))
export const sessions = reactive<DeviceSessionEvent[]>(readJSON(DEVICE_SESSIONS_KEY, createPresetSessions(devices)))

export function persistDevices() {
  writeJSON(DEVICE_LIST_KEY, devices)
}

export function persistLogs() {
  writeJSON(DEVICE_LOGS_KEY, logs)
}

export function persistMqttLogs() {
  writeJSON(DEVICE_MQTT_LOGS_KEY, mqttLogs)
}

export function persistSessions() {
  writeJSON(DEVICE_SESSIONS_KEY, sessions)
}

/** 【原型说明】把设备台账恢复为初始演示数据，并重建变更记录、MQTT 通讯日志与上下线记录 */
export function resetDeviceData() {
  devices.splice(0, devices.length, ...createPresetDevices())
  logs.splice(0, logs.length)
  mqttLogs.splice(0, mqttLogs.length, ...createPresetMqttLogs(devices))
  sessions.splice(0, sessions.length, ...createPresetSessions(devices))
  persistDevices()
  persistLogs()
  persistMqttLogs()
  persistSessions()
}
