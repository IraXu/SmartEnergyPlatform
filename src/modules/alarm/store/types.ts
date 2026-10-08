/**
 * 【原型说明】告警中心模块的数据结构定义，仅用于原型交互验证。
 * 不涉及数据库表、字段类型或接口设计。
 */

/**
 * 一条告警。
 * 设备先在本地触发报警并上报到云端，再由云端推送到本系统，因此一条推送即一条告警。
 */
export interface Alarm {
  /** 告警编号 */
  id: string
  /** 事件类型名称，如「A相失压」「开表盖」 */
  eventType: string
  /** 事件类别，用于事件类型查询分组 */
  eventCategory: string
  /** 告警内容（一句话描述） */
  content: string
  /** 所属设备编号 */
  meterId: string
  /** 所属设备名称 */
  meterName: string
  /** 设备 License（设备唯一标识） */
  meterLicense: string
  /** 所属用能单元 id */
  unitId: string
  /** 所属用能单元完整层级路径 */
  unitPath: string
  /** 告警时间（云端推送时间） */
  reportAt: number
}

/** 删除动作的审计记录（对应「系统管理 › 系统日志」，本页不展示独立界面） */
export interface AlarmChangeLog {
  id: string
  at: number
  account: string
  type: '删除告警'
  detail: string
}

/** 事件类型字典项 */
export interface EventTypeItem {
  category: string
  name: string
}

/** 告警时间范围：起止均为当天，格式 YYYY-MM-DD */
export type DateRange = [string, string]

/** 查询条件 */
export interface AlarmFilters {
  /** 告警时间范围，默认今日；跨度上限 12 个月 */
  dateRange: DateRange
  /** 事件类型，多选；空数组表示全部 */
  eventTypes: string[]
  /** 所属用能单元；选中节点时表示「该节点及其全部下级」 */
  unitId: string | null
  /** 所属设备：按设备名称或 License 模糊匹配 */
  meterKeyword: string
}

/** 列表排序方向（仅告警时间可排序，默认倒序） */
export type SortOrder = 'ascend' | 'descend'
