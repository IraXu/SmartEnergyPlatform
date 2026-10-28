/**
 * 【原型说明】角色管理模块的演示数据，仅用于原型交互验证。
 * 角色与权限配置贴近《产品需求文档-角色管理》v1.0 的功能范围与业务规则，
 * 不涉及真实客户数据、接口或数据库设计。
 */

import type { Role } from '../store/types'

/** 【原型说明】预置角色标识：企业超级管理员，拥有本企业全部权限，不可改权限、不可删除 */
export const PRESET_ROLE_ID = 'ROLE-PRESET'

/** 【原型说明】平台默认角色标识：由平台「企业角色管理」统一维护，企业侧只读 */
export const DEFAULT_ROLE_IDS = ['ROLE-DEFAULT-01', 'ROLE-DEFAULT-02'] as const

/**
 * 【原型说明】预置角色 + 2 个平台默认角色 + 5 个企业自建角色示例。
 * 预置角色仅「企业超级管理员」一个（PRD Q-ROL-03）：权限恒等于字典全集，
 * 因此这里不写死权限清单，由 store 在读取时按字典实时计算（超管自动获得新增权限点）。
 * 默认角色（source = 'default'）由平台统一维护，企业侧只读、可分配给成员；
 * 平台侧「企业角色管理」页对同一批数据做增删改。
 *
 * 自定义角色的 permissions 存「已授权节点」的收敛态，标识可位于任意层级：
 * - `'system'`：目录级授权（整块授予「系统管理」下全部功能）
 * - `'dashboard'`：无下级目录的授权（可进入工作台）
 * - `'system:member'`：菜单级授权（可进入企业成员页，但不含任何按钮操作）
 * - `'system:member:create'`：按钮级授权（最小颗粒度）
 * 注：仅授权按钮时会自动补齐其上级菜单的进入能力（见 role.ts 的 collapsePermissionKeys）。
 */
export const PRESET_ROLES: Role[] = [
  {
    id: PRESET_ROLE_ID,
    name: '企业超级管理员',
    desc: '系统预置角色，拥有本企业全部功能权限与全部数据权限',
    source: 'preset',
    permissions: [],
    createdAt: Date.now() - 30 * 24 * 60 * 60 * 1000,
  },
  {
    id: DEFAULT_ROLE_IDS[0],
    name: '企业运维管理员',
    desc: '平台默认角色：负责企业设备、告警与成员日常运维',
    source: 'default',
    permissions: [
      'dashboard',
      'location',
      'alarm',
      'alarm:export',
      'device:ledger',
      'device:ledger:control:timesync',
      'device:ledger:control:meterread',
      'device:ledger:control:switchon',
      'device:ledger:control:switchoff',
      'device:ledger:control:reconnect',
      'device:ledger:param',
      // 能源数据：可进入三个页面查看，不含导出 / 生成报告等操作权限
      'energy:monitor',
      'energy:analysis',
      'energy:report',
      'system:org',
      'system:member',
    ],
    createdAt: Date.now() - 20 * 24 * 60 * 60 * 1000,
  },
  {
    id: DEFAULT_ROLE_IDS[1],
    name: '企业只读成员',
    desc: '平台默认角色：可查看企业设备、告警与能源数据，不具备操作权限',
    source: 'default',
    permissions: [
      'dashboard',
      'location',
      'alarm',
      'device:ledger',
      'device:ota',
      'device:ota:content',
      'device:ota:record',
      // 能源数据仅可进入三个页面查看，不含导出 / 生成报表等按钮级权限
      'energy:monitor',
      'energy:analysis',
      'energy:report',
      'system:org',
      'system:member',
    ],
    createdAt: Date.now() - 18 * 24 * 60 * 60 * 1000,
  },
  {
    id: 'ROLE-02',
    name: '运维工程师',
    desc: '负责设备与能耗运维的一线人员',
    source: 'custom',
    // 告警中心：可查看 + 导出；设备管理：可查看设备台账 + 新增 / 编辑 / 迁移 / 全部设备控制指令（含两类清零）/ 设备参数配置 + 设备OTA 检测 / 升级 / 查看升级内容 / 查看升级进度与记录 + 负荷策略全部操作（PRD 3.1 运维工程师权限级别）
    permissions: [
      'dashboard',
      'location',
      'alarm',
      'alarm:export',
      'device:ledger',
      'device:ledger:create',
      'device:ledger:edit',
      'device:ledger:move',
      'device:ledger:importdelete',
      'device:ledger:control:timesync',
      'device:ledger:control:meterread',
      'device:ledger:control:switchon',
      'device:ledger:control:switchoff',
      'device:ledger:control:reconnect',
      'device:ledger:control:powerclear',
      'device:ledger:control:eventclear',
      'device:ledger:param',
      'device:ledger:mqtt:export',
      'device:ota',
      'device:ota:detect',
      'device:ota:upgrade',
      'device:ota:content',
      'device:ota:record',
      'device:power',
      'device:power:strategy',
      'device:power:strategy:create',
      'device:power:strategy:edit',
      'device:power:strategy:toggle',
      'device:power:strategy:delete',
      'device:power:strategy:record',
      // 能源数据：设备数据分析 + 统计报表（安全/系统运行报告用于运维定位），只读进入
      'energy:monitor',
      'energy:report',
      'system:org',
      'system:member',
      // 系统日志：可进入并查看两类日志 + 导出操作行为日志（查看为菜单级共用，导出按类型拆分）
      'system:log',
      'system:log:operation:export',
    ],
    createdAt: Date.now() - 12 * 24 * 60 * 60 * 1000,
  },
  {
    id: 'ROLE-03',
    name: '能源服务经理',
    desc: '负责客户能源服务对接与报表解读',
    source: 'custom',
    permissions: [
      'dashboard',
      'location',
      'alarm',
      'alarm:export',
      'device',
      // 能源数据：面向客户报表解读，可查看三类报告并生成、导出
      'energy:analysis',
      'energy:monitor',
      'energy:report',
      'energy:report:generate',
      'energy:report:export',
      'system:org',
      'system:member',
      'system:role',
      // 企业中心：仅维护企业联系人（演示「三个按钮级权限点相互独立」：档案与资质仍只读）
      'system:enterprise',
      'system:enterprise:contact:edit',
    ],
    createdAt: Date.now() - 10 * 24 * 60 * 60 * 1000,
  },
  {
    id: 'ROLE-04',
    name: '园区主管',
    desc: '负责园区层级结构维护与人员归属调整',
    source: 'custom',
    // 告警中心：可查看 + 导出 + 删除（PRD 3.1 企业管理员权限级别）；
    // 设备管理：设备台账整块授权（含批量添加与删除）；
    // 组织架构：整块授权（含全部节点操作）；企业成员：仅可进入 + 分配角色（不含新增 / 删除等）
    permissions: [
      'dashboard',
      'location',
      'alarm',
      'alarm:export',
      'alarm:delete',
      'device',
      // 能源数据：园区主管查看本范围统计报表
      'energy:report',
      'system:org',
      'system:member',
      'system:member:role:assign',
      'system:member:scope:bind',
    ],
    createdAt: Date.now() - 8 * 24 * 60 * 60 * 1000,
  },
  {
    id: 'ROLE-05',
    name: '只读查看',
    desc: '以查阅汇总数据为主的只读角色',
    source: 'custom',
    // 仅授予页面进入能力 + 设备OTA 的两个只读按钮（查看升级内容 / 查看升级进度与记录）
    // + 负荷策略的只读按钮（查看执行记录）→ 全站只读
    permissions: [
      'dashboard',
      'location',
      'alarm',
      'device:ledger',
      'device:ota',
      'device:ota:content',
      'device:ota:record',
      'device:power:strategy',
      'device:power:strategy:record',
      // 能源数据：只读查看三个页面，不含任何按钮级操作
      'energy:analysis',
      'energy:monitor',
      'energy:report',
      'system:org',
      'system:member',
      'system:role',
      // 企业中心：仅可进入查看（无任一按钮级权限点），用于验证卡片整体只读、不渲染「编辑」入口
      'system:enterprise',
      // 品牌设置：仅可进入查看与预览，不渲染编辑 / 保存 / 恢复默认入口
      'system:branding',
      // 系统日志：仅可进入查看两类日志（无任一导出权限点），用于验证「导出」入口不渲染
      'system:log',
    ],
    createdAt: Date.now() - 5 * 24 * 60 * 60 * 1000,
  },
  {
    id: 'ROLE-06',
    name: '能耗分析岗',
    desc: '面向能耗数据分析岗，权限待业务确认后再行配置',
    source: 'custom',
    permissions: [],
    createdAt: Date.now() - 2 * 24 * 60 * 60 * 1000,
  },
]
