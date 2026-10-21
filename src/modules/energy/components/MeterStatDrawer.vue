<!--
  【原型说明】用电统计设置抽屉：从用能分析顶部「用电统计设置」进入，左侧树选择用能单元，右侧设置统计口径。
  一个用能单元只保留一个统计口径：按进线总表统计，或自动汇总该单元下全部独立电表（不含网关，新增电表自动纳入）。
-->
<template>
  <a-drawer
    v-model:open="openModel"
    title="用电统计设置"
    placement="right"
    :size="820"
    :mask-closable="false"
  >
    <div class="msd">
      <!-- 左：组织与用能单元树 -->
      <aside class="msd__side">
        <div class="msd__side-title">选择用能单元</div>
        <p class="msd__side-hint">仅用能单元可设置；组织节点按其下属用能单元汇总。</p>
        <EnergyRangeTree
          v-model:value="treeSelection"
          :multiple="false"
          :show-head="false"
          only-units
          class="msd__tree"
        />
      </aside>

      <!-- 右：当前单元的统计设置 -->
      <section class="msd__main">
        <div class="msd__unit">
          <span class="msd__unit-name">{{ unitName }}</span>
          <a-tag class="msd__status">{{ statusText }}</a-tag>
        </div>
        <p class="msd__path">{{ unitPathText }}</p>

        <div v-if="noAvailableMeter" class="energy-notice energy-notice--warning">
          <InfoCircleOutlined />
          <span>当前单元及下级暂无可用于统计的计量电表，请先在设备台账核对设备归属。</span>
        </div>

        <template v-else>
          <div class="msd__field">
            <span class="msd__label">统计方式</span>
            <a-radio-group
              v-model:value="form.mode"
              class="msd__radio"
              button-style="solid"
              :disabled="!canEdit"
              @change="formError = ''"
            >
              <a-radio-button value="total">按进线总表统计</a-radio-button>
              <a-radio-button value="sum">独立电表相加</a-radio-button>
            </a-radio-group>
          </div>

          <div v-if="form.mode === 'total'" class="msd__field">
            <span class="msd__label">进线总表<em>*</em></span>
            <a-select
              v-model:value="form.totalMeterId"
              class="msd__control"
              show-search
              allow-clear
              placeholder="请选择该单元的进线总表（1 块）"
              option-filter-prop="label"
              :options="totalMeterOptions"
              :disabled="!canEdit"
              @change="formError = ''"
            />
            <p class="msd__hint">
              从该用能单元及下级的计量电表中选择一块作为进线总表；网关不参与电量统计。
            </p>
          </div>

          <div v-else class="msd__auto">
            <div class="msd__auto-head">
              <span class="msd__auto-title">自动汇总该用能单元下的全部独立电表</span>
              <span class="msd__auto-count">{{ independentMeters.length }} 只</span>
            </div>
            <div v-if="independentMeters.length" class="msd__chips">
              <a-tag v-for="meter in independentMeters" :key="meter.id" class="msd__chip">
                {{ meter.name }}
              </a-tag>
            </div>
            <div v-else class="energy-notice energy-notice--warning">
              <InfoCircleOutlined />
              <span>当前单元及下级暂无独立电表；可改为按进线总表统计，或先在设备台账补充独立电表。</span>
            </div>
            <p class="msd__hint">
              不含进线总表与采集网关；后续该用能单元下新增的独立电表会自动纳入统计，无需重新配置。
            </p>
          </div>

          <p v-if="formError" class="msd__error">{{ formError }}</p>

          <div class="msd__calc">
            <div class="msd__calc-row">
              <span class="msd__calc-label">计算说明</span>
              <span class="msd__calc-text">{{ calcText }}</span>
            </div>
            <div class="msd__calc-row">
              <span class="msd__calc-label">生效时间</span>
              <span class="msd__calc-text msd__code">{{ effectiveText }}</span>
            </div>
            <p class="msd__note">默认保存时刻即生效时间；保存后按新口径重新查询生效。</p>
          </div>

          <p class="msd__note">
            一个用能单元只保留一个统计口径：按进线总表统计，或将该单元下全部独立电表相加。
          </p>
        </template>
      </section>
    </div>

    <template #footer>
      <div class="msd__footer">
        <a-button @click="closeDrawer">取消</a-button>
        <a-button
          v-if="canEdit"
          type="primary"
          :loading="saving"
          :disabled="noAvailableMeter || !dirty"
          @click="handleSave"
        >
          保存
        </a-button>
      </div>
    </template>
  </a-drawer>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { message } from 'antdv-next'
import { InfoCircleOutlined } from '@antdv-next/icons'
import EnergyRangeTree from './EnergyRangeTree.vue'
import { hasPermission, meterStats, meters, saveMeterStat, units } from '../store'
import { PERM } from '../store/constants'
import type { MeterDevice, MeterStatMode } from '../store/types'

const props = withDefaults(
  defineProps<{
    open: boolean
    /** 可配置的用能单元集合（来自分析对象选择） */
    unitIds: string[]
    /** 打开时默认选中哪个单元 */
    unitId?: string
  }>(),
  { unitId: '' },
)

const emit = defineEmits<{
  (event: 'update:open', value: boolean): void
  (event: 'saved', unitId: string): void
}>()

const unitMap = new Map(units.map((unit) => [unit.id, unit]))
const meterMap = new Map(meters.map((meter) => [meter.id, meter]))

const canEdit = computed(() => hasPermission(PERM.meterStatEdit))

const openModel = computed({
  get: () => props.open,
  set: (value: boolean) => emit('update:open', value),
})

/** 只接受用能单元 ID：组织节点没有设备归属，不能作为设置对象 */
function asUnitId(id: string | undefined): string {
  const unit = id ? unitMap.get(id) : undefined
  return unit?.kind === 'unit' ? unit.id : ''
}

const firstUnitId = computed(
  () => props.unitIds.find((id) => unitMap.get(id)?.kind === 'unit') ?? '',
)

const currentUnitId = ref(asUnitId(props.unitId) || firstUnitId.value)

/** 左侧树单选：选中单元即切换右侧配置 */
const treeSelection = computed<string[]>({
  get: () => (currentUnitId.value ? [currentUnitId.value] : []),
  set: (keys) => {
    const next = keys[0]
    if (next) currentUnitId.value = next
  },
})

watch(
  () => props.unitId,
  (value) => {
    const unitId = asUnitId(value)
    if (unitId) currentUnitId.value = unitId
  },
)

watch(
  () => props.open,
  (open) => {
    if (!open) return
    currentUnitId.value = asUnitId(props.unitId) || firstUnitId.value
    fillForm()
  },
)

watch(currentUnitId, () => fillForm())

const unitName = computed(() => unitMap.get(currentUnitId.value)?.name ?? currentUnitId.value)

const unitPathText = computed(() => {
  const names: string[] = []
  let cursor = unitMap.get(currentUnitId.value)
  while (cursor) {
    names.unshift(cursor.name)
    cursor = cursor.parentId ? unitMap.get(cursor.parentId) : undefined
  }
  return names.join(' / ')
})

/** childId 是否等于 ancestorId 或位于其下级 */
function isWithinUnit(childId: string, ancestorId: string): boolean {
  let cursor = unitMap.get(childId)
  while (cursor) {
    if (cursor.id === ancestorId) return true
    cursor = cursor.parentId ? unitMap.get(cursor.parentId) : undefined
  }
  return false
}

/** 本单元及下级的计量电表（不含网关）：进线总表候选 */
const unitMeters = computed(() =>
  meters.filter((meter) => !meter.isGateway && isWithinUnit(meter.unitId, currentUnitId.value)),
)
/** 独立电表：本单元及下级的独立电表，独立电表相加时自动全部纳入 */
const independentMeters = computed(() =>
  unitMeters.value.filter((meter) => meter.role === '独立电表'),
)
const noAvailableMeter = computed(() => unitMeters.value.length === 0)

const totalMeterOptions = computed(() =>
  unitMeters.value.map((meter) => ({
    value: meter.id,
    label:
      meter.unitId === currentUnitId.value
        ? meter.name
        : `${meter.name}（${unitMap.get(meter.unitId)?.name ?? meter.unitId}）`,
  })),
)

const storedConfig = computed(() => meterStats[currentUnitId.value] ?? null)
const statusText = computed(() => {
  if (!storedConfig.value) return '未设置'
  return storedConfig.value.totalMeterId ? '已设置进线总表' : '独立电表相加'
})

const form = reactive<{
  mode: MeterStatMode
  totalMeterId: string | null
}>({
  mode: 'total',
  totalMeterId: null,
})

function fillForm() {
  const base = storedConfig.value
  form.mode = base?.mode ?? 'total'
  form.totalMeterId = base?.totalMeterId ?? null
  formError.value = ''
  snapshot.value = serialize()
}

function serialize(): string {
  return JSON.stringify({
    mode: form.mode,
    totalMeterId: form.mode === 'total' ? form.totalMeterId : null,
  })
}

const snapshot = ref('')
const dirty = computed(() => serialize() !== snapshot.value)

const formError = ref('')
const saving = ref(false)

const totalMeterObj = computed<MeterDevice | null>(() =>
  form.totalMeterId ? meterMap.get(form.totalMeterId) ?? null : null,
)

const calcText = computed(() => {
  if (form.mode === 'total') {
    const meter = totalMeterObj.value
    if (!meter) return '尚未选择进线总表，无法生成统计口径说明'
    return `以「${meter.name}」的读数作为该用能单元的统计口径`
  }
  if (!independentMeters.value.length) return '当前用能单元下暂无独立电表，无法生成统计口径说明'
  return `自动汇总该用能单元下全部 ${independentMeters.value.length} 只独立电表（不含总表与网关）`
})

const effectiveText = computed(() => storedConfig.value?.effectiveAt ?? '保存后立即生效')

function validate(): string {
  if (form.mode === 'total') return form.totalMeterId ? '' : '请先选择进线总表'
  return independentMeters.value.length ? '' : '当前用能单元下暂无独立电表'
}

function handleSave() {
  if (saving.value) return
  const error = validate()
  if (error) {
    formError.value = error
    message.error(error)
    return
  }
  saving.value = true
  window.setTimeout(() => {
    saveMeterStat({
      unitId: currentUnitId.value,
      mode: form.mode,
      totalMeterId: form.mode === 'total' ? form.totalMeterId : null,
      subMeterIds: [],
      meterIds: [],
      effectiveAt: '',
      updatedBy: '',
      confirmed: true,
    })
    saving.value = false
    emit('saved', currentUnitId.value)
    message.success(`已为「${unitName.value}」保存用电统计设置`)
    closeDrawer()
  }, 320)
}

function closeDrawer() {
  openModel.value = false
}
</script>

<style scoped>
.msd {
  display: flex;
  align-items: stretch;
  gap: 16px;
  min-height: calc(100vh - 176px);
}

/* 左：组织与用能单元树 */
.msd__side {
  display: flex;
  flex: none;
  flex-direction: column;
  gap: 8px;
  width: 260px;
  padding-right: 16px;
  border-right: 1px solid #eef2f1;
}

.msd__side-title {
  font-size: 13px;
  font-weight: 600;
  color: rgba(0, 0, 0, 0.88);
}

.msd__side-hint {
  margin: 0;
  font-size: 12px;
  line-height: 18px;
  color: rgba(0, 0, 0, 0.45);
}

/* 复用分析对象树，去掉卡片外观并撑满左侧 */
.msd__side :deep(.energy-range) {
  width: 100%;
  padding: 0;
  background: transparent;
  border: 0;
  border-radius: 0;
}

.msd__side :deep(.energy-range__tree) {
  max-height: calc(100vh - 250px);
}

/* 右：当前单元配置 */
.msd__main {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  gap: 14px;
  min-width: 0;
  overflow: auto;
}

.msd__unit {
  display: flex;
  align-items: center;
  gap: 8px;
}

.msd__unit-name {
  font-size: 14px;
  color: rgba(0, 0, 0, 0.88);
}

.msd__status {
  margin-left: auto;
  margin-inline-end: 0;
  color: #0f7b6c;
  background: #e9f4f1;
  border-color: #d5ebe5;
}

.msd__path {
  margin: -6px 0 0;
  font-size: 12px;
  line-height: 18px;
  color: rgba(0, 0, 0, 0.45);
}

.msd__field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.msd__label {
  flex: none;
  font-size: 13px;
  line-height: 18px;
  color: rgba(0, 0, 0, 0.65);
}

.msd__label em {
  margin-left: 2px;
  font-style: normal;
  color: #ff4d4f;
}

.msd__radio {
  display: flex;
  width: 100%;
}

.msd__radio :deep(.ant-radio-button-wrapper) {
  flex: 1 1 0;
  height: 32px;
  line-height: 30px;
  text-align: center;
}

.msd__control {
  width: 100%;
}

.msd__hint {
  margin: 0;
  font-size: 12px;
  line-height: 18px;
  color: rgba(0, 0, 0, 0.45);
}

/* 独立电表相加：只读展示自动纳入的电表集合 */
.msd__auto {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px 14px;
  background: #fbfcfc;
  border: 1px solid #eef2f1;
  border-radius: 10px;
}

.msd__auto-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
}

.msd__auto-title {
  font-size: 13px;
  font-weight: 600;
  color: rgba(0, 0, 0, 0.88);
}

.msd__auto-count {
  font-size: 12px;
  color: #0f7b6c;
}

.msd__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.msd__chip {
  margin: 0;
  color: rgba(0, 0, 0, 0.65);
  background: #fff;
  border-color: #e7edec;
}

.msd__error {
  margin: 0;
  font-size: 12px;
  color: #ff4d4f;
}

.msd__calc {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px 14px;
  background: #fbfcfc;
  border: 1px solid #eef2f1;
  border-radius: 10px;
}

.msd__calc-row {
  display: flex;
  gap: 12px;
  font-size: 13px;
  line-height: 20px;
}

.msd__calc-label {
  flex: none;
  width: 64px;
  color: rgba(0, 0, 0, 0.65);
}

.msd__calc-text {
  color: rgba(0, 0, 0, 0.88);
}

.msd__code {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12px;
}

.msd__note {
  margin: 0;
  font-size: 12px;
  line-height: 18px;
  color: rgba(0, 0, 0, 0.45);
}

.msd__footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>
