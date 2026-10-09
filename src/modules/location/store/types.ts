/**
 * 【原型说明】点位地图模块的数据结构定义，仅用于原型交互验证。
 * 信息项对齐《产品需求文档-点位地图》v1.0 与《产品交互设计文档-点位地图》v1.0，
 * 不涉及数据库表、字段类型或接口设计。
 *
 * 本模块为**只读空间视图**：不新建业务对象，用能单元与设备均为引用
 * （来自组织架构与设备台账的演示数据容器）。
 */

/** 维度：用能单元 / 设备（PRD F-LOC-01） */
export type LocationDimension = 'unit' | 'device'

/** 用能单元维度的筛选条件（PRD F-LOC-07） */
export interface UnitFilters {
  /** 所属组织节点；选中时表示「该节点及其全部下级」 */
  orgId: string | null
}

/** 设备维度的筛选条件（PRD F-LOC-07） */
export interface DeviceFilters {
  /** 设备类型，多选；空数组表示全部 */
  types: string[]
  /** 在线状态，多选；空数组表示全部 */
  onlineStatuses: DeviceOnlineState[]
  /** 所属用能单元；选中时表示「该用能单元本身」（用能单元无下级） */
  unitId: string | null
}

/** 设备在地图上的在线状态（与设备台账一致，两态互斥） */
export type DeviceOnlineState = '在线' | '离线'

/**
 * 地图上的一个标记（用能单元维度与设备维度共用位置信息）。
 * 坐标为经纬度，由地图视野换算为画布百分比位置。
 */
export interface MapMarker {
  /** 用能单元 id 或设备 id */
  id: string
  name: string
  lng: number
  lat: number
}

/** 用能单元维度的标记：聚合标记 + 该单元下的设备数 */
export interface UnitMarker extends MapMarker {
  /** 该用能单元下的全部设备数（含离线设备） */
  deviceCount: number
  /** 用能单元编码 */
  unitCode: string
}

/** 设备维度的标记：逐台独立标记 + 在线状态 */
export interface DeviceMarker extends MapMarker {
  type: string
  license: string
  onlineState: DeviceOnlineState
}

/** 设备明细行（OVERLAY-01 抽屉内的设备列表） */
export interface UnitDeviceRow {
  id: string
  name: string
  type: string
  license: string
  onlineState: DeviceOnlineState
}

/** 用能单元档案摘要（OVERLAY-01 抽屉上半部） */
export interface UnitProfile {
  id: string
  name: string
  unitCode: string
  /** 所属组织节点完整层级路径（不含用能单元自身）；节点已失效时为空字符串 */
  orgPath: string
  /** 所属组织节点是否已失效 */
  orgInvalid: boolean
  /** GPS 坐标展示文本 */
  coordinate: string
  address: string
  remark: string
}

/** 位置检索结果项（PRD F-LOC-06） */
export interface SearchHit {
  id: string
  name: string
  /** 副标题：用能单元展示编码；设备展示类型 + License */
  subtitle: string
  /** 设备检索结果额外携带，用于命中后打开信息卡 */
  onlineState?: DeviceOnlineState
}

/** 地图视野：当前可视范围对应的经纬度矩形 */
export interface MapViewport {
  centerLng: number
  centerLat: number
  spanLng: number
  spanLat: number
}

/**
 * 【权限】当前账号在点位地图页可执行的操作集合。
 * 本模块仅设目录级权限点 `location`（一级导航项自身即页面，只读、无按钮级权限点）。
 * `view` 为进入本模块的前提；`openDeviceDetail` 决定是否渲染「查看详情」与设备名称链接
 * （跳转设备详情依赖设备台账的 `device:ledger`，见 PRD F-LOC-04）。
 */
export interface LocationPerms {
  view: boolean
  openDeviceDetail: boolean
}
