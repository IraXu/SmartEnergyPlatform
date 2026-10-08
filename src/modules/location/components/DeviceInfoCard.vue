<!--
  OVERLAY-02 设备信息卡（《产品交互设计文档-点位地图》v1.0 5.2）
  【原型说明】点击设备标记后弹出，锚定标记展示设备关键信息，卡内可进入设备详情。
  无 `device:ledger` 权限点时不渲染「查看详情」（不置灰、不提示）；设备名称始终为纯文本，
  避免与底部「查看详情」入口重复。
  定位与遮挡规则：默认在标记上方 14px 水平居中；标记靠近上边缘时改为下方；
  标记靠近左右边缘时卡片水平方向贴边对齐，确保不超出地图区边界。
-->
<template>
  <div
    v-if="profile"
    class="loc-card"
    :style="cardStyle"
    role="dialog"
    aria-label="设备信息卡"
    @click.stop
  >
    <!-- 头部：状态色条 + 设备名 + 关闭 -->
    <div class="loc-card__head" :class="`loc-card__head--${stateClass(profile.onlineState)}`">
      <span class="loc-card__avatar" :class="`loc-card__avatar--${stateClass(profile.onlineState)}`">
        <HddOutlined />
      </span>
      <div class="loc-card__title">
        <p class="loc-card__name" :title="profile.name">{{ profile.name }}</p>
        <span class="loc-card__online" :class="`loc-card__online--${stateClass(profile.onlineState)}`">
          <i class="loc-card__online-dot" />
          {{ STATE_TEXT[profile.onlineState] }}
        </span>
      </div>
      <a-button type="text" size="small" aria-label="关闭" @click="emit('close')">
        <template #icon><CloseOutlined /></template>
      </a-button>
    </div>

    <dl class="loc-card__body">
      <div class="loc-card__row">
        <dt class="loc-card__label">设备类型</dt>
        <dd class="loc-card__value">
          <span class="loc-tag">{{ profile.type }}</span>
        </dd>
      </div>
      <div class="loc-card__row">
        <dt class="loc-card__label">所属用能单元</dt>
        <dd class="loc-card__value">{{ profile.unitPath }}</dd>
      </div>
      <div class="loc-card__row">
        <dt class="loc-card__label">License</dt>
        <dd class="loc-card__value loc-mono">{{ profile.license }}</dd>
      </div>
      <div class="loc-card__row">
        <dt class="loc-card__label">GPS 坐标</dt>
        <dd class="loc-card__value loc-mono">{{ profile.coordinate }}</dd>
      </div>
    </dl>

    <div v-if="openDeviceDetail" class="loc-card__foot">
      <a-button type="primary" size="small" block @click="emit('view-detail', profile.id)">
        查看详情
      </a-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { CloseOutlined, HddOutlined } from '@antdv-next/icons'
import { MARKER_STATE_TEXT, deviceProfile } from '../store'
import type { DeviceOnlineState } from '../store'

const props = defineProps<{
  /** 当前设备 id */
  deviceId: string
  /** 是否渲染设备详情跳转入口（依赖 device:ledger 权限点） */
  openDeviceDetail: boolean
  /** 标记在画布内的位置（百分比字符串），用于卡片锚定 */
  anchor: { left: string; top: string }
}>()

const emit = defineEmits<{
  close: []
  'view-detail': [string]
}>()

const STATE_TEXT = MARKER_STATE_TEXT

const profile = computed(() => (props.deviceId ? deviceProfile(props.deviceId) : null))

/**
 * 卡片定位：以标记为锚点，
 * - left 钳制在 4%~68% 之间，避免卡片（宽 300px）在地图右缘溢出
 * - top 默认在标记上方展开；标记位于画布上半部（卡片高度约占 36%）时改为下方展开，避免顶部溢出
 */
const cardStyle = computed(() => {
  const top = Number.parseFloat(props.anchor.top)
  const left = Number.parseFloat(props.anchor.left)
  const placement = top < 36 ? 'below' : 'above'
  return {
    left: `${Math.min(Math.max(left, 4), 68)}%`,
    top: `${top}%`,
    transform: placement === 'below' ? 'translate(0, 16px)' : 'translate(0, calc(-100% - 16px))',
  }
})

function stateClass(state: DeviceOnlineState) {
  return state === '在线' ? 'online' : state === '离线' ? 'offline' : 'unknown'
}
</script>
