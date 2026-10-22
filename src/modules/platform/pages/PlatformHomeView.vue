<template>
  <div class="page-container platform-home">
    <!-- 顶部欢迎卡片：账号信息 + 当前时间 + 欢迎语 -->
    <section class="platform-hello">
      <div class="platform-hello__main">
        <p class="platform-hello__greeting">Hello，{{ displayName }}</p>
        <p class="platform-hello__meta">
          <span>{{ identifier }}</span>
          <span class="platform-hello__dot" aria-hidden="true">·</span>
          <span>{{ roleText }}</span>
        </p>
        <p class="platform-hello__welcome">欢迎使用智能数字化能源系统平台管理端</p>
      </div>
      <div class="platform-hello__clock">
        <p class="platform-hello__time">{{ clockTime }}</p>
        <p class="platform-hello__date">{{ clockDate }}</p>
      </div>
    </section>

    <!-- 关键指标区：按全平台 / 所选企业口径汇总 -->
    <section class="platform-home__filter">
      <span class="platform-home__filter-title">平台概览</span>
      <a-select
        v-model:value="selectedOrgId"
        class="platform-home__filter-control"
        allow-clear
        show-search
        option-filter-prop="label"
        placeholder="按企业筛选（默认全平台）"
        :options="orgOptions"
        @change="loadMetrics"
      />
      <span class="platform-home__filter-hint">
        {{ selectedOrgId ? '当前按所选企业统计' : '当前按全平台统计' }}
      </span>
      <div class="platform-home__filter-right">
        <span class="platform-home__time">数据统计时间：{{ updatedAtText }}</span>
        <a-button :loading="loading" @click="loadMetrics">
          <template #icon><ReloadOutlined /></template>
          刷新
        </a-button>
      </div>
    </section>

    <section class="platform-home__cards">
      <article
        v-for="card in cards"
        :key="card.key"
        class="platform-metric"
        :class="{ 'platform-metric--error': card.error }"
      >
        <template v-if="card.error">
          <p class="platform-metric__error">数据加载失败</p>
          <a-button type="link" size="small" @click="loadMetrics">刷新</a-button>
        </template>
        <template v-else>
          <span class="platform-metric__icon" :class="`platform-metric__icon--${card.key}`">
            <component :is="card.icon" />
          </span>
          <div class="platform-metric__main">
            <span class="platform-metric__label">{{ card.label }}</span>
            <span class="platform-metric__value">{{ card.value }}</span>
            <span v-if="card.hint" class="platform-metric__hint">{{ card.hint }}</span>
          </div>
        </template>
      </article>
    </section>

    <!-- 下半区：企业设备分布 + 快捷入口 -->
    <div class="platform-home__lower">
      <section class="platform-panel platform-panel--board">
        <div class="platform-panel__head">
          <h2 class="platform-panel__title">企业设备分布</h2>
          <span class="platform-panel__note">按在册设备数降序</span>
        </div>
        <ul class="platform-rank">
          <li v-for="(row, index) in ranking" :key="row.id" class="platform-rank__item">
            <span class="platform-rank__no" :class="{ 'is-top': index < 3 }">{{ index + 1 }}</span>
            <span class="platform-rank__name" :title="row.name">{{ row.name }}</span>
            <span class="platform-rank__bar">
              <i class="platform-rank__bar-fill" :style="{ width: `${row.percent}%` }" />
            </span>
            <span class="platform-rank__count">{{ row.deviceCount.toLocaleString('zh-CN') }} 台</span>
            <span class="platform-rank__rate">{{ row.onlineRate }}%</span>
          </li>
        </ul>
      </section>

      <section class="platform-panel platform-panel--entry">
        <div class="platform-panel__head">
          <h2 class="platform-panel__title">快捷入口</h2>
        </div>
        <div class="platform-entry">
          <button
            v-for="entry in entries"
            :key="entry.route"
            type="button"
            class="platform-entry__item"
            @click="router.push(entry.route)"
          >
            <span class="platform-entry__icon"><component :is="entry.icon" /></span>
            <span class="platform-entry__text">
              <span class="platform-entry__label">{{ entry.label }}</span>
              <span class="platform-entry__desc">{{ entry.desc }}</span>
            </span>
            <RightOutlined class="platform-entry__arrow" />
          </button>
        </div>
      </section>
    </div>

    <ProtoTip :lines="tipLines" />
  </div>
</template>

<script setup lang="ts">
/**
 * PAL-PAGE-01 首页
 * 【原型说明】对齐《产品交互设计文档-首页》v1.0：
 * - 顶部欢迎卡片展示登录账号（姓名 / 账号 / 平台角色，账号不脱敏）、当前时间与欢迎语；
 * - 三项指标：客户数 / 已添加设备数 / 在线设备数，默认全平台，可按企业（单选）筛选；
 * - 企业设备分布：按各企业在册设备数与在线率给出排行（视觉增强，不提供下钻）；
 * - 快捷入口：按平台权限点渲染可进入的模块。
 * 指标卡只读、不下钻；单卡加载失败不影响其余卡片。
 */
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import {
  ApartmentOutlined,
  ClusterOutlined,
  HomeOutlined,
  RightOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
  ThunderboltOutlined,
  UserOutlined,
} from '@antdv-next/icons'
import ProtoTip from '@/shared/components/ProtoTip.vue'
import { session } from '@/modules/auth/store'
import {
  currentPlatformPermissions,
  platformEnterprises,
  type PlatformEnterprise,
} from '@/modules/platform/store'

const router = useRouter()

const loading = ref(false)
const selectedOrgId = ref<string | undefined>(undefined)

const metrics = ref({ customerCount: 0, deviceCount: 0, onlineDeviceCount: 0, updatedAt: Date.now() })
/** 各卡片独立错误态：单项失败不影响其余（EX-PH-01） */
const cardError = ref<Record<string, boolean>>({})

/* ---------- 顶部欢迎卡片 ---------- */
const currentSession = computed(() => session.current)
/** 账号不做脱敏，按登录时的账号原值展示 */
const identifier = computed(() => currentSession.value?.identifier ?? '—')
const displayName = computed(() => currentSession.value?.platformName || identifier.value)
const roleText = computed(() => {
  const roles = currentSession.value?.platformRoles ?? []
  return roles.length ? roles.join('、') : '—'
})

/** 当前时间：实时走秒 */
const now = ref(Date.now())
let clockTimer: number | undefined
const pad = (value: number) => String(value).padStart(2, '0')
const clockTime = computed(() => {
  const date = new Date(now.value)
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
})
const clockDate = computed(() => {
  const date = new Date(now.value)
  const weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']
  return `${date.getFullYear()} 年 ${pad(date.getMonth() + 1)} 月 ${pad(date.getDate())} 日 ${weekdays[date.getDay()]}`
})

/* ---------- 指标与分布 ---------- */
const orgOptions = computed(() =>
  platformEnterprises().map((org: PlatformEnterprise) => ({ label: org.name, value: org.id })),
)

const updatedAtText = computed(() => formatTime(metrics.value.updatedAt))

function formatTime(ts: number) {
  const d = new Date(ts)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

/** 【原型说明】未筛选时按全平台口径汇总，否则按所选企业口径 */
function computeMetrics() {
  const list = platformEnterprises()
  if (!selectedOrgId.value) {
    const deviceCount = list.reduce((total, org) => total + org.deviceCount, 0)
    const onlineDeviceCount = list.reduce((total, org) => total + org.onlineCount, 0)
    return { customerCount: list.length, deviceCount, onlineDeviceCount, updatedAt: Date.now() }
  }
  const org = list.find((item) => item.id === selectedOrgId.value)
  if (!org) {
    return { customerCount: list.length, deviceCount: 0, onlineDeviceCount: 0, updatedAt: Date.now() }
  }
  return {
    customerCount: 1,
    deviceCount: org.deviceCount,
    onlineDeviceCount: org.onlineCount,
    updatedAt: Date.now(),
  }
}

const onlineRate = computed(() =>
  metrics.value.deviceCount > 0
    ? `${Math.round((metrics.value.onlineDeviceCount / metrics.value.deviceCount) * 1000) / 10}%`
    : '—',
)

const cards = computed(() => [
  { key: 'customer', label: '客户数', value: formatNumber(metrics.value.customerCount), hint: '平台内企业总数', icon: HomeOutlined, error: cardError.value.customer },
  { key: 'device', label: '已添加设备数', value: formatNumber(metrics.value.deviceCount), hint: '在册设备总数', icon: ClusterOutlined, error: cardError.value.device },
  { key: 'online', label: '在线设备数', value: formatNumber(metrics.value.onlineDeviceCount), hint: `在线率 ${onlineRate.value}`, icon: ThunderboltOutlined, error: cardError.value.online },
])

function formatNumber(value: number) {
  return value.toLocaleString('zh-CN')
}

/** 企业设备分布：按在册设备数降序，条形宽度以最大设备数归一化 */
const ranking = computed(() => {
  const list = [...platformEnterprises()].sort((a, b) => b.deviceCount - a.deviceCount)
  const max = list[0]?.deviceCount ?? 1
  return list.map((org) => ({
    id: org.id,
    name: org.name,
    deviceCount: org.deviceCount,
    onlineRate: org.deviceCount > 0 ? Math.round((org.onlineCount / org.deviceCount) * 1000) / 10 : 0,
    percent: Math.max(6, Math.round((org.deviceCount / max) * 100)),
  }))
})

/* ---------- 快捷入口（按平台权限点渲染） ---------- */
const permissions = computed(() => currentPlatformPermissions())
const entries = computed(() => {
  const list: Array<{ label: string; desc: string; route: string; icon: typeof HomeOutlined }> = []
  if (permissions.value.includes('platform:customer')) {
    list.push({ label: '客户&设备', desc: '跨企业查看全平台设备', route: '/platform/customer', icon: ClusterOutlined })
  }
  if (permissions.value.includes('platform:member')) {
    list.push({ label: '平台成员管理', desc: '维护平台侧成员账号', route: '/platform/members', icon: UserOutlined })
  }
  if (permissions.value.includes('platform:role')) {
    list.push({ label: '平台角色管理', desc: '配置平台角色与权限', route: '/platform/roles', icon: ApartmentOutlined })
  }
  if (permissions.value.includes('platform:enterprise:role')) {
    list.push({
      label: '企业角色管理',
      desc: '维护全平台企业默认角色',
      route: '/platform/enterprise-roles',
      icon: SafetyCertificateOutlined,
    })
  }
  return list
})

async function loadMetrics() {
  loading.value = true
  cardError.value = {}
  await new Promise((resolve) => window.setTimeout(resolve, 400))
  metrics.value = computeMetrics()
  loading.value = false
}

const tipLines = [
  '顶部欢迎卡片展示当前登录账号（姓名 / 账号 / 平台角色，账号不脱敏）、当前时间与欢迎语。',
  '平台概览三项指标：客户数（平台内企业总数）、已添加设备数、在线设备数；默认全平台口径，选定企业后按该企业口径更新。',
  '「企业设备分布」按各企业在册设备数降序给出条形对比与在线率，只读展示、不提供下钻。',
  '「快捷入口」按当前账号的平台权限点渲染可进入的模块。',
  '指标卡只读、不提供点击下钻；查看设备明细请进入「客户&设备」。',
]

onMounted(() => {
  metrics.value = computeMetrics()
  clockTimer = window.setInterval(() => {
    now.value = Date.now()
  }, 1000)
})

onBeforeUnmount(() => {
  if (clockTimer) window.clearInterval(clockTimer)
})
</script>
