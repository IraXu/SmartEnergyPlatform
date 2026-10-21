/**
 * 【原型说明】平台管理端的演示数据，仅用于原型交互验证，非生产代码。
 * 账号、角色、客户与指标贴近各 PRD v1.0 的功能范围与业务规则，不涉及真实客户数据、接口或数据库设计。
 */

import type {
  PlatformDevice,
  PlatformEnterprise,
  PlatformMember,
  PlatformOverview,
  PlatformRole,
  PlatformUnitNode,
} from '../store/types'

/** 【原型说明】预置平台角色标识：平台超级管理员，拥有全部平台权限，不可改权限、不可删除 */
export const PLATFORM_PRESET_ROLE_ID = 'PAL-ROLE-PRESET'

/** 【原型说明】内置平台超级管理员的账号标识（暂定） */
export const PLATFORM_SUPER_IDENTIFIER = 'admin@energyplatform.com'

const DAY = 24 * 60 * 60 * 1000
const now = Date.now()

/** 预置平台角色 + 2 个自定义平台角色示例 */
export const PRESET_PLATFORM_ROLES: PlatformRole[] = [
  {
    id: PLATFORM_PRESET_ROLE_ID,
    name: '平台超级管理员',
    desc: '系统预置角色，拥有全部平台功能权限',
    source: 'preset',
    // 预置角色权限恒等于字典全集，此处不写死，由 store 按字典实时计算
    permissions: [],
    createdAt: now - 60 * DAY,
  },
  {
    id: 'PAL-ROLE-02',
    name: '客户查看',
    desc: '仅可查看首页与客户&设备，不涉及平台成员与角色维护',
    source: 'custom',
    permissions: ['platform:home', 'platform:customer'],
    createdAt: now - 40 * DAY,
  },
  {
    id: 'PAL-ROLE-03',
    name: '平台成员管理员',
    desc: '可查看客户并维护平台成员，不可维护平台角色',
    source: 'custom',
    permissions: ['platform:home', 'platform:customer', 'platform:member', 'platform:member:create', 'platform:member:edit', 'platform:member:toggle', 'platform:member:resetpwd'],
    createdAt: now - 20 * DAY,
  },
]

/** 预置平台成员：内置超管 + 2 名运营成员 */
export const PRESET_PLATFORM_MEMBERS: PlatformMember[] = [
  {
    id: 'PAL-MEM-01',
    name: '平台超管',
    identifier: PLATFORM_SUPER_IDENTIFIER,
    password: 'Platform2026',
    super: true,
    status: 'normal',
    roleIds: [PLATFORM_PRESET_ROLE_ID],
    createdAt: now - 90 * DAY,
    updatedAt: now - 90 * DAY,
  },
  {
    id: 'PAL-MEM-02',
    name: '张运营',
    identifier: 'zhangyy@energyplatform.com',
    password: 'Platform2026',
    super: false,
    status: 'normal',
    roleIds: ['PAL-ROLE-02'],
    createdAt: now - 30 * DAY,
    updatedAt: now - 8 * DAY,
  },
  {
    id: 'PAL-MEM-03',
    name: '李客服',
    identifier: 'lics@energyplatform.com',
    password: 'Platform2026',
    super: false,
    status: 'disabled',
    roleIds: ['PAL-ROLE-03'],
    createdAt: now - 15 * DAY,
    updatedAt: now - 3 * DAY,
  },
]

/** 预置企业（用于「所属企业」筛选与统计口径汇总；设备总数为各企业在册口径） */
export const PRESET_ENTERPRISES: PlatformEnterprise[] = [
  { id: 'ORG-1001', name: '南京伊米特电子科技技术有限公司', deviceCount: 86, onlineCount: 62 },
  { id: 'ORG-1002', name: '上海星辰科技有限公司', deviceCount: 45, onlineCount: 33 },
  { id: 'ORG-1003', name: '北京云创科技股份公司', deviceCount: 23, onlineCount: 18 },
  { id: 'ORG-1005', name: '新加坡裕廊能源服务有限公司', deviceCount: 12, onlineCount: 8 },
]

/**
 * 各企业的用能单元树（平台端只读）。
 * 用于「所属企业 → 所属用能单元」的树选择联动：选定企业后仅展示该企业的用能单元。
 */
export const PRESET_ENTERPRISE_UNITS: Record<string, PlatformUnitNode[]> = {
  'ORG-1001': [
    {
      id: 'NJ-U-1',
      name: '一号厂房',
      children: [
        { id: 'NJ-U-1-1', name: '配电房' },
        { id: 'NJ-U-1-2', name: '照明回路' },
        { id: 'NJ-U-1-3', name: '动力回路' },
      ],
    },
    {
      id: 'NJ-U-2',
      name: '二号厂房',
      children: [
        { id: 'NJ-U-2-1', name: '配电房' },
        { id: 'NJ-U-2-2', name: '照明回路' },
      ],
    },
    { id: 'NJ-U-3', name: '厂区公共' },
  ],
  'ORG-1002': [
    {
      id: 'SH-U-1',
      name: '办公区',
      children: [
        { id: 'SH-U-1-1', name: '一层配电间' },
        { id: 'SH-U-1-2', name: '空调机房' },
        { id: 'SH-U-1-3', name: '照明回路' },
        { id: 'SH-U-1-4', name: '数据机房' },
      ],
    },
    { id: 'SH-U-2', name: '园区公共' },
  ],
  'ORG-1003': [
    {
      id: 'BJ-U-1',
      name: '门店',
      children: [
        { id: 'BJ-U-1-1', name: '总配电' },
        { id: 'BJ-U-1-2', name: '冷链区' },
        { id: 'BJ-U-1-3', name: '照明区' },
      ],
    },
  ],
  'ORG-1005': [
    {
      id: 'SG-U-1',
      name: '厂区',
      children: [
        { id: 'SG-U-1-1', name: '主配电室' },
        { id: 'SG-U-1-2', name: '光伏区' },
        { id: 'SG-U-1-3', name: '储能区' },
      ],
    },
  ],
}

/** 用能单元 id → 完整层级路径文本 */
const UNIT_PATH_TEXT: Record<string, string> = {
  'NJ-U-1': '南京伊米特电子科技技术有限公司 / 一号厂房',
  'NJ-U-1-1': '南京伊米特电子科技技术有限公司 / 一号厂房 / 配电房',
  'NJ-U-1-2': '南京伊米特电子科技技术有限公司 / 一号厂房 / 照明回路',
  'NJ-U-1-3': '南京伊米特电子科技技术有限公司 / 一号厂房 / 动力回路',
  'NJ-U-2': '南京伊米特电子科技技术有限公司 / 二号厂房',
  'NJ-U-2-1': '南京伊米特电子科技技术有限公司 / 二号厂房 / 配电房',
  'NJ-U-2-2': '南京伊米特电子科技技术有限公司 / 二号厂房 / 照明回路',
  'NJ-U-3': '南京伊米特电子科技技术有限公司 / 厂区公共',
  'SH-U-1': '上海星辰科技有限公司 / 办公区',
  'SH-U-1-1': '上海星辰科技有限公司 / 办公区 / 一层配电间',
  'SH-U-1-2': '上海星辰科技有限公司 / 办公区 / 空调机房',
  'SH-U-1-3': '上海星辰科技有限公司 / 办公区 / 照明回路',
  'SH-U-1-4': '上海星辰科技有限公司 / 办公区 / 数据机房',
  'SH-U-2': '上海星辰科技有限公司 / 园区公共',
  'BJ-U-1': '北京云创科技股份公司 / 门店',
  'BJ-U-1-1': '北京云创科技股份公司 / 门店 / 总配电',
  'BJ-U-1-2': '北京云创科技股份公司 / 门店 / 冷链区',
  'BJ-U-1-3': '北京云创科技股份公司 / 门店 / 照明区',
  'SG-U-1': '新加坡裕廊能源服务有限公司 / 厂区',
  'SG-U-1-1': '新加坡裕廊能源服务有限公司 / 厂区 / 主配电室',
  'SG-U-1-2': '新加坡裕廊能源服务有限公司 / 厂区 / 光伏区',
  'SG-U-1-3': '新加坡裕廊能源服务有限公司 / 厂区 / 储能区',
}

/** 用能单元完整层级路径（企业端「所属用能单元」列的只读展示口径） */
export const platformUnitPathText = (unitId: string): string => UNIT_PATH_TEXT[unitId] ?? '—'

/** 三相电表的指标占位（与设备台账类型字典字段名一致） */
const threePhaseMetrics = (base: number): Record<string, string> => {
  const drift = (value: number, step: number, digits = 1) => (value + (base % 7) * step).toFixed(digits)
  return {
    'A 相电压': drift(219.6, 0.4, 1),
    'AB 线电压': drift(380.9, 0.6, 1),
    'A 相电流': drift(84.2, 0.9, 1),
    'A 相有功功率': drift(18.46, 0.22, 2),
    'A 相无功功率': drift(5.2, 0.2, 2),
    'A 相视在功率': drift(19.21, 0.24, 2),
    'A 相功率因数': drift(0.951, 0.002, 3),
    'B 相电压': drift(220.1, 0.35, 1),
    'BC 线电压': drift(381.0, 0.6, 1),
    'B 相电流': drift(83.4, 0.8, 1),
    'B 相有功功率': drift(18.12, 0.2, 2),
    'B 相无功功率': drift(5.0, 0.18, 2),
    'B 相视在功率': drift(18.82, 0.22, 2),
    'B 相功率因数': drift(0.953, 0.002, 3),
    'C 相电压': drift(219.2, 0.38, 1),
    'C 相电流': drift(85.6, 0.85, 1),
    'C 相有功功率': drift(18.72, 0.21, 2),
    'C 相无功功率': drift(5.4, 0.19, 2),
    'C 相视在功率': drift(19.51, 0.23, 2),
    'C 相功率因数': drift(0.949, 0.002, 3),
    总有功电量: (125_360 + base * 128.4).toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
    正向有功电量: (125_360 + base * 128.4).toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
    反向无功电量: '482.7',
    正向无功电量: (18_420 + base * 9.3).toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
    反向有功电量: '1,204.2',
  }
}

/** 单相电表的指标占位 */
const singlePhaseMetrics = (base: number): Record<string, string> => ({
  'A 相电压': (219.4 + (base % 5) * 0.35).toFixed(1),
  'A 相电流': (3.1 + (base % 4) * 0.42).toFixed(1),
  'A 相有功功率': (0.68 + (base % 3) * 0.11).toFixed(2),
  'A 相无功功率': (0.06 + (base % 2) * 0.03).toFixed(2),
  'A 相视在功率': (0.71 + (base % 3) * 0.11).toFixed(2),
  'A 相功率因数': (0.951 + (base % 2) * 0.002).toFixed(3),
  总有功电量: (8420 + base * 13.7).toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
  正向有功电量: (8420 + base * 13.7).toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
  反向无功电量: '0.0',
  正向无功电量: '0.0',
  反向有功电量: '0.0',
})

/**
 * 预置平台设备（只读示例样本）
 * 字段口径与企业端「设备台账」一致；新增「所属企业」为首字段，供平台侧跨企业查看。
 * 为便于演示检索与筛选，此处给出跨 4 家企业的样本设备。
 */
export const PRESET_PLATFORM_DEVICES: PlatformDevice[] = [
  { id: 'PDEV-1001', enterpriseId: 'ORG-1001', enterpriseName: '南京伊米特电子科技技术有限公司', unitId: 'NJ-U-1-1', name: '1#配电房总表', license: 'LIC-NJ-0001', imei: '867630010001001', meterNo: '3201000001', cardNo: '89860619000000000101', type: '三相智能电表', model: 'DTZ341-3×220/380V', factory: '示例仪表厂', factoryDate: '2024-05-12', installDate: '2024-06-02', installPosition: '一号厂房一层东侧配电间 1 号柜', commType: '4G', protocol: 'DL/T645', gatewayImei: '867630019001001', lng: 118.7969, lat: 32.0603, latchStatus: '合闸', onlineStatus: '在线', signalStrength: '24', ctRatio: '40', ptRatio: '1', metrics: threePhaseMetrics(1), strategyTimeCount: 2, strategyLoadCount: 1, remark: '一层东侧主进线总表', createdAt: now - 42 * DAY },
  { id: 'PDEV-1002', enterpriseId: 'ORG-1001', enterpriseName: '南京伊米特电子科技技术有限公司', unitId: 'NJ-U-1-1', name: '1#配电房分表A', license: 'LIC-NJ-0002', imei: '867630010001002', meterNo: '3201000002', cardNo: '89860619000000000102', type: '三相智能电表', model: 'DTZ341-3×220/380V', factory: '示例仪表厂', factoryDate: '2024-05-12', installDate: '2024-06-02', installPosition: '一号厂房一层东侧配电间 2 号柜', commType: '4G', protocol: 'DL/T645', gatewayImei: '867630019001001', lng: 118.7969, lat: 32.0603, latchStatus: '合闸', onlineStatus: '在线', signalStrength: '21', ctRatio: '30', ptRatio: '1', metrics: threePhaseMetrics(2), strategyTimeCount: 1, strategyLoadCount: 0, remark: '', createdAt: now - 41 * DAY },
  { id: 'PDEV-1003', enterpriseId: 'ORG-1001', enterpriseName: '南京伊米特电子科技技术有限公司', unitId: 'NJ-U-1-1', name: '1#配电房分表B', license: 'LIC-NJ-0003', imei: '867630010001003', meterNo: '3201000003', cardNo: '89860619000000000103', type: '三相智能电表', model: 'DTZ341-3×220/380V', factory: '示例仪表厂', factoryDate: '2024-05-12', installDate: '2024-06-02', installPosition: '一号厂房一层东侧配电间 3 号柜', commType: '4G', protocol: 'DL/T645', gatewayImei: '867630019001001', lng: 118.7969, lat: 32.0603, latchStatus: '分闸', onlineStatus: '在线', signalStrength: '19', ctRatio: '30', ptRatio: '1', metrics: threePhaseMetrics(3), strategyTimeCount: 0, strategyLoadCount: 1, remark: '', createdAt: now - 40 * DAY },
  { id: 'PDEV-1004', enterpriseId: 'ORG-1001', enterpriseName: '南京伊米特电子科技技术有限公司', unitId: 'NJ-U-2-1', name: '2#配电房总表', license: 'LIC-NJ-0004', imei: '867630010001004', meterNo: '3201000004', cardNo: '89860619000000000104', type: '三相智能电表', model: 'DTZ341-3×220/380V', factory: '示例仪表厂', factoryDate: '2024-05-12', installDate: '2024-06-05', installPosition: '二号厂房一层配电间 1 号柜', commType: '4G', protocol: 'DL/T645', gatewayImei: '867630019001002', lng: 118.7975, lat: 32.0609, latchStatus: '合闸', onlineStatus: '离线', signalStrength: '', ctRatio: '50', ptRatio: '1', metrics: threePhaseMetrics(4), strategyTimeCount: 2, strategyLoadCount: 1, remark: '', createdAt: now - 39 * DAY },
  { id: 'PDEV-1005', enterpriseId: 'ORG-1001', enterpriseName: '南京伊米特电子科技技术有限公司', unitId: 'NJ-U-2-2', name: '厂房照明总表', license: 'LIC-NJ-0005', imei: '867630010001005', meterNo: '3201000005', cardNo: '89860619000000000105', type: '单相智能电表', model: 'DDS341-220V', factory: '示例仪表厂', factoryDate: '2024-05-12', installDate: '2024-06-05', installPosition: '二号厂房照明配电箱', commType: 'NB-IoT', protocol: 'DL/T645', gatewayImei: '', lng: 118.7975, lat: 32.0609, latchStatus: null, onlineStatus: '在线', signalStrength: '', ctRatio: '', ptRatio: '', metrics: singlePhaseMetrics(5), strategyTimeCount: 1, strategyLoadCount: 0, remark: '', createdAt: now - 38 * DAY },
  { id: 'PDEV-1006', enterpriseId: 'ORG-1001', enterpriseName: '南京伊米特电子科技技术有限公司', unitId: 'NJ-U-1', name: '厂区网关1', license: 'LIC-NJ-0006', imei: '867630019001001', meterNo: '', cardNo: '89860619000000000106', type: '智能网关', model: 'GW-200', factory: '示例通信厂', factoryDate: '2024-05-10', installDate: '2024-06-01', installPosition: '一号厂房配电间弱电柜', commType: '以太网', protocol: 'DL/T645 → MQTT', gatewayImei: '', lng: 118.7969, lat: 32.0603, latchStatus: null, onlineStatus: '在线', signalStrength: '', ctRatio: '', ptRatio: '', metrics: { 接入设备数: '12', 转发规约: 'DL/T645 → 云端 MQTT', 上行通信方式: '以太网（主）/ 4G（备）', 在线率: '99.2' }, strategyTimeCount: 0, strategyLoadCount: 0, remark: '', createdAt: now - 37 * DAY },
  { id: 'PDEV-1007', enterpriseId: 'ORG-1001', enterpriseName: '南京伊米特电子科技技术有限公司', unitId: 'NJ-U-2', name: '厂区网关2', license: 'LIC-NJ-0007', imei: '867630019001002', meterNo: '', cardNo: '89860619000000000107', type: '智能网关', model: 'GW-200', factory: '示例通信厂', factoryDate: '2024-05-10', installDate: '2024-06-01', installPosition: '二号厂房配电间弱电柜', commType: '4G', protocol: 'DL/T645 → MQTT', gatewayImei: '', lng: 118.7975, lat: 32.0609, latchStatus: null, onlineStatus: '离线', signalStrength: '', ctRatio: '', ptRatio: '', metrics: { 接入设备数: '8', 转发规约: 'DL/T645 → 云端 MQTT', 上行通信方式: '4G（主）/ 以太网（备）', 在线率: '96.4' }, strategyTimeCount: 0, strategyLoadCount: 0, remark: '', createdAt: now - 36 * DAY },
  { id: 'PDEV-1008', enterpriseId: 'ORG-1002', enterpriseName: '上海星辰科技有限公司', unitId: 'SH-U-1-1', name: '办公楼主表', license: 'LIC-SH-0001', imei: '867630020001001', meterNo: '3102000001', cardNo: '89860619000000000201', type: '三相智能电表', model: 'DTZ341-3×220/380V', factory: '示例仪表厂', factoryDate: '2024-07-01', installDate: '2024-07-20', installPosition: '办公楼一层配电间总柜', commType: '4G', protocol: 'DL/T645', gatewayImei: '867630029001001', lng: 121.4737, lat: 31.2304, latchStatus: '合闸', onlineStatus: '在线', signalStrength: '26', ctRatio: '60', ptRatio: '1', metrics: threePhaseMetrics(8), strategyTimeCount: 2, strategyLoadCount: 2, remark: '', createdAt: now - 30 * DAY },
  { id: 'PDEV-1009', enterpriseId: 'ORG-1002', enterpriseName: '上海星辰科技有限公司', unitId: 'SH-U-1-2', name: '空调专线表', license: 'LIC-SH-0002', imei: '867630020001002', meterNo: '3102000002', cardNo: '89860619000000000202', type: '三相智能电表', model: 'DTZ341-3×220/380V', factory: '示例仪表厂', factoryDate: '2024-07-01', installDate: '2024-07-20', installPosition: '办公楼空调机房配电柜', commType: '4G', protocol: 'DL/T645', gatewayImei: '867630029001001', lng: 121.4737, lat: 31.2304, latchStatus: '合闸', onlineStatus: '在线', signalStrength: '22', ctRatio: '40', ptRatio: '1', metrics: threePhaseMetrics(9), strategyTimeCount: 1, strategyLoadCount: 2, remark: '空调负荷专用', createdAt: now - 29 * DAY },
  { id: 'PDEV-1010', enterpriseId: 'ORG-1002', enterpriseName: '上海星辰科技有限公司', unitId: 'SH-U-1-3', name: '照明分表', license: 'LIC-SH-0003', imei: '867630020001003', meterNo: '3102000003', cardNo: '89860619000000000203', type: '单相智能电表', model: 'DDS341-220V', factory: '示例仪表厂', factoryDate: '2024-07-01', installDate: '2024-07-20', installPosition: '办公楼照明配电箱', commType: 'NB-IoT', protocol: 'DL/T645', gatewayImei: '', lng: 121.4737, lat: 31.2304, latchStatus: '分闸', onlineStatus: '离线', signalStrength: '', ctRatio: '', ptRatio: '', metrics: singlePhaseMetrics(10), strategyTimeCount: 1, strategyLoadCount: 0, remark: '', createdAt: now - 28 * DAY },
  { id: 'PDEV-1011', enterpriseId: 'ORG-1002', enterpriseName: '上海星辰科技有限公司', unitId: 'SH-U-1-4', name: '机房精密配电表', license: 'LIC-SH-0004', imei: '867630020001004', meterNo: '3102000004', cardNo: '89860619000000000204', type: '三相智能电表', model: 'DTZ341-3×220/380V', factory: '示例仪表厂', factoryDate: '2024-07-01', installDate: '2024-07-22', installPosition: '办公楼数据机房精密配电柜', commType: '以太网', protocol: 'Modbus-TCP', gatewayImei: '867630029001002', lng: 121.4737, lat: 31.2304, latchStatus: '合闸', onlineStatus: '在线', signalStrength: '', ctRatio: '80', ptRatio: '1', metrics: threePhaseMetrics(11), strategyTimeCount: 0, strategyLoadCount: 1, remark: '机房精密配电，重点监控', createdAt: now - 27 * DAY },
  { id: 'PDEV-1012', enterpriseId: 'ORG-1002', enterpriseName: '上海星辰科技有限公司', unitId: 'SH-U-1', name: '办公区网关', license: 'LIC-SH-0005', imei: '867630029001001', meterNo: '', cardNo: '89860619000000000205', type: '智能网关', model: 'GW-200', factory: '示例通信厂', factoryDate: '2024-06-28', installDate: '2024-07-18', installPosition: '办公楼一层弱电间', commType: '以太网', protocol: 'DL/T645 → MQTT', gatewayImei: '', lng: 121.4737, lat: 31.2304, latchStatus: null, onlineStatus: '在线', signalStrength: '', ctRatio: '', ptRatio: '', metrics: { 接入设备数: '10', 转发规约: 'DL/T645 → 云端 MQTT', 上行通信方式: '以太网（主）/ 4G（备）', 在线率: '99.6' }, strategyTimeCount: 0, strategyLoadCount: 0, remark: '', createdAt: now - 26 * DAY },
  { id: 'PDEV-1013', enterpriseId: 'ORG-1003', enterpriseName: '北京云创科技股份公司', unitId: 'BJ-U-1-1', name: '门店总表', license: 'LIC-BJ-0001', imei: '867630030001001', meterNo: '1101000001', cardNo: '89860619000000000301', type: '三相智能电表', model: 'DTZ341-3×220/380V', factory: '示例仪表厂', factoryDate: '2024-08-01', installDate: '2024-08-15', installPosition: '门店总配电箱', commType: '4G', protocol: 'DL/T645', gatewayImei: '867630039001001', lng: 116.4074, lat: 39.9042, latchStatus: '合闸', onlineStatus: '在线', signalStrength: '23', ctRatio: '40', ptRatio: '1', metrics: threePhaseMetrics(13), strategyTimeCount: 1, strategyLoadCount: 1, remark: '', createdAt: now - 20 * DAY },
  { id: 'PDEV-1014', enterpriseId: 'ORG-1003', enterpriseName: '北京云创科技股份公司', unitId: 'BJ-U-1-2', name: '冷柜回路表', license: 'LIC-BJ-0002', imei: '867630030001002', meterNo: '1101000002', cardNo: '89860619000000000302', type: '单相智能电表', model: 'DDS341-220V', factory: '示例仪表厂', factoryDate: '2024-08-01', installDate: '2024-08-15', installPosition: '门店冷链区配电箱', commType: 'NB-IoT', protocol: 'DL/T645', gatewayImei: '', lng: 116.4074, lat: 39.9042, latchStatus: '合闸', onlineStatus: '在线', signalStrength: '', ctRatio: '', ptRatio: '', metrics: singlePhaseMetrics(14), strategyTimeCount: 0, strategyLoadCount: 1, remark: '冷链回路，重点监控', createdAt: now - 19 * DAY },
  { id: 'PDEV-1015', enterpriseId: 'ORG-1003', enterpriseName: '北京云创科技股份公司', unitId: 'BJ-U-1-3', name: '广告照明分表', license: 'LIC-BJ-0003', imei: '867630030001003', meterNo: '1101000003', cardNo: '89860619000000000303', type: '单相智能电表', model: 'DDS341-220V', factory: '示例仪表厂', factoryDate: '2024-08-01', installDate: '2024-08-15', installPosition: '门店广告灯箱配电箱', commType: 'NB-IoT', protocol: 'DL/T645', gatewayImei: '', lng: 116.4074, lat: 39.9042, latchStatus: '分闸', onlineStatus: '离线', signalStrength: '', ctRatio: '', ptRatio: '', metrics: singlePhaseMetrics(15), strategyTimeCount: 1, strategyLoadCount: 0, remark: '', createdAt: now - 18 * DAY },
  { id: 'PDEV-1016', enterpriseId: 'ORG-1003', enterpriseName: '北京云创科技股份公司', unitId: 'BJ-U-1', name: '门店网关', license: 'LIC-BJ-0004', imei: '867630039001001', meterNo: '', cardNo: '89860619000000000304', type: '智能网关', model: 'GW-200', factory: '示例通信厂', factoryDate: '2024-07-28', installDate: '2024-08-12', installPosition: '门店弱电箱', commType: '4G', protocol: 'DL/T645 → MQTT', gatewayImei: '', lng: 116.4074, lat: 39.9042, latchStatus: null, onlineStatus: '在线', signalStrength: '', ctRatio: '', ptRatio: '', metrics: { 接入设备数: '6', 转发规约: 'DL/T645 → 云端 MQTT', 上行通信方式: '4G（主）/ 以太网（备）', 在线率: '98.1' }, strategyTimeCount: 0, strategyLoadCount: 0, remark: '', createdAt: now - 17 * DAY },
  { id: 'PDEV-1017', enterpriseId: 'ORG-1005', enterpriseName: '新加坡裕廊能源服务有限公司', unitId: 'SG-U-1-1', name: 'JTC 主表', license: 'LIC-SG-0001', imei: '867630040001001', meterNo: 'SG02000001', cardNo: '89860619000000000401', type: '三相智能电表', model: 'DTZ341-3×220/380V', factory: '示例仪表厂', factoryDate: '2024-09-01', installDate: '2024-09-20', installPosition: '厂区主配电室进线柜', commType: '4G', protocol: 'DL/T645', gatewayImei: '867630049001001', lng: 103.8198, lat: 1.3521, latchStatus: '合闸', onlineStatus: '在线', signalStrength: '25', ctRatio: '100', ptRatio: '1', metrics: threePhaseMetrics(17), strategyTimeCount: 1, strategyLoadCount: 1, remark: '', createdAt: now - 12 * DAY },
  { id: 'PDEV-1018', enterpriseId: 'ORG-1005', enterpriseName: '新加坡裕廊能源服务有限公司', unitId: 'SG-U-1-2', name: '光伏并网表', license: 'LIC-SG-0002', imei: '867630040001002', meterNo: 'SG02000002', cardNo: '89860619000000000402', type: '三相智能电表', model: 'DTZ341-3×220/380V', factory: '示例仪表厂', factoryDate: '2024-09-01', installDate: '2024-09-22', installPosition: '厂区光伏并网柜', commType: '4G', protocol: 'DL/T645', gatewayImei: '867630049001001', lng: 103.8198, lat: 1.3521, latchStatus: '分闸', onlineStatus: '离线', signalStrength: '', ctRatio: '60', ptRatio: '1', metrics: threePhaseMetrics(18), strategyTimeCount: 0, strategyLoadCount: 0, remark: '光伏并网点', createdAt: now - 11 * DAY },
  { id: 'PDEV-1019', enterpriseId: 'ORG-1005', enterpriseName: '新加坡裕廊能源服务有限公司', unitId: 'SG-U-1-3', name: '储能回路表', license: 'LIC-SG-0003', imei: '867630040001003', meterNo: 'SG02000003', cardNo: '89860619000000000403', type: '三相智能电表', model: 'DTZ341-3×220/380V', factory: '示例仪表厂', factoryDate: '2024-09-01', installDate: '2024-09-25', installPosition: '厂区储能区配电柜', commType: '以太网', protocol: 'Modbus-TCP', gatewayImei: '867630049001002', lng: 103.8198, lat: 1.3521, latchStatus: '合闸', onlineStatus: '在线', signalStrength: '', ctRatio: '80', ptRatio: '1', metrics: threePhaseMetrics(19), strategyTimeCount: 0, strategyLoadCount: 1, remark: '储能充放回路', createdAt: now - 10 * DAY },
]

/** 预置平台概览指标：默认全平台口径 */
export const PRESET_OVERVIEW: PlatformOverview = {
  customerCount: 4,
  deviceCount: 166,
  onlineDeviceCount: 121,
  updatedAt: now,
}
