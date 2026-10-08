<template>
  <!-- OVERLAY-05 企业 Logo 裁剪（COMP-ENT-03）：固定 1:1 裁剪框，可拖动与缩放，不留白、不提供旋转与比例切换 -->
  <a-modal
    :open="open"
    title="裁剪企业 Logo"
    :width="560"
    :footer="null"
    :mask-closable="true"
    @cancel="emit('cancel')"
  >
    <p class="ent-crop__desc">拖动图片调整位置，滚轮或滑杆缩放；Logo 将按正方形展示</p>

    <!-- 裁剪区：外层 320×320 裁剪框，框内展示图片，框外用半透明遮罩压暗 -->
    <div class="ent-crop__stage" @wheel="handleWheel">
      <div class="ent-crop__frame" @pointerdown="handlePointerDown">
        <img
          v-if="imageSrc"
          :src="imageSrc"
          alt=""
          class="ent-crop__img"
          :style="imageStyle"
          draggable="false"
        />
        <span v-if="dragging" class="ent-crop__hint">松开鼠标完成定位</span>
      </div>
      <span class="ent-crop__corner ent-crop__corner--tl" />
      <span class="ent-crop__corner ent-crop__corner--tr" />
      <span class="ent-crop__corner ent-crop__corner--bl" />
      <span class="ent-crop__corner ent-crop__corner--br" />
    </div>

    <!-- 缩放控件：− 按钮 + 滑杆 + ＋ 按钮（与滚轮缩放联动） -->
    <div class="ent-crop__zoom">
      <a-button size="small" :disabled="zoom <= 1" @click="stepZoom(-1)">−</a-button>
      <a-slider
        v-model:value="zoom"
        class="ent-crop__slider"
        :min="1"
        :max="LOGO_CROP_MAX_SCALE"
        :step="0.01"
        :tooltip="{ formatter: (value: number) => `${Number(value).toFixed(2)}×` }"
      />
      <a-button size="small" :disabled="zoom >= LOGO_CROP_MAX_SCALE" @click="stepZoom(1)">＋</a-button>
    </div>

    <p v-if="sizeWarning" class="ent-crop__warn">{{ sizeWarning }}</p>

    <div class="ent-crop__footer">
      <a-button @click="emit('cancel')">取消</a-button>
      <a-button type="primary" :disabled="!ready" @click="handleConfirm">确定</a-button>
    </div>
  </a-modal>
</template>

<script setup lang="ts">
/**
 * 【原型说明】企业 Logo 裁剪浮层（OVERLAY-05 / COMP-ENT-03）。
 * 固定 320×320px 正方形裁剪框；图片可拖动平移、滚轮 / 滑杆 / ± 按钮缩放；
 * 缩放最小比例为「图片恰好铺满裁剪框」（不留白），最大 3×；
 * 不提供裁剪比例切换与旋转。确定后回填裁剪结果（待保存态，仍需点卡片「保存」）。
 */
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { cropToSquare, loadImageFile } from '../store'
import { LOGO_CROP_MAX_SCALE, LOGO_CROP_SIZE, LOGO_SUGGEST_SIZE } from '../store'

const props = defineProps<{ open: boolean; file: File | null }>()
const emit = defineEmits<{ cancel: []; confirm: [string] }>()

const imageEl = ref<HTMLImageElement | null>(null)
const imageSrc = ref('')
/** 缩放倍数：1 = 图片恰好铺满裁剪框（基准比例），上限 3× */
const zoom = ref(1)
/** 图片相对裁剪框中心的偏移（CSS 像素） */
const offset = ref({ x: 0, y: 0 })
const dragging = ref(false)
const sizeWarning = ref('')

const ready = computed(() => Boolean(imageEl.value && imageSrc.value))

/** 基准比例：使图片恰好铺满裁剪框的最小比例（不留白） */
const baseScale = computed(() => {
  const image = imageEl.value
  if (!image) return 1
  return Math.max(LOGO_CROP_SIZE / image.naturalWidth, LOGO_CROP_SIZE / image.naturalHeight)
})

/** 当前实际显示比例与显示尺寸 */
const displayScale = computed(() => baseScale.value * zoom.value)
const displaySize = computed(() => {
  const image = imageEl.value
  if (!image) return { width: 0, height: 0 }
  return {
    width: image.naturalWidth * displayScale.value,
    height: image.naturalHeight * displayScale.value,
  }
})

/** 偏移上限：保证裁剪框始终被图片填满，不出现留白（EX-ENT-28） */
const offsetLimit = computed(() => ({
  x: Math.max(0, (displaySize.value.width - LOGO_CROP_SIZE) / 2),
  y: Math.max(0, (displaySize.value.height - LOGO_CROP_SIZE) / 2),
}))

const imageStyle = computed(() => ({
  width: `${displaySize.value.width}px`,
  height: `${displaySize.value.height}px`,
  left: `${(LOGO_CROP_SIZE - displaySize.value.width) / 2 + offset.value.x}px`,
  top: `${(LOGO_CROP_SIZE - displaySize.value.height) / 2 + offset.value.y}px`,
}))

/** 缩放变化后重新夹取偏移，避免出现留白 */
function clampOffset() {
  const limit = offsetLimit.value
  offset.value = {
    x: Math.min(Math.max(offset.value.x, -limit.x), limit.x),
    y: Math.min(Math.max(offset.value.y, -limit.y), limit.y),
  }
}

watch(zoom, clampOffset)

async function prepare() {
  const file = props.file
  imageEl.value = null
  imageSrc.value = ''
  offset.value = { x: 0, y: 0 }
  zoom.value = 1
  sizeWarning.value = ''
  if (!file) return
  try {
    const image = await loadImageFile(file)
    imageEl.value = image
    imageSrc.value = image.src
    if (Math.min(image.naturalWidth, image.naturalHeight) < LOGO_SUGGEST_SIZE) {
      sizeWarning.value = '图片尺寸较小，可能在徽标中显示模糊'
    }
  } catch {
    sizeWarning.value = '图片读取失败，请重新选择'
  }
}

watch(() => props.file, prepare, { immediate: true })
watch(
  () => props.open,
  (open) => {
    if (open) prepare()
  },
)

function stepZoom(direction: 1 | -1) {
  const next = zoom.value + direction * 0.25
  zoom.value = Math.min(Math.max(next, 1), LOGO_CROP_MAX_SCALE)
}

/* ---------- 拖动平移 ---------- */
let dragStart = { x: 0, y: 0, offsetX: 0, offsetY: 0 }

function handlePointerDown(event: PointerEvent) {
  if (!ready.value) return
  dragging.value = true
  dragStart = {
    x: event.clientX,
    y: event.clientY,
    offsetX: offset.value.x,
    offsetY: offset.value.y,
  }
  window.addEventListener('pointermove', handlePointerMove)
  window.addEventListener('pointerup', handlePointerUp)
}

function handlePointerMove(event: PointerEvent) {
  if (!dragging.value) return
  const limit = offsetLimit.value
  offset.value = {
    x: Math.min(Math.max(dragStart.offsetX + (event.clientX - dragStart.x), -limit.x), limit.x),
    y: Math.min(Math.max(dragStart.offsetY + (event.clientY - dragStart.y), -limit.y), limit.y),
  }
}

function handlePointerUp() {
  dragging.value = false
  window.removeEventListener('pointermove', handlePointerMove)
  window.removeEventListener('pointerup', handlePointerUp)
}

/** 滚轮缩放：向上放大、向下缩小，与滑杆联动 */
function handleWheel(event: WheelEvent) {
  if (!props.open || !ready.value) return
  event.preventDefault()
  const next = zoom.value + (event.deltaY < 0 ? 0.1 : -0.1)
  zoom.value = Math.min(Math.max(next, 1), LOGO_CROP_MAX_SCALE)
}

onBeforeUnmount(() => {
  window.removeEventListener('pointermove', handlePointerMove)
  window.removeEventListener('pointerup', handlePointerUp)
})

function handleConfirm() {
  const image = imageEl.value
  if (!image) return
  const scale = displayScale.value
  const size = LOGO_CROP_SIZE / scale
  // 裁剪框左上角在原图坐标系中的位置
  const left = (LOGO_CROP_SIZE - displaySize.value.width) / 2 + offset.value.x
  const top = (LOGO_CROP_SIZE - displaySize.value.height) / 2 + offset.value.y
  emit('confirm', cropToSquare(image, { x: -left / scale, y: -top / scale, size }))
}
</script>
