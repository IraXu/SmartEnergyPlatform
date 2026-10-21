/**
 * 【原型说明】平台管理端的数据结构定义，仅用于原型交互验证，非生产代码。
 * 信息项对齐《产品需求文档-平台管理端总览》《首页》《客户&设备》《平台成员管理》《平台角色管理》v1.0，
 * 不涉及数据库表、字段类型或接口设计。
 */

/* ---------- 平台成员 ---------- */

/** 平台成员状态：正常 / 已停用（平台成员级），锁定由登录失败驱动、不由本页控制 */
export type PlatformMemberStatus = 'normal' | 'disabled'

export interface PlatformMember {
  id: string
  /** 成员姓名 */
  name: string
  /** 账号标识：邮箱（平台成员为运营方内部人员） */
  identifier: string
  /**
   * 【原型说明】平台成员的登录密码。
   * 对齐平台成员管理 PRD：账号在平台不存在时由超管设置初始密码；
   * 此处仅用于原型校验，非明文存储方案。
   */
  password: string
  /** 是否内置平台超级管理员：不可删除、不可修改、默认全量权限 */
  super: boolean
  status: PlatformMemberStatus
  /** 拥有的平台角色标识集合（内置超管的角色恒为预置角色，不可调整） */
  roleIds: string[]
  createdAt: number
  updatedAt: number
  /** 是否尚未修改过由超管下发的初始密码（列表展示「待改密」标识） */
  mustChangePassword?: boolean
}

export interface PlatformMemberInput {
  name: string
  identifier: string
  /** 账号类型：手机号 / 邮箱（由输入内容自动识别） */
  accountType?: 'phone' | 'email'
  /** 手机号账号的国际区号，邮箱账号为空 */
  countryCode?: string
  /** 账号在平台不存在时的初始密码；账号已存在且未归属企业时为空（免密沿用） */
  password?: string
  roleIds: string[]
}

/* ---------- 平台角色 ---------- */

export type PlatformRoleSource = 'preset' | 'custom'

export interface PlatformRole {
  id: string
  name: string
  desc: string
  source: PlatformRoleSource
  /** 已授权的平台权限节点标识集合（收敛态） */
  permissions: string[]
  createdAt: number
}

export interface PlatformRoleInput {
  name: string
  desc: string
}

/* ---------- 平台权限点 ---------- */

export type PlatformPermissionLevel = 'dir' | 'menu' | 'action'

export interface PlatformPermissionNode {
  key: string
  name: string
  level: PlatformPermissionLevel
  children: PlatformPermissionNode[]
}

/* ---------- 客户&设备（平台端只读视图） ---------- */

/** 用能单元节点（平台端按企业组织，用于「所属企业 → 所属用能单元」树选择） */
export interface PlatformUnitNode {
  id: string
  name: string
  children?: PlatformUnitNode[]
}

/** 平台端一家企业（用于「所属企业」筛选与统计口径） */
export interface PlatformEnterprise {
  id: string
  name: string
  /** 该企业在册设备总数（统计区口径，全平台 = 各企业之和） */
  deviceCount: number
  /** 该企业在线设备数（统计区口径） */
  onlineCount: number
}

/**
 * 平台设备（只读）
 * 字段口径沿用企业端「设备台账」；差异点是新增「所属企业」（列表首列 / 查询首项）。
 */
export interface PlatformDevice {
  id: string
  /** 所属企业 id */
  enterpriseId: string
  /** 所属企业名称（列表首列 / 查询条件首项） */
  enterpriseName: string
  /** 所属用能单元 id（取自本企业用能单元树） */
  unitId: string
  /** 设备名称 */
  name: string
  /** License（全平台唯一标识） */
  license: string
  /** 设备识别码（IMEI） */
  imei: string
  /** 表号 */
  meterNo: string
  /** 卡号（ICCID） */
  cardNo: string
  /** 设备类型 */
  type: string
  /** 规格型号 */
  model: string
  /** 生产厂家 */
  factory: string
  /** 出厂日期 YYYY-MM-DD */
  factoryDate: string
  /** 安装日期 YYYY-MM-DD */
  installDate: string
  /** 安装位置描述 */
  installPosition: string
  /** 通信方式，如 4G / NB-IoT / 以太网 */
  commType: string
  /** 采集 / 抄表协议 */
  protocol: string
  /** 上级网关设备识别码 */
  gatewayImei: string
  /** GPS 经度 */
  lng: number | null
  /** GPS 纬度 */
  lat: number | null
  /** 拉合闸状态（设备上报，只读；未上报为 null） */
  latchStatus: '合闸' | '分闸' | null
  /** 在线状态（只读） */
  onlineStatus: '在线' | '离线'
  /** 信号强度（CSQ），仅 4G 设备有值 */
  signalStrength: string
  /** CT 变比（只读，取自设备参数） */
  ctRatio: string
  /** PT 变比（只读，取自设备参数） */
  ptRatio: string
  /** 类型专属数据快照（只读；字段名 → 展示值） */
  metrics: Record<string, string>
  /** 关联负荷策略：时控条数（跨企业只读概览） */
  strategyTimeCount: number
  /** 关联负荷策略：负控条数 */
  strategyLoadCount: number
  /** 备注 */
  remark: string
  /** 添加时间（建档时间） */
  createdAt: number
}

/** 客户&设备查询条件（首项为「所属企业」） */
export interface PlatformDeviceFilters {
  /** 所属企业 id；null 表示全部企业 */
  enterpriseId: string | null
  /** 所属用能单元 id（仅当选定企业后由树选择给出） */
  unitId: string | null
  /** 所属用能单元关键字（未选企业时按路径文本模糊匹配） */
  unitText: string
  name: string
  imei: string
  license: string
  meterNo: string
  types: string[]
  latchStatuses: Array<'合闸' | '分闸'>
  onlineStatuses: Array<'在线' | '离线'>
}

/** 规模统计区口径 */
export interface PlatformCustomerStats {
  /** 企业总数 */
  enterpriseCount: number
  /** 设备总数 */
  deviceCount: number
  /** 在线设备数 */
  onlineDeviceCount: number
  /** 在线率（0-100，保留 1 位小数）；设备总数为 0 时为 null */
  onlineRate: number | null
}

/** 平台端设备 MQTT 通讯日志（只读，仅保留最近 30 天） */
export interface PlatformMqttLog {
  id: string
  deviceId: string
  at: number
  direction: '上行' | '下行'
  event: string
  topic: string
  result: '成功' | '失败'
  payload: string
  cost: number | null
  error: string
}

/** 上下线事件类型：上线与离线各自独立成一条记录 */
export type PlatformSessionEventType = '上线' | '离线'

/** 平台端设备上下线记录（只读，仅保留最近 30 天） */
export interface PlatformSessionEvent {
  id: string
  deviceId: string
  at: number
  type: PlatformSessionEventType
  detail: string
}

/* ---------- 平台概览指标 ---------- */

export interface PlatformOverview {
  customerCount: number
  deviceCount: number
  onlineDeviceCount: number
  /** 最近一次成功统计的时间戳 */
  updatedAt: number
}
