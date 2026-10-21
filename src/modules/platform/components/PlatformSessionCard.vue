<!--
  PAL-CARD 上下线记录（平台端只读）
  【原型说明】平台设备详情页：以事件流水展示设备最近 30 天的连接情况。
  上线与离线各自独立成一条记录，不做成对聚合；记录只读、仅保留最近 30 天，与 MQTT 通讯日志同一口径。
  默认收起，只露出概览统计；展开后可查询（事件类型 + 时间范围）与分页。
-->
<template>
  <section class="device-detail__card">
    <div class="device-detail__card-head device-detail__card-head--toggle" @click="open = !open">
      <h2 class="device-detail__card-title">
        上下线记录
        <span class="device-detail__card-note">最近 {{ summary.keepDays }} 天，上线与离线各为一条记录</span>
      </h2>
      <span class="device-detail__toggle">
        {{ open ? '收起' : '展开' }}
        <DownOutlined class="device-detail__toggle-icon" :class="{ 'is-open': open }" />
      </span>
    </div>

    <p v-if="summary.onlineCount || summary.offlineCount" class="devsess__summary" :class="{ 'is-collapsed': !open }">
      <span class="devsess__summary-item">上线 <em>{{ summary.onlineCount }}</em> 次</span>
      <span class="devsess__summary-sep">·</span>
      <span class="devsess__summary-item">掉线 <em>{{ summary.offlineCount }}</em> 次</span>
      <span class="devsess__summary-sep">·</span>
      <span class="devsess__summary-item">
        最近掉线
        <em>{{ summary.latestOfflineAt ? formatTime(summary.latestOfflineAt) : '保留期内未掉线' }}</em>
      </span>
    </p>

    <div v-show="open" class="devsess__body">
      <div class="devsess__filter">
        <a-select v-model:value="draftType" class="devsess__filter-item" allow-clear placeholder="全部事件" :options="TYPE_OPTIONS" />
        <a-range-picker
          v-model:value="draftRange"
          class="devsess__filter-item devsess__filter-item--date"
          :show-time="SHOW_TIME"
          :format="DATE_FORMAT"
          :presets="RANGE_PRESETS"
          :placeholder="['开始时间', '结束时间']"
        />
        <a-button type="primary" @click="handleSearch">
          <template #icon><SearchOutlined /></template>
          查询
        </a-button>
        <a-button @click="handleReset">
          <template #icon><ReloadOutlined /></template>
          重置
        </a-button>
      </div>

      <a-table
        v-if="rows.length"
        class="device-table device-table--plain"
        :columns="columns"
        :data-source="rows"
        :pagination="pagination"
        row-key="id"
        size="small"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'at'">
            <span class="devsess__time">{{ formatTime(record.at) }}</span>
          </template>
          <template v-else-if="column.key === 'type'">
            <span class="devsess__type" :class="record.type === '上线' ? 'is-on' : 'is-off'">{{ record.type }}</span>
          </template>
          <template v-else>
            <span class="devsess__reason" :title="record.detail">{{ record.detail || '—' }}</span>
          </template>
        </template>
      </a-table>

      <div v-else class="device-detail__empty">
        {{ applied.hasFilter ? '没有符合查询条件的上下线记录' : '该设备在保留期内暂无上下线记录' }}
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
/**
 * 【原型说明】平台设备详情的上下线记录卡片（只读）：
 * 与企业端设备详情同一套呈现，数据源为平台端只读演示数据。
 */
import { computed, reactive, ref, watch } from 'vue'
import dayjs from 'dayjs'
import type { Dayjs } from 'dayjs'
import type { RangePickerProps, TableColumnsType } from 'antdv-next'
import { DownOutlined, ReloadOutlined, SearchOutlined } from '@antdv-next/icons'
import { formatTime } from '@/modules/device/store'
import {
  platformDeviceSessions,
  platformSessionSummary,
  type PlatformDevice,
  type PlatformSessionEvent,
  type PlatformSessionEventType,
} from '@/modules/platform/store'

const props = defineProps<{
  device: PlatformDevice | null
}>()

const open = ref(false)

const summary = computed(() =>
  props.device
    ? platformSessionSummary(props.device.id)
    : { onlineCount: 0, offlineCount: 0, latestOfflineAt: null, keepDays: 30 },
)

const TYPE_OPTIONS = [
  { label: '上线', value: '上线' },
  { label: '离线', value: '离线' },
]

const RANGE_PRESETS: RangePickerProps['presets'] = [
  { label: '今日', value: [dayjs().startOf('day'), dayjs().endOf('day')] },
  { label: '近 7 天', value: [dayjs().add(-6, 'd').startOf('day'), dayjs().endOf('day')] },
  { label: '近 30 天', value: [dayjs().add(-29, 'd').startOf('day'), dayjs().endOf('day')] },
]
const SHOW_TIME: RangePickerProps['showTime'] = { format: 'HH:mm:ss' }
const DATE_FORMAT = 'YYYY-MM-DD HH:mm:ss'

const draftType = ref<PlatformSessionEventType | null>(null)
const draftRange = ref<[Dayjs, Dayjs] | null>(null)

const applied = reactive({
  type: null as PlatformSessionEventType | null,
  from: null as number | null,
  to: null as number | null,
  hasFilter: false,
})

function boundsOf(range: [Dayjs, Dayjs] | null): [number | null, number | null] {
  if (!range?.[0] || !range?.[1]) return [null, null]
  return [range[0].startOf('second').valueOf(), range[1].endOf('second').valueOf()]
}

function handleSearch() {
  const [from, to] = boundsOf(draftRange.value)
  applied.type = draftType.value
  applied.from = from
  applied.to = to
  applied.hasFilter = Boolean(draftType.value || from !== null)
  page.value = 1
}

function handleReset() {
  draftType.value = null
  draftRange.value = null
  applied.type = null
  applied.from = null
  applied.to = null
  applied.hasFilter = false
  page.value = 1
}

const rows = computed(() => {
  if (!props.device) return []
  return platformDeviceSessions(props.device.id).filter((item) => {
    if (applied.type && item.type !== applied.type) return false
    if (applied.from !== null && item.at < applied.from) return false
    if (applied.to !== null && item.at > applied.to) return false
    return true
  })
})

const page = ref(1)
const pageSize = ref(10)

const pagination = computed(() => ({
  current: page.value,
  pageSize: pageSize.value,
  size: 'small' as const,
  showSizeChanger: true,
  pageSizeOptions: ['10', '20', '50'],
  showTotal: (total: number) => `共 ${total} 条`,
  onChange: (nextPage: number, nextSize: number) => {
    if (nextSize !== pageSize.value) {
      pageSize.value = nextSize
      page.value = 1
      return
    }
    page.value = nextPage
  },
}))

watch(
  () => props.device?.id,
  () => {
    handleReset()
  },
)

const columns: TableColumnsType<PlatformSessionEvent> = [
  { title: '时间', key: 'at', width: '30%' },
  { title: '事件', key: 'type', width: '20%' },
  { title: '说明', key: 'detail', width: '50%' },
]
</script>
