<template>
  <!--
    作用用电单元清单：策略详情（OVERLAY-03）与作用对象抽屉（OVERLAY-05）共用同一套呈现，
    保证两处风格一致。
    【原型说明】单元数可达数十个：按所属组织节点分组（上级路径只出现一次）；
    折叠态只铺开能完整容纳的组织节点，其余收口并给「展开全部」，避免把分组切一半。
  -->
  <div class="lst-units-wrap">
    <div class="lst-units-body" :class="{ 'is-clipped': clipped }">
      <div class="lst-units" :style="bodyStyle">
        <div
          v-for="(group, index) in groups"
          :key="group.key"
          :ref="(el) => setGroupEl(el, index)"
          class="lst-units__group"
        >
          <span class="lst-units__head">
            <span class="lst-units__path" :title="group.path">{{ group.path }}</span>
            <span class="lst-units__count">{{ group.units.length }} 个</span>
            <span v-if="hasInvalid(group)" class="lst-units__warn">含失效单元</span>
          </span>
          <span class="lst-units__chips">
            <span
              v-for="unit in group.units"
              :key="unit.unitId"
              class="lst-unit-chip"
              :class="{ 'is-invalid': unit.invalid }"
              :title="unit.invalid ? '该用能单元已失效' : unit.name"
            >{{ unit.name }}</span>
          </span>
        </div>
      </div>
    </div>

    <button v-if="isCollapsed && overflow" type="button" class="lst-units__toggle" @click="toggle">
      展开全部 {{ unitCount }} 个单元
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { ScopeUnitGroup } from '../store'

const props = withDefaults(defineProps<{ groups: ScopeUnitGroup[]; collapsed?: boolean }>(), {
  collapsed: false,
})

/** 折叠态可铺开的高度：只完整展示能放进这个高度的组织节点 */
const COLLAPSE_HEIGHT = 132
/** 与 .lst-units 的 gap 保持一致，用于累计整组高度 */
const GROUP_GAP = 10

const groupEls = ref<HTMLElement[]>([])
const expanded = ref(false)
/** 折叠态可完整展示的组织节点高度合计；null 表示内容不足一屏、无需折叠 */
const fitHeight = ref<number | null>(null)

const unitCount = computed(() => props.groups.reduce((total, group) => total + group.units.length, 0))
const isCollapsed = computed(() => props.collapsed && !expanded.value)
const clipped = computed(() => isCollapsed.value && fitHeight.value !== null)
const overflow = computed(() => fitHeight.value !== null)
const bodyStyle = computed(() => (clipped.value ? { maxHeight: `${fitHeight.value}px` } : undefined))

const hasInvalid = (group: ScopeUnitGroup) => group.units.some((unit) => unit.invalid)

function setGroupEl(el: unknown, index: number) {
  if (el instanceof HTMLElement) groupEls.value[index] = el
}

/** 按「整组」累计高度，取不超过 COLLAPSE_HEIGHT 的最大整数个组织节点 */
function measure() {
  const heights = groupEls.value.filter(Boolean).map((el) => el.offsetHeight)
  if (!heights.length) {
    fitHeight.value = null
    return
  }
  let total = heights[0]
  let count = 1
  for (let i = 1; i < heights.length; i += 1) {
    const next = total + GROUP_GAP + heights[i]
    if (next > COLLAPSE_HEIGHT) break
    total = next
    count += 1
  }
  // 全部组织节点都能放进折叠高度时，不需要收口
  fitHeight.value = count >= heights.length ? null : total
}

async function refresh() {
  expanded.value = false
  await nextTick()
  measure()
}

function toggle() {
  expanded.value = true
}

watch(() => props.groups, refresh, { deep: true })

onMounted(async () => {
  window.addEventListener('resize', refresh)
  await nextTick()
  measure()
})

onBeforeUnmount(() => window.removeEventListener('resize', refresh))
</script>
