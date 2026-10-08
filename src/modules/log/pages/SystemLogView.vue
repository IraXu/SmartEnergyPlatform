<template>
  <!-- STATE-LOG-12 无页面权限 -->
  <div v-if="!canView" class="page-container log-page">
    <div class="log-denied">
      <a-empty description="当前账号无权限访问系统日志" />
      <a-button type="primary" @click="router.push('/dashboard')">返回</a-button>
    </div>
  </div>

  <div v-else class="page-container log-page">
    <!-- AREA-LOG-01 留存周期提示（warning Alert，常驻顶部） -->
    <a-alert
      class="log-retention"
      type="warning"
      show-icon
      :closable="false"
      :message="`登录日志与操作行为日志均保留 ${RETENTION_MONTHS} 个月，超出留存期的记录将自动归档、不再展示，如有需要请及时导出留存`"
    />

    <!-- AREA-LOG-02 日志类型页签（CMP-LOG-03） -->
    <div class="log-tabs" role="tablist" aria-label="日志类型">
      <button
        v-for="tab in TAB_ITEMS"
        :key="tab.key"
        type="button"
        role="tab"
        class="log-tabs__item"
        :class="{ 'log-tabs__item--active': activeTab === tab.key }"
        :aria-selected="activeTab === tab.key"
        @click="switchTab(tab.key)"
      >
        {{ tab.label }}
      </button>
    </div>

    <!-- AREA-LOG-03 筛选区：条件仅修改草稿，点「查询」后才生效（各页签条件独立保留） -->
    <section class="log-filter" aria-label="日志查询条件">
      <!-- 登录日志筛选：时间 / 账号 / 操作类型 / 登录方式 / 结果 -->
      <div v-if="activeTab === 'login'" class="log-filter__body">
        <div class="log-field">
          <label class="log-field__label">时间范围</label>
          <a-range-picker
            v-model:value="loginRangeValue"
            class="log-field__control"
            :allow-clear="false"
            :presets="rangePresets"
            :placeholder="['开始日期', '结束日期']"
          />
        </div>

        <div class="log-field">
          <label class="log-field__label">账号</label>
          <a-input
            v-model:value="loginDraft.keyword"
            class="log-field__control"
            placeholder="账号或姓名"
            allow-clear
            :maxlength="50"
            @press-enter="applyFilters"
          />
        </div>

        <div class="log-field">
          <label class="log-field__label">操作类型</label>
          <a-select
            v-model:value="loginDraft.actions"
            class="log-field__control"
            mode="multiple"
            allow-clear
            max-tag-count="responsive"
            placeholder="全部类型"
            :options="actionOptions"
          />
        </div>

        <div class="log-field">
          <label class="log-field__label">登录方式</label>
          <a-select
            v-model:value="loginDraft.methods"
            class="log-field__control"
            mode="multiple"
            allow-clear
            max-tag-count="responsive"
            placeholder="全部方式"
            :options="methodOptions"
          />
        </div>

        <div class="log-field">
          <label class="log-field__label">结果</label>
          <a-select
            v-model:value="loginDraft.results"
            class="log-field__control"
            mode="multiple"
            allow-clear
            max-tag-count="responsive"
            placeholder="全部结果"
            :options="resultOptions"
          />
        </div>

        <div class="log-filter__actions">
          <a-button type="primary" :loading="login.loading" @click="applyFilters">
            <template #icon><SearchOutlined /></template>
            查询
          </a-button>
          <a-button @click="resetFilters">
            <template #icon><ReloadOutlined /></template>
            重置
          </a-button>
          <a-button
            v-if="canExportCurrent"
            :disabled="!filteredList.length || currentState.loading"
            :loading="exporting"
            @click="handleExport"
          >
            <template #icon><DownloadOutlined /></template>
            {{ exporting ? '导出中…' : '导出' }}
          </a-button>
        </div>
      </div>

      <!-- 操作行为日志筛选：时间 / 操作账号 / 所属模块 / 功能 / 变更类型 / 关键字 -->
      <div v-else class="log-filter__body">
        <div class="log-field">
          <label class="log-field__label">时间范围</label>
          <a-range-picker
            v-model:value="operationRangeValue"
            class="log-field__control"
            :allow-clear="false"
            :presets="rangePresets"
            :placeholder="['开始日期', '结束日期']"
          />
        </div>

        <div class="log-field">
          <label class="log-field__label">操作账号</label>
          <a-input
            v-model:value="operationDraft.keyword"
            class="log-field__control"
            placeholder="账号或姓名"
            allow-clear
            :maxlength="50"
            @press-enter="applyFilters"
          />
        </div>

        <div class="log-field">
          <label class="log-field__label">所属模块</label>
          <a-select
            v-model:value="operationDraft.module"
            class="log-field__control"
            allow-clear
            placeholder="全部模块"
            :options="moduleOptions"
            @change="handleModuleChange"
          />
        </div>

        <div class="log-field">
          <label class="log-field__label">功能</label>
          <a-select
            v-model:value="operationDraft.feature"
            class="log-field__control"
            show-search
            allow-clear
            placeholder="全部功能"
            :options="featureOptions"
            @change="handleFeatureChange"
          />
        </div>

        <div class="log-field">
          <label class="log-field__label">变更类型</label>
          <a-select
            v-model:value="operationDraft.changeType"
            class="log-field__control"
            show-search
            allow-clear
            placeholder="全部类型"
            :options="changeTypeOptions"
          />
        </div>

        <div class="log-field">
          <label class="log-field__label">关键字</label>
          <a-input
            v-model:value="operationDraft.search"
            class="log-field__control"
            placeholder="对象名称 / 变更内容 / 账号"
            allow-clear
            :maxlength="50"
            @press-enter="applyFilters"
          >
            <template #prefix><SearchOutlined class="log-field__prefix" /></template>
          </a-input>
        </div>

        <div class="log-filter__actions">
          <a-button type="primary" :loading="operation.loading" @click="applyFilters">
            <template #icon><SearchOutlined /></template>
            查询
          </a-button>
          <a-button @click="resetFilters">
            <template #icon><ReloadOutlined /></template>
            重置
          </a-button>
          <a-button
            v-if="canExportCurrent"
            :disabled="!filteredList.length || currentState.loading"
            :loading="exporting"
            @click="handleExport"
          >
            <template #icon><DownloadOutlined /></template>
            {{ exporting ? '导出中…' : '导出' }}
          </a-button>
        </div>
      </div>
    </section>

    <!-- AREA-LOG-04 列表区 -->
    <section class="log-list" aria-label="日志列表">
      <!-- STATE-LOG-01 / STATE-LOG-03 加载中 -->
      <div v-if="currentState.loading" class="log-list__skeleton">
        <a-skeleton active :paragraph="{ rows: 6 }" />
      </div>

      <!-- STATE-LOG-05 列表加载失败 -->
      <div v-else-if="currentState.failed" class="log-state">
        <span class="log-state__icon log-state__icon--error"><DisconnectOutlined /></span>
        <p class="log-state__title">日志加载失败</p>
        <p class="log-state__desc">网络异常或服务暂时不可用，请稍后重试</p>
        <a-button type="primary" size="small" @click="loadList">
          <template #icon><ReloadOutlined /></template>
          重新加载
        </a-button>
      </div>

      <!-- STATE-LOG-04 空数据（含留存期外） -->
      <div v-else-if="!filteredList.length" class="log-state">
        <span class="log-state__icon"><SearchOutlined /></span>
        <p class="log-state__title">
          {{ activeTab === 'login' ? '当前条件下没有登录日志' : '当前条件下没有操作记录' }}
        </p>
        <p class="log-state__desc">
          可放宽时间范围或清空筛选条件后重试；超出留存期的记录不会出现在结果中
        </p>
        <a-button type="primary" size="small" @click="resetFilters">重置查询条件</a-button>
      </div>

      <!-- 登录日志列表（操作类型区分「登录 / 退出登录」；无详情入口，不可点击） -->
      <a-table
        v-else-if="activeTab === 'login'"
        class="log-table"
        :columns="loginColumns"
        :data-source="pagedLogin"
        :pagination="paginationConfig"
        :scroll="{ x: TABLE_MIN_WIDTH }"
        row-key="id"
        @change="handleTableChange"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'at'">
            <span class="log-cell__mono">{{ formatTime(record.at) }}</span>
          </template>
          <template v-else-if="column.key === 'actionType'">
            <a-tag :class="['log-tag', record.action === '登录' ? 'log-tag--ok' : 'log-tag--muted']">
              {{ record.action }}
            </a-tag>
          </template>
          <template v-else-if="column.key === 'account'">
            <div class="log-cell__stack">
              <span class="log-cell__mono log-cell__ellipsis" :title="record.account">{{ record.account }}</span>
              <span v-if="record.accountName" class="log-cell__sub log-cell__ellipsis" :title="record.accountName">
                {{ record.accountName }}
              </span>
            </div>
          </template>
          <template v-else-if="column.key === 'method'">
            <span :title="record.method">{{ record.method || '—' }}</span>
          </template>
          <template v-else-if="column.key === 'result'">
            <a-tag :class="['log-tag', `log-tag--${resultTone(record.result)}`]">{{ record.result }}</a-tag>
          </template>
          <template v-else-if="column.key === 'failReason'">
            <span :title="record.failReason">{{ record.failReason || '—' }}</span>
          </template>
          <template v-else-if="column.key === 'ip'">
            <span class="log-cell__mono">{{ record.ip }}</span>
          </template>
          <template v-else-if="column.key === 'terminal'">
            <span :title="record.terminal">{{ record.terminal || '—' }}</span>
          </template>
        </template>
      </a-table>

      <!-- 操作行为日志列表：整行可点击，「操作」列固定提供查看详情入口 -->
      <a-table
        v-else
        class="log-table log-table--clickable"
        :columns="operationColumns"
        :data-source="pagedOperation"
        :pagination="paginationConfig"
        :scroll="{ x: TABLE_MIN_WIDTH }"
        :on-row="operationRowProps"
        row-key="id"
        @change="handleTableChange"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'at'">
            <span class="log-cell__mono">{{ formatTime(record.at) }}</span>
          </template>
          <template v-else-if="column.key === 'account'">
            <div class="log-cell__stack">
              <span class="log-cell__mono log-cell__ellipsis" :title="record.account">{{ record.account }}</span>
              <span v-if="record.accountName" class="log-cell__sub log-cell__ellipsis" :title="record.accountName">
                {{ record.accountName }}
              </span>
            </div>
          </template>
          <template v-else-if="column.key === 'feature'">
            <span :title="record.feature">{{ record.feature }}</span>
          </template>
          <template v-else-if="column.key === 'changeType'">
            <span class="log-cell__type" :title="record.changeType">{{ record.changeType }}</span>
          </template>
          <template v-else-if="column.key === 'object'">
            <span class="log-cell__ellipsis" :title="`${record.objectType} / ${record.objectName}`">
              {{ record.objectType }} / {{ record.objectName }}
            </span>
            <a-tag v-if="record.objectDeleted" class="log-tag log-tag--muted">已删除</a-tag>
          </template>
          <template v-else-if="column.key === 'summary'">
            <span :title="record.summary">{{ record.summary }}</span>
          </template>
          <template v-else-if="column.key === 'op'">
            <a-button type="link" size="small" class="log-cell__op" @click.stop="openDetail(record)">
              查看详情
            </a-button>
          </template>
        </template>
      </a-table>
    </section>

    <!-- OVERLAY-01 日志详情抽屉 -->
    <LogDetailDrawer
      ref="drawerRef"
      v-model:open="detailOpen"
      :kind="activeTab"
      :record="detailRecord"
    />

    <ProtoTip :lines="tipLines" @reset="handleResetData">
      <template #extra>
        <a-space size="small">
          <a-button size="small" @click="simulateLoadFail">模拟加载失败</a-button>
          <!-- 详情仅操作行为日志具备，故该演示入口只在「操作行为日志」页签提供 -->
          <a-button v-if="activeTab === 'operation'" size="small" @click="simulateDetailFail">
            模拟详情加载失败
          </a-button>
        </a-space>
      </template>
    </ProtoTip>
  </div>
</template>

<script setup lang="ts">
/**
 * PAGE-01 系统日志
 * 【原型说明】单页双页签承载「登录日志」与「操作行为日志」两类审计日志：
 * - 登录日志记录本企业账号的**会话行为**：登录（成功 / 失败 / 已锁定）与退出登录
 * - 页签切换复用各自上次的查询结果与页码，不重复查询
 * - 查询条件仅修改草稿，点「查询」后才生效；「重置」恢复默认条件并立即查询
 * - 默认时间范围为**当日**，进入本页的数据压力最小
 * - 「导出」位于查询 / 重置之后，与该页签的查询条件一致
 * - 详情入口仅「操作行为日志」具备（操作列按钮 + 整行点击）；登录日志为纯只读清单
 * - 两类日志均为只读：无行选择框、无批量操作、无编辑 / 删除
 */
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { message } from 'antdv-next'
import type { RangePickerProps, TableColumnsType, TablePaginationConfig, TableProps } from 'antdv-next'
import dayjs from 'dayjs'
import type { Dayjs } from 'dayjs'
import { DisconnectOutlined, DownloadOutlined, ReloadOutlined, SearchOutlined } from '@antdv-next/icons'
import ProtoTip from '@/shared/components/ProtoTip.vue'
import LogDetailDrawer from '../components/LogDetailDrawer.vue'
import { currentPermissions } from '@/modules/role/store'
import {
  DEFAULT_RANGE_DAYS,
  LOGIN_ACTION_OPTIONS,
  LOGIN_METHOD_OPTIONS,
  LOGIN_RESULT_OPTIONS,
  LOG_MODULE_OPTIONS,
  PAGE_SIZE_OPTIONS,
  RETENTION_MONTHS,
  buildLoginExport,
  buildOperationExport,
  changeTypeOptionsOf,
  defaultRange,
  downloadText,
  featureOptionsOf,
  filterLoginLogs,
  filterOperationLogs,
  formatTime,
  resetLogData,
  validateRange,
} from '../store'
import type {
  DateRange,
  LogTab,
  LoginFilters,
  LoginLog,
  OperationFilters,
  OperationLog,
} from '../store'

/* ---------- 角色与权限 ---------- */
/**
 * 【原型说明】系统日志为二级导航项且自身即页面：
 * 菜单级 `system:log` 代表「可进入并查看两类日志」；
 * 导出按日志类型拆分为两个独立按钮级权限点（PRD 7.6）。
 * 无导出权限时不渲染「导出」且不做无权限提示。
 */
const canView = computed(() => has('system:log'))
const canExportCurrent = computed(() =>
  activeTab.value === 'login' ? has('system:log:login:export') : has('system:log:operation:export'),
)

function has(key: string) {
  return currentPermissions().includes(key)
}

const router = useRouter()

/* ---------- 页签（CMP-LOG-03） ---------- */
const TAB_ITEMS: Array<{ key: LogTab; label: string }> = [
  { key: 'login', label: '登录日志' },
  { key: 'operation', label: '操作行为日志' },
]

/** 默认落在「登录日志」 */
const activeTab = ref<LogTab>('login')

/* ---------- 查询条件：草稿（可改）+ 生效值（点查询后写入） ---------- */

const defaultLoginFilters = (): LoginFilters => ({
  dateRange: defaultRange(DEFAULT_RANGE_DAYS),
  keyword: '',
  actions: [],
  methods: [],
  results: [],
})

const defaultOperationFilters = (): OperationFilters => ({
  dateRange: defaultRange(DEFAULT_RANGE_DAYS),
  keyword: '',
  module: '',
  feature: '',
  changeType: '',
  search: '',
})

/** 深拷贝，避免草稿与生效值共享数组引用 */
const cloneLogin = (value: LoginFilters): LoginFilters => ({ ...value, dateRange: [...value.dateRange] as DateRange, actions: [...value.actions], methods: [...value.methods], results: [...value.results] })
const cloneOperation = (value: OperationFilters): OperationFilters => ({ ...value, dateRange: [...value.dateRange] as DateRange })

/** 登录日志：草稿条件与生效条件 */
const loginDraft = reactive<LoginFilters>(defaultLoginFilters())
const loginApplied = ref<LoginFilters>(defaultLoginFilters())
/** 操作行为日志：草稿条件与生效条件 */
const operationDraft = reactive<OperationFilters>(defaultOperationFilters())
const operationApplied = ref<OperationFilters>(defaultOperationFilters())

const login = reactive({ page: 1, pageSize: 20, loading: true, failed: false, loaded: false })
const operation = reactive({ page: 1, pageSize: 20, loading: false, failed: false, loaded: false })

/** 最近一次生效的时间范围：草稿区间不合法时回退 */
const validLoginRange = ref<DateRange>(defaultLoginFilters().dateRange)
const validOperationRange = ref<DateRange>(defaultOperationFilters().dateRange)

/** 快捷时间范围：默认当日，另提供近 7 天 / 近 30 天 */
const rangePresets: RangePickerProps['presets'] = [
  { label: '今日', value: [dayjs().startOf('day'), dayjs()] },
  { label: '近 7 天', value: [dayjs().subtract(6, 'd').startOf('day'), dayjs()] },
  { label: '近 30 天', value: [dayjs().subtract(29, 'd').startOf('day'), dayjs()] },
]

/** 时间范围回显：组件需要 Dayjs，业务内维护 `YYYY-MM-DD` 字符串 */
const loginRangeValue = computed({
  get: (): [Dayjs, Dayjs] => [dayjs(loginDraft.dateRange[0]), dayjs(loginDraft.dateRange[1])],
  set: (value: [Dayjs, Dayjs] | null) => {
    if (!value?.[0] || !value?.[1]) return
    applyRange('login', [value[0].format('YYYY-MM-DD'), value[1].format('YYYY-MM-DD')])
  },
})

const operationRangeValue = computed({
  get: (): [Dayjs, Dayjs] => [dayjs(operationDraft.dateRange[0]), dayjs(operationDraft.dateRange[1])],
  set: (value: [Dayjs, Dayjs] | null) => {
    if (!value?.[0] || !value?.[1]) return
    applyRange('operation', [value[0].format('YYYY-MM-DD'), value[1].format('YYYY-MM-DD')])
  },
})

/** 时间范围变更：校验通过才写入草稿，否则回退并提示 */
function applyRange(tab: LogTab, next: DateRange) {
  const issue = validateRange(next)
  if (issue) {
    message.error(issue)
    if (tab === 'login') loginDraft.dateRange = [...validLoginRange.value]
    else operationDraft.dateRange = [...validOperationRange.value]
    return
  }
  if (tab === 'login') {
    validLoginRange.value = next
    loginDraft.dateRange = next
  } else {
    validOperationRange.value = next
    operationDraft.dateRange = next
  }
}

/* ---------- 筛选选项 ---------- */

const actionOptions = LOGIN_ACTION_OPTIONS.map((item) => ({ label: item, value: item }))
const methodOptions = LOGIN_METHOD_OPTIONS.map((item) => ({ label: item, value: item }))
const resultOptions = LOGIN_RESULT_OPTIONS.map((item) => ({ label: item, value: item }))
const moduleOptions = LOG_MODULE_OPTIONS.map((item) => ({ label: item, value: item }))

const featureOptions = computed(() => featureOptionsOf(operationDraft.module))
const changeTypeOptions = computed(() => changeTypeOptionsOf(operationDraft.module, operationDraft.feature))

/** 切换模块：不属于新模块的功能与变更类型一并清空（PRD EX-LOG-06） */
function handleModuleChange() {
  const features = featureOptionsOf(operationDraft.module).map((item) => item.value)
  if (operationDraft.feature && !features.includes(operationDraft.feature)) {
    operationDraft.feature = ''
    operationDraft.changeType = ''
  }
  const types = changeTypeOptionsOf(operationDraft.module, operationDraft.feature).map((item) => item.value)
  if (operationDraft.changeType && !types.includes(operationDraft.changeType)) {
    operationDraft.changeType = ''
  }
}

/** 切换功能：不属于新功能的变更类型清空 */
function handleFeatureChange() {
  const types = changeTypeOptionsOf(operationDraft.module, operationDraft.feature).map((item) => item.value)
  if (operationDraft.changeType && !types.includes(operationDraft.changeType)) {
    operationDraft.changeType = ''
  }
}

/* ---------- 查询结果（基于「生效值」而非草稿） ---------- */

/** 登录日志：按生效条件过滤后，按操作时间倒序（固定排序，不提供排序切换） */
const filteredLogin = computed(() => filterLoginLogs(loginApplied.value).sort((a, b) => b.at - a.at))
/** 操作行为日志：同上 */
const filteredOperation = computed(() => filterOperationLogs(operationApplied.value).sort((a, b) => b.at - a.at))

const filteredList = computed<Array<LoginLog | OperationLog>>(() =>
  activeTab.value === 'login' ? filteredLogin.value : filteredOperation.value,
)

const pagedLogin = computed(() =>
  filteredLogin.value.slice((login.page - 1) * login.pageSize, login.page * login.pageSize),
)
const pagedOperation = computed(() =>
  filteredOperation.value.slice((operation.page - 1) * operation.pageSize, operation.page * operation.pageSize),
)

const currentState = computed(() => (activeTab.value === 'login' ? login : operation))
const currentTotal = computed(() => filteredList.value.length)

const paginationConfig = computed<TablePaginationConfig>(() => ({
  current: currentState.value.page,
  pageSize: currentState.value.pageSize,
  total: currentTotal.value,
  size: 'small' as const,
  showSizeChanger: true,
  pageSizeOptions: PAGE_SIZE_OPTIONS,
  showTotal: (total: number) => `共 ${total} 条`,
  hideOnSinglePage: false,
}))

function handleTableChange(pagination: TablePaginationConfig) {
  currentState.value.page = pagination.current ?? 1
  currentState.value.pageSize = pagination.pageSize ?? 20
}

/* ---------- 加载 ---------- */

/** 【原型说明】模拟列表加载耗时，无真实接口调用 */
function loadList() {
  const state = currentState.value
  state.loading = true
  state.failed = false
  window.setTimeout(() => {
    state.loading = false
    state.loaded = true
  }, 420)
}

/** 【原型说明】模拟加载失败，用于验证错误态与重试 */
function simulateLoadFail() {
  const state = currentState.value
  state.loading = true
  state.failed = false
  window.setTimeout(() => {
    state.loading = false
    state.failed = true
  }, 420)
}

/** 【原型说明】模拟详情加载失败，用于验证抽屉错误态 */
function simulateDetailFail() {
  if (!detailRecord.value) {
    openDetail(filteredList.value[0] ?? null)
  }
  drawerRef.value?.simulateFail()
}

/** 查询：把草稿条件写入生效值，回到第 1 页后加载（草稿改动不即时生效） */
function applyFilters() {
  const range = activeTab.value === 'login' ? loginDraft.dateRange : operationDraft.dateRange
  const issue = validateRange(range)
  if (issue) {
    message.error(issue)
    return
  }
  if (activeTab.value === 'login') {
    loginApplied.value = cloneLogin(loginDraft)
    login.page = 1
  } else {
    operationApplied.value = cloneOperation(operationDraft)
    operation.page = 1
  }
  loadList()
}

/** 重置：恢复该页签默认条件（当日、其余为空）并立即查询 */
function resetFilters() {
  if (activeTab.value === 'login') {
    Object.assign(loginDraft, defaultLoginFilters())
    validLoginRange.value = defaultLoginFilters().dateRange
    loginApplied.value = cloneLogin(loginDraft)
    login.page = 1
  } else {
    Object.assign(operationDraft, defaultOperationFilters())
    validOperationRange.value = defaultOperationFilters().dateRange
    operationApplied.value = cloneOperation(operationDraft)
    operation.page = 1
  }
  loadList()
}

/**
 * 切换页签：复用该页签上次的查询结果与页码，不重复查询；
 * 首次进入该页签时才按默认条件加载。
 */
function switchTab(tab: LogTab) {
  if (activeTab.value === tab) return
  activeTab.value = tab
  if (!currentState.value.loaded) loadList()
}

/* ---------- 列表列 ---------- */

/**
 * 表格最小宽度：窄屏（内容区 < 该值）时横向滚动，避免右侧列被裁切；
 * 宽屏下表格撑满容器，各列按设定宽度等比放大。
 */
const TABLE_MIN_WIDTH = 1058

/**
 * 登录日志：操作时间 / 操作类型 / 操作账号 / 登录方式 / 结果 / 失败原因 / 来源 IP / 来源终端（无行操作列）。
 * 宽度策略：以各列内容实测「需要宽度」为准，合计 1058px 贴合 1440 下的内容区——
 * 短内容列（时间 / 类型 / 账号 / 方式 / 结果 / IP）给足宽度确保完整显示、不换行不截断；
 * 仅「失败原因 / 来源终端」内容可能极长，分配剩余宽度并省略号截断（悬浮可看全文）。
 * 表格为 fixed 布局，容器更宽时各列按上述比例同步放大。
 */
const loginColumns: TableColumnsType<LoginLog> = [
  { title: '操作时间', key: 'at', width: 166 },
  { title: '操作类型', key: 'actionType', width: 94 },
  { title: '操作账号', key: 'account', width: 166, ellipsis: true },
  { title: '登录方式', dataIndex: 'method', key: 'method', width: 110, ellipsis: true },
  { title: '结果', key: 'result', width: 82 },
  { title: '失败原因', key: 'failReason', width: 150, ellipsis: true },
  { title: '来源 IP', key: 'ip', width: 130 },
  { title: '来源终端', key: 'terminal', width: 160, ellipsis: true },
]

/**
 * 操作行为日志：操作时间 / 操作账号 / 所属模块 / 功能 / 变更类型 / 操作对象 / 变更内容摘要 / 操作。
 * 短内容列（时间 / 账号 / 模块 / 功能 / 变更类型 / 操作）给足宽度；
 * 「操作对象 / 变更内容摘要」内容差异极大（长企业名可超 500px），分配剩余宽度并省略号截断。
 */
const operationColumns: TableColumnsType<OperationLog> = [
  { title: '操作时间', key: 'at', width: 166 },
  { title: '操作账号', key: 'account', width: 130, ellipsis: true },
  { title: '所属模块', dataIndex: 'module', key: 'module', width: 96, ellipsis: true },
  { title: '功能', key: 'feature', width: 94, ellipsis: true },
  { title: '变更类型', key: 'changeType', width: 120 },
  { title: '操作对象', key: 'object', width: 180, ellipsis: true },
  { title: '变更内容摘要', key: 'summary', width: 188, ellipsis: true },
  { title: '操作', key: 'op', width: 84 },
]

/** 结果标签配色：成功 / 失败 / 已锁定 */
function resultTone(result: string) {
  if (result === '成功') return 'ok'
  if (result === '失败') return 'fail'
  return 'warn'
}

/* ---------- 详情抽屉（OVERLAY-01） ---------- */

const detailOpen = ref(false)
const detailRecord = ref<LoginLog | OperationLog | null>(null)
const drawerRef = ref<InstanceType<typeof LogDetailDrawer> | null>(null)

function openDetail(record: LoginLog | OperationLog | null) {
  if (!record) return
  detailRecord.value = record
  detailOpen.value = true
}

/**
 * 仅「操作行为日志」提供详情入口：该页签整行可点击，「操作」列的「查看详情」按钮为显式入口。
 * 「登录日志」为纯只读清单，不提供详情（无行点击、无操作列）。
 */
const operationRowProps: TableProps<OperationLog>['onRow'] = (record) => ({
  onClick: () => openDetail(record),
})

/* ---------- 导出 ---------- */

const exporting = ref(false)

async function handleExport() {
  const result = activeTab.value === 'login'
    ? buildLoginExport(filteredLogin.value)
    : buildOperationExport(filteredOperation.value)
  if (!result.ok) {
    message.error(result.reason)
    return
  }
  exporting.value = true
  // 【原型说明】模拟文件生成耗时，无真实导出接口
  await new Promise((resolve) => setTimeout(resolve, 600))
  downloadText(result.fileName, result.content)
  exporting.value = false
  message.success(`导出成功，共 ${result.count} 条记录`)
}

/* ---------- 演示提示 ---------- */

const tipLines = [
  '本页是各模块审计日志的统一检索入口：8 个已定稿模块（组织架构、企业成员、角色管理、企业中心、设备台账、设备OTA、负荷策略、告警中心）的变更动作都会写入「操作行为日志」。',
  '「登录日志」记录本企业账号的会话行为：登录（成功 / 失败 / 已锁定）与**退出登录**；只含本企业数据，不跨企业。',
  '默认时间范围为**当日**（进入本页数据压力最小），可切换「今日 / 近 7 天 / 近 30 天」或自定义（单次跨度不超过 90 天）。',
  '查询方式为**提交式**：修改时间或筛选条件后需点「查询」才生效；「重置」恢复默认条件（当日）并立即查询。',
  '「导出」位于查询 / 重置之后，导出内容严格等于当前查询条件；两类日志的导出权限相互独立。',
  '列表固定按操作时间倒序、不提供排序切换。**「登录日志」不提供详情**（纯只读清单，行不可点击）；**「操作行为日志」保留详情**——可点「操作」列的「查看详情」，也可直接点整行，打开右侧只读详情抽屉。',
  '列表单元格过长时以省略号展示，鼠标悬浮可查看完整内容。',
  '下方按钮可快速验证列表加载失败与详情加载失败状态；「重置演示数据」会清空原型内新产生的会话记录。',
]

function handleResetData() {
  // 清空原型内新产生的会话记录，并恢复两页签的默认查询条件
  resetLogData()
  Object.assign(loginDraft, defaultLoginFilters())
  Object.assign(operationDraft, defaultOperationFilters())
  loginApplied.value = defaultLoginFilters()
  operationApplied.value = defaultOperationFilters()
  validLoginRange.value = defaultLoginFilters().dateRange
  validOperationRange.value = defaultOperationFilters().dateRange
  login.page = 1
  operation.page = 1
  loadList()
}

/** 进入页面即按默认条件（当日）加载「登录日志」 */
onMounted(loadList)
</script>
