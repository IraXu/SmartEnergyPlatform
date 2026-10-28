<template>
  <ScaledStage :width="1120" :height="360">
    <FramePreview :config="config" />
  </ScaledStage>
</template>

<script setup lang="ts">
/**
 * 【原型说明】主界面框架预览（与左侧「主界面框架」配置一一对应）。
 * 复用真实顶栏样式，按 1120×360 画布绘制后等比缩放到预览列宽度；
 * 重点呈现 Header Logo、主界面标题与导航框架，内容区仅作示意。
 */
import type { BrandingConfig } from '@/modules/branding/store'
import FramePreview from './FramePreview.vue'
import ScaledStage from './ScaledStage.vue'

defineProps<{ config: BrandingConfig }>()
</script>
