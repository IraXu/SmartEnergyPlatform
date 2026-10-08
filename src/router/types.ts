/**
 * 【原型说明】路由元信息与公共类型。
 */

import 'vue-router'

declare module 'vue-router' {
  interface RouteMeta {
    /** 浏览器标题 */
    title?: string
    /** 需要登录态才能访问 */
    requiresAuth?: boolean
    /** 仅未登录可访问，已登录会自动跳转首页 */
    guestOnly?: boolean
    /**
     * 尚未进入企业的登录态专用页（选择登录企业）。
     * 已进入企业的账号访问该页会跳回首页；未进入企业时访问业务页会跳回该页。
     */
    pendingOrg?: boolean
  }
}

export {}
