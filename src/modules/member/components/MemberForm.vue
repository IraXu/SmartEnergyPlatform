<template>
  <div class="member-form">
    <!-- 表单态 -->
    <template v-if="!resultMode">
      <a-form :model="form" layout="vertical">
        <p class="member-form__group">基础信息</p>
        <a-form-item
          label="姓名"
          required
          :validate-status="nameError ? 'error' : undefined"
          :help="nameError ?? undefined"
        >
          <a-input
            v-model:value="form.name"
            show-count
            :maxlength="NAME_MAX"
            placeholder="请输入成员姓名"
          />
        </a-form-item>

        <a-form-item
          label="账号"
          required
          :validate-status="identifierError ? 'error' : undefined"
          :help="identifierError ?? undefined"
        >
          <!-- 不提供账号类型切换：由输入内容自动识别手机号与邮箱（含字母或 @ 即视为邮箱） -->
          <AccountField
            v-model:value="form.identifier"
            placeholder="请输入手机号或邮箱，系统将自动识别"
          />
          <!-- 默认态提示：仅在「新增 + 无校验错误 + 未进入加入企业」时展示，避免与错误提示叠加 -->
          <p v-if="showIdentifierHint" class="member-form__hint">
            账号在平台内唯一；已存在的账号可直接加入本企业
          </p>
        </a-form-item>

        <!-- 加入企业：账号在平台已存在、但本企业尚未添加该成员 → 免密，沿用现有密码 -->
        <p v-if="identifierJoinable" class="member-form__note">
          <CheckCircleFilled class="member-form__note-icon" />
          该账号已存在于平台，将沿用其现有密码
        </p>

        <!-- 初始密码仅在新增且平台尚未存在该账号时填写（账号在平台已存在即免密）；编辑不涉及密码（PRD F-MEM-03） -->
        <template v-if="isCreate && !identifierMatchedExisting">
          <p class="member-form__group">账号与密码</p>
          <a-form-item
            label="初始密码"
            required
            :validate-status="passwordError ? 'error' : undefined"
            :help="passwordError ?? undefined"
          >
            <a-input-password v-model:value="form.password" placeholder="8-20 位，需包含字母与数字" />
            <PasswordStrength :password="form.password" />
          </a-form-item>
          <a-form-item
            label="确认密码"
            required
            :validate-status="confirmError ? 'error' : undefined"
            :help="confirmError ?? undefined"
          >
            <a-input-password v-model:value="form.confirm" placeholder="请再次输入初始密码" />
          </a-form-item>
        </template>

        <p class="member-form__group">权限配置</p>
        <a-form-item
          label="角色"
          required
          :validate-status="roleError ? 'error' : undefined"
          :help="roleError ?? undefined"
        >
          <a-select
            v-model:value="form.roleIds"
            mode="multiple"
            show-search
            allow-clear
            option-filter-prop="label"
            placeholder="请选择角色，可多选"
            :options="roleSelectOptions"
            :not-found-content="roleList.length ? undefined : '暂无可分配的角色，请先在「角色管理」中创建角色'"
            :max-tag-count="'responsive'"
          />
          <p v-if="hasSuperAdminRole" class="member-form__hint">
            企业超级管理员拥有本企业全部功能与全部数据权限
          </p>
        </a-form-item>

        <a-form-item
          label="数据范围"
          required
          :validate-status="scopeError ? 'error' : undefined"
          :help="scopeError ?? undefined"
        >
          <MemberScopeSelect v-model="form.scopeIds" :readonly="hasSuperAdminRole" />
        </a-form-item>
      </a-form>

      <!-- 变更影响提示：角色或数据范围发生变化时展示（OVERLAY-02） -->
      <a-alert
        v-if="!isCreate && changedFields.length"
        type="info"
        show-icon
        :closable="false"
        class="member-form__alert"
        message="保存后该成员的可用功能与可见数据范围将立即发生变化"
        :description="`本次变更：${changedFields.join('、')}`"
      />
    </template>

    <!-- 结果态：新建账号一次性展示账号与初始密码；已存在账号无新密码可展示（PRD Q-MEM-01） -->
    <template v-else>
      <div class="member-form__result">
        <a-alert
          type="success"
          show-icon
          :closable="false"
          :message="
            credential.password
              ? '账号已创建，成员可凭初始密码登录，首次登录需修改密码'
              : '已将该账号加入本企业，将继续使用其现有密码'
          "
        />
        <div class="member-form__credential">
          <div class="member-form__credential-row">
            <span class="member-form__credential-label">账号标识</span>
            <span class="member-form__mono">{{ credential.identifier }}</span>
            <a-button type="link" size="small" @click="copy(credential.identifier)">复制</a-button>
          </div>
          <div v-if="credential.password" class="member-form__credential-row">
            <span class="member-form__credential-label">初始密码</span>
            <span class="member-form__mono">{{ credential.password }}</span>
            <a-button type="link" size="small" @click="copy(credential.password)">复制</a-button>
          </div>
        </div>
        <p class="member-form__warn">
          {{
            credential.password
              ? '初始密码仅展示一次，请及时告知成员并提醒其首次登录后修改'
              : '未设置新密码，该账号仍使用其原有密码；若成员遗忘请在本页重置'
          }}
        </p>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
/**
 * 【原型说明】成员表单（OVERLAY-01 新增 / OVERLAY-02 编辑），
 * 对齐《产品交互设计文档-企业成员》v1.0 第 5 章 5.1、5.2。
 * 字段顺序固定为：姓名 → 账号类型 → 账号标识 →（新增）初始密码 → 确认密码 → 角色 → 数据范围。
 * 成员为企业超级管理员时数据范围锁定为「全部数据」且不可修改（PRD Q-MEM-08）。
 */
import { computed, reactive, ref, watch } from 'vue'
import { message } from 'antdv-next'
import { CheckCircleFilled } from '@antdv-next/icons'
import AccountField from '@/modules/auth/components/AccountField.vue'
import PasswordStrength from '@/modules/auth/components/PasswordStrength.vue'
import MemberScopeSelect from './MemberScopeSelect.vue'
import { splitPhoneIdentifier } from '@/shared/mock/countryCode'
import { normalizeIdentifier } from '@/modules/auth/store/identifier'
import {
  NAME_MAX,
  accountExistsInPlatform,
  identifierInOrg,
  roleList,
  roleOptions,
  validateConfirmPassword,
  validateIdentifier,
  validateName,
  validatePassword,
} from '../store'

const props = defineProps<{
  mode: 'create' | 'edit'
  /** 成员 ID，仅编辑模式需要 */
  memberId?: string
  initial?: {
    name: string
    identifier: string
    roleIds: string[]
    scopeIds: string[]
  }
  /** 【原型演示】新增态预填值，用于一键演示「加入企业」等分支（编辑态不使用） */
  prefill?: {
    name?: string
    identifier?: string
  }
  submitting: boolean
}>()

const emit = defineEmits<{
  submit: [payload: {
    name: string
    accountType: 'phone' | 'email'
    identifier: string
    countryCode: string
    password: string
    roleIds: string[]
    scopeIds: string[]
  }]
  dirtyChange: [dirty: boolean]
}>()

const isCreate = computed(() => props.mode === 'create')
/** 结果态：新增成功后一次性展示账号与初始密码（PRD Q-MEM-01） */
const resultMode = ref(false)

const form = reactive({
  name: props.initial?.name ?? props.prefill?.name ?? '',
  identifier: props.initial?.identifier ?? props.prefill?.identifier ?? '',
  password: '',
  confirm: '',
  roleIds: [...(props.initial?.roleIds ?? [])],
  scopeIds: [...(props.initial?.scopeIds ?? [])],
})

const triedSubmit = ref(false)

/**
 * 输入的账号是否已存在于平台（已归属其他企业或已自助注册）。
 * 已存在时进入「加入企业」语义：隐藏密码字段、沿用账号现有密码。
 */
const identifierMatchedExisting = computed(
  () => isCreate.value && !!form.identifier.trim() && accountExistsInPlatform(form.identifier),
)

/**
 * 是否进入「加入企业」状态：账号在平台已存在，但本企业尚未添加该成员。
 * 与「本企业已有该成员」互斥——后者由字段错误拦截，不再展示本提示。
 */
const identifierJoinable = computed(
  () => identifierMatchedExisting.value && !identifierInOrg(form.identifier, props.memberId),
)

/* ---------- 校验 ---------- */

const nameError = computed(() => (form.name ? validateName(form.name) : null))
const identifierError = computed(() =>
  form.identifier ? validateIdentifier(form.identifier, props.memberId) : null,
)
const passwordError = computed(() =>
  triedSubmit.value && isCreate.value && !identifierMatchedExisting.value
    ? validatePassword(form.password, form.identifier)
    : null,
)
const confirmError = computed(() =>
  triedSubmit.value && isCreate.value && !identifierMatchedExisting.value
    ? validateConfirmPassword(form.password, form.confirm)
    : null,
)
const roleError = computed(() => (triedSubmit.value && !form.roleIds.length ? '请至少为一个成员选择一个角色' : null))
/** 数据范围为必填：未选择组织节点时无法保存 */
const scopeError = computed(() =>
  triedSubmit.value && !hasSuperAdminRole.value && !form.scopeIds.length ? '请为成员选择数据范围' : null,
)

/**
 * 账号默认提示的展示条件：新增态、无格式错误、账号尚未存在于平台。
 * 编辑态不涉及加入企业；错误或「加入企业」提示出现时让位，保证同一时刻只有一条提示。
 */
const showIdentifierHint = computed(
  () => isCreate.value && !identifierError.value && !identifierMatchedExisting.value,
)

/* ---------- 角色 ---------- */

const roleSelectOptions = computed(() =>
  roleOptions().map((item) => ({
    value: item.value,
    label: item.label,
    desc: item.desc,
    source: item.source,
  })),
)

const hasSuperAdminRole = computed(() =>
  form.roleIds.some((id) => roleList.find((role) => role.id === id)?.source === 'preset'),
)

/** 选中超级管理员后，数据范围锁定为「全部数据」（PRD Q-MEM-08） */
watch(hasSuperAdminRole, (value) => {
  if (value) form.scopeIds = []
})

/* ---------- 变更检测（OVERLAY-02 变更影响提示） ---------- */

const changedFields = computed(() => {
  if (isCreate.value || !props.initial) return []
  const list: string[] = []
  if (props.initial.name !== form.name.trim()) list.push('姓名')
  if (normalizeIdentifier(props.initial.identifier) !== normalizeIdentifier(form.identifier)) list.push('账号')
  const before = [...props.initial.roleIds].sort().join(',')
  const after = [...form.roleIds].sort().join(',')
  if (before !== after) list.push('角色')
  const beforeScope = [...props.initial.scopeIds].sort().join(',')
  const afterScope = [...form.scopeIds].sort().join(',')
  if (beforeScope !== afterScope) list.push('数据范围')
  return list
})

watch(changedFields, (list) => emit('dirtyChange', list.length > 0), { immediate: true })

/* ---------- 结果态与复制 ---------- */

const credential = reactive({ identifier: '', password: '' })

/** 由页面在创建成功后调用，切换到结果态并写入一次性凭据（账号已存在时密码为空） */
function showResult(identifier: string, password: string) {
  credential.identifier = identifier
  credential.password = password
  resultMode.value = true
}

async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    message.success('已复制')
  } catch {
    message.warning('复制失败，请手动选择复制')
  }
}

/* ---------- 提交 ---------- */

function submit() {
  triedSubmit.value = true
  if (validateName(form.name)) {
    message.error('请输入正确的成员姓名')
    return
  }
  const idIssue = validateIdentifier(form.identifier, props.memberId)
  if (idIssue) {
    message.error(idIssue)
    return
  }
  if (isCreate.value && !identifierMatchedExisting.value) {
    const pwdIssue = validatePassword(form.password, form.identifier)
    if (pwdIssue) {
      message.error(pwdIssue)
      return
    }
    const confirmIssue = validateConfirmPassword(form.password, form.confirm)
    if (confirmIssue) {
      message.error(confirmIssue)
      return
    }
  }
  if (!form.roleIds.length) {
    message.error('请至少为一个成员选择一个角色')
    return
  }
  // 数据范围为必填（超级管理员锁定为「全部数据」，无需选择）
  if (!hasSuperAdminRole.value && !form.scopeIds.length) {
    message.error('请为成员选择数据范围')
    return
  }

  const normalized = normalizeIdentifier(form.identifier)
  // 账号类型由输入内容自动识别：含 @ 或字母视为邮箱，其余视为手机号
  const accountType: 'phone' | 'email' = normalized.includes('@') ? 'email' : 'phone'
  const countryCode = accountType === 'phone' ? splitPhoneIdentifier(normalized).countryCode : ''

  emit('submit', {
    name: form.name,
    accountType,
    identifier: normalized,
    countryCode,
    password: form.password,
    roleIds: [...form.roleIds],
    scopeIds: hasSuperAdminRole.value ? [] : [...form.scopeIds],
  })
}

defineExpose({ submit, showResult })
</script>
