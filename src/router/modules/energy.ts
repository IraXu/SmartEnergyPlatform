/**
 * 【原型说明】能源数据模块路由（v1.0.1 迭代）。
 * 三个菜单页：用能分析 / 设备数据分析 / 统计报表；
 * 用电统计设置已取消，meter-stat 仅作历史原型留存，不再提供入口。
 */

import type { RouteRecordRaw } from 'vue-router'
import AdminLayout from '@/layouts/AdminLayout.vue'

export const energyRoutes: RouteRecordRaw[] = [
  {
    path: '/energy',
    component: AdminLayout,
    redirect: '/energy/analysis',
    children: [
      {
        path: 'monitor',
        name: 'energy-monitor',
        component: () => import('@/modules/energy/pages/EnergyMonitorView.vue'),
        meta: { title: '设备数据分析', requiresAuth: true },
      },
      {
        path: 'analysis',
        name: 'energy-analysis',
        component: () => import('@/modules/energy/pages/EnergyAnalysisView.vue'),
        meta: { title: '用能分析', requiresAuth: true },
      },
      {
        path: 'report',
        name: 'energy-report',
        component: () => import('@/modules/energy/pages/EnergyReportView.vue'),
        meta: { title: '统计报表', requiresAuth: true },
      },
      {
        path: 'meter-stat/:unitId?',
        name: 'energy-meter-stat',
        component: () => import('@/modules/energy/pages/EnergyMeterStatView.vue'),
        meta: { title: '用电统计设置（历史原型）', requiresAuth: true },
      },
    ],
  },
]
