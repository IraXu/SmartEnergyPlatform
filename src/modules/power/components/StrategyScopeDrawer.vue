<template>
  <!-- OVERLAY-05 作用对象（所选用电单元与设备明细） -->
  <a-drawer
    v-model:open="visible"
    placement="right"
    :size="drawerWidth"
    :closable="false"
    :styles="{ body: { padding: 0 } }"
    @close="visible = false"
  >
    <template #title />

    <div v-if="strategy" class="lst-scoped">
      <!-- 头部：模块标识 + 策略名称 + 关闭入口 -->
      <header class="lst-scoped__head">
        <div class="lst-scoped__head-text">
          <span class="lst-scoped__eyebrow">作用对象</span>
          <h3 class="lst-scoped__title" :title="strategy.name">{{ strategy.name }}</h3>
        </div>
        <a-button type="text" size="small" aria-label="关闭" @click="visible = false">
          <template #icon><CloseOutlined /></template>
        </a-button>
      </header>

      <!-- 概览：单元数 · 设备数 + 范围类型 -->
      <div class="lst-scoped__summary">
        <span class="lst-scoped__count">
          <strong>{{ unitCount }}</strong> 个单元 ·
          <strong>{{ scopeDevices.length }}</strong> 个设备
        </span>
        <span class="lst-scoped__kind">{{ isWhole ? '动态范围' : '静态范围' }}</span>
      </div>
      <p class="lst-scoped__hint">
        {{
          isWhole
            ? '作用于所选用电单元（含全部下级）下的全部设备，后续新增设备自动纳入。'
            : '仅作用于已指定的设备，后续新增设备不会自动纳入。'
        }}
      </p>

      <!-- 作用用电单元：与策略详情共用同一组件（分组 + 折叠收口），风格一致 -->
      <section class="lst-scoped__block" aria-label="作用用电单元">
        <div class="lst-scoped__block-head">
          <span class="lst-scoped__block-title">作用用电单元</span>
          <span class="lst-scoped__block-count">{{ unitCount }} 个 · {{ unitGroups.length }} 个组织节点</span>
        </div>
        <StrategyUnitGroups v-if="unitGroups.length" :groups="unitGroups" collapsed />
        <p v-else class="lst-scoped__empty">未选择作用用电单元</p>
      </section>

      <!-- 作用设备：提供所属单元筛选；完整清单分页呈现（数量可达数百台） -->
      <section class="lst-scoped__block lst-scoped__block--table" aria-label="作用设备">
        <div class="lst-scoped__block-head">
          <span class="lst-scoped__block-title">作用设备</span>
          <span class="lst-scoped__block-count">共 {{ scopeDevices.length }} 台</span>
        </div>

        <div v-if="scopeDevices.length" class="lst-scoped__filters">
          <a-select
            v-model:value="filterUnitId"
            class="lst-scoped__filter"
            size="small"
            allow-clear
            show-search
            option-filter-prop="label"
            placeholder="全部用能单元"
            :options="unitFilterOptions"
          />
          <span class="lst-scoped__filter-hint">
            {{ filterUnitId ? `该单元下 ${filteredDevices.length} 台` : '可按用能单元筛选' }}
          </span>
        </div>

        <a-table
          v-if="filteredDevices.length"
          class="lst-scoped__table"
          size="small"
          row-key="id"
          :columns="columns"
          :data-source="filteredDevices"
          :pagination="pagination"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'name'">
              <span class="lst-scoped__name" :title="record.name">{{ record.name }}</span>
            </template>

            <template v-else-if="column.key === 'type'">
              <span v-if="record.type" class="lst-scoped__type">{{ record.type }}</span>
              <span v-else class="lst-scoped__empty-cell">—</span>
            </template>

            <template v-else-if="column.key === 'unit'">
              <span class="lst-scoped__path" :title="unitPath(record.unitId)">{{ unitPath(record.unitId) }}</span>
            </template>

            <template v-else-if="column.key === 'onlineStatus'">
              <span v-if="!record.onlineStatus" class="lst-scoped__empty-cell">—</span>
              <span v-else class="lst-scoped__online" :class="record.onlineStatus === '在线' ? 'is-on' : 'is-off'">
                <i class="lst-scoped__dot-icon" />
                {{ record.onlineStatus }}
              </span>
            </template>
          </template>
        </a-table>

        <p v-else-if="scopeDevices.length" class="lst-scoped__empty">该用能单元下没有设备，试试切换其他单元</p>
        <p v-else class="lst-scoped__empty">所选用电单元下暂无设备，策略暂时不会产生实际动作</p>
      </section>
    </div>

    <div v-else class="lst-scoped__fallback">
      <a-empty description="该策略已被删除" />
      <a-button type="primary" size="small" @click="visible = false">关闭</a-button>
    </div>
  </a-drawer>
</template>

<script setup lang="ts">
/**
 * OVERLAY-05 作用对象
 * 【原型说明】从列表「作用对象」列点击后右侧滑出，只读展示该策略的作用用电单元与设备明细。
 * 作用对象 = 作用用电单元（必选，可多个）+ 作用设备（留空表示所选用电单元下的全部设备）。
 * 列表只展示「N 个单元 · M 个设备」的计数，具体构成在本抽屉内核对。
 */
import { computed, ref, watch } from 'vue'
import type { TableColumnsType } from 'antdv-next'
import { CloseOutlined } from '@antdv-next/icons'
import {
  getStrategy,
  groupScopeUnits,
  isWholeScope,
  resolveScopeDevices,
  unitPath,
  unitShortPath,
} from '../store'
import type { Device } from '@/modules/device/store'
import StrategyUnitGroups from './StrategyUnitGroups.vue'

const props = defineProps<{
  open: boolean
  /** 目标策略标识；为 null 时不渲染内容 */
  strategyId: string | null
}>()

const emit = defineEmits<{ 'update:open': [boolean] }>()

const visible = computed({
  get: () => props.open,
  set: (value: boolean) => emit('update:open', value),
})

/** 抽屉宽度：设备明细列较多，参照设备参数抽屉的宽度区间 */
const drawerWidth = computed(() => Math.min(Math.max(Math.round(window.innerWidth * 0.5), 640), 880))

const strategy = computed(() => (props.strategyId ? getStrategy(props.strategyId) : null))
const isWhole = computed(() => (strategy.value ? isWholeScope(strategy.value) : true))

/** 作用用电单元按所属组织节点分组（上级路径只出现一次） */
const unitGroups = computed(() => groupScopeUnits(strategy.value?.unitIds ?? []))

const unitCount = computed(() => unitGroups.value.reduce((total, group) => total + group.units.length, 0))

const scopeDevices = computed<Device[]>(() => (strategy.value ? resolveScopeDevices(strategy.value) : []))

/** 设备按所属单元筛选：数量可达数百台，逐台翻页找设备不现实 */
const filterUnitId = ref<string | undefined>(undefined)
watch(
  () => props.strategyId,
  () => {
    filterUnitId.value = undefined
  },
)

const unitFilterOptions = computed(() =>
  (strategy.value?.unitIds ?? []).map((unitId) => ({
    label: unitShortPath(unitId),
    value: unitId,
  })),
)

const filteredDevices = computed(() =>
  filterUnitId.value ? scopeDevices.value.filter((device) => device.unitId === filterUnitId.value) : scopeDevices.value,
)

const columns: TableColumnsType<Device> = [
  { title: '设备名称', key: 'name', width: 180 },
  { title: '设备类型', key: 'type', width: 120 },
  { title: '所属用能单元', key: 'unit', width: 220 },
  { title: '在线状态', key: 'onlineStatus', width: 96 },
]

const pagination = { pageSize: 10, size: 'small' as const, showTotal: (total: number) => `共 ${total} 台` }
</script>
