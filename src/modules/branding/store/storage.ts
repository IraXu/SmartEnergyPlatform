/**
 * 【原型说明】品牌设置的 localStorage 持久化，仅用于原型演示，非生产存储方案。
 */

import { readJSON, removeKeys, writeJSON } from '@/shared/utils/storage'
import { BRANDING_DATA_VERSION, BRANDING_OVERRIDES_KEY, BRANDING_VERSION_KEY } from './constants'
import type { BrandingOverrideMap } from './types'

// 演示数据结构版本变化时清理旧数据，避免历史字段影响新逻辑
// 注意：版本号通过 writeJSON 写入，读取时需按 JSON 解析，否则会因引号差异误清空数据
const storedVersion = readJSON<string>(BRANDING_VERSION_KEY, '')
if (storedVersion !== BRANDING_DATA_VERSION) {
  removeKeys([BRANDING_OVERRIDES_KEY])
  writeJSON(BRANDING_VERSION_KEY, BRANDING_DATA_VERSION)
}

export const brandingOverrides = readJSON<BrandingOverrideMap>(BRANDING_OVERRIDES_KEY, {})

export function persistBrandingOverrides() {
  writeJSON(BRANDING_OVERRIDES_KEY, brandingOverrides)
}

export function clearBrandingOverrides() {
  Object.keys(brandingOverrides).forEach((key) => delete brandingOverrides[key])
  persistBrandingOverrides()
}
