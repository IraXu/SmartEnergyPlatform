<template>
  <div class="proto-tip">
    <div class="proto-tip__head">
      <span>原型演示提示</span>
      <a-button type="link" size="small" @click="onReset">重置演示数据</a-button>
    </div>
    <div v-for="(line, index) in lines" :key="index">{{ line }}</div>
    <div v-if="$slots.extra" class="proto-tip__extra">
      <slot name="extra" />
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * 【原型说明】用于说明当前页面的演示要点，并提供重置演示数据入口，便于反复验证异常分支。
 * 页面可通过 extra 插槽补充专属的演示触发入口（如模拟加载失败）。
 */
import { message } from 'antdv-next'
import { resetPrototypeData } from '@/modules/auth/store'

defineProps<{ lines: string[] }>()

const emit = defineEmits<{ reset: [] }>()

function onReset() {
  resetPrototypeData()
  message.success('演示数据已重置')
  emit('reset')
}
</script>
