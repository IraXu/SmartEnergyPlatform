<template>
  <!-- 无权限：整页空态，不渲染左树、条件区与结果区（STATE-ANA-09 / EX-ANA-14） -->
  <div v-if="!canView" class="energy-page">
    <section class="energy-panel">
      <div class="energy-state">
        <span class="energy-state__icon energy-state__icon--error"><WarningOutlined /></span>
        <p class="energy-state__title">当前账号无权限执行此操作</p>
        <p class="energy-state__desc">用能分析需要「能源分析」权限，请联系管理员为当前账号分配。</p>
        <a-button type="primary" size="small" @click="router.push('/dashboard')">返回</a-button>
      </div>
    </section>
  </div>

  <div v-else class="energy-page">
    <div class="energy-layout">
      <!-- AREA-ANA-01 分析对象树：企业 → 组织节点 → 用能单元，类型由图标区分，默认不选中 -->
      <EnergyRangeTree v-model:value="rangeKeysDraft" :multiple="true" :show-head="false" />

      <div class="energy-main">
        <!-- 来源标识（CMP-ANA-32）：由外部页面带入条件进入时显示 -->
        <div v-if="source" class="energy-source">
          <span>来自：{{ source }}</span>
          <a-button type="link" size="small" @click="backToSource">返回来源</a-button>
        </div>

        <!-- AREA-ANA-02 顶部：分析对象 + 用电统计设置入口（随左侧树联动） -->
        <section class="ana-head" aria-label="分析对象与用电统计设置">
          <div class="ana-head__object">
            <div class="ana-head__label">分析对象</div>
            <div v-if="rangeKeysDraft.length" class="ana-head__tags">
              <a-tag
                v-for="id in rangeKeysDraft"
                :key="id"
                class="ana-head__tag"
                closable
                @close="removeScope(id)"
              >
                {{ unitName(id) }}
              </a-tag>
              <a-tag class="ana-head__kind">{{ selectedKindLabel }}</a-tag>
            </div>
            <div v-else class="ana-head__empty">未选择对象，请在左侧树中选择企业、组织节点或用能单元</div>
            <div class="ana-head__meta">{{ headMeta }}</div>
          </div>

          <!-- 用电统计设置：仅作引导入口，不展示是否已设置总表 -->
          <button type="button" class="ana-head__stat" @click="openStatDrawer">
            <span class="ana-head__stat-icon"><SettingOutlined /></span>
            <span class="ana-head__stat-body">
              <span class="ana-head__stat-title">用电统计设置</span>
              <span class="ana-head__stat-meta">
                如需按进线总表统计，可在此设置；否则默认汇总该用能单元下全部独立电表。组织节点按其下属用能单元汇总。
              </span>
            </span>
            <span class="ana-head__stat-action">
              去设置
              <RightOutlined />
            </span>
          </button>
        </section>

        <!-- AREA-ANA-02 条件区：按「统计指标 → 对比方式 → 时间范围 → 时间粒度」的查询流程排列 -->
        <section class="energy-toolbar" aria-label="用能分析条件">
          <div class="energy-toolbar__item ana-field--metric">
            <label class="energy-toolbar__label">统计指标</label>
            <a-select v-model:value="metricDraft" class="ana-field__control" :options="metricOptions" />
          </div>

          <!-- 对比方式仅对「用电量」有效；分时分析不做对比 -->
          <div v-if="metricDraft === 'electricity'" class="energy-toolbar__item ana-field--compare">
            <label class="energy-toolbar__label">对比方式</label>
            <a-segmented
              v-model:value="compareModeDraft"
              class="ana-field__control"
              :options="compareModeOptions"
            />
          </div>

          <div class="energy-toolbar__item ana-field--range">
            <label class="energy-toolbar__label">时间范围</label>
            <a-range-picker
              v-model:value="rangeValue"
              class="ana-field__control"
              :allow-clear="false"
              :format="'YYYY-MM-DD'"
              :presets="rangePresets"
            />
          </div>

          <div class="energy-toolbar__item ana-field--granularity">
            <label class="energy-toolbar__label">
              时间粒度
              <a-tooltip :title="granularityHint">
                <InfoCircleOutlined class="ana-label__hint" />
              </a-tooltip>
            </label>
            <a-segmented
              v-model:value="granularityDraft"
              class="ana-field__control"
              :options="granularityOptions"
            />
          </div>

          <div class="energy-toolbar__actions">
            <a-button type="primary" :loading="loading" :disabled="!rangeKeysDraft.length" @click="runQuery">
              <template #icon><SearchOutlined /></template>
              查询
            </a-button>
            <a-button @click="resetAll">
              <template #icon><ReloadOutlined /></template>
              重置
            </a-button>
            <a-button
              v-if="canExport"
              :loading="exporting"
              :disabled="!hasQueried || queryDirty || !rangeKeys.length"
              @click="handleExport"
            >
              <template #icon><DownloadOutlined /></template>
              导出
            </a-button>
          </div>
        </section>

        <!-- 未选择分析对象：默认进入即此状态，不发起查询 -->
        <section v-if="!rangeKeysDraft.length" class="energy-panel">
          <div class="energy-state">
            <span class="energy-state__icon energy-state__icon--empty"><ApartmentOutlined /></span>
            <p class="energy-state__title">请选择分析对象</p>
            <p class="energy-state__desc">在左侧树中选择企业、组织节点或用能单元</p>
          </div>
        </section>

        <!-- 已选择对象但尚未查询：不自动取数，等待用户点「查询」 -->
        <section v-else-if="!hasQueried" class="energy-panel">
          <div class="energy-state">
            <span class="energy-state__icon energy-state__icon--empty"><SearchOutlined /></span>
            <p class="energy-state__title">已选择分析对象</p>
            <p class="energy-state__desc">确认统计指标、时间范围与时间粒度后，点击「查询」查看分析结果</p>
          </div>
        </section>

        <!-- 条件已变更但未重新查询：保留上次查询口径，不自动刷新 -->
        <section v-else-if="queryDirty" class="energy-panel">
          <div class="energy-state">
            <span class="energy-state__icon energy-state__icon--empty"><ReloadOutlined /></span>
            <p class="energy-state__title">分析条件已变更</p>
            <p class="energy-state__desc">点击「查询」按当前条件刷新结果</p>
          </div>
        </section>

        <!-- 加载中：结果区骨架屏，条件区与左树保持可用 -->
        <section v-else-if="loading" class="energy-panel ana-loading">
          <a-skeleton active :paragraph="{ rows: 6 }" />
        </section>

        <!-- 结果区：正常有数据 -->
        <template v-else-if="demoState === 'idle'">
          <!-- AREA-ANA-03 指标区（卡片随统计指标 / 对比方式变化） -->
          <div v-if="!(metric === 'tou' && touUnsupported)" class="energy-metrics">
            <div v-for="item in metrics" :key="item.label" class="energy-metric">
              <div class="energy-metric__label">{{ item.label }}</div>
              <div class="energy-metric__value" :class="{ 'ana-metric__value--sm': item.compact }">
                {{ item.value }}<span v-if="item.unit" class="energy-metric__unit">{{ item.unit }}</span>
              </div>
              <div v-if="item.hint" class="ana-metric__hint">{{ item.hint }}</div>
            </div>
          </div>

          <!-- AREA-ANA-04 图表区 -->
          <section class="energy-panel">
            <div class="energy-panel__head">
              <span class="energy-panel__title">{{ chartTitle }}</span>
              <span class="ana-chart__tools">
                <span v-if="metric === 'tou'" class="ana-chart-source">
                  <InfoCircleOutlined />
                  <a-tooltip title="按时间段计算（时段规则版本 v2026.09）">计算来源：分时寄存器 / 按时段规则</a-tooltip>
                </span>
                <a-button
                  v-if="canDownloadChart"
                  type="text"
                  size="small"
                  class="ana-chart__download"
                  @click="downloadChart"
                >
                  <template #icon><DownloadOutlined /></template>
                  下载图片
                </a-button>
              </span>
            </div>
            <div class="ana-chart-box">
              <!-- 分时分析：按所选时间范围与粒度展示尖峰平谷堆叠构成 -->
              <template v-if="metric === 'tou'">
                <!-- STATE-ANA-08 分时数据未就绪：展示未支持状态，不展示伪分时图 -->
                <div v-if="touUnsupported" class="energy-state">
                  <span class="energy-state__icon energy-state__icon--warning"><WarningOutlined /></span>
                  <p class="energy-state__title">当前数据不支持分时分析</p>
                  <p class="energy-state__desc">
                    缺少分时电量历史或时段规则未生效，暂不展示分时构成；可切换统计指标或联系管理员确认计量能力。
                  </p>
                </div>
                <EnergyTouChart
                  v-else
                  ref="touChartRef"
                  :labels="bucketLabels"
                  :series="touSeries"
                  unit="kWh"
                  :height="240"
                />
              </template>

              <!-- 用电量 · 对象对比：按所选时间粒度的多序列折线 -->
              <template v-else-if="compareMode === 'object'">
                <EnergyLineChart
                  v-if="rangeKeys.length >= 2"
                  ref="lineChartRef"
                  :series="compareSeries"
                  unit="kWh"
                  :height="260"
                  legend-position="bottom"
                  show-missing-legend
                  :show-quality-legend="false"
                  :show-quality-marks="false"
                />
                <div v-else class="energy-notice energy-notice--info">
                  <InfoCircleOutlined />
                  <span>在左侧树中再选择至少 1 个同类型对象，即可查看按{{ granularityLabel }}聚合的对象对比折线。</span>
                </div>
              </template>

              <!-- 用电量 · 趋势 / 同比 / 环比 -->
              <EnergyLineChart
                v-else
                ref="lineChartRef"
                :series="lineSeries"
                unit="kWh"
                :height="260"
                legend-position="bottom"
                show-missing-legend
                :show-quality-legend="false"
                :show-quality-marks="false"
              />
            </div>
            <p class="energy-table-tip">统计时间：{{ statTime }}</p>
            <p v-if="hasMissing" class="energy-table-tip ana-missing-tip">
              <WarningOutlined />
              所选区间存在缺失数据：缺失时段以断点 / 空白展示，不计入统计。
            </p>
          </section>

          <!-- AREA-ANA-05 排名区：仅用电量指标展示，排名范围=当前所选对象 -->
          <section v-if="metric === 'electricity'" class="energy-panel">
            <div class="energy-panel__head">
              <div class="ana-rank__head">
                <span class="energy-panel__title">用能排名</span>
                <span class="energy-panel__sub">
                  本期指所选时间范围；仅统计当前所选对象，点击行首图标展开设备明细
                </span>
              </div>
              <a-button
                v-if="selectedRanks.length > RANK_TOP_N"
                type="link"
                @click="drawerOpen = true"
              >
                查看全部
              </a-button>
            </div>
            <a-table
              class="ana-rank"
              :columns="rankColumns"
              :data-source="topRanks"
              :pagination="false"
              :expandable="rankExpandable"
              row-key="id"
              size="small"
            >
              <template #bodyCell="{ column, record }">
                <template v-if="column.key === 'rank'">{{ rankOf(record) }}</template>
                <template v-else-if="column.key === 'name'">
                  <span class="ana-cell__name">{{ record.name }}</span>
                  <a-tag v-if="showCompareColumns && record.deltaRate === null" class="ana-cell__tag">基期不可比</a-tag>
                </template>
                <template v-else-if="column.key === 'current'">
                  <span class="ana-num">{{ fmt(record.current) }}</span>
                </template>
                <template v-else-if="column.key === 'previous'">
                  <span class="ana-num">{{ fmt(record.previous) }}</span>
                </template>
                <template v-else-if="column.key === 'delta'">
                  <span class="ana-num" :class="record.delta > 0 ? 'ana-delta--up' : 'ana-delta--down'">
                    {{ record.delta > 0 ? '+' : '' }}{{ fmt(record.delta) }}
                  </span>
                </template>
                <template v-else-if="column.key === 'deltaRate'">
                  <a-tooltip v-if="record.deltaRate === null" title="基期不可比">
                    <span class="ana-num">—</span>
                  </a-tooltip>
                  <span v-else class="ana-num" :class="record.delta > 0 ? 'ana-delta--up' : 'ana-delta--down'">
                    {{ record.deltaRate > 0 ? '+' : '' }}{{ record.deltaRate.toFixed(1) }}%
                  </span>
                </template>
                <template v-else-if="column.key === 'ratio'">
                  <span class="ana-num">{{ ratioOf(record) }}%</span>
                </template>
              </template>
              <template #expandedRowRender="{ record }">
                <RankDrillPanel :record="record" />
              </template>
            </a-table>
          </section>
        </template>

        <!-- 结果区：空数据 / 查询无结果 / 统计范围未确认 / 加载失败 -->
        <section v-else class="energy-panel">
          <div class="energy-state">
            <span class="energy-state__icon" :class="stateIconClass">
              <DisconnectOutlined v-if="demoState === 'failed'" />
              <InboxOutlined v-else-if="demoState === 'empty'" />
              <SearchOutlined v-else-if="demoState === 'noresult'" />
              <WarningOutlined v-else />
            </span>
            <p class="energy-state__title">{{ stateTitle }}</p>
            <p class="energy-state__desc">{{ stateDesc }}</p>
            <a-button v-if="demoState === 'noresult'" type="primary" size="small" @click="resetAll">重置条件</a-button>
            <a-button v-else-if="demoState === 'failed'" type="primary" size="small" @click="runQuery">
              <template #icon><ReloadOutlined /></template>
              重新加载
            </a-button>
          </div>
        </section>
      </div>
    </div>

    <!-- OVERLAY-ANA-02 排名明细浮层：所选对象的完整排名 -->
    <a-drawer v-model:open="drawerOpen" title="用能排名（所选对象）" placement="right" :size="720">
      <p class="ana-drawer__desc">
        范围：{{ scopeText }} · 期间：{{ periodText }} · 口径：用电量（首期正向有功）
      </p>
      <a-table
        :columns="rankColumns"
        :data-source="selectedRanks"
        :pagination="drawerPagination"
        :expandable="rankExpandable"
        row-key="id"
        size="small"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'rank'">{{ rankOf(record) }}</template>
          <template v-else-if="column.key === 'name'">{{ record.name }}</template>
          <template v-else-if="column.key === 'current'"><span class="ana-num">{{ fmt(record.current) }}</span></template>
          <template v-else-if="column.key === 'previous'"><span class="ana-num">{{ fmt(record.previous) }}</span></template>
          <template v-else-if="column.key === 'delta'">
            <span class="ana-num" :class="record.delta > 0 ? 'ana-delta--up' : 'ana-delta--down'">
              {{ record.delta > 0 ? '+' : '' }}{{ fmt(record.delta) }}
            </span>
          </template>
          <template v-else-if="column.key === 'deltaRate'">
            <span v-if="record.deltaRate === null" class="ana-num">—</span>
            <span v-else class="ana-num">{{ record.deltaRate > 0 ? '+' : '' }}{{ record.deltaRate.toFixed(1) }}%</span>
          </template>
          <template v-else-if="column.key === 'ratio'"><span class="ana-num">{{ ratioOf(record) }}%</span></template>
        </template>
        <template #expandedRowRender="{ record }">
          <RankDrillPanel :record="record" />
        </template>
      </a-table>
    </a-drawer>

    <!-- OVERLAY-ANA-01 用电统计设置抽屉：查看 / 编辑所选对象的进线总表口径 -->
    <MeterStatDrawer
      v-model:open="statDrawerOpen"
      :unit-ids="statDrawerUnits"
      :unit-id="statDrawerUnitId"
      @saved="handleStatSaved"
    />

    <ProtoTip :lines="tipLines" @reset="handleResetData">
      <template #extra>
        <a-button size="small" @click="toggleDemo('empty')">模拟无数据</a-button>
        <a-button size="small" @click="toggleDemo('noresult')">模拟查询无结果</a-button>
        <a-button size="small" @click="toggleDemo('unconfirmed')">模拟统计范围未确认</a-button>
        <a-button size="small" @click="simulateTouUnsupported">模拟分时未支持</a-button>
        <a-button size="small" @click="toggleDemo('failed')">模拟加载失败</a-button>
      </template>
    </ProtoTip>
  </div>
</template>

<script setup lang="ts">
/**
 * PAGE-ANA-01 用能分析
 * 【原型说明】左树（分析对象多选）+ 右侧（分析对象与用电统计设置入口 → 条件区 → 指标卡 → 图表 → 排名）。
 * 统计指标为「用电量 / 分时分析」；用电量下可选对比方式（不对比 / 同比 / 环比 / 对象对比）。
 * 复用同一套对象与时间条件；提交式查询（条件改动后点「查询」生效）。
 * 数据全部来自能源数据演示 store；不含数据库、接口与图表库依赖。
 */
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { message } from 'antdv-next'
import type { RangePickerProps, TableColumnsType, TablePaginationConfig } from 'antdv-next'
import dayjs from 'dayjs'
import type { Dayjs } from 'dayjs'
import {
  ApartmentOutlined,
  DisconnectOutlined,
  DownloadOutlined,
  InfoCircleOutlined,
  InboxOutlined,
  ReloadOutlined,
  RightOutlined,
  SearchOutlined,
  SettingOutlined,
  WarningOutlined,
} from '@antdv-next/icons'
import ProtoTip from '@/shared/components/ProtoTip.vue'
import EnergyRangeTree from '../components/EnergyRangeTree.vue'
import EnergyLineChart from '../components/EnergyLineChart.vue'
import EnergyTouChart from '../components/EnergyTouChart.vue'
import MeterStatDrawer from '../components/MeterStatDrawer.vue'
import RankDrillPanel from '../components/RankDrillPanel.vue'
import {
  dailySeries,
  hasPermission,
  rankRows,
  resetEnergyData,
  touItems,
  units,
} from '../store'
import type { RankRow, Series } from '../store/types'
import { PERM, RANK_TOP_N } from '../store/constants'

/* ---------- 权限：无 energy:analysis 时整页空态；导出按 energy:export 渲染 ---------- */
const canView = computed(() => hasPermission(PERM.analysis))
const canExport = computed(() => hasPermission(PERM.export))

const router = useRouter()
const route = useRoute()
/** 来源标识：由外部页面带入条件进入时显示「来自：{来源页面}」 */
const source = computed(() => {
  const value = route.query.from
  return typeof value === 'string' && value ? value : ''
})

/* ---------- 条件区 ---------- */
type Metric = 'electricity' | 'tou'
type CompareMode = 'none' | 'yoy' | 'mom' | 'object'
type Granularity = 'day' | 'week' | 'month' | 'year'
type DemoState = 'idle' | 'empty' | 'noresult' | 'unconfirmed' | 'failed'

/** 已提交查询条件：结果区只按这份快照计算，条件改动不自动刷新 */
const metric = ref<Metric>('electricity')
const compareMode = ref<CompareMode>('none')
const granularity = ref<Granularity>('day')
/** 已提交的分析对象（左树多选）：一次查询对应一份对象快照 */
const rangeKeys = ref<string[]>([])

/** 编辑中的条件：控件绑定这份草稿，点击「查询」后才写入已提交条件 */
const metricDraft = ref<Metric>('electricity')
const compareModeDraft = ref<CompareMode>('none')
const granularityDraft = ref<Granularity>('day')
const rangeKeysDraft = ref<string[]>([])
/** 是否至少完成过一次查询（用于区分「已选对象未查询」） */
const hasQueried = ref(false)

/** 当前草稿是否与已提交条件不同 */
const queryDirty = computed(() => {
  if (!hasQueried.value) return true
  return JSON.stringify({
    keys: rangeKeysDraft.value,
    metric: metricDraft.value,
    compareMode: compareModeDraft.value,
    granularity: granularityDraft.value,
    range: rangeRangeDraft.value,
  }) !== JSON.stringify({
    keys: rangeKeys.value,
    metric: metric.value,
    compareMode: compareMode.value,
    granularity: granularity.value,
    range: rangeRange.value,
  })
})

const metricOptions = [
  { label: '用电量', value: 'electricity' as Metric },
  { label: '分时分析', value: 'tou' as Metric },
]
const compareModeOptions = [
  { label: '不对比', value: 'none' as CompareMode },
  { label: '同比', value: 'yoy' as CompareMode },
  { label: '环比', value: 'mom' as CompareMode },
  { label: '对象对比', value: 'object' as CompareMode },
]

/** 时间范围（字符串粒度维护，回显时转成日期组件值；不引入额外依赖） */
function defaultRange(): [string, string] {
  const now = dayjs()
  return [now.startOf('month').format('YYYY-MM-DD'), now.format('YYYY-MM-DD')]
}
const rangeRange = ref<[string, string]>(defaultRange())
/** 编辑中的时间范围；点击「查询」后才同步到 rangeRange */
const rangeRangeDraft = ref<[string, string]>(defaultRange())
const rangeValue = computed({
  get: (): [Dayjs, Dayjs] => [dayjs(rangeRangeDraft.value[0]), dayjs(rangeRangeDraft.value[1])],
  set: (value: [Dayjs, Dayjs] | null) => {
    if (!value?.[0] || !value?.[1]) return
    rangeRangeDraft.value = [value[0].format('YYYY-MM-DD'), value[1].format('YYYY-MM-DD')]
  },
})
const rangePresets: RangePickerProps['presets'] = [
  { label: '本月', value: [dayjs().startOf('month'), dayjs()] },
  { label: '近 7 天', value: [dayjs().add(-6, 'day'), dayjs()] },
  { label: '近 30 天', value: [dayjs().add(-29, 'day'), dayjs()] },
]

/** 当前查询天数（已提交口径）：用于日均值等结果计算 */
const rangeDays = computed(
  () => dayjs(rangeRange.value[1]).diff(dayjs(rangeRange.value[0]), 'day') + 1,
)

/** 编辑中的范围天数：用于粒度选项联动，不参与结果计算 */
const rangeDaysDraft = computed(
  () => dayjs(rangeRangeDraft.value[1]).diff(dayjs(rangeRangeDraft.value[0]), 'day') + 1,
)

/** 粒度选项按范围自动禁用过细粒度；范围变长时自动升档，避免出现无效组合 */
const granularityOptions = computed(() => [
  { label: '日', value: 'day' as Granularity, disabled: rangeDaysDraft.value > 366 },
  { label: '周', value: 'week' as Granularity, disabled: rangeDaysDraft.value > 1095 },
  { label: '月', value: 'month' as Granularity },
  { label: '年', value: 'year' as Granularity },
])

const granularityHint = computed(() => {
  if (rangeDaysDraft.value > 366) return `当前范围 ${rangeDaysDraft.value} 天，建议使用周 / 月粒度`
  if (rangeDaysDraft.value > 180 && granularityDraft.value === 'day') return '范围较长，建议切换为周 / 月粒度'
  if (metricDraft.value === 'electricity' && (compareModeDraft.value === 'yoy' || compareModeDraft.value === 'mom')) {
    return '本期与对比期按同一粒度对齐'
  }
  return '按所选时间粒度聚合展示'
})

watch(rangeDaysDraft, () => {
  if (granularityDraft.value === 'day' && rangeDaysDraft.value > 366) granularityDraft.value = 'week'
  if (granularityDraft.value === 'week' && rangeDaysDraft.value > 1095) granularityDraft.value = 'month'
})

/** 移除分析对象：只改编辑条件，查询结果保留到下次查询 */
function removeScope(id: string) {
  rangeKeysDraft.value = rangeKeysDraft.value.filter((key) => key !== id)
}

const periodText = computed(() => rangeRange.value.join(' ～ '))
const comparePeriodLabel = computed(() => (compareMode.value === 'yoy' ? '去年同期' : '上一周期'))
const scopeText = computed(() => {
  if (!rangeKeys.value.length) return '未选择对象'
  return rangeKeys.value.map((id) => unitName(id)).join('、')
})

/** 当前选择类型：企业单独代表全量汇总；组织节点与用能单元不能混合对比 */
const selectedKind = computed<'enterprise' | 'org' | 'unit' | null>(() => {
  const first = units.find((unit) => unit.id === rangeKeysDraft.value[0])
  if (!first) return null
  if (first.kind === 'root') return 'enterprise'
  return first.kind === 'unit' ? 'unit' : 'org'
})
const selectedKindLabel = computed(() =>
  selectedKind.value === 'unit'
    ? '用能单元'
    : selectedKind.value === 'org'
      ? '组织节点'
      : selectedKind.value === 'enterprise'
        ? '企业'
        : '',
)
const headMeta = computed(() => {
  if (!rangeKeysDraft.value.length) return '企业汇总全部下级用能单元；组织节点之间、用能单元之间可对比，两类不能混合选择'
  if (selectedKind.value === 'enterprise') return '按企业下全部用能单元汇总 · 不可与其他对象同时选择'
  const aggregateHint = selectedKind.value === 'org' ? ' · 按下属用能单元口径汇总' : ''
  if (rangeKeysDraft.value.length > 1) {
    return `${selectedKindLabel.value}之间对比 · 已选 ${rangeKeysDraft.value.length} 个${aggregateHint}`
  }
  return `${selectedKindLabel.value}${aggregateHint} · 可再选择同类对象进行对比`
})

/* ---------- 用电统计设置（仅针对用能单元） ---------- */
/** 可选设置对象：仅用能单元；设备只归属到用能单元 */
const statDrawerUnits = computed(() =>
  units.filter((unit) => unit.kind === 'unit').map((unit) => unit.id),
)

const statDrawerOpen = ref(false)
const statDrawerUnitId = ref('')

/** 找到某节点下的第一个用能单元（自身为单元时返回自身） */
function firstUnitWithin(id: string): string {
  const node = units.find((unit) => unit.id === id)
  if (!node) return ''
  if (node.kind === 'unit') return node.id
  const child = units.find((unit) => unit.parentId === id)
  return child ? firstUnitWithin(child.id) : ''
}

function openStatDrawer() {
  const preferred = rangeKeysDraft.value[0] ?? rangeKeys.value[0] ?? ''
  statDrawerUnitId.value =
    firstUnitWithin(preferred) || statDrawerUnits.value[0] || ''
  statDrawerOpen.value = true
}

function handleStatSaved() {
  // 保存后按新口径重新查询当前编辑条件
  if (rangeKeysDraft.value.length) runQuery()
}

/* ---------- 演示状态（用于复现空态 / 无结果 / 未确认 / 失败） ---------- */
const loading = ref(false)
const demoState = ref<DemoState>('idle')
/** 分时未支持演示开关（STATE-ANA-08）：仅影响分时分析的指标与图表 */
const touUnsupported = ref(false)

function simulateTouUnsupported() {
  metricDraft.value = 'tou'
  metric.value = 'tou'
  touUnsupported.value = true
  if (rangeKeysDraft.value.length) {
    rangeKeys.value = [...rangeKeysDraft.value]
    hasQueried.value = true
  }
}

watch(metric, (value) => {
  if (value !== 'tou') touUnsupported.value = false
})
const exporting = ref(false)

function runQuery() {
  if (!rangeKeysDraft.value.length) {
    message.warning('请先在左侧选择分析对象')
    return
  }
  // 提交式查询：把编辑条件写入查询快照，结果区只读快照
  metric.value = metricDraft.value
  compareMode.value = compareModeDraft.value
  granularity.value = granularityDraft.value
  rangeRange.value = [...rangeRangeDraft.value]
  rangeKeys.value = [...rangeKeysDraft.value]
  hasQueried.value = true
  demoState.value = 'idle'
  loading.value = true
  // 【原型说明】模拟查询耗时，无真实接口调用
  window.setTimeout(() => {
    loading.value = false
  }, 420)
}

function resetAll() {
  metricDraft.value = 'electricity'
  compareModeDraft.value = 'none'
  granularityDraft.value = 'day'
  rangeRangeDraft.value = defaultRange()
  rangeKeysDraft.value = []

  metric.value = 'electricity'
  compareMode.value = 'none'
  granularity.value = 'day'
  rangeRange.value = defaultRange()
  rangeKeys.value = []
  hasQueried.value = false
  touUnsupported.value = false
  loading.value = false
}

function handleResetData() {
  resetEnergyData()
  resetAll()
}

function toggleDemo(state: DemoState) {
  demoState.value = demoState.value === state ? 'idle' : state
  if (demoState.value === 'idle') runQuery()
}

/* ---------- 指标计算（演示口径，数值来自 store） ---------- */
interface MetricItem {
  label: string
  value: string
  unit?: string
  hint?: string
  /** 数值较长时使用小字号（如对象名称） */
  compact?: boolean
}

function fmt(value: number): string {
  return Math.round(value).toLocaleString('en-US')
}

/** 所选对象的排名数据：一行一个已选对象，按本期用电量降序 */
const selectedRanks = computed<RankRow[]>(() =>
  rangeKeys.value
    .map((id) => {
      const name = unitName(id)
      const node = units.find((unit) => unit.id === id)
      let current = 0
      let previous = 0

      if (node?.kind === 'unit') {
        // 用能单元：直接取该单元的统计值
        const exact = rankRows.value.find((row) => row.unitId === id && row.name === name)
        const base = exact ?? rankRows.value.find((row) => row.unitId === id)
        current = base?.current ?? 0
        previous = base?.previous ?? 0
      } else {
        // 组织节点 / 企业：按下属叶子用能单元的统计值求和
        const leaves = leafUnitIds(id)
        current = leaves.reduce((sum, leafId) => sum + rowValueOf(leafId, 'current'), 0)
        previous = leaves.reduce((sum, leafId) => sum + rowValueOf(leafId, 'previous'), 0)
      }

      const delta = current - previous
      return {
        id: `SEL-${id}`,
        unitId: id,
        name,
        current,
        previous,
        delta,
        deltaRate: previous === 0 ? null : Number(((delta / previous) * 100).toFixed(1)),
        ratio: null,
      }
    })
    .sort((a, b) => b.current - a.current),
)

/** 取某对象的叶子用能单元（自身为叶子时返回自身） */
function leafUnitIds(id: string): string[] {
  const children = units.filter((unit) => unit.parentId === id)
  if (!children.length) return [id]
  return children.flatMap((child) => leafUnitIds(child.id))
}

/** 叶子单元在排名演示数据中的本期 / 对比期值 */
function rowValueOf(unitId: string, key: 'current' | 'previous'): number {
  const name = unitName(unitId)
  const row =
    rankRows.value.find((item) => item.unitId === unitId && item.name === name) ??
    rankRows.value.find((item) => item.unitId === unitId)
  return row?.[key] ?? 0
}

const currentTotal = computed(() => selectedRanks.value.reduce((sum, row) => sum + row.current, 0))
const previousTotal = computed(() => selectedRanks.value.reduce((sum, row) => sum + row.previous, 0))
const deltaTotal = computed(() => currentTotal.value - previousTotal.value)
const deltaRate = computed<number | null>(() =>
  previousTotal.value === 0 ? null : Number(((deltaTotal.value / previousTotal.value) * 100).toFixed(1)),
)
/** 日均值：按查询天数平均（不再区分数据质量） */
const dailyAvg = computed(() => Math.round(currentTotal.value / (rangeDays.value || 1)))
/** 期间内用电最高的对象及占比（不对比时用于指标卡） */
const topObject = computed(() => selectedRanks.value[0])
const topRatio = computed(() =>
  currentTotal.value ? Number(((topObject.value.current / currentTotal.value) * 100).toFixed(1)) : 0,
)
/* ---------- 时间粒度聚合：按所选粒度把查询区间切成统计时段 ---------- */
const granularityLabel = computed(
  () => ({ day: '日', week: '周', month: '月', year: '年' })[granularity.value],
)

interface Bucket {
  label: string
  /** 该统计时段无任何有效采集时为 null（曲线断点，图例标注「缺失」） */
  value: number | null
  missing: boolean
}

const buckets = computed<Bucket[]>(() => {
  const start = dayjs(rangeRange.value[0]).startOf('day')
  const end = dayjs(rangeRange.value[1]).startOf('day')
  const days = Math.max(1, end.diff(start, 'day') + 1)
  const map = new Map<string, { label: string; sum: number; hasValue: boolean; missing: boolean }>()
  for (let index = 0; index < days; index += 1) {
    const date = start.add(index, 'day')
    let key: string
    let label: string
    if (granularity.value === 'day') {
      key = date.format('YYYY-MM-DD')
      label = date.format('M/D')
    } else if (granularity.value === 'week') {
      const weekStart = date.startOf('week')
      key = weekStart.format('YYYY-MM-DD')
      label = `${weekStart.format('M/D')} 周`
    } else if (granularity.value === 'month') {
      key = date.format('YYYY-MM')
      label = date.format('YYYY-MM')
    } else {
      key = date.format('YYYY')
      label = `${date.format('YYYY')} 年`
    }
    const source = dailySeries.points[index % dailySeries.points.length]
    const value = source?.value ?? null
    const hit = map.get(key)
    if (hit) {
      if (value === null) hit.missing = true
      else {
        hit.sum += value
        hit.hasValue = true
      }
    } else {
      map.set(key, { label, sum: value ?? 0, hasValue: value !== null, missing: value === null })
    }
  }
  const raw = [...map.values()]
  const rawTotal = raw.reduce((sum, item) => sum + item.sum, 0) || 1
  const factor = currentTotal.value / rawTotal
  return raw.map((item) => ({
    label: item.label,
    value: item.hasValue ? Math.round(item.sum * factor) : null,
    missing: item.missing,
  }))
})

const bucketLabels = computed(() => buckets.value.map((item) => item.label))

/** 查询区间是否存在缺失数据（用于图表脚注提示） */
const hasMissing = computed(() => buckets.value.some((item) => item.missing))

/** 分时（尖 / 峰 / 平 / 谷）按每个统计时段的电量等比拆分；缺失时段留空 */
const touSeries = computed(() => {
  const base = touItems.reduce((sum, item) => sum + item.value, 0) || 1
  return touItems.map((item) => ({
    name: item.name,
    color: item.color,
    values: buckets.value.map((bucket) =>
      bucket.value === null ? null : Math.round(bucket.value * (item.value / base)),
    ),
  }))
})

/** 分时四项在查询区间内的合计与占比 */
const touTotals = computed(() => {
  const list = touSeries.value.map((item) => ({
    name: item.name,
    value: item.values.reduce<number>((sum, value) => sum + (value ?? 0), 0),
  }))
  const total = list.reduce((sum, item) => sum + item.value, 0) || 1
  return list.map((item) => ({ ...item, ratio: Number(((item.value / total) * 100).toFixed(1)) }))
})

function signedText(value: number): string {
  return `${value > 0 ? '+' : ''}${fmt(value)}`
}
function rateText(rate: number | null): string {
  return rate === null ? '—' : `${rate > 0 ? '+' : ''}${rate.toFixed(1)}`
}

const metrics = computed<MetricItem[]>(() => {
  if (metric.value === 'tou') {
    return touTotals.value.map((item) => ({
      label: item.name,
      value: fmt(item.value),
      unit: 'kWh',
      hint: `占比 ${item.ratio}%`,
    }))
  }
  if (compareMode.value === 'yoy' || compareMode.value === 'mom') {
    return [
      { label: '本期', value: fmt(currentTotal.value), unit: 'kWh', hint: periodText.value },
      {
        label: '对比期',
        value: fmt(previousTotal.value),
        unit: 'kWh',
        hint: `${comparePeriodLabel.value} · 相同已过时长`,
      },
      { label: '变化量', value: signedText(deltaTotal.value), unit: 'kWh' },
      {
        label: '变化率',
        value: rateText(deltaRate.value),
        unit: deltaRate.value === null ? undefined : '%',
        hint: deltaRate.value === null ? '基期不可比' : undefined,
      },
    ]
  }
  if (compareMode.value === 'object') {
    const selectedTop = compareTop.value
    return [
      { label: '本期合计', value: fmt(currentTotal.value), unit: 'kWh' },
      { label: '对比对象', value: String(rangeKeys.value.length), unit: '个' },
      {
        label: 'Top1 对象及占比',
        value: selectedTop?.name ?? '—',
        hint: selectedTop
          ? `占比 ${((selectedTop.current / (currentTotal.value || 1)) * 100).toFixed(1)}%`
          : '请在左侧选择对象',
        compact: true,
      },
      { label: '变化量', value: signedText(deltaTotal.value), unit: 'kWh' },
    ]
  }
  return [
    { label: '本期合计', value: fmt(currentTotal.value), unit: 'kWh' },
    { label: '日均值', value: fmt(dailyAvg.value), unit: 'kWh' },
    {
      label: 'Top1 对象及占比',
      value: topObject.value?.name ?? '—',
      hint: `占比 ${topRatio.value}%`,
      compact: true,
    },
  ]
})

/* ---------- 图表数据 ---------- */
const chartTitle = computed(() => {
  if (metric.value === 'tou') return `分时用电构成（按${granularityLabel.value}）`
  if (compareMode.value === 'object') return `对象对比（按${granularityLabel.value}）`
  if (compareMode.value === 'yoy') return `同比分析（按${granularityLabel.value}）`
  if (compareMode.value === 'mom') return `环比分析（按${granularityLabel.value}）`
  return `用电量趋势（按${granularityLabel.value}）`
})

/* ---------- 图表图片下载 ---------- */
interface ChartExpose {
  getDataURL: () => string
}
const lineChartRef = ref<ChartExpose | null>(null)
const touChartRef = ref<ChartExpose | null>(null)

/** 当前是否有可下载的图表（对象对比不足 2 个对象、分时未支持时没有图表） */
const canDownloadChart = computed(() =>
  metric.value === 'tou'
    ? !touUnsupported.value
    : compareMode.value !== 'object' || rangeKeys.value.length >= 2,
)

function downloadChart() {
  const dataUrl =
    metric.value === 'tou'
      ? touChartRef.value?.getDataURL()
      : lineChartRef.value?.getDataURL()
  if (!dataUrl) {
    message.warning('图表尚未渲染完成，请稍后重试')
    return
  }
  const filename = `${chartTitle.value}-${rangeRange.value[0]}_${rangeRange.value[1]}`
    .replace(/[\\/:*?"<>|\s]+/g, '-')
  const link = document.createElement('a')
  link.href = dataUrl
  link.download = `${filename}.png`
  link.click()
  message.success('图表图片已开始下载')
}

const lineSeries = computed<Series[]>(() => {
  if (metric.value === 'tou' || compareMode.value === 'object') return []
  const points = buckets.value.map((bucket) => ({
    label: bucket.label,
    value: bucket.value,
    quality: bucket.missing ? ('missing' as const) : ('valid' as const),
  }))
  if (compareMode.value === 'none') {
    return [{ name: '本期用电量', color: '#0f7b6c', points }]
  }
  const ratio = currentTotal.value ? previousTotal.value / currentTotal.value : 1
  return [
    { name: '本期', color: '#0f7b6c', points },
    {
      name: comparePeriodLabel.value,
      color: '#1890ff',
      points: points.map((point) => ({
        ...point,
        value: point.value === null ? null : Math.round(point.value * ratio),
      })),
    },
  ]
})

const COMPARE_COLORS = ['#0f7b6c', '#1890ff', '#faad14', '#52c41a', '#ff4d4f', '#8c8c8c', '#722ed1', '#13c2c2', '#eb2f96', '#2f54eb']
/** 对象对比：左侧树所选对象按同一时间粒度聚合，以多序列折线展示 */
const compareSeries = computed<Series[]>(() => {
  if (metric.value !== 'electricity' || compareMode.value !== 'object') return []
  const total = currentTotal.value || 1
  return rangeKeys.value.map((id, index) => {
    const row = selectedRanks.value.find((item) => item.unitId === id)
    const share = row ? row.current / total : 1 / Math.max(1, rangeKeys.value.length)
    return {
      name: unitName(id),
      color: COMPARE_COLORS[index % COMPARE_COLORS.length],
      points: buckets.value.map((bucket) => ({
        label: bucket.label,
        value: bucket.value === null ? null : Math.round(bucket.value * share),
        quality: bucket.missing ? ('missing' as const) : ('valid' as const),
      })),
    }
  })
})

/** 对象对比指标卡：所选对象中用电最高者 */
const compareTop = computed(() => selectedRanks.value[0])

const statTime = computed(
  () => `${rangeRange.value[0]} ～ ${rangeRange.value[1]} · 按${granularityLabel.value}汇总`,
)

/* ---------- 排名 ---------- */
const topRanks = computed(() => selectedRanks.value.slice(0, RANK_TOP_N))

/** 排名按所选对象的完整排序计算，翻页后序号保持连续 */
function rankOf(record: RankRow): number {
  return selectedRanks.value.findIndex((row) => row.id === record.id) + 1
}

function ratioOf(record: RankRow): string {
  if (!currentTotal.value) return '0.0'
  return ((record.current / currentTotal.value) * 100).toFixed(1)
}

/** 仅同比 / 环比展示对比期与变化列；不对比或对象对比时排名只保留本期与占比 */
const showCompareColumns = computed(
  () => metric.value === 'electricity' && (compareMode.value === 'yoy' || compareMode.value === 'mom'),
)
const rankColumns = computed<TableColumnsType<RankRow>>(() => {
  const compare = showCompareColumns.value
  const columns: TableColumnsType<RankRow> = [
    { title: '排名', key: 'rank', align: 'center' },
    { title: '对象', key: 'name' },
    { title: '本期用电量（kWh）', key: 'current', align: 'right' },
  ]
  if (compare) {
    columns.push(
      { title: '对比期用电量（kWh）', key: 'previous', align: 'right' },
      { title: '变化量（kWh）', key: 'delta', align: 'right' },
      { title: '变化率', key: 'deltaRate', align: 'right' },
    )
  }
  columns.push({ title: '占比', key: 'ratio', align: 'right' })
  return columns
})

/** 表格行首内置展开 / 收起图标，展开后展示该对象下的设备明细 */
const rankExpandable = { columnWidth: 44 }

/* ---------- 查看全部（Drawer） ---------- */
const drawerOpen = ref(false)
const drawerPagination = computed<TablePaginationConfig>(() => ({
  size: 'small',
  pageSize: 10,
  showSizeChanger: false,
  showTotal: (total: number) => `共 ${total} 个对象`,
  hideOnSinglePage: false,
}))

/* ---------- 对象名称 ---------- */
function unitName(id: string): string {
  return units.find((unit) => unit.id === id)?.name ?? id
}

/* ---------- 导出 ---------- */
async function handleExport() {
  exporting.value = true
  // 【原型说明】模拟导出耗时，无真实导出接口
  await new Promise((resolve) => setTimeout(resolve, 600))
  exporting.value = false
  message.success('已导出当前条件的数据')
}

/* ---------- 结果区状态文案 ---------- */
const stateTitle = computed(() => {
  if (demoState.value === 'empty') return '暂无用能数据'
  if (demoState.value === 'noresult') return '没有符合条件的用能数据'
  if (demoState.value === 'unconfirmed') return '统计范围未确认'
  return '分析结果加载失败'
})
const stateDesc = computed(() => {
  if (demoState.value === 'empty') return '当前条件下没有可分析的用能数据，试试调整范围或时间'
  if (demoState.value === 'noresult') return '试试调整分析范围或时间范围'
  if (demoState.value === 'unconfirmed') return '当前对象未设置进线总表，平台按所选独立电表求和；可在顶部「统计口径」中设置总表。'
  return '网络异常或服务暂时不可用，请稍后重试'
})
const stateIconClass = computed(() => {
  if (demoState.value === 'failed') return 'energy-state__icon--error'
  if (demoState.value === 'empty' || demoState.value === 'unconfirmed') return 'energy-state__icon--warning'
  return 'energy-state__icon--empty'
})

function backToSource() {
  if (window.history.length > 1) router.back()
  else router.push('/dashboard')
}

/* ---------- 演示提示 ---------- */
const tipLines = [
  '页面查询流程：在左侧树选择分析对象 → 统计指标 →（用电量为「对比方式」）→ 时间范围 → 时间粒度 → 点「查询」。选择对象或修改任一条件均不自动取数，结果区会提示待查询。',
  '左侧分析对象树以企业为根，图标区分企业、组织节点与用能单元：选择企业即统计其下全部用能单元的汇总，且不能与其他对象同时选择；组织节点之间、用能单元之间可对比，两类不能混合选择；默认不选中。',
  '右上角「用电统计设置」仅为引导入口，不判断是否已设置总表；设置只针对用能单元（设备只归属用能单元），组织节点按其下属用能单元汇总。设置总表后按总表统计；未设置时默认汇总该用能单元下全部独立电表。',
  '缺失状态：所选区间存在无采集数据时，曲线以断点展示并在图例标注「缺失」，图表脚注给出说明，缺失时段不计入统计。',
  '时间粒度（日 / 周 / 月 / 年）参与图表聚合：趋势、同比 / 环比、对象对比与分时分析均按所选粒度展示；时间范围过长时粒度自动升档。',
  '同比 / 环比固定按「相同已过时长」对齐，不提供基期口径切换。变化率为空时显示「—」并提示基期不可比。',
  '对象对比：在左侧树选择 2 个及以上同类型对象，按同一时间粒度以多序列折线展示。',
  '分时分析：同样选择时间范围与时间粒度，按粒度展示尖 / 峰 / 平 / 谷的堆叠构成；分时分析关注时段结构，不展示用能排名。',
  '用能排名仅展示当前所选对象的排名与本期的用电量与占比；本期指所选时间范围。点击行首展开图标查看该对象的设备明细（含所属用能单元完整路径、License、IMEI），总表在名称后带「总表」标签。',
  '图表区标题行右侧提供「下载图片」，可将当前趋势 / 对比 / 分时图表导出为 PNG。',
  '下方按钮可快速验证空数据、查询无结果、统计范围未确认与加载失败等状态，验证后请重置演示数据。',
]
</script>

<style scoped>
/* 条件区控件：固定宽度、统一高度，避免换行后参差 */
.ana-field--metric {
  width: 180px;
}

.ana-field--range {
  width: 280px;
}

.ana-field--compare {
  width: 336px;
}

.ana-field--granularity {
  width: 196px;
}

/* 分段控件铺满容器，避免右侧残留背景色 */
.ana-field--compare :deep(.ant-segmented),
.ana-field--granularity :deep(.ant-segmented) {
  width: 100%;
}

.ana-field--compare :deep(.ant-segmented-group),
.ana-field--granularity :deep(.ant-segmented-group) {
  width: 100%;
}

.ana-field--compare :deep(.ant-segmented-item),
.ana-field--granularity :deep(.ant-segmented-item) {
  flex: 1 1 0;
  text-align: center;
}

.ana-label__hint {
  margin-left: 4px;
  color: rgba(0, 0, 0, 0.35);
}

/* 顶部：分析对象 + 用电统计设置入口（与数据分析页容器间距一致） */
.ana-head {
  display: flex;
  align-items: stretch;
  gap: 16px;
  padding: 16px;
  background: #fff;
  border: 1px solid #eef2f1;
  border-radius: 10px;
}

.ana-head__object {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.ana-head__label {
  font-size: 12px;
  line-height: 18px;
  color: rgba(0, 0, 0, 0.45);
}

.ana-head__tags {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}

.ana-head__tag {
  margin: 0;
}

.ana-head__kind {
  margin: 0;
  color: #0f7b6c;
  background: #e9f4f1;
  border-color: #d5ebe5;
}

.ana-head__empty {
  padding: 2px 0;
  font-size: 13px;
  color: rgba(0, 0, 0, 0.45);
}

.ana-head__meta {
  font-size: 12px;
  color: rgba(0, 0, 0, 0.45);
}

/* 用电统计设置：仅作引导入口的整块可点击卡片 */
.ana-head__stat {
  display: flex;
  flex: none;
  align-items: center;
  gap: 10px;
  width: 360px;
  padding: 12px 14px;
  text-align: left;
  background: #f7fbfa;
  border: 1px solid #e7f1ee;
  border-radius: 10px;
  cursor: pointer;
  transition:
    background 0.2s,
    border-color 0.2s;
}

.ana-head__stat:hover {
  background: #f0f8f6;
  border-color: #cfe8e2;
}

.ana-head__stat:focus-visible {
  outline: 2px solid #0f7b6c;
  outline-offset: 2px;
}

.ana-head__stat-icon {
  display: inline-flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  font-size: 16px;
  color: #0f7b6c;
  background: #e9f4f1;
  border-radius: 8px;
}

.ana-head__stat-body {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.ana-head__stat-title {
  font-size: 13px;
  font-weight: 600;
  line-height: 18px;
  color: rgba(0, 0, 0, 0.88);
}

.ana-head__stat-meta {
  margin: 0;
  font-size: 12px;
  line-height: 18px;
  color: rgba(0, 0, 0, 0.45);
}

.ana-head__stat-action {
  display: inline-flex;
  flex: none;
  align-items: center;
  gap: 2px;
  font-size: 12px;
  color: #0f7b6c;
}

.ana-field__control {
  width: 100%;
}

/* 指标卡补充说明行 */
.ana-metric__hint {
  margin-top: 4px;
  font-size: 12px;
  color: rgba(0, 0, 0, 0.45);
}

.ana-metric__value--sm {
  font-size: 16px;
  word-break: break-all;
}

/* 图表区：占满容器宽度（避免居中时被内容宽度压缩） */
.ana-chart-box {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  min-height: 260px;
}

.ana-chart-box :deep(.energy-chart),
.ana-chart-box :deep(.energy-bar) {
  width: 100%;
}

.ana-chart__tools {
  display: inline-flex;
  align-items: center;
  gap: 12px;
}

.ana-chart__download {
  height: 24px;
  padding: 0 6px;
  font-size: 12px;
  color: rgba(0, 0, 0, 0.55);
}

.ana-chart-source {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: rgba(0, 0, 0, 0.45);
}

/* 排名表格单元格 */
.ana-num {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12px;
}

.ana-delta--up {
  color: #ff4d4f;
}

.ana-delta--down {
  color: #52c41a;
}

.ana-cell__name {
  color: rgba(0, 0, 0, 0.88);
}

.ana-cell__owner {
  margin-left: 8px;
  font-size: 12px;
  color: rgba(0, 0, 0, 0.45);
}

.ana-cell__tag {
  margin-left: 8px;
  font-size: 12px;
}

/* 行内下钻容器 */
.ana-drill {
  padding: 12px 16px;
  background: #f8fbfa;
  border-radius: 8px;
}

.ana-drill__title {
  margin-bottom: 8px;
  font-size: 13px;
  color: rgba(0, 0, 0, 0.65);
}

/* 排名区标题：标题 + 说明 */
.ana-rank__head {
  display: flex;
  align-items: baseline;
  gap: 8px;
  min-width: 0;
}

/* 缺失数据提示 */
.ana-missing-tip {
  display: flex;
  align-items: center;
  gap: 6px;
  color: #d48806;
}

/* 加载中容器 */
.ana-loading {
  min-height: 240px;
}

/* Drawer 说明 */
.ana-drawer__desc {
  margin-bottom: 12px;
  font-size: 12px;
  color: rgba(0, 0, 0, 0.45);
}
</style>
