/**
 * 【原型说明】设备管理 › 设备用电管控 › 负荷策略 的存储键与规则常量，仅用于原型演示。
 * 规则取值对齐《产品需求文档-负荷策略》v1.0 与《产品交互设计文档-负荷策略》v1.0（均已定稿）。
 */

export const STRATEGY_LIST_KEY = 'proto_strategy_list'
export const STRATEGY_BATCH_KEY = 'proto_strategy_batches'
export const STRATEGY_LATCH_KEY = 'proto_strategy_latches'
export const STRATEGY_LOG_KEY = 'proto_strategy_logs'
export const STRATEGY_VERSION_KEY = 'proto_strategy_data_version'

/** 【原型说明】演示数据结构版本，调整演示数据时提升版本以清理旧数据 */
export const STRATEGY_DATA_VERSION = '6'

/** 策略名称长度（PRD F-LST-03 业务规则） */
export const STRATEGY_NAME_MIN = 2
export const STRATEGY_NAME_MAX = 30

/** 策略备注长度上限 */
export const STRATEGY_REMARK_MAX = 200

/** 时控单策略的时间点条目上限（Q-LST-03 已关闭：维持 20 条） */
export const TIME_POINT_MAX = 20

/** 负控单策略的触发规则条数上限（事件 + 动作 成对配置） */
export const EVENT_RULE_MAX = 10

/** 负控执行延时的取值范围（分钟）：命中事件后延时下发该规则的动作，0 表示立即执行 */
export const DELAY_MIN = 0
export const DELAY_MAX = 60

/** 查询关键字长度上限 */
export const SEARCH_MAX = 30

/** 【原型说明】设备级执行结果的失败原因候选，用于演示失败与跳过路径 */
export const EXEC_FAIL_REASONS = ['设备离线或通信失败', '设备响应超时', '设备侧拒绝执行'] as const

export const STRATEGY_ALL_KEYS = [
  STRATEGY_LIST_KEY,
  STRATEGY_BATCH_KEY,
  STRATEGY_LATCH_KEY,
  STRATEGY_LOG_KEY,
] as const
