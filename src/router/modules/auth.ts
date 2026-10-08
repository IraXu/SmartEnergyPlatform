/**
 * 【原型说明】认证模块路由（P-01 ~ P-06）。
 */

import type { RouteRecordRaw } from 'vue-router'

export const authRoutes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'login',
    component: () => import('@/modules/auth/pages/LoginView.vue'),
    meta: { title: '登录', guestOnly: true },
  },
  {
    path: '/register',
    name: 'register',
    component: () => import('@/modules/auth/pages/RegisterView.vue'),
    meta: { title: '注册账号', guestOnly: true },
  },
  {
    path: '/forgot-password',
    name: 'forgot-password',
    component: () => import('@/modules/auth/pages/ForgotPasswordView.vue'),
    meta: { title: '重置密码', guestOnly: true },
  },
  {
    path: '/register-success',
    name: 'register-success',
    component: () => import('@/modules/auth/pages/RegisterSuccessView.vue'),
    meta: { title: '注册成功', requiresAuth: true },
  },
  {
    path: '/select-org',
    name: 'select-org',
    component: () => import('@/modules/auth/pages/SelectOrgView.vue'),
    // 凭证校验通过但尚未进入企业时停留本页；已进入企业的账号访问则跳回首页
    meta: { title: '选择登录企业', requiresAuth: true, pendingOrg: true },
  },
]

