/** 密码强度与合规校验规则，对齐 PRD F-03 与交互设计文档 4.6.4（密码强度组件） */
export type PasswordStrength = 'weak' | 'medium' | 'strong'

export interface PasswordCheckResult {
  strength: PasswordStrength
  strengthText: string
  percent: number
  /** 是否满足可提交的最低要求（中及以上） */
  valid: boolean
  /** 首个不满足的原因，用于提示 */
  reason?: string
}

export const PASSWORD_MIN_LENGTH = 8
export const PASSWORD_MAX_LENGTH = 20

export function checkPassword(password: string, identifier = ''): PasswordCheckResult {
  const value = password ?? ''
  const hasLetter = /[a-zA-Z]/.test(value)
  const hasDigit = /\d/.test(value)
  const hasSymbol = /[^a-zA-Z0-9]/.test(value)
  const lengthOk = value.length >= PASSWORD_MIN_LENGTH && value.length <= PASSWORD_MAX_LENGTH

  if (!value) {
    return { strength: 'weak', strengthText: '弱', percent: 0, valid: false, reason: '密码长度需为 8-20 位' }
  }
  if (!lengthOk) {
    return { strength: 'weak', strengthText: '弱', percent: 20, valid: false, reason: '密码长度需为 8-20 位' }
  }
  if (!hasLetter || !hasDigit) {
    return { strength: 'weak', strengthText: '弱', percent: 35, valid: false, reason: '密码需同时包含字母和数字' }
  }
  if (identifier && isSimilarToIdentifier(value, identifier)) {
    return {
      strength: 'weak',
      strengthText: '弱',
      percent: 35,
      valid: false,
      reason: '密码不能与手机号或邮箱相同或过于相似',
    }
  }
  if (hasSymbol || value.length >= 12) {
    return { strength: 'strong', strengthText: '强', percent: 100, valid: true }
  }
  return { strength: 'medium', strengthText: '中', percent: 65, valid: true }
}

function isSimilarToIdentifier(password: string, identifier: string): boolean {
  const lowerPassword = password.toLowerCase()
  const lowerIdentifier = identifier.toLowerCase()
  if (lowerPassword === lowerIdentifier) return true
  // 账号的本地部分（邮箱 @ 前）或手机号整体被包含时，视为过于相似
  const core = lowerIdentifier.includes('@') ? lowerIdentifier.split('@')[0] : lowerIdentifier
  return core.length >= 6 && lowerPassword.includes(core)
}

export const passwordStrengthColor: Record<PasswordStrength, string> = {
  weak: '#ff4d4f',
  medium: '#faad14',
  strong: '#52c41a',
}
