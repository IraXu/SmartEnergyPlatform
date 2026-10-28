<template>
  <div class="brand-image" :class="[`brand-image--${shape}`, { 'brand-image--error': Boolean(error) }]">
    <button
      type="button"
      class="brand-image__box"
      :disabled="disabled || uploading"
      :aria-label="value ? `更换${meta.label}` : `上传${meta.label}`"
      @click="openPicker"
    >
      <img v-if="value" :src="value" alt="" class="brand-image__img" />
      <span v-else class="brand-image__empty">
        <PictureOutlined class="brand-image__empty-icon" />
        <span>{{ meta.emptyText }}</span>
      </span>
      <span v-if="uploading" class="brand-image__loading"><LoadingOutlined spin /> 上传中</span>
      <span v-else-if="value" class="brand-image__mask">更换</span>
    </button>

    <div class="brand-image__actions">
      <a-button type="link" size="small" :disabled="disabled || uploading" @click="openPicker">
        {{ value ? '更换' : '上传' }}
      </a-button>
      <a-button v-if="value" type="link" size="small" danger :disabled="disabled || uploading" @click="emit('delete')">
        删除
      </a-button>
    </div>

    <p v-if="error" class="brand-image__error">{{ error }}</p>
    <p v-else class="brand-image__tip">{{ meta.tip }}</p>

    <input ref="inputRef" class="brand-image__input" type="file" accept=".jpg,.jpeg,.png" @change="handleChange" />
  </div>
</template>

<script setup lang="ts">
/**
 * 【原型说明】品牌设置图片字段：缩略预览 + 上传 / 更换 / 删除 + 错误与规格提示。
 * 文件类型与大小校验由页面处理；方形图片进入裁剪浮层，背景图直接压缩回填。
 */
import { computed, ref } from 'vue'
import { LoadingOutlined, PictureOutlined } from '@antdv-next/icons'
import { BRAND_IMAGE_RULES, type BrandImageKind } from '@/modules/branding/store'

const props = withDefaults(
  defineProps<{
    kind: BrandImageKind
    value: string
    disabled?: boolean
    uploading?: boolean
    error?: string
  }>(),
  { disabled: false, uploading: false, error: '' },
)

const emit = defineEmits<{ pick: [file: File]; delete: [] }>()

const inputRef = ref<HTMLInputElement | null>(null)

const meta = computed(() => {
  const rule = BRAND_IMAGE_RULES[props.kind]
  if (props.kind === 'loginBackground') {
    return {
      label: rule.label,
      emptyText: '未上传，使用平台默认渐变',
      tip: `JPG / PNG，不超过 ${rule.maxMb}MB，建议 ${rule.suggestWidth}×${rule.suggestHeight} 以上，铺满展示`,
    }
  }
  return {
    label: rule.label,
    emptyText: '未上传，继承平台默认',
    tip: `JPG / PNG，不超过 ${rule.maxMb}MB，建议 ${rule.suggestWidth}×${rule.suggestHeight} 以上，按 1:1 裁剪`,
  }
})

const shape = computed(() => (props.kind === 'loginBackground' ? 'wide' : 'square'))

function openPicker() {
  if (props.disabled || props.uploading) return
  inputRef.value?.click()
}

function handleChange(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (file) emit('pick', file)
}
</script>
