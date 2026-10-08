<template>
  <!-- OVERLAY-04 执行记录（只读） -->
  <a-modal
    v-model:open="visible"
    title="执行记录"
    :width="920"
    :footer="null"
    wrap-class-name="lst-record-modal"
  >
    <!-- 先讲清「一条记录 = 一次触发」，再看明细：批次含义是理解本弹窗的前提 -->
    <ul class="lst-record__lead">
      <li><strong>一条记录 = 一次触发</strong>：策略每命中一个时间点或一个事件，就产生一条记录。</li>
      <li>点左侧 <strong>+</strong> 展开该次触发下每台设备的结果与失败原因；本浮层只读，不提供重试 / 撤销。</li>
    </ul>

    <a-table
      class="lst-record__table"
      size="small"
      :columns="batchColumns"
      :data-source="batchList"
      :pagination="{ pageSize: 10, size: 'small', showTotal: (t: number) => `共 ${t} 条触发记录` }"
      :scroll="{ x: 880 }"
      :expanded-row-keys="expandedKeys"
      row-key="id"
      @expand="handleExpand"
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'at'">
          <span class="lst-record__time">{{ formatTime(record.at) }}</span>
        </template>

        <!-- 策略名与「已删除」标注同一行：名称过长时先压缩名称，标注始终可见 -->
        <template v-else-if="column.key === 'strategyName'">
          <span class="lst-record__strategy">
            <span class="lst-record__name" :title="record.strategyName">{{ record.strategyName }}</span>
            <span v-if="!strategyExists(record)" class="lst-record__gone">已删除</span>
          </span>
        </template>

        <!-- 触发来源：方式标签 + 具体命中对象，回答「这次为什么触发」 -->
        <template v-else-if="column.key === 'trigger'">
          <span class="lst-record__trigger">
            <span class="lst-tag" :class="record.triggerType === '时控' ? 'lst-tag--time' : 'lst-tag--event'">
              {{ record.triggerType }}
            </span>
            <span class="lst-record__trigger-detail" :title="record.triggerDetail">{{ record.triggerDetail }}</span>
          </span>
        </template>

        <template v-else-if="column.key === 'action'">
          <span
            class="lst-action"
            :class="record.action === '拉闸' ? 'lst-action--close' : 'lst-action--open'"
          >{{ record.action }}</span>
        </template>

        <template v-else-if="column.key === 'deviceCount'">
          <span class="lst-record__count">{{ record.devices.length }} 台</span>
        </template>

        <!-- 执行结果：结论标签 + 成功 / 失败 / 跳过计数同排，一眼看清结论与构成 -->
        <template v-else-if="column.key === 'result'">
          <span class="lst-record__result">
            <span class="lst-record__tag" :class="resultClass(batchResultOf(record))">{{ batchResultOf(record) }}</span>
            <span class="lst-record__summary">
              成功
              <strong>{{ countOfBatch(record).success }}</strong>
              · 失败
              <strong :class="{ 'is-failed': countOfBatch(record).failed }">{{ countOfBatch(record).failed }}</strong>
              · 跳过
              <strong>{{ countOfBatch(record).skipped }}</strong>
            </span>
          </span>
        </template>
      </template>

      <!-- 设备级结果：展开该次触发后展示 -->
      <template #expandedRowRender="{ record }">
        <div class="lst-record__detail">
          <div class="lst-record__detail-head">
            <span class="lst-record__detail-title">本次触发的设备结果</span>
            <span class="lst-record__detail-meta">
              {{ record.strategyName }} · {{ formatTime(record.at) }} · {{ record.triggerDetail }} · {{ record.action }}
            </span>
          </div>
          <a-table
            class="lst-record__devices"
            size="small"
            :columns="deviceColumns"
            :data-source="record.devices"
            :pagination="false"
            :scroll="{ x: 720 }"
            row-key="deviceId"
          >
            <template #bodyCell="{ column, record: device }">
              <template v-if="column.key === 'unit'">
                <span class="lst-record__path" :title="deviceUnitPath(device.unitId)">
                  {{ deviceUnitPath(device.unitId) }}
                </span>
              </template>

              <template v-else-if="column.key === 'action'">
                <span
                  class="lst-action"
                  :class="device.action === '拉闸' ? 'lst-action--close' : 'lst-action--open'"
                >{{ device.action }}</span>
              </template>

              <template v-else-if="column.key === 'result'">
                <span class="lst-record__tag" :class="resultClass(device.result)">{{ device.result }}</span>
              </template>

              <template v-else-if="column.key === 'reason'">
                <!-- 失败为异常、跳过为预期外未执行：同一列用颜色区分，避免把「未接入」读成故障 -->
                <span
                  v-if="device.reason"
                  class="lst-record__reason"
                  :class="{ 'is-skip': device.result === '已跳过' }"
                  :title="device.reason"
                >{{ device.reason }}</span>
                <span v-else class="lst-record__empty">—</span>
              </template>
            </template>
          </a-table>
        </div>
      </template>

      <template #emptyText>
        <div class="lst-record__empty-block">
          <a-empty description="暂无执行记录" />
        </div>
      </template>
    </a-table>
  </a-modal>
</template>

<script setup lang="ts">
/**
 * OVERLAY-04 执行记录
 * 【原型说明】按执行批次展示（执行时间、策略名称、触发来源、动作、设备台数、执行结果），
 * 展开批次可见设备级结果与失败原因。只读，不提供重试 / 撤销 / 删除入口。
 * 批次即「一次触发」：同一策略按不同时间点 / 事件触发会形成多条记录，因此用「触发来源」列
 * 明确本次命中的时间点或事件，避免用户误读为重复记录。
 * 按执行时间倒序（不做「进行中置顶」：批次通常秒级完成，避免列表跳动）；
 * 策略删除后批次保留，策略名称取删除时的快照。
 */
import { computed, ref, watch } from 'vue'
import type { TableColumnsType } from 'antdv-next'
import {
  batchResultOf,
  countOfBatch,
  deviceUnitPath,
  formatTime,
  getStrategy,
  sortedBatches,
  type BatchResult,
  type ExecBatch,
  type ExecDeviceResult,
  type ExecResult,
} from '../store'

const props = defineProps<{ open: boolean }>()

const emit = defineEmits<{ 'update:open': [boolean] }>()

const visible = computed({
  get: () => props.open,
  set: (value: boolean) => emit('update:open', value),
})

const batchList = computed(() => sortedBatches())

const expandedKeys = ref<string[]>([])

// 打开时收起展开行，避免上次的展开状态在下次打开时残留
watch(
  () => props.open,
  (value) => {
    if (value) expandedKeys.value = []
  },
)

/** 展开 / 收起：单批次展开，避免表格过长 */
function handleExpand(expanded: boolean, record: ExecBatch) {
  expandedKeys.value = expanded ? [record.id] : []
}

/** 批次对应的策略是否仍在册：已删除策略的批次按名称快照保留，需标注区分 */
const strategyExists = (batch: ExecBatch) => Boolean(getStrategy(batch.strategyId))

const batchColumns: TableColumnsType<ExecBatch> = [
  { title: '执行时间', key: 'at', width: 148 },
  { title: '策略名称', key: 'strategyName', width: 170 },
  { title: '触发来源', key: 'trigger', width: 158 },
  { title: '动作', key: 'action', width: 76 },
  { title: '设备台数', key: 'deviceCount', width: 84 },
  { title: '执行结果', key: 'result', width: 236 },
]

const deviceColumns: TableColumnsType<ExecDeviceResult> = [
  { title: '设备名称', key: 'deviceName', dataIndex: 'deviceName', width: 160, ellipsis: true },
  { title: '所属用能单元', key: 'unit', width: 216 },
  { title: '动作', key: 'action', width: 80 },
  { title: '执行结果', key: 'result', width: 96 },
  { title: '失败原因', key: 'reason', width: 168, ellipsis: true },
]

const resultClass = (result: BatchResult | ExecResult) => {
  if (result === '成功') return 'is-success'
  if (result === '失败' || result === '全部失败') return 'is-failed'
  if (result === '部分失败') return 'is-warn'
  return 'is-skip'
}
</script>
