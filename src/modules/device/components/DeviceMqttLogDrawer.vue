<!--
  OVERLAY-09 MQTT 通讯日志抽屉（PRD F-DEV-14）
  【原型说明】从设备详情页工具栏打开，右侧滑出。
  仅展示该设备最近 30 天的通讯日志（超出部分系统自动删除），
  支持按通讯方向与结果筛选、分页，并可展开单条日志查看报文与失败原因。
  日志为只读记录，抽屉内不提供任何编辑与删除入口。
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
      <!-- 头部：设备标识 + 保留期说明 + 关闭 -->
      <header class="mqttlog__head">
        <div class="mqttlog__head-text">
          <span class="mqttlog__eyebrow">MQTT 通讯日志</span>
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

      <!-- 概览：总量 / 失败量 / 最早记录时间 -->
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

      <!-- 筛选：通讯方向 / 通讯结果 / 事件关键字 -->
      <div class="mqttlog__filter">
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

        <!-- 展开行：报文内容与失败原因 -->
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
import type { TableColumnsType } from 'antdv-next'
import { CloseOutlined, ExclamationCircleOutlined } from '@antdv-next/icons'
import { deviceMqttLogs, formatTime, mqttLogSummary } from '../store'
import type { Device, MqttDirection, MqttResult } from '../store'

const props = defineProps<{
  /** 抽屉开关（v-model:open） */
  open: boolean
  /** 目标设备；为 null 时不渲染内容 */
  device: Device | null
}>()

const emit = defineEmits<{ 'update:open': [boolean] }>()

/** 抽屉宽度：日志表列较多（时间 / 方向 / 事件 / 主题 / 结果 / 耗时 / 详情），故下限高于用能单元抽屉 */
const drawerWidth = computed(() => Math.min(Math.max(Math.round(window.innerWidth * 0.58), 760), 1080))

const DIRECTION_OPTIONS = [
  { label: '上行（设备→平台）', value: '上行' },
  { label: '下行（平台→设备）', value: '下行' },
]
const RESULT_OPTIONS = [
  { label: '成功', value: '成功' },
  { label: '失败', value: '失败' },
]

const directionFilter = ref<MqttDirection | null>(null)
const resultFilter = ref<MqttResult | null>(null)
const keyword = ref('')
const page = ref(1)
const pageSize = ref(10)
/** 展开查看报文的行（受控，便于筛选变化时收起） */
const expandedKeys = ref<readonly (string | number)[]>([])

/** 抽屉关闭时重置筛选与分页，避免下次打开沿用上次条件造成「日志变少了」的误解 */
watch(
  () => props.open,
  (open) => {
    if (open) return
    directionFilter.value = null
    resultFilter.value = null
    keyword.value = ''
    page.value = 1
    expandedKeys.value = []
  },
)

const summary = computed(() =>
  props.device ? mqttLogSummary(props.device.id) : { total: 0, failed: 0, earliestAt: null, keepDays: 30 },
)

/** 筛选后的日志：方向与结果为精确匹配，关键字匹配事件名或主题 */
const filteredRows = computed(() => {
  if (!props.device) return []
  const value = keyword.value.trim().toLowerCase()
  return deviceMqttLogs(props.device.id).filter((log) => {
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

/** 筛选条件变化时回到第 1 页并收起展开行，避免停留在越界页码 */
watch([directionFilter, resultFilter, keyword], () => {
  page.value = 1
  expandedKeys.value = []
})

const columns: TableColumnsType = [
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
