<!--
  OVERLAY-01 设备明细抽屉（《产品交互设计文档-点位地图》v1.0 5.1）
  【原型说明】点击用能单元聚合标记后右侧滑出，上半部为该用能单元的档案摘要（只读），
  下半部为该用能单元下的设备明细列表（仅有坐标设备）。抽屉内不提供任何编辑入口。
  设备名称与「查看详情」依赖设备台账的 `device:ledger` 权限点：无权限时不渲染（不置灰、不提示）。
-->
<template>
  <a-drawer
    :open="open"
    placement="right"
    :size="drawerWidth"
    :closable="false"
    :styles="{ body: { padding: 0 } }"
    @close="close"
  >
    <div class="loc-drawer">
      <!-- 头部区：模块标识 + 用能单元名称 + 关闭按钮 -->
      <header class="loc-drawer__head">
        <span class="loc-drawer__head-icon" aria-hidden="true">
          <ThunderboltOutlined />
        </span>
        <div class="loc-drawer__head-text">
          <span class="loc-drawer__eyebrow">用能单元定位</span>
          <h3 class="loc-drawer__title" :title="profile?.name">{{ profile?.name || '设备明细' }}</h3>
        </div>
        <a-button type="text" size="small" aria-label="关闭" @click="close">
          <template #icon><CloseOutlined /></template>
        </a-button>
      </header>

      <!-- 信息区：档案摘要卡片（两列栅格，无值不渲染该项） -->
      <section v-if="profile" class="loc-drawer__profile" aria-label="用能单元信息">
        <div class="loc-drawer__field">
          <span class="loc-drawer__label">用能单元编码</span>
          <span class="loc-drawer__value loc-drawer__value--mono">{{ profile.unitCode }}</span>
        </div>
        <div class="loc-drawer__field">
          <span class="loc-drawer__label">GPS 坐标</span>
          <span class="loc-drawer__value loc-drawer__value--mono">{{ profile.coordinate }}</span>
        </div>
        <div class="loc-drawer__field loc-drawer__field--wide">
          <span class="loc-drawer__label">所属组织节点</span>
          <span class="loc-drawer__value">
            <template v-if="profile.orgInvalid">
              原层级路径已失效
              <span class="loc-drawer__invalid">所属组织节点已失效</span>
            </template>
            <template v-else>{{ profile.orgPath }}</template>
          </span>
        </div>
        <div v-if="profile.address" class="loc-drawer__field loc-drawer__field--wide">
          <span class="loc-drawer__label">详细地址</span>
          <span class="loc-drawer__value">{{ profile.address }}</span>
        </div>
        <div v-if="profile.remark" class="loc-drawer__field loc-drawer__field--wide">
          <span class="loc-drawer__label">备注</span>
          <span class="loc-drawer__value">{{ profile.remark }}</span>
        </div>
      </section>

      <!-- 明细区：设备明细 -->
      <section class="loc-drawer__detail" aria-label="设备明细">
        <div class="loc-drawer__detail-head">
          <span class="loc-drawer__detail-title">设备明细</span>
          <span class="loc-drawer__detail-count">共 {{ allRows.length }} 台</span>
        </div>

        <!-- 明细加载失败：局部错误态（STATE-LOC-11 / EX-LOC-13） -->
        <div v-if="failed" class="loc-drawer__state">
          <p class="loc-drawer__state-text">设备明细加载失败</p>
          <a-button size="small" @click="emit('reload')">
            <template #icon><ReloadOutlined /></template>
            重新加载
          </a-button>
        </div>

        <!-- 明细加载中 -->
        <div v-else-if="loading" class="loc-drawer__state">
          <a-spin size="small" />
          <p class="loc-drawer__state-text">正在加载设备明细…</p>
        </div>

        <!-- 明细空态：该用能单元下暂无（有坐标的）设备 -->
        <div v-else-if="!allRows.length" class="loc-drawer__state">
          <p class="loc-drawer__state-text">该用能单元下暂无设备</p>
          <a-button size="small" @click="gotoLedger">查看设备台账</a-button>
        </div>

        <a-table
          v-else
          :columns="columns"
          :data-source="allRows"
          :pagination="pagination"
          row-key="id"
          size="middle"
          :scroll="{ x: COLUMNS_MIN_WIDTH, y: tableScrollY }"
        >
          <template #bodyCell="{ column, record }">
            <!-- 设备名称始终为纯文本：进入设备详情的唯一入口是操作列「查看详情」，避免重复 -->
            <template v-if="column.key === 'name'">
              <span class="loc-drawer__name" :title="record.name">{{ record.name }}</span>
            </template>
            <template v-else-if="column.key === 'type'">
              <span class="loc-tag">{{ record.type }}</span>
            </template>
            <template v-else-if="column.key === 'online'">
              <span class="loc-online" :class="`loc-online--${stateClass(record.onlineState)}`">
                <i class="loc-online__dot" />
                {{ STATE_TEXT[record.onlineState as DeviceOnlineState] }}
              </span>
            </template>
            <template v-else-if="column.key === 'license'">
              <span class="loc-mono">{{ record.license }}</span>
            </template>
            <template v-else-if="column.key === 'action'">
              <a-button v-if="openDeviceDetail" type="link" size="small" @click="emit('view-detail', record.id)">
                查看详情
              </a-button>
            </template>
          </template>
        </a-table>
      </section>
    </div>
  </a-drawer>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import type { TableColumnsType } from 'antdv-next'
import { CloseOutlined, ReloadOutlined, ThunderboltOutlined } from '@antdv-next/icons'
import { LOAD_DELAY, ONLINE_STATE_TEXT, UNIT_PAGE_SIZE, UNIT_PAGE_SIZES } from '../store'
import { unitDeviceRows, unitProfile } from '../store'
import type { DeviceOnlineState } from '../store'

const props = defineProps<{
  /** 抽屉开关（v-model:open） */
  open: boolean
  /** 当前用能单元 id */
  unitId: string
  /** 是否渲染设备详情跳转入口（依赖 device:ledger 权限点） */
  openDeviceDetail: boolean
  /** 【原型说明】是否模拟明细加载失败，用于验证局部错误态 */
  fail: boolean
}>()

const emit = defineEmits<{
  'update:open': [boolean]
  /** 打开设备详情页 */
  'view-detail': [string]
  /** 请求重新加载明细 */
  reload: []
}>()

const STATE_TEXT = ONLINE_STATE_TEXT

const router = useRouter()

/**
 * 抽屉宽度：按视口自适应并设上下限——明细表 5 列固定合计 556px，加左右内边距后需 ≥ 600px
 * 才不触发横向滚动，因此下限取 640px；上限 880px 避免在超宽屏占满整屏影响地图浏览。
 */
const drawerWidth = computed(() =>
  Math.min(Math.max(Math.round(window.innerWidth * 0.46), 640), 880),
)

const loading = ref(false)
const page = ref(1)
const pageSize = ref(UNIT_PAGE_SIZE)

/** 明细表最小列宽合计（名称 148 + 类型 108 + 在线 88 + License 152 + 操作 60）；抽屉更窄时横向滚动 */
const COLUMNS_MIN_WIDTH = 556

/** 明细表可滚动高度：抽屉通高，扣除头部 56 + 档案摘要与区块头约 300 + 分页约 56 */
const tableScrollY = computed(() => Math.max(window.innerHeight - 420, 320))

const profile = computed(() => (props.unitId ? unitProfile(props.unitId) : null))
const allRows = computed(() => (props.unitId ? unitDeviceRows(props.unitId) : []))

const failed = computed(() => props.fail)

const columns: TableColumnsType = [
  { key: 'name', title: '设备名称', dataIndex: 'name', width: 148, ellipsis: true },
  { key: 'type', title: '设备类型', dataIndex: 'type', width: 108 },
  { key: 'online', title: '在线状态', dataIndex: 'onlineState', width: 88 },
  { key: 'license', title: 'License', dataIndex: 'license', width: 152 },
  { key: 'action', title: '操作', width: 60 },
]

const pagination = computed(() => ({
  current: page.value,
  pageSize: pageSize.value,
  total: allRows.value.length,
  pageSizeOptions: UNIT_PAGE_SIZES,
  showSizeChanger: true,
  size: 'small' as const,
  showTotal: (total: number) => `共 ${total} 条`,
  onChange: (nextPage: number, nextPageSize: number) => {
    page.value = nextPage
    pageSize.value = nextPageSize
  },
}))

/** 【原型说明】模拟明细加载耗时；切换用能单元或重新打开时回到第 1 页 */
watch(
  () => [props.unitId, props.open] as const,
  ([unitId, open]) => {
    if (!open || !unitId) return
    page.value = 1
    loading.value = true
    window.setTimeout(() => {
      loading.value = false
    }, LOAD_DELAY)
  },
  { immediate: true },
)

function stateClass(state: DeviceOnlineState) {
  return state === '在线' ? 'online' : 'offline'
}

function close() {
  emit('update:open', false)
}

function gotoLedger() {
  emit('update:open', false)
  router.push('/device/ledger')
}
</script>
