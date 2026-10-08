<template>
  <div class="auth-brand">
    <div class="auth-brand__logo">
      <img class="auth-brand__mark" :src="`${baseUrl}logo.png`" alt="智能数字化能源系统" />
      <span class="auth-brand__name">智能数字化能源系统</span>
    </div>

    <div class="auth-brand__hero">
      <h1 class="auth-brand__title">连接每一台设备 · 看清每一度能源</h1>
      <p class="auth-brand__desc">
        以电能为重点的能源数字化管理平台，统一接入并管理园区、企业与各类用能场景的电能数据，
        覆盖设备管控、用电策略、点位分布与告警闭环，支撑用能成本下降与碳排管理目标达成。
      </p>

      <div class="auth-brand__points">
        <div class="auth-brand__point">
          <span class="auth-brand__point-icon"><CheckCircleOutlined /></span>
          <span class="auth-brand__point-text">设备台账与固件 OTA，档案与运行状态集中管控</span>
        </div>
        <div class="auth-brand__point">
          <span class="auth-brand__point-icon"><CheckCircleOutlined /></span>
          <span class="auth-brand__point-text">时控与负控策略，用电管控按规则自动执行</span>
        </div>
        <div class="auth-brand__point">
          <span class="auth-brand__point-icon"><CheckCircleOutlined /></span>
          <span class="auth-brand__point-text">点位地图与告警中心，设备分布可视、异常闭环</span>
        </div>
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
