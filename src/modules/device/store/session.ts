/**
 * 【原型说明】设备上下线记录的业务逻辑，仅用于原型交互验证。
 *
 * - 记录为事件流水：上线与离线各自独立成一条，不做成对聚合
 * - 仅保留最近 30 天，与 MQTT 通讯日志同一口径
 * - 概览统计（上线 / 掉线次数、最近掉线）由事件流水推导，不额外存储
 */

import { SESSION_KEEP_DAYS } from './constants'
import { sessions } from './storage'
import type { DeviceSessionEvent } from './types'

const DAY = 24 * 60 * 60 * 1000

/** 记录保留窗口的起始时间：最近 30 天 */
const keepFrom = () => Date.now() - SESSION_KEEP_DAYS * DAY

/**
 * 某台设备的上下线事件流水（按时间倒序）。
 * 这里对保留期做一次兜底过滤，保证读取结果不出现 30 天前的记录。
 */
export function deviceSessions(deviceId: string): DeviceSessionEvent[] {
  const from = keepFrom()
  return sessions.filter((item) => item.deviceId === deviceId && item.at >= from).sort((a, b) => b.at - a.at)
}

/**
 * 设备上下线概览：供卡片头部展示，口径为「保留期内全量事件」，
 * 不随列表上的查询条件变化，避免筛完后数字跳动造成误读。
 */
export function sessionSummary(deviceId: string) {
  const list = deviceSessions(deviceId)
  return {
    onlineCount: list.filter((item) => item.type === '上线').length,
    offlineCount: list.filter((item) => item.type === '离线').length,
    latestOfflineAt: list.find((item) => item.type === '离线')?.at ?? null,
    keepDays: SESSION_KEEP_DAYS,
  }
}
