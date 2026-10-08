<template>
  <!-- OVERLAY-01 新建 / 编辑策略 -->
  <a-modal
    v-model:open="visible"
    wrap-class-name="lst-form-modal"
    :title="isEdit ? '编辑策略' : '新建策略'"
    :width="760"
    :mask-closable="false"
    ok-text="保存"
    cancel-text="取消"
    @ok="handleSave"
    @cancel="handleCancel"
  >
    <div class="lst-form">
      <!-- 编辑态：只读展示被编辑对象的创建信息，便于核对 -->
      <p v-if="isEdit && editing" class="lst-form__meta">
        创建人 {{ editing.createdBy }} · 创建于 {{ formatTime(editing.createdAt) }}
      </p>

      <a-form layout="vertical">
        <!-- ---------- 基本信息 ---------- -->
        <section class="lst-form__section">
          <h4 class="lst-form__section-title">基本信息</h4>
          <div class="lst-form__grid">
            <a-form-item
              label="策略名称"
              required
              :validate-status="errors.name ? 'error' : undefined"
              :help="errors.name ?? undefined"
            >
              <a-input
                v-model:value="draft.name"
                show-count
                :maxlength="STRATEGY_NAME_MAX"
                placeholder="请输入策略名称，如「生产区夜间停机」"
              />
            </a-form-item>

            <a-form-item label="触发方式" required>
              <a-segmented
                v-model:value="draft.triggerType"
                block
                :options="triggerOptions"
                @change="handleTriggerChange"
              />
              <p class="lst-form__hint">
                {{
                  draft.triggerType === '时控'
                    ? '按周期与时间点自动拉合闸'
                    : '命中指定告警事件时执行对应的拉闸 / 合闸动作'
                }}
              </p>
            </a-form-item>
          </div>

          <!-- 切换触发方式会清空原触发配置：就地提示并让用户确认，不弹出独立弹窗打断填写 -->
          <div v-if="pendingTrigger" class="lst-switch">
            <ExclamationCircleOutlined class="lst-switch__icon" />
            <div class="lst-switch__text">
              <p class="lst-switch__title">切换为「{{ pendingTrigger }}」将清空已有触发配置</p>
              <p class="lst-switch__desc">{{ pendingTriggerDesc }}</p>
            </div>
            <div class="lst-switch__actions">
              <a-button size="small" type="primary" @click="confirmTriggerSwitch">继续切换</a-button>
              <a-button size="small" @click="cancelSwitch">取消</a-button>
            </div>
          </div>
        </section>

        <!-- ---------- 触发配置：时控 ---------- -->
        <section v-if="draft.triggerType === '时控'" class="lst-form__section">
          <h4 class="lst-form__section-title">周期与时间点</h4>

          <a-form-item
            label="周期类型"
            required
            :validate-status="errors.cycleType ? 'error' : undefined"
            :help="errors.cycleType ?? undefined"
          >
            <a-segmented
              v-model:value="draft.cycleType"
              block
              :options="cycleOptions"
              @change="handleCycleChange"
            />
          </a-form-item>

          <!-- 切换周期类型会清空时间点：同样就地提示 -->
          <div v-if="pendingCycle" class="lst-switch">
            <ExclamationCircleOutlined class="lst-switch__icon" />
            <div class="lst-switch__text">
              <p class="lst-switch__title">切换为「{{ pendingCycle }}」将清空已配置的时间点</p>
              <p class="lst-switch__desc">周期改变后原时间点不再适用，需要按新周期重新配置。</p>
            </div>
            <div class="lst-switch__actions">
              <a-button size="small" type="primary" @click="confirmCycleSwitch">继续切换</a-button>
              <a-button size="small" @click="cancelSwitch">取消</a-button>
            </div>
          </div>

          <a-form-item
            v-if="draft.cycleType === '按周'"
            label="星期"
            required
            :validate-status="errors.weekdays ? 'error' : undefined"
            :help="errors.weekdays ?? undefined"
          >
            <!-- 按钮块平铺：7 项一次看全，选中态实心高亮，点选 / 再点取消 -->
            <div class="lst-weekdays">
              <button
                v-for="day in weekdayOptions"
                :key="day.value"
                type="button"
                class="lst-weekdays__item"
                :class="{ 'is-on': draft.weekdays.includes(day.value) }"
                :aria-pressed="draft.weekdays.includes(day.value)"
                @click="toggleWeekday(day.value)"
              >{{ day.label }}</button>
            </div>
          </a-form-item>

          <a-form-item
            v-if="draft.cycleType === '一次性'"
            label="执行日期"
            required
            :validate-status="errors.onceDate ? 'error' : undefined"
            :help="errors.onceDate ?? undefined"
          >
            <a-date-picker
              :value="toDayjs(draft.onceDate)"
              class="lst-form__control"
              placeholder="请选择执行日期"
              @change="(value: Dayjs | null) => (draft.onceDate = fromDayjs(value))"
            />
          </a-form-item>

          <a-form-item
            label="时间点"
            required
            :validate-status="errors.timePoints || errors.duplicatePoint ? 'error' : undefined"
            :help="errors.timePoints ?? errors.duplicatePoint ?? undefined"
          >
            <div class="lst-points">
              <div v-for="(point, index) in draft.timePoints" :key="point.id" class="lst-points__row">
                <span class="lst-points__index">{{ index + 1 }}</span>
                <a-time-picker
                  :value="clockToDayjs(point.time)"
                  format="HH:mm"
                  placeholder="选择时间"
                  class="lst-points__time"
                  @change="(value: Dayjs | null) => (point.time = dayjsToClock(value))"
                />
                <div class="lst-points__action">
                  <button
                    v-for="option in actionOptions"
                    :key="option.value"
                    type="button"
                    class="lst-action-btn"
                    :class="[
                      option.value === '拉闸' ? 'lst-action-btn--close' : 'lst-action-btn--open',
                      { 'is-on': point.action === option.value },
                    ]"
                    :aria-pressed="point.action === option.value"
                    @click="point.action = option.value"
                  >{{ option.label }}</button>
                </div>
                <span class="lst-points__spacer" />
                <a-button
                  type="text"
                  danger
                  size="small"
                  class="lst-points__del"
                  aria-label="删除该时间点"
                  @click="removePoint(point.id)"
                >
                  <template #icon><DeleteOutlined /></template>
                </a-button>
              </div>

              <p v-if="!draft.timePoints.length" class="lst-points__empty">
                还没有时间点，点「添加时间点」配置拉闸 / 合闸动作
              </p>

              <div class="lst-points__foot">
                <a-button size="small" :disabled="draft.timePoints.length >= TIME_POINT_MAX" @click="addPoint">
                  <template #icon><PlusOutlined /></template>
                  添加时间点
                </a-button>
                <span class="lst-points__count">{{ draft.timePoints.length }} / {{ TIME_POINT_MAX }}</span>
              </div>

              <p class="lst-points__note">
                时间点按自然日判断，不跨日顺延。如需「22:00 拉闸、次日 07:00 合闸」，添加这两条时间点即可。
              </p>
            </div>
          </a-form-item>
        </section>

        <!-- ---------- 触发配置：负控 ---------- -->
        <section v-else class="lst-form__section">
          <h4 class="lst-form__section-title">触发规则</h4>

          <a-form-item
            label="事件与动作"
            required
            :validate-status="errors.eventRules || errors.duplicateEvent ? 'error' : undefined"
            :help="errors.eventRules ?? errors.duplicateEvent ?? undefined"
          >
            <div class="lst-rules">
              <!-- 每条规则 = 一个触发事件 + 命中后执行的动作，成对配置便于逐条核对 -->
              <div v-for="(item, index) in draft.eventRules" :key="item.id" class="lst-rules__row">
                <span class="lst-rules__index">{{ index + 1 }}</span>
                <a-select
                  v-model:value="item.event"
                  class="lst-rules__event"
                  show-search
                  placeholder="选择触发事件"
                  :options="eventGroups"
                  option-filter-prop="label"
                />
                <span class="lst-rules__label" aria-hidden="true">执行</span>
                <div class="lst-rules__action">
                  <button
                    v-for="option in actionOptions"
                    :key="option.value"
                    type="button"
                    class="lst-action-btn"
                    :class="[
                      option.value === '拉闸' ? 'lst-action-btn--close' : 'lst-action-btn--open',
                      { 'is-on': item.action === option.value },
                    ]"
                    :aria-pressed="item.action === option.value"
                    @click="item.action = option.value"
                  >{{ option.label }}</button>
                </div>
                <a-button
                  type="text"
                  danger
                  size="small"
                  class="lst-rules__del"
                  aria-label="删除该规则"
                  @click="removeRule(item.id)"
                >
                  <template #icon><DeleteOutlined /></template>
                </a-button>
              </div>

              <p v-if="!draft.eventRules.length" class="lst-rules__empty">
                还没有触发规则，点「添加规则」配置「命中什么事件、执行什么动作」
              </p>

              <div class="lst-rules__foot">
                <a-button size="small" :disabled="draft.eventRules.length >= EVENT_RULE_MAX" @click="addRule">
                  <template #icon><PlusOutlined /></template>
                  添加规则
                </a-button>
                <span class="lst-rules__count">{{ draft.eventRules.length }} / {{ EVENT_RULE_MAX }}</span>
              </div>

              <p class="lst-rules__note">
                每条规则相互独立：命中该事件即执行对应动作。同一事件只能配置一条规则。
              </p>
            </div>
          </a-form-item>

          <a-form-item
            label="执行延时"
            :validate-status="errors.delay ? 'error' : undefined"
            :help="errors.delay ?? undefined"
          >
            <a-input-number
              v-model:value="draft.delay"
              class="lst-form__control"
              :min="DELAY_MIN"
              :max="DELAY_MAX"
              :precision="0"
            >
              <template #suffix>分钟</template>
            </a-input-number>
            <p class="lst-form__hint">命中事件后延时下发动作，用于过滤瞬时抖动；0 表示立即执行</p>
          </a-form-item>
        </section>

        <!-- ---------- 作用对象 ---------- -->
        <section class="lst-form__section">
          <h4 class="lst-form__section-title">作用对象</h4>

          <a-form-item
            label="作用用电单元"
            required
            :validate-status="errors.unitIds ? 'error' : undefined"
            :help="errors.unitIds ?? undefined"
          >
            <a-tree-select
              v-model:value="draft.unitIds"
              multiple
              show-search
              allow-clear
              tree-checkable
              tree-default-expand-all
              max-tag-count="responsive"
              placeholder="请选择作用的用电单元"
              :tree-data="unitTree"
              :field-names="{ label: 'title', value: 'value', children: 'children' }"
              :styles="{ popup: { root: { maxHeight: '320px', overflow: 'auto' } } }"
              @change="handleUnitChange"
            />
            <p class="lst-form__hint">只能选择用能单元；组织节点仅作路径展示，不可作为作用对象</p>
          </a-form-item>

          <!-- 作用设备：下拉多选，候选项按「所属用能单元」分组，同名设备不至于混淆 -->
          <a-form-item label="作用设备">
            <a-select
              v-model:value="draft.deviceIds"
              mode="multiple"
              show-search
              allow-clear
              max-tag-count="responsive"
              :disabled="!draft.unitIds.length"
              :placeholder="draft.unitIds.length ? '留空表示作用于所选用电单元下的全部设备' : '请先选择作用的用电单元'"
              :options="deviceOptions"
              option-filter-prop="label"
              :classes="{ popup: { root: 'lst-device-pop' } }"
              :styles="{ popup: { root: { minWidth: '420px' } } }"
            >
              <!-- 候选项只呈现设备名与必要提示；所属单元已由分组标题表达，不再逐行重复 -->
              <template #optionRender="{ option }">
                <div class="lst-opt">
                  <span class="lst-opt__name" :title="option.data.name">{{ option.data.name }}</span>
                  <span v-if="option.data.abnormal" class="lst-opt__warn">{{ option.data.abnormal }}</span>
                </div>
              </template>
            </a-select>
            <p class="lst-form__hint">
              {{
                draft.deviceIds.length
                  ? `仅作用于已选中的 ${draft.deviceIds.length} 台设备（静态范围），后续新增设备不会自动纳入。`
                  : '作用于所选用电单元下的全部设备（含后续新增），为动态范围。'
              }}
            </p>
          </a-form-item>

          <div class="lst-form__summary">
            <span class="lst-form__summary-label">作用对象</span>
            <span class="lst-form__summary-value">
              <strong>{{ draft.unitIds.length }}</strong> 个单元 ·
              <strong>{{ scope.total }}</strong> 个设备
            </span>
            <span class="lst-form__summary-kind">{{ draft.deviceIds.length ? '静态范围' : '动态范围' }}</span>
            <span v-if="scope.pending || scope.offline" class="lst-form__summary-warn">
              其中 {{ scope.pending }} 台待接入、{{ scope.offline }} 台离线
            </span>
          </div>
          <p v-if="draft.unitIds.length && !scope.total" class="lst-form__warn">
            所选用电单元下暂无设备，策略暂时不会产生实际动作
          </p>
        </section>

        <!-- ---------- 生效期与备注 ---------- -->
        <section class="lst-form__section">
          <h4 class="lst-form__section-title">生效期与备注</h4>
          <div class="lst-form__grid">
            <a-form-item label="生效开始日期" required>
              <a-date-picker
                :value="toDayjs(draft.startDate)"
                class="lst-form__control"
                placeholder="请选择生效开始日期"
                @change="(value: Dayjs | null) => (draft.startDate = fromDayjs(value))"
              />
            </a-form-item>

            <a-form-item
              label="生效结束日期"
              :validate-status="errors.dateRange ? 'error' : undefined"
              :help="errors.dateRange ?? undefined"
            >
              <a-date-picker
                :value="toDayjs(draft.endDate)"
                class="lst-form__control"
                allow-clear
                placeholder="留空表示长期有效"
                @change="(value: Dayjs | null) => (draft.endDate = fromDayjs(value))"
              />
            </a-form-item>
          </div>

          <a-form-item label="备注">
            <a-textarea
              v-model:value="draft.remark"
              :rows="3"
              show-count
              :maxlength="STRATEGY_REMARK_MAX"
              placeholder="补充说明该策略的用途或现场注意事项"
            />
          </a-form-item>
        </section>
      </a-form>
    </div>
  </a-modal>
</template>

<script setup lang="ts">
/**
 * OVERLAY-01 新建 / 编辑策略
 * 【原型说明】按触发方式动态呈现配置区：时控（周期类型 + 时间点）与负控（事件 + 动作规则 + 执行延时）。
 * 切换触发方式或周期类型时二次确认并清空原触发配置（避免残留配置产生歧义）；
 * 作用对象 = 作用用电单元（必选）+ 作用设备（留空表示所选用电单元下的全部设备，动态范围）。
 * 保存前统一经过 OVERLAY-02 确认（由父组件承载），本组件只负责表单与校验。
 */
import { computed, reactive, ref, watch } from 'vue'
import { message } from 'antdv-next'
import type { Dayjs } from 'dayjs'
import dayjs from 'dayjs'
import { DeleteOutlined, ExclamationCircleOutlined, PlusOutlined } from '@antdv-next/icons'
import { eventTypeGroups } from '@/modules/alarm/store'
import {
  ACTION_OPTIONS,
  CYCLE_TYPE_OPTIONS,
  DELAY_MAX,
  DELAY_MIN,
  EVENT_RULE_MAX,
  STRATEGY_NAME_MAX,
  STRATEGY_REMARK_MAX,
  TIME_POINT_MAX,
  TRIGGER_TYPE_OPTIONS,
  WEEKDAY_OPTIONS,
  formatTime,
  getStrategy,
  hasFormError,
  sanitizeUnitIds,
  scopeStats,
  selectableDevices,
  sortTimePoints,
  todayText,
  unitShortPath,
  unitCheckTreeData,
  validateStrategy,
  type ActionType,
  type CycleType,
  type EventRule,
  type Strategy,
  type StrategyFormErrors,
  type StrategyInput,
  type TriggerType,
} from '../store'

const props = defineProps<{
  open: boolean
  /** 编辑时的策略标识；为 null 表示新建 */
  strategyId: string | null
}>()

const emit = defineEmits<{
  'update:open': [boolean]
  /** 校验通过后交付父组件，由父组件打开保存确认弹窗 */
  save: [input: StrategyInput]
}>()

const visible = computed({
  get: () => props.open,
  set: (value: boolean) => emit('update:open', value),
})

const isEdit = computed(() => Boolean(props.strategyId))
const editing = computed(() => (props.strategyId ? getStrategy(props.strategyId) : null))

const triggerOptions = TRIGGER_TYPE_OPTIONS.map((value) => ({ label: value, value }))
const cycleOptions = CYCLE_TYPE_OPTIONS.map((value) => ({ label: value, value }))
const actionOptions = ACTION_OPTIONS.map((value) => ({ label: value, value }))
const weekdayOptions = WEEKDAY_OPTIONS.map((item) => ({ label: item.label, value: item.value }))
const eventGroups = computed(() => eventTypeGroups())
const unitTree = computed(() => unitCheckTreeData())

/* ---------- 表单草稿 ---------- */

let pointSeq = 0
const newPoint = (time: string, action: ActionType) => ({ id: `TP-${Date.now()}-${++pointSeq}`, time, action })

let ruleSeq = 0
const newRule = (event = '', action: ActionType = '拉闸'): EventRule => ({
  id: `ER-${Date.now()}-${++ruleSeq}`,
  event,
  action,
})

function emptyDraft(): StrategyInput {
  return {
    name: '',
    triggerType: '时控',
    enabled: true,
    cycleType: '按日',
    weekdays: [],
    onceDate: '',
    // 时间点默认留空：由用户按现场需要逐条添加，避免误保存未核对过的默认动作
    timePoints: [],
    eventRules: [],
    delay: 0,
    unitIds: [],
    deviceIds: [],
    startDate: todayText(),
    endDate: '',
    remark: '',
  }
}

const draft = reactive<StrategyInput>(emptyDraft())
const errors = reactive<StrategyFormErrors>({})

/** 待确认的切换目标；为 null 表示当前没有待确认的切换（须在下方 watch 之前声明，watch 为 immediate） */
const pendingTrigger = ref<TriggerType | null>(null)
const pendingCycle = ref<CycleType | null>(null)

/** 切换前的取值记录：切换触发方式 / 周期类型时用于判断是否需清空确认，取消时据此回退 */
let lastTriggerType: TriggerType = '时控'
let lastCycleType: CycleType = '按日'

function clearErrors() {
  ;(Object.keys(errors) as Array<keyof StrategyFormErrors>).forEach((key) => delete errors[key])
}

/** 用既有策略回填草稿（编辑态） */
function fillFromStrategy(strategy: Strategy) {
  Object.assign(draft, {
    name: strategy.name,
    triggerType: strategy.triggerType,
    enabled: strategy.enabled,
    cycleType: strategy.cycleType ?? '按日',
    weekdays: [...strategy.weekdays],
    onceDate: strategy.onceDate,
    timePoints: strategy.timePoints.map((item) => ({ ...item, id: `${item.id}-${Date.now()}-${++pointSeq}` })),
    eventRules: strategy.eventRules.map((item) => ({ ...item, id: `${item.id}-${Date.now()}-${++ruleSeq}` })),
    delay: strategy.delay,
    unitIds: [...strategy.unitIds],
    deviceIds: [...strategy.deviceIds],
    startDate: strategy.startDate,
    endDate: strategy.endDate,
    remark: strategy.remark,
  })
}

/** 打开时初始化：新建用空草稿，编辑用既有配置回填 */
watch(
  () => props.open,
  (open) => {
    if (!open) return
    clearErrors()
    pendingTrigger.value = null
    pendingCycle.value = null
    const strategy = editing.value
    if (strategy) fillFromStrategy(strategy)
    else Object.assign(draft, emptyDraft())
    lastTriggerType = draft.triggerType
    lastCycleType = draft.cycleType ?? '按日'
  },
  { immediate: true },
)

/* ---------- 时间与日期转换 ---------- */

const toDayjs = (value: string) => (value ? dayjs(value) : null)
const fromDayjs = (value: Dayjs | null) => (value ? value.format('YYYY-MM-DD') : '')

/** 时刻字符串 → Dayjs（不依赖 customParseFormat，手动写入时分） */
function clockToDayjs(time: string): Dayjs | null {
  if (!time) return null
  const [hour, minute] = time.split(':').map((item) => Number(item))
  if (Number.isNaN(hour) || Number.isNaN(minute)) return null
  return dayjs().hour(hour).minute(minute).second(0)
}

function dayjsToClock(value: Dayjs | null) {
  if (!value) return ''
  return `${String(value.hour()).padStart(2, '0')}:${String(value.minute()).padStart(2, '0')}`
}

/* ---------- 时间点条目 ---------- */

function addPoint() {
  if (draft.timePoints.length >= TIME_POINT_MAX) {
    message.warning(`单条策略最多 ${TIME_POINT_MAX} 个时间点`)
    return
  }
  draft.timePoints.push(newPoint('08:00', '拉闸'))
}

function removePoint(id: string) {
  const index = draft.timePoints.findIndex((item) => item.id === id)
  if (index >= 0) draft.timePoints.splice(index, 1)
}

/** 星期按钮块：点选加入、再点移出 */
function toggleWeekday(value: number) {
  const index = draft.weekdays.indexOf(value)
  if (index >= 0) draft.weekdays.splice(index, 1)
  else draft.weekdays.push(value)
  // 保持升序，与列表摘要的展示顺序一致
  draft.weekdays.sort((a, b) => a - b)
}

/* ---------- 负控规则条目 ---------- */

function addRule() {
  if (draft.eventRules.length >= EVENT_RULE_MAX) {
    message.warning(`单条策略最多 ${EVENT_RULE_MAX} 条触发规则`)
    return
  }
  draft.eventRules.push(newRule())
}

function removeRule(id: string) {
  const index = draft.eventRules.findIndex((item) => item.id === id)
  if (index >= 0) draft.eventRules.splice(index, 1)
}

/* ---------- 触发方式 / 周期类型切换（清空原配置需确认） ----------
   时控与负控的配置字段无交集，残留配置会让用户误以为两者可以叠加，因此切换前需要确认。
   提示直接落在表单内（不做独立弹窗），用户不必先关掉弹窗再回到表单接着填。
   点「取消」回退到切换前的取值，保证界面与已保存配置一致。 */

/** 待确认切换的原因说明（按目标触发方式给出具体将被清空的字段） */
const pendingTriggerDesc = computed(() =>
  pendingTrigger.value === '负控'
    ? `已配置的 ${draft.timePoints.length} 个时间点将被清空。`
    : `已配置的 ${draft.eventRules.length} 条触发规则与执行延时将被清空。`,
)

function handleTriggerChange() {
  const target = draft.triggerType
  if (!target || target === lastTriggerType) return
  // 目标触发方式尚未配置内容时无需确认（例如新建后第一次切换）
  const hasConfig = target === '负控' ? draft.timePoints.length > 0 : draft.eventRules.length > 0
  if (!hasConfig) {
    lastTriggerType = target
    if (target === '时控') lastCycleType = draft.cycleType ?? '按日'
    // 切到负控时给一条空白规则，省去用户再点一次「添加规则」
    if (target === '负控' && !draft.eventRules.length) draft.eventRules = [newRule()]
    pendingTrigger.value = null
    return
  }
  draft.triggerType = lastTriggerType
  pendingTrigger.value = target
}

function confirmTriggerSwitch() {
  const target = pendingTrigger.value
  if (!target) return
  draft.triggerType = target
  draft.timePoints = []
  draft.eventRules = []
  draft.delay = 0
  // 切到负控时给一条空白规则，省去用户再点一次「添加规则」
  if (target === '负控') draft.eventRules = [newRule()]
  if (target === '时控') draft.cycleType = lastCycleType
  lastTriggerType = target
  pendingTrigger.value = null
}

function handleCycleChange() {
  const target = draft.cycleType
  if (!target || target === lastCycleType) return
  if (!draft.timePoints.length) {
    lastCycleType = target
    pendingCycle.value = null
    return
  }
  draft.cycleType = lastCycleType
  pendingCycle.value = target
}

function confirmCycleSwitch() {
  const target = pendingCycle.value
  if (!target) return
  draft.cycleType = target
  draft.timePoints = []
  draft.weekdays = []
  draft.onceDate = ''
  lastCycleType = target
  pendingCycle.value = null
}

/** 取消切换：把控件回到切换前的取值，并撤下提示 */
function cancelSwitch() {
  draft.triggerType = lastTriggerType
  draft.cycleType = lastCycleType
  pendingTrigger.value = null
  pendingCycle.value = null
}

/* ---------- 作用对象联动 ---------- */

/** 作用设备选项：仅已选作用用电单元下的设备；候选项按「所属用能单元」分组，避免多单元下同名设备混淆 */
const selectable = computed(() => selectableDevices(draft.unitIds))

const deviceOptions = computed(() => {
  // 以所属用能单元为分组单位：上级路径只作为分组标题出现一次，候选项只留设备名
  const groups = new Map<string, { label: string; options: Array<Record<string, unknown>> }>()
  selectable.value.forEach((device) => {
    const unitId = device.unitId || 'SCOPE-UNIT-UNASSIGNED'
    if (!groups.has(unitId)) {
      groups.set(unitId, {
        // 分组标题用简洁路径（省略企业名），避免标题过长挤占候选项宽度
        label: device.unitId ? unitShortPath(device.unitId) : '未归属用能单元',
        options: [],
      })
    }
    groups.get(unitId)!.options.push({
      label: device.name,
      value: device.id,
      name: device.name,
      // 异常状态（待接入 / 离线）才提示：在线且已接入的设备无需占用候选行的注意力
      abnormal:
        device.accessStatus !== '已接入' ? '未接入' : device.onlineStatus !== '在线' ? '离线' : '',
    })
  })
  return [...groups.values()]
})

/** 取消用能单元时，自动移出不在作用范围内的已选设备并提示 */
function handleUnitChange() {
  // 勾选树可能联动带回非用能单元节点，先做一次过滤
  const units = sanitizeUnitIds(draft.unitIds)
  if (units.length !== draft.unitIds.length) draft.unitIds = units

  if (!draft.deviceIds.length) return
  const allowed = new Set(selectable.value.map((device) => device.id))
  const removed = draft.deviceIds.filter((id) => !allowed.has(id))
  if (!removed.length) return
  draft.deviceIds = draft.deviceIds.filter((id) => allowed.has(id))
  message.info(`已移除 ${removed.length} 台不在作用范围内的设备`)
}

/** 作用对象的设备统计（总数 / 待接入 / 离线） */
const scope = computed(() => scopeStats({ unitIds: draft.unitIds, deviceIds: draft.deviceIds }))

/* ---------- 保存 ---------- */

function handleSave() {
  // 切换提示未处理时先让用户确认，避免带着未定稿的触发配置进入下一步
  if (pendingTrigger.value || pendingCycle.value) {
    message.warning('请先确认或取消周期 / 触发方式的切换')
    return
  }
  const draftInput: StrategyInput = {
    ...draft,
    timePoints: sortTimePoints(draft.timePoints),
  }
  const result = validateStrategy(draftInput, props.strategyId ?? undefined)
  clearErrors()
  Object.assign(errors, result)
  if (hasFormError(result)) {
    message.warning('请先修正表单中的错误')
    return
  }
  emit('save', draftInput)
}

function handleCancel() {
  visible.value = false
}
</script>
