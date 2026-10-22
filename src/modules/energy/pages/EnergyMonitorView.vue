<template>
  <!-- 无页面权限：整页空态，不渲染范围树与查询区（STATE-MON-18 / EX-MON-15 / UI-MON-15） -->
  <div v-if="!permitted" class="energy-page">
    <div class="energy-panel">
      <div class="energy-state">
        <span class="energy-state__icon energy-state__icon--error"><DisconnectOutlined /></span>
        <p class="energy-state__title">当前账号无权限执行此操作</p>
        <p class="energy-state__desc">请联系管理员分配「设备数据分析」权限后重试</p>
        <a-button type="primary" @click="router.push('/dashboard')">返回</a-button>
      </div>
    </div>
  </div>

  <div v-else class="energy-page">
    <div class="energy-layout">
      <!-- AREA-MON-01 左侧范围树：企业 / 组织节点 / 用能单元均可选，选中节点时取其下全部用能单元的设备 -->
      <EnergyRangeTree v-model:value="selectedUnits" title="组织与用能单元" device-scope />

      <!-- AREA-MON-02 右侧主区 -->
      <div class="energy-main">
        <!-- AREA-MON-03 页签栏：设备数据分析当前仅提供历史曲线 -->
        <div class="energy-tabs" role="tablist" aria-label="设备数据分析页签">
          <button
            type="button"
            class="energy-tabs__item energy-tabs__item--active"
            role="tab"
            aria-selected="true"
          >
            历史曲线
          </button>
        </div>

        <!-- 来源弱化标识（由其他页面带入来源时渲染，无线索不渲染）CMP-MP2-22 -->
        <div v-if="fromSource" class="energy-source">
          <span>来自：{{ fromSource }}</span>
          <a-button type="link" size="small" @click="goBack">
            <template #icon><ArrowLeftOutlined /></template>
            返回来源
          </a-button>
        </div>

        <!-- 对比设备：多选、可搜索、按用能单元分组，提供全选 / 清空 -->
        <DeviceCompareSelect
          v-model="deviceIds"
          :options="deviceOptions"
          :max="DEVICE_COMPARE_LIMIT"
        />

        <!-- AREA-MON-04 查询条件区 -->
        <section class="energy-toolbar" aria-label="设备数据分析查询条件">
          <div class="energy-toolbar__item ana-field--metric">
            <label class="energy-toolbar__label">指标</label>
            <a-select
              v-model:value="metricDraft"
              class="energy-toolbar__control"
              mode="multiple"
              show-search
              option-filter-prop="label"
              :max-tag-count="2"
              :options="metricOptions"
              placeholder="请选择指标"
              @change="handleMetricChange"
            />
          </div>

          <div class="energy-toolbar__item ana-field--range">
            <label class="energy-toolbar__label">时间范围</label>
            <a-range-picker
              v-model:value="rangeDraft"
              class="energy-toolbar__control"
              :allow-clear="false"
              :presets="RANGE_PRESETS"
              :disabled-date="disabledDate"
              format="YYYY-MM-DD"
              :placeholder="['开始日期', '结束日期']"
            />
          </div>

          <div class="energy-toolbar__item ana-field--granularity">
            <label class="energy-toolbar__label">粒度</label>
            <a-segmented
              v-model:value="granularityDraft"
              class="energy-toolbar__control"
              block
              :options="GRANULARITY_OPTIONS"
            />
          </div>

          <!-- 【原型说明】仅用于演示状态覆盖，非真实功能；切换后会对当前条件重新发起查询 -->
          <div class="energy-toolbar__item energy-toolbar__item--demo">
            <label class="energy-toolbar__label">演示状态（仅原型）</label>
            <a-segmented v-model:value="demoMode" size="small" :options="DEMO_OPTIONS" />
          </div>

          <div class="energy-toolbar__actions">
            <a-button type="primary" @click="runQuery">
              <template #icon><SearchOutlined /></template>
              查询
            </a-button>
            <a-button @click="resetFilters">
              <template #icon><ReloadOutlined /></template>
              重置
            </a-button>
            <!-- 无 energy:export 时不渲染导出入口（按钮级权限） -->
            <a-button v-if="canExport" :disabled="!appliedDeviceIds.length" @click="openExport">
              <template #icon><DownloadOutlined /></template>
              数据导出
            </a-button>
          </div>
        </section>

        <!-- AREA-MON-05 曲线容器 -->
        <section class="energy-panel" aria-label="设备曲线对比">
          <div class="energy-panel__head">
            <div class="energy-curve__titles">
              <span class="energy-panel__title">设备曲线对比</span>
              <span v-if="status === 'ready'" class="energy-panel__sub">{{ readySubtitle }}</span>
            </div>
            <a-button
              v-if="status === 'ready' && appliedDeviceIds.length === 1"
              type="link"
              size="small"
              @click="goDeviceDetail"
            >
              查看设备详情
              <template #icon><RightOutlined /></template>
            </a-button>
          </div>

          <!-- STATE-MON-11 默认未查询 -->
          <div v-if="status === 'idle'" class="energy-state">
            <span class="energy-state__icon energy-state__icon--empty"><LineChartOutlined /></span>
            <p class="energy-state__title">请选择对比设备与指标后查询</p>
            <p class="energy-state__desc">在左侧选择用能单元，勾选多台设备并设置指标、时间范围与粒度后点击「查询」</p>
          </div>

          <!-- STATE-MON-12 加载中（CMP-MP2-21） -->
          <div v-else-if="status === 'loading'" class="energy-skeleton">
            <a-skeleton active :paragraph="{ rows: 6 }" />
          </div>

          <!-- STATE-MON-17 加载失败 -->
          <div v-else-if="status === 'error'" class="energy-state">
            <span class="energy-state__icon energy-state__icon--error"><DisconnectOutlined /></span>
            <p class="energy-state__title">曲线加载失败</p>
            <p class="energy-state__desc">网络异常或服务暂时不可用，请稍后重试</p>
            <a-button type="primary" size="small" @click="runQuery">
              <template #icon><ReloadOutlined /></template>
              重试
            </a-button>
          </div>

          <!-- STATE-MON-14 空数据 -->
          <div v-else-if="status === 'empty'" class="energy-state">
            <span class="energy-state__icon energy-state__icon--empty"><LineChartOutlined /></span>
            <p class="energy-state__title">暂无用能数据</p>
            <p class="energy-state__desc">当前条件下没有可分析的用能数据，试试调整设备、指标或时间</p>
          </div>

          <!-- STATE-MON-13 有数据：同一指标下多设备对比 -->
          <template v-else>
            <div class="energy-compare__summary">
              <div
                v-for="item in deviceSummaries"
                :key="item.id"
                class="energy-compare__summary-card"
              >
                <div class="energy-compare__summary-head">
                  <i class="energy-compare__summary-dot" :style="{ background: item.color }" />
                  <span class="energy-compare__summary-name" :title="item.name">{{ item.name }}</span>
                </div>
                <div
                  v-for="metric in item.metrics"
                  :key="metric.name"
                  class="energy-compare__summary-metric"
                >
                  <span class="energy-compare__summary-metric-name" :title="metric.name">
                    {{ metric.name }}<template v-if="metric.unit">（{{ metric.unit }}）</template>
                  </span>
                  <span class="energy-compare__summary-values">
                    <span>末值 <em>{{ formatValue(metric.last, metric.unit) }}</em></span>
                    <span>均值 <em>{{ formatValue(metric.average, metric.unit) }}</em></span>
                    <span>峰值 <em>{{ formatValue(metric.max, metric.unit) }}</em></span>
                  </span>
                </div>
              </div>
            </div>

            <div class="energy-compare__chart">
              <EnergyLineChart
                :series="chartSeries"
                :unit="metricUnit"
                :height="320"
                legend-position="bottom"
                :precision="metricPrecision"
                :show-quality-legend="false"
                :show-quality-marks="false"
                :show-missing-legend="false"
                show-baseline-toggle
              />
            </div>

            <div class="energy-notice energy-notice--info energy-curve__notice">
              <InfoCircleOutlined />
              <span>
                同一指标、同一粒度下按设备对比，共用同一纵轴；同一设备同色，实线 / 虚线 / 点线区分所选指标；图例可逐条隐藏 / 显示，悬浮提示可查看同一时刻各系列数值。
              </span>
            </div>
            <p class="energy-table-tip">
              统计时间：{{ rangeText }} · 按{{ granularityLabel }}汇总 · 数据为智能电表上报的原始指标快照。
            </p>
          </template>
        </section>
      </div>
    </div>

    <!-- OVERLAY-MON-01 导出任务浮层（宽 520px） -->
    <a-modal
      v-model:open="exportOpen"
      title="导出能源数据"
      :width="520"
      :mask-closable="exportPhase !== 'running'"
      :keyboard="exportPhase !== 'running'"
      :closable="exportPhase !== 'running'"
      :confirm-loading="exportPhase === 'running'"
      :ok-button-props="{ disabled: exportOverLimit || exportPhase === 'running' }"
      :cancel-button-props="{ disabled: exportPhase === 'running' }"
      :ok-text="exportOkText"
      cancel-text="取消"
      @ok="handleExportOk"
      @cancel="closeExport"
    >
      <a-descriptions :column="1" size="small" bordered class="energy-export__desc">
        <a-descriptions-item label="范围">{{ exportScopeText }}</a-descriptions-item>
        <a-descriptions-item label="指标">{{ appliedMetrics.join('、') }}<template v-if="appliedMetrics.length">（{{ metricUnitLabel }}）</template></a-descriptions-item>
        <a-descriptions-item label="时间">{{ exportTimeText }}</a-descriptions-item>
        <a-descriptions-item label="格式">CSV</a-descriptions-item>
        <a-descriptions-item label="预估行数">{{ estimateText }}</a-descriptions-item>
      </a-descriptions>

      <!-- 超限不静默截断：提示缩小时间范围或改用粒度，并禁用确定（EX-MON-12） -->
      <div v-if="exportOverLimit" class="energy-notice energy-notice--warning">
        <WarningOutlined />
        <span>预估行数超过单次上限（≤ {{ EXPORT_LIMIT_TEXT }} 行），请缩小时间范围或改用粒度。</span>
      </div>

      <p class="energy-export__tip">将导出当前条件下全部设备、全部时间点的曲线数据。</p>

      <!-- 导出任务状态：生成中 / 成功可下载 / 失败可重试 -->
      <div v-if="exportPhase === 'running'" class="energy-export__status">
        <a-spin size="small" />
        <span>正在生成导出文件，请勿关闭…</span>
      </div>
      <div v-else-if="exportPhase === 'success'" class="energy-notice energy-notice--success">
        <CheckCircleOutlined />
        <span>导出成功，文件已生成。</span>
        <a-button type="link" size="small" @click="downloadCsv">下载 CSV</a-button>
      </div>
      <div v-else-if="exportPhase === 'failed'" class="energy-notice energy-notice--error">
        <CloseCircleOutlined />
        <span>导出失败，保留当前条件，可点击「重试」。</span>
      </div>

      <!-- 【原型说明】仅用于演示失败分支，非真实功能 -->
      <a-checkbox v-model:checked="simulateExportFail" class="energy-export__demo">
        模拟导出失败（仅原型）
      </a-checkbox>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
/**
 * PAGE-MON-02 设备数据分析 · 历史曲线
 * 【原型说明】左侧用能单元范围树（单选）+ 右侧主区（对比设备多选 → 条件区 → 多设备曲线）。
 * 指标与粒度沿用设备详情「历史数据曲线」字典：81 项电表上报指标、时 / 日 / 周 / 月粒度与日期范围限制。
 * 同一指标下多台设备共用一个纵轴，按选择顺序分配颜色；不设历史明细卡片。
 * 数据全部来自能源数据 / 设备演示 store，无后端接口与数据库实现。
 */
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { message } from 'antdv-next'
import type { RangePickerProps } from 'antdv-next'
import dayjs from 'dayjs'
import type { Dayjs } from 'dayjs'
import {
  ArrowLeftOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  DisconnectOutlined,
  DownloadOutlined,
  InfoCircleOutlined,
  LineChartOutlined,
  ReloadOutlined,
  RightOutlined,
  SearchOutlined,
  WarningOutlined,
} from '@antdv-next/icons'
import EnergyLineChart from '../components/EnergyLineChart.vue'
import EnergyRangeTree from '../components/EnergyRangeTree.vue'
import DeviceCompareSelect from '../components/DeviceCompareSelect.vue'
import { hasPermission, meters, units } from '../store'
import { devices } from '@/modules/device/store'
import {
  DEVICE_COMPARE_COLORS,
  DEVICE_COMPARE_LIMIT,
  EXPORT_ROW_LIMIT,
  PERM,
} from '../store/constants'
import {
  createMetricSeries,
  formatMetricValue,
  GRANULARITY_OPTIONS,
  MAX_RANGE_DAYS,
  METRIC_GROUPS,
  METRIC_GROUP_OF,
  METRIC_INDEX,
  summarizeSeries,
  type Granularity,
} from '../../device/mock/history'

const router = useRouter()
const route = useRoute()

/* ---------- 权限渲染（页面级 + 按钮级） ---------- */
const permitted = computed(() => hasPermission(PERM.monitor))
const canExport = computed(() => hasPermission(PERM.export))

/* ---------- 来源弱化标识 ---------- */
const fromSource = computed(() => {
  const raw = route.query.from
  return typeof raw === 'string' ? raw.trim() : ''
})

function goBack() {
  router.back()
}

/* ---------- 统计范围（左侧范围树单选，包含下级单元） ---------- */
const selectedUnits = ref<string[]>([])
const selectedUnitId = computed(() => selectedUnits.value[0] ?? null)
const selectedUnitName = computed(
  () => units.find((unit) => unit.id === selectedUnitId.value)?.name ?? '—',
)

/** 收集所选用能单元及其全部下级单元标识 */
function collectUnitIds(rootId: string): string[] {
  const result = [rootId]
  let frontier = [rootId]
  while (frontier.length) {
    const children = units
      .filter((unit) => unit.parentId !== null && frontier.includes(unit.parentId))
      .map((unit) => unit.id)
    const fresh = children.filter((id) => !result.includes(id))
    result.push(...fresh)
    frontier = fresh
  }
  return result
}

const scopeUnitIds = computed(() => (selectedUnitId.value ? collectUnitIds(selectedUnitId.value) : []))

/** 设备选项：仅列出所选范围内设备，排除采集网关（网关不参与计量） */
interface DeviceCompareOption {
  value: string
  label: string
  unitName: string
  license: string
  imei: string
}

const deviceOptions = computed<DeviceCompareOption[]>(() =>
  meters
    .filter((meter) => !meter.isGateway && scopeUnitIds.value.includes(meter.unitId))
    .map((meter) => ({
      value: meter.id,
      label: meter.name,
      unitName: units.find((unit) => unit.id === meter.unitId)?.name ?? '未归属用能单元',
      license: meter.license,
      imei: meter.imei,
    })),
)

/** 对比设备（草稿）：默认不选，需用户主动选择 */
const deviceIds = ref<string[]>([])

/* ---------- 结果状态机 ---------- */
type ResultStatus = 'idle' | 'loading' | 'error' | 'empty' | 'ready'
const status = ref<ResultStatus>('idle')

/** 范围变化只清空已选设备，不自动选择；需要用户主动选择对比设备 */
watch(selectedUnitId, () => {
  deviceIds.value = []
  appliedDeviceIds.value = []
  status.value = 'idle'
})

/* ---------- 查询条件：指标（同分组多选）/ 时间范围 / 粒度（与设备详情历史曲线一致） ---------- */
const DEFAULT_METRICS = ['A 相有功功率', 'B 相有功功率', 'C 相有功功率']
const metricDraft = ref<string[]>([...DEFAULT_METRICS])
const appliedMetrics = ref<string[]>([...DEFAULT_METRICS])
const metricOptions = METRIC_GROUPS.map((group) => ({
  label: group.title,
  options: group.options.map((option) => ({ label: option.name, value: option.name })),
}))

/** 指标只允许在同一分组内多选；跨分组时保留新分组、取消原分组 */
function handleMetricChange(value: string[]) {
  metricDraft.value = scopeMetricsToSingleGroup(value, metricDraft.value)
}

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

const metricUnits = computed(() => [
  ...new Set(appliedMetrics.value.map((name) => METRIC_INDEX[name]?.unit ?? '')),
])
const metricUnit = computed(() => (metricUnits.value.length === 1 ? metricUnits.value[0] : ''))
const metricUnitLabel = computed(() =>
  metricUnits.value.length > 1 ? '混合单位' : metricUnit.value || '无量纲',
)
/** 电量类指标数值较大，纵轴保留 1 位小数；其余指标保留 2 位（与设备详情一致） */
const metricPrecision = computed(() => (/kWh|kvarh|kVAh/.test(metricUnit.value) ? 1 : 2))
const metricTitleText = computed(() => {
  if (!appliedMetrics.value.length) return '未选择指标'
  if (appliedMetrics.value.length === 1) return appliedMetrics.value[0]
  return `${appliedMetrics.value[0]} 等 ${appliedMetrics.value.length} 个指标`
})

const granularityDraft = ref<Granularity>('day')
const granularity = ref<Granularity>('day')
const GRANULARITY_LABEL: Record<Granularity, string> = {
  hour: '时',
  day: '日',
  week: '周',
  month: '月',
}
const granularityLabel = computed(() => GRANULARITY_LABEL[granularity.value])

/** 默认查询窗口：含当天在内的近 7 天（与设备详情一致） */
function defaultRange(): [Dayjs, Dayjs] {
  return [dayjs().subtract(6, 'day').startOf('day'), dayjs().endOf('day')]
}

const rangeDraft = ref<[Dayjs, Dayjs]>(defaultRange())
const range = ref<[Dayjs, Dayjs]>(defaultRange())

/** 快捷时间范围：与设备详情历史曲线一致 */
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

/** 按粒度限制可选日期范围，避免粒度越细区间越长 */
const disabledDate = (current: Dayjs) =>
  current.isAfter(dayjs().endOf('day')) ||
  current.isBefore(dayjs().subtract(MAX_RANGE_DAYS[granularityDraft.value] - 1, 'day').startOf('day'))

/** 粒度切换后收敛草稿范围，保证查询窗口不超过该粒度的上限 */
function clampRange(value: [Dayjs, Dayjs], maxDays: number): [Dayjs, Dayjs] {
  const end = value[1].isAfter(dayjs()) ? dayjs() : value[1]
  const earliest = end.subtract(maxDays - 1, 'day').startOf('day')
  return [value[0].isBefore(earliest) ? earliest : value[0], end]
}

watch(granularityDraft, (value) => {
  rangeDraft.value = clampRange(rangeDraft.value, MAX_RANGE_DAYS[value])
})

/* ---------- 演示状态（仅原型，用于复现加载中 / 空 / 错误） ---------- */
type DemoMode = 'normal' | 'loading' | 'empty' | 'error'
const demoMode = ref<DemoMode>('normal')
const DEMO_OPTIONS = [
  { label: '正常', value: 'normal' },
  { label: '加载中', value: 'loading' },
  { label: '空数据', value: 'empty' },
  { label: '错误', value: 'error' },
]

/* ---------- 已提交的查询快照 ---------- */
const appliedDeviceIds = ref<string[]>([])

function runQuery() {
  if (!deviceIds.value.length) {
    message.warning('请先选择要对比的设备')
    return
  }
  if (!metricDraft.value.length) {
    message.warning('请先选择指标')
    return
  }
  deviceIds.value = [...deviceIds.value]
  appliedDeviceIds.value = [...deviceIds.value]
  appliedMetrics.value = [...metricDraft.value]
  granularity.value = granularityDraft.value
  range.value = [rangeDraft.value[0], rangeDraft.value[1]]
  status.value = 'loading'

  // 演示「加载中」：停留在骨架屏，便于观察状态
  if (demoMode.value === 'loading') return
  window.setTimeout(() => {
    if (demoMode.value === 'error') {
      status.value = 'error'
      return
    }
    if (demoMode.value === 'empty') {
      status.value = 'empty'
      return
    }
    status.value = chartSeries.value.length ? 'ready' : 'empty'
  }, 480)
}

function resetFilters() {
  metricDraft.value = [...DEFAULT_METRICS]
  appliedMetrics.value = [...DEFAULT_METRICS]
  granularityDraft.value = 'day'
  granularity.value = 'day'
  rangeDraft.value = defaultRange()
  range.value = defaultRange()
  deviceIds.value = []
  appliedDeviceIds.value = []
  status.value = 'idle'
}

// 演示状态下即时重算，便于验证各结果状态
watch(demoMode, () => {
  if (status.value !== 'idle' && appliedDeviceIds.value.length) runQuery()
})

/* ---------- 多设备 × 多指标曲线 ---------- */
const METRIC_LINE_TYPES: Array<'solid' | 'dashed' | 'dotted'> = ['solid', 'dashed', 'dotted']
const chartSeries = computed(() => {
  const start = range.value[0].valueOf()
  const end = range.value[1].valueOf()
  const result: Array<{
    name: string
    color: string
    dash: 'solid' | 'dashed' | 'dotted'
    points: ReturnType<typeof createMetricSeries>['points']
  }> = []
  appliedDeviceIds.value.forEach((id, deviceIndex) => {
    const meter = meters.find((item) => item.id === id)
    const deviceName = meter?.name ?? id
    appliedMetrics.value.forEach((metricName, metricIndex) => {
      const series = createMetricSeries(id, metricName, start, end, granularity.value)
      result.push({
        ...series,
        name: `${deviceName} · ${metricName}`,
        color: DEVICE_COMPARE_COLORS[deviceIndex % DEVICE_COMPARE_COLORS.length],
        dash: METRIC_LINE_TYPES[metricIndex % METRIC_LINE_TYPES.length],
      })
    })
  })
  return result
})

const rangeText = computed(
  () => `${range.value[0].format('YYYY-MM-DD')} ～ ${range.value[1].format('YYYY-MM-DD')}`,
)

const readySubtitle = computed(
  () =>
    `${appliedDeviceIds.value.length} 台设备 · ${metricTitleText.value}` +
    `（${metricUnitLabel.value}） · ${rangeText.value}（${granularityLabel.value}）`,
)

interface MetricSummaryValue {
  name: string
  unit: string
  last: number | null
  average: number | null
  max: number | null
}

interface DeviceSummary {
  id: string
  name: string
  color: string
  metrics: MetricSummaryValue[]
}

/** 每台设备按所选指标分别给出末值 / 均值 / 峰值 */
const deviceSummaries = computed<DeviceSummary[]>(() =>
  appliedDeviceIds.value.map((id, deviceIndex) => {
    const meter = meters.find((item) => item.id === id)
    const metrics = appliedMetrics.value.map((metricName, metricIndex) => {
      const series = chartSeries.value[deviceIndex * appliedMetrics.value.length + metricIndex]
      const summary = summarizeSeries(series)
      return {
        name: metricName,
        unit: METRIC_INDEX[metricName]?.unit ?? '',
        last: summary.last,
        average: summary.average,
        max: summary.max,
      }
    })
    return {
      id,
      name: meter?.name ?? id,
      color: DEVICE_COMPARE_COLORS[deviceIndex % DEVICE_COMPARE_COLORS.length],
      metrics,
    }
  }),
)

function formatValue(value: number | null, unit = metricUnit.value) {
  return formatMetricValue(value, unit)
}

/* ---------- 下钻 ---------- */
function goDeviceDetail() {
  if (appliedDeviceIds.value.length !== 1) return
  const meter = meters.find((item) => item.id === appliedDeviceIds.value[0])
  // 设备台账与能源演示数据通过 IMEI 对应，避免使用能源侧内部编号导致详情页 404
  const target = meter ? devices.find((item) => item.imei === meter.imei) : undefined
  if (!target) {
    message.warning('该设备在设备台账中暂无对应档案')
    return
  }
  router.push(`/device/ledger/${target.id}`)
}

/* ---------- 导出浮层（OVERLAY-MON-01） ---------- */
type ExportPhase = 'idle' | 'running' | 'success' | 'failed'
const exportOpen = ref(false)
const exportPhase = ref<ExportPhase>('idle')
const simulateExportFail = ref(false)

const exportOkText = computed(() => {
  if (exportPhase.value === 'success') return '完成'
  if (exportPhase.value === 'failed') return '重试'
  return '开始导出'
})

/** 导出数据行数 = 设备数 × 指标数 × 当前粒度下的时间点数 */
const estimateRows = computed(() => {
  const pointCount = chartSeries.value[0]?.points.length ?? 0
  return appliedDeviceIds.value.length * appliedMetrics.value.length * pointCount
})
const exportOverLimit = computed(() => estimateRows.value > EXPORT_ROW_LIMIT)
const estimateText = computed(() => `${estimateRows.value.toLocaleString('en-US')} 行`)
const EXPORT_LIMIT_TEXT = EXPORT_ROW_LIMIT.toLocaleString('en-US')

const exportScopeText = computed(
  () =>
    `${selectedUnitName.value} · ${appliedDeviceIds.value.length} 台设备 · ${appliedMetrics.value.length} 个指标`,
)
const exportTimeText = computed(
  () => `${range.value[0].format('YYYY-MM-DD')} ～ ${range.value[1].format('YYYY-MM-DD')}（${granularityLabel.value}）`,
)

function openExport() {
  if (!appliedDeviceIds.value.length) {
    message.warning('请先查询需要导出的数据')
    return
  }
  exportPhase.value = 'idle'
  exportOpen.value = true
}

/** 【原型说明】模拟导出任务：生成中 → 成功可下载 / 失败可重试，无真实导出接口 */
function submitExport() {
  if (exportOverLimit.value || exportPhase.value === 'running') return
  exportPhase.value = 'running'
  window.setTimeout(() => {
    exportPhase.value = simulateExportFail.value ? 'failed' : 'success'
  }, 1200)
}

function handleExportOk() {
  if (exportPhase.value === 'success') {
    closeExport()
    return
  }
  submitExport()
}

function closeExport() {
  exportOpen.value = false
  exportPhase.value = 'idle'
  simulateExportFail.value = false
}

/** 按当前对比结果生成 CSV：一行 = 一台设备的一个指标在一个时间点的值 */
function downloadCsv() {
  const exportedAt = new Date().toLocaleString('zh-CN', { hour12: false })
  const header = ['范围', '设备', '指标', '单位', '采集时间', '数值', '粒度', '导出时间']
  const lines = [header]
  appliedDeviceIds.value.forEach((id, deviceIndex) => {
    const meter = meters.find((item) => item.id === id)
    const unitName = units.find((unit) => unit.id === meter?.unitId)?.name ?? ''
    appliedMetrics.value.forEach((metricName, metricIndex) => {
      const series = chartSeries.value[deviceIndex * appliedMetrics.value.length + metricIndex]
      if (!series) return
      series.points.forEach((point) => {
        lines.push([
          `${selectedUnitName.value} / ${unitName}`,
          meter?.name ?? id,
          metricName,
          METRIC_INDEX[metricName]?.unit || '无量纲',
          point.label,
          point.value === null ? '' : String(point.value),
          granularityLabel.value,
          exportedAt,
        ])
      })
    })
  })
  const csv = lines
    .map((cols) => cols.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(','))
    .join('\n')
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `设备数据分析_${range.value[0].format('YYYY-MM-DD')}_${range.value[1].format('YYYY-MM-DD')}.csv`
  link.click()
  URL.revokeObjectURL(url)
  message.success('CSV 已开始下载')
}
</script>

<style scoped>
/* 抵消布局内容区 24px 内边距，使页面内边距为最小视觉基准的 16px */
.energy-page {
  margin: -8px;
}

.ana-field--metric {
  width: 260px;
}

.ana-field--range {
  width: 280px;
}

.ana-field--granularity {
  width: 196px;
}

.ana-field--granularity :deep(.ant-segmented),
.ana-field--granularity :deep(.ant-segmented-group) {
  width: 100%;
}

.ana-field--granularity :deep(.ant-segmented-item) {
  flex: 1 1 0;
  text-align: center;
}

.energy-toolbar__control {
  width: 100%;
}

.energy-toolbar__item--demo {
  min-width: 260px;
}

.energy-curve__titles {
  display: flex;
  align-items: baseline;
  gap: 10px;
  min-width: 0;
}

/* 多设备摘要卡：每台设备一张，颜色与曲线一致 */
.energy-compare__summary {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 12px;
  margin-bottom: 16px;
}

.energy-compare__summary-card {
  min-width: 0;
  padding: 12px 14px;
  background: #fbfcfc;
  border: 1px solid #eef2f1;
  border-radius: 10px;
}

.energy-compare__summary-head {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.energy-compare__summary-dot {
  flex: none;
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.energy-compare__summary-name {
  overflow: hidden;
  font-size: 13px;
  font-weight: 600;
  color: rgba(0, 0, 0, 0.88);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.energy-compare__summary-metric {
  margin-top: 10px;
  padding-top: 8px;
  border-top: 1px dashed #eef2f1;
}

.energy-compare__summary-metric:first-of-type {
  margin-top: 8px;
  padding-top: 0;
  border-top: 0;
}

.energy-compare__summary-metric-name {
  display: block;
  overflow: hidden;
  font-size: 12px;
  font-weight: 600;
  color: rgba(0, 0, 0, 0.65);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.energy-compare__summary-values {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 12px;
  margin-top: 4px;
  font-size: 12px;
  color: rgba(0, 0, 0, 0.45);
}

.energy-compare__summary-values em {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-style: normal;
  color: rgba(0, 0, 0, 0.88);
}

.energy-compare__chart {
  min-height: 320px;
}

.energy-curve__notice {
  margin-top: 12px;
}

.energy-skeleton {
  padding: 8px 0;
}

.energy-export__desc {
  margin-bottom: 12px;
}

.energy-export__tip {
  margin: 12px 0 0;
  font-size: 12px;
  color: rgba(0, 0, 0, 0.45);
}

.energy-export__status {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 12px;
  font-size: 13px;
  color: rgba(0, 0, 0, 0.65);
}

.energy-export__demo {
  margin-top: 12px;
  font-size: 12px;
  color: rgba(0, 0, 0, 0.45);
}
</style>
