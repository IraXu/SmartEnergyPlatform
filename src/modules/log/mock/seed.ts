/**
 * 【原型说明】系统日志模块的演示数据，仅用于原型交互验证。
 * 覆盖「登录日志」与「操作行为日志」两类日志、全部 8 个已定稿模块的变更类动作，
 * 以及交互文档 COMP-LOG-01 的五类变更明细形态；不涉及真实客户数据、接口或数据库设计。
 */

import { PRESET_MEMBERS } from '@/modules/member/mock/seed'
import type {
  ChangeDetail,
  LogFeature,
  LogModule,
  LoginLog,
  LoginMethod,
  LoginResult,
  OperationLog,
  SessionActionType,
} from '../store/types'

const DAY = 24 * 60 * 60 * 1000
const HOUR = 60 * 60 * 1000
const MINUTE = 60 * 1000

/* ---------- 查询条件级联：所属模块 → 功能 → 变更类型 ---------- */

/** 【原型演示数据】筛选级联选项，与《产品需求文档-系统日志》4.5 的变更类型清单一致 */
export const LOG_FEATURE_MAP: Record<LogModule, Array<{ feature: LogFeature; changeTypes: string[] }>> = {
  系统管理: [
    {
      feature: '组织架构',
      changeTypes: ['新增节点', '重命名节点', '移动节点', '同级排序', '删除节点', '编辑节点属性'],
    },
    {
      feature: '企业成员',
      changeTypes: [
        '新增成员',
        '编辑成员',
        '分配角色',
        '绑定数据范围',
        '启用成员',
        '停用成员',
        '重置密码',
        '删除成员',
      ],
    },
    { feature: '角色管理', changeTypes: ['新增角色', '重命名角色', '编辑角色描述', '配置角色权限', '删除角色'] },
    {
      feature: '企业中心',
      changeTypes: [
        '编辑企业档案',
        '上传企业 Logo',
        '更换企业 Logo',
        '删除企业 Logo',
        '编辑企业联系人',
        '编辑企业资质信息',
      ],
    },
  ],
  设备管理: [
    {
      feature: '设备台账',
      changeTypes: ['新增设备', '批量添加设备', '编辑设备', '迁移设备', '删除设备', '批量导入删除'],
    },
    { feature: '设备OTA', changeTypes: ['检测设备', '升级设备', '升级结果'] },
    {
      feature: '设备用电管控 › 负荷策略',
      changeTypes: ['新建策略', '编辑策略', '启用策略', '停用策略', '删除策略', '策略执行'],
    },
  ],
  告警中心: [{ feature: '告警中心', changeTypes: ['删除告警'] }],
}

export const LOG_MODULE_OPTIONS: LogModule[] = ['系统管理', '设备管理', '告警中心']

export const LOGIN_ACTION_OPTIONS: SessionActionType[] = ['登录', '退出登录']
export const LOGIN_METHOD_OPTIONS: LoginMethod[] = ['密码登录', '验证码登录', '注册后自动登录']
export const LOGIN_RESULT_OPTIONS: LoginResult[] = ['成功', '失败', '已锁定']

/* ---------- 登录日志演示数据 ---------- */

/** 【原型说明】来源终端只展示「浏览器 / 操作系统」两项，不再带设备类型 */
const TERMINALS = [
  'Chrome 130 / Windows 11',
  'Edge 130 / Windows 10',
  'Safari 18 / macOS 15',
  'Chrome 130 / macOS 15',
]

type LoginSeedRow = {
  identifier: string
  /** 操作类型；缺省为「登录」 */
  action?: SessionActionType
  dayOffset: number
  /** 非今日记录的当天时刻 HH:mm */
  time?: string
  method?: LoginMethod
  result: LoginResult
  failReason?: string
  ip: string
  terminal?: string
}

/**
 * 【原型演示数据】会话日志清单（登录 + 退出登录）。
 * 默认查询范围为「当日」，因此今日记录刻意铺满 12 条，覆盖：
 * 三种登录方式、成功 / 失败 / 已锁定三类结果、退出登录，以及「登录 → 退出登录」成对出现；
 * 非今日记录用于验证时间范围筛选。
 */
const LOGIN_SEED_ROWS: LoginSeedRow[] = [
  // 今日：登录成功 / 退出登录 / 失败 / 锁定
  { identifier: '+8613800138000', dayOffset: 0, method: '密码登录', result: '成功', ip: '203.0.113.24' },
  { identifier: '+8613900139000', dayOffset: 0, method: '密码登录', result: '成功', ip: '203.0.113.88' },
  { identifier: '+8613800138000', dayOffset: 0, action: '退出登录', result: '成功', ip: '203.0.113.24' },
  { identifier: '+8613500135000', dayOffset: 0, method: '密码登录', result: '失败', failReason: '密码错误', ip: '198.51.100.17' },
  { identifier: '+8613500135000', dayOffset: 0, method: '密码登录', result: '失败', failReason: '密码错误', ip: '198.51.100.17' },
  {
    identifier: '+8613500135000',
    dayOffset: 0,
    method: '密码登录',
    result: '已锁定',
    failReason: '连续失败 5 次，触发账号锁定',
    ip: '198.51.100.17',
    terminal: 'Chrome 130 / macOS 15',
  },
  { identifier: 'zhouxd@example.com', dayOffset: 0, method: '验证码登录', result: '成功', ip: '203.0.113.140', terminal: 'Edge 130 / Windows 10' },
  { identifier: 'zhouxd@example.com', dayOffset: 0, action: '退出登录', result: '成功', ip: '203.0.113.140', terminal: 'Edge 130 / Windows 10' },
  { identifier: '+8613600136000', dayOffset: 0, method: '验证码登录', result: '成功', ip: '203.0.113.51' },
  { identifier: '+6591234567', dayOffset: 0, method: '密码登录', result: '成功', ip: '175.139.20.6', terminal: 'Safari 18 / macOS 15' },
  { identifier: '+8613900139000', dayOffset: 0, action: '退出登录', result: '成功', ip: '203.0.113.88' },
  { identifier: 'lin.wei@example.com', dayOffset: 0, method: '密码登录', result: '失败', failReason: '账号不存在', ip: '198.51.100.203' },

  { identifier: '+8613600136000', dayOffset: 1, time: '09:12', method: '验证码登录', result: '成功', ip: '203.0.113.51' },
  { identifier: '+8613600136000', dayOffset: 1, time: '11:40', action: '退出登录', result: '成功', ip: '203.0.113.51' },
  { identifier: '+8613900139000', dayOffset: 1, time: '14:05', method: '密码登录', result: '失败', failReason: '密码错误', ip: '203.0.113.88' },
  { identifier: '+8613900139000', dayOffset: 1, time: '14:06', method: '密码登录', result: '成功', ip: '203.0.113.88' },
  { identifier: 'zhouxd@example.com', dayOffset: 1, time: '16:22', method: '验证码登录', result: '成功', ip: '203.0.113.140', terminal: 'Edge 130 / Windows 10' },

  { identifier: '+8613500135000', dayOffset: 2, time: '08:31', method: '密码登录', result: '失败', failReason: '密码错误', ip: '198.51.100.17' },
  { identifier: '+8613700137000', dayOffset: 2, time: '09:02', method: '密码登录', result: '失败', failReason: '账号已停用', ip: '192.0.2.44' },
  { identifier: '+8613700137000', dayOffset: 2, time: '09:03', method: '密码登录', result: '失败', failReason: '账号已停用', ip: '192.0.2.44' },
  { identifier: 'admin@example.com', dayOffset: 2, time: '11:48', method: '密码登录', result: '成功', ip: '203.0.113.9' },
  { identifier: 'admin@example.com', dayOffset: 2, time: '17:20', action: '退出登录', result: '成功', ip: '203.0.113.9' },

  { identifier: 'lin.wei@example.com', dayOffset: 4, time: '09:41', method: '密码登录', result: '失败', failReason: '账号不存在', ip: '198.51.100.203' },
  { identifier: 'lin.wei@example.com', dayOffset: 4, time: '09:42', method: '密码登录', result: '失败', failReason: '账号不存在', ip: '198.51.100.203' },
  { identifier: '+6591234567', dayOffset: 4, time: '18:33', method: '验证码登录', result: '成功', ip: '175.139.20.6', terminal: 'Safari 18 / macOS 15' },

  { identifier: '+8613900139000', dayOffset: 6, time: '07:55', method: '密码登录', result: '成功', ip: '203.0.113.88' },
  { identifier: '+8613800138000', dayOffset: 6, time: '20:12', method: '密码登录', result: '成功', ip: '203.0.113.24' },
  { identifier: '+8613800138000', dayOffset: 6, time: '21:05', action: '退出登录', result: '成功', ip: '203.0.113.24' },

  { identifier: '+8613500135000', dayOffset: 12, time: '10:26', method: '密码登录', result: '失败', failReason: '密码错误', ip: '198.51.100.17' },
  { identifier: '+8613800138000', dayOffset: 20, time: '09:00', method: '注册后自动登录', result: '成功', ip: '203.0.113.24' },
]

/** 姓名快照：优先取企业成员演示数据，缺失时留空（列表展示 `—`） */
function memberNameOf(identifier: string) {
  return PRESET_MEMBERS.find((member) => member.identifier === identifier)?.name ?? ''
}

/**
 * 【原型说明】生成初始会话日志：今日记录的时刻落在「今日 00:00 ~ 当前时间」之间，
 * 使默认「当日」范围下始终有数据可看。
 */
export function createPresetLoginLogs(): LoginLog[] {
  const now = Date.now()
  const dayStart = new Date()
  dayStart.setHours(0, 0, 0, 0)
  const base = dayStart.getTime()

  const todayRows = LOGIN_SEED_ROWS.filter((row) => row.dayOffset === 0)
  const elapsed = Math.max(now - base, todayRows.length * MINUTE)
  let todayIndex = 0

  const withTime = LOGIN_SEED_ROWS.map((row) => {
    if (row.dayOffset === 0) {
      const at = base + Math.round((elapsed * (todayRows.length - todayIndex)) / (todayRows.length + 1))
      todayIndex += 1
      return { row, at }
    }
    const [hour, minute] = (row.time ?? '00:00').split(':').map(Number)
    return { row, at: base - row.dayOffset * DAY + hour * HOUR + minute * MINUTE }
  })
  withTime.sort((a, b) => b.at - a.at)

  const daySeq = new Map<string, number>()
  return withTime.map(({ row, at }) => {
    const date = new Date(at)
    const key = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`
    const seq = (daySeq.get(key) ?? 0) + 1
    daySeq.set(key, seq)
    const action: SessionActionType = row.action ?? '登录'
    return {
      id: `LOGIN-${key}-${String(seq).padStart(3, '0')}`,
      at,
      action,
      account: row.identifier,
      accountName: memberNameOf(row.identifier),
      // 退出登录不适用登录方式与失败原因
      method: action === '退出登录' ? '' : (row.method ?? '密码登录'),
      result: row.result,
      failReason: action === '退出登录' ? '' : (row.failReason ?? ''),
      ip: row.ip,
      terminal: row.terminal ?? TERMINALS[seq % TERMINALS.length],
    }
  })
}


/* ---------- 操作行为日志演示数据 ---------- */

const field = (rows: Array<{ field: string; before: string; after: string }>): ChangeDetail => ({ kind: 'field', rows })

type OperationSeedRow = {
  dayOffset: number
  time: string
  identifier: string
  module: LogModule
  feature: LogFeature
  changeType: string
  objectType: string
  objectId: string
  objectName: string
  objectDeleted?: boolean
  summary: string
  detail: ChangeDetail
}

/**
 * 【原型演示数据】操作行为日志清单，覆盖 8 个模块与五类变更明细形态
 * （字段级前后值 / 权限点增删 / 状态变更 / 归属变更 / 对象清单）。
 */
const OPERATION_SEED_ROWS: OperationSeedRow[] = [
  // 角色管理：权限点增删清单
  {
    dayOffset: 0,
    time: '10:05',
    identifier: '+8613800138000',
    module: '系统管理',
    feature: '角色管理',
    changeType: '配置角色权限',
    objectType: '角色',
    objectId: 'ROLE-02',
    objectName: '运维工程师',
    summary: '新增权限点 2 项，移除权限点 1 项',
    detail: {
      kind: 'permission',
      added: ['系统管理 / 企业中心 / 维护企业联系人', '系统管理 / 系统日志 / 导出操作行为日志'],
      removed: ['设备管理 / 设备台账 / 批量删除设备'],
    },
  },
  // 企业中心：字段级前后值 + 同步影响（同步影响由页面按变更类型追加）
  {
    dayOffset: 0,
    time: '09:48',
    identifier: '+8613800138000',
    module: '系统管理',
    feature: '企业中心',
    changeType: '编辑企业档案',
    objectType: '企业',
    objectId: '南京伊米特电子科技技术有限公司',
    objectName: '南京伊米特电子科技技术有限公司',
    summary: '企业名称由「南京伊米特电子科技有限公司」改为「南京伊米特电子科技技术有限公司」',
    detail: field([
      { field: '企业名称', before: '南京伊米特电子科技有限公司', after: '南京伊米特电子科技技术有限公司' },
      { field: '企业所在地区', before: '广东省 / 深圳市', after: '广东省 / 深圳市' },
    ]),
  },
  // 企业成员：状态变更
  {
    dayOffset: 0,
    time: '09:20',
    identifier: '+8613800138000',
    module: '系统管理',
    feature: '企业成员',
    changeType: '停用成员',
    objectType: '企业成员',
    objectId: '+8613700137000',
    objectName: '王强',
    summary: '启用 → 停用',
    detail: { kind: 'state', before: '启用', after: '停用' },
  },
  // 组织架构：归属变更
  {
    dayOffset: 0,
    time: '08:57',
    identifier: '+8613800138000',
    module: '系统管理',
    feature: '组织架构',
    changeType: '移动节点',
    objectType: '用能单元',
    objectId: '1 号厂房 / 一层 / 1 号配电房',
    objectName: '1 号配电房',
    summary: '由「1 号厂房 / 一层」移动至「1 号厂房 / 二层」',
    detail: { kind: 'ownership', before: '1 号厂房 / 一层', after: '1 号厂房 / 二层' },
  },
  // 设备台账：对象清单
  {
    dayOffset: 1,
    time: '17:32',
    identifier: '+8613900139000',
    module: '设备管理',
    feature: '设备台账',
    changeType: '批量添加设备',
    objectType: '设备',
    objectId: 'LIC-8F2A-1043-7C61 等 3 台',
    objectName: '批量导入设备清单',
    summary: '导入文件「设备台账模板-0905.xlsx」，成功 2 台、失败 1 台',
    detail: {
      kind: 'objects',
      total: 3,
      rows: [
        { name: '1 号总表（LIC-8F2A-1043-7C61）', result: '成功', note: '归属 1 号厂房 / 一层 / 1 号配电房' },
        { name: '2 号车间动力表（LIC-8F2A-1044-7C62）', result: '成功', note: '归属 1 号厂房 / 一层 / 2 号配电房' },
        { name: '临时施工用电表（LIC-7C05-3312-5E24）', result: '失败', note: '用能单元编码未匹配到节点' },
      ],
    },
  },
  // 设备OTA：状态变更
  {
    dayOffset: 1,
    time: '15:08',
    identifier: '+8613900139000',
    module: '设备管理',
    feature: '设备OTA',
    changeType: '升级设备',
    objectType: '设备',
    objectId: 'LIC-9B31-2207-4D08',
    objectName: '中央空调机房总表',
    summary: '升级任务 OTA-20260905-01 成功，固件 V1.2.0 → V1.3.1',
    detail: { kind: 'state', before: 'V1.2.0', after: 'V1.3.1' },
  },
  // 负荷策略：策略执行对象清单
  {
    dayOffset: 1,
    time: '02:00',
    identifier: '+8613800138000',
    module: '设备管理',
    feature: '设备用电管控 › 负荷策略',
    changeType: '策略执行',
    objectType: '负荷策略',
    objectId: 'STR-0003',
    objectName: '夜间非生产区拉闸',
    summary: '触发来源「时控」，拉闸 3 台，全部成功',
    detail: {
      kind: 'objects',
      total: 3,
      rows: [
        { name: '临时施工用电表', result: '成功', note: '已下发分闸指令' },
        { name: '中央空调机房总表', result: '成功', note: '已下发分闸指令' },
        { name: '2 号车间动力表', result: '成功', note: '已下发分闸指令' },
      ],
    },
  },
  // 告警中心：删除告警
  {
    dayOffset: 1,
    time: '11:26',
    identifier: '+8613800138000',
    module: '告警中心',
    feature: '告警中心',
    changeType: '删除告警',
    objectType: '告警',
    objectId: 'ALM-20260905-0007',
    objectName: '开表盖 / 1 号总表',
    summary: '删除告警「ALM-20260905-0007」（开表盖 / 864512030001001）',
    detail: {
      kind: 'text',
      text: '告警编号 ALM-20260905-0007；事件类型 开表盖；设备编号 864512030001001；所在用能单元 1 号厂房 / 一层 / 1 号配电房',
    },
  },
  // 角色管理：新增角色（对象已删除的场景）
  {
    dayOffset: 2,
    time: '16:41',
    identifier: '+8613800138000',
    module: '系统管理',
    feature: '角色管理',
    changeType: '删除角色',
    objectType: '角色',
    objectId: 'ROLE-07',
    objectName: '临时巡检员',
    objectDeleted: true,
    summary: '删除角色「临时巡检员」（删除前有 4 项权限）',
    detail: {
      kind: 'text',
      text: '角色名称 临时巡检员；角色描述 临时巡检岗位；删除前权限点数量 4 项',
    },
  },
  // 企业成员：重置密码（不含密码内容）
  {
    dayOffset: 2,
    time: '14:12',
    identifier: '+8613800138000',
    module: '系统管理',
    feature: '企业成员',
    changeType: '重置密码',
    objectType: '企业成员',
    objectId: '+8613600136000',
    objectName: '孙立',
    summary: '重置该成员密码（日志不记录密码内容）',
    detail: { kind: 'text', text: '为该成员生成了新的初始密码，首次登录需修改密码；日志不记录密码内容' },
  },
  // 组织架构：同级排序
  {
    dayOffset: 2,
    time: '10:03',
    identifier: '+8613800138000',
    module: '系统管理',
    feature: '组织架构',
    changeType: '同级排序',
    objectType: '组织节点',
    objectId: '1 号厂房 / 一层',
    objectName: '一层',
    summary: '上移一位，与「二层」交换顺序',
    detail: { kind: 'text', text: '在同级节点中上移一位，与「二层」交换排列顺序' },
  },
  // 设备台账：编辑设备（字段级）
  {
    dayOffset: 4,
    time: '15:37',
    identifier: '+8613900139000',
    module: '设备管理',
    feature: '设备台账',
    changeType: '编辑设备',
    objectType: '设备',
    objectId: 'LIC-8F2A-1044-7C62',
    objectName: '2 号车间动力表',
    summary: '变更设备名称、规格型号',
    detail: field([
      { field: '设备名称', before: '2 号车间动力表', after: '2 号车间动力总表' },
      { field: '规格型号', before: 'DTSD341-MA3', after: 'DTSD341-MA4' },
    ]),
  },
  // 企业中心：更换 Logo
  {
    dayOffset: 4,
    time: '11:05',
    identifier: '+8613800138000',
    module: '系统管理',
    feature: '企业中心',
    changeType: '更换企业 Logo',
    objectType: '企业',
    objectId: '南京伊米特电子科技技术有限公司',
    objectName: '南京伊米特电子科技技术有限公司',
    summary: '更换企业 Logo（logo-2026.png，86KB）',
    detail: { kind: 'text', text: '更换企业 Logo：文件名 logo-2026.png，大小 86KB；日志不记录图片内容' },
  },
  // 企业成员：分配角色（归属变更）
  {
    dayOffset: 5,
    time: '09:33',
    identifier: '+8613800138000',
    module: '系统管理',
    feature: '企业成员',
    changeType: '分配角色',
    objectType: '企业成员',
    objectId: '+8613500135000',
    objectName: '赵敏',
    summary: '角色由「园区主管」调整为「能源服务经理」',
    detail: { kind: 'ownership', before: '园区主管', after: '能源服务经理' },
  },
  // 负荷策略：新建策略（字段级）
  {
    dayOffset: 5,
    time: '08:41',
    identifier: '+8613900139000',
    module: '设备管理',
    feature: '设备用电管控 › 负荷策略',
    changeType: '新建策略',
    objectType: '负荷策略',
    objectId: 'STR-0004',
    objectName: '营业时间限电',
    summary: '新建时控策略，作用于 5 台设备',
    detail: field([
      { field: '触发方式', before: '—', after: '时控 / 按周' },
      { field: '时间点', before: '—', after: '周一至周五 09:00 合闸、18:00 拉闸' },
      { field: '作用对象', before: '—', after: '1 号厂房（含 5 台设备）' },
      { field: '生效期', before: '—', after: '2026-09-10 ~ 2026-12-31' },
    ]),
  },
  // 设备台账：迁移设备（归属变更）
  {
    dayOffset: 6,
    time: '16:58',
    identifier: '+8613900139000',
    module: '设备管理',
    feature: '设备台账',
    changeType: '迁移设备',
    objectType: '设备',
    objectId: 'LIC-8F2A-1043-7C61',
    objectName: '1 号总表',
    summary: '所属用能单元由「1 号配电房」迁移至「2 号配电房」',
    detail: {
      kind: 'ownership',
      before: '1 号厂房 / 一层 / 1 号配电房',
      after: '1 号厂房 / 一层 / 2 号配电房',
    },
  },
  // 告警中心：批量删除
  {
    dayOffset: 8,
    time: '17:20',
    identifier: '+8613800138000',
    module: '告警中心',
    feature: '告警中心',
    changeType: '删除告警',
    objectType: '告警',
    objectId: 'ALM-20260829-0003 等 6 条',
    objectName: '批量删除告警',
    summary: '批量删除告警 6 条',
    detail: {
      kind: 'objects',
      total: 6,
      rows: [
        { name: 'ALM-20260829-0003（电压不平衡）', result: '成功', note: '1 号总表' },
        { name: 'ALM-20260829-0004（C相断流）', result: '成功', note: '2 号车间动力表' },
        { name: 'ALM-20260829-0005（过温）', result: '成功', note: '中央空调机房总表' },
        { name: 'ALM-20260829-0006（开端钮盖）', result: '成功', note: '华东园区总配电表' },
        { name: 'ALM-20260829-0007（潮流反向）', result: '成功', note: '临时施工用电表' },
        { name: 'ALM-20260829-0008（A相过压）', result: '成功', note: '1 号总表' },
      ],
    },
  },
  // 组织架构：新增节点
  {
    dayOffset: 12,
    time: '10:15',
    identifier: '+8613800138000',
    module: '系统管理',
    feature: '组织架构',
    changeType: '新增节点',
    objectType: '用能单元',
    objectId: '2 号厂房 / 三层 / 3 号配电房',
    objectName: '3 号配电房',
    summary: '新增用能单元「3 号配电房」',
    detail: { kind: 'text', text: '在「2 号厂房 / 三层」下新增用能单元「3 号配电房」，编码自动生成为 UNIT-0013' },
  },
  // 企业中心：编辑资质信息
  {
    dayOffset: 20,
    time: '14:26',
    identifier: '+8613800138000',
    module: '系统管理',
    feature: '企业中心',
    changeType: '编辑企业资质信息',
    objectType: '企业',
    objectId: '南京伊米特电子科技技术有限公司',
    objectName: '南京伊米特电子科技技术有限公司',
    summary: '填写统一社会信用代码、注册地址，上传营业执照',
    detail: field([
      { field: '统一社会信用代码', before: '—', after: '91320100MA1XXXXX2A' },
      { field: '注册地址', before: '—', after: '江苏省南京市江宁区某路 1 号' },
      { field: '营业执照', before: '未上传', after: '已上传（营业执照.jpg）' },
    ]),
  },
]

/** 【原型说明】生成初始操作行为日志；按时间倒序排列 */
export function createPresetOperationLogs(): OperationLog[] {
  const dayStart = new Date()
  dayStart.setHours(0, 0, 0, 0)
  const base = dayStart.getTime()

  const daySeq = new Map<string, number>()
  const rows = OPERATION_SEED_ROWS.map((row) => {
    const [hour, minute] = row.time.split(':').map(Number)
    const at = base - row.dayOffset * DAY + hour * HOUR + minute * MINUTE
    const date = new Date(at)
    const key = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`
    const seq = (daySeq.get(key) ?? 0) + 1
    daySeq.set(key, seq)
    return {
      id: `OPLOG-${key}-${String(seq).padStart(3, '0')}`,
      at,
      account: row.identifier,
      accountName: memberNameOf(row.identifier),
      module: row.module,
      feature: row.feature,
      changeType: row.changeType,
      objectType: row.objectType,
      objectId: row.objectId,
      objectName: row.objectName,
      objectDeleted: row.objectDeleted,
      summary: row.summary,
      detail: row.detail,
    } satisfies OperationLog
  })
  rows.sort((a, b) => b.at - a.at)
  return rows
}
