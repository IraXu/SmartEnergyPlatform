<template>
  <div class="auth-page">
    <AuthBrand />

    <div class="auth-panel">
      <div class="auth-card auth-card--wide">
        <h2 class="auth-card__title">注册账号</h2>
        <p class="auth-card__subtitle">创建企业账号并成为该企业的企业管理员</p>

        <a-steps class="auth-steps" size="small" :current="current" :items="stepItems" />

        <a-alert
          v-if="formAlert"
          class="form-alert"
          :type="formAlert.type"
          :message="formAlert.text"
          show-icon
          closable
          @close="formAlert = null"
        >
          <template v-if="formAlert.action" #action>
            <a-button size="small" type="primary" ghost @click="formAlert.action!.handler">
              {{ formAlert.action.text }}
            </a-button>
          </template>
        </a-alert>

        <a-form ref="formRef" :model="form" :rules="activeRules" layout="vertical" @finish="handleNext">
          <!-- 步骤一：验证账号 -->
          <template v-if="current === 0">
            <a-form-item label="手机号 / 邮箱" name="identifier">
              <AccountField v-model:value="form.identifier" :disabled="submitting" />
            </a-form-item>

            <a-form-item label="验证码" name="code">
              <div class="code-field">
                <a-input
                  v-model:value="form.code"
                  class="code-field__input"
                  size="large"
                  placeholder="请输入 6 位验证码"
                  :maxlength="6"
                  :disabled="submitting"
                >
                  <template #prefix>
                    <SafetyOutlined style="color: rgba(0, 0, 0, 0.3)" />
                  </template>
                </a-input>
                <a-button
                  class="code-field__button"
                  size="large"
                  :disabled="codeCountdown > 0 || submitting"
                  @click="handleSendCode"
                >
                  {{ codeCountdown > 0 ? `${codeCountdown} 秒后重新获取` : '获取验证码' }}
                </a-button>
              </div>
            </a-form-item>
          </template>

          <!-- 步骤二：设置密码（所有注册账号均需本人设置，含仅被企业新增过的账号） -->
          <template v-if="current === 1">
            <a-form-item label="密码" name="password">
              <a-input-password
                v-model:value="form.password"
                size="large"
                placeholder="请设置 8-20 位密码，含字母和数字"
                :disabled="submitting"
              />
              <PasswordStrength :password="form.password" :identifier="form.identifier" />
            </a-form-item>

            <a-form-item label="确认密码" name="confirmPassword">
              <a-input-password
                v-model:value="form.confirmPassword"
                size="large"
                placeholder="请再次输入密码"
                :disabled="submitting"
              />
            </a-form-item>
          </template>

          <!-- 企业信息：始终为最后一步 -->
          <template v-if="isLastStep">
            <a-form-item label="企业名称" name="orgName">
              <a-input
                v-model:value="form.orgName"
                size="large"
                placeholder="请输入企业名称，用于创建企业组织"
                :maxlength="50"
                show-count
                :disabled="submitting"
              >
                <template #prefix>
                  <BankOutlined style="color: rgba(0, 0, 0, 0.3)" />
                </template>
              </a-input>
            </a-form-item>

            <a-form-item label="企业所属行业" name="industry">
              <a-select
                v-model:value="form.industry"
                size="large"
                placeholder="请选择企业所属行业"
                :options="INDUSTRY_OPTIONS"
                :disabled="submitting"
                allow-clear
              />
            </a-form-item>

            <a-form-item label="企业所在地区" name="region">
              <a-cascader
                v-model:value="form.region"
                size="large"
                placeholder="请选择省 / 市"
                :options="REGION_OPTIONS"
                :disabled="submitting"
                allow-clear
              />
            </a-form-item>

            <a-form-item label="联系人姓名" name="contactName">
              <a-input
                v-model:value="form.contactName"
                size="large"
                placeholder="请输入联系人姓名，用于平台运营方联系"
                :maxlength="20"
                :disabled="submitting"
              />
            </a-form-item>

            <a-form-item label="联系人职务" name="contactTitle">
              <a-input
                v-model:value="form.contactTitle"
                size="large"
                placeholder="选填，如行政负责人、运维负责人"
                :maxlength="20"
                :disabled="submitting"
              />
            </a-form-item>

            <a-form-item label="联系人电话" name="contactPhone">
              <AccountField
                v-model:value="form.contactPhone"
                phone-only
                :disabled="submitting || contactPhoneLocked"
              />
              <template v-if="contactPhoneLocked" #extra>
                <span style="font-size: 12px; color: rgba(0, 0, 0, 0.45)">
                  已自动填入注册手机号，如需修改请在注册完成后于「组织与用户管理」模块维护
                </span>
              </template>
            </a-form-item>

            <a-form-item name="agree">
              <a-checkbox v-model:checked="form.agree" :disabled="submitting">
                我已阅读并同意
                <a-typography-link @click.prevent="showProtocol('用户协议')">《用户协议》</a-typography-link>
                与
                <a-typography-link @click.prevent="showProtocol('隐私政策')">《隐私政策》</a-typography-link>
              </a-checkbox>
            </a-form-item>

            <a-alert
              type="info"
              show-icon
              message="注册成功后，您将成为该企业的企业管理员，可管理本企业组织与人员。"
              style="margin-bottom: 18px"
            />
          </template>

          <div style="display: flex; gap: 12px">
            <a-button v-if="current > 0" size="large" :disabled="submitting" @click="handlePrev">上一步</a-button>
            <a-button type="primary" size="large" block html-type="submit" :loading="submitting">
              {{ isLastStep ? '注册' : '下一步' }}
            </a-button>
          </div>
        </a-form>

        <div class="auth-switch">
          <span>已有账号？</span>
          <a-typography-link @click="handleBackToLogin">返回登录</a-typography-link>
        </div>

        <ProtoTip :lines="tipLines" @reset="handleDataReset">
          <template #extra>
            <a-space size="small" wrap>
              <a-button size="small" type="primary" ghost @click="handleDemoExisting">
                预填「仅被企业新增过的账号」
              </a-button>
              <a-button size="small" @click="handleDemoPlatformRegistered">
                预填「已自助注册过的账号」
              </a-button>
            </a-space>
          </template>
        </ProtoTip>
      </div>
    </div>

    <a-modal
      v-model:open="leaveConfirmOpen"
      title="确认离开注册流程？"
      ok-text="确认离开"
      cancel-text="继续填写"
      @ok="confirmLeave"
    >
      离开后已填写内容将不会保留，确认离开？
    </a-modal>
  </div>
</template>

<script setup lang="ts">
/**
 * P-02 注册页
 * 【原型说明】对齐 PRD v1.5 F-01 / F-02 / F-03 与交互设计文档 4.2（PAGE-02）。
 * 三步结构：验证账号 → 设置密码 → 企业信息，覆盖 EX-15 ~ EX-32 异常分支。
 */
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { message, type FormInstance } from 'antdv-next'
import { BankOutlined, SafetyOutlined } from '@antdv-next/icons'
import AccountField from '@/modules/auth/components/AccountField.vue'
import AuthBrand from '@/modules/auth/components/AuthBrand.vue'
import PasswordStrength from '@/modules/auth/components/PasswordStrength.vue'
import ProtoTip from '@/shared/components/ProtoTip.vue'
import { INDUSTRY_OPTIONS, REGION_OPTIONS } from '@/shared/mock/dict'
import { splitPhoneIdentifier } from '@/shared/mock/countryCode'
import { checkPassword } from '@/modules/auth/utils/password'
import {
  addMembership,
  codeCooldownSeconds,
  createAccount,
  createSession,
  detectAccountType,
  enterOrg,
  findAccount,
  issueCode,
  markPlatformRegistered,
  verifyCode,
  type MembershipInput,
} from '@/modules/auth/store'

const router = useRouter()

const current = ref(0)
const submitting = ref(false)
/** 用于驱动验证码冷却倒计时刷新 */
const tick = ref(0)
const formRef = ref<FormInstance>()
const leaveConfirmOpen = ref(false)
const formAlert = ref<{
  type: 'error' | 'warning' | 'info'
  text: string
  action?: { text: string; handler: () => void }
} | null>(null)

const form = reactive({
  identifier: '',
  code: '',
  password: '',
  confirmPassword: '',
  orgName: '',
  industry: undefined as string | undefined,
  region: undefined as string[] | undefined,
  contactName: '',
  contactTitle: '',
  contactPhone: '',
  agree: false,
})

/** 账号类型由输入内容自动识别，用于文案与提交时的校验分支 */
const accountType = computed<'phone' | 'email' | null>(() => detectAccountType(form.identifier))

/**
 * 手机号注册时，联系人电话自动带入注册手机号并锁定；
 * 邮箱注册无手机号可带入，由用户自行填写。
 */
const contactPhoneLocked = computed(() => accountType.value === 'phone')

/** 步骤条固定三步：验证账号 → 设置密码 → 企业信息 */
const stepItems = [
  { title: '验证账号' },
  { title: '设置密码' },
  { title: '企业信息' },
]

/** 企业信息为最后一步 */
const isLastStep = computed(() => current.value === 2)

const tipLines = [
  '本页为「自助创建企业」：注册成功后当前账号成为该企业的企业管理员。',
  '账号是否被拦截取决于「是否已从登录注册页自助注册过」，而非平台是否存在该账号。',
  '已自助注册过的账号（如 +8613800138000）再次注册会被拦截，并引导去登录。',
  '仅被企业管理员在「企业成员」中新增过的账号（如 +8613900139000），本人仍可自助创建企业，需自行设置密码。',
  '验证码为原型模拟，点击获取后会回显 6 位数字，5 分钟有效，60 秒冷却，单日上限 10 次。',
  '密码需 8-20 位且同时包含字母和数字；弱密码不可提交，用于验证强度校验。',
]

const identifierValidator = (_rule: unknown, value: string) => {
  if (!detectAccountType(value)) return Promise.reject('请输入正确的手机号或邮箱')
  return Promise.resolve()
}

const activeRules = computed(() => {
  if (current.value === 0) {
    return {
      identifier: [{ required: true, validator: identifierValidator, trigger: 'blur' }],
      code: [
        { required: true, message: '请输入 6 位验证码', trigger: 'blur' },
        { pattern: /^\d{6}$/, message: '请输入 6 位验证码', trigger: 'blur' },
      ],
    }
  }
  // 密码步骤
  if (current.value === 1) {
    return {
      password: [
        {
          required: true,
          validator: (_rule: unknown, value: string) => {
            const check = checkPassword(value ?? '', form.identifier)
            return check.valid ? Promise.resolve() : Promise.reject(check.reason)
          },
          trigger: 'blur',
        },
      ],
      confirmPassword: [
        {
          required: true,
          validator: (_rule: unknown, value: string) =>
            value && value === form.password ? Promise.resolve() : Promise.reject('两次输入的密码不一致'),
          trigger: 'blur',
        },
      ],
    }
  }
  return {
    orgName: [
      {
        required: true,
        validator: (_rule: unknown, value: string) =>
          value && value.trim() ? Promise.resolve() : Promise.reject('请输入企业名称'),
        trigger: 'blur',
      },
    ],
    industry: [{ required: true, message: '请选择企业所属行业', trigger: 'change' }],
    region: [
      {
        required: true,
        validator: (_rule: unknown, value: string[] | undefined) =>
          value && value.length === 2 ? Promise.resolve() : Promise.reject('请选择企业所在地区'),
        trigger: 'change',
      },
    ],
    contactName: [
      {
        required: true,
        validator: (_rule: unknown, value: string) =>
          value && value.trim() ? Promise.resolve() : Promise.reject('请输入联系人姓名'),
        trigger: 'blur',
      },
    ],
    contactPhone: [
      {
        required: true,
        validator: (_rule: unknown, value: string) => {
          if (!value || !value.trim()) return Promise.reject('请输入联系人电话')
          return detectAccountType(value) === 'phone'
            ? Promise.resolve()
            : Promise.reject('请输入正确的联系人电话')
        },
        trigger: 'blur',
      },
    ],
    agree: [
      {
        validator: (_rule: unknown, value: boolean) =>
          value ? Promise.resolve() : Promise.reject('请阅读并同意用户协议与隐私政策'),
        trigger: 'change',
      },
    ],
  }
})

/**
 * 验证码冷却秒数由当前输入的账号标识推导，而非页面级计时器。
 * 这样在账号类型自动切换（手机号 ↔ 邮箱）后，倒计时能立即反映新标识的冷却状态。
 */
const codeCountdown = computed(() => {
  void tick.value
  const identifier = form.identifier.trim()
  if (!identifier) return 0
  return codeCooldownSeconds(identifier, 'register')
})

let tickTimer: number | undefined

function startCountdownTicker() {
  window.clearInterval(tickTimer)
  tickTimer = window.setInterval(() => {
    tick.value += 1
    // 冷却结束即停止刷新，避免无意义的常驻计时器
    if (codeCountdown.value === 0) window.clearInterval(tickTimer)
  }, 1000)
}

async function handleSendCode() {
  const identifier = form.identifier.trim()
  try {
    await formRef.value?.validate(['identifier'])
  } catch {
    return
  }
  const result = issueCode(identifier, 'register')
  if (!result.ok) {
    message.warning(result.message)
    return
  }
  startCountdownTicker()
  message.success({
    content: `【原型演示】验证码已发送至 ${identifier}，验证码为 ${result.code}，5 分钟内有效`,
    duration: 8,
  })
}

async function handleNext() {
  formAlert.value = null

  if (current.value === 0) {
    const identifier = form.identifier.trim()
    // 【原型说明】模拟异步校验验证码
    submitting.value = true
    await new Promise((resolve) => window.setTimeout(resolve, 600))
    const result = verifyCode(identifier, 'register', form.code)
    submitting.value = false
    if (result === 'wrong') {
      formRef.value?.setFields([{ name: 'code', errors: ['验证码错误，请重新输入'] }])
      return
    }
    if (result === 'expired') {
      form.code = ''
      formRef.value?.setFields([{ name: 'code', errors: ['验证码已失效，请重新获取'] }])
      return
    }

    const existing = findAccount(identifier)
    if (existing?.status === 'DISABLED') {
      formAlert.value = { type: 'error', text: '账号已被停用，请联系平台运营方' }
      return
    }
    // 已从登录注册页自助注册过 → 一个账号最多自主创建一家企业，直接拦截
    if (existing?.source === 'platform') {
      formAlert.value = {
        type: 'error',
        text: `该${accountType.value === 'phone' ? '手机号' : '邮箱'}已注册过平台账号，请直接登录；如需使用其他企业，请由该企业管理员在「企业成员」中新增。`,
        action: { text: '去登录', handler: () => router.push({ name: 'login' }) },
      }
      return
    }
    // 账号虽已存在但从未自助注册（仅被企业新增过）→ 允许自助创建企业，照常走密码步骤
    if (existing) {
      formAlert.value = {
        type: 'info',
        text: `该${accountType.value === 'phone' ? '手机号' : '邮箱'}已被企业添加为成员。本次将为你创建一个新企业并赋予企业管理员权限，请设置你自己的登录密码。`,
      }
    }
    // 进入密码步骤前带入注册手机号；邮箱注册保持为空，由用户填写
    if (contactPhoneLocked.value) form.contactPhone = form.identifier.trim()
    current.value = 1
    return
  }

  // 密码步骤：新建账号与「已存在但非自助注册」的账号均需本人设置密码
  if (current.value === 1) {
    const check = checkPassword(form.password, form.identifier)
    if (!check.valid) {
      formRef.value?.setFields([{ name: 'password', errors: [check.reason ?? '密码不符合要求'] }])
      return
    }
    // 进入企业信息前带入注册手机号；邮箱注册保持为空，由用户填写
    if (contactPhoneLocked.value) form.contactPhone = form.identifier.trim()
    current.value = 2
    return
  }

  // 企业信息步骤：三种入口共用（全新账号 / 仅被企业新增过的账号）
  submitting.value = true
  await new Promise((resolve) => window.setTimeout(resolve, 800))
  const identifier = form.identifier.trim()
  const membership: MembershipInput = {
    orgId: buildOrgId(),
    orgName: form.orgName.trim(),
    industry: form.industry ?? '',
    region: (form.region ?? []).join(' / '),
    role: '企业管理员',
    roleCode: 'ORG_ADMIN',
    contactName: form.contactName.trim(),
    contactTitle: form.contactTitle.trim(),
    contactPhone: form.contactPhone.trim(),
  }

  const existing = findAccount(identifier)
  if (existing) {
    // 账号已存在但非自助注册：自己设置了新密码 → 更新平台级密码并把来源升级为 platform
    if (existing.memberships.some((item) => item.orgName === membership.orgName)) {
      submitting.value = false
      formRef.value?.setFields([{ name: 'orgName', errors: ['该账号已归属这家企业，请勿重复创建'] }])
      return
    }
    existing.password = form.password
    addMembership(existing, membership)
    markPlatformRegistered(existing)
  } else {
    createAccount({
      accountType: accountType.value ?? 'phone',
      countryCode: accountType.value === 'phone' ? splitPhoneIdentifier(identifier).countryCode : '',
      identifier,
      password: form.password,
      membership,
      source: 'platform',
    })
  }
  const account = findAccount(identifier)
  if (account) createSession(account, false)
  // 本次注册对应的企业即新创建的企业，直接进入并展示结果页
  enterOrg(membership.orgId)
  submitting.value = false
  router.replace({ name: 'register-success' })
}

/** 【原型说明】为新加入的企业生成演示用企业标识 */
function buildOrgId(): string {
  return `ORG-${Date.now().toString().slice(-6)}`
}

function handlePrev() {
  current.value -= 1
  formAlert.value = null
}

function handleBackToLogin() {
  const dirty =
    form.identifier ||
    form.code ||
    form.password ||
    form.confirmPassword ||
    form.orgName ||
    form.industry ||
    form.contactName ||
    form.contactPhone
  if (dirty) {
    leaveConfirmOpen.value = true
    return
  }
  router.push({ name: 'login' })
}

function confirmLeave() {
  leaveConfirmOpen.value = false
  router.push({ name: 'login' })
}

function showProtocol(name: string) {
  message.info(`【原型说明】此处打开《${name}》，原型不实现具体条款内容`)
}

/**
 * 【原型演示】一键预填「已被企业添加为成员、但本人从未自助注册」的账号。
 * 用于快速演示：该账号在注册页不被拦截，可自行设置密码并创建自己的企业。
 */
function handleDemoExisting() {
  const demoIdentifier = '+8613900139000'
  const account = findAccount(demoIdentifier)
  if (!account || account.source !== 'member') {
    message.warning('演示数据已变更，请先点击「重置演示数据」')
    return
  }
  form.identifier = demoIdentifier
  formAlert.value = {
    type: 'info',
    text: '该手机号已被企业添加为成员。本次将为你创建一个新企业并赋予企业管理员权限，请设置你自己的登录密码。',
  }
  current.value = 1
  message.info('已预填演示账号：请设置密码并填写新企业信息')
}

/**
 * 【原型演示】一键预填「已从注册页自助注册过」的账号。
 * 提交步骤一后会被拦截，提示账号已注册、应直接登录。
 */
function handleDemoPlatformRegistered() {
  const demoIdentifier = '+8613800138000'
  const account = findAccount(demoIdentifier)
  if (!account || account.source !== 'platform') {
    message.warning('演示数据已变更，请先点击「重置演示数据」')
    return
  }
  form.identifier = demoIdentifier
  current.value = 0
  message.info('已预填已自助注册过的账号，请获取验证码后点「下一步」查看拦截提示')
}

function handleDataReset() {
  current.value = 0
  form.identifier = ''
  form.code = ''
  form.password = ''
  form.confirmPassword = ''
  form.orgName = ''
  form.industry = undefined
  form.region = undefined
  form.contactName = ''
  form.contactTitle = ''
  form.contactPhone = ''
  form.agree = false
  formAlert.value = null
  window.clearInterval(tickTimer)
  formRef.value?.clearValidate()
}

watch(current, () => {
  formRef.value?.clearValidate()
})

onBeforeUnmount(() => {
  window.clearInterval(tickTimer)
})
</script>
