<template>
  <!-- 无页面权限：整页空态，不渲染页面头、条件区与地图（STATE-LOC-12 / EX-LOC-01） -->
  <div v-if="!perms.view" class="page-container loc-page">
    <div class="loc-denied">
      <a-empty description="当前账号无权限访问点位地图" />
      <a-button type="primary" @click="router.push('/dashboard')">返回</a-button>
    </div>
  </div>

  <div v-else class="loc-page">
    <!-- 地图占满整个内容区，全部控件悬浮在地图之上 -->
    <section class="loc-map" aria-label="地图">
      <!-- 地图画布：底图 + 网格 + 道路 + 标记层；支持鼠标拖拽平移 -->
      <div
        ref="canvasRef"
        class="loc-canvas"
        :class="{ 'loc-canvas--dragging': dragging }"
        role="application"
        tabindex="0"
        aria-label="模拟地图，可拖拽或使用方向键平移，滚轮或加减号缩放"
        @mousedown="handleDragStart"
        @click="handleCanvasClick"
        @keydown="handleCanvasKeydown"
        @wheel.prevent="handleWheel"
      >
        <div class="loc-canvas__grid" aria-hidden="true" />
        <div class="loc-canvas__roads" aria-hidden="true" />

        <!-- 标记层：切换维度时新维度标记整体淡入，刷新期间不清空已有标记 -->
        <Transition name="loc-marker-fade">
          <!-- 用能单元维度：聚合标记 + 设备数徽标 -->
          <div v-if="dimension === 'unit' && showMarkers" key="unit" class="loc-marker-layer">
            <a-tooltip
              v-for="marker in visibleUnitMarkers"
              :key="marker.id"
              :title="`${marker.name} · ${marker.deviceCount} 台设备`"
              placement="top"
            >
              <button
                type="button"
                class="loc-marker loc-marker--unit"
                :class="{
                  'loc-marker--active': selectedId === marker.id,
                  'loc-marker--empty': marker.deviceCount === 0,
                }"
                :style="marker.style"
                :aria-label="`${marker.name}，${marker.deviceCount} 台设备`"
                @mousedown.stop
                @click.stop="selectUnitMarker(marker.id)"
              >
                <ThunderboltOutlined class="loc-marker__icon" />
                <span class="loc-marker__badge">{{ marker.deviceCount }}</span>
              </button>
            </a-tooltip>
          </div>

          <!-- 设备维度：逐台独立标记，按在线状态区分形态 -->
          <div v-else-if="dimension === 'device' && showMarkers" key="device" class="loc-marker-layer">
            <a-tooltip
              v-for="marker in visibleDeviceMarkers"
              :key="marker.id"
              :title="`${marker.name} · ${MARKER_STATE_TEXT[marker.onlineState]}`"
              placement="top"
            >
              <button
                type="button"
                class="loc-marker loc-marker--device"
                :class="[`loc-marker--${stateClass(marker.onlineState)}`, { 'loc-marker--active': selectedId === marker.id }]"
                :style="marker.style"
                :aria-label="`${marker.name}，${MARKER_STATE_TEXT[marker.onlineState]}`"
                @mousedown.stop
                @click.stop="selectDeviceMarker(marker.id)"
              />
            </a-tooltip>
          </div>
        </Transition>
      </div>

      <!-- 轻量刷新进度条：维度切换 / 查询 / 重置时贴地图顶边滑过，不遮挡内容、不阻断操作 -->
      <div v-if="refreshing" class="loc-progress" role="status" aria-live="polite">
        <span class="loc-progress__bar" />
        <span class="loc-sr-only">正在刷新地图数据</span>
      </div>

      <!-- OVERLAY-02 设备信息卡（悬浮在地图上，锚定标记） -->
      <DeviceInfoCard
        v-if="dimension === 'device' && selectedDeviceId && selectedDeviceStyle"
        :device-id="selectedDeviceId"
        :open-device-detail="perms.openDeviceDetail"
        :anchor="selectedDeviceStyle"
        @close="clearSelection"
        @view-detail="gotoDeviceDetail"
      />

      <!-- ---- 悬浮控件层（均绝对定位在地图之上，不挤占地图空间） ---- -->

      <!-- 左上：维度切换 + 检索与筛选 -->
      <div class="loc-float loc-float--top-left">
        <div class="loc-dimension" role="tablist" aria-label="查看维度">
          <!-- 滑动指示块：整体式分段控件的选中底色，切换时左右滑动 -->
          <span
            class="loc-dimension__thumb"
            aria-hidden="true"
            :style="{ transform: `translateX(${dimensionIndex * 100}%)` }"
          />
          <button
            v-for="option in dimensionOptions"
            :key="option.value"
            type="button"
            role="tab"
            class="loc-dimension__item"
            :class="{ 'loc-dimension__item--active': dimension === option.value }"
            :aria-selected="dimension === option.value"
            @click="switchDimension(option.value)"
          >
            {{ option.label }}
          </button>
        </div>

        <div class="loc-panel loc-panel--filter">
          <label class="loc-field">
            <span class="loc-field__label">检索</span>
            <a-input-search
              v-model:value="keyword"
              class="loc-field__control"
              :placeholder="searchPlaceholder"
              allow-clear
              :maxlength="SEARCH_MAX"
              @search="handleSearchSubmit"
              @change="handleKeywordChange"
            />
            <!-- 检索结果下拉 -->
            <ul v-if="showHits" class="loc-hits">
              <li v-if="!hits.length" class="loc-hits__empty">未找到匹配的位置</li>
              <li v-for="hit in hits" :key="hit.id">
                <button type="button" class="loc-hits__item" @click="applyHit(hit)">
                  <span class="loc-hits__name">{{ hit.name }}</span>
                  <span class="loc-hits__sub">{{ hit.subtitle }}</span>
                </button>
              </li>
            </ul>
          </label>

          <!-- 用能单元维度：仅所属组织节点 -->
          <label v-if="dimension === 'unit'" class="loc-field">
            <span class="loc-field__label">所属组织节点</span>
            <a-tree-select
              v-model:value="unitFilters.orgId"
              class="loc-field__control"
              :tree-data="orgTree"
              :field-names="{ label: 'title', value: 'value', children: 'children' }"
              tree-node-label-prop="path"
              placeholder="全部组织节点"
              allow-clear
              tree-default-expand-all
            />
          </label>

          <!-- 设备维度：设备类型 / 在线状态 / 所属用能单元 -->
          <template v-else>
            <label class="loc-field">
              <span class="loc-field__label">设备类型</span>
              <a-select
                v-model:value="deviceFilters.types"
                class="loc-field__control"
                mode="multiple"
                allow-clear
                max-tag-count="responsive"
                placeholder="全部设备类型"
                :options="typeGroups"
              />
            </label>
            <label class="loc-field">
              <span class="loc-field__label">在线状态</span>
              <a-select
                v-model:value="deviceFilters.onlineStatuses"
                class="loc-field__control"
                mode="multiple"
                allow-clear
                max-tag-count="responsive"
                placeholder="全部状态"
                :options="onlineOptions"
              />
            </label>
            <label class="loc-field">
              <span class="loc-field__label">所属用能单元</span>
              <a-tree-select
                v-model:value="deviceFilters.unitId"
                class="loc-field__control"
                :tree-data="unitTree"
                :field-names="{ label: 'title', value: 'value', children: 'children' }"
                tree-node-label-prop="path"
                placeholder="全部用能单元"
                allow-clear
                tree-default-expand-all
              />
            </label>
          </template>

          <div class="loc-filter__actions">
            <span class="loc-filter__count">
              当前呈现 {{ markerCount }} 个标记
              <span v-if="refreshing" class="loc-filter__refreshing">· 刷新中</span>
            </span>
            <a-button type="primary" size="small" :loading="refreshing" @click="applyFilters">
              <template #icon><SearchOutlined /></template>
              查询
            </a-button>
            <a-button size="small" @click="resetAll">
              <template #icon><ReloadOutlined /></template>
              重置
            </a-button>
          </div>
        </div>
      </div>

      <!-- 底部居中：状态提示（超限提示条 / 视野内无标记） -->
      <div v-if="!loading && !failed && !emptyState" class="loc-float loc-float--bottom-center">
        <a-alert
          v-if="dimension === 'device' && markerResult.limited"
          class="loc-panel__alert"
          type="warning"
          show-icon
          :message="limitText"
        />
        <p v-else-if="outOfView" class="loc-panel__hint">
          当前视野内无{{ dimensionName }}，可拖拽或点「重置视野」
        </p>
      </div>

      <!-- 左下：图例 + 坐标读数 -->
      <div class="loc-float loc-float--bottom-left">
        <div class="loc-legend" aria-label="图例">
          <template v-if="dimension === 'unit'">
            <span class="loc-legend__item">
              <span class="loc-legend__unit-icon"><ThunderboltOutlined /></span>
              用能单元
            </span>
            <span class="loc-legend__item">
              <span class="loc-legend__unit-icon loc-legend__unit-icon--empty"><ThunderboltOutlined /></span>
              设备数为 0
            </span>
            <span class="loc-legend__item">
              <span class="loc-legend__active" />
              已选中
            </span>
          </template>
          <template v-else>
            <span class="loc-legend__item"><span class="loc-legend__dot" />在线</span>
            <span class="loc-legend__item"><span class="loc-legend__ring" />离线</span>
            <span class="loc-legend__item"><span class="loc-legend__unknown" />未接入</span>
            <span class="loc-legend__item"><span class="loc-legend__active" />已选中</span>
          </template>
        </div>
        <p class="loc-readout">
          经 {{ readout.lngMin }}° ~ {{ readout.lngMax }}° ／ 纬 {{ readout.latMin }}° ~ {{ readout.latMax }}°
        </p>
      </div>

      <!-- 右下：重置视野 + 缩放控件 -->
      <div class="loc-float loc-float--bottom-right">
        <button
          type="button"
          class="loc-tool loc-tool--reset"
          :disabled="loading || failed"
          @click="resetViewport"
        >
          <AimOutlined />
          重置视野
        </button>
        <div class="loc-tools">
          <button type="button" class="loc-tool" :disabled="zoomInDisabled" title="放大" @click="zoom('in')">
            <PlusOutlined />
          </button>
          <button type="button" class="loc-tool" :disabled="zoomOutDisabled" title="缩小" @click="zoom('out')">
            <MinusOutlined />
          </button>
        </div>
      </div>

      <!-- 地图内状态（加载中 / 加载失败 / 空态）：覆盖画布居中展示 -->
      <div v-if="loading" class="loc-overlay">
        <a-spin />
        <p class="loc-overlay__text">正在加载地图数据…</p>
      </div>
      <div v-else-if="failed" class="loc-overlay">
        <p class="loc-overlay__text loc-overlay__text--error">地图数据加载失败</p>
        <a-button size="small" @click="reloadMap">
          <template #icon><ReloadOutlined /></template>
          重新加载
        </a-button>
      </div>
      <div v-else-if="emptyState" class="loc-overlay">
        <p class="loc-overlay__text">{{ emptyState.text }}</p>
        <a-button v-if="emptyState.action === 'org'" type="primary" size="small" @click="router.push('/system/org-structure')">
          前往组织架构
        </a-button>
        <a-button v-else-if="emptyState.action === 'device'" type="primary" size="small" @click="router.push('/device/ledger')">
          前往设备台账
        </a-button>
        <a-button v-else type="primary" size="small" @click="resetAll">重置筛选条件</a-button>
      </div>

      <!-- 右上：原型演示入口（可折叠，不干扰地图浏览） -->
      <div class="loc-float loc-float--top-right">
        <button type="button" class="loc-tool loc-tool--demo" @click="demoOpen = !demoOpen">
          <QuestionCircleOutlined />
          原型说明
        </button>
        <div v-if="demoOpen" class="loc-panel loc-panel--demo">
          <div class="loc-panel__demo-head">
            <span>原型演示提示</span>
            <a-button type="link" size="small" @click="handleResetDemo">重置演示状态</a-button>
          </div>
          <ul class="loc-panel__demo-list">
            <li v-for="(line, index) in tipLines" :key="index">{{ line }}</li>
          </ul>
          <div class="loc-panel__demo-actions">
            <a-button size="small" @click="simulateLoadFail">模拟加载失败</a-button>
            <a-button size="small" @click="simulateNoCoordinate">模拟全部无坐标</a-button>
            <a-button size="small" @click="simulateDrawerFail">模拟明细加载失败</a-button>
          </div>
        </div>
      </div>
    </section>

    <!-- OVERLAY-01 设备明细抽屉（从右侧滑出，悬浮在地图之上） -->
    <UnitDetailDrawer
      v-model:open="drawerOpen"
      :unit-id="selectedUnitId"
      :open-device-detail="perms.openDeviceDetail"
      :fail="drawerFail"
      @view-detail="gotoDeviceDetail"
      @reload="reloadDrawer"
    />
  </div>
</template>

<script setup lang="ts">
/**
 * PAGE-01 点位地图
 * 【原型说明】以地图为唯一载体，按「用能单元 / 设备」两个维度呈现企业内空间分布。
 * 本模块为**只读空间视图**：不提供任何坐标新增 / 编辑 / 删除 / 微调入口；
 * 用能单元坐标来自组织架构、设备坐标来自设备台账，两者均为已有数据。
 *
 * 交互要点：
 * - 维度切换为上下文整体重置（条件、检索、视野、浮层全部回到新维度默认状态）
 * - 用能单元维度点击标记打开 OVERLAY-01 抽屉；设备维度点击标记打开 OVERLAY-02 信息卡（互斥）
 * - 设备维度单次渲染上限 500 个标记，超出按「当前视野内 + 最近上报优先」截取并给出常驻提示条
 * - 地图为模拟地图：坐标按可视范围线性换算，不引入第三方地图依赖
 */
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import {
  AimOutlined,
  MinusOutlined,
  PlusOutlined,
  QuestionCircleOutlined,
  ReloadOutlined,
  SearchOutlined,
  ThunderboltOutlined,
} from '@antdv-next/icons'
import { currentPermissions } from '@/modules/role/store'
import { deviceTypeGroups } from '@/modules/device/store'
import DeviceInfoCard from '../components/DeviceInfoCard.vue'
import UnitDetailDrawer from '../components/UnitDetailDrawer.vue'
import {
  LOAD_DELAY,
  MARKER_LIMIT,
  MARKER_STATE_TEXT,
  ONLINE_STATE_OPTIONS,
  REFRESH_DELAY,
  SEARCH_MAX,
  allDevices,
  allUnits,
  defaultViewport,
  deviceMarkers,
  focusViewport,
  isZoomMax,
  isZoomMin,
  locatedDevices,
  locatedUnits,
  locationPerms,
  orgTreeData,
  panViewport,
  searchDevices,
  searchUnits,
  toMapStyle,
  unitMarkers,
  unitTreeData,
  viewportReadout,
  zoomViewport,
} from '../store'
import type {
  DeviceFilters,
  DeviceMarker,
  MapViewport,
  SearchHit,
  UnitFilters,
  UnitMarker,
} from '../store'

/* ---------- 权限：按当前账号的功能权限点渲染 ---------- */
const perms = computed(() => locationPerms(currentPermissions()))

const router = useRouter()

/* ---------- 演示开关：用于验证各类状态与异常 ---------- */
/** 【原型说明】模拟地图数据加载失败 */
const failed = ref(false)
/** 【原型说明】模拟坐标全缺失的空态（与真实数据无关） */
const noCoordinate = ref(false)
/** 【原型说明】模拟抽屉明细加载失败 */
const drawerFail = ref(false)

/* ---------- 维度 ---------- */
const dimension = ref<'unit' | 'device'>('unit')
/** 维度切换控件：纯文字分段按钮（无图标、无容器底色），突出当前维度 */
const dimensionOptions = [
  { label: '用能单元定位', value: 'unit' as const },
  { label: '设备定位', value: 'device' as const },
]
/** 当前维度在分段控件中的序号，用于滑动指示块定位 */
const dimensionIndex = computed(() => dimensionOptions.findIndex((option) => option.value === dimension.value))
const dimensionName = computed(() => (dimension.value === 'unit' ? '用能单元' : '设备'))

/* ---------- 条件 ---------- */
const keyword = ref('')
const unitFilters = reactive<UnitFilters>({ orgId: null })
const deviceFilters = reactive<DeviceFilters>({ types: [], onlineStatuses: [], unitId: null })

const orgTree = computed(() => orgTreeData())
const unitTree = computed(() => unitTreeData())
const typeGroups = computed(() => deviceTypeGroups())
const onlineOptions = ONLINE_STATE_OPTIONS.map((value) => ({ label: value, value }))

const searchPlaceholder = computed(() =>
  dimension.value === 'unit' ? '用能单元名称 / 编码' : '设备名称 / 编号 / License',
)

/* ---------- 地图视野 ---------- */
const viewport = ref<MapViewport>(defaultViewport())
const readout = computed(() => viewportReadout(viewport.value))

/* ---------- 标记数据 ---------- */

/** 用能单元维度：默认全部有坐标用能单元（点「查询」后才应用条件） */
const appliedUnitFilters = ref<UnitFilters>({ orgId: null })
const appliedDeviceFilters = ref<DeviceFilters>({ types: [], onlineStatuses: [], unitId: null })

const rawUnitMarkers = computed<UnitMarker[]>(() =>
  noCoordinate.value ? [] : unitMarkers(appliedUnitFilters.value),
)

const markerResult = computed(() => {
  if (noCoordinate.value) return { markers: [] as DeviceMarker[], limited: false, total: 0 }
  return deviceMarkers(appliedDeviceFilters.value, viewport.value)
})

/** 渲染到画布上的用能单元标记（含位置换算；超出视野的自动剔除） */
const visibleUnitMarkers = computed(() =>
  rawUnitMarkers.value
    .map((marker) => ({ ...marker, style: toMapStyle(marker.lng, marker.lat, viewport.value) }))
    .filter((marker): marker is UnitMarker & { style: { left: string; top: string } } => marker.style !== null),
)

const visibleDeviceMarkers = computed(() =>
  markerResult.value.markers
    .map((marker) => ({ ...marker, style: toMapStyle(marker.lng, marker.lat, viewport.value) }))
    .filter((marker): marker is DeviceMarker & { style: { left: string; top: string } } => marker.style !== null),
)

const markerCount = computed(() =>
  dimension.value === 'unit' ? visibleUnitMarkers.value.length : visibleDeviceMarkers.value.length,
)

const limitText = computed(
  () =>
    `当前视野内设备较多（共 ${markerResult.value.total} 台），已显示最近上报的 ${MARKER_LIMIT} 台，请放大地图或补充筛选条件`,
)

/* ---------- 选中态与浮层 ---------- */
const selectedId = ref('')
const selectedUnitId = ref('')
const selectedDeviceId = ref('')
const drawerOpen = ref(false)

const selectedDeviceStyle = computed(() => {
  const marker = visibleDeviceMarkers.value.find((item) => item.id === selectedDeviceId.value)
  return marker ? marker.style : null
})

/**
 * 全画布空态判定（STATE-LOC-03/04/05 无对象或无坐标、STATE-LOC-07 筛选无结果）。
 * 「视野内无标记」不在此列——按交互文档 4.5 STATE-LOC-09 应正常展示地图并给画布中央轻提示，
 * 因此这里只判断「是否有命中对象」，与视野无关。
 */
const emptyState = computed<{ text: string; action: 'org' | 'device' | 'reset' } | null>(() => {
  if (dimension.value === 'unit') {
    if (noCoordinate.value || !locatedUnits().length) {
      // 区分「无用能单元」与「有用能单元但均未设坐标」
      return noCoordinate.value || allUnits().length
        ? { text: '当前企业的用能单元尚未设置 GPS 坐标，无法在地图上呈现', action: 'org' }
        : { text: '尚未创建用能单元，请先在企业组织架构中完成结构维护', action: 'org' }
    }
    return rawUnitMarkers.value.length ? null : { text: '没有符合条件的用能单元', action: 'reset' }
  }

  if (noCoordinate.value || !locatedDevices().length) {
    return noCoordinate.value || allDevices().length
      ? { text: '当前企业的设备尚未设置 GPS 坐标，无法在地图上呈现', action: 'device' }
      : { text: '尚未建立设备档案，请先在设备台账中添加设备', action: 'device' }
  }
  return markerResult.value.total ? null : { text: '没有符合条件的设备', action: 'reset' }
})

/** 命中对象存在但均不在当前视野内（STATE-LOC-09 / EX-LOC-10）：地图正常展示 + 中央轻提示 */
const outOfView = computed(
  () => !emptyState.value && markerCount.value === 0 && !loading.value && !failed.value,
)

/**
 * 标记层是否渲染：仅「冷启动加载中 / 加载失败 / 空态」时不渲染。
 * 轻量刷新（维度切换、查询、重置）期间标记**保持可见**，靠交叉淡入淡出完成新旧交替，
 * 不再整层清空（交互文档 STATE-LOC-02 非阻断式刷新）。
 */
const showMarkers = computed(() => !loading.value && !failed.value && !emptyState.value)

/* ---------- 加载 ---------- */
/** 冷启动整屏加载：仅「首次进入」与错误态「重新加载」使用，覆盖画布居中展示 */
const loading = ref(true)
/** 轻量刷新：维度切换 / 查询 / 重置时使用，地图与标记全程保持可见，仅顶部细进度条提示 */
const refreshing = ref(false)
/** 轻量刷新计时器；连续触发时复位，避免多次刷新叠加导致进度条忽隐忽现 */
let refreshTimer: number | undefined

/**
 * 【原型说明】模拟地图数据加载。
 * `blocking` 为 true 时走整屏加载态（冷启动 / 错误重试），其余场景一律走**轻量刷新**：
 * 地图、标记与悬浮控件全程保持可见，只以顶部细进度条与面板内文案表达「刷新中」，
 * 避免切换定位类型时整屏白屏 + 标记全部消失造成的强打断（交互文档 STATE-LOC-02）。
 * `fitViewport` 为 true 时在加载完成后按数据分布自适应视野——只在「首次进入」「维度切换」
 * 「点重置」时使用；点「查询」与「重新加载」不重置视野，避免用户已框定的观察范围被丢弃
 * （交互文档 ACT-LOC-04 / ACT-LOC-09）。
 */
function loadMap({ fitViewport = false, blocking = false }: { fitViewport?: boolean; blocking?: boolean } = {}) {
  failed.value = false
  // 视野立即生效，避免刷新完成时标记「二次跳动」
  if (fitViewport) viewport.value = defaultViewport()
  if (blocking) {
    loading.value = true
    window.setTimeout(() => {
      loading.value = false
    }, LOAD_DELAY)
    return
  }
  refreshing.value = true
  window.clearTimeout(refreshTimer)
  refreshTimer = window.setTimeout(() => {
    refreshing.value = false
  }, REFRESH_DELAY)
}

onMounted(() => loadMap({ fitViewport: true, blocking: true }))

/** 【原型说明】模拟加载失败，用于验证错误态与重试 */
function simulateLoadFail() {
  loading.value = true
  failed.value = false
  window.setTimeout(() => {
    loading.value = false
    failed.value = true
  }, LOAD_DELAY)
}

/** 【原型说明】模拟全部对象无坐标，用于验证空态文案 */
function simulateNoCoordinate() {
  noCoordinate.value = true
  clearSelection()
}

/** 【原型说明】模拟抽屉明细加载失败 */
function simulateDrawerFail() {
  drawerFail.value = true
  if (!drawerOpen.value) {
    // 未打开抽屉时先打开一个有坐标的用能单元，便于观察局部错误态
    const first = visibleUnitMarkers.value[0]
    if (first) selectUnitMarker(first.id)
  }
}

function reloadMap() {
  // 错误态重试仍走整屏加载态，明确表达「重新拉取中」
  loadMap({ blocking: true })
}

function reloadDrawer() {
  drawerFail.value = false
}

/* ---------- 维度切换：上下文整体重置 ---------- */
/** 切换维度；重复点击当前维度不做任何处理，避免无谓重置 */
function switchDimension(next: 'unit' | 'device') {
  if (dimension.value === next) return
  dimension.value = next
  keyword.value = ''
  hits.value = []
  showHits.value = false
  unitFilters.orgId = null
  deviceFilters.types = []
  deviceFilters.onlineStatuses = []
  deviceFilters.unitId = null
  appliedUnitFilters.value = { orgId: null }
  appliedDeviceFilters.value = { types: [], onlineStatuses: [], unitId: null }
  clearSelection()
  // 轻量刷新：地图与标记保持可见，仅顶部进度条提示，避免整屏白屏打断
  loadMap({ fitViewport: true })
}

/* ---------- 检索 ---------- */
const hits = ref<SearchHit[]>([])
const showHits = ref(false)

function handleKeywordChange() {
  if (!keyword.value.trim()) {
    hits.value = []
    showHits.value = false
    return
  }
  hits.value = dimension.value === 'unit' ? searchUnits(keyword.value) : searchDevices(keyword.value)
  showHits.value = true
}

function handleSearchSubmit() {
  handleKeywordChange()
  if (hits.value.length) applyHit(hits.value[0])
}

function applyHit(hit: SearchHit) {
  showHits.value = false
  if (dimension.value === 'unit') {
    const marker = rawUnitMarkers.value.find((item) => item.id === hit.id)
    if (!marker) return
    viewport.value = focusViewport(viewport.value, marker.lng, marker.lat)
    selectUnitMarker(hit.id)
  } else {
    const marker = markerResult.value.markers.find((item) => item.id === hit.id)
    if (!marker) return
    viewport.value = focusViewport(viewport.value, marker.lng, marker.lat)
    selectDeviceMarker(hit.id)
  }
}

/* ---------- 查询 / 重置 ---------- */
function applyFilters() {
  appliedUnitFilters.value = { orgId: unitFilters.orgId }
  appliedDeviceFilters.value = {
    types: [...deviceFilters.types],
    onlineStatuses: [...deviceFilters.onlineStatuses],
    unitId: deviceFilters.unitId,
  }
  clearSelection()
  // 点「查询」保留当前视野，便于比较条件变化前后的分布差异（交互文档 ACT-LOC-04）
  loadMap()
}

function resetAll() {
  keyword.value = ''
  hits.value = []
  showHits.value = false
  unitFilters.orgId = null
  deviceFilters.types = []
  deviceFilters.onlineStatuses = []
  deviceFilters.unitId = null
  appliedUnitFilters.value = { orgId: null }
  appliedDeviceFilters.value = { types: [], onlineStatuses: [], unitId: null }
  clearSelection()
  // 点「重置」恢复默认视野，同样走轻量刷新（交互文档 ACT-LOC-05）
  loadMap({ fitViewport: true })
}

/* ---------- 标记选中与浮层（两浮层互斥） ---------- */
function clearSelection() {
  selectedId.value = ''
  selectedUnitId.value = ''
  selectedDeviceId.value = ''
  drawerOpen.value = false
  drawerFail.value = false
}

function selectUnitMarker(unitId: string) {
  selectedId.value = unitId
  selectedUnitId.value = unitId
  selectedDeviceId.value = ''
  drawerFail.value = false
  drawerOpen.value = true
}

function selectDeviceMarker(deviceId: string) {
  selectedId.value = deviceId
  selectedDeviceId.value = deviceId
  selectedUnitId.value = ''
  drawerOpen.value = false
}

function gotoDeviceDetail(deviceId: string) {
  router.push(`/device/ledger/${deviceId}`)
}

/* ---------- 地图视野操作 ---------- */
const zoomInDisabled = computed(() => isZoomMin(viewport.value))
const zoomOutDisabled = computed(() => isZoomMax(viewport.value))

function zoom(direction: 'in' | 'out') {
  viewport.value = zoomViewport(viewport.value, direction)
}

function resetViewport() {
  viewport.value = defaultViewport()
}

function handleWheel(event: WheelEvent) {
  if (loading.value || failed.value) return
  zoom(event.deltaY < 0 ? 'in' : 'out')
}

/* ---------- 鼠标拖拽平移（与真实地图一致的抓手手势） ---------- */
const canvasRef = ref<HTMLElement | null>(null)
const dragging = ref(false)
/** 拖拽起点在画布内的像素位置与当时的视野中心 */
let dragOrigin: { x: number; y: number; centerLng: number; centerLat: number } | null = null
/** 【原型说明】拖拽超过该像素阈值才视为平移，避免「点一下标记」被误判为拖拽 */
const DRAG_THRESHOLD = 3
let dragMoved = false

function handleDragStart(event: MouseEvent) {
  if (loading.value || failed.value || emptyState.value) return
  // 仅响应左键；标记自身的 mousedown 已通过 .stop 阻断，不会进入拖拽
  if (event.button !== 0) return
  const rect = canvasRef.value?.getBoundingClientRect()
  if (!rect || !rect.width || !rect.height) return
  dragOrigin = {
    x: event.clientX,
    y: event.clientY,
    centerLng: viewport.value.centerLng,
    centerLat: viewport.value.centerLat,
  }
  dragMoved = false
  dragging.value = true
  window.addEventListener('mousemove', handleDragMove)
  window.addEventListener('mouseup', handleDragEnd)
}

function handleDragMove(event: MouseEvent) {
  if (!dragOrigin) return
  const rect = canvasRef.value?.getBoundingClientRect()
  if (!rect || !rect.width || !rect.height) return
  const dx = event.clientX - dragOrigin.x
  const dy = event.clientY - dragOrigin.y
  if (!dragMoved && Math.abs(dx) < DRAG_THRESHOLD && Math.abs(dy) < DRAG_THRESHOLD) return
  dragMoved = true
  // 画布内像素位移换算为经纬度位移：向右拖拽 → 视野中心西移（内容随手指走）
  const lngPerPx = viewport.value.spanLng / rect.width
  const latPerPx = viewport.value.spanLat / rect.height
  viewport.value = {
    ...viewport.value,
    centerLng: dragOrigin.centerLng - dx * lngPerPx,
    centerLat: dragOrigin.centerLat + dy * latPerPx,
  }
}

function handleDragEnd() {
  dragging.value = false
  // 发生过平移时抑制随后的 click，避免误清空选中
  if (dragMoved) suppressClick = true
  dragOrigin = null
  window.removeEventListener('mousemove', handleDragMove)
  window.removeEventListener('mouseup', handleDragEnd)
}

/** 拖拽结束后抑制一次 click（拖动不应被当作「点击空白处关闭浮层」） */
let suppressClick = false

function handleCanvasClick() {
  if (suppressClick) {
    suppressClick = false
    return
  }
  clearSelection()
}

onBeforeUnmount(() => {
  window.removeEventListener('mousemove', handleDragMove)
  window.removeEventListener('mouseup', handleDragEnd)
  window.clearTimeout(refreshTimer)
})

/** 键盘：方向键平移、+/- 缩放、Esc 关闭浮层 */
function handleCanvasKeydown(event: KeyboardEvent) {
  if (loading.value || failed.value) return
  const key = event.key
  if (key === 'Escape') {
    clearSelection()
    return
  }
  if (key === '+' || key === '=') {
    event.preventDefault()
    zoom('in')
    return
  }
  if (key === '-' || key === '_') {
    event.preventDefault()
    zoom('out')
    return
  }
  const panMap: Record<string, 'up' | 'down' | 'left' | 'right'> = {
    ArrowUp: 'up',
    ArrowDown: 'down',
    ArrowLeft: 'left',
    ArrowRight: 'right',
  }
  const direction = panMap[key]
  if (!direction) return
  event.preventDefault()
  viewport.value = panViewport(viewport.value, direction)
}

/* ---------- 标记形态 ---------- */
function stateClass(state: DeviceMarker['onlineState']) {
  return state === '在线' ? 'online' : state === '离线' ? 'offline' : 'unknown'
}

/* ---------- 演示入口（悬浮在地图右上角，可折叠） ---------- */
const demoOpen = ref(false)

/** 【原型说明】复位本页全部演示开关并刷新地图 */
function handleResetDemo() {
  noCoordinate.value = false
  drawerFail.value = false
  failed.value = false
  resetAll()
}

const tipLines = [
  '本模块为**只读空间视图**：用能单元坐标来自「组织架构」，设备坐标来自「设备台账」，本页不提供任何坐标维护入口。',
  '用能单元维度为聚合标记（徽标为设备数），点击后在右侧抽屉查看该单元的档案摘要与设备明细；设备维度为逐台独立标记，点击弹出信息卡，卡内可进入设备详情。',
  `设备维度单次渲染上限 ${MARKER_LIMIT} 个标记，超出时按「当前视野内 + 最近上报优先」截取，并在底部给出常驻提示条。`,
  '地图为**模拟地图**：坐标按可视范围线性换算，不接入第三方地图服务；支持鼠标拖拽平移、滚轮缩放、方向键平移与加减号缩放。',
  '无坐标对象不渲染、不列出、不提示（坐标在组织架构与设备台账均为必填，缺失属异常数据）。',
]
</script>
