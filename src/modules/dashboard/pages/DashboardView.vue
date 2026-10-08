<template>
  <div class="page-container">
    <a-alert
      type="info"
      show-icon
      message="平台首页为框架占位页"
      description="本期「登录与注册」模块仅保证认证成功后能正确进入并展示账号与企业信息。能耗监测、能源分析、告警工单等业务内容在后续模块中定义。"
      style="margin-bottom: 20px"
    />

    <a-row :gutter="16" style="margin-bottom: 20px">
      <a-col :span="8">
        <a-card size="small">
          <a-statistic title="当前登录账号" :value="maskedIdentifier" />
        </a-card>
      </a-col>
      <a-col :span="8">
        <a-card size="small">
          <a-statistic title="所属企业" :value="accountSession?.orgName ?? '—'" />
        </a-card>
      </a-col>
      <a-col :span="8">
        <a-card size="small">
          <a-statistic title="当前角色" :value="accountSession?.role ?? '—'" />
        </a-card>
      </a-col>
    </a-row>

    <a-card title="登录态信息" size="small">
      <a-descriptions :column="2" size="small" bordered>
        <a-descriptions-item label="账号类型">
          {{ accountSession?.accountType === 'phone' ? '手机号' : '邮箱' }}
        </a-descriptions-item>
        <a-descriptions-item label="记住登录状态">
          {{ accountSession?.remember ? '已勾选（登录态 7 天）' : '未勾选（2 小时无操作失效）' }}
        </a-descriptions-item>
        <a-descriptions-item label="登录态到期时间">{{ expireText }}</a-descriptions-item>
        <a-descriptions-item label="所在地区">{{ accountSession?.region || '—' }}</a-descriptions-item>
      </a-descriptions>
      <div style="margin-top: 16px; display: flex; gap: 12px">
        <a-button @click="handleRefreshSession">刷新登录态有效期</a-button>
      </div>
    </a-card>

    <ProtoTip :lines="tipLines" />
  </div>
</template>

<script setup lang="ts">
/**
 * P-05 平台首页（框架占位）
 * 【原型说明】对齐 PRD 页面 P-05 与交互设计文档。顶栏与退出登录由 AdminLayout 承载，
 * 本页仅展示登录态信息与原型演示提示。
 */
import { computed } from 'vue'
import { message } from 'antdv-next'
import ProtoTip from '@/shared/components/ProtoTip.vue'
import { refreshSession as refresh, session } from '@/modules/auth/store'
import { maskIdentifier } from '@/shared/utils/mask'

const accountSession = computed(() => session.current)
const maskedIdentifier = computed(() => (session.current ? maskIdentifier(session.current.identifier) : '—'))

const expireText = computed(() => {
  if (!session.current) return '—'
  return new Date(session.current.expiresAt).toLocaleString('zh-CN', { hour12: false })
})

const tipLines = [
  '在登录页勾选「记住登录状态」后登录，此处的登录态有效期会显示为 7 天。',
  '「刷新登录态有效期」对应有操作时延长有效期的规则。',
  '退出登录后浏览器回退无法进入本页，会跳转登录页并提示登录状态已失效。',
  '清理 localStorage 中的 proto_session 可模拟登录态超时失效。',
]

function handleRefreshSession() {
  refresh()
  message.success('登录态有效期已刷新')
}
</script>
