/**
 * 【原型说明】本文件仅用于原型交互验证，非生产代码。
 * Mock 账号与企业归属数据与 PRD《登录与注册》的页面信息项和业务规则保持一致，
 * 不涉及真实接口、数据库或字段设计。
 *
 * 账号与企业为多对多：账号只承载身份凭证（标识与密码），
 * 企业名称、行业、地区、角色、联系人信息均按 membership（归属关系）存放。
 */

import type { AccountSource, Membership } from '../store/types'

export type AccountStatus = 'ACTIVE' | 'DISABLED'

export interface PrototypeAccount {
  id: string
  accountType: 'phone' | 'email'
  /** 账号标识：手机号为「国际区号 + 本地号码」，邮箱为完整地址 */
  identifier: string
  /** 手机号账号所属国际区号，邮箱账号为空 */
  countryCode: string
  /**
   * 平台级唯一密码：一个账号一套密码，加入新企业不重置、不覆盖。
   * 【原型说明】原型内仅用于校验演示，非明文存储方案。
   */
  password: string
  /**
   * 注册来源：决定该账号能否在注册页再次自助创建企业。
   * 由「企业成员」页新增产生的账号来源为 `member`，本人仍可自助创建企业；
   * 一旦本人从注册页注册过，来源升级为 `platform`，此后不可再次自助创建企业。
   */
  source: AccountSource
  status: AccountStatus
  /** 账号归属的全部企业及其在该企业下的角色与联系人信息 */
  memberships: Membership[]
}

const DAY = 24 * 60 * 60 * 1000
const now = Date.now()

/** 【原型说明】预置企业演示数据，便于在同一账号下演示多企业切换 */
export const PRESET_ORGS = {
  nanjing: '南京伊米特电子科技技术有限公司',
  shanghai: '上海星辰科技有限公司',
  beijing: '北京云创科技股份公司',
  dongguan: '东莞松山湖制造基地',
  singapore: '新加坡裕廊能源服务有限公司',
  platform: '平台运营中心',
} as const

/**
 * 【原型演示数据】预置账号，便于直接体验登录与异常分支；手机号统一采用「区号 + 本地号码」标识。
 * - +8613800138000：归属 3 家企业且角色各不相同，用于演示选择登录企业与系统内切换企业；本人自助注册（来源 platform）
 * - +8613900139000：同时归属南京与上海 2 家企业，用于演示多企业但仅其中一家有运维角色；由企业新增（来源 member），故本人仍可自助创建企业
 * - +6591234567：归属境外 1 家企业，用于演示单企业直接进入（不出现选择页）；本人自助注册
 * - admin@example.com：归属平台运营中心 1 家企业（邮箱账号单企业）；本人自助注册
 * - +8613700137000：账号已停用，用于演示「账号已被停用」提示
 * - +8613880013888：仅归属上海星辰 1 家企业（非当前演示企业），用于在企业成员页演示「账号已在其他企业、本企业没有」的加入企业场景；由企业新增（来源 member）
 */
export const PRESET_ACCOUNTS: PrototypeAccount[] = [
  {
    id: 'ACC-1001',
    accountType: 'phone',
    identifier: '+8613800138000',
    countryCode: '+86',
    password: 'Energy2026',
    /** 本人从注册页自助注册并创建了企业，因此不可再次自助创建企业 */
    source: 'platform',
    status: 'ACTIVE',
    memberships: [
      {
        orgId: 'ORG-1001',
        orgName: PRESET_ORGS.nanjing,
        industry: '电力热力燃气及水生产和供应业',
        region: '广东省 / 深圳市',
        role: '企业管理员',
        roleCode: 'ORG_ADMIN',
        contactName: '吕建成',
        contactTitle: '能源管理负责人',
        contactPhone: '+8613800138000',
        status: 'normal',
        joinedAt: now - 60 * DAY,
      },
      {
        orgId: 'ORG-1002',
        orgName: PRESET_ORGS.shanghai,
        industry: '信息传输、软件和信息技术服务业',
        region: '上海市 / 上海市',
        role: '区域经理',
        roleCode: 'REGION_MANAGER',
        contactName: '吕建成',
        contactTitle: '区域负责人',
        contactPhone: '+8613800138000',
        status: 'normal',
        joinedAt: now - 30 * DAY,
      },
      {
        orgId: 'ORG-1003',
        orgName: PRESET_ORGS.beijing,
        industry: '批发和零售业',
        region: '北京市 / 北京市',
        role: '门店店长',
        roleCode: 'STORE_MANAGER',
        contactName: '吕建成',
        contactTitle: '门店负责人',
        contactPhone: '+8613800138000',
        status: 'normal',
        joinedAt: now - 12 * DAY,
      },
    ],
  },
  {
    id: 'ACC-1002',
    accountType: 'phone',
    identifier: '+8613900139000',
    countryCode: '+86',
    password: 'Energy2026',
    /** 由企业管理员在「企业成员」页新增，本人从未自助注册，因此仍可自助创建企业 */
    source: 'member',
    status: 'ACTIVE',
    memberships: [
      {
        orgId: 'ORG-1001',
        orgName: PRESET_ORGS.nanjing,
        industry: '电力热力燃气及水生产和供应业',
        region: '广东省 / 深圳市',
        role: '运维工程师',
        roleCode: 'OPS_ENGINEER',
        contactName: '李明',
        contactTitle: '运维负责人',
        contactPhone: '+8613900139000',
        status: 'normal',
        joinedAt: now - 40 * DAY,
      },
      {
        orgId: 'ORG-1002',
        orgName: PRESET_ORGS.shanghai,
        industry: '信息传输、软件和信息技术服务业',
        region: '上海市 / 上海市',
        role: '运维工程师',
        roleCode: 'OPS_ENGINEER',
        contactName: '李明',
        contactTitle: '运维负责人',
        contactPhone: '+8613900139000',
        status: 'normal',
        joinedAt: now - 8 * DAY,
      },
    ],
  },
  {
    id: 'ACC-1003',
    accountType: 'email',
    identifier: 'admin@example.com',
    countryCode: '',
    password: 'Energy2026',
    /** 平台运营账号，由平台侧建立 */
    source: 'platform',
    status: 'ACTIVE',
    memberships: [
      {
        orgId: 'ORG-9001',
        orgName: PRESET_ORGS.platform,
        industry: '信息传输、软件和信息技术服务业',
        region: '广东省 / 深圳市',
        role: '平台运营管理员',
        roleCode: 'PLATFORM_ADMIN',
        contactName: '运营值班',
        contactTitle: '平台运营',
        contactPhone: '+8613600136000',
        status: 'normal',
        joinedAt: now - 90 * DAY,
      },
    ],
  },
  {
    id: 'ACC-1004',
    accountType: 'phone',
    identifier: '+8613700137000',
    countryCode: '+86',
    password: 'Energy2026',
    /** 由企业新增（来源 member），后被停用；停用账号在注册页同样被拦截 */
    source: 'member',
    status: 'DISABLED',
    memberships: [
      {
        orgId: 'ORG-1004',
        orgName: PRESET_ORGS.dongguan,
        industry: '制造业',
        region: '广东省 / 东莞市',
        role: '运维工程师',
        roleCode: 'OPS_ENGINEER',
        contactName: '王强',
        contactTitle: '设备运维',
        contactPhone: '+8613700137000',
        /** 该账号同时被本企业停用（与企业成员页预置成员 MEM-04 状态一致） */
        status: 'disabled',
        joinedAt: now - 25 * DAY,
      },
    ],
  },
  {
    id: 'ACC-1005',
    accountType: 'phone',
    identifier: '+6591234567',
    countryCode: '+65',
    password: 'Energy2026',
    /** 本人自助注册并创建了企业 */
    source: 'platform',
    status: 'ACTIVE',
    memberships: [
      {
        orgId: 'ORG-1005',
        orgName: PRESET_ORGS.singapore,
        industry: '电力热力燃气及水生产和供应业',
        region: '广东省 / 深圳市',
        role: '企业管理员',
        roleCode: 'ORG_ADMIN',
        contactName: '陈伟明',
        contactTitle: '能源服务经理',
        contactPhone: '+6591234567',
        status: 'normal',
        joinedAt: now - 18 * DAY,
      },
    ],
  },
  {
    id: 'ACC-1006',
    accountType: 'phone',
    identifier: '+8613880013888',
    countryCode: '+86',
    password: 'Energy2026',
    /** 由企业（上海星辰）新增，本人从未自助注册，因此仍可自助创建企业 */
    source: 'member',
    status: 'ACTIVE',
    memberships: [
      {
        orgId: 'ORG-1002',
        orgName: PRESET_ORGS.shanghai,
        industry: '信息传输、软件和信息技术服务业',
        region: '上海市 / 上海市',
        role: '运维工程师',
        roleCode: 'OPS_ENGINEER',
        contactName: '林晓峰',
        contactTitle: '现场运维',
        contactPhone: '+8613880013888',
        status: 'normal',
        joinedAt: now - 20 * DAY,
      },
    ],
  },
]
