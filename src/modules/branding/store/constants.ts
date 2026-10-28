/**
 * 【原型说明】品牌设置模块的存储键与规则常量，仅用于原型演示。
 * 规则取值对齐《产品需求文档-品牌设置》v1.0 与《产品交互设计文档-品牌设置》v1.0。
 */

export const BRANDING_OVERRIDES_KEY = 'proto_branding_overrides'
export const BRANDING_VERSION_KEY = 'proto_branding_data_version'
/** 本次登录流程中「选择登录企业」页选中的企业（sessionStorage，退出登录即失效） */
export const BRANDING_LOGIN_ORG_KEY = 'proto_branding_login_org'

/** 【原型说明】演示数据结构版本，调整演示数据时提升版本以清理旧数据 */
export const BRANDING_DATA_VERSION = '2'

/** 文案长度上限（PRD 6.2） */
export const TAB_TITLE_MIN = 1
export const TAB_TITLE_MAX = 30
export const LOGIN_BRAND_NAME_MIN = 1
export const LOGIN_BRAND_NAME_MAX = 20
export const LOGIN_TITLE_MIN = 1
export const LOGIN_TITLE_MAX = 40
export const LOGIN_SUBTITLE_MAX = 200
export const LOGIN_POINT_MAX = 40
export const HEADER_TITLE_MIN = 1
export const HEADER_TITLE_MAX = 30

/** 图片用途：标签图标 / 登录页 Logo / 登录页背景图 / Header Logo */
export type BrandImageKind = 'tabIcon' | 'loginLogo' | 'loginBackground' | 'headerLogo'

/** 图片格式统一为 JPG / PNG（Q-BRD-03 本期不支持 ICO / SVG） */
export const BRAND_IMAGE_ACCEPT = '.jpg,.jpeg,.png'
export const BRAND_IMAGE_MIME_TYPES = ['image/jpeg', 'image/png']

/** 各用途的大小上限与建议尺寸 */
export const BRAND_IMAGE_RULES: Record<
  BrandImageKind,
  { maxMb: number; maxBytes: number; suggestWidth: number; suggestHeight: number; label: string }
> = {
  tabIcon: { maxMb: 1, maxBytes: 1 * 1024 * 1024, suggestWidth: 64, suggestHeight: 64, label: '标签图标' },
  loginLogo: {
    maxMb: 2,
    maxBytes: 2 * 1024 * 1024,
    suggestWidth: 256,
    suggestHeight: 256,
    label: '登录页 Logo',
  },
  loginBackground: {
    maxMb: 5,
    maxBytes: 5 * 1024 * 1024,
    suggestWidth: 1920,
    suggestHeight: 1080,
    label: '登录页背景图',
  },
  headerLogo: {
    maxMb: 2,
    maxBytes: 2 * 1024 * 1024,
    suggestWidth: 128,
    suggestHeight: 128,
    label: 'Header Logo',
  },
}

/** 方形图片裁剪框：固定 320×320px，缩放 1×~3×（复用企业中心裁剪浮层） */
export const BRAND_LOGO_CROP_SIZE = 320
export const BRAND_LOGO_CROP_MAX_SCALE = 3

/** 平台默认品牌（Q-BRD-01：本期由系统内置，不提供平台端维护入口） */
export const PLATFORM_BRANDING = {
  tabTitle: '智能数字化能源系统',
  tabIcon: '',
  loginLogo: '',
  loginBrandName: '智能数字化能源系统',
  loginTitle: '连接每一台设备 · 看清每一度能源',
  loginSubtitle:
    '以电能为重点的能源数字化管理平台，统一接入并管理园区、企业与各类用能场景的电能数据，覆盖设备管控、用电策略、点位分布与告警闭环，支撑用能成本下降与能源管理目标达成。',
  loginBackground: '',
  loginPoint1: '设备台账与固件 OTA，档案与运行状态集中管控',
  loginPoint2: '时控与负控策略，用电管控按规则自动执行',
  loginPoint3: '点位地图与告警中心，设备分布可视、异常闭环',
  headerLogo: '',
  headerTitle: '智能数字化能源系统',
} as const

/** 登录页页脚：平台统一文案，不开放自定义（PRD F-BRD-02） */
export const PLATFORM_LOGIN_FOOTER = '© 2026 智能数字化能源系统 · 伊米特合作平台项目 · 南京鹤梦产品部原型'
