<template>
  <div class="auth-brand" :class="{ 'auth-brand--image': Boolean(brand.loginBackground), 'auth-brand--preview': preview }" :style="brandStyle">
    <div class="auth-brand__logo">
      <img class="auth-brand__mark" :src="logoSrc" alt="" @error="logoFailed = true" />
      <span class="auth-brand__name">{{ brand.loginBrandName }}</span>
    </div>

    <div class="auth-brand__hero">
      <h1 class="auth-brand__title">{{ brand.loginTitle }}</h1>
      <p v-if="brand.loginSubtitle" class="auth-brand__desc">{{ brand.loginSubtitle }}</p>

      <div v-if="points.length" class="auth-brand__points">
        <div v-for="point in points" :key="point" class="auth-brand__point">
          <span class="auth-brand__point-icon"><CheckCircleOutlined /></span>
          <span class="auth-brand__point-text">{{ point }}</span>
        </div>
      </div>
    </div>

    <!-- 页脚为平台统一文案，不开放品牌自定义 -->
    <div class="auth-brand__footer">{{ PLATFORM_LOGIN_FOOTER }}</div>
  </div>
</template>

<script setup lang="ts">
/**
 * 【原型说明】认证类页面的公共品牌区。
 * 品牌取自「平台默认 + 企业覆盖」：已登录时用当前企业品牌，未登录时用最近进入企业的品牌；
 * 品牌设置页的登录页预览通过 config 传入草稿值，实现所见即所得。
 */
import { computed, ref, watch } from 'vue'
import { CheckCircleOutlined } from '@antdv-next/icons'
import {
  brandImageSrc,
  brandingVersion,
  loginBranding,
  PLATFORM_LOGIN_FOOTER,
  type BrandingConfig,
} from '@/modules/branding/store'

const props = withDefaults(defineProps<{ config?: BrandingConfig | null; preview?: boolean }>(), {
  config: null,
  preview: false,
})

/** 使用外部草稿配置时不再读取已保存品牌；否则随品牌版本号刷新 */
const brand = computed<BrandingConfig>(() => {
  if (props.config) return props.config
  void brandingVersion.value
  return loginBranding()
})

/** 品牌区三条价值点：按配置顺序展示，空值不占位 */
const points = computed(() =>
  [brand.value.loginPoint1, brand.value.loginPoint2, brand.value.loginPoint3].map((item) => item.trim()).filter(Boolean),
)

const logoFailed = ref(false)
const logoSrc = computed(() => (logoFailed.value ? `${import.meta.env.BASE_URL}logo.png` : brandImageSrc(brand.value.loginLogo)))
watch(
  () => brand.value.loginLogo,
  () => {
    logoFailed.value = false
  },
)

/** 有背景图时叠加固定深色遮罩，保证白色标题与副标题可读（交互文档 4.9.2） */
const brandStyle = computed(() => {
  const image = brand.value.loginBackground
  if (!image) return undefined
  return {
    backgroundImage: `linear-gradient(rgba(7, 63, 56, 0.5), rgba(7, 63, 56, 0.5)), url("${image}")`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
  }
})
</script>
