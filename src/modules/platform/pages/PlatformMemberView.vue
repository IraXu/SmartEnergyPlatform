<template>
  <div class="page-container member-page">
    <!-- 页面标题区（AREA-MEM-01） -->
    <header class="member-page__head">
      <div>
        <h1 class="member-page__title">平台成员管理</h1>
        <p class="member-page__desc">维护平台侧成员账号，分配平台角色以控制可用功能；平台成员不属任何企业</p>
      </div>
      <a-button v-if="can('platform:member:create')" type="primary" @click="openCreate">
        <template #icon><PlusOutlined /></template>
        新增成员
      </a-button>
    </header>

    <!-- 筛选区卡片（AREA-MEM-02） -->
    <section class="member-filter">
      <a-input
        v-model:value="filters.keyword"
        class="member-filter__control"
        placeholder="搜索成员姓名或账号"
        allow-clear
        :maxlength="PLATFORM_SEARCH_MAX"
        @press-enter="applySearch"
      >
        <template #prefix><SearchOutlined class="member-filter__icon" /></template>
      </a-input>

      <a-select
        v-model:value="filters.roleIds"
        class="member-filter__control"
        mode="multiple"
        show-search
        allow-clear
        option-filter-prop="label"
        placeholder="按角色筛选"
        :options="roleFilterOptions"
        :max-tag-count="'responsive'"
      />

      <a-select
        v-model:value="filters.status"
        class="member-filter__control"
        allow-clear
        placeholder="按状态筛选"
        :options="statusOptions"
      />

      <div class="member-filter__actions">
        <a-button type="primary" @click="applySearch">
          <template #icon><SearchOutlined /></template>
          查询
        </a-button>
        <a-button @click="resetFilters">
          <template #icon><ReloadOutlined /></template>
          重置
        </a-button>
      </div>
    </section>

    <!-- 列表卡片（AREA-MEM-03） -->
    <section class="member-list">
      <div v-if="loading" class="member-list__body">
        <a-skeleton active :paragraph="{ rows: 6 }" />
      </div>

      <div v-else-if="failed" class="member-list__body member-list__body--center">
        <div class="member-list__state">
          <span class="member-list__state-icon"><DisconnectOutlined /></span>
          <p class="member-list__state-title">成员列表加载失败</p>
          <p class="member-list__state-desc">网络异常或服务暂时不可用，请稍后重试</p>
          <a-button type="primary" class="member-list__state-action" @click="loadList">
            <template #icon><ReloadOutlined /></template>
            重新加载
          </a-button>
        </div>
      </div>

      <div v-else-if="!rows.length" class="member-list__body member-list__body--center">
        <a-empty :description="hasFilter ? '未找到匹配的成员' : '还没有平台成员，点击「新增成员」开始添加'">
          <a-button v-if="hasFilter" @click="resetFilters">重置筛选</a-button>
          <a-button v-else-if="can('platform:member:create')" type="primary" @click="openCreate">新增成员</a-button>
        </a-empty>
      </div>

      <a-table
        v-else
        :columns="columns"
        :data-source="rows"
        :pagination="pagination"
        row-key="id"
        size="middle"
        @change="handleTableChange"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'name'">
            <div class="member-cell__nameline">
              <span class="member-cell__name" :title="record.name">{{ record.name }}</span>
              <a-tag v-if="record.super" class="member-cell__tag--admin">系统内置</a-tag>
              <a-tag v-else-if="record.mustChangePassword" color="orange">待改密</a-tag>
            </div>
          </template>

          <template v-else-if="column.key === 'identifier'">
            <span class="member-cell__mono">{{ record.identifier }}</span>
          </template>

          <template v-else-if="column.key === 'roles'">
            <div class="member-cell__tags">
              <a-tag
                v-for="role in record.roleTags"
                :key="role.id"
                :class="{ 'member-cell__tag--admin': role.preset }"
              >
                {{ role.name }}
              </a-tag>
              <span v-if="!record.roleTags.length" class="member-cell__warn">无角色</span>
            </div>
          </template>

          <template v-else-if="column.key === 'status'">
            <div v-if="can('platform:member:toggle')" class="member-cell__status">
              <a-switch
                :checked="record.status === 'normal'"
                :disabled="record.super || toggleId === record.id"
                :loading="toggleId === record.id"
                size="small"
                @change="(checked: boolean) => handleStatusChange(record, checked)"
              />
              <span class="member-cell__status-text">{{ record.status === 'normal' ? '启用' : '停用' }}</span>
            </div>
            <span v-else class="member-cell__status-text">{{ record.status === 'normal' ? '启用' : '停用' }}</span>
            <p v-if="record.super" class="member-cell__note">系统内置账号不可停用</p>
          </template>

          <template v-else-if="column.key === 'updatedAt'">
            <span class="member-cell__time">{{ formatTime(record.updatedAt) }}</span>
          </template>

          <template v-else-if="column.key === 'action'">
            <span class="member-cell__actions">
              <a-button
                v-if="can('platform:member:resetpwd')"
                type="link"
                size="small"
                class="member-cell__action member-cell__action--reset"
                :disabled="record.status === 'disabled'"
                @click="openReset(record)"
              >
                重置密码
              </a-button>
              <a-button
                v-if="can('platform:member:edit')"
                type="link"
                size="small"
                class="member-cell__action member-cell__action--edit"
                :disabled="record.super"
                @click="openEdit(record)"
              >
                编辑
              </a-button>
              <a-popconfirm
                v-if="can('platform:member:delete')"
                title="确认删除该平台成员？"
                description="删除后该账号将不再是平台成员，且不再具备任何平台权限；此操作不可恢复。"
                ok-text="删除"
                ok-type="danger"
                cancel-text="取消"
                :disabled="record.super"
                @confirm="handleDelete(record)"
              >
                <a-button
                  type="link"
                  size="small"
                  danger
                  class="member-cell__action member-cell__action--danger"
                  :disabled="record.super"
                >
                  删除
                </a-button>
              </a-popconfirm>
            </span>
          </template>
        </template>
      </a-table>
    </section>

    <PlatformMemberForm v-model:open="formOpen" :member="editing" :roles="roles" @saved="handleSaved" />

    <!-- OVERLAY-02 重置密码 -->
    <a-modal
      v-model:open="resetOpen"
      :title="newPassword ? '密码已重置' : `重置密码 · ${resetting?.name ?? ''}`"
      :width="480"
      :confirm-loading="resettingSubmitting"
      :ok-text="newPassword ? '完成' : '确认重置'"
      :cancel-button-props="{ style: newPassword ? 'display:none' : '' }"
      @ok="handleResetOk"
      @cancel="handleResetCancel"
    >
      <template v-if="newPassword">
        <a-alert type="success" show-icon message="密码已重置，请线下告知该成员；本弹窗关闭后不再展示" />
        <div class="platform-reset__pwd">{{ newPassword }}</div>
        <a-button size="small" @click="copyPassword">复制</a-button>
      </template>
      <template v-else>
        <p class="member-modal__hint">
          重置后该成员的原密码将立即失效；该成员下次登录须修改密码。
        </p>
        <a-form layout="vertical" class="platform-form">
          <a-form-item label="新密码" required>
            <a-input-password
              v-model:value="resetPassword"
              placeholder="8-20 位，需含字母和数字"
              :maxlength="PLATFORM_PASSWORD_MAX"
              :disabled="resettingSubmitting"
            />
            <PasswordStrength :password="resetPassword" />
          </a-form-item>
        </a-form>
      </template>
    </a-modal>

    <ProtoTip :lines="tipLines" @reset="handleResetData">
      <template #extra>
        <a-button size="small" @click="simulateLoadFail">模拟加载失败</a-button>
      </template>
    </ProtoTip>
  </div>
</template>

<script setup lang="ts">
/**
 * PAL-PAGE-04 平台成员管理
 * 【原型说明】对齐《产品交互设计文档-平台成员管理》v1.0，**设计风格与企业端「企业成员」页保持一致**：
 * 页面标题区 + 筛选卡片 + 列表卡片；列表 + 新增 / 编辑 + 重置密码 + 启停用 + 删除；
 * 操作入口按平台权限点渲染；内置平台超管的停用 / 编辑 / 删除入口禁用并给出原因。
 * 与企业成员的差异：平台成员**不属任何企业**，故无「数据范围」列与字段（平台侧不设数据范围）。
 */
import { computed, onMounted, reactive, ref } from 'vue'
import { message } from 'antdv-next'
import type { TableColumnsType } from 'antdv-next'
import { DisconnectOutlined, PlusOutlined, ReloadOutlined, SearchOutlined } from '@antdv-next/icons'
import ProtoTip from '@/shared/components/ProtoTip.vue'
import PasswordStrength from '@/modules/auth/components/PasswordStrength.vue'
import PlatformMemberForm from '../components/PlatformMemberForm.vue'
import {
  PLATFORM_PASSWORD_MAX,
  PLATFORM_SEARCH_MAX,
  currentPlatformPermissions,
  deletePlatformMember,
  getPlatformRole,
  resetPlatformMemberPassword,
  sortedPlatformMembers,
  sortedPlatformRoles,
  togglePlatformMember,
  validatePlatformPassword,
  type PlatformMember,
  type PlatformRole,
} from '@/modules/platform/store'

const permissions = computed(() => currentPlatformPermissions())
function can(permission: string) {
  return permissions.value.includes(permission)
}

const roles = computed<PlatformRole[]>(() => sortedPlatformRoles())
const roleFilterOptions = computed(() =>
  roles.value.map((role) => ({ value: role.id, label: role.name })),
)
const statusOptions = [
  { value: 'normal', label: '正常' },
  { value: 'disabled', label: '已停用' },
]

/* ---------- 筛选与列表 ---------- */
const filters = reactive<{
  keyword: string
  roleIds: string[]
  status: 'normal' | 'disabled' | undefined
}>({ keyword: '', roleIds: [], status: undefined })

const applied = reactive({
  keyword: '',
  roleIds: [] as string[],
  status: 'all' as 'all' | 'normal' | 'disabled',
})

const hasFilter = computed(() => !!applied.keyword.trim() || applied.roleIds.length > 0 || applied.status !== 'all')

function applySearch() {
  applied.keyword = filters.keyword
  applied.roleIds = [...filters.roleIds]
  applied.status = filters.status ?? 'all'
  page.value = 1
}

function resetFilters() {
  filters.keyword = ''
  filters.roleIds = []
  filters.status = undefined
  applied.keyword = ''
  applied.roleIds = []
  applied.status = 'all'
  page.value = 1
}

interface MemberRow extends PlatformMember {
  roleTags: Array<{ id: string; name: string; preset: boolean }>
}

const loading = ref(true)
const failed = ref(false)
const page = ref(1)
const pageSize = ref(20)

const filtered = computed(() => {
  const keyword = applied.keyword.trim().toLowerCase()
  return sortedPlatformMembers().filter((member) => {
    if (keyword && !member.name.toLowerCase().includes(keyword) && !member.identifier.toLowerCase().includes(keyword)) {
      return false
    }
    if (applied.roleIds.length && !member.roleIds.some((id) => applied.roleIds.includes(id))) return false
    if (applied.status !== 'all' && member.status !== applied.status) return false
    return true
  })
})

const rows = computed<MemberRow[]>(() =>
  filtered.value.slice((page.value - 1) * pageSize.value, page.value * pageSize.value).map((member) => ({
    ...member,
    roleTags: member.roleIds
      .map((id) => getPlatformRole(id))
      .filter((role): role is PlatformRole => !!role)
      .map((role) => ({ id: role.id, name: role.name, preset: role.source === 'preset' })),
  })),
)

const pagination = computed(() => ({
  size: 'small' as const,
  current: page.value,
  pageSize: pageSize.value,
  total: filtered.value.length,
  pageSizeOptions: ['10', '20', '50', '100'],
  showSizeChanger: true,
  showTotal: (total: number) => `共 ${total} 条`,
}))

function handleTableChange(pager: { current?: number; pageSize?: number }) {
  page.value = pager.current ?? 1
  pageSize.value = pager.pageSize ?? 20
}

const columns: TableColumnsType<MemberRow> = [
  { title: '姓名', dataIndex: 'name', key: 'name', width: 180 },
  { title: '账号', dataIndex: 'identifier', key: 'identifier', width: 240 },
  { title: '平台角色', dataIndex: 'roles', key: 'roles', width: 240 },
  { title: '状态', dataIndex: 'status', key: 'status', width: 160 },
  { title: '更新时间', dataIndex: 'updatedAt', key: 'updatedAt', width: 170 },
  { title: '操作', key: 'action', width: 210, align: 'right' },
]

function formatTime(ts: number) {
  const d = new Date(ts)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** 【原型说明】模拟列表加载耗时，无真实接口调用 */
function loadList() {
  loading.value = true
  failed.value = false
  window.setTimeout(() => {
    loading.value = false
  }, 420)
}

/** 【原型说明】模拟列表加载失败（EX-MEM-01） */
function simulateLoadFail() {
  loading.value = true
  failed.value = true
  window.setTimeout(() => {
    loading.value = false
  }, 420)
}

onMounted(loadList)

/* ---------- 新增 / 编辑 ---------- */
const formOpen = ref(false)
const editing = ref<PlatformMember | null>(null)

function openCreate() {
  editing.value = null
  formOpen.value = true
}

function openEdit(record: PlatformMember) {
  if (record.super) {
    message.warning('系统内置平台超级管理员不可修改')
    return
  }
  editing.value = record
  formOpen.value = true
}

function handleSaved() {
  loadList()
  message.success('保存成功')
}

/* ---------- 启停用 ---------- */
const toggleId = ref('')

async function handleStatusChange(record: MemberRow, checked: boolean) {
  if (record.super) {
    message.warning('系统内置平台超级管理员不可停用')
    return
  }
  toggleId.value = record.id
  try {
    await togglePlatformMember(record.id, checked ? 'normal' : 'disabled')
    message.success(checked ? '已启用' : '已停用')
    loadList()
  } catch (error) {
    message.error(error instanceof Error ? error.message : '操作失败，请重试')
  } finally {
    toggleId.value = ''
  }
}

/* ---------- 删除 ---------- */
async function handleDelete(record: PlatformMember) {
  try {
    await deletePlatformMember(record.id)
    message.success('已删除')
    loadList()
  } catch (error) {
    message.error(error instanceof Error ? error.message : '删除失败，请重试')
  }
}

/* ---------- 重置密码 ---------- */
const resetOpen = ref(false)
const resetting = ref<PlatformMember | null>(null)
const resettingSubmitting = ref(false)
const resetPassword = ref('')
const newPassword = ref('')

function openReset(record: PlatformMember) {
  if (record.status === 'disabled') {
    message.warning('请先启用该成员后再重置密码')
    return
  }
  resetting.value = record
  resetPassword.value = ''
  newPassword.value = ''
  resetOpen.value = true
}

async function handleResetOk() {
  if (!resetting.value) return
  if (newPassword.value) {
    resetOpen.value = false
    return
  }
  const error = validatePlatformPassword(resetPassword.value, '请输入新密码')
  if (error) {
    message.error(error)
    return
  }
  resettingSubmitting.value = true
  try {
    await resetPlatformMemberPassword(resetting.value.id, resetPassword.value)
    newPassword.value = resetPassword.value
    loadList()
  } catch (error) {
    message.error(error instanceof Error ? error.message : '重置失败，请重试')
  } finally {
    resettingSubmitting.value = false
  }
}

function handleResetCancel() {
  if (newPassword.value) {
    message.warning('新密码仅展示一次，如需重新获取请再次重置')
  }
  resetOpen.value = false
}

function copyPassword() {
  navigator.clipboard?.writeText(newPassword.value)
  message.success('已复制')
}

/* ---------- 演示提示 ---------- */
const tipLines = [
  '平台成员为平台运营方内部人员，**不属任何企业**；新增成员时会校验账号是否已归属企业，已归属则拦截。',
  '演示：新增平台成员时，账号填写 `+8613800138000`（该账号已归属 3 家企业）会被「该账号已归属企业，请更换账号或先使其脱离原企业」拦截，可据此验证归属校验。',
  '筛选区为「搜索 + 角色 / 状态 + 查询 / 重置」：条件填好后点「查询」生效，点「重置」清空全部条件。',
  '列表展示姓名、账号、平台角色、状态、更新时间与操作；账号按原值展示，不做脱敏。',
  '成员状态用开关控制启用 / 停用；系统内置平台超级管理员的编辑、停用与删除入口均为禁用态。',
  '本页与「企业成员」页设计风格一致，差异在于平台成员不属任何企业，故无「数据范围」列（平台侧不设数据范围）。',
  '下方按钮可快速验证列表加载失败状态，验证后请重置演示数据。',
]

function handleResetData() {
  void import('@/modules/platform/store').then(({ resetPlatformData }) => {
    resetPlatformData()
    resetFilters()
    loadList()
  })
}
</script>
