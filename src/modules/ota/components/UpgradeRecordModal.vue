<template>
  <!-- OVERLAY-05 升级进度与记录（只读浮层） -->
  <a-modal
    v-model:open="visible"
    title="升级进度与记录"
    :width="860"
    :footer="null"
  >
    <p class="ota-record__lead">展示本企业全部升级任务（进行中与历史），展开可查看该任务的设备级结果与失败原因。</p>

    <a-table
      class="ota-record__table"
      size="small"
      :columns="taskColumns"
      :data-source="taskList"
      :pagination="{ pageSize: 10, size: 'small', showTotal: (t: number) => `共 ${t} 个任务` }"
      :scroll="{ x: 800 }"
      :expanded-row-keys="expandedKeys"
      row-key="id"
      @expand="handleExpand"
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'id'">
          <span class="device-cell__mono">{{ record.id }}</span>
        </template>

        <template v-else-if="column.key === 'targetVersions'">
          <span class="device-cell__mono">{{ versionText(record) }}</span>
        </template>

        <template v-else-if="column.key === 'createdAt'">
          <span class="ota-record__time">{{ formatTime(record.createdAt) }}</span>
        </template>

        <template v-else-if="column.key === 'status'">
          <span class="ota-record__tag" :class="statusClass(record.status)">{{ record.status }}</span>
        </template>

        <template v-else-if="column.key === 'result'">
          <span class="ota-record__result">
            成功 <strong>{{ countOf(record).success }}</strong> · 失败
            <strong :class="{ 'is-failed': countOf(record).failed }">{{ countOf(record).failed }}</strong>
            · 已跳过 {{ countOf(record).skipped }} · 共 {{ countOf(record).total }}
          </span>
        </template>
      </template>

      <!-- 设备级结果：展开任务后展示 -->
      <template #expandedRowRender="{ record }">
        <a-table
          class="ota-record__devices"
          size="small"
          :columns="deviceColumns"
          :data-source="record.devices"
          :pagination="false"
          row-key="deviceId"
        >
          <template #bodyCell="{ column, record: device }">
            <template v-if="column.key === 'fromVersion'">
              <span class="device-cell__mono">{{ device.fromVersion }}</span>
            </template>

            <template v-else-if="column.key === 'progress'">
              <div class="ota-progress__device">
                <span class="ota-progress__device-bar" :class="deviceBarClass(device.status)">
                  <i :style="{ width: `${devicePercent(device)}%` }" />
                </span>
                <span class="ota-progress__device-percent">{{ devicePercent(device) }}%</span>
              </div>
            </template>

            <template v-else-if="column.key === 'status'">
              <span class="ota-record__tag" :class="statusClass(device.status)">{{ device.status }}</span>
            </template>

            <template v-else-if="column.key === 'failReason'">
              <span v-if="device.failReason" class="ota-progress__fail" :title="device.failReason">{{ device.failReason }}</span>
              <span v-else class="device-cell__empty">—</span>
            </template>
          </template>
        </a-table>
      </template>
    </a-table>
  </a-modal>
</template>

<script setup lang="ts">
/**
 * OVERLAY-05 升级进度与记录
 * 【原型说明】按升级任务展示（进行中与历史），展开任务可查看设备级进度、状态与失败原因。
 * 只读，不提供取消升级、暂停与重试入口（失败后由用户在列表重新发起升级）。
 */
import { computed, ref, watch } from 'vue'
import type { TableColumnsType } from 'antdv-next'
import { otaTasks } from '../store'
import type { UpgradeTask, UpgradeTaskDevice, UpgradeTaskStatus } from '../store'

const props = defineProps<{
  open: boolean
  /** 打开时需自动展开的任务标识（从「查看进度与记录」进入时携带） */
  taskId: string | null
}>()

const emit = defineEmits<{ 'update:open': [boolean] }>()

const visible = computed({
  get: () => props.open,
  set: (value: boolean) => emit('update:open', value),
})

/** 任务列表：进行中在最上，其余按创建时间倒序 */
const taskList = computed(() =>
  [...otaTasks].sort((a, b) => {
    if (a.status === '进行中' && b.status !== '进行中') return -1
    if (a.status !== '进行中' && b.status === '进行中') return 1
    return b.createdAt - a.createdAt
  }),
)

const expandedKeys = ref<string[]>([])

// 打开时自动展开指定任务；未指定时展开第一个进行中任务
watch(
  () => props.open,
  (value) => {
    if (!value) return
    if (props.taskId) {
      expandedKeys.value = [props.taskId]
      return
    }
    const running = taskList.value.find((task) => task.status === '进行中')
    expandedKeys.value = running ? [running.id] : []
  },
)

/** 展开 / 收起：单任务展开，避免表格过长 */
function handleExpand(expanded: boolean, record: UpgradeTask) {
  expandedKeys.value = expanded ? [record.id] : []
}

const taskColumns: TableColumnsType<UpgradeTask> = [
  { title: '任务编号', key: 'id', width: 176 },
  { title: '目标固件版本', key: 'targetVersions', width: 132 },
  { title: '触发账号', key: 'account', dataIndex: 'account', width: 108 },
  { title: '创建时间', key: 'createdAt', width: 140 },
  { title: '状态', key: 'status', width: 92 },
  { title: '结果', key: 'result', width: 216 },
]

const deviceColumns: TableColumnsType<UpgradeTaskDevice> = [
  { title: '设备名称', key: 'deviceName', dataIndex: 'deviceName', width: 160, ellipsis: true },
  { title: '设备编号', key: 'deviceImei', dataIndex: 'deviceImei', width: 128, ellipsis: true },
  { title: '升级前版本', key: 'fromVersion', width: 104 },
  { title: '升级进度', key: 'progress', width: 116 },
  { title: '状态', key: 'status', width: 96 },
  { title: '失败原因', key: 'failReason', width: 150, ellipsis: true },
]

function versionText(task: UpgradeTask) {
  if (!task.targetVersions.length) return '—'
  if (task.targetVersions.length <= 3) return task.targetVersions.join(' / ')
  return `${task.targetVersions.slice(0, 3).join(' / ')} 等 ${task.targetVersions.length} 个版本`
}

function countOf(task: UpgradeTask) {
  return {
    success: task.devices.filter((item) => item.status === '升级成功').length,
    failed: task.devices.filter((item) => item.status === '升级失败').length,
    skipped: task.devices.filter((item) => item.status === '已跳过').length,
    total: task.devices.length,
  }
}

/** 设备级进度：成功与跳过均为 100%，失败取实际进度 */
function devicePercent(record: UpgradeTaskDevice) {
  if (record.status === '升级成功' || record.status === '已跳过') return 100
  return record.progress
}

const statusClass = (status: UpgradeTaskStatus | UpgradeTaskDevice['status']) => {
  if (status === '已完成' || status === '升级成功') return 'is-success'
  if (status === '全部失败' || status === '升级失败') return 'is-failed'
  if (status === '部分失败') return 'is-warn'
  if (status === '已跳过') return 'is-skip'
  return 'is-running'
}

const deviceBarClass = (status: UpgradeTaskDevice['status']) => {
  if (status === '升级成功') return 'is-success'
  if (status === '升级失败') return 'is-failed'
  if (status === '已跳过') return 'is-skip'
  return 'is-running'
}

const pad = (value: number) => String(value).padStart(2, '0')
function formatTime(at: number) {
  const date = new Date(at)
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}
</script>
