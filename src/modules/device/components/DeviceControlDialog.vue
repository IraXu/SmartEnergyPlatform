<!--
  OVERLAY-10 设备控制（PRD F-DEV-15 / F-DEV-20）
  【原型说明】从设备详情页工具栏打开。7 个操作按「读取类 → 开关类 → 通讯类 → 清零类」排序，
  界面不展示分组标题：校时、抄表、重连为常态操作；合闸、分闸影响现场供电；
  电量清零、设备事件清零影响计量数据或设备内记录，后四类用警示样式区分。
  点击任一操作均先二次确认（danger 类确认弹窗突出风险），确认后下发并给出结果反馈；
  清零操作按「已提交 / 执行成功 / 执行失败 / 结果未知」四态反馈，每次下发都会在 MQTT 通讯日志中留下一条下行记录。
  【权限】弹窗入口不设权限点，7 个操作各自独立授权：
  无该操作权限时按钮置灰并说明原因；无任何操作权限时给出统一提示；两类清零权限均未授予时两项不展示。
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
      <!-- 设备不可控（离线）：说明原因，仍展示清单便于了解设备可用能力 -->
      <a-alert
        v-else-if="!controllable"
        class="devctl__alert"
        type="warning"
        show-icon
        :message="unavailableReason"
      />
      <!-- 设备可控且至少有一项权限：风险提示。合闸、分闸影响现场供电；两类清零影响计量数据或设备内记录 -->
      <a-alert
        v-else
        class="devctl__alert"
        type="warning"
        show-icon
        message="合闸、分闸会直接影响现场供电；电量清零会影响累计电量与后续统计，请谨慎操作。"
      />

      <!-- 指令清单：单列铺排，不展示分组标题；无权限与设备不可控两种情况都置灰 -->
      <div v-if="hasAnyPermission" class="devctl__list">
        <button
          v-for="item in visibleCommands"
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
          <span v-else-if="item.group === '清零类'" class="devctl__item-risk">影响计量数据</span>
          <span v-else-if="item.risk === 'danger'" class="devctl__item-risk">影响供电</span>
        </button>
      </div>

      <p class="devctl__note">
        指令下发结果会记入「MQTT 通讯日志」；设备需在线才能接收指令。设备事件清零不删除云端告警、MQTT 日志与审计日志。
      </p>
    </div>
  </a-modal>

  <!-- 二次确认：独立弹窗，danger 类指令以警示样式呈现风险文案；两类清零各自独立确认 -->
  <a-modal
    v-model:open="confirmOpen"
    :title="confirmTitle"
    :width="440"
    :mask-closable="false"
    :ok-button-props="{ loading: running, danger: pending?.risk === 'danger' }"
    :ok-text="confirmOkText"
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
      <!-- 清零四态：已提交 / 执行成功 / 执行失败 / 结果未知 -->
      <p v-if="submitState" class="devctl__confirm-state" :class="stateClass">{{ submitState }}</p>
      <p v-if="submitState === '已提交'" class="devctl__confirm-hint">
        已提交，等待设备回执…提交成功不代表设备执行成功
      </p>
    </template>
  </a-modal>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { message } from 'antdv-next'
import {
  ClearOutlined,
  DeleteOutlined,
  LinkOutlined,
  PoweroffOutlined,
  ReadOutlined,
  SyncOutlined,
  ThunderboltOutlined,
} from '@antdv-next/icons'
import { currentPermissions } from '@/modules/role/store'
import { DEVICE_COMMANDS, sendDeviceCommand } from '../store'
import type { ClearState, Device, DeviceCommand, DeviceCommandItem } from '../store'

const props = defineProps<{
  /** 弹窗开关（v-model:open） */
  open: boolean
  /** 目标设备；为 null 时不渲染内容 */
  device: Device | null
}>()

const emit = defineEmits<{
  'update:open': [boolean]
}>()

/** 指令与图标的对应关系：读取类用文档 / 时钟，开关类用电源，通讯类用链接，清零类用清除 */
const ICONS: Record<DeviceCommand, unknown> = {
  校时: SyncOutlined,
  抄表: ReadOutlined,
  合闸: ThunderboltOutlined,
  分闸: PoweroffOutlined,
  重连: LinkOutlined,
  电量清零: ClearOutlined,
  设备事件清零: DeleteOutlined,
}

const iconOf = (name: DeviceCommand) => ICONS[name]

/* ---------- 权限：入口常显，能力收敛到指令级 ---------- */

const perms = computed(() => currentPermissions())
const granted = (item: DeviceCommandItem) => perms.value.includes(item.permission)
const hasAnyPermission = computed(() => DEVICE_COMMANDS.some((item) => granted(item)))

/** 可控制条件：设备在线（PRD F-DEV-15 前置条件） */
const controllable = computed(() => Boolean(props.device) && props.device!.onlineStatus === '在线')

/** 清零能力：仅计量表计支持，网关设备不支持清零（Q-DEV-08） */
const supportsClear = computed(() => Boolean(props.device?.type?.includes('电表')))

/**
 * 指令清单：保持「读取类 → 开关类 → 通讯类 → 清零类」的排序，但界面不展示分组标题。
 * 两类清零权限均未授予时，清零类两项整体不展示（见交互文档 5.9）。
 */
const visibleCommands = computed(() =>
  DEVICE_COMMANDS.filter((item) => item.group !== '清零类' || granted(item)),
)

const unavailableReason = computed(() => {
  if (!props.device) return ''
  if (props.device.onlineStatus !== '在线') return '该设备当前离线，控制指令无法送达，请确认设备通信状态后重试。'
  return ''
})

/** 指令是否可点：具备该指令权限、设备可控，且清零类操作要求设备支持清零 */
const canRun = (item: DeviceCommandItem) =>
  granted(item) && controllable.value && (item.group !== '清零类' || supportsClear.value)

/** 置灰原因：权限缺失优先说明，其次为设备能力，最后为设备状态 */
function disabledReason(item: DeviceCommandItem): string {
  if (!granted(item)) return `无「${item.name}」指令权限，请联系管理员配置`
  if (item.group === '清零类' && !supportsClear.value) {
    return `该设备当前不支持「${item.name}」，请联系厂家确认设备能力`
  }
  if (!controllable.value) return unavailableReason.value
  return ''
}

const confirmOpen = ref(false)
const pending = ref<DeviceCommandItem | null>(null)
const running = ref(false)
/** 清零执行状态：已提交 / 执行成功 / 执行失败 / 结果未知 */
const submitState = ref<ClearState | ''>('')

const confirmTitle = computed(() => {
  if (!pending.value) return '确认下发指令？'
  return pending.value.group === '清零类'
    ? `确认执行「${pending.value.name}」？`
    : `确认下发「${pending.value.name}」指令？`
})

const confirmOkText = computed(() => {
  if (pending.value?.group === '清零类') return '确认清零'
  return pending.value?.risk === 'danger' ? '确认下发' : '确定'
})

const stateClass = computed(() => ({
  'is-submitted': submitState.value === '已提交',
  'is-success': submitState.value === '执行成功',
  'is-failed': submitState.value === '执行失败' || submitState.value === '结果未知',
}))

/** 关闭主弹窗时同步收起确认框，避免残留状态在下次打开时闪出 */
watch(
  () => props.open,
  (open) => {
    if (open) return
    confirmOpen.value = false
    pending.value = null
    submitState.value = ''
  },
)

function ask(item: DeviceCommandItem) {
  if (!canRun(item)) return
  pending.value = item
  submitState.value = ''
  confirmOpen.value = true
}

/** 确认后下发指令：成功则收起确认框；清零按四态反馈，失败保留以便重试 */
async function handleConfirm() {
  if (!props.device || !pending.value) return
  const command = pending.value.name
  const isClear = pending.value.group === '清零类'
  running.value = true
  if (isClear) submitState.value = '已提交'
  try {
    const result = await sendDeviceCommand(props.device, command)
    if (result.state) submitState.value = result.state
    if (result.ok) {
      message.success(result.message)
      confirmOpen.value = false
    } else if (result.state === '结果未知') {
      message.warning(result.message)
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
