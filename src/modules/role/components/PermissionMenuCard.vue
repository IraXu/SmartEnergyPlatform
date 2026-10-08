<template>
  <div class="perm-menu" :class="{ 'perm-menu--nested': depth > 0, 'perm-menu--dim': dim }">
    <!-- 菜单行头（CMP-ROL-19）：菜单级节点自带「可进入该页面」语义；
         若其下还有下级菜单，则自身无页面、仅作分组容器（勾选即整块授权其下全部子功能） -->
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

    <!-- 该菜单直属的按钮级权限点 -->
    <div v-if="actions.length" class="perm-menu__actions">
      <PermissionActionItem
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

    <!-- 下级菜单：嵌套在上级菜单卡片内部、逐级缩进并附左侧浅色条，层级归属一眼可辨 -->
    <div v-if="childMenus.length" class="perm-menu__children">
      <PermissionMenuCard
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
 * 【原型说明】菜单卡片（CMP-ROL-19），**递归组件**，支持任意层级菜单嵌套（多级菜单天然支持）。
 * - 无下级菜单 → 自身即页面：行头 + 其下按钮级权限点，附「菜单」徽标；
 * - 有下级菜单 → 自身无页面、仅作分组：行头 + 其下级菜单**嵌套展示在卡片内部**（逐级缩进 + 左侧浅色条）。
 * 每一级行头都带勾选框（三态），勾选即整块授权其下全部内容。
 * 勾选状态、计数与搜索淡出全部取自 store 的权限计算函数，与面板其余部分同一口径。
 */
import { computed } from 'vue'
import PermissionActionItem from './PermissionActionItem.vue'
import { subtreeCapabilityKeysOf } from '../store'
import type { PermissionNode } from '../store'

const props = defineProps<{
  node: PermissionNode
  /** 菜单嵌套深度，0 为二级菜单栏内的项；用于缩进与左侧色条 */
  depth: number
  /** 已授权的生效能力集合（展开后），勾选态与计数以它为准 */
  granted: Set<string>
  /** 搜索命中的权限节点标识 */
  hitKeys: Set<string>
  /** 是否处于搜索中：决定未命中项是否淡出 */
  searching: boolean
  keyword: string
  disabled: boolean
}>()

const emit = defineEmits<{
  toggle: [key: string, checked: boolean]
}>()

/** 节点直属的按钮级权限点 */
const actions = computed(() => props.node.children.filter((child) => child.level === 'action'))

/** 节点的下级菜单 */
const childMenus = computed(() => props.node.children.filter((child) => child.level === 'menu'))

/** 节点子树的可授权能力（自身进入能力 + 下级全部菜单与按钮） */
const caps = computed(() => subtreeCapabilityKeysOf(props.node))

const state = computed<'all' | 'partial' | 'none'>(() => {
  const hit = caps.value.filter((key) => props.granted.has(key)).length
  if (hit === 0) return 'none'
  return hit === caps.value.length ? 'all' : 'partial'
})

const capabilityCount = computed(() => caps.value.length)
const grantedCount = computed(() => caps.value.filter((key) => props.granted.has(key)).length)

/** 搜索未命中时整块淡出（仍可见，不改变勾选状态） */
const dim = computed(() => props.searching && !props.hitKeys.has(props.node.key))
const isDim = (key: string) => props.searching && !props.hitKeys.has(key)
</script>
