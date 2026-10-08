<template>
  <!-- OVERLAY-01 升级内容（只读浮层） -->
  <a-modal
    v-model:open="visible"
    title="升级内容"
    :width="560"
    :footer="null"
  >
    <div v-if="loading" class="ota-content__loading">
      <a-skeleton active :paragraph="{ rows: 5 }" />
    </div>

    <div v-else-if="failed" class="device-state">
      <span class="device-state__icon device-state__icon--error"><DisconnectOutlined /></span>
      <p class="device-state__title">升级内容加载失败</p>
      <p class="device-state__desc">网络异常或服务暂时不可用，请稍后重试</p>
      <a-button type="primary" size="small" @click="load">
        <template #icon><ReloadOutlined /></template>
        重新加载
      </a-button>
    </div>

    <div v-else-if="release" class="ota-content">
      <!-- 版本对比 -->
      <div class="ota-content__compare">
        <div class="ota-content__versions">
          <span class="ota-content__version">
            <em>当前版本</em>
            <strong>{{ currentVersion || '—' }}</strong>
          </span>
          <span class="ota-content__arrow">→</span>
          <span class="ota-content__version">
            <em>目标版本</em>
            <strong class="is-target">{{ release.version }}</strong>
          </span>
        </div>
        <p class="ota-content__meta">发布日期 {{ release.releasedAt }} · 固件大小 {{ release.size }}</p>
      </div>

      <!-- 适配设备 -->
      <div class="ota-content__field">
        <span class="ota-content__label">适配设备</span>
        <span class="ota-content__value">{{ device?.type }} · {{ device?.model }}</span>
      </div>

      <!-- 更新说明 -->
      <div class="ota-content__field">
        <span class="ota-content__label">更新说明</span>
        <ul v-if="release.notes.length" class="ota-content__notes">
          <li v-for="(note, index) in release.notes" :key="index">{{ note }}</li>
        </ul>
        <p v-else class="ota-content__empty">暂无更新说明</p>
      </div>

      <!-- 升级提示（固定文案） -->
      <div class="ota-content__warn">
        升级期间设备将重启并短暂离线，请勿在升级期间断电；升级不可回滚，且不提供版本降级。
      </div>
    </div>

    <div v-else class="ota-content__blank">该设备暂无可用升级内容</div>
  </a-modal>
</template>

<script setup lang="ts">
/**
 * OVERLAY-01 升级内容
 * 【原型说明】只读浮层，可从列表行内与升级确认弹窗两处打开，内容一致。
 * 固件内容由平台运营方维护，本浮层不提供任何编辑入口。
 */
import { computed, ref, watch } from 'vue'
import { DisconnectOutlined, ReloadOutlined } from '@antdv-next/icons'
import { devices } from '@/modules/device/store'
import { latestReleaseOf } from '../store'

const props = defineProps<{
  open: boolean
  deviceId: string | null
  currentVersion: string
}>()

const emit = defineEmits<{ 'update:open': [boolean] }>()

const visible = computed({
  get: () => props.open,
  set: (value: boolean) => emit('update:open', value),
})

const loading = ref(false)
const failed = ref(false)

const device = computed(() => devices.find((item) => item.id === props.deviceId) ?? null)
const release = computed(() => (device.value ? latestReleaseOf(device.value) : null))
/** 当前版本：取设备档案登记的固件版本（OTA 状态中的当前版本） */
const currentVersion = computed(() => props.currentVersion || '')

// 【原型说明】模拟加载耗时
watch(
  () => props.open,
  (value) => {
    if (!value) return
    loading.value = true
    failed.value = false
    window.setTimeout(() => {
      loading.value = false
    }, 360)
  },
)

function load() {
  loading.value = true
  failed.value = false
  window.setTimeout(() => {
    loading.value = false
  }, 360)
}
</script>
