/**
 * 【原型说明】设备控制与 MQTT 通讯日志的业务逻辑，仅用于原型交互验证。
 * 业务规则对齐 PRD F-DEV-14（MQTT 通讯日志，保留最近 30 天）与 F-DEV-15（设备控制）。
 *
 * - 设备控制指令：校时 / 抄表 / 合闸 / 分闸 / 重连；全部需二次确认后下发
 * - 指令下发结果同步写入 MQTT 通讯日志（下行记录），形成「操作 → 日志」的闭环
 * - 日志只保留最近 30 天，超出部分自动删除
 */

import { MQTT_LOG_KEEP_DAYS } from './constants'
import { mqttLogs, persistDevices, persistMqttLogs } from './storage'
import type { CommandResult, Device, DeviceCommand, DeviceCommandItem, MqttDirection, MqttResult } from './types'

/* ---------- 指令字典 ---------- */

/**
 * 【原型说明】7 个设备控制操作，按「读取类 / 开关类 / 通讯类 / 清零类」分组。
 * 「分闸 / 合闸」直接影响现场供电，「电量清零 / 设备事件清零」影响计量数据或设备内记录，
 * 均标记为 danger，确认弹窗中以警示样式突出风险。
 * 每个操作对应独立的按钮级权限点（permission），由界面据此决定是否可点击。
 */
export const DEVICE_COMMANDS: DeviceCommandItem[] = [
  {
    name: '校时',
    group: '读取类',
    desc: '同步设备时钟与平台服务器时间',
    risk: 'normal',
    confirmText: '将向设备下发平台服务器时间，用于校准设备时钟。请确认设备在线，指令将在设备下次通讯时执行。',
    permission: 'device:ledger:control:timesync',
  },
  {
    name: '抄表',
    group: '读取类',
    desc: '立即读取一次设备的计量数据',
    risk: 'normal',
    confirmText: '将向设备下发即时抄表指令，读回的电量、电压、电流等数据会更新到「设备专属数据」。',
    permission: 'device:ledger:control:meterread',
  },
  {
    name: '合闸',
    group: '开关类',
    desc: '远程合闸，恢复现场供电',
    risk: 'danger',
    confirmText: '合闸将恢复该设备回路的供电，可能造成现场设备突然启动。请务必确认现场无人检修、具备送电条件。',
    permission: 'device:ledger:control:switchon',
  },
  {
    name: '分闸',
    group: '开关类',
    desc: '远程分闸，切断现场供电',
    risk: 'danger',
    confirmText: '分闸将立即切断该设备回路的供电，可能造成生产中断或数据丢失。请务必确认已获得停电许可。',
    permission: 'device:ledger:control:switchoff',
  },
  {
    name: '重连',
    group: '通讯类',
    desc: '触发设备重新与平台建立连接',
    risk: 'normal',
    confirmText: '将通知设备断开当前连接并重新接入平台，用于处理假在线、数据不上报等异常。',
    permission: 'device:ledger:control:reconnect',
  },
  {
    name: '电量清零',
    group: '清零类',
    desc: '重置设备内的累计电量读数',
    risk: 'danger',
    confirmText:
      '电量清零会重置设备内的累计电量读数，影响后续用电统计；历史数据按分段累计处理，读数不闭合时将标记「统计不完整」。该操作不可撤销，请确认设备已完成更换或调试。',
    permission: 'device:ledger:control:powerclear',
  },
  {
    name: '设备事件清零',
    group: '清零类',
    desc: '重置设备内的事件记录',
    risk: 'danger',
    confirmText:
      '设备事件清零会重置设备内的事件记录，不影响云端告警、MQTT 通讯日志与审计日志。该操作不可撤销，请确认现场已完成事件排查。',
    permission: 'device:ledger:control:eventclear',
  },
]

/** 是否为零清类操作 */
export const isClearCommand = (command: DeviceCommand) =>
  command === '电量清零' || command === '设备事件清零'

export const getCommandItem = (name: DeviceCommand) => DEVICE_COMMANDS.find((item) => item.name === name) ?? null

/* ---------- MQTT 通讯日志 ---------- */

const DAY = 24 * 60 * 60 * 1000

/** 日志保留窗口的起始时间：最近 30 天的零点 */
function keepFrom() {
  return Date.now() - MQTT_LOG_KEEP_DAYS * DAY
}

/**
 * 清理超出保留期的日志（PRD F-DEV-14）。
 * 由 store 初始化与指令下发两个时机调用，不在渲染过程中触发，
 * 避免在 computed 求值期间写入响应式数据。
 */
export function pruneMqttLogs() {
  const from = keepFrom()
  let removed = 0
  for (let index = mqttLogs.length - 1; index >= 0; index -= 1) {
    if (mqttLogs[index].at < from) {
      mqttLogs.splice(index, 1)
      removed += 1
    }
  }
  if (removed) persistMqttLogs()
  return removed
}

/**
 * 某台设备的 MQTT 通讯日志（按时间倒序）。
 * 这里对保留期做一次兜底过滤，保证读取结果不会出现 30 天前的记录；
 * 实际删除由 `pruneMqttLogs` 负责。
 */
export function deviceMqttLogs(deviceId: string) {
  const from = keepFrom()
  return mqttLogs
    .filter((log) => log.deviceId === deviceId && log.at >= from)
    .sort((a, b) => b.at - a.at)
}

/** 当前设备的日志总数与保留期内的最早一条，用于抽屉概览提示 */
export function mqttLogSummary(deviceId: string) {
  const list = deviceMqttLogs(deviceId)
  return {
    total: list.length,
    failed: list.filter((log) => log.result === '失败').length,
    earliestAt: list.length ? list[list.length - 1].at : null,
    keepDays: MQTT_LOG_KEEP_DAYS,
  }
}

/**
 * 写入一条 MQTT 通讯日志。
 * 供设备控制与设备参数两个入口共用，保证所有下行操作都留下同一套留痕。
 */
export function pushMqttLog(entry: {
  device: Device
  direction: MqttDirection
  topic: string
  event: string
  result: MqttResult
  payload: string
  cost: number | null
  error?: string
}) {
  mqttLogs.unshift({
    id: `MQTT-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    deviceId: entry.device.id,
    at: Date.now(),
    direction: entry.direction,
    topic: `/esa/device/${entry.device.imei}/${entry.topic}`,
    event: entry.event,
    result: entry.result,
    payload: entry.payload,
    cost: entry.cost,
    error: entry.error ?? '',
  })
  pruneMqttLogs()
  persistMqttLogs()
}

/* ---------- 设备控制 ---------- */

/** 指令 → 下行主题后缀，用于生成通讯日志中的主题 */
const COMMAND_TOPIC: Record<DeviceCommand, string> = {
  校时: 'down/time-sync',
  抄表: 'down/read-meter',
  合闸: 'down/switch',
  分闸: 'down/switch',
  重连: 'down/reconnect',
  电量清零: 'down/power-clear',
  设备事件清零: 'down/event-clear',
}

/** 指令 → 下行报文内容 */
const COMMAND_PAYLOAD: Record<DeviceCommand, string> = {
  校时: `{"serverTime":"${new Date().toISOString()}","timezone":"UTC+8"}`,
  抄表: '{"items":["energyTotal","voltage","current","power"]}',
  合闸: '{"action":"close"}',
  分闸: '{"action":"open"}',
  重连: '{"action":"reconnect","delay":5}',
  电量清零: '{"action":"power-clear"}',
  设备事件清零: '{"action":"event-clear","scope":"device-local-events"}',
}

/** 【原型说明】模拟指令下发的异步耗时 */
function delay(ms = 900) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms)
  })
}

/** 读取设备当前累计电量读数，用于清零前后留痕 */
function readTotalEnergy(device: Device): number {
  const raw = device.metrics['总有功电量'] ?? ''
  const parsed = Number(raw.replace(/[^0-9.-]/g, ''))
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0
}

/**
 * 执行清零操作（F-DEV-20）。
 * 过程区分「已提交 / 执行成功 / 执行失败 / 结果未知」：
 * 提交成功不代表设备执行成功，无回执时按「结果未知」反馈，不展示为成功。
 * 电量清零成功后同步把设备当前「总有功电量」置零，便于在「设备专属数据」中核对。
 */
async function runClearCommand(
  device: Device,
  command: '电量清零' | '设备事件清零',
): Promise<CommandResult> {
  const before = readTotalEnergy(device)
  const action = command === '电量清零' ? 'power-clear' : 'event-clear'
  await delay(1200)

  // 【原型说明】演示概率：78% 执行成功、12% 执行失败、10% 未收到回执（结果未知）
  const roll = Math.random()
  const basePayload = {
    action,
    before: `${before.toFixed(2)} kWh`,
    at: new Date().toISOString(),
  }

  if (roll < 0.1) {
    pushMqttLog({
      device,
      direction: '下行',
      topic: COMMAND_TOPIC[command],
      event: command,
      result: '失败',
      payload: JSON.stringify({ ...basePayload, state: '结果未知' }),
      cost: null,
      error: '未收到设备回执（结果未知）',
    })
    return {
      ok: false,
      state: '结果未知',
      message: '已提交，设备执行结果未知，请稍后查看日志或重新查询设备读数',
    }
  }

  if (roll < 0.22) {
    pushMqttLog({
      device,
      direction: '下行',
      topic: COMMAND_TOPIC[command],
      event: command,
      result: '失败',
      payload: JSON.stringify({ ...basePayload, state: '执行失败' }),
      cost: null,
      error: '设备执行失败：清零指令被拒绝',
    })
    return {
      ok: false,
      state: '执行失败',
      message: `「${command}」执行失败：设备执行失败，清零指令被拒绝`,
    }
  }

  const cost = 180 + Math.round(Math.random() * 320)
  if (command === '电量清零') {
    device.metrics['总有功电量'] = '0.00'
    persistDevices()
  }
  pushMqttLog({
    device,
    direction: '下行',
    topic: COMMAND_TOPIC[command],
    event: command,
    result: '成功',
    payload: JSON.stringify({
      ...basePayload,
      after: command === '电量清零' ? '0.00 kWh' : '设备内事件已重置',
      state: '执行成功',
    }),
    cost,
  })
  return {
    ok: true,
    state: '执行成功',
    message:
      command === '电量清零'
        ? `「电量清零」执行成功，清零前读数 ${before.toFixed(2)} kWh，清零后 0.00 kWh`
        : '「设备事件清零」执行成功，设备内事件记录已重置；云端告警与日志不受影响',
  }
}

/**
 * 下发改备控制指令（F-DEV-15）。
 * 设备必须在线才能接收指令；其余情况直接返回失败并说明原因，
 * 不产生通讯日志（未建连即无通讯发生）。
 */
export async function sendDeviceCommand(device: Device, command: DeviceCommand): Promise<CommandResult> {
  if (device.onlineStatus !== '在线') {
    return { ok: false, message: '设备当前离线，指令无法送达，请确认设备通信状态后重试' }
  }

  // 清零类操作单独走四态流程（F-DEV-20）
  if (isClearCommand(command)) {
    return runClearCommand(device, command as '电量清零' | '设备事件清零')
  }

  await delay()

  // 【原型说明】用少量随机失败模拟现场弱网与服务端超时，便于验证失败提示
  const failed = Math.random() < 0.1
  if (failed) {
    const error = '设备响应超时（5s）'
    pushMqttLog({
      device,
      direction: '下行',
      topic: COMMAND_TOPIC[command],
      event: command,
      result: '失败',
      payload: '—',
      cost: null,
      error,
    })
    return { ok: false, message: `「${command}」下发失败：${error}` }
  }

  const cost = 80 + Math.round(Math.random() * 260)
  pushMqttLog({
    device,
    direction: '下行',
    topic: COMMAND_TOPIC[command],
    event: command,
    result: '成功',
    payload: COMMAND_PAYLOAD[command],
    cost,
  })

  // 抄表成功会带回一次即时数据，模拟设备随后的一次上行
  if (command === '抄表') {
    pushMqttLog({
      device,
      direction: '上行',
      topic: 'up/data',
      event: '数据上报',
      result: '成功',
      payload: '{"trigger":"read-meter","energyTotal":"已更新","voltage":"已更新"}',
      cost: 120 + Math.round(Math.random() * 200),
    })
  }

  return { ok: true, message: `「${command}」指令已下发，设备已响应（${cost}ms）` }
}
