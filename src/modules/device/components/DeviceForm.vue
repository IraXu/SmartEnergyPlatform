<template>
  <div class="devform">
    <a-form :model="form" layout="vertical">
      <p class="devform__group">基础信息</p>
      <div class="devform__grid">
        <a-form-item label="设备名称" required :validate-status="errors.name ? 'error' : undefined" :help="errors.name ?? undefined">
          <a-input v-model:value="form.name" show-count :maxlength="NAME_MAX" placeholder="请输入设备名称" />
        </a-form-item>

        <a-form-item
          label="License"
          required
          :validate-status="errors.license ? 'error' : undefined"
          :help="errors.license ?? undefined"
        >
          <a-input
            v-model:value="form.license"
            :maxlength="CODE_MAX"
            placeholder="设备唯一标识，全平台唯一"
          />
          <p class="devform__hint">填写后自动查询设备信息</p>
        </a-form-item>

        <a-form-item
          label="设备识别码（IMEI）"
          required
          :validate-status="errors.imei ? 'error' : undefined"
          :help="errors.imei ?? undefined"
        >
          <a-input
            v-model:value="form.imei"
            :maxlength="CODE_MAX"
            :loading="identityQuerying"
            :placeholder="imeiPlaceholder"
            @input="imeiTouched = true"
          />
          <p class="devform__hint" :class="identityHintClass">{{ identityHint }}</p>
        </a-form-item>

        <a-form-item label="表号">
          <a-input
            v-model:value="form.meterNo"
            :maxlength="CODE_MAX"
            :loading="identityQuerying"
            :placeholder="meterNoPlaceholder"
            @input="meterNoTouched = true"
          />
          <p class="devform__hint">网关通讯设备以表号判定，插卡 4G 设备可留空</p>
        </a-form-item>
      </div>

      <template v-if="isCreate">
        <p class="devform__group">归属信息</p>
        <div class="devform__grid">
          <a-form-item
            label="所属用能单元"
            required
            :validate-status="errors.unitId ? 'error' : undefined"
            :help="errors.unitId ?? undefined"
          >
            <a-tree-select
              v-model:value="form.unitId"
              show-search
              tree-default-expand-all
              tree-node-filter-prop="title"
              tree-node-label-prop="path"
              placeholder="请选择所属用能单元"
              :tree-data="unitTree"
              :field-names="{ label: 'title', value: 'value', children: 'children' }"
              :styles="{ popup: { root: { maxHeight: '320px', overflow: 'auto' } } }"
              @change="handleUnitChange"
            />
          </a-form-item>

          <a-form-item class="devform__item--full" label="GPS 位置">
            <DeviceGpsPicker
              :lng="form.lng"
              :lat="form.lat"
              :custom="form.gpsCustom"
              :unit-lng="unitLng"
              :unit-lat="unitLat"
              @pick="handleGpsPick"
              @follow="resetGpsToUnit"
            />
            <p class="devform__hint">
              默认同所属用能单元，可地图选点微调
            </p>
          </a-form-item>

          <a-form-item class="devform__item--full" label="安装位置描述">
            <a-input
              v-model:value="form.installPosition"
              show-count
              :maxlength="INSTALL_POSITION_MAX"
              placeholder="如：A 栋一层东侧配电间 1 号柜"
            />
          </a-form-item>
        </div>

        <p class="devform__group">备注</p>
        <a-form-item class="devform__item--full">
          <a-textarea
            v-model:value="form.remark"
            show-count
            :maxlength="REMARK_MAX"
            :rows="3"
            placeholder="选填，最多 200 字"
          />
        </a-form-item>
      </template>

      <!-- 编辑：字段与新增保持一致，仅放开基础信息、归属信息与备注；不含设备类型、卡号、所属用能单元与状态字段 -->
      <template v-else>
        <p class="devform__group">归属信息</p>
        <div class="devform__grid">
          <a-form-item
            class="devform__item--full"
            label="GPS 位置"
            :validate-status="errors.lng ? 'error' : undefined"
            :help="errors.lng ?? undefined"
          >
            <DeviceGpsPicker
              :lng="form.lng"
              :lat="form.lat"
              :custom="form.gpsCustom"
              :unit-lng="unitLng"
              :unit-lat="unitLat"
              @pick="handleGpsPick"
              @follow="resetGpsToUnit"
            />
            <p class="devform__hint">默认同所属用能单元，可地图选点微调</p>
          </a-form-item>

          <a-form-item class="devform__item--full" label="安装位置描述">
            <a-input
              v-model:value="form.installPosition"
              show-count
              :maxlength="INSTALL_POSITION_MAX"
              placeholder="如：A 栋一层东侧配电间 1 号柜"
            />
          </a-form-item>
        </div>

        <p class="devform__group">备注</p>
        <a-form-item class="devform__item--full">
          <a-textarea
            v-model:value="form.remark"
            show-count
            :maxlength="REMARK_MAX"
            :rows="3"
            placeholder="选填，最多 200 字"
          />
        </a-form-item>
      </template>
    </a-form>
  </div>
</template>

<script setup lang="ts">
/**
 * 【原型说明】新增设备（弹窗内「手动录入 / 批量导入」两种方式共用）与编辑设备的表单。
 * - License 为用户填写的唯一标识；填写后自动向平台查询该设备信息
 * - 设备识别码（IMEI）与表号：平台查询到则自动填入；未查询到时支持按现场实际人工填写（可编辑）
 * - 归属信息含所属用能单元、安装位置描述与 GPS 位置；GPS 随所属用能单元自动填入，支持地图选点自定义
 * - 不含设备类型、卡号、安装日期、规格、通信与状态字段（设备类型与卡号由服务端在设备上云后返回）
 */
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import DeviceGpsPicker from './DeviceGpsPicker.vue'
import {
  CODE_MAX,
  INSTALL_POSITION_MAX,
  NAME_MAX,
  REMARK_MAX,
  queryDeviceIdentityByLicense,
  unitLocation,
  unitTreeData,
} from '../store'
import type { DeviceFormErrors, DeviceInput } from '../store'

const props = defineProps<{
  /** 表单值（由父组件持有，便于提交时读取） */
  modelValue: DeviceInput
  /** 是否为新增（新增含所属用能单元与添加方式差异） */
  isCreate: boolean
  /** 校验错误集合 */
  errors: DeviceFormErrors
}>()

const emit = defineEmits<{ 'update:modelValue': [DeviceInput] }>()

const form = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
})

const unitTree = computed(() => unitTreeData())

/** 编辑场景下所属用能单元的坐标，「恢复为用能单元坐标」使用；新增场景取当前所选单元 */
const unitLng = computed(() => unitLocation(form.value.unitId || '').lng)
const unitLat = computed(() => unitLocation(form.value.unitId || '').lat)

/* ---------- License → 平台查询身份信息（IMEI / 表号） ---------- */

/** 查询状态：idle 未查询 / querying 查询中 / matched 已查到并自动填入 / nomatch 未查到（需人工填写） */
type IdentityState = 'idle' | 'querying' | 'matched' | 'nomatch'

const identityState = ref<IdentityState>('idle')
const identityQuerying = computed(() => identityState.value === 'querying')
/** 用户是否手动改写过识别码 / 表号；改写后不再被自动查询结果覆盖 */
const imeiTouched = ref(false)
const meterNoTouched = ref(false)
let queryTimer: number | undefined

/** 清掉待执行的查询，避免防抖窗口内组件已卸载仍回调 */
function clearQueryTimer() {
  if (queryTimer !== undefined) {
    window.clearTimeout(queryTimer)
    queryTimer = undefined
  }
}

/**
 * 监听 License 变化，防抖后模拟「按 License 查询平台设备信息」。
 * 查询到：自动填入识别码与表号（用户已手改的字段不覆盖）；
 * 未查询到：置为 nomatch，由用户按现场实际填写。
 */
watch(
  () => form.value.license,
  () => {
    clearQueryTimer()
    imeiTouched.value = false
    meterNoTouched.value = false
    const license = form.value.license.trim()
    if (!license) {
      identityState.value = 'idle'
      return
    }
    identityState.value = 'querying'
    queryTimer = window.setTimeout(() => {
      const identity = queryDeviceIdentityByLicense(license)
      if (!identity) {
        identityState.value = 'nomatch'
        return
      }
      identityState.value = 'matched'
      form.value = {
        ...form.value,
        imei: imeiTouched.value ? form.value.imei : identity.imei,
        meterNo: meterNoTouched.value ? form.value.meterNo : identity.meterNo,
      }
    }, 420)
  },
)

onBeforeUnmount(clearQueryTimer)

/** 识别码输入框占位文案：按查询状态区分 */
const imeiPlaceholder = computed(() =>
  identityState.value === 'nomatch' ? '未查询到，可手动填写' : '填写 License 后自动带入',
)

/** 表号占位文案：插卡 4G 设备可留空 */
const meterNoPlaceholder = computed(() =>
  identityState.value === 'nomatch' ? '未查询到，可手动填写' : '填写 License 后自动带入',
)

/** 查询提示文案：让用户明确「已自动带入」或「未查到、可自定义」 */
const identityHint = computed(() => {
  switch (identityState.value) {
    case 'querying':
      return '正在查询…'
    case 'matched':
      return '已自动带入，可手动修正'
    case 'nomatch':
      return '平台未查询到，请手动填写'
    default:
      return '必填，可由平台自动带入'
  }
})

const identityHintClass = computed(() =>
  identityState.value === 'nomatch' ? 'is-warn' : identityState.value === 'matched' ? 'is-ok' : '',
)

/**
 * 选择所属用能单元：GPS 默认跟随该用能单元坐标，已自定义过则不覆盖。
 * 注意：change 事件早于父组件回写 modelValue，因此这里用事件参数而不是 form.unitId，
 * 否则会读到上一次的选择导致 GPS 不更新。
 */
function handleUnitChange(value: string | null) {
  if (form.value.gpsCustom) return
  const location = unitLocation(value || '')
  form.value = { ...form.value, unitId: value ?? '', lng: location.lng, lat: location.lat }
}

/** 恢复为所属用能单元的坐标 */
function resetGpsToUnit() {
  const location = unitLocation(form.value.unitId || '')
  form.value = { ...form.value, lng: location.lng, lat: location.lat, gpsCustom: false }
}

/** 地图选点确认：写入自定义坐标 */
function handleGpsPick(point: { lng: number; lat: number }) {
  form.value = { ...form.value, lng: point.lng, lat: point.lat, gpsCustom: true }
}
</script>
