<template>
  <section class="org-tree" aria-label="组织架构树">
    <!-- 工具行：搜索（CMP-ORG-03） -->
    <div class="org-tree__toolbar">
      <a-input
        :value="keyword"
        class="org-tree__search"
        placeholder="搜索节点名称"
        allow-clear
        :maxlength="SEARCH_MAX"
        @update:value="emit('update:keyword', $event)"
      >
        <template #prefix>
          <SearchOutlined class="org-tree__search-icon" />
        </template>
      </a-input>
    </div>

    <!-- 超限提醒（STATE-ORG-10 / CMP-ORG-18） -->
    <a-alert
      v-if="limitReached"
      type="warning"
      show-icon
      class="org-tree__alert"
      message="节点数量已达上限（500），请先清理不再使用的节点"
    />

    <!-- 加载中（STATE-ORG-01） -->
    <div v-if="loading" class="org-tree__body">
      <a-skeleton active :paragraph="{ rows: 3 }" />
    </div>

    <!-- 加载失败（STATE-ORG-06 / EX-ORG-01）：
         树面板仅 360px 宽，a-result 的 72px 大图标 + 24px 标题会把文案挤成两行，
         这里改用贴合窄面板的紧凑空态：中号图标 + 单行标题 + 说明 + 重试按钮。 -->
    <div v-else-if="failed" class="org-tree__body org-tree__body--center">
      <div class="org-tree__state">
        <span class="org-tree__state-icon org-tree__state-icon--error">
          <DisconnectOutlined />
        </span>
        <p class="org-tree__state-title">组织架构加载失败</p>
        <p class="org-tree__state-desc">网络异常或服务暂时不可用，请稍后重试</p>
        <a-button type="primary" class="org-tree__state-action" @click="emit('retry')">
          <template #icon>
            <ReloadOutlined />
          </template>
          重新加载
        </a-button>
      </div>
    </div>

    <!-- 搜索无结果（STATE-ORG-05 / EX-ORG-03） -->
    <div v-else-if="searching && !hits.length" class="org-tree__body org-tree__body--center">
      <div class="org-tree__state">
        <span class="org-tree__state-icon">
          <SearchOutlined />
        </span>
        <p class="org-tree__state-title">未找到匹配的节点</p>
        <p class="org-tree__state-desc">换个关键字试试，或清空搜索查看全部节点</p>
      </div>
    </div>

    <!-- 搜索命中列表（STATE-ORG-04）：命中关键字高亮 + 上级路径，点击定位 -->
    <div v-else-if="searching" class="org-tree__body">
      <button
        v-for="hit in hits"
        :key="hit.node.id"
        type="button"
        class="org-tree__hit"
        :class="{ 'org-tree__hit--current': hit.node.id === selectedId }"
        @click="emit('locate', hit.node.id)"
      >
        <span class="org-tree__hit-head">
          <span class="org-tree__hit-name" v-html="highlight(hit.node.name)" />
          <a-tag v-if="hit.node.kind === 'unit'" class="org-tree__hit-tag">用能单元</a-tag>
        </span>
        <span class="org-tree__hit-path">{{ hit.pathText }}</span>
      </button>
    </div>

    <!-- 默认（有结构，含仅根节点的空结构）（STATE-ORG-02、STATE-ORG-03） -->
    <div v-else ref="bodyRef" class="org-tree__body">
      <a-tree
        v-model:expanded-keys="expandedKeys"
        :tree-data="treeData"
        :selected-keys="selectedKeys"
        :title-render="renderTitle"
        block-node
        :selectable="true"
        @select="handleSelect"
      />

      <div v-if="isSingleRoot" class="org-tree__empty">
        <span>还没有下级节点，点击「新增下级」开始搭建</span>
        <a-button v-if="perms.create" type="link" size="small" @click="emit('create', rootId)">
          新增下级
        </a-button>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
/**
 * 【原型说明】组织架构树面板，对齐交互设计文档 4.1.2 AREA-ORG-03 与 4.1.3、4.1.5。
 * 覆盖加载中、加载失败、有结构、仅根节点的空结构、搜索命中、搜索无结果六种树区状态；
 * 节点操作与「未保存修改」确认逻辑通过事件交给页面统一处理。
 * 【权限】节点操作入口按权限点逐项渲染（见 OrgNodeTitle），本组件只透传 perms。
 */
import { computed, h, nextTick, ref, watch } from 'vue'
import { DisconnectOutlined, ReloadOutlined, SearchOutlined } from '@antdv-next/icons'
import type { TreeDataNode } from 'antdv-next'
import OrgNodeTitle from './OrgNodeTitle.vue'
import { getNode, getRoot, getSubtreeIds, searchNodes, SEARCH_MAX } from '../store'
import type { OrgNode, OrgPerms } from '../store'

const props = defineProps<{
  nodes: OrgNode[]
  selectedId: string | null
  keyword: string
  loading: boolean
  failed: boolean
  /** 【权限】当前账号可执行的组织架构操作 */
  perms: OrgPerms
  dirty: boolean
  pendingSwitchId: string | null
  limitReached: boolean
  initialExpandedKeys: string[]
}>()

const emit = defineEmits<{
  'update:keyword': [value: string]
  select: [nodeId: string]
  locate: [nodeId: string]
  create: [parentId: string]
  rename: [nodeId: string]
  move: [nodeId: string]
  sort: [nodeId: string, direction: 'up' | 'down']
  remove: [nodeId: string]
  confirmSwitch: []
  cancelSwitch: []
  retry: []
  'update:expandedKeys': [keys: string[]]
}>()

const rootId = computed(() => getRoot()?.id ?? '')
/** 仅根节点时视为空结构，在树下方给出搭建引导 */
const isSingleRoot = computed(() => {
  const root = getRoot()
  return !!root && getSubtreeIds(root.id).length <= 1
})

const searching = computed(() => props.keyword.trim().length > 0)
const hits = computed(() => searchNodes(props.keyword))

/** 受控展开：默认展开根节点第一层；由页面传入以支持会话内保留（Q-IXD-05） */
const expandedKeys = ref<string[]>(props.initialExpandedKeys)
watch(
  () => props.initialExpandedKeys,
  (keys) => {
    expandedKeys.value = keys
  },
)
watch(expandedKeys, (keys) => emit('update:expandedKeys', keys))

const selectedKeys = computed(() => (props.selectedId ? [props.selectedId] : []))

/** 扁平结构生成树数据：子节点按同级顺序排列（同级顺序影响树形展示） */
const treeData = computed<TreeDataNode[]>(() => {
  const childrenMap = new Map<string | null, OrgNode[]>()
  props.nodes.forEach((node) => {
    const list = childrenMap.get(node.parentId) ?? []
    list.push(node)
    childrenMap.set(node.parentId, list)
  })
  childrenMap.forEach((list) => list.sort((a, b) => a.order - b.order))

  const build = (parentId: string | null): TreeDataNode[] =>
    (childrenMap.get(parentId) ?? []).map((node) => {
      const children = build(node.id)
      return {
        key: node.id,
        title: node.name,
        isLeaf: node.kind === 'unit',
        children: children.length ? children : undefined,
      }
    })

  return build(null)
})

/** 自定义节点行：图标 + 名称 + 下级数量 + 常显操作区（CMP-ORG-06~CMP-ORG-10） */
function renderTitle(data: TreeDataNode) {
  const node = getNode(String(data.key))
  if (!node) return h('span', String(data.title ?? ''))
  return h(OrgNodeTitle, {
    node,
    selected: node.id === props.selectedId,
    perms: props.perms,
    dirty: props.dirty,
    pending: props.pendingSwitchId === node.id,
    onCreate: (parentId: string) => emit('create', parentId),
    onRename: (nodeId: string) => emit('rename', nodeId),
    onMove: (nodeId: string) => emit('move', nodeId),
    onSort: (nodeId: string, direction: 'up' | 'down') => emit('sort', nodeId, direction),
    onRemove: (nodeId: string) => emit('remove', nodeId),
    onConfirmSwitch: () => emit('confirmSwitch'),
    onCancelSwitch: () => emit('cancelSwitch'),
  })
}

function handleSelect(_keys: Array<string | number>, info: { node: { key?: string | number } }) {
  const id = String(info.node.key ?? '')
  if (id) emit('select', id)
}

/**
 * 【原型说明】选中节点后滚动到可见位置（ACT-ORG-14 与 OVERLAY-01~03 的定位规则）。
 * 仅调整树区自身的 scrollTop，不带动页面整体滚动。
 */
const bodyRef = ref<HTMLElement | null>(null)
watch(
  () => props.selectedId,
  () => {
    nextTick(() => {
      const container = bodyRef.value
      const target = container?.querySelector<HTMLElement>('.ant-tree-treenode-selected')
      if (!container || !target) return
      const containerRect = container.getBoundingClientRect()
      const targetRect = target.getBoundingClientRect()
      if (targetRect.top < containerRect.top) {
        container.scrollTop += targetRect.top - containerRect.top
      } else if (targetRect.bottom > containerRect.bottom) {
        container.scrollTop += targetRect.bottom - containerRect.bottom
      }
    })
  },
)

/**
 * 【原型说明】命中关键字高亮（STATE-ORG-04）。
 * 节点名称按纯文本处理，此处先做转义再包裹高亮标签，避免引入脚本内容。
 */
function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function highlight(name: string) {
  const safe = escapeHtml(name)
  const keyword = props.keyword.trim().slice(0, SEARCH_MAX)
  if (!keyword) return safe
  const index = safe.toLowerCase().indexOf(keyword.toLowerCase())
  if (index < 0) return safe
  return `${safe.slice(0, index)}<em class="org-tree__hit-mark">${safe.slice(index, index + keyword.length)}</em>${safe.slice(index + keyword.length)}`
}
</script>
