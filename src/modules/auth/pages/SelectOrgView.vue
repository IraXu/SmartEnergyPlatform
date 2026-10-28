<template>
  <div class="auth-page">
    <AuthBrand />

    <div class="auth-panel">
      <div class="auth-card auth-card--wide">
        <h2 class="auth-card__title">选择登录企业</h2>
        <p class="auth-card__subtitle">请选择您要进入的管理组织</p>

        <div class="org-picker" role="radiogroup" aria-label="选择登录企业">
          <button
            v-for="item in orgOptions"
            :key="item.orgId"
            type="button"
            role="radio"
            class="org-option"
            :class="{ 'org-option--active': selectedOrgId === item.orgId }"
            :aria-checked="selectedOrgId === item.orgId"
            @click="handleSelect(item.orgId)"
          >
            <EnterpriseBadge :logo="item.logo" :name="item.orgName" :size="44" :radius="6" />
            <span class="org-option__body">
              <span class="org-option__line">
                <span class="org-option__name">{{ item.orgName }}</span>
                <a-tag v-if="item.isRecent" class="org-option__tag" color="green">最近登录</a-tag>
              </span>
              <span class="org-option__meta">
                <span class="org-option__role">{{ item.role }}</span>
                <span class="org-option__divider">·</span>
                <span>ID：{{ item.orgId }}</span>
              </span>
            </span>
          </button>
        </div>

        <a-checkbox v-model:checked="rememberChoice" class="org-picker__remember">
          记住选择，下次自动登录
        </a-checkbox>

        <a-button
          type="primary"
          size="large"
          block
          class="org-picker__submit"
          :loading="submitting"
          @click="handleEnter"
        >
          进入系统
        </a-button>

        <div class="auth-switch">
          <a-typography-link @click="handleBackToLogin">返回登录</a-typography-link>
        </div>

        <ProtoTip :lines="tipLines" @reset="handleDataReset" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * P-06 选择登录企业
 * 【原型说明】账号归属多个企业时，凭证校验通过后进入本页选择要进入的企业。
 *
 * 「最近登录」与「记住选择」是两个独立概念：
 * - 最近登录 = 该账号最近一次「成功选择某企业并进入系统」的时间，仅用于打标签与默认选中；
 * - 记住选择 = 用户明确勾选后写入的记录，是下次登录自动进入的唯一依据。
 * 拆开后，未勾选「记住选择」时下次登录仍会展示本页，也才能看到「最近登录」标签。
 *
 * 单企业账号不经过本页，登录后直接进入其唯一企业。
 */
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { message } from 'antdv-next'
import AuthBrand from '@/modules/auth/components/AuthBrand.vue'
import ProtoTip from '@/shared/components/ProtoTip.vue'
import EnterpriseBadge from '@/shared/components/EnterpriseBadge.vue'
import { logoOf } from '@/modules/enterprise/store'
import {
  clearSession,
  enterOrg,
  findAccount,
  getRecentOrg,
  membershipsOf,
  session,
} from '@/modules/auth/store'
import { recordSessionLog } from '@/modules/log/store'
import { applyDocumentBranding, clearLoginBrandOrg, setLoginBrandOrg } from '@/modules/branding/store'

const route = useRoute()
const router = useRouter()

const submitting = ref(false)
const selectedOrgId = ref('')
/** 是否记住选择：勾选即写入「记住选择」记录，下次登录自动进入该企业 */
const rememberChoice = ref(false)

const account = computed(() => findAccount(session.current?.identifier ?? ''))
const recentOrg = computed(() =>
  session.current ? getRecentOrg(session.current.identifier) : null,
)

/** 企业选项：企业徽标（Logo 优先，未上传回退首字）、企业名称、当前账号在该企业下的角色与最近登录标记 */
const orgOptions = computed(() => {
  const recentOrgId = recentOrg.value?.orgId ?? ''
  return membershipsOf(account.value).map((item) => ({
    orgId: item.orgId,
    orgName: item.orgName,
    role: item.role,
    logo: logoOf(item.orgId),
    isRecent: item.orgId === recentOrgId,
  }))
})

const tipLines = [
  '使用多企业账号登录（+8613800138000 归属 3 家企业）即可进入本页。',
  '选中企业后，左侧品牌区自动识别并切换为该企业设置的品牌（未配置的分组继承平台默认）。',
  '「最近登录」= 该账号最近一次成功选择并进入某企业的时间，仅用于打标签与默认选中。',
  '勾选「记住选择」后再次登录将直接进入所选企业，不再展示本页；未勾选则下次登录仍展示本页。',
  '单企业账号（如 +6591234567、admin@example.com）登录后直接进入，不经过本页。',
]

/** 选中企业：同步切换该企业在登录页／选择企业页的品牌（Q-BRD-02） */
function handleSelect(orgId: string) {
  selectedOrgId.value = orgId
  setLoginBrandOrg(orgId)
  applyDocumentBranding(String(route.meta.title ?? ''))
}

function initializeSelection() {
  const options = orgOptions.value
  if (!options.length) return
  const recentOrgId = recentOrg.value?.orgId ?? ''
  handleSelect(
    options.some((item) => item.orgId === recentOrgId) ? recentOrgId : (options[0]?.orgId ?? ''),
  )
  // 默认不勾选「记住选择」：是否记住由用户本次主动决定
  rememberChoice.value = false
}

initializeSelection()

async function handleEnter() {
  if (!selectedOrgId.value) {
    message.warning('请选择要进入的企业')
    return
  }
  submitting.value = true
  // 【原型说明】模拟异步进入耗时，非真实接口调用
  await new Promise((resolve) => window.setTimeout(resolve, 400))
  // 勾选则写入「记住选择」，未勾选则清除；无论是否记住都更新「最近登录」
  const entered = enterOrg(selectedOrgId.value, rememberChoice.value)
  submitting.value = false
  if (!entered) {
    message.error('该账号不属于所选企业，请重新选择')
    return
  }
  // 会话日志：记录一条登录成功记录（PRD F-LOG-01）
  recordSessionLog({
    identifier: session.current?.identifier ?? '',
    action: '登录',
    method: '密码登录',
    result: '成功',
  })
  message.success(`已进入「${entered.orgName}」`)
  router.replace({ name: 'dashboard' })
}

/** 返回登录：结束「待选企业」态并回到登录页，重新走凭证校验 */
function handleBackToLogin() {
  clearSession()
  clearLoginBrandOrg()
  message.info('已返回登录')
  router.replace({ name: 'login' })
}

function handleDataReset() {
  selectedOrgId.value = ''
  rememberChoice.value = false
  initializeSelection()
}
</script>
