/**
 * 【原型说明】登录态路由守卫。
 * - 未登录访问业务页面：跳转登录页并提示登录态失效。
 * - 企业端：已登录但尚未进入企业时，业务页面统一跳转「选择登录企业」。
 * - 平台端：平台成员（scope = platform）登录后进入平台管理端，不进入企业端选择流程；
 *   访问企业端页面统一跳回平台首页，反之企业账号访问平台页亦跳回。
 */

import type { Router } from 'vue-router'
import { hasEnteredOrg, isPlatformSession, isSessionValid, refreshSession } from '@/modules/auth/store'
import { applyEnterpriseScope } from '@/shared/enterpriseScope'

export function setupRouterGuard(router: Router) {
  router.beforeEach((to) => {
    const authed = isSessionValid()
    if (to.meta.requiresAuth && !authed) {
      return { name: 'login', query: { reason: 'expired', redirect: to.fullPath } }
    }

    // 已进入企业时，按企业上下文装载演示数据（切换到新企业时重载，保证数据隔离）
    if (authed && hasEnteredOrg()) applyEnterpriseScope()

    // 平台端会话：只能在平台端页面之间导航
    if (authed && isPlatformSession()) {
      if (to.meta.platform === true) {
        refreshSession()
        return true
      }
      // 平台成员访问企业端页面或认证页时，回到平台首页
      return { name: 'platform-home' }
    }

    // 企业端会话：不可进入平台端页面
    if (authed && to.meta.platform === true) {
      // 未进入企业时仍需先选择企业，避免绕过
      if (!hasEnteredOrg()) return { name: 'select-org' }
      return { name: 'dashboard' }
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
