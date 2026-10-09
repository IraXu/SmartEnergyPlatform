/**
 * 【原型说明】设备台账模块的演示数据，仅用于原型交互验证。
 * 设备类型字典为本期收敛后的 3 类（智能电表 / 三相智能电表 / 智能网关），
 * 结构与文案贴近页面信息项，不涉及真实客户数据、接口或数据库设计。
 *
 * 设备所属用能单元的层级路径取自「系统管理 › 组织架构」的真实节点（见 modules/org/mock/seed.ts），
 * 本文件只引用其节点 id，不重复维护组织架构数据。
 */

import type { Device, DeviceMetrics, DeviceTypeItem } from '../store/types'
import { BULK_UNITS } from '@/modules/org/mock/seed'

/**
 * 【原型演示数据】设备类型字典（本期 3 类）。
 * 新增 / 编辑表单不选择设备类型：类型由设备上云后服务端返回；
 * 本清单用于列表标签、查询条件与详情页专属数据区的呈现口径。
 *
 * 电表专属数据按「相别分组 + 电量分组」组织，与现场抄见口径一致：
 * 单相电表仅 A 相；三相电表含 A / B / C 三相。数值单位由字段定义给出，
 * 详情页按「数值（大字号）+ 单位（小字）」呈现。
 */
export const DEVICE_TYPES: DeviceTypeItem[] = [
  {
    name: '智能电表',
    category: '计量表计',
    groups: [
      {
        title: 'A 相',
        fields: [
          { name: 'A 相电压', unit: 'V' },
          { name: 'A 相电流', unit: 'A' },
          { name: 'A 相有功功率', unit: 'kW' },
          { name: 'A 相无功功率', unit: 'kVar' },
          { name: 'A 相视在功率', unit: 'kVA' },
          { name: 'A 相功率因数' },
        ],
      },
      {
        title: '电量',
        fields: [
          { name: '总有功电量', unit: 'kWh' },
          { name: '正向有功电量', unit: 'kWh' },
          { name: '反向无功电量', unit: 'kvarh' },
          { name: '正向无功电量', unit: 'kvarh' },
          { name: '反向有功电量', unit: 'kWh' },
        ],
      },
    ],
  },
  {
    name: '三相智能电表',
    category: '计量表计',
    groups: [
      {
        title: 'A 相',
        fields: [
          { name: 'A 相电压', unit: 'V' },
          { name: 'AB 线电压', unit: 'V' },
          { name: 'A 相电流', unit: 'A' },
          { name: 'A 相有功功率', unit: 'kW' },
          { name: 'A 相无功功率', unit: 'kVar' },
          { name: 'A 相视在功率', unit: 'kVA' },
          { name: 'A 相功率因数' },
        ],
      },
      {
        title: 'B 相',
        fields: [
          { name: 'B 相电压', unit: 'V' },
          { name: 'BC 线电压', unit: 'V' },
          { name: 'B 相电流', unit: 'A' },
          { name: 'B 相有功功率', unit: 'kW' },
          { name: 'B 相无功功率', unit: 'kVar' },
          { name: 'B 相视在功率', unit: 'kVA' },
          { name: 'B 相功率因数' },
        ],
      },
      {
        title: 'C 相',
        fields: [
          { name: 'C 相电压', unit: 'V' },
          { name: 'C 相电流', unit: 'A' },
          { name: 'C 相有功功率', unit: 'kW' },
          { name: 'C 相无功功率', unit: 'kVar' },
          { name: 'C 相视在功率', unit: 'kVA' },
          { name: 'C 相功率因数' },
        ],
      },
      {
        title: '电量',
        fields: [
          { name: '总有功电量', unit: 'kWh' },
          { name: '正向有功电量', unit: 'kWh' },
          { name: '反向无功电量', unit: 'kvarh' },
          { name: '正向无功电量', unit: 'kvarh' },
          { name: '反向有功电量', unit: 'kWh' },
        ],
      },
    ],
  },
  {
    name: '智能网关',
    category: '网关设备',
    groups: [
      {
        title: '接入',
        fields: [{ name: '接入设备数', unit: '台' }, { name: '转发规约' }],
      },
      {
        title: '通信',
        fields: [
          { name: '上行通信方式' },
          { name: '在线率', unit: '%' },
          { name: '最近心跳时间' },
        ],
      },
    ],
  },
]

const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR

/** 相对当前时间的偏移，保证演示数据的时间始终「新鲜」 */
const ago = (days: number, hours = 0) => Date.now() - days * DAY - hours * HOUR

/**
 * 【原型说明】设备图片由「智慧物联生态平台」按设备类型维护：
 * 智能电表 / 三相智能电表直接引用该平台返回的图片地址；
 * 智能网关该平台暂未提供对应图片，先用文生图产物占位，待平台补齐后替换为平台地址。
 */
const IOT_SAFE_IMAGE_BASE = 'https://esa-resource.iot-safe.com/images/typeImage'

const DEVICE_IMAGES: Record<string, string> = {
  // 智慧物联生态平台返回的图片
  智能电表: `${IOT_SAFE_IMAGE_BASE}/L6330Model.png`,
  三相智能电表: `${IOT_SAFE_IMAGE_BASE}/L6330Model.png`,
  // 平台暂未提供，占位图
  智能网关:
    'https://coresg-normal.trae.ai/api/ide/v1/text_to_image?prompt=' +
    encodeURIComponent(
      'product photo of an industrial IoT communication gateway, dark grey metal enclosure with 4G antenna and ethernet ports, isolated on pure white background, studio lighting, centered, no shadow',
    ) +
    '&image_size=square',
}

/**
 * 设备图片兜底图：对应设备在「智慧物联生态平台」未维护图片时展示，
 * 也与设备上云前（无设备类型）的场景对应。
 */
export const DEFAULT_DEVICE_IMAGE =
  'https://coresg-normal.trae.ai/api/ide/v1/text_to_image?prompt=' +
  encodeURIComponent(
    'minimal flat illustration of a generic industrial IoT device placeholder, simple grey device outline centered on a light neutral background',
  ) +
  '&image_size=square'

/**
 * 【原型演示数据】设备台账初始数据。
 * 覆盖两类归类（计量表计 / 网关设备）与在线 / 离线、拉合闸状态；
 * unitId 指向组织架构模块中的用能单元节点（见 modules/org/mock/seed.ts）。
 * 设备类型、卡号（ICCID）与表号均为设备上云后由服务端 / 网关返回的只读值，未上云设备为空。
 * GPS 默认取所属用能单元坐标（gpsCustom 为 false）；个别设备为「地图选点自定义」的演示样本。
 * metrics 只存数值文本，单位由设备类型字典的字段定义提供。
 * hasImage 仅用于演示数据：false 表示该设备在「智慧物联生态平台」未维护图片，卡片展示兜底图。
 */
const PRESET_DEVICES: Array<Omit<Device, 'id' | 'createdAt' | 'imageUrl'> & { hasImage?: boolean }> = [
  {
    name: '1 号总表',
    imei: '864512030001001',
    // 与上级网关（A 栋接入网关）通讯，以表号做唯一判定
    meterNo: '320000000001',
    cardNo: '89860619000000000001',
    license: 'LIC-8F2A-1043-7C61',
    type: '三相智能电表',
    model: 'DTZ341-3×220/380V',
    factory: '示例仪表厂',
    factoryDate: '2026-06-12',
    unitId: 'NODE-P1-B1-U1',
    installDate: '2026-07-02',
    installPosition: 'A 栋一层东侧配电间 1 号柜',
    lng: 113.8847,
    lat: 22.5654,
    gpsCustom: false,
    commType: '4G',
    protocol: 'DL/T645',
    gatewayImei: '864512039001001',
    onlineStatus: '在线',
    latchStatus: '合闸',
    signalStrength: '24',
    accessedAt: ago(60),
    lastReportAt: ago(0, 0.2),
    metrics: {
      'A 相电压': '220.4',
      'AB 线电压': '381.3',
      'A 相电流': '186.2',
      'A 相有功功率': '41.02',
      'A 相无功功率': '12.4',
      'A 相视在功率': '42.85',
      'A 相功率因数': '0.957',
      'B 相电压': '221.1',
      'BC 线电压': '382.2',
      'B 相电流': '184.5',
      'B 相有功功率': '40.68',
      'B 相无功功率': '11.9',
      'B 相视在功率': '42.39',
      'B 相功率因数': '0.960',
      'C 相电压': '219.8',
      'C 相电流': '188.9',
      'C 相有功功率': '41.35',
      'C 相无功功率': '13.1',
      'C 相视在功率': '43.38',
      'C 相功率因数': '0.953',
      总有功电量: '128,430.6',
      正向有功电量: '128,430.6',
      反向无功电量: '482.7',
      正向无功电量: '36,905.4',
      反向有功电量: '1,204.2',
    },
    remark: '一层东侧主进线总表',
  },
  {
    name: '2 号车间动力表',
    imei: '864512030001002',
    // 与上级网关通讯，以表号做唯一判定
    meterNo: '320000000002',
    cardNo: '89860619000000000002',
    license: 'LIC-8F2A-1044-7C62',
    type: '三相智能电表',
    model: 'DTZ341-3×220/380V',
    factory: '示例仪表厂',
    factoryDate: '2026-06-12',
    unitId: 'NODE-P1-B1-U2',
    installDate: '2026-07-02',
    installPosition: 'A 栋一层西侧配电间 3 号柜',
    // 该设备安装位置与用能单元不同，GPS 为地图选点自定义
    lng: 113.8852,
    lat: 22.5661,
    gpsCustom: true,
    commType: '4G',
    protocol: 'DL/T645',
    gatewayImei: '864512039001001',
    onlineStatus: '离线',
    latchStatus: '分闸',
    signalStrength: '',
    accessedAt: ago(60),
    lastReportAt: ago(2, 5),
    metrics: {
      'A 相电压': '—',
      'AB 线电压': '—',
      'A 相电流': '—',
      'A 相有功功率': '—',
      'A 相无功功率': '—',
      'A 相视在功率': '—',
      'A 相功率因数': '—',
      'B 相电压': '—',
      'BC 线电压': '—',
      'B 相电流': '—',
      'B 相有功功率': '—',
      'B 相无功功率': '—',
      'B 相视在功率': '—',
      'B 相功率因数': '—',
      'C 相电压': '—',
      'C 相电流': '—',
      'C 相有功功率': '—',
      'C 相无功功率': '—',
      'C 相视在功率': '—',
      'C 相功率因数': '—',
      总有功电量: '86,120.8',
      正向有功电量: '86,120.8',
      反向无功电量: '0.0',
      正向无功电量: '22,140.1',
      反向有功电量: '0.0',
    },
    remark: '注塑机主回路',
  },
  {
    name: '中央空调机房总表',
    imei: '864512030001003',
    // 以太网直连、不经网关，无表号，以设备识别码（IMEI）唯一判定
    meterNo: '',
    cardNo: '89860619000000000003',
    license: 'LIC-9B31-2207-4D08',
    type: '三相智能电表',
    model: 'DTZ341-3×220/380V',
    factory: '示例仪表厂',
    factoryDate: '2026-05-20',
    unitId: 'NODE-P1-B2-U1',
    installDate: '2026-06-05',
    installPosition: 'B 栋地下一层制冷机房配电柜',
    lng: 113.8814,
    lat: 22.5639,
    gpsCustom: false,
    commType: '以太网',
    protocol: 'DL/T645',
    gatewayImei: '',
    onlineStatus: '在线',
    latchStatus: '合闸',
    // 以太网直连，无信号强度
    signalStrength: '',
    accessedAt: ago(110),
    lastReportAt: ago(0, 0.1),
    metrics: {
      'A 相电压': '219.6',
      'AB 线电压': '379.8',
      'A 相电流': '92.4',
      'A 相有功功率': '20.28',
      'A 相无功功率': '5.1',
      'A 相视在功率': '21.0',
      'A 相功率因数': '0.966',
      'B 相电压': '220.2',
      'BC 线电压': '380.6',
      'B 相电流': '94.1',
      'B 相有功功率': '20.71',
      'B 相无功功率': '5.4',
      'B 相视在功率': '21.4',
      'B 相功率因数': '0.968',
      'C 相电压': '220.7',
      'C 相电流': '90.7',
      'C 相有功功率': '20.02',
      'C 相无功功率': '4.9',
      'C 相视在功率': '20.6',
      'C 相功率因数': '0.972',
      总有功电量: '242,880.3',
      正向有功电量: '242,880.3',
      反向无功电量: '0.0',
      正向无功电量: '61,420.9',
      反向有功电量: '0.0',
    },
    remark: '集中供冷主计量',
  },
  {
    name: '华东园区总配电表',
    imei: '864512030001004',
    meterNo: '320000000004',
    cardNo: '89860619000000000004',
    license: 'LIC-9B31-2208-4D09',
    type: '智能电表',
    model: 'DDS341-220V',
    factory: '示例仪表厂',
    factoryDate: '2026-08-01',
    unitId: 'NODE-P2-U1',
    installDate: '2026-08-18',
    installPosition: '园区北侧独立配电房主进线柜',
    lng: 120.0435,
    lat: 30.2818,
    gpsCustom: false,
    commType: '4G',
    protocol: 'DL/T645',
    gatewayImei: '864512039001002',
    onlineStatus: '在线',
    latchStatus: '合闸',
    signalStrength: '17',
    accessedAt: ago(30),
    lastReportAt: ago(0, 0.4),
    metrics: {
      'A 相电压': '219.0',
      'A 相电流': '2.1',
      'A 相有功功率': '0.46',
      'A 相无功功率': '0.0',
      'A 相视在功率': '0.46',
      'A 相功率因数': '0.999',
      总有功电量: '0.26',
      正向有功电量: '0.26',
      反向无功电量: '0.0',
      正向无功电量: '0.0',
      反向有功电量: '0.0',
    },
    remark: '含光伏倒送计量',
  },
  {
    name: '临时施工用电表',
    imei: '864512030001005',
    // 未上云：表号由平台在设备上云后返回，暂为空
    meterNo: '',
    cardNo: '',
    license: 'LIC-7C05-3312-5E24',
    type: '',
    model: 'DDS341-220V',
    factory: '示例仪表厂',
    factoryDate: '2026-08-20',
    unitId: 'NODE-P1-B1-U2',
    installDate: '2026-09-01',
    installPosition: 'A 栋西侧临时配电箱',
    lng: 113.8849,
    lat: 22.5658,
    gpsCustom: false,
    commType: '4G',
    protocol: 'DL/T645',
    gatewayImei: '864512039001001',
    // 设备未上云，无上报数据，按离线呈现
    onlineStatus: '离线',
    latchStatus: null,
    signalStrength: '',
    accessedAt: null,
    lastReportAt: null,
    metrics: {},
    remark: '施工临时用电，投产前拆除',
    // 演示：该设备在「智慧物联生态平台」未维护图片，卡片展示兜底图
    hasImage: false,
  },
  {
    name: 'A 栋接入网关',
    imei: '864512039001001',
    // 网关设备本身不参与表号定位（表号用于经其接入的表计）
    meterNo: '',
    cardNo: '89860619000000000006',
    license: 'LIC-GW01-7788-11A2',
    type: '智能网关',
    model: 'GW-200',
    factory: '示例通信厂',
    factoryDate: '2026-06-01',
    unitId: 'NODE-P1-B1-U1',
    installDate: '2026-06-28',
    installPosition: 'A 栋一层弱电间',
    lng: 113.8847,
    lat: 22.5654,
    gpsCustom: false,
    commType: '4G',
    protocol: 'Modbus-TCP',
    gatewayImei: '',
    onlineStatus: '在线',
    // 网关无供电回路，不呈现拉合闸状态
    latchStatus: null,
    signalStrength: '26',
    accessedAt: ago(88),
    lastReportAt: ago(0, 0.1),
    metrics: {
      接入设备数: '4',
      转发规约: 'DL/T645 → 云端 MQTT',
      上行通信方式: '4G（主）/ 以太网（备）',
      在线率: '99.2',
    },
    remark: 'A 栋表计汇聚网关',
  },
  {
    name: '华东园区接入网关',
    imei: '864512039001002',
    meterNo: '',
    cardNo: '89860619000000000007',
    license: 'LIC-GW02-8899-22B3',
    type: '智能网关',
    model: 'GW-200',
    factory: '示例通信厂',
    factoryDate: '2026-07-15',
    unitId: 'NODE-P2-U1',
    installDate: '2026-08-10',
    installPosition: '园区北侧配电房通信柜',
    lng: 120.0435,
    lat: 30.2818,
    gpsCustom: false,
    commType: '4G',
    protocol: 'Modbus-TCP',
    gatewayImei: '',
    onlineStatus: '离线',
    latchStatus: null,
    signalStrength: '',
    accessedAt: ago(42),
    lastReportAt: ago(1, 6),
    metrics: {
      接入设备数: '1',
      转发规约: 'DL/T645 → 云端 MQTT',
      上行通信方式: '4G',
      在线率: '86.5',
    },
    remark: '华东园区在建，暂未投产',
  },
  {
    name: 'A 栋照明分表',
    imei: '864512031001001',
    // NB-IoT 直连、不经网关，无表号，以设备识别码（IMEI）唯一判定
    meterNo: '',
    cardNo: '89860619000000000008',
    license: 'LIC-WTA1-4412-6F07',
    type: '智能电表',
    model: 'DDS341-220V',
    factory: '示例仪表厂',
    factoryDate: '2026-06-20',
    unitId: 'NODE-P1-B1-U1',
    installDate: '2026-07-05',
    installPosition: 'A 栋一层照明配电箱',
    lng: 113.8847,
    lat: 22.5654,
    gpsCustom: false,
    commType: 'NB-IoT',
    protocol: 'DL/T645',
    gatewayImei: '',
    onlineStatus: '在线',
    latchStatus: '合闸',
    signalStrength: '',
    accessedAt: ago(58),
    lastReportAt: ago(0, 1.2),
    metrics: {
      'A 相电压': '221.2',
      'A 相电流': '4.6',
      'A 相有功功率': '0.98',
      'A 相无功功率': '0.1',
      'A 相视在功率': '1.02',
      'A 相功率因数': '0.961',
      总有功电量: '14,208.6',
      正向有功电量: '14,208.6',
      反向无功电量: '0.0',
      正向无功电量: '0.0',
      反向有功电量: '0.0',
    },
    remark: '一层公共照明计量',
  },
  {
    name: 'B 栋办公分表',
    imei: '864512032001001',
    // 未上云：表号由平台在设备上云后返回，暂为空
    meterNo: '',
    cardNo: '',
    license: 'LIC-GSA1-5523-7E18',
    type: '',
    model: 'DDS341-220V',
    factory: '示例仪表厂',
    factoryDate: '2026-05-08',
    unitId: 'NODE-P1-B2-U1',
    installDate: '2026-06-15',
    installPosition: 'B 栋二层办公区配电箱',
    lng: 113.8814,
    lat: 22.5639,
    gpsCustom: false,
    commType: 'NB-IoT',
    protocol: 'DL/T645',
    gatewayImei: '',
    onlineStatus: '离线',
    latchStatus: null,
    signalStrength: '',
    accessedAt: null,
    lastReportAt: null,
    metrics: {},
    remark: '办公区计量，待装表',
    // 演示：该设备在「智慧物联生态平台」未维护图片，卡片展示兜底图
    hasImage: false,
  },
]

/**
 * 【原型演示数据】西部园区的批量设备：每个用能单元 2 台，共 24 台。
 * 与 PRESET_DEVICES 中的 8 台合计 32 台，超过设备台账单页 20 条，
 * 也超过负荷策略作用对象抽屉单页 10 条，用于验证分页效果。
 * 设备名称按所属单元的现场用途命名，取值全部按索引推导，不使用随机数，保证每次生成的演示数据一致。
 *
 * 计量表计需要按设备类型提供对应指标快照，这里的数值仅为演示占位。
 */

/** 按槽位偏移生成一组有差异的数值，避免列表里每台设备读数完全相同 */
const drift = (base: number, step: number, index: number, digits = 1) =>
  (base + (index % 7) * step).toFixed(digits)

/** 计量表计的指标占位：字段名与 DEVICE_TYPES 中的定义保持一致 */
const bulkMetrics = (threePhase: boolean, index: number): DeviceMetrics => {
  if (!threePhase) {
    return {
      'A 相电压': drift(219.4, 0.35, index),
      'A 相电流': drift(3.1, 0.42, index),
      'A 相有功功率': drift(0.68, 0.11, index, 2),
      'A 相无功功率': drift(0.06, 0.03, index, 2),
      'A 相视在功率': drift(0.71, 0.11, index, 2),
      'A 相功率因数': drift(0.951, 0.002, index, 3),
      总有功电量: `${(8420 + index * 137.6).toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}`,
      正向有功电量: `${(8420 + index * 137.6).toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}`,
      反向无功电量: '0.0',
      正向无功电量: '0.0',
      反向有功电量: '0.0',
    }
  }
  return {
    'A 相电压': drift(219.8, 0.4, index),
    'AB 线电压': drift(380.6, 0.7, index),
    'A 相电流': drift(86.2, 0.9, index),
    'A 相有功功率': drift(19.15, 0.22, index, 2),
    'A 相无功功率': drift(5.4, 0.2, index, 2),
    'A 相视在功率': drift(19.92, 0.24, index, 2),
    'A 相功率因数': drift(0.952, 0.002, index, 3),
    'B 相电压': drift(220.3, 0.35, index),
    'BC 线电压': drift(381.2, 0.6, index),
    'B 相电流': drift(85.4, 0.8, index),
    'B 相有功功率': drift(18.88, 0.2, index, 2),
    'B 相无功功率': drift(5.2, 0.18, index, 2),
    'B 相视在功率': drift(19.62, 0.22, index, 2),
    'B 相功率因数': drift(0.954, 0.002, index, 3),
    'C 相电压': drift(219.2, 0.38, index),
    'C 相电流': drift(87.6, 0.85, index),
    'C 相有功功率': drift(19.42, 0.21, index, 2),
    'C 相无功功率': drift(5.7, 0.19, index, 2),
    'C 相视在功率': drift(20.31, 0.23, index, 2),
    'C 相功率因数': drift(0.949, 0.002, index, 3),
    总有功电量: `${(125_360 + index * 1284.7).toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}`,
    正向有功电量: `${(125_360 + index * 1284.7).toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}`,
    反向无功电量: '0.0',
    正向无功电量: `${(18_420 + index * 96.3).toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}`,
    反向有功电量: '0.0',
  }
}

const gatewayMetrics = (linked: number, index: number) => ({
  接入设备数: String(linked),
  转发规约: 'DL/T645 → 云端 MQTT',
  上行通信方式: index % 3 === 0 ? '以太网（主）/ 4G（备）' : '4G（主）/ 以太网（备）',
  在线率: drift(96.4, 0.6, index),
})

/**
 * 【原型演示数据】补充设备：所在用能单元不在任何负荷策略的作用范围内，
 * 用于验证「设备不关联负荷策略」的展示（详情页空态与列表列占位符）。
 * 追加在清单末尾，避免影响既有演示数据的设备编号（DEV-0001 ~ DEV-0032）。
 */
function createExtraDevices(): Array<Omit<Device, 'id' | 'createdAt' | 'imageUrl'> & { hasImage?: boolean }> {
  return [
    {
      name: '二次供水泵房总表',
      imei: '864512034001001',
      // NB-IoT 直连、不经网关，无表号，以设备识别码（IMEI）唯一判定
      meterNo: '',
      cardNo: '89860619000000000033',
      license: 'LIC-WSP1-6634-8A29',
      type: '三相智能电表',
      model: 'DTZ341-3×220/380V',
      factory: '示例仪表厂',
      factoryDate: '2026-07-18',
      // 该用能单元未被任何负荷策略作用，故该设备无关联策略
      unitId: 'NODE-P1-B2-U2',
      installDate: '2026-07-26',
      installPosition: 'B 栋地下一层水泵房配电柜',
      lng: 113.8818,
      lat: 22.5643,
      gpsCustom: false,
      commType: 'NB-IoT',
      protocol: 'DL/T645',
      gatewayImei: '',
      onlineStatus: '在线',
      latchStatus: '合闸',
      signalStrength: '',
      accessedAt: ago(40),
      lastReportAt: ago(0, 0.3),
      metrics: bulkMetrics(true, 3),
      remark: '生活供水加压，暂未纳入负荷策略管控',
    },
  ]
}

function createBulkDevices(): Array<Omit<Device, 'id' | 'createdAt' | 'imageUrl'> & { hasImage?: boolean }> {
  const list: Array<Omit<Device, 'id' | 'createdAt' | 'imageUrl'> & { hasImage?: boolean }> = []

  BULK_UNITS.forEach((unit, unitIndex) => {
    // 每个用能单元 2 台：第 1 台网关，第 2 台计量表计（三相按单元交替）
    unit.deviceNames.forEach((deviceName, slotIndex) => {
      const slot = slotIndex + 1
      const serial = unitIndex * unit.deviceNames.length + slot
      const isGateway = slot === 1
      const threePhase = !isGateway && unitIndex % 2 === 0
      const type = isGateway ? '智能网关' : threePhase ? '三相智能电表' : '智能电表'
      // 在线状态两态互斥：按固定间隔取样，保证在线 / 离线都有样本
      const onlineStatus: Device['onlineStatus'] = serial % 9 === 0 ? '离线' : '在线'
      const imei = `8645129${String(serial).padStart(7, '0')}`
      // 计量表计经网关接入，以表号做唯一判定；网关本身无表号
      const meterNo = isGateway ? '' : `32${String(serial).padStart(10, '0')}`
      // 通讯方式：网关多为 4G，计量表计按单元交替 4G / NB-IoT
      const commType = isGateway ? '4G' : unitIndex % 2 === 0 ? '4G' : 'NB-IoT'
      // 拉合闸状态由设备上报：网关无该状态；离线按分闸呈现；在线含少量已拉闸样本
      const latchStatus: Device['latchStatus'] =
        isGateway ? null : onlineStatus === '离线' || serial % 13 === 0 ? '分闸' : '合闸'
      // 信号强度：4G 设备上报 CSQ（0-31），其他通讯方式或离线设备为空
      const signalStrength =
        commType !== '4G' || onlineStatus === '离线' ? '' : String(10 + (serial % 21))

      list.push({
        name: deviceName,
        imei,
        meterNo,
        cardNo: `8986061900000${String(serial).padStart(6, '0')}`,
        license: `LIC-XB${String(unitIndex + 1).padStart(2, '0')}-${String(slot).padStart(2, '0')}-${String(serial).padStart(4, '0')}`,
        type,
        model: isGateway ? 'GW-200' : threePhase ? 'DTZ341-3×220/380V' : 'DDS341-220V',
        factory: isGateway ? '示例通信厂' : '示例仪表厂',
        factoryDate: '2026-08-10',
        unitId: unit.id,
        installDate: '2026-08-20',
        installPosition: isGateway
          ? `${unit.buildingName}${unit.name}弱电间`
          : `${unit.buildingName}${unit.name}配电间 ${slot - 1} 号柜`,
        lng: Number((104.0665 + Math.floor(unitIndex / 4) * 0.0004).toFixed(6)),
        lat: Number((30.5723 + (unitIndex % 4) * 0.0001).toFixed(6)),
        gpsCustom: false,
        commType,
        protocol: isGateway ? 'Modbus-TCP' : 'DL/T645',
        gatewayImei: isGateway ? '' : `${unit.id}-GW`,
        onlineStatus,
        latchStatus,
        signalStrength,
        accessedAt: ago(20 + (serial % 30)),
        lastReportAt: onlineStatus === '在线' ? ago(0, 0.3) : ago(1, 6),
        metrics: isGateway
          ? gatewayMetrics(unit.deviceNames.length - 1, unitIndex)
          : bulkMetrics(threePhase, unitIndex),
        remark: '',
      })
    })
  })

  return list
}

/** 生成初始演示设备清单：按数组顺序赋予递增添加时间（越靠前添加越早） */
export function createPresetDevices(): Device[] {
  const preset = [...PRESET_DEVICES, ...createBulkDevices(), ...createExtraDevices()]
  const base = Date.now() - preset.length * 2 * DAY
  return preset.map(({ hasImage, ...item }, index) => ({
    ...item,
    id: `DEV-${String(index + 1).padStart(4, '0')}`,
    // 设备图片由「智慧物联生态平台」按设备维护；hasImage 为 false 表示平台未维护，改用兜底图
    imageUrl: hasImage === false ? '' : DEVICE_IMAGES[item.type] ?? DEFAULT_DEVICE_IMAGE,
    // metrics 为只读快照，需克隆避免多处共享同一对象
    metrics: { ...item.metrics },
    createdAt: base + index * DAY,
  }))
}
