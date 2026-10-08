/**
 * 【原型说明】路由装配入口：汇总各模块路由并挂载登录态守卫。
 * 新增业务模块时，在 router/modules/ 下新建路由文件并加入 routes 数组。
 */

import { createRouter, createWebHashHistory } from 'vue-router'
import { setupRouterGuard } from './guard'
import { authRoutes } from './modules/auth'
import { adminRoutes } from './modules/dashboard'
import './types'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '', redirect: '/login' },
    ...authRoutes,
    ...adminRoutes,
    { path: '/:pathMatch(.*)*', redirect: '/login' },
  ],
})

setupRouterGuard(router)

export default router
