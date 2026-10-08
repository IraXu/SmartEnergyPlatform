<!--
  【原型说明】设备台账的卡片视图：单台设备一张卡片。
  展示设备图片（取自「智慧物联生态平台」，未维护时用默认兜底图）、设备名称、
  License、设备识别码（IMEI）、设备类型与在线状态；点击卡片进入设备详情。
-->
<template>
  <div
    class="devcard"
    role="button"
    tabindex="0"
    :aria-label="`查看设备 ${device.name} 详情`"
    @click="emit('open', device)"
    @keydown.enter.prevent="emit('open', device)"
    @keydown.space.prevent="emit('open', device)"
  >
    <div class="devcard__top">
      <div class="devcard__thumb">
        <img
          class="devcard__image"
          :src="imageSrc"
          :alt="`${device.name} 设备图片`"
          loading="lazy"
          @error="imageFailed = true"
        />
      </div>

      <div class="devcard__head">
        <span class="devcard__name" :title="device.name">{{ device.name }}</span>
      </div>

      <div class="devcard__aside">
        <span v-if="!device.onlineStatus" class="device-cell__empty devcard__online">未接入</span>
        <span
          v-else
          class="device-cell__online devcard__online"
          :class="device.onlineStatus === '在线' ? 'is-on' : 'is-off'"
        >
          <i class="device-cell__dot" />
          {{ device.onlineStatus }}
        </span>
        <span v-if="device.type" class="device-cell__type devcard__type" :title="device.type">{{ device.type }}</span>
        <span v-else class="device-cell__empty devcard__type">平台未返回类型</span>
      </div>
    </div>

    <!-- 所属用能单元：独占一整行，避免被缩略图与右侧信息挤到省略 -->
    <p class="devcard__unit" :title="unitText">{{ unitText }}</p>

    <dl class="devcard__meta">
      <div class="devcard__row">
        <dt>License</dt>
        <dd>
          <span class="device-cell__mono" :title="device.license">{{ device.license || '—' }}</span>
          <button
            v-if="device.license"
            type="button"
            class="devcard__copy"
            title="复制 License"
            aria-label="复制 License"
            @click.stop="copy(device.license, 'License')"
          >
            <CopyOutlined />
          </button>
        </dd>
      </div>
      <div class="devcard__row">
        <dt>IMEI</dt>
        <dd>
          <span class="device-cell__mono" :title="device.imei">{{ device.imei || '—' }}</span>
          <button
            v-if="device.imei"
            type="button"
            class="devcard__copy"
            title="复制设备识别码（IMEI）"
            aria-label="复制设备识别码"
            @click.stop="copy(device.imei, '设备识别码')"
          >
            <CopyOutlined />
          </button>
        </dd>
      </div>
    </dl>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { message } from 'antdv-next'
import { CopyOutlined } from '@antdv-next/icons'
import { DEFAULT_DEVICE_IMAGE } from '../mock/seed'
import { isUnitInvalid, unitPath, type Device } from '../store'

const props = defineProps<{
  /** 卡片对应的设备 */
  device: Device
}>()

const emit = defineEmits<{
  /** 点击卡片：进入该设备详情 */
  open: [Device]
}>()

/** 图片加载失败时回落到兜底图，避免破图影响列表观感 */
const imageFailed = ref(false)

watch(
  () => props.device.imageUrl,
  () => {
    imageFailed.value = false
  },
)

/** 图片源：「智慧物联生态平台」未维护（空值）或加载失败时使用默认兜底图 */
const imageSrc = computed(() => (imageFailed.value || !props.device.imageUrl ? DEFAULT_DEVICE_IMAGE : props.device.imageUrl))

/** 所属用能单元：展示完整层级路径，节点已失效时补注说明 */
const unitText = computed(() => {
  const path = unitPath(props.device.unitId)
  return isUnitInvalid(props.device.unitId) ? `${path}（已失效）` : path
})

/**
 * 复制标识值：卡片整体可点击进入详情，因此按钮上需阻止冒泡。
 * 浏览器非安全上下文（如局域网 IP 访问）下剪贴板 API 不可用，此时给出提示兜底。
 */
async function copy(value: string, label: string) {
  try {
    await navigator.clipboard.writeText(value)
    message.success(`${label} 已复制`)
  } catch {
    message.warning('复制失败，请手动选择')
  }
}
</script>
