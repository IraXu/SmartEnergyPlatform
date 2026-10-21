<!--
  【原型说明】设备数据分析的对比设备选择器（适配大规模设备）：
  - 主区只展示已选设备标签与入口，不再把所有设备塞进一个下拉；
  - 点击「选择设备」打开弹窗，按设备名称 / License / IMEI 搜索，按用能单元过滤，分页勾选；
  - 跨页保留已选，最多对比 10 台；标签颜色与曲线系列一一对应。
-->
<template>
  <section class="device-compare" aria-label="对比设备">
    <div class="device-compare__head">
      <div class="device-compare__title">
        对比设备
        <span class="device-compare__count">已选 {{ modelValue.length }} / {{ max }}</span>
      </div>
      <div class="device-compare__actions">
        <a-button type="primary" size="small" :disabled="!options.length" @click="openPicker">
          <template #icon><PlusOutlined /></template>
          选择设备
        </a-button>
        <a-button size="small" :disabled="!modelValue.length" @click="clearAll">清空</a-button>
      </div>
    </div>

    <div v-if="modelValue.length" class="device-compare__selected">
      <span v-for="value in visibleTags" :key="value" class="device-compare__tag">
        <i class="device-compare__dot" :style="{ background: colorOf(value) }" />
        <span class="device-compare__tag-label" :title="labelOf(value)">{{ labelOf(value) }}</span>
        <CloseOutlined class="device-compare__close" @click="removeDevice(value)" />
      </span>
      <button v-if="hiddenCount" type="button" class="device-compare__more" @click="openPicker">
        +{{ hiddenCount }} 台
      </button>
    </div>
    <p v-else class="device-compare__empty">
      {{ options.length ? '尚未选择对比设备' : '请先在左侧选择用能单元' }}
    </p>

    <p class="device-compare__hint">
      支持按设备名称 / License / IMEI 搜索并分页勾选；同一指标下按设备对比，最多选择 {{ max }} 台。
    </p>

    <a-modal
      v-model:open="pickerOpen"
      title="选择对比设备"
      :width="960"
      :ok-text="`确定（${draft.length}/${max}）`"
      cancel-text="取消"
      :ok-button-props="{ disabled: !draft.length }"
      @ok="confirmPicker"
      @cancel="cancelPicker"
    >
      <div class="device-picker">
        <div class="device-picker__filters">
          <a-input
            v-model:value="keyword"
            class="device-picker__search"
            allow-clear
            placeholder="搜索设备名称 / License / IMEI"
          >
            <template #prefix><SearchOutlined class="device-picker__search-icon" /></template>
          </a-input>
          <a-select
            v-model:value="unitFilter"
            class="device-picker__unit"
            allow-clear
            placeholder="全部用能单元"
            :options="unitOptions"
          />
        </div>

        <div class="device-picker__meta">
          <span>共 {{ filteredOptions.length }} 台设备 · 已选 {{ draft.length }} / {{ max }}</span>
          <div class="device-picker__quick">
            <a-button type="link" size="small" :disabled="!pagedOptions.length" @click="selectCurrentPage">
              全选当前页
            </a-button>
            <a-button type="link" size="small" :disabled="!draft.length" @click="clearDraft">
              清空已选
            </a-button>
          </div>
        </div>

        <a-table
          size="small"
          row-key="value"
          :columns="columns"
          :data-source="pagedOptions"
          :pagination="false"
          :row-selection="rowSelection"
          :scroll="{ y: 340 }"
          :locale="{ emptyText: '未找到匹配的设备' }"
        />

        <div class="device-picker__pager">
          <span class="device-picker__range">{{ rangeText }}</span>
          <a-pagination
            v-model:current="page"
            size="small"
            :page-size="PAGE_SIZE"
            :total="filteredOptions.length"
            :show-size-changer="false"
          />
        </div>

        <p v-if="draft.length >= max" class="device-picker__tip">
          已选满 {{ max }} 台，取消部分设备后可继续选择。
        </p>
        <div v-else-if="draft.length" class="device-picker__selected">
          <span class="device-picker__selected-title">已选设备</span>
          <span v-for="value in draft" :key="value" class="device-picker__chip">
            <i class="device-compare__dot" :style="{ background: colorOfDraft(value) }" />
            {{ labelOf(value) }}
            <CloseOutlined class="device-compare__close" @click="removeDraft(value)" />
          </span>
        </div>
      </div>
    </a-modal>
  </section>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { message } from 'antdv-next'
import { CloseOutlined, PlusOutlined, SearchOutlined } from '@antdv-next/icons'
import { DEVICE_COMPARE_COLORS } from '../store/constants'

interface DeviceCompareOption {
  value: string
  label: string
  unitName: string
  license: string
  imei: string
}

const props = withDefaults(
  defineProps<{
    modelValue: string[]
    options: DeviceCompareOption[]
    max?: number
  }>(),
  { max: 10 },
)

const emit = defineEmits<{ (event: 'update:modelValue', value: string[]): void }>()

/** 主区标签最多展示数量；超出部分折叠为「+N 台」 */
const MAX_VISIBLE_TAGS = 4
const PAGE_SIZE = 10

const pickerOpen = ref(false)
const keyword = ref('')
const unitFilter = ref<string | undefined>(undefined)
const page = ref(1)
const draft = ref<string[]>([])

const visibleTags = computed(() => props.modelValue.slice(0, MAX_VISIBLE_TAGS))
const hiddenCount = computed(() => Math.max(props.modelValue.length - MAX_VISIBLE_TAGS, 0))

/** 用能单元筛选：只列出当前范围内实际挂有设备的用能单元（组织节点不挂设备） */
const unitOptions = computed(() => {
  const counts = new Map<string, number>()
  props.options.forEach((option) => counts.set(option.unitName, (counts.get(option.unitName) ?? 0) + 1))
  return [...counts.entries()].map(([name, count]) => ({
    label: `${name}（${count} 台）`,
    value: name,
  }))
})

const filteredOptions = computed(() => {
  const text = keyword.value.trim().toLowerCase()
  return props.options.filter((option) => {
    if (unitFilter.value && option.unitName !== unitFilter.value) return false
    if (!text) return true
    return [option.label, option.license, option.imei]
      .some((field) => field.toLowerCase().includes(text))
  })
})

const pagedOptions = computed(() => {
  const start = (page.value - 1) * PAGE_SIZE
  return filteredOptions.value.slice(start, start + PAGE_SIZE)
})

const rangeText = computed(() => {
  const total = filteredOptions.value.length
  if (!total) return '共 0 条'
  const start = (page.value - 1) * PAGE_SIZE + 1
  const end = Math.min(page.value * PAGE_SIZE, total)
  return `第 ${start}–${end} 条 / 共 ${total} 条`
})

watch([keyword, unitFilter], () => {
  page.value = 1
})

watch(
  () => filteredOptions.value.length,
  (total) => {
    const maxPage = Math.max(1, Math.ceil(total / PAGE_SIZE))
    if (page.value > maxPage) page.value = maxPage
  },
)

const columns = [
  { title: '设备名称', dataIndex: 'label', key: 'label', ellipsis: true },
  { title: '所属用能单元', dataIndex: 'unitName', key: 'unitName', width: 190, ellipsis: true },
  { title: 'License', dataIndex: 'license', key: 'license', width: 190, ellipsis: true },
  { title: 'IMEI', dataIndex: 'imei', key: 'imei', width: 170, ellipsis: true },
]

/** 表格勾选：跨页保留已选，并保留勾选顺序用于曲线配色 */
const rowSelection = computed(() => ({
  selectedRowKeys: draft.value,
  onSelect: (record: DeviceCompareOption, selected: boolean) => {
    if (selected) {
      if (draft.value.includes(record.value)) return
      if (draft.value.length >= props.max) {
        message.warning(`最多同时对比 ${props.max} 台设备`)
        return
      }
      draft.value = [...draft.value, record.value]
      return
    }
    draft.value = draft.value.filter((value) => value !== record.value)
  },
  onSelectAll: (selected: boolean, selectedRows: DeviceCompareOption[]) => {
    const rows = selectedRows?.length ? selectedRows : pagedOptions.value
    if (!selected) {
      const removing = new Set(rows.map((row) => row.value))
      draft.value = draft.value.filter((value) => !removing.has(value))
      return
    }
    const remaining = props.max - draft.value.length
    if (remaining <= 0) {
      message.warning(`最多同时对比 ${props.max} 台设备`)
      return
    }
    const additions = rows
      .map((row) => row.value)
      .filter((value) => !draft.value.includes(value))
    if (additions.length > remaining) {
      draft.value = [...draft.value, ...additions.slice(0, remaining)]
      message.warning(`本页设备较多，已选择前 ${props.max} 台`)
      return
    }
    draft.value = [...draft.value, ...additions]
  },
  getCheckboxProps: (record: DeviceCompareOption) => ({
    disabled: !draft.value.includes(record.value) && draft.value.length >= props.max,
  }),
}))

/** 按选择顺序分配颜色，与图表系列保持一致 */
function colorOf(value: string) {
  const index = props.modelValue.indexOf(value)
  return DEVICE_COMPARE_COLORS[(index < 0 ? 0 : index) % DEVICE_COMPARE_COLORS.length]
}

function colorOfDraft(value: string) {
  const index = draft.value.indexOf(value)
  return DEVICE_COMPARE_COLORS[(index < 0 ? 0 : index) % DEVICE_COMPARE_COLORS.length]
}

function labelOf(value: string) {
  return props.options.find((option) => option.value === value)?.label ?? value
}

function openPicker() {
  if (!props.options.length) {
    message.warning('请先在左侧选择用能单元')
    return
  }
  draft.value = [...props.modelValue]
  keyword.value = ''
  unitFilter.value = undefined
  page.value = 1
  pickerOpen.value = true
}

function confirmPicker() {
  emit('update:modelValue', [...draft.value])
  pickerOpen.value = false
}

function cancelPicker() {
  pickerOpen.value = false
}

function removeDraft(value: string) {
  draft.value = draft.value.filter((item) => item !== value)
}

function removeDevice(value: string) {
  emit('update:modelValue', props.modelValue.filter((item) => item !== value))
}

function clearDraft() {
  draft.value = []
}

/** 全选当前页：已选满时不再追加，避免静默丢弃 */
function selectCurrentPage() {
  const remaining = props.max - draft.value.length
  if (remaining <= 0) {
    message.warning(`最多同时对比 ${props.max} 台设备`)
    return
  }
  const additions = pagedOptions.value
    .map((option) => option.value)
    .filter((value) => !draft.value.includes(value))
  if (additions.length > remaining) {
    draft.value = [...draft.value, ...additions.slice(0, remaining)]
    message.warning(`本页设备较多，已选择前 ${props.max} 台`)
    return
  }
  draft.value = [...draft.value, ...additions]
}

function clearAll() {
  emit('update:modelValue', [])
}
</script>

<style scoped>
.device-compare {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 14px 16px;
  background: #fff;
  border: 1px solid #eef2f1;
  border-radius: 10px;
}

.device-compare__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.device-compare__title {
  display: inline-flex;
  align-items: baseline;
  gap: 8px;
  font-size: 13px;
  font-weight: 600;
  color: rgba(0, 0, 0, 0.88);
}

.device-compare__count {
  font-size: 12px;
  font-weight: 400;
  color: rgba(0, 0, 0, 0.45);
}

.device-compare__actions {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.device-compare__selected {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  min-height: 24px;
}

.device-compare__tag {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 24px;
  padding: 0 7px;
  font-size: 12px;
  line-height: 22px;
  color: rgba(0, 0, 0, 0.72);
  background: #f7fbfa;
  border: 1px solid #dceae6;
  border-radius: 4px;
}

.device-compare__tag-label {
  max-width: 220px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.device-compare__close {
  font-size: 10px;
  color: rgba(0, 0, 0, 0.45);
  cursor: pointer;
}

.device-compare__close:hover {
  color: rgba(0, 0, 0, 0.88);
}

.device-compare__dot {
  display: inline-block;
  flex: none;
  width: 7px;
  height: 7px;
  border-radius: 50%;
}

.device-compare__more {
  height: 24px;
  padding: 0 8px;
  font: inherit;
  font-size: 12px;
  color: rgba(0, 0, 0, 0.55);
  cursor: pointer;
  background: #f7fbfa;
  border: 1px dashed #dceae6;
  border-radius: 4px;
}

.device-compare__more:hover {
  color: #0f7b6c;
  border-color: #0f7b6c;
}

.device-compare__empty {
  margin: 0;
  font-size: 12px;
  line-height: 18px;
  color: rgba(0, 0, 0, 0.45);
}

.device-compare__hint {
  margin: 0;
  font-size: 12px;
  line-height: 18px;
  color: rgba(0, 0, 0, 0.45);
}

/* ---------- 设备选择弹窗 ---------- */
.device-picker {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.device-picker__filters {
  display: flex;
  gap: 8px;
}

.device-picker__search {
  flex: 1 1 auto;
}

.device-picker__search-icon {
  color: rgba(0, 0, 0, 0.45);
}

.device-picker__unit {
  flex: none;
  width: 220px;
}

.device-picker__meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  font-size: 12px;
  color: rgba(0, 0, 0, 0.45);
}

.device-picker__quick {
  display: inline-flex;
  gap: 2px;
}

.device-picker__pager {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.device-picker__range {
  font-size: 12px;
  color: rgba(0, 0, 0, 0.45);
}

.device-picker__tip {
  margin: 0;
  padding: 6px 10px;
  font-size: 12px;
  color: rgba(0, 0, 0, 0.65);
  background: rgba(250, 173, 20, 0.1);
  border-radius: 6px;
}

.device-picker__selected {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  max-height: 72px;
  overflow-y: auto;
}

.device-picker__selected-title {
  font-size: 12px;
  color: rgba(0, 0, 0, 0.45);
}

.device-picker__chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 24px;
  padding: 0 7px;
  font-size: 12px;
  color: rgba(0, 0, 0, 0.72);
  background: #f7fbfa;
  border: 1px solid #dceae6;
  border-radius: 4px;
}
</style>
