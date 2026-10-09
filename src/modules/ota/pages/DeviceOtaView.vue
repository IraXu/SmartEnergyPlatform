<template>
  <!-- 无页面权限：整页空态，不渲染页面头、查询条件区与列表（STATE-OTA-16） -->
  <div v-if="!canView" class="page-container device-page">
    <div class="device-denied">
      <a-empty description="当前账号无权限执行此操作" />
      <a-button type="primary" @click="router.push('/dashboard')">返回</a-button>
    </div>
  </div>

  <div v-else class="page-container device-page">
    <!-- AREA-OTA-01 页面头 -->
    <header class="ota-head">
      <div class="ota-head__left">
        <h1 class="ota-head__title">设备OTA</h1>
        <p class="ota-head__desc">查看设备固件版本并升级至最新固件</p>
      </div>
      <div class="ota-head__actions">
        <a-button v-if="can.record" @click="openRecord()">
          <template #icon><HistoryOutlined /></template>
          升级进度与记录
        </a-button>
      </div>
    </header>

    <!-- AREA-OTA-02 查询条件区 -->
    <section class="device-filter" aria-label="设备查询条件">
      <div class="device-filter__body">
        <div class="device-field">
          <label class="device-field__label">设备名称 / 编号 / License</label>
          <a-input
            v-model:value="filters.keyword"
            class="device-field__control"
            placeholder="设备名称 / 编号 / License"
            allow-clear
            :maxlength="OTA_SEARCH_MAX"
            @press-enter="applyFilters"
          >
            <template #prefix><SearchOutlined class="device-field__prefix" /></template>
          </a-input>
        </div>

        <div class="device-field">
          <label class="device-field__label">设备类型</label>
          <a-select
            v-model:value="filters.types"
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
            v-model:value="filters.unitId"
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
          <label class="device-field__label">新固件标识</label>
          <a-select
            v-model:value="filters.firmwareStates"
            class="device-field__control"
            mode="multiple"
            allow-clear
            max-tag-count="responsive"
            placeholder="全部固件状态"
            :options="firmwareOptions"
          />
        </div>

        <div class="device-field">
          <label class="device-field__label">升级状态</label>
          <a-select
            v-model:value="filters.upgradeStatuses"
            class="device-field__control"
            mode="multiple"
            allow-clear
            max-tag-count="responsive"
            placeholder="全部升级状态"
            :options="upgradeOptions"
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

    <!-- AREA-OTA-03 列表容器 -->
    <section class="device-list" aria-label="设备OTA 列表">
      <!-- 进行中任务提示条 -->
      <Transition name="device-selbar">
        <div v-if="running.total" class="device-selbar ota-running">
          <span class="device-selbar__text">
            正在升级 <strong>{{ running.total }}</strong> 台设备，已完成 <strong class="is-done">{{ running.done }}</strong> 台
          </span>
          <a-button type="link" size="small" @click="openRecord()">查看进度与记录</a-button>
        </div>
      </Transition>

      <!-- 选择态操作条 -->
      <Transition name="device-selbar">
        <div v-if="selectedIds.length" class="device-selbar">
          <span class="device-selbar__text">
            已选择 <strong>{{ selectedIds.length }}</strong> 台设备
          </span>
          <a-space size="small">
            <a-button v-if="can.detect" size="small" @click="openBatchDetect">
              <template #icon><ScanOutlined /></template>
              批量检测
            </a-button>
            <a-button v-if="can.upgrade" type="primary" size="small" @click="openBatchUpgrade">
              <template #icon><RocketOutlined /></template>
              批量升级
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
        <p class="device-state__desc">当前企业还没有设备，请先在「设备台账」中建档</p>
        <a-button type="primary" size="small" @click="router.push('/device/ledger')">前往设备台账</a-button>
      </div>

      <div v-else-if="!sortedList.length" class="device-state">
        <span class="device-state__icon"><SearchOutlined /></span>
        <p class="device-state__title">没有符合条件的设备</p>
        <p class="device-state__desc">试试调整查询条件</p>
        <a-button type="primary" size="small" @click="resetFilters">重置查询条件</a-button>
      </div>

      <a-table
        v-else
        class="device-table ota-table"
        :columns="columns"
        :data-source="sortedList"
        :pagination="paginationConfig"
        :row-selection="rowSelection"
        :scroll="{ x: 1284 }"
        row-key="id"
        @change="handleTableChange"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'name'">
            <a-button type="link" size="small" class="device-cell__link" @click="openDetail(record)">
              <span :title="record.device.name">{{ record.device.name }}</span>
            </a-button>
          </template>

          <template v-else-if="column.key === 'license'">
            <span class="device-cell__mono" :title="record.device.license">{{ record.device.license }}</span>
          </template>

          <template v-else-if="column.key === 'type'">
            <span v-if="record.device.type" class="device-cell__type">{{ record.device.type }}</span>
            <span v-else class="device-cell__empty">—</span>
          </template>

          <template v-else-if="column.key === 'unit'">
            <span class="device-cell__path" :title="unitPath(record.device.unitId)">{{ unitPath(record.device.unitId) }}</span>
          </template>

          <template v-else-if="column.key === 'onlineStatus'">
            <span v-if="!record.device.onlineStatus" class="device-cell__empty">—</span>
            <span v-else class="device-cell__online" :class="record.device.onlineStatus === '在线' ? 'is-on' : 'is-off'">
              <i class="device-cell__dot" />
              {{ record.device.onlineStatus }}
            </span>
          </template>

          <!-- 固件版本：当前 → 最新 合并展示，右侧附新固件标识 -->
          <template v-else-if="column.key === 'firmware'">
            <div class="ota-firmware">
              <span class="ota-firmware__current" :title="record.currentVersion || '—'">
                {{ record.currentVersion || '—' }}
              </span>
              <span class="ota-firmware__arrow">→</span>
              <span class="ota-firmware__latest" :title="record.latestVersion || '—'">
                {{ record.latestVersion || '—' }}
              </span>
              <span v-if="record.firmwareState === '有新固件'" class="ota-version__tag">有新固件</span>
              <span
                v-else-if="record.firmwareState === '无新固件'"
                class="ota-version__hint"
                title="已是最新版本"
              >已是最新</span>
            </div>
          </template>

          <template v-else-if="column.key === 'upgradeStatus'">
            <div class="ota-status">
              <span class="ota-status__tag" :class="upgradeClass(record.upgradeStatus)">
                {{ record.upgradeStatus }}
                <template v-if="record.upgradeStatus === '升级中'"> {{ record.progress }}%</template>
              </span>
              <span
                v-if="record.upgradeStatus === '升级中'"
                class="ota-status__bar"
              >
                <i :style="{ width: `${record.progress}%` }" />
              </span>
            </div>
          </template>

          <template v-else-if="column.key === 'action'">
            <div class="device-cell__actions">
              <a-tooltip
                v-if="can.detect"
                :title="record.canDetect ? '' : detectDisabledReason(record)"
              >
                <a-button
                  type="link"
                  size="small"
                  class="ota-action--detect"
                  :disabled="!record.canDetect"
                  :loading="detectingId === record.device.id"
                  @click="handleDetect(record)"
                >检测</a-button>
              </a-tooltip>

              <!-- 升级中：行内「升级」替换为「查看进度与记录」（受 device:ota:record 控制） -->
              <a-button
                v-if="record.upgradeStatus === '升级中' && can.record"
                type="link"
                size="small"
                class="ota-action--record"
                @click="openRecord(record.taskId)"
              >查看进度与记录</a-button>
              <a-button
                v-else-if="record.upgradeStatus !== '升级中' && can.upgrade && record.canUpgrade"
                type="link"
                size="small"
                class="ota-action--upgrade"
                @click="openUpgrade(record)"
              >升级</a-button>

              <a-button
                v-if="can.content"
                type="link"
                size="small"
                class="ota-action--content"
                :disabled="!record.hasUpgradeContent"
                :title="record.hasUpgradeContent ? '' : '该设备暂无可用升级内容'"
                @click="openContent(record)"
              >升级内容</a-button>

              <span
                v-if="!can.detect && !can.upgrade && !can.content && !can.record"
                class="device-cell__empty"
              >—</span>
            </div>
          </template>
        </template>
      </a-table>
    </section>

    <!-- OVERLAY-01 升级内容 -->
    <UpgradeContentModal
      v-model:open="contentOpen"
      :device-id="contentDeviceId"
      :current-version="contentCurrentVersion"
    />

    <!-- OVERLAY-02 批量检测确认 -->
    <BatchDetectDialog
      v-model:open="detectOpen"
      :device-ids="detectTargets"
      :scope-label="detectScopeLabel"
      @done="handleDetectDone"
    />

    <!-- OVERLAY-03 升级确认 / OVERLAY-04 批量升级确认 -->
    <UpgradeConfirmModal
      ref="upgradeConfirmRef"
      v-model:open="upgradeOpen"
      :device-id="upgradeDeviceId"
      :current-version="upgradeCurrentVersion"
      :selected-ids="upgradeBatchIds"
      :cross-page="crossPageSelected"
      :upgrade-count="batchPlan.count"
      :skipped="batchPlan.skipped"
      :target-versions="batchPlan.versions"
      @submit="handleUpgradeSubmit"
    />

    <!-- OVERLAY-05 升级进度与记录 -->
    <UpgradeRecordModal v-model:open="recordOpen" :task-id="recordTaskId" />

    <ProtoTip :lines="tipLines" @reset="handleResetData">
      <template #extra>
        <a-button size="small" @click="simulateLoadFail">模拟加载失败</a-button>
        <a-button size="small" @click="simulateOffline">模拟设备离线</a-button>
        <a-button size="small" @click="simulateUpgradeFail">模拟升级失败</a-button>
      </template>
    </ProtoTip>
  </div>
</template>

<script setup lang="ts">
/**
 * PAGE-01 设备OTA
 * 【原型说明】查看设备固件版本、检测新固件、查看升级内容、发起单台与批量升级、跟进升级进度与记录。
 * 固件包由平台运营方统一维护，企业侧只读；本期仅支持手动即时升级，升级不可回滚。
 * 列表字段为「选择框 / 设备名称 / 设备 License / 设备类型 / 所属用能单元 / 在线状态 /
 * 固件版本（当前 → 最新） / 升级状态 / 操作」，固定按建档时间倒序、每页 20 条，不提供排序切换。
 * 页面头右侧为「升级进度与记录」常驻入口（进行中与历史任务均可回查）。
 */
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { message } from 'antdv-next'
import type { TableColumnsType, TablePaginationConfig } from 'antdv-next'
import {
  ClusterOutlined,
  DisconnectOutlined,
  HistoryOutlined,
  ReloadOutlined,
  RocketOutlined,
  ScanOutlined,
  SearchOutlined,
} from '@antdv-next/icons'
import ProtoTip from '@/shared/components/ProtoTip.vue'
import { currentPermissions } from '@/modules/role/store'
import { deviceTypeGroups, unitPath, unitTreeData } from '@/modules/device/store'
import UpgradeContentModal from '../components/UpgradeContentModal.vue'
import BatchDetectDialog from '../components/BatchDetectDialog.vue'
import UpgradeConfirmModal from '../components/UpgradeConfirmModal.vue'
import UpgradeRecordModal from '../components/UpgradeRecordModal.vue'
import {
  FIRMWARE_STATE_OPTIONS,
  OTA_SEARCH_MAX,
  UPGRADE_STATUS_OPTIONS,
  activeTasks,
  detectDevice,
  filterRows,
  hasAnyDevice,
  isUpgradable,
  markNextUpgradeFail,
  resetOtaDemoData,
  runningSummary,
  sortRows,
  startOtaTicker,
  stopOtaTicker,
  upgradeDevice,
  upgradeDevices,
} from '../store'
import type { DetectBatchResult, OtaFilters, OtaRow, UpgradeStatus } from '../store'

/* ---------- 权限：按当前账号的功能权限点渲染入口 ---------- */
const perms = computed(() => currentPermissions())
const canView = computed(() => perms.value.includes('device:ota'))
const can = computed(() => ({
  detect: perms.value.includes('device:ota:detect'),
  upgrade: perms.value.includes('device:ota:upgrade'),
  content: perms.value.includes('device:ota:content'),
  record: perms.value.includes('device:ota:record'),
}))

const router = useRouter()

/* ---------- 查询条件 ---------- */
const defaultFilters = (): OtaFilters => ({
  keyword: '',
  types: [],
  unitId: null,
  firmwareStates: [],
  upgradeStatuses: [],
})

const filters = reactive<OtaFilters>(defaultFilters())
const typeGroups = computed(() => deviceTypeGroups())
const unitTree = computed(() => unitTreeData())
const firmwareOptions = FIRMWARE_STATE_OPTIONS.map((value) => ({ label: value, value }))
const upgradeOptions = UPGRADE_STATUS_OPTIONS.map((value) => ({ label: value, value }))

/** 列表顺序固定按建档时间倒序（最新建档在前），不提供排序切换 */
const sortedList = computed(() => sortRows(filterRows(filters)))

/** 进行中升级任务汇总（列表提示条） */
const running = ref(runningSummary())

function applyFilters() {
  page.value = 1
  loadList()
}

function resetFilters() {
  Object.assign(filters, defaultFilters())
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

/** 【原型说明】把当前列表中的在线设备标记为离线，用于验证检测与升级失败路径 */
function simulateOffline() {
  const targets = filterRows(filters).filter((row) => row.device.onlineStatus === '在线')
  if (!targets.length) {
    message.info('当前列表中没有在线设备可供模拟')
    return
  }
  targets.slice(0, 2).forEach((row) => {
    row.device.onlineStatus = '离线'
  })
  message.success(`已把 ${Math.min(2, targets.length)} 台在线设备标记为离线，可继续验证检测与升级失败`)
}

/** 【原型说明】标记下一次升级任务首台设备失败 */
function simulateUpgradeFail() {
  markNextUpgradeFail()
  message.info('已标记：下一次升级的首台设备将被演示为升级失败')
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

function handleTableChange(pagination: TablePaginationConfig) {
  page.value = pagination.current ?? 1
  pageSize.value = pagination.pageSize ?? 20
}

const columns: TableColumnsType<OtaRow> = [
  { title: '设备名称', key: 'name', width: 150 },
  { title: '设备 License', key: 'license', width: 168 },
  { title: '设备类型', key: 'type', width: 116 },
  { title: '所属用能单元', key: 'unit', width: 186 },
  { title: '在线状态', key: 'onlineStatus', width: 100 },
  { title: '固件版本（当前 → 最新）', key: 'firmware', width: 236 },
  { title: '升级状态', key: 'upgradeStatus', width: 128 },
  { title: '操作', key: 'action', width: 152 },
]

const upgradeClass = (status: UpgradeStatus) => {
  if (status === '升级中') return 'is-running'
  if (status === '升级成功') return 'is-success'
  if (status === '升级失败') return 'is-failed'
  return 'is-idle'
}

const detectingId = ref<string | null>(null)

/** 检测入口禁用原因（悬停说明） */
function detectDisabledReason(row: OtaRow) {
  if (row.device.accessedAt === null) return '设备从未建连，无法进行 OTA 操作'
  if (row.upgradeStatus === '升级中') return '设备升级中，请等待升级完成'
  return ''
}

/* ---------- 跨页勾选 ---------- */
const selectedIds = ref<string[]>([])

const rowSelection = computed(() => ({
  selectedRowKeys: selectedIds.value,
  columnWidth: 48,
  onChange: (keys: Array<string | number>) => {
    selectedIds.value = keys.map((key) => String(key))
  },
  // 无检测且无升级权限、或设备不可检测与升级时不可勾选
  getCheckboxProps: (record: OtaRow) => ({
    disabled: (!can.value.detect && !can.value.upgrade) || !isSelectable(record),
  }),
}))

/** 选择框是否可用：从未建连与升级中设备不可勾选 */
function isSelectable(row: OtaRow) {
  const connected = row.device.accessedAt !== null
  return connected && row.upgradeStatus !== '升级中'
}

const crossPageSelected = computed(() => {
  const currentIds = sortedList.value
    .slice((page.value - 1) * pageSize.value, page.value * pageSize.value)
    .map((item) => item.device.id)
  return selectedIds.value.some((id) => !currentIds.includes(id))
})

function clearSelection() {
  selectedIds.value = []
}

/** 取设备标识对应的列表行 */
const rowOf = (deviceId: string) => filterRows(defaultFilters()).find((row) => row.device.id === deviceId) ?? null

/* ---------- 查看设备详情 ---------- */
function openDetail(row: OtaRow) {
  router.push(`/device/ledger/${row.device.id}`)
}

/* ---------- 单台检测 ---------- */
async function handleDetect(row: OtaRow) {
  if (!row.canDetect) {
    message.warning(detectDisabledReason(row) || '当前设备不支持检测')
    return
  }
  detectingId.value = row.device.id
  try {
    const result = await detectDevice(row.device.id)
    if (result.state === '有新固件') message.success(`检测完成：发现新固件 ${result.version}`)
    else message.success('检测完成：已是最新版本')
  } catch (error) {
    message.error(error instanceof Error ? error.message : '检测失败，请重试')
  } finally {
    detectingId.value = null
  }
}

/* ---------- 批量检测（选择态操作条触发 OVERLAY-02） ---------- */
const detectOpen = ref(false)
const detectTargets = ref<string[]>([])
const detectScopeLabel = ref('')

function openBatchDetect() {
  detectTargets.value = [...selectedIds.value]
  detectScopeLabel.value = '检测范围：已勾选的设备'
  detectOpen.value = true
}

/** 批量检测完成：清空勾选并刷新列表（结果提示由浮层给出） */
function handleDetectDone(_result: DetectBatchResult) {
  clearSelection()
  loadList()
}

/* ---------- 升级内容 ---------- */
const contentOpen = ref(false)
const contentDeviceId = ref<string | null>(null)
const contentCurrentVersion = ref('')

function openContent(row: OtaRow) {
  if (!row.hasUpgradeContent) {
    message.warning('该设备暂无可用升级内容')
    return
  }
  contentDeviceId.value = row.device.id
  contentCurrentVersion.value = row.currentVersion
  contentOpen.value = true
}

/* ---------- 单台升级 ---------- */
const upgradeOpen = ref(false)
const upgradeDeviceId = ref<string | null>(null)
const upgradeCurrentVersion = ref('')
const upgradeBatchIds = ref<string[]>([])
const upgradeConfirmRef = ref<{ finish: () => void } | null>(null)

/** 批量升级预案：可升级台数与跳过台数 */
const batchPlan = computed(() => {
  const targets = upgradeBatchIds.value
    .map((id) => rowOf(id))
    .filter((row): row is OtaRow => Boolean(row))
  const upgradable = targets.filter((row) => isUpgradable(row.device))
  return {
    count: upgradable.length,
    skipped: targets.length - upgradable.length,
    versions: Array.from(new Set(upgradable.map((row) => row.latestVersion).filter(Boolean))),
  }
})

function openUpgrade(row: OtaRow) {
  if (!row.canUpgrade) {
    message.warning('该设备当前不可升级')
    return
  }
  upgradeDeviceId.value = row.device.id
  upgradeCurrentVersion.value = row.currentVersion
  upgradeBatchIds.value = []
  upgradeOpen.value = true
}

function openBatchUpgrade() {
  const targets = selectedIds.value.map((id) => rowOf(id)).filter((row): row is OtaRow => Boolean(row))
  const upgradable = targets.filter((row) => isUpgradable(row.device))
  if (!upgradable.length) {
    message.warning('所选设备均无需升级')
    return
  }
  upgradeDeviceId.value = null
  upgradeBatchIds.value = [...selectedIds.value]
  upgradeOpen.value = true
}

async function handleUpgradeSubmit() {
  try {
    if (upgradeBatchIds.value.length) {
      const result = await upgradeDevices(upgradeBatchIds.value)
      upgradeConfirmRef.value?.finish()
      upgradeOpen.value = false
      clearSelection()
      loadList()
      running.value = runningSummary()
      openRecord(result.task.id)
      message.success(`已提交 ${result.upgradeCount} 台设备升级，跳过 ${result.skipped} 台`)
    } else if (upgradeDeviceId.value) {
      const task = await upgradeDevice(upgradeDeviceId.value)
      upgradeConfirmRef.value?.finish()
      upgradeOpen.value = false
      loadList()
      running.value = runningSummary()
      openRecord(task.id)
      message.success('升级已下发，正在升级')
    }
  } catch (error) {
    upgradeConfirmRef.value?.finish()
    message.error(error instanceof Error ? error.message : '升级下发失败，请重试')
  }
}

/* ---------- 升级进度与记录 ---------- */
const recordOpen = ref(false)
const recordTaskId = ref<string | null>(null)

/**
 * 打开升级进度与记录浮层。
 * 【原型说明】不传 taskId 时（页面头入口、进行中任务提示条）由浮层自动展开第一个进行中任务；
 * 传入 taskId 时（行内「查看进度与记录」、升级提交后）展开该任务。
 * 权限按「入口渲染」控制（无 `device:ota:record` 时页面头与行内入口不渲染），
 * 进行中任务提示条的入口按产品决策**不受权限控制**（正在升级时总能看进度），故此处不守卫。
 */
function openRecord(taskId?: string | null) {
  recordTaskId.value = taskId ?? activeTasks()[0]?.id ?? null
  recordOpen.value = true
}

/* ---------- 升级节拍器与刷新 ---------- */
let refreshTimer: number | null = null

onMounted(() => {
  loadList()
  startOtaTicker()
  // 【原型说明】升级进度需要实时性：局部刷新提示条；存在升级中设备时刷新列表
  refreshTimer = window.setInterval(() => {
    running.value = runningSummary()
  }, 1200)
})

onBeforeUnmount(() => {
  stopOtaTicker()
  if (refreshTimer !== null) window.clearInterval(refreshTimer)
})

/* ---------- 演示数据重置 ---------- */
function handleResetData() {
  resetOtaDemoData()
  loadList()
}

const tipLines = [
  '固件包由平台运营方统一维护，企业侧只读；本期仅支持手动即时升级，升级不可回滚。',
  '新固件标识由「当前固件版本」与「最新固件版本」比较自动得出；检测可刷新设备真实版本。',
  '批量升级会跳过已是最新、从未建连与升级中的设备；升级进度以定时器模拟推进。',
  '演示数据：设备与设备类型取自「设备台账」，固件基线为演示数据。',
]
</script>
