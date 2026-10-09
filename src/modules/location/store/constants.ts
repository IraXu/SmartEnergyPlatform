/**
 * 【原型说明】点位地图模块的规则常量，仅用于原型演示。
 * 取值对齐《产品需求文档-点位地图》v1.0 的业务规则。
 */

import type { DeviceOnlineState } from './types'

/** 设备维度单次渲染上限（PRD 4.5 F-LOC-05 / 7 章性能） */
export const MARKER_LIMIT = 500

/** 检索关键字长度上限 */
export const SEARCH_MAX = 30

/** 位置检索结果下拉最多展示条数（PRD F-LOC-06） */
export const SEARCH_HIT_MAX = 10

/** 抽屉内设备明细分页可选值 */
export const UNIT_PAGE_SIZES = ['10', '20', '50', '100'] as const
export const UNIT_PAGE_SIZE = 20

/**
 * 【原型说明】地图视野跨度的默认值与上下限。
 * 默认跨度按企业全部有坐标对象的分布范围自适应，最小不低于 DEFAULT_SPAN_*；
 * 缩放跨度被钳制在 MIN_SPAN_* 与 MAX_SPAN_* 之间，越界即视为达到缩放上下限。
 */
export const DEFAULT_SPAN_LNG = 0.012
export const DEFAULT_SPAN_LAT = 0.009
export const MIN_SPAN_LNG = 0.0016
export const MIN_SPAN_LAT = 0.0012
export const MAX_SPAN_LNG = 40
export const MAX_SPAN_LAT = 30

/** 每次缩放对跨度的乘数（放大 0.8 / 缩小 1.25） */
export const ZOOM_IN_RATIO = 0.8
export const ZOOM_OUT_RATIO = 1.25

/** 方向键平移：每次平移跨度比例 */
export const PAN_RATIO = 0.12

/** 【原型说明】模拟地图加载耗时，用于验证加载态 */
export const LOAD_DELAY = 420

/**
 * 【原型说明】轻量刷新耗时（维度切换 / 查询 / 重置）。
 * 明显短于 LOAD_DELAY——该场景下地图与标记保持可见，仅以顶部细进度条表达「刷新中」，
 * 时长过长会让进度条显得像卡顿（交互文档 STATE-LOC-02）。
 */
export const REFRESH_DELAY = 260

/** 在线状态筛选选项（在线 / 离线两态） */
export const ONLINE_STATE_OPTIONS: DeviceOnlineState[] = ['在线', '离线']

/** 在线状态展示文案 */
export const ONLINE_STATE_TEXT: Record<DeviceOnlineState, string> = {
  在线: '在线',
  离线: '离线',
}

/** 在线状态在地图标记上的悬停说明文案 */
export const MARKER_STATE_TEXT: Record<DeviceOnlineState, string> = {
  在线: '在线',
  离线: '离线',
}
