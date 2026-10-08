<template>
  <div class="gps-picker">
    <!-- 触发入口：展示已选坐标 + 「地图选点」按钮，地图交互收进弹窗，避免表单里塞一张大地图 -->
    <div class="gps-picker__field">
      <span class="gps-picker__value" :class="{ 'gps-picker__value--empty': !picked }">
        {{ picked ? coordinateText : '未选点' }}
      </span>
      <a-button size="small" @click="openModal">
        <template #icon>
          <EnvironmentOutlined />
        </template>
        地图选点
      </a-button>
      <a-button v-if="picked" type="link" size="small" @click="clear">清除</a-button>
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
      <div class="gps-picker__locate">
        <a-input-search
          v-model:value="keyword"
          placeholder="输入地点名称查询定位，例如「华南园区」"
          enter-button="查询定位"
          allow-clear
          @search="handleSearch"
        />
        <ul v-if="keyword.trim() && !located" class="gps-picker__results">
          <li v-if="!hits.length" class="gps-picker__results-empty">
            未找到该地点，请在地图上双击直接确定位置
          </li>
          <li v-for="poi in hits" :key="poi.name">
            <button type="button" class="gps-picker__result" @click="locateTo(poi)">
              <span class="gps-picker__result-name">{{ poi.name }}</span>
              <span class="gps-picker__result-coord">{{ poi.lng }}, {{ poi.lat }}</span>
            </button>
          </li>
        </ul>
        <p v-else-if="located" class="gps-picker__located">
          已定位到「{{ located }}」，可直接点「确定」使用该坐标，或在地图上双击微调
        </p>
      </div>

      <p class="gps-picker__hint-bar">
        <span class="gps-picker__hint-strong">单击</span>预览位置，
        <span class="gps-picker__hint-strong">双击</span>确定位置
      </p>

      <!-- 模拟地图：单击落预览准星，双击落下确定点；视野随查询结果平移 -->
      <div
        ref="mapRef"
        class="gps-picker__map"
        role="button"
        tabindex="0"
        :aria-label="'模拟地图，已确定位置 ' + coordinateText"
        @click="handlePreview"
        @dblclick="handlePick"
        @keydown.enter.prevent="handlePickAtCenter"
      >
        <div class="gps-picker__grid" aria-hidden="true" />
        <div class="gps-picker__roads" aria-hidden="true" />

        <!-- 预览准星：单击产生，双击后转为确定点 -->
        <span v-if="previewStyle" class="gps-picker__crosshair" :style="previewStyle" aria-hidden="true">
          <span class="gps-picker__crosshair-h" />
          <span class="gps-picker__crosshair-v" />
        </span>

        <!-- 已确定点：双击或查询定位产生 -->
        <template v-if="markerStyle">
          <span class="gps-picker__pin" :style="markerStyle" aria-hidden="true" />
          <span class="gps-picker__pin-label" :style="markerStyle">{{ draftText }}</span>
        </template>

        <span class="gps-picker__corner gps-picker__corner--tl">经 {{ view.lngMin.toFixed(2) }}° 纬 {{ view.latMax.toFixed(2) }}°</span>
        <span class="gps-picker__corner gps-picker__corner--br">经 {{ view.lngMax.toFixed(2) }}° 纬 {{ view.latMin.toFixed(2) }}°</span>
      </div>

      <div class="gps-picker__coord">
        <label class="gps-picker__coord-item">
          <span class="gps-picker__coord-label">经度</span>
          <a-input-number
            :value="draftLng"
            class="gps-picker__input"
            :precision="6"
            :min="-180"
            :max="180"
            :controls="false"
            placeholder="如 113.883100"
            @update:value="updateDraftLng"
          />
        </label>
        <label class="gps-picker__coord-item">
          <span class="gps-picker__coord-label">纬度</span>
          <a-input-number
            :value="draftLat"
            class="gps-picker__input"
            :precision="6"
            :min="-90"
            :max="90"
            :controls="false"
            placeholder="如 22.564600"
            @update:value="updateDraftLat"
          />
        </label>
      </div>
      <p class="gps-picker__note">
        【原型说明】此处为模拟地图，仅用于验证「地图选点 → 回填经纬度」的交互；正式实现将接入真实地图服务。
      </p>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
/**
 * 【原型说明】GPS 选点组件，用于「新增下级节点」与「编辑节点属性」。
 * 表单内只保留「地图选点」按钮入口与坐标展示，地图交互收进弹窗：
 * 支持按地点名称查询定位、单击预览、双击确定位置，点「确定」后把经纬度回填给表单；
 * 经纬度也可在弹窗内手动微调。不引入任何第三方地图依赖，坐标按弹窗地图可视范围线性换算。
 */
import { computed, ref } from 'vue'
import { EnvironmentOutlined } from '@antdv-next/icons'
import { validateLat, validateLng } from '../store'

const props = defineProps<{
  lng: number | null
  lat: number | null
}>()

const emit = defineEmits<{
  'update:lng': [value: number | null]
  'update:lat': [value: number | null]
  'update:error': [message: string | null]
}>()

/** 【原型说明】地图视野跨度：按城市级缩放设定，视野中心随查询定位平移 */
const SPAN_LNG = 0.08
const SPAN_LAT = 0.06
/** 【原型说明】默认视野中心（演示数据所在区域：深圳宝安） */
const DEFAULT_CENTER = { lng: 113.8835, lat: 22.5645 }

/** 【原型说明】可查询的地点，正式实现由地图服务的 POI 检索提供 */
const PLACES = [
  { name: '华南园区（深圳宝安）', lng: 113.8831, lat: 22.5646 },
  { name: '华东园区（杭州余杭）', lng: 120.0432, lat: 30.2815 },
  { name: '深圳北站', lng: 114.029, lat: 22.61 },
  { name: '杭州东站', lng: 120.213, lat: 30.29 },
  { name: '深圳市民中心', lng: 114.0625, lat: 22.547 },
]

const open = ref(false)
const keyword = ref('')
const located = ref('')
const mapRef = ref<HTMLElement | null>(null)

/** 弹窗内的临时选点，点「确定」后才写回表单 */
const draftLng = ref<number | null>(null)
const draftLat = ref<number | null>(null)
/** 视野中心：随查询定位平移，初始取当前已选点 */
const center = ref({ ...DEFAULT_CENTER })
/** 单击产生的预览点，双击/查询定位后清除 */
const preview = ref<{ lng: number; lat: number } | null>(null)

const picked = computed(() => props.lng !== null && props.lat !== null)
const coordinateText = computed(() => (picked.value ? `${props.lng}, ${props.lat}` : '未选点'))

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

const markerStyle = computed(() => toStyle(draftLng.value !== null && draftLat.value !== null ? { lng: draftLng.value, lat: draftLat.value } : null))
const previewStyle = computed(() => toStyle(preview.value))

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
  center.value = picked.value ? { lng: props.lng!, lat: props.lat! } : { ...DEFAULT_CENTER }
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
  emit('update:error', validateLng(point.lng) ?? validateLat(point.lat))
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
  emit('update:error', validateLng(draftLng.value))
}

function updateDraftLat(value: number | string | null) {
  draftLat.value = toNumber(value)
  emit('update:error', validateLat(draftLat.value))
}

function handleConfirm() {
  emit('update:lng', draftLng.value)
  emit('update:lat', draftLat.value)
  emit('update:error', null)
  open.value = false
}

function clear() {
  emit('update:lng', null)
  emit('update:lat', null)
  emit('update:error', null)
}

function toNumber(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null
  const num = Number(value)
  return Number.isFinite(num) ? num : null
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, value))
const round6 = (value: number) => Number(value.toFixed(6))
</script>
