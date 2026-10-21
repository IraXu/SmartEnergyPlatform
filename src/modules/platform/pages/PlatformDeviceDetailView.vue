<template>
  <div class="page-container device-page">
    <div v-if="loading" class="device-detail__card">
      <a-skeleton active :paragraph="{ rows: 8 }" />
    </div>

    <div v-else-if="!device" class="device-detail__card">
      <div class="device-state">
        <span class="device-state__icon"><DisconnectOutlined /></span>
        <p class="device-state__title">未找到该设备</p>
        <p class="device-state__desc">该设备可能已被所属企业删除，无法查看详情</p>
        <a-button type="primary" size="small" @click="goBack">返回客户&设备</a-button>
      </div>
    </div>

    <template v-else>
      <!-- AREA-PDEV-01 顶部信息区：返回在左，所属企业 + 设备标识为主 -->
      <header class="device-detail__head">
        <div class="device-detail__head-main">
          <a-button class="device-detail__back" size="small" @click="goBack">
            <template #icon><ArrowLeftOutlined /></template>
            返回
          </a-button>
          <div class="device-detail__title-row">
            <span class="device-detail__title-group">
              <h1 class="device-detail__title" :title="device.name">{{ device.name }}</h1>
              <span v-if="device.type" class="device-cell__type">{{ device.type }}</span>
            </span>

            <span class="device-detail__title-sep" aria-hidden="true" />

            <span class="device-detail__title-group">
              <span class="device-cell__online" :class="device.onlineStatus === '在线' ? 'is-on' : 'is-off'">
                <i class="device-cell__dot" />
                {{ device.onlineStatus }}
              </span>

              <span class="device-detail__title-dot" aria-hidden="true">·</span>
              <span v-if="device.latchStatus" class="device-cell__tag" :class="device.latchStatus === '合闸' ? 'is-closed' : 'is-open'">
                {{ device.latchStatus }}
              </span>
              <span v-else class="device-detail__title-muted">闸位未上报</span>

              <template v-if="showSignal">
                <span class="device-detail__title-dot" aria-hidden="true">·</span>
                <!-- 信号强度：条形图标组按格数直观表达强弱，数值作为辅助 -->
                <span
                  v-if="device.signalStrength"
                  class="device-detail__signal"
                  :class="signalClass"
                  :title="`信号强度 ${device.signalStrength}（CSQ 0-31）· ${signalText}`"
                >
                  <span class="device-detail__signal-bars" aria-hidden="true">
                    <i v-for="level in 4" :key="level" :class="{ 'is-on': level <= signalLevel }" />
                  </span>
                  <span class="device-detail__signal-value">{{ device.signalStrength }}</span>
                </span>
                <span v-else class="device-detail__title-muted">信号未上报</span>
              </template>
            </span>
          </div>
          <p class="device-detail__path">
            <span class="platform-detail__enterprise">{{ device.enterpriseName }}</span>
            <span class="device-detail__title-dot" aria-hidden="true">·</span>
            {{ unitPath(device.unitId) }}
          </p>
        </div>
        <div class="device-detail__head-actions">
          <a-button @click="mqttOpen = true">
            <template #icon><FileSearchOutlined /></template>
            MQTT 通讯日志
          </a-button>
          <a-tag class="platform-detail__readonly">只读视图</a-tag>
        </div>
      </header>

      <!-- CARD 设备档案：只读，按语义分组 -->
      <section class="device-detail__card">
        <h2 class="device-detail__card-title">设备档案</h2>
        <div class="device-detail__archive">
          <div class="device-detail__archive-group">
            <p class="device-detail__archive-title">设备标识</p>
            <dl class="device-detail__archive-list">
              <div class="device-detail__archive-item">
                <dt>License</dt>
                <dd class="device-cell__mono">{{ device.license }}</dd>
              </div>
              <div class="device-detail__archive-item">
                <dt>IMEI</dt>
                <dd class="device-cell__mono">{{ device.imei || '—' }}</dd>
              </div>
              <div class="device-detail__archive-item">
                <dt>表号</dt>
                <dd class="device-cell__mono">{{ device.meterNo || '—' }}</dd>
              </div>
              <div class="device-detail__archive-item">
                <dt>卡号（ICCID）</dt>
                <dd class="device-cell__mono">{{ device.cardNo || '—' }}</dd>
              </div>
              <div class="device-detail__archive-item">
                <dt>规格型号</dt>
                <dd>{{ device.model || '—' }}</dd>
              </div>
            </dl>
          </div>

          <div class="device-detail__archive-group">
            <p class="device-detail__archive-title">归属与安装</p>
            <dl class="device-detail__archive-list">
              <div class="device-detail__archive-item device-detail__archive-item--wide">
                <dt>所属企业</dt>
                <dd>{{ device.enterpriseName }}</dd>
              </div>
              <div class="device-detail__archive-item device-detail__archive-item--wide">
                <dt>所属用能单元</dt>
                <dd>{{ unitPath(device.unitId) }}</dd>
              </div>
              <div class="device-detail__archive-item device-detail__archive-item--wide">
                <dt>GPS 位置</dt>
                <dd class="device-cell__mono">{{ gpsText }}</dd>
              </div>
              <div class="device-detail__archive-item device-detail__archive-item--wide">
                <dt>安装位置描述</dt>
                <dd>{{ device.installPosition || '—' }}</dd>
              </div>
              <div class="device-detail__archive-item">
                <dt>安装日期</dt>
                <dd>{{ device.installDate || '—' }}</dd>
              </div>
            </dl>
          </div>

          <div class="device-detail__archive-group device-detail__archive-group--full">
            <p class="device-detail__archive-title">备注</p>
            <p class="device-detail__archive-remark">{{ device.remark || '—' }}</p>
          </div>
        </div>
      </section>

      <!-- CARD 设备专属数据（含计量参数 CT/PT，按类型与相别分组突出数值） -->
      <section class="device-detail__card device-detail__card--primary">
        <div class="device-detail__card-head">
          <h2 class="device-detail__card-title">设备专属数据</h2>
        </div>

        <div class="device-detail__metric-group">
          <p class="device-detail__metric-title">
            <i class="device-detail__metric-bar" />
            计量参数
          </p>
          <div class="device-detail__metrics">
            <div class="device-detail__metric">
              <span class="device-detail__metric-label">CT 变比</span>
              <span class="device-detail__metric-value">
                <em>{{ device.ctRatio || '—' }}</em>
                <small v-if="device.ctRatio">倍</small>
              </span>
            </div>
            <div class="device-detail__metric">
              <span class="device-detail__metric-label">PT 变比</span>
              <span class="device-detail__metric-value">
                <em>{{ device.ptRatio || '—' }}</em>
                <small v-if="device.ptRatio">倍</small>
              </span>
            </div>
          </div>
        </div>

        <div v-if="!typeGroups.length" class="device-detail__empty">
          该设备类型的专属数据待补充
        </div>

        <template v-else>
          <div v-for="group in typeGroups" :key="group.title" class="device-detail__metric-group">
            <p class="device-detail__metric-title">
              <i class="device-detail__metric-bar" />
              {{ group.title }}
            </p>
            <div class="device-detail__metrics">
              <div v-for="field in group.fields" :key="field.name" class="device-detail__metric">
                <span class="device-detail__metric-label">{{ field.name }}</span>
                <span class="device-detail__metric-value">
                  <em>{{ device.metrics[field.name] || '—' }}</em>
                  <small v-if="field.unit">{{ field.unit }}</small>
                </span>
              </div>
            </div>
          </div>
        </template>
      </section>

      <!-- 只读用电曲线：每日用电量 / 历史数据曲线（与企业端设备详情一致） -->
      <div v-if="isMeter" class="device-detail__chart-grid">
        <section class="device-detail__card">
          <div class="device-detail__card-head">
            <h2 class="device-detail__card-title">每日用电量</h2>
            <span class="device-detail__stamp">单位 kWh</span>
          </div>
          <div class="device-detail__filter-bar">
            <a-range-picker
              v-model:value="dailyDraftRange"
              class="device-detail__filter-range"
              size="small"
              :allow-clear="false"
              :presets="RANGE_PRESETS"
              format="YYYY-MM-DD"
              :disabled-date="dailyDisabledDate"
            />
            <a-segmented v-model:value="dailyDraftGranularity" :options="GRANULARITY_OPTIONS" size="small" />
            <div class="device-detail__filter-actions">
              <a-button type="primary" size="small" @click="applyDailyQuery">查询</a-button>
              <a-button size="small" @click="resetDailyQuery">重置</a-button>
            </div>
          </div>
          <div class="device-detail__chart-summary">
            <span>区间合计 <em>{{ dailySummary.total }}</em> kWh</span>
            <span>{{ dailyAverageLabel }} <em>{{ dailySummary.average }}</em> kWh</span>
            <span>峰值 <em>{{ dailySummary.max }}</em> kWh</span>
          </div>
          <EnergyLineChart
            :series="[dailySeries]"
            unit="kWh"
            :height="220"
            :precision="1"
            :show-quality-legend="false"
            :show-baseline-toggle="true"
          />
          <p class="device-detail__chart-note">
            口径：按所选粒度统计正向有功电量增量（非累计表底）；跨清零按分段处理，缺边界读数时标记统计不完整。
          </p>
        </section>

        <section class="device-detail__card">
          <div class="device-detail__card-head">
            <h2 class="device-detail__card-title">历史数据曲线</h2>
            <span class="device-detail__stamp">
              {{
                historyMetrics.length
                  ? `${historyMetrics.length} 个指标 · ${historyUnitLabel}`
                  : '未选择指标'
              }}
            </span>
          </div>
          <div class="device-detail__filter-bar">
            <a-select
              v-model:value="historyDraftMetrics"
              class="device-detail__filter-metric"
              size="small"
              mode="multiple"
              show-search
              allow-clear
              option-filter-prop="label"
              :max-tag-count="2"
              :options="metricOptions"
              placeholder="请选择指标"
              @change="handleHistoryMetricChange"
            />
            <a-range-picker
              v-model:value="historyDraftRange"
              class="device-detail__filter-range"
              size="small"
              :allow-clear="false"
              :presets="RANGE_PRESETS"
              format="YYYY-MM-DD"
              :disabled-date="historyDisabledDate"
            />
            <a-segmented v-model:value="historyDraftGranularity" :options="GRANULARITY_OPTIONS" size="small" />
            <div class="device-detail__filter-actions">
              <a-button type="primary" size="small" @click="applyHistoryQuery">查询</a-button>
              <a-button size="small" @click="resetHistoryQuery">重置</a-button>
            </div>
          </div>
          <template v-if="historyMetrics.length">
            <div class="device-detail__chart-summary-list">
              <div
                v-for="item in historySummaries"
                :key="item.name"
                class="device-detail__chart-summary"
              >
                <span class="device-detail__chart-summary-name">
                  {{ item.name }}<template v-if="item.unit">（{{ item.unit }}）</template>
                </span>
                <span>当前值 <em>{{ item.last }}</em></span>
                <span>均值 <em>{{ item.average }}</em></span>
                <span>峰值 <em>{{ item.max }}</em></span>
              </div>
            </div>
            <EnergyLineChart
              :series="historySeries"
              :unit="historyUnit"
              :height="220"
              :precision="historyPrecision"
              :show-quality-legend="false"
              :show-baseline-toggle="true"
            />
          </template>
          <div v-else class="device-detail__chart-empty">
            <span class="device-detail__chart-empty-icon">
              <LineChartOutlined />
            </span>
            <p class="device-detail__chart-empty-title">
              {{ historyDraftMetrics.length ? '点击查询查看历史数据' : '请选择指标并点击查询' }}
            </p>
            <p class="device-detail__chart-empty-desc">
              支持功率、相电压、线电压、电流、电量、象限无功等 81 项电表上报指标
            </p>
          </div>
          <p class="device-detail__chart-note">
            数据为智能电表上报的原始指标快照；同一分组内可多选，切换分组会自动取消原分组指标。
          </p>
        </section>
      </div>

      <!-- CARD 关联负荷策略（只读概览：跨企业仅给出条数） -->
      <section class="device-detail__card">
        <div class="device-detail__card-head">
          <h2 class="device-detail__card-title">关联负荷策略</h2>
          <span class="device-detail__card-note">只读概览</span>
        </div>
        <div v-if="!hasStrategy" class="device-detail__strategy-empty">
          <DisconnectOutlined class="device-detail__strategy-empty-icon" />
          <p class="device-detail__strategy-empty-title">未关联负荷策略</p>
          <p class="device-detail__strategy-empty-desc">该设备当前未被任何负荷策略作用</p>
        </div>
        <div v-else class="device-detail__strategy-summary">
          <span v-if="device.strategyTimeCount" class="device-detail__strategy-chip is-time">时控 {{ device.strategyTimeCount }} 条</span>
          <span v-if="device.strategyLoadCount" class="device-detail__strategy-chip is-load">负控 {{ device.strategyLoadCount }} 条</span>
        </div>
      </section>

      <!-- CARD 上下线记录（只读，最近 30 天） -->
      <PlatformSessionCard :device="device" />

      <ProtoTip :lines="tipLines" />
    </template>

    <!-- MQTT 通讯日志抽屉（只读） -->
    <PlatformMqttLogDrawer v-model:open="mqttOpen" :device="device" />
  </div>
</template>

<script setup lang="ts">
/**
 * PAL-PAGE-02-D 平台设备详情（只读）
 * 【原型说明】从「客户&设备」列表点击设备名称进入，跨企业只读查看单台设备档案与专属数据。
 * 平台端为只读视图：不提供设备控制、参数配置、迁移、删除等任何写操作入口；
 * 关联负荷策略仅给出条数概览，明细维护在企业端；
 * 顶部信息区展示在线 / 拉合闸 / 信号强度，并提供 MQTT 通讯日志与上下线记录（均只读）。
 */
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import dayjs from 'dayjs'
import type { Dayjs } from 'dayjs'
import { message } from 'antdv-next'
import type { RangePickerProps } from 'antdv-next'
import {
  ArrowLeftOutlined,
  DisconnectOutlined,
  FileSearchOutlined,
  LineChartOutlined,
} from '@antdv-next/icons'
import ProtoTip from '@/shared/components/ProtoTip.vue'
import EnergyLineChart from '@/modules/energy/components/EnergyLineChart.vue'
import PlatformMqttLogDrawer from '../components/PlatformMqttLogDrawer.vue'
import PlatformSessionCard from '../components/PlatformSessionCard.vue'
import { typeGroupsOf } from '@/modules/device/store'
import {
  GRANULARITY_OPTIONS,
  MAX_RANGE_DAYS,
  METRIC_GROUPS,
  METRIC_GROUP_OF,
  METRIC_INDEX,
  createEnergySeries,
  createMetricSeries,
  formatMetricValue,
  summarizeSeries,
  type Granularity,
} from '@/modules/device/mock/history'
import { getPlatformDevice, platformUnitPath } from '@/modules/platform/store'

const route = useRoute()
const router = useRouter()

const loading = ref(true)
const mqttOpen = ref(false)
const deviceId = computed(() => String(route.params.id ?? ''))
const device = computed(() => getPlatformDevice(deviceId.value))

const unitPath = platformUnitPath

const gpsText = computed(() =>
  device.value && device.value.lng !== null && device.value.lat !== null
    ? `${device.value.lng.toFixed(6)}, ${device.value.lat.toFixed(6)}`
    : '—',
)

/** 专属数据分组：复用企业端设备类型字典的字段口径 */
const typeGroups = computed(() => (device.value ? typeGroupsOf(device.value.type) : []))

const hasStrategy = computed(() => Boolean(device.value && (device.value.strategyTimeCount || device.value.strategyLoadCount)))

/* ---------- 只读用电曲线：每日用电量 / 历史数据曲线 ---------- */
/** 仅计量表计产生用电数据；网关设备不渲染曲线卡 */
const isMeter = computed(() => Boolean(device.value?.type?.includes('电表')))
function defaultRange(): [Dayjs, Dayjs] {
  return [dayjs().subtract(6, 'day').startOf('day'), dayjs().endOf('day')]
}

const RANGE_PRESETS: RangePickerProps['presets'] = [
  { label: '今日', value: [dayjs().startOf('day'), dayjs().endOf('day')] },
  { label: '近 7 天', value: [dayjs().subtract(6, 'day').startOf('day'), dayjs().endOf('day')] },
  { label: '近 30 天', value: [dayjs().subtract(29, 'day').startOf('day'), dayjs().endOf('day')] },
  { label: '近 90 天', value: [dayjs().subtract(89, 'day').startOf('day'), dayjs().endOf('day')] },
  { label: '本月', value: [dayjs().startOf('month'), dayjs().endOf('day')] },
  {
    label: '上月',
    value: [
      dayjs().subtract(1, 'month').startOf('month'),
      dayjs().subtract(1, 'month').endOf('month'),
    ],
  },
]

const dailyGranularity = ref<Granularity>('day')
const historyGranularity = ref<Granularity>('day')
const dailyRange = ref<[Dayjs, Dayjs]>(defaultRange())
const historyRange = ref<[Dayjs, Dayjs]>(defaultRange())
const dailyDraftGranularity = ref<Granularity>('day')
const historyDraftGranularity = ref<Granularity>('day')
const dailyDraftRange = ref<[Dayjs, Dayjs]>(defaultRange())
const historyDraftRange = ref<[Dayjs, Dayjs]>(defaultRange())

function disabledDateOf(granularity: typeof dailyDraftGranularity) {
  return (current: Dayjs) =>
    current.isAfter(dayjs().endOf('day')) ||
    current.isBefore(dayjs().subtract(MAX_RANGE_DAYS[granularity.value] - 1, 'day').startOf('day'))
}
const dailyDisabledDate = disabledDateOf(dailyDraftGranularity)
const historyDisabledDate = disabledDateOf(historyDraftGranularity)

function clampRange(range: [Dayjs, Dayjs], maxDays: number): [Dayjs, Dayjs] {
  const end = range[1].isAfter(dayjs()) ? dayjs() : range[1]
  const earliest = end.subtract(maxDays - 1, 'day').startOf('day')
  return [range[0].isBefore(earliest) ? earliest : range[0], end]
}

watch(dailyDraftGranularity, (value) => {
  dailyDraftRange.value = clampRange(dailyDraftRange.value, MAX_RANGE_DAYS[value])
})
watch(historyDraftGranularity, (value) => {
  historyDraftRange.value = clampRange(historyDraftRange.value, MAX_RANGE_DAYS[value])
})

function applyDailyQuery() {
  dailyRange.value = [dailyDraftRange.value[0], dailyDraftRange.value[1]]
  dailyGranularity.value = dailyDraftGranularity.value
}

function resetDailyQuery() {
  dailyDraftRange.value = defaultRange()
  dailyDraftGranularity.value = 'day'
  dailyRange.value = defaultRange()
  dailyGranularity.value = 'day'
}

const DEFAULT_HISTORY_METRICS = ['A 相有功功率', 'B 相有功功率', 'C 相有功功率']
const historyMetrics = ref<string[]>([...DEFAULT_HISTORY_METRICS])
const historyDraftMetrics = ref<string[]>([...DEFAULT_HISTORY_METRICS])
const metricOptions = METRIC_GROUPS.map((group) => ({
  label: group.title,
  options: group.options.map((option) => ({ label: option.name, value: option.name })),
}))

/** 同一分组内可多选；选择其他分组时只保留新分组的指标 */
function scopeMetricsToSingleGroup(next: string[], previous: string[]) {
  if (next.length <= 1) return next
  const groups = new Set(next.map((name) => METRIC_GROUP_OF[name]))
  if (groups.size <= 1) return next
  const added = next.filter((name) => !previous.includes(name))
  const clicked = added[added.length - 1] ?? next[next.length - 1]
  const group = METRIC_GROUP_OF[clicked]
  message.info(`已切换指标分组，仅保留「${group}」下的指标`)
  return next.filter((name) => METRIC_GROUP_OF[name] === group)
}

function handleHistoryMetricChange(value: string[]) {
  const next = scopeMetricsToSingleGroup(value, historyDraftMetrics.value)
  historyDraftMetrics.value = next
  if (!next.length) historyMetrics.value = []
}

function applyHistoryQuery() {
  if (!historyDraftMetrics.value.length) {
    message.warning('请先选择指标')
    return
  }
  historyMetrics.value = [...historyDraftMetrics.value]
  historyRange.value = [historyDraftRange.value[0], historyDraftRange.value[1]]
  historyGranularity.value = historyDraftGranularity.value
}

function resetHistoryQuery() {
  historyDraftMetrics.value = [...DEFAULT_HISTORY_METRICS]
  historyDraftRange.value = defaultRange()
  historyDraftGranularity.value = 'day'
  historyMetrics.value = [...DEFAULT_HISTORY_METRICS]
  historyRange.value = defaultRange()
  historyGranularity.value = 'day'
}

const dailySeries = computed(() =>
  createEnergySeries(
    deviceId.value,
    dailyRange.value[0].valueOf(),
    dailyRange.value[1].valueOf(),
    dailyGranularity.value,
  ),
)

const AVERAGE_LABEL: Record<Granularity, string> = {
  hour: '时均',
  day: '日均',
  week: '周均',
  month: '月均',
}
const dailyAverageLabel = computed(() => AVERAGE_LABEL[dailyGranularity.value])
const dailySummary = computed(() => {
  const summary = summarizeSeries(dailySeries.value)
  return {
    total: formatMetricValue(summary.total, 'kWh'),
    average: formatMetricValue(summary.average, 'kWh'),
    max: formatMetricValue(summary.max, 'kWh'),
  }
})

const METRIC_COLORS = ['#0f7b6c', '#1890ff', '#faad14', '#722ed1', '#13c2c2', '#eb2f96', '#52c41a', '#ff4d4f', '#2f54eb', '#8c8c8c']
const historySeries = computed(() => {
  if (!historyMetrics.value.length) return []
  return historyMetrics.value.map((metricName, index) => {
    const series = createMetricSeries(
      deviceId.value,
      metricName,
      historyRange.value[0].valueOf(),
      historyRange.value[1].valueOf(),
      historyGranularity.value,
    )
    return { ...series, color: METRIC_COLORS[index % METRIC_COLORS.length] }
  })
})

const historyUnits = computed(() => [
  ...new Set(historyMetrics.value.map((name) => METRIC_INDEX[name]?.unit ?? '')),
])
const historyUnit = computed(() => (historyUnits.value.length === 1 ? historyUnits.value[0] : ''))
const historyUnitLabel = computed(() =>
  historyUnits.value.length > 1 ? '混合单位' : historyUnit.value ? `单位 ${historyUnit.value}` : '无量纲',
)
const historyPrecision = computed(() => (/kWh|kvarh|kVAh/.test(historyUnit.value) ? 1 : 2))
const historySummaries = computed(() =>
  historySeries.value.map((series) => {
    const summary = summarizeSeries(series)
    const unit = METRIC_INDEX[series.name]?.unit ?? ''
    return {
      name: series.name,
      unit,
      last: formatMetricValue(summary.last, unit),
      average: formatMetricValue(summary.average, unit),
      max: formatMetricValue(summary.max, unit),
    }
  }),
)

/** 仅通讯方式为 4G 的设备展示信号强度（与企业端口径一致） */
const showSignal = computed(() => device.value?.commType === '4G')

/** 信号强度区间配色：≥20 良好、10-19 一般、<10 较差（CSQ 0-31 口径） */
const signalClass = computed(() => {
  const value = Number(device.value?.signalStrength)
  if (!Number.isFinite(value)) return 'is-weak'
  if (value >= 20) return 'is-good'
  if (value >= 10) return 'is-fair'
  return 'is-weak'
})

/** 信号强弱文案，用于数值的语义补充与悬停提示 */
const signalText = computed(() => {
  const value = Number(device.value?.signalStrength)
  if (!Number.isFinite(value)) return '未知'
  if (value >= 20) return '良好'
  if (value >= 10) return '一般'
  return '较差'
})

/** 条形图标组点亮格数（共 4 格）：按 CSQ 区间映射到 1-4 格 */
const signalLevel = computed(() => {
  const value = Number(device.value?.signalStrength)
  if (!Number.isFinite(value)) return 0
  if (value >= 24) return 4
  if (value >= 20) return 3
  if (value >= 10) return 2
  return 1
})

function goBack() {
  router.push({ name: 'platform-customer' })
}

onMounted(() => {
  window.setTimeout(() => {
    loading.value = false
  }, 360)
})

const tipLines = [
  '本页为平台端设备详情的**只读视图**，从「客户&设备」列表点击设备名称进入。',
  '档案与专属数据均取自所属企业在企业端维护的设备信息；平台端不提供任何写操作入口。',
  '关联负荷策略仅给出条数概览，策略明细由企业在企业端维护与查看。',
]
</script>
