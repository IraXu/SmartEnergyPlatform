<template>
  <a-modal
    :open="open"
    :title="isBatch ? '批量迁移设备' : '迁移设备'"
    :width="480"
    :mask-closable="!submitting"
    :ok-button-props="{ loading: submitting }"
    ok-text="确认迁移"
    cancel-text="取消"
    @ok="handleSubmit"
    @cancel="handleClose"
  >
    <!-- 单条迁移：展示设备摘要与当前归属 -->
    <template v-if="!isBatch && device">
      <div class="devmove__summary">
        <span class="devmove__name">{{ device.name }}</span>
        <span class="devmove__meta">{{ device.imei }} · {{ device.license }}</span>
      </div>

      <div class="devmove__field">
        <span class="devmove__label">当前所属用能单元</span>
        <span class="devmove__current">{{ unitPath(device.unitId) }}</span>
      </div>
    </template>

    <!-- 批量迁移：明示已选条数与跨页标注 -->
    <p v-else class="devmove__lead">
      已选择 <strong>{{ selectedCount }}</strong> 台设备<template v-if="crossPage">（含其他页的选择）</template>。
    </p>

    <div class="devmove__field devmove__field--target">
      <span class="devmove__label">目标用能单元 <em>*</em></span>
      <a-tree-select
        v-model:value="targetUnitId"
        show-search
        tree-default-expand-all
        tree-node-filter-prop="title"
        tree-node-label-prop="path"
        placeholder="请选择目标用能单元"
        :tree-data="unitTree"
        :field-names="{ label: 'title', value: 'value', children: 'children' }"
        :styles="{ popup: { root: { maxHeight: '320px', overflow: 'auto' } } }"
        @change="targetError = ''"
      />
      <p v-if="targetError" class="devmove__error">{{ targetError }}</p>
    </div>

    <div class="devmove__notice">
      <p>迁移只影响迁移之后的数据落位，迁移之前已产生的告警与能耗记录仍归属原用能单元。</p>
      <p v-if="isBatch" class="devmove__notice-sub">已在目标用能单元下的设备将自动跳过。</p>
    </div>
  </a-modal>
</template>

<script setup lang="ts">
/**
 * 【原型说明】OVERLAY-03 设备迁移 / OVERLAY-04 批量迁移 的共用弹窗。
 * 迁移的唯一语义是「改所属用能单元」；目标仅可选「用能单元」，组织节点不可选；
 * 弹窗固定明示「历史数据不追溯」，批量迁移额外明示已选条数与跳过规则。
 */
import { computed, ref, watch } from 'vue'
import { message } from 'antdv-next'
import { moveDevice, moveDevices, unitPath, unitTreeData, validateMoveTarget } from '../store'
import type { Device } from '../store'

const props = defineProps<{
  open: boolean
  /** 单条迁移时的目标设备 */
  device?: Device | null
  /** 批量迁移时勾选的设备 id */
  selectedIds?: string[]
  /** 勾选是否含其他页的选择 */
  crossPage?: boolean
  /** 批量迁移时的全部待迁移设备（用于目标相同校验的展示） */
  devices?: Device[]
}>()

const emit = defineEmits<{ 'update:open': [boolean]; done: [void] }>()

const isBatch = computed(() => !props.device)
const selectedCount = computed(() => props.selectedIds?.length ?? 0)
const unitTree = computed(() => unitTreeData())

const targetUnitId = ref<string | null>(null)
const targetError = ref('')
const submitting = ref(false)

watch(
  () => props.open,
  (value) => {
    if (!value) {
      targetUnitId.value = null
      targetError.value = ''
      submitting.value = false
    }
  },
)

function handleClose() {
  if (submitting.value) return
  emit('update:open', false)
}

async function handleSubmit() {
  // 单条迁移：目标不可与当前相同
  if (!isBatch.value && props.device) {
    const issue = validateMoveTarget(props.device, targetUnitId.value ?? '')
    if (issue) {
      targetError.value = issue
      return
    }
  } else if (!targetUnitId.value) {
    targetError.value = '请选择目标用能单元'
    return
  }

  submitting.value = true
  try {
    if (isBatch.value) {
      const result = await moveDevices(props.selectedIds ?? [], targetUnitId.value as string)
      if (!result.success) {
        message.warning('所选设备均已在目标用能单元下，无需迁移')
      } else if (result.skipped) {
        message.warning(`迁移完成：成功 ${result.success} 台，跳过 ${result.skipped} 台（已在目标单元或已被删除）`)
      } else {
        message.success(`已迁移 ${result.success} 台设备`)
      }
    } else {
      await moveDevice((props.device as Device).id, targetUnitId.value as string)
      message.success('设备已迁移')
    }
    emit('done')
    emit('update:open', false)
  } catch (error) {
    targetError.value = error instanceof Error ? error.message : '迁移失败，请重试'
    message.error(targetError.value)
  } finally {
    submitting.value = false
  }
}
</script>
