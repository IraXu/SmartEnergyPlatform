/**
 * 【原型说明】企业成员模块的演示数据，仅用于原型交互验证。
 * 成员、角色绑定与数据范围贴近《产品需求文档-企业成员》v1.0 的页面信息项与业务规则，
 * 不涉及真实客户数据、接口或数据库设计。
 */

import type { Member } from '../store/types'

/**
 * 【原型说明】角色 ID 与角色模块演示数据保持一致。
 * 此处不直接引用角色模块，避免「角色 → 成员（统计成员数）」与「成员 → 角色」形成循环依赖；
 * 角色 ID 属于稳定的演示常量，正式实现中由服务端返回。
 */
const ROLE_PRESET = 'ROLE-PRESET'
const ROLE_OPS = 'ROLE-02'
const ROLE_SERVICE = 'ROLE-03'
const ROLE_PARK = 'ROLE-04'
const ROLE_VIEWER = 'ROLE-05'
const ROLE_PENDING = 'ROLE-06'

/** 组织节点 ID，与组织架构模块演示数据一致（NODE-ROOT / NODE-P1 / NODE-P2 等） */
const NODE_ROOT = 'NODE-ROOT'

const DAY = 24 * 60 * 60 * 1000

/**
 * 【原型说明】预置成员：姓名与手机号与组织架构模块「节点负责人」的演示成员保持一致，
 * 保证跨模块同一人在两处的展示相同。
 * - 吕建成为首个注册账号，自动获得预置角色「企业超级管理员」
 * - 李明为运维工程师，用于验证「只读角色」的权限显隐（无编辑入口）
 */
export const PRESET_MEMBERS: Member[] = [
  {
    id: 'MEM-01',
    name: '吕建成',
    accountType: 'phone',
    identifier: '+8613800138000',
    countryCode: '+86',
    roleIds: [ROLE_PRESET],
    scopeIds: [NODE_ROOT],
    status: 'normal',
    mustChangePassword: false,
    createdAt: Date.now() - 30 * DAY,
    updatedAt: Date.now() - 2 * DAY,
  },
  {
    id: 'MEM-02',
    name: '李明',
    accountType: 'phone',
    identifier: '+8613900139000',
    countryCode: '+86',
    roleIds: [ROLE_OPS],
    scopeIds: ['NODE-P1'],
    status: 'normal',
    mustChangePassword: false,
    createdAt: Date.now() - 20 * DAY,
    updatedAt: Date.now() - 5 * DAY,
  },
  {
    id: 'MEM-03',
    name: '陈伟明',
    accountType: 'phone',
    identifier: '+6591234567',
    countryCode: '+65',
    roleIds: [ROLE_SERVICE],
    scopeIds: ['NODE-P1', 'NODE-P2'],
    status: 'normal',
    mustChangePassword: false,
    createdAt: Date.now() - 16 * DAY,
    updatedAt: Date.now() - 3 * DAY,
  },
  {
    id: 'MEM-04',
    name: '王强',
    accountType: 'phone',
    identifier: '+8613700137000',
    countryCode: '+86',
    roleIds: [ROLE_OPS],
    scopeIds: ['NODE-P1-B1'],
    status: 'disabled',
    mustChangePassword: false,
    createdAt: Date.now() - 14 * DAY,
    updatedAt: Date.now() - 9 * DAY,
  },
  {
    id: 'MEM-05',
    name: '赵敏',
    accountType: 'phone',
    identifier: '+8613500135000',
    countryCode: '+86',
    roleIds: [ROLE_PARK],
    scopeIds: ['NODE-P1', 'NODE-P2'],
    status: 'normal',
    /** 【原型说明】用于验证「待改密」标识：仍在用初始密码 */
    mustChangePassword: true,
    createdAt: Date.now() - 10 * DAY,
    updatedAt: Date.now() - 10 * DAY,
  },
  {
    id: 'MEM-06',
    name: '周晓东',
    accountType: 'email',
    identifier: 'zhouxd@example.com',
    countryCode: '',
    roleIds: [ROLE_VIEWER],
    scopeIds: ['NODE-P2'],
    status: 'normal',
    mustChangePassword: false,
    createdAt: Date.now() - 6 * DAY,
    updatedAt: Date.now() - 2 * DAY,
  },
  {
    id: 'MEM-07',
    name: '孙立',
    accountType: 'phone',
    identifier: '+8613600136000',
    countryCode: '+86',
    /** 【原型说明】用于验证「输出无角色成员」状态：角色已被删除后成员失去全部角色 */
    roleIds: [ROLE_PENDING],
    /** 【原型说明】用于验证「未设置数据范围」：不绑定任何组织节点（PRD Q-MEM-07） */
    scopeIds: [],
    status: 'normal',
    mustChangePassword: true,
    createdAt: Date.now() - 3 * DAY,
    updatedAt: Date.now() - 3 * DAY,
  },
]

/**
 * 【原型说明】锁定附注的验证方式：在登录页用某成员的账号连续失败 5 次触发锁定，
 * 回本页即可看到该成员状态列附注「已锁定（剩余 X 分钟）」；账号安全状态由认证模块维护，本页只读展示。
 */
