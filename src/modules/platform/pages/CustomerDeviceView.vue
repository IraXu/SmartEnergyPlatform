<template>
  <div class="page-container platform-customer">
    <!-- AREA-CUS-01 规模统计区：查询控件区上方，展示企业 / 设备 / 在线规模 -->
    <section class="platform-stats" aria-label="全平台设备规模统计">
      <div class="platform-stat platform-stat--enterprise">
        <span class="platform-stat__icon"><HomeOutlined /></span>
        <div class="platform-stat__main">
          <span class="platform-stat__label">企业总数</span>
          <span class="platform-stat__value">{{ stats.enterpriseCount.toLocaleString('zh-CN') }}</span>
        </div>
      </div>
      <div class="platform-stat platform-stat--device">
        <span class="platform-stat__icon"><ClusterOutlined /></span>
        <div class="platform-stat__main">
          <span class="platform-stat__label">设备总数</span>
          <span class="platform-stat__value">{{ stats.deviceCount.toLocaleString('zh-CN') }}</span>
        </div>
      </div>
      <div class="platform-stat platform-stat--online">
        <span class="platform-stat__icon"><ThunderboltOutlined /></span>
        <div class="platform-stat__main">
          <span class="platform-stat__label">在线设备数</span>
          <span class="platform-stat__value">{{ stats.onlineDeviceCount.toLocaleString('zh-CN') }}</span>
        </div>
      </div>
      <div class="platform-stat platform-stat--rate">
        <span class="platform-stat__icon"><RiseOutlined /></span>
        <div class="platform-stat__main">
          <span class="platform-stat__label">在线率</span>
          <span class="platform-stat__value">{{ onlineRateText }}</span>
        </div>
      </div>
    </section>

    <!-- AREA-CUS-02 查询条件区：首项为「所属企业」，其余沿用设备台账口径 -->
    <section class="device-filter" aria-label="设备查询条件">
      <div class="device-filter__body">
        <div class="device-field">
          <label class="device-field__label">所属企业</label>
          <a-select
            v-model:value="draftFilters.enterpriseId"
            class="device-field__control"
            show-search
            allow-clear
            option-filter-prop="label"
            placeholder="全部企业"
            :options="enterpriseOptions"
            @change="handleEnterpriseChange"
          />
        </div>

        <div class="device-field">
          <label class="device-field__label">所属用能单元</label>
          <!-- 未选企业：跨企业按路径文本模糊匹配；选定企业：切换为该企业的用能单元树选择 -->
          <a-input
            v-if="!draftFilters.enterpriseId"
            v-model:value="draftFilters.unitText"
            class="device-field__control"
            placeholder="请输入用能单元"
            allow-clear
            :maxlength="PLATFORM_SEARCH_MAX"
            @press-enter="applyFilters"
          >
            <template #prefix><SearchOutlined class="device-field__prefix" /></template>
          </a-input>
          <a-tree-select
            v-else
            v-model:value="draftFilters.unitId"
            class="device-field__control"
            show-search
            allow-clear
            tree-default-expand-all
            tree-node-filter-prop="title"
            placeholder="全部用能单元"
            :tree-data="unitTree"
            :field-names="{ label: 'title', value: 'value', children: 'children' }"
            :styles="{ popup: { root: { maxHeight: '320px', overflow: 'auto' } } }"
          />
        </div>
        <div class="device-field">
          <label class="device-field__label">设备名称</label>
          <a-input
            v-model:value="draftFilters.name"
            class="device-field__control"
            placeholder="请输入设备名称"
            allow-clear
            :maxlength="PLATFORM_SEARCH_MAX"
            @press-enter="applyFilters"
          >
            <template #prefix><SearchOutlined class="device-field__prefix" /></template>
          </a-input>
        </div>

        <div class="device-field">
          <label class="device-field__label">设备识别码（IMEI）</label>
          <a-input
            v-model:value="draftFilters.imei"
            class="device-field__control"
            placeholder="请输入设备识别码"
            allow-clear
            :maxlength="PLATFORM_SEARCH_MAX"
            @press-enter="applyFilters"
          >
            <template #prefix><SearchOutlined class="device-field__prefix" /></template>
          </a-input>
        </div>

        <div class="device-field">
          <label class="device-field__label">License</label>
          <a-input
            v-model:value="draftFilters.license"
            class="device-field__control"
            placeholder="请输入 License"
            allow-clear
            :maxlength="PLATFORM_SEARCH_MAX"
            @press-enter="applyFilters"
          >
            <template #prefix><SearchOutlined class="device-field__prefix" /></template>
          </a-input>
        </div>

        <div class="device-field">
          <label class="device-field__label">表号</label>
          <a-input
            v-model:value="draftFilters.meterNo"
            class="device-field__control"
            placeholder="请输入表号"
            allow-clear
            :maxlength="PLATFORM_SEARCH_MAX"
            @press-enter="applyFilters"
          >
            <template #prefix><SearchOutlined class="device-field__prefix" /></template>
          </a-input>
        </div>

        <div class="device-field">
          <label class="device-field__label">设备类型</label>
          <a-select
            v-model:value="draftFilters.types"
            class="device-field__control"
            mode="multiple"
            show-search
            allow-clear
            max-tag-count="responsive"
            placeholder="全部设备类型"
            :options="typeOptions"
          />
        </div>

        <div class="device-field">
          <label class="device-field__label">拉合闸状态</label>
          <a-select
            v-model:value="draftFilters.latchStatuses"
            class="device-field__control"
            mode="multiple"
            allow-clear
            max-tag-count="responsive"
            placeholder="全部拉合闸状态"
            :options="latchOptions"
          />
        </div>

        <div class="device-field">
          <label class="device-field__label">在线状态</label>
          <a-select
            v-model:value="draftFilters.onlineStatuses"
            class="device-field__control"
            mode="multiple"
            allow-clear
            max-tag-count="responsive"
            placeholder="全部在线状态"
            :options="onlineOptions"
          />
        </div>

        <div class="device-filter__actions">
          <a-button type="primary" @click="applyFilters">
            <template #icon><SearchOutlined /></template>
            查询
          </a-button>
          <a-button @click="resetFilters">
            <template #icon><ReloadOutlined /></template>
            重置
          </a-button>
        </div>
      </div>
    </section>

    <!-- AREA-CUS-03 列表容器：仅列表样式，无操作项；提供列设置 -->
    <section class="device-list" aria-label="全平台设备列表">
      <div class="device-toolbar">
        <div class="device-toolbar__setting">
          <PlatformColumnSetting />
        </div>
      </div>

      <div v-if="loading" class="device-list__skeleton">
        <a-skeleton active :paragraph="{ rows: 6 }" />
      </div>

      <div v-else-if="failed" class="device-state">
        <span class="device-state__icon device-state__icon--error"><DisconnectOutlined /></span>
        <p class="device-state__title">设备列表加载失败</p>
        <p class="device-state__desc">网络异常或服务暂时不可用，请稍后重试</p>
        <a-button type="primary" size="small" @click="loadList">
          <template #icon><ReloadOutlined /></template>
          重新加载
        </a-button>
      </div>

      <div v-else-if="!totalCount" class="device-state">
        <span class="device-state__icon"><ClusterOutlined /></span>
        <p class="device-state__title">暂无设备</p>
        <p class="device-state__desc">平台内各企业还没有在册设备</p>
      </div>

      <div v-else-if="!sortedList.length" class="device-state">
        <span class="device-state__icon"><SearchOutlined /></span>
        <p class="device-state__title">没有符合条件的设备</p>
        <p class="device-state__desc">试试调整查询条件</p>
        <a-button type="primary" size="small" @click="resetFilters">重置查询条件</a-button>
      </div>

      <a-table
        v-else
        class="device-table"
        :columns="columns"
        :data-source="sortedList"
        :pagination="paginationConfig"
        :scroll="{ x: tableScrollX }"
        row-key="id"
        @change="handleTableChange"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'unit'">
            <!-- 用能单元路径的顶级为企业名，字重加重以突出所属企业 -->
            <span class="device-cell__path" :title="unitPath(record.unitId)">
              <span class="platform-unit__enterprise">{{ unitPathParts(record.unitId).enterprise }}</span>
              <template v-if="unitPathParts(record.unitId).rest">{{ unitPathParts(record.unitId).rest }}</template>
            </span>
          </template>

          <template v-else-if="column.key === 'name'">
            <a-button type="link" size="small" class="device-cell__link" @click="openDetail(record)">
              <span :title="record.name">{{ record.name }}</span>
            </a-button>
          </template>

          <template v-else-if="column.key === 'license'">
            <span class="device-cell__mono" :title="record.license">{{ record.license }}</span>
          </template>

          <template v-else-if="column.key === 'imei'">
            <span class="device-cell__mono" :title="record.imei">{{ record.imei }}</span>
          </template>

          <template v-else-if="column.key === 'meterNo'">
            <span v-if="record.meterNo" class="device-cell__mono" :title="record.meterNo">{{ record.meterNo }}</span>
            <span v-else class="device-cell__empty">—</span>
          </template>

          <template v-else-if="column.key === 'cardNo'">
            <span v-if="record.cardNo" class="device-cell__mono" :title="record.cardNo">{{ record.cardNo }}</span>
            <span v-else class="device-cell__empty">—</span>
          </template>

          <template v-else-if="column.key === 'type'">
            <span v-if="record.type" class="device-cell__type">{{ record.type }}</span>
            <span v-else class="device-cell__empty">—</span>
          </template>

          <template v-else-if="column.key === 'model'">
            <span class="device-cell__model" :title="record.model">{{ record.model || '—' }}</span>
          </template>

          <template v-else-if="column.key === 'ratio'">
            <span v-if="ratioText(record)" class="device-cell__mono">{{ ratioText(record) }}</span>
            <span v-else class="device-cell__empty">—</span>
          </template>

          <template v-else-if="column.key === 'strategy'">
            <div v-if="record.strategyTimeCount || record.strategyLoadCount" class="device-cell__strategy">
              <span v-if="record.strategyTimeCount" class="device-cell__strategy-tag is-time">时控 {{ record.strategyTimeCount }} 条</span>
              <span v-if="record.strategyLoadCount" class="device-cell__strategy-tag is-load">负控 {{ record.strategyLoadCount }} 条</span>
            </div>
            <span v-else class="device-cell__empty">—</span>
          </template>

          <template v-else-if="column.key === 'latchStatus'">
            <span v-if="!record.latchStatus" class="device-cell__empty">—</span>
            <span v-else class="device-cell__tag" :class="record.latchStatus === '合闸' ? 'is-closed' : 'is-open'">
              {{ record.latchStatus }}
            </span>
          </template>

          <template v-else-if="column.key === 'onlineStatus'">
            <span class="device-cell__online" :class="record.onlineStatus === '在线' ? 'is-on' : 'is-off'">
              <i class="device-cell__dot" />
              {{ record.onlineStatus }}
            </span>
          </template>

          <template v-else-if="column.key === 'createdAt'">
            <div class="device-cell__time">
              <span class="device-cell__time-date">{{ formatDatePart(record.createdAt) }}</span>
              <span class="device-cell__time-clock">{{ formatTimePart(record.createdAt) }}</span>
            </div>
          </template>
        </template>
      </a-table>
    </section>

    <ProtoTip :lines="tipLines">
      <template #extra>
        <a-button size="small" @click="simulateLoadFail">模拟加载失败</a-button>
      </template>
    </ProtoTip>
  </div>
</template>

<script setup lang="ts">
/**
 * PAL-PAGE-02 客户&设备
 * 【原型说明】对齐《产品交互设计文档-客户与设备》v1.0。页面形态与「设备台账」一致，差异点：
 * ①列表首列为「所属企业」、查询首项为「所属企业」；②查询区上方新增规模统计区；
 * ③仅列表样式（无列表/卡片切换）；④无任何写操作项（新增 / 导入 / 批量删除）；
 * ⑤「所属用能单元」随「所属企业」联动：未选企业为文本模糊匹配，选定企业后为该企业的用能单元树；
 * ⑥设备名称可点击进入设备详情；⑦提供列设置，更多字段可按需勾选显示。
 */
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import type { TableColumnsType } from 'antdv-next'
import {
  ClusterOutlined,
  DisconnectOutlined,
  HomeOutlined,
  ReloadOutlined,
  RiseOutlined,
  SearchOutlined,
  ThunderboltOutlined,
} from '@antdv-next/icons'
import ProtoTip from '@/shared/components/ProtoTip.vue'
import PlatformColumnSetting from '../components/PlatformColumnSetting.vue'
import {
  PLATFORM_LATCH_OPTIONS,
  PLATFORM_ONLINE_OPTIONS,
  PLATFORM_SEARCH_MAX,
  enterpriseUnitTree,
  filterPlatformDevices,
  platformCustomerStats,
  platformDeviceTypeOptions,
  platformDevices,
  platformEnterprises,
  platformUnitPath,
  sortPlatformDevices,
  visiblePlatformColumnMetas,
  type PlatformDevice,
  type PlatformDeviceFilters,
  type PlatformUnitNode,
} from '@/modules/platform/store'

const router = useRouter()

/* ---------- 查询条件：草稿 / 生效两段式 ---------- */
const defaultFilters = (): PlatformDeviceFilters => ({
  enterpriseId: null,
  unitId: null,
  unitText: '',
  name: '',
  imei: '',
  license: '',
  meterNo: '',
  types: [],
  latchStatuses: [],
  onlineStatuses: [],
})

const draftFilters = reactive<PlatformDeviceFilters>(defaultFilters())
const filters = reactive<PlatformDeviceFilters>(defaultFilters())

const enterpriseOptions = computed(() =>
  platformEnterprises().map((item) => ({ label: item.name, value: item.id })),
)
const typeOptions = computed(() => platformDeviceTypeOptions().map((value) => ({ label: value, value })))
const latchOptions = PLATFORM_LATCH_OPTIONS.map((value) => ({ label: value, value }))
const onlineOptions = PLATFORM_ONLINE_OPTIONS.map((value) => ({ label: value, value }))

/** 「所属用能单元」树选择数据：仅当选定企业后可用，随企业联动；顶级节点为企业本身 */
const unitTree = computed(() =>
  enterpriseUnitTree(draftFilters.enterpriseId).map((node) => toTreeOption(node, 0)),
)

interface UnitTreeOption {
  value: string
  title: string
  selectable: boolean
  children?: UnitTreeOption[]
}

/** 把 {id,name,children} 转换为树控件所需的 {value,title,children}；顶级（企业）不可选、其余可选 */
function toTreeOption(node: PlatformUnitNode, depth: number): UnitTreeOption {
  const children = node.children?.map((child) => toTreeOption(child, depth + 1))
  return {
    value: node.id,
    title: node.name,
    // 顶级为企业根节点：仅作层级展示，不可选（选企业等价于「所属企业」筛选）；其余用能单元可选（含下级）
    selectable: depth > 0,
    children,
  }
}

/** 切换「所属企业」：清空「所属用能单元」选择，避免跨企业的旧值残留 */
function handleEnterpriseChange() {
  draftFilters.unitId = null
  draftFilters.unitText = ''
}

/** 规模统计区：随生效查询条件（尤其「所属企业」）联动 */
const stats = computed(() => platformCustomerStats(filters))
const onlineRateText = computed(() => (stats.value.onlineRate === null ? '—' : `${stats.value.onlineRate}%`))

const unitPath = platformUnitPath

/** 拆分用能单元路径：首段为企业名（字重加重），其余为层级路径；用能单元失效时兜底 */
function unitPathParts(unitId: string): { enterprise: string; rest: string } {
  const full = platformUnitPath(unitId)
  if (full === '—') return { enterprise: '—', rest: '' }
  const segments = full.split(' / ')
  return { enterprise: segments[0], rest: segments.length > 1 ? ` / ${segments.slice(1).join(' / ')}` : '' }
}

/** CT/PT 值展示：两者均有值时按「CT/PT」拼接，否则展示可得的一项；均无则空 */
function ratioText(device: PlatformDevice): string {
  const parts: string[] = []
  if (device.ctRatio) parts.push(`CT ${device.ctRatio}`)
  if (device.ptRatio) parts.push(`PT ${device.ptRatio}`)
  return parts.join(' / ')
}

/* ---------- 列表 ---------- */
const sortOrder = ref<'descend' | 'ascend'>('descend')
const totalCount = computed(() => platformDevices().length)
const sortedList = computed(() => sortPlatformDevices(filterPlatformDevices(filters), sortOrder.value))

const loading = ref(true)
const failed = ref(false)
const page = ref(1)
const pageSize = ref(20)

const paginationConfig = computed(() => ({
  current: page.value,
  pageSize: pageSize.value,
  size: 'small' as const,
  showSizeChanger: true,
  pageSizeOptions: ['10', '20', '50', '100'],
  showTotal: (total: number) => `共 ${total} 条`,
  hideOnSinglePage: false,
}))

/** 列：顺序与显隐由「列设置」维护；首列为「所属企业」；无操作列 */
const columns = computed<TableColumnsType<PlatformDevice>>(() =>
  visiblePlatformColumnMetas.value.map((meta) => ({
    title: meta.title,
    key: meta.key,
    width: meta.width,
    fixed: meta.fixed,
    ellipsis: meta.key !== 'onlineStatus' && meta.key !== 'latchStatus',
  })),
)

const tableScrollX = computed(() => visiblePlatformColumnMetas.value.reduce((total, column) => total + column.width, 0))

const pad = (value: number) => String(value).padStart(2, '0')
function formatDatePart(at: number) {
  const date = new Date(at)
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}
function formatTimePart(at: number) {
  const date = new Date(at)
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/* ---------- 查询与加载 ---------- */
function applyFilters() {
  Object.assign(filters, {
    ...draftFilters,
    types: [...draftFilters.types],
    latchStatuses: [...draftFilters.latchStatuses],
    onlineStatuses: [...draftFilters.onlineStatuses],
  })
  page.value = 1
  loadList()
}

function resetFilters() {
  Object.assign(draftFilters, defaultFilters())
  Object.assign(filters, defaultFilters())
  sortOrder.value = 'descend'
  page.value = 1
  loadList()
}

function handleTableChange(pagination: { current?: number; pageSize?: number }) {
  page.value = pagination.current ?? 1
  pageSize.value = pagination.pageSize ?? 20
}

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

/** 点击设备名称进入平台设备详情页 */
function openDetail(device: PlatformDevice) {
  router.push(`/platform/customer/${device.id}`)
}

const tipLines = [
  '「客户&设备」是平台端跨企业查看全平台设备的入口，页面形态与企业端「设备台账」一致，整体为只读视图。',
  '查询控件区上方为规模统计区：企业总数、设备总数、在线设备数、在线率；默认全平台口径，选定「所属企业」后随查询条件联动。',
  '查询条件首项为「所属企业」（单选）；「所属用能单元」与其联动——未选企业时为文本模糊匹配，选定企业后切换为该企业的用能单元树选择（顶级即企业本身）。',
  '「所属用能单元」列的顶级即企业名称，因此不再单列「所属企业」；点击设备名称可进入设备详情页。',
  '列表右上角「列设置」与企业端设备台账一致（仅去掉「操作」）：可勾选显示规格型号、CT/PT 值、拉合闸状态、关联负荷策略等，非固定列可拖动排序。',
  '与企业端设备台账的差异：仅支持列表样式（无列表 / 卡片切换）、无任何操作项、不支持新增设备与批量导入删除。',
  '下方按钮可快速验证列表加载失败状态，验证后请重置演示数据。',
]

onMounted(loadList)
</script>
