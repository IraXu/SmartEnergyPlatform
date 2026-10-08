/**
 * 【原型说明】验证码管理：冷却、单日上限、下发与校验。
 * 冷却与上限均按账号标识独立计算，不同标识之间互不影响。
 */

import { CODE_COOLDOWN_MS, CODE_DAILY_LIMIT, CODE_TTL_MS } from './constants'
import { normalizeIdentifier } from './identifier'
import { codeMap, persistCodes } from './storage'
import type { CodeRecord } from './types'

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

function codeKey(identifier: string, scene: string): string {
  return `${scene}:${normalizeIdentifier(identifier)}`
}

export function getCodeRecord(identifier: string, scene: string): CodeRecord | undefined {
  return codeMap[codeKey(identifier, scene)]
}

/** 冷却剩余秒数，0 表示可发送 */
export function codeCooldownSeconds(identifier: string, scene: string): number {
  const record = getCodeRecord(identifier, scene)
  if (!record) return 0
  const elapsed = Date.now() - (record.expiresAt - CODE_TTL_MS)
  const remain = Math.ceil((CODE_COOLDOWN_MS - elapsed) / 1000)
  return remain > 0 ? remain : 0
}

export function dailySentCount(identifier: string, scene: string): number {
  const record = getCodeRecord(identifier, scene)
  if (!record) return 0
  return record.sentDate === today() ? record.sentCount : 0
}

/** 【原型演示】验证码固定为 6 位数字，且在页面提示中回显，便于走通流程 */
export function issueCode(identifier: string, scene: string): { ok: boolean; code?: string; message?: string } {
  const key = codeKey(identifier, scene)
  const existing = codeMap[key]
  const sentCount = existing && existing.sentDate === today() ? existing.sentCount : 0

  if (sentCount >= CODE_DAILY_LIMIT) {
    return { ok: false, message: '今日验证码获取次数已达上限，请明日再试' }
  }
  if (codeCooldownSeconds(identifier, scene) > 0) {
    return { ok: false, message: `请 ${codeCooldownSeconds(identifier, scene)} 秒后重新获取` }
  }

  const code = String(Math.floor(100000 + Math.random() * 900000))
  codeMap[key] = {
    scene,
    code,
    expiresAt: Date.now() + CODE_TTL_MS,
    sentCount: sentCount + 1,
    sentDate: today(),
  }
  persistCodes()
  return { ok: true, code }
}

export type CodeCheckResult = 'ok' | 'wrong' | 'expired'

export function verifyCode(identifier: string, scene: string, input: string): CodeCheckResult {
  const record = getCodeRecord(identifier, scene)
  if (!record) return 'expired'
  if (Date.now() > record.expiresAt) return 'expired'
  if (record.code !== input.trim()) return 'wrong'
  // 校验成功后立即消费，不可重复使用
  delete codeMap[codeKey(identifier, scene)]
  persistCodes()
  return 'ok'
}
