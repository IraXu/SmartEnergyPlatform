/**
 * 【原型说明】企业中心模块的统一出口，仅用于原型交互验证，非生产代码。
 * 企业档案、企业 Logo、企业联系人与企业资质信息的维护规则对齐
 * 《产品需求文档-企业中心》v1.0 与《产品交互设计文档-企业中心》v1.0。
 */

import { removeKeys } from '@/shared/utils/storage'
import { ENTERPRISE_ALL_KEYS } from './constants'
import { buildProfile, enterpriseLogs, enterpriseProfiles, persistProfiles } from './storage'
import { accounts } from '@/modules/auth/store'

export * from './constants'
export * from './types'
export * from './enterprise'

export { enterpriseLogs, enterpriseProfiles } from './storage'
export { persistEnterpriseLogs, persistProfiles } from './storage'

/** 【原型调试】重置企业中心演示数据，便于反复验证各状态与异常分支 */
export function resetEnterpriseData() {
  removeKeys(ENTERPRISE_ALL_KEYS)
  const seen = new Set<string>()
  const rebuilt = [] as typeof enterpriseProfiles
  accounts.forEach((account) => {
    account.memberships.forEach((membership) => {
      if (seen.has(membership.orgId)) return
      seen.add(membership.orgId)
      rebuilt.push(
        buildProfile(membership.orgId, membership.orgName, membership.industry, membership.region),
      )
    })
  })
  enterpriseProfiles.splice(0, enterpriseProfiles.length, ...rebuilt)
  enterpriseLogs.splice(0, enterpriseLogs.length)
  persistProfiles()
}
