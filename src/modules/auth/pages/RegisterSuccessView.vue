<template>
  <div class="auth-page">
    <AuthBrand />

    <div class="auth-panel">
      <div class="auth-card">
        <a-result status="success" title="注册成功" :sub-title="`您已成为「${sessionOrgName}」的企业管理员`">
          <template #extra>
            <div style="text-align: left; margin-bottom: 20px">
              <a-descriptions :column="1" size="small" bordered>
                <a-descriptions-item label="企业名称">{{ sessionOrgName }}</a-descriptions-item>
                <a-descriptions-item label="所属行业">{{ accountSession?.industry || '—' }}</a-descriptions-item>
                <a-descriptions-item label="所在地区">{{ accountSession?.region || '—' }}</a-descriptions-item>
                <a-descriptions-item label="登录账号">{{ maskedIdentifier }}</a-descriptions-item>
                <a-descriptions-item label="当前角色">
                  <a-tag color="green">{{ accountSession?.role || '企业管理员' }}</a-tag>
                </a-descriptions-item>
              </a-descriptions>
            </div>
            <a-button type="primary" size="large" block @click="goDashboard">
              进入平台{{ countdown > 0 ? `（${countdown} 秒后自动进入）` : '' }}
            </a-button>
          </template>
        </a-result>

        <a-alert
          type="info"
          show-icon
          style="margin-top: 18px"
          message="企业信息后续可在「组织与用户管理」模块由企业管理员维护。"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * P-04 注册成功引导
 * 【原型说明】对齐 PRD v1.5 页面 P-04 与交互设计文档 4.4（PAGE-04）。回显企业信息与当前角色，3 秒后自动进入平台。
 */
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import AuthBrand from '@/modules/auth/components/AuthBrand.vue'
import { session } from '@/modules/auth/store'
import { maskIdentifier } from '@/shared/utils/mask'

const router = useRouter()
const countdown = ref(3)
let timer: number | undefined

const sessionOrgName = computed(() => session.current?.orgName ?? '未命名企业')
const accountSession = computed(() => session.current)
const maskedIdentifier = computed(() => (session.current ? maskIdentifier(session.current.identifier) : '—'))

function goDashboard() {
  router.replace({ name: 'dashboard' })
}

onMounted(() => {
  timer = window.setInterval(() => {
    countdown.value -= 1
    if (countdown.value <= 0) {
      window.clearInterval(timer)
      goDashboard()
    }
  }, 1000)
})

onBeforeUnmount(() => {
  window.clearInterval(timer)
})
</script>
