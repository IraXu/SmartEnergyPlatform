<template>
  <div class="tab-preview">
    <div class="tab-preview__browser">
      <div class="tab-preview__bar">
        <span class="tab-preview__dots" aria-hidden="true"><i /><i /><i /></span>
        <span class="tab-preview__tab" :title="tabTitle">
          <img class="tab-preview__favicon" :src="faviconSrc" alt="" @error="faviconFailed = true" />
          <span class="tab-preview__tab-title">{{ tabTitle }}</span>
          <CloseOutlined class="tab-preview__close" />
        </span>
        <span class="tab-preview__new" aria-hidden="true">+</span>
      </div>

      <div class="tab-preview__address">
        <LockOutlined />
        <span>https://energy.example.com/#/login</span>
      </div>

      <div class="tab-preview__page">
        <div class="tab-preview__page-brand">
          <span class="tab-preview__page-mark">
            <img :src="brandImageSrc(config.loginLogo)" alt="" />
          </span>
          <span class="tab-preview__page-name">{{ config.loginBrandName }}</span>
        </div>
        <div class="tab-preview__page-lines">
          <span class="tab-preview__line tab-preview__line--wide" />
          <span class="tab-preview__line" />
        </div>
        <span class="tab-preview__page-note">标签页效果预览</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * 【原型说明】浏览器标签预览卡（与左侧「浏览器标签」配置一一对应）。
 * 以接近 1:1 的浏览器标签栏呈现标题与图标，避免整体缩放导致文字不可读。
 */
import { computed, ref, watch } from 'vue'
import { CloseOutlined, LockOutlined } from '@antdv-next/icons'
import { brandImageSrc, type BrandingConfig } from '@/modules/branding/store'

const props = defineProps<{ config: BrandingConfig }>()

const faviconFailed = ref(false)
watch(
  () => props.config.tabIcon,
  () => {
    faviconFailed.value = false
  },
)

const faviconSrc = computed(() =>
  faviconFailed.value ? `${import.meta.env.BASE_URL}logo.png` : brandImageSrc(props.config.tabIcon),
)
const tabTitle = computed(() => `登录 — ${props.config.tabTitle}`)
</script>
