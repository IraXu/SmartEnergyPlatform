<!--
  OVERLAY-11 设备参数配置（PRD F-DEV-16）
  【原型说明】从设备详情页工具栏打开，右侧滑出。
  按参数字典分组呈现可配置项（计量参数 / 上报参数 / 通讯参数），
  每项同时展示「设备当前值」与「待下发值」：先「从设备抄读」取得当前值，
  修改后「下发修改」写回设备，写入结果会记入 MQTT 通讯日志。
  【扩展性】分组与参数项均来自参数字典，抽屉按分组自动渲染，
  新增可配置项无需改动本组件。
-->
<template>
  <a-drawer
    :open="open"
    placement="right"
    :size="drawerWidth"
    :styles="{ body: { padding: 0 } }"
    :closable="false"
    @close="close"
  >
    <template #title />
    <div class="devparam">
      <!-- 头部：设备标识，License 优先于设备识别码（IMEI）展示 -->
      <header class="devparam__head">
        <div class="devparam__head-text">
          <span class="devparam__eyebrow">设备参数配置</span>
          <h3 class="devparam__title" :title="device?.name">{{ device?.name || '设备' }}</h3>
          <dl class="devparam__ident">
            <div class="devparam__ident-row">
              <dt>License</dt>
              <dd class="device-cell__mono" :title="device?.license">{{ device?.license || '—' }}</dd>
            </div>
            <div class="devparam__ident-row">
              <dt>IMEI</dt>
              <dd class="device-cell__mono" :title="device?.imei">{{ device?.imei || '—' }}</dd>
            </div>
          </dl>
        </div>
        <a-button type="text" size="small" aria-label="关闭" @click="close">
          <template #icon><CloseOutlined /></template>
        </a-button>
      </header>

      <div class="devparam__body">
        <a-alert
          v-if="!reachable"
          class="devparam__alert"
          type="warning"
          show-icon
          :message="unreachableReason"
        />
        <a-alert
          v-else
          class="devparam__alert"
          type="info"
          show-icon
          message="参数直接写入设备，建议先「从设备抄读」核对现场互感器铭牌后再下发修改。"
        />

        <!-- 操作区：抄读当前值 / 下发修改 -->
        <div class="devparam__toolbar">
          <a-button size="small" :disabled="!reachable" :loading="reading" @click="handleRead">
            <template #icon><SyncOutlined /></template>
            从设备抄读
          </a-button>
          <span v-if="lastReadText" class="devparam__toolbar-tip">最近抄读 {{ lastReadText }}</span>
          <span v-else class="devparam__toolbar-tip">{{ currentHint }}</span>
          <span class="devparam__toolbar-spacer" />
          <span v-if="changedKeys.length" class="devparam__changed">已修改 {{ changedKeys.length }} 项</span>
          <a-button
            size="small"
            type="primary"
            :disabled="!reachable || !changedKeys.length"
            :loading="writing"
            @click="handleWrite"
          >
            <template #icon><CloudUploadOutlined /></template>
            下发修改
          </a-button>
        </div>

        <!-- 参数分组：按字典顺序分块，空分组自动隐藏 -->
        <section v-for="group in groups" :key="group.key" class="devparam__group">
          <div class="devparam__group-head">
            <h4 class="devparam__group-title">{{ group.name }}</h4>
            <p class="devparam__group-desc">{{ group.desc }}</p>
          </div>

          <div
            v-for="item in group.items"
            :key="item.key"
            class="devparam__item"
            :class="{ 'is-changed': changedKeys.includes(item.key) }"
          >
            <div class="devparam__item-info">
              <span class="devparam__item-name">
                {{ item.name }}
                <em v-if="item.unit" class="devparam__item-unit">单位：{{ item.unit }}</em>
              </span>
              <p class="devparam__item-desc">{{ item.desc }}</p>
            </div>

            <div class="devparam__item-fields">
              <div class="devparam__field">
                <span class="devparam__field-label">设备当前值</span>
                <span class="devparam__current" :class="{ 'is-empty': currentText(item) === '未抄读' }">
                  {{ currentText(item) }}
                </span>
              </div>

              <div class="devparam__field">
                <span class="devparam__field-label">待下发值</span>
                <a-select
                  v-if="item.type === 'select'"
                  :value="form[item.key] || undefined"
                  class="devparam__control"
                  :options="selectOptions(item)"
                  :placeholder="`请选择${item.name}`"
                  @change="(value: string) => updateValue(item.key, value)"
                />
                <a-input-number
                  v-else
                  :value="numberValue(item.key)"
                  class="devparam__control"
                  :min="item.min"
                  :max="item.max"
                  :precision="item.precision ?? 0"
                  :placeholder="`请输入${item.name}`"
                  @change="(value: number | string | null) => updateValue(item.key, value === null || value === undefined ? '' : String(value))"
                />
                <span v-if="errorOf(item)" class="devparam__error">{{ errorOf(item) }}</span>
              </div>
            </div>
          </div>
        </section>

        <p v-if="device && !groups.length" class="devparam__empty">该设备类型暂无可配置参数</p>
      </div>
    </div>
  </a-drawer>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { message } from 'antdv-next'
import { CloseOutlined, CloudUploadOutlined, SyncOutlined } from '@antdv-next/icons'
import {
  changedParamKeys,
  currentParamValue,
  formatTime,
  hasReadParams,
  paramGroupsWithItems,
  readDeviceParams,
  validateParamForm,
  writeDeviceParams,
} from '../store'
import type { Device, DeviceParamItem, DeviceParamValues } from '../store'

const props = defineProps<{
  /** 抽屉开关（v-model:open） */
  open: boolean
  /** 目标设备；为 null 时不渲染内容 */
  device: Device | null
}>()

const emit = defineEmits<{ 'update:open': [boolean] }>()

/** 抽屉宽度：参数项为「说明 + 当前值 + 待下发值」两列，故下限高于日志抽屉之外的窄抽屉 */
const drawerWidth = computed(() => Math.min(Math.max(Math.round(window.innerWidth * 0.5), 640), 920))

/** 参数分组与组内参数项，空分组已由 store 过滤 */
const groups = computed(() => (props.device ? paramGroupsWithItems() : []))

/** 可读写条件：设备已接入且在线（与设备控制保持一致的前置条件） */
const reachable = computed(
  () => Boolean(props.device) && props.device!.accessStatus === '已接入' && props.device!.onlineStatus === '在线',
)

const unreachableReason = computed(() => {
  if (!props.device) return ''
  if (props.device.accessStatus !== '已接入') return '该设备尚未接入平台，无法读写设备参数。'
  if (props.device.onlineStatus !== '在线') return '该设备当前离线，参数读写无法送达，请确认设备通信状态后重试。'
  return ''
})

/* ---------- 表单态 ---------- */

/** 待下发值：参数标识 → 文本值，与设备当前值分离，便于随时改回 */
const form = ref<DeviceParamValues>({})
/** 用户是否已改动过某项，用于决定是否即时提示校验错误（避免一打开就铺满必填提示） */
const touched = ref<Record<string, boolean>>({})
const submitted = ref(false)
const reading = ref(false)
const writing = ref(false)
const lastReadAt = ref<number | null>(null)

/** 用设备当前值初始化待下发值；未抄读的参数留空，等待用户先抄读 */
function syncForm() {
  if (!props.device) {
    form.value = {}
    return
  }
  const next: DeviceParamValues = {}
  paramGroupsWithItems().forEach((group) => {
    group.items.forEach((item) => {
      next[item.key] = currentParamValue(props.device!, item.key)
    })
  })
  form.value = next
  touched.value = {}
  submitted.value = false
}

/** 每次打开抽屉（或切换设备）都重新取值，避免沿用上一次的编辑内容 */
watch(
  () => [props.open, props.device?.id] as const,
  ([open]) => {
    if (!open) return
    lastReadAt.value = null
    syncForm()
  },
  { immediate: true },
)

const errors = computed(() => (props.device ? validateParamForm(form.value) : {}))
const changedKeys = computed(() => (props.device ? changedParamKeys(props.device, form.value) : []))

const lastReadText = computed(() => (lastReadAt.value ? `${formatTime(lastReadAt.value)}（本次会话）` : ''))

/** 未抄读时的说明：设备不可达时由上方警示条解释原因，此处不再重复 */
const currentHint = computed(() => (reachable.value ? '当前值取自设备最近一次上报，可先抄读核对' : ''))

function updateValue(key: string, value: string) {
  form.value = { ...form.value, [key]: value }
  touched.value = { ...touched.value, [key]: true }
}

/** 数值型输入框的绑定值：空文本对应 null，避免 antdv-next 把空串渲染为 0 */
function numberValue(key: string): number | null {
  const raw = (form.value[key] ?? '').trim()
  if (!raw) return null
  const num = Number(raw)
  return Number.isFinite(num) ? num : null
}

const selectOptions = (item: DeviceParamItem) => (item.options ?? []).map((value) => ({ label: value, value }))

/** 设备当前值的展示文本：未抄读与设备未上报分别给出不同文案 */
function currentText(item: DeviceParamItem): string {
  if (!props.device) return '—'
  if (!hasReadParams(props.device.id)) return '未抄读'
  return currentParamValue(props.device, item.key) || '设备未上报'
}

/** 校验提示：仅在该项被改动过或用户已尝试下发时展示 */
function errorOf(item: DeviceParamItem): string {
  if (!submitted.value && !touched.value[item.key]) return ''
  return errors.value[item.key] ?? ''
}

/* ---------- 抄读与下发 ---------- */

async function handleRead() {
  if (!props.device) return
  reading.value = true
  try {
    const result = await readDeviceParams(props.device)
    if (result.ok) {
      lastReadAt.value = Date.now()
      syncForm()
      message.success(result.message)
    } else {
      message.error(result.message)
    }
  } finally {
    reading.value = false
  }
}

async function handleWrite() {
  if (!props.device) return
  submitted.value = true
  const firstError = Object.values(errors.value)[0]
  if (firstError) {
    message.warning(firstError)
    return
  }
  writing.value = true
  try {
    const result = await writeDeviceParams(props.device, form.value)
    if (result.ok) {
      syncForm()
      message.success(result.message)
    } else {
      message.error(result.message)
    }
  } finally {
    writing.value = false
  }
}

function close() {
  emit('update:open', false)
}
</script>
