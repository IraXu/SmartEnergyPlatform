<template>
  <div class="auth-page">
    <AuthBrand />

    <div class="auth-panel">
      <div class="auth-card">
        <h2 class="auth-card__title">重置密码</h2>
        <p class="auth-card__subtitle">通过手机号或邮箱验证身份后设置新密码</p>

        <a-steps class="auth-steps" size="small" :current="current" :items="stepItems" />

        <a-alert
          v-if="formAlert"
          class="form-alert"
          :type="formAlert.type"
          :message="formAlert.text"
          show-icon
          closable
          @close="formAlert = null"
        />

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
              <template #extra>
                <span v-if="codeSent" style="font-size: 12px">
                  若该{{ accountType === 'email' ? '邮箱' : '手机号' }}已注册，验证码已发送
                </span>
              </template>
            </a-form-item>
          </template>

          <!-- 步骤二：设置新密码 -->
          <template v-else>
            <a-form-item label="新密码" name="password">
              <a-input-password
                v-model:value="form.password"
                size="large"
                placeholder="请设置 8-20 位新密码，含字母和数字"
                :disabled="submitting"
              />
              <PasswordStrength :password="form.password" :identifier="form.identifier" />
            </a-form-item>

            <a-form-item label="确认新密码" name="confirmPassword">
              <a-input-password
                v-model:value="form.confirmPassword"
                size="large"
                placeholder="请再次输入新密码"
                :disabled="submitting"
              />
            </a-form-item>
          </template>

          <div style="display: flex; gap: 12px">
            <a-button v-if="current > 0" size="large" :disabled="submitting" @click="current = 0">上一步</a-button>
            <a-button type="primary" size="large" block html-type="submit" :loading="submitting">
              {{ current === 0 ? '下一步' : '重置密码' }}
            </a-button>
          </div>
        </a-form>

        <div class="auth-switch">
          <span>想起密码了？</span>
          <a-typography-link @click="router.push({ name: 'login' })">返回登录</a-typography-link>
        </div>

        <ProtoTip :lines="tipLines" @reset="handleDataReset" />
      </div>
    </div>

    <a-modal
      v-model:open="confirmOpen"
      title="确认重置密码？"
      ok-text="确认重置"
      cancel-text="取消"
      :confirm-loading="submitting"
      @ok="handleConfirmReset"
    >
      重置成功后原密码立即失效，其他设备的登录状态将失效。
    </a-modal>
  </div>
</template>

<script setup lang="ts">
/**
 * P-03 忘记密码页
 * 【原型说明】对齐 PRD v1.5 F-09 / F-10 与交互设计文档 4.3（PAGE-03）。
 * 两步结构：验证账号 → 设置新密码，含统一发送提示与二次确认，覆盖 EX-33 ~ EX-42。
 */
import { computed, onBeforeUnmount, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { message, type FormInstance } from 'antdv-next'
import { SafetyOutlined } from '@antdv-next/icons'
import AccountField from '@/modules/auth/components/AccountField.vue'
import AuthBrand from '@/modules/auth/components/AuthBrand.vue'
import PasswordStrength from '@/modules/auth/components/PasswordStrength.vue'
import ProtoTip from '@/shared/components/ProtoTip.vue'
import { checkPassword } from '@/modules/auth/utils/password'
import {
  clearLock,
  codeCooldownSeconds,
  detectAccountType,
  findAccount,
  issueCode,
  verifyCode,
} from '@/modules/auth/store'

const router = useRouter()
const route = useRoute()

const current = ref(0)
const submitting = ref(false)
/** 用于驱动验证码冷却倒计时刷新 */
const tick = ref(0)
const codeSent = ref(false)
const confirmOpen = ref(false)
const formRef = ref<FormInstance>()
const formAlert = ref<{ type: 'error' | 'warning' | 'info'; text: string } | null>(null)

const queriedIdentifier = (route.query.identifier as string) ?? ''

const form = reactive({
  identifier: queriedIdentifier,
  code: '',
  password: '',
  confirmPassword: '',
})

/** 账号类型由输入内容自动识别，用于提示文案与流程分支 */
const accountType = computed<'phone' | 'email' | null>(() => detectAccountType(form.identifier))

const stepItems = [{ title: '验证账号' }, { title: '设置新密码' }]

const tipLines = [
  '账号输入框自动识别手机号与邮箱：手机号支持选择国际区号（默认 +86 中国），输入含 @ 的内容自动切换为邮箱。',
  '验证码为原型模拟，点击获取后会回显 6 位数字，5 分钟有效。',
  '使用未注册的标识发起找回，同样提示「若已注册，验证码已发送」，用于验证不暴露账号状态。',
  '预置账号 +8613800138000 / admin@example.com，原密码均为 Energy2026。',
  '重置成功后原密码失效、其他设备登录态失效，且账号锁定状态会被解除。',
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
  return {
    password: [
      {
        required: true,
        validator: (_rule: unknown, value: string) => {
          const check = checkPassword(value ?? '', form.identifier)
          if (!check.valid) return Promise.reject(check.reason)
          const account = findAccount(form.identifier)
          if (account && account.password === value) return Promise.reject('新密码不能与原密码相同')
          return Promise.resolve()
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
})

/**
 * 验证码冷却秒数由当前输入的账号标识推导，而非页面级计时器。
 * 这样在账号类型自动切换（手机号 ↔ 邮箱）后，倒计时能立即反映新标识的冷却状态。
 */
const codeCountdown = computed(() => {
  void tick.value
  const identifier = form.identifier.trim()
  if (!identifier) return 0
  return codeCooldownSeconds(identifier, 'reset')
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
  try {
    await formRef.value?.validate(['identifier'])
  } catch {
    return
  }
  const identifier = form.identifier.trim()
  const result = issueCode(identifier, 'reset')
  if (!result.ok) {
    message.warning(result.message)
    return
  }
  startCountdownTicker()
  codeSent.value = true
  // 反馈文案不暴露账号是否存在
  const exists = Boolean(findAccount(identifier))
  message.success({
    content: exists
      ? `【原型演示】验证码已发送至 ${identifier}，验证码为 ${result.code}，5 分钟内有效`
      : `【原型演示】若该${accountType.value === 'phone' ? '手机号' : '邮箱'}已注册，验证码已发送（该标识未注册，验证码为 ${result.code}，仅用于流程演示）`,
    duration: 8,
  })
}

async function handleNext() {
  formAlert.value = null

  if (current.value === 0) {
    const identifier = form.identifier.trim()
    submitting.value = true
    await new Promise((resolve) => window.setTimeout(resolve, 600))
    const result = verifyCode(identifier, 'reset', form.code)
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
    if (!findAccount(identifier)) {
      formAlert.value = {
        type: 'warning',
        text: '该标识未注册，无法完成密码重置。原型已放行以演示后续页面，正式环境会提示账号不存在并引导注册',
      }
    }
    current.value = 1
    return
  }

  confirmOpen.value = true
}

async function handleConfirmReset() {
  submitting.value = true
  await new Promise((resolve) => window.setTimeout(resolve, 700))
  const identifier = form.identifier.trim()
  const account = findAccount(identifier)
  if (account) {
    account.password = form.password
  }
  clearLock(identifier)
  submitting.value = false
  confirmOpen.value = false
  message.success('密码重置成功，请使用新密码登录', 3)
  router.replace({ name: 'login' })
}

function handleDataReset() {
  current.value = 0
  form.identifier = ''
  form.code = ''
  form.password = ''
  form.confirmPassword = ''
  codeSent.value = false
  formAlert.value = null
  window.clearInterval(tickTimer)
  formRef.value?.clearValidate()
}

onBeforeUnmount(() => {
  window.clearInterval(tickTimer)
})
</script>
