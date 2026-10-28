/**
 * 【原型说明】品牌设置模块的数据结构定义，仅用于原型交互验证。
 * 品牌按「分组」整体覆盖平台默认：浏览器标签 / 登录页 / 主界面框架三组互相独立。
 */

/** 品牌配置分组 */
export type BrandingSection = 'tab' | 'login' | 'frame'

/** 浏览器标签分组 */
export interface TabBrandValues {
  tabTitle: string
  /** 标签图标（data URL）；为空表示继承平台默认 */
  tabIcon: string
}

/** 登录页品牌分组 */
export interface LoginBrandValues {
  /** 登录页 Logo（data URL）；为空表示继承平台默认 */
  loginLogo: string
  /** 品牌名称：展示在登录页 Logo 右侧，与浏览器标签标题互相独立 */
  loginBrandName: string
  loginTitle: string
  loginSubtitle: string
  /** 背景图（data URL）；为空表示使用平台默认渐变 */
  loginBackground: string
  /** 品牌区三条价值点文案；为空表示不展示该条 */
  loginPoint1: string
  loginPoint2: string
  loginPoint3: string
}

/** 主界面框架分组 */
export interface FrameBrandValues {
  /** Header Logo（data URL）；为空表示继承平台默认 */
  headerLogo: string
  headerTitle: string
}

/** 生效品牌：三组合并后的完整配置 */
export type BrandingConfig = TabBrandValues & LoginBrandValues & FrameBrandValues

/** 单个企业的品牌覆盖（未出现分组表示该组继承平台默认） */
export interface BrandingOverride {
  tab?: TabBrandValues
  login?: LoginBrandValues
  frame?: FrameBrandValues
  /** 最近一次保存时间 */
  updatedAt: number
  /** 最近一次操作人展示名 */
  updatedBy: string
}

/** 企业标识 → 品牌覆盖 */
export type BrandingOverrideMap = Record<string, BrandingOverride>

/** 分组来源：继承平台默认 / 企业自定义 */
export type BrandingSource = 'inherit' | 'custom'
