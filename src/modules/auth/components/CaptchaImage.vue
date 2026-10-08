<template>
  <div class="captcha-row">
    <a-input
      v-model:value="inner"
      class="captcha-row__input"
      :placeholder="placeholder"
      :maxlength="4"
      :status="error ? 'error' : undefined"
      allow-clear
    />
    <div class="captcha-canvas" title="点击刷新图形验证码" @click="refresh">{{ captchaText }}</div>
  </div>
</template>

<script setup lang="ts">
/**
 * 【原型说明】图形验证码为前端生成的四位字符，仅用于演示"连续失败 3 次后出现图形验证码"的交互，
 * 不代表真实安全实现。
 */
import { computed, ref } from 'vue'

const props = defineProps<{
  modelValue: string
  error?: boolean
  placeholder?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
  refresh: []
}>()

const inner = computed({
  get: () => props.modelValue,
  set: (value: string) => emit('update:modelValue', value),
})

const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXY3456789'
const captchaText = ref(generate())

function generate(): string {
  let result = ''
  for (let i = 0; i < 4; i += 1) {
    result += CHARS[Math.floor(Math.random() * CHARS.length)]
  }
  return result
}

function refresh() {
  captchaText.value = generate()
  inner.value = ''
  emit('refresh')
}

defineExpose({ refresh, value: captchaText })
</script>
