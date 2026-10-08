/**
 * 【原型说明】企业中心模块的演示数据容器与版本迁移，仅用于原型演示。
 * 数据存于 localStorage；正式实现应为服务端存储，此处仅用于交互验证。
 *
 * 【数据口径】企业档案按企业维度（orgId）存放一份，同企业下所有账号共享；
 * 企业联系人按「账号 × 企业归属」登记，落在 auth 模块的归属关系上，本模块不另存一份。
 */

import { reactive } from 'vue'
import { readJSON, removeKeys, writeJSON } from '@/shared/utils/storage'
import { accounts, session } from '@/modules/auth/store'
import { PRESET_PROFILE_EXTRAS } from '../mock/seed'
import {
  ENTERPRISE_ALL_KEYS,
  ENTERPRISE_DATA_VERSION,
  ENTERPRISE_LOGS_KEY,
  ENTERPRISE_PROFILES_KEY,
  ENTERPRISE_VERSION_KEY,
} from './constants'
import type { EnterpriseChangeLog, EnterpriseProfile } from './types'

/** 演示数据结构升级时清理旧数据，避免历史结构格式不一致 */
function migrateEnterpriseData() {
  if (localStorage.getItem(ENTERPRISE_VERSION_KEY) === ENTERPRISE_DATA_VERSION) return
  removeKeys(ENTERPRISE_ALL_KEYS)
  localStorage.setItem(ENTERPRISE_VERSION_KEY, ENTERPRISE_DATA_VERSION)
}

migrateEnterpriseData()

/** 按企业基础信息建档；注册未采集的资质与标识字段由预置补充数据回填 */
export function buildProfile(
  orgId: string,
  orgName: string,
  industry: string,
  region: string,
): EnterpriseProfile {
  return {
    orgId,
    name: orgName,
    industry,
    region,
    logo: '',
    creditCode: '',
    registeredAddress: '',
    businessLicense: '',
    licenseFileName: '',
    updatedAt: Date.now(),
    ...(PRESET_PROFILE_EXTRAS[orgId] ?? {}),
  }
}

/** 预置档案：为演示账号归属的全部企业建档，保证切换企业与选择登录企业时均有档案可读 */
export function presetProfiles(): EnterpriseProfile[] {
  const seen = new Set<string>()
  const list: EnterpriseProfile[] = []
  accounts.forEach((account) => {
    account.memberships.forEach((membership) => {
      if (seen.has(membership.orgId)) return
      seen.add(membership.orgId)
      list.push(buildProfile(membership.orgId, membership.orgName, membership.industry, membership.region))
    })
  })
  const current = session.current
  if (current?.orgId && !seen.has(current.orgId)) {
    list.push(buildProfile(current.orgId, current.orgName, current.industry, current.region))
  }
  return list
}

export const enterpriseProfiles = reactive<EnterpriseProfile[]>(
  readJSON(ENTERPRISE_PROFILES_KEY, presetProfiles()),
)
export const enterpriseLogs = reactive<EnterpriseChangeLog[]>(readJSON(ENTERPRISE_LOGS_KEY, []))

/** 本地存储缺失档案时按账号归属补齐，保证「选择登录企业」与顶栏切换企业处可读到企业 Logo */
function ensurePresetProfiles() {
  presetProfiles().forEach((profile) => {
    if (!enterpriseProfiles.some((item) => item.orgId === profile.orgId)) {
      enterpriseProfiles.push(profile)
    }
  })
}

ensurePresetProfiles()

export function persistProfiles() {
  writeJSON(ENTERPRISE_PROFILES_KEY, enterpriseProfiles)
}

export function persistEnterpriseLogs() {
  writeJSON(ENTERPRISE_LOGS_KEY, enterpriseLogs)
}
