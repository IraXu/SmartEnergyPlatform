/**
 * 【原型说明】品牌设置模块的统一出口，仅用于原型交互验证，非生产代码。
 * 业务规则对齐《产品需求文档-品牌设置》v1.0：
 * - 平台默认 + 企业覆盖：企业未配置的分组继承平台默认品牌；
 * - 三组独立覆盖（浏览器标签 / 登录页 / 主界面框架），保存即发布；
 * - 恢复平台默认即清除该分组覆盖；
 * - 标题按纯文本处理、去除首尾空格；图片仅支持 JPG / PNG。
 */

import { ref } from 'vue'
import { session } from '@/modules/auth/store'
import { loadImageFile } from '@/modules/enterprise/store'
import { maskIdentifier } from '@/shared/utils/mask'
import {
  BRANDING_LOGIN_ORG_KEY,
  BRAND_IMAGE_RULES,
  BRAND_LOGO_CROP_SIZE,
  HEADER_TITLE_MAX,
  HEADER_TITLE_MIN,
  LOGIN_BRAND_NAME_MAX,
  LOGIN_BRAND_NAME_MIN,
  LOGIN_POINT_MAX,
  LOGIN_SUBTITLE_MAX,
  LOGIN_TITLE_MAX,
  LOGIN_TITLE_MIN,
  PLATFORM_BRANDING,
  TAB_TITLE_MAX,
  TAB_TITLE_MIN,
  type BrandImageKind,
} from './constants'
import { brandingOverrides, clearBrandingOverrides, persistBrandingOverrides } from './storage'
import type {
  BrandingConfig,
  BrandingOverride,
  BrandingSection,
  BrandingSource,
  FrameBrandValues,
  LoginBrandValues,
  TabBrandValues,
} from './types'

export * from './types'
export * from './constants'

/** 品牌配置版本号：保存 / 恢复后自增，供顶栏、登录页与文档标题响应式刷新 */
export const brandingVersion = ref(0)

/* ---------- 基础读取 ---------- */

function currentOrgId() {
  return session.current?.orgId ?? ''
}

/** 当前操作人展示名，用于品牌配置的最近操作人 */
function currentOperator() {
  const current = session.current
  if (!current) return '未知账号'
  return current.contactName || maskIdentifier(current.identifier)
}

/** 平台默认品牌（副本，避免调用方误改内置值） */
export function platformBranding(): BrandingConfig {
  return { ...PLATFORM_BRANDING }
}

export function overrideOf(orgId: string): BrandingOverride | null {
  return brandingOverrides[orgId] ?? null
}

/** 按企业取生效品牌：未覆盖的分组逐组回退平台默认 */
export function effectiveBranding(orgId?: string): BrandingConfig {
  const org = orgId ?? currentOrgId()
  const override = org ? overrideOf(org) : null
  return {
    ...PLATFORM_BRANDING,
    ...(override?.tab ?? {}),
    ...(override?.login ?? {}),
    ...(override?.frame ?? {}),
  }
}

/** 当前登录企业的生效品牌 */
export function currentBranding(): BrandingConfig {
  return effectiveBranding(currentOrgId())
}

/**
 * 登录页 / 认证页使用的品牌（PRD 6.2 / Q-BRD-02 已确认规则）：
 * 已进入企业时取当前企业；未进入企业时取「选择登录企业」页选中的企业；
 * 尚未选择企业时回退平台默认品牌。
 */
export function loginBranding(): BrandingConfig {
  return effectiveBranding(currentOrgId() || loginBrandOrgId())
}

/** 「选择登录企业」页选中企业时立即切换到该企业品牌，仅本次登录流程有效 */
export function setLoginBrandOrg(orgId: string) {
  if (!orgId) return
  sessionStorage.setItem(BRANDING_LOGIN_ORG_KEY, orgId)
  brandingVersion.value += 1
}

export function loginBrandOrgId(): string {
  return sessionStorage.getItem(BRANDING_LOGIN_ORG_KEY) ?? ''
}

/** 退出登录 / 返回登录时清除本次选择，登录页回到平台默认品牌 */
export function clearLoginBrandOrg() {
  sessionStorage.removeItem(BRANDING_LOGIN_ORG_KEY)
  brandingVersion.value += 1
}

/* ---------- 分组状态 ---------- */

export function brandingSource(orgId: string, section: BrandingSection): BrandingSource {
  return overrideOf(orgId)?.[section] ? 'custom' : 'inherit'
}

export function updatedAtOf(orgId: string): number {
  return overrideOf(orgId)?.updatedAt ?? 0
}

export function updatedByOf(orgId: string): string {
  return overrideOf(orgId)?.updatedBy ?? ''
}

/** 取某分组在给定配置中的字段值 */
export function sectionValues(
  config: BrandingConfig,
  section: BrandingSection,
): TabBrandValues | LoginBrandValues | FrameBrandValues {
  if (section === 'tab') return { tabTitle: config.tabTitle, tabIcon: config.tabIcon }
  if (section === 'login') {
    return {
      loginLogo: config.loginLogo,
      loginBrandName: config.loginBrandName,
      loginTitle: config.loginTitle,
      loginSubtitle: config.loginSubtitle,
      loginBackground: config.loginBackground,
      loginPoint1: config.loginPoint1,
      loginPoint2: config.loginPoint2,
      loginPoint3: config.loginPoint3,
    }
  }
  return { headerLogo: config.headerLogo, headerTitle: config.headerTitle }
}

/* ---------- 校验 ---------- */

export function normalizeText(value: string) {
  return (value ?? '').replace(/\s+/g, ' ').trim()
}

export function validateTabTitle(value: string): string | null {
  const text = normalizeText(value)
  if (!text) return '请输入标签标题'
  if (text.length < TAB_TITLE_MIN || text.length > TAB_TITLE_MAX) {
    return `标签标题需 ${TAB_TITLE_MIN}-${TAB_TITLE_MAX} 个字符`
  }
  return null
}

export function validateLoginBrandName(value: string): string | null {
  const text = normalizeText(value)
  if (!text) return '请输入品牌名称'
  if (text.length < LOGIN_BRAND_NAME_MIN || text.length > LOGIN_BRAND_NAME_MAX) {
    return `品牌名称需 ${LOGIN_BRAND_NAME_MIN}-${LOGIN_BRAND_NAME_MAX} 个字符`
  }
  return null
}

export function validateLoginTitle(value: string): string | null {
  const text = normalizeText(value)
  if (!text) return '请输入登录页主标题'
  if (text.length < LOGIN_TITLE_MIN || text.length > LOGIN_TITLE_MAX) {
    return `主标题需 ${LOGIN_TITLE_MIN}-${LOGIN_TITLE_MAX} 个字符`
  }
  return null
}

export function validateLoginSubtitle(value: string): string | null {
  return (value ?? '').length > LOGIN_SUBTITLE_MAX ? `副标题不能超过 ${LOGIN_SUBTITLE_MAX} 个字符` : null
}

export function validateLoginPoint(value: string): string | null {
  return (value ?? '').length > LOGIN_POINT_MAX ? `价值点文案不能超过 ${LOGIN_POINT_MAX} 个字符` : null
}

export function validateHeaderTitle(value: string): string | null {
  const text = normalizeText(value)
  if (!text) return '请输入主界面标题'
  if (text.length < HEADER_TITLE_MIN || text.length > HEADER_TITLE_MAX) {
    return `主界面标题需 ${HEADER_TITLE_MIN}-${HEADER_TITLE_MAX} 个字符`
  }
  return null
}

/** 图片文件校验：类型与大小（背景图与方形图片共用） */
export function validateBrandImage(file: File, kind: BrandImageKind): string | null {
  const rule = BRAND_IMAGE_RULES[kind]
  const type = file.type.toLowerCase()
  const nameMatched = /\.(jpe?g|png)$/i.test(file.name)
  if (!['image/jpeg', 'image/png'].includes(type) && !nameMatched) {
    return '仅支持 JPG、PNG 格式的图片'
  }
  if (file.size > rule.maxBytes) return `图片大小不能超过 ${rule.maxMb}MB`
  return null
}

/** 原图尺寸低于建议值时提示（仅提示，不阻塞） */
export function imageSizeHint(image: HTMLImageElement, kind: BrandImageKind): string | null {
  const rule = BRAND_IMAGE_RULES[kind]
  if (image.naturalWidth < rule.suggestWidth || image.naturalHeight < rule.suggestHeight) {
    return `图片尺寸较小（建议 ${rule.suggestWidth}×${rule.suggestHeight}），可能显示模糊`
  }
  return null
}

/** 读取本地图片，供背景图压缩与尺寸提示使用 */
export { loadImageFile }

/**
 * 【原型说明】背景图按最大宽度 1920 等比压缩后转 data URL，避免超出 localStorage 配额。
 * 正式实现应上传原图到文件存储服务（Q-BRD-04）。
 */
export function compressBackground(image: HTMLImageElement, maxWidth = 1920): string {
  const scale = Math.min(1, maxWidth / image.naturalWidth)
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(image.naturalWidth * scale)
  canvas.height = Math.round(image.naturalHeight * scale)
  const ctx = canvas.getContext('2d')
  if (!ctx) return ''
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL('image/jpeg', 0.84)
}

/** 方形裁剪输出尺寸：与裁剪框一致，输出 320×320 JPEG */
export const brandLogoCropSize = BRAND_LOGO_CROP_SIZE

/* ---------- 保存 / 恢复 ---------- */

/** 【原型说明】模拟保存耗时，无真实接口调用 */
function delay(ms = 320) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms)
  })
}

function normalizeSection(section: BrandingSection, values: TabBrandValues | LoginBrandValues | FrameBrandValues) {
  if (section === 'tab') {
    const tab = values as TabBrandValues
    return { tabTitle: normalizeText(tab.tabTitle), tabIcon: (tab.tabIcon ?? '').trim() }
  }
  if (section === 'login') {
    const login = values as LoginBrandValues
    return {
      loginLogo: (login.loginLogo ?? '').trim(),
      loginBrandName: normalizeText(login.loginBrandName),
      loginTitle: normalizeText(login.loginTitle),
      loginSubtitle: (login.loginSubtitle ?? '').trim(),
      loginBackground: (login.loginBackground ?? '').trim(),
      loginPoint1: normalizeText(login.loginPoint1),
      loginPoint2: normalizeText(login.loginPoint2),
      loginPoint3: normalizeText(login.loginPoint3),
    }
  }
  const frame = values as FrameBrandValues
  return { headerLogo: (frame.headerLogo ?? '').trim(), headerTitle: normalizeText(frame.headerTitle) }
}

/** 分组内容是否与平台默认完全一致（一致时不保留覆盖，自动回到继承态） */
function equalsPlatformDefault(section: BrandingSection, values: TabBrandValues | LoginBrandValues | FrameBrandValues) {
  const defaults = sectionValues(platformBranding(), section)
  return Object.entries(values).every(([key, value]) => String(defaults[key as keyof typeof defaults] ?? '') === String(value ?? ''))
}

/**
 * 保存某个分组并立即发布。
 * 保存后该分组整体标记为企业自定义；若内容与平台默认一致，则清除覆盖回到继承态。
 */
export async function saveBrandingSection(
  section: BrandingSection,
  values: TabBrandValues | LoginBrandValues | FrameBrandValues,
): Promise<{ source: BrandingSource; updatedAt: number }> {
  await delay()
  const orgId = currentOrgId()
  if (!orgId) throw new Error('未选择企业，无法保存品牌配置')

  const normalized = normalizeSection(section, values)
  const record: BrandingOverride = brandingOverrides[orgId] ?? { updatedAt: 0, updatedBy: '' }

  if (equalsPlatformDefault(section, normalized)) {
    delete record[section]
  } else if (section === 'tab') {
    record.tab = normalized as TabBrandValues
  } else if (section === 'login') {
    record.login = normalized as LoginBrandValues
  } else {
    record.frame = normalized as FrameBrandValues
  }

  const hasOverride = Boolean(record.tab || record.login || record.frame)
  if (hasOverride) {
    record.updatedAt = Date.now()
    record.updatedBy = currentOperator()
    brandingOverrides[orgId] = record
  } else {
    delete brandingOverrides[orgId]
  }
  persistBrandingOverrides()
  brandingVersion.value += 1

  return {
    source: brandingOverrides[orgId]?.[section] ? 'custom' : 'inherit',
    updatedAt: brandingOverrides[orgId]?.updatedAt ?? 0,
  }
}

/** 恢复某个分组为平台默认（清除企业覆盖并立即生效） */
export async function resetBrandingSection(section: BrandingSection): Promise<void> {
  await delay()
  const orgId = currentOrgId()
  if (!orgId) throw new Error('未选择企业，无法恢复品牌配置')
  const record = brandingOverrides[orgId]
  if (!record?.[section]) return
  delete record[section]
  if (record.tab || record.login || record.frame) {
    record.updatedAt = Date.now()
    record.updatedBy = currentOperator()
    brandingOverrides[orgId] = record
  } else {
    delete brandingOverrides[orgId]
  }
  persistBrandingOverrides()
  brandingVersion.value += 1
}

export function resetBrandingData() {
  clearBrandingOverrides()
  brandingVersion.value += 1
}

/* ---------- 全站品牌应用 ---------- */

/** 图片为空时回退平台默认 Logo */
export function brandImageSrc(value: string): string {
  return value || `${import.meta.env.BASE_URL}logo.png`
}

/** 浏览器标签标题格式：`{页面名称} — {标签标题}` */
export function documentTitleOf(pageTitle: string, tabTitle: string): string {
  return pageTitle ? `${pageTitle} — ${tabTitle}` : tabTitle
}

function ensureIconLink(rel: string): HTMLLinkElement {
  let link = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`)
  if (!link) {
    link = document.createElement('link')
    link.rel = rel
    document.head.appendChild(link)
  }
  return link
}

/** 应用浏览器标签标题与图标；pageTitle 为空时仅展示品牌标题 */
export function applyDocumentBranding(pageTitle = '') {
  const config = loginBranding()
  document.title = documentTitleOf(pageTitle, config.tabTitle)
  const href = brandImageSrc(config.tabIcon)
  ensureIconLink('icon').href = href
  ensureIconLink('apple-touch-icon').href = href
}

/* ---------- 演示数据 ---------- */

/** 演示用：清除本企业品牌覆盖 */
export function resetCurrentOrgBranding() {
  const orgId = currentOrgId()
  if (!orgId) return
  delete brandingOverrides[orgId]
  persistBrandingOverrides()
  brandingVersion.value += 1
}
