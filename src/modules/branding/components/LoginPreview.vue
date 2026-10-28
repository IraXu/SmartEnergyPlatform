<template>
  <ScaledStage :width="1120" :height="400">
    <div class="brand-login-stage">
      <AuthBrand :config="config" preview />
    </div>
  </ScaledStage>
</template>

<script setup lang="ts">
/**
 * 【原型说明】登录页品牌区预览（与左侧「登录页品牌」配置一一对应）。
 * 直接复用真实登录页的品牌区组件与样式类，只展示可配置的品牌区；
 * 右侧表单区由登录与注册模块固定，不属于品牌设置范围。
 */
import AuthBrand from '@/modules/auth/components/AuthBrand.vue'
import type { BrandingConfig } from '@/modules/branding/store'
import ScaledStage from './ScaledStage.vue'

defineProps<{ config: BrandingConfig }>()
</script>
