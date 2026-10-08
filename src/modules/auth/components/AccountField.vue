<template>
  <div ref="rootRef" class="account-field" @focusout="handleFocusOut">
    <a-space-compact block size="large">
      <!-- 区号选择框仅在手机号形态出现；与输入框各自持有稳定的 key，保证切换类型时输入框复用、焦点不丢失 -->
      <a-select
        v-if="mode === 'phone'"
        key="country-code"
        v-model:value="iso2"
        class="account-field__code"
        size="large"
        show-search
        :options="COUNTRY_OPTIONS"
        :filter-option="filterCountry"
        :popup-match-select-width="280"
        :disabled="disabled"
        aria-label="选择国际区号"
        @change="syncValue"
        @openChange="handleCountryOpenChange"
      >
        <template #labelRender="{ value: val }">{{ codeOf(val) }}</template>
        <template #optionRender="{ option }">
          <span>{{ option.data.nameCn }}</span>
          <span class="account-field__option-code">{{ option.data.code }}</span>
        </template>
      </a-select>

      <a-input
        key="account-input"
        :id="fieldId"
        v-model:value="displayValue"
        class="account-field__input"
        size="large"
        :placeholder="placeholderText"
        :maxlength="mode === 'phone' ? 24 : 64"
        :disabled="disabled"
        allow-clear
        :aria-describedby="fieldDescribedBy"
        :aria-invalid="fieldInvalid"
        :aria-required="fieldRequired"
        @focus="handleFocus"
      />
    </a-space-compact>

    <div v-if="mode === 'email' && !phoneOnly" class="account-field__hint">
      已按邮箱输入；清空后可重新填写手机号
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * 【原型说明】账号输入组件：手机号（国际区号 + 本地号码）与邮箱二合一。
 * 输入内容自动识别账号类型，页面不再提供独立的账号类型切换控件，减少操作割裂感。
 * 区号默认 +86 中国，支持按中文名、英文名或区号搜索；同一输入框内切换类型不丢失已输入内容。
 */
import { computed, ref, useAttrs, watch } from 'vue'
import {
  COUNTRY_OPTIONS,
  DEFAULT_COUNTRY_CODE,
  DEFAULT_COUNTRY_ISO2,
  composePhoneIdentifier,
  findCountryByIso2,
  splitPhoneIdentifier,
} from '@/shared/mock/countryCode'

const props = defineProps<{
  /** 规范化账号标识：手机号为「国际区号 + 本地号码」，邮箱为完整地址 */
  value: string
  disabled?: boolean
  /** 仅允许手机号输入，关闭邮箱自动识别，用于联系人电话等只收手机号的场景 */
  phoneOnly?: boolean
  /** 自定义输入框占位文案 */
  placeholder?: string
}>()

const emit = defineEmits<{ 'update:value': [string]; blur: []; focus: [] }>()

defineOptions({ inheritAttrs: false })

const attrs = useAttrs()
const rootRef = ref<HTMLElement>()
const fieldId = computed(() => attrs.id as string | undefined)
const fieldDescribedBy = computed(() => attrs['aria-describedby'] as string | undefined)
const fieldInvalid = computed(() => attrs['aria-invalid'] as string | undefined)
const fieldRequired = computed(() => attrs['aria-required'] as string | undefined)

const mode = ref<'phone' | 'email'>('phone')
const iso2 = ref(DEFAULT_COUNTRY_ISO2)
const local = ref('')
const email = ref('')
/** 记录最近一次向外回传的值，用于区分内部输入与外部回填 */
let lastEmitted = ''
/** 区号下拉是否展开，展开期间不触发失焦校验 */
let countryOpen = false

const countryCode = computed(() => findCountryByIso2(iso2.value).code)

const placeholderText = computed(() => {
  if (props.placeholder) return props.placeholder
  if (props.phoneOnly) return '请输入手机号'
  return mode.value === 'phone' ? '请输入手机号或邮箱' : '请输入邮箱地址'
})

function codeOf(value: string): string {
  return findCountryByIso2(String(value)).code
}

/** 区号下拉支持按中文名、英文名、区号或 ISO 代码搜索 */
function filterCountry(input: string, option?: Record<string, unknown>) {
  const keyword = (input ?? '').trim().toLowerCase()
  if (!keyword) return true
  const item = (option?.data ?? option) as {
    nameCn?: string
    nameEn?: string
    code?: string
    iso2?: string
  }
  return `${item.nameCn ?? ''} ${item.nameEn ?? ''} ${item.code ?? ''} ${item.iso2 ?? ''}`
    .toLowerCase()
    .includes(keyword)
}

/** 计算并向父级回传规范化标识；手机号本地号码为空时回传空值，交由必填校验提示 */
function syncValue() {
  let next = ''
  if (mode.value === 'email') {
    next = email.value.trim()
  } else if (local.value.replace(/\D/g, '')) {
    next = composePhoneIdentifier(countryCode.value, local.value)
  }
  lastEmitted = next
  emit('update:value', next)
}

/** 切换账号类型仅调整展示形态，输入框元素复用，已输入内容与光标位置保持不变 */
function switchMode(nextMode: 'phone' | 'email') {
  mode.value = nextMode
}

const displayValue = computed({
  get: () => (mode.value === 'phone' ? local.value : email.value),
  set: (val: string) => {
    if (mode.value === 'email') {
      email.value = val
      // 清空邮箱后回到手机号输入，区号复位为默认的 +86 中国
      if (!val) {
        iso2.value = DEFAULT_COUNTRY_ISO2
        local.value = ''
        switchMode('phone')
      }
      syncValue()
      return
    }
    // 输入字母或 @ 时判定为邮箱，原样带入已输入内容；仅手机号场景下忽略该识别
    if (!props.phoneOnly && /[A-Za-z@]/.test(val)) {
      email.value = val
      local.value = ''
      switchMode('email')
      syncValue()
      return
    }
    // 粘贴或输入带国际区号的完整号码时，自动识别区号并回填到区号选择器
    if (val.includes('+')) {
      const parsed = splitPhoneIdentifier(val)
      iso2.value = parsed.local ? parsed.iso2 : DEFAULT_COUNTRY_ISO2
      local.value = parsed.local
      syncValue()
      return
    }
    // 仅手机号场景下过滤非数字输入，避免展示无效字符
    local.value = props.phoneOnly ? val.replace(/\D/g, '') : val
    syncValue()
  },
})

/** 外部回填（初始预填、找回密码带入、重置演示数据）时同步组件内部状态 */
watch(
  () => props.value,
  (value) => {
    const next = (value ?? '').trim()
    if (next === lastEmitted) return
    if (!next) {
      mode.value = 'phone'
      iso2.value = DEFAULT_COUNTRY_ISO2
      local.value = ''
      email.value = ''
      return
    }
    if (next.includes('@')) {
      mode.value = 'email'
      email.value = next
      local.value = ''
      return
    }
    const canonical = next.startsWith('+') ? next : `${DEFAULT_COUNTRY_CODE}${next}`
    const parsed = splitPhoneIdentifier(canonical)
    mode.value = 'phone'
    iso2.value = parsed.iso2
    local.value = parsed.local
    email.value = ''
  },
  { immediate: true },
)

/**
 * 失焦校验：区号选择器与号码输入框同属一个账号字段，
 * 焦点在字段内部转移时不触发校验，避免切换区号即报错。
 */
function handleFocusOut(event: FocusEvent) {
  // 区号下拉展开时，点击选项会让焦点离开字段，此时不触发校验
  if (countryOpen) return
  const next = event.relatedTarget as Node | null
  if (next && rootRef.value?.contains(next)) return
  emit('blur')
}

function handleCountryOpenChange(open: boolean) {
  countryOpen = open
  if (open) return
  // 下拉关闭后若焦点已不在字段内（如点击选项收起），补一次失焦校验
  window.setTimeout(() => {
    if (rootRef.value?.contains(document.activeElement)) return
    emit('blur')
  }, 0)
}

function handleFocus() {
  emit('focus')
}
</script>
