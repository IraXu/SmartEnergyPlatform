<template>
  <a-popconfirm
    :open="pending"
    :disabled="!dirty"
    title="当前修改尚未保存，切换节点将丢失修改"
    ok-text="放弃修改"
    cancel-text="继续编辑"
    placement="rightTop"
    @confirm="emit('confirmSwitch')"
    @cancel="emit('cancelSwitch')"
  >
    <div class="org-node" :class="{ 'org-node--current': selected, 'org-node--menu-open': menuOpen }">
      <component
        :is="icon"
        class="org-node__icon"
        :class="[`org-node__icon--${node.kind}`, { 'org-node__icon--current': selected }]"
      />
      <span class="org-node__name" :title="node.name">{{ node.name }}</span>
      <span v-if="node.kind === 'org' && childCount" class="org-node__count">（{{ childCount }}）</span>
      <span v-if="hasAnyAction" class="org-node__actions">
        <button
          v-if="canCreate && node.kind !== 'unit'"
          type="button"
          class="org-node__action"
          title="新增下级"
          @click.stop="emit('create', node.id)"
        >
          <PlusOutlined />
        </button>
        <a-dropdown
          v-if="node.kind !== 'root' && hasMenuAction"
          :menu="{ items: menuItems }"
          :open="menuOpen"
          :trigger="['click']"
          placement="bottomRight"
          @open-change="menuOpen = $event"
          @menu-click="handleMenuClick"
        >
          <button type="button" class="org-node__action" title="更多操作" @click.stop>
            <EllipsisOutlined />
          </button>
        </a-dropdown>
      </span>
    </div>
  </a-popconfirm>
</template>

<script setup lang="ts">
/**
 * 【原型说明】组织架构树的单个节点行，对齐交互设计文档 4.1.3 CMP-ORG-06~CMP-ORG-10。
 * 节点操作区常显（默认低对比度，悬停 / 聚焦 / 选中 / 菜单展开时转主色）：非用能单元可「新增下级」，
 * 非根节点有「更多」菜单（重命名、移动、上移、下移、删除）；根节点在本页只读，不展示「更多」（PRD Q-ORG-01）。
 * 【权限】各操作入口按当前账号的权限点逐项渲染（新增下级 / 重命名 / 移动 / 排序 / 删除），
 * 无对应权限点时该入口不渲染（不置灰、不提示）；整个操作区在无任何权限点时不渲染。
 * 属性编辑中切换节点时用 Popconfirm 确认放弃修改（EX-ORG-11）。
 */
import { computed, ref } from 'vue'
import type { MenuItemType } from 'antdv-next'
import {
  ApartmentOutlined,
  BankOutlined,
  EllipsisOutlined,
  PlusOutlined,
  ThunderboltOutlined,
} from '@antdv-next/icons'
import { getChildCount, getSiblings } from '../store'
import type { OrgNode, OrgPerms } from '../store'

const props = defineProps<{
  node: OrgNode
  selected: boolean
  /** 【权限】当前账号可执行的组织架构操作（由页面按权限点推导后传入） */
  perms: OrgPerms
  dirty: boolean
  pending: boolean
}>()

const emit = defineEmits<{
  create: [nodeId: string]
  rename: [nodeId: string]
  move: [nodeId: string]
  sort: [nodeId: string, direction: 'up' | 'down']
  remove: [nodeId: string]
  confirmSwitch: []
  cancelSwitch: []
}>()

const icon = computed(() => {
  if (props.node.kind === 'root') return BankOutlined
  if (props.node.kind === 'unit') return ThunderboltOutlined
  return ApartmentOutlined
})

/** 「更多」菜单展开态：展开期间保持操作区可见，避免鼠标移入浮层后触发元素被隐藏 */
const menuOpen = ref(false)

const childCount = computed(() => getChildCount(props.node.id))

/* ---------- 权限：按权限点逐项渲染操作入口 ---------- */

/** 是否可「新增下级」（用能单元为最小计量单元，无下级） */
const canCreate = computed(() => props.perms.create)
/** 「更多」菜单内是否至少有一项可用操作 */
const hasMenuAction = computed(
  () => props.perms.rename || props.perms.move || props.perms.sort || props.perms.remove,
)
/** 整个操作区是否有内容可渲染 */
const hasAnyAction = computed(
  () => (canCreate.value && props.node.kind !== 'unit') || hasMenuAction.value,
)

const siblings = computed(() => getSiblings(props.node.id))
const index = computed(() => siblings.value.findIndex((item) => item.id === props.node.id))

/** 按权限点裁剪菜单项：无权限的项不渲染，避免暴露功能存在 */
const menuItems = computed<MenuItemType[]>(() => {
  const items: MenuItemType[] = []
  if (props.perms.rename) items.push({ key: 'rename', label: '重命名' })
  if (props.perms.move) items.push({ key: 'move', label: '移动' })
  if (props.perms.sort) {
    if (items.length) items.push({ type: 'divider' })
    items.push({ key: 'up', label: '上移', disabled: index.value <= 0 })
    items.push({
      key: 'down',
      label: '下移',
      disabled: index.value < 0 || index.value >= siblings.value.length - 1,
    })
  }
  if (props.perms.remove) {
    if (items.length) items.push({ type: 'divider' })
    items.push({ key: 'remove', label: '删除', danger: true, disabled: childCount.value > 0 })
  }
  return items
})

function handleMenuClick({ key }: { key: string }) {
  if (key === 'rename') emit('rename', props.node.id)
  else if (key === 'move') emit('move', props.node.id)
  else if (key === 'up') emit('sort', props.node.id, 'up')
  else if (key === 'down') emit('sort', props.node.id, 'down')
  else if (key === 'remove') emit('remove', props.node.id)
}
</script>
