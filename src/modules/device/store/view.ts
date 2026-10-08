/**
 * 【原型说明】设备台账「列表 / 卡片」展示方式的偏好，仅用于原型交互验证。
 * 默认列表展示；偏好保存在 localStorage（仅浏览器本地生效），
 * 正式实现应随账号在服务端保存。
 */

import { ref, watch } from 'vue'
import { readJSON, writeJSON } from '@/shared/utils/storage'
import { DEVICE_VIEW_KEY } from './constants'

/** 展示方式：列表（默认）/ 卡片 */
export type DeviceViewMode = 'list' | 'card'

const stored = readJSON<DeviceViewMode>(DEVICE_VIEW_KEY, 'list')

export const deviceViewMode = ref<DeviceViewMode>(stored === 'card' ? 'card' : 'list')

watch(deviceViewMode, (value) => writeJSON(DEVICE_VIEW_KEY, value))
