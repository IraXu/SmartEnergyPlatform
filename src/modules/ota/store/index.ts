/**
 * 【原型说明】设备管理 › 设备OTA 模块的统一出口，仅用于原型交互验证，非生产代码。
 * 业务规则对齐《产品需求文档-设备OTA》v1.0。
 *
 * 设备档案与设备类型取自「设备管理 › 设备台账」的演示数据容器；
 * 固件基线为平台运营方维护的演示数据（企业侧只读）。
 */

import { removeKeys } from '@/shared/utils/storage'
import { OTA_ALL_KEYS } from './constants'
import { createPresetOtaStates } from '../mock/seed'
import { otaLogs, otaStates, otaTasks } from './storage'

export * from './constants'
export * from './types'
export * from './ota'

export { otaLogs, otaStates, otaTasks } from './storage'
export { persistOtaLogs, persistOtaStates, persistOtaTasks } from './storage'

/** 【原型调试】重置设备OTA 演示数据，便于反复验证各状态与异常分支 */
export function resetOtaDemoData() {
  removeKeys(OTA_ALL_KEYS)
  otaStates.splice(0, otaStates.length, ...createPresetOtaStates())
  otaTasks.splice(0, otaTasks.length)
  otaLogs.splice(0, otaLogs.length)
}
