<template>
  <div class="page-container role-page">
    <!-- 页面标题区（AREA-ROL-01） -->
    <header class="role-page__head">
      <h1 class="role-page__title">企业角色管理</h1>
      <p class="role-page__desc">维护全平台企业统一可见的企业默认角色；企业侧只读，可直接分配给成员</p>
    </header>

    <!-- 主体分栏：左角色列表 280px + 右权限面板自适应（AREA-ROL-02） -->
    <div class="role-page__main">
      <!-- 左侧：角色列表面板（AREA-ROL-03） -->
      <section class="role-list" aria-label="企业角色列表">
        <div class="role-list__tools">
          <a-input v-model:value="keyword" class="role-list__search" placeholder="搜索角色名称" allow-clear :maxlength="SEARCH_MAX">
            <template #prefix><SearchOutlined class="role-list__search-icon" /></template>
          </a-input>
        </div>

        <div v-if="listLoading" class="role-list__body">
          <a-skeleton active :paragraph="{ rows: 4 }" />
        </div>
        <div v-else-if="listFailed" class="role-list__body role-list__body--center">
          <div class="role-list__state">
            <span class="role-list__state-icon role-list__state-icon--error"><DisconnectOutlined /></span>
            <p class="role-list__state-title">角色列表加载失败</p>
            <p class="role-list__state-desc">网络异常或服务暂时不可用，请稍后重试</p>
            <a-button type="primary" class="role-list__state-action" @click="loadList">
              <template #icon><ReloadOutlined /></template>
              重新加载
            </a-button>
          </div>
        </div>
        <div v-else-if="!roles.length" class="role-list__body role-list__body--center">
          <div class="role-list__state">
            <span class="role-list__state-icon"><SearchOutlined /></span>
            <p class="role-list__state-title">未找到匹配的角色</p>
            <p class="role-list__state-desc">换个关键字试试，或清空搜索查看全部角色</p>
          </div>
        </div>
        <div v-else class="role-list__body">
          <button
            v-for="item in roles"
            :key="item.id"
            type="button"
            class="role-item"
            :class="{ 'role-item--current': selectedId === item.id }"
            @click="selectRole(item.id)"
          >
            <span class="role-item__name" :title="item.name">{{ item.name }}</span>
            <a-tag v-if="item.source === 'preset'" class="role-item__tag role-item__tag--preset">
              <template #icon><LockOutlined /></template>
              内置
            </a-tag>
            <a-tag v-else class="role-item__tag role-item__tag--default">
              <template #icon><LockOutlined /></template>
              默认
            </a-tag>
            <span class="role-item__count" :title="`全平台 ${roleMemberCount(item.id)} 名成员使用`">
              {{ roleMemberCount(item.id) }}
            </span>
          </button>
        </div>

        <a-button v-if="can('platform:enterprise:role:create')" type="primary" block class="role-list__add" @click="openCreate">
          <template #icon><PlusOutlined /></template>
          新增默认角色
        </a-button>
      </section>

      <!-- 右侧：权限配置面板（AREA-ROL-04） -->
      <section class="role-perm" aria-label="权限配置">
        <div v-if="!selectedRole" class="role-perm__empty">
          <a-empty description="请从左侧选择一个平台角色查看权限配置" />
        </div>

        <template v-else>
          <header class="role-perm__head">
            <div class="role-perm__title">
              <span class="role-perm__icon" :class="{ 'role-perm__icon--preset': preset }">
                <component :is="preset ? SafetyCertificateOutlined : TeamOutlined" />
              </span>
              <span class="role-perm__name" :title="selectedRole.name">{{ selectedRole.name }}</span>
              <a-tag v-if="preset" class="role-perm__tag role-perm__tag--preset">
                <template #icon><LockOutlined /></template>
                内置
              </a-tag>
              <a-tag v-else class="role-perm__tag role-perm__tag--default">
                <template #icon><LockOutlined /></template>
                默认
              </a-tag>
              <a v-if="memberCount > 0" class="role-perm__members" @click="openMembers">全平台 {{ memberCount }} 名成员</a>
              <span v-else class="role-perm__members role-perm__members--empty">全平台 0 名成员</span>
            </div>
            <div class="role-perm__head-actions">
              <a-button v-if="!preset && can('platform:enterprise:role:edit')" type="link" size="small" @click="openEdit">编辑</a-button>
              <a-button
                v-if="!preset && can('platform:enterprise:role:delete')"
                type="link"
                size="small"
                danger
                @click="handleDeleteClick"
              >
                删除
              </a-button>
            </div>
          </header>

          <p class="role-perm__desc">
            <span class="role-perm__desc-label">角色描述</span>
            <span :class="{ 'role-perm__desc-value--empty': !selectedRole.desc }">{{ selectedRole.desc || '—' }}</span>
          </p>

          <div v-if="preset" class="role-perm__lock">
            <span class="role-perm__lock-icon"><LockOutlined /></span>
            <div class="role-perm__lock-main">
              <p class="role-perm__lock-title">该角色为企业内置角色，权限不可修改</p>
              <p class="role-perm__lock-desc">企业超级管理员恒定拥有该企业全部功能与全部数据权限</p>
            </div>
          </div>

          <div v-else class="role-perm__lock">
            <span class="role-perm__lock-icon"><LockOutlined /></span>
            <div class="role-perm__lock-main">
              <p class="role-perm__lock-title">该角色全平台企业统一可见，企业侧只读</p>
              <p class="role-perm__lock-desc">企业可在「系统管理 › 角色管理」中查看并分配给成员；权限修改保存后对所有企业立即生效</p>
            </div>
          </div>

          <!-- 权限工具行：搜索 + 统计 + 全选 / 清空 -->
          <div class="role-perm__tools">
            <a-input v-model:value="permKeyword" class="role-perm__search" placeholder="搜索权限点名称" allow-clear :maxlength="SEARCH_MAX">
              <template #prefix><SearchOutlined class="role-perm__search-icon" /></template>
            </a-input>
            <span v-if="permKeyword.trim()" class="role-perm__hits">命中 {{ hits.length }} 项</span>
            <span class="role-perm__count">
              {{ preset ? `全部 ${ALL_CAPABILITY_KEYS.length} 项权限` : `已选 ${checkedCount} / ${ALL_CAPABILITY_KEYS.length} 项权限` }}
            </span>
            <a-space v-if="can('platform:enterprise:role:permission') && !preset" size="small">
              <a-button type="link" size="small" @click="draft = allPermissions()">全选</a-button>
              <a-button type="link" size="small" danger @click="draft = []">清空</a-button>
            </a-space>
          </div>

          <div v-if="permLoading" class="role-perm__body role-perm__body--center">
            <a-skeleton active :paragraph="{ rows: 6 }" />
          </div>

          <div v-else class="role-perm__body">
            <div
              v-for="dir in PERMISSION_TREE"
              :key="dir.key"
              class="perm-module"
              :class="{ 'perm-module--dim': isNodeDim(dir) }"
            >
              <div class="perm-module__head">
                <a-checkbox
                  class="perm-level__box"
                  :checked="stateOf(dir.key) === 'all'"
                  :indeterminate="stateOf(dir.key) === 'partial'"
                  :disabled="readonly"
                  @change="toggle(dir.key, $event.target.checked)"
                />
                <span class="perm-module__icon"><AppstoreOutlined /></span>
                <span class="perm-module__name">{{ dir.name }}</span>
                <span class="perm-level__badge">目录</span>
                <span class="perm-module__count">{{ grantedCountOf(dir.key) }} / {{ capabilityCountOf(dir.key) }} 项权限</span>
              </div>

              <template v-if="!hasMenuChildren(dir)">
                <div v-if="actionChildrenOf(dir).length" class="perm-module__actions">
                  <PlatformPermissionActionItem
                    v-for="action in actionChildrenOf(dir)"
                    :key="action.key"
                    :node="action"
                    :checked="granted.has(action.key)"
                    :dim="searching && !hits.includes(action.key)"
                    :keyword="permKeyword"
                    :disabled="readonly"
                    @toggle="toggle"
                  />
                </div>
                <p v-else class="perm-module__note">勾选即获得此页面的访问权限</p>
              </template>

              <div v-else class="perm-menus">
                <PlatformPermissionMenuCard
                  v-for="child in menuChildrenOf(dir)"
                  :key="child.key"
                  :node="child"
                  :depth="0"
                  :granted="granted"
                  :hit-keys="hitKeys"
                  :searching="searching"
                  :keyword="permKeyword"
                  :disabled="readonly"
                  @toggle="toggle"
                />
              </div>
            </div>

            <p v-if="permKeyword.trim() && !hits.length" class="role-perm__no-hit">未找到匹配的权限点</p>
          </div>

          <!-- 底部操作区（AREA-ROL-06） -->
          <footer v-if="can('platform:enterprise:role:permission') && !preset" class="role-perm__footer">
            <span v-if="dirty" class="role-perm__summary">
              已选 {{ checkedCount }} / {{ ALL_CAPABILITY_KEYS.length }} 项权限 · 新增 {{ diffAdded.length }} 项 · 移除 {{ diffRemoved.length }} 项
            </span>
            <span v-else class="role-perm__summary role-perm__summary--idle">权限已是最新，无未保存修改</span>
            <a-space>
              <a-button :disabled="!dirty" @click="resetGrant">取消</a-button>
              <a-button type="primary" :disabled="!dirty" :loading="saving" @click="handleSave">保存</a-button>
            </a-space>
          </footer>
        </template>
      </section>
    </div>

    <!-- OVERLAY-01 新增角色 -->
    <a-modal
      v-model:open="roleFormOpen"
      :title="editingRole ? '编辑默认角色' : '新增默认角色'"
      :width="480"
      :confirm-loading="roleSubmitting"
      ok-text="保存"
      cancel-text="取消"
      @ok="handleRoleOk"
    >
      <a-form layout="vertical">
        <a-form-item label="角色名称" required :validate-status="roleNameError ? 'error' : undefined" :help="roleNameError || undefined">
          <a-input v-model:value="roleForm.name" show-count :maxlength="ROLE_NAME_MAX" placeholder="请输入角色名称" />
        </a-form-item>
        <a-form-item label="角色描述" :validate-status="roleDescError ? 'error' : undefined" :help="roleDescError || undefined">
          <a-textarea v-model:value="roleForm.desc" :rows="3" show-count :maxlength="ROLE_DESC_MAX" placeholder="请说明该角色的适用岗位（选填）" />
        </a-form-item>
      </a-form>
      <p class="role-modal__hint">创建后角色将自动选中，请在右侧勾选企业权限并点击「保存」完成配置；保存后对所有企业立即生效。</p>
    </a-modal>

    <!-- OVERLAY-05 角色成员清单 -->
    <a-modal v-model:open="membersOpen" :title="`${selectedRole?.name ?? ''} · 成员清单`" :width="640" :footer="null">
      <div class="role-members__head">
        <span>该角色下有 {{ memberList.length }} 名成员</span>
      </div>
      <div class="role-members__body">
        <a-empty v-if="!memberList.length" description="该角色下暂无成员" />
        <a-table v-else :columns="memberColumns" :data-source="memberList" :pagination="false" row-key="id" size="middle">
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'status'">
              <span class="role-members__status" :class="`role-members__status--${record.status}`">
                <i class="role-members__dot" />
                {{ record.status === 'normal' ? '启用' : '停用' }}
              </span>
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
      :confirm-loading="saving"
      ok-text="确认保存"
      cancel-text="取消"
      @ok="handleSaveSubmit"
    >
      <p class="role-modal__path">
        本次将新增 {{ diffAdded.length }} 项权限、移除 {{ diffRemoved.length }} 项权限，该角色当前有 {{ memberCount }} 名成员。
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

    <ProtoTip :lines="tipLines" @reset="handleResetData" />
  </div>
</template>

<script setup lang="ts">
/**
 * PAL-PAGE-06 企业角色管理
 * 【原型说明】对齐《产品交互设计文档-企业角色管理》v1.0：
 * 左侧企业角色列表（内置企业超级管理员 + 平台默认角色）+ 右侧企业权限配置（「左选右配」）；
 * 内置角色只读；默认角色可增删改、权限保存后对所有企业立即生效；平台侧不设数据范围。
 * 权限点来源为企业权限字典（与企业端「角色管理」共用同一份演示数据）。
 */
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { Modal, message } from 'antdv-next'
import type { TableColumnsType } from 'antdv-next'
import {
  AppstoreOutlined,
  DisconnectOutlined,
  LockOutlined,
  MinusOutlined,
  PlusOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
  SearchOutlined,
  TeamOutlined,
} from '@antdv-next/icons'
import ProtoTip from '@/shared/components/ProtoTip.vue'
import PlatformPermissionActionItem from '../components/PlatformPermissionActionItem.vue'
import PlatformPermissionMenuCard from '../components/PlatformPermissionMenuCard.vue'
import { currentPlatformPermissions } from '@/modules/platform/store'
import type { Member } from '@/modules/member/store/types'
import {
  ALL_CAPABILITY_KEYS,
  PERMISSION_TREE,
  ROLE_DESC_MAX,
  ROLE_NAME_MAX,
  SEARCH_MAX,
  allPermissions,
  createDefaultRole,
  expandPermissionKeys,
  getPermissionNode,
  getRole,
  hasMenuChildren,
  isDefaultRole,
  isPresetRole,
  permissionPathText,
  resetRoleData,
  roleGrantKeys,
  roleMemberCount,
  roleMembers,
  rolePermissions,
  removeDefaultRole,
  saveDefaultRolePermissions,
  searchDefaultRoles,
  subtreeCapabilityKeysOf,
  togglePermissionGrant,
  updateDefaultRole,
  validateDefaultRoleName,
  validateRoleDesc,
  type PermissionNode,
  type Role,
} from '@/modules/role/store'

const permissions = computed(() => currentPlatformPermissions())
function can(permission: string) {
  return permissions.value.includes(permission)
}

/* ---------- 角色列表与选中 ---------- */
const listLoading = ref(true)
const listFailed = ref(false)
const keyword = ref('')
const refreshKey = ref(0)
const selectedId = ref<string>('')

const roles = computed(() => {
  void refreshKey.value
  return searchDefaultRoles(keyword.value)
})

const selectedRole = computed<Role | null>(() => (selectedId.value ? getRole(selectedId.value) : null))
const preset = computed(() => Boolean(selectedRole.value && isPresetRole(selectedRole.value)))
const memberCount = computed(() => (selectedId.value ? roleMemberCount(selectedId.value) : 0))

function loadList() {
  listLoading.value = true
  listFailed.value = false
  window.setTimeout(() => {
    listLoading.value = false
    if (!selectedId.value || !getRole(selectedId.value)) {
      selectedId.value = roles.value[0]?.id ?? ''
    }
  }, 420)
}

onMounted(loadList)

function selectRole(id: string) {
  if (id === selectedId.value) return
  if (dirty.value) {
    const ok = window.confirm('放弃未保存的权限修改？')
    if (!ok) return
  }
  selectedId.value = id
}

/* ---------- 权限草稿与加载 ---------- */
const permLoading = ref(false)
const permKeyword = ref('')
const draft = ref<string[]>([])
const saving = ref(false)

const readonly = computed(() => preset.value || !can('platform:enterprise:role:permission'))

watch(
  selectedRole,
  (role) => {
    permKeyword.value = ''
    permLoading.value = true
    window.setTimeout(() => {
      permLoading.value = false
      draft.value = [...roleGrantKeys(role)]
    }, 320)
  },
  { immediate: true },
)

/** 草稿对应的生效能力集合（展开态），用于勾选判定与差异比对 */
const granted = computed(() => new Set(expandPermissionKeys(draft.value)))
const checkedCount = computed(() => ALL_CAPABILITY_KEYS.filter((key) => granted.value.has(key)).length)

/** 已保存角色的生效能力集合 */
const savedPermissions = computed(() => rolePermissions(selectedRole.value))

const diffAdded = computed(() => {
  const before = new Set(savedPermissions.value)
  return ALL_CAPABILITY_KEYS.filter((key) => granted.value.has(key) && !before.has(key))
})
const diffRemoved = computed(() => {
  const after = new Set(granted.value)
  return savedPermissions.value.filter((key) => !after.has(key))
})
const dirty = computed(() => diffAdded.value.length > 0 || diffRemoved.value.length > 0)

/* ---------- 层级状态与计数 ---------- */
function capabilityCountOf(key: string) {
  const node = getPermissionNode(key)
  return node ? subtreeCapabilityKeysOf(node).length : 0
}

function grantedCountOf(key: string) {
  const node = getPermissionNode(key)
  if (!node) return 0
  return subtreeCapabilityKeysOf(node).filter((item) => granted.value.has(item)).length
}

function stateOf(key: string): 'all' | 'partial' | 'none' {
  const node = getPermissionNode(key)
  if (!node) return 'none'
  const caps = subtreeCapabilityKeysOf(node)
  const hit = caps.filter((item) => granted.value.has(item)).length
  if (hit === 0) return 'none'
  return hit === caps.length ? 'all' : 'partial'
}

function actionChildrenOf(node: PermissionNode): PermissionNode[] {
  return node.children.filter((child) => child.level === 'action')
}
function menuChildrenOf(dir: PermissionNode): PermissionNode[] {
  return dir.children.filter((child) => child.level === 'menu')
}

function toggle(key: string, checked: boolean) {
  if (readonly.value) return
  draft.value = togglePermissionGrant(draft.value, key, checked)
}

function resetGrant() {
  draft.value = [...roleGrantKeys(selectedRole.value)]
}

/* ---------- 搜索高亮与淡出 ---------- */
const keywordLower = computed(() => permKeyword.value.trim().toLowerCase())
const hits = computed(() => {
  const value = keywordLower.value
  if (!value) return []
  return ALL_CAPABILITY_KEYS.filter((key) => permissionPathText(key).toLowerCase().includes(value))
})
const hitKeys = computed(() => new Set(hits.value))
const searching = computed(() => !!keywordLower.value)
const isNodeDim = (node: PermissionNode) => searching.value && !hits.value.some((key) => key.startsWith(node.key))

/* ---------- 保存 ---------- */
const diffOpen = ref(false)

function handleSave() {
  if (!dirty.value) return
  diffOpen.value = true
}

async function handleSaveSubmit() {
  if (!selectedRole.value) return
  saving.value = true
  try {
    await saveDefaultRolePermissions(selectedRole.value.id, draft.value)
    diffOpen.value = false
    refreshKey.value += 1
    message.success('权限已保存，已对所有企业生效')
  } catch (error) {
    message.error(error instanceof Error ? error.message : '保存失败，请重试')
  } finally {
    saving.value = false
  }
}

/* ---------- 新增 / 编辑 / 删除角色 ---------- */
const roleFormOpen = ref(false)
const roleSubmitting = ref(false)
const editingRole = ref<Role | null>(null)
const roleNameError = ref('')
const roleDescError = ref('')
const roleForm = reactive({ name: '', desc: '' })

function openCreate() {
  editingRole.value = null
  roleForm.name = ''
  roleForm.desc = ''
  roleNameError.value = ''
  roleDescError.value = ''
  roleFormOpen.value = true
}

function openEdit() {
  const role = selectedRole.value
  if (!role || !isDefaultRole(role)) return
  editingRole.value = role
  roleForm.name = role.name
  roleForm.desc = role.desc
  roleNameError.value = ''
  roleDescError.value = ''
  roleFormOpen.value = true
}

async function handleRoleOk() {
  roleNameError.value = validateDefaultRoleName(roleForm.name, editingRole.value?.id) ?? ''
  roleDescError.value = validateRoleDesc(roleForm.desc) ?? ''
  if (roleNameError.value || roleDescError.value) return
  roleSubmitting.value = true
  try {
    if (editingRole.value) {
      await updateDefaultRole(editingRole.value.id, { name: roleForm.name, desc: roleForm.desc })
    } else {
      const created = await createDefaultRole({ name: roleForm.name, desc: roleForm.desc })
      selectedId.value = created.id
      draft.value = []
    }
    roleFormOpen.value = false
    refreshKey.value += 1
    message.success('保存成功')
  } catch (error) {
    roleNameError.value = error instanceof Error ? error.message : '保存失败'
  } finally {
    roleSubmitting.value = false
  }
}

function handleDeleteClick() {
  const role = selectedRole.value
  if (!role || !isDefaultRole(role)) return
  const count = roleMemberCount(role.id)
  if (count > 0) {
    message.warning(`该默认角色仍被 ${count} 名成员使用，请先在企业成员中解除绑定后再删除`)
    return
  }
  Modal.confirm({
    title: '确认删除该默认角色？',
    content: '删除后该默认角色将从全部企业的角色列表中移除，且不可恢复。',
    okText: '删除',
    okType: 'danger',
    cancelText: '取消',
    onOk: handleDelete,
  })
}

async function handleDelete() {
  const role = selectedRole.value
  if (!role || !isDefaultRole(role)) return
  try {
    await removeDefaultRole(role.id)
    selectedId.value = ''
    refreshKey.value += 1
    message.success('角色已删除')
  } catch (error) {
    message.warning(error instanceof Error ? error.message : '删除失败')
  }
}

/* ---------- 角色成员清单 ---------- */
const membersOpen = ref(false)
const memberList = ref<Member[]>([])
const memberColumns: TableColumnsType<Member> = [
  { title: '姓名', dataIndex: 'name', key: 'name', width: 160 },
  { title: '账号', dataIndex: 'identifier', key: 'identifier' },
  { title: '状态', dataIndex: 'status', key: 'status', width: 120 },
]

function openMembers() {
  if (!selectedRole.value || memberCount.value === 0) {
    message.info('该角色下暂无成员')
    return
  }
  memberList.value = roleMembers(selectedRole.value.id)
  membersOpen.value = true
}

/* ---------- 演示提示 ---------- */
const tipLines = [
  '左侧选中角色，右侧即时加载该角色的企业权限配置，形成「左选右配」联动。',
  '权限点来自企业权限字典（与企业端「角色管理」同一份），按「目录 → 菜单 → 按钮」逐级下钻；不设数据范围。',
  '默认角色的权限保存后，对所有企业的绑定成员立即生效；保存前会弹出差异清单。',
  '内置角色「企业超级管理员」只读；平台默认角色对全部企业统一可见，企业侧只读、仅可分配给成员。',
  '删除默认角色时，若任一企业仍有成员绑定，将阻断并提示先解除绑定。',
]

function handleResetData() {
  resetRoleData()
  keyword.value = ''
  permKeyword.value = ''
  selectedId.value = ''
  loadList()
}
</script>
