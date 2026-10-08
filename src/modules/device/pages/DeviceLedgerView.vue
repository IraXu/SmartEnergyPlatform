<template>
  <!-- 无页面权限：整页空态，不渲染页面头、查询条件区与列表（STATE-DEV-14） -->
  <div v-if="!canView" class="page-container device-page">
    <div class="device-denied">
      <a-empty description="当前账号无权限执行此操作" />
      <a-button type="primary" @click="router.push('/dashboard')">返回</a-button>
    </div>
  </div>

  <div v-else class="page-container device-page">
    <!-- AREA-DEV-02 查询条件区 -->
    <section class="device-filter" aria-label="设备查询条件">
      <div class="device-filter__body">
        <div class="device-field">
          <label class="device-field__label">设备名称 / 识别码 / License</label>
          <a-input
            v-model:value="draftFilters.keyword"
            class="device-field__control"
            placeholder="设备名称 / 识别码 / License"
            allow-clear
            :maxlength="SEARCH_MAX"
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
            :options="typeGroups"
          />
        </div>

        <div class="device-field">
          <label class="device-field__label">所属用能单元</label>
          <a-tree-select
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
          <label class="device-field__label">接入状态</label>
          <a-select
            v-model:value="draftFilters.accessStatuses"
            class="device-field__control"
            mode="multiple"
            allow-clear
            max-tag-count="responsive"
            placeholder="全部接入状态"
            :options="accessOptions"
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

    <!-- AREA-DEV-03 列表容器 -->
    <section class="device-list" aria-label="设备列表">
      <!-- 工具行：建档入口位于设备列表左上方，列设置位于列表右上角 -->
      <div class="device-toolbar">
        <div class="device-toolbar__actions">
          <a-button v-if="canCreateAny" type="primary" @click="openCreate()">
            <template #icon><PlusOutlined /></template>
            新增设备
          </a-button>
          <!-- 批量导入删除：上传按 License 填写的文件，一次删除多台设备；danger 样式提示其为删除类操作 -->
          <a-button v-if="can.importDelete" danger @click="openImportDelete">
            <template #icon><DeleteOutlined /></template>
            批量导入删除
          </a-button>
        </div>
        <div class="device-toolbar__setting">
          <!-- 展示方式切换：列表（默认）/ 卡片；卡片视图下无需列设置 -->
          <a-segmented v-model:value="viewMode" class="device-toolbar__view" :options="viewOptions" size="small" />
          <DeviceColumnSetting v-if="viewMode === 'list'" />
        </div>
      </div>

      <Transition name="device-selbar">
        <div v-if="viewMode === 'list' && selectedIds.length" class="device-selbar">
          <span class="device-selbar__text">
            已选择 <strong>{{ selectedIds.length }}</strong> 台设备
          </span>
          <a-space size="small">
            <a-button v-if="can.move" size="small" @click="openBatchMove">
              <template #icon><SwapOutlined /></template>
              批量迁移
            </a-button>
            <a-button v-if="can.remove" danger size="small" @click="openBatchDelete">
              <template #icon><DeleteOutlined /></template>
              批量删除
            </a-button>
            <a-button type="link" size="small" @click="clearSelection">取消选择</a-button>
          </a-space>
        </div>
      </Transition>

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

      <!-- 企业暂无设备：与「查询无结果」文案与操作均不同 -->
      <div v-else-if="!hasAnyDevice()" class="device-state">
        <span class="device-state__icon"><ClusterOutlined /></span>
        <p class="device-state__title">暂无设备</p>
        <p class="device-state__desc">当前企业还没有设备，点击「新增设备」开始建档</p>
        <a-button v-if="canCreateAny" type="primary" size="small" @click="openCreate()">
          <template #icon><PlusOutlined /></template>
          新增设备
        </a-button>
      </div>

      <div v-else-if="!sortedList.length" class="device-state">
        <span class="device-state__icon"><SearchOutlined /></span>
        <p class="device-state__title">没有符合条件的设备</p>
        <p class="device-state__desc">试试调整查询条件</p>
        <a-button type="primary" size="small" @click="resetFilters">重置查询条件</a-button>
      </div>

      <a-table
        v-else-if="viewMode === 'list'"
        class="device-table"
        :columns="columns"
        :data-source="sortedList"
        :pagination="paginationConfig"
        :row-selection="rowSelection"
        :scroll="{ x: tableScrollX }"
        row-key="id"
        @change="handleTableChange"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'name'">
            <a-button type="link" size="small" class="device-cell__link" @click="openDetail(record)">
              <span :title="record.name">{{ record.name }}</span>
            </a-button>
          </template>

          <template v-else-if="column.key === 'imei'">
            <span class="device-cell__mono" :title="record.imei">{{ record.imei }}</span>
          </template>

          <template v-else-if="column.key === 'cardNo'">
            <span v-if="record.cardNo" class="device-cell__mono" :title="record.cardNo">{{ record.cardNo }}</span>
            <span v-else class="device-cell__empty">—</span>
          </template>

          <template v-else-if="column.key === 'license'">
            <span class="device-cell__mono" :title="record.license">{{ record.license }}</span>
          </template>

          <template v-else-if="column.key === 'type'">
            <span v-if="record.type" class="device-cell__type">{{ record.type }}</span>
            <span v-else class="device-cell__empty">—</span>
          </template>

          <template v-else-if="column.key === 'model'">
            <span class="device-cell__model" :title="record.model">{{ record.model || '—' }}</span>
          </template>

          <template v-else-if="column.key === 'unit'">
            <span v-if="isUnitInvalid(record.unitId)" class="device-cell__invalid">
              {{ unitPath(record.unitId) }}
              <em>所属用能单元已失效</em>
            </span>
            <span v-else class="device-cell__path" :title="unitPath(record.unitId)">{{ unitPath(record.unitId) }}</span>
          </template>

          <template v-else-if="column.key === 'accessStatus'">
            <span class="device-cell__tag" :class="accessClass(record.accessStatus)">
              {{ record.accessStatus }}
            </span>
          </template>

          <template v-else-if="column.key === 'onlineStatus'">
            <span v-if="!record.onlineStatus" class="device-cell__empty">—</span>
            <span v-else class="device-cell__online" :class="record.onlineStatus === '在线' ? 'is-on' : 'is-off'">
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

          <template v-else-if="column.key === 'action'">
            <div class="device-cell__actions">
              <a-button v-if="can.move" type="link" size="small" @click="openMove(record)">迁移</a-button>
              <a-button v-if="can.edit" type="link" size="small" @click="openEdit(record)">编辑</a-button>
              <a-button v-if="can.remove" type="link" size="small" danger @click="openDelete(record)">删除</a-button>
              <span v-if="!can.move && !can.edit && !can.remove" class="device-cell__empty">—</span>
            </div>
          </template>
        </template>
      </a-table>

      <!-- 卡片视图：点击卡片进入设备详情；分页与列表共用同一套条件与排序 -->
      <template v-else>
        <div class="device-cards">
          <DeviceCard v-for="record in pageList" :key="record.id" :device="record" @open="openDetail" />
        </div>
        <a-pagination
          class="device-cards__pager"
          :current="page"
          :page-size="pageSize"
          :total="sortedList.length"
          :show-size-changer="true"
          :page-size-options="['10', '20', '50', '100']"
          :show-total="(total: number) => `共 ${total} 条`"
          @change="handleCardPageChange"
          @show-size-change="handleCardPageSizeChange"
        />
      </template>
    </section>

    <!-- OVERLAY-01 新增设备（含添加方式切换）/ OVERLAY-07 编辑设备 -->
    <a-modal
      v-model:open="formOpen"
      :title="formMode === 'create' ? '新增设备' : '编辑设备'"
      :width="720"
      :mask-closable="false"
      :ok-button-props="okButtonProps"
      :ok-text="isImportMode ? '开始导入' : '保存'"
      cancel-text="取消"
      @ok="handleFormSubmit"
      @cancel="handleFormCancel"
    >
      <!-- 添加方式：手动录入 / 批量导入（仅新增时出现；只有一种可用时不展示切换） -->
      <a-segmented
        v-if="formMode === 'create' && createModeOptions.length > 1"
        v-model:value="createMode"
        class="devcreate__modes"
        block
        :options="createModeOptions"
        @change="handleCreateModeChange"
      />

      <DeviceForm
        v-if="createMode !== 'import'"
        :key="formMode + createMode + formKey"
        v-model="formValue"
        :is-create="formMode === 'create'"
        :errors="formErrors"
      />

      <!-- 批量导入：面板内完成模板下载、上传与校验，点「开始导入」执行导入 -->
      <DeviceImportDialog v-else ref="importRef" @done="handleImportDone" @change="handleImportChange" />
    </a-modal>

    <!-- OVERLAY-12 批量导入删除：上传文件按 License 批量删除设备 -->
    <DeviceImportDeleteDialog v-model:open="importDeleteOpen" @done="handleImportDeleteDone" />

    <!-- OVERLAY-03 设备迁移 / OVERLAY-04 批量迁移 -->
    <DeviceMoveDialog
      v-model:open="moveOpen"
      :device="moveDevice_"
      :selected-ids="selectedIds"
      :cross-page="crossPageSelected"
      @done="handleMoveDone"
    />

    <!-- OVERLAY-05 删除确认 -->
    <a-modal
      v-model:open="deleteOpen"
      title="删除该设备？"
      :width="440"
      :mask-closable="!deleting"
      :ok-button-props="{ loading: deleting, danger: true }"
      ok-text="确认删除"
      cancel-text="取消"
      @ok="handleDeleteSubmit"
    >
      <div v-if="deleteTarget" class="device-confirm">
        <div class="device-confirm__head">
          <span class="device-confirm__name">{{ deleteTarget.name }}</span>
          <span class="device-cell__type">{{ deleteTarget.type }}</span>
        </div>
        <p class="device-confirm__meta">{{ deleteTarget.imei }} · {{ deleteTarget.license }}</p>
        <p class="device-confirm__meta">{{ unitPath(deleteTarget.unitId) }}</p>
      </div>
      <div class="device-confirm__warn">
        <p class="device-confirm__danger">删除后该设备记录将被移除，操作不可恢复。</p>
        <p>该设备已产生的历史告警仍会保留，并按告警记录中的设备名称与 License 展示。</p>
      </div>
    </a-modal>

    <!-- OVERLAY-06 批量删除确认 -->
    <a-modal
      v-model:open="batchDeleteOpen"
      title="删除所选设备？"
      :width="440"
      :mask-closable="!batchDeleting"
      :ok-button-props="{ loading: batchDeleting, danger: true }"
      ok-text="确认删除"
      cancel-text="取消"
      @ok="handleBatchDeleteSubmit"
    >
      <p class="device-confirm__lead">
        已选择 <strong>{{ selectedIds.length }}</strong> 台设备<template v-if="crossPageSelected">（含其他页的选择）</template>。
      </p>
      <div class="device-confirm__warn">
        <p class="device-confirm__danger">删除后所选设备记录将被移除，操作不可恢复。</p>
        <p>所选设备已产生的历史告警仍会保留。</p>
      </div>
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
 * PAGE-01 设备台账
 * 【原型说明】维护本企业设备档案与所属用能单元。
 * 列表字段为「选择框 / 设备名称 / License / 设备识别码（IMEI）/ 卡号 / 设备类型 /
 * 规格型号 / 所属用能单元 / 接入状态 / 在线状态 / 添加时间 / 操作」，
 * 默认按添加时间倒序、每页 20 条；
 * 支持五项条件查询与重置、跨页勾选、单条与批量迁移、单条与批量删除、
 * 新增统一入口（弹窗内切换手动录入 / 批量导入），以及按文件批量删除。
 * 本期不含设备启用 / 停用，在线状态与接入状态均为只读。
 */
import { computed, h, onMounted, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { message } from 'antdv-next'
import type { TableColumnsType, TablePaginationConfig } from 'antdv-next'
import {
  AppstoreOutlined,
  ClusterOutlined,
  DeleteOutlined,
  DisconnectOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
  SwapOutlined,
  UnorderedListOutlined,
} from '@antdv-next/icons'
import ProtoTip from '@/shared/components/ProtoTip.vue'
import { currentPermissions } from '@/modules/role/store'
import DeviceCard from '../components/DeviceCard.vue'
import DeviceColumnSetting from '../components/DeviceColumnSetting.vue'
import DeviceForm from '../components/DeviceForm.vue'
import DeviceImportDeleteDialog from '../components/DeviceImportDeleteDialog.vue'
import DeviceImportDialog from '../components/DeviceImportDialog.vue'
import DeviceMoveDialog from '../components/DeviceMoveDialog.vue'
import {
  ACCESS_STATUS_OPTIONS,
  ONLINE_STATUS_OPTIONS,
  SEARCH_MAX,
  createDevice,
  deleteDevice,
  deleteDevices,
  deviceTypeGroups,
  deviceViewMode,
  filterDevices,
  getDevice,
  hasAnyDevice,
  isUnitInvalid,
  resetDeviceLedgerData,
  sortDevices,
  unitPath,
  unitTreeData,
  updateDevice,
  validateDevice,
  visibleColumnMetas,
} from '../store'
import type {
  AccessStatus,
  Device,
  DeviceFilters,
  DeviceFormErrors,
  DeviceInput,
  SortOrder,
} from '../store'

/* ---------- 权限：按当前账号的功能权限点渲染入口 ---------- */
const perms = computed(() => currentPermissions())
const canView = computed(() => perms.value.includes('device:ledger'))
const can = computed(() => ({
  create: perms.value.includes('device:ledger:create'),
  import: perms.value.includes('device:ledger:import'),
  importDelete: perms.value.includes('device:ledger:importdelete'),
  edit: perms.value.includes('device:ledger:edit'),
  move: perms.value.includes('device:ledger:move'),
  remove: perms.value.includes('device:ledger:delete'),
}))
/** 只要拥有建档或批量导入权限，「新增设备」入口即可见（弹窗内再按方式区分） */
const canCreateAny = computed(() => can.value.create || can.value.import)

const router = useRouter()

/* ---------- 展示方式：列表（默认）/ 卡片 ---------- */
const viewMode = deviceViewMode

/** 切换入口：带图标的紧凑分段控件，避免占用过多工具行空间 */
const viewOptions = [
  { value: 'list', label: '列表', icon: () => h(UnorderedListOutlined) },
  { value: 'card', label: '卡片', icon: () => h(AppstoreOutlined) },
]

/** 卡片视图的当页数据：与表格共用筛选、排序与分页状态 */
const pageList = computed(() =>
  sortedList.value.slice((page.value - 1) * pageSize.value, page.value * pageSize.value),
)

function handleCardPageChange(current: number) {
  page.value = current
}

/** 每页条数变更后回到第 1 页，避免页码越界 */
function handleCardPageSizeChange(_current: number, size: number) {
  pageSize.value = size
  page.value = 1
}

// 卡片视图没有勾选入口：切到卡片时清空已有勾选，避免残留不可见的批量选择
watch(viewMode, (mode) => {
  if (mode === 'card') clearSelection()
})

/* ---------- 查询条件 ---------- */
const defaultFilters = (): DeviceFilters => ({
  keyword: '',
  types: [],
  unitId: null,
  accessStatuses: [],
  onlineStatuses: [],
})

/**
 * 两段式查询：草稿态绑定输入控件，生效态驱动列表。
 * 改动输入控件不立即查询（避免边输入边刷列表），点「查询」或回车才把草稿态写入生效态。
 */
const draftFilters = reactive<DeviceFilters>(defaultFilters())
const filters = reactive<DeviceFilters>(defaultFilters())
const typeGroups = computed(() => deviceTypeGroups())
const unitTree = computed(() => unitTreeData())
const accessOptions = ACCESS_STATUS_OPTIONS.map((value) => ({ label: value, value }))
const onlineOptions = ONLINE_STATUS_OPTIONS.map((value) => ({ label: value, value }))

/** 排序：仅按添加时间，两态切换（默认倒序） */
const sortOrder = ref<SortOrder>('descend')

const sortedList = computed(() => sortDevices(filterDevices(filters), sortOrder.value))

/** 点「查询」或回车：把草稿条件写入生效条件并回到第 1 页 */
function applyFilters() {
  // 数组字段需复制一份，避免草稿态后续编辑直接改动生效态
  Object.assign(filters, {
    ...draftFilters,
    types: [...draftFilters.types],
    accessStatuses: [...draftFilters.accessStatuses],
    onlineStatuses: [...draftFilters.onlineStatuses],
  })
  page.value = 1
  loadList()
}

/** 点「重置」：草稿与生效条件同时回到默认值 */
function resetFilters() {
  Object.assign(draftFilters, defaultFilters())
  Object.assign(filters, defaultFilters())
  sortOrder.value = 'descend'
  page.value = 1
  clearSelection()
  loadList()
}

/* ---------- 列表加载 ---------- */
const loading = ref(true)
const failed = ref(false)
const page = ref(1)
const pageSize = ref(20)

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
  pageSize.value = pagination.pageSize ?? 20
  // 只有点击列头排序时才改写方向；翻页与筛选不改变排序
  if (extra?.action !== 'sort') return
  const order = Array.isArray(sorter) ? sorter[0]?.order : sorter?.order
  // 表格在两个方向轮完后会返回空 order（语义为「取消排序」）。
  // 添加时间的排序方向常驻，因此这里改为翻转到另一方向，形成「降序 ⇄ 升序」两态切换。
  sortOrder.value = order ?? (sortOrder.value === 'descend' ? 'ascend' : 'descend')
}

/* ---------- 列表列：顺序与显隐由列设置维护，固定列锁定两端 ---------- */
const columns = computed<TableColumnsType<Device>>(() =>
  visibleColumnMetas.value.map((meta) => {
    const base = {
      title: meta.title,
      key: meta.key,
      width: meta.width,
      fixed: meta.fixed,
    }
    // 仅「添加时间」支持排序：固定「降序 ⇄ 升序」两态，不提供「取消排序」
    if (meta.key !== 'createdAt') return base
    return {
      ...base,
      dataIndex: 'createdAt',
      sorter: true,
      sortDirections: ['descend', 'ascend'] as SortOrder[],
      sortOrder: sortOrder.value,
      // 覆盖组件默认提示，改为描述下一次点击的方向
      showSorterTooltip: { title: sortOrder.value === 'descend' ? '点击升序' : '点击降序' },
    }
  }),
)

/** 表格横向滚动宽度：选择列 48px + 当前展示列宽度合计 */
const tableScrollX = computed(
  () => 48 + visibleColumnMetas.value.reduce((total, column) => total + column.width, 0),
)

/** 添加时间拆成「日期 / 时刻」两行展示，便于在窄列中快速扫读 */
const pad = (value: number) => String(value).padStart(2, '0')
function formatDatePart(at: number) {
  const date = new Date(at)
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}
function formatTimePart(at: number) {
  const date = new Date(at)
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`
}

const accessClass = (status: AccessStatus) => (status === '已接入' ? 'is-accessed' : 'is-pending')

/* ---------- 跨页勾选 ---------- */
const selectedIds = ref<string[]>([])

const rowSelection = computed(() => ({
  selectedRowKeys: selectedIds.value,
  columnWidth: 48,
  // 与「设备名称」一起锁定在左侧，横向滚动时勾选入口始终可用
  fixed: true,
  onChange: (keys: Array<string | number>) => {
    selectedIds.value = keys.map((key) => String(key))
  },
  // 无迁移且无删除权限时复选框不可勾选
  getCheckboxProps: () => ({ disabled: !can.value.move && !can.value.remove }),
}))

const crossPageSelected = computed(() => {
  const currentIds = sortedList.value
    .slice((page.value - 1) * pageSize.value, page.value * pageSize.value)
    .map((item) => item.id)
  return selectedIds.value.some((id) => !currentIds.includes(id))
})

function clearSelection() {
  selectedIds.value = []
}

/* ---------- 新增 / 编辑 ---------- */
/** 新增时的添加方式：手动录入 / 批量导入（同一弹窗内切换） */
type CreateMode = 'manual' | 'import'

const importRef = ref<{ submit: () => Promise<boolean>; reset: () => void } | null>(null)
/** 批量导入面板是否已有可导入的行 / 是否正在导入，用于控制主按钮可用性 */
const importReady = ref(false)
const importRunning = ref(false)
const formOpen = ref(false)
const formMode = ref<'create' | 'edit'>('create')
const createMode = ref<CreateMode>('manual')
/** 用于强制重建表单组件，避免新增与编辑之间残留上一次的输入与校验态 */
const formKey = ref(0)
const saving = ref(false)
const formErrors = ref<DeviceFormErrors>({})
const editingId = ref<string | null>(null)

/** 添加方式选项：按权限点收敛（手动录入用 `:create`，批量导入用 `:import`） */
const createModeOptions = computed(() => {
  const options = [
    { label: '手动录入', value: 'manual' as CreateMode, enabled: can.value.create },
    { label: '批量导入', value: 'import' as CreateMode, enabled: can.value.import },
  ]
  return options.filter((item) => item.enabled).map(({ label, value }) => ({ label, value }))
})

const emptyInput = (): DeviceInput => ({
  name: '',
  license: '',
  model: '',
  factory: '',
  factoryDate: '',
  unitId: '',
  installDate: '',
  installPosition: '',
  lng: null,
  lat: null,
  gpsCustom: false,
  commType: '',
  protocol: '',
  gatewayImei: '',
  remark: '',
})

const formValue = ref<DeviceInput>(emptyInput())

/** 批量导入方式：未上传文件或正在导入时禁用主按钮，避免空提交 */
const isImportMode = computed(() => formMode.value === 'create' && createMode.value === 'import')
const okButtonProps = computed(() => ({
  loading: saving.value,
  disabled: isImportMode.value && (!importReady.value || importRunning.value),
}))

function openCreate(mode?: CreateMode) {
  formMode.value = 'create'
  // 未指定添加方式时取当前有权使用的第一种（仅有批量导入权限的账号直接进入批量导入）
  const available = createModeOptions.value.map((item) => item.value)
  createMode.value = mode && available.includes(mode) ? mode : available[0] ?? 'manual'
  editingId.value = null
  formValue.value = emptyInput()
  formErrors.value = {}
  importReady.value = false
  importRunning.value = false
  formKey.value += 1
  formOpen.value = true
}

function openEdit(device: Device) {
  formMode.value = 'edit'
  createMode.value = 'manual'
  editingId.value = device.id
  formValue.value = {
    name: device.name,
    license: device.license,
    model: device.model,
    factory: device.factory,
    factoryDate: device.factoryDate,
    unitId: device.unitId,
    installDate: device.installDate,
    installPosition: device.installPosition,
    lng: device.lng,
    lat: device.lat,
    gpsCustom: device.gpsCustom,
    commType: device.commType,
    protocol: device.protocol,
    gatewayImei: device.gatewayImei,
    remark: device.remark,
  }
  formErrors.value = {}
  formKey.value += 1
  formOpen.value = true
}

/** 切换添加方式：清空校验错误；导入面板会被销毁重建，主按钮同步回到不可用态 */
function handleCreateModeChange() {
  formErrors.value = {}
  importReady.value = false
  importRunning.value = false
}

function handleFormCancel() {
  importRef.value?.reset()
  formErrors.value = {}
}

/** 导入面板状态回传：控制「开始导入」按钮的可用性与加载态 */
function handleImportChange(state: { ready: boolean; running: boolean }) {
  importReady.value = state.ready
  importRunning.value = state.running
}

async function handleFormSubmit() {
  // 批量导入方式：点「开始导入」执行导入
  if (isImportMode.value) {
    saving.value = true
    try {
      await importRef.value?.submit()
    } finally {
      saving.value = false
    }
    return
  }

  const errors = validateDevice(formValue.value, editingId.value ?? undefined)
  formErrors.value = errors
  if (Object.keys(errors).length) return

  saving.value = true
  try {
    if (formMode.value === 'create') {
      await createDevice(formValue.value)
      message.success('设备已新增')
      page.value = 1
    } else if (editingId.value) {
      await updateDevice(editingId.value, formValue.value)
      message.success('设备信息已保存')
    }
    formOpen.value = false
    loadList()
  } catch (error) {
    message.error(error instanceof Error ? error.message : '保存失败，请重试')
  } finally {
    saving.value = false
  }
}

/* ---------- 批量导入完成 ---------- */
function handleImportDone() {
  formOpen.value = false
  page.value = 1
  loadList()
}

/* ---------- 批量导入删除 ---------- */
const importDeleteOpen = ref(false)

function openImportDelete() {
  importDeleteOpen.value = true
}

/** 批量删除完成后回到第 1 页：原勾选可能已被删除，统一清空避免残留 */
function handleImportDeleteDone() {
  clearSelection()
  page.value = 1
  loadList()
}

/* ---------- 迁移（单条 / 批量） ---------- */
const moveOpen = ref(false)
const moveDevice_ = ref<Device | null>(null)

function openMove(device: Device) {
  moveDevice_.value = device
  moveOpen.value = true
}

function openBatchMove() {
  if (!selectedIds.value.length) {
    message.warning('请先勾选需要操作的设备')
    return
  }
  moveDevice_.value = null
  moveOpen.value = true
}

function handleMoveDone() {
  // 批量迁移成功后清空勾选并回到第 1 页（PRD F-DEV-08）；单条迁移仅刷新列表
  if (!moveDevice_.value) {
    clearSelection()
    page.value = 1
  }
  loadList()
}

/* ---------- 单条删除 ---------- */
const deleteOpen = ref(false)
const deleting = ref(false)
const deleteId = ref<string | null>(null)
const deleteTarget = computed(() => (deleteId.value ? getDevice(deleteId.value) : null))

function openDelete(device: Device) {
  deleteId.value = device.id
  deleteOpen.value = true
}

async function handleDeleteSubmit() {
  if (!deleteId.value) return
  const removedId = deleteId.value
  const removedPage = page.value
  deleting.value = true
  try {
    await deleteDevice(removedId)
    deleteOpen.value = false
    deleteId.value = null
    selectedIds.value = selectedIds.value.filter((id) => id !== removedId)
    // 删除后停留在当前页；当前页因此变空时回退到上一页
    const maxPage = Math.max(1, Math.ceil(sortedList.value.length / pageSize.value))
    if (removedPage > maxPage) page.value = maxPage
    message.success('设备已删除')
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
    message.warning('请先勾选需要操作的设备')
    return
  }
  batchDeleteOpen.value = true
}

async function handleBatchDeleteSubmit() {
  const ids = [...selectedIds.value]
  batchDeleting.value = true
  try {
    const result = await deleteDevices(ids)
    batchDeleteOpen.value = false
    clearSelection()
    page.value = 1
    if (result.skipped) {
      message.warning(`已删除 ${result.success} 台，${result.skipped} 台已被删除被跳过`)
    } else {
      message.success(`已删除 ${result.success} 台设备`)
    }
  } catch (error) {
    message.error(error instanceof Error ? error.message : '删除失败，请重试')
  } finally {
    batchDeleting.value = false
  }
}

/* ---------- 详情跳转 ---------- */
function openDetail(device: Device) {
  router.push(`/device/ledger/${device.id}`)
}

/* ---------- 排序变化时回到第 1 页（查询条件变更已在 applyFilters / resetFilters 中处理） ---------- */
watch(sortOrder, () => {
  page.value = 1
})

/* ---------- 演示提示 ---------- */
const tipLines = [
  '本期设备台账支持：建档（新增设备内切换添加方式）、编辑、迁移（改所属用能单元）、删除，以及设备详情页。',
  '列表 12 列：选择框 / 设备名称 / License / 设备识别码（IMEI）/ 卡号 / 设备类型 / 规格型号 / 所属用能单元 / 接入状态 / 在线状态 / 添加时间 / 操作；设备名称固定在左侧、操作列固定在右侧，每页 20 条。',
  '设备列表右上角「列设置」可调整列：非固定列可勾选隐藏、可拖动排序；设备名称 / License / 设备识别码为核心列，常驻显示不可隐藏。',
  '设备列表支持「列表 / 卡片」两种展示方式（默认列表），入口在列表右上角；卡片展示设备缩略图、设备名称、所属用能单元、设备类型、在线状态、License 与设备识别码（IMEI），点击卡片进入设备详情；License 与 IMEI 支持一键复制。',
  '卡片中的设备缩略图取自「智慧物联生态平台」，该平台未维护该设备图片（或图片加载失败）时展示默认兜底图；图片与详情页字段一致均为只读。',
  '默认按「添加时间」倒序（最新的在最上方）；点击「添加时间」列头在「降序 ⇄ 升序」两态间切换，不提供「取消排序」。',
  '查询条件五项：设备名称 / 识别码 / License（同一输入框模糊匹配）、设备类型、所属用能单元（含下级）、接入状态、在线状态；点「查询」或回车生效，「重置」回到默认条件。',
  '「新增设备」入口位于查询控件下方、设备列表左上方，一个入口覆盖两类建档方式；弹窗顶部以「添加方式」切换——手动录入 / 批量导入，切换即换弹窗内容。',
  '新增设备填 License、设备名称（必填）与归属信息（所属用能单元、安装位置描述、GPS 位置），可选填备注；不含设备类型、安装时间、规格与通信信息。',
  'License 是用户填写的设备唯一标识（必填且全平台唯一）；设备识别码（IMEI）在填写 License 后由平台查询自动带出、只读不可手填；设备类型与卡号（ICCID）由服务端在设备上云后返回。',
  'GPS 位置默认取所属用能单元的坐标（选择用能单元后自动填入），如需精确到设备安装点，可点击「地图选点」自定义；自定义后标记为「已自定义」并可一键恢复为用能单元坐标。',
  '「编辑」字段与新增保持一致：仅设备名称、License、安装位置描述、GPS 位置与备注；所属用能单元通过「迁移」调整，不在编辑中修改。',
  '「批量导入」方式下先下载模板再上传文件：模板列为设备名称 / License / 所属用能单元 / 安装位置描述 / 备注；其中「所属用能单元」填用能单元编码（在「组织架构 › 用能单元」列表中查看）；逐行校验并给出失败原因与失败报告，导入为部分成功语义（有效行入库、失败行跳过），只新增不更新已有设备。',
  '「批量导入删除」按文件批量删除设备：下载模板后仅填写 License 列，上传后逐行核对该 License 是否存在，确认删除后命中行被删除、未命中行跳过并给出说明；删除为彻底删除不可恢复，历史告警仍保留。',
  '「迁移」的唯一语义是改所属用能单元，不追溯历史数据；目标用能单元选中后回显完整层级路径，单条与批量均需二次确认，批量迁移中已在目标单元下的设备会自动跳过。',
  '「删除」为彻底删除且不可恢复，单条、批量与按文件批量删除均需二次确认；历史告警按告警记录中的设备信息保留，不因删除丢失定位。',
  '接入状态与在线状态由采集侧驱动，本页只读、不提供修改入口；设备无「启用 / 停用」状态。',
  '设备所属用能单元取自「系统管理 › 组织架构」中维护的用能单元节点；设备的历史告警在「告警中心」按所属设备筛选查看。',
]

function handleResetData() {
  resetDeviceLedgerData()
  Object.assign(draftFilters, defaultFilters())
  Object.assign(filters, defaultFilters())
  sortOrder.value = 'descend'
  clearSelection()
  page.value = 1
  loadList()
}

onMounted(loadList)
</script>
