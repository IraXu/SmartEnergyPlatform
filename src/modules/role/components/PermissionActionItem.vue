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
 * 【原型说明】按钮级权限点勾选项（CMP-ROL-20）。
 * 「目录自身即页面」与「菜单下」的按钮级权限点结构一致，抽取此处共用；
 * 命中搜索时名称内关键字高亮（COMP-ROL-02），不改变勾选状态。
 */
import { computed } from 'vue'
import type { PermissionNode } from '../store'

const props = defineProps<{
  node: PermissionNode
  /** 是否已授权 */
  checked: boolean
  /** 搜索未命中时淡出（仍可见） */
  dim: boolean
  /** 搜索关键字（受控） */
  keyword: string
  disabled: boolean
}>()

const emit = defineEmits<{
  toggle: [key: string, checked: boolean]
}>()

/** 命中片段的切分：命中部分单独成段以便高亮 */
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
