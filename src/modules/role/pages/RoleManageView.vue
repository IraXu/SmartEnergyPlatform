<template>
  <div v-if="!canView" class="page-container role-page">
    <div class="role-page__denied">
      <a-empty description="当前账号无权限执行此操作" />
      <a-button type="primary" @click="router.push('/dashboard')">返回</a-button>
    </div>
  </div>

  <div v-else class="page-container role-page">
    <!-- 页面标题区（AREA-ROL-01 / CMP-ROL-01、CMP-ROL-02） -->
    <header class="role-page__head">
      <h1 class="role-page__title">角色管理</h1>
      <p class="role-page__desc">定义角色的功能权限边界，成员通过绑定角色获得对应功能与数据范围</p>
    </header>

    <!-- 主体分栏：左角色列表 280px + 右权限面板自适应（AREA-ROL-02） -->
    <div class="role-page__main">
      <RoleListView
        v-model:keyword="keyword"
        :roles="roles"
        :selected-id="selectedId"
        :loading="listLoading"
        :failed="listFailed"
        :limit-reached="limitReached"
        :can-create="canCreate"
        :can-edit="canEdit"
        :can-remove="canRemove"
        @select="handleSelectRole"
        @create="openCreate"
        @retry="loadList"
        @menu="handleMenu"
      />

      <RolePermissionPanel
        :role="selectedRole"
        :permissions="savedPermissions"
        :draft="draft"
        :keyword="permKeyword"
        :loading="permLoading"
        :failed="permFailed"
        :failed-title="permFailedTitle"
        :saving="saving"
        :perm-updated="permUpdated"
        :can-config="canConfig"
        :can-edit="canEdit"
        :member-count="memberCount"
        @toggle="handleToggle"
        @select-all="handleSelectAll"
        @clear-all="openClearConfirm"
        @cancel="handleCancel"
        @save="openDiffConfirm"
        @rename="openRename"
        @retry="reloadPermissions"
        @view-members="openMembers"
        @dismiss-update="permUpdated = false"
        @update:keyword="permKeyword = $event"
      />
    </div>

    <!-- OVERLAY-01 新增角色（名称与权限分两步保存，PRD Q-ROL-06） -->
    <a-modal
      v-model:open="createOpen"
      title="新增角色"
      :width="480"
      :mask-closable="!submitting"
      :ok-button-props="{ loading: submitting }"
      ok-text="确定"
      cancel-text="取消"
      @ok="handleCreateSubmit"
    >
      <a-form :model="createForm" layout="vertical">
        <a-form-item
          label="角色名称"
          required
          :validate-status="createNameError ? 'error' : undefined"
          :help="createNameError ?? undefined"
        >
          <a-input
            v-model:value="createForm.name"
            show-count
            :maxlength="ROLE_NAME_MAX"
            placeholder="请输入角色名称"
          />
        </a-form-item>
        <a-form-item
          label="角色描述"
          :validate-status="createDescError ? 'error' : undefined"
          :help="createDescError ?? undefined"
        >
          <a-textarea
            v-model:value="createForm.desc"
            :rows="3"
            show-count
            :maxlength="ROLE_DESC_MAX"
            placeholder="请说明该角色的适用岗位（选填）"
          />
        </a-form-item>
      </a-form>
      <p class="role-modal__hint">创建后角色将自动选中，请在右侧勾选权限并点击「保存」完成配置。</p>
    </a-modal>

    <!-- OVERLAY-02 编辑角色 -->
    <a-modal
      v-model:open="renameOpen"
      title="编辑角色"
      :width="480"
      :mask-closable="!submitting"
      :ok-button-props="{ loading: submitting }"
      ok-text="保存"
      cancel-text="取消"
      @ok="handleRenameSubmit"
    >
      <a-form :model="renameForm" layout="vertical">
        <a-form-item
          label="角色名称"
          required
          :validate-status="renameNameError ? 'error' : undefined"
          :help="renameNameError ?? undefined"
        >
          <a-input
            ref="renameNameRef"
            v-model:value="renameForm.name"
            show-count
            :maxlength="ROLE_NAME_MAX"
            placeholder="请输入角色名称"
          />
        </a-form-item>
        <a-form-item
          label="角色描述"
          :validate-status="renameDescError ? 'error' : undefined"
          :help="renameDescError ?? undefined"
        >
          <a-textarea v-model:value="renameForm.desc" :rows="3" show-count :maxlength="ROLE_DESC_MAX" />
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- OVERLAY-04 删除角色确认 -->
    <a-modal
      v-model:open="removeOpen"
      title="确认删除该角色？"
      :width="440"
      :mask-closable="!submitting"
      :ok-button-props="{ loading: submitting, danger: true }"
      ok-text="确认删除"
      cancel-text="取消"
      @ok="handleRemoveSubmit"
    >
      <div class="role-modal__card">
        <p class="role-modal__card-name">{{ removeTarget?.name }}</p>
        <p v-if="removeTarget?.desc" class="role-modal__card-desc">{{ removeTarget.desc }}</p>
      </div>
      <p class="role-modal__lead">该角色当前配置了 {{ removePermissionCount }} 项权限，删除后：</p>
      <ul class="role-modal__risks">
        <li><ExclamationCircleOutlined /> 该角色的权限配置将一并清除，且不可恢复</li>
        <li><ExclamationCircleOutlined /> 角色名称将保留在系统日志中，用于审计追溯</li>
      </ul>
    </a-modal>

    <!-- OVERLAY-05 角色成员清单 -->
    <a-modal
      v-model:open="membersOpen"
      :title="`${selectedRole?.name ?? ''} · 成员清单`"
      :width="720"
      :footer="null"
      @cancel="membersOpen = false"
    >
      <div class="role-members__head">
        <span>该角色下有 {{ memberRows.length }} 名成员</span>
        <a-input v-model:value="memberKeyword" placeholder="搜索成员姓名或账号" allow-clear class="role-members__search">
          <template #prefix>
            <SearchOutlined class="role-perm__search-icon" />
          </template>
        </a-input>
      </div>

      <div class="role-members__body">
        <a-empty v-if="!memberRows.length" description="该角色下暂无成员" />
        <a-empty v-else-if="!filteredMemberRows.length" description="未找到匹配的成员" />
        <a-table
          v-else
          :columns="memberColumns"
          :data-source="filteredMemberRows"
          :pagination="memberPagination"
          row-key="id"
          size="middle"
          :scroll="{ y: 320 }"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'name'">
              <a v-if="canViewMembers" @click="gotoMember(record as MemberRow)">{{ (record as MemberRow).name }}</a>
              <span v-else>{{ (record as MemberRow).name }}</span>
            </template>
            <template v-else-if="column.key === 'status'">
              <span class="role-members__status" :class="`role-members__status--${(record as MemberRow).status}`">
                <i class="role-members__dot" />
                {{ (record as MemberRow).statusText }}
              </span>
            </template>
            <template v-else-if="column.key === 'scopeText'">
              <a-tooltip :title="(record as MemberRow).scopeTitle">
                <span class="role-members__scope">{{ (record as MemberRow).scopeText }}</span>
              </a-tooltip>
            </template>
          </template>
        </a-table>
      </div>
      <div class="role-members__footer">
        <a-button @click="membersOpen = false">关闭</a-button>
      </div>
    </a-modal>

    <!-- COMP-ROL-01 权限变更差异确认 -->
    <a-modal
      v-model:open="diffOpen"
      title="确认保存权限变更？"
      :width="520"
      :mask-closable="!submitting"
      :ok-button-props="{ loading: submitting }"
      ok-text="确认保存"
      cancel-text="取消"
      @ok="handleSaveSubmit"
    >
      <p class="role-modal__path">
        本次将新增 {{ diffAdded.length }} 项权限、移除 {{ diffRemoved.length }} 项权限，该角色当前有
        {{ memberCount }} 名成员。
      </p>

      <div v-if="diffAdded.length" class="role-diff">
        <p class="role-diff__title">新增权限（{{ diffAdded.length }}）</p>
        <ul class="role-diff__list">
          <li v-for="key in diffAdded" :key="key">{{ permissionPathText(key) }}</li>
        </ul>
      </div>

      <div v-if="diffRemoved.length" class="role-diff">
        <p class="role-diff__title">移除权限（{{ diffRemoved.length }}）</p>
        <ul class="role-diff__list">
          <li v-for="key in diffRemoved" :key="key" class="role-diff__item--removed">
            <MinusOutlined /> {{ permissionPathText(key) }}
          </li>
        </ul>
      </div>

      <p v-if="diffRemoved.length" class="role-modal__warn">
        本次将移除 {{ diffRemoved.length }} 项权限，该角色下的 {{ memberCount }} 名成员将立即失去对应功能
      </p>
    </a-modal>

    <!-- 清空权限二次确认（ACT-ROL-10 / EX-ROL-18） -->
    <a-modal
      v-model:open="clearOpen"
      title="确认清空该角色的全部权限？"
      :width="440"
      ok-text="确认清空"
      cancel-text="取消"
      :ok-button-props="{ danger: true }"
      @ok="handleClearConfirm"
    >
      <p class="role-modal__hint">
        清空后该角色将不具备任何功能权限，该角色下的成员将无法使用任何业务功能。清空后需点击「保存」生效。
      </p>
    </a-modal>

    <!-- 未保存修改时离开页面的确认（EX-ROL-05） -->
    <a-modal
      v-model:open="leaveOpen"
      title="当前权限修改尚未保存"
      :width="440"
      :closable="false"
      :mask-closable="false"
      ok-text="放弃修改并离开"
      cancel-text="留在此页"
      :ok-button-props="{ danger: true }"
      @ok="confirmLeave"
      @cancel="cancelLeave"
    >
      <p class="role-modal__hint">离开将丢失本次修改，确定离开？</p>
    </a-modal>

    <ProtoTip :lines="tipLines" @reset="handleResetData">
      <template #extra>
        <a-space size="small" wrap>
          <a-button size="small" @click="simulateListFail">模拟列表加载失败</a-button>
          <a-button size="small" @click="simulatePermFail">模拟权限加载失败</a-button>
          <a-button size="small" @click="simulatePermUpdate">模拟权限字典更新</a-button>
        </a-space>
      </template>
    </ProtoTip>
  </div>
</template>

<script setup lang="ts">
/**
 * PAGE-01 角色管理
 * 【原型说明】对齐《产品交互设计文档-角色管理》v1.0 4.1（PAGE-01）与第 5 章（OVERLAY-01~05、COMP-ROL-01）。
 * 覆盖左选右配联动、三级权限树勾选与联动、权限草稿显式保存与差异确认、预置角色只读、
 * 角色新增 / 编辑 / 删除、角色成员清单、未保存保护与各异常分支（EX-ROL-01~EX-ROL-29）。
 */
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { onBeforeRouteLeave, useRouter } from 'vue-router'
import { Modal, message } from 'antdv-next'
import type { TableColumnsType } from 'antdv-next'
import { ExclamationCircleOutlined, MinusOutlined, SearchOutlined } from '@antdv-next/icons'
import ProtoTip from '@/shared/components/ProtoTip.vue'
import { scopeNames, scopeText } from '@/modules/member/store'
import RoleListView from '../components/RoleListView.vue'
import RolePermissionPanel from '../components/RolePermissionPanel.vue'
import {
  ROLE_DESC_MAX,
  ROLE_LIMIT,
  ROLE_NAME_MAX,
  allPermissions,
  createRole,
  currentPermissions,
  expandPermissionKeys,
  getRole,
  isPresetRole,
  isRoleLimitReached,
  normalizeText,
  permissionPathText,
  removeRole,
  resetRoleData,
  roleGrantKeys,
  roleMemberCount,
  roleMembers,
  rolePermissions,
  saveRolePermissions,
  searchRoles,
  sortedRoles,
  togglePermissionGrant,
  updateRole,
  validateRoleDesc,
  validateRoleName,
} from '../store'
import type { Role } from '../store'

const router = useRouter()

/* ---------- 权限点：本页自身的操作入口按权限点显隐（PRD Q-ROL-01 / 5.3） ---------- */
/**
 * 【原型说明】当前账号的功能权限 = 其所绑定角色权限点的并集（PRD 7.2）。
 * 演示中可用「运维工程师」等非管理员账号登录，验证「无权限则入口不渲染」的表现。
 * 菜单级权限点 `system:role` 即「可进入角色管理并查看」；其余为该页面的按钮级权限点。
 */
const canView = computed(() => has('system:role'))
const canCreate = computed(() => has('system:role:create'))
const canEdit = computed(() => has('system:role:edit'))
const canRemove = computed(() => has('system:role:delete'))
const canConfig = computed(() => has('system:role:permission:config'))
const canViewMembers = computed(() => has('system:member'))

function has(key: string) {
  return currentPermissions().includes(key)
}

/* ---------- 列表加载与选中 ---------- */
const listLoading = ref(true)
const listFailed = ref(false)
const keyword = ref('')
const selectedId = ref<string | null>(null)

const roles = computed(() => searchRoles(keyword.value))
const limitReached = computed(() => isRoleLimitReached())

const selectedRole = computed<Role | null>(() => (selectedId.value ? getRole(selectedId.value) : null))
/** 角色的生效能力集合（展开后的目录 / 菜单 / 按钮能力）：预置角色为字典全集，用于差异确认与保存摘要 */
const savedPermissions = computed(() => rolePermissions(selectedRole.value))
const memberCount = computed(() => (selectedId.value ? roleMemberCount(selectedId.value) : 0))

/** 【原型说明】模拟列表加载耗时，无真实接口调用 */
function loadList() {
  listLoading.value = true
  listFailed.value = false
  window.setTimeout(() => {
    listLoading.value = false
    // 默认选中第一个角色（预置角色），其权限全选只读（STATE-ROL-02）
    if (!selectedId.value || !getRole(selectedId.value)) {
      selectedId.value = sortedRoles()[0]?.id ?? null
    }
  }, 420)
}

onMounted(loadList)

/* ---------- 权限面板：草稿态与加载 ---------- */
const permLoading = ref(false)
const permFailed = ref(false)
const permFailedTitle = ref('权限列表加载失败')
const permUpdated = ref(false)
const permKeyword = ref('')
/**
 * 草稿授权集合（收敛态）：保存的是「最上层已授权节点」，
 * 可含一级菜单 / 页面 / 操作任意层级的标识，例如只配一个一级菜单时为 `['system']`。
 */
const draft = ref<string[]>([])
const saving = ref(false)

/** 切换角色时重新加载权限（存在未保存修改时先确认，EX-ROL-04） */
function handleSelectRole(id: string) {
  if (id === selectedId.value) return
  if (dirty.value) {
    pendingRoleId.value = id
    return
  }
  applySelect(id)
}

const pendingRoleId = ref<string | null>(null)

function applySelect(id: string) {
  selectedId.value = id
  permKeyword.value = ''
  loadPermissions()
}

/**
 * 是否存在未保存修改：以「生效能力集合」（含菜单进入能力）为口径比对，
 * 这样「整块授权」与「逐项授权到同一结果」不会被误判为有改动，
 * 而「可进入但不含按钮」与「整块授权该菜单」也能被正确区分。
 */
const dirty = computed(() => {
  const before = savedPermissions.value
  const after = draftCapabilities.value
  if (before.length !== after.length) return true
  const set = new Set(before)
  return after.some((key) => !set.has(key))
})

/** 草稿对应的生效能力集合（展开后），用于与已保存权限比对 */
const draftCapabilities = computed(() => expandPermissionKeys(draft.value))

/** 【原型说明】模拟权限加载耗时 */
function loadPermissions() {
  permLoading.value = true
  permFailed.value = false
  window.setTimeout(() => {
    permLoading.value = false
    draft.value = [...roleGrantKeys(selectedRole.value)]
  }, 320)
}

function reloadPermissions() {
  loadPermissions()
}

watch(selectedId, () => {
  if (selectedId.value) loadPermissions()
})

/** 勾选 / 取消某个层级的权限节点，统一由 store 收敛（含 Q-ROL-08 查看类联动） */
function handleToggle(key: string, checked: boolean) {
  draft.value = togglePermissionGrant(draft.value, key, checked)
}

function handleSelectAll() {
  draft.value = allPermissions()
}

const clearOpen = ref(false)
function openClearConfirm() {
  clearOpen.value = true
}
function handleClearConfirm() {
  draft.value = []
  clearOpen.value = false
}

function handleCancel() {
  draft.value = [...roleGrantKeys(selectedRole.value)]
}

/* ---------- COMP-ROL-01 差异确认与保存 ---------- */
const diffOpen = ref(false)

/** 差异清单按「生效能力集合」逐项列出，口径与面板底部摘要一致 */
const diffAdded = computed(() => {
  const before = new Set(savedPermissions.value)
  return draftCapabilities.value.filter((key) => !before.has(key))
})
const diffRemoved = computed(() => {
  const after = new Set(draftCapabilities.value)
  return savedPermissions.value.filter((key) => !after.has(key))
})

function openDiffConfirm() {
  if (!dirty.value) return
  diffOpen.value = true
}

async function handleSaveSubmit() {
  if (!selectedId.value) return
  submitting.value = true
  try {
    await saveRolePermissions(selectedId.value, draft.value)
    diffOpen.value = false
    message.success('权限已保存')
  } catch (error) {
    message.error(error instanceof Error ? error.message : '保存失败，请重试')
  } finally {
    submitting.value = false
  }
}

/* ---------- OVERLAY-01 新增角色 ---------- */
const createOpen = ref(false)
const submitting = ref(false)
const createForm = reactive({ name: '', desc: '' })

const createNameError = computed(() => (createForm.name ? validateRoleName(createForm.name) : null))
const createDescError = computed(() => validateRoleDesc(createForm.desc))

function openCreate() {
  if (limitReached.value) {
    message.warning(`自定义角色数量已达上限（${ROLE_LIMIT}），请先清理不再使用的角色`)
    return
  }
  createForm.name = ''
  createForm.desc = ''
  createOpen.value = true
}

async function handleCreateSubmit() {
  if (!normalizeText(createForm.name)) {
    message.error('请输入角色名称')
    return
  }
  if (createNameError.value || createDescError.value) return
  submitting.value = true
  try {
    const role = await createRole({ name: createForm.name, desc: createForm.desc })
    createOpen.value = false
    message.success('新增成功')
    // 新角色自动选中，权限面板为全未选，等待继续配置（PRD Q-ROL-06）
    selectedId.value = role.id
    draft.value = []
    permKeyword.value = ''
  } catch (error) {
    message.error(error instanceof Error ? error.message : '保存失败，请重试')
  } finally {
    submitting.value = false
  }
}

/* ---------- OVERLAY-02 编辑角色 ---------- */
const renameOpen = ref(false)
const renameForm = reactive({ id: '', name: '', desc: '' })
const renameNameRef = ref<{ focus: () => void } | null>(null)

const renameNameError = computed(() =>
  renameForm.name ? validateRoleName(renameForm.name, renameForm.id) : null,
)
const renameDescError = computed(() => validateRoleDesc(renameForm.desc))

function openRename() {
  const role = selectedRole.value
  if (!role) return
  if (isPresetRole(role)) {
    message.warning('预置角色不可修改')
    return
  }
  renameForm.id = role.id
  renameForm.name = role.name
  renameForm.desc = role.desc
  renameOpen.value = true
  window.setTimeout(() => renameNameRef.value?.focus(), 0)
}

async function handleRenameSubmit() {
  const role = getRole(renameForm.id)
  if (!role) return
  if (!normalizeText(renameForm.name)) {
    message.error('请输入角色名称')
    return
  }
  if (renameNameError.value || renameDescError.value) return
  // 名称与描述均未变化时直接关闭，不产生保存请求（交互文档 5.2）
  if (role.name === normalizeText(renameForm.name) && role.desc === normalizeText(renameForm.desc)) {
    renameOpen.value = false
    return
  }
  submitting.value = true
  try {
    await updateRole(renameForm.id, { name: renameForm.name, desc: renameForm.desc })
    renameOpen.value = false
    message.success('已保存')
  } catch (error) {
    message.error(error instanceof Error ? error.message : '保存失败，请重试')
  } finally {
    submitting.value = false
  }
}

/* ---------- OVERLAY-04 删除角色 ---------- */
const removeOpen = ref(false)
const removeTarget = ref<Role | null>(null)

const removePermissionCount = computed(() => (removeTarget.value ? rolePermissions(removeTarget.value).length : 0))

function openRemove() {
  const role = selectedRole.value
  if (!role) return
  if (isPresetRole(role)) {
    message.warning('预置角色不可删除')
    return
  }
  // 删除入口常显可用，成员数校验在点击后进行：命中时给出明确的阻断原因
  const count = roleMemberCount(role.id)
  if (count > 0) {
    message.error(`该角色下有 ${count} 名成员，请先在企业成员中解除绑定后再删除`)
    return
  }
  removeTarget.value = role
  removeOpen.value = true
}

async function handleRemoveSubmit() {
  const role = removeTarget.value
  if (!role) return
  submitting.value = true
  try {
    await removeRole(role.id)
    removeOpen.value = false
    message.success('角色已删除')
    // 选中态转移到列表第一个角色（PRD F-ROL-07）
    selectedId.value = sortedRoles()[0]?.id ?? null
  } catch (error) {
    message.error(error instanceof Error ? error.message : '删除失败，请重试')
  } finally {
    submitting.value = false
  }
}

/* ---------- 角色行「更多」菜单 ---------- */
function handleMenu(roleId: string, action: string) {
  if (roleId !== selectedId.value) {
    if (dirty.value) {
      pendingRoleId.value = roleId
      pendingAction.value = action
      return
    }
    selectedId.value = roleId
  }
  runAction(action)
}

const pendingAction = ref<string | null>(null)

function runAction(action: string) {
  if (action === 'rename') openRename()
  else if (action === 'remove') openRemove()
  else if (action === 'members') openMembers()
}

/* ---------- OVERLAY-05 角色成员清单 ---------- */
const membersOpen = ref(false)
const memberKeyword = ref('')

interface MemberRow {
  id: string
  name: string
  identifier: string
  status: 'normal' | 'disabled'
  statusText: string
  scopeText: string
  scopeTitle: string
}

const memberRows = computed<MemberRow[]>(() => {
  if (!selectedId.value) return []
  return roleMembers(selectedId.value).map((member) => {
    // 数据范围与「企业成员」页同源：复用成员模块的 scopeText / scopeNames 口径
    const scope = scopeText(member)
    const names = scopeNames(member)
    return {
      id: member.id,
      name: member.name,
      identifier: member.identifier,
      status: member.status,
      statusText: member.status === 'normal' ? '启用' : '停用',
      scopeText: scope.text,
      scopeTitle: names.length ? names.join('、') : scope.text,
    }
  })
})

const filteredMemberRows = computed(() => {
  const value = memberKeyword.value.trim().toLowerCase()
  if (!value) return memberRows.value
  return memberRows.value.filter(
    (row) => row.name.toLowerCase().includes(value) || row.identifier.toLowerCase().includes(value),
  )
})

const memberColumns: TableColumnsType<MemberRow> = [
  { title: '姓名', dataIndex: 'name', key: 'name', width: '20%' },
  { title: '账号', dataIndex: 'identifier', key: 'identifier', width: '28%' },
  { title: '状态', dataIndex: 'status', key: 'status', width: '18%' },
  { title: '数据范围', dataIndex: 'scopeText', key: 'scopeText' },
]

const memberPagination = {
  size: 'small' as const,
  pageSize: 20,
  pageSizeOptions: ['10', '20', '50', '100'],
  showSizeChanger: true,
  showTotal: (total: number) => `共 ${total} 条`,
}

function openMembers() {
  if (!selectedId.value || memberCount.value === 0) {
    message.info('该角色下暂无成员')
    return
  }
  memberKeyword.value = ''
  membersOpen.value = true
}

/** 跳转企业成员页并携带角色筛选（OVERLAY-05 跳转行为） */
function gotoMember(row: MemberRow) {
  if (!canViewMembers.value) return
  router.push({ path: '/system/members', query: { role: selectedId.value, member: row.id } })
}

/* ---------- 未保存保护 ---------- */
const leaveOpen = ref(false)
let leaveResolve: ((value: boolean) => void) | null = null

/** 切换角色时确认放弃修改（EX-ROL-04） */
watch(pendingRoleId, async (id) => {
  if (!id) return
  const target = id
  const action = pendingAction.value
  Modal.confirm({
    title: '当前权限修改尚未保存',
    content: '切换角色将丢失修改，确定继续？',
    okText: '放弃修改',
    cancelText: '继续编辑',
    onOk: () => {
      pendingRoleId.value = null
      pendingAction.value = null
      selectedId.value = target
      draft.value = [...roleGrantKeys(getRole(target))]
      if (action) window.setTimeout(() => runAction(action), 0)
    },
    onCancel: () => {
      pendingRoleId.value = null
      pendingAction.value = null
    },
  })
})

onBeforeRouteLeave(async () => {
  if (!dirty.value) return true
  return await new Promise<boolean>((resolve) => {
    leaveResolve = resolve
    leaveOpen.value = true
  })
})

function confirmLeave() {
  leaveOpen.value = false
  // 放弃修改后放行
  draft.value = [...roleGrantKeys(selectedRole.value)]
  leaveResolve?.(true)
  leaveResolve = null
}

function cancelLeave() {
  leaveOpen.value = false
  leaveResolve?.(false)
  leaveResolve = null
}

/* ---------- 演示提示与模拟入口 ---------- */
const tipLines = [
  '左侧选中角色，右侧即时加载该角色的权限配置，形成「左选右配」的联动（PRD F-ROL-02）。',
  '权限的每一级都可独立授权：勾选「目录」或整块菜单即授予其下全部功能，因此「只配一个目录 / 菜单」可一步完成；也可下钻到下级菜单或单个操作按钮做细化。',
  '取消某个下级即在上级授权的基础上做细化；每级的勾选框为三态（全选 / 半选 / 未选），一眼看出该级的授权完整度。',
  '每级都用底色、左侧色条与层级徽标（目录 / 菜单）标注层级：目录为浅底行、菜单为白底卡片、按钮为浅底勾选块，避免层级混淆。',
  '菜单下若还有下级菜单（如「设备用电管控 › 负荷策略」），下级菜单卡片嵌套在上级菜单卡片内部并缩进展示，不会被误认为同级菜单。',
  '菜单级节点自带「可进入该页面」语义：勾选任一按钮级权限点会自动补齐其所属菜单的进入能力，因此不存在独立的「查看」类权限点。',
  '权限修改为草稿态：勾选变化不即时生效，需点「保存」；保存前会弹出差异清单，逐项列出新增与移除的权限点。',
  '存在未保存修改时切换角色或离开页面都会被拦住，可选「放弃修改」或「继续编辑」（EX-ROL-04、EX-ROL-05）。',
  '预置角色「企业超级管理员」权限全选且不可取消，不展示全选 / 清空 / 保存，也不展示编辑与删除入口。',
  '删除入口常显可用：点击后若该角色下仍有成员，会直接给出「先解除绑定」的阻断提示（PRD Q-ROL-02）。',
  '权限搜索会高亮命中项、淡出未命中项（仍可见），且不改变任何勾选状态。',
  '下方按钮可快速验证列表加载失败、权限加载失败与权限字典更新三种状态，验证后请重置演示数据。',
]

function handleResetData() {
  resetRoleData()
  keyword.value = ''
  permKeyword.value = ''
  permUpdated.value = false
  selectedId.value = null
  loadList()
}

/** 【原型说明】模拟列表加载失败（EX-ROL-01） */
function simulateListFail() {
  listLoading.value = true
  listFailed.value = true
  window.setTimeout(() => {
    listLoading.value = false
  }, 420)
}

/** 【原型说明】模拟权限加载失败（EX-ROL-02、EX-ROL-03） */
function simulatePermFail() {
  permLoading.value = true
  permFailed.value = true
  permFailedTitle.value = '该角色的权限加载失败'
  window.setTimeout(() => {
    permLoading.value = false
  }, 420)
}

/** 【原型说明】模拟权限字典已更新（STATE-ROL-14 / EX-ROL-20） */
function simulatePermUpdate() {
  permUpdated.value = true
  message.info('已模拟权限字典更新，可在提示条中确认')
}

onBeforeUnmount(() => {
  leaveResolve = null
})

defineOptions({ name: 'RoleManageView' })
</script>
