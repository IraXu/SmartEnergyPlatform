<template>
  <div
    class="perm-menu"
    :class="{ 'perm-menu--nested': depth > 0, 'perm-menu--dim': dim, 'perm-menu--with-children': childMenus.length }"
  >
    <div class="perm-menu__head">
      <a-checkbox
        class="perm-level__box"
        :checked="state === 'all'"
        :indeterminate="state === 'partial'"
        :disabled="disabled"
        @change="emit('toggle', node.key, $event.target.checked)"
      />
      <span class="perm-menu__name">{{ node.name }}</span>
      <span class="perm-level__badge perm-level__badge--menu">菜单</span>
      <span class="perm-menu__count">{{ grantedCount }} / {{ capabilityCount }}</span>
    </div>

    <div v-if="actions.length" class="perm-menu__actions">
      <PlatformPermissionActionItem
        v-for="action in actions"
        :key="action.key"
        :node="action"
        :checked="granted.has(action.key)"
        :dim="isDim(action.key)"
        :keyword="keyword"
        :disabled="disabled"
        @toggle="(key, value) => emit('toggle', key, value)"
      />
    </div>

    <div v-if="childMenus.length" class="perm-menu__children">
      <PlatformPermissionMenuCard
        v-for="child in childMenus"
        :key="child.key"
        :node="child"
        :depth="depth + 1"
        :granted="granted"
        :hit-keys="hitKeys"
        :searching="searching"
        :keyword="keyword"
        :disabled="disabled"
        @toggle="(key, value) => emit('toggle', key, value)"
      />
    </div>

    <p v-else-if="!actions.length" class="perm-menu__empty">该菜单下暂无按钮级权限</p>
  </div>
</template>

<script setup lang="ts">
/**
 * 【原型说明】平台菜单权限卡片（对齐企业端角色管理 CMP-ROL-19），**递归组件**，支持任意层级菜单嵌套。
 * 设计风格与企业端角色管理完全一致，仅权限点来源替换为平台权限字典。
 */
import { computed } from 'vue'
import PlatformPermissionActionItem from './PlatformPermissionActionItem.vue'
import { platformSubtreeKeysOf } from '../mock/permissions'
import type { PlatformPermissionNode } from '../store/types'

const props = defineProps<{
  node: PlatformPermissionNode
  depth: number
  granted: Set<string>
  hitKeys: Set<string>
  searching: boolean
  keyword: string
  disabled: boolean
}>()

const emit = defineEmits<{
  toggle: [key: string, checked: boolean]
}>()

const actions = computed(() => props.node.children.filter((child) => child.level === 'action'))
const childMenus = computed(() => props.node.children.filter((child) => child.level === 'menu'))

const caps = computed(() => platformSubtreeKeysOf(props.node))

const state = computed<'all' | 'partial' | 'none'>(() => {
  const hit = caps.value.filter((key) => props.granted.has(key)).length
  if (hit === 0) return 'none'
  return hit === caps.value.length ? 'all' : 'partial'
})

const capabilityCount = computed(() => caps.value.length)
const grantedCount = computed(() => caps.value.filter((key) => props.granted.has(key)).length)

const dim = computed(() => props.searching && !props.hitKeys.has(props.node.key))
const isDim = (key: string) => props.searching && !props.hitKeys.has(key)

defineOptions({ name: 'PlatformPermissionMenuCard' })
</script>
