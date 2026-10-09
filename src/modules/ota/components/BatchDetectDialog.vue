<template>
  <!-- OVERLAY-02 批量检测确认 -->
  <a-modal
    v-model:open="visible"
    title="检测设备升级"
    :width="480"
    :mask-closable="!running"
    :closable="!running"
    :keyboard="!running"
    :ok-text="finished ? '完成' : '确认检测'"
    cancel-text="取消"
    :cancel-button-props="{ disabled: running }"
    :ok-button-props="{ loading: running }"
    @ok="handleOk"
    @cancel="handleCancel"
  >
    <div class="ota-detect">
      <p class="ota-detect__lead">
        将检测 <strong>{{ deviceIds.length }}</strong> 台设备
      </p>
      <p class="ota-detect__scope">{{ scopeLabel }}</p>

      <!-- 跳过说明：存在从未建连或升级中设备时展示 -->
      <p v-if="skippedCount" class="ota-detect__skip">
        其中 {{ skippedCount }} 台不可检测（从未建连或升级中），将跳过
      </p>

      <!-- 检测进度与结果汇总 -->
      <div v-if="started" class="ota-detect__progress">
        <a-progress :percent="percent" :status="finished ? 'success' : 'active'" />
        <p class="ota-detect__count">已检测 {{ done }} / {{ total }}</p>
        <p v-if="finished" class="ota-detect__summary">
          有新固件 {{ result.newFirmware }} 台 · 已是最新 {{ result.upToDate }} 台 · 失败 {{ result.failed }} 台
        </p>
      </div>
    </div>
  </a-modal>
</template>

<script setup lang="ts">
/**
 * OVERLAY-02 批量检测确认
 * 【原型说明】检测范围为「当前查询结果」（页面头入口）或「已勾选的设备」（操作条入口）；
 * 提交后展示检测进度与结果汇总；检测可后台继续（关闭弹窗不中断）。
 */
import { computed, ref, watch } from 'vue'
import { message } from 'antdv-next'
import { devices } from '@/modules/device/store'
import { detectDevices, isDetectable } from '../store'
import type { DetectBatchResult } from '../store'

const props = defineProps<{
  open: boolean
  /** 待检测的设备标识清单 */
  deviceIds: string[]
  /** 范围来源文案，如「检测范围：当前查询结果」 */
  scopeLabel: string
}>()

const emit = defineEmits<{ 'update:open': [boolean]; done: [DetectBatchResult] }>()

const visible = computed({
  get: () => props.open,
  set: (value: boolean) => emit('update:open', value),
})

const running = ref(false)
const started = ref(false)
const finished = ref(false)
const done = ref(0)
const total = ref(0)
const result = ref<DetectBatchResult>({ newFirmware: 0, upToDate: 0, failed: 0, skipped: 0 })

/** 提交时将被跳过的台数（从未建连 / 升级中） */
const skippedCount = computed(() => {
  const targets = props.deviceIds
    .map((id) => devices.find((item) => item.id === id))
    .filter((item): item is (typeof devices)[number] => Boolean(item))
  return targets.length - targets.filter(isDetectable).length
})

const percent = computed(() => (total.value ? Math.round((done.value / total.value) * 100) : 0))

// 关闭即重置本次检测的展示状态，便于下次重新打开
watch(
  () => props.open,
  (value) => {
    if (value) return
    running.value = false
    started.value = false
    finished.value = false
    done.value = 0
    total.value = 0
    result.value = { newFirmware: 0, upToDate: 0, failed: 0, skipped: 0 }
  },
)

async function handleOk() {
  // 检测完成后按钮转为「完成」，仅关闭弹窗
  if (finished.value) {
    visible.value = false
    return
  }
  running.value = true
  started.value = true
  total.value = props.deviceIds.filter((id) => {
    const device = devices.find((item) => item.id === id)
    return device ? isDetectable(device) : false
  }).length
  done.value = 0

  try {
    const summary = await detectDevices(props.deviceIds, (current) => {
      done.value = current
    })
    result.value = summary
    finished.value = true
    running.value = false

    const { newFirmware, upToDate, failed, skipped } = summary
    if (newFirmware + upToDate + failed === 0) {
      // 全部被跳过（从未建连 / 升级中）或全部不可检测
      message.warning(skipped ? '所选设备均不可检测（从未建连或升级中）' : '检测失败，所选设备均未响应，请确认设备在线状态后重试')
    } else if (failed === 0) {
      message.success(`检测完成：有新固件 ${newFirmware} 台，已是最新 ${upToDate} 台`)
    } else {
      message.warning(`检测完成：有新固件 ${newFirmware} 台，已是最新 ${upToDate} 台，失败 ${failed} 台`)
    }
    emit('done', summary)
  } catch (error) {
    running.value = false
    finished.value = true
    message.error(error instanceof Error ? error.message : '批量检测中断，请重试')
  }
}

function handleCancel() {
  visible.value = false
}
</script>
