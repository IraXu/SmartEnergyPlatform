<template>
  <!-- 无页面权限：整页空态 -->
  <div v-if="!canView" class="page-container device-page">
    <div class="device-denied">
      <a-empty description="当前账号无权限执行此操作" />
      <a-button type="primary" @click="router.push('/dashboard')">返回</a-button>
    </div>
  </div>

  <div v-else class="page-container device-page">
    <!-- 加载中 -->
    <div v-if="loading" class="device-detail__card">
      <a-skeleton active :paragraph="{ rows: 8 }" />
    </div>

    <!-- 加载失败 -->
    <div v-else-if="failed" class="device-detail__card">
      <div class="device-state">
        <span class="device-state__icon device-state__icon--error"><DisconnectOutlined /></span>
        <p class="device-state__title">设备详情加载失败</p>
        <p class="device-state__desc">网络异常或服务暂时不可用，请稍后重试</p>
        <a-button type="primary" size="small" @click="loadDetail">
          <template #icon><ReloadOutlined /></template>
          重新加载
        </a-button>
      </div>
    </div>

    <!-- 设备已被删除 -->
    <div v-else-if="!device" class="device-detail__card">
      <div class="device-state">
        <span class="device-state__icon"><DeleteOutlined /></span>
        <p class="device-state__title">该设备已被删除</p>
        <p class="device-state__desc">该设备记录已被移除，无法查看详情</p>
        <a-button type="primary" size="small" @click="goBack">返回设备台账</a-button>
      </div>
    </div>

    <template v-else>
      <!-- AREA-DEV-04 顶部信息区：返回在左，设备标识与操作为主 -->
      <header class="device-detail__head">
        <div class="device-detail__head-main">
          <a-button class="device-detail__back" size="small" @click="goBack">
            <template #icon><ArrowLeftOutlined /></template>
            返回
          </a-button>
          <!-- 标题行：标识类（名称 / 类型）与状态类（在线 / 拉合闸 / 信号强度）各成一组，单行不换行；
               组间用竖线分隔，组内用圆点分隔 -->
          <div class="device-detail__title-row">
            <span class="device-detail__title-group">
              <h1 class="device-detail__title" :title="device.name">{{ device.name }}</h1>
              <span v-if="device.type" class="device-cell__type">{{ device.type }}</span>
            </span>

            <span class="device-detail__title-sep" aria-hidden="true" />

            <span class="device-detail__title-group">
              <span class="device-cell__online" :class="device.onlineStatus === '在线' ? 'is-on' : 'is-off'">
                <i class="device-cell__dot" />
                {{ device.onlineStatus }}
              </span>

              <span class="device-detail__title-dot" aria-hidden="true">·</span>
              <span v-if="device.latchStatus" class="device-cell__tag" :class="device.latchStatus === '合闸' ? 'is-closed' : 'is-open'">
                {{ device.latchStatus }}
              </span>
              <span v-else class="device-detail__title-muted">闸位未上报</span>

              <template v-if="showSignal">
                <span class="device-detail__title-dot" aria-hidden="true">·</span>
                <!-- 信号强度：条形图标组按格数直观表达强弱，数值作为辅助 -->
                <span
                  v-if="device.signalStrength"
                  class="device-detail__signal"
                  :class="signalClass"
                  :title="`信号强度 ${device.signalStrength}（CSQ 0-31）· ${signalText}`"
                >
                  <span class="device-detail__signal-bars" aria-hidden="true">
                    <i v-for="level in 4" :key="level" :class="{ 'is-on': level <= signalLevel }" />
                  </span>
                  <span class="device-detail__signal-value">{{ device.signalStrength }}</span>
                </span>
                <span v-else class="device-detail__title-muted">信号未上报</span>
              </template>
            </span>
          </div>
          <p class="device-detail__path">
            <span v-if="unitInvalid" class="device-detail__invalid">{{ unitPath(device.unitId) }}（所属用能单元已失效）</span>
            <span v-else>{{ unitPath(device.unitId) }}</span>
          </p>
        </div>
        <div class="device-detail__head-actions">
          <a-button @click="controlOpen = true">
            <template #icon><ControlOutlined /></template>
            设备控制
          </a-button>
          <a-button v-if="canParam" @click="paramOpen = true">
            <template #icon><SlidersOutlined /></template>
            设备参数
          </a-button>
          <a-button @click="mqttOpen = true">
            <template #icon><FileSearchOutlined /></template>
            MQTT 通讯日志
          </a-button>
        </div>
      </header>

      <!-- CARD-07 设备档案：默认折叠；展开后按语义分组，组内「固定宽度标签 + 取值」两列对齐 -->
      <section class="device-detail__card">
        <div class="device-detail__card-head device-detail__card-head--toggle" @click="archiveOpen = !archiveOpen">
          <h2 class="device-detail__card-title">设备档案</h2>
          <span class="device-detail__toggle">
            {{ archiveOpen ? '收起' : '展开' }}
            <DownOutlined class="device-detail__toggle-icon" :class="{ 'is-open': archiveOpen }" />
          </span>
        </div>

        <div v-show="archiveOpen" class="device-detail__archive">
          <div class="device-detail__archive-group">
            <p class="device-detail__archive-title">设备标识</p>
            <dl class="device-detail__archive-list">
              <div class="device-detail__archive-item">
                <dt>License</dt>
                <dd class="device-cell__mono">
                  {{ device.license }}
                  <a-button type="text" size="small" class="device-detail__copy" @click="copyLicense">
                    <template #icon><CopyOutlined /></template>
                  </a-button>
                </dd>
              </div>
              <div class="device-detail__archive-item">
                <dt>设备识别码</dt>
                <dd class="device-cell__mono">{{ device.imei || '—' }}</dd>
              </div>
              <div class="device-detail__archive-item">
                <dt>表号</dt>
                <dd class="device-cell__mono">
                  {{ device.meterNo || '—' }}
                  <span v-if="!device.meterNo" class="device-detail__badge">未返回</span>
                </dd>
              </div>
              <div class="device-detail__archive-item">
                <dt>卡号（ICCID）</dt>
                <dd class="device-cell__mono">{{ device.cardNo || '—' }}</dd>
              </div>
              <div class="device-detail__archive-item">
                <dt>规格型号</dt>
                <dd>{{ device.model || '—' }}</dd>
              </div>
            </dl>
          </div>

          <div class="device-detail__archive-group">
            <p class="device-detail__archive-title">安装与位置</p>
            <dl class="device-detail__archive-list">
              <div class="device-detail__archive-item device-detail__archive-item--wide">
                <dt>所属用能单元</dt>
                <dd>
                  {{ unitPath(device.unitId) }}
                  <em v-if="unitInvalid" class="device-detail__invalid">所属用能单元已失效</em>
                </dd>
              </div>
              <div class="device-detail__archive-item device-detail__archive-item--wide">
                <dt>GPS 位置</dt>
                <dd class="device-cell__mono">
                  {{ formatCoordinate(device.lng, device.lat) }}
                  <span v-if="device.gpsCustom" class="device-detail__badge">设备自定义</span>
                  <span v-else class="device-detail__badge is-follow">同所属用能单元</span>
                </dd>
              </div>
              <div class="device-detail__archive-item device-detail__archive-item--wide">
                <dt>安装位置描述</dt>
                <dd>{{ device.installPosition || '—' }}</dd>
              </div>
              <div class="device-detail__archive-item">
                <dt>安装日期</dt>
                <dd>{{ device.installDate || '—' }}</dd>
              </div>
            </dl>
          </div>

          <div class="device-detail__archive-group device-detail__archive-group--full">
            <p class="device-detail__archive-title">备注</p>
            <p class="device-detail__archive-remark">{{ device.remark || '—' }}</p>
          </div>
        </div>
      </section>

      <!-- CARD-04 设备专属数据（含计量参数 CT/PT，按类型与相别分组突出数值） -->
      <section class="device-detail__card device-detail__card--primary">
        <div class="device-detail__card-head">
          <h2 class="device-detail__card-title">设备专属数据</h2>
          <span v-if="lastReportText" class="device-detail__stamp">最近上报 {{ lastReportText }}</span>
        </div>

        <!-- 计量参数：CT / PT 变比取自设备参数，只读展示 -->
        <div class="device-detail__metric-group">
          <p class="device-detail__metric-title">
            <i class="device-detail__metric-bar" />
            计量参数
          </p>
          <div class="device-detail__metrics">
            <div class="device-detail__metric">
              <span class="device-detail__metric-label">CT 变比</span>
              <span class="device-detail__metric-value">
                <em>{{ ctRatio || '—' }}</em>
                <small v-if="ctRatio">倍</small>
              </span>
            </div>
            <div class="device-detail__metric">
              <span class="device-detail__metric-label">PT 变比</span>
              <span class="device-detail__metric-value">
                <em>{{ ptRatio || '—' }}</em>
                <small v-if="ptRatio">倍</small>
              </span>
            </div>
          </div>
        </div>

        <div v-if="!device.type" class="device-detail__empty">
          设备类型由设备上云后服务端返回，上云后在此展示该类型的专属数据
        </div>

        <div v-else-if="!typeGroups.length" class="device-detail__empty">
          该设备类型的专属数据待补充
        </div>

        <template v-else>
          <div v-for="group in typeGroups" :key="group.title" class="device-detail__metric-group">
            <p class="device-detail__metric-title">
              <i class="device-detail__metric-bar" />
              {{ group.title }}
            </p>
            <div class="device-detail__metrics">
              <div v-for="field in group.fields" :key="field.name" class="device-detail__metric">
                <span class="device-detail__metric-label">{{ field.name }}</span>
                <span class="device-detail__metric-value">
                  <em>{{ device.metrics[field.name] || '—' }}</em>
                  <small v-if="field.unit">{{ field.unit }}</small>
                </span>
              </div>
            </div>
          </div>
        </template>
      </section>

      <!-- CARD-05 关联负荷策略：设备是否被负荷策略作用，及其触发方式与策略清单 -->
      <section class="device-detail__card">
        <div class="device-detail__card-head">
          <h2 class="device-detail__card-title">关联负荷策略</h2>
          <span v-if="relatedStrategies.length" class="device-detail__stamp">共 {{ relatedStrategies.length }} 条</span>
        </div>

        <div v-if="!relatedStrategies.length" class="device-detail__strategy-empty">
          <DisconnectOutlined class="device-detail__strategy-empty-icon" />
          <p class="device-detail__strategy-empty-title">未关联负荷策略</p>
          <p class="device-detail__strategy-empty-desc">该设备当前未被任何负荷策略作用，不会被时控或负控自动拉合闸</p>
        </div>

        <template v-else>
          <div class="device-detail__strategy-summary">
            <span
              v-for="item in triggerSummary"
              :key="item.type"
              class="device-detail__strategy-chip"
              :class="item.type === '时控' ? 'is-time' : 'is-load'"
            >
              {{ item.type }} {{ item.count }} 条
            </span>
          </div>
          <ul class="device-detail__strategy-list">
            <li v-for="strategy in relatedStrategies" :key="strategy.id" class="device-detail__strategy-item">
              <div class="device-detail__strategy-main">
                <span class="device-detail__strategy-name" :title="strategy.name">{{ strategy.name }}</span>
                <span class="device-detail__strategy-type" :class="strategy.triggerType === '时控' ? 'is-time' : 'is-load'">
                  {{ strategy.triggerType }}
                </span>
                <span class="device-detail__strategy-state" :class="stateClassOf(strategy)">
                  {{ effectiveStateOf(strategy) }}
                </span>
              </div>
              <p class="device-detail__strategy-cond">{{ summaryText(strategy) }}</p>
            </li>
          </ul>
        </template>
      </section>

      <!-- CARD-06 上下线记录（只读，按在线会话聚合，保留最近 30 天） -->
      <DeviceSessionCard :device="device" />
    </template>

    <!-- OVERLAY-09 MQTT 通讯日志（只读，仅保留最近 30 天） -->
    <DeviceMqttLogDrawer v-model:open="mqttOpen" :device="device" />

    <!-- OVERLAY-10 设备控制：校时 / 抄表 / 合闸 / 分闸 / 重连 -->
    <DeviceControlDialog v-model:open="controlOpen" :device="device" />

    <!-- OVERLAY-11 设备参数配置：PT / CT 等可配置项，支持抄读与下发 -->
    <DeviceParamDrawer v-model:open="paramOpen" :device="device" />

    <ProtoTip :lines="tipLines" @reset="handleResetData">
      <template #extra>
        <a-button size="small" @click="simulateLoadFail">模拟加载失败</a-button>
      </template>
    </ProtoTip>
  </div>
</template>

<script setup lang="ts">
/**
 * PAGE-02 设备详情
 * 【原型说明】以「设备专属数据」为主角呈现单台设备的运行概览，档案信息默认折叠。
 * 版块顺序：设备档案（默认折叠）/ 设备专属数据（含计量参数，按类型与相别分组）/ 关联负荷策略 / 上下线记录；
 * 顶部信息区展示在线状态、拉合闸状态与 4G 信号强度；返回入口在页面左上角。
 * 本页为只读运行视图：设备的建档与归属维护在「设备台账」列表页完成，
 * 故不提供编辑 / 迁移 / 删除入口；顶部工具栏只提供设备侧的操作能力——
 * 「设备控制」（校时 / 抄表 / 合闸 / 分闸 / 重连，需二次确认）、
 * 「设备参数」（PT / CT 等可配置项，支持抄读与下发）、
 * 「MQTT 通讯日志」（抽屉，只读，保留最近 30 天）。
 * 设备关联的历史告警不在本页展示，统一在「告警中心」按设备筛选查看。
 */
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { message } from 'antdv-next'
import {
  ArrowLeftOutlined,
  ControlOutlined,
  CopyOutlined,
  DeleteOutlined,
  DisconnectOutlined,
  DownOutlined,
  FileSearchOutlined,
  ReloadOutlined,
  SlidersOutlined,
} from '@antdv-next/icons'
import ProtoTip from '@/shared/components/ProtoTip.vue'
import { currentPermissions } from '@/modules/role/store'
import { effectiveStateOf, strategiesForDevice, summaryText } from '@/modules/power/store'
import type { Strategy } from '@/modules/power/store'
import DeviceControlDialog from '../components/DeviceControlDialog.vue'
import DeviceMqttLogDrawer from '../components/DeviceMqttLogDrawer.vue'
import DeviceParamDrawer from '../components/DeviceParamDrawer.vue'
import DeviceSessionCard from '../components/DeviceSessionCard.vue'
import {
  deviceRatioValues,
  formatCoordinate,
  formatTime,
  getDevice,
  isUnitInvalid,
  resetDeviceLedgerData,
  typeGroupsOf,
  unitPath,
} from '../store'

const route = useRoute()
const router = useRouter()

/* ---------- 权限 ---------- */
const perms = computed(() => currentPermissions())
const canView = computed(() => perms.value.includes('device:ledger'))
/** 「设备参数」按钮依赖权限点；「设备控制」入口常显，其下指令在弹窗内按指令级权限逐项判定 */
const canParam = computed(() => perms.value.includes('device:ledger:param'))

const deviceId = computed(() => String(route.params.id ?? ''))

/* ---------- 加载与状态 ---------- */
const loading = ref(true)
const failed = ref(false)

function loadDetail() {
  loading.value = true
  failed.value = false
  window.setTimeout(() => {
    loading.value = false
  }, 420)
}

function simulateLoadFail() {
  loading.value = true
  failed.value = false
  window.setTimeout(() => {
    loading.value = false
    failed.value = true
  }, 420)
}

/** 设备已被删除时 getDevice 返回 null，页面展示对应状态（STATE-DEV-20） */
const device = computed(() => getDevice(deviceId.value))

const unitInvalid = computed(() => (device.value ? isUnitInvalid(device.value.unitId) : false))

/* ---------- CARD-07 设备档案折叠态：默认收起，让专属数据优先占用首屏 ---------- */
const archiveOpen = ref(false)

/* ---------- CARD-04 专属数据区（置顶） ---------- */
const typeGroups = computed(() => (device.value ? typeGroupsOf(device.value.type) : []))
/** 专属数据的时效标注：最近上报时间，未上报时不展示 */
const lastReportText = computed(() => (device.value?.lastReportAt ? formatTime(device.value.lastReportAt) : ''))

/** 仅通讯方式为 4G 的设备展示信号强度 */
const showSignal = computed(() => device.value?.commType === '4G')

/** 信号强度区间配色：≥20 良好、10-19 一般、<10 较差（CSQ 0-31 口径） */
const signalClass = computed(() => {
  const value = Number(device.value?.signalStrength)
  if (!Number.isFinite(value)) return 'is-weak'
  if (value >= 20) return 'is-good'
  if (value >= 10) return 'is-fair'
  return 'is-weak'
})

/** 信号强弱文案，用于数值的语义补充与悬停提示 */
const signalText = computed(() => {
  const value = Number(device.value?.signalStrength)
  if (!Number.isFinite(value)) return '未知'
  if (value >= 20) return '良好'
  if (value >= 10) return '一般'
  return '较差'
})

/** 条形图标组点亮格数（共 4 格）：按 CSQ 区间映射到 1-4 格，直观表达强弱 */
const signalLevel = computed(() => {
  const value = Number(device.value?.signalStrength)
  if (!Number.isFinite(value)) return 0
  if (value >= 24) return 4
  if (value >= 20) return 3
  if (value >= 10) return 2
  return 1
})

/** CT / PT 变比取值，取自设备参数（只读） */
const ratioValues = computed(() =>
  device.value ? deviceRatioValues(device.value) : { ct: '', pt: '' },
)
const ctRatio = computed(() => ratioValues.value.ct)
const ptRatio = computed(() => ratioValues.value.pt)

/* ---------- CARD-05 关联负荷策略 ---------- */
/** 该设备被哪些负荷策略作用（静态选中或动态范围覆盖） */
const relatedStrategies = computed<Strategy[]>(() => (device.value ? strategiesForDevice(device.value.id) : []))

/** 触发方式汇总：时控 / 负控各多少条 */
const triggerSummary = computed(() =>
  (['时控', '负控'] as const)
    .map((type) => ({ type, count: relatedStrategies.value.filter((item) => item.triggerType === type).length }))
    .filter((item) => item.count > 0),
)

/** 生效状态对应的样式类 */
function stateClassOf(strategy: Strategy) {
  const state = effectiveStateOf(strategy)
  if (state === '生效中') return 'is-active'
  if (state === '待生效') return 'is-pending'
  return 'is-inactive'
}

/* ---------- 设备侧操作入口：设备控制 / 设备参数 / MQTT 通讯日志 ---------- */
const mqttOpen = ref(false)
const controlOpen = ref(false)
const paramOpen = ref(false)

/* ---------- 复制 License ---------- */
async function copyLicense() {
  if (!device.value) return
  try {
    await navigator.clipboard.writeText(device.value.license)
    message.success('已复制')
  } catch {
    message.warning('复制失败，请手动选择')
  }
}

/* ---------- 返回列表（保留列表查询条件由浏览器历史承担） ---------- */
function goBack() {
  router.push('/device/ledger')
}

/* ---------- 演示提示 ---------- */
const tipLines = [
  '详情页版块顺序：设备档案（默认折叠）/ 设备专属数据（含计量参数，按类型与相别分组）/ 关联负荷策略 / 上下线记录；「返回」按钮在页面左上角。',
  '页面顶部信息区在同一行展示设备名称、类型、在线状态、拉合闸状态（合闸 / 分闸，由设备上报、只读）与信号强度（仅通讯方式为 4G 的设备有），各状态之间用竖线分隔；信号强度以条形图标组直观表达强弱（格数越多越强），数值作为辅助。',
  '「设备档案」默认收起，点击标题行展开：License 置首位，其次为设备识别码（IMEI）、表号、卡号（ICCID）、规格型号与安装位置信息。',
  '设备档案中的 License、设备识别码（IMEI）、表号与卡号（ICCID）由平台 / 网关 / 服务端返回，本页只读；表号为经上级网关通讯设备在网关侧的唯一标识，未返回时标注「未返回」。',
  'GPS 位置为设备级坐标：默认与所属用能单元一致（标注「同所属用能单元」），地图选点自定义后标注「设备自定义」。',
  '「设备专属数据」首组为计量参数（CT 变比 / PT 变比，取自设备参数、只读），其后按设备类型动态呈现：单相智能电表展示 A 相与电量两组，三相智能电表展示 A / B / C 相与电量四组；每项按「数值（大字号）+ 单位（小字）」展示，右上角标注最近上报时间。',
  '「关联负荷策略」展示该设备被哪些负荷策略作用：顶部按触发方式汇总「时控 / 负控」各多少条，列表逐条给出策略名称、触发方式、生效状态与触发条件摘要；未被任何策略作用时给出空态，避免与「无数据」混淆。',
  '「上下线记录」以事件流水展示最近 30 天的连接情况：上线与离线各自独立成一条记录，含时间、事件类型与说明（离线为断开原因），便于逐条排查某时刻发生了什么。',
  '上下线记录默认收起，只保留概览统计；点击标题行展开查询区与记录列表。',
  '上下线记录支持按事件类型（上线 / 离线）与时间范围（可选到时分秒）查询：查询条件为草稿态，必须点「查询」才作用于列表、点「重置」才清空条件；列表按分页展示（默认每页 10 条，可切换 20 / 50 条），避免设备频繁上下线时列表无限平铺。',
  '卡片头部的概览为紧凑内联呈现：上线次数、掉线次数与最近一次掉线时间，口径始终为保留期内全量记录，不随列表上的查询条件变化。',
  '本页不再展示「关联告警」：设备的历史告警统一在「告警中心」按所属设备筛选查看，避免同一份数据在两处口径不一致。',
  '本页为只读运行视图：设备建档、编辑、迁移、删除统一在「设备台账」列表页完成，详情页不再提供这三个入口，避免同一操作在两处出现。',
  '设备的变更记录（新增、批量添加、编辑、迁移与删除）统一在「系统管理 › 系统日志」中检索。',
  '「设备控制」支持 5 个指令：校时、抄表、合闸、分闸、重连；全部指令下发前均需二次确认，其中合闸、分闸影响现场供电，确认弹窗会突出风险提示。',
  '设备控制的前置条件是设备在线：离线设备会禁用全部指令并说明原因；每次指令下发都会在 MQTT 通讯日志中留下一条下行记录。',
  '「设备控制」入口常显（不设入口级权限点），其下 5 个指令各自独立授权：无某指令权限时该指令置灰并提示联系管理员；若 5 个指令权限均未授予，弹窗内给出统一提示且不展示指令清单。',
  '「设备参数」本期开放 PT（电压互感器变比）与 CT（电流互感器变比）两项计量参数，每项同时展示设备当前值与待下发值，可「从设备抄读」后修改并下发；其余参数（表计地址、接线方式、上报参数、通讯参数等）已登记为待规划，本期界面不呈现。',
  '参数配置按分组组织并只呈现本期开放项（当前为「计量参数」），新增或开放可配置项只需调整参数字典，抽屉会按分组自动适配，无需改动页面结构。',
  '「MQTT 通讯日志」由工具栏按钮打开抽屉查看：只读记录，仅保留最近 30 天，超期记录系统自动删除；支持按时间段（精确到时分秒）、通讯方向 / 结果与关键字筛选，可展开查看报文，失败记录会给出失败原因；有导出权限时可导出当前筛选结果。',
  '「设备参数」入口依赖权限点 `device:ledger:param`：无该权限的账号不显示按钮（不置灰、不提示）。',
]

function handleResetData() {
  resetDeviceLedgerData()
  loadDetail()
}

onMounted(loadDetail)
</script>
