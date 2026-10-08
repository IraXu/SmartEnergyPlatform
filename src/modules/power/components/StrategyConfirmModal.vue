<template>
  <!-- OVERLAY-02 保存确认（新建与编辑共用） -->
  <a-modal
    v-model:open="visible"
    title="确认保存策略"
    :width="520"
    :mask-closable="false"
    :closable="!submitting"
    :keyboard="!submitting"
    ok-text="确认保存"
    cancel-text="返回修改"
    :ok-button-props="{ loading: submitting }"
    @ok="handleOk"
  >
    <div v-if="input" class="lst-confirm">
      <!-- 配置复述：完整配置而非差异（拉闸风险不因「这是修改」而降低） -->
      <div class="lst-confirm__block">
        <div v-for="row in rows" :key="row.label" class="lst-confirm__row">
          <span class="lst-confirm__label">{{ row.label }}</span>
          <span class="lst-confirm__value">
            <template v-for="(segment, index) in row.segments" :key="index">
              <strong
                v-if="segment.action"
                class="lst-action"
                :class="segment.action === '拉闸' ? 'lst-action--close' : 'lst-action--open'"
              >{{ segment.text }}</strong>
              <strong v-else-if="segment.strong" class="lst-confirm__num">{{ segment.text }}</strong>
              <span v-else>{{ segment.text }}</span>
            </template>
          </span>
        </div>
      </div>

      <div class="lst-confirm__danger">
        拉闸将直接切断所选设备回路的供电，可能导致生产中断或数据丢失；合闸将恢复供电，请确认现场无人检修。
      </div>

      <!-- 同刻矛盾配置提示：不阻止保存，按拉闸优先执行 -->
      <div v-if="conflictPoint" class="lst-confirm__warn">
        检测到同一时间点配置了拉闸与合闸，将按「拉闸优先」执行。
      </div>
    </div>
  </a-modal>
</template>

<script setup lang="ts">
/**
 * OVERLAY-02 保存确认
 * 【原型说明】复述完整配置（触发方式、周期 / 触发事件、动作、作用用电单元、作用设备数与生效期），
 * 并固定展示拉闸风险提示；作用设备留空时必须回显解析出的实际设备台数。
 * 同刻矛盾配置（同一时间点同时含拉闸与合闸）给出「拉闸优先」提示，但不阻止保存。
 */
import { computed, ref, watch } from 'vue'
import {
  effectiveRangeText,
  resolveScopeDevices,
  sortTimePoints,
  summarySegments,
  unitPath,
  weekdayText,
  type ActionType,
  type StrategyInput,
} from '../store'

const props = defineProps<{
  open: boolean
  /** 待保存的策略配置；为 null 时不渲染内容 */
  input: StrategyInput | null
}>()

const emit = defineEmits<{
  'update:open': [boolean]
  confirm: []
}>()

const visible = computed({
  get: () => props.open,
  set: (value: boolean) => emit('update:open', value),
})

const submitting = ref(false)

watch(
  () => props.open,
  (open) => {
    if (open) submitting.value = false
  },
)

type Segment = { text: string; action?: ActionType; strong?: boolean }

/** 配置复述行：标签 + 片段数组（动作词着色、计数加粗） */
const rows = computed(() => {
  const input = props.input
  if (!input) return [] as Array<{ label: string; segments: Segment[] }>

  const triggerRow: { label: string; segments: Segment[] } = {
    label: '触发方式',
    segments: [{ text: input.triggerType }],
  }

  const conditionRow: { label: string; segments: Segment[] } =
    input.triggerType === '时控'
      ? { label: '周期与动作', segments: timeControlSegments(input) }
      : {
          label: '触发规则',
          segments: [
            ...summarySegments(input),
            { text: `｜命中后延时 ${input.delay} 分钟执行` },
          ],
        }

  /** 作用对象：单元数 · 设备数（设备数按当前解析结果统计） */
  const scopeSegments: Segment[] = [
    { text: `${input.unitIds.length}`, strong: true },
    { text: ' 个单元 · ' },
    { text: `${resolveScopeDevices({ unitIds: input.unitIds, deviceIds: input.deviceIds }).length}`, strong: true },
    { text: input.deviceIds.length ? ' 个设备（指定）' : ' 个设备（单元下全部设备）' },
  ]

  return [
    { label: '策略名称', segments: [{ text: input.name.trim() || '—' }] },
    triggerRow,
    conditionRow,
    { label: '作用对象', segments: scopeSegments },
    {
      label: '作用用电单元',
      segments: [{ text: input.unitIds.length ? input.unitIds.map((id) => unitPath(id)).join('；') : '—' }],
    },
    { label: '生效期', segments: [{ text: effectiveRangeText(input) }] },
  ]
})

/** 时控的周期与动作片段：周期名 + 时间点摘要（动作词着色） */
function timeControlSegments(input: StrategyInput): Segment[] {
  return [...cycleSegments(input), ...summarySegments(input)]
}

/** 周期描述片段（时控） */
function cycleSegments(input: StrategyInput): Segment[] {
  if (input.cycleType === '按周') return [{ text: `按周 · ${weekdayText(input.weekdays)}｜` }]
  if (input.cycleType === '一次性') return [{ text: `一次性 · ${input.onceDate || '—'}｜` }]
  return [{ text: '按日｜' }]
}

/** 是否存在同一时间点同时配置拉闸与合闸（时控） */
const conflictPoint = computed(() => {
  const input = props.input
  if (!input || input.triggerType !== '时控') return false
  const sorted = sortTimePoints(input.timePoints)
  const groups = new Map<string, Set<ActionType>>()
  sorted.forEach((item) => {
    const actions = groups.get(item.time) ?? new Set<ActionType>()
    actions.add(item.action)
    groups.set(item.time, actions)
  })
  return Array.from(groups.values()).some((actions) => actions.size > 1)
})

function handleOk() {
  submitting.value = true
  emit('confirm')
}

/** 父组件在保存结束后回调，关闭 loading */
defineExpose({
  finish() {
    submitting.value = false
  },
})
</script>
