<template>
  <a-checkbox
    class="perm-action"
    :class="{ 'perm-action--on': checked, 'perm-action--dim': dim }"
    :checked="checked"
    :disabled="disabled"
    @change="emit('toggle', node.key, $event.target.checked)"
  >
    <span class="perm-action__text">
      <span
        v-for="(seg, index) in segments"
        :key="index"
        :class="{ 'role-perm__mark': seg.hit }"
      >{{ seg.text }}</span>
    </span>
  </a-checkbox>
</template>

<script setup lang="ts">
/**
 * 【原型说明】平台按钮级权限点勾选项（对齐企业端角色管理 CMP-ROL-20）。
 * 与「企业成员」同一套设计风格：命中搜索时名称内关键字高亮，不改变勾选状态。
 */
import { computed } from 'vue'
import type { PlatformPermissionNode } from '../store/types'

const props = defineProps<{
  node: PlatformPermissionNode
  checked: boolean
  dim: boolean
  keyword: string
  disabled: boolean
}>()

const emit = defineEmits<{
  toggle: [key: string, checked: boolean]
}>()

const segments = computed(() => {
  const value = props.keyword.trim().toLowerCase()
  const text = props.node.name
  if (!value) return [{ text, hit: false }]
  const lower = text.toLowerCase()
  const parts: Array<{ text: string; hit: boolean }> = []
  let cursor = 0
  while (cursor < text.length) {
    const index = lower.indexOf(value, cursor)
    if (index < 0) {
      parts.push({ text: text.slice(cursor), hit: false })
      break
    }
    if (index > cursor) parts.push({ text: text.slice(cursor, index), hit: false })
    parts.push({ text: text.slice(index, index + value.length), hit: true })
    cursor = index + value.length
  }
  return parts
})
</script>
