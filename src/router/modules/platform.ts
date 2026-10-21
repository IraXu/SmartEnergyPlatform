/**
 * 【原型说明】平台管理端路由。
 * 平台成员登录后进入平台端，独立于企业端；一级「首页 / 客户&设备 / 平台管理（权限管理 › 平台成员管理 / 平台角色管理）」。
 * 所有页面均带 meta.platform = true，由路由守卫限制仅平台端会话可进入。
 */

import type { RouteRecordRaw } from 'vue-router'
import PlatformLayout from '@/layouts/PlatformLayout.vue'

export const platformRoutes: RouteRecordRaw[] = [
  {
    path: '/platform',
    component: PlatformLayout,
    redirect: '/platform/home',
    children: [
      {
        path: 'home',
        name: 'platform-home',
        component: () => import('@/modules/platform/pages/PlatformHomeView.vue'),
        meta: { title: '首页', requiresAuth: true, platform: true },
      },
      {
        path: 'customer',
        name: 'platform-customer',
        component: () => import('@/modules/platform/pages/CustomerDeviceView.vue'),
        meta: { title: '客户&设备', requiresAuth: true, platform: true },
      },
      {
        path: 'customer/:id',
        name: 'platform-customer-device-detail',
        component: () => import('@/modules/platform/pages/PlatformDeviceDetailView.vue'),
        meta: { title: '设备详情', requiresAuth: true, platform: true },
      },
      {
        path: 'members',
        name: 'platform-members',
        component: () => import('@/modules/platform/pages/PlatformMemberView.vue'),
        meta: { title: '平台成员管理', requiresAuth: true, platform: true },
      },
      {
        path: 'roles',
        name: 'platform-roles',
        component: () => import('@/modules/platform/pages/PlatformRoleView.vue'),
        meta: { title: '平台角色管理', requiresAuth: true, platform: true },
      },
    ],
  },
]
