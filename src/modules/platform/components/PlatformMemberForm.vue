<template>
  <a-modal
    :open="open"
    :title="isEdit ? '编辑平台成员' : '新增平台成员'"
    :width="560"
    :mask-closable="!submitting"
    :confirm-loading="submitting"
    ok-text="保存"
    cancel-text="取消"
    @ok="handleOk"
    @cancel="handleCancel"
  >
    <a-form ref="formRef" :model="form" layout="vertical" class="platform-form">
      <p class="platform-form__group">基础信息</p>
      <a-form-item label="姓名" name="name" required>
        <a-input
          v-model:value="form.name"
          placeholder="请输入成员姓名"
          :maxlength="PLATFORM_NAME_MAX"
          :disabled="submitting"
        />
      </a-form-item>

      <a-form-item label="账号" name="identifier" required>
        <!-- 支持手机号与邮箱，由输入内容自动识别（与企业成员同一套账号组件） -->
        <AccountField
          v-model:value="form.identifier"
          placeholder="请输入手机号或邮箱，系统将自动识别"
          :disabled="isEdit || submitting"
          @blur="handleIdentifierBlur"
        />
        <template #extra>
          <span v-if="isEdit" class="platform-form__hint">账号创建后不可修改</span>
          <span v-else-if="identifierStatus === 'belong-org'" class="platform-form__error">
            该账号已归属企业，请更换账号或先使其脱离原企业
          </span>
          <span v-else-if="identifierStatus === 'duplicated'" class="platform-form__error">
            该账号已是平台成员
          </span>
          <span v-else-if="identifierStatus === 'existing'" class="platform-form__hint">
            该账号已存在于平台，将沿用其现有密码
          </span>
        </template>
      </a-form-item>

      <!-- 新增且平台不存在该账号时设置初始密码，需二次确认 -->
      <template v-if="showPassword">
        <p class="platform-form__group">账号与密码</p>
        <a-form-item label="初始密码" required>
          <a-input-password
            v-model:value="form.password"
            placeholder="8-20 位，需含字母和数字"
            :maxlength="PLATFORM_PASSWORD_MAX"
            :disabled="submitting"
          />
          <PasswordStrength :password="form.password" />
        </a-form-item>
        <a-form-item
          label="确认密码"
          required
          :validate-status="confirmError ? 'error' : undefined"
          :help="confirmError ?? undefined"
        >
          <a-input-password
            v-model:value="form.confirm"
            placeholder="请再次输入初始密码"
            :maxlength="PLATFORM_PASSWORD_MAX"
            :disabled="submitting"
          />
        </a-form-item>
      </template>

      <p class="platform-form__group">权限配置</p>
      <a-form-item label="平台角色" name="roleIds" required>
        <a-select
          v-model:value="form.roleIds"
          mode="multiple"
          show-search
          allow-clear
          option-filter-prop="label"
          placeholder="请选择平台角色，可多选"
          :options="roleOptions"
          :disabled="submitting"
          :max-tag-count="'responsive'"
        />
      </a-form-item>
    </a-form>
  </a-modal>
</template>

<script setup lang="ts">
/**
 * 【原型说明】平台成员新增 / 编辑浮层（PAL-OVERLAY-01）
 * 对齐《产品交互设计文档-平台成员管理》v1.0 5.1，并**与企业端「企业成员」表单保持一致**：
 * - 账号支持手机号与邮箱（由输入内容自动识别）；
 * - 新增且账号在平台不存在时设置初始密码，并需「确认密码」二次输入；
 * - 新增时校验账号是否已归属企业（拦截）或已是平台成员（拦截）；
 * - 编辑时账号标识只读；内置超管不可进入本浮层。
 */
import { computed, reactive, ref, watch } from 'vue'
import { message } from 'antdv-next'
import type { FormInstance } from 'antdv-next'
import AccountField from '@/modules/auth/components/AccountField.vue'
import PasswordStrength from '@/modules/auth/components/PasswordStrength.vue'
import { splitPhoneIdentifier } from '@/shared/mock/countryCode'
import { normalizeIdentifier } from '@/modules/auth/store/identifier'
import {
  PLATFORM_NAME_MAX,
  PLATFORM_PASSWORD_MAX,
  createPlatformMember,
  updatePlatformMember,
  validatePlatformIdentifier,
  validatePlatformPassword,
  type PlatformMember,
  type PlatformRole,
} from '@/modules/platform/store'
import { findAccount } from '@/modules/auth/store'

const props = defineProps<{
  open: boolean
  /** 编辑态：传入既有成员 */
  member?: PlatformMember | null
  roles: PlatformRole[]
}>()

const emit = defineEmits<{
  (e: 'update:open', value: boolean): void
  (e: 'saved'): void
}>()

const formRef = ref<FormInstance>()
const submitting = ref(false)
const triedSubmit = ref(false)
const identifierStatus = ref<'idle' | 'belong-org' | 'duplicated' | 'existing'>('idle')

const form = reactive({
  name: '',
  identifier: '',
  password: '',
  confirm: '',
  roleIds: [] as string[],
})

const isEdit = computed(() => Boolean(props.member))
/** 账号在平台已存在且未归属企业时免密沿用，不显示密码字段 */
const showPassword = computed(() => !isEdit.value && identifierStatus.value !== 'existing')

const roleOptions = computed(() => props.roles.map((role) => ({ label: role.name, value: role.id })))

/** 确认密码校验：仅在需设置密码且已尝试提交后提示 */
const confirmError = computed(() => {
  if (!showPassword.value || !triedSubmit.value) return null
  if (!form.confirm) return '请再次输入初始密码'
  if (form.confirm !== form.password) return '两次输入的密码不一致'
  return null
})

watch(
  () => props.open,
  (open) => {
    if (!open) return
    identifierStatus.value = 'idle'
    triedSubmit.value = false
    if (props.member) {
      form.name = props.member.name
      form.identifier = props.member.identifier
      form.password = ''
      form.confirm = ''
      form.roleIds = [...props.member.roleIds]
    } else {
      form.name = ''
      form.identifier = ''
      form.password = ''
      form.confirm = ''
      form.roleIds = []
    }
  },
)

/** 账号失焦时做归属校验，给出即时反馈 */
function handleIdentifierBlur() {
  if (!form.identifier.trim()) {
    identifierStatus.value = 'idle'
    return
  }
  const error = validatePlatformIdentifier(form.identifier, props.member?.id)
  if (error?.includes('已归属企业')) identifierStatus.value = 'belong-org'
  else if (error?.includes('已是平台成员')) identifierStatus.value = 'duplicated'
  else if (findAccount(form.identifier.trim())) identifierStatus.value = 'existing'
  else identifierStatus.value = 'idle'
}

async function handleOk() {
  triedSubmit.value = true
  await formRef.value?.validate()
  // 必填校验
  if (!form.name.trim()) {
    message.error('请输入成员姓名')
    return
  }
  const error = isEdit.value ? null : validatePlatformIdentifier(form.identifier, props.member?.id)
  if (error) {
    identifierStatus.value = error.includes('已归属企业')
      ? 'belong-org'
      : error.includes('已是平台成员')
        ? 'duplicated'
        : 'idle'
    message.error(error)
    return
  }
  // 需设置密码时校验密码与二次确认
  if (showPassword.value) {
    const pwdError = validatePlatformPassword(form.password)
    if (pwdError) {
      message.error(pwdError)
      return
    }
    if (!form.confirm) {
      message.error('请再次输入初始密码')
      return
    }
    if (form.confirm !== form.password) {
      message.error('两次输入的密码不一致')
      return
    }
  }
  if (!form.roleIds.length) {
    message.error('请至少选择一个平台角色')
    return
  }

  submitting.value = true
  try {
    const identifier = normalizeIdentifier(form.identifier)
    const accountType: 'phone' | 'email' = identifier.includes('@') ? 'email' : 'phone'
    const countryCode = accountType === 'phone' ? splitPhoneIdentifier(identifier).countryCode : ''
    if (isEdit.value && props.member) {
      await updatePlatformMember(props.member.id, {
        name: form.name,
        identifier: props.member.identifier,
        roleIds: form.roleIds,
      })
    } else {
      await createPlatformMember({
        name: form.name,
        identifier,
        password: form.password,
        roleIds: form.roleIds,
        accountType,
        countryCode,
      })
    }
    emit('saved')
    emit('update:open', false)
  } catch (err) {
    message.error(err instanceof Error ? err.message : '保存失败，请重试')
  } finally {
    submitting.value = false
  }
}

function handleCancel() {
  emit('update:open', false)
}
</script>

<style scoped>
.platform-form__group {
  margin: 4px 0 12px;
  font-size: 13px;
  font-weight: 600;
  color: rgba(0, 0, 0, 0.88);
}
.platform-form__group:not(:first-child) {
  padding-top: 12px;
  border-top: 1px solid #f0f0f0;
}
.platform-form__hint {
  font-size: 12px;
  color: rgba(0, 0, 0, 0.45);
}
.platform-form__error {
  font-size: 12px;
  color: #ff4d4f;
}
</style>
