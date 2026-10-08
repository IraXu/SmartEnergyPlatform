/**
 * 【原型说明】设备管理 › 设备用电管控 › 负荷策略 模块的数据结构定义，仅用于原型交互验证。
 * 信息项对齐《产品需求文档-负荷策略》v0.1 与《产品交互设计文档-负荷策略》v0.1，
 * 不涉及数据库表、字段类型或接口设计。
 *
 * 策略是「什么条件下、对哪些设备的哪个范围、做什么拉合闸动作」的规则对象；
 * 触发方式分「时控」（按时间自动拉合闸）与「负控」（按告警事件执行对应的拉闸 / 合闸动作）。
 */

/** 触发方式：时控（按时间）/ 负控（按告警事件） */
export type TriggerType = '时控' | '负控'

/** 时控的周期类型：按日 / 按周 / 一次性（三者互斥） */
export type CycleType = '按日' | '按周' | '一次性'

/** 拉合闸动作：拉闸（切断供电）/ 合闸（恢复供电） */
export type ActionType = '拉闸' | '合闸'

/** 时控的一个时间点条目：时间 + 动作 */
export interface TimePoint {
  id: string
  /** 时刻，格式 HH:mm */
  time: string
  action: ActionType
}

/** 负控的一条触发规则：命中某事件时执行指定动作 */
export interface EventRule {
  id: string
  /** 触发事件类型名称（取自告警中心事件类型字典） */
  event: string
  action: ActionType
}

/** 一条负荷策略 */
export interface Strategy {
  id: string
  /** 策略名称，企业内唯一（不区分大小写） */
  name: string
  triggerType: TriggerType
  /** 启用状态：由列表内的开关直接控制（与生效状态正交） */
  enabled: boolean
  /** 时控的周期类型；负控为 null */
  cycleType: CycleType | null
  /** 按周周期下的星期（1=周一 … 7=周日）；非按周为空数组 */
  weekdays: number[]
  /** 一次性周期下的执行日期，YYYY-MM-DD；非一次性为空字符串 */
  onceDate: string
  /** 时控的时间点条目；负控为空数组 */
  timePoints: TimePoint[]
  /**
   * 负控的触发规则：每条规则 = 一个触发事件 + 该事件命中时执行的动作（拉闸 / 合闸）；
   * 时控为空数组。
   */
  eventRules: EventRule[]
  /** 负控执行延时（分钟，0-60）：命中事件后延时下发该规则的动作，0 表示立即执行 */
  delay: number
  /** 作用用电单元 id（必选，多选）；组织节点不可作为作用对象 */
  unitIds: string[]
  /** 作用设备 id；**为空表示作用于所选用电单元下的全部设备（动态范围）** */
  deviceIds: string[]
  /** 生效开始日期，YYYY-MM-DD */
  startDate: string
  /** 生效结束日期，YYYY-MM-DD；为空表示长期有效 */
  endDate: string
  remark: string
  createdAt: number
  createdBy: string
  updatedAt: number
  updatedBy: string
}

/** 新建 / 编辑策略的表单入参 */
export interface StrategyInput {
  name: string
  triggerType: TriggerType
  enabled: boolean
  cycleType: CycleType | null
  weekdays: number[]
  onceDate: string
  timePoints: TimePoint[]
  eventRules: EventRule[]
  delay: number
  unitIds: string[]
  deviceIds: string[]
  startDate: string
  endDate: string
  remark: string
}

/**
 * 生效状态：由「启用状态 + 生效期 + 当前时间」推导，不是人工状态。
 * 展示文案固定四项，见 PRD 5.2 状态流转。
 */
export type EffectiveState = '生效中' | '待生效' | '已过期' | '未生效'

/** 设备级执行结果 */
export type ExecResult = '成功' | '失败' | '已跳过'

/** 批次级执行结果（由批次内设备结果聚合） */
export type BatchResult = '成功' | '部分失败' | '全部失败' | '已跳过'

/** 执行批次内的一台设备 */
export interface ExecDeviceResult {
  deviceId: string
  deviceName: string
  /** 所属用能单元 id，用于展示层级路径 */
  unitId: string
  action: ActionType
  result: ExecResult
  /** 失败或跳过的原因；成功时为空 */
  reason: string
}

/**
 * 一次执行批次：一次策略触发（时控命中一个时间点 / 负控命中一次事件）即形成一批。
 * 策略删除后批次保留，其 strategyName 为删除时的名称快照。
 */
export interface ExecBatch {
  id: string
  at: number
  strategyId: string
  /** 策略名称快照：策略删除后历史批次仍可读 */
  strategyName: string
  triggerType: TriggerType
  /** 触发来源说明：时控给出周期与命中的时间点（如「按日 22:00」），负控给出命中的事件名 */
  triggerDetail: string
  action: ActionType
  devices: ExecDeviceResult[]
}

/** 设备闸位状态：用于判断某策略是否仍有设备处于「已拉闸且未合闸」 */
export interface LatchState {
  deviceId: string
  /** 是否处于已拉闸状态 */
  latched: boolean
  /** 最近一次改变闸位的策略标识 */
  strategyId: string
  at: number
}

/** 查询条件 */
export interface StrategyFilters {
  /** 策略名称：模糊匹配 */
  keyword: string
  /** 触发方式，多选；空数组表示全部 */
  triggerTypes: TriggerType[]
  /** 状态，多选；空数组表示全部 */
  statuses: Array<'启用' | '停用'>
}

/** 策略变更类型 */
export type StrategyChangeType = '新建策略' | '编辑策略' | '启用策略' | '停用策略' | '删除策略' | '策略执行'

/** 【原型说明】策略变更记录，对应 PRD 的审计要求（正式查看入口为「系统管理 › 系统日志」） */
export interface StrategyChangeLog {
  id: string
  at: number
  account: string
  type: StrategyChangeType
  /** 目标策略标识 */
  strategyId: string
  /** 策略名称快照 */
  target: string
  detail: string
}

/**
 * 【权限】当前账号在负荷策略页可执行的操作集合。
 * 对应权限点：`device:power:strategy`（进入）与 `:create` / `:edit` / `:toggle` / `:delete` / `:record`。
 */
export interface StrategyPerms {
  view: boolean
  create: boolean
  edit: boolean
  toggle: boolean
  remove: boolean
  record: boolean
}
