<template>
  <div class="page-container ems-page">
    <!-- 顶部说明：生产环境本页为「组织架构 › 用能单元详情 › 用电统计设置」页签，原型以独立地址承载 -->
    <div class="ems-head">
      <span class="ems-head__text">
        用电统计设置（生产环境位于「组织架构 › 用能单元详情 › 用电统计设置」页签；原型以本页承载）
      </span>
      <a-button type="link" class="ems-head__back" @click="goBack">
        <ArrowLeftOutlined />
        返回
      </a-button>
    </div>

    <!-- 【原型演示】仅用于原型交互验证：切换权限与口径状态，不进入生产实现 -->
    <div class="ems-demo">
      <span class="ems-demo__label">【原型演示】</span>
      <a-segmented v-model:value="demoPermit" size="small" :options="permitOptions" />
      <a-segmented v-model:value="demoConfig" size="small" :options="configOptions" />
    </div>

    <div class="ems-body">
      <!-- 用能单元选择：路由带 unitId 时带入，未带参数时默认 U-A -->
      <EnergyRangeTree v-model:value="treeValue" title="选择用能单元（单选）" />

      <div class="ems-main">
        <!-- 从组织架构带入的单元未匹配到演示数据时，明确告知当前展示的是哪个单元 -->
        <a-alert
          v-if="unmatchedUnitName && !loading"
          class="ems-unmatched"
          type="info"
          show-icon
          :closable="false"
          :message="`「${unmatchedUnitName}」暂未接入能源统计演示数据，已展示演示单元「${unitName}」的统计口径`"
        />

        <!-- 加载中（STATE-STA-01） -->
        <div v-if="loading" class="energy-panel">
          <a-skeleton active :paragraph="{ rows: 3 }" />
        </div>

        <!-- 加载失败（STATE-STA-06，自研紧凑状态块，不使用 a-result） -->
        <div v-else-if="failed" class="energy-panel">
          <div class="energy-state">
            <span class="energy-state__icon energy-state__icon--error"><DisconnectOutlined /></span>
            <span class="energy-state__title">用电统计设置加载失败</span>
            <span class="energy-state__desc">网络异常或服务暂时不可用，请稍后重试</span>
            <a-button @click="reload">
              <ReloadOutlined />
              重新加载
            </a-button>
          </div>
        </div>

        <!-- 空态：无可用电表（STATE-STA-05） -->
        <div v-else-if="noAvailableMeter" class="energy-panel">
          <div class="energy-state">
            <span class="energy-state__icon energy-state__icon--empty"><ThunderboltOutlined /></span>
            <span class="energy-state__title">当前单元暂无可用于统计的电表</span>
            <span class="energy-state__desc">请先在设备台账核对设备归属后返回</span>
            <a-button type="primary" @click="goDeviceLedger">
              <LinkOutlined />
              前往设备台账核对归属
            </a-button>
          </div>
        </div>

        <template v-else>
          <!-- ========== 区块一：统计方式设置（只读态 / 编辑态） ========== -->
          <section class="energy-panel ems-block" aria-label="统计方式设置">
            <div class="energy-panel__head">
              <span class="energy-panel__title">统计方式设置</span>
              <div class="ems-block__head">
                <span class="ems-unit__code">{{ unitId }}</span>
                <!-- 编辑入口按权限点渲染（system:org:unit:meterstat:edit）；未设置口径时由「前往设置」进入 -->
                <a-button
                  v-if="canEdit && !editing && status !== 'unset'"
                  size="small"
                  @click="startEdit"
                >
                  <EditOutlined />
                  编辑
                </a-button>
              </div>
            </div>

            <p class="ems-unit__path">当前用能单元：{{ unitName }} · {{ unitPathText }}</p>

            <!-- 未设置口径提示：不默认求和 -->
            <div v-if="status === 'unset'" class="energy-notice energy-notice--warning">
              <ExclamationCircleOutlined class="ems-notice__icon" />
              <div class="ems-notice__body">
                <div>未设置用电统计口径，当前仅展示所选电表读数合计，<strong>不默认求和</strong></div>
                <div class="energy-notice__extra">系统不对未确认的口径做任何推断，请先设置统计方式与计量边界。</div>
              </div>
              <a-button v-if="canEdit" type="link" class="ems-notice__action" @click="startEdit">
                前往设置
              </a-button>
            </div>

            <!-- 覆盖不足提示（STATE-STA-04 / EX-STA-05） -->
            <div v-else-if="status === 'overrun'" class="energy-notice energy-notice--warning">
              <ExclamationCircleOutlined class="ems-notice__icon" />
              <div class="ems-notice__body">
                <div>统计范围未确认，当前仅展示所选电表读数合计</div>
                <div class="energy-notice__extra">所选表未覆盖统计边界，建议补充选表或调整统计方式。</div>
              </div>
            </div>

            <!-- AREA-STA-01 统计方式 -->
            <div class="ems-field">
              <span class="ems-field__label">统计方式</span>
              <div class="ems-field__value">
                <!-- 编辑态：按钮式单选，切换即切换下方电表选择区（非当前方式的控件不渲染） -->
                <a-radio-group
                  v-if="editing"
                  v-model:value="form.mode"
                  class="ems-radio"
                  button-style="solid"
                  @change="handleModeChange"
                >
                  <a-radio-button value="total">以指定总表统计</a-radio-button>
                  <a-radio-button value="sum">所选独立电表相加</a-radio-button>
                </a-radio-group>
                <template v-else>
                  <span class="ems-field__text">{{ modeText }}</span>
                  <span class="ems-status" :class="`ems-status--${status}`">{{ statusText }}</span>
                </template>
              </div>
            </div>

            <!-- AREA-STA-02 电表选择区（编辑态） -->
            <template v-if="editing">
              <template v-if="form.mode === 'total'">
                <div class="ems-field" :class="{ 'ems-field--error': !!formError }">
                  <span class="ems-field__label">指定总表<em>*</em></span>
                  <a-select
                    v-model:value="form.totalMeterId"
                    class="ems-control"
                    show-search
                    allow-clear
                    placeholder="请选择该单元的指定总表（1 块）"
                    option-filter-prop="label"
                    :options="meterOptions"
                    :styles="{ popup: { root: { minWidth: '320px', maxHeight: '256px', overflow: 'auto' } } }"
                    @change="formError = ''"
                  >
                    <template #optionRender="{ option }">
                      <div class="ems-opt">
                        <span class="ems-opt__name" :title="option.data.name">{{ option.data.name }}</span>
                        <span class="ems-opt__role">{{ option.data.role }}</span>
                      </div>
                    </template>
                  </a-select>
                  <p class="ems-field__hint">
                    仅列出本单元下的计量电表；以下拉中的计量角色为准，名称含「总表」不作为判断依据，网关不参与电量统计。
                  </p>
                </div>

                <div class="ems-field">
                  <span class="ems-field__label">分项表（可选，用于构成分析）</span>
                  <a-select
                    v-model:value="form.subMeterIds"
                    class="ems-control"
                    mode="multiple"
                    show-search
                    allow-clear
                    max-tag-count="responsive"
                    placeholder="可多选，仅用于构成分析、不重复累加"
                    option-filter-prop="label"
                    :options="subMeterOptions"
                    :styles="{ popup: { root: { minWidth: '320px', maxHeight: '256px', overflow: 'auto' } } }"
                  >
                    <template #optionRender="{ option }">
                      <div class="ems-opt">
                        <span class="ems-opt__name" :title="option.data.name">{{ option.data.name }}</span>
                        <span class="ems-opt__role">{{ option.data.role }}</span>
                      </div>
                    </template>
                  </a-select>
                  <p class="ems-field__hint">分项表不参与总量计算，仅用于生成「分项构成（占比）」。</p>
                </div>
              </template>

              <div v-else class="ems-field" :class="{ 'ems-field--error': !!formError }">
                <span class="ems-field__label">独立电表集合<em>*</em></span>
                <a-select
                  v-model:value="form.meterIds"
                  class="ems-control"
                  mode="multiple"
                  show-search
                  allow-clear
                  max-tag-count="responsive"
                  placeholder="请选择参与相加的独立电表（可多选）"
                  option-filter-prop="label"
                  :options="meterOptions"
                  :styles="{ popup: { root: { minWidth: '320px', maxHeight: '256px', overflow: 'auto' } } }"
                  @change="formError = ''"
                >
                  <template #optionRender="{ option }">
                    <div class="ems-opt">
                      <span class="ems-opt__name" :title="option.data.name">{{ option.data.name }}</span>
                      <span class="ems-opt__role">{{ option.data.role }}</span>
                    </div>
                  </template>
                </a-select>
                <p class="ems-field__hint">
                  所选电表须共同覆盖统计边界且彼此无包含关系；存在包含关系时不能相加。
                </p>
              </div>

              <p v-if="formError" class="ems-form-error">{{ formError }}</p>
            </template>

            <!-- AREA-STA-02 计量电表（只读态；未设置时不展示） -->
            <div v-else-if="status !== 'unset'" class="ems-field">
              <span class="ems-field__label">{{ meterFieldLabel }}</span>
              <div class="ems-field__value">
                <template v-if="viewMode === 'total'">
                  <template v-if="totalMeterObj">
                    <span class="ems-meter">{{ totalMeterObj.name }}</span>
                    <span class="ems-opt__role">{{ totalMeterObj.role }}</span>
                  </template>
                  <span v-else class="ems-field__empty">—</span>
                  <span v-if="subMeterObjs.length" class="ems-field__sub">
                    分项表：{{ subMeterObjs.map((meter) => meter.name).join('、') }}
                  </span>
                </template>
                <div v-else class="ems-chips">
                  <span v-for="meter in sumMeterObjs" :key="meter.id" class="ems-chip">{{ meter.name }}</span>
                  <span v-if="!sumMeterObjs.length" class="ems-field__empty">—</span>
                </div>
              </div>
            </div>

            <!-- AREA-STA-03 计算说明与生效时间（未设置时不展示） -->
            <div v-if="editing || status !== 'unset'" class="ems-calc">
              <div class="ems-calc__row">
                <span class="ems-calc__label">计算说明</span>
                <span class="ems-calc__text">{{ calcText }}</span>
              </div>
              <div class="ems-calc__row">
                <span class="ems-calc__label">生效时间</span>
                <span class="ems-calc__text ems-code">{{ effectiveText }}</span>
              </div>
              <p class="ems-calc__note">默认保存时刻即生效时间，口径切换以生效时间为界。</p>
            </div>

            <!-- AREA-STA-04 操作区（编辑态 + 编辑权限，右对齐；提交中禁止重复提交） -->
            <div v-if="editing && canEdit" class="ems-actions">
              <a-button :disabled="saving" @click="cancelEdit">取消</a-button>
              <a-button type="primary" :loading="saving" @click="handleSave">保存</a-button>
            </div>
          </section>

          <!-- ========== 区块二：只读展示（数据来源同分析页口径） ========== -->
          <section class="energy-panel ems-block" aria-label="只读展示">
            <div class="energy-panel__head">
              <span class="energy-panel__title">只读展示</span>
              <span class="energy-panel__sub">数据来源同分析页口径</span>
            </div>

            <template v-if="showComposition">
              <!-- 分项构成（占比）：只读，不参与总量计算 -->
              <div class="ems-sub">
                <div class="ems-sub__head">
                  <span>分项构成（占比）</span>
                  <span class="energy-panel__sub">构成占比以指定总表的时段用电为分母</span>
                </div>
                <div class="energy-sub-list">
                  <div v-for="item in subItems" :key="item.name" class="energy-sub-item">
                    <span class="energy-sub-item__name" :title="item.name">{{ item.name }}</span>
                    <span class="energy-sub-item__bar">
                      <span class="energy-sub-item__fill" :style="{ width: `${item.ratio}%` }" />
                    </span>
                    <span class="ems-sub__value">{{ formatNumber(item.value) }} kWh</span>
                    <span class="energy-sub-item__ratio">{{ item.ratio }}%</span>
                  </div>
                </div>
              </div>

              <!-- 计量差额（未分摊）：如实展示正负号，不做绝对值掩盖 -->
              <div class="ems-diff">
                <span class="ems-diff__label">计量差额（未分摊）</span>
                <p class="ems-diff__expr">
                  总表 <strong>{{ formatNumber(DEMO_TOTAL_KWH) }}</strong> kWh − 分表合计
                  <strong>{{ formatNumber(subKwh) }}</strong> kWh = 差额
                  <strong :class="{ 'ems-diff__value--negative': diffKwh < 0 }">{{ formatNumber(diffKwh) }}</strong> kWh
                </p>
                <p class="ems-calc__note">计量差额未经核实前称为「未分摊」，不直接定性为损耗。</p>
              </div>
            </template>

            <div v-else class="energy-notice energy-notice--info">
              <InfoCircleOutlined class="ems-notice__icon" />
              <div class="ems-notice__body">{{ compositionEmptyText }}</div>
            </div>

            <!-- 数据质量提示：缺数时段不计入合计（EX-STA-09） -->
            <p class="ems-note">任一电表读数缺数时，缺数时段不计入合计。</p>
            <p v-if="demoMissing" class="ems-note ems-note--warn">分项数据不完整，差额仅供参考。</p>
          </section>
        </template>
      </div>
    </div>

    <!-- 并发保存冲突：阻止覆盖，提示刷新重试（EX-STA-03 / Q-IXD-STA-04） -->
    <a-modal
      v-model:open="conflictOpen"
      title="统计设置已被他人修改"
      :width="440"
      :mask-closable="false"
      ok-text="刷新"
      cancel-text="关闭"
      @ok="handleConflictRefresh"
    >
      <p>该单元统计设置已被他人修改，请刷新后再试。</p>
      <p class="ems-modal__hint">为避免覆盖他人的统计口径，本次保存已被阻止，你的修改未被保存。</p>
    </a-modal>

    <!-- 未保存修改时切换用能单元（EX-STA-07） -->
    <a-modal
      v-model:open="switchConfirmOpen"
      title="当前修改尚未保存？"
      :width="440"
      ok-text="放弃修改并切换"
      cancel-text="取消"
      @ok="confirmSwitch"
      @cancel="cancelSwitch"
    >
      <p>当前修改尚未保存，切换后将丢失修改。</p>
    </a-modal>

    <ProtoTip :lines="tipLines" @reset="handleResetDemo">
      <template #extra>
        <a-button size="small" @click="simulateLoadFail">模拟加载失败</a-button>
        <a-button size="small" @click="simulateNoMeter">模拟无可用电表</a-button>
        <a-button size="small" @click="armSaveFail">模拟保存失败（下一次保存）</a-button>
        <a-button size="small" @click="armConflict">模拟并发冲突（下一次保存）</a-button>
        <a-button size="small" @click="simulateMissing">模拟分项缺数</a-button>
      </template>
    </ProtoTip>
  </div>
</template>

<script setup lang="ts">
/**
 * 历史页面：用电统计设置（已迁出，当前由用能分析 OVERLAY-ANA-01 抽屉承载）
 * 【原型说明】历史承载页：用电统计设置已迁入「用能分析」页的用电统计设置抽屉（对应交互文档《产品交互设计文档-用能分析》5.1 OVERLAY-ANA-01）。
 * 历史承载页：该能力已迁入「能源数据 › 用能分析」页的用电统计设置抽屉，本页仅作历史路由留存。
 * 覆盖：统计方式（指定总表 / 独立电表相加）、总表与分项表选择、独立电表集合与包含关系拦截、
 * 计算说明与生效时间、只读分项构成与计量差额、权限点渲染，以及加载/空态/保存中/保存失败/并发冲突等状态。
 * 演示数据仅来自能源数据 store，不引入接口与数据库实现。
 */
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { message } from 'antdv-next'
import {
  ArrowLeftOutlined,
  DisconnectOutlined,
  EditOutlined,
  ExclamationCircleOutlined,
  InfoCircleOutlined,
  LinkOutlined,
  ReloadOutlined,
  ThunderboltOutlined,
} from '@antdv-next/icons'
import ProtoTip from '@/shared/components/ProtoTip.vue'
import EnergyRangeTree from '../components/EnergyRangeTree.vue'
import { hasPermission, meterStats, meters, saveMeterStat, subItems, units } from '../store'
import { PERM } from '../store/constants'
import type { MeterDevice, MeterStatConfig, MeterStatMode } from '../store/types'

const route = useRoute()
const router = useRouter()

/* ---------- 静态索引：演示用能单元与计量电表的快速查找 ---------- */
const unitMap = new Map(units.map((unit) => [unit.id, unit]))
const meterMap = new Map(meters.map((meter) => [meter.id, meter]))

/** 计量差额演示口径：与分项构成（subItems）保持同一时段口径 */
const DEMO_TOTAL_KWH = 1000

/* ---------- 权限：编辑入口按 system:org:unit:meterstat:edit 渲染 ---------- */
/** 【原型演示】权限开关，仅用于原型验证「有权限/无权限」两态 */
const demoPermit = ref<string>('grant')
/** 【原型演示】口径状态开关，仅用于原型验证「已设置/未设置/覆盖不足」 */
const demoConfig = ref<string>('set')
/** 【原型演示】无可用电表开关 */
const demoNoMeter = ref(false)
/** 【原型演示】下一次保存模拟失败 / 并发冲突 */
const simulateFailNext = ref(false)
const simulateConflictNext = ref(false)
/** 【原型演示】分项缺数 */
const demoMissing = ref(false)

const permitOptions = [
  { label: '有权限', value: 'grant' },
  { label: '无权限', value: 'deny' },
]
const configOptions = [
  { label: '已设置', value: 'set' },
  { label: '未设置', value: 'unset' },
  { label: '覆盖不足', value: 'overrun' },
]

const canEdit = computed(() => hasPermission(PERM.meterStatEdit) && demoPermit.value === 'grant')

/* ---------- 用能单元上下文：路由参数带入 / 默认 U-A ---------- */
const unmatchedUnitName = ref('')
const unitId = ref(resolveInitialUnit())

/** 统一单元名称：去掉空格并把中文数字转成阿拉伯数字，便于组织架构与能源演示单元按名称匹配 */
function normalizeUnitName(name: string): string {
  const digits: Record<string, string> = {
    一: '1', 二: '2', 三: '3', 四: '4', 五: '5', 六: '6', 七: '7', 八: '8', 九: '9', 十: '10',
  }
  return name.replace(/\s+/g, '').replace(/[一二三四五六七八九十]/g, (char) => digits[char] ?? char)
}

function resolveInitialUnit(): string {
  const raw = route.params.unitId
  const id = Array.isArray(raw) ? raw[0] : raw
  if (id && unitMap.has(id)) return id
  const rawName = route.query.unitName
  const requested = Array.isArray(rawName) ? rawName[0] : rawName
  if (requested) {
    const normalized = normalizeUnitName(requested)
    const matched = units.find((unit) => normalizeUnitName(unit.name) === normalized)
    if (matched) return matched.id
    unmatchedUnitName.value = requested
  }
  return 'U-A'
}

const unitName = computed(() => unitMap.get(unitId.value)?.name ?? unitId.value)

/** 层级路径（只读）：从根到当前单元 */
const unitPathText = computed(() => {
  const names: string[] = []
  let cursor = unitMap.get(unitId.value)
  while (cursor) {
    names.unshift(cursor.name)
    cursor = cursor.parentId ? unitMap.get(cursor.parentId) : undefined
  }
  return names.join(' / ')
})

/** 单元选择：与 EnergyRangeTree 双向绑定，切换前若存在未保存修改先确认 */
const treeValue = computed<string[]>({
  get: () => [unitId.value],
  set: (keys) => {
    const next = keys[0]
    if (next && next !== unitId.value) requestSwitchUnit(next)
  },
})

/* ---------- 加载态与错误态 ---------- */
const loading = ref(true)
const failed = ref(false)

function reload() {
  loading.value = true
  failed.value = false
  window.setTimeout(() => {
    loading.value = false
  }, 360)
}

onMounted(reload)

/* ---------- 已保存设置与口径状态 ---------- */
const storedConfig = computed<MeterStatConfig | null>(() => meterStats[unitId.value] ?? null)

/** 只读/编辑共用的当前口径（叠加演示开关） */
const config = computed<MeterStatConfig | null>(() => {
  if (demoConfig.value === 'unset') return null
  const base = storedConfig.value
  if (!base) return null
  if (demoConfig.value === 'overrun') return { ...base, confirmed: false }
  return base
})

type StatStatus = 'unset' | 'set' | 'overrun'
const status = computed<StatStatus>(() => {
  if (!config.value) return 'unset'
  return config.value.confirmed ? 'set' : 'overrun'
})

const statusText = computed(() => {
  if (status.value === 'unset') return '未设置'
  return status.value === 'overrun' ? '覆盖不足' : '已设置'
})

/** 本单元下可用于统计的计量电表（不含网关） */
const unitMeters = computed(() => meters.filter((meter) => !meter.isGateway && isWithinUnit(meter.unitId, unitId.value)))
const noAvailableMeter = computed(() => demoNoMeter.value || unitMeters.value.length === 0)

const meterOptions = computed(() =>
  unitMeters.value.map((meter) => ({ value: meter.id, label: meter.name, name: meter.name, role: meter.role })),
)
/** 分项表候选项排除已选中的指定总表 */
const subMeterOptions = computed(() =>
  meterOptions.value.filter((option) => option.value !== form.totalMeterId),
)

/* ---------- 编辑态表单 ---------- */
const editing = ref(false)

/** 权限回收后立即退出编辑态，不保留保存/取消入口（UI-STA-11） */
watch(canEdit, (value) => {
  if (!value) editing.value = false
})
const saving = ref(false)
const formError = ref('')
const form = reactive<{
  mode: MeterStatMode
  totalMeterId: string | null
  subMeterIds: string[]
  meterIds: string[]
}>({
  mode: 'total',
  totalMeterId: null,
  subMeterIds: [],
  meterIds: [],
})

/** 打开编辑时的快照，用于「未保存修改」判断 */
const snapshot = ref('')
const formSerialized = computed(() =>
  JSON.stringify({
    mode: form.mode,
    totalMeterId: form.totalMeterId,
    subMeterIds: [...form.subMeterIds].sort(),
    meterIds: [...form.meterIds].sort(),
  }),
)
const dirty = computed(() => editing.value && formSerialized.value !== snapshot.value)

function fillForm() {
  const base = config.value
  form.mode = base?.mode ?? 'total'
  form.totalMeterId = base?.totalMeterId ?? null
  form.subMeterIds = base ? [...base.subMeterIds] : []
  form.meterIds = base ? [...base.meterIds] : []
  snapshot.value = formSerialized.value
}

function startEdit() {
  if (!canEdit.value) return
  fillForm()
  formError.value = ''
  editing.value = true
}

function cancelEdit() {
  editing.value = false
  formError.value = ''
  fillForm()
}

function handleModeChange() {
  formError.value = ''
}

/* ---------- 只读/编辑共用的取值口径 ---------- */
const viewMode = computed<MeterStatMode>(() => (editing.value ? form.mode : config.value?.mode ?? 'total'))
const viewTotalId = computed(() => (editing.value ? form.totalMeterId : config.value?.totalMeterId ?? null))
const viewSubIds = computed(() => (editing.value ? form.subMeterIds : config.value?.subMeterIds ?? []))
const viewMeterIds = computed(() => (editing.value ? form.meterIds : config.value?.meterIds ?? []))

const totalMeterObj = computed<MeterDevice | null>(() => (viewTotalId.value ? meterMap.get(viewTotalId.value) ?? null : null))
const subMeterObjs = computed(() =>
  viewSubIds.value.map((id) => meterMap.get(id)).filter((meter): meter is MeterDevice => !!meter),
)
const sumMeterObjs = computed(() =>
  viewMeterIds.value.map((id) => meterMap.get(id)).filter((meter): meter is MeterDevice => !!meter),
)

const modeText = computed(() => {
  if (status.value === 'unset') return '未设置'
  return viewMode.value === 'total' ? '以指定总表统计' : '所选独立电表相加'
})
const meterFieldLabel = computed(() => (viewMode.value === 'total' ? '指定总表' : '独立电表集合'))

/** 计算说明：按当前选择动态生成一句中文说明 */
const calcText = computed(() => {
  if (viewMode.value === 'total') {
    const meter = totalMeterObj.value
    if (!meter) return '尚未选择指定总表，无法生成统计口径说明'
    return viewSubIds.value.length
      ? `以「${meter.name}」为该单元统计口径，分项表仅作构成分析、不重复累加`
      : `以「${meter.name}」为该单元统计口径`
  }
  const count = viewMeterIds.value.length
  if (!count) return '尚未选择独立电表，无法生成统计口径说明'
  return `以所选 ${count} 只独立电表读数相加，不再次累加分项表`
})

const effectiveText = computed(() => config.value?.effectiveAt ?? '—')

/* ---------- 只读展示区：分项构成与计量差额 ---------- */
const showComposition = computed(
  () => status.value !== 'unset' && viewMode.value === 'total' && viewSubIds.value.length > 0,
)
const subKwh = computed(() => subItems.reduce((sum, item) => sum + item.value, 0))
const diffKwh = computed(() => DEMO_TOTAL_KWH - subKwh.value)

const compositionEmptyText = computed(() => {
  if (status.value === 'unset') return '未设置统计口径，暂无分项构成与计量差额'
  if (viewMode.value === 'sum') return '所选独立电表相加方式下不展示分项构成，计量差额需以指定总表统计方式分析'
  return '未关联分项表，暂无分项构成与计量差额；可在编辑态补充分项表后查看'
})

/* ---------- 保存与校验 ---------- */
/** 是否为「某单元总表与其分项表同时相加」的已知包含关系 */
function hasContainment(ids: string[]): boolean {
  const list = ids.map((id) => meterMap.get(id)).filter((meter): meter is MeterDevice => !!meter)
  return list.some(
    (total) =>
      total.role === '总表' &&
      list.some((sub) => sub.id !== total.id && sub.role === '分项表' && isWithinUnit(sub.unitId, total.unitId)),
  )
}

function validate(): string {
  if (form.mode === 'total') {
    return form.totalMeterId ? '' : '请先选择参与统计的电表'
  }
  if (!form.meterIds.length) return '请先选择参与统计的电表'
  if (hasContainment(form.meterIds)) return '所选电表存在包含关系，不能相加'
  return ''
}

function handleSave() {
  if (saving.value) return
  const error = validate()
  if (error) {
    formError.value = error
    message.error(error)
    return
  }
  formError.value = ''
  saving.value = true

  // 【原型演示】模拟保存失败（EX-STA-04）：保留编辑态与已填内容
  if (simulateFailNext.value) {
    simulateFailNext.value = false
    window.setTimeout(() => {
      saving.value = false
      message.error('保存失败，请重试')
    }, 600)
    return
  }
  // 【原型演示】模拟并发保存冲突（EX-STA-03）：阻止覆盖并提示刷新
  if (simulateConflictNext.value) {
    simulateConflictNext.value = false
    window.setTimeout(() => {
      saving.value = false
      conflictOpen.value = true
    }, 600)
    return
  }

  window.setTimeout(() => {
    saveMeterStat({
      unitId: unitId.value,
      mode: form.mode,
      totalMeterId: form.mode === 'total' ? form.totalMeterId : null,
      subMeterIds: form.mode === 'total' ? [...form.subMeterIds] : [],
      meterIds: form.mode === 'sum' ? [...form.meterIds] : [],
      effectiveAt: '',
      updatedBy: '',
      confirmed: true,
    })
    saving.value = false
    editing.value = false
    // 保存后回到「已设置」口径展示
    demoConfig.value = 'set'
    message.success('已保存并写入系统日志')
  }, 600)
}

/* ---------- 并发冲突与单元切换确认 ---------- */
const conflictOpen = ref(false)
function handleConflictRefresh() {
  conflictOpen.value = false
  reload()
}

const switchConfirmOpen = ref(false)
const pendingUnit = ref<string | null>(null)

function requestSwitchUnit(next: string) {
  if (editing.value && dirty.value) {
    pendingUnit.value = next
    switchConfirmOpen.value = true
    return
  }
  applyUnit(next)
}

function applyUnit(next: string) {
  unitId.value = next
  unmatchedUnitName.value = ''
  editing.value = false
  formError.value = ''
  fillForm()
  reload()
}

function confirmSwitch() {
  const next = pendingUnit.value
  pendingUnit.value = null
  switchConfirmOpen.value = false
  if (next) applyUnit(next)
}

function cancelSwitch() {
  pendingUnit.value = null
  switchConfirmOpen.value = false
}

/* ---------- 跳转 ---------- */
function goBack() {
  if (window.history.length > 1) router.back()
  else router.push({ name: 'energy-analysis' })
}

function goDeviceLedger() {
  router.push({ name: 'device-ledger' })
}

/* ---------- 演示触发入口 ---------- */
function simulateLoadFail() {
  loading.value = true
  failed.value = false
  window.setTimeout(() => {
    loading.value = false
    failed.value = true
  }, 360)
}

function simulateNoMeter() {
  demoNoMeter.value = true
  editing.value = false
  message.info('已模拟该单元无可用计量电表')
}

function armSaveFail() {
  simulateFailNext.value = true
  message.info('下一次点「保存」将模拟保存失败')
}

function armConflict() {
  simulateConflictNext.value = true
  message.info('下一次点「保存」将模拟并发冲突')
}

function simulateMissing() {
  demoMissing.value = true
  message.info('已模拟分项缺数，差额标注为仅供参考')
}

function handleResetDemo() {
  demoPermit.value = 'grant'
  demoConfig.value = 'set'
  demoNoMeter.value = false
  simulateFailNext.value = false
  simulateConflictNext.value = false
  demoMissing.value = false
  unitId.value = 'U-A'
  editing.value = false
  saving.value = false
  formError.value = ''
  conflictOpen.value = false
  switchConfirmOpen.value = false
  pendingUnit.value = null
  fillForm()
  reload()
}

/* ---------- 工具 ---------- */
/** childId 是否等于 ancestorId 或位于其下级 */
function isWithinUnit(childId: string, ancestorId: string): boolean {
  let cursor = unitMap.get(childId)
  while (cursor) {
    if (cursor.id === ancestorId) return true
    cursor = cursor.parentId ? unitMap.get(cursor.parentId) : undefined
  }
  return false
}

function formatNumber(value: number): string {
  return value.toLocaleString('zh-CN')
}

/* ---------- 演示提示 ---------- */
const tipLines = [
  '本页为用电统计设置的历史承载页；该能力已迁入「能源数据 › 用能分析」页的用电统计设置抽屉（OVERLAY-ANA-01）。',
  '统计方式为单选：以指定总表统计 / 所选独立电表相加；切换到某一方式时只渲染该方式所需的选表控件，非当前方式的控件不置灰渲染。',
  '指定总表只能选 1 块；分项表可多选，仅用于构成分析，不参与总量计算（不重复累加）。',
  '所选独立电表相加时，若同时选中某单元的总表与其分项表，保存会被拦截并提示「所选电表存在包含关系，不能相加」。',
  '未设置用电统计口径时，仅展示所选电表读数合计，不默认求和；可由「前往设置」进入编辑态。',
  '计量差额未经核实前称为「未分摊」，不直接定性为损耗；差额为负时如实展示负号，不做绝对值掩盖。',
  '编辑入口按权限点 system:org:unit:meterstat:edit 渲染；无权限时本页为只读展示，不渲染编辑/保存/取消。',
  '保存成功写入系统日志；并发保存冲突时阻止覆盖并提示刷新后重试，不静默覆盖他人口径。',
  '顶部开关与下方按钮仅用于原型演示各状态，正式实现以服务端数据与真实权限为准。',
]
</script>

<style scoped>
/* 页面容器：顶部说明 + 演示开关 + 左侧用能单元树 + 右侧设置面板 */
.ems-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.ems-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.ems-head__text {
  font-size: 14px;
  font-weight: 600;
  line-height: 22px;
  color: rgba(0, 0, 0, 0.88);
}

.ems-head__back {
  flex: none;
  padding: 0;
}

/* 【原型演示】演示开关条，仅用于原型验证，不进入生产实现 */
.ems-demo {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  padding: 8px 16px;
  background: #f7faf9;
  border: 1px dashed #cfe0dd;
  border-radius: 8px;
}

.ems-demo__label {
  font-size: 12px;
  color: #0f7b6c;
}

.ems-body {
  display: flex;
  align-items: flex-start;
  gap: 16px;
}

.ems-main {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  gap: 16px;
  min-width: 480px;
}

.ems-block {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.ems-block .energy-panel__head {
  margin-bottom: 0;
}

.ems-block__head {
  display: flex;
  align-items: center;
  gap: 12px;
}

.ems-unit__code {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12px;
  color: rgba(0, 0, 0, 0.45);
}

.ems-unit__path {
  margin: 0;
  font-size: 12px;
  line-height: 18px;
  color: rgba(0, 0, 0, 0.45);
}

/* 信息项 */
.ems-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.ems-field__label {
  font-size: 13px;
  line-height: 18px;
  color: rgba(0, 0, 0, 0.65);
}

.ems-field__label em {
  margin-left: 2px;
  font-style: normal;
  color: #ff4d4f;
}

.ems-field__value {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: rgba(0, 0, 0, 0.88);
}

.ems-field__text {
  font-size: 14px;
}

.ems-field__hint {
  margin: 0;
  font-size: 12px;
  line-height: 18px;
  color: rgba(0, 0, 0, 0.45);
}

.ems-field__empty {
  color: rgba(0, 0, 0, 0.25);
}

.ems-field__sub {
  font-size: 12px;
  color: rgba(0, 0, 0, 0.45);
}

.ems-field--error .ems-control :deep(.ant-select-selector) {
  border-color: #ff4d4f;
}

.ems-control {
  width: 100%;
}

.ems-radio {
  display: flex;
  width: 100%;
}

.ems-radio :deep(.ant-radio-button-wrapper) {
  flex: 1 1 0;
  height: 32px;
  line-height: 30px;
  text-align: center;
}

.ems-form-error {
  margin: 0;
  font-size: 12px;
  line-height: 18px;
  color: #ff4d4f;
}

/* 状态标签：不止靠颜色，同时附文字 */
.ems-status {
  display: inline-flex;
  align-items: center;
  height: 22px;
  padding: 0 8px;
  font-size: 12px;
  line-height: 22px;
  border: 1px solid transparent;
  border-radius: 8px;
}

.ems-status--set {
  color: #52c41a;
  background: rgba(82, 196, 26, 0.1);
  border-color: rgba(82, 196, 26, 0.3);
}

.ems-status--unset {
  color: rgba(0, 0, 0, 0.45);
  background: rgba(0, 0, 0, 0.04);
  border-color: #d9d9d9;
}

.ems-status--overrun {
  color: #faad14;
  background: rgba(250, 173, 20, 0.1);
  border-color: rgba(250, 173, 20, 0.3);
}

/* 只读态电表展示 */
.ems-meter {
  font-size: 14px;
  color: rgba(0, 0, 0, 0.88);
}

.ems-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.ems-chip {
  display: inline-flex;
  align-items: center;
  height: 24px;
  padding: 0 8px;
  font-size: 12px;
  color: #0f7b6c;
  background: #ecf4f3;
  border: 1px solid rgba(15, 123, 108, 0.2);
  border-radius: 8px;
}

/* 下拉候选项：名称 + 计量角色标签 */
.ems-opt {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.ems-opt__name {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ems-opt__role {
  flex: none;
  padding: 0 6px;
  font-size: 12px;
  line-height: 20px;
  color: #0f7b6c;
  background: #ecf4f3;
  border: 1px solid rgba(15, 123, 108, 0.2);
  border-radius: 6px;
}

/* 提示条 */
.ems-notice__icon {
  margin-top: 3px;
  flex: none;
  color: #faad14;
}

.energy-notice--info .ems-notice__icon {
  color: #1890ff;
}

.ems-notice__body {
  flex: 1 1 auto;
  min-width: 0;
}

.ems-notice__action {
  flex: none;
  padding: 0;
}

/* 计算说明与生效时间（只读卡片） */
.ems-calc {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 14px 16px;
  background: #fbfcfc;
  border: 1px solid #eef2f1;
  border-radius: 10px;
}

.ems-calc__row {
  display: flex;
  gap: 12px;
  font-size: 14px;
  line-height: 22px;
}

.ems-calc__label {
  flex: none;
  width: 72px;
  font-size: 13px;
  color: rgba(0, 0, 0, 0.65);
}

.ems-calc__text {
  color: rgba(0, 0, 0, 0.88);
}

.ems-calc__note {
  margin: 0;
  font-size: 12px;
  line-height: 18px;
  color: rgba(0, 0, 0, 0.45);
}

.ems-code {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 13px;
}

.ems-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

/* 只读展示区 */
.ems-sub {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.ems-sub__head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  font-size: 13px;
  color: rgba(0, 0, 0, 0.88);
}

.ems-sub__value {
  flex: none;
  width: 96px;
  font-size: 13px;
  text-align: right;
  color: rgba(0, 0, 0, 0.65);
}

.ems-diff {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 14px 16px;
  background: #fbfcfc;
  border: 1px solid #eef2f1;
  border-radius: 10px;
}

.ems-diff__label {
  font-size: 13px;
  color: rgba(0, 0, 0, 0.65);
}

.ems-diff__expr {
  margin: 0;
  font-size: 14px;
  line-height: 22px;
  color: rgba(0, 0, 0, 0.88);
}

.ems-diff__value--negative {
  color: #ff4d4f;
}

.ems-note {
  margin: 0;
  font-size: 12px;
  line-height: 18px;
  color: rgba(0, 0, 0, 0.45);
}

.ems-note--warn {
  color: #faad14;
}

/* 冲突弹窗补充说明 */
.ems-modal__hint {
  margin: 8px 0 0;
  font-size: 12px;
  line-height: 18px;
  color: rgba(0, 0, 0, 0.45);
}

/* 窄屏（1280~1365px）：面板最小宽随组织架构收窄至 400px */
@media (max-width: 1365px) {
  .ems-main {
    min-width: 400px;
  }
}
</style>
