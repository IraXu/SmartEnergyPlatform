/**
 * 【原型说明】账号锁定管理：失败计数、锁定判定与解除。
 */

import { LOCK_AFTER_FAILS, LOCK_DURATION_MS } from './constants'
import { lockMap, persistLocks } from './storage'
import type { LockState } from './types'

export function getLock(identifier: string): LockState {
  if (!lockMap[identifier]) {
    lockMap[identifier] = { fails: 0, lockedUntil: 0 }
  }
  return lockMap[identifier]
}

export function isLocked(identifier: string): boolean {
  const lock = getLock(identifier)
  if (!lock.lockedUntil) return false
  if (Date.now() >= lock.lockedUntil) {
    lock.lockedUntil = 0
    lock.fails = 0
    persistLocks()
    return false
  }
  return true
}

export function remainLockMinutes(identifier: string): number {
  const lock = getLock(identifier)
  return Math.max(1, Math.ceil((lock.lockedUntil - Date.now()) / 60000))
}

/** 记录一次失败，返回本次是否触发锁定 */
export function recordFail(identifier: string): boolean {
  const lock = getLock(identifier)
  lock.fails += 1
  if (lock.fails >= LOCK_AFTER_FAILS) {
    lock.lockedUntil = Date.now() + LOCK_DURATION_MS
    // 锁定期限从触发本次失败的时间点起算，不因期间继续尝试而延长
    persistLocks()
    return true
  }
  persistLocks()
  return false
}

export function clearLock(identifier: string) {
  const lock = getLock(identifier)
  lock.fails = 0
  lock.lockedUntil = 0
  persistLocks()
}
