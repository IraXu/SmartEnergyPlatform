<template>
  <!-- OVERLAY-03 升级确认（单台）/ OVERLAY-04 批量升级确认 -->
  <a-modal
    v-model:open="visible"
    :title="isBatch ? '批量升级设备固件' : '升级设备固件'"
    :width="560"
    :mask-closable="!submitting"
    :closable="!submitting"
    :keyboard="!submitting"
    ok-text="确认升级"
    cancel-text="取消"
    :ok-button-props="{ loading: submitting }"
    @ok="handleSubmit"
    @cancel="handleCancel"
  >
    <!-- 单台：设备摘要 -->
    <div v-if="!isBatch && device" class="device-confirm">
      <div class="device-confirm__head">
        <span class="device-confirm__name">{{ device.name }}</span>
        <span class="device-cell__type">{{ device.type }}</span>
      </div>
      <p class="device-confirm__meta">{{ device.imei }} · {{ device.license }}</p>
      <p class="device-confirm__meta">{{ unitPath(device.unitId) }}</p>
    </div>

    <!-- 批量：已选条数 -->
    <p v-else class="ota-upgrade__lead">
      已选择 <strong>{{ selectedIds.length }}</strong> 台设备<template v-if="crossPage">（含其他页的选择）</template>
    </p>

    <!-- 可升级与跳过条数（批量） -->
    <p v-if="isBatch" class="ota-upgrade__count">
      可升级 <strong>{{ upgradeCount }}</strong> 台，将跳过 {{ skipped }} 台（已是最新版本 / 从未建连 / 升级中）
    </p>

    <!-- 版本对比 / 目标版本 -->
    <div class="ota-upgrade__compare">
      <template v-if="!isBatch && release">
        <span class="ota-upgrade__version">当前版本 {{ currentVersion || '—' }}</span>
        <span class="ota-upgrade__arrow">→</span>
        <span class="ota-upgrade__version is-target">目标版本 {{ release.version }}</span>
      </template>
      <template v-else-if="targetVersions.length === 1">
        <span class="ota-upgrade__version is-target">目标版本 {{ targetVersions[0] }}</span>
      </template>
      <template v-else>
        <span class="ota-upgrade__version is-target">
          目标版本：{{ targetVersions.slice(0, 3).join(' / ') }}<template v-if="targetVersions.length > 3"> 等 {{ targetVersions.length }} 个版本</template>
        </span>
      </template>
    </div>
    <p v-if="isBatch" class="ota-upgrade__hint">目标版本取自平台固件基线中与该设备匹配的最新版本</p>

    <!-- 更新说明：全量展示，浅底描边块，便于复核本次升级带来的变化 -->
    <div v-if="!isBatch && release" class="ota-upgrade__notes">
      <span class="ota-content__label">更新说明</span>
      <div class="ota-upgrade__notes-box">
        <ul v-if="release.notes.length" class="ota-content__notes">
          <li v-for="(note, index) in release.notes" :key="index">{{ note }}</li>
        </ul>
        <p v-else class="ota-content__empty">该版本未提供更新说明</p>
      </div>
    </div>
    <div v-else-if="isBatch && targetVersions.length > 1" class="ota-upgrade__notes">
      <span class="ota-content__label">更新说明</span>
      <div class="ota-upgrade__notes-box">
        <p class="ota-upgrade__hint">涉及 {{ targetVersions.length }} 个固件版本，请逐台查看升级内容</p>
      </div>
    </div>
    <div v-else-if="isBatch" class="ota-upgrade__notes">
      <span class="ota-content__label">更新说明</span>
      <div class="ota-upgrade__notes-box">
        <ul v-if="sharedNotes.length" class="ota-content__notes">
          <li v-for="(note, index) in sharedNotes" :key="index">{{ note }}</li>
        </ul>
        <p v-else class="ota-content__empty">该版本未提供更新说明</p>
      </div>
    </div>

    <!-- 影响说明：两条固定提示 -->
    <div class="ota-upgrade__warn">
      升级期间设备将重启并短暂离线，请勿在升级期间断电。
    </div>
    <div class="ota-upgrade__danger">
      升级不可回滚，且不提供版本降级。
    </div>
  </a-modal>
</template>

<script setup lang="ts">
/**
 * OVERLAY-03 升级确认（单台）/ OVERLAY-04 批量升级确认
 * 【原型说明】两条固定风险提示（重启离线 / 不可回滚）均不可省略；
 * 批量升级明示可升级与跳过条数，取消时保留勾选。
 */
import { computed, ref } from 'vue'
import { devices, unitPath } from '@/modules/device/store'
import { latestReleaseOf } from '../store'

const props = defineProps<{
  open: boolean
  /** 单台升级时的设备标识 */
  deviceId: string | null
  /** 单台升级时该设备的当前固件版本 */
  currentVersion: string
  /** 批量升级时的已选设备标识 */
  selectedIds: string[]
  /** 批量时是否含其他页的选择 */
  crossPage: boolean
  /** 可升级台数（批量，由父组件按跳过规则计算） */
  upgradeCount: number
  /** 跳过台数（批量） */
  skipped: number
  /** 各设备的目标版本（批量去重后） */
  targetVersions: string[]
}>()

const emit = defineEmits<{
  'update:open': [boolean]
  submit: []
}>()

const visible = computed({
  get: () => props.open,
  set: (value: boolean) => emit('update:open', value),
})

const submitting = ref(false)

const isBatch = computed(() => props.selectedIds.length > 0)
const device = computed(() => devices.find((item) => item.id === props.deviceId) ?? null)
const release = computed(() => (device.value ? latestReleaseOf(device.value) : null))

/** 批量时若目标版本唯一，取该版本的更新说明做摘要 */
const sharedNotes = computed(() => {
  if (props.targetVersions.length !== 1) return []
  const matched = devices
    .map((item) => latestReleaseOf(item))
    .find((item) => item && item.version === props.targetVersions[0])
  return matched?.notes ?? []
})

function handleCancel() {
  visible.value = false
}

function handleSubmit() {
  submitting.value = true
  emit('submit')
}

/** 父组件在提交结束后回调，关闭 loading */
defineExpose({
  finish() {
    submitting.value = false
  },
})
</script>
