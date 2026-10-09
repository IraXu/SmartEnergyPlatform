/**
 * 【原型说明】点位地图的数据加工逻辑，仅用于原型交互验证。
 * 业务规则对齐《产品需求文档-点位地图》v1.0：
 * - 只读空间视图：不新增/编辑/删除任何数据
 * - 数据源为组织架构的用能单元坐标与设备台账的设备坐标（均为已有数据）
 * - 无坐标对象不渲染、不列出、不提示（坐标在两模块均为必填，缺失属异常数据）
 * - 用能单元维度为聚合标记 + 抽屉下钻；设备维度为逐台独立标记 + 信息卡
 * - 设备维度单次渲染上限 500 个，超出按「当前视野内 + 最近上报优先」截取
 * - 位置检索与条件筛选只作用于有坐标对象
 */

import {
  getNode,
  getPathText,
  getSubtreeIds,
  nodes as orgNodes,
  type OrgNode,
} from '@/modules/org/store'
import { devices as deviceList, formatCoordinate } from '@/modules/device/store'
import type { Device } from '@/modules/device/store'
import {
  DEFAULT_SPAN_LAT,
  DEFAULT_SPAN_LNG,
  MARKER_LIMIT,
  MAX_SPAN_LAT,
  MAX_SPAN_LNG,
  MIN_SPAN_LAT,
  MIN_SPAN_LNG,
  PAN_RATIO,
  SEARCH_HIT_MAX,
  SEARCH_MAX,
  ZOOM_IN_RATIO,
  ZOOM_OUT_RATIO,
} from './constants'
import type {
  DeviceFilters,
  DeviceMarker,
  DeviceOnlineState,
  LocationPerms,
  MapViewport,
  SearchHit,
  UnitDeviceRow,
  UnitFilters,
  UnitMarker,
  UnitProfile,
} from './types'

/* ---------- 通用 ---------- */

const hasCoordinate = (lng: number | null, lat: number | null): boolean => lng !== null && lat !== null

/** 无坐标对象一律不参与地图呈现、检索与筛选（PRD 决策：不渲染、不列出、不提示） */
const located = <T extends { lng: number | null; lat: number | null }>(item: T): boolean =>
  hasCoordinate(item.lng, item.lat)

/** 设备的在线状态：与设备台账一致，两态互斥 */
export function onlineStateOf(device: Device): DeviceOnlineState {
  return device.onlineStatus
}

/** 地图标记叠放优先级：离线优先 → 在线（PRD F-LOC-05 业务规则） */
const STATE_PRIORITY: Record<DeviceOnlineState, number> = { 离线: 0, 在线: 1 }

/* ---------- 用能单元维度 ---------- */

/** 企业全部用能单元（含未设坐标的），用于区分「无用能单元」与「有用能单元但均未设坐标」 */
export function allUnits(): OrgNode[] {
  return orgNodes.filter((node) => node.kind === 'unit')
}

/** 有坐标的用能单元（组织架构中 kind = 'unit' 且经纬度齐备） */
export function locatedUnits(): OrgNode[] {
  return orgNodes.filter((node) => node.kind === 'unit' && located(node))
}

/** 某用能单元下的全部设备（按所属用能单元精确匹配——用能单元是最小计量落位，无下级） */
export function devicesOfUnit(unitId: string): Device[] {
  return deviceList.filter((device) => device.unitId === unitId)
}

/** 某用能单元下有坐标的设备 */
export function locatedDevicesOfUnit(unitId: string): Device[] {
  return devicesOfUnit(unitId).filter(located)
}

/** 用能单元维度的标记列表；按条件筛选（所属组织节点含下级语义） */
export function unitMarkers(filters: UnitFilters): UnitMarker[] {
  const scope = filters.orgId ? getSubtreeIds(filters.orgId) : null
  return locatedUnits()
    .filter((node) => !scope || scope.includes(node.id))
    .map((node) => ({
      id: node.id,
      name: node.name,
      lng: node.lng as number,
      lat: node.lat as number,
      unitCode: node.unitCode || '—',
      // 徽标口径为该用能单元下的全部设备数（含离线设备）
      deviceCount: devicesOfUnit(node.id).length,
    }))
}

/** 用能单元档案摘要（OVERLAY-01 抽屉上半部） */
export function unitProfile(unitId: string): UnitProfile | null {
  const node = getNode(unitId)
  if (!node || node.kind !== 'unit') return null
  const parentExists = Boolean(node.parentId && getNode(node.parentId))
  return {
    id: node.id,
    name: node.name,
    unitCode: node.unitCode || '—',
    // 所属组织节点已被删除时保留原值不可得，故以失效标记表达；正常时给完整层级路径
    orgPath: parentExists ? getPathText(node.parentId as string) : '',
    orgInvalid: !parentExists,
    coordinate: located(node) ? `${(node.lng as number).toFixed(6)}, ${(node.lat as number).toFixed(6)}` : '—',
    address: node.address || '',
    remark: node.remark || '',
  }
}

/** 用能单元下的设备明细行（仅含有坐标设备；PRD F-LOC-03） */
export function unitDeviceRows(unitId: string): UnitDeviceRow[] {
  return locatedDevicesOfUnit(unitId)
    .map((device) => ({
      id: device.id,
      name: device.name,
      type: device.type || '—',
      license: device.license,
      onlineState: onlineStateOf(device),
    }))
    .sort((a, b) => {
      const byState = STATE_PRIORITY[a.onlineState] - STATE_PRIORITY[b.onlineState]
      return byState !== 0 ? byState : a.name.localeCompare(b.name, 'zh-Hans-CN')
    })
}

/* ---------- 设备维度 ---------- */

/** 企业全部设备（含未设坐标的），用于区分「无设备」与「有设备但均未设坐标」 */
export function allDevices(): Device[] {
  return deviceList
}

/** 有坐标的设备 */
export function locatedDevices(): Device[] {
  return deviceList.filter(located)
}

/** 按条件筛选设备（维度之间为「且」，同一条件多选为「或」） */
export function filterLocatedDevices(filters: DeviceFilters): Device[] {
  const unitScope = filters.unitId ? getSubtreeIds(filters.unitId) : null
  return locatedDevices().filter((device) => {
    if (filters.types.length && !filters.types.includes(device.type)) return false
    if (filters.onlineStatuses.length && !filters.onlineStatuses.includes(onlineStateOf(device))) return false
    if (unitScope && !unitScope.includes(device.unitId)) return false
    return true
  })
}

/** 设备的最近上报时间（用于「最近上报优先」排序；未上报视为 0） */
const lastReportOf = (device: Device) => device.lastReportAt ?? 0

/**
 * 设备维度的标记列表：按「当前视野内 + 最近上报优先」截取前 500 个（PRD F-LOC-05）。
 * 返回被截取的标记与是否触发上限，供页面展示常驻提示条。
 */
export function deviceMarkers(
  filters: DeviceFilters,
  viewport: MapViewport,
): { markers: DeviceMarker[]; limited: boolean; total: number } {
  const candidates = filterLocatedDevices(filters)
  const total = candidates.length

  // 当前视野内优先：视野内有足够对象时不再纳入视野外对象
  const inView = candidates.filter((device) => inViewport(device.lng as number, device.lat as number, viewport))
  const pool = inView.length >= MARKER_LIMIT ? inView : candidates

  const sorted = [...pool].sort((a, b) => {
    const byReport = lastReportOf(b) - lastReportOf(a)
    if (byReport !== 0) return byReport
    return STATE_PRIORITY[onlineStateOf(a)] - STATE_PRIORITY[onlineStateOf(b)]
  })

  const sliced = sorted.slice(0, MARKER_LIMIT)
  return {
    markers: sliced.map((device) => ({
      id: device.id,
      name: device.name,
      lng: device.lng as number,
      lat: device.lat as number,
      type: device.type || '—',
      license: device.license,
      onlineState: onlineStateOf(device),
    })),
    limited: total > MARKER_LIMIT,
    total,
  }
}

function inViewport(lng: number, lat: number, viewport: MapViewport): boolean {
  const lngMin = viewport.centerLng - viewport.spanLng / 2
  const lngMax = viewport.centerLng + viewport.spanLng / 2
  const latMin = viewport.centerLat - viewport.spanLat / 2
  const latMax = viewport.centerLat + viewport.spanLat / 2
  return lng >= lngMin && lng <= lngMax && lat >= latMin && lat <= latMax
}

/** 设备信息卡所需的设备详情（OVERLAY-02） */
export function deviceProfile(deviceId: string) {
  const device = deviceList.find((item) => item.id === deviceId)
  if (!device) return null
  return {
    id: device.id,
    name: device.name,
    type: device.type || '—',
    license: device.license,
    onlineState: onlineStateOf(device),
    unitPath: device.unitId && getNode(device.unitId) ? getPathText(device.unitId) : '—',
    // 设备 GPS 坐标（经度在前、纬度在后，各 6 位小数）；无坐标时给占位符
    coordinate: formatCoordinate(device.lng, device.lat),
  }
}

/* ---------- 位置检索（PRD F-LOC-06） ---------- */

/** 用能单元维度检索：按用能单元名称 / 用能单元编码模糊匹配，只检索有坐标对象 */
export function searchUnits(keyword: string): SearchHit[] {
  const value = keyword.trim().slice(0, SEARCH_MAX).toLowerCase()
  if (!value) return []
  return locatedUnits()
    .filter(
      (node) =>
        node.name.toLowerCase().includes(value) || (node.unitCode || '').toLowerCase().includes(value),
    )
    .map((node) => ({
      id: node.id,
      name: node.name,
      subtitle: `用能单元编码 ${node.unitCode || '—'}`,
    }))
    .slice(0, SEARCH_HIT_MAX)
}

/** 设备维度检索：按设备名称 / 设备编号 / 设备 License 模糊匹配，只检索有坐标对象 */
export function searchDevices(keyword: string): SearchHit[] {
  const value = keyword.trim().slice(0, SEARCH_MAX).toLowerCase()
  if (!value) return []
  return locatedDevices()
    .filter(
      (device) =>
        device.name.toLowerCase().includes(value) ||
        device.imei.toLowerCase().includes(value) ||
        device.license.toLowerCase().includes(value),
    )
    .map((device) => ({
      id: device.id,
      name: device.name,
      subtitle: `${device.type || '—'} · ${device.license}`,
      onlineState: onlineStateOf(device),
    }))
    .slice(0, SEARCH_HIT_MAX)
}

/* ---------- 地图视野 ---------- */

/**
 * 默认视野：按企业全部有坐标对象的分布范围自适应，最小不低于默认跨度。
 * 无任何有坐标对象时回退到演示区域的默认中心（保证底图可见）。
 */
export function defaultViewport(): MapViewport {
  const points = [
    ...locatedUnits().map((node) => ({ lng: node.lng as number, lat: node.lat as number })),
    ...locatedDevices().map((device) => ({ lng: device.lng as number, lat: device.lat as number })),
  ]
  if (!points.length) return { centerLng: 113.8835, centerLat: 22.5645, spanLng: DEFAULT_SPAN_LNG, spanLat: DEFAULT_SPAN_LAT }

  const lngs = points.map((point) => point.lng)
  const lats = points.map((point) => point.lat)
  const centerLng = (Math.min(...lngs) + Math.max(...lngs)) / 2
  const centerLat = (Math.min(...lats) + Math.max(...lats)) / 2
  // 留出 20% 余量，避免边缘标记贴边
  const spanLng = Math.max((Math.max(...lngs) - Math.min(...lngs)) * 1.2, DEFAULT_SPAN_LNG)
  const spanLat = Math.max((Math.max(...lats) - Math.min(...lats)) * 1.2, DEFAULT_SPAN_LAT)
  return {
    centerLng,
    centerLat,
    spanLng: Math.min(spanLng, MAX_SPAN_LNG),
    spanLat: Math.min(spanLat, MAX_SPAN_LAT),
  }
}

const clampSpan = (span: number, min: number, max: number) => Math.min(Math.max(span, min), max)

/** 缩放：放大（in）或缩小（out）；跨度被钳制在上下限之间 */
export function zoomViewport(viewport: MapViewport, direction: 'in' | 'out'): MapViewport {
  const ratio = direction === 'in' ? ZOOM_IN_RATIO : ZOOM_OUT_RATIO
  return {
    ...viewport,
    spanLng: clampSpan(viewport.spanLng * ratio, MIN_SPAN_LNG, MAX_SPAN_LNG),
    spanLat: clampSpan(viewport.spanLat * ratio, MIN_SPAN_LAT, MAX_SPAN_LAT),
  }
}

/** 是否已达缩放上下限（用于缩放按钮置灰与提示） */
export function isZoomMin(viewport: MapViewport): boolean {
  return viewport.spanLng <= MIN_SPAN_LNG || viewport.spanLat <= MIN_SPAN_LAT
}

export function isZoomMax(viewport: MapViewport): boolean {
  return viewport.spanLng >= MAX_SPAN_LNG || viewport.spanLat >= MAX_SPAN_LAT
}

/** 平移：以当前跨度的固定比例为步长移动视野中心 */
export function panViewport(viewport: MapViewport, direction: 'up' | 'down' | 'left' | 'right'): MapViewport {
  const stepLng = viewport.spanLng * PAN_RATIO
  const stepLat = viewport.spanLat * PAN_RATIO
  return {
    ...viewport,
    centerLng:
      direction === 'left'
        ? viewport.centerLng - stepLng
        : direction === 'right'
          ? viewport.centerLng + stepLng
          : viewport.centerLng,
    centerLat:
      direction === 'up'
        ? viewport.centerLat + stepLat
        : direction === 'down'
          ? viewport.centerLat - stepLat
          : viewport.centerLat,
  }
}

/** 定位到某个坐标：保持当前跨度（已缩放到可辨认单点时不再放大） */
export function focusViewport(viewport: MapViewport, lng: number, lat: number): MapViewport {
  return {
    centerLng: lng,
    centerLat: lat,
    // 定位时若跨度过大则收敛到适合单点辨认的范围
    spanLng: clampSpan(Math.min(viewport.spanLng, DEFAULT_SPAN_LNG), MIN_SPAN_LNG, MAX_SPAN_LNG),
    spanLat: clampSpan(Math.min(viewport.spanLat, DEFAULT_SPAN_LAT), MIN_SPAN_LAT, MAX_SPAN_LAT),
  }
}

/** 坐标 → 地图内百分比位置；超出当前视野时返回 null（不渲染） */
export function toMapStyle(
  lng: number,
  lat: number,
  viewport: MapViewport,
): { left: string; top: string } | null {
  const lngMin = viewport.centerLng - viewport.spanLng / 2
  const lngMax = viewport.centerLng + viewport.spanLng / 2
  const latMin = viewport.centerLat - viewport.spanLat / 2
  const latMax = viewport.centerLat + viewport.spanLat / 2
  const left = ((lng - lngMin) / (lngMax - lngMin)) * 100
  const top = ((latMax - lat) / (latMax - latMin)) * 100
  if (left < 0 || left > 100 || top < 0 || top > 100) return null
  return { left: `${left}%`, top: `${top}%` }
}

/** 视野坐标读数（保留 2 位小数，经度在前、纬度在后） */
export function viewportReadout(viewport: MapViewport) {
  return {
    lngMin: (viewport.centerLng - viewport.spanLng / 2).toFixed(2),
    lngMax: (viewport.centerLng + viewport.spanLng / 2).toFixed(2),
    latMin: (viewport.centerLat - viewport.spanLat / 2).toFixed(2),
    latMax: (viewport.centerLat + viewport.spanLat / 2).toFixed(2),
  }
}

/* ---------- 权限 ---------- */

/** 本模块仅按目录级权限点 `location` 判定；`device:ledger` 决定设备详情跳转入口是否渲染 */
export function locationPerms(keys: string[]): LocationPerms {
  return {
    view: keys.includes('location'),
    openDeviceDetail: keys.includes('device:ledger'),
  }
}

/* ---------- 组织节点选项（筛选） ---------- */

/** 组织节点树选择数据（含企业根节点与全部组织节点；用能单元不作为筛选范围） */
export function orgTreeData() {
  const childrenOf = (parentId: string | null) =>
    orgNodes
      .filter((node) => node.parentId === parentId && node.kind !== 'unit')
      .sort((a, b) => a.order - b.order)

  const build = (parentId: string | null): Array<Record<string, unknown>> =>
    childrenOf(parentId).map((node) => {
      const children = build(node.id)
      return {
        value: node.id,
        title: node.name,
        // 选中后回显完整层级路径（见 `tree-node-label-prop`），下拉内仍只显示节点名
        path: getPathText(node.id),
        children: children.length ? children : undefined,
      }
    })
  return build(null)
}

/** 用能单元树选择数据（仅用能单元可选，用于设备维度的「所属用能单元」筛选） */
export function unitTreeData() {
  const childrenOf = (parentId: string | null) =>
    orgNodes.filter((node) => node.parentId === parentId).sort((a, b) => a.order - b.order)

  const build = (parentId: string | null): Array<Record<string, unknown>> =>
    childrenOf(parentId).map((node) => {
      const children = build(node.id)
      return {
        value: node.id,
        title: node.name,
        path: getPathText(node.id),
        selectable: node.kind === 'unit',
        children: children.length ? children : undefined,
      }
    })
  return build(null)
}

/** 选取框回显的完整层级路径（已失效节点回退为占位符） */
export function pathOf(id: string | null): string {
  if (!id) return ''
  return getNode(id) ? getPathText(id) : ''
}
