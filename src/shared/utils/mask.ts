/**
 * 【原型说明】手机号与邮箱的脱敏展示工具，格式约定见《项目术语表》命名约定章节。
 */

import { splitPhoneIdentifier } from '@/shared/mock/countryCode'
import { isEmail } from '@/shared/utils/validate'

/**
 * 手机号脱敏：保留国际区号与号码首尾，中间以 * 代替，且不改变号码位数。
 * 例：+86 13800138000 → +86 138****8000
 */
export function maskPhone(value: string): string {
  const digits = (value ?? '').replace(/\D/g, '')
  if (!digits) return value
  const { countryCode } = splitPhoneIdentifier(`+${digits}`)
  const local = digits.slice(countryCode.replace('+', '').length)
  if (!local) return countryCode
  if (local.length >= 8) {
    return `${countryCode} ${local.slice(0, 3)}${'*'.repeat(local.length - 7)}${local.slice(-4)}`
  }
  if (local.length >= 5) {
    return `${countryCode} ${local.slice(0, 2)}${'*'.repeat(local.length - 4)}${local.slice(-2)}`
  }
  return `${countryCode} ${'*'.repeat(Math.max(local.length - 1, 1))}${local.slice(-1)}`
}

export function maskEmail(value: string): string {
  const [name, domain] = value.split('@')
  if (!domain) return value
  const visible = name.slice(0, 2)
  return `${visible}${'*'.repeat(Math.max(name.length - 2, 1))}@${domain}`
}

export function maskIdentifier(value: string): string {
  return isEmail(value) ? maskEmail(value) : maskPhone(value)
}
