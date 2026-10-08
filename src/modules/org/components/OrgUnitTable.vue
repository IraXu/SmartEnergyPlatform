<template>
  <section class="org-units" aria-label="用能单元列表">
    <header class="org-units__head">
      <div class="org-units__title">
        <h2 class="org-units__heading">用能单元</h2>
        <span class="org-units__count">共 {{ rows.length }} 个</span>
      </div>
      <a-input
        v-if="rows.length"
        v-model:value="keyword"
        class="org-units__search"
        placeholder="按名称或编码筛选"
        allow-clear
      >
        <template #prefix>
          <SearchOutlined class="org-units__search-icon" />
        </template>
      </a-input>
    </header>

    <!-- 空态：当前节点及其下级均无用能单元 -->
    <div v-if="!rows.length" class="org-units__empty">
      <a-empty description="当前节点及其下级暂无用能单元" />
    </div>

    <!-- 筛选无结果：与「无数据」区分，避免误判为该节点下没有单元 -->
    <div v-else-if="!filteredRows.length" class="org-units__empty">
      <a-empty description="未找到匹配的用能单元" />
    </div>

    <a-table
      v-else
      class="org-units__table"
      :columns="columns"
      :data-source="filteredRows"
      :pagination="pagination"
      row-key="id"
      size="middle"
    >
      <template #headerCell="{ column }">
        <!-- 用能单元编码：编码是设备批量导入 / 批量导入删除的定位依据，列头给出说明 -->
        <template v-if="column.key === 'unitCode'">
          <span class="org-units__head-cell">
            用能单元编码
            <a-tooltip title="该用能单元的唯一编码，用于批量添加/删除设备">
              <QuestionCircleOutlined class="org-units__head-tip" />
            </a-tooltip>
          </span>
        </template>
      </template>

      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'name'">
          <a class="org-units__name" @click="emit('locate', (record as UnitRow).id)">
            {{ (record as UnitRow).name }}
          </a>
        </template>
        <!-- 长文本（GPS 坐标、所属组织节点全路径）需完整可读，折行展示而非省略 -->
        <template v-else-if="column.key === 'coordinate' || column.key === 'orgPath'">
          <span class="org-units__wrap">{{ (record as UnitRow)[column.key as 'coordinate' | 'orgPath'] }}</span>
        </template>
      </template>
    </a-table>
  </section>
</template>

<script setup lang="ts">
/**
 * 【原型说明】右侧「用能单元」列表，展示当前所选节点及其全部下级中的用能单元。
 * 字段：名称、用能单元编码、GPS 坐标、所属组织节点（完整层级路径）。
 * 名称可点击，定位到左侧树中的对应节点；
 * 「用能单元编码」列头带说明图标——该编码是设备批量添加 / 批量删除的定位依据。
 */
import { computed, ref } from 'vue'
import { QuestionCircleOutlined, SearchOutlined } from '@antdv-next/icons'
import type { TableColumnsType } from 'antdv-next'
import type { UnitRow } from '../store'

const props = defineProps<{
  rows: UnitRow[]
}>()

const emit = defineEmits<{
  locate: [nodeId: string]
}>()

const keyword = ref('')

/** 单元数量可能较多，列表内分页；不因只有一页而隐藏，分页入口需始终可见 */
const pagination = {
  size: 'small' as const,
  pageSize: 20,
  pageSizeOptions: ['10', '20', '50', '100'],
  showSizeChanger: true,
  showTotal: (total: number) => `共 ${total} 条`,
}

const filteredRows = computed(() => {
  const value = keyword.value.trim().toLowerCase()
  if (!value) return props.rows
  return props.rows.filter(
    (row) => row.name.toLowerCase().includes(value) || row.unitCode.toLowerCase().includes(value),
  )
})

/**
 * 列宽按比例分配，避免仅末列吸收全部剩余宽度导致「一张大表配一条长空白」；
 * GPS 坐标与所属组织节点为长文本，不设 ellipsis，由单元格内折行完整展示
 */
const columns: TableColumnsType<UnitRow> = [
  { title: '名称', dataIndex: 'name', key: 'name', width: '16%', ellipsis: true },
  { title: '用能单元编码', dataIndex: 'unitCode', key: 'unitCode', width: '20%' },
  { title: 'GPS 坐标', dataIndex: 'coordinate', key: 'coordinate', width: '26%' },
  { title: '所属组织节点', dataIndex: 'orgPath', key: 'orgPath' },
]
</script>
