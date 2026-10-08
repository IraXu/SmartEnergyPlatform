/**
 * 【原型说明】告警中心模块的演示数据，仅用于原型交互验证。
 * 事件类型清单由产品侧提供，平台固定维护；结构与文案贴近页面信息项，
 * 不涉及真实客户数据、接口或数据库设计。
 */

import type { Alarm, EventTypeItem } from '../store/types'

/**
 * 【原型演示数据】事件类型字典，按事件类别分组。
 * 事件类型查询与列表展示均引用本清单。
 */
export const EVENT_TYPES: EventTypeItem[] = [
  { category: '温度类', name: '过温' },

  { category: '相序与不平衡', name: '电压逆相序' },
  { category: '相序与不平衡', name: '电流逆相序' },
  { category: '相序与不平衡', name: '电压不平衡' },
  { category: '相序与不平衡', name: '电流不平衡' },
  { category: '相序与不平衡', name: '电流严重不平衡' },

  { category: '需量与功率', name: '需量超限' },
  { category: '需量与功率', name: '总功率因数超下限' },
  { category: '需量与功率', name: '潮流反向' },

  { category: '防窃电', name: '开表盖' },
  { category: '防窃电', name: '开端钮盖' },

  { category: 'A 相事件', name: 'A相失压' },
  { category: 'A 相事件', name: 'A相欠压' },
  { category: 'A 相事件', name: 'A相过压' },
  { category: 'A 相事件', name: 'A相失流' },
  { category: 'A 相事件', name: 'A相过流' },
  { category: 'A 相事件', name: 'A相过载' },
  { category: 'A 相事件', name: 'A相功率反向' },
  { category: 'A 相事件', name: 'A相断相' },
  { category: 'A 相事件', name: 'A相断流' },

  { category: 'B 相事件', name: 'B相失压' },
  { category: 'B 相事件', name: 'B相欠压' },
  { category: 'B 相事件', name: 'B相过压' },
  { category: 'B 相事件', name: 'B相失流' },
  { category: 'B 相事件', name: 'B相过流' },
  { category: 'B 相事件', name: 'B相过载' },
  { category: 'B 相事件', name: 'B相功率反向' },
  { category: 'B 相事件', name: 'B相断相' },
  { category: 'B 相事件', name: 'B相断流' },

  { category: 'C 相事件', name: 'C相失压' },
  { category: 'C 相事件', name: 'C相欠压' },
  { category: 'C 相事件', name: 'C相过压' },
  { category: 'C 相事件', name: 'C相失流' },
  { category: 'C 相事件', name: 'C相过流' },
  { category: 'C 相事件', name: 'C相过载' },
  { category: 'C 相事件', name: 'C相功率反向' },
  { category: 'C 相事件', name: 'C相断相' },
  { category: 'C 相事件', name: 'C相断流' },
]

/**
 * 【原型演示数据】设备档案与「设备 → 用能单元」的归属关系。
 * unitId 指向组织架构模块中的用能单元节点（见 modules/org/mock/seed.ts）；
 * 所属用能单元的层级路径取自组织架构的真实节点属性，不在本文件重复维护。
 * meterNo 取「设备管理 › 设备台账」中的设备识别码（IMEI），两模块口径一致。
 */
export const METERS: Array<{
  meterNo: string
  meterName: string
  license: string
  unitId: string
}> = [
  { meterNo: '864512030001001', meterName: '1 号总表', license: 'LIC-8F2A-1043-7C61', unitId: 'NODE-P1-B1-U1' },
  { meterNo: '864512030001002', meterName: '2 号车间动力表', license: 'LIC-8F2A-1044-7C62', unitId: 'NODE-P1-B1-U2' },
  { meterNo: '864512030001003', meterName: '中央空调机房总表', license: 'LIC-9B31-2207-4D08', unitId: 'NODE-P1-B2-U1' },
  { meterNo: '864512030001004', meterName: '华东园区总配电表', license: 'LIC-9B31-2208-4D09', unitId: 'NODE-P2-U1' },
  { meterNo: '864512030001005', meterName: '临时施工用电表', license: 'LIC-7C05-3312-5E24', unitId: 'NODE-P1-B1-U2' },
]

const DAY = 24 * 60 * 60 * 1000
const HOUR = 60 * 60 * 1000
const MINUTE = 60 * 1000

/** 【原型说明】演示告警的数据表 */
type SeedRow = {
  meterNo: string
  eventType: string
  content: string
  /**
   * 距今天数：0 表示今日，告警时刻在当前时间之前均匀分布；
   * 大于 0 表示 N 天前，按 time 指定当天时刻。
   */
  dayOffset: number
  /** 非今日告警的当天时刻 HH:mm；今日告警不使用 */
  time?: string
}

/**
 * 【原型演示数据】告警清单，同一天内按时间从新到旧排列。
 * 覆盖全部事件类型与多台设备；今日 14 条便于验证默认「今日」范围下的分页，
 * 非今日数据用于验证时间范围筛选。
 */
const SEED_ROWS: SeedRow[] = [
  { meterNo: 'MTR-0001', eventType: 'A相断相', content: 'A 相完全失电，电压 0V，判定为断相', dayOffset: 0 },
  { meterNo: 'MTR-0002', eventType: 'C相过流', content: 'C 相电流超过额定值，当前 312A', dayOffset: 0 },
  { meterNo: 'MTR-0003', eventType: '过温', content: '设备内部温度 78℃，超过告警阈值 70℃', dayOffset: 0 },
  { meterNo: 'MTR-0001', eventType: 'B相失压', content: 'B 相电压低于欠压门槛，当前 168V', dayOffset: 0 },
  { meterNo: 'MTR-0004', eventType: '开表盖', content: '表壳被打开，记录到开盖动作', dayOffset: 0 },
  { meterNo: 'MTR-0002', eventType: '电流不平衡', content: '三相电流偏差超过门槛，最大偏差 28%', dayOffset: 0 },
  { meterNo: 'MTR-0005', eventType: '电流严重不平衡', content: '三相电流偏差超过严重门槛，最大偏差 46%', dayOffset: 0 },
  { meterNo: 'MTR-0001', eventType: '需量超限', content: '最大需量超过签订值，当前 520kW', dayOffset: 0 },
  { meterNo: 'MTR-0003', eventType: '总功率因数超下限', content: '总功率因数低于考核下限，当前 0.78', dayOffset: 0 },
  { meterNo: 'MTR-0004', eventType: '潮流反向', content: '检测到潮流反向，反向有功电量 3.6kWh', dayOffset: 0 },
  { meterNo: 'MTR-0002', eventType: '开端钮盖', content: '接线端子盖被打开', dayOffset: 0 },
  { meterNo: 'MTR-0003', eventType: '电压逆相序', content: '三相电压相序颠倒，判定为逆相序', dayOffset: 0 },
  { meterNo: 'MTR-0001', eventType: 'A相过压', content: 'A 相电压超过上限门槛，当前 268V', dayOffset: 0 },
  { meterNo: 'MTR-0004', eventType: 'C相欠压', content: 'C 相电压低于下限门槛，当前 172V', dayOffset: 0 },

  { meterNo: 'MTR-0002', eventType: '电流逆相序', content: '三相电流相序颠倒，判定为逆相序', dayOffset: 1, time: '21:15' },
  { meterNo: 'MTR-0005', eventType: 'A相过载', content: 'A 相负载率超过 100%，当前 112%', dayOffset: 1, time: '19:40' },
  { meterNo: 'MTR-0001', eventType: 'A相功率反向', content: 'A 相检测到反向功率，疑似接线错误', dayOffset: 1, time: '17:05' },
  { meterNo: 'MTR-0003', eventType: '电压不平衡', content: '三相电压偏差超过门槛，最大偏差 6.2%', dayOffset: 1, time: '15:22' },
  { meterNo: 'MTR-0004', eventType: 'B相过流', content: 'B 相电流超过额定值，当前 286A', dayOffset: 1, time: '13:36' },
  { meterNo: 'MTR-0002', eventType: 'C相断流', content: 'C 相电流为 0，判定为断流', dayOffset: 1, time: '11:18' },
  { meterNo: 'MTR-0001', eventType: 'B相失流', content: 'B 相电流异常偏低，当前 12A', dayOffset: 1, time: '09:47' },
  { meterNo: 'MTR-0003', eventType: 'A相欠压', content: 'A 相电压低于下限门槛，当前 176V', dayOffset: 1, time: '07:55' },

  { meterNo: 'MTR-0004', eventType: 'B相断相', content: 'B 相完全失电，电压 0V，判定为断相', dayOffset: 2, time: '22:10' },
  { meterNo: 'MTR-0002', eventType: 'C相过载', content: 'C 相负载率超过 100%，当前 106%', dayOffset: 2, time: '20:33' },
  { meterNo: 'MTR-0005', eventType: 'C相功率反向', content: 'C 相检测到反向功率，疑似接线错误', dayOffset: 2, time: '18:16' },
  { meterNo: 'MTR-0001', eventType: 'B相功率反向', content: 'B 相检测到反向功率，疑似接线错误', dayOffset: 2, time: '16:02' },
  { meterNo: 'MTR-0003', eventType: 'C相断相', content: 'C 相完全失电，电压 0V，判定为断相', dayOffset: 2, time: '13:44' },
  { meterNo: 'MTR-0004', eventType: 'A相失流', content: 'A 相电流异常偏低，当前 8A', dayOffset: 2, time: '10:28' },
  { meterNo: 'MTR-0005', eventType: 'C相失流', content: 'C 相电流异常偏低，当前 9A', dayOffset: 1, time: '22:30' },

  { meterNo: 'MTR-0002', eventType: 'B相过载', content: 'B 相负载率超过 100%，当前 104%', dayOffset: 5, time: '21:36' },
  { meterNo: 'MTR-0001', eventType: 'A相过流', content: 'A 相电流超过额定值，当前 298A', dayOffset: 5, time: '19:11' },
  { meterNo: 'MTR-0003', eventType: 'C相过压', content: 'C 相电压超过上限门槛，当前 266V', dayOffset: 5, time: '16:48' },
  { meterNo: 'MTR-0005', eventType: 'A相断流', content: 'A 相电流为 0，判定为断流', dayOffset: 5, time: '14:22' },
  { meterNo: 'MTR-0004', eventType: 'B相欠压', content: 'B 相电压低于下限门槛，当前 174V', dayOffset: 5, time: '11:05' },

  { meterNo: 'MTR-0002', eventType: 'B相断流', content: 'B 相电流为 0，判定为断流', dayOffset: 20, time: '20:15' },
  { meterNo: 'MTR-0001', eventType: '过温', content: '设备内部温度 73℃，超过告警阈值 70℃', dayOffset: 20, time: '17:42' },
  { meterNo: 'MTR-0003', eventType: 'C相失压', content: 'C 相电压低于欠压门槛，当前 162V', dayOffset: 20, time: '14:30' },
  { meterNo: 'MTR-0004', eventType: 'A相失压', content: 'A 相电压低于欠压门槛，当前 158V', dayOffset: 20, time: '11:20' },
  { meterNo: 'MTR-0005', eventType: 'B相过压', content: 'B 相电压超过上限门槛，当前 272V', dayOffset: 20, time: '09:10' },
]

const eventMeta = (name: string) => EVENT_TYPES.find((item) => item.name === name) ?? EVENT_TYPES[0]

/** 告警编号：ALM-{8 位日期}-{4 位当日序号} */
function makeIdFactory() {
  const daySeq = new Map<string, number>()
  return (at: number) => {
    const date = new Date(at)
    const key = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`
    const seq = (daySeq.get(key) ?? 0) + 1
    daySeq.set(key, seq)
    return `ALM-${key}-${String(seq).padStart(4, '0')}`
  }
}

/**
 * 【原型演示数据】生成初始告警清单。
 * 所属用能单元的层级路径由调用方从组织架构数据中解析后传入，
 * 保证告警的归属信息与「系统管理 › 组织架构」中维护的结构一致。
 * 今日告警的时间落在「今日 00:00 ~ 当前时间」之间，保证默认「今日」范围下始终有数据。
 */
export function createPresetAlarms(resolveUnitPath: (unitId: string) => string): Alarm[] {
  const now = Date.now()
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const dayStart = todayStart.getTime()

  const todayCount = SEED_ROWS.filter((row) => row.dayOffset === 0).length
  // 今日告警按顺序均匀分布在已过去的时间里，最新一条最接近当前时间
  const elapsed = Math.max(now - dayStart, todayCount * MINUTE)
  let todayIndex = 0

  const rows = SEED_ROWS.map((row) => {
    let reportAt: number
    if (row.dayOffset === 0) {
      reportAt = dayStart + Math.round((elapsed * (todayCount - todayIndex)) / (todayCount + 1))
      todayIndex += 1
    } else {
      const [hour, minute] = (row.time ?? '00:00').split(':').map(Number)
      reportAt = dayStart - row.dayOffset * DAY + hour * HOUR + minute * MINUTE
    }
    return { row, reportAt }
  })
  // 按时间倒序生成，使告警编号在同一日内与时间顺序一致
  rows.sort((a, b) => b.reportAt - a.reportAt)

  const nextId = makeIdFactory()
  return rows.map(({ row, reportAt }) => {
    const meter = METERS.find((item) => item.meterNo === row.meterNo) ?? METERS[0]
    const meta = eventMeta(row.eventType)
    return {
      id: nextId(reportAt),
      eventType: meta.name,
      eventCategory: meta.category,
      content: row.content,
      meterId: meter.meterNo,
      meterName: meter.meterName,
      meterLicense: meter.license,
      unitId: meter.unitId,
      unitPath: resolveUnitPath(meter.unitId),
      reportAt,
    }
  })
}
