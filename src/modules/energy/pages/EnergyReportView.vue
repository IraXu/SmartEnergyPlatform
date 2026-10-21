<template>
  <!-- 页面级无权限：整页空态，不渲染条件区与列表（STATE-RPT-04） -->
  <div v-if="!canView" class="energy-page">
    <section class="energy-panel" aria-label="无访问权限">
      <div class="energy-state">
        <span class="energy-state__icon energy-state__icon--empty"><LockOutlined /></span>
        <p class="energy-state__title">当前账号无权限执行此操作</p>
        <p class="energy-state__desc">
          报表统计用于生成、预览与导出用能月报 / 年报。如需访问，请联系管理员为当前账号分配「报表统计」权限。
        </p>
        <a-button type="primary" size="small" @click="goHome">返回</a-button>
      </div>
    </section>
  </div>

  <div v-else class="energy-page">
    <!-- AREA-RPT-01 顶部条件区 -->
    <section class="energy-toolbar" aria-label="报告生成条件">
      <div class="energy-toolbar__item">
        <div class="rpt-label-row">
          <label class="energy-toolbar__label">报告周期</label>
          <a-tooltip :title="ANNUAL_HINT">
            <QuestionCircleOutlined class="rpt-label-row__icon" />
          </a-tooltip>
        </div>
        <a-select v-model:value="period" class="rpt-control" :options="periodOptions" />
      </div>

      <div class="energy-toolbar__item">
        <label class="energy-toolbar__label">统计期间</label>
        <a-date-picker
          v-model:value="periodValue"
          class="rpt-control"
          picker="month"
          format="YYYY年M月"
          :allow-clear="false"
          placeholder="选择统计期间"
          @change="handlePeriodChange"
        />
      </div>

      <div class="energy-toolbar__item">
        <label class="energy-toolbar__label">范围</label>
        <a-select
          v-model:value="rangeUnitId"
          class="rpt-control"
          show-search
          allow-clear
          placeholder="请选择范围"
          :options="rangeOptions"
        />
      </div>

      <div class="energy-toolbar__actions">
        <a-button
          v-if="canGenerate"
          type="primary"
          :loading="generatingBusy"
          :disabled="!canSubmit"
          @click="handleGenerate"
        >
          <template #icon><PlusOutlined /></template>
          生成报告
        </a-button>
      </div>
    </section>

    <!-- AREA-RPT-02 报告列表容器 -->
    <section class="energy-panel rpt-list" aria-label="报告列表">
      <div class="energy-notice energy-notice--info">
        <span>
          一行代表报告的一个版本。对同一期间、同一范围再次生成时，系统新增一行版本（版本号 +1）并保留旧版本快照，
          旧版本的报告内容与生成时间不会改变。
        </span>
      </div>

      <!-- STATE-RPT-06 生成中提示 -->
      <div v-if="generatingCount" class="energy-notice energy-notice--info">
        <span>报告生成中，完成后可在列表查看</span>
        <span class="energy-notice__extra">共 {{ generatingCount }} 个版本生成中</span>
      </div>

      <!-- STATE-RPT-01 加载中 -->
      <div v-if="loading" class="rpt-list__skeleton">
        <a-skeleton active :paragraph="{ rows: 6 }" />
      </div>

      <!-- STATE-RPT-03 暂无报告 -->
      <div v-else-if="!reports.length" class="energy-state">
        <span class="energy-state__icon energy-state__icon--empty"><FileTextOutlined /></span>
        <p class="energy-state__title">暂无报告</p>
        <p class="energy-state__desc">选择报告周期与统计期间后点击「生成报告」</p>
        <a-button
          v-if="canGenerate"
          type="primary"
          size="small"
          :disabled="!canSubmit"
          @click="handleGenerate"
        >
          <template #icon><PlusOutlined /></template>
          生成报告
        </a-button>
      </div>

      <!-- STATE-RPT-07 / 08 报告列表（一行 = 一个版本） -->
      <a-table
        v-else
        class="rpt-table"
        :columns="columns"
        :data-source="sortedReports"
        :pagination="paginationConfig"
        :scroll="{ x: 1190 }"
        row-key="id"
        @change="handleTableChange"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'name'">
            <span class="rpt-cell__name" :title="record.name">{{ record.name }}</span>
          </template>

          <template v-else-if="column.key === 'scope'">
            <span class="rpt-cell__scope" :title="scopeOf(record)">{{ scopeOf(record) }}</span>
          </template>

          <template v-else-if="column.key === 'periodText'">
            {{ record.periodText }}
          </template>

          <template v-else-if="column.key === 'version'">
            <span :class="{ 'rpt-cell__version--latest': latestVersionIds.has(record.id) }">
              v{{ record.version }}
            </span>
          </template>

          <template v-else-if="column.key === 'status'">
            <a-tag :color="statusColor(record.status)">{{ statusText(record.status) }}</a-tag>
            <a-progress
              v-if="record.status === 'generating'"
              class="rpt-progress"
              :percent="progressMap[record.id] ?? 0"
              :show-info="false"
              size="small"
            />
          </template>

          <template v-else-if="column.key === 'generatedAt'">
            <span class="rpt-cell__time">{{ record.generatedAt }}</span>
          </template>

          <template v-else-if="column.key === 'action'">
            <template v-if="record.status === 'generated'">
              <a-button type="link" size="small" @click="handlePreview(record)">预览</a-button>
              <a-button v-if="canExport" type="link" size="small" @click="handleExport">导出 PDF</a-button>
              <a-button v-if="canGenerate" type="link" size="small" @click="handleRegenerate(record)">
                重新生成
              </a-button>
            </template>
            <a-button
              v-else-if="record.status === 'failed' && canGenerate"
              type="link"
              size="small"
              @click="handleRetry(record)"
            >
              重试
            </a-button>
          </template>
        </template>
      </a-table>
    </section>
  </div>

  <!-- OVERLAY-RPT-PREVIEW 报告预览浮层：Modal 宽 960px，内容区滚动、操作区固定 -->
  <a-modal
    v-model:open="previewOpen"
    :width="960"
    :mask="{ closable: !exportingPdf }"
    :keyboard="!exportingPdf"
    :closable="!exportingPdf"
    :styles="modalStyles"
  >
    <template #title>
      <div class="rpt-modal-title">
        <span class="rpt-modal-title__name">{{ previewReport?.name }}</span>
        <span class="rpt-modal-title__ver">版本 v{{ previewReport?.version }}</span>
      </div>
    </template>

    <div v-if="previewReport" class="rpt-modal-body">
      <!-- 报告头信息：报告身份信息仅在此展示一次 -->
      <div class="energy-report-head">
        <div class="rpt-meta">
          <div class="rpt-meta__row">
            <span class="rpt-meta__label">报告名称</span>
            <span class="rpt-meta__value">{{ previewReport.name }}</span>
          </div>
          <div class="rpt-meta__row">
            <span class="rpt-meta__label">范围</span>
            <span class="rpt-meta__value">{{ rangePath }}</span>
          </div>
          <div class="rpt-meta__row">
            <span class="rpt-meta__label">统计期间</span>
            <span class="rpt-meta__value">{{ previewReport.periodText }}</span>
          </div>
          <div class="rpt-meta__row">
            <span class="rpt-meta__label">报告周期</span>
            <span class="rpt-meta__value">{{ previewReport.period === 'monthly' ? '月报' : '年报' }}</span>
          </div>
          <div class="rpt-meta__row">
            <span class="rpt-meta__label">版本</span>
            <span class="rpt-meta__value">v{{ previewReport.version }}</span>
          </div>
          <div class="rpt-meta__row">
            <span class="rpt-meta__label">生成时间</span>
            <span class="rpt-meta__value">{{ previewReport.generatedAt }}</span>
          </div>
          <div class="rpt-meta__row">
            <span class="rpt-meta__label">数据版本</span>
            <span class="rpt-meta__value">v{{ dataVersion }}</span>
          </div>
        </div>
      </div>

      <!-- 1 范围与数据完整性 -->
      <section class="energy-report-section">
        <h4 class="rpt-section__title">1 范围与数据完整性</h4>
        <div class="rpt-meta">
          <div class="rpt-meta__row">
            <span class="rpt-meta__label">数据完整率</span>
            <span class="rpt-meta__value">{{ completenessText }}</span>
          </div>
          <div class="rpt-meta__row">
            <span class="rpt-meta__label">有效天数</span>
            <span class="rpt-meta__value">{{ validDays }} / {{ totalDays }} 天</span>
          </div>
          <div class="rpt-meta__row">
            <span class="rpt-meta__label">统计口径</span>
            <span class="rpt-meta__value">{{ statConfirmed }}</span>
          </div>
        </div>
        <p class="rpt-hint">
          完整率 = 有效真实采集点数 ÷ 应采集点数（网关不计入分母）；缺失数据不按 0 计入。
        </p>
      </section>

      <!-- 2 用能概况 -->
      <section class="energy-report-section">
        <h4 class="rpt-section__title">2 用能概况</h4>
        <div class="rpt-metric-row">
          <div class="rpt-metric">
            <span class="rpt-metric__label">期间总用电</span>
            <span class="rpt-metric__value">{{ periodTotal.toLocaleString() }}<em>kWh</em></span>
          </div>
          <div class="rpt-metric">
            <span class="rpt-metric__label">日均用电</span>
            <span class="rpt-metric__value">{{ dailyAverage.toLocaleString() }}<em>kWh</em></span>
          </div>
        </div>
        <p class="rpt-hint">
          峰值时段「{{ peakItem.name }}」，谷值时段「{{ valleyItem.name }}」。
        </p>
        <EnergyBarChart :items="touScaled" unit="kWh" :height="180" />
      </section>

      <!-- 3 同比环比 -->
      <section class="energy-report-section">
        <h4 class="rpt-section__title">3 同比环比</h4>
        <div class="rpt-metric-row">
          <div class="rpt-metric">
            <span class="rpt-metric__label">本期</span>
            <span class="rpt-metric__value">{{ periodTotal.toLocaleString() }}<em>kWh</em></span>
          </div>
          <div class="rpt-metric">
            <span class="rpt-metric__label">对比期</span>
            <span class="rpt-metric__value">{{ previousTotal.toLocaleString() }}<em>kWh</em></span>
          </div>
          <div class="rpt-metric">
            <span class="rpt-metric__label">变化量</span>
            <span class="rpt-metric__value">{{ deltaText }}<em>kWh</em></span>
          </div>
          <div class="rpt-metric">
            <span class="rpt-metric__label">变化率</span>
            <span class="rpt-metric__value">{{ deltaRateText }}<em v-if="deltaRatePct !== null">%</em></span>
          </div>
        </div>
        <p class="rpt-hint">
          {{
            deltaRatePct === null
              ? '基期缺数或为 0，变化率留空并说明原因，不输出无穷大。'
              : '对比期为对齐的上一周期（相同已过时长口径）。'
          }}
        </p>
      </section>

      <!-- 4 日趋势 -->
      <section class="energy-report-section">
        <h4 class="rpt-section__title">4 日趋势</h4>
        <EnergyLineChart :series="[dailySeries]" unit="kWh" :height="260" legend-position="bottom" />
        <p class="rpt-hint">缺数显式为「缺失」，估算·展示补齐单列，不按 0 计入。</p>
      </section>

      <!-- 5 分组 / 电表排名 -->
      <section class="energy-report-section">
        <h4 class="rpt-section__title">5 分组 / 电表排名</h4>
        <div class="rpt-rank">
          <div v-for="(row, index) in focusRows" :key="row.id" class="rpt-rank__row">
            <span class="rpt-rank__no" :class="{ 'rpt-rank__no--top': index < 3 }">{{ index + 1 }}</span>
            <span class="rpt-rank__name" :title="row.name">{{ row.name }}</span>
            <span class="rpt-rank__value">{{ row.current.toLocaleString() }} kWh</span>
          </div>
        </div>
        <p class="rpt-hint">按去重口径统计；默认展示前 {{ rankTopN }} 名。</p>
      </section>

      <!-- 6 设备状态与告警摘要 -->
      <section class="energy-report-section">
        <h4 class="rpt-section__title">6 设备状态与告警摘要</h4>
        <div class="rpt-meta">
          <div class="rpt-meta__row">
            <span class="rpt-meta__label">期末在线（期末快照）</span>
            <span class="rpt-meta__value">{{ onlineSnapshot }} 台</span>
          </div>
          <div class="rpt-meta__row">
            <span class="rpt-meta__label">期末离线（期末快照）</span>
            <span class="rpt-meta__value">{{ offlineSnapshot }} 台</span>
          </div>
          <div class="rpt-meta__row">
            <span class="rpt-meta__label">期间发生过离线的设备数</span>
            <span class="rpt-meta__value">{{ offlineEverCount }} 台（按设备去重）</span>
          </div>
          <div class="rpt-meta__row">
            <span class="rpt-meta__label">告警记录数</span>
            <span class="rpt-meta__value">{{ alarmRecordCount }} 条（按期间记录数）</span>
          </div>
          <div class="rpt-meta__row">
            <span class="rpt-meta__label">有告警设备数</span>
            <span class="rpt-meta__value">{{ alarmDeviceCount }} 台（按设备去重）</span>
          </div>
          <div class="rpt-meta__row">
            <span class="rpt-meta__label">运行时长 / 正常设备数</span>
            <span class="rpt-meta__value">暂无数据依据</span>
          </div>
        </div>
        <p class="rpt-hint">
          「期末在线 / 离线」为期末快照；无运行信号与告警恢复状态时，运行时长与正常设备数标注「暂无数据依据」。
        </p>
      </section>
    </div>

    <template #footer>
      <a-button @click="closePreview">关闭</a-button>
      <a-button v-if="canExport" type="primary" :loading="exportingPdf" @click="handleExport">
        导出 PDF
      </a-button>
    </template>
  </a-modal>
</template>

<script setup lang="ts">
/**
 * PAGE-RPT-01 报表统计
 * 【原型说明】承载 EN-07 用能月报与年报（同页两周期）：
 * ①顶部条件区（报告周期 / 报告期间 / 范围 + 生成报告）；
 * ②报告列表 7 列（报告名称 / 报告周期 / 报告期间 / 版本 / 状态 / 生成时间 / 操作）；
 * ③预览为浮层 OVERLAY-RPT-PREVIEW（报告六部分 + 报告头信息）。
 * 核心规则：一行 = 一个版本；「重新生成」调用 generateReport 新增一行，旧版本内容与生成时间不变。
 * 入口按权限渲染：无 energy:report 整页无权限态；「生成 / 重新生成 / 重试」按 energy:report:generate、
 * 「导出 PDF」按 energy:report:export，无权限时不渲染（不置灰、不提示）。
 */
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { message } from 'antdv-next'
import type { TableColumnsType, TablePaginationConfig } from 'antdv-next'
import dayjs from 'dayjs'
import type { Dayjs } from 'dayjs'
import { FileTextOutlined, LockOutlined, PlusOutlined, QuestionCircleOutlined } from '@antdv-next/icons'
import EnergyBarChart from '../components/EnergyBarChart.vue'
import EnergyLineChart from '../components/EnergyLineChart.vue'
import { alarms } from '@/modules/alarm/store/storage'
import { ENERGY_DATA_VERSION, PERM, RANK_TOP_N } from '../store/constants'
import {
  dailySeries,
  generateReport,
  hasPermission,
  meterStats,
  meters,
  persistReports,
  rankRows,
  reports,
  touItems,
  units,
} from '../store'
import type { ReportPeriod, ReportStatus, ReportVersion } from '../store/types'

const router = useRouter()

/* ---------- 权限：页面级 + 按钮级 ---------- */
const canView = computed(() => hasPermission(PERM.report))
const canGenerate = computed(() => hasPermission(PERM.reportGenerate))
const canExport = computed(() => hasPermission(PERM.reportExport))

function goHome() {
  router.push('/dashboard')
}

/* ---------- 条件区 ---------- */
/** 年报开放阈值说明（hover 提示） */
const ANNUAL_HINT = '需具备不少于 13 个月的日/月汇总后方可开放'

const period = ref<ReportPeriod>('monthly')
/** 年报默认未开放：仅「年报」选项 disabled */
const periodOptions = [
  { value: 'monthly', label: '月报' },
  { value: 'annual', label: '年报', disabled: true, title: ANNUAL_HINT },
]

/** 统计期间：默认上一自然月（PRD F-RPT-02） */
const periodValue = ref<Dayjs>(dayjs().subtract(1, 'month').startOf('month'))
const periodText = ref(periodValue.value.format('YYYY年M月'))

function handlePeriodChange(value: Dayjs | null) {
  if (!value) return
  periodValue.value = value
  periodText.value = value.format('YYYY年M月')
}

/** 范围：当前成员可见的用能单元（原型取演示用能单元树），默认选中可见范围顶层节点 */
const rangeUnitId = ref<string | null>('U-ROOT')

function unitPath(id: string): string {
  const names: string[] = []
  let cursor: string | null = id
  while (cursor) {
    const node = units.find((unit) => unit.id === cursor)
    if (!node) break
    names.unshift(node.name)
    cursor = node.parentId
  }
  return names.join(' / ')
}

const rangeOptions = computed(() => units.map((unit) => ({ value: unit.id, label: unitPath(unit.id) })))
const rangePath = computed(() => (rangeUnitId.value ? unitPath(rangeUnitId.value) : '—'))

/** 列表「范围」列：优先取报告生成时的快照，缺失时回退当前条件 */
function scopeOf(record: ReportVersion) {
  return record.scope || rangePath.value
}

/** 生成报告需同时具备权限、期间与范围 */
const canSubmit = computed(() => canGenerate.value && Boolean(periodText.value) && Boolean(rangeUnitId.value))

/* ---------- 报告列表 ---------- */
const loading = ref(true)
const page = ref(1)
const pageSize = ref(20)

onMounted(() => {
  loading.value = true
  // 【原型说明】模拟列表加载耗时，无真实接口调用
  window.setTimeout(() => {
    loading.value = false
  }, 420)
})

/** 默认按生成时间倒序（最新版本在最上方），不提供页内筛选 */
const sortedReports = computed(() =>
  [...reports].sort((a, b) => b.generatedAt.localeCompare(a.generatedAt)),
)

/** 同一「周期 + 期间」下的最高版本号，用于最新版本加粗 */
const latestVersionIds = computed(() => {
  const maxByGroup = new Map<string, number>()
  reports.forEach((item) => {
    const key = `${item.period}-${item.periodText}`
    maxByGroup.set(key, Math.max(maxByGroup.get(key) ?? 0, item.version))
  })
  return new Set(
    reports
      .filter((item) => item.version === maxByGroup.get(`${item.period}-${item.periodText}`))
      .map((item) => item.id),
  )
})

const generatingCount = computed(() => reports.filter((item) => item.status === 'generating').length)

/** 生成中行内进度：随 store 的异步完成同步推进 */
const progressMap = reactive<Record<string, number>>({})
let progressTimer: number | null = null

function stopProgress() {
  if (progressTimer !== null) {
    window.clearInterval(progressTimer)
    progressTimer = null
  }
}

function syncProgress() {
  const generatingIds = reports.filter((item) => item.status === 'generating').map((item) => item.id)
  generatingIds.forEach((id) => {
    if (progressMap[id] === undefined) progressMap[id] = 0
  })
  Object.keys(progressMap).forEach((id) => {
    if (!generatingIds.includes(id)) delete progressMap[id]
  })
  if (generatingIds.length && progressTimer === null) {
    progressTimer = window.setInterval(() => {
      if (!Object.keys(progressMap).length) {
        stopProgress()
        return
      }
      Object.keys(progressMap).forEach((id) => {
        progressMap[id] = Math.min(96, progressMap[id] + 5)
      })
    }, 120)
  }
  if (!generatingIds.length) stopProgress()
}

watch(() => reports.map((item) => `${item.id}:${item.status}`).join(','), syncProgress, { immediate: true })
onUnmounted(stopProgress)

/** 列：7 列全定宽，合计 1190px（scroll.x 同值） */
const columns: TableColumnsType<ReportVersion> = [
  { title: '报告名称', key: 'name', dataIndex: 'name', width: 340, ellipsis: true },
  { title: '范围', key: 'scope', width: 200, ellipsis: true },
  { title: '统计期间', key: 'periodText', dataIndex: 'periodText', width: 120 },
  { title: '版本', key: 'version', width: 80 },
  { title: '生成时间', key: 'generatedAt', dataIndex: 'generatedAt', width: 150 },
  { title: '状态', key: 'status', width: 110 },
  { title: '操作', key: 'action', width: 190 },
]

const paginationConfig = computed<TablePaginationConfig>(() => ({
  current: page.value,
  pageSize: pageSize.value,
  size: 'small' as const,
  showSizeChanger: true,
  pageSizeOptions: ['10', '20', '50', '100'],
  showTotal: (total: number) => `共 ${total} 条`,
  hideOnSinglePage: false,
}))

function handleTableChange(pagination: TablePaginationConfig) {
  page.value = pagination.current ?? 1
  pageSize.value = pagination.pageSize ?? 20
}

function statusText(status: ReportStatus) {
  if (status === 'generating') return '生成中'
  if (status === 'failed') return '生成失败'
  return '已生成'
}

function statusColor(status: ReportStatus) {
  if (status === 'generating') return 'processing'
  if (status === 'failed') return 'error'
  return 'success'
}

/* ---------- 生成 / 重新生成 / 重试（均不二次确认） ---------- */
const generatingBusy = ref(false)

function handleGenerate() {
  if (!canSubmit.value) {
    if (!rangeUnitId.value) message.warning('请选择范围')
    else if (!periodText.value) message.warning('请选择报告期间')
    return
  }
  generatingBusy.value = true
  generateReport(period.value, periodText.value, rangePath.value)
  window.setTimeout(() => {
    generatingBusy.value = false
  }, 600)
  window.setTimeout(() => {
    message.success('报告已生成')
  }, 1800)
}

function handleRegenerate(record: ReportVersion) {
  if (!canGenerate.value) return
  const report = generateReport(record.period, record.periodText, record.scope || rangePath.value)
  window.setTimeout(() => {
    message.success(`已生成新版本 v${report.version}`)
  }, 1800)
}

/** 生成失败行「重试」：将该版本重新触发生成（不新增版本） */
function handleRetry(record: ReportVersion) {
  if (!canGenerate.value) return
  record.status = 'generating'
  record.sizeText = '—'
  persistReports()
  window.setTimeout(() => {
    record.status = 'generated'
    record.sizeText = '1.9 MB'
    persistReports()
    message.success('报告已生成')
  }, 1800)
}

/* ---------- 导出 PDF ---------- */
const exportingPdf = ref(false)

function handleExport() {
  if (!canExport.value) return
  exportingPdf.value = true
  // 【原型说明】模拟 PDF 生成耗时，无真实导出接口
  window.setTimeout(() => {
    exportingPdf.value = false
    message.success('已开始导出 PDF')
  }, 400)
}

/* ---------- OVERLAY-RPT-PREVIEW 报告预览浮层 ---------- */
const previewOpen = ref(false)
const previewId = ref<string | null>(null)
const previewReport = computed(() => reports.find((item) => item.id === previewId.value) ?? null)
/** 内容区最大高 calc(100vh - 200px)；超长时内容区滚动、操作区固定（Q-IXD-RPT-01） */
const modalStyles = { body: { maxHeight: 'calc(100vh - 200px)', overflow: 'auto' } }
const dataVersion = ENERGY_DATA_VERSION
const rankTopN = RANK_TOP_N

function handlePreview(record: ReportVersion) {
  previewId.value = record.id
  previewOpen.value = true
}

function closePreview() {
  previewOpen.value = false
}

/* ---------- 报告内容（均为 store 演示数据的只读快照口径） ---------- */
const validDays = computed(() => dailySeries.points.filter((point) => point.quality === 'valid').length)
const totalDays = computed(() => dailySeries.points.length)

const completenessText = computed(() => {
  // 与「有效天数」同源同口径：有效真实采集点数 ÷ 应采集点数
  const total = dailySeries.points.length || 1
  const valid = dailySeries.points.filter((point) => point.quality === 'valid').length
  return `${((valid / total) * 100).toFixed(1)}%`
})

const statConfirmed = computed(() => {
  const config = rangeUnitId.value ? meterStats[rangeUnitId.value] : undefined
  if (!config) return '未设置用电统计口径（仅展示所选电表读数合计）'
  return config.confirmed ? '用电统计口径已确认' : '用电统计口径未确认'
})

/** 期间总用电与「重点对象」同一口径（对象本期合计），保证报告内部数值一致 */
const periodTotal = computed(() => rankRows.value.reduce((sum, row) => sum + row.current, 0))
/** 分时构成按同一期间总量等比折算，避免与总量口径不一致 */
const touScaled = computed(() => {
  const base = touItems.reduce((sum, item) => sum + item.value, 0) || 1
  return touItems.map((item) => ({ ...item, value: Math.round((item.value / base) * periodTotal.value) }))
})
/** 日均用电：按有效天数（与完整率同口径） */
const dailyAverage = computed(() => Math.round(periodTotal.value / (validDays.value || 1)))

/** 报告内同比环比：与「本期合计」同一去重口径 */
const previousTotal = computed(() => rankRows.value.reduce((sum, row) => sum + row.previous, 0))
const deltaValue = computed(() => periodTotal.value - previousTotal.value)
const deltaRatePct = computed<number | null>(() =>
  previousTotal.value === 0 ? null : Number(((deltaValue.value / previousTotal.value) * 100).toFixed(1)),
)
const deltaText = computed(() => `${deltaValue.value > 0 ? '+' : ''}${deltaValue.value.toLocaleString('en-US')}`)
const deltaRateText = computed(() =>
  deltaRatePct.value === null ? '—' : `${deltaRatePct.value > 0 ? '+' : ''}${deltaRatePct.value.toFixed(1)}`,
)
const peakItem = computed(() =>
  touScaled.value.reduce((max, item) => (item.value > max.value ? item : max), touScaled.value[0]),
)
const valleyItem = computed(() =>
  touScaled.value.reduce((min, item) => (item.value < min.value ? item : min), touScaled.value[0]),
)

/** 期末在线 / 离线快照（按采集网关去重，演示口径） */
const onlineSnapshot = computed(() => meters.filter((meter) => !meter.isGateway).length)
const offlineSnapshot = computed(() => meters.filter((meter) => meter.isGateway).length)
/** 【原型说明】演示数据未提供期间离线事件历史，此处取演示值；正式实现按期间内离线事件去重统计 */
const offlineEverCount = 2

const focusRows = computed(() => rankRows.value.slice(0, RANK_TOP_N))

/** 告警摘要：按期间记录数与按设备去重（数据来自告警中心演示数据） */
const alarmRecordCount = computed(() => alarms.length)
const alarmDeviceCount = computed(() => new Set(alarms.map((item) => item.meterLicense)).size)

/* ---------- 条件变化时回到第 1 页 ---------- */
watch([period, rangeUnitId, periodText], () => {
  page.value = 1
})
</script>

<style scoped>
/* ---------- 条件区 ---------- */
.rpt-control {
  width: 100%;
}

.energy-toolbar__item {
  flex: 1 1 0;
}

.rpt-label-row {
  display: flex;
  align-items: center;
  gap: 4px;
}

.rpt-label-row__icon {
  font-size: 12px;
  color: rgba(0, 0, 0, 0.45);
  cursor: help;
}

/* ---------- 列表容器 ---------- */
.rpt-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
  flex: 1 1 auto;
  min-height: 320px;
}

.rpt-list__skeleton {
  padding: 8px 0;
}

.rpt-cell__name {
  display: inline-block;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: rgba(0, 0, 0, 0.88);
}

.rpt-cell__version--latest {
  font-weight: 600;
  color: #0f7b6c;
}

.rpt-cell__time {
  font-variant-numeric: tabular-nums;
  color: rgba(0, 0, 0, 0.65);
}

.rpt-progress {
  width: 90px;
  margin-top: 4px;
}

/* 表格：表头浅底、行悬停底色、单元格内边距按第 3 章视觉 token */
.rpt-table :deep(.ant-table) {
  font-size: 14px;
}

.rpt-table :deep(.ant-table-thead > tr > th) {
  padding: 11px 14px;
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;
  color: rgba(0, 0, 0, 0.65);
  background: #f7faf9;
  border-bottom: 1px solid #eaf0ef;
}

.rpt-table :deep(.ant-table-thead > tr > th::before) {
  display: none;
}

.rpt-table :deep(.ant-table-tbody > tr > td) {
  padding: 13px 14px;
  vertical-align: middle;
  border-bottom: 1px solid #f4f7f6;
}

.rpt-table :deep(.ant-table-tbody > tr:last-child > td) {
  border-bottom: none;
}

.rpt-table :deep(.ant-table-tbody > tr:hover > td) {
  background: #f8fbfa;
}

.rpt-table :deep(.ant-table-tbody > tr > td .ant-btn-variant-link) {
  padding-inline: 0;
}

.rpt-table :deep(.ant-table-pagination.ant-pagination) {
  margin: 16px 0 0;
}

/* ---------- 预览浮层 ---------- */
.rpt-modal-title {
  display: flex;
  align-items: center;
  gap: 8px;
}

.rpt-modal-title__name {
  font-size: 14px;
  color: rgba(0, 0, 0, 0.88);
}

.rpt-modal-title__ver {
  padding: 1px 6px;
  font-size: 12px;
  color: #0f7b6c;
  background: #ecf4f3;
  border-radius: 8px;
}

.rpt-modal-body {
  display: flex;
  flex-direction: column;
}

.rpt-meta {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px 24px;
  width: 100%;
}

.rpt-meta__row {
  display: flex;
  gap: 8px;
  font-size: 13px;
  line-height: 22px;
}

.rpt-meta__label {
  flex: none;
  width: 132px;
  color: rgba(0, 0, 0, 0.65);
}

.rpt-meta__value {
  flex: 1 1 auto;
  min-width: 0;
  color: rgba(0, 0, 0, 0.88);
  word-break: break-all;
}

.rpt-section__title {
  margin: 0 0 8px;
  font-size: 14px;
  font-weight: 600;
  color: rgba(0, 0, 0, 0.88);
}

.rpt-cell__scope {
  display: inline-block;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  vertical-align: bottom;
}

.rpt-hint {
  margin: 8px 0 0;
  font-size: 12px;
  line-height: 1.7;
  color: rgba(0, 0, 0, 0.45);
}

.rpt-metric-row {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
  margin-bottom: 4px;
}

.rpt-metric__label {
  font-size: 12px;
  color: rgba(0, 0, 0, 0.65);
}

.rpt-metric__value {
  display: block;
  margin-top: 4px;
  font-size: 20px;
  font-weight: 600;
  line-height: 1.2;
  color: rgba(0, 0, 0, 0.88);
}

.rpt-metric__value em {
  margin-left: 4px;
  font-size: 12px;
  font-style: normal;
  font-weight: 400;
  color: rgba(0, 0, 0, 0.45);
}

.rpt-rank {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.rpt-rank__row {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 13px;
}

.rpt-rank__no {
  flex: none;
  width: 20px;
  height: 20px;
  font-size: 12px;
  line-height: 20px;
  text-align: center;
  color: rgba(0, 0, 0, 0.65);
  background: #f4f7f6;
  border-radius: 50%;
}

.rpt-rank__no--top {
  color: #fff;
  background: #0f7b6c;
}

.rpt-rank__name {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: rgba(0, 0, 0, 0.88);
}

.rpt-rank__value {
  flex: none;
  font-weight: 600;
  color: rgba(0, 0, 0, 0.88);
}

.rpt-list-lines {
  margin: 0;
  padding-left: 18px;
  font-size: 13px;
  line-height: 1.9;
  color: rgba(0, 0, 0, 0.88);
}
</style>
