<template>
  <div ref="stageRef" class="brand-scaled-stage" :style="{ height: `${stageHeight}px` }">
    <div
      class="brand-scaled-stage__canvas"
      :style="{
        width: `${width}px`,
        height: `${height}px`,
        transform: `scale(${scale})`,
      }"
    >
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * 【原型说明】固定设计画布的等比缩放容器。
 * 预览内容按真实页面尺寸（如 960×540）绘制，再按容器宽度等比缩放铺满容器，保证字号、间距比例与真实页面一致。
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'

const props = defineProps<{ width: number; height: number }>()

const stageRef = ref<HTMLElement | null>(null)
const stageWidth = ref(0)
/** 不设 1:1 上限：始终按容器宽度等比缩放，避免宽屏下预览两侧留白 */
const scale = computed(() => (stageWidth.value ? stageWidth.value / props.width : 0))
const stageHeight = computed(() => Math.round(props.height * scale.value))

let observer: ResizeObserver | null = null

function measure() {
  stageWidth.value = stageRef.value?.clientWidth ?? 0
}

onMounted(async () => {
  await nextTick()
  measure()
  if (typeof ResizeObserver !== 'undefined' && stageRef.value) {
    observer = new ResizeObserver(measure)
    observer.observe(stageRef.value)
  }
})

onBeforeUnmount(() => {
  observer?.disconnect()
  observer = null
})
</script>
