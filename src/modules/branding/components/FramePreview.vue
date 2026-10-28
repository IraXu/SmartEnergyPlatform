<template>
  <div class="brand-frame">
    <header class="admin-header">
      <div class="admin-header__left">
        <img class="admin-header__mark" :src="logoSrc" alt="" @error="logoFailed = true" />
        <span class="admin-header__title">{{ config.headerTitle }}</span>
      </div>

      <div class="admin-header__right">
        <span class="brand-frame__org">
          <span class="brand-frame__org-badge">{{ orgInitial }}</span>
          <span class="brand-frame__org-name">{{ orgName }}</span>
          <DownOutlined class="brand-frame__caret" />
        </span>
        <span class="brand-frame__account">
          <span class="brand-frame__avatar">{{ userInitial }}</span>
          <span class="brand-frame__account-name">{{ userName }}</span>
          <DownOutlined class="brand-frame__caret" />
        </span>
      </div>
    </header>

    <div class="brand-frame__body">
      <nav class="admin-nav brand-frame__nav" aria-label="主界面框架预览导航">
        <template v-for="item in navItems" :key="item.key">
          <span v-if="item.bottom" class="brand-frame__nav-spacer" />
          <button
            type="button"
            class="admin-nav__item"
            :class="{ 'admin-nav__item--current': item.current }"
            tabindex="-1"
          >
            <component :is="item.icon" class="admin-nav__icon" />
            <span class="admin-nav__label">{{ item.label }}</span>
          </button>
        </template>
      </nav>

      <main class="brand-frame__content">
        <div class="brand-frame__content-head">
          <span class="brand-frame__content-title">工作台</span>
          <span class="brand-frame__content-note">内容区示意</span>
        </div>

        <div class="brand-frame__metrics">
          <div v-for="metric in metrics" :key="metric.label" class="brand-frame__metric">
            <span class="brand-frame__metric-label">{{ metric.label }}</span>
            <span class="brand-frame__metric-value">{{ metric.value }}</span>
            <span class="brand-frame__metric-note">{{ metric.note }}</span>
          </div>
        </div>

        <div class="brand-frame__panels">
          <div class="brand-frame__panel">
            <span class="brand-frame__panel-title">用能趋势</span>
            <div class="brand-frame__chart">
              <span v-for="(height, index) in chartBars" :key="index" class="brand-frame__bar" :style="{ height: `${height}%` }" />
            </div>
          </div>

          <div class="brand-frame__panel">
            <span class="brand-frame__panel-title">最新告警</span>
            <ul class="brand-frame__alarms">
              <li v-for="alarm in alarms" :key="alarm.text">
                <span class="brand-frame__alarm-dot" :class="`brand-frame__alarm-dot--${alarm.level}`" />
                <span class="brand-frame__alarm-text">{{ alarm.text }}</span>
                <span class="brand-frame__alarm-time">{{ alarm.time }}</span>
              </li>
            </ul>
          </div>
        </div>
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * 【原型说明】品牌设置页的主界面框架预览（交互文档 4.9.3）。
 * 顶栏复用真实布局的 .admin-header 与 .admin-header__title 样式，仅约束为 1120×360 画布；
 * 导航、指标与内容为静态示意，用于判断品牌效果，不代表真实业务数据。
 */
import { computed, ref, watch } from 'vue'
import {
  AlertOutlined,
  ClusterOutlined,
  DownOutlined,
  HeatMapOutlined,
  HomeOutlined,
  SettingOutlined,
  ThunderboltOutlined,
} from '@antdv-next/icons'
import { session } from '@/modules/auth/store'
import { brandImageSrc } from '@/modules/branding/store'
import type { BrandingConfig } from '@/modules/branding/store'
import { maskIdentifier } from '@/shared/utils/mask'

const props = defineProps<{ config: BrandingConfig }>()

const logoFailed = ref(false)
const logoSrc = computed(() => (logoFailed.value ? `${import.meta.env.BASE_URL}logo.png` : brandImageSrc(props.config.headerLogo)))
watch(
  () => props.config.headerLogo,
  () => {
    logoFailed.value = false
  },
)

const orgName = computed(() => session.current?.orgName || '示例企业')
const orgInitial = computed(() => orgName.value.slice(0, 1))
const userName = computed(() => {
  const current = session.current
  if (!current) return '企业管理员'
  return current.contactName || maskIdentifier(current.identifier)
})
const userInitial = computed(() => userName.value.slice(0, 1) || '用')

const navItems = [
  { key: 'workbench', label: '工作台', icon: HomeOutlined, current: true },
  { key: 'location', label: '点位地图', icon: HeatMapOutlined, current: false },
  { key: 'alarm', label: '告警中心', icon: AlertOutlined, current: false },
  { key: 'energy', label: '能源数据', icon: ThunderboltOutlined, current: false },
  { key: 'device', label: '设备管理', icon: ClusterOutlined, current: false },
  { key: 'system', label: '系统管理', icon: SettingOutlined, current: false, bottom: true },
]

const metrics = [
  { label: '设备总数', value: '128', note: '台' },
  { label: '在线设备', value: '116', note: '在线率 90.6%' },
  { label: '今日告警', value: '3', note: '待关注 1 条' },
  { label: '今日用能', value: '1,286', note: 'kWh' },
]

const chartBars = [38, 52, 44, 66, 58, 72, 61, 78, 69, 83, 74, 88]
const alarms = [
  { text: 'A 相失压', time: '10:24', level: 'high' },
  { text: '设备离线', time: '09:12', level: 'mid' },
  { text: '电压越限', time: '08:46', level: 'low' },
]
</script>
