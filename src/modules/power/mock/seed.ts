/**
 * 【原型说明】设备管理 › 设备用电管控 › 负荷策略 的演示数据，仅用于原型交互验证。
 * 策略形态贴近《产品需求文档-负荷策略》v0.1 的功能范围与业务规则，
 * 不涉及真实客户数据、接口或数据库设计。
 *
 * 设备档案与设备类型取自「设备管理 › 设备台账」的演示数据；
 * 用能单元与层级路径取自「系统管理 › 组织架构」的演示数据，本模块不重复维护。
 */

import type {
  ActionType,
  EventRule,
  ExecBatch,
  ExecDeviceResult,
  LatchState,
  Strategy,
  TimePoint,
} from '../store/types'
import { BULK_UNITS } from '@/modules/org/mock/seed'

const DAY = 24 * 60 * 60 * 1000
const HOUR = 60 * 60 * 1000

/** 相对当前时间的天偏移，保证演示数据的时间始终「新鲜」 */
const dayOffset = (days: number) => Date.now() + days * DAY

const pad = (value: number) => String(value).padStart(2, '0')
const dateText = (at: number) => {
  const date = new Date(at)
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

let pointSeq = 0
const point = (time: string, action: TimePoint['action']): TimePoint => ({
  id: `TP-${++pointSeq}`,
  time,
  action,
})

let ruleSeq = 0
const rule = (event: string, action: EventRule['action']): EventRule => ({
  id: `ER-${++ruleSeq}`,
  event,
  action,
})

/**
 * 【原型演示数据】负荷策略清单。覆盖：
 * - 时控三种周期（按日 / 按周 / 一次性）与负控
 * - 作用设备留空（动态范围）与指定设备（静态范围）
 * - 启用 / 停用、生效中 / 待生效 / 已过期、长期有效与有结束日期
 */
export function createPresetStrategies(): Strategy[] {
  const now = Date.now()
  return [
    {
      id: 'LST-0001',
      name: '生产区夜间停机',
      triggerType: '时控',
      enabled: true,
      cycleType: '按日',
      weekdays: [],
      onceDate: '',
      timePoints: [point('22:00', '拉闸'), point('07:00', '合闸')],
      eventRules: [],
      delay: 0,
      // 作用范围：1 号车间 + 2 号车间，作用设备留空 → 动态范围（含后续新增）
      unitIds: ['NODE-P1-B1-U1', 'NODE-P1-B1-U2'],
      deviceIds: [],
      startDate: dateText(dayOffset(-27)),
      endDate: '',
      remark: '生产区夜间无人值守，22:00 断电、次日 07:00 送电',
      createdAt: now - 27 * DAY,
      createdBy: '旗木卡卡西',
      updatedAt: now - 3 * DAY,
      updatedBy: '旗木卡卡西',
    },
    {
      id: 'LST-0002',
      name: '空调机房分时管控',
      triggerType: '时控',
      enabled: true,
      cycleType: '按周',
      weekdays: [1, 2, 3, 4, 5],
      onceDate: '',
      timePoints: [point('09:00', '拉闸'), point('17:30', '合闸')],
      eventRules: [],
      delay: 0,
      unitIds: ['NODE-P1-B2-U1'],
      deviceIds: [],
      startDate: dateText(dayOffset(-20)),
      endDate: '',
      remark: '仅工作日执行，避开非工作时间的集中供冷',
      createdAt: now - 20 * DAY,
      createdBy: '漩涡鸣人',
      updatedAt: now - 20 * DAY,
      updatedBy: '漩涡鸣人',
    },
    {
      id: 'LST-0003',
      name: '过温过载回路切除',
      triggerType: '负控',
      enabled: true,
      cycleType: null,
      weekdays: [],
      onceDate: '',
      timePoints: [],
      // 负控：命中过温 / 过载 / 过流类事件时拉闸（事件取自告警中心事件类型字典）
      eventRules: [
        rule('过温', '拉闸'),
        rule('A相过载', '拉闸'),
        rule('C相过流', '拉闸'),
      ],
      delay: 3,
      unitIds: ['NODE-P1-B1-U1', 'NODE-P1-B1-U2'],
      deviceIds: [],
      startDate: dateText(dayOffset(-15)),
      endDate: '',
      remark: '过温、过载、过流类事件命中即切除对应回路，避免设备损坏',
      createdAt: now - 15 * DAY,
      createdBy: '宇智波佐助',
      updatedAt: now - 15 * DAY,
      updatedBy: '宇智波佐助',
    },
    {
      id: 'LST-0004',
      name: '华东园区临时限电',
      triggerType: '时控',
      enabled: true,
      cycleType: '一次性',
      weekdays: [],
      onceDate: dateText(dayOffset(7)),
      timePoints: [point('09:00', '拉闸'), point('12:00', '合闸')],
      eventRules: [],
      delay: 0,
      // 作用范围：总配电房，作用设备为非空 → 静态范围（仅指定的这台设备）
      unitIds: ['NODE-P2-U1'],
      deviceIds: ['DEV-0004'],
      startDate: dateText(dayOffset(3)),
      endDate: dateText(dayOffset(10)),
      remark: '上级电网检修配合停电，仅作用于园区总配电表',
      createdAt: now - 5 * DAY,
      createdBy: '奈良鹿丸',
      updatedAt: now - 5 * DAY,
      updatedBy: '奈良鹿丸',
    },
    {
      id: 'LST-0005',
      name: '施工用电按日管控',
      triggerType: '时控',
      enabled: false,
      cycleType: '按日',
      weekdays: [],
      onceDate: '',
      timePoints: [point('19:00', '拉闸')],
      eventRules: [],
      delay: 0,
      unitIds: ['NODE-P1-B1-U2'],
      deviceIds: ['DEV-0005'],
      startDate: dateText(dayOffset(-10)),
      endDate: '',
      remark: '施工临时用电表尚未接入，先停用待接入后启用',
      createdAt: now - 10 * DAY,
      createdBy: '日向雏田',
      updatedAt: now - 2 * DAY,
      updatedBy: '日向雏田',
    },
    {
      id: 'LST-0006',
      name: '夏季高峰错峰用电',
      triggerType: '时控',
      enabled: true,
      cycleType: '按日',
      weekdays: [],
      onceDate: '',
      timePoints: [point('13:00', '拉闸'), point('15:00', '合闸')],
      eventRules: [],
      delay: 0,
      unitIds: ['NODE-P2-U1'],
      deviceIds: [],
      startDate: dateText(dayOffset(-90)),
      // 已过期的生效期：用于演示「已过期」生效状态
      endDate: dateText(dayOffset(-30)),
      remark: '夏季高峰时段错峰，已于 8 月底到期',
      createdAt: now - 90 * DAY,
      createdBy: '春野樱',
      updatedAt: now - 30 * DAY,
      updatedBy: '春野樱',
    },
    {
      id: 'LST-0007',
      name: '西部园区错峰限电',
      triggerType: '时控',
      enabled: true,
      cycleType: '按周',
      weekdays: [1, 2, 3, 4, 5],
      onceDate: '',
      timePoints: [point('08:30', '拉闸'), point('18:00', '合闸')],
      eventRules: [],
      delay: 0,
      // 【数据量演示】西部园区全部 12 个车间级用能单元，作用设备留空 → 覆盖 24 台设备；
      // 单元数与设备数均超过清单单页，用于验证列表计数、分页与折叠收口的展示。
      unitIds: BULK_UNITS.map((unit) => unit.id),
      deviceIds: [],
      startDate: dateText(dayOffset(-12)),
      endDate: '',
      remark: '西部园区产线错峰限电，工作日 08:30 断电、18:00 送电',
      createdAt: now - 12 * DAY,
      createdBy: '李洛克',
      updatedAt: now - 4 * DAY,
      updatedBy: '李洛克',
    },
  ]
}

/**
 * 【原型演示数据】历史执行批次：共 12 条（略多于记录浮层单页 10 条，用于验证分页）。
 * 覆盖成功 / 部分失败 / 全部失败 / 已跳过四种批次结果，
 * 并保留一条「策略已删除」的批次（LST-0099 不在策略清单中）用于验证名称快照。
 */
export function createPresetBatches(): ExecBatch[] {
  const now = Date.now()
  const at = (daysAgo: number, hour: number, minute = 0) => {
    const date = new Date(now - daysAgo * DAY)
    date.setHours(hour, minute, 0, 0)
    return date.getTime()
  }

  /**
   * 【原型说明】西部园区的批次设备级明细按 BULK_UNITS 推导，
   * 与设备台账的批量设备一一对应（网关在前、表计在后）。
   * 结果按序号取样：网关与表计大多成功，个别记为失败 / 已跳过以覆盖三种结果。
   */
  const bulkDeviceRows = (action: ActionType): ExecDeviceResult[] =>
    BULK_UNITS.flatMap((unit, unitIndex) =>
      unit.deviceNames.map((deviceName, slotIndex) => {
        const serial = unitIndex * unit.deviceNames.length + slotIndex + 1
        const skipped = serial % 11 === 0
        const failed = !skipped && serial % 9 === 0
        return {
          deviceId: `DEV-${String(9 + serial).padStart(4, '0')}`,
          deviceName,
          unitId: unit.id,
          action,
          result: skipped ? '已跳过' : failed ? '失败' : '成功',
          reason: skipped ? '设备未接入' : failed ? '设备离线或通信失败' : '',
        } satisfies ExecDeviceResult
      }),
    )

  return [
    {
      id: 'EXB-0009',
      at: at(0, 18, 0),
      strategyId: 'LST-0007',
      strategyName: '西部园区错峰限电',
      triggerType: '时控',
      triggerDetail: '按周 18:00',
      action: '合闸',
      devices: bulkDeviceRows('合闸'),
    },
    {
      id: 'EXB-0010',
      at: at(0, 8, 30),
      strategyId: 'LST-0007',
      strategyName: '西部园区错峰限电',
      triggerType: '时控',
      triggerDetail: '按周 08:30',
      action: '拉闸',
      devices: bulkDeviceRows('拉闸'),
    },
    {
      id: 'EXB-0001',
      at: at(1, 22, 0),
      strategyId: 'LST-0001',
      strategyName: '生产区夜间停机',
      triggerType: '时控',
      triggerDetail: '按日 22:00',
      action: '拉闸',
      devices: [
        { deviceId: 'DEV-0001', deviceName: '1 号总表', unitId: 'NODE-P1-B1-U1', action: '拉闸', result: '成功', reason: '' },
        { deviceId: 'DEV-0008', deviceName: 'A 栋照明分表', unitId: 'NODE-P1-B1-U1', action: '拉闸', result: '成功', reason: '' },
        { deviceId: 'DEV-0006', deviceName: 'A 栋接入网关', unitId: 'NODE-P1-B1-U1', action: '拉闸', result: '成功', reason: '' },
        { deviceId: 'DEV-0002', deviceName: '2 号车间动力表', unitId: 'NODE-P1-B1-U2', action: '拉闸', result: '失败', reason: '设备离线或通信失败' },
        { deviceId: 'DEV-0005', deviceName: '临时施工用电表', unitId: 'NODE-P1-B1-U2', action: '拉闸', result: '已跳过', reason: '设备未接入' },
      ],
    },
    {
      id: 'EXB-0002',
      at: at(1, 7, 0),
      strategyId: 'LST-0001',
      strategyName: '生产区夜间停机',
      triggerType: '时控',
      triggerDetail: '按日 07:00',
      action: '合闸',
      devices: [
        { deviceId: 'DEV-0001', deviceName: '1 号总表', unitId: 'NODE-P1-B1-U1', action: '合闸', result: '成功', reason: '' },
        { deviceId: 'DEV-0008', deviceName: 'A 栋照明分表', unitId: 'NODE-P1-B1-U1', action: '合闸', result: '成功', reason: '' },
        { deviceId: 'DEV-0006', deviceName: 'A 栋接入网关', unitId: 'NODE-P1-B1-U1', action: '合闸', result: '成功', reason: '' },
        { deviceId: 'DEV-0002', deviceName: '2 号车间动力表', unitId: 'NODE-P1-B1-U2', action: '合闸', result: '失败', reason: '设备离线或通信失败' },
        { deviceId: 'DEV-0005', deviceName: '临时施工用电表', unitId: 'NODE-P1-B1-U2', action: '合闸', result: '已跳过', reason: '设备未接入' },
      ],
    },
    {
      id: 'EXB-0003',
      at: at(2, 9, 0),
      strategyId: 'LST-0002',
      strategyName: '空调机房分时管控',
      triggerType: '时控',
      triggerDetail: '按周 09:00',
      action: '拉闸',
      devices: [
        { deviceId: 'DEV-0003', deviceName: '中央空调机房总表', unitId: 'NODE-P1-B2-U1', action: '拉闸', result: '成功', reason: '' },
        { deviceId: 'DEV-0009', deviceName: 'B 栋办公分表', unitId: 'NODE-P1-B2-U1', action: '拉闸', result: '已跳过', reason: '设备未接入' },
      ],
    },
    {
      id: 'EXB-0004',
      at: at(3, 14, 20),
      strategyId: 'LST-0003',
      strategyName: '过温过载回路切除',
      triggerType: '负控',
      triggerDetail: '过温',
      action: '拉闸',
      devices: [
        { deviceId: 'DEV-0001', deviceName: '1 号总表', unitId: 'NODE-P1-B1-U1', action: '拉闸', result: '成功', reason: '' },
        { deviceId: 'DEV-0002', deviceName: '2 号车间动力表', unitId: 'NODE-P1-B1-U2', action: '拉闸', result: '失败', reason: '设备响应超时' },
      ],
    },
    {
      id: 'EXB-0005',
      at: at(3, 14, 31),
      strategyId: 'LST-0003',
      strategyName: '过温过载回路切除',
      triggerType: '负控',
      triggerDetail: '过温 解除',
      action: '合闸',
      devices: [
        { deviceId: 'DEV-0001', deviceName: '1 号总表', unitId: 'NODE-P1-B1-U1', action: '合闸', result: '成功', reason: '' },
        { deviceId: 'DEV-0002', deviceName: '2 号车间动力表', unitId: 'NODE-P1-B1-U2', action: '合闸', result: '失败', reason: '设备离线或通信失败' },
      ],
    },
    {
      id: 'EXB-0006',
      at: at(6, 13, 0),
      strategyId: 'LST-0006',
      strategyName: '夏季高峰错峰用电',
      triggerType: '时控',
      triggerDetail: '按日 13:00',
      action: '拉闸',
      devices: [
        { deviceId: 'DEV-0004', deviceName: '华东园区总配电表', unitId: 'NODE-P2-U1', action: '拉闸', result: '成功', reason: '' },
        { deviceId: 'DEV-0007', deviceName: '华东园区接入网关', unitId: 'NODE-P2-U1', action: '拉闸', result: '失败', reason: '设备离线或通信失败' },
      ],
    },
    {
      id: 'EXB-0007',
      at: at(12, 22, 0),
      strategyId: 'LST-0099',
      // 策略已删除：批次保留名称快照，用于验证「策略删除后记录仍可读」
      strategyName: '旧版全厂夜间断电',
      triggerType: '时控',
      triggerDetail: '按日 22:00',
      action: '拉闸',
      devices: [
        { deviceId: 'DEV-0001', deviceName: '1 号总表', unitId: 'NODE-P1-B1-U1', action: '拉闸', result: '成功', reason: '' },
        { deviceId: 'DEV-0002', deviceName: '2 号车间动力表', unitId: 'NODE-P1-B1-U2', action: '拉闸', result: '成功', reason: '' },
        { deviceId: 'DEV-0003', deviceName: '中央空调机房总表', unitId: 'NODE-P1-B2-U1', action: '拉闸', result: '成功', reason: '' },
      ],
    },
    {
      id: 'EXB-0008',
      at: at(20, 22, 0),
      strategyId: 'LST-0001',
      strategyName: '生产区夜间停机',
      triggerType: '时控',
      triggerDetail: '按日 22:00',
      action: '拉闸',
      devices: [
        { deviceId: 'DEV-0005', deviceName: '临时施工用电表', unitId: 'NODE-P1-B1-U2', action: '拉闸', result: '已跳过', reason: '设备未接入' },
      ],
    },
    {
      id: 'EXB-0011',
      at: at(21, 17, 30),
      strategyId: 'LST-0002',
      strategyName: '空调机房分时管控',
      triggerType: '时控',
      triggerDetail: '按周 17:30',
      action: '合闸',
      devices: [
        { deviceId: 'DEV-0003', deviceName: '中央空调机房总表', unitId: 'NODE-P1-B2-U1', action: '合闸', result: '成功', reason: '' },
        { deviceId: 'DEV-0009', deviceName: 'B 栋办公分表', unitId: 'NODE-P1-B2-U1', action: '合闸', result: '已跳过', reason: '设备未接入' },
      ],
    },
    {
      id: 'EXB-0012',
      at: at(25, 7, 0),
      strategyId: 'LST-0001',
      strategyName: '生产区夜间停机',
      triggerType: '时控',
      triggerDetail: '按日 07:00',
      action: '合闸',
      devices: [
        { deviceId: 'DEV-0001', deviceName: '1 号总表', unitId: 'NODE-P1-B1-U1', action: '合闸', result: '成功', reason: '' },
        { deviceId: 'DEV-0008', deviceName: 'A 栋照明分表', unitId: 'NODE-P1-B1-U1', action: '合闸', result: '成功', reason: '' },
        { deviceId: 'DEV-0006', deviceName: 'A 栋接入网关', unitId: 'NODE-P1-B1-U1', action: '合闸', result: '成功', reason: '' },
        { deviceId: 'DEV-0002', deviceName: '2 号车间动力表', unitId: 'NODE-P1-B1-U2', action: '合闸', result: '失败', reason: '设备离线或通信失败' },
        { deviceId: 'DEV-0005', deviceName: '临时施工用电表', unitId: 'NODE-P1-B1-U2', action: '合闸', result: '已跳过', reason: '设备未接入' },
      ],
    },
  ]
}

/**
 * 【原型演示数据】设备闸位初始状态。
 * 用于演示「停用 / 删除策略时，若该策略仍有设备处于已拉闸状态则追加提示」。
 * DEV-0002 为「生产区夜间停机」拉闸后未合闸的演示样本（该设备离线，合闸批次亦失败）。
 */
export function createPresetLatches(): LatchState[] {
  const now = Date.now()
  return [
    { deviceId: 'DEV-0002', latched: true, strategyId: 'LST-0001', at: now - 1 * DAY - 2 * HOUR },
  ]
}
