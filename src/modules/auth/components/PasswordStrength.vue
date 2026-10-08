<template>
  <div>
    <div class="pwd-strength">
      <a-progress
        :percent="result.percent"
        :stroke-color="result.color"
        :show-info="false"
        size="small"
        style="width: 132px"
      />
      <span class="pwd-strength__text" :style="{ color: result.color }">
        密码强度：{{ result.strengthText }}
      </span>
    </div>
    <div class="pwd-rules">密码需 8-20 位，且同时包含字母和数字；包含符号或长度达 12 位以上为强密码。</div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { checkPassword, passwordStrengthColor } from '@/modules/auth/utils/password'

const props = defineProps<{ password: string; identifier?: string }>()

const result = computed(() => {
  const check = checkPassword(props.password, props.identifier ?? '')
  return { ...check, color: passwordStrengthColor[check.strength] }
})
</script>
