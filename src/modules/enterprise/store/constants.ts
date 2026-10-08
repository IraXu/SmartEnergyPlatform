/**
 * 【原型说明】企业中心模块的存储键与规则常量，仅用于原型演示。
 * 规则取值对齐《产品需求文档-企业中心》v1.0 与《产品交互设计文档-企业中心》v1.0 的业务规则。
 */

export const ENTERPRISE_PROFILES_KEY = 'proto_enterprise_profiles'
export const ENTERPRISE_LOGS_KEY = 'proto_enterprise_logs'
export const ENTERPRISE_VERSION_KEY = 'proto_enterprise_data_version'

/** 【原型说明】演示数据结构版本，调整演示数据时提升版本以清理旧数据 */
export const ENTERPRISE_DATA_VERSION = '2'

/** 企业名称长度（PRD F-ENT-02 业务规则） */
export const NAME_MIN = 1
export const NAME_MAX = 50
/** 联系人姓名长度 */
export const CONTACT_NAME_MIN = 2
export const CONTACT_NAME_MAX = 20
/** 联系人职务长度上限 */
export const CONTACT_TITLE_MAX = 30
/** 注册地址长度上限 */
export const ADDRESS_MAX = 100

/** 统一社会信用代码：18 位，字符集为数字与大写字母，且不含 I、O、S、V、Z */
export const CREDIT_CODE_LENGTH = 18
export const CREDIT_CODE_PATTERN = /^[0-9ABCDEFGHJKLMNPQRTUWXY]{18}$/
export const CREDIT_CODE_ALLOWED = '0123456789ABCDEFGHJKLMNPQRTUWXY'

/** 图片上传约束：单张 ≤ 5MB，仅 JPG / PNG */
export const IMAGE_MAX_MB = 5
export const IMAGE_MAX_BYTES = IMAGE_MAX_MB * 1024 * 1024
export const IMAGE_ACCEPT = '.jpg,.jpeg,.png'
export const IMAGE_MIME_TYPES = ['image/jpeg', 'image/png']

/** 企业 Logo 建议原图尺寸（低于该尺寸仅提示不阻塞，EX-ENT-27） */
export const LOGO_SUGGEST_SIZE = 200
/** 营业执照建议原图尺寸（低于该尺寸仅提示不阻塞） */
export const LICENSE_SUGGEST_WIDTH = 800
export const LICENSE_SUGGEST_HEIGHT = 600

/** 企业 Logo 裁剪框：固定 320×320px 正方形，缩放范围 1×~3×（COMP-ENT-03） */
export const LOGO_CROP_SIZE = 320
export const LOGO_CROP_MAX_SCALE = 3

/** 统一社会信用代码输入过滤：仅保留允许字符并转大写（EX-ENT-16） */
export function normalizeCreditCode(value: string) {
  return (value ?? '')
    .replace(/\s/g, '')
    .toUpperCase()
    .split('')
    .filter((char) => CREDIT_CODE_ALLOWED.includes(char))
    .join('')
    .slice(0, CREDIT_CODE_LENGTH)
}

export const ENTERPRISE_ALL_KEYS = [ENTERPRISE_PROFILES_KEY, ENTERPRISE_LOGS_KEY] as const
