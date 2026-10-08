<!--
  【原型说明】设备 GPS 选点组件，交互与「系统管理 › 组织架构」的 GpsPicker 保持一致。
  表单内只保留「坐标 + 来源标签 + 地图选点」入口，地图交互收进弹窗：
  支持按地点名称查询定位、单击预览、双击确定，也可直接微调经纬度；
  点「确定」后回填设备坐标并标记为「已自定义」，可一键恢复为所属用能单元坐标。
  不引入任何第三方地图依赖，坐标按弹窗地图可视范围线性换算。
-->
<template>
  <div class="devgps">
    <!-- 表单内入口：只读坐标框（含来源标签）+ 地图选点入口，地图交互收进弹窗 -->
    <div class="devgps__field">
      <div class="devgps__readout">
        <span class="devgps__value" :class="{ 'devgps__value--empty': !picked }">
          {{ picked ? coordinateText : '未设置' }}
        </span>
        <span v-if="picked && custom" class="devgps__tag">已自定义</span>
        <span v-else-if="picked" class="devgps__tag is-follow">跟随用能单元</span>
      </div>
      <a-button size="small" class="devgps__open" @click="openModal">
        <template #icon><EnvironmentOutlined /></template>
        地图选点
      </a-button>
      <a-button v-if="custom && canFollow" type="link" size="small" @click="resetToUnit">
        恢复默认
      </a-button>
    </div>

    <!-- 地图弹窗：查询定位或双击确定位置，点「确定」后回填经纬度 -->
    <a-modal
      v-model:open="open"
      title="地图选点"
      :width="720"
      ok-text="确定"
      cancel-text="取消"
      @ok="handleConfirm"
    >
      <div class="devgps__locate">
        <a-input-search
          v-model:value="keyword"
          placeholder="输入地点名称查询定位，例如「华南园区」"
          enter-button="查询定位"
          allow-clear
          @search="handleSearch"
        />
        <ul v-if="keyword.trim() && !located" class="devgps__results">
          <li v-if="!hits.length" class="devgps__results-empty">
            未找到该地点，请在地图上双击直接确定位置
          </li>
          <li v-for="poi in hits" :key="poi.name">
            <button type="button" class="devgps__result" @click="locateTo(poi)">
              <span class="devgps__result-name">{{ poi.name }}</span>
              <span class="devgps__result-coord">{{ poi.lng }}, {{ poi.lat }}</span>
            </button>
          </li>
        </ul>
        <p v-else-if="located" class="devgps__located">
          已定位到「{{ located }}」，可直接点「确定」使用该坐标，或在地图上双击微调
        </p>
      </div>

      <div class="devgps__hint-bar">
        <span class="devgps__hint-strong">单击</span>预览位置，
        <span class="devgps__hint-strong">双击</span>确定位置
        <a-button v-if="canFollow" type="link" size="small" @click="resetToUnit">
          取用能单元坐标（{{ unitText }}）
        </a-button>
      </div>

      <!-- 模拟地图：单击落预览准星，双击落下确定点；视野随查询结果平移 -->
      <div
        ref="mapRef"
        class="devgps__map"
        role="button"
        tabindex="0"
        :aria-label="'模拟地图，当前设备位置 ' + draftText"
        @click="handlePreview"
        @dblclick="handlePick"
        @keydown.enter.prevent="handlePickAtCenter"
      >
        <div class="devgps__grid" aria-hidden="true" />
        <div class="devgps__roads" aria-hidden="true" />

        <!-- 所属用能单元参考点：空心主色圆点，说明「默认值来自哪里」 -->
        <span v-if="unitStyle" class="devgps__unit" :style="unitStyle" aria-hidden="true" />

        <!-- 预览准星：单击产生，双击后转为确定点 -->
        <span v-if="previewStyle" class="devgps__crosshair" :style="previewStyle" aria-hidden="true">
          <span class="devgps__crosshair-h" />
          <span class="devgps__crosshair-v" />
        </span>

        <!-- 已确定点：双击或查询定位产生 -->
        <template v-if="markerStyle">
          <span class="devgps__pin" :style="markerStyle" aria-hidden="true" />
          <span class="devgps__pin-label" :style="markerStyle">{{ draftText }}</span>
        </template>

        <span class="devgps__corner devgps__corner--tl">
          经 {{ view.lngMin.toFixed(2) }}° 纬 {{ view.latMax.toFixed(2) }}°
        </span>
        <span class="devgps__corner devgps__corner--br">
          经 {{ view.lngMax.toFixed(2) }}° 纬 {{ view.latMin.toFixed(2) }}°
        </span>
      </div>

      <div class="devgps__coord">
        <label class="devgps__coord-item">
          <span class="devgps__coord-label">经度</span>
          <a-input-number
            :value="draftLng"
            class="devgps__input"
            :precision="6"
            :min="-180"
            :max="180"
            :controls="false"
            placeholder="如 113.883100"
            @update:value="updateDraftLng"
          />
        </label>
        <label class="devgps__coord-item">
          <span class="devgps__coord-label">纬度</span>
          <a-input-number
            :value="draftLat"
            class="devgps__input"
            :precision="6"
            :min="-90"
            :max="90"
            :controls="false"
            placeholder="如 22.564600"
            @update:value="updateDraftLat"
          />
        </label>
      </div>
      <p class="devgps__note">
        【原型说明】此处为模拟地图，仅用于验证「地图选点 → 回填设备坐标」的交互；正式实现将接入真实地图服务。
      </p>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { message } from 'antdv-next'
import { EnvironmentOutlined } from '@antdv-next/icons'

const props = defineProps<{
  /** 设备当前 GPS 经度 */
  lng: number | null
  /** 设备当前 GPS 纬度 */
  lat: number | null
  /** 是否为地图选点自定义（false 表示跟随所属用能单元） */
  custom: boolean
  /** 所属用能单元经度，作为默认值与「恢复默认」的目标 */
  unitLng: number | null
  /** 所属用能单元纬度 */
  unitLat: number | null
}>()

const emit = defineEmits<{
  /** 选点结果：自定义坐标 */
  pick: [{ lng: number; lat: number }]
  /** 恢复为所属用能单元坐标 */
  follow: [void]
}>()

/** 【原型说明】地图视野跨度：设备级精度（约 1km 见方），便于看清同一园区的多台设备 */
const SPAN_LNG = 0.012
const SPAN_LAT = 0.009
/** 【原型说明】默认视野中心（演示数据所在区域：深圳宝安） */
const DEFAULT_CENTER = { lng: 113.8835, lat: 22.5645 }

/** 【原型说明】可查询的地点，正式实现由地图服务的 POI 检索提供 */
const PLACES = [
  { name: '华南园区（深圳宝安）', lng: 113.8831, lat: 22.5646 },
  { name: '华东园区（杭州余杭）', lng: 120.0432, lat: 30.2815 },
  { name: 'A 栋厂房', lng: 113.8847, lat: 22.5654 },
  { name: 'B 栋厂房', lng: 113.8814, lat: 22.5639 },
  { name: '园区配电房', lng: 113.8836, lat: 22.5648 },
]

const open = ref(false)
const keyword = ref('')
const located = ref('')
const mapRef = ref<HTMLElement | null>(null)

/** 弹窗内的临时选点，点「确定」后才写回表单 */
const draftLng = ref<number | null>(null)
const draftLat = ref<number | null>(null)
/** 视野中心：随查询定位平移，初始取所属用能单元或设备当前坐标 */
const center = ref({ ...DEFAULT_CENTER })
/** 单击产生的预览点，双击 / 查询定位后清除 */
const preview = ref<{ lng: number; lat: number } | null>(null)

const picked = computed(() => props.lng !== null && props.lat !== null)
const coordinateText = computed(() => (picked.value ? `${props.lng}, ${props.lat}` : ''))

/** 所属用能单元坐标是否可用（决定「恢复默认」等入口是否出现） */
const canFollow = computed(() => props.unitLng !== null && props.unitLat !== null)
const unitText = computed(() =>
  canFollow.value ? `${props.unitLng}, ${props.unitLat}` : '',
)

const draftText = computed(() =>
  draftLng.value !== null && draftLat.value !== null ? `${draftLng.value}, ${draftLat.value}` : '',
)

const view = computed(() => ({
  lngMin: center.value.lng - SPAN_LNG / 2,
  lngMax: center.value.lng + SPAN_LNG / 2,
  latMin: center.value.lat - SPAN_LAT / 2,
  latMax: center.value.lat + SPAN_LAT / 2,
}))

/** 坐标 → 地图内的百分比位置；超出当前视野时不渲染 */
function toStyle(point: { lng: number; lat: number } | null) {
  if (!point) return null
  const left = ((point.lng - view.value.lngMin) / (view.value.lngMax - view.value.lngMin)) * 100
  const top = ((view.value.latMax - point.lat) / (view.value.latMax - view.value.latMin)) * 100
  if (left < 0 || left > 100 || top < 0 || top > 100) return null
  return { left: `${left}%`, top: `${top}%` }
}

const markerStyle = computed(() =>
  toStyle(draftLng.value !== null && draftLat.value !== null ? { lng: draftLng.value, lat: draftLat.value } : null),
)
const previewStyle = computed(() => toStyle(preview.value))
const unitStyle = computed(() =>
  canFollow.value ? toStyle({ lng: props.unitLng as number, lat: props.unitLat as number }) : null,
)

const hits = computed(() => {
  const value = keyword.value.trim().toLowerCase()
  if (!value) return []
  return PLACES.filter((poi) => poi.name.toLowerCase().includes(value))
})

function openModal() {
  draftLng.value = props.lng
  draftLat.value = props.lat
  preview.value = null
  keyword.value = ''
  located.value = ''
  center.value = canFollow.value
    ? { lng: props.unitLng as number, lat: props.unitLat as number }
    : picked.value
      ? { lng: props.lng as number, lat: props.lat as number }
      : { ...DEFAULT_CENTER }
  open.value = true
}

/** 视图坐标 → 经纬度；单击预览 */
function handlePreview(event: MouseEvent) {
  const point = pointFromEvent(event)
  if (!point) return
  preview.value = point
}

/** 双击确定位置：预览点转为确定点 */
function handlePick(event: MouseEvent) {
  const point = pointFromEvent(event)
  if (!point) return
  preview.value = null
  located.value = ''
  applyPoint(point)
}

/** 键盘操作：Enter 在视野中心确定位置，保证无鼠标也可完成选点 */
function handlePickAtCenter() {
  preview.value = null
  applyPoint({ lng: center.value.lng, lat: center.value.lat })
}

function pointFromEvent(event: MouseEvent) {
  const rect = mapRef.value?.getBoundingClientRect()
  if (!rect || !rect.width || !rect.height) return null
  const xRatio = clamp01((event.clientX - rect.left) / rect.width)
  const yRatio = clamp01((event.clientY - rect.top) / rect.height)
  return {
    lng: round6(view.value.lngMin + xRatio * (view.value.lngMax - view.value.lngMin)),
    lat: round6(view.value.latMax - yRatio * (view.value.latMax - view.value.latMin)),
  }
}

function applyPoint(point: { lng: number; lat: number }) {
  draftLng.value = point.lng
  draftLat.value = point.lat
}

function handleSearch() {
  const value = keyword.value.trim()
  if (!value) return
  const hit = PLACES.find((poi) => poi.name.toLowerCase().includes(value.toLowerCase()))
  if (hit) locateTo(hit)
}

/** 查询定位：视野平移到该地点并把该点设为确定位置 */
function locateTo(poi: { name: string; lng: number; lat: number }) {
  center.value = { lng: poi.lng, lat: poi.lat }
  keyword.value = poi.name
  located.value = poi.name
  preview.value = null
  applyPoint({ lng: poi.lng, lat: poi.lat })
}

function updateDraftLng(value: number | string | null) {
  draftLng.value = toNumber(value)
}

function updateDraftLat(value: number | string | null) {
  draftLat.value = toNumber(value)
}

function handleConfirm() {
  // 未选点且未跟随用能单元时无法确定：给出提示而非静默无响应
  if (draftLng.value === null || draftLat.value === null) {
    if (canFollow.value) {
      resetToUnit()
      return
    }
    message.warning('请在地图上双击选择位置，或直接填写经纬度')
    return
  }
  emit('pick', { lng: draftLng.value, lat: draftLat.value })
  open.value = false
}

/** 恢复为所属用能单元坐标 */
function resetToUnit() {
  emit('follow')
  open.value = false
}

function toNumber(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null
  const num = Number(value)
  return Number.isFinite(num) ? num : null
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, value))
const round6 = (value: number) => Number(value.toFixed(6))
</script>
