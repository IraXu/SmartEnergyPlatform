<template>
  <div class="member-scope">
    <!-- 表单内入口：已选标签 + 「选择组织节点」按钮（CMP-MEM-14 的展示规则） -->
    <div class="member-scope__field">
      <template v-if="deduped.length">
        <a-tag
          v-for="id in deduped"
          :key="id"
          :closable="!readonly && !disabled"
          class="member-scope__tag"
          @close="removeNode(id)"
        >
          <span class="member-scope__tag-text" :title="pathText(id)">{{ nodeName(id) }}</span>
        </a-tag>
      </template>
      <span v-else class="member-scope__empty">未选择组织节点</span>
      <a-button v-if="!readonly && !disabled" type="link" size="small" @click="openPicker">
        选择组织节点
      </a-button>
      <span v-if="readonly" class="member-scope__readonly">全部数据</span>
    </div>

    <!-- 只读说明：企业超级管理员的数据范围锁定为「全部数据」（PRD Q-MEM-08） -->
    <p v-if="readonly" class="member-scope__hint">企业超级管理员默认拥有全部数据权限</p>

    <!-- 失效节点提示（EX-MEM-23） -->
    <p v-if="invalid.length" class="member-scope__warn">部分组织节点已被删除，请重新选择数据范围</p>

    <!-- COMP-MEM-01 组织节点选择 -->
    <a-modal
      v-model:open="pickerOpen"
      title="选择组织节点"
      :width="640"
      :ok-button-props="{ disabled: exceeded }"
      ok-text="确定"
      cancel-text="取消"
      @ok="confirmPick"
    >
      <p class="member-scope__modal-desc">
        所选节点包含其全部下级。选中上级节点后，其下级节点不再重复计入。
      </p>

      <a-input v-model:value="keyword" placeholder="搜索组织节点名称" allow-clear class="member-scope__search">
        <template #prefix>
          <SearchOutlined class="member-scope__search-icon" />
        </template>
      </a-input>

      <div class="member-scope__tree">
        <a-tree
          v-model:expanded-keys="expandedKeys"
          :tree-data="treeData"
          :checked-keys="draftChecked"
          checkable
          block-node
          :field-names="{ title: 'title', key: 'key', children: 'children' }"
          @check="handleCheck"
        />
        <p v-if="keyword.trim() && !matchedKeys.length" class="member-scope__no-hit">未找到匹配的组织节点</p>
      </div>

      <div class="member-scope__selected">
        <a-tag v-for="id in draftDeduped" :key="id" closable @close="removeDraft(id)">
          <span :title="pathText(id)">{{ nodeName(id) }}</span>
        </a-tag>
        <span v-if="!draftDeduped.length" class="member-scope__empty">未选择组织节点</span>
      </div>
      <p class="member-scope__count">
        {{
          draftDeduped.length === 1 && isRoot(draftDeduped[0])
            ? '已选全部数据（企业根节点）'
            : `已选 ${draftDeduped.length} 个组织节点`
        }}
      </p>
      <p v-if="exceeded" class="member-scope__warn">
        单个成员最多选择 {{ SCOPE_NODE_LIMIT }} 个组织节点，可改选其上级节点
      </p>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
/**
 * 【原型说明】数据范围选择（COMP-MEM-01），对齐《产品交互设计文档-企业成员》v1.0 4.1.3。
 * 只展示企业根节点与组织节点（用能单元不作为可选范围）；
 * 父子节点同时选中时按父节点去重；上限 100 个节点；未绑定时持续给出警告；
 * 成员为企业超级管理员时该字段只读并展示「全部数据」（PRD Q-MEM-08）。
 */
import { computed, ref, watch } from 'vue'
import { SearchOutlined } from '@antdv-next/icons'
import type { TreeDataNode } from 'antdv-next'
import {
  SCOPE_NODE_LIMIT,
  dedupeScopeIds,
  getPathText,
  getRoot,
  scopeNodeOptions,
} from '../store'

const props = defineProps<{
  modelValue: string[]
  disabled?: boolean
  /** 成员为超级管理员时只读展示「全部数据」（PRD Q-MEM-08） */
  readonly?: boolean
}>()

const emit = defineEmits<{ 'update:modelValue': [value: string[]] }>()

const pickerOpen = ref(false)
const keyword = ref('')
const draftChecked = ref<string[]>([])
const expandedKeys = ref<string[]>([])

const options = computed(() => scopeNodeOptions())
const nodeName = (id: string) => options.value.find((item) => item.id === id)?.name ?? id
const pathText = (id: string) => getPathText(id)
const isRoot = (id: string) => getRoot()?.id === id

/** 已选节点（父子去重）：页面展示与统计都以去重结果为准 */
const deduped = computed(() => dedupeScopeIds(props.modelValue))
const invalid = computed(() => props.modelValue.filter((id) => !options.value.some((item) => item.id === id)))

/* ---------- 弹窗内 ---------- */

const draftDeduped = computed(() => dedupeScopeIds(draftChecked.value))
const exceeded = computed(() => draftDeduped.value.length > SCOPE_NODE_LIMIT)

const treeData = computed<TreeDataNode[]>(() => {
  const childrenMap = new Map<string | null, typeof options.value>()
  options.value.forEach((node) => {
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
        children: children.length ? children : undefined,
      }
    })
  return build(null)
})

/** 搜索命中的节点键：命中节点自动展开其路径（不改变勾选状态） */
const matchedKeys = computed(() => {
  const value = keyword.value.trim().toLowerCase()
  if (!value) return []
  return options.value.filter((node) => node.name.toLowerCase().includes(value)).map((node) => node.id)
})

watch(matchedKeys, (keys) => {
  if (!keys.length) return
  const pathKeys = new Set<string>()
  keys.forEach((id) => {
    let cursor = options.value.find((item) => item.id === id)
    while (cursor) {
      pathKeys.add(cursor.id)
      cursor = cursor.parentId ? options.value.find((item) => item.id === cursor?.parentId) : undefined
    }
  })
  expandedKeys.value = Array.from(new Set([...expandedKeys.value, ...pathKeys]))
})

function openPicker() {
  draftChecked.value = [...props.modelValue]
  keyword.value = ''
  // 默认展开全部节点，便于在企业根节点与组织节点之间快速勾选
  expandedKeys.value = options.value.map((item) => item.id)
  pickerOpen.value = true
}

/**
 * 勾选处理：树内保留原始勾选键（含父节点），回填时按父子去重，
 * 避免「同时勾选父节点与其下级」造成范围语义重复（PRD F-MEM-05 业务规则）。
 */
function handleCheck(keys: string[] | { checked: string[]; halfChecked: string[] }) {
  draftChecked.value = Array.isArray(keys) ? keys : keys.checked
}

function removeDraft(id: string) {
  // 移除父节点时，连同其下级的勾选一并清掉，避免出现「取消了父节点但子节点仍在」的歧义
  draftChecked.value = draftChecked.value.filter((key) => key !== id)
}

function removeNode(id: string) {
  emit('update:modelValue', dedupeScopeIds(props.modelValue).filter((key) => key !== id))
}

function confirmPick() {
  if (exceeded.value) return
  emit('update:modelValue', draftDeduped.value)
  pickerOpen.value = false
}
</script>
