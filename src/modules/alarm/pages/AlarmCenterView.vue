<template>
  <div v-if="!canView" class="page-container alm-page">
    <div class="alm-denied">
      <a-empty description="当前账号无权限执行此操作" />
      <a-button type="primary" @click="router.push('/dashboard')">返回</a-button>
    </div>
  </div>

  <div v-else class="page-container alm-page">
    <!-- AREA-ALM-01 查询条件区 -->
    <section class="alm-filter" aria-label="告警查询条件">
      <div class="alm-filter__body">
        <div class="alm-field alm-field--date">
          <label class="alm-field__label">告警时间</label>
          <a-range-picker
            v-model:value="rangeValue"
            class="alm-field__control"
            :allow-clear="false"
            :presets="rangePresets"
            :placeholder="['开始日期', '结束日期']"
            @change="applyFilters"
          />
        </div>

        <div class="alm-field">
          <label class="alm-field__label">事件类型</label>
          <a-select
            v-model:value="filters.eventTypes"
            class="alm-field__control"
            mode="multiple"
            show-search
            allow-clear
            max-tag-count="responsive"
            placeholder="全部事件类型"
            :options="eventGroups"
          />
        </div>

        <div class="alm-field">
          <label class="alm-field__label">所属用能单元</label>
          <a-tree-select
            v-model:value="filters.unitId"
            class="alm-field__control"
            show-search
            allow-clear
            tree-default-expand-all
            placeholder="全部用能单元"
            :tree-data="unitTree"
            :field-names="{ label: 'title', value: 'value', children: 'children' }"
            :tree-node-filter-prop="'title'"
            :styles="{ popup: { root: { maxHeight: '320px', overflow: 'auto' } } }"
          />
        </div>

        <div class="alm-field">
          <label class="alm-field__label">所属设备</label>
          <a-input
            v-model:value="filters.meterKeyword"
            class="alm-field__control"
            placeholder="设备名称 / License"
            allow-clear
            @press-enter="applyFilters"
          >
            <template #prefix>
              <SearchOutlined class="alm-field__prefix" />
            </template>
          </a-input>
        </div>

        <div class="alm-filter__actions">
          <a-button type="primary" @click="applyFilters">
            <template #icon><SearchOutlined /></template>
            查询
          </a-button>
          <a-button @click="resetFilters">
            <template #icon><ReloadOutlined /></template>
            重置
          </a-button>
          <a-button v-if="canExport" :loading="exporting" @click="handleExport">
            <template #icon><DownloadOutlined /></template>
            导出
          </a-button>
        </div>
      </div>
    </section>

    <!-- AREA-ALM-02 列表容器 -->
    <section class="alm-list" aria-label="告警列表">
      <!-- 选择态操作条：仅在勾选后出现，避免与分页总条数重复展示 -->
      <Transition name="alm-selbar">
        <div v-if="selectedIds.length" class="alm-selbar">
          <span class="alm-selbar__text">
            已选择 <strong>{{ selectedIds.length }}</strong> 条告警
          </span>
          <a-space size="small">
            <a-button v-if="canDelete" danger size="small" :loading="batchDeleting" @click="openBatchDelete">
              <template #icon><DeleteOutlined /></template>
              批量删除
            </a-button>
            <a-button type="link" size="small" @click="clearSelection">取消选择</a-button>
          </a-space>
        </div>
      </Transition>

      <!-- 加载中 -->
      <div v-if="loading" class="alm-list__skeleton">
        <a-skeleton active :paragraph="{ rows: 6 }" />
      </div>

      <!-- 加载失败 -->
      <div v-else-if="failed" class="alm-state">
        <span class="alm-state__icon alm-state__icon--error"><DisconnectOutlined /></span>
        <p class="alm-state__title">告警列表加载失败</p>
        <p class="alm-state__desc">网络异常或服务暂时不可用，请稍后重试</p>
        <a-button type="primary" size="small" @click="loadList">
          <template #icon><ReloadOutlined /></template>
          重新加载
        </a-button>
      </div>

      <!-- 企业暂无告警 -->
      <div v-else-if="!alarms.length" class="alm-state">
        <span class="alm-state__icon"><BellOutlined /></span>
        <p class="alm-state__title">暂无告警</p>
        <p class="alm-state__desc">当前企业还没有设备上报的告警事件</p>
      </div>

      <!-- 查询无结果 -->
      <div v-else-if="!sortedList.length" class="alm-state">
        <span class="alm-state__icon"><SearchOutlined /></span>
        <p class="alm-state__title">没有符合条件的告警</p>
        <p class="alm-state__desc">试试调整查询条件或扩大时间范围</p>
        <a-button type="primary" size="small" @click="resetFilters">重置查询条件</a-button>
      </div>

      <a-table
        v-else
        class="alm-table"
        :columns="columns"
        :data-source="sortedList"
        :pagination="paginationConfig"
        :row-selection="rowSelection"
        :scroll="{ x: 1096 }"
        row-key="id"
        @change="handleTableChange"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'reportAt'">
            <div class="alm-cell__time">
              <span class="alm-cell__time-date">{{ formatDatePart(record.reportAt) }}</span>
              <span class="alm-cell__time-clock">{{ formatTimePart(record.reportAt) }}</span>
            </div>
          </template>

          <template v-else-if="column.key === 'eventType'">
            <span class="alm-cell__event">{{ record.eventType }}</span>
          </template>

          <template v-else-if="column.key === 'content'">
            <span class="alm-cell__content" :title="record.content">{{ record.content }}</span>
          </template>

          <template v-else-if="column.key === 'meter'">
            <div class="alm-cell__stack">
              <span class="alm-cell__name" :title="record.meterName">{{ record.meterName }}</span>
              <span class="alm-cell__meta" :title="record.meterLicense">
                <span class="alm-cell__meta-key">License</span>
                <span class="alm-cell__mono">{{ record.meterLicense }}</span>
              </span>
            </div>
          </template>

          <template v-else-if="column.key === 'unit'">
            <span class="alm-cell__path" :title="record.unitPath">{{ record.unitPath }}</span>
          </template>

          <template v-else-if="column.key === 'action'">
            <a-button v-if="canDelete" type="link" size="small" danger @click="openDelete(record)">
              删除
            </a-button>
            <span v-else class="alm-cell__empty">—</span>
          </template>
        </template>
      </a-table>
    </section>

    <!-- 单条删除确认 -->
    <a-modal
      v-model:open="deleteOpen"
      title="删除该条告警？"
      :width="440"
      :mask-closable="!deleting"
      :ok-button-props="{ loading: deleting, danger: true }"
      ok-text="确认删除"
      cancel-text="取消"
      @ok="handleDeleteSubmit"
    >
      <div v-if="deleteTarget" class="alm-confirm">
        <div class="alm-confirm__head">
          <span class="alm-confirm__event">{{ deleteTarget.eventType }}</span>
          <span class="alm-confirm__time">{{ formatTime(deleteTarget.reportAt) }}</span>
        </div>
        <p class="alm-confirm__content">{{ deleteTarget.content }}</p>
        <p class="alm-confirm__meta">
          {{ deleteTarget.meterName }} · {{ deleteTarget.unitPath }}
        </p>
      </div>
      <p class="alm-confirm__warn">删除后该条告警记录将被移除，操作不可恢复。</p>
    </a-modal>

    <!-- 批量删除确认 -->
    <a-modal
      v-model:open="batchDeleteOpen"
      title="删除所选告警？"
      :width="440"
      :mask-closable="!batchDeleting"
      :ok-button-props="{ loading: batchDeleting, danger: true }"
      ok-text="确认删除"
      cancel-text="取消"
      @ok="handleBatchDeleteSubmit"
    >
      <p class="alm-confirm__lead">
        已选择 <strong>{{ selectedIds.length }}</strong> 条告警<template v-if="crossPageSelected">（含其他页的选择）</template>。
      </p>
      <p class="alm-confirm__warn">删除后所选告警记录将被移除，操作不可恢复。</p>
    </a-modal>

    <ProtoTip :lines="tipLines" @reset="handleResetData">
      <template #extra>
        <a-button size="small" @click="simulateLoadFail">模拟加载失败</a-button>
      </template>
    </ProtoTip>
  </div>
</template>

<script setup lang="ts">
/**
 * PAGE-01 告警中心
 * 【原型说明】展示组织架构下各用能单元所属设备的告警。
 * 列表字段为「选择框 / 告警时间 / 所属用能单元 / 所属设备 / 事件类型 / 告警内容 / 操作」，
 * 默认按告警时间倒序、每页 10 条；支持按条件查询、重置、跨页勾选与批量删除、导出。
 * 本期不含告警等级、重复合并、通知规则、详情抽屉与单独刷新按钮。
 */
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { message } from 'antdv-next'
import type { RangePickerProps, TableColumnsType, TablePaginationConfig } from 'antdv-next'
import dayjs from 'dayjs'
import type { Dayjs } from 'dayjs'
import {
  BellOutlined,
  DeleteOutlined,
  DisconnectOutlined,
  DownloadOutlined,
  ReloadOutlined,
  SearchOutlined,
} from '@antdv-next/icons'
import ProtoTip from '@/shared/components/ProtoTip.vue'
import { currentPermissions } from '@/modules/role/store'
import {
  alarms,
  buildExport,
  deleteAlarm,
  deleteAlarms,
  downloadText,
  eventTypeGroups,
  filterAlarms,
  formatTime,
  getAlarm,
  resetAlarmData,
  sortAlarms,
  todayRange,
  unitTreeData,
  validateRange,
} from '../store'
import type { Alarm, AlarmFilters, DateRange, SortOrder } from '../store'

/* ---------- 角色与权限：按当前账号的功能权限渲染入口 ---------- */
/**
 * 【原型说明】告警中心是一级导航项且自身即页面，因此菜单级能力 `alarm`
 * 代表「可进入告警中心查看列表」；导出与删除为按钮级权限点。
 * 无删除权限时不渲染行内删除、复选框不可勾选、不出现选择态操作条；
 * 无导出权限时不渲染「导出」；两者均不做无权限提示（PRD 5.3 / STATE-ALM-07）。
 */
const canView = computed(() => has('alarm'))
const canDelete = computed(() => has('alarm:delete'))
const canExport = computed(() => has('alarm:export'))

function has(key: string) {
  return currentPermissions().includes(key)
}

const router = useRouter()

/* ---------- 查询条件 ---------- */
const defaultFilters = (): AlarmFilters => ({
  dateRange: todayRange(),
  eventTypes: [],
  unitId: null,
  meterKeyword: '',
})

/**
 * 【原型说明】支持从「设备详情 › 查看全部告警」带入设备筛选。
 * 告警中心的「所属设备」条件按设备名称或设备 License 匹配（PRD 不匹配设备编号），
 * 因此设备详情携带的是设备 License。
 */
const route = useRoute()
const initialMeterKeyword = String(route.query.meter ?? '')
const filters = reactive<AlarmFilters>({ ...defaultFilters(), meterKeyword: initialMeterKeyword })
/** 最近一次生效的时间范围：区间不合法时回退用 */
const validRange = ref<DateRange>(defaultFilters().dateRange)

/** 快捷时间范围，点击后直接带入区间 */
const rangePresets: RangePickerProps['presets'] = [
  { label: '今日', value: [dayjs().startOf('day'), dayjs()] },
  { label: '近 7 天', value: [dayjs().add(-6, 'd').startOf('day'), dayjs()] },
  { label: '近 30 天', value: [dayjs().add(-29, 'd').startOf('day'), dayjs()] },
]

/** 时间范围：查询区间按日期粒度维护，回显时转成日期组件需要的值 */
const rangeValue = computed({
  get: (): [Dayjs, Dayjs] => [dayjs(filters.dateRange[0]), dayjs(filters.dateRange[1])],
  set: (value: [Dayjs, Dayjs] | null) => {
    if (!value?.[0] || !value?.[1]) return
    const next: DateRange = [value[0].format('YYYY-MM-DD'), value[1].format('YYYY-MM-DD')]
    const issue = validateRange(next)
    if (issue) {
      message.error(issue)
      // 区间不合法时回退到最近一次生效的范围
      filters.dateRange = [validRange.value[0], validRange.value[1]]
      return
    }
    validRange.value = next
    filters.dateRange = next
  },
})

const eventGroups = computed(() => eventTypeGroups())
const unitTree = computed(() => unitTreeData())

/** 查询结果：先按条件过滤，再按告警时间排序（默认倒序） */
const sortOrder = ref<SortOrder>('descend')
const sortedList = computed(() => sortAlarms(filterAlarms(filters), sortOrder.value))

/** 输入类条件在回车或点「查询」时生效 */
function applyFilters() {
  page.value = 1
  loadList()
}

function resetFilters() {
  Object.assign(filters, defaultFilters())
  validRange.value = defaultFilters().dateRange
  sortOrder.value = 'descend'
  page.value = 1
  clearSelection()
  loadList()
}

/* ---------- 列表加载 ---------- */
const loading = ref(true)
const failed = ref(false)
const page = ref(1)
const pageSize = ref(10)

/** 【原型说明】模拟列表加载耗时，无真实接口调用 */
function loadList() {
  loading.value = true
  failed.value = false
  window.setTimeout(() => {
    loading.value = false
  }, 420)
}

/** 【原型说明】模拟加载失败，用于验证错误态与重试 */
function simulateLoadFail() {
  loading.value = true
  failed.value = false
  window.setTimeout(() => {
    loading.value = false
    failed.value = true
  }, 420)
}

const paginationConfig = computed<TablePaginationConfig>(() => ({
  current: page.value,
  pageSize: pageSize.value,
  size: 'small' as const,
  showSizeChanger: true,
  pageSizeOptions: ['10', '20', '50', '100'],
  showTotal: (total: number) => `共 ${total} 条`,
  hideOnSinglePage: false,
}))

function handleTableChange(
  pagination: TablePaginationConfig,
  _filtersArg: unknown,
  sorter: { order?: SortOrder | null } | Array<{ order?: SortOrder | null }>,
  extra?: { action?: string },
) {
  page.value = pagination.current ?? 1
  pageSize.value = pagination.pageSize ?? 10
  // 只有点击列头排序时才改写方向；翻页与筛选不改变排序
  if (extra?.action !== 'sort') return
  const order = Array.isArray(sorter) ? sorter[0]?.order : sorter?.order
  // 表格在两个方向轮完后会返回空 order（语义为「取消排序」）。
  // 告警时间的排序方向常驻，因此这里改为翻转到另一方向，形成「降序 ⇄ 升序」两态切换。
  sortOrder.value = order ?? (sortOrder.value === 'descend' ? 'ascend' : 'descend')
}

/* ---------- 列表列 ---------- */
/**
 * 各列宽度合计 1096px（含勾选列 48px），对应 scroll.x = 1096：
 * 1366px 及以上宽度下表格不出现横向滚动，操作列稳定可见；
 * 内容区更宽时各列按比例摊开，不会把操作列单独推到表格右缘。
 * 告警时间为受控排序：sortOrder 跟随页面排序状态，点击列头在倒序 / 正序之间切换，
 * 排序图标因此始终反映当前生效的顺序。
 */
const columns = computed<TableColumnsType<Alarm>>(() => [
  {
    title: '告警时间',
    dataIndex: 'reportAt',
    key: 'reportAt',
    width: 148,
    sorter: true,
    // 只提供「降序 / 升序」两个方向：告警时间始终有序，不需要「取消排序」这一态
    sortDirections: ['descend', 'ascend'] as SortOrder[],
    sortOrder: sortOrder.value,
    // 覆盖组件默认提示，改为描述下一次点击的方向
    showSorterTooltip: { title: sortOrder.value === 'descend' ? '点击升序' : '点击降序' },
  },
  { title: '所属用能单元', key: 'unit', width: 214 },
  { title: '所属设备', key: 'meter', width: 200 },
  { title: '事件类型', key: 'eventType', width: 134 },
  { title: '告警内容', key: 'content', width: 276 },
  { title: '操作', key: 'action', width: 76 },
])

/** 时间拆成「日期 / 时刻」两行展示，便于在窄列中快速扫读 */
const pad = (value: number) => String(value).padStart(2, '0')
function formatDatePart(at: number) {
  const date = new Date(at)
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}
function formatTimePart(at: number) {
  const date = new Date(at)
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/* ---------- 跨页勾选与批量删除 ---------- */
const selectedIds = ref<string[]>([])

/** 【原型说明】勾选跨页保留，按告警标识记录；切换页码或调整条件后仍保留 */
const rowSelection = computed(() => ({
  selectedRowKeys: selectedIds.value,
  columnWidth: 48,
  onChange: (keys: Array<string | number>) => {
    selectedIds.value = keys.map((key) => String(key))
  },
  getCheckboxProps: () => ({ disabled: !canDelete.value }),
}))

/** 所选条目是否有当前页之外的（用于提示「含其他页的选择」） */
const crossPageSelected = computed(() => {
  const currentPageIds = sortedList.value.slice((page.value - 1) * pageSize.value, page.value * pageSize.value).map((item) => item.id)
  return selectedIds.value.some((id) => !currentPageIds.includes(id))
})

function clearSelection() {
  selectedIds.value = []
}

/* ---------- 单条删除 ---------- */
const deleteOpen = ref(false)
const deleting = ref(false)
const deleteId = ref<string | null>(null)
const deleteTarget = computed(() => (deleteId.value ? getAlarm(deleteId.value) : null))

function openDelete(record: Alarm) {
  deleteId.value = record.id
  deleteOpen.value = true
}

async function handleDeleteSubmit() {
  if (!deleteId.value) return
  const removedId = deleteId.value
  const removedPage = page.value
  deleting.value = true
  try {
    await deleteAlarm(removedId)
    deleteOpen.value = false
    deleteId.value = null
    selectedIds.value = selectedIds.value.filter((id) => id !== removedId)
    // 删除后停留在当前页；当前页因此变空时回退到上一页
    const maxPage = Math.max(1, Math.ceil(sortedList.value.length / pageSize.value))
    if (removedPage > maxPage) page.value = maxPage
    message.success('告警已删除')
  } catch (error) {
    message.error(error instanceof Error ? error.message : '删除失败，请重试')
  } finally {
    deleting.value = false
  }
}

/* ---------- 批量删除（不设条数上限） ---------- */
const batchDeleteOpen = ref(false)
const batchDeleting = ref(false)

function openBatchDelete() {
  if (!selectedIds.value.length) {
    message.warning('请先勾选需要删除的告警')
    return
  }
  batchDeleteOpen.value = true
}

async function handleBatchDeleteSubmit() {
  const ids = [...selectedIds.value]
  batchDeleting.value = true
  try {
    const result = await deleteAlarms(ids)
    batchDeleteOpen.value = false
    clearSelection()
    page.value = 1
    if (result.skipped) {
      message.warning(`已删除 ${result.success} 条，${result.skipped} 条已被删除被跳过`)
    } else {
      message.success(`已删除 ${result.success} 条告警`)
    }
  } catch (error) {
    message.error(error instanceof Error ? error.message : '删除失败，请重试')
  } finally {
    batchDeleting.value = false
  }
}

/* ---------- 导出 ---------- */
const exporting = ref(false)

async function handleExport() {
  const result = buildExport(sortedList.value)
  if (!result.ok) {
    message.error(result.reason)
    return
  }
  exporting.value = true
  // 【原型说明】模拟文件生成耗时，无真实导出接口
  await new Promise((resolve) => setTimeout(resolve, 600))
  downloadText(result.fileName, result.content)
  exporting.value = false
  message.success(`已导出 ${result.count} 条告警`)
}

/* ---------- 条件或排序变化时回到第 1 页 ---------- */
watch(
  () => JSON.stringify([filters, sortOrder.value]),
  () => {
    page.value = 1
  },
)

/* ---------- 演示提示 ---------- */
const tipLines = [
  '本期只做告警展示：设备先触发报警并上报云端，云端再推送到本系统，一条推送即一条告警。',
  '列表字段：选择框 / 告警时间 / 所属用能单元 / 所属设备（名称 + License）/ 事件类型 / 告警内容 / 操作。',
  '默认按告警时间倒序，最新在最上方；点击「告警时间」列头可切换正序与倒序；列表默认每页 10 条。',
  '查询条件：告警时间默认今日，可选「今日 / 近 7 天 / 近 30 天」快捷区间或自定义日期区间（跨度上限 12 个月）、事件类型（按类别分组多选）、所属用能单元（含下级）、所属设备（设备名称 / License）；点「查询」或回车生效；「重置」回到默认条件并刷新。',
  '「导出」在查询条件区右侧，导出当前查询结果（上限 10000 条）。没有单独的刷新按钮：重新点「查询」「重置」或刷新网页即可。',
  '勾选支持跨页累计：翻页或调整查询条件后已勾选项仍保留；勾选后列表上方出现操作条，提供「批量删除」与「取消选择」，批量删除不设条数上限。',
  '删除为彻底删除且不可恢复，单条与批量均需二次确认；当前角色不具备删除权限时，勾选框与「删除」入口均不可用。',
  '告警的所属用能单元路径取自「系统管理 › 组织架构」中维护的用能单元节点，两个模块数据一致。',
  '下方按钮可快速验证列表加载失败状态，验证后请重置演示数据。',
]

function handleResetData() {
  resetAlarmData()
  Object.assign(filters, defaultFilters())
  validRange.value = defaultFilters().dateRange
  sortOrder.value = 'descend'
  clearSelection()
  page.value = 1
  loadList()
}

onMounted(loadList)
</script>
