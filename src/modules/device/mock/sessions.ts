/**
 * 【原型说明】设备上下线记录的演示数据，仅用于原型交互验证。
 * 按「最近 30 天」生成，与 MQTT 通讯日志同口径：同一台设备每次生成一致，便于反复验证。
 *
 * 【记录形态】上线与离线各自独立成一条事件流水，不做「上线 → 离线」成对聚合：
 * 更贴近现场日志的原始形态，便于逐条排查「某时刻发生了什么」；
 * 概览统计（上线 / 掉线次数等）由 store 侧从事件推导。
 *
 * 【生成方式】从当前时刻向前倒推，而非从 30 天前向后铺：
 * 这样能保证末尾事件一定贴合设备当前状态（在线设备末尾为「上线」、离线设备末尾为「离线」），
 * 且截到条数上限时丢掉的是最早的历史记录，不会破坏当前状态。
 */

import type { Device, DeviceSessionEvent } from '../store/types'

const MINUTE = 60 * 1000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

/** 【原型说明】演示记录覆盖的天数，与 MQTT 日志「最近 30 天」保持一致 */
const KEEP_DAYS = 30

/** 离线设备的「最近一次掉线」回退到至少 2 天前，体现「已离线一段时间」 */
const OFFLINE_GAP = 2 * DAY

/**
 * 【原型说明】单台设备的演示记录条数上限。
 * 默认每页 10 条，取 20 条即约 2 页，足够验证分页与查询，又不会让演示数据过长。
 * 正式实现中记录由通讯侧持续写入，不做此限制。
 */
const EVENT_LIMIT = 20

/** 离线原因样本：贴近现场断电、弱网与平台侧主动断开的表现 */
const OFFLINE_REASONS = [
  '设备主动断开（正常关机）',
  '现场断电，设备失联',
  '信号强度不足，连接中断',
  '心跳超时，平台判定离线',
  '设备重启',
]

/** 上线说明样本：区分正常上电与异常恢复，便于排查 */
const ONLINE_DETAILS = ['设备上电，建立连接', '信号恢复，重新接入平台', '心跳恢复正常，连接重建', '设备重启后重新接入']

/** 稳定伪随机：同一设备每次生成的记录一致 */
function seeded(seed: number) {
  let value = seed % 2147483647
  if (value <= 0) value += 2147483646
  return () => {
    value = (value * 16807) % 2147483647
    return (value - 1) / 2147483646
  }
}

/** 设备识别码 → 稳定种子（与 MQTT 日志使用不同乘数以拉开数据分布） */
function seedOf(text: string) {
  return text.split('').reduce((total, char) => total + char.charCodeAt(0), 13)
}

/** 在 [min, max] 内取一个稳定伪随机时长 */
const pick = (random: () => number, range: [number, number]) =>
  Math.floor(range[0] + random() * (range[1] - range[0]))

/** 一次会话（上线 → 离线）；offlineAt 为 null 表示该次会话仍在进行 */
interface RawSession {
  onlineAt: number
  offlineAt: number | null
}

/**
 * 【原型说明】为单台设备生成最近 30 天的上下线事件流水（按时间倒序）。
 * 仅「已接入」设备有上下线记录：待接入设备从未与平台建连。
 */
export function createPresetSessions(devices: Device[]): DeviceSessionEvent[] {
  const now = Date.now()
  const windowStart = now - KEEP_DAYS * DAY
  const events: DeviceSessionEvent[] = []

  devices
    .filter((device) => device.accessStatus === '已接入' && device.imei)
    .forEach((device) => {
      const random = seeded(seedOf(device.imei))
      const online = device.onlineStatus === '在线'
      // 约三分之一的设备为弱网高频重连，其余按日常节奏上下线
      const flapping = random() < 0.34
      // 高频重连：相邻两次上线间隔 2～8 小时；稳定设备：2～4 天
      const gapRange: [number, number] = flapping ? [2 * HOUR, 8 * HOUR] : [2 * DAY, 4 * DAY]
      // 单次在线时长：高频重连设备较短，稳定设备较长
      const onlineRange: [number, number] = flapping ? [10 * MINUTE, 3 * HOUR] : [1 * HOUR, 20 * HOUR]

      /* 倒序生成会话（最新一段在前） */
      const sessions: RawSession[] = [buildLatest(now, online, random, onlineRange)]
      // 在线设备的末段会话只贡献 1 条事件，离线设备贡献 2 条
      let count = online ? 1 : 2

      // 从末段会话的上线时刻继续向前推，直至用满条数上限或超出保留期
      let cursor = sessions[0].onlineAt - pick(random, gapRange)
      while (count + 2 <= EVENT_LIMIT) {
        const start = cursor - pick(random, onlineRange)
        if (start < windowStart) break
        sessions.push({ onlineAt: start, offlineAt: cursor })
        count += 2
        cursor = start - pick(random, gapRange)
      }

      /* 展开为事件流水：会话翻转为时间正序，每段内「上线 → 离线」 */
      sessions
        .slice()
        .reverse()
        .forEach((item) => {
          events.push({
            id: `SESS-${device.id}-上线-${item.onlineAt}`,
            deviceId: device.id,
            at: item.onlineAt,
            type: '上线',
            detail: ONLINE_DETAILS[Math.floor(random() * ONLINE_DETAILS.length)],
          })
          if (item.offlineAt !== null) {
            events.push({
              id: `SESS-${device.id}-离线-${item.offlineAt}`,
              deviceId: device.id,
              at: item.offlineAt,
              type: '离线',
              detail: OFFLINE_REASONS[Math.floor(random() * OFFLINE_REASONS.length)],
            })
          }
        })
    })

  return events.sort((a, b) => b.at - a.at)
}

/**
 * 末段会话：贴合设备当前状态。
 * - 在线设备：会话进行中（offlineAt 为 null），代表此刻仍与平台保持连接
 * - 离线设备：会话已结束，且结束于至少 2 天前
 */
function buildLatest(
  now: number,
  online: boolean,
  random: () => number,
  onlineRange: [number, number],
): RawSession {
  if (online) {
    return { onlineAt: now - pick(random, onlineRange), offlineAt: null }
  }
  const offlineAt = now - OFFLINE_GAP - Math.floor(random() * 2 * DAY)
  return { onlineAt: offlineAt - pick(random, onlineRange), offlineAt }
}
