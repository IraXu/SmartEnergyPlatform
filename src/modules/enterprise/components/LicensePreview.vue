<template>
  <!--
    【原型说明】营业执照大图查看（OVERLAY-02）。
    不套弹窗外框，直接以深色遮罩铺满视口的灯箱形态呈现图片本身：
    底部悬浮缩放 / 旋转工具栏，右下角展示文件名，右上角关闭；
    支持滚轮缩放与拖拽平移；不提供下载与打印。
  -->
  <Teleport to="body">
    <Transition name="ent-lightbox">
      <div
        v-if="open"
        class="ent-lightbox"
        role="dialog"
        aria-modal="true"
        aria-label="营业执照"
        @click.self="emit('close')"
      >
        <!-- 关闭：右上角，与图片保持距离，避免遮挡 -->
        <button type="button" class="ent-lightbox__close" aria-label="关闭" @click="emit('close')">
          <CloseOutlined />
        </button>

        <div class="ent-lightbox__stage" @wheel="handleWheel" @pointerdown="handlePointerDown">
          <img
            v-if="!failed"
            :src="src"
            alt="营业执照"
            class="ent-lightbox__img"
            :style="imageStyle"
            draggable="false"
            @error="failed = true"
          />
          <div v-else class="ent-lightbox__error">
            <FileImageOutlined class="ent-lightbox__error-icon" />
            <p class="ent-lightbox__error-text">图片加载失败</p>
          </div>
        </div>

        <!-- 缩放与旋转工具栏：底部居中悬浮，半透明深底 -->
        <div v-if="!failed" class="ent-lightbox__toolbar" @pointerdown.stop @wheel.stop>
          <button
            type="button"
            class="ent-lightbox__tool"
            :disabled="scale <= MIN_SCALE"
            title="缩小"
            @click="zoom(-1)"
          >
            <ZoomOutOutlined />
          </button>
          <span class="ent-lightbox__scale">{{ Math.round(scale * 100) }}%</span>
          <button
            type="button"
            class="ent-lightbox__tool"
            :disabled="scale >= MAX_SCALE"
            title="放大"
            @click="zoom(1)"
          >
            <ZoomInOutlined />
          </button>
          <span class="ent-lightbox__divider" />
          <button type="button" class="ent-lightbox__tool" title="向左旋转" @click="rotate(-90)">
            <RotateLeftOutlined />
          </button>
          <button type="button" class="ent-lightbox__tool" title="向右旋转" @click="rotate(90)">
            <RotateRightOutlined />
          </button>
        </div>

        <!-- 文件名 + 操作提示 -->
        <div class="ent-lightbox__caption">
          <span class="ent-lightbox__name">{{ fileName || '营业执照' }}</span>
          <span class="ent-lightbox__hint">滚轮缩放 · 按住拖动查看</span>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
/**
 * 【原型说明】营业执照大图查看（OVERLAY-02）。
 * 提供缩放（步进 0.5，即每步 1.5×）与旋转（90° 步进）控件，支持滚轮缩放与拖拽平移；
 * 不提供下载与打印入口。图片加载失败时展示错误占位（EX-ENT-29）。
 */
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
  CloseOutlined,
  FileImageOutlined,
  RotateLeftOutlined,
  RotateRightOutlined,
  ZoomInOutlined,
  ZoomOutOutlined,
} from '@antdv-next/icons'

const props = withDefaults(
  defineProps<{ open: boolean; src: string; fileName?: string }>(),
  { fileName: '' },
)
const emit = defineEmits<{ close: [] }>()

const MIN_SCALE = 0.5
const MAX_SCALE = 4
/** 每步 0.5（即放大 1.5×、缩小约 0.67×），与交互文档「步进 0.5」一致 */
const STEP = 0.5

const scale = ref(1)
const rotateDeg = ref(0)
const failed = ref(false)
const offset = ref({ x: 0, y: 0 })
const dragging = ref(false)

watch(
  () => props.open,
  (open) => {
    if (!open) return
    scale.value = 1
    rotateDeg.value = 0
    offset.value = { x: 0, y: 0 }
    failed.value = false
  },
)

watch(
  () => props.src,
  () => {
    failed.value = false
  },
)

const imageStyle = computed(() => ({
  transform: `translate(${offset.value.x}px, ${offset.value.y}px) scale(${scale.value}) rotate(${rotateDeg.value}deg)`,
}))

function zoom(direction: 1 | -1) {
  const next = direction === 1 ? scale.value + STEP : Math.max(MIN_SCALE, scale.value - STEP)
  scale.value = Math.min(Math.max(next, MIN_SCALE), MAX_SCALE)
}

function rotate(deg: number) {
  rotateDeg.value += deg
}

function handleWheel(event: WheelEvent) {
  if (!props.open || failed.value) return
  event.preventDefault()
  zoom(event.deltaY < 0 ? 1 : -1)
}

/* ---------- 拖拽平移（图片大于容器时） ---------- */
let dragStart = { x: 0, y: 0, offsetX: 0, offsetY: 0 }

function handlePointerDown(event: PointerEvent) {
  if (failed.value) return
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
  offset.value = {
    x: dragStart.offsetX + (event.clientX - dragStart.x),
    y: dragStart.offsetY + (event.clientY - dragStart.y),
  }
}

function handlePointerUp() {
  dragging.value = false
  window.removeEventListener('pointermove', handlePointerMove)
  window.removeEventListener('pointerup', handlePointerUp)
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && props.open) emit('close')
}

onMounted(() => window.addEventListener('keydown', handleKeydown))
onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeydown)
  window.removeEventListener('pointermove', handlePointerMove)
  window.removeEventListener('pointerup', handlePointerUp)
})
</script>
