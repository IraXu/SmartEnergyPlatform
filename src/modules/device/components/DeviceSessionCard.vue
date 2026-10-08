<!--
  CARD-06 上下线记录
  【原型说明】设备详情页最后一屏：以事件流水展示设备最近 30 天的连接情况。
  上线与离线各自独立成一条记录，不做成对聚合，便于逐条排查「某时刻发生了什么」。
  记录只读，仅保留最近 30 天，与 MQTT 通讯日志同一口径。
  【折叠】默认收起，只露出概览统计，点击标题行展开查询区与记录列表。
  【分页】30 天内频繁上下线时记录量可观，故列表按下拉分页展示，避免无限平铺。
  【查询】查询条件为草稿态，必须点「查询」才生效、点「重置」才清空；
  概览统计始终按保留期全量口径，不受查询条件影响。
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

    <!-- 概览：紧凑内联，收起时也可见，便于不解锁详情即了解连接情况 -->
    <p v-if="summary.onlineCount || summary.offlineCount" class="devsess__summary" :class="{ 'is-collapsed': !open }">
      <span class="devsess__summary-item">
        上线 <em>{{ summary.onlineCount }}</em> 次
      </span>
      <span class="devsess__summary-sep">·</span>
      <span class="devsess__summary-item">
        掉线 <em>{{ summary.offlineCount }}</em> 次
      </span>
      <span class="devsess__summary-sep">·</span>
      <span class="devsess__summary-item">
        最近掉线
        <em>{{ summary.latestOfflineAt ? formatTime(summary.latestOfflineAt) : '保留期内未掉线' }}</em>
      </span>
    </p>

    <div v-show="open" class="devsess__body">
      <!-- 查询条件：事件类型 + 时间范围；均为草稿态，点「查询」后才作用于列表 -->
      <div class="devsess__filter">
        <a-select
          v-model:value="draftType"
          class="devsess__filter-item"
          allow-clear
          placeholder="全部事件"
          :options="TYPE_OPTIONS"
        />
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
 * 【原型说明】上下线记录卡片，对齐设备详情页「运行视图」定位：
 * 只读展示，不含任何编辑入口；数据由通讯侧写入，本卡片只负责呈现。
 * 设备当前的在线状态在顶部信息区与本页其他卡片已有呈现，此处不再重复。
 */
import { computed, reactive, ref, watch } from 'vue'
import dayjs from 'dayjs'
import type { Dayjs } from 'dayjs'
import type { RangePickerProps, TableColumnsType } from 'antdv-next'
import { DownOutlined, ReloadOutlined, SearchOutlined } from '@antdv-next/icons'
import { deviceSessions, formatTime, sessionSummary } from '../store'
import type { Device, DeviceSessionEvent, DeviceSessionEventType } from '../store'

const props = defineProps<{
  /** 目标设备；为 null 时不展示记录 */
  device: Device | null
}>()

/** 折叠态：默认收起，点击标题行展开；收起时仅保留概览统计 */
const open = ref(false)

/** 概览统计：保留期内全量口径，不随查询条件变化 */
const summary = computed(() =>
  props.device
    ? sessionSummary(props.device.id)
    : { onlineCount: 0, offlineCount: 0, latestOfflineAt: null, keepDays: 30 },
)

const TYPE_OPTIONS = [
  { label: '上线', value: '上线' },
  { label: '离线', value: '离线' },
]

/** 时间快捷范围：与告警中心保持一致的操作习惯 */
const RANGE_PRESETS: RangePickerProps['presets'] = [
  { label: '今日', value: [dayjs().startOf('day'), dayjs().endOf('day')] },
  { label: '近 7 天', value: [dayjs().add(-6, 'd').startOf('day'), dayjs().endOf('day')] },
  { label: '近 30 天', value: [dayjs().add(-29, 'd').startOf('day'), dayjs().endOf('day')] },
]

/** 时间选择精确到秒：面板给出时 / 分 / 秒三列，输入框按同一格式回显 */
const SHOW_TIME: RangePickerProps['showTime'] = { format: 'HH:mm:ss' }
const DATE_FORMAT = 'YYYY-MM-DD HH:mm:ss'

/* ---------- 查询条件：草稿态 → 点「查询」后才生效 ---------- */

/** 草稿态：界面上的控件值，未点查询前不参与过滤 */
const draftType = ref<DeviceSessionEventType | null>(null)
const draftRange = ref<[Dayjs, Dayjs] | null>(null)

/** 生效态：已点「查询」的条件，列表只按它过滤 */
const applied = reactive({
  type: null as DeviceSessionEventType | null,
  from: null as number | null,
  to: null as number | null,
  hasFilter: false,
})

/**
 * 时间范围取闭区间：起始下沉到该秒的第 0 毫秒、结束上抬到该秒的第 999 毫秒。
 * 日期控件已支持选择到时分秒（show-time），因此粒度收到「秒」，
 * 保证所选时刻本身与其所在整秒内的记录都能命中。
 */
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

/** 查询结果：事件类型精确匹配 + 时间范围闭区间 */
const rows = computed(() => {
  if (!props.device) return []
  return deviceSessions(props.device.id).filter((item) => {
    if (applied.type && item.type !== applied.type) return false
    if (applied.from !== null && item.at < applied.from) return false
    if (applied.to !== null && item.at > applied.to) return false
    return true
  })
})

/* ---------- 分页 ---------- */

const page = ref(1)
const pageSize = ref(10)

const pagination = computed(() => ({
  current: page.value,
  pageSize: pageSize.value,
  size: 'small' as const,
  showSizeChanger: true,
  pageSizeOptions: ['10', '20', '50'],
  showTotal: (total: number) => `共 ${total} 条`,
  /** 每页条数变化时回到第 1 页，避免停留在越界页码 */
  onChange: (nextPage: number, nextSize: number) => {
    if (nextSize !== pageSize.value) {
      pageSize.value = nextSize
      page.value = 1
      return
    }
    page.value = nextPage
  },
}))

/** 切换设备时清空查询条件与分页，避免上一台设备的条件被沿用 */
watch(
  () => props.device?.id,
  () => {
    handleReset()
  },
)

/* ---------- 列 ---------- */

/**
 * 列宽按比例分配（合计 100%）使三列均匀铺满整行；
 * 若只给部分列定宽、末列留空，剩余宽度会被末列独吞，表头会挤在左侧。
 */
const columns: TableColumnsType<DeviceSessionEvent> = [
  { title: '时间', key: 'at', width: '30%' },
  { title: '事件', key: 'type', width: '20%' },
  { title: '说明', key: 'detail', width: '50%' },
]
</script>
