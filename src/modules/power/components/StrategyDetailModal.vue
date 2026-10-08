<template>
  <!-- OVERLAY-03 策略详情（只读，不含编辑入口） -->
  <a-modal
    v-model:open="visible"
    title="策略详情"
    :width="680"
    :footer="null"
    wrap-class-name="lst-detail-modal"
  >
    <div v-if="strategy" class="lst-detail">
      <!-- 概览：名称 + 触发方式 + 启用状态 + 生效状态 -->
      <header class="lst-detail__hero">
        <h3 class="lst-detail__name" :title="strategy.name">{{ strategy.name }}</h3>
        <div class="lst-detail__hero-tags">
          <span class="lst-tag" :class="strategy.triggerType === '时控' ? 'lst-tag--time' : 'lst-tag--event'">
            {{ strategy.triggerType }}
          </span>
          <span class="lst-detail__chip" :class="strategy.enabled ? 'is-on' : 'is-off'">
            {{ strategy.enabled ? '启用' : '停用' }}
          </span>
          <span class="lst-detail__chip" :class="effectiveClass">{{ effectiveState }}</span>
        </div>
      </header>

      <!-- 生效期：最常被核对的信息，提到概览下方独立一行 -->
      <div class="lst-detail__bar">
        <span class="lst-detail__bar-label">生效期</span>
        <span class="lst-detail__bar-value">{{ effectiveRangeText(strategy) }}</span>
      </div>

      <!-- 触发配置：时控逐条列时间点（完整不摘要）；负控列全部「事件 → 动作」规则 -->
      <section class="lst-detail__section">
        <h4 class="lst-detail__section-title">
          {{ strategy.triggerType === '时控' ? '周期与时间点' : '触发规则' }}
        </h4>

        <template v-if="strategy.triggerType === '时控'">
          <div class="lst-detail__row">
            <span class="lst-detail__key">周期</span>
            <span class="lst-detail__val">{{ cycleText(strategy) }}</span>
          </div>
          <div class="lst-detail__row">
            <span class="lst-detail__key">时间点</span>
            <span class="lst-detail__val">
              <span class="lst-detail__points">
                <span v-for="point in sortedPoints" :key="point.id" class="lst-detail__point">
                  <span class="lst-detail__clock">{{ point.time }}</span>
                  <span
                    class="lst-action"
                    :class="point.action === '拉闸' ? 'lst-action--close' : 'lst-action--open'"
                  >{{ point.action }}</span>
                </span>
              </span>
            </span>
          </div>
        </template>

        <template v-else>
          <div class="lst-detail__row">
            <span class="lst-detail__key">规则明细</span>
            <span class="lst-detail__val">
              <span class="lst-detail__rules">
                <span v-for="(rule, index) in strategy.eventRules" :key="rule.id" class="lst-detail__rule">
                  <span class="lst-detail__rule-index">{{ index + 1 }}</span>
                  <span class="lst-detail__event">{{ rule.event }}</span>
                  <span class="lst-detail__rule-arrow">→</span>
                  <span
                    class="lst-action"
                    :class="rule.action === '拉闸' ? 'lst-action--close' : 'lst-action--open'"
                  >{{ rule.action }}</span>
                </span>
              </span>
            </span>
          </div>
          <div class="lst-detail__row">
            <span class="lst-detail__key">执行延时</span>
            <span class="lst-detail__val">
              {{ strategy.delay > 0 ? `命中事件后延时 ${strategy.delay} 分钟执行` : '命中事件后立即执行' }}
            </span>
          </div>
        </template>
      </section>

      <!-- 作用对象：单元清单与抽屉共用组件（折叠收口 + 展开全部），风格一致 -->
      <section class="lst-detail__section">
        <h4 class="lst-detail__section-title">作用对象</h4>

        <div class="lst-detail__row">
          <span class="lst-detail__key">作用用电单元</span>
          <span class="lst-detail__val">
            <template v-if="unitCount">
              <span class="lst-detail__scope">
                <span class="lst-detail__scope-count">{{ unitCount }} 个</span>
                <span v-if="unitGroups.length > 1" class="lst-detail__muted">
                  分布于 {{ unitGroups.length }} 个组织节点
                </span>
              </span>
              <StrategyUnitGroups class="lst-detail__units" :groups="unitGroups" collapsed />
            </template>
            <span v-else>—</span>
          </span>
        </div>

        <div class="lst-detail__row">
          <span class="lst-detail__key">作用设备</span>
          <span class="lst-detail__val">
            <span class="lst-detail__scope">
              <span class="lst-detail__scope-count">{{ scope.total }} 台</span>
              <span class="lst-detail__chip" :class="isWhole ? 'is-dynamic' : 'is-static'">
                {{ isWhole ? '动态范围 · 全部设备' : '静态范围 · 指定设备' }}
              </span>
              <span v-if="scope.pending" class="lst-detail__chip is-pending">{{ scope.pending }} 台待接入</span>
              <span v-if="scope.offline" class="lst-detail__chip is-pending">{{ scope.offline }} 台离线</span>
            </span>
            <!-- 静态范围设备清单数量可控，直接列出 -->
            <span v-if="!isWhole && scope.list.length" class="lst-detail__devices">
              <span v-for="device in shownDevices" :key="device.id" class="lst-detail__device">
                {{ device.name }}
              </span>
              <span v-if="restCount > 0" class="lst-detail__more">等 {{ restCount }} 台</span>
            </span>
          </span>
        </div>

        <p class="lst-detail__hint">
          {{
            isWhole
              ? '作用于所选用电单元（含全部下级）下的全部设备，后续新增设备自动纳入。'
              : '仅作用于已指定的设备，后续新增设备不会自动纳入。'
          }}
          点列表「作用对象」可核对完整单元与设备清单。
        </p>
      </section>

      <!-- 备注 -->
      <section class="lst-detail__section">
        <h4 class="lst-detail__section-title">备注</h4>
        <p class="lst-detail__remark">{{ strategy.remark || '—' }}</p>
      </section>
    </div>

    <div v-else class="lst-detail__empty">
      <a-empty description="策略详情加载失败" />
      <a-button type="primary" size="small" @click="visible = false">关闭</a-button>
    </div>
  </a-modal>
</template>

<script setup lang="ts">
/**
 * OVERLAY-03 策略详情
 * 【原型说明】以只读方式完整展示策略配置，不提供编辑入口：
 * 列表点策略名称即进入本浮层，编辑走操作列的「编辑」，两条路径互不交叉，避免详情页职责含糊。
 * 内容按「概览 → 生效期 → 触发配置 → 作用对象 → 备注」分区呈现，
 * 触发配置完整不摘要（时控逐条列时间点、负控逐条列「事件 → 动作」规则）。
 * 详情不展示执行记录：执行记录为跨策略的历史事实，由 OVERLAY-04 独立承载。
 */
import { computed } from 'vue'
import {
  cycleText,
  effectiveRangeText,
  effectiveStateOf,
  getStrategy,
  groupScopeUnits,
  isWholeScope,
  resolveScopeDevices,
  sortTimePoints,
} from '../store'
import StrategyUnitGroups from './StrategyUnitGroups.vue'

const props = defineProps<{
  open: boolean
  strategyId: string | null
}>()

const emit = defineEmits<{ 'update:open': [boolean] }>()

const visible = computed({
  get: () => props.open,
  set: (value: boolean) => emit('update:open', value),
})

const strategy = computed(() => (props.strategyId ? getStrategy(props.strategyId) : null))
const sortedPoints = computed(() => (strategy.value ? sortTimePoints(strategy.value.timePoints) : []))
const isWhole = computed(() => (strategy.value ? isWholeScope(strategy.value) : true))

const effectiveState = computed(() => (strategy.value ? effectiveStateOf(strategy.value) : '未生效'))
const effectiveClass = computed(() => {
  if (effectiveState.value === '生效中') return 'is-active'
  if (effectiveState.value === '待生效') return 'is-pending'
  return 'is-idle'
})

/** 作用用电单元按所属组织节点分组（上级路径只出现一次），失效节点以错误色标注 */
const unitGroups = computed(() => groupScopeUnits(strategy.value?.unitIds ?? []))

const unitCount = computed(() => unitGroups.value.reduce((total, group) => total + group.units.length, 0))

const scope = computed(() => {
  const list = strategy.value ? resolveScopeDevices(strategy.value) : []
  const pending = list.filter((device) => device.accessStatus !== '已接入').length
  const offline = list.filter(
    (device) => device.accessStatus === '已接入' && device.onlineStatus !== '在线',
  ).length
  return { total: list.length, list, pending, offline }
})

/** 作用设备名称清单：超出 10 台时展示前 10 台并附「等 N 台」 */
const shownDevices = computed(() => scope.value.list.slice(0, 10))
const restCount = computed(() => Math.max(0, scope.value.list.length - 10))
</script>
