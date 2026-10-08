/**
 * 【原型说明】设备可配置参数的业务逻辑，仅用于原型交互验证。
 *
 * 【扩展性设计】参数字典集中在 mock/params.ts，本文件只提供通用能力：
 * - 按分组取参数清单、按参数定义校验取值
 * - 读取某台设备的参数值（含「未抄读」态）
 * - 从设备抄读（拉取当前值）与向设备下发（写入值）
 * 新增可配置项无需改动本文件。
 */

import {
  createPresetParamValues,
  DEFAULT_PARAM_VALUES,
  DEVICE_PARAM_GROUPS,
  paramItemsOfGroup,
} from '../mock/params'
import { pushMqttLog } from './control'
import type { Device, DeviceParamItem, DeviceParamValues } from './types'

/* ---------- 字典查询 ---------- */

export { DEVICE_PARAM_GROUPS, DEVICE_PARAM_ITEMS, paramItemsOfGroup } from '../mock/params'

/**
 * 本期开放的参数项：界面呈现、校验与读写一律以它为准，
 * 待规划项（status = 'planned'）不参与任何逻辑，避免未开放项卡住校验。
 */
const activeItems = () => paramGroupsWithItems().flatMap((group) => group.items)

export const getParamItem = (key: string) => activeItems().find((item) => item.key === key) ?? null

/**
 * 分组参数清单：只返回该分组下真实存在的参数项，
 * 空分组由界面自动隐藏，避免新增分组后出现空壳区块。
 */
export function paramGroupsWithItems() {
  return DEVICE_PARAM_GROUPS.map((group) => ({
    ...group,
    items: paramItemsOfGroup(group.key),
  })).filter((group) => group.items.length > 0)
}

/* ---------- 参数值容器 ---------- */
/**
 * 设备参数值快照：设备 id → 参数值。
 * 【原型说明】正式实现中参数值保存在设备侧，平台仅做读写透传；
 * 这里为便于演示把已抄读的值缓存在内存中，不与设备台账数据混存。
 */
const paramValues = new Map<string, DeviceParamValues>()

/** 参数是否已从设备抄读过；未抄读时界面只允许「抄读」，不允许直接下发 */
const readFlags = new Map<string, boolean>()

/** 该设备是否已有参数值（演示数据按设备识别码生成，模拟「设备侧已配置」） */
export function ensureParamValues(device: Device): DeviceParamValues {
  const cached = paramValues.get(device.id)
  if (cached) return cached
  const preset = createPresetParamValues(device.imei, device.type)
  paramValues.set(device.id, preset)
  // 演示数据视为设备侧已配置，因此抄读后可直接看到值；未上云设备为空
  readFlags.set(device.id, Object.keys(preset).length > 0)
  return preset
}

/** 是否已抄读过该设备的参数 */
export const hasReadParams = (deviceId: string) => readFlags.get(deviceId) === true

/**
 * 参数当前值的展示文本。
 * 已抄读但设备侧无该值（如新增参数后设备未上报）时返回空字符串，界面展示占位符。
 */
export function currentParamValue(device: Device, key: string): string {
  const values = ensureParamValues(device)
  return values[key] ?? ''
}

/* ---------- 校验 ---------- */

/** 校验单个参数的待下发值；通过时返回空字符串 */
export function validateParamValue(item: DeviceParamItem, raw: string): string {
  const value = raw.trim()
  if (!value) return item.required ? `请填写${item.name}` : ''

  if (item.type === 'select') {
    if (item.options && !item.options.includes(value)) return `${item.name}取值不在可选范围内`
    return ''
  }

  const num = Number(value)
  if (!Number.isFinite(num)) return `${item.name}须为数字`
  if (item.min !== undefined && num < item.min) return `${item.name}不得小于 ${item.min}${item.unit ?? ''}`
  if (item.max !== undefined && num > item.max) return `${item.name}不得大于 ${item.max}${item.unit ?? ''}`
  return ''
}

/** 批量校验整张参数表单；返回「参数标识 → 错误信息」，仅校验本期开放的参数项 */
export function validateParamForm(form: DeviceParamValues): Record<string, string> {
  const errors: Record<string, string> = {}
  activeItems().forEach((item) => {
    const message = validateParamValue(item, form[item.key] ?? '')
    if (message) errors[item.key] = message
  })
  return errors
}

/**
 * 待下发值中相对设备当前值真正发生变化的参数标识（仅本期开放的参数项）。
 * 数值型按精度归一化后比较，避免「1」与「1.00」被判为变更。
 */
export function changedParamKeys(device: Device, form: DeviceParamValues): string[] {
  const values = ensureParamValues(device)
  return activeItems()
    .filter((item) => normalize(item, form[item.key]) !== normalize(item, values[item.key]))
    .map((item) => item.key)
}

/* ---------- 抄读与下发 ---------- */

/** 【原型说明】模拟与设备交互的异步耗时 */
function delay(ms = 700) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms)
  })
}

function assertReachable(device: Device): string {
  if (device.accessStatus !== '已接入') return '设备尚未接入平台，无法读写参数'
  if (device.onlineStatus !== '在线') return '设备当前离线，参数读写无法送达，请确认设备通信状态后重试'
  return ''
}

/** 参数写入时同步登记一条 MQTT 下行日志，与设备控制保持同一套留痕口径 */
function logParamWrite(device: Device, item: DeviceParamItem, before: string, after: string) {
  pushMqttLog({
    device,
    direction: '下行',
    topic: 'down/param',
    event: '参数下发',
    result: '成功',
    payload: `{"key":"${item.key}","name":"${item.name}","before":"${before || '—'}","after":"${after}"}`,
    cost: 90 + Math.round(Math.random() * 240),
  })
}

/** 从设备抄读全部参数当前值 */
export async function readDeviceParams(device: Device): Promise<{ ok: boolean; message: string }> {
  const blocked = assertReachable(device)
  if (blocked) return { ok: false, message: blocked }

  await delay()

  // 【原型说明】用少量随机失败模拟现场弱网，便于验证失败提示
  if (Math.random() < 0.08) {
    return { ok: false, message: '参数抄读失败：设备响应超时（5s），请稍后重试' }
  }

  const preset = createPresetParamValues(device.imei, device.type)
  paramValues.set(device.id, preset)
  readFlags.set(device.id, true)

  pushMqttLog({
    device,
    direction: '上行',
    topic: 'up/param',
    event: '参数回读',
    result: '成功',
    payload: `{"keys":${JSON.stringify(activeItems().map((item) => item.key))}}`,
    cost: 140 + Math.round(Math.random() * 260),
  })

  return { ok: true, message: '已从设备抄读最新参数值' }
}

/** 向设备下发修改后的参数；逐项校验并写入 */
export async function writeDeviceParams(device: Device, form: DeviceParamValues): Promise<{ ok: boolean; message: string }> {
  const blocked = assertReachable(device)
  if (blocked) return { ok: false, message: blocked }

  const errors = validateParamForm(form)
  const firstError = Object.values(errors)[0]
  if (firstError) return { ok: false, message: firstError }

  const values = ensureParamValues(device)
  const changed = changedParamKeys(device, form)
    .map((key) => getParamItem(key))
    .filter((item): item is DeviceParamItem => item !== null)
  if (!changed.length) return { ok: true, message: '参数未发生变化，无需下发' }

  await delay()

  if (Math.random() < 0.1) {
    return { ok: false, message: '参数下发失败：设备响应超时（5s），请稍后重试' }
  }

  changed.forEach((item) => {
    const before = values[item.key] ?? ''
    const after = (form[item.key] ?? '').trim()
    values[item.key] = after
    logParamWrite(device, item, before, after)
  })
  paramValues.set(device.id, values)
  readFlags.set(device.id, true)

  return { ok: true, message: `已向设备下发 ${changed.length} 项参数修改` }
}

/** 数值型按精度归一化后再比较，避免「1」与「1.00」被判为变更 */
function normalize(item: DeviceParamItem, raw: string | undefined) {
  const value = (raw ?? '').trim()
  if (!value || item.type === 'select') return value
  const num = Number(value)
  return Number.isFinite(num) ? num.toFixed(item.precision ?? 0) : value
}

/** 【原型调试】重置参数缓存，便于反复验证「未抄读 → 抄读 → 下发」全流程 */
export function resetParamCache() {
  paramValues.clear()
  readFlags.clear()
}

/** 参数默认值，供新增设备时初始化 */
export { DEFAULT_PARAM_VALUES }
