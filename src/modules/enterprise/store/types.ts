/**
 * 【原型说明】企业中心模块的数据结构定义，仅用于原型交互验证。
 * 信息项对齐《产品需求文档-企业中心》v1.0 与《产品交互设计文档-企业中心》v1.0，
 * 不涉及数据库表、字段类型或接口设计。
 */

/**
 * 企业档案：按企业维度维护的本企业主体信息。
 * 企业名称 / 所属行业 / 所在地区为企业级共享信息，同企业下所有账号看到同一份；
 * 企业 Logo 亦按企业维度维护，用于「选择登录企业」页与顶栏「企业切换」组件。
 */
export interface EnterpriseProfile {
  orgId: string
  /** 企业名称：与组织架构企业根节点、顶栏当前企业、选择登录企业列表同源 */
  name: string
  /** 所属行业，取值来自注册侧统一的行业预设列表 */
  industry: string
  /** 企业所在地区，展示形态为「省 / 市」 */
  region: string
  /** 企业 Logo 图片数据；空串表示未上传（企业中心展示「未上传 Logo」空态） */
  logo: string
  /** 统一社会信用代码，18 位，平台内唯一 */
  creditCode: string
  /** 注册地址，最多 100 字符 */
  registeredAddress: string
  /** 营业执照图片数据；空串表示未上传 */
  businessLicense: string
  /** 营业执照文件名，仅用于预览浮层展示 */
  licenseFileName: string
  updatedAt: number
}

/** 企业档案卡片（含企业 Logo） */
export interface EnterpriseProfileInput {
  name: string
  industry: string
  region: string
  logo: string
}

/**
 * 企业联系人：按「账号 × 企业归属」口径登记，展示与维护当前登录账号在本企业下的条目。
 * 【原型说明】数据落在账号归属关系上（见 auth 模块 Membership），本模块不另存一份。
 */
export interface EnterpriseContactInput {
  name: string
  title: string
  phone: string
}

/** 企业资质信息 */
export interface EnterpriseQualificationInput {
  creditCode: string
  registeredAddress: string
  businessLicense: string
  licenseFileName: string
}

/** 卡片的编辑权限点分组标识 */
export type EnterpriseCardKey = 'profile' | 'contact' | 'qualification'

export type EnterpriseChangeType =
  | '编辑企业档案'
  | '企业名称变更'
  | '上传企业Logo'
  | '更换企业Logo'
  | '删除企业Logo'
  | '编辑企业联系人'
  | '编辑企业资质信息'
  | '上传营业执照'
  | '替换营业执照'
  | '删除营业执照'

/** 【原型说明】企业信息变更记录，对应 PRD F-ENT-05（正式查看入口为「系统管理 › 系统日志」） */
export interface EnterpriseChangeLog {
  id: string
  at: number
  account: string
  type: EnterpriseChangeType
  /** 变更时的企业名称，便于日志中区分企业主体 */
  orgName: string
  detail: string
}
