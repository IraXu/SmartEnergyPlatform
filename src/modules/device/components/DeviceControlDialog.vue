<!--
  OVERLAY-10 设备控制（PRD F-DEV-15）
  【原型说明】从设备详情页工具栏打开。5 个指令按「读取类 / 开关类 / 通讯类」分组：
  校时、抄表、重连为常态操作；合闸、分闸影响现场供电，用警示样式区分。
  点击任一指令均先二次确认（danger 类确认弹窗突出风险），确认后下发并给出结果反馈；
  每次下发都会在 MQTT 通讯日志中留下一条下行记录。
  【权限】弹窗入口不设权限点，5 个指令各自独立授权：
  无该指令权限时按钮置灰并说明原因；无任何指令权限时给出统一提示。
-->
<template>
  <a-modal
    :open="open"
    title="设备控制"
    :width="560"
    :footer="null"
    :mask-closable="!running"
    @cancel="close"
  >
    <div v-if="device" class="devctl">
      <!-- 目标设备：名称与类型为主，License 优先于设备识别码（IMEI）展示 -->
      <div class="devctl__target">
        <div class="devctl__target-main">
          <span class="devctl__target-name" :title="device.name">{{ device.name }}</span>
          <span v-if="device.type" class="device-cell__type">{{ device.type }}</span>
        </div>
        <dl class="devctl__ident">
          <div class="devctl__ident-row">
            <dt>License</dt>
            <dd class="device-cell__mono" :title="device.license">{{ device.license || '—' }}</dd>
          </div>
          <div class="devctl__ident-row">
            <dt>IMEI</dt>
            <dd class="device-cell__mono" :title="device.imei">{{ device.imei || '—' }}</dd>
          </div>
        </dl>
      </div>

      <!-- 无任何指令权限：统一提示，不展示指令清单 -->
      <a-alert
        v-if="!hasAnyPermission"
        class="devctl__alert"
        type="warning"
        show-icon
        message="当前账号未被授予任何设备控制指令权限，请联系管理员在「角色管理」中配置后重试。"
      />
      <!-- 设备不可控（未接入 / 离线）：说明原因，仍展示清单便于了解设备可用能力 -->
      <a-alert
        v-else-if="!controllable"
        class="devctl__alert"
        type="warning"
        show-icon
        :message="unavailableReason"
      />
      <!-- 设备可控且至少有一项指令权限：风险提示。合闸、分闸影响现场供电，用 warning 强化 -->
      <a-alert
        v-else
        class="devctl__alert"
        type="warning"
        show-icon
        message="合闸、分闸会直接影响现场供电，请谨慎操作。"
      />

      <!-- 指令清单：无权限与设备不可控两种情况都置灰，disabledReason 给出对应原因 -->
      <div v-if="hasAnyPermission" class="devctl__list">
        <button
          v-for="item in DEVICE_COMMANDS"
          :key="item.name"
          type="button"
          class="devctl__item"
          :class="{ 'is-danger': item.risk === 'danger' }"
          :disabled="!canRun(item) || running"
          :title="disabledReason(item)"
          @click="ask(item)"
        >
          <span class="devctl__item-icon" aria-hidden="true">
            <component :is="iconOf(item.name)" />
          </span>
          <span class="devctl__item-text">
            <span class="devctl__item-name">{{ item.name }}</span>
            <span class="devctl__item-desc">{{ item.desc }}</span>
          </span>
          <span v-if="!granted(item)" class="devctl__item-lock">无权限</span>
          <span v-else-if="item.risk === 'danger'" class="devctl__item-risk">影响供电</span>
        </button>
      </div>

      <p class="devctl__note">
        指令下发结果会记入「MQTT 通讯日志」；设备需「已接入」且在线才能接收指令。
      </p>
    </div>
  </a-modal>

  <!-- 二次确认：独立弹窗，danger 类指令以警示样式呈现风险文案 -->
  <a-modal
    v-model:open="confirmOpen"
    :title="pending ? `确认下发「${pending.name}」指令？` : '确认下发指令？'"
    :width="440"
    :mask-closable="false"
    :ok-button-props="{ loading: running, danger: pending?.risk === 'danger' }"
    :ok-text="pending?.risk === 'danger' ? '确认下发' : '确定'"
    cancel-text="取消"
    @ok="handleConfirm"
  >
    <template v-if="pending">
      <p class="devctl__confirm-text" :class="{ 'is-danger': pending.risk === 'danger' }">
        {{ pending.confirmText }}
      </p>
      <p class="devctl__confirm-target">
        目标设备：{{ device?.name }}（{{ device?.license || '—' }}）
      </p>
    </template>
  </a-modal>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { message } from 'antdv-next'
import {
  LinkOutlined,
  PoweroffOutlined,
  ReadOutlined,
  SyncOutlined,
  ThunderboltOutlined,
} from '@antdv-next/icons'
import { currentPermissions } from '@/modules/role/store'
import { DEVICE_COMMANDS, sendDeviceCommand } from '../store'
import type { Device, DeviceCommand, DeviceCommandItem } from '../store'

const props = defineProps<{
  /** 弹窗开关（v-model:open） */
  open: boolean
  /** 目标设备；为 null 时不渲染内容 */
  device: Device | null
}>()

const emit = defineEmits<{
  'update:open': [boolean]
}>()

/** 指令与图标的对应关系：读取类用文档 / 时钟，开关类用电源，通讯类用链接 */
const ICONS: Record<DeviceCommand, unknown> = {
  校时: SyncOutlined,
  抄表: ReadOutlined,
  合闸: ThunderboltOutlined,
  分闸: PoweroffOutlined,
  重连: LinkOutlined,
}

const iconOf = (name: DeviceCommand) => ICONS[name]

/* ---------- 权限：入口常显，能力收敛到指令级 ---------- */

const perms = computed(() => currentPermissions())
const granted = (item: DeviceCommandItem) => perms.value.includes(item.permission)
const hasAnyPermission = computed(() => DEVICE_COMMANDS.some((item) => granted(item)))

/** 可控制条件：设备已接入且在线（PRD F-DEV-15 前置条件） */
const controllable = computed(() => Boolean(props.device) && props.device!.accessStatus === '已接入' && props.device!.onlineStatus === '在线')

const unavailableReason = computed(() => {
  if (!props.device) return ''
  if (props.device.accessStatus !== '已接入') return '该设备尚未接入平台，暂不支持下发控制指令。'
  if (props.device.onlineStatus !== '在线') return '该设备当前离线，控制指令无法送达，请确认设备通信状态后重试。'
  return ''
})

/** 指令是否可点：同时具备该指令权限且设备可控 */
const canRun = (item: DeviceCommandItem) => granted(item) && controllable.value

/** 置灰原因：权限缺失优先说明，其次才是设备状态 */
function disabledReason(item: DeviceCommandItem): string {
  if (!granted(item)) return `无「${item.name}」指令权限，请联系管理员配置`
  if (!controllable.value) return unavailableReason.value
  return ''
}

const confirmOpen = ref(false)
const pending = ref<DeviceCommandItem | null>(null)
const running = ref(false)

/** 关闭主弹窗时同步收起确认框，避免残留状态在下次打开时闪出 */
watch(
  () => props.open,
  (open) => {
    if (open) return
    confirmOpen.value = false
    pending.value = null
  },
)

function ask(item: DeviceCommandItem) {
  if (!canRun(item)) return
  pending.value = item
  confirmOpen.value = true
}

/** 确认后下发指令：成功则收起确认框；失败仅提示，便于立即重试 */
async function handleConfirm() {
  if (!props.device || !pending.value) return
  const command = pending.value.name
  running.value = true
  try {
    const result = await sendDeviceCommand(props.device, command)
    if (result.ok) {
      message.success(result.message)
      confirmOpen.value = false
    } else {
      message.error(result.message)
    }
  } finally {
    running.value = false
  }
}

function close() {
  emit('update:open', false)
}
</script>
