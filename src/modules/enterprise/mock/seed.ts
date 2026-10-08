/**
 * 【原型说明】企业中心模块的演示数据，仅用于原型交互验证。
 * 演示内容贴近《产品需求文档-企业中心》v1.0 的页面信息项与业务规则，
 * 不涉及真实客户数据、接口或数据库设计。
 */

import type { EnterpriseProfile } from '../store/types'

/**
 * 【原型说明】演示图片统一拼接站点基路径，兼容 GitHub Pages 子路径部署与本地根路径。
 */
const baseUrl = import.meta.env.BASE_URL

/**
 * 【原型说明】企业 Logo 的演示图片：产品侧提供的「南京伊米特电子科技技术有限公司」企业标识。
 */
const LOGO_ORG_1001 = `${baseUrl}mock/enterprise/ORG-1001-logo.png`

/** 营业执照的演示图片：产品侧提供的样例营业执照，仅用于原型演示 */
const LICENSE_ORG_1001 = `${baseUrl}mock/enterprise/ORG-1001-license.jpg`

/**
 * 【原型说明】企业档案的补充演示数据，按企业标识存放。
 *
 * 企业名称、所属行业与所在地区来自注册侧采集（账号归属关系与会话），
 * 因此**不在本文件重复定义**，由 store 在首次进入时按当前企业自动建档；
 * 本文件只提供注册未采集、用于演示「已上传标识 / 已登记资质」表现的补充值。
 *
 * - ORG-1001（南京伊米特电子科技技术有限公司，演示主企业）：已上传企业 Logo、已登记统一社会信用代码与注册地址、已上传营业执照
 *   → 用于演示企业中心三张卡片的完整展示、营业执照大图查看，以及顶栏与「选择登录企业」页的 Logo 生效
 * - ORG-1002（上海星辰科技有限公司）：**未上传 Logo**
 *   → 与 ORG-1001 形成对照，用于演示「选择登录企业」页与顶栏「企业切换」组件的首字徽标回退
 */
export const PRESET_PROFILE_EXTRAS: Record<string, Partial<EnterpriseProfile>> = {
  'ORG-1001': {
    logo: LOGO_ORG_1001,
    creditCode: '91320100MA1WXY2T3A',
    registeredAddress: '江苏省南京市江宁区示例科技园 1 号楼 8 层',
    businessLicense: LICENSE_ORG_1001,
    licenseFileName: '营业执照.jpg',
  },
}
