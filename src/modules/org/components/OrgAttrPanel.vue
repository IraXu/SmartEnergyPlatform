<template>
  <section class="org-attr" aria-label="节点属性">
    <!-- 未选中任何节点：引导态（CMP-ORG-16） -->
    <div v-if="!node" class="org-attr__empty">
      <a-empty description="请从左侧选择一个节点查看详细信息" />
    </div>

    <template v-else>
      <!-- 面板头部：节点类型图标 + 名称 + 类型标签 + 操作入口（CMP-ORG-08、CMP-ORG-11） -->
      <header class="org-attr__head">
        <div class="org-attr__title">
          <span class="org-attr__title-icon" :class="`org-attr__title-icon--${node.kind}`">
            <component :is="kindIcon" />
          </span>
          <span class="org-attr__name" :title="node.name">{{ node.name }}</span>
          <a-tag class="org-attr__kind" :class="`org-attr__kind--${node.kind}`">{{ kindText }}</a-tag>
        </div>
        <div class="org-attr__head-actions">
          <a-button v-if="canRename" type="link" size="small" @click="emit('rename', node.id)">
            重命名
          </a-button>
          <a-button v-if="canEditAttr && !editing" type="link" size="small" @click="startEdit">编辑</a-button>
        </div>
      </header>

      <!-- 只读态：属性项（CMP-ORG-13）。短字段两列并排、长字段占满整行，避免单列铺满导致的稀疏感。
           根节点（企业）由注册信息自动生成，只呈现层级路径、下级节点数量与备注三项。 -->
      <div v-if="!editing" class="org-attr__grid">
        <div class="org-attr__field org-attr__field--full">
          <span class="org-attr__label">层级路径</span>
          <a-breadcrumb class="org-attr__path">
            <a-breadcrumb-item v-for="item in path" :key="item.id">
              <a class="org-attr__path-link" @click="emit('locate', item.id)">{{ item.name }}</a>
            </a-breadcrumb-item>
          </a-breadcrumb>
        </div>

        <div class="org-attr__field" :class="{ 'org-attr__field--full': node.kind === 'root' }">
          <span class="org-attr__label">下级节点数量</span>
          <span class="org-attr__value">{{ childCount }}</span>
        </div>

        <template v-if="node.kind !== 'root'">
          <div class="org-attr__field">
            <span class="org-attr__label">节点负责人</span>
            <span class="org-attr__value" :class="{ 'org-attr__value--empty': !ownerText }">{{ ownerText || '—' }}</span>
          </div>

          <div v-if="node.kind === 'unit'" class="org-attr__field">
            <span class="org-attr__label">用能单元编码</span>
            <span class="org-attr__value org-attr__value--code">{{ node.unitCode || '—' }}</span>
          </div>

          <div class="org-attr__field" :class="{ 'org-attr__field--full': node.kind !== 'unit' }">
            <span class="org-attr__label">GPS 坐标</span>
            <span class="org-attr__value" :class="{ 'org-attr__value--empty': coordinateText === '—' }">
              {{ coordinateText }}
            </span>
          </div>

          <div class="org-attr__field org-attr__field--full">
            <span class="org-attr__label">详细地址</span>
            <span class="org-attr__value" :class="{ 'org-attr__value--empty': !node.address }">
              {{ node.address || '—' }}
            </span>
          </div>
        </template>

        <div class="org-attr__field org-attr__field--full">
          <span class="org-attr__label">备注</span>
          <span class="org-attr__value" :class="{ 'org-attr__value--empty': !node.remark }">
            {{ node.remark || '—' }}
          </span>
        </div>

        <div v-if="node.kind !== 'root'" class="org-attr__field org-attr__field--full">
          <span class="org-attr__label">创建时间</span>
          <span class="org-attr__value org-attr__value--muted">{{ createdText }}</span>
        </div>
      </div>

      <!-- 编辑态：负责人为成员选择器，详细地址手动填写，GPS 由地图选点回填（CMP-ORG-14） -->
      <a-form v-else :model="form" layout="vertical" class="org-attr__form">
        <a-form-item label="节点负责人" name="ownerId">
          <a-select
            v-model:value="form.ownerId"
            show-search
            allow-clear
            option-filter-prop="label"
            placeholder="请选择成员（可留空）"
            :options="ownerOptions"
            :not-found-content="hasMember ? undefined : '暂无成员'"
          />
          <p class="org-attr__hint">负责人可留空，待成员到位后再指定</p>
        </a-form-item>

        <a-form-item
          label="GPS 坐标"
          name="coordinate"
          required
          :validate-status="coordinateMessage ? 'error' : undefined"
          :help="coordinateMessage ?? undefined"
        >
          <GpsPicker
            v-model:lng="form.lng"
            v-model:lat="form.lat"
            @update:error="gpsError = $event"
          />
        </a-form-item>

        <a-form-item label="详细地址" name="address" :validate-status="addressError ? 'error' : undefined" :help="addressError ?? undefined">
          <a-input v-model:value="form.address" :maxlength="ADDRESS_MAX" placeholder="请输入详细地址" />
        </a-form-item>

        <a-form-item
          label="备注"
          name="remark"
          :validate-status="remarkError ? 'error' : undefined"
          :help="remarkError ?? undefined"
        >
          <a-textarea v-model:value="form.remark" :rows="3" show-count :maxlength="REMARK_MAX" placeholder="请输入备注" />
        </a-form-item>

        <div class="org-attr__form-footer">
          <a-alert
            v-if="dirty"
            type="warning"
            show-icon
            :closable="false"
            class="org-attr__unsaved"
            message="当前修改尚未保存，切换节点将丢失修改"
          />
          <a-space class="org-attr__form-actions">
            <a-button @click="cancelEdit">取消</a-button>
            <a-button type="primary" :loading="saving" @click="handleSave">保存</a-button>
          </a-space>
        </div>
      </a-form>

      <!-- 当前节点及其下级的用能单元列表：只在只读态展示，避免与编辑态表单争抢空间 -->
      <OrgUnitTable v-if="!editing" class="org-attr__units" :rows="unitRows" @locate="emit('locate', $event)" />
    </template>
  </section>
</template>

<script setup lang="ts">
/**
 * 【原型说明】节点属性面板，对齐交互设计文档 4.1.3 与 4.1.5。
 * 只读态展示层级路径、下级数量、用能单元编码、负责人、GPS 坐标、详细地址、备注、创建时间（按节点类型裁剪）；
 * 编辑态负责人为成员选择器（PRD Q-ORG-02：选填），详细地址手动填写，GPS 由地图选点回填且必填（PRD Q-ORG-07）；
 * 面板下方展示当前节点及其下级的用能单元列表（名称 / 用能单元编码 / GPS 坐标 / 所属组织节点全路径）。
 * 保存成功后写入变更记录；无编辑权限时只读（STATE-ORG-09）。
 */
import { computed, reactive, ref, watch } from 'vue'
import { ApartmentOutlined, BankOutlined, ThunderboltOutlined } from '@antdv-next/icons'
import GpsPicker from './GpsPicker.vue'
import OrgUnitTable from './OrgUnitTable.vue'
import {
  getChildCount,
  getNode,
  getPath,
  getUnitRows,
  hasSelectableMember,
  memberName,
  memberOptions,
  validateAddress,
  validateCoordinate,
  validateRemark,
  ADDRESS_MAX,
  REMARK_MAX,
} from '../store'
import type { OrgNode, OrgPerms } from '../store'

const props = defineProps<{
  node: OrgNode | null
  /** 【权限】当前账号可执行的组织架构操作（由页面按权限点推导后传入） */
  perms: OrgPerms
  saving: boolean
}>()

const emit = defineEmits<{
  rename: [nodeId: string]
  locate: [nodeId: string]
  save: [nodeId: string, attrs: { ownerId: string | null; address: string; lng: number | null; lat: number | null; remark: string }]
  dirtyChange: [dirty: boolean]
}>()

const editing = ref(false)

const form = reactive<{ ownerId: string | null; address: string; lng: number | null; lat: number | null; remark: string }>({
  ownerId: null,
  address: '',
  lng: null,
  lat: null,
  remark: '',
})

const gpsError = ref<string | null>(null)

const ownerOptions = computed(() => memberOptions())

/** 企业成员全部停用或成员列表为空时，成员选择器展示空态（EX-ORG-19） */
const hasMember = computed(() => hasSelectableMember())

const path = computed(() => (props.node ? getPath(props.node.id) : []))
const childCount = computed(() => (props.node ? getChildCount(props.node.id) : 0))
/** 当前节点及其全部下级的用能单元（PRD Q-ORG-05：用能单元为最小计量落位） */
const unitRows = computed(() => (props.node ? getUnitRows(props.node.id) : []))

/**
 * 根节点（企业）在本页完全只读：不展示重命名与编辑入口（PRD Q-ORG-01）。
 * 仅非根节点的属性可编辑；重命名与属性编辑各自对应独立权限点，需分别具备。
 */
const canRename = computed(() => props.perms.rename && !!props.node && props.node.kind !== 'root')
const canEditAttr = computed(
  () => props.perms.editAttr && !!props.node && props.node.kind !== 'root',
)

const kindText = computed(() => {
  if (!props.node) return ''
  if (props.node.kind === 'root') return '企业'
  return props.node.kind === 'unit' ? '用能单元' : '组织节点'
})

/** 头部图标与树中节点图标保持一致，强化「选中的就是树上这一行」的关联 */
const kindIcon = computed(() => {
  if (props.node?.kind === 'root') return BankOutlined
  if (props.node?.kind === 'unit') return ThunderboltOutlined
  return ApartmentOutlined
})

const ownerText = computed(() => memberName(props.node?.ownerId ?? null) || '—')
const coordinateText = computed(() => {
  const node = props.node
  if (!node || node.lng === null || node.lat === null) return '—'
  return `${node.lng}, ${node.lat}`
})
const createdText = computed(() => {
  if (!props.node) return '—'
  return formatTime(props.node.createdAt)
})

const addressError = computed(() => (editing.value ? validateAddress(form.address) : null))
const remarkError = computed(() => (editing.value ? validateRemark(form.remark) : null))
/** GPS 坐标必填：编辑态下未选点即报错，避免漏填导致设备与用能数据无处落位 */
const coordinateError = computed(() =>
  editing.value ? validateCoordinate(form.lng, form.lat) : null,
)
/** 未选点的必填报错在「点过保存」后才提示，避免刚打开编辑态就飘红 */
const triedSave = ref(false)
/** 取值范围提示（选了点但数值非法）优先于必填提示；必填提示仅在尝试保存后出现 */
const coordinateMessage = computed(() => gpsError.value ?? (triedSave.value ? coordinateError.value : null))

/** 与打开编辑时的快照对比，用于「未保存修改」提示与切换节点确认 */
const snapshot = ref('')
const serialized = computed(() =>
  JSON.stringify({ ownerId: form.ownerId, address: form.address, lng: form.lng, lat: form.lat, remark: form.remark }),
)
const dirty = computed(() => editing.value && serialized.value !== snapshot.value)

watch(dirty, (value) => emit('dirtyChange', value))

/** 切换选中节点时重置编辑态，避免残留上一个节点的填写内容 */
watch(
  () => props.node?.id,
  () => {
    editing.value = false
    fillForm(props.node)
  },
  { immediate: true },
)

function fillForm(node: OrgNode | null) {
  form.ownerId = node?.ownerId ?? null
  form.address = node?.address ?? ''
  form.lng = node?.lng ?? null
  form.lat = node?.lat ?? null
  form.remark = node?.remark ?? ''
  snapshot.value = serialized.value
}

function startEdit() {
  gpsError.value = null
  triedSave.value = false
  fillForm(props.node)
  editing.value = true
}

function cancelEdit() {
  editing.value = false
  gpsError.value = null
  triedSave.value = false
  fillForm(props.node)
}

function handleSave() {
  if (!props.node) return
  // 必填与取值范围校验都在此统一拦截，未选点时提示用户去地图选点
  if (gpsError.value || coordinateError.value || addressError.value || remarkError.value) {
    triedSave.value = true
    return
  }
  emit('save', props.node.id, {
    ownerId: form.ownerId,
    address: form.address,
    lng: form.lng,
    lat: form.lat,
    remark: form.remark,
  })
}

/** 保存成功后由页面回写；此处暴露给页面以便关闭编辑态 */
function finishEdit() {
  editing.value = false
  triedSave.value = false
  fillForm(getNode(props.node?.id ?? '') ?? null)
}

defineExpose({ finishEdit })

function formatTime(value: number) {
  return new Date(value).toLocaleString('zh-CN', { hour12: false, month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}
</script>
