<template>
  <!-- 页面级权限：无 `system:org` 时整页无权限空态（PRD 5.3 / 交互文档 CMP-ORG-10） -->
  <div v-if="!perms.view" class="page-container org-page">
    <div class="org-page__denied">
      <a-empty description="当前账号无权限执行此操作" />
      <a-button type="primary" @click="router.push('/dashboard')">返回</a-button>
    </div>
  </div>

  <div v-else class="page-container org-page">
    <!-- 页面标题区（AREA-ORG-01 / CMP-ORG-01、CMP-ORG-02） -->
    <header class="org-page__head">
      <h1 class="org-page__title">组织架构</h1>
      <p class="org-page__desc">维护企业的层级结构，用能单元作为设备与用能数据的最小落位</p>
    </header>

    <!-- 主体分栏：左树 360px + 右属性面板自适应（AREA-ORG-02） -->
    <div class="org-page__main">
      <OrgTreePanel
        v-model:keyword="keyword"
        :nodes="nodes"
        :selected-id="selectedId"
        :loading="loading"
        :failed="failed"
        :perms="perms"
        :dirty="dirty"
        :pending-switch-id="pendingSwitchId"
        :limit-reached="limitReached"
        :initial-expanded-keys="expandedKeys"
        @select="handleSelectNode"
        @locate="locateNode"
        @create="openCreate"
        @rename="openRename"
        @move="openMove"
        @sort="handleSort"
        @remove="openRemove"
        @confirm-switch="confirmSwitch"
        @cancel-switch="cancelSwitch"
        @retry="loadTree"
        @update:expanded-keys="expandedKeys = $event"
      />

      <OrgAttrPanel
        ref="attrRef"
        :node="selectedNode"
        :perms="perms"
        :saving="attrSaving"
        @rename="openRename"
        @locate="locateNode"
        @save="handleSaveAttrs"
        @dirty-change="dirty = $event"
      />
    </div>

    <!-- OVERLAY-01 新增下级节点 -->
    <a-modal
      v-model:open="createOpen"
      title="新增下级节点"
      :width="520"
      :mask-closable="!submitting"
      :ok-button-props="{ loading: submitting }"
      ok-text="确定"
      cancel-text="取消"
      @ok="handleCreateSubmit"
    >
      <a-form :model="createForm" layout="vertical">
        <a-form-item label="上级节点">
          <a-input :value="createParentPath" disabled />
        </a-form-item>
        <a-form-item label="节点类型" required>
          <a-radio-group v-model:value="createForm.kind" button-style="solid">
            <a-radio-button value="org">组织节点</a-radio-button>
            <a-radio-button value="unit">用能单元</a-radio-button>
          </a-radio-group>
        </a-form-item>
        <a-form-item
          label="节点名称"
          required
          :validate-status="createNameError ? 'error' : undefined"
          :help="createNameError ?? undefined"
        >
          <a-input v-model:value="createForm.name" show-count :maxlength="NAME_MAX" placeholder="请输入节点名称" />
        </a-form-item>
        <a-form-item label="负责人">
          <a-select
            v-model:value="createForm.ownerId"
            show-search
            allow-clear
            option-filter-prop="label"
            placeholder="请选择成员（可留空）"
            :options="ownerOptions"
            :not-found-content="hasMember ? undefined : '暂无成员'"
          />
        </a-form-item>
        <a-form-item
          label="GPS 坐标"
          required
          :validate-status="createCoordinateMessage ? 'error' : undefined"
          :help="createCoordinateMessage ?? undefined"
        >
          <GpsPicker v-model:lng="createForm.lng" v-model:lat="createForm.lat" @update:error="createGpsError = $event" />
        </a-form-item>
        <a-form-item label="详细地址" :validate-status="createAddressError ? 'error' : undefined" :help="createAddressError ?? undefined">
          <a-input v-model:value="createForm.address" :maxlength="ADDRESS_MAX" placeholder="请输入详细地址" />
        </a-form-item>
        <a-form-item label="备注" :validate-status="createRemarkError ? 'error' : undefined" :help="createRemarkError ?? undefined">
          <a-textarea v-model:value="createForm.remark" :rows="3" show-count :maxlength="REMARK_MAX" placeholder="请输入备注" />
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- OVERLAY-02 重命名节点 -->
    <a-modal
      v-model:open="renameOpen"
      title="重命名节点"
      :width="480"
      :mask-closable="!submitting"
      :ok-button-props="{ loading: submitting }"
      ok-text="确定"
      cancel-text="取消"
      @ok="handleRenameSubmit"
    >
      <p class="org-modal__path">{{ renamePath }}</p>
      <a-form-item :validate-status="renameError ? 'error' : undefined" :help="renameError ?? undefined">
        <a-input
          ref="renameInputRef"
          v-model:value="renameForm.name"
          show-count
          :maxlength="NAME_MAX"
          placeholder="请输入节点名称"
        />
      </a-form-item>
    </a-modal>

    <!-- OVERLAY-03 移动节点 -->
    <a-modal
      v-model:open="moveOpen"
      title="移动节点"
      :width="520"
      :mask-closable="!submitting"
      :ok-button-props="{ loading: submitting, disabled: !moveTargetId }"
      ok-text="确定"
      cancel-text="取消"
      @ok="handleMoveSubmit"
    >
      <p class="org-modal__path">待移动：{{ movePath }}</p>
      <div class="org-modal__tree">
        <a-tree
          :tree-data="moveTreeData"
          :selected-keys="moveTargetId ? [moveTargetId] : []"
          :default-expand-all="true"
          block-node
          @select="handleMoveSelect"
        />
      </div>
      <p class="org-modal__hint">自身及其下级节点不可选；用能单元不可作为目标上级</p>
    </a-modal>

    <!-- OVERLAY-04 删除节点确认 -->
    <a-modal
      v-model:open="removeOpen"
      title="确认删除该节点？"
      :width="440"
      :mask-closable="!submitting"
      :ok-button-props="{ loading: submitting, danger: true }"
      ok-text="确认删除"
      cancel-text="取消"
      @ok="handleRemoveSubmit"
    >
      <p class="org-modal__path">{{ removePath }}</p>
      <p class="org-modal__hint">
        删除后该节点将从组织架构中移除，操作不可恢复。若该节点已被设备或用能数据引用，删除后相关数据将失去归属。
      </p>
    </a-modal>

    <ProtoTip :lines="tipLines" @reset="handleResetData">
      <template #extra>
        <a-space size="small" wrap>
          <a-button size="small" @click="simulateLoadFail">模拟加载失败</a-button>
          <a-button size="small" @click="simulateNodeLimit">模拟节点达上限</a-button>
        </a-space>
      </template>
    </ProtoTip>
  </div>
</template>

<script setup lang="ts">
/**
 * PAGE-01 组织架构
 * 【原型说明】对齐《产品交互设计文档-组织架构》v1.0 4.1（PAGE-01）与第 5 章（OVERLAY-01~04）。
 * 覆盖结构维护（新增下级、重命名、移动、同级排序、删除）、节点属性编辑、GPS 地图选点、
 * 用能单元列表（筛选 / 分页 / 定位）、搜索定位、根节点只读、节点上限、变更写日志
 * 与各异常分支（EX-ORG-01~EX-ORG-24）。
 */
import { computed, nextTick, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { message } from 'antdv-next'
import type { TreeDataNode } from 'antdv-next'
import ProtoTip from '@/shared/components/ProtoTip.vue'
import OrgTreePanel from '../components/OrgTreePanel.vue'
import OrgAttrPanel from '../components/OrgAttrPanel.vue'
import GpsPicker from '../components/GpsPicker.vue'
import { currentPermissions } from '@/modules/role/store'
import {
  ADDRESS_MAX,
  createNode,
  getNode,
  getPath,
  getPathText,
  getRoot,
  getSubtreeIds,
  isLimitReached,
  memberOptions,
  hasSelectableMember,
  moveNode,
  NAME_MAX,
  nodes as storeNodes,
  normalizeText,
  persistNodes,
  REMARK_MAX,
  removeNode,
  renameNode,
  resetOrgData,
  saveAttributes,
  sortNode,
  validateAddress,
  validateCoordinate,
  validateName,
  validateRemark,
} from '../store'
import type { NodeAttrsInput, OrgNode, OrgPerms } from '../store'

/* ---------- 权限点：本页自身与各操作入口按权限点渲染（PRD 5.3 / 角色管理 7.4） ---------- */
/**
 * `system:org` 代表「可进入组织架构并查看」，无此权限点时整页展示无权限空态；
 * 其余为按钮级权限点，逐项控制新增下级 / 重命名 / 移动 / 同级排序 / 删除 / 属性编辑入口，
 * 无权限的入口直接不渲染，不做无权限提示（交互文档 CMP-ORG-10 / STATE-ORG-09）。
 */
const perms = computed<OrgPerms>(() => ({
  view: has('system:org'),
  create: has('system:org:node:create'),
  rename: has('system:org:node:rename'),
  move: has('system:org:node:move'),
  sort: has('system:org:node:sort'),
  remove: has('system:org:node:delete'),
  editAttr: has('system:org:node:attr:edit'),
}))

function has(key: string) {
  return currentPermissions().includes(key)
}

/* ---------- 树加载与展开状态 ---------- */
const router = useRouter()
const loading = ref(true)
const failed = ref(false)
const nodes = computed<OrgNode[]>(() => storeNodes)
const rootId = computed(() => getRoot()?.id ?? '')
const expandedKeys = ref<string[]>([])

const selectedId = ref<string | null>(null)
const selectedNode = computed(() => (selectedId.value ? getNode(selectedId.value) : null))

const keyword = ref('')
const limitReached = computed(() => isLimitReached())

const attrRef = ref<InstanceType<typeof OrgAttrPanel> | null>(null)
const dirty = ref(false)
const attrSaving = ref(false)
/** 属性编辑中待切换的目标节点，用于 Popconfirm 确认放弃修改 */
const pendingSwitchId = ref<string | null>(null)

const ownerOptions = computed(() => memberOptions())

/** 企业成员全部停用或成员列表为空时，成员选择器展示空态（EX-ORG-19） */
const hasMember = computed(() => hasSelectableMember())

/** 【原型说明】模拟树加载耗时，无真实接口调用 */
function loadTree() {
  loading.value = true
  failed.value = false
  window.setTimeout(() => {
    loading.value = false
    expandedKeys.value = rootId.value ? [rootId.value] : []
    if (!selectedId.value) selectedId.value = rootId.value || null
  }, 420)
}

onMounted(loadTree)

/* ---------- 选中与定位 ---------- */

function handleSelectNode(id: string) {
  // 属性编辑中存在未保存修改时，先确认再切换（EX-ORG-11）
  if (dirty.value && selectedId.value !== id) {
    pendingSwitchId.value = id
    return
  }
  selectedId.value = id
}

function locateNode(id: string) {
  if (dirty.value && selectedId.value !== id) {
    pendingSwitchId.value = id
    return
  }
  // 展开命中节点所在的完整路径，并退出搜索态
  const pathIds = getPath(id).map((node) => node.id)
  expandedKeys.value = Array.from(new Set([...expandedKeys.value, ...pathIds]))
  keyword.value = ''
  selectedId.value = id
}

function confirmSwitch() {
  const target = pendingSwitchId.value
  pendingSwitchId.value = null
  dirty.value = false
  if (target) {
    const pathIds = getPath(target).map((node) => node.id)
    expandedKeys.value = Array.from(new Set([...expandedKeys.value, ...pathIds]))
    selectedId.value = target
  }
}

function cancelSwitch() {
  pendingSwitchId.value = null
}

/* ---------- OVERLAY-01 新增下级 ---------- */

const createOpen = ref(false)
const submitting = ref(false)
const createForm = reactive<{ parentId: string; kind: 'org' | 'unit'; name: string; ownerId: string | null; address: string; lng: number | null; lat: number | null; remark: string }>({
  parentId: '',
  kind: 'org',
  name: '',
  ownerId: null,
  address: '',
  lng: null,
  lat: null,
  remark: '',
})

const createParentPath = computed(() => (createForm.parentId ? getPathText(createForm.parentId) : ''))
const createNameError = computed(() =>
  createForm.name ? validateName(createForm.name, createForm.parentId) : null,
)
const createAddressError = computed(() => validateAddress(createForm.address))
const createRemarkError = computed(() => validateRemark(createForm.remark))
const createGpsError = ref<string | null>(null)
/** 新增弹窗的必填提示同样在「点过确定」后才出现，避免一打开表单就飘红 */
const createTriedSubmit = ref(false)
/** GPS 坐标必填：取值范围提示优先，必填提示仅在尝试提交后出现 */
const createCoordinateMessage = computed(
  () => createGpsError.value ?? (createTriedSubmit.value ? validateCoordinate(createForm.lng, createForm.lat) : null),
)

function openCreate(parentId: string) {
  const parent = getNode(parentId)
  if (!parent) {
    message.warning('请先选择一个节点')
    return
  }
  if (parent.kind === 'unit') {
    message.warning('用能单元为最小计量单元，不能再新增下级')
    return
  }
  if (limitReached.value) {
    message.warning('节点数量已达上限（500），请先清理不再使用的节点')
    return
  }
  createForm.parentId = parentId
  createForm.kind = 'org'
  createForm.name = ''
  createForm.ownerId = null
  createForm.address = ''
  createForm.lng = null
  createForm.lat = null
  createForm.remark = ''
  createGpsError.value = null
  createTriedSubmit.value = false
  createOpen.value = true
}

async function handleCreateSubmit() {
  const nameError = validateName(createForm.name, createForm.parentId)
  if (nameError || !normalizeText(createForm.name)) {
    message.error('请输入正确的节点名称')
    return
  }
  // GPS 坐标为必填：未选点或数值非法时拦截并让表单展示提示
  const coordinateIssue = createCoordinateMessage.value ?? validateCoordinate(createForm.lng, createForm.lat)
  if (coordinateIssue) {
    createTriedSubmit.value = true
    message.error(coordinateIssue)
    return
  }
  if (createAddressError.value || createRemarkError.value) return
  submitting.value = true
  try {
    const node = await createNode({
      parentId: createForm.parentId,
      name: createForm.name,
      kind: createForm.kind,
      ownerId: createForm.ownerId,
      address: createForm.address,
      lng: createForm.lng,
      lat: createForm.lat,
      remark: createForm.remark,
    })
    createOpen.value = false
    createForm.lng = null
    createForm.lat = null
    expandedKeys.value = Array.from(new Set([...expandedKeys.value, createForm.parentId]))
    selectedId.value = node.id
    dirty.value = false
    message.success('新增成功')
  } catch (error) {
    message.error(error instanceof Error ? error.message : '保存失败，请重试')
  } finally {
    submitting.value = false
  }
}

/* ---------- OVERLAY-02 重命名 ---------- */

const renameOpen = ref(false)
const renameForm = reactive({ id: '', name: '' })
const renameInputRef = ref<{ focus: () => void; select: () => void } | null>(null)
const renameError = computed(() => (renameForm.name ? validateName(renameForm.name, getNode(renameForm.id)?.parentId ?? null, renameForm.id) : null))
const renamePath = computed(() => (renameForm.id ? getPathText(renameForm.id) : ''))

function openRename(id: string) {
  const node = getNode(id)
  if (!node) return
  if (node.kind === 'root') {
    message.warning('根节点名称不可修改')
    return
  }
  renameForm.id = id
  renameForm.name = node.name
  renameOpen.value = true
  // 弹窗内容渲染后输入框获得焦点并全选（交互文档 5.2）
  nextTick(() => {
    renameInputRef.value?.focus()
    renameInputRef.value?.select()
  })
}

async function handleRenameSubmit() {
  const node = getNode(renameForm.id)
  if (!node) return
  if (!normalizeText(renameForm.name)) {
    message.error('请输入节点名称')
    return
  }
  if (renameError.value) return
  // 名称未变化时直接关闭，不产生保存请求（交互文档 5.2）
  if (node.name === normalizeText(renameForm.name)) {
    renameOpen.value = false
    return
  }
  submitting.value = true
  try {
    await renameNode(renameForm.id, renameForm.name)
    renameOpen.value = false
    message.success('重命名成功')
  } catch (error) {
    message.error(error instanceof Error ? error.message : '保存失败，请重试')
  } finally {
    submitting.value = false
  }
}

/* ---------- OVERLAY-03 移动 ---------- */

const moveOpen = ref(false)
const moveForm = reactive({ id: '', targetId: '' })
const movePath = computed(() => (moveForm.id ? getPathText(moveForm.id) : ''))
const moveTargetId = computed(() => moveForm.targetId)

/** 自身及其子孙节点与用能单元在目标树中不可选（EX-ORG-09、PRD F-ORG-05） */
const moveTreeData = computed<TreeDataNode[]>(() => {
  const forbidden = new Set(moveForm.id ? getSubtreeIds(moveForm.id) : [])
  const childrenMap = new Map<string | null, OrgNode[]>()
  nodes.value.forEach((node) => {
    const list = childrenMap.get(node.parentId) ?? []
    list.push(node)
    childrenMap.set(node.parentId, list)
  })
  childrenMap.forEach((list) => list.sort((a, b) => a.order - b.order))
  const build = (parentId: string | null): TreeDataNode[] =>
    (childrenMap.get(parentId) ?? []).map((node) => {
      const children = build(node.id)
      return {
        key: node.id,
        title: node.name,
        disabled: forbidden.has(node.id) || node.kind === 'unit',
        children: children.length ? children : undefined,
      }
    })
  return build(null)
})

function openMove(id: string) {
  const node = getNode(id)
  if (!node) return
  if (node.kind === 'root') {
    message.warning('根节点不可移动')
    return
  }
  moveForm.id = id
  moveForm.targetId = ''
  moveOpen.value = true
}

function handleMoveSelect(_keys: Array<string | number>, info: { node: { key?: string | number } }) {
  moveForm.targetId = String(info.node.key ?? '')
}

async function handleMoveSubmit() {
  if (!moveForm.targetId) {
    message.error('请选择目标上级节点')
    return
  }
  submitting.value = true
  try {
    await moveNode(moveForm.id, moveForm.targetId)
    moveOpen.value = false
    const pathIds = getPath(moveForm.id).map((node) => node.id)
    expandedKeys.value = Array.from(new Set([...expandedKeys.value, ...pathIds]))
    selectedId.value = moveForm.id
    message.success('移动成功')
  } catch (error) {
    message.error(error instanceof Error ? error.message : '保存失败，请重试')
  } finally {
    submitting.value = false
  }
}

/* ---------- 同级排序 ---------- */

async function handleSort(id: string, direction: 'up' | 'down') {
  try {
    await sortNode(id, direction)
    message.success('排序已更新')
  } catch (error) {
    message.error(error instanceof Error ? error.message : '排序失败，请重试')
  }
}

/* ---------- OVERLAY-04 删除 ---------- */

const removeOpen = ref(false)
const removeForm = reactive({ id: '' })
const removePath = computed(() => (removeForm.id ? getPathText(removeForm.id) : ''))

function openRemove(id: string) {
  const node = getNode(id)
  if (!node) return
  if (node.kind === 'root') {
    message.warning('根节点不可删除')
    return
  }
  const childCount = nodes.value.filter((item) => item.parentId === id).length
  if (childCount > 0) {
    message.warning('该节点下存在下级节点，请先删除或移动其下级')
    return
  }
  removeForm.id = id
  removeOpen.value = true
}

async function handleRemoveSubmit() {
  const parentId = getNode(removeForm.id)?.parentId ?? null
  submitting.value = true
  try {
    await removeNode(removeForm.id)
    removeOpen.value = false
    selectedId.value = parentId ?? rootId.value
    dirty.value = false
    message.success('节点已删除')
  } catch (error) {
    message.error(error instanceof Error ? error.message : '删除失败，请重试')
  } finally {
    submitting.value = false
  }
}

/* ---------- 属性编辑 ---------- */

async function handleSaveAttrs(id: string, attrs: NodeAttrsInput) {
  attrSaving.value = true
  try {
    await saveAttributes(id, attrs)
    attrRef.value?.finishEdit()
    dirty.value = false
    message.success('属性已保存')
  } catch (error) {
    message.error(error instanceof Error ? error.message : '保存失败，请重试')
  } finally {
    attrSaving.value = false
  }
}

/* ---------- 演示提示 ---------- */

const tipLines = [
  '本页按当前账号的权限点渲染：需具备「组织架构」权限点（system:org）才能进入，否则整页展示无权限空态。',
  '结构维护入口逐项受按钮级权限点控制：新增下级（system:org:node:create）、重命名（system:org:node:rename）、移动（system:org:node:move）、排序（system:org:node:sort）、删除（system:org:node:delete）、属性编辑（system:org:node:attr:edit）；无权限的入口不渲染。',
  '企业根节点在本页只读：不展示「更多」操作区，无法重命名、移动、删除，仅可新增下级。',
  '右侧属性面板下方列出当前节点及其全部下级的用能单元（名称 / 用能单元编码 / GPS 坐标 / 所属组织节点全路径），点击名称可定位到左侧树；列表默认每页 20 条，可切换 10 / 20 / 50 / 100 条。',
  '结构维护入口在树节点行右侧并常显：组织节点行有「新增下级」与「更多」，用能单元行仅有「更多」，企业根节点行仅有「新增下级」。',
  'GPS 坐标为必填：点「地图选点」打开地图弹窗，可按地点名称查询定位，或在地图上双击确定位置，点「确定」后回填经纬度；未选点时保存会被拦截。',
  '节点负责人为成员选择器，可留空保存，用于验证「结构先建、负责人后补」的场景。',
  '用能单元为叶子节点，不展示「新增下级」入口；组织节点与用能单元的图标不同，可一眼区分。',
  '有下级节点时「删除」项置灰，用于验证「请先删除或移动其下级」的拦截。',
  '所有结构与属性变更都会写入变更记录（对应 PRD F-ORG-09），正式入口为「系统管理 › 系统日志」。',
  '搜索「A 栋」等关键字可验证命中关键字高亮与定位；输入无匹配内容可验证搜索无结果状态。',
  '属性编辑中切换节点会弹出确认，用于验证「未保存修改」的保护逻辑。',
  '下方按钮可快速验证加载失败与节点达上限两种状态，验证后请重置演示数据。',
]

function handleResetData() {
  resetOrgData()
  keyword.value = ''
  dirty.value = false
  selectedId.value = null
  loadTree()
}

/** 【原型说明】模拟加载失败，用于验证错误态与重试（STATE-ORG-06 / EX-ORG-01） */
function simulateLoadFail() {
  loading.value = true
  failed.value = false
  window.setTimeout(() => {
    loading.value = false
    failed.value = true
  }, 420)
}

/** 【原型说明】把演示结构补到上限，用于验证节点达上限时的拦截与提示（STATE-ORG-10） */
function simulateNodeLimit() {
  if (isLimitReached()) {
    message.info('当前已是节点数量上限（500）')
    return
  }
  const root = getRoot()
  if (!root) return
  let order = nodes.value.filter((node) => node.parentId === root.id).length
  while (storeNodes.length < 500) {
    storeNodes.push({
      id: `NODE-DEMO-${storeNodes.length}`,
      parentId: root.id,
      name: `演示用能单元 ${storeNodes.length}`,
      kind: 'unit',
      order: order++,
      ownerId: null,
      address: '',
      lng: null,
      lat: null,
      unitCode: `UNIT-DEMO-${storeNodes.length}`,
      remark: '【原型说明】为验证节点数量上限而生成的演示数据',
      createdAt: Date.now(),
    })
  }
  message.success('已补充演示节点至上限（500）')
  persistNodes()
}
</script>
