/**
 * 【原型说明】MQTT 通讯日志的演示数据，仅用于原型交互验证。
 * 按「最近 30 天」生成，贴近真实设备的上下行通讯节奏：
 * 上行以数据上报、心跳为主，下行以平台下发的控制与参数指令为主，并含少量失败样本。
 * 不涉及真实报文、真实主题命名规范或接口设计。
 */

import type { Device, MqttLog, MqttResult } from '../store/types'

const MINUTE = 60 * 1000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

/** 【原型说明】演示日志覆盖的天数，与「仅保留最近 30 天」的业务规则一致 */
const KEEP_DAYS = 30

/** 演示主题前缀与设备识别码拼接，贴近「一设备一主题」的推荐实践 */
const topicOf = (imei: string, suffix: string) => `/esa/device/${imei}/${suffix}`

/** 上行事件：采集数据上报与心跳 */
const UPLOAD_EVENTS = [
  { event: '数据上报', topic: 'up/data', payload: '{"voltage":220.4,"current":186.2,"power":41.02}' },
  { event: '心跳', topic: 'up/heartbeat', payload: '{"rssi":-68,"csq":21}' },
  { event: '数据上报', topic: 'up/data', payload: '{"energyTotal":128430.6,"energyForward":128430.6}' },
  { event: '参数回读', topic: 'up/param', payload: '{"reportInterval":300,"meterAddr":"000000000001"}' },
]

/** 下行事件：平台下发的控制与参数指令 */
const DOWNLINK_EVENTS = [
  { event: '校时', topic: 'down/time-sync', payload: '{"serverTime":"2026-09-28 10:20:00","timezone":"UTC+8"}' },
  { event: '抄表', topic: 'down/read-meter', payload: '{"items":["energyTotal","voltage","current"]}' },
  { event: '合闸', topic: 'down/switch', payload: '{"action":"close","reason":"远程复电"}' },
  { event: '分闸', topic: 'down/switch', payload: '{"action":"open","reason":"欠费停电"}' },
  { event: '重连', topic: 'down/reconnect', payload: '{"action":"reconnect","delay":5}' },
  { event: '参数下发', topic: 'down/param', payload: '{"reportInterval":600,"freezeTime":"00:00"}' },
]

/** 失败原因样本：贴近弱信号、超时与设备离线的现场表现 */
const FAIL_REASONS = ['设备响应超时（5s）', '信号强度不足，上行重传失败', '设备离线，指令下发失败', '报文校验失败']

/** 稳定伪随机：同一设备每次生成的日志一致，便于反复验证同一份数据 */
function seeded(seed: number) {
  let value = seed % 2147483647
  if (value <= 0) value += 2147483646
  return () => {
    value = (value * 16807) % 2147483647
    return (value - 1) / 2147483646
  }
}

/** 设备识别码 → 稳定种子 */
function seedOf(text: string) {
  return text.split('').reduce((total, char) => total + char.charCodeAt(0), 7)
}

/**
 * 【原型说明】为单台设备生成最近 30 天的 MQTT 通讯日志。
 * 仅「已接入」设备有通讯记录：待接入设备未与平台建连，日志为空。
 */
export function createPresetMqttLogs(devices: Device[]): MqttLog[] {
  const now = Date.now()
  const logs: MqttLog[] = []

  devices
    .filter((device) => device.accessStatus === '已接入' && device.imei)
    .forEach((device) => {
      const random = seeded(seedOf(device.imei))
      // 每台设备每日 3～6 条，30 天累计约 100～180 条，兼顾真实性又不至于过于冗长
      for (let day = KEEP_DAYS - 1; day >= 0; day -= 1) {
        const count = 3 + Math.floor(random() * 4)
        // 离线设备（如 2 号车间动力表）近两天无通讯，体现「离线即无日志」的现场语义
        if (device.onlineStatus === '离线' && day < 2) continue

        for (let index = 0; index < count; index += 1) {
          // 下行指令占比约三成，避免日志被控制指令淹没
          const isDownlink = random() < 0.3
          const pool = isDownlink ? DOWNLINK_EVENTS : UPLOAD_EVENTS
          const picked = pool[Math.floor(random() * pool.length)]
          const failed = random() < 0.08
          const result: MqttResult = failed ? '失败' : '成功'
          const at = now - day * DAY - Math.floor(random() * 20) * HOUR - Math.floor(random() * 60) * MINUTE

          logs.push({
            id: `MQTT-${device.id}-${day}-${index}`,
            deviceId: device.id,
            at,
            direction: isDownlink ? '下行' : '上行',
            topic: topicOf(device.imei, picked.topic),
            event: picked.event,
            result,
            payload: failed ? '—' : picked.payload,
            cost: failed ? null : 60 + Math.floor(random() * 240),
            error: failed ? FAIL_REASONS[Math.floor(random() * FAIL_REASONS.length)] : '',
          })
        }
      }
    })

  return logs.sort((a, b) => b.at - a.at)
}
