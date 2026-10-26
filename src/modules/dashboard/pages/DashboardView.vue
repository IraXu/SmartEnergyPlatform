<template>
  <div class="page-container wb-page">
    <!-- 顶部信息区：账号信息卡 + 企业信息卡（统一色调 + 标题分割线） -->
    <section class="wb-top" aria-label="身份与企业信息">
      <!-- AREA-WB-01 账号信息卡 -->
      <div class="wb-card wb-account">
        <p class="wb-card__label">账号信息</p>
        <div class="wb-account__body">
          <span class="wb-account__avatar" aria-hidden="true">{{ userInitial }}</span>
          <div class="wb-account__main">
            <p class="wb-account__greeting">Hello，{{ displayName }}</p>
            <div class="wb-account__meta">
              <span class="wb-account__id">{{ maskedIdentifier }}</span>
              <template v-if="roleTags.length">
                <a-tag v-for="role in roleTags" :key="role" class="wb-account__role">{{ role }}</a-tag>
              </template>
              <span v-else class="wb-account__id">—</span>
            </div>
          </div>
          <div class="wb-account__clock">
            <p class="wb-account__time">{{ clockTime }}</p>
            <p class="wb-account__date">{{ clockDate }}</p>
          </div>
        </div>
      </div>

      <!-- AREA-WB-02 企业信息卡 -->
      <div class="wb-card wb-enterprise">
        <p class="wb-card__label">企业信息</p>
        <div class="wb-enterprise__body">
          <EnterpriseBadge :logo="profile.logo" :name="profile.name" :size="52" :radius="10" />
          <div class="wb-enterprise__text">
            <p class="wb-enterprise__name">{{ profile.name || '—' }}</p>
            <p class="wb-enterprise__addr">
              <EnvironmentOutlined />
              <span>{{ profile.registeredAddress || '—' }}</span>
            </p>
          </div>
        </div>
      </div>
    </section>

    <!-- AREA-WB-03 平台使用引导（四步；全部完成自动隐藏） -->
    <section v-if="showOnboarding" class="wb-onboard" aria-label="平台使用引导">
      <header class="wb-onboard__head">
        <h2 class="wb-onboard__title">
          <span class="wb-onboard__wave" aria-hidden="true">👋</span>
          欢迎使用智能数字化能源平台，完成以下基础设置后即可正常使用
        </h2>
        <a-button
          type="text"
          shape="circle"
          size="small"
          class="wb-onboard__close"
          aria-label="关闭引导"
          @click="closeOnboarding"
        >
          <template #icon><CloseOutlined /></template>
        </a-button>
      </header>
      <div class="wb-onboard__steps">
        <template v-for="(step, i) in steps" :key="step.key">
          <button
            type="button"
            class="wb-step"
            :class="{ 'wb-step--done': step.done }"
            :disabled="step.done"
            @click="goStep(step)"
          >
            <span class="wb-step__head">
              <span class="wb-step__index">
                <CheckCircleOutlined v-if="step.done" />
                <template v-else>{{ step.index }}</template>
              </span>
              <span v-if="step.done" class="wb-step__state wb-step__state--done">
                <CheckCircleOutlined />
                已完成
              </span>
              <span v-else class="wb-step__state wb-step__state--todo">
                去完成
                <RightOutlined class="wb-step__go" />
              </span>
            </span>
            <span class="wb-step__text">
              <span class="wb-step__title">{{ step.title }}</span>
              <span class="wb-step__desc">{{ step.desc }}</span>
            </span>
          </button>
          <RightOutlined v-if="i < steps.length - 1" class="wb-onboard__arrow" />
        </template>
      </div>
      <!-- 进度置于卡片底部：整行铺满，进度条在前、文字与百分比紧随其后 -->
      <div class="wb-onboard__progress">
        <span class="wb-onboard__progress-bar">
          <i :style="{ width: `${progressPercent}%` }" />
        </span>
        <div class="wb-onboard__progress-meta">
          <span class="wb-onboard__progress-text">
            已完成 <b>{{ doneCount }}</b> / {{ steps.length }} 步
          </span>
          <span class="wb-onboard__progress-percent">{{ progressPercent }}%</span>
        </div>
      </div>
    </section>

    <!-- AREA-WB-04 核心指标统计面板（六项；面板头含统计时间与刷新） -->
    <section class="wb-stats" aria-label="核心指标">
      <header class="wb-stats__head">
        <h2 class="wb-panel-title">核心指标</h2>
        <div class="wb-stats__tools">
          <span class="wb-stats__time">数据统计时间：{{ updatedAtText }}</span>
          <a-button :loading="loading" size="small" @click="reload">
            <template #icon><ReloadOutlined /></template>
            刷新
          </a-button>
        </div>
      </header>

      <div v-if="statsError" class="wb-error wb-error--inline">
        <span class="wb-error__icon" aria-hidden="true">
          <ExclamationCircleOutlined />
        </span>
        <div class="wb-error__text">
          <p class="wb-error__title">数据加载失败</p>
          <p class="wb-error__desc">统计数据拉取异常，请稍后重试</p>
        </div>
        <a-button type="primary" ghost size="small" @click="retryStats">
          <template #icon><ReloadOutlined /></template>
          重新加载
        </a-button>
      </div>

      <div v-else-if="loading" class="wb-stats__body">
        <div v-for="n in 4" :key="`sk-${n}`" class="wb-stat wb-stat--skeleton">
          <a-skeleton active :paragraph="{ rows: 1 }" :title="false" />
        </div>
      </div>

      <div v-else class="wb-stats__body">
        <div v-for="item in statItems" :key="item.key" class="wb-stat" :class="`wb-stat--${item.tone}`">
          <span class="wb-stat__icon"><component :is="item.icon" /></span>
          <div class="wb-stat__text">
            <p class="wb-stat__value">{{ item.value }}</p>
            <p class="wb-stat__name">
              <span>{{ item.label }}</span>
              <a-tooltip
                v-if="item.tips"
                placement="top"
                :title="item.tips"
                color="#ffffff"
                :styles="{ container: TIP_BUBBLE_STYLE }"
              >
                <QuestionCircleOutlined class="wb-stat__tip" />
              </a-tooltip>
            </p>
            <p v-if="item.hint" class="wb-stat__hint">{{ item.hint }}</p>
          </div>
        </div>
      </div>
    </section>

    <!-- AREA-WB-08 用能概览（EN-08：4 项用能指标 + 趋势简图） -->
    <section v-if="canEnergyOverview" class="wb-panel wb-energy" aria-label="用能概览">
      <header class="wb-panel__head">
        <h2 class="wb-panel__title">用能概览</h2>
        <div class="wb-energy__tools">
          <span class="wb-panel__note">数据统计时间：{{ energyStatAtText }}</span>
          <a-button
            v-if="canEnergyAnalysis"
            type="link"
            size="small"
            class="wb-energy__entry"
            @click="goEnergy('analysis')"
          >
            用能分析
          </a-button>
          <a-button
            v-if="canEnergyReport"
            type="link"
            size="small"
            class="wb-energy__entry"
            @click="goEnergy('report')"
          >
            统计报表
          </a-button>
        </div>
      </header>

      <div v-if="sectionError.energy" class="wb-error">
        <span class="wb-error__icon" aria-hidden="true">
          <ExclamationCircleOutlined />
        </span>
        <p class="wb-error__title">数据加载失败</p>
        <p class="wb-error__desc">统计数据拉取异常，请稍后重试</p>
        <a-button type="primary" ghost size="small" @click="retryEnergy">
          <template #icon><ReloadOutlined /></template>
          重新加载
        </a-button>
      </div>

      <div v-else-if="energyState === 'no-stat'" class="wb-energy__state">
        <span class="wb-energy__state-tag">统计范围未确认</span>
        <p class="wb-energy__state-desc">用电统计尚未设置，当前不展示用能数值</p>
        <a-button v-if="canEnergyAnalysis" type="link" size="small" @click="goEnergy('analysis')">
          前往用能分析配置统计口径 ›
        </a-button>
      </div>

      <div v-else-if="energyState === 'no-data'" class="wb-energy__state">
        <span class="wb-energy__state-tag">暂无历史数据</span>
        <p class="wb-energy__state-desc">授权范围内暂无可用于统计的历史数据</p>
      </div>

      <div v-else class="wb-energy__body">
        <div class="wb-energy__metrics">
          <div
            v-for="item in energyMetrics"
            :key="item.key"
            class="wb-energy__metric"
            :class="`wb-energy__metric--${item.tone}`"
          >
            <span class="wb-energy__metric-icon"><component :is="item.icon" /></span>
            <div class="wb-energy__metric-text">
              <p class="wb-energy__metric-value">{{ item.value }}</p>
              <p class="wb-energy__metric-name">{{ item.label }}</p>
              <p class="wb-energy__metric-hint">{{ item.hint }}</p>
            </div>
          </div>
        </div>

        <div class="wb-energy__trend">
          <div class="wb-energy__trend-head">
            <span class="wb-energy__trend-title">近 {{ energy.trend.length }} 天用电趋势（kWh）</span>
            <span v-if="energyIncomplete" class="wb-energy__trend-flag">数据不完整</span>
            <span class="wb-energy__trend-time">统计时间：{{ energyStatAtText }}</span>
          </div>
          <svg
            class="wb-energy__spark"
            :viewBox="`0 0 ${SPARK_WIDTH} ${SPARK_HEIGHT}`"
            preserveAspectRatio="none"
            role="img"
            aria-label="近 14 天用电趋势简图"
          >
            <line
              v-for="n in 3"
              :key="`grid-${n}`"
              x1="0"
              :y1="(SPARK_HEIGHT / 4) * n"
              :x2="SPARK_WIDTH"
              :y2="(SPARK_HEIGHT / 4) * n"
              stroke="#eef2f1"
              stroke-width="1"
              vector-effect="non-scaling-stroke"
            />
            <polyline
              v-for="(segment, index) in sparkSegments"
              :key="`seg-${index}`"
              :points="segment"
              fill="none"
              stroke="#0f7b6c"
              stroke-width="2.4"
              stroke-linecap="round"
              stroke-linejoin="round"
              vector-effect="non-scaling-stroke"
            />
          </svg>
          <div class="wb-energy__spark-axis">
            <span>{{ energy.trend[0]?.label }}</span>
            <span>{{ energy.trend[energy.trend.length - 1]?.label }}</span>
          </div>
        </div>
      </div>
    </section>

    <!-- AREA-WB-05 / WB-06 最新告警 与 快捷入口（左右并排，各占一半） -->
    <div class="wb-split">
      <!-- AREA-WB-05 最新告警（左半，当日实时清单） -->
      <section v-if="canAlarm" class="wb-panel" aria-label="最新告警">
        <header class="wb-panel__head">
          <h2 class="wb-panel__title">
            最新告警
            <span v-if="!realtimeBroken" class="wb-live">
              <i class="wb-live__dot" aria-hidden="true" />
              实时
            </span>
            <span v-else class="wb-live wb-live--off">实时告警更新已中断，可点击刷新</span>
          </h2>
          <a-button type="link" size="small" @click="goAlarmCenter">查看全部</a-button>
        </header>

        <div v-if="sectionError.alarm" class="wb-error">
          <span class="wb-error__icon" aria-hidden="true">
            <ExclamationCircleOutlined />
          </span>
          <p class="wb-error__title">告警加载失败</p>
          <p class="wb-error__desc">告警数据拉取异常，请稍后重试</p>
          <a-button type="primary" ghost size="small" @click="retryAlarm">
            <template #icon><ReloadOutlined /></template>
            重新加载
          </a-button>
        </div>

        <div v-else-if="!alarmRows.length" class="wb-alarm__empty">
          <span class="wb-alarm__empty-icon" aria-hidden="true">
            <CheckCircleOutlined />
          </span>
          <p class="wb-alarm__empty-title">今日暂无告警</p>
          <p class="wb-alarm__empty-desc">设备运行正常，暂无告警记录</p>
        </div>

        <table v-else class="wb-alarm">
          <colgroup>
            <col class="wb-alarm__col-time" />
            <col class="wb-alarm__col-unit" />
            <col class="wb-alarm__col-device" />
            <col class="wb-alarm__col-type" />
            <col class="wb-alarm__col-content" />
          </colgroup>
          <thead>
            <tr>
              <th>告警时间</th>
              <th>所属用能单元</th>
              <th>所属设备</th>
              <th>事件类型</th>
              <th>告警内容</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in alarmRows" :key="row.id" :class="{ 'wb-alarm--new': row.isNew }">
              <td class="wb-alarm__time">
                <span v-if="row.isNew" class="wb-alarm__badge">新</span>
                {{ formatTime(row.reportAt) }}
              </td>
              <td class="wb-alarm__ellipsis" :title="row.unitPath || '—'">{{ row.unitText || '—' }}</td>
              <td class="wb-alarm__ellipsis" :title="`${row.meterName} / ${row.meterLicense}`">
                {{ row.meterName }} / {{ row.meterLicense }}
              </td>
              <td>
                <span class="wb-alarm__type">{{ row.eventType }}</span>
              </td>
              <td class="wb-alarm__content" :title="row.content">{{ row.content }}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <!-- AREA-WB-06 快捷入口（右半） -->
      <section v-if="entries.length" class="wb-panel" aria-label="快捷入口">
        <header class="wb-panel__head">
          <h2 class="wb-panel__title">快捷入口</h2>
        </header>
        <div class="wb-entry">
          <button
            v-for="entry in entries"
            :key="entry.route"
            type="button"
            class="wb-entry__item"
            @click="router.push(entry.route)"
          >
            <span class="wb-entry__icon"><component :is="entry.icon" /></span>
            <span class="wb-entry__label">{{ entry.label }}</span>
            <RightOutlined class="wb-entry__arrow" />
          </button>
        </div>
      </section>
    </div>

    <ProtoTip :lines="tipLines" @reset="handleReset">
      <template #extra>
        <a-space size="small">
          <a-button size="small" @click="simulatePush">模拟收到新告警推送</a-button>
          <a-button size="small" @click="simulateNoStat">
            {{ energyNoStat ? '恢复统计范围' : '模拟统计范围未确认' }}
          </a-button>
          <a-button size="small" @click="simulateFail">{{ anyError ? '恢复展示' : '模拟加载失败' }}</a-button>
        </a-space>
      </template>
    </ProtoTip>

    <!-- 右下角悬浮按钮：帮助入口（点击展开菜单，本期仅「使用手册」，后续可扩展下载客户端等其他入口） -->
    <a-float-button-group
      class="wb-fab"
      trigger="click"
      type="primary"
      shape="square"
      placement="top"
      tooltip="帮助"
      aria-label="帮助"
    >
      <template #icon><QuestionCircleOutlined /></template>
      <a-float-button
        type="primary"
        content="使用手册"
        aria-label="使用手册"
        @click="openManual"
      >
        <template #icon><ReadOutlined /></template>
      </a-float-button>
    </a-float-button-group>
  </div>
</template>

<script setup lang="ts">
/**
 * WB-PAGE-01 工作台
 * 【原型说明】对齐《产品交互设计文档-工作台》v0.6：
 * - 顶部账号信息卡展示问候语、脱敏账号、角色标签与实时时间；企业信息卡展示企业 Logo / 名称 / 注册地址；
 * - 平台使用引导为固定四步（新建组织架构 / 新建角色 / 新建成员 / 添加设备），按本企业实际数据判定完成态，
 *   四步全部完成自动隐藏，未完成时可手动关闭（当次会话）；
 * - 核心指标为单块统计面板（六项），面板头承载统计时间与刷新；
 *   「今日策略执行次数」名称旁带口径说明 Tooltip；
 * - 用能概览（EN-08）展示授权范围内的今日用电 / 本月用电 / 本月可比环比 / 数据完整率与近 14 天趋势简图，
 *   面板头提供「用能分析 / 统计报表」入口；未就绪时以状态表达，不以 0 替代；
 * - 最新告警为当日实时清单（最多 10 条、动态覆盖、推送实时插入并高亮）；
 * - 快捷入口按当前账号权限点渲染（含能源数据三个子页面）；
 * 页面只读、不提供写操作与处置动作；不做自动轮询。
 */
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import {
  AlertOutlined,
  ApartmentOutlined,
  AreaChartOutlined,
  CalendarOutlined,
  CheckCircleOutlined,
  CloseOutlined,
  CloudUploadOutlined,
  ClusterOutlined,
  DashboardOutlined,
  DeploymentUnitOutlined,
  DisconnectOutlined,
  EnvironmentOutlined,
  ExclamationCircleOutlined,
  FieldTimeOutlined,
  FileTextOutlined,
  HeatMapOutlined,
  HddOutlined,
  LineChartOutlined,
  QuestionCircleOutlined,
  ReadOutlined,
  ReloadOutlined,
  RightOutlined,
  RiseOutlined,
  SafetyCertificateOutlined,
  SettingOutlined,
  ThunderboltOutlined,
  WarningOutlined,
  WifiOutlined,
} from '@antdv-next/icons'
import { message } from 'antdv-next'
import ProtoTip from '@/shared/components/ProtoTip.vue'
import EnterpriseBadge from '@/shared/components/EnterpriseBadge.vue'
import { maskIdentifier } from '@/shared/utils/mask'
import { session } from '@/modules/auth/store'
import { resetAlarmData } from '@/modules/alarm/store'
import { currentPermissions } from '@/modules/role/store'
import { currentProfile } from '@/modules/enterprise/store'
import { hasPermission as hasEnergyPermission } from '@/modules/energy/store'
import { PERM as ENERGY_PERM } from '@/modules/energy/store/constants'
import {
  LATEST_ALARM_LIMIT,
  buildPushedAlarm,
  latestAlarms,
  onboardingSteps,
  workbenchEnergy,
  workbenchMetrics,
} from '../store'
import type { Alarm } from '@/modules/alarm/store'
import type { OnboardingStep } from '../store'

const router = useRouter()

/* ---------- 权限：工作台自身只读，各项指标 / 区块按对应模块权限点渲染 ---------- */
function has(key: string) {
  return currentPermissions().includes(key)
}

const canAlarm = computed(() => has('alarm'))
const canOnboarding = computed(() => has('system:org'))
const canOta = computed(() => has('device:ota'))
const canStrategy = computed(() => has('device:power:strategy'))

/* ---------- 能源数据权限（按菜单级权限渲染，与 AdminLayout 口径一致） ---------- */
const canEnergyMonitor = computed(() => hasEnergyPermission(ENERGY_PERM.monitor))
const canEnergyAnalysis = computed(() => hasEnergyPermission(ENERGY_PERM.analysis))
const canEnergyReport = computed(() => hasEnergyPermission(ENERGY_PERM.report))
/** 用能概览可见性：至少一个能源数据子页面权限；无权限时区块整体不展示 */
const canEnergyOverview = computed(
  () => canEnergyAnalysis.value || canEnergyMonitor.value || canEnergyReport.value,
)

/* ---------- 顶部信息区 ---------- */
const current = computed(() => session.current)
const maskedIdentifier = computed(() =>
  session.current ? maskIdentifier(session.current.identifier) : '—',
)
/** 问候语优先取联系人姓名，缺失回退脱敏账号 */
const displayName = computed(() => current.value?.contactName || maskedIdentifier.value)
/** 账号头像文字取展示名首字，与顶栏账号区口径一致 */
const userInitial = computed(() => displayName.value.slice(0, 1) || '用')
/** 角色以标签展示：当前企业下单一角色字段按顿号拆分，兼容多角色 */
const roleTags = computed(() => {
  const role = current.value?.role ?? ''
  return role
    .split(/[、,，]/)
    .map((item) => item.trim())
    .filter(Boolean)
})

/** 企业信息卡：取当前企业档案（Logo / 名称 / 注册地址），档案缺失回退会话名称 */
const profile = computed(() => {
  const found = currentProfile()
  return {
    logo: found.logo,
    name: found.name || current.value?.orgName || '',
    registeredAddress: found.registeredAddress,
  }
})

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

/* ---------- 平台使用引导 ---------- */
const steps = ref<OnboardingStep[]>(onboardingSteps())
const onboardingClosed = ref(false)
const doneCount = computed(() => steps.value.filter((step) => step.done).length)
/** 进度百分比（0~100 取整） */
const progressPercent = computed(() =>
  steps.value.length ? Math.round((doneCount.value / steps.value.length) * 100) : 0,
)
/** 引导展示条件：具备 `system:org` + 存在未完成步骤 + 未手动关闭（当次会话） */
const showOnboarding = computed(
  () => canOnboarding.value && !onboardingClosed.value && doneCount.value < steps.value.length,
)

function goStep(step: OnboardingStep) {
  if (step.done) return
  router.push(step.route)
}

function closeOnboarding() {
  onboardingClosed.value = true
}

/* ---------- 加载与统计时间 ---------- */
const loading = ref(true)
const updatedAt = ref(Date.now())
const statsError = ref(false)
const sectionError = reactive({ alarm: false, energy: false })
const realtimeBroken = ref(false)

const updatedAtText = computed(() => formatTime(updatedAt.value))

function formatTime(at: number) {
  const date = new Date(at)
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

function formatNumber(value: number) {
  return value.toLocaleString('zh-CN')
}

function formatPercent(value: number) {
  return `${Math.round(value * 10) / 10}%`
}

const metrics = ref(workbenchMetrics())

/** 六项指标：后两项按权限渲染；「今日策略执行次数」带口径 Tooltip（PRD F-WB-04） */
const STRATEGY_TIP = '统计当日 00:00 起本企业负荷策略的执行批次次数（一次触发算一批次，含时控与负控）'

/**
 * 口径 Tooltip 气泡：白底 + 深色文字 + 柔和阴影。
 * `color="#ffffff"` 负责气泡与箭头背景，`container` 补充内边距、文字色与描边阴影。
 */
const TIP_BUBBLE_STYLE = {
  maxWidth: '260px',
  padding: '8px 12px',
  color: 'rgba(0, 0, 0, 0.75)',
  lineHeight: 1.6,
  boxShadow: '0 6px 16px rgba(15, 23, 42, 0.14), 0 0 0 1px rgba(15, 123, 108, 0.12)',
}

const statItems = computed(() => {
  const list = [
    {
      key: 'deviceTotal',
      label: '设备总数',
      value: formatNumber(metrics.value.deviceTotal),
      hint: '',
      tips: '',
      icon: HddOutlined,
      tone: 'primary',
    },
    {
      key: 'deviceOnline',
      label: '在线设备数',
      value: formatNumber(metrics.value.deviceOnline),
      hint: metrics.value.onlineRate === null ? '' : `在线率 ${formatPercent(metrics.value.onlineRate)}`,
      tips: '',
      icon: WifiOutlined,
      tone: 'success',
    },
    {
      key: 'deviceOffline',
      label: '离线设备数',
      value: formatNumber(metrics.value.deviceOffline),
      hint: '',
      tips: '',
      icon: DisconnectOutlined,
      tone: 'neutral',
    },
    {
      key: 'todayAlarms',
      label: '今日告警数',
      value: formatNumber(metrics.value.todayAlarms),
      hint: '',
      tips: '',
      icon: WarningOutlined,
      tone: 'warning',
    },
  ]
  if (canOta.value) {
    list.push({
      key: 'upgradableDevices',
      label: '可升级设备数',
      value: formatNumber(metrics.value.upgradableDevices),
      hint: '',
      tips: '',
      icon: CloudUploadOutlined,
      tone: 'info',
    })
  }
  if (canStrategy.value) {
    list.push({
      key: 'todayExecutions',
      label: '今日策略执行次数',
      value: formatNumber(metrics.value.todayExecutions),
      hint: '',
      tips: STRATEGY_TIP,
      icon: FieldTimeOutlined,
      tone: 'primary',
    })
  }
  return list
})

/* ---------- 用能概览（EN-08：4 项用能指标 + 趋势简图） ---------- */
const energy = ref(workbenchEnergy())
/** 演示态：模拟「无有效用电统计设置」，用于复现 STATE-WB-13 */
const energyNoStat = ref(false)
const energyState = computed(() => (energyNoStat.value ? 'no-stat' : energy.value.state))
const energyStatAtText = computed(() => formatTime(energy.value.statAt))
const energyIncomplete = computed(() => energyState.value === 'ready' && energy.value.incomplete)

function formatKwh(value: number | null) {
  return value === null ? '—' : `${formatNumber(value)} kWh`
}

const energyMetrics = computed(() => {
  const data = energy.value
  return [
    {
      key: 'todayKwh',
      label: '今日用电',
      value: formatKwh(data.todayKwh),
      hint: '当日 00:00 起',
      icon: ThunderboltOutlined,
      tone: 'primary',
    },
    {
      key: 'monthKwh',
      label: '本月用电',
      value: formatKwh(data.monthKwh),
      hint: `本月已过 ${data.monthDays} 天`,
      icon: CalendarOutlined,
      tone: 'info',
    },
    {
      key: 'delta',
      label: '本月可比环比',
      value:
        data.deltaRate === null
          ? '—'
          : `${data.deltaRate > 0 ? '+' : ''}${data.deltaRate}%`,
      hint:
        data.deltaKwh === null
          ? '基期缺数，暂不可比'
          : `${data.deltaKwh > 0 ? '+' : ''}${formatNumber(data.deltaKwh)} kWh`,
      icon: RiseOutlined,
      tone: data.deltaRate !== null && data.deltaRate < 0 ? 'success' : 'warning',
    },
    {
      key: 'completeness',
      label: '数据完整率',
      value: data.completeness === null ? '—' : `${data.completeness}%`,
      hint: data.incomplete ? '含缺失 / 补齐点' : '有效采集点占比',
      icon: SafetyCertificateOutlined,
      tone: data.incomplete ? 'warning' : 'success',
    },
  ]
})

/** 趋势简图（近 14 天；缺失点断开，不补 0） */
const SPARK_WIDTH = 720
const SPARK_HEIGHT = 120
const sparkSegments = computed(() => {
  const points = energy.value.trend
  const values = points
    .map((point) => point.value)
    .filter((value): value is number => value !== null)
  const max = Math.max(...values, 1)
  const stepX = SPARK_WIDTH / Math.max(points.length - 1, 1)
  const segments: string[] = []
  let current: string[] = []
  points.forEach((point, index) => {
    if (point.value === null) {
      if (current.length > 1) segments.push(current.join(' '))
      current = []
      return
    }
    const x = Math.round(index * stepX)
    const y = Math.round(SPARK_HEIGHT - 10 - (point.value / max) * (SPARK_HEIGHT - 24))
    current.push(`${x},${y}`)
  })
  if (current.length > 1) segments.push(current.join(' '))
  return segments
})

/* ---------- 最新告警（当日实时清单 + 推送插入） ---------- */
interface AlarmRow extends Alarm {
  isNew: boolean
  /** 所属用能单元展示文本：去掉冗余的企业根节点前缀（企业名已在顶部企业信息卡展示） */
  unitText: string
}

const alarmRows = ref<AlarmRow[]>([])
let highlightTimers: number[] = []

/** 用能单元展示：截去路径中以企业名开头的根前缀，仅保留企业内的层级落位 */
function unitDisplay(path: string) {
  const parts = path.split(' / ')
  return parts.length > 1 ? parts.slice(1).join(' / ') : path
}

function loadAlarms() {
  alarmRows.value = latestAlarms().map((alarm) => ({
    ...alarm,
    isNew: false,
    unitText: unitDisplay(alarm.unitPath),
  }))
}

/** 收到推送：插入最新一条至顶部，动态覆盖最旧一条，短暂高亮（PRD Q-WB-03） */
let pushSeq = 0
function simulatePush() {
  const base = alarmRows.value[0] ?? latestAlarms()[0]
  if (!base) return
  const pushed: AlarmRow = { ...buildPushedAlarm(base, pushSeq), isNew: true } as AlarmRow
  pushSeq += 1
  alarmRows.value = [pushed, ...alarmRows.value].slice(0, LATEST_ALARM_LIMIT)
  const timer = window.setTimeout(() => {
    const row = alarmRows.value.find((item) => item.id === pushed.id)
    if (row) row.isNew = false
  }, 3200)
  highlightTimers.push(timer)
}

/* ---------- 快捷入口（按权限点渲染，仅导航跳转） ---------- */
const ALL_ENTRIES = [
  { perm: 'location', label: '点位地图', route: '/location', icon: HeatMapOutlined },
  { perm: 'alarm', label: '告警中心', route: '/alarm/center', icon: AlertOutlined },
  { perm: 'device:ledger', label: '设备台账', route: '/device/ledger', icon: ClusterOutlined },
  { perm: 'device:ota', label: '设备OTA', route: '/device/ota', icon: CloudUploadOutlined },
  { perm: 'device:power:strategy', label: '负荷策略', route: '/device/power/load-strategy', icon: FieldTimeOutlined },
  { perm: 'system:org', label: '组织架构', route: '/system/org-structure', icon: DeploymentUnitOutlined },
  { perm: 'system:member', label: '企业成员', route: '/system/members', icon: SettingOutlined },
  { perm: 'system:role', label: '角色管理', route: '/system/roles', icon: ApartmentOutlined },
  { perm: 'system:log', label: '系统日志', route: '/system/logs', icon: DashboardOutlined },
  { perm: 'system:enterprise', label: '企业中心', route: '/system/enterprise', icon: ApartmentOutlined },
]

/** 能源数据入口：目录级 `energy` 下按菜单级权限分别渲染 */
const ENERGY_ENTRIES = [
  { label: '用能分析', route: '/energy/analysis', icon: LineChartOutlined, visible: canEnergyAnalysis },
  { label: '设备数据分析', route: '/energy/monitor', icon: AreaChartOutlined, visible: canEnergyMonitor },
  { label: '统计报表', route: '/energy/report', icon: FileTextOutlined, visible: canEnergyReport },
]

const entries = computed(() => {
  const base = ALL_ENTRIES.filter((entry) => has(entry.perm)).map(({ route, label, icon }) => ({
    route,
    label,
    icon,
  }))
  const energyEntries = ENERGY_ENTRIES.filter((entry) => entry.visible.value).map(
    ({ route, label, icon }) => ({ route, label, icon }),
  )
  if (!energyEntries.length) return base
  // 能源数据入口紧随「告警中心」，与一级导航顺序一致
  const alarmIndex = base.findIndex((entry) => entry.route === '/alarm/center')
  const at = alarmIndex === -1 ? base.length : alarmIndex + 1
  return [...base.slice(0, at), ...energyEntries, ...base.slice(at)]
})

/* ---------- 右下角悬浮按钮（帮助入口：点击展开菜单，本期仅「使用手册」，后续可扩展其他入口） ---------- */
/** 打开《用户使用手册》：原型仅给出入口提示，不实现具体内容 */
function openManual() {
  message.info('【原型说明】此处打开《用户使用手册》，原型不实现具体内容')
}

/* ---------- 加载 / 刷新 / 重试 ---------- */
async function reload() {
  loading.value = true
  statsError.value = false
  sectionError.alarm = false
  sectionError.energy = false
  realtimeBroken.value = false
  await new Promise((resolve) => window.setTimeout(resolve, 500))
  refreshData()
  updatedAt.value = Date.now()
  loading.value = false
}

function refreshData() {
  metrics.value = workbenchMetrics()
  energy.value = workbenchEnergy()
  steps.value = onboardingSteps()
  loadAlarms()
}

function retryStats() {
  statsError.value = false
  metrics.value = workbenchMetrics()
}

function retryAlarm() {
  sectionError.alarm = false
  loadAlarms()
}

function retryEnergy() {
  sectionError.energy = false
  energy.value = workbenchEnergy()
}

/* ---------- 演示控制 ---------- */
const anyError = computed(() => statsError.value || sectionError.alarm || sectionError.energy)

function simulateFail() {
  if (anyError.value) {
    statsError.value = false
    sectionError.alarm = false
    sectionError.energy = false
    realtimeBroken.value = false
    return
  }
  statsError.value = true
  sectionError.alarm = true
  sectionError.energy = true
}

/** 模拟「无有效用电统计设置」：用于复现用能概览四态，不影响其他区块 */
function simulateNoStat() {
  energyNoStat.value = !energyNoStat.value
  message.info(energyNoStat.value ? '已模拟：统计范围未确认' : '已恢复：统计范围已设置')
}

function goAlarmCenter() {
  router.push('/alarm/center')
}

function goEnergy(target: 'monitor' | 'analysis' | 'report') {
  router.push(`/energy/${target}`)
}

function handleReset() {
  resetAlarmData()
  energyNoStat.value = false
  refreshData()
  setTimeout(() => {
    onboardingClosed.value = false
    refreshData()
    updatedAt.value = Date.now()
  }, 0)
}

const tipLines = [
  '顶部账号信息卡展示问候语、脱敏账号、角色标签与实时时间；企业信息卡展示企业 Logo / 名称 / 注册地址。',
  '平台使用引导为固定四步（新建组织架构 / 新建角色 / 新建成员 / 添加设备），按本企业实际数据判定完成态；未完成步骤可点击跳转，四步全部完成后自动隐藏，也可手动关闭。',
  '核心指标为单块统计面板（设备总数 / 在线设备数 / 离线设备数 / 今日告警数 / 可升级设备数 / 今日策略执行次数）；后两项按权限渲染，「今日策略执行次数」名称旁问号可悬浮查看口径。',
  '用能概览按当前成员授权范围展示今日用电 / 本月用电 / 本月可比环比 / 数据完整率与近 14 天趋势简图；未就绪时展示状态标签，不以 0 替代。',
  '「最新告警」只展示当日告警，最多 10 条；点击「模拟收到新告警推送」可验证实时插入顶部并动态覆盖最旧一条。',
  '同时点击「模拟统计范围未确认」可复现用能概览未设置统计口径的状态；「模拟加载失败」用于验证各区块错误态。',
  '右下角为常驻悬浮按钮，点击展开帮助菜单（本期仅「使用手册」，后续可扩展其他入口；原型仅演示入口，不做真实跳转）。',
  '页面整体手动刷新、不做自动轮询。',
]

onMounted(() => {
  reload()
  clockTimer = window.setInterval(() => {
    now.value = Date.now()
  }, 1000)
})

onBeforeUnmount(() => {
  if (clockTimer) window.clearInterval(clockTimer)
  highlightTimers.forEach((timer) => window.clearTimeout(timer))
  highlightTimers = []
})
</script>
