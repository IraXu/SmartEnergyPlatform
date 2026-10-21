<!--
  PAL-OVERLAY MQTT 通讯日志抽屉（平台端只读）
  【原型说明】从平台设备详情页打开，右侧滑出。
  仅展示该设备最近 30 天的通讯日志，支持按时间段、方向、结果筛选与关键字搜索、分页，
  并可展开单条日志查看报文与失败原因。平台端为**只读视图**，不提供导出与任何写操作。
-->
<template>
  <a-drawer
    :open="open"
    placement="right"
    :size="drawerWidth"
    :styles="{ body: { padding: 0 } }"
    :closable="false"
    @close="close"
  >
    <template #title />
    <div class="mqttlog">
      <header class="mqttlog__head">
        <div class="mqttlog__head-text">
          <span class="mqttlog__eyebrow">MQTT 通讯日志（只读）</span>
          <h3 class="mqttlog__title" :title="device?.name">{{ device?.name || '设备' }}</h3>
          <dl class="mqttlog__ident">
            <div class="mqttlog__ident-row">
              <dt>License</dt>
              <dd class="device-cell__mono" :title="device?.license">{{ device?.license || '—' }}</dd>
            </div>
            <div class="mqttlog__ident-row">
              <dt>IMEI</dt>
              <dd class="device-cell__mono" :title="device?.imei">{{ device?.imei || '—' }}</dd>
            </div>
          </dl>
          <p class="mqttlog__sub">仅保留最近 {{ summary.keepDays }} 天，超期记录已自动删除</p>
        </div>
        <a-button type="text" size="small" aria-label="关闭" @click="close">
          <template #icon><CloseOutlined /></template>
        </a-button>
      </header>

      <section class="mqttlog__overview" aria-label="日志概览">
        <div class="mqttlog__stat">
          <span class="mqttlog__stat-label">保留期内记录</span>
          <span class="mqttlog__stat-value">{{ summary.total }}<small>条</small></span>
        </div>
        <div class="mqttlog__stat">
          <span class="mqttlog__stat-label">通讯失败</span>
          <span class="mqttlog__stat-value" :class="{ 'is-danger': summary.failed > 0 }">
            {{ summary.failed }}<small>条</small>
          </span>
        </div>
        <div class="mqttlog__stat">
          <span class="mqttlog__stat-label">最早记录</span>
          <span class="mqttlog__stat-value mqttlog__stat-value--time">
            {{ summary.earliestAt ? formatTime(summary.earliestAt) : '—' }}
          </span>
        </div>
      </section>

      <div class="mqttlog__filter">
        <a-range-picker
          v-model:value="rangeFilter"
          class="mqttlog__filter-item mqttlog__filter-item--date"
          :show-time="SHOW_TIME"
          :format="DATE_FORMAT"
          :presets="RANGE_PRESETS"
          :placeholder="['开始时间', '结束时间']"
        />
        <a-select
          v-model:value="directionFilter"
          class="mqttlog__filter-item"
          allow-clear
          placeholder="全部方向"
          :options="DIRECTION_OPTIONS"
        />
        <a-select
          v-model:value="resultFilter"
          class="mqttlog__filter-item"
          allow-clear
          placeholder="全部结果"
          :options="RESULT_OPTIONS"
        />
        <a-input
          v-model:value="keyword"
          class="mqttlog__filter-item mqttlog__filter-item--grow"
          allow-clear
          placeholder="按事件或主题筛选"
        />
      </div>

      <a-table
        v-model:expanded-row-keys="expandedKeys"
        class="device-table device-table--plain mqttlog__table"
        :columns="columns"
        :data-source="pageRows"
        :pagination="pagination"
        row-key="id"
        size="small"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'at'">
            <span class="device-cell__time">{{ formatTime(record.at) }}</span>
          </template>
          <template v-else-if="column.key === 'direction'">
            <span class="mqttlog__direction" :class="record.direction === '上行' ? 'is-up' : 'is-down'">
              {{ record.direction }}
            </span>
          </template>
          <template v-else-if="column.key === 'event'">
            <span class="device-cell__type">{{ record.event }}</span>
          </template>
          <template v-else-if="column.key === 'topic'">
            <span class="device-cell__mono mqttlog__topic" :title="record.topic">{{ record.topic }}</span>
          </template>
          <template v-else-if="column.key === 'result'">
            <span class="mqttlog__result" :class="record.result === '成功' ? 'is-ok' : 'is-fail'">
              {{ record.result }}
            </span>
          </template>
          <template v-else-if="column.key === 'cost'">
            <span v-if="record.cost === null" class="device-cell__empty">—</span>
            <span v-else class="mqttlog__cost">{{ record.cost }}ms</span>
          </template>
        </template>

        <template #expandedRowRender="{ record }">
          <div class="mqttlog__detail">
            <p v-if="record.error" class="mqttlog__detail-error">
              <ExclamationCircleOutlined />
              失败原因：{{ record.error }}
            </p>
            <p class="mqttlog__detail-label">报文内容</p>
            <pre class="mqttlog__payload">{{ record.payload }}</pre>
          </div>
        </template>
      </a-table>
    </div>
  </a-drawer>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import dayjs from 'dayjs'
import type { Dayjs } from 'dayjs'
import type { RangePickerProps, TableColumnsType } from 'antdv-next'
import { CloseOutlined, ExclamationCircleOutlined } from '@antdv-next/icons'
import {
  platformDeviceMqttLogs,
  platformMqttSummary,
  type PlatformDevice,
  type PlatformMqttLog,
} from '@/modules/platform/store'
import { formatTime } from '@/modules/device/store'

const props = defineProps<{
  open: boolean
  device: PlatformDevice | null
}>()

const emit = defineEmits<{ 'update:open': [boolean] }>()

const drawerWidth = computed(() => Math.min(Math.max(Math.round(window.innerWidth * 0.58), 760), 1080))

const DIRECTION_OPTIONS = [
  { label: '上行（设备→平台）', value: '上行' },
  { label: '下行（平台→设备）', value: '下行' },
]
const RESULT_OPTIONS = [
  { label: '成功', value: '成功' },
  { label: '失败', value: '失败' },
]

const RANGE_PRESETS: RangePickerProps['presets'] = [
  { label: '今日', value: [dayjs().startOf('day'), dayjs().endOf('day')] },
  { label: '近 7 天', value: [dayjs().add(-6, 'd').startOf('day'), dayjs().endOf('day')] },
  { label: '近 30 天', value: [dayjs().add(-29, 'd').startOf('day'), dayjs().endOf('day')] },
]
const SHOW_TIME: RangePickerProps['showTime'] = { format: 'HH:mm:ss' }
const DATE_FORMAT = 'YYYY-MM-DD HH:mm:ss'

const directionFilter = ref<'上行' | '下行' | null>(null)
const resultFilter = ref<'成功' | '失败' | null>(null)
const rangeFilter = ref<[Dayjs, Dayjs] | null>(null)
const keyword = ref('')
const page = ref(1)
const pageSize = ref(10)
const expandedKeys = ref<readonly (string | number)[]>([])

watch(
  () => props.open,
  (open) => {
    if (open) return
    directionFilter.value = null
    resultFilter.value = null
    rangeFilter.value = null
    keyword.value = ''
    page.value = 1
    expandedKeys.value = []
  },
)

const summary = computed(() =>
  props.device ? platformMqttSummary(props.device.id) : { total: 0, failed: 0, earliestAt: null, keepDays: 30 },
)

const rangeBounds = computed(() => {
  const range = rangeFilter.value
  if (!range?.[0] || !range?.[1]) return [null, null] as [number | null, number | null]
  return [range[0].startOf('second').valueOf(), range[1].endOf('second').valueOf()] as [number, number]
})

const filteredRows = computed(() => {
  if (!props.device) return []
  const value = keyword.value.trim().toLowerCase()
  const [from, to] = rangeBounds.value
  return platformDeviceMqttLogs(props.device.id).filter((log) => {
    if (from !== null && log.at < from) return false
    if (to !== null && log.at > to) return false
    if (directionFilter.value && log.direction !== directionFilter.value) return false
    if (resultFilter.value && log.result !== resultFilter.value) return false
    if (!value) return true
    return log.event.toLowerCase().includes(value) || log.topic.toLowerCase().includes(value)
  })
})

const pageRows = computed(() =>
  filteredRows.value.slice((page.value - 1) * pageSize.value, page.value * pageSize.value),
)

const pagination = computed(() => ({
  current: page.value,
  pageSize: pageSize.value,
  total: filteredRows.value.length,
  size: 'small' as const,
  showSizeChanger: true,
  pageSizeOptions: ['10', '20', '50'],
  showTotal: (total: number) => `共 ${total} 条`,
  onChange: (nextPage: number, nextSize: number) => {
    page.value = nextPage
    pageSize.value = nextSize
  },
}))

watch([directionFilter, resultFilter, rangeFilter, keyword], () => {
  page.value = 1
  expandedKeys.value = []
})

const columns: TableColumnsType<PlatformMqttLog> = [
  { key: 'at', title: '通讯时间', width: 148 },
  { key: 'direction', title: '方向', width: 72 },
  { key: 'event', title: '事件', width: 96 },
  { key: 'topic', title: '主题', width: 260 },
  { key: 'result', title: '结果', width: 72 },
  { key: 'cost', title: '耗时', width: 84 },
]

function close() {
  emit('update:open', false)
}
</script>
