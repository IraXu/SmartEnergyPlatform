/**
 * 【原型说明】登录态路由守卫。
 * - 未登录访问业务页面：跳转登录页并提示登录态失效。
 * - 已登录但尚未进入企业：业务页面不可直接访问，统一跳转「选择登录企业」。
 * - 已进入企业访问认证页或「选择登录企业」：跳转首页。
 */

import type { Router } from 'vue-router'
import { hasEnteredOrg, isSessionValid, refreshSession } from '@/modules/auth/store'

export function setupRouterGuard(router: Router) {
  router.beforeEach((to) => {
    const authed = isSessionValid()
    if (to.meta.requiresAuth && !authed) {
      return { name: 'login', query: { reason: 'expired', redirect: to.fullPath } }
    }
    // 已登录但尚未选定企业：只允许停留在「选择登录企业」，业务页与认证页均重定向回该页
    if (authed && !hasEnteredOrg() && !to.meta.pendingOrg) {
      return { name: 'select-org' }
    }
    // 已选定企业后访问「选择登录企业」：无选择必要，回到首页
    if (authed && to.meta.pendingOrg && hasEnteredOrg()) {
      return { name: 'dashboard' }
    }
    if (authed && to.meta.guestOnly && hasEnteredOrg()) {
      return { name: 'dashboard' }
    }
    if (authed) refreshSession()
    return true
  })

  router.afterEach((to) => {
    const title = to.meta.title || ''
    document.title = title ? `${title} — 智能数字化能源系统` : '智能数字化能源系统'
  })
}
