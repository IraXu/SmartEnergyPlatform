/**
 * 【原型说明】账号标识的类型判断与规范化。
 * 手机号标识为「国际区号 + 本地号码」，区号参与唯一性判断。
 */

import { DEFAULT_COUNTRY_ISO2, findCountryByIso2, splitPhoneIdentifier } from '@/shared/mock/countryCode'
import { isEmail } from '@/shared/utils/validate'

/** 手机号国际区号规则：中国大陆为 11 位，其他国家和地区按 4-13 位、含区号不超过 15 位校验 */
const PHONE_RULES: Record<string, RegExp> = {
  CN: /^1[3-9]\d{9}$/,
}

/**
 * 手机号本地号码校验。
 * @param local 不含区号的本地号码（可含空格、连字符）
 * @param iso2 国家/地区代码，用于套用中国大陆等专属规则
 */
export function isPhoneLocal(local: string, iso2 = DEFAULT_COUNTRY_ISO2): boolean {
  const digits = local.replace(/\D/g, '')
  if (!digits) return false
  const rule = PHONE_RULES[iso2]
  if (rule) return rule.test(digits)
  const codeLength = findCountryByIso2(iso2).code.replace('+', '').length
  return digits.length >= 4 && digits.length + codeLength <= 15
}

/** 规范化手机号标识校验：格式为「国际区号 + 本地号码」且本地号码长度符合所属国家/地区规则 */
export function isCanonicalPhone(value: string): boolean {
  const trimmed = (value ?? '').trim().replace(/[\s-]/g, '')
  if (!/^\+\d{6,15}$/.test(trimmed)) return false
  const { iso2, local } = splitPhoneIdentifier(trimmed)
  return isPhoneLocal(local, iso2)
}

/** 统一账号标识：手机号去掉空格与连字符，邮箱去空格并转小写 */
export function normalizeIdentifier(value: string): string {
  const trimmed = (value ?? '').trim()
  if (isEmail(trimmed)) return trimmed.toLowerCase()
  return trimmed.replace(/[\s-]/g, '')
}

/** 识别账号类型：手机号需为「国际区号 + 本地号码」形式 */
export function detectAccountType(value: string): 'phone' | 'email' | null {
  const trimmed = (value ?? '').trim()
  if (isEmail(trimmed)) return 'email'
  if (isCanonicalPhone(trimmed)) return 'phone'
  return null
}
