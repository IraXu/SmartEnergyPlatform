<template>
  <div class="page-container">
    <a-alert
      type="info"
      show-icon
      :message="`${title}为导航框架占位页`"
      description="本期「登录与注册」模块仅验证认证流程与后台框架。该模块的二级功能与页面内容在其对应模块定稿后补充。"
      style="margin-bottom: 20px"
    />
  </div>
</template>

<script setup lang="ts">
/**
 * 【原型说明】导航框架占位页：用于验证一级导航在多个模块间的高亮与切换，
 * 模块内容在其对应模块文档定稿后替换为真实页面。
 */
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const title = computed(() => String(route.meta.title ?? '该模块'))
</script>
