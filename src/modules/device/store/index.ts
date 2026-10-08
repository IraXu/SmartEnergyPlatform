/**
 * 【原型说明】设备管理 › 设备台账模块的统一出口，仅用于原型交互验证，非生产代码。
 * 设备台账的维护规则对齐《产品需求文档-设备台账》v1.0。
 *
 * 设备所属用能单元取自「系统管理 › 组织架构」的演示数据容器，本模块不单独维护。
 */

import { removeKeys } from '@/shared/utils/storage'
import { DEVICE_ALL_KEYS } from './constants'
import { createPresetDevices } from '../mock/seed'
import { createPresetMqttLogs } from '../mock/mqttLogs'
import { createPresetSessions } from '../mock/sessions'
import { pruneMqttLogs } from './control'
import { devices, logs, mqttLogs, sessions } from './storage'

export * from './constants'
export * from './types'
export * from './device'
export * from './columns'
export * from './view'
export * from './control'
export * from './params'
export * from './session'

export { devices, logs, mqttLogs, sessions } from './storage'
export { persistDevices, persistLogs, persistMqttLogs, persistSessions } from './storage'

/**
 * 【原型说明】模块加载时按「仅保留最近 30 天」清理一次历史通讯日志，
 * 模拟服务端的定期自动清理（PRD F-DEV-14）。
 */
pruneMqttLogs()

/** 【原型调试】重置设备台账演示数据，便于反复验证各状态与异常分支 */
export function resetDeviceLedgerData() {
  removeKeys(DEVICE_ALL_KEYS)
  devices.splice(0, devices.length, ...createPresetDevices())
  logs.splice(0, logs.length)
  mqttLogs.splice(0, mqttLogs.length, ...createPresetMqttLogs(devices))
  sessions.splice(0, sessions.length, ...createPresetSessions(devices))
}
