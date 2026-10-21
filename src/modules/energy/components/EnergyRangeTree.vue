<template>
  <!-- 【原型说明】能源数据左侧分析对象树：企业 → 组织节点 → 用能单元，同类型多选，无折叠控件 -->
  <section class="energy-range" aria-label="分析对象树">
    <div v-if="showHead" class="energy-range__head">
      <span class="energy-range__title">{{ title }}</span>
      <a-tooltip
        :title="
          onlyUnits
            ? '仅用能单元可挂载设备并作为统计范围；组织节点只作层级分组，不可选择'
            : deviceScope
              ? '企业、组织节点、用能单元均可选择；选中组织节点时，在其下全部用能单元范围内选择设备（组织节点本身不挂设备）'
              : '选择企业汇总其下全部用能单元，且不能与其他对象同时选择；组织节点只能与节点对比，用能单元只能与用能单元对比'
        "
      >
        <InfoCircleOutlined class="energy-range__hint" />
      </a-tooltip>
    </div>

    <a-input v-model:value="keyword" class="energy-range__search" allow-clear placeholder="搜索节点或用能单元">
      <template #prefix>
        <SearchOutlined class="energy-range__search-icon" />
      </template>
    </a-input>

    <div class="energy-range__tree">
      <a-tree
        v-if="treeData.length"
        :key="keyword"
        :tree-data="treeData"
        :selected-keys="selectedKeys"
        :checkable="false"
        :multiple="multiple"
        :default-expand-all="true"
        block-node
        @select="handleSelect"
      >
        <template #titleRender="node">
          <span class="energy-range__node">
            <BankOutlined
              v-if="node.kind === 'root'"
              class="energy-range__node-icon energy-range__node-icon--root"
            />
            <ThunderboltOutlined
              v-else-if="node.kind === 'unit'"
              class="energy-range__node-icon energy-range__node-icon--unit"
            />
            <ApartmentOutlined v-else class="energy-range__node-icon energy-range__node-icon--org" />
            <span class="energy-range__node-name">{{ node.title }}</span>
          </span>
        </template>
      </a-tree>
      <a-empty v-else description="未找到匹配的节点或用能单元" />
    </div>
  </section>
</template>

<script setup lang="ts">
/** 【原型说明】分析对象树：数据来自能源数据演示组织树，区分组织节点与用能单元。 */
import { computed, ref, watch } from 'vue'
import { message } from 'antdv-next'
import {
  ApartmentOutlined,
  BankOutlined,
  InfoCircleOutlined,
  SearchOutlined,
  ThunderboltOutlined,
} from '@antdv-next/icons'
import { units } from '../store'

const props = withDefaults(
  defineProps<{
    /** 已选节点（默认为空） */
    value: string[]
    /** 是否多选（分析对象多选） */
    multiple?: boolean
    title?: string
    /** 是否展示标题行（用能分析页不展示，搜索框直接置于卡片顶部） */
    showHead?: boolean
    /** 仅允许选择用能单元（用电统计设置使用；组织节点仅作层级展示） */
    onlyUnits?: boolean
    /** 设备选择范围：企业可汇总全部用能单元，组织节点仅作层级展示 */
    deviceScope?: boolean
  }>(),
  { multiple: false, title: '分析对象', showHead: true, onlyUnits: false, deviceScope: false },
)

const emit = defineEmits<{ (event: 'update:value', value: string[]): void }>()

const keyword = ref('')
const selectedKeys = ref<string[]>([...props.value])

watch(
  () => props.value,
  (value) => {
    selectedKeys.value = [...value]
  },
  { deep: true },
)

/** 选择类型归一化：企业根节点代表全企业汇总，组织节点与用能单元各自成组 */
function kindOf(id: string): 'enterprise' | 'org' | 'unit' | null {
  const unit = units.find((item) => item.id === id)
  if (!unit) return null
  if (unit.kind === 'root') return 'enterprise'
  return unit.kind === 'unit' ? 'unit' : 'org'
}

function kindLabel(kind: 'org' | 'unit') {
  return kind === 'unit' ? '用能单元' : '组织节点'
}

/** 完整树数据：按父子关系递归构建 */
const fullTree = computed<Array<Record<string, unknown>>>(() => {
  const build = (parentId: string | null): Array<Record<string, unknown>> =>
    units
      .filter((unit) => unit.parentId === parentId)
      .map((unit) => {
        const children = build(unit.id)
        return {
          key: unit.id,
          title: unit.name,
          kind: unit.kind,
          selectable: props.onlyUnits ? unit.kind === 'unit' : true,
          children: children.length ? children : undefined,
        }
      })
  return build(null)
})

/** 搜索过滤：命中节点保留其完整子树，子节点命中时保留祖先路径 */
const treeData = computed<Array<Record<string, unknown>>>(() => {
  const text = keyword.value.trim()
  if (!text) return fullTree.value
  const filter = (nodes: Array<Record<string, unknown>>): Array<Record<string, unknown>> =>
    nodes.flatMap((node) => {
      const selfMatch = String(node.title ?? '').includes(text)
      const children = filter((node.children as Array<Record<string, unknown>> | undefined) ?? [])
      if (selfMatch) return [{ ...node }]
      return children.length ? [{ ...node, children }] : []
    })
  return filter(fullTree.value)
})

function handleSelect(
  _keys: Array<string | number>,
  info: { node: { key?: string | number }; selected?: boolean },
) {
  const id = String(info.node.key ?? '')
  if (!id) return

  // 用电统计设置：组织节点仅作层级展示，不允许作为配置对象
  if (props.onlyUnits && kindOf(id) !== 'unit') return

  // 单选：点击已选节点保持选中，避免出现无选中
  if (!props.multiple) {
    selectedKeys.value = [id]
    emit('update:value', [id])
    return
  }

  const exists = selectedKeys.value.includes(id)
  const shouldSelect = info.selected ?? !exists
  const targetKind = kindOf(id)

  // 企业根节点代表全企业汇总：只能单独选中，再次点击取消
  if (targetKind === 'enterprise') {
    const next = shouldSelect ? [id] : []
    selectedKeys.value = next
    emit('update:value', next)
    return
  }

  // 取消选择：允许取消到空
  if (!shouldSelect) {
    const next = selectedKeys.value.filter((key) => key !== id)
    selectedKeys.value = next
    emit('update:value', next)
    return
  }

  // 已选企业时改选其他对象：取消企业，回到组织节点 / 用能单元选择
  const restKeys = selectedKeys.value.filter((key) => kindOf(key) !== 'enterprise')
  const restKind = restKeys.length ? kindOf(restKeys[0]) : null
  if ((restKind === 'org' || restKind === 'unit') && targetKind && targetKind !== restKind) {
    message.warning(`已选择${kindLabel(restKind)}，不能与${kindLabel(targetKind)}混合对比`)
    // 重新赋值同一份选中集合，强制树回退本次点击产生的内部高亮
    selectedKeys.value = [...selectedKeys.value]
    return
  }

  // 多选：允许取消到空，默认未选择；同一类型才能一起对比
  const next = [...restKeys, id]
  selectedKeys.value = next
  emit('update:value', next)
}
</script>
