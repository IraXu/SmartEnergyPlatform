/**
 * 【原型说明】设备管理 › 设备OTA 模块的数据结构定义，仅用于原型交互验证。
 * 信息项对齐《产品需求文档-设备OTA》v1.0 与《产品交互设计文档-设备OTA》v1.0，
 * 不涉及数据库表、字段类型或接口设计。
 *
 * 固件包由平台运营方统一维护，企业侧只读；本模块只承载「设备固件版本 → 检测 → 升级 → 进度」的消费视图。
 */

/** 新固件标识：由「设备当前版本」与「平台最新版本」比较自动得出 */
export type FirmwareState = '有新固件' | '无新固件' | '待检测' | '不可判断'

/** 设备维度的升级状态（记录最近一次升级的结果） */
export type UpgradeStatus = '未升级' | '升级中' | '升级成功' | '升级失败'

/** 升级任务内单台设备的状态 */
export type UpgradeTaskDeviceStatus = '排队中' | '升级中' | '升级成功' | '升级失败' | '已跳过'

/** 升级任务状态（由任务内设备结果聚合） */
export type UpgradeTaskStatus = '进行中' | '已完成' | '部分失败' | '全部失败'

/** 一个固件版本（平台固件基线中的一项） */
export interface FirmwareRelease {
  /** 版本号，格式 V{主}.{次}.{修订} */
  version: string
  /** 发布日期，YYYY-MM-DD */
  releasedAt: string
  /** 固件包大小展示文本 */
  size: string
  /** 更新说明：条目化纯文本 */
  notes: string[]
}

/**
 * 固件基线：按「设备类型 + 规格型号」匹配设备可用的固件版本清单。
 * 由平台运营方维护，企业侧只读。
 */
export interface FirmwareBaseline {
  type: string
  model: string
  /** 可用的固件版本清单（按版本升序） */
  releases: FirmwareRelease[]
}

/** 设备的固件与升级状态（OTA 侧数据，按设备标识关联设备台账） */
export interface OtaState {
  deviceId: string
  /** 设备最近一次上报 / 检测到的当前固件版本；从未建连或未上报为空字符串 */
  currentVersion: string
  /** 最近一次检测时间 */
  detectedAt: number | null
  upgradeStatus: UpgradeStatus
  /** 升级中进度百分比 0-100 */
  progress: number
  /** 升级失败原因 */
  failReason: string
  /** 升级中或最近一次所属升级任务标识 */
  taskId: string | null
  /** 最近一次升级结果时间 */
  lastUpgradedAt: number | null
}

/** 升级任务内的一台设备 */
export interface UpgradeTaskDevice {
  deviceId: string
  deviceName: string
  /** 设备识别码（IMEI），与设备台账口径一致 */
  deviceImei: string
  fromVersion: string
  toVersion: string
  progress: number
  status: UpgradeTaskDeviceStatus
  failReason: string
  /** 【原型说明】该设备是否会被演示为升级失败（离线设备与原因为固定演示规则） */
  willFail: boolean
}

/** 一次升级任务 */
export interface UpgradeTask {
  id: string
  /** 目标固件版本；多版本时展示「多个版本」，逐设备的具体目标见 devices */
  targetVersions: string[]
  account: string
  createdAt: number
  status: UpgradeTaskStatus
  devices: UpgradeTaskDevice[]
}

/** 查询条件 */
export interface OtaFilters {
  /** 设备名称 / 识别码 / License：按三者模糊匹配（或关系） */
  keyword: string
  /** 设备类型，多选；空数组表示全部 */
  types: string[]
  /** 所属用能单元；选中节点时表示「该节点及其全部下级」 */
  unitId: string | null
  /** 新固件标识，多选；空数组表示全部 */
  firmwareStates: FirmwareStateFilter[]
  /** 升级状态，多选；空数组表示全部 */
  upgradeStatuses: UpgradeStatus[]
}

/** 查询条件中的新固件标识（仅两项；「待检测」「不可判断」不作为筛选维度） */
export type FirmwareStateFilter = '有新固件' | '无新固件'

/** 检测结果 */
export interface DetectResult {
  /** 检测是否成功 */
  ok: boolean
  /** 成功时的固件状态 */
  state: FirmwareState
  /** 成功时的当前版本 */
  version: string
}

/** OTA 变更类型 */
export type OtaChangeType = '检测设备' | '设备OTA升级'

/** 【原型说明】OTA 变更记录，对应 PRD 的审计要求（正式查看入口为「系统管理 › 系统日志」） */
export interface OtaChangeLog {
  id: string
  at: number
  account: string
  type: OtaChangeType
  /** 目标设备标识 */
  deviceId: string
  /** 目标设备展示名（名称 + 识别码） */
  target: string
  detail: string
}

/**
 * 【权限】当前账号在设备OTA 页可执行的操作集合。
 * 对应权限点：`device:ota`（进入）与 `device:ota:detect` / `device:ota:upgrade`。
 */
export interface OtaPerms {
  view: boolean
  detect: boolean
  upgrade: boolean
}
