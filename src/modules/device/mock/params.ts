/**
 * 【原型说明】设备可配置参数的字典与默认值，仅用于原型交互验证。
 *
 * 【扩展方式】后续新增可配置项只需两步，抽屉与校验逻辑会自动适配，无需改动页面结构：
 * 1. 在 `DEVICE_PARAM_ITEMS` 追加一条参数定义（选择已有 group，或先在 `DEVICE_PARAM_GROUPS` 中加分组）
 * 2. 如需演示该参数的初始值，在 `DEFAULT_PARAM_VALUES` 中补一条默认值
 *
 * 【开放范围】每条参数带 `status`：
 * - `active`：本期开放，界面呈现且参与校验
 * - `planned`：待规划，界面不呈现、校验不参与；后续开放只需改为 `active`
 * 本期仅开放 PT 变比与 CT 变比两项计量参数。
 *
 * 参数值统一以「文本」承载：数值型存数字字符串，枚举型存选项文本，
 * 与设备侧读写的一致性更好，也便于后续接入真实报文时直接映射。
 */

import type { DeviceParamGroup, DeviceParamItem, DeviceParamValues } from '../store/types'

/** 参数分组：抽屉按此顺序分块呈现 */
export const DEVICE_PARAM_GROUPS: DeviceParamGroup[] = [
  {
    key: 'metering',
    name: '计量参数',
    desc: '与电量计量准确性直接相关，修改前请核对现场互感器铭牌参数',
  },
  {
    key: 'report',
    name: '上报参数',
    desc: '控制设备数据上报与冻结的节奏，影响平台侧数据的实时性',
  },
  {
    key: 'comm',
    name: '通讯参数',
    desc: '影响设备与平台的连接与重传策略，修改后设备会重新建连',
  },
]

/**
 * 可配置参数清单。
 * PT / CT 变比是最常用的两项计量参数：现场互感器变比与设备内部设置不一致时，
 * 会造成电量数值成倍偏差，因此本期优先开放这两项；
 * 其余参数已登记但标记为「待规划」，界面暂不呈现。
 */
export const DEVICE_PARAM_ITEMS: DeviceParamItem[] = [
  /* ---------- 计量参数 ---------- */
  {
    key: 'ptRatio',
    name: 'PT 变比',
    group: 'metering',
    type: 'number',
    unit: '倍',
    min: 1,
    max: 1000,
    precision: 0,
    required: true,
    status: 'active',
    desc: '电压互感器变比。设备显示电压 = 一次侧实际电压 ÷ 该变比，须与现场互感器铭牌一致。',
  },
  {
    key: 'ctRatio',
    name: 'CT 变比',
    group: 'metering',
    type: 'number',
    unit: '倍',
    min: 1,
    max: 5000,
    precision: 0,
    required: true,
    status: 'active',
    desc: '电流互感器变比。设备显示电流 = 一次侧实际电流 ÷ 该变比，设置错误会导致电量成倍偏差。',
  },
  {
    key: 'meterAddr',
    name: '表计地址',
    group: 'metering',
    type: 'number',
    unit: '',
    min: 1,
    max: 247,
    precision: 0,
    status: 'planned',
    desc: '设备在采集总线上的通信地址，须在同一网关下唯一，避免与其他表计冲突。',
  },
  {
    key: 'wiringMode',
    name: '接线方式',
    group: 'metering',
    type: 'select',
    options: ['三相四线', '三相三线', '单相两线'],
    required: true,
    status: 'planned',
    desc: '设备实际接线方式，须与现场接线一致，否则功率与电量计算会出错。',
  },

  /* ---------- 上报参数 ---------- */
  {
    key: 'reportInterval',
    name: '上报周期',
    group: 'report',
    type: 'number',
    unit: 's',
    min: 30,
    max: 3600,
    precision: 0,
    status: 'planned',
    desc: '设备周期性上报数据的间隔，间隔越短数据越实时、流量消耗越大。',
  },
  {
    key: 'freezeTime',
    name: '日冻结时间',
    group: 'report',
    type: 'select',
    options: ['00:00', '08:00', '12:00', '20:00'],
    status: 'planned',
    desc: '设备每日电量冻结的时刻，平台按冻结值生成日用电量报表。',
  },
  {
    key: 'heartbeatInterval',
    name: '心跳周期',
    group: 'report',
    type: 'number',
    unit: 's',
    min: 30,
    max: 1800,
    precision: 0,
    status: 'planned',
    desc: '设备与平台保持连接的保活心跳间隔，过长会被平台判定为离线。',
  },

  /* ---------- 通讯参数 ---------- */
  {
    key: 'mqttServer',
    name: 'MQTT 服务地址',
    group: 'comm',
    type: 'select',
    options: ['mqtt://iot.example.com:1883', 'mqtts://iot.example.com:8883', 'mqtt://iot-backup.example.com:1883'],
    required: true,
    status: 'planned',
    desc: '设备接入平台所用的 MQTT 服务地址，须与平台实际部署一致。',
  },
  {
    key: 'retryTimes',
    name: '重传次数',
    group: 'comm',
    type: 'number',
    unit: '次',
    min: 0,
    max: 10,
    precision: 0,
    status: 'planned',
    desc: '上行报文失败后的最大重传次数，次数越多弱网下成功率越高、但更耗流量。',
  },
]

/**
 * 本期开放的参数项（status = 'active'）。
 * 界面呈现、校验与读写都以它为准；后续开放某项只需把字典中的 status 改为 'active'，
 * 分组与界面会自动适配，无需改动上传调用方。
 */
export const ACTIVE_PARAM_ITEMS = DEVICE_PARAM_ITEMS.filter((item) => item.status === 'active')

/** 某分组下本期开放的参数项；无开放项的分组会因结果为空而被界面自动隐藏 */
export function paramItemsOfGroup(groupKey: string) {
  return ACTIVE_PARAM_ITEMS.filter((item) => item.group === groupKey)
}

/**
 * 参数默认值：新增设备/导入设备时作为设备侧初始值。
 * 演示数据里各设备的实际值在此基础上做少量差异化（见 createPresetParamValues）。
 */
export const DEFAULT_PARAM_VALUES: DeviceParamValues = {
  ptRatio: '1',
  ctRatio: '1',
  meterAddr: '1',
  wiringMode: '三相四线',
  reportInterval: '300',
  freezeTime: '00:00',
  heartbeatInterval: '120',
  mqttServer: 'mqtt://iot.example.com:1883',
  retryTimes: '3',
}

/** 【原型说明】常用互感器变比样本，用于演示「不同设备配置不同变比」的真实场景 */
const RATIO_SAMPLES: Array<{ ptRatio: string; ctRatio: string }> = [
  { ptRatio: '1', ctRatio: '1' },
  { ptRatio: '1', ctRatio: '40' },
  { ptRatio: '10', ctRatio: '60' },
  { ptRatio: '10', ctRatio: '100' },
  { ptRatio: '1', ctRatio: '20' },
]

const WIRING_SAMPLES = ['三相四线', '三相三线', '单相两线']

/** 稳定伪随机：同一设备每次生成的值一致，便于反复验证 */
function seeded(seed: number) {
  let value = seed % 2147483647
  if (value <= 0) value += 2147483646
  return () => {
    value = (value * 16807) % 2147483647
    return (value - 1) / 2147483646
  }
}

function seedOf(text: string) {
  return text.split('').reduce((total, char) => total + char.charCodeAt(0), 11)
}

/**
 * 【原型说明】按设备识别码生成该设备的参数值快照。
 * 未上云设备（无设备类型）视为尚未回读参数，返回空值，由界面提示用户先抄读。
 */
export function createPresetParamValues(imei: string, type: string): DeviceParamValues {
  if (!type || !imei) return {}
  const random = seeded(seedOf(imei))
  const ratio = RATIO_SAMPLES[Math.floor(random() * RATIO_SAMPLES.length)]
  const wiring = WIRING_SAMPLES[Math.floor(random() * WIRING_SAMPLES.length)]
  return {
    ...DEFAULT_PARAM_VALUES,
    ptRatio: ratio.ptRatio,
    ctRatio: ratio.ctRatio,
    wiringMode: wiring,
    meterAddr: String(1 + Math.floor(random() * 12)),
    reportInterval: String([60, 300, 600, 900][Math.floor(random() * 4)]),
    heartbeatInterval: String([60, 120, 300][Math.floor(random() * 3)]),
  }
}
