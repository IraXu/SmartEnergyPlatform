/**
 * 【原型说明】设备管理 › 设备台账模块的数据结构定义，仅用于原型交互验证。
 * 信息项对齐《产品需求文档-设备台账》v1.0 与《产品交互设计文档-设备台账》v1.0，
 * 不涉及数据库表、字段类型或接口设计。
 */

/** 设备类型归类：计量表计 / 网关设备（PRD 6.4） */
export type DeviceCategory = '计量表计' | '网关设备'

/** 类型专属数据字段：名称 + 可选单位（详情页按「数值 + 单位」呈现） */
export interface DeviceMetricField {
  name: string
  /** 单位，如 V / A / kW；无量纲字段（功率因数等）留空 */
  unit?: string
}

/** 设备类型字典项 */
export interface DeviceTypeItem {
  /** 类型名称，如「智能电表」 */
  name: string
  category: DeviceCategory
  /** 该类型的专属信息项分组（详情页专属数据区使用） */
  groups: Array<{ title: string; fields: DeviceMetricField[] }>
}

/** 在线状态：在线 / 离线（由设备通信状态决定，两态互斥） */
export type OnlineStatus = '在线' | '离线'

/**
 * 拉合闸状态：设备侧回路的通断状态，由设备上报，本模块只读。
 * 未上报时无该状态（为 null）。
 */
export type LatchStatus = '合闸' | '分闸'

/**
 * 信号强度：仅 4G 等无线通讯方式的设备有此项，由设备上报。
 * 以 0-31 的原始值（CSQ）或 0-100 的百分比承载，统一以文本展示。
 */
export type SignalStrength = string

/** 设备的专属数据快照：字段名 → 展示值；未上报或未定义时为空 */
export type DeviceMetrics = Record<string, string>

/**
 * 一台设备。
 * 设备是平台主数据对象：设备台账负责建档与归属维护，告警中心等模块引用设备。
 */
export interface Device {
  id: string
  /** 设备名称（用户可读名） */
  name: string
  /**
   * 设备识别码（IMEI）：填写 License 后由平台查询带出并自动填入；
   * 平台未查询到（设备未上云）时允许用户按现场实际自定义填写。
   */
  imei: string
  /**
   * 表号：填写 License 后由平台 / 网关查询带出并自动填入；
   * 与上级网关通讯的设备以表号唯一判定，插卡的 4G 智能电表以 IMEI 唯一判定；
   * 平台未查询到且该设备无表号时留空。
   */
  meterNo: string
  /**
   * 卡号（ICCID）：设备建档完成后由服务端返回，前端不可录入与编辑。
   * 未完成装卡 / 未上云设备为空，界面展示占位符。
   */
  cardNo: string
  /** License：必填且全平台唯一，是用户在表单中填写的设备唯一标识 */
  license: string
  /** 设备类型名称，须在设备类型字典内；由设备上云后服务端返回 */
  type: string
  /** 规格型号 */
  model: string
  /** 生产厂家 */
  factory: string
  /** 出厂日期，YYYY-MM-DD；未填为空字符串 */
  factoryDate: string
  /** 所属用能单元 id；未绑定为空字符串 */
  unitId: string
  /** 安装日期，YYYY-MM-DD */
  installDate: string
  /** 安装位置描述 */
  installPosition: string
  /** 设备 GPS 经度；选所属用能单元时默认取该用能单元坐标，也可地图选点自定义 */
  lng: number | null
  /** 设备 GPS 纬度 */
  lat: number | null
  /**
   * GPS 是否由用户地图选点自定义。
   * false 表示沿用所属用能单元的坐标，用能单元坐标变更时随之更新。
   */
  gpsCustom: boolean
  /** 通信方式，如 4G / 以太网 */
  commType: string
  /** 采集 / 抄表协议，如 DL/T645 */
  protocol: string
  /** 上级网关的设备识别码（文本记录，本期不做拓扑校验） */
  gatewayImei: string
  /** 在线状态：由通信状态决定，本模块只读；在线 / 离线两态互斥 */
  onlineStatus: OnlineStatus
  /**
   * 拉合闸状态：设备侧回路的通断状态，由设备上报，本模块只读；
   * 未上报时为 null，界面展示占位符。
   */
  latchStatus: LatchStatus | null
  /**
   * 信号强度：仅无线通讯方式（如 4G / NB-IoT）的设备有值，由设备上报；
   * 有线通讯（以太网）或未上报时为空字符串。
   */
  signalStrength: SignalStrength
  /** 首次接入时间（设备首次与平台建连的时间） */
  accessedAt: number | null
  /** 最近上报时间 */
  lastReportAt: number | null
  /**
   * 设备图片地址：由「智慧物联生态平台」维护并返回。
   * 该平台未维护时为空字符串，界面展示默认兜底图。
   */
  imageUrl: string
  /** 类型专属数据快照（只读） */
  metrics: DeviceMetrics
  remark: string
  /** 添加时间（建档时间），列表默认按其倒序排列，支持点击列头两态切换 */
  createdAt: number
}

export type DeviceChangeType = '新增设备' | '批量添加' | '编辑设备' | '迁移' | '删除设备'

/**
 * 【原型说明】设备变更记录，对应 PRD F-DEV 的审计要求。
 * 详情页不再展示该区块，正式查看入口为「系统管理 › 系统日志」。
 */
export interface DeviceChangeLog {
  id: string
  at: number
  account: string
  type: DeviceChangeType
  /** 目标设备标识 */
  deviceId: string
  /** 目标设备展示名（名称 + 设备识别码） */
  target: string
  detail: string
}

/** 设备控制指令（PRD F-DEV-15）：校时 / 抄表 / 合闸 / 分闸 / 重连 */
export type DeviceCommand = '校时' | '抄表' | '合闸' | '分闸' | '重连'

/** 指令风险等级：danger 类指令（分闸 / 合闸）影响现场供电，需在确认弹窗中突出风险提示 */
export type DeviceCommandRisk = 'normal' | 'danger'

/**
 * 设备控制指令的权限点标识。
 * 每个指令独立授权，最小颗粒度落到指令级：
 * 只授予「分闸」即可让一线人员停电，但不具备送电（合闸）能力。
 */
export type DeviceCommandPermission =
  | 'device:ledger:control:timesync'
  | 'device:ledger:control:meterread'
  | 'device:ledger:control:switchon'
  | 'device:ledger:control:switchoff'
  | 'device:ledger:control:reconnect'

/** 设备控制指令字典项 */
export interface DeviceCommandItem {
  /** 指令名称，同时作为下发记录中的事件名 */
  name: DeviceCommand
  /** 一句话说明指令的作用 */
  desc: string
  /** 风险等级 */
  risk: DeviceCommandRisk
  /** 二次确认弹窗中的正文（说明影响与前置条件） */
  confirmText: string
  /** 该指令对应的按钮级权限点；无此权限时指令置灰并提示 */
  permission: DeviceCommandPermission
}

/** MQTT 通讯方向：上行 = 设备上报，下行 = 平台下发 */
export type MqttDirection = '上行' | '下行'

/** MQTT 通讯结果 */
export type MqttResult = '成功' | '失败'

/** MQTT 通讯日志（PRD F-DEV-14：仅保留最近 30 天，超出自动删除） */
export interface MqttLog {
  id: string
  /** 所属设备 id */
  deviceId: string
  /** 通讯时间 */
  at: number
  direction: MqttDirection
  /** 通讯主题 */
  topic: string
  /**
   * 事件名称：上行以「数据上报」「心跳」等采集事件命名，
   * 下行以设备控制指令命名（校时 / 抄表 / 合闸 / 分闸 / 重连）。
   */
  event: string
  result: MqttResult
  /** 报文摘要，展开日志时可查看 */
  payload: string
  /** 通讯耗时（ms）；失败时为 null */
  cost: number | null
  /** 失败原因；成功时为空 */
  error: string
}

/** 设备控制指令的下发结果 */
export interface CommandResult {
  ok: boolean
  /** 展示给用户的结论文案 */
  message: string
}

/** 上下线事件类型：上线与离线各自独立成一条记录 */
export type DeviceSessionEventType = '上线' | '离线'

/**
 * 设备上下线记录：一条记录只承载一个事件（上线或离线）。
 * 与「上线 → 离线」成对呈现的会话不同，事件流水更贴近现场日志的原始形态，
 * 便于逐条排查「某时刻发生了什么」；在线率等汇总口径由 store 侧从事件推导。
 */
export interface DeviceSessionEvent {
  id: string
  /** 所属设备 id */
  deviceId: string
  /** 事件发生时间 */
  at: number
  type: DeviceSessionEventType
  /**
   * 事件说明：离线为断开原因（如「现场断电，设备失联」），
   * 上线为建立连接的说明；无补充信息时为空。
   */
  detail: string
}

/** 可配置参数的录入形态：数值 / 枚举 */
export type ParamInputType = 'number' | 'select'

/** 参数开放状态：本期开放 / 待规划（待规划项不在本期界面呈现） */
export type ParamStatus = 'active' | 'planned'

/**
 * 一个可配置参数的定义。
 * 新增配置项只需在参数字典中追加一条，抽屉按分组自动呈现，无需改动页面结构。
 */
export interface DeviceParamItem {
  /** 参数标识，全局唯一，用作设备侧的读写键 */
  key: string
  /** 参数名称，如「PT 变比」 */
  name: string
  /** 所属分组标识（见 DEVICE_PARAM_GROUPS） */
  group: string
  /** 录入形态 */
  type: ParamInputType
  /** 单位，如「倍」「s」；无量纲留空 */
  unit?: string
  /** 允许的取值范围（数值型），用于前端校验与提示 */
  min?: number
  max?: number
  /** 小数位（数值型）；0 或省略表示整数 */
  precision?: number
  /** 枚举型可选值（type 为 select 时必填） */
  options?: string[]
  /** 一句话说明该参数的作用，作为字段下方提示 */
  desc: string
  /** 是否为必填项 */
  required?: boolean
  /**
   * 开放状态：`planned` 表示本期不开放，界面不呈现、校验不参与；
   * 后续开放时只需把该字段改为 `active`（或删除），无需改动其它代码。
   */
  status: ParamStatus
}

/** 参数分组：新增分组只需在清单中追加一条 */
export interface DeviceParamGroup {
  key: string
  name: string
  desc: string
}

/** 某台设备的参数值快照：参数标识 → 设备侧当前值（文本形式统一承载数值与枚举） */
export type DeviceParamValues = Record<string, string>

/** 查询条件 */
export interface DeviceFilters {
  /** 设备名称：按名称模糊匹配 */
  name: string
  /** 设备识别码（IMEI）：按识别码模糊匹配 */
  imei: string
  /** License：按 License 模糊匹配 */
  license: string
  /** 表号：按表号模糊匹配 */
  meterNo: string
  /** 设备类型，多选；空数组表示全部；未上云的设备类型为空，不参与筛选 */
  types: string[]
  /** 所属用能单元；选中节点时表示「该节点及其全部下级」 */
  unitId: string | null
  /** 拉合闸状态，多选；空数组表示全部；无该状态（未上报）的设备不参与筛选 */
  latchStatuses: LatchStatus[]
  /** 在线状态，多选；空数组表示全部 */
  onlineStatuses: OnlineStatus[]
}

/** 列表排序：仅按建档时间，两态互斥（不提供「取消排序」） */
export type SortOrder = 'descend' | 'ascend'

/**
 * 新增 / 编辑设备的表单入参。
 * 不含设备类型、卡号与状态：这些由服务端 / 平台返回，状态由设备侧决定。
 * 设备识别码（IMEI）与表号：填写 License 后由平台查询自动带出；
 * 平台未查询到时允许用户按现场实际自定义填写。
 */
export interface DeviceInput {
  name: string
  /** 设备唯一标识，必填且全平台唯一；IMEI 与表号由平台按 License 查询带出 */
  license: string
  /** 设备识别码（IMEI）：平台带出或用户自定义 */
  imei: string
  /** 表号：平台 / 网关带出或用户自定义；插卡 4G 设备可留空 */
  meterNo: string
  model: string
  factory: string
  factoryDate: string
  unitId: string
  installDate: string
  installPosition: string
  /** 设备 GPS 经度；未选点时为空 */
  lng: number | null
  /** 设备 GPS 纬度 */
  lat: number | null
  /** GPS 是否由用户地图选点自定义；false 表示跟随所属用能单元 */
  gpsCustom: boolean
  commType: string
  protocol: string
  gatewayImei: string
  remark: string
}

/** 批量导入的解析结果行 */
export interface ImportRow {
  /** 文件中的行号（含表头，便于用户对照） */
  lineNo: number
  /** 原始行内容，用于失败报告 */
  raw: Record<string, string>
  /** 校验通过时的设备入参 */
  input: DeviceInput | null
  /** 失败原因；校验通过时为空 */
  error: string
}

/**
 * 批量导入删除的解析结果行。
 * 按 License 唯一定位设备：命中则可删除，未命中（不存在 / 重复 / 为空）跳过并给出原因。
 */
export interface ImportDeleteRow {
  /** 文件中的行号（含表头，便于用户对照） */
  lineNo: number
  /** 该行填写的 License */
  license: string
  /** 命中的设备；未命中时为空 */
  device: Device | null
  /** 未命中原因；命中时为空 */
  error: string
}

/**
 * 【权限】当前账号在设备台账页可执行的操作集合。
 * 对应权限点：`device:ledger`（进入）与 `device:ledger:create` / `:import` / `:importdelete`
 * / `:edit` / `:move` / `:delete`。
 */
export interface DevicePerms {
  view: boolean
  create: boolean
  import: boolean
  /** 按文件批量删除设备 */
  importDelete: boolean
  edit: boolean
  move: boolean
  remove: boolean
}
