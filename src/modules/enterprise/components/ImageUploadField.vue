<template>
  <div class="ent-upload">
    <!-- 已上传态：图片预览 + 悬停操作（COMP-ENT-01） -->
    <div
      v-if="value"
      class="ent-upload__box ent-upload__box--filled"
      :class="{ 'ent-upload__box--logo': kind === 'logo' }"
    >
      <img :src="value" alt="" class="ent-upload__img" />
      <div v-if="!disabled" class="ent-upload__mask">
        <span class="ent-upload__op" @click="openPicker">更换</span>
        <span class="ent-upload__op ent-upload__op--danger" @click="emit('delete')">删除</span>
      </div>
      <div v-if="uploading" class="ent-upload__progress">
        <LoadingOutlined class="ent-upload__progress-icon" />
        <span>图片上传中…</span>
      </div>
    </div>

    <!-- 未上传态：虚线边框 + 上传图标 + 固定文案 -->
    <button
      v-else
      type="button"
      class="ent-upload__box ent-upload__box--empty"
      :class="{ 'ent-upload__box--logo': kind === 'logo' }"
      :disabled="disabled || uploading"
      @click="openPicker"
    >
      <UploadOutlined class="ent-upload__icon" />
      <span class="ent-upload__text">{{ kind === 'logo' ? '上传 Logo' : '上传营业执照' }}</span>
      <span v-if="uploading" class="ent-upload__progress-icon"><LoadingOutlined /></span>
    </button>

    <!-- 提示行：固定说明，常显（Logo 追加裁剪说明） -->
    <p class="ent-upload__hint">
      支持 JPG、PNG，大小不超过 {{ IMAGE_MAX_MB }}MB<template v-if="kind === 'logo'">；建议使用正方形图片，上传后可裁剪</template>
    </p>
    <p v-if="error" class="ent-upload__error">{{ error }}</p>

    <input
      ref="inputRef"
      type="file"
      class="ent-upload__input"
      :accept="IMAGE_ACCEPT"
      @change="handleChange"
    />
  </div>
</template>

<script setup lang="ts">
/**
 * 【原型说明】企业中心图片上传（企业 Logo 与营业执照共用，对应 COMP-ENT-01）。
 * 组件只负责：选择文件 → 类型 / 大小校验 → 把通过校验的文件交给父级处理；
 * Logo 的裁剪（OVERLAY-05）与营业执照的预览（OVERLAY-02）由页面按各自流程承载。
 * 校验在裁剪之前执行（EX-ENT-08 / EX-ENT-09），校验与上传失败文案由父级传入展示。
 */
import { ref } from 'vue'
import { UploadOutlined, LoadingOutlined } from '@antdv-next/icons'
import { IMAGE_ACCEPT, IMAGE_MAX_MB, validateImageFile } from '../store'

const props = withDefaults(
  defineProps<{
    /** 当前图片地址；空串表示未上传 */
    value: string
    /** logo 96×96（圆角 6px）；license 160×120（圆角 8px） */
    kind: 'logo' | 'license'
    /** 上传中：期间「保存」不可用、上传区不可点击 */
    uploading?: boolean
    disabled?: boolean
    /** 校验 / 上传失败文案，展示在上传区下方 */
    error?: string
  }>(),
  { uploading: false, disabled: false, error: '' },
)

const emit = defineEmits<{
  /** 通过校验的原始文件，由父级决定后续流程（裁剪 / 直传） */
  pick: [File]
  /** 删除已上传图片（父级负责二次确认） */
  delete: []
  /** 校验失败文案 */
  error: [string]
}>()

const inputRef = ref<HTMLInputElement | null>(null)

function openPicker() {
  if (props.disabled || props.uploading) return
  // 每次点击都先清空，保证同一文件可重复选择触发 change
  if (inputRef.value) inputRef.value.value = ''
  inputRef.value?.click()
}

function handleChange(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  const message = validateImageFile(file)
  if (message) {
    emit('error', message)
    return
  }
  emit('error', '')
  emit('pick', file)
}
</script>
