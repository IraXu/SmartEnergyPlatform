<template>
  <div class="auth-page">
    <AuthBrand />

    <div class="auth-panel">
      <div class="auth-card">
        <h2 class="auth-card__title">登录</h2>
        <p class="auth-card__subtitle">使用手机号或邮箱登录智能数字化能源系统</p>

        <a-alert
          v-if="formAlert"
          class="form-alert"
          :type="formAlert.type"
          :message="formAlert.text"
          show-icon
          :closable="formAlert.closable"
          @close="formAlert = null"
        />

        <a-segmented
          v-model:value="mode"
          block
          :options="modeOptions"
          style="margin-bottom: 20px"
          @change="handleModeChange"
        />

        <a-form ref="formRef" :model="form" :rules="activeRules" layout="vertical" @finish="handleSubmit">
          <a-form-item label="手机号 / 邮箱" name="identifier">
            <AccountField v-model:value="form.identifier" :disabled="submitting" />
          </a-form-item>

          <template v-if="mode === 'password'">
            <a-form-item label="密码" name="password">
              <a-input-password
                v-model:value="form.password"
                size="large"
                placeholder="请输入密码"
                :disabled="submitting"
              >
                <template #prefix>
                  <LockOutlined style="color: rgba(0, 0, 0, 0.3)" />
                </template>
              </a-input-password>
            </a-form-item>
          </template>

          <template v-else>
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

          <a-form-item v-if="captchaRequired" label="图形验证码" name="captcha">
            <CaptchaImage ref="captchaRef" v-model="form.captcha" placeholder="请输入右侧 4 位字符" />
            <template #extra>
              <span style="font-size: 12px; color: rgba(0, 0, 0, 0.45)">
                该账号已连续登录失败，请输入图形验证码后重试
              </span>
            </template>
          </a-form-item>

          <div class="auth-form-actions">
            <a-checkbox v-model:checked="form.remember" :disabled="submitting">记住登录状态</a-checkbox>
            <a-typography-link @click="goForgot">忘记密码</a-typography-link>
          </div>

          <a-button
            type="primary"
            size="large"
            block
            html-type="submit"
            :loading="submitting"
            :disabled="passwordLoginDisabled"
          >
            登录
          </a-button>

          <div v-if="passwordLoginDisabled" style="margin-top: 8px; font-size: 12px; color: #faad14">
            账号锁定期间无法使用密码登录，可切换到验证码登录或等待自动解锁
          </div>
        </a-form>

        <div class="auth-switch">
          <span>还没有账号？</span>
          <a-typography-link @click="router.push({ name: 'register' })">注册</a-typography-link>
        </div>

        <div class="auth-footer">
          登录即表示同意
          <a-typography-link @click="showProtocol('用户协议')">《用户协议》</a-typography-link>
          与
          <a-typography-link @click="showProtocol('隐私政策')">《隐私政策》</a-typography-link>
        </div>

        <ProtoTip :lines="tipLines" @reset="handleDataReset" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * P-01 登录页
 * 【原型说明】对齐 PRD v1.5 F-04 / F-05 / F-06 / F-07 / F-08 与交互设计文档 4.1（PAGE-01）。
 * 含页面状态：初始态、校验中、密码错误、需图形验证码、账号锁定、账号停用、登录态失效、网络异常。
 */
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { message, type FormInstance } from 'antdv-next'
import { LockOutlined, SafetyOutlined } from '@antdv-next/icons'
import AccountField from '@/modules/auth/components/AccountField.vue'
import AuthBrand from '@/modules/auth/components/AuthBrand.vue'
import CaptchaImage from '@/modules/auth/components/CaptchaImage.vue'
import ProtoTip from '@/shared/components/ProtoTip.vue'
import {
  CAPTCHA_AFTER_FAILS,
  clearLock,
  codeCooldownSeconds,
  createSession,
  detectAccountType,
  findAccount,
  getLock,
  isLocked,
  isSessionValid,
  issueCode,
  recordFail,
  refreshSession,
  remainLockMinutes,
  resolveEntry,
  verifyCode,
} from '@/modules/auth/store'
import { recordSessionLog } from '@/modules/log/store'

const router = useRouter()
const route = useRoute()

type LoginMode = 'password' | 'otp'

const mode = ref<LoginMode>('password')
const submitting = ref(false)
/** 用于驱动验证码冷却倒计时刷新 */
const tick = ref(0)
const captchaRequired = ref(false)
const lockRemain = ref(0)
const formRef = ref<FormInstance>()
const captchaRef = ref<InstanceType<typeof CaptchaImage>>()
const formAlert = ref<{ type: 'error' | 'warning' | 'info'; text: string; closable: boolean } | null>(null)

const form = reactive({
  identifier: '',
  password: '',
  code: '',
  captcha: '',
  remember: false,
})

const modeOptions = [
  { label: '密码登录', value: 'password' },
  { label: '验证码登录', value: 'otp' },
]

const tipLines = [
  '预置账号：+8613800138000 / +8613900139000 / admin@example.com，密码均为 Energy2026。',
  '预置国际手机号：+6591234567（新加坡），用于验证区号切换与登录。',
  '预置停用账号：+8613700137000，用于验证「账号已被停用」提示。',
  '账号输入框自动识别手机号与邮箱：输入数字显示区号选择，输入含 @ 的内容自动切换为邮箱。',
  '验证码为原型模拟，点击获取后会在提示中回显，6 位数字，5 分钟有效。',
  '连续输错密码 5 次将锁定账号 15 分钟，锁定后可用验证码登录立即恢复。',
]

const identifierValidator = (_rule: unknown, value: string) => {
  if (!detectAccountType(value)) {
    return Promise.reject('请输入正确的手机号或邮箱')
  }
  return Promise.resolve()
}

const activeRules = computed(() => {
  const rules: Record<string, unknown[]> = {
    identifier: [{ required: true, validator: identifierValidator, trigger: 'blur' }],
  }
  if (mode.value === 'password') {
    rules.password = [{ required: true, message: '请输入密码', trigger: 'blur' }]
  } else {
    rules.code = [
      { required: true, message: '请输入 6 位验证码', trigger: 'blur' },
      { pattern: /^\d{6}$/, message: '请输入 6 位验证码', trigger: 'blur' },
    ]
  }
  if (captchaRequired.value) {
    rules.captcha = [{ required: true, message: '图形验证码错误，请重新输入', trigger: 'blur' }]
  }
  return rules
})

const passwordLoginDisabled = computed(() => mode.value === 'password' && lockRemain.value > 0)

/**
 * 验证码冷却秒数由当前输入的账号标识推导，而非页面级计时器。
 * 这样在账号类型自动切换（手机号 ↔ 邮箱）后，倒计时能立即反映新标识的冷却状态。
 */
const codeCountdown = computed(() => {
  void tick.value
  const identifier = form.identifier.trim()
  if (!identifier) return 0
  return codeCooldownSeconds(identifier, 'login')
})

let tickTimer: number | undefined
let lockTimer: number | undefined

function startCountdownTicker() {
  window.clearInterval(tickTimer)
  tickTimer = window.setInterval(() => {
    tick.value += 1
    // 冷却结束即停止刷新，避免无意义的常驻计时器
    if (codeCountdown.value === 0) window.clearInterval(tickTimer)
  }, 1000)
}

function syncLockState() {
  const identifier = form.identifier.trim()
  if (!identifier || !findAccount(identifier)) {
    lockRemain.value = 0
    return
  }
  lockRemain.value = isLocked(identifier) ? remainLockMinutes(identifier) : 0
  if (lockRemain.value > 0) {
    formAlert.value = {
      type: 'warning',
      text: `连续失败次数过多，账号已锁定，请 ${lockRemain.value} 分钟后重试或使用验证码登录`,
      closable: false,
    }
  } else if (formAlert.value?.type === 'warning') {
    formAlert.value = null
  }
}

function startLockTimer() {
  window.clearInterval(lockTimer)
  lockTimer = window.setInterval(() => {
    syncLockState()
    if (lockRemain.value === 0) {
      window.clearInterval(lockTimer)
      message.success('账号锁定已解除，可重新使用密码登录')
    }
  }, 1000)
}

function handleModeChange() {
  form.code = ''
  form.password = ''
  form.captcha = ''
  captchaRef.value?.refresh()
  captchaRequired.value = false
  formAlert.value = null
  formRef.value?.clearValidate()
  syncLockState()
  syncCaptchaFlag()
}

function syncCaptchaFlag() {
  const identifier = form.identifier.trim()
  if (!identifier) return
  const lock = getLock(identifier)
  captchaRequired.value = lock.fails >= CAPTCHA_AFTER_FAILS
}

watch(
  () => form.identifier,
  () => {
    syncLockState()
    syncCaptchaFlag()
  },
)

async function handleSendCode() {
  const identifier = form.identifier.trim()
  if (!detectAccountType(identifier)) {
    formRef.value?.validate(['identifier'])
    return
  }
  const result = issueCode(identifier, 'login')
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

/** 图形验证码为原型内前端生成的 4 位字符，与输入内容比对 */
function captchaMatches(): boolean {
  const expected = captchaRef.value?.value ?? ''
  return form.captcha.trim().toUpperCase() === String(expected).toUpperCase()
}

async function handleSubmit() {
  const identifier = form.identifier.trim()
  const account = findAccount(identifier)

  if (mode.value === 'password') {
    if (lockRemain.value > 0) {
      formAlert.value = {
        type: 'warning',
        text: `账号已锁定，请 ${lockRemain.value} 分钟后重试或使用验证码登录`,
        closable: false,
      }
      return
    }
    if (account && account.status === 'DISABLED') {
      formAlert.value = { type: 'error', text: '账号已被停用，请联系平台运营方', closable: true }
      return
    }
    if (captchaRequired.value && !captchaMatches()) {
      formRef.value?.setFields([{ name: 'captcha', errors: ['图形验证码错误，请重新输入'] }])
      captchaRef.value?.refresh()
      return
    }
  }

  submitting.value = true
  formAlert.value = null
  // 【原型说明】模拟异步请求耗时，非真实接口调用
  await new Promise((resolve) => window.setTimeout(resolve, 700))

  if (mode.value === 'password') {
    if (!account || account.password !== form.password) {
      const locked = recordFail(identifier)
      form.password = ''
      const lock = getLock(identifier)
      // 会话日志：失败与触发锁定分别记录（PRD F-LOG-01）
      recordSessionLog({
        identifier,
        action: '登录',
        method: '密码登录',
        result: locked ? '已锁定' : '失败',
        failReason: locked ? `连续失败 ${lock.fails} 次，触发账号锁定` : '密码错误',
      })
      if (locked) {
        captchaRequired.value = true
        formAlert.value = {
          type: 'warning',
          text: '连续失败次数过多，账号已锁定，请 15 分钟后重试或使用验证码登录',
          closable: false,
        }
        startLockTimer()
      } else {
        if (lock.fails >= CAPTCHA_AFTER_FAILS) captchaRequired.value = true
        formAlert.value = {
          type: 'error',
          text: `账号或密码不正确（原型提示：已连续失败 ${lock.fails} 次，达 5 次将锁定账号）`,
          closable: true,
        }
      }
      if (captchaRequired.value) {
        form.captcha = ''
        captchaRef.value?.refresh()
      }
      submitting.value = false
      return
    }
    clearLock(identifier)
    createSession(account, form.remember)
    submitting.value = false
    goAfterAuth(account)
    return
  }

  // 验证码登录：账号类型已由输入框自动识别，此处按识别结果给出对应提示
  const checkType = detectAccountType(identifier)
  if (!checkType) {
    formRef.value?.setFields([{ name: 'identifier', errors: ['请输入正确的手机号或邮箱'] }])
    submitting.value = false
    return
  }
  if (!account) {
    formAlert.value = {
      type: 'error',
      text: checkType === 'phone' ? '该手机号未注册，请先注册' : '该邮箱未注册，请先注册',
      closable: true,
    }
    submitting.value = false
    return
  }
  if (account.status === 'DISABLED') {
    formAlert.value = { type: 'error', text: '账号已被停用，请联系平台运营方', closable: true }
    submitting.value = false
    return
  }
  const result = verifyCode(identifier, 'login', form.code)
  if (result === 'wrong') {
    recordFail(identifier)
    formRef.value?.setFields([{ name: 'code', errors: ['验证码错误，请重新输入'] }])
    submitting.value = false
    return
  }
  if (result === 'expired') {
    formRef.value?.setFields([{ name: 'code', errors: ['验证码已失效，请重新获取'] }])
    submitting.value = false
    return
  }

  const wasLocked = isLocked(identifier)
  clearLock(identifier)
  lockRemain.value = 0
  captchaRequired.value = false
  createSession(account, form.remember)
  submitting.value = false
  goAfterAuth(account, wasLocked)
}

/**
 * 凭证校验通过后的去向：单企业直接进入，多企业按「记住选择」自动进入或转选择页。
 * 账号归属多家企业时，本页只完成身份校验，企业由「选择登录企业」页确认。
 */
function goAfterAuth(account: NonNullable<ReturnType<typeof findAccount>>, wasLocked = false) {
  const decision = resolveEntry(account)
  if (decision.type === 'no-org') {
    formAlert.value = {
      type: 'error',
      text: '该账号暂未归属任何企业，请联系平台运营方',
      closable: true,
    }
    return
  }
  if (decision.type === 'org-disabled') {
    formAlert.value = {
      type: 'error',
      text: '该账号所属企业均已停用该成员，请联系对应企业管理员',
      closable: true,
    }
    return
  }
  if (decision.type === 'select-org') {
    // 尚未进入企业：进入「选择登录企业」页后再记录一条登录成功记录
    message.success('身份校验通过，请选择要进入的企业')
    router.replace({ name: 'select-org' })
    return
  }
  // 会话日志：登录成功（PRD F-LOG-01）
  recordSessionLog({
    identifier: account.identifier,
    action: '登录',
    method: mode.value === 'password' ? '密码登录' : '验证码登录',
    result: '成功',
  })
  message.success(
    wasLocked
      ? `登录成功，账号锁定已解除，已进入「${decision.orgName}」`
      : `登录成功，正在进入「${decision.orgName}」`,
  )
  router.replace({ name: 'dashboard' })
}

function goForgot() {
  router.push({ name: 'forgot-password', query: { identifier: form.identifier.trim() } })
}

function showProtocol(name: string) {
  message.info(`【原型说明】此处打开《${name}》，原型不实现具体条款内容`)
}

function handleDataReset() {
  form.identifier = ''
  form.password = ''
  form.code = ''
  form.captcha = ''
  form.remember = false
  lockRemain.value = 0
  captchaRequired.value = false
  formAlert.value = null
  window.clearInterval(tickTimer)
  window.clearInterval(lockTimer)
  formRef.value?.clearValidate()
}

onMounted(() => {
  if (isSessionValid()) refreshSession()
  if (route.query.reason === 'expired') {
    formAlert.value = { type: 'info', text: '登录状态已失效，请重新登录', closable: true }
  }
})

onBeforeUnmount(() => {
  window.clearInterval(tickTimer)
  window.clearInterval(lockTimer)
})
</script>
