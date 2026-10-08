<template>
  <div class="auth-brand">
    <div class="auth-brand__logo">
      <img class="auth-brand__mark" :src="`${baseUrl}logo.png`" alt="智能数字化能源系统" />
      <span class="auth-brand__name">智能数字化能源系统</span>
    </div>
    <h1 class="auth-brand__title">让每一度能源<br />都可见、可控、可优化</h1>
    <p class="auth-brand__desc">
      面向工商业园区与用能企业的能源数字化管理平台，统一采集电、水、气等能源数据，
      支撑能耗成本下降与碳排管理目标达成。
    </p>
    <div class="auth-brand__points">
      <div class="auth-brand__point">
        <CheckCircleOutlined />
        <span>统一账号体系，支持多组织数据隔离</span>
      </div>
      <div class="auth-brand__point">
        <CheckCircleOutlined />
        <span>手机号与邮箱双通道认证，登录方式灵活</span>
      </div>
      <div class="auth-brand__point">
        <CheckCircleOutlined />
        <span>账号安全策略可追溯，异常登录可防护</span>
      </div>
    </div>
    <div class="auth-brand__footer">© 2026 智能数字化能源系统· 伊米特合作平台项目 · 南京鹤梦产品部原型</div>
  </div>
</template>

<script setup lang="ts">
/**
 * 【原型说明】左侧品牌区为认证类页面的公共视觉模块。
 */
import { CheckCircleOutlined } from '@antdv-next/icons'

/** 站点部署基路径：兼容 GitHub Pages 子路径与本地根路径 */
const baseUrl = import.meta.env.BASE_URL
</script>
