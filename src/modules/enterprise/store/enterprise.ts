/**
 * 【原型说明】企业档案、企业联系人与企业资质信息的维护逻辑，仅用于原型交互验证。
 * 业务规则对齐《产品需求文档-企业中心》v1.0：
 * - 企业名称必填、1-50 字符、平台内不要求唯一、不做工商核验；变更需二次确认
 * - 企业名称变更后同步组织架构企业根节点名称、顶栏当前企业名称与「选择登录企业」列表；
 *   同步失败按整次保存失败处理（原型中不模拟同步失败，见交互文档 EX-ENT-22）
 * - 企业 Logo 选填、单张图片，上传前须经裁剪浮层裁为正方形（COMP-ENT-03）
 * - 企业联系人按「账号 × 企业归属」口径登记，仅维护当前登录账号在本企业下的条目
 * - 统一社会信用代码选填、18 位、平台内唯一；注册地址选填、最多 100 字符
 * - 营业执照选填、单张图片，不做裁剪，预览提供缩放与旋转
 * - 全部变更写入变更记录（对应 F-ENT-05）
 */

import { accounts, session } from '@/modules/auth/store'
import { persistAccounts, persistSession } from '@/modules/auth/store/storage'
import { isCanonicalPhone } from '@/modules/auth/store/identifier'
import { maskIdentifier } from '@/shared/utils/mask'
import { getRoot, persistNodes } from '@/modules/org/store'
import {
  ADDRESS_MAX,
  CONTACT_NAME_MAX,
  CONTACT_NAME_MIN,
  CONTACT_TITLE_MAX,
  CREDIT_CODE_LENGTH,
  CREDIT_CODE_PATTERN,
  IMAGE_MAX_BYTES,
  IMAGE_MAX_MB,
  IMAGE_MIME_TYPES,
  LICENSE_SUGGEST_HEIGHT,
  LICENSE_SUGGEST_WIDTH,
  LOGO_CROP_SIZE,
  LOGO_SUGGEST_SIZE,
  NAME_MAX,
  NAME_MIN,
  normalizeCreditCode,
} from './constants'
import {
  buildProfile,
  enterpriseLogs,
  enterpriseProfiles,
  persistEnterpriseLogs,
  persistProfiles,
} from './storage'
import type {
  EnterpriseChangeType,
  EnterpriseContactInput,
  EnterpriseProfile,
  EnterpriseProfileInput,
  EnterpriseQualificationInput,
} from './types'

/* ---------- 通用 ---------- */

/** 【原型说明】模拟异步保存耗时，无真实接口调用 */
function delay(ms = 320) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms)
  })
}

/** 当前操作账号展示名，用于变更记录 */
function currentOperator() {
  const current = session.current
  if (!current) return '未知账号'
  return current.contactName || maskIdentifier(current.identifier)
}

/** 输入内容按纯文本处理：去除首尾空格，仅空格视为未填写 */
export function normalizeText(value: string) {
  return (value ?? '').replace(/\s+/g, ' ').trim()
}

/* ---------- 企业档案 ---------- */

const currentOrgId = () => session.current?.orgId ?? ''

/** 取当前进入企业的档案；本地缺失时按当前企业信息即时建档（异常数据兜底） */
export function currentProfile(): EnterpriseProfile {
  const orgId = currentOrgId()
  const found = enterpriseProfiles.find((item) => item.orgId === orgId)
  if (found) return found
  const current = session.current
  const created = buildProfile(
    orgId,
    current?.orgName ?? '',
    current?.industry ?? '',
    current?.region ?? '',
  )
  enterpriseProfiles.push(created)
  persistProfiles()
  return created
}

/** 按企业标识取档案，供「选择登录企业」页与顶栏「企业切换」组件读取企业 Logo */
export function profileOf(orgId: string): EnterpriseProfile | null {
  return enterpriseProfiles.find((item) => item.orgId === orgId) ?? null
}

/**
 * 企业 Logo：企业中心只读展示用（空值由页面呈现「未上传 Logo」空态）。
 * 「选择登录企业」页与顶栏「企业切换」组件读取同一值，无值时由徽标组件回退企业名称首字。
 */
export function logoOf(orgId: string): string {
  return profileOf(orgId)?.logo ?? ''
}

/* ---------- 校验 ---------- */

export function validateName(name: string): string | null {
  const value = normalizeText(name)
  if (!value) return '请输入企业名称'
  if (value.length < NAME_MIN || value.length > NAME_MAX) {
    return `企业名称需 ${NAME_MIN}-${NAME_MAX} 个字符`
  }
  return null
}

export function validateIndustry(industry: string): string | null {
  return industry ? null : '请选择企业所属行业'
}

/** 企业所在地区：省 / 市两级均需选择 */
export function validateRegion(region: string[]): string | null {
  return region.length === 2 && region.every(Boolean) ? null : '请选择企业所在地区'
}

export function validateContactName(name: string): string | null {
  const value = normalizeText(name)
  if (!value) return '请输入联系人姓名'
  if (value.length < CONTACT_NAME_MIN || value.length > CONTACT_NAME_MAX) {
    return `联系人姓名需 ${CONTACT_NAME_MIN}-${CONTACT_NAME_MAX} 个字符`
  }
  return null
}

export function validateContactTitle(title: string): string | null {
  return normalizeText(title).length > CONTACT_TITLE_MAX ? `联系人职务不能超过 ${CONTACT_TITLE_MAX} 个字符` : null
}

export function validateContactPhone(phone: string): string | null {
  const value = (phone ?? '').trim()
  if (!value) return '请输入联系人电话'
  return isCanonicalPhone(value) ? null : '请输入正确的手机号'
}

/**
 * 统一社会信用代码校验（PRD F-ENT-04）：
 * 位数 → 字符集 → 平台内唯一；同一企业重复保存自身值不视为冲突。
 */
export function validateCreditCode(code: string, excludeOrgId?: string): string | null {
  const value = normalizeCreditCode(code)
  if (!value) return null
  if (value.length !== CREDIT_CODE_LENGTH) return `统一社会信用代码为 ${CREDIT_CODE_LENGTH} 位`
  if (!CREDIT_CODE_PATTERN.test(value)) {
    return '统一社会信用代码仅支持数字与大写字母，且不含 I、O、S、V、Z'
  }
  const duplicated = enterpriseProfiles.some(
    (item) => item.orgId !== excludeOrgId && item.creditCode && item.creditCode === value,
  )
  return duplicated ? '该统一社会信用代码已被登记，请核对后重新填写' : null
}

export function validateAddress(address: string): string | null {
  return (address ?? '').length > ADDRESS_MAX ? `注册地址不能超过 ${ADDRESS_MAX} 个字符` : null
}

/* ---------- 企业名称全局同步 ---------- */

/**
 * 企业名称变更后的同步（PRD F-ENT-02 业务结果）：
 * 组织架构企业根节点名称、会话中的当前企业名称、账号归属关系中的企业名称
 * （「选择登录企业」列表与顶栏「企业切换」浮层均读取归属关系）。
 */
function syncOrgName(nextName: string) {
  const root = getRoot()
  if (root) {
    root.name = nextName
    root.remark = '企业根节点由注册信息自动生成，名称由「企业中心」维护'
    persistNodes()
  }
  const orgId = currentOrgId()
  accounts.forEach((account) => {
    account.memberships.forEach((membership) => {
      if (membership.orgId === orgId) membership.orgName = nextName
    })
  })
  persistAccounts()
  if (session.current?.orgId === orgId) {
    session.current.orgName = nextName
    persistSession()
  }
}

/* ---------- 变更记录（F-ENT-05） ---------- */

/**
 * 【原型说明】记录企业信息变更，对应 PRD F-ENT-05。
 * 正式实现中该记录写入「系统管理 › 系统日志」，本页不展示独立界面；
 * 日志不记录任何图片内容，仅记录动作与文件名等摘要信息。
 */
function writeEnterpriseLog(type: EnterpriseChangeType, orgName: string, detail: string) {
  enterpriseLogs.unshift({
    id: `ELOG-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    at: Date.now(),
    account: currentOperator(),
    type,
    orgName,
    detail,
  })
  if (enterpriseLogs.length > 200) enterpriseLogs.splice(200)
  persistEnterpriseLogs()
}

/* ---------- 企业档案与 Logo 保存（F-ENT-02） ---------- */

/**
 * 保存企业档案（企业名称、所属行业、所在地区、企业 Logo）与档案共用同一次保存。
 * 返回是否发生了企业名称变更，供页面决定是否弹出变更确认（此处由页面先行确认后再提交）。
 */
export async function saveProfile(input: EnterpriseProfileInput): Promise<{ nameChanged: boolean }> {
  await delay()
  const profile = currentProfile()
  const beforeName = profile.name
  const beforeIndustry = profile.industry
  const beforeRegion = profile.region
  const beforeLogo = profile.logo

  const name = normalizeText(input.name)
  const logoChanged = beforeLogo !== input.logo
  const nameChanged = beforeName !== name
  if (!nameChanged && beforeIndustry === input.industry && beforeRegion === input.region && !logoChanged) {
    return { nameChanged: false }
  }

  profile.name = name
  profile.industry = input.industry
  profile.region = input.region
  profile.logo = input.logo
  profile.updatedAt = Date.now()
  persistProfiles()

  if (nameChanged) syncOrgName(name)

  const changes: string[] = []
  if (nameChanged) changes.push(`企业名称由「${beforeName}」改为「${name}」`)
  if (beforeIndustry !== profile.industry) changes.push('修改了所属行业')
  if (beforeRegion !== profile.region) changes.push('修改了企业所在地区')
  if (changes.length) {
    writeEnterpriseLog(
      nameChanged ? '企业名称变更' : '编辑企业档案',
      name,
      nameChanged
        ? `${changes.join('；')}；已同步组织架构企业根节点名称、顶栏当前企业名称与选择登录企业列表`
        : changes.join('；'),
    )
  }
  if (logoChanged) {
    writeEnterpriseLog(
      input.logo ? (beforeLogo ? '更换企业Logo' : '上传企业Logo') : '删除企业Logo',
      name,
      input.logo ? '更新企业 Logo（日志不记录图片内容）' : '清除企业 Logo，徽标回退为企业名称首字',
    )
  }
  return { nameChanged }
}

/* ---------- 企业联系人保存（F-ENT-03） ---------- */

/** 当前登录账号在本企业下的归属关系；联系人信息即登记在该归属关系上 */
function currentMembership() {
  const current = session.current
  if (!current) return null
  const account = accounts.find((item) => item.identifier === current.identifier)
  return account?.memberships.find((item) => item.orgId === current.orgId) ?? null
}

/** 当前账号在本企业下登记的联系人信息（只读展示用） */
export function currentContact(): EnterpriseContactInput {
  const current = session.current
  return {
    name: current?.contactName ?? '',
    title: current?.contactTitle ?? '',
    phone: current?.contactPhone ?? '',
  }
}

/**
 * 保存企业联系人：写入当前账号在本企业下的归属关系与会话。
 * 联系人电话可与企业账号不同，修改不影响账号标识与登录（PRD F-ENT-03 业务规则）。
 */
export async function saveContact(input: EnterpriseContactInput): Promise<void> {
  await delay()
  const membership = currentMembership()
  if (!membership || !session.current) throw new Error('未找到当前账号在本企业下的归属关系')

  const name = normalizeText(input.name)
  const title = normalizeText(input.title)
  const phone = (input.phone ?? '').trim()
  const before = currentContact()

  membership.contactName = name
  membership.contactTitle = title
  membership.contactPhone = phone
  persistAccounts()

  session.current.contactName = name
  session.current.contactTitle = title
  session.current.contactPhone = phone
  persistSession()

  const changes: string[] = []
  if (before.name !== name) changes.push(`联系人姓名由「${before.name || '未填写'}」改为「${name}」`)
  if (before.title !== title) changes.push('修改了联系人职务')
  if (before.phone !== phone) changes.push('修改了联系人电话')
  if (changes.length) {
    writeEnterpriseLog('编辑企业联系人', session.current.orgName, changes.join('；'))
  }
}

/* ---------- 企业资质信息保存（F-ENT-04） ---------- */

export async function saveQualification(input: EnterpriseQualificationInput): Promise<void> {
  await delay()
  const profile = currentProfile()
  const before = {
    creditCode: profile.creditCode,
    registeredAddress: profile.registeredAddress,
    businessLicense: profile.businessLicense,
  }

  const creditCode = normalizeCreditCode(input.creditCode)
  const address = (input.registeredAddress ?? '').trim()
  const licenseChanged = before.businessLicense !== input.businessLicense
  const changed =
    before.creditCode !== creditCode ||
    before.registeredAddress !== address ||
    licenseChanged
  if (!changed) return

  profile.creditCode = creditCode
  profile.registeredAddress = address
  profile.businessLicense = input.businessLicense
  profile.licenseFileName = input.businessLicense ? input.licenseFileName : ''
  profile.updatedAt = Date.now()
  persistProfiles()

  const changes: string[] = []
  if (before.creditCode !== creditCode) {
    changes.push(creditCode ? '登记了统一社会信用代码' : '清除了统一社会信用代码')
  }
  if (before.registeredAddress !== address) changes.push('修改了注册地址')
  if (changes.length) {
    writeEnterpriseLog('编辑企业资质信息', profile.name, changes.join('；'))
  }
  if (licenseChanged) {
    writeEnterpriseLog(
      input.businessLicense ? (before.businessLicense ? '替换营业执照' : '上传营业执照') : '删除营业执照',
      profile.name,
      input.businessLicense
        ? `更新营业执照「${input.licenseFileName}」（日志不记录图片内容）`
        : '删除营业执照，回到未上传状态',
    )
  }
}

/* ---------- 图片处理（COMP-ENT-01 / COMP-ENT-03） ---------- */

/**
 * 图片文件校验：类型与大小（**裁剪前执行**，EX-ENT-08 / EX-ENT-09）。
 * 返回错误文案，通过校验时返回 null。
 */
export function validateImageFile(file: File): string | null {
  const type = file.type.toLowerCase()
  const nameMatched = /\.(jpe?g|png)$/i.test(file.name)
  if (!IMAGE_MIME_TYPES.includes(type) && !nameMatched) return '仅支持 JPG、PNG 格式的图片'
  if (file.size > IMAGE_MAX_BYTES) return `图片大小不能超过 ${IMAGE_MAX_MB}MB`
  return null
}

/**
 * 读取本地图片文件为 HTMLImageElement，供裁剪浮层与预览使用。
 * 【原型说明】先经 FileReader 转为 data URL 再解码：裁剪浮层需要用 image.src 复用同一地址渲染，
 * 若使用 ObjectURL 并在加载后释放，预览图会因地址失效而无法显示。
 */
export function loadImageFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const image = new Image()
      image.onload = () => resolve(image)
      image.onerror = () => reject(new Error('图片读取失败'))
      image.src = String(reader.result)
    }
    reader.onerror = () => reject(new Error('图片读取失败'))
    reader.readAsDataURL(file)
  })
}

/** 原图尺寸小于建议值时给出提示文案（仅提示，不阻塞，EX-ENT-27） */
export function imageSizeHint(image: HTMLImageElement, kind: 'logo' | 'license'): string | null {
  if (kind === 'logo') {
    return Math.min(image.naturalWidth, image.naturalHeight) < LOGO_SUGGEST_SIZE
      ? '图片尺寸较小，可能在徽标中显示模糊'
      : null
  }
  return image.naturalWidth < LICENSE_SUGGEST_WIDTH || image.naturalHeight < LICENSE_SUGGEST_HEIGHT
    ? '图片尺寸较小，可能影响证件细节辨识'
    : null
}

/**
 * 【原型说明】把裁剪结果生成为可持久化的图片地址（data URL）。
 * 正式实现应上传裁剪后的文件到文件存储服务；此处为避免 localStorage 超限，
 * 统一按正方形输出并压缩为 JPEG。
 */
export function cropToSquare(image: HTMLImageElement, source: CropSource): string {
  const canvas = document.createElement('canvas')
  canvas.width = LOGO_CROP_SIZE
  canvas.height = LOGO_CROP_SIZE
  const ctx = canvas.getContext('2d')
  if (!ctx) return ''
  ctx.drawImage(
    image,
    source.x,
    source.y,
    source.size,
    source.size,
    0,
    0,
    LOGO_CROP_SIZE,
    LOGO_CROP_SIZE,
  )
  return canvas.toDataURL('image/jpeg', 0.9)
}

/** 裁剪参数：原图坐标系下裁剪框的位置与边长 */
export interface CropSource {
  x: number
  y: number
  size: number
}

/**
 * 【原型说明】营业执照不做裁剪，仅按上限等比缩小后转 data URL，避免超 localStorage 配额。
 * 正式实现应是原图上传，此处仅为原型演示的存储折中。
 */
export function compressLicenseImage(image: HTMLImageElement, maxWidth = 1200): string {
  const scale = Math.min(1, maxWidth / image.naturalWidth)
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(image.naturalWidth * scale)
  canvas.height = Math.round(image.naturalHeight * scale)
  const ctx = canvas.getContext('2d')
  if (!ctx) return ''
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL('image/jpeg', 0.86)
}
