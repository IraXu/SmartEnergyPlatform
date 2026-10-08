<template>
  <div v-if="!canView" class="page-container member-page">
    <div class="member-page__denied">
      <a-empty description="当前账号无权限执行此操作" />
      <a-button type="primary" @click="router.push('/dashboard')">返回</a-button>
    </div>
  </div>

  <div v-else class="page-container member-page">
    <!-- 页面标题区（AREA-MEM-01） -->
    <header class="member-page__head">
      <div>
        <h1 class="member-page__title">企业成员</h1>
        <p class="member-page__desc">管理本企业成员账号，分配角色与数据范围以控制可用功能与可见数据</p>
      </div>
      <a-button v-if="canCreate" type="primary" @click="openCreate">
        <template #icon>
          <PlusOutlined />
        </template>
        新增成员
      </a-button>
    </header>

    <!-- 筛选区卡片（AREA-MEM-02）：四个控件等宽同高，条件填好后点「查询」生效 -->
    <section class="member-filter">
      <a-input
        v-model:value="filters.keyword"
        class="member-filter__control"
        placeholder="搜索成员姓名或账号"
        allow-clear
        :maxlength="SEARCH_MAX"
        @press-enter="applySearch"
      >
        <template #prefix>
          <SearchOutlined class="member-filter__icon" />
        </template>
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

      <!-- 组织节点筛选：下拉宽度按内容自适应，节点层级路径完整展示不换行 -->
      <a-tree-select
        v-model:value="filters.scopeId"
        class="member-filter__control"
        allow-clear
        show-search
        tree-default-expand-all
        tree-node-filter-prop="title"
        :popup-match-select-width="false"
        popup-class-name="member-scope-filter-popup"
        placeholder="按组织节点筛选"
        :tree-data="scopeTreeData"
      />

      <div class="member-filter__actions">
        <a-button type="primary" @click="applySearch">
          <template #icon>
            <SearchOutlined />
          </template>
          查询
        </a-button>
        <a-button @click="resetFilters">
          <template #icon>
            <ReloadOutlined />
          </template>
          重置
        </a-button>
      </div>
    </section>

    <!-- 列表卡片（AREA-MEM-03） -->
    <section class="member-list">
      <!-- 加载中（STATE-MEM-01） -->
      <div v-if="loading" class="member-list__body">
        <a-skeleton active :paragraph="{ rows: 6 }" />
      </div>

      <!-- 加载失败（STATE-MEM-05） -->
      <div v-else-if="failed" class="member-list__body member-list__body--center">
        <div class="member-list__state">
          <span class="member-list__state-icon">
            <DisconnectOutlined />
          </span>
          <p class="member-list__state-title">成员列表加载失败</p>
          <p class="member-list__state-desc">网络异常或服务暂时不可用，请稍后重试</p>
          <a-button type="primary" class="member-list__state-action" @click="loadList">
            <template #icon>
              <ReloadOutlined />
            </template>
            重新加载
          </a-button>
        </div>
      </div>

      <!-- 空态（STATE-MEM-03、STATE-MEM-04） -->
      <div v-else-if="!rows.length" class="member-list__body member-list__body--center">
        <a-empty :description="hasFilter ? '未找到匹配的成员' : '还没有其他成员，点击「新增成员」开始添加'">
          <a-button v-if="hasFilter" @click="resetFilters">重置筛选</a-button>
          <a-button v-else-if="canCreate" type="primary" @click="openCreate">新增成员</a-button>
        </a-empty>
      </div>

      <!-- 成员表格（CMP-MEM-11 ~ CMP-MEM-20） -->
      <a-table
        v-else
        :columns="columns"
        :data-source="rows"
        :pagination="pagination"
        :row-class-name="rowClassName"
        row-key="id"
        size="middle"
        @change="handleTableChange"
      >
        <template #bodyCell="{ column, record }">
          <!-- 姓名列：纯文本，不展示头像（Q-IXD-MEM-01） -->
          <template v-if="column.key === 'name'">
            <span class="member-cell__name" :title="(record as MemberRow).name">{{ (record as MemberRow).name }}</span>
          </template>

          <!-- 账号列：不脱敏，展示账号类型标识 -->
          <template v-else-if="column.key === 'identifier'">
            <div class="member-cell__account">
              <span class="member-cell__mono">{{ (record as MemberRow).identifier }}</span>
              <span class="member-cell__type">{{ (record as MemberRow).accountTypeText }}</span>
            </div>
          </template>

          <!-- 角色列：标签组，最多 2 个 + 溢出计数 -->
          <template v-else-if="column.key === 'roles'">
            <div class="member-cell__tags">
              <a-tag
                v-for="role in (record as MemberRow).roleTags.slice(0, 2)"
                :key="role.id"
                :class="{ 'member-cell__tag--admin': role.preset }"
              >
                {{ role.name }}
              </a-tag>
              <a-tooltip v-if="(record as MemberRow).roleTags.length > 2" :title="roleTooltip(record as MemberRow)">
                <a-tag>+{{ (record as MemberRow).roleTags.length - 2 }}</a-tag>
              </a-tooltip>
              <span v-if="!(record as MemberRow).roleTags.length" class="member-cell__warn">无角色</span>
            </div>
          </template>

          <!-- 数据范围列：可点击查看详细节点（成员可能管理超多组织节点） -->
          <template v-else-if="column.key === 'scope'">
            <a
              v-if="(record as MemberRow).scope.type !== 'none'"
              class="member-cell__scope-link"
              @click="openScopeDetail(record as MemberRow)"
            >
              {{ (record as MemberRow).scope.text }}
            </a>
            <span v-else class="member-cell__warn">{{ (record as MemberRow).scope.text }}</span>
            <p v-if="(record as MemberRow).scopeInvalid" class="member-cell__warn member-cell__warn--hint">
              部分组织节点已失效，请重新选择
            </p>
          </template>

          <!-- 状态列：开关控制启用 / 停用；无启停用权限时降级为只读文案 -->
          <template v-else-if="column.key === 'status'">
            <div v-if="canToggle" class="member-cell__status">
              <a-switch
                :checked="(record as MemberRow).status === 'normal'"
                :disabled="(record as MemberRow).isLastAdmin || toggleId === (record as MemberRow).id"
                :loading="toggleId === (record as MemberRow).id"
                size="small"
                @change="handleStatusChange(record as MemberRow, $event as boolean)"
              />
              <span class="member-cell__status-text">{{ (record as MemberRow).statusText }}</span>
            </div>
            <span v-else class="member-cell__status-text">{{ (record as MemberRow).statusText }}</span>
            <p v-if="(record as MemberRow).lockText" class="member-cell__note member-cell__note--warn">
              <ExclamationCircleOutlined /> {{ (record as MemberRow).lockText }}
            </p>
            <p v-else-if="(record as MemberRow).mustChangePassword" class="member-cell__note member-cell__note--warn">
              <ExclamationCircleOutlined /> 待改密
            </p>
          </template>

          <!-- 更新时间列 -->
          <template v-else-if="column.key === 'updatedAt'">
            <span class="member-cell__time">{{ (record as MemberRow).updatedText }}</span>
          </template>

          <!-- 操作列：重置密码（主色）、编辑（中性）、删除（危险色），三种动作色彩与悬停态各自独立 -->
          <template v-else-if="column.key === 'action'">
            <span class="member-cell__actions">
              <a-button
                v-if="canReset"
                type="link"
                size="small"
                class="member-cell__action member-cell__action--reset"
                :disabled="(record as MemberRow).status === 'disabled'"
                @click="openReset(record as MemberRow)"
              >
                重置密码
              </a-button>
              <a-button
                v-if="canEdit"
                type="link"
                size="small"
                class="member-cell__action member-cell__action--edit"
                @click="openEdit(record as MemberRow)"
              >
                编辑
              </a-button>
              <a-button
                v-if="canRemove"
                type="link"
                size="small"
                danger
                class="member-cell__action member-cell__action--danger"
                :disabled="(record as MemberRow).isLastAdmin || (record as MemberRow).isSelf"
                @click="openRemove(record as MemberRow)"
              >
                删除
              </a-button>
            </span>
          </template>
        </template>
      </a-table>
    </section>

    <!-- OVERLAY-01 新增成员 / OVERLAY-02 编辑成员 -->
    <a-modal
      v-model:open="formOpen"
      :title="formMode === 'create' ? '新增成员' : '编辑成员'"
      :width="640"
      :mask-closable="!submitting"
      :closable="!isResultMode"
      :ok-button-props="{ loading: submitting }"
      :ok-text="isResultMode ? '完成' : '确定'"
      :cancel-button-props="{ style: isResultMode ? 'display:none' : '' }"
      @ok="handleFormOk"
      @cancel="handleFormCancel"
    >
      <!-- key 随每次打开递增，保证弹窗复用时不残留上一次的输入与结果态 -->
      <MemberForm
        :key="formNonce"
        ref="formRef"
        :mode="formMode"
        :member-id="editingId ?? undefined"
        :initial="editingInitial"
        :prefill="formPrefill"
        :submitting="submitting"
        @submit="handleFormSubmit"
      />
    </a-modal>

    <!-- OVERLAY-03 停用确认 -->
    <a-modal
      v-model:open="disableOpen"
      title="确认停用该成员？"
      :width="440"
      :mask-closable="!submitting"
      :ok-button-props="{ loading: submitting }"
      ok-text="确认停用"
      cancel-text="取消"
      @ok="handleDisableSubmit"
    >
      <div class="member-modal__card">
        <div class="member-modal__card-row">
          <span class="member-modal__card-label">成员</span>
          <div class="member-modal__card-main">
            <p class="member-modal__card-name" :title="actionTarget?.name">{{ actionTarget?.name }}</p>
            <p class="member-modal__card-mono" :title="actionTarget?.identifier">{{ actionTarget?.identifier }}</p>
          </div>
        </div>
        <div class="member-modal__card-row">
          <span class="member-modal__card-label">角色</span>
          <div class="member-modal__tags">
            <a-tag v-for="role in actionTarget?.roleTags ?? []" :key="role.id">{{ role.name }}</a-tag>
            <span v-if="!actionTarget?.roleTags.length" class="member-modal__empty">无角色</span>
          </div>
        </div>
      </div>
      <p class="member-modal__hint">
        停用后该成员将无法登录平台，其角色与数据范围将保留，可随时重新启用。
      </p>
      <p v-if="isSelfTarget" class="member-modal__warn">
        <ExclamationCircleOutlined /> 停用后你本人也会被退出登录
      </p>
    </a-modal>

    <!-- OVERLAY-04 删除确认：成员信息卡 + 三条风险说明 + 必勾选确认项 -->
    <a-modal
      v-model:open="removeOpen"
      title="确认删除该成员？"
      :width="520"
      :mask-closable="!submitting"
      :ok-button-props="{ loading: submitting, danger: true, disabled: !removeConfirmed }"
      ok-text="确认删除"
      cancel-text="取消"
      @ok="handleRemoveSubmit"
    >
      <!-- 成员信息卡：姓名与账号分两行各占一行省略，避免长账号与角色标签挤在一行后折行 -->
      <div class="member-modal__card">
        <div class="member-modal__card-row">
          <span class="member-modal__card-label">成员</span>
          <div class="member-modal__card-main">
            <p class="member-modal__card-name" :title="actionTarget?.name">{{ actionTarget?.name }}</p>
            <p class="member-modal__card-mono" :title="actionTarget?.identifier">{{ actionTarget?.identifier }}</p>
          </div>
        </div>
        <div class="member-modal__card-row">
          <span class="member-modal__card-label">角色</span>
          <div class="member-modal__tags">
            <a-tag v-for="role in actionTarget?.roleTags ?? []" :key="role.id">{{ role.name }}</a-tag>
            <span v-if="!actionTarget?.roleTags.length" class="member-modal__empty">无角色</span>
          </div>
        </div>
        <div class="member-modal__card-row">
          <span class="member-modal__card-label">数据范围</span>
          <span class="member-modal__card-value">{{ actionTarget?.scope.text }}</span>
        </div>
      </div>

      <p class="member-modal__lead">删除后以下信息将同时受影响，请确认：</p>
      <ul class="member-modal__risks">
        <li><ExclamationCircleOutlined /> 该成员账号将无法恢复，且不提供回收站</li>
        <li><ExclamationCircleOutlined /> 若其被组织架构节点指定为负责人，相应节点负责人将被清空</li>
        <li><ExclamationCircleOutlined /> 历史操作记录将保留在系统日志中，用于审计追溯</li>
      </ul>
      <p v-if="isSoleMemberOfRole" class="member-modal__warn">
        <ExclamationCircleOutlined /> 删除后其所属角色将不再有任何成员
      </p>

      <a-checkbox v-model:checked="removeConfirmed" class="member-modal__confirm">
        我已了解删除后不可恢复
      </a-checkbox>
    </a-modal>

    <!-- OVERLAY-05 重置密码：确认态 → 结果态 -->
    <a-modal
      v-model:open="resetOpen"
      :title="resetResult ? '密码已重置' : '确认重置该成员的密码？'"
      :width="480"
      :mask-closable="!submitting"
      :ok-button-props="{ loading: submitting }"
      :ok-text="resetResult ? '完成' : '确认重置'"
      :cancel-button-props="{ style: resetResult ? 'display:none' : '' }"
      @ok="resetResult ? closeReset() : handleResetSubmit()"
      @cancel="resetResult ? guardResetClose() : (resetOpen = false)"
    >
      <template v-if="!resetResult">
        <div class="member-modal__card">
          <div class="member-modal__card-row">
            <span class="member-modal__card-label">成员</span>
            <div class="member-modal__card-main">
              <p class="member-modal__card-name" :title="actionTarget?.name">{{ actionTarget?.name }}</p>
              <p class="member-modal__card-mono" :title="actionTarget?.identifier">{{ actionTarget?.identifier }}</p>
            </div>
          </div>
        </div>
        <p class="member-modal__hint">
          重置后该成员的原密码将立即失效，新密码仅展示一次；该成员下次登录须修改密码；同时将解除该成员的登录失败锁定状态。
        </p>
      </template>
      <template v-else>
        <div class="member-form__credential">
          <div class="member-form__credential-row">
            <span class="member-form__credential-label">新密码</span>
            <span class="member-form__mono">{{ resetPassword }}</span>
            <a-button type="link" size="small" @click="copyText(resetPassword)">复制</a-button>
          </div>
        </div>
        <p class="member-form__warn">新密码仅展示一次，请及时告知成员</p>
      </template>
    </a-modal>

    <!-- OVERLAY-06 数据范围详情：成员可能管理超多组织节点，需按层级查看全部范围 -->
    <a-modal
      v-model:open="scopeDetailOpen"
      title="数据范围详情"
      :width="640"
      :footer="null"
      class="member-scope-detail-modal"
    >
      <!-- 成员信息条：姓名 + 账号 + 节点数，一眼确认当前查看的是谁 -->
      <div class="scope-detail__summary">
        <div class="scope-detail__avatar"><UserOutlined /></div>
        <div class="scope-detail__summary-main">
          <p class="scope-detail__summary-name">{{ scopeDetailTarget?.name }}</p>
          <p class="scope-detail__summary-sub">{{ scopeDetailTarget?.identifier }}</p>
        </div>
        <a-tag class="scope-detail__summary-tag">
          {{ isSuperAdminTarget ? '全部数据' : `${scopeDetailNodes.length} 个组织节点` }}
        </a-tag>
      </div>

      <a-input
        v-model:value="scopeDetailKeyword"
        class="scope-detail__search"
        placeholder="按节点名称或层级路径筛选"
        allow-clear
      >
        <template #prefix>
          <SearchOutlined class="member-filter__icon" />
        </template>
      </a-input>

      <div class="scope-detail__body">
        <a-empty v-if="!scopeDetailNodes.length" description="该成员未设置数据范围" />
        <a-empty v-else-if="!filteredScopeDetailNodes.length" description="未找到匹配的组织节点" />
        <ul v-else class="scope-detail__list">
          <li v-for="node in filteredScopeDetailNodes" :key="node.id" class="scope-detail__item">
            <span class="scope-detail__item-icon"><ApartmentOutlined /></span>
            <div class="scope-detail__item-main">
              <p class="scope-detail__item-name">{{ node.name }}</p>
              <p class="scope-detail__item-path">{{ node.path }}</p>
            </div>
            <a-tag class="scope-detail__item-tag">含下级</a-tag>
          </li>
        </ul>
      </div>

      <div class="scope-detail__footer">
        <span class="scope-detail__hint">
          <InfoCircleOutlined /> 所选节点均包含其全部下级，无需再单独选择下级节点
        </span>
        <a-button @click="scopeDetailOpen = false">关闭</a-button>
      </div>
    </a-modal>

    <ProtoTip :lines="tipLines" @reset="handleResetData">
      <template #extra>
        <a-space size="small" wrap>
          <a-button size="small" @click="simulateLoadFail">模拟列表加载失败</a-button>
          <a-button size="small" @click="simulateLock">模拟账号锁定</a-button>
          <a-button size="small" @click="simulateJoinEnterprise">模拟加入企业账号</a-button>
        </a-space>
      </template>
    </ProtoTip>
  </div>
</template>

<script setup lang="ts">
/**
 * PAGE-01 企业成员
 * 【原型说明】对齐《产品交互设计文档-企业成员》v1.0 4.1（PAGE-01）与第 5 章（OVERLAY-01~06、COMP-MEM-01）。
 * 覆盖成员列表与检索、新增（一次性交付初始密码）、编辑、角色与数据范围分配、启停用开关、
 * 删除（二次确认 + 勾选风险确认项）、重置密码、数据范围详情、超级管理员保护与各异常分支。
 */
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { message } from 'antdv-next'
import type { TableColumnsType } from 'antdv-next'
import {
  ApartmentOutlined,
  DisconnectOutlined,
  ExclamationCircleOutlined,
  InfoCircleOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
  UserOutlined,
} from '@antdv-next/icons'
import ProtoTip from '@/shared/components/ProtoTip.vue'
import MemberForm from '../components/MemberForm.vue'
import { getLock, isLocked, remainLockMinutes } from '@/modules/auth/store/lock'
import { session } from '@/modules/auth/store'
import { findAccount } from '@/modules/auth/store/account'
import { currentPermissions } from '@/modules/role/store'
import {
  SEARCH_MAX,
  createMember,
  dedupeScopeIds,
  filterMembers,
  getMember,
  getPathText,
  identifierInOrg,
  isLastSuperAdmin,
  isSuperAdmin,
  removeMember,
  resetMemberPassword,
  roleList,
  roleMemberCount,
  scopeNodeOptions,
  scopeText,
  toggleMember,
  updateMember,
} from '../store'
import type { Member } from '../store'

const router = useRouter()
const route = useRoute()

/* ---------- 权限点：入口按当前账号的功能权限显隐（PRD Q-ROL-01 / 5.3） ---------- */
/* 菜单级权限点 `system:member` 即「可进入企业成员并查看」；其余为该页面的按钮级权限点 */
const canView = computed(() => has('system:member'))
const canCreate = computed(() => has('system:member:create'))
const canEdit = computed(() => has('system:member:edit'))
const canToggle = computed(() => has('system:member:toggle'))
const canReset = computed(() => has('system:member:password:reset'))
const canRemove = computed(() => has('system:member:delete'))

function has(key: string) {
  return currentPermissions().includes(key)
}

/* ---------- 筛选与列表 ---------- */
const filters = reactive<{
  keyword: string
  roleIds: string[]
  status: 'normal' | 'disabled' | undefined
  scopeId: string | null | undefined
}>({
  keyword: '',
  roleIds: [],
  status: undefined,
  scopeId: null,
})

/** 已应用的筛选快照：点「查询」后才生效，与表单中的待提交条件区分 */
const applied = reactive({
  keyword: '',
  roleIds: [] as string[],
  status: 'all' as 'all' | 'normal' | 'disabled',
  scopeId: null as string | null,
})

const hasFilter = computed(
  () => !!applied.keyword.trim() || applied.roleIds.length > 0 || applied.status !== 'all' || !!applied.scopeId,
)

const roleFilterOptions = computed(() =>
  roleList.map((role) => ({ value: role.id, label: `${role.name}（${roleMemberCount(role.id)}）` })),
)

const statusOptions = [
  { value: 'normal', label: '正常' },
  { value: 'disabled', label: '已停用' },
]

/** 组织节点筛选树：只含企业根节点与组织节点（与数据范围口径一致） */
const scopeTreeData = computed(() => {
  const options = scopeNodeOptions()
  const childrenMap = new Map<string | null, typeof options>()
  options.forEach((node) => {
    const list = childrenMap.get(node.parentId) ?? []
    list.push(node)
    childrenMap.set(node.parentId, list)
  })
  childrenMap.forEach((list) => list.sort((a, b) => a.order - b.order))
  const build = (parentId: string | null): Array<Record<string, unknown>> =>
    (childrenMap.get(parentId) ?? []).map((node) => {
      const children = build(node.id)
      return { value: node.id, title: node.name, children: children.length ? children : undefined }
    })
  return build(null)
})

/** 列表行：把成员数据加工为单元格需要的展示信息 */
interface MemberRow extends Member {
  accountTypeText: string
  roleTags: Array<{ id: string; name: string; preset: boolean }>
  scope: { text: string; type: 'full' | 'partial' | 'none' }
  scopeInvalid: boolean
  statusText: string
  lockText: string
  updatedText: string
  isLastAdmin: boolean
  isSelf: boolean
}

function toRow(member: Member): MemberRow {
  const locked = isLocked(member.identifier)
  const selfIdentifier = session.current?.identifier ?? ''
  const nodeOptions = scopeNodeOptions()
  return {
    ...member,
    accountTypeText: member.accountType === 'phone' ? '手机号' : '邮箱',
    roleTags: member.roleIds
      .map((id) => roleList.find((role) => role.id === id))
      .filter((role): role is NonNullable<typeof role> => !!role)
      .map((role) => ({ id: role.id, name: role.name, preset: role.source === 'preset' })),
    scope: scopeText(member),
    scopeInvalid: member.scopeIds.some((id) => !nodeOptions.some((node) => node.id === id)),
    statusText: member.status === 'normal' ? '启用' : '停用',
    // 已停用成员不再展示锁定附注（停用优先）
    lockText:
      member.status === 'normal' && locked ? `已锁定（剩余 ${remainLockMinutes(member.identifier)} 分钟）` : '',
    updatedText: formatTime(member.updatedAt),
    isLastAdmin: isLastSuperAdmin(member),
    isSelf: !!selfIdentifier && selfIdentifier === member.identifier,
  }
}

const loading = ref(true)
const failed = ref(false)
const page = ref(1)
const pageSize = ref(20)

const filtered = computed(() => filterMembers(applied))
const rows = computed(() =>
  filtered.value.slice((page.value - 1) * pageSize.value, page.value * pageSize.value).map(toRow),
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

/** 从角色管理跳转过来的成员行加高亮类，便于从角色视角核对到具体成员 */
function rowClassName(record: MemberRow) {
  return record.id === highlightId.value ? 'member-row--highlight' : ''
}

/** 点「查询」应用当前筛选条件（筛选条件需提交后才生效） */
function applySearch() {
  applied.keyword = filters.keyword
  applied.roleIds = [...filters.roleIds]
  applied.status = filters.status ?? 'all'
  applied.scopeId = filters.scopeId ?? null
  page.value = 1
}

function resetFilters() {
  filters.keyword = ''
  filters.roleIds = []
  filters.status = undefined
  filters.scopeId = null
  applied.keyword = ''
  applied.roleIds = []
  applied.status = 'all'
  applied.scopeId = null
  page.value = 1
}

/* ---------- 列定义 ---------- */
const columns: TableColumnsType<MemberRow> = [
  { title: '姓名', dataIndex: 'name', key: 'name', width: 140, ellipsis: true },
  { title: '账号', dataIndex: 'identifier', key: 'identifier', width: 200 },
  { title: '角色', dataIndex: 'roles', key: 'roles', width: 220 },
  { title: '数据范围', dataIndex: 'scope', key: 'scope', width: 190 },
  { title: '状态', dataIndex: 'status', key: 'status', width: 160 },
  { title: '更新时间', dataIndex: 'updatedAt', key: 'updatedAt', width: 170 },
  { title: '操作', key: 'action', width: 210, align: 'right' },
]

function roleTooltip(row: MemberRow) {
  return row.roleTags.map((role) => role.name).join('、')
}

/** 列表加载（【原型说明】模拟异步耗时，无真实接口调用） */
function loadList() {
  loading.value = true
  failed.value = false
  window.setTimeout(() => {
    loading.value = false
  }, 420)
}

onMounted(() => {
  loadList()
  // 从角色管理「查看成员」跳转时按角色筛选（角色管理 OVERLAY-05 的跳转行为）
  const roleId = route.query.role
  if (typeof roleId === 'string' && roleId) {
    filters.roleIds = [roleId]
    applied.roleIds = [roleId]
  }
  // 聚焦跳转来源的成员行，便于从角色视角直接核对到具体成员
  const memberId = route.query.member
  if (typeof memberId === 'string' && memberId) highlightId.value = memberId
})

/** 从角色管理跳转过来的成员行，用于高亮定位 */
const highlightId = ref('')

/* ---------- 行操作 ---------- */

const actionTarget = ref<MemberRow | null>(null)

/** 状态开关：切到停用需二次确认，切回启用直接提交 */
const toggleId = ref('')

function handleStatusChange(row: MemberRow, checked: boolean) {
  actionTarget.value = row
  if (checked) {
    handleEnable(row)
    return
  }
  if (row.isLastAdmin) {
    message.warning('企业需至少保留 1 名超级管理员，该成员不可停用')
    return
  }
  disableOpen.value = true
}

const isSelfTarget = computed(() => !!actionTarget.value?.isSelf)
const isSoleMemberOfRole = computed(() => {
  const target = actionTarget.value
  if (!target) return false
  return target.roleIds.some((id) => roleMemberCount(id) === 1)
})

/* ---------- OVERLAY-03 停用 / 启用 ---------- */
const disableOpen = ref(false)
const submitting = ref(false)

async function handleDisableSubmit() {
  const target = actionTarget.value
  if (!target) return
  submitting.value = true
  toggleId.value = target.id
  try {
    await toggleMember(target.id, false)
    disableOpen.value = false
    message.success('已停用')
    if (target.isSelf) {
      // 停用本人后立即退出登录（OVERLAY-03 的本人停用提醒）
      window.setTimeout(() => router.push('/login'), 600)
    }
  } catch (error) {
    message.error(error instanceof Error ? error.message : '停用失败，请重试')
  } finally {
    submitting.value = false
    toggleId.value = ''
  }
}

async function handleEnable(row: MemberRow) {
  toggleId.value = row.id
  try {
    await toggleMember(row.id, true)
    message.success('已启用')
  } catch (error) {
    message.error(error instanceof Error ? error.message : '启用失败，请重试')
  } finally {
    toggleId.value = ''
  }
}

/* ---------- OVERLAY-04 删除 ---------- */
const removeOpen = ref(false)
const removeConfirmed = ref(false)

function openRemove(row: MemberRow) {
  if (row.isLastAdmin) {
    message.warning('企业需至少保留 1 名超级管理员，该成员不可删除')
    return
  }
  if (row.isSelf) {
    message.warning('不能删除当前登录账号')
    return
  }
  actionTarget.value = row
  removeConfirmed.value = false
  removeOpen.value = true
}

async function handleRemoveSubmit() {
  const target = actionTarget.value
  if (!target || !removeConfirmed.value) return
  submitting.value = true
  try {
    await removeMember(target.id)
    removeOpen.value = false
    message.success('成员已删除')
  } catch (error) {
    message.error(error instanceof Error ? error.message : '删除失败，请重试')
  } finally {
    submitting.value = false
  }
}

/* ---------- OVERLAY-05 重置密码 ---------- */
const resetOpen = ref(false)
const resetResult = ref(false)
const resetPassword = ref('')
const resetCopied = ref(false)

function openReset(row: MemberRow) {
  if (row.status === 'disabled') {
    message.warning('请先启用该成员后再重置密码')
    return
  }
  actionTarget.value = row
  resetResult.value = false
  resetPassword.value = ''
  resetCopied.value = false
  resetOpen.value = true
}

async function handleResetSubmit() {
  const target = actionTarget.value
  if (!target) return
  submitting.value = true
  try {
    resetPassword.value = await resetMemberPassword(target.id)
    resetResult.value = true
    message.success('密码已重置')
  } catch (error) {
    message.error(error instanceof Error ? error.message : '重置失败，请重试')
  } finally {
    submitting.value = false
  }
}

/** 结果态关闭保护：未复制时拦截关闭 */
function guardResetClose() {
  if (!resetCopied.value) {
    message.warning('新密码仅展示一次，如需重新获取请再次重置')
  }
  closeReset()
}

function closeReset() {
  resetOpen.value = false
  resetResult.value = false
}

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    resetCopied.value = true
    message.success('已复制')
  } catch {
    message.warning('复制失败，请手动选择复制')
  }
}

/* ---------- OVERLAY-06 数据范围详情 ---------- */

const scopeDetailOpen = ref(false)
const scopeDetailTarget = ref<MemberRow | null>(null)
const scopeDetailKeyword = ref('')

/** 数据范围展开为「节点名称 + 完整层级路径」，便于成员管理超多组织节点时逐条核对 */
const scopeDetailNodes = computed(() => {
  const target = scopeDetailTarget.value
  if (!target) return []
  const options = scopeNodeOptions()
  const ids = isSuperAdmin(target) ? options.map((node) => node.id) : dedupeScopeIds(target.scopeIds)
  return ids.map((id) => ({
    id,
    name: options.find((node) => node.id === id)?.name ?? id,
    path: getPathText(id),
  }))
})

/** 企业超级管理员的数据范围锁定为「全部数据」（PRD Q-MEM-08） */
const isSuperAdminTarget = computed(() => !!scopeDetailTarget.value && isSuperAdmin(scopeDetailTarget.value))

const filteredScopeDetailNodes = computed(() => {
  const value = scopeDetailKeyword.value.trim().toLowerCase()
  if (!value) return scopeDetailNodes.value
  return scopeDetailNodes.value.filter(
    (node) => node.name.toLowerCase().includes(value) || node.path.toLowerCase().includes(value),
  )
})

function openScopeDetail(row: MemberRow) {
  if (row.scope.type === 'none') {
    message.info('该成员未设置数据范围')
    return
  }
  scopeDetailTarget.value = row
  scopeDetailKeyword.value = ''
  scopeDetailOpen.value = true
}

/* ---------- OVERLAY-01 / OVERLAY-02 新增与编辑 ---------- */
const formOpen = ref(false)
const formMode = ref<'create' | 'edit'>('create')
const formRef = ref<InstanceType<typeof MemberForm> | null>(null)
/** 每次打开表单弹窗时递增，用于重建表单组件、清空上一次的输入与结果态 */
const formNonce = ref(0)
const editingId = ref<string | null>(null)
const isResultMode = ref(false)
/** 【原型演示】新增表单的预填值，仅用于一键演示「加入企业」等分支 */
const formPrefill = ref<{ name?: string; identifier?: string } | undefined>(undefined)

const editingInitial = computed(() => {
  if (formMode.value !== 'edit' || !editingId.value) return undefined
  const member = getMember(editingId.value)
  if (!member) return undefined
  return {
    name: member.name,
    identifier: member.identifier,
    roleIds: [...member.roleIds],
    scopeIds: [...member.scopeIds],
  }
})

function openCreate() {
  if (!canCreate.value) return
  if (!roleList.length) {
    message.warning('暂无可分配的角色，请先在「角色管理」中创建角色')
    return
  }
  formMode.value = 'create'
  editingId.value = null
  isResultMode.value = false
  formPrefill.value = undefined
  formNonce.value += 1
  formOpen.value = true
}

function openEdit(row: MemberRow) {
  if (!canEdit.value) return
  formMode.value = 'edit'
  editingId.value = row.id
  isResultMode.value = false
  formNonce.value += 1
  formOpen.value = true
}

async function handleFormOk() {
  if (isResultMode.value) {
    formOpen.value = false
    isResultMode.value = false
    return
  }
  // 校验与提交载荷由 MemberForm 负责，校验通过后经 submit 事件回传
  formRef.value?.submit()
}

interface FormPayload {
  name: string
  accountType: 'phone' | 'email'
  identifier: string
  countryCode: string
  password: string
  roleIds: string[]
  scopeIds: string[]
}

/** MemberForm 校验通过后回传的提交载荷 */
async function handleFormSubmit(payload: FormPayload) {
  submitting.value = true
  try {
    if (formMode.value === 'create') {
      const created = await createMember(payload)
      // 切到结果态并一次性展示账号与初始密码；账号已存在时无新密码可展示
      formRef.value?.showResult(created.identifier, created.mustChangePassword ? payload.password : '')
      isResultMode.value = true
      message.success('新增成功')
      return
    }

    const id = editingId.value
    if (!id) return
    await updateMember(id, {
      name: payload.name,
      accountType: payload.accountType,
      identifier: payload.identifier,
      countryCode: payload.countryCode,
      roleIds: payload.roleIds,
      scopeIds: payload.scopeIds,
    })
    formOpen.value = false
    message.success('已保存')
  } catch (error) {
    message.error(error instanceof Error ? error.message : '保存失败，请重试')
  } finally {
    submitting.value = false
  }
}

function handleFormCancel() {
  if (isResultMode.value) {
    message.warning('初始密码仅展示一次，如需重新获取请重置密码')
  }
  formOpen.value = false
  isResultMode.value = false
}

/* ---------- 工具 ---------- */

function formatTime(value: number) {
  const date = new Date(value)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/* ---------- 演示提示与模拟入口 ---------- */
const tipLines = [
  '筛选区为「搜索 + 角色 / 状态 / 组织节点 + 查询 / 重置」：条件填好后点「查询」生效，点「重置」清空全部条件。',
  '列表展示姓名、账号、角色、数据范围、状态、更新时间与操作；账号按原值展示，不做脱敏。',
  '成员状态用开关控制启用 / 停用：关闭时弹出二次确认，开启时直接生效；最后一名超管的开关为禁用态。',
  '数据范围可点击查看详情：弹窗内按层级路径逐条列出该成员的全部组织节点，支持按名称或路径筛选，便于成员管理超多组织节点时核对。',
  '新增成员会一次性展示账号与初始密码，仅展示一次；未复制就关闭会给出拦截提醒。',
  '若输入的账号已存在于平台（已归属其他企业或已自助注册），将进入「加入企业」：不要求设置密码，沿用该账号现有密码，结果态也不展示密码。可点下方「模拟加入企业账号」一键预填演示账号（仅归属其他企业、本企业没有）。',
  '账号类型由输入内容自动识别（含字母或 @ 视为邮箱），弹窗内不提供账号类型切换。',
  '成员为企业超级管理员时，编辑弹窗的数据范围字段只读并展示「全部数据」。',
  '删除成员需勾选「我已了解删除后不可恢复」，并逐条列出不可恢复、清空组织架构节点负责人引用、历史记录保留三条风险。',
  '不能删除当前登录账号；最后一名超级管理员的删除入口为禁用态。',
  '重置密码由系统随机生成，结果态一次性展示；重置会解除该成员的登录失败锁定。',
  '停用与删除只作用于本企业：该账号在其他企业的归属与登录不受影响；停用后该成员将不再出现在登录时的「选择登录企业」列表。',
  '平台级停用是平台运营方的独立处置（预置账号 +8613700137000 即被平台停用），与本页的企业级停用叠加生效。',
  '下方按钮可快速验证列表加载失败与账号锁定附注两种状态，验证后请重置演示数据。',
]

function handleResetData() {
  // 成员模块与角色模块的演示数据一并重置，避免「角色已重置但成员仍指向旧角色」
  void import('@/modules/member/store').then(({ resetMemberData }) => {
    resetMemberData()
    resetFilters()
    loadList()
  })
  void import('@/modules/role/store').then(({ resetRoleData }) => resetRoleData())
}

/** 【原型说明】模拟列表加载失败（EX-MEM-01） */
function simulateLoadFail() {
  loading.value = true
  failed.value = true
  window.setTimeout(() => {
    loading.value = false
  }, 420)
}

/** 【原型说明】模拟账号锁定附注（STATE-MEM-09）：直接为该成员写入一次锁定 */
function simulateLock() {
  const target = rows.value.find((row) => row.status === 'normal' && !row.isLastAdmin)
  if (!target) {
    message.info('暂无可用于演示的成员')
    return
  }
  const lock = getLock(target.identifier)
  lock.fails = 5
  lock.lockedUntil = Date.now() + 15 * 60 * 1000
  message.success(`已将「${target.name}」模拟为锁定状态`)
  loadList()
}

/**
 * 【原型说明】一键演示「加入企业」分支（EX-MEM-07）：
 * 预填一个已归属其他企业、但本企业没有的平台账号，打开新增成员弹窗，
 * 账号字段随即展示绿色一行式提示并隐藏密码字段。
 */
function simulateJoinEnterprise() {
  if (!canCreate.value) {
    message.warning('当前账号无「新增成员」权限')
    return
  }
  const demoIdentifier = '+8613880013888'
  const account = findAccount(demoIdentifier)
  if (!account) {
    message.warning('演示数据已变更，请先点击「重置演示数据」')
    return
  }
  if (identifierInOrg(demoIdentifier)) {
    message.info('该演示账号已被加入本企业，请先「重置演示数据」后再试')
    return
  }
  formMode.value = 'create'
  editingId.value = null
  isResultMode.value = false
  formPrefill.value = { identifier: demoIdentifier }
  formNonce.value += 1
  formOpen.value = true
  message.info('已预填一个归属其他企业的账号，账号字段将进入「加入企业」状态')
}
</script>
