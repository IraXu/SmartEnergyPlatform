/**
 * 【原型说明】平台后台业务模块路由（P-05 起）。
 * 后续模块（能耗监测等）在此追加各自的路由分组。
 * 「系统管理」下「组织架构」「企业成员」「角色管理」「企业中心」「系统日志」已实现为真实页面，其余二级项仍为导航框架占位页。
 */

import type { RouteRecordRaw } from 'vue-router'
import AdminLayout from '@/layouts/AdminLayout.vue'
import ModulePlaceholder from '@/shared/components/ModulePlaceholder.vue'

export const adminRoutes: RouteRecordRaw[] = [
  {
    path: '/',
    component: AdminLayout,
    redirect: '/dashboard',
    children: [
      {
        path: 'dashboard',
        name: 'dashboard',
        component: () => import('@/modules/dashboard/pages/DashboardView.vue'),
        meta: { title: '平台首页', requiresAuth: true },
      },
      {
        path: 'location',
        name: 'location',
        component: () => import('@/modules/location/pages/LocationView.vue'),
        meta: { title: '点位地图', requiresAuth: true },
      },
      {
        path: 'alarm',
        name: 'alarm',
        redirect: '/alarm/center',
        children: [
          {
            path: 'center',
            name: 'alarm-center',
            component: () => import('@/modules/alarm/pages/AlarmCenterView.vue'),
            meta: { title: '告警中心', requiresAuth: true },
          },
        ],
      },
      {
        path: 'device',
        name: 'device',
        redirect: '/device/ledger',
        children: [
          {
            path: 'ledger',
            name: 'device-ledger',
            component: () => import('@/modules/device/pages/DeviceLedgerView.vue'),
            meta: { title: '设备台账', requiresAuth: true },
          },
          {
            path: 'ledger/:id',
            name: 'device-ledger-detail',
            component: () => import('@/modules/device/pages/DeviceDetailView.vue'),
            meta: { title: '设备详情', requiresAuth: true },
          },
          {
            path: 'ota',
            name: 'device-ota',
            component: () => import('@/modules/ota/pages/DeviceOtaView.vue'),
            meta: { title: '设备OTA', requiresAuth: true },
          },
          {
            path: 'power',
            name: 'device-power',
            redirect: '/device/power/load-strategy',
            children: [
              {
                path: 'load-strategy',
                name: 'device-power-load-strategy',
                component: () => import('@/modules/power/pages/LoadStrategyView.vue'),
                meta: { title: '负荷策略', requiresAuth: true },
              },
              {
                path: 'remote',
                name: 'device-power-remote',
                component: ModulePlaceholder,
                meta: { title: '远程控制', requiresAuth: true },
              },
              {
                path: 'billing',
                name: 'device-power-billing',
                component: ModulePlaceholder,
                meta: { title: '费控账务', requiresAuth: true },
              },
            ],
          },
        ],
      },
      {
        path: 'system',
        name: 'system',
        redirect: '/system/org-structure',
        children: [
          {
            path: 'org-structure',
            name: 'system-org-structure',
            component: () => import('@/modules/org/pages/OrgStructureView.vue'),
            meta: { title: '组织架构', requiresAuth: true },
          },
          {
            path: 'members',
            name: 'system-members',
            component: () => import('@/modules/member/pages/MemberManageView.vue'),
            meta: { title: '企业成员', requiresAuth: true },
          },
          {
            path: 'roles',
            name: 'system-roles',
            component: () => import('@/modules/role/pages/RoleManageView.vue'),
            meta: { title: '角色管理', requiresAuth: true },
          },
          {
            path: 'logs',
            name: 'system-logs',
            component: () => import('@/modules/log/pages/SystemLogView.vue'),
            meta: { title: '系统日志', requiresAuth: true },
          },
          {
            path: 'enterprise',
            name: 'system-enterprise',
            component: () => import('@/modules/enterprise/pages/EnterpriseCenterView.vue'),
            meta: { title: '企业中心', requiresAuth: true },
          },
          {
            path: 'branding',
            name: 'system-branding',
            component: () => import('@/modules/branding/pages/BrandingView.vue'),
            meta: { title: '品牌设置', requiresAuth: true },
          },
        ],
      },
    ],
  },
]
