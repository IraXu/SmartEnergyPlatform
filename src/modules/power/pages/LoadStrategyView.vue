<template>
  <!-- 无页面权限：整页空态，不渲染查询条件区与列表（STATE-LST-16） -->
  <div v-if="!can.view" class="page-container device-page">
    <div class="device-denied">
      <a-empty description="当前账号无权限执行此操作" />
      <a-button type="primary" @click="router.push('/dashboard')">返回</a-button>
    </div>
  </div>

  <div v-else class="page-container device-page">
    <!-- AREA-LST-02 查询条件区 -->
    <section class="device-filter" aria-label="负荷策略查询条件">
      <div class="device-filter__body">
        <div class="device-field">
          <label class="device-field__label">策略名称</label>
          <a-input
            v-model:value="draftFilters.keyword"
            class="device-field__control"
            placeholder="策略名称"
            allow-clear
            :maxlength="SEARCH_MAX"
            @press-enter="applyFilters"
          >
            <template #prefix><SearchOutlined class="device-field__prefix" /></template>
          </a-input>
        </div>

        <div class="device-field">
          <label class="device-field__label">触发方式</label>
          <a-select
            v-model:value="draftFilters.triggerTypes"
            class="device-field__control"
            mode="multiple"
            allow-clear
            max-tag-count="responsive"
            placeholder="全部触发方式"
            :options="triggerOptions"
          />
        </div>

        <div class="device-field">
          <label class="device-field__label">状态</label>
          <a-select
            v-model:value="draftFilters.statuses"
            class="device-field__control"
            mode="multiple"
            allow-clear
            max-tag-count="responsive"
            placeholder="全部状态"
            :options="statusOptions"
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

    <!-- AREA-LST-03 列表容器 -->
    <section class="device-list" aria-label="负荷策略列表">
      <!-- 工具行：新建策略位于列表左上方，执行记录位于列表右上角 -->
      <div class="device-toolbar">
        <div class="device-toolbar__actions">
          <a-button v-if="can.create" type="primary" @click="openCreate">
            <template #icon><PlusOutlined /></template>
            新建策略
          </a-button>
        </div>
        <div class="device-toolbar__setting">
          <a-button v-if="can.record" @click="recordOpen = true">
            <template #icon><HistoryOutlined /></template>
            执行记录
          </a-button>
        </div>
      </div>

      <div v-if="loading" class="device-list__skeleton">
        <a-skeleton active :paragraph="{ rows: 6 }" />
      </div>

      <div v-else-if="failed" class="device-state">
        <span class="device-state__icon device-state__icon--error"><DisconnectOutlined /></span>
        <p class="device-state__title">策略列表加载失败</p>
        <p class="device-state__desc">网络异常或服务暂时不可用，请稍后重试</p>
        <a-button type="primary" size="small" @click="loadList">
          <template #icon><ReloadOutlined /></template>
          重新加载
        </a-button>
      </div>

      <!-- 企业暂无策略：与「查询无结果」文案与操作均不同 -->
      <div v-else-if="!hasAnyStrategy()" class="device-state">
        <span class="device-state__icon"><ControlOutlined /></span>
        <p class="device-state__title">暂无负荷策略</p>
        <p class="device-state__desc">当前企业还没有负荷策略，点击「新建策略」开始配置</p>
        <a-button v-if="can.create" type="primary" size="small" @click="openCreate">新建策略</a-button>
      </div>

      <div v-else-if="!sortedList.length" class="device-state">
        <span class="device-state__icon"><SearchOutlined /></span>
        <p class="device-state__title">没有符合条件的策略</p>
        <p class="device-state__desc">试试调整查询条件</p>
        <a-button type="primary" size="small" @click="resetFilters">重置查询条件</a-button>
      </div>

      <a-table
        v-else
        class="device-table lst-table"
        :columns="columns"
        :data-source="sortedList"
        :pagination="paginationConfig"
        :scroll="{ x: TABLE_SCROLL_X }"
        row-key="id"
        @change="handleTableChange"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'name'">
            <a-button type="link" size="small" class="device-cell__link" @click="openDetail(record.id)">
              <span :title="record.name">{{ record.name }}</span>
            </a-button>
          </template>

          <template v-else-if="column.key === 'triggerType'">
            <span class="lst-tag" :class="triggerTagClass(record)">{{ record.triggerType }}</span>
          </template>

          <!-- 周期摘要：动作词按拉闸 / 合闸着色，便于扫读 -->
          <template v-else-if="column.key === 'summary'">
            <span class="lst-summary" :title="summaryText(record)">
              <template v-for="(segment, index) in summarySegments(record)" :key="index">
                <strong
                  v-if="segment.action"
                  class="lst-action"
                  :class="segment.action === '拉闸' ? 'lst-action--close' : 'lst-action--open'"
                >{{ segment.text }}</strong>
                <span v-else>{{ segment.text }}</span>
              </template>
            </span>
          </template>

          <!-- 作用对象：仅展示计数，具体单元与设备在抽屉内核对（OVERLAY-05） -->
          <template v-else-if="column.key === 'scope'">
            <a-button
              type="link"
              size="small"
              class="device-cell__link lst-scope-link"
              :title="scopeTitle(record)"
              @click="openScope(record.id)"
            >
              {{ scopeCountText(record) }}
            </a-button>
          </template>

          <template v-else-if="column.key === 'range'">
            <span class="lst-range">{{ effectiveRangeText(record) }}</span>
          </template>

          <!-- 状态列：开关表达启用 / 停用，右侧文字标注生效状态（不只依赖颜色） -->
          <template v-else-if="column.key === 'status'">
            <div class="lst-status">
              <a-switch
                v-if="can.toggle"
                :checked="record.enabled"
                size="small"
                @change="(checked: boolean) => handleToggle(record, checked)"
              />
              <span v-else class="lst-status__text">{{ record.enabled ? '启用' : '停用' }}</span>
              <span class="lst-status__effective" :class="effectiveClass(record)">{{ effectiveStateOf(record) }}</span>
            </div>
          </template>

          <template v-else-if="column.key === 'remark'">
            <span v-if="record.remark" class="lst-remark" :title="record.remark">{{ record.remark }}</span>
            <span v-else class="device-cell__empty">—</span>
          </template>

          <template v-else-if="column.key === 'updatedAt'">
            <span class="lst-range">{{ formatTime(record.updatedAt) }}</span>
          </template>

          <template v-else-if="column.key === 'updatedBy'">
            <span class="lst-operator">{{ record.updatedBy }}</span>
          </template>

          <template v-else-if="column.key === 'action'">
            <!-- 查看详情由「策略名称」承载，操作列只保留写操作，避免同一入口重复出现 -->
            <div class="device-cell__actions">
              <a-button v-if="can.edit" type="link" size="small" @click="openEdit(record.id)">编辑</a-button>
              <a-button v-if="can.remove" type="link" size="small" danger @click="askRemove(record)">
                删除
              </a-button>
              <span v-if="!can.edit && !can.remove" class="device-cell__empty">—</span>
            </div>
          </template>
        </template>
      </a-table>
    </section>

    <!-- OVERLAY-01 新建 / 编辑策略 -->
    <StrategyForm
      v-model:open="formOpen"
      :strategy-id="formStrategyId"
      @save="handleFormSave"
    />

    <!-- OVERLAY-02 保存确认 -->
    <StrategyConfirmModal
      ref="confirmRef"
      v-model:open="confirmOpen"
      :input="pendingInput"
      @confirm="handleConfirmSave"
    />

    <!-- OVERLAY-03 策略详情（只读，编辑走操作列，由父组件切换为编辑态浮层） -->
    <StrategyDetailModal v-model:open="detailOpen" :strategy-id="detailId" />

    <!-- OVERLAY-04 执行记录 -->
    <StrategyRecordModal v-model:open="recordOpen" />

    <!-- OVERLAY-05 作用对象（所选用电单元与设备明细） -->
    <StrategyScopeDrawer v-model:open="scopeOpen" :strategy-id="scopeStrategyId" />

    <ProtoTip :lines="tipLines" @reset="handleResetData">
      <template #extra>
        <a-button size="small" @click="simulateLoadFail">模拟加载失败</a-button>
        <a-button size="small" @click="simulateExecute">模拟策略触发</a-button>
      </template>
    </ProtoTip>
  </div>
</template>

<script setup lang="ts">
/**
 * PAGE-01 负荷策略
 * 【原型说明】查看与维护本企业的负荷策略：新建（时控 / 负控）、编辑、启用停用、删除、查看详情与执行记录。
 * 触发方式两类：时控（按日 / 按周 / 一次性 + 时间点）与负控（事件 + 动作成对配置，命中事件即执行对应动作）。
 * 作用对象：作用用电单元必选，作用设备留空表示该单元下全部设备（动态范围）；
 * 列表只展示「N 个单元 · M 个设备」计数，点开抽屉核对具体单元与设备。
 * 查询为两段式：输入控件绑定草稿条件，点「查询」或回车才写入生效条件并刷新列表。
 */
import { computed, h, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { Modal, message } from 'antdv-next'
import type { TableColumnsType, TablePaginationConfig } from 'antdv-next'
import {
  ControlOutlined,
  DisconnectOutlined,
  HistoryOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
} from '@antdv-next/icons'
import ProtoTip from '@/shared/components/ProtoTip.vue'
import { currentPermissions } from '@/modules/role/store'
import StrategyForm from '../components/StrategyForm.vue'
import StrategyConfirmModal from '../components/StrategyConfirmModal.vue'
import StrategyDetailModal from '../components/StrategyDetailModal.vue'
import StrategyRecordModal from '../components/StrategyRecordModal.vue'
import StrategyScopeDrawer from '../components/StrategyScopeDrawer.vue'
import {
  SEARCH_MAX,
  STATUS_OPTIONS,
  TRIGGER_TYPE_OPTIONS,
  createStrategy,
  effectiveRangeText,
  effectiveStateOf,
  executeStrategy,
  filterStrategies,
  formatTime,
  hasAnyStrategy,
  latchedDevicesOf,
  removeStrategy,
  resetStrategyData,
  scopeStats,
  scopeUnitPaths,
  sortStrategies,
  summarySegments,
  summaryText,
  toggleStrategy,
  updateStrategy,
  type Strategy,
  type StrategyFilters,
  type StrategyInput,
} from '../store'

/* ---------- 权限：按当前账号的功能权限点渲染入口 ---------- */
const perms = computed(() => currentPermissions())
const can = computed(() => ({
  view: perms.value.includes('device:power:strategy'),
  create: perms.value.includes('device:power:strategy:create'),
  edit: perms.value.includes('device:power:strategy:edit'),
  toggle: perms.value.includes('device:power:strategy:toggle'),
  remove: perms.value.includes('device:power:strategy:delete'),
  record: perms.value.includes('device:power:strategy:record'),
}))

const router = useRouter()

/* ---------- 查询条件 ----------
   两段式：草稿态绑定输入控件，生效态驱动列表。
   改动控件不立即查询（避免边输入边刷列表），点「查询」或回车才把草稿态写入生效态。 */
const defaultFilters = (): StrategyFilters => ({ keyword: '', triggerTypes: [], statuses: [] })

const draftFilters = reactive<StrategyFilters>(defaultFilters())
const filters = reactive<StrategyFilters>(defaultFilters())

const triggerOptions = TRIGGER_TYPE_OPTIONS.map((value) => ({ label: value, value }))
const statusOptions = STATUS_OPTIONS.map((value) => ({ label: value, value }))

/** 列表顺序固定按创建时间倒序（最新创建在前），不提供排序切换 */
const sortedList = computed(() => sortStrategies(filterStrategies(filters)))

/** 点「查询」或回车：把草稿条件写入生效条件并回到第 1 页 */
function applyFilters() {
  // 数组字段需复制一份，避免草稿态后续编辑直接改动生效态
  Object.assign(filters, {
    ...draftFilters,
    triggerTypes: [...draftFilters.triggerTypes],
    statuses: [...draftFilters.statuses],
  })
  page.value = 1
  loadList()
}

/** 点「重置」：草稿与生效条件同时回到默认值 */
function resetFilters() {
  Object.assign(draftFilters, defaultFilters())
  Object.assign(filters, defaultFilters())
  page.value = 1
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

function handleTableChange(pagination: TablePaginationConfig) {
  page.value = pagination.current ?? 1
  pageSize.value = pagination.pageSize ?? 20
}

/** 列较多（合计宽超出容器）时横向滚动；名称与操作分列两端锁定，滚动时始终可见 */
const columns: TableColumnsType<Strategy> = [
  { title: '策略名称', key: 'name', width: 168, fixed: 'left' },
  { title: '触发方式', key: 'triggerType', width: 96 },
  { title: '策略周期 / 触发条件', key: 'summary', width: 296 },
  { title: '作用对象', key: 'scope', width: 168 },
  { title: '生效期', key: 'range', width: 190 },
  { title: '状态', key: 'status', width: 132 },
  { title: '备注', key: 'remark', width: 180 },
  { title: '更新时间', key: 'updatedAt', width: 150 },
  { title: '操作人', key: 'updatedBy', width: 108 },
  { title: '操作', key: 'action', width: 124, fixed: 'right' },
]

/** 表格横向滚动宽度 = 各列宽合计，列宽调整时同步维护 */
const TABLE_SCROLL_X = columns.reduce((total, column) => total + (column.width as number), 0)

/* ---------- 生效状态配色 ---------- */
function effectiveClass(strategy: Strategy) {
  const state = effectiveStateOf(strategy)
  if (state === '生效中') return 'is-active'
  if (state === '待生效') return 'is-pending'
  return 'is-idle'
}

/** 触发方式标签配色类名（时控主色系 / 负控警告色系） */
const triggerTagClass = (strategy: Strategy) => (strategy.triggerType === '时控' ? 'lst-tag--time' : 'lst-tag--event')

/* ---------- 作用对象展示 ---------- */
/** 作用对象计数：N 个单元 · M 个设备（设备数按当前解析结果统计） */
function scopeCountText(strategy: Strategy) {
  return `${strategy.unitIds.length} 个单元 · ${scopeStats(strategy).total} 个设备`
}

function scopeTitle(strategy: Strategy) {
  return scopeUnitPaths(strategy)
    .map((item) => item.path)
    .join('；')
}

/* ---------- 新建 / 编辑 ---------- */
const formOpen = ref(false)
const formStrategyId = ref<string | null>(null)

function openCreate() {
  formStrategyId.value = null
  formOpen.value = true
}

function openEdit(id: string) {
  formStrategyId.value = id
  formOpen.value = true
}

/* ---------- 保存确认 ---------- */
const confirmOpen = ref(false)
const pendingInput = ref<StrategyInput | null>(null)
const confirmRef = ref<{ finish: () => void } | null>(null)

/** 表单校验通过：打开确认弹窗，复述完整配置 */
function handleFormSave(input: StrategyInput) {
  pendingInput.value = input
  confirmOpen.value = true
}

async function handleConfirmSave() {
  if (!pendingInput.value) return
  try {
    if (formStrategyId.value) {
      updateStrategy(formStrategyId.value, pendingInput.value)
      message.success('策略已更新')
    } else {
      createStrategy(pendingInput.value)
      message.success('策略已创建并启用')
    }
    confirmRef.value?.finish()
    confirmOpen.value = false
    formOpen.value = false
    pendingInput.value = null
    loadList()
  } catch (error) {
    confirmRef.value?.finish()
    message.error(error instanceof Error ? error.message : '保存失败，请重试')
  }
}

/* ---------- 详情 ---------- */
const detailOpen = ref(false)
const detailId = ref<string | null>(null)

function openDetail(id: string) {
  detailId.value = id
  detailOpen.value = true
}

/* ---------- 作用对象抽屉 ---------- */
const scopeOpen = ref(false)
const scopeStrategyId = ref<string | null>(null)

function openScope(id: string) {
  scopeStrategyId.value = id
  scopeOpen.value = true
}

/* ---------- 二次确认（停用 / 删除共用同一套版式） ---------- */
/**
 * 二次确认弹窗内容：先复述被操作对象（名称 + 触发方式 + 范围 + 触发配置），
 * 再分区给出影响说明与已拉闸设备提示。两种操作只换文案，版式保持一致。
 */
function confirmContent(
  strategy: Strategy,
  lead: { danger?: string; note: string },
  latchText: string,
) {
  const latched = latchedDevicesOf(strategy.id)
  return () =>
    h('div', { class: 'lst-remove' }, [
      h('div', { class: 'lst-remove__target' }, [
        h('p', { class: 'lst-remove__name' }, [
          strategy.name,
          h('span', { class: `lst-tag ${triggerTagClass(strategy)}` }, strategy.triggerType),
        ]),
        h('p', { class: 'lst-remove__meta' }, [
          `${strategy.unitIds.length} 个单元 · ${scopeStats(strategy).total} 个设备`,
          h('br'),
          summaryText(strategy),
        ]),
      ]),
      h('div', { class: 'lst-remove__warn' }, [
        lead.danger ? h('p', { class: 'lst-remove__danger' }, lead.danger) : null,
        h('p', {}, lead.note),
      ]),
      latched.length ? h('div', { class: 'lst-remove__latch' }, latchText.replace('{n}', String(latched.length))) : null,
    ])
}

/* ---------- 启用 / 停用 ---------- */
/** 停用需二次确认；存在已拉闸且未合闸设备时追加提示；启用直接生效 */
function handleToggle(strategy: Strategy, checked: boolean) {
  if (checked) {
    toggleStrategy(strategy.id, true)
    message.success('策略已启用')
    return
  }
  Modal.confirm({
    title: '停用该策略？',
    icon: null,
    width: 460,
    okText: '确认停用',
    okType: 'danger',
    cancelText: '取消',
    content: confirmContent(
      strategy,
      { note: '停用后该策略不再自动拉合闸，已在执行中的批次不受影响。' },
      '该策略当前有 {n} 台设备处于已拉闸状态，停用后不会自动合闸，请先确认现场送电方式。',
    ),
    onOk: () => {
      toggleStrategy(strategy.id, false)
      message.success('策略已停用，不再自动拉合闸')
      loadList()
    },
    onCancel: () => {
      // 取消时开关保持原状（受控开关由列表数据渲染，无需额外处理）
    },
  })
}

/* ---------- 删除 ---------- */
/** 删除不可恢复：与停用同一套版式，把不可恢复与已拉闸设备的影响分别说明 */
function askRemove(strategy: Strategy) {
  Modal.confirm({
    title: '删除该策略？',
    icon: null,
    width: 460,
    okText: '确认删除',
    okType: 'danger',
    cancelText: '取消',
    content: confirmContent(
      strategy,
      {
        danger: '删除后该策略将被移除，操作不可恢复。',
        note: '该策略已产生的执行记录会保留，仍可在「执行记录」中查看。',
      },
      '该策略当前有 {n} 台设备处于已拉闸状态，删除后不会自动合闸，请先确认现场送电方式。',
    ),
    onOk: async () => {
      try {
        removeStrategy(strategy.id)
        message.success('策略已删除')
        loadList()
      } catch (error) {
        message.error(error instanceof Error ? error.message : '删除失败，请重试')
      }
    },
  })
}

/* ---------- 执行记录 ---------- */
const recordOpen = ref(false)

/* ---------- 演示入口 ---------- */
/** 【原型说明】触发一次启用中时控策略的执行，用于验证执行记录与「拉闸优先」裁决 */
async function simulateExecute() {
  const target = sortedList.value.find((item) => item.triggerType === '时控' && effectiveStateOf(item) === '生效中')
  if (!target) {
    message.info('当前没有生效中的时控策略可供模拟')
    return
  }
  const action = target.timePoints[0]?.action ?? '拉闸'
  const batch = await executeStrategy(target.id, action)
  if (!batch) {
    message.info('本次合闸请求被「拉闸优先」裁决拦截，未下发')
    return
  }
  message.success(`已模拟触发「${target.name}」，${batch.devices.length} 台设备参与执行`)
}

function handleResetData() {
  resetStrategyData()
  Object.assign(draftFilters, defaultFilters())
  Object.assign(filters, defaultFilters())
  loadList()
}

onMounted(loadList)

const tipLines = [
  '触发方式两类：时控（按日 / 按周 / 一次性 + 时间点）与负控（按事件 + 动作成对配置，命中指定事件即执行拉闸 / 合闸）。',
  '作用对象 = 作用用电单元 + 作用设备；作用设备留空表示作用于所选用电单元下的全部设备（动态范围），列表点开可核对具体单元与设备。',
  '查询为两段式：输入条件后需点「查询」或回车才会生效，点「重置」清空全部条件。',
  '拉合闸为高风险动作：保存前统一二次确认并复述完整配置与作用设备台数；停用需二次确认、启用直接生效。',
  '多策略命中同一设备时按「拉闸优先」裁决：任一策略要求拉闸则拉闸，全部条件解除后才合闸。',
  '演示数据：设备取自「设备台账」，用能单元取自「组织架构」，事件类型取自「告警中心」。',
]
</script>
