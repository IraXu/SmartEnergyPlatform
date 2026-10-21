<template>
  <div class="admin-layout platform-layout">
    <header class="admin-header">
      <div class="admin-header__left">
        <img class="admin-header__mark" :src="`${baseUrl}logo.png`" alt="智能数字化能源系统" />
        <span>智能数字化能源系统</span>
      </div>

      <div class="admin-header__right">
        <a-dropdown
          :menu="accountMenu"
          :open="accountMenuOpen"
          :trigger="['click']"
          placement="bottomRight"
          @open-change="accountMenuOpen = $event"
          @menu-click="handleMenuClick"
        >
          <div class="admin-account" :class="{ 'admin-account--open': accountMenuOpen }">
            <span class="admin-account__avatar">{{ userInitial }}</span>
            <span class="admin-account__name">{{ displayName }}</span>
            <DownOutlined class="admin-account__caret" />
          </div>

          <template #popupRender="menu">
            <div class="admin-account-popup">
              <div class="admin-account-popup__head">
                <span class="admin-account-popup__avatar">{{ userInitial }}</span>
                <span class="admin-account-popup__name">{{ displayName }}</span>
                <span class="admin-account-popup__identifier">{{ maskedIdentifier }}</span>
                <span class="admin-role-tag">{{ roleText }}</span>
                <span class="admin-account-popup__org">平台管理端</span>
              </div>
              <component :is="menu" />
            </div>
          </template>
        </a-dropdown>
      </div>
    </header>

    <div class="admin-body">
      <nav ref="navRef" class="admin-nav" aria-label="平台端主导航" @keydown="handleNavKeydown">
        <template v-for="item in platformNav" :key="item.key">
          <button
            type="button"
            class="admin-nav__item"
            :data-key="item.key"
            :class="{
              'admin-nav__item--expanded': openKey === item.key,
              'admin-nav__item--current': isCurrent(item),
            }"
            :aria-current="isCurrent(item) ? 'page' : undefined"
            :aria-expanded="item.expandable ? openKey === item.key : undefined"
            @click="handleNavClick(item, $event)"
          >
            <component :is="item.icon" class="admin-nav__icon" />
            <span class="admin-nav__label">{{ item.label }}</span>
          </button>
        </template>
      </nav>

      <Transition name="nav-panel">
        <aside v-if="openItem" ref="panelRef" class="admin-nav-panel" :aria-label="`${openItem.label}二级导航`">
          <!-- 以模块 key 作为容器身份：切换一级项时容器重建，二级项重新挂载并逐项播放滑入 -->
          <div :key="openItem.key" class="admin-nav-panel__list">
            <template v-for="(child, index) in visibleChildren(openItem)" :key="child.key">
              <!-- 含三级菜单的二级分组：点击在二级列内展开三级项，分组自身不跳转 -->
              <div
                v-if="child.children?.length"
                class="admin-nav-panel__group"
                :style="{ '--nav-item-index': index }"
              >
                <button
                  type="button"
                  class="admin-nav-panel__item admin-nav-panel__item--group"
                  :class="{
                    'admin-nav-panel__item--expanded': openChildKey === child.key,
                    'admin-nav-panel__item--current': isGroupCurrent(child),
                  }"
                  :aria-expanded="openChildKey === child.key"
                  @click="toggleChildGroup(child)"
                >
                  <span class="admin-nav-panel__item-text">{{ child.label }}</span>
                  <RightOutlined class="admin-nav-panel__caret" />
                </button>

                <div v-if="openChildKey === child.key" class="admin-nav-panel__sublist">
                  <button
                    v-for="(leaf, leafIndex) in child.children"
                    :key="leaf.key"
                    type="button"
                    class="admin-nav-panel__item admin-nav-panel__item--leaf"
                    :class="{ 'admin-nav-panel__item--current': isChildCurrent(leaf) }"
                    :style="{ '--nav-item-index': index + leafIndex + 1 }"
                    :aria-current="isChildCurrent(leaf) ? 'page' : undefined"
                    @click="handleChildClick(leaf)"
                  >
                    {{ leaf.label }}
                  </button>
                </div>
              </div>

              <button
                v-else
                type="button"
                class="admin-nav-panel__item"
                :class="{ 'admin-nav-panel__item--current': isChildCurrent(child) }"
                :style="{ '--nav-item-index': index }"
                :aria-current="isChildCurrent(child) ? 'page' : undefined"
                @click="handleChildClick(child)"
              >
                {{ child.label }}
              </button>
            </template>
          </div>
        </aside>
      </Transition>

      <main class="admin-content">
        <RouterView />
      </main>
    </div>

    <a-modal
      v-model:open="logoutConfirmOpen"
      title="确认退出登录？"
      ok-text="确认退出"
      ok-type="danger"
      cancel-text="取消"
      @ok="handleLogout"
    >
      退出后本设备需重新登录，其他设备的登录状态不受影响。
    </a-modal>
  </div>
</template>

<script setup lang="ts">
/**
 * 平台管理端通用布局
 * 【原型说明】承载平台端顶栏（平台标识 + 账号区，**不含企业切换**）、一级导航栏与二级导航列。
 * 一级项为「首页 / 客户&设备 / 平台管理」，其中「平台管理」下含二级分组「权限管理」，
 * 「权限管理」再展开「平台成员管理 / 平台角色管理」两个三级菜单。
 * 导航项按平台权限点渲染：无对应权限的项不出现（与企业端「对全部账号可见」的口径不同）。
 */
import { computed, h, onBeforeUnmount, onMounted, ref, watch, type Component } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { message, type MenuItemType, type MenuProps } from 'antdv-next'
import {
  ApartmentOutlined,
  DownOutlined,
  HomeOutlined,
  LogoutOutlined,
  RightOutlined,
  TeamOutlined,
} from '@antdv-next/icons'
import { clearSession, session } from '@/modules/auth/store'
import { currentPlatformPermissions } from '@/modules/platform/store'
import { maskIdentifier } from '@/shared/utils/mask'

const baseUrl = import.meta.env.BASE_URL

type NavChild = {
  key: string
  label: string
  /** 二级项对应路由；缺失时表示含三级菜单的分组，自身不可跳转 */
  route?: string
  permission: string
  /** 三级菜单项；仅「权限管理」这类分组存在，在二级列内缩进展开 */
  children?: NavChild[]
}
type NavItem = {
  key: string
  label: string
  icon: Component
  route?: string
  expandable?: boolean
  permission: string
  children?: NavChild[]
}

/** 平台端一级导航：按平台权限点渲染 */
const platformNavAll: NavItem[] = [
  { key: 'home', label: '首页', icon: HomeOutlined, route: '/platform/home', permission: 'platform:home' },
  { key: 'customer', label: '客户&设备', icon: TeamOutlined, route: '/platform/customer', permission: 'platform:customer' },
  {
    key: 'permission',
    label: '平台管理',
    icon: ApartmentOutlined,
    expandable: true,
    permission: 'platform:permission',
    children: [
      // 二级分组「权限管理」：自身不跳转，点击在二级列内展开三级菜单
      {
        key: 'permission-manage',
        label: '权限管理',
        permission: 'platform:permission:manage',
        children: [
          { key: 'members', label: '平台成员管理', route: '/platform/members', permission: 'platform:member' },
          { key: 'roles', label: '平台角色管理', route: '/platform/roles', permission: 'platform:role' },
        ],
      },
    ],
  },
]

const permissions = computed(() => currentPlatformPermissions())

/** 有权限的一级项：具备 permission 或其任一子项权限 */
const platformNav = computed(() =>
  platformNavAll.filter((item) => {
    if (item.children?.length) {
      return item.children.some((child) => childHasPermission(child))
    }
    return permissions.value.includes(item.permission)
  }),
)

/** 子项（含三级）是否具备权限 */
function childHasPermission(child: NavChild): boolean {
  if (child.children?.length) return child.children.some((leaf) => childHasPermission(leaf))
  return permissions.value.includes(child.permission)
}

/** 有权限的二级项：分组按三级项权限过滤，普通项按自身权限过滤 */
function visibleChildren(item: NavItem): NavChild[] {
  return (item.children ?? []).filter((child) => childHasPermission(child))
}

const router = useRouter()
const route = useRoute()
const logoutConfirmOpen = ref(false)
const accountMenuOpen = ref(false)

const navRef = ref<HTMLElement | null>(null)
const panelRef = ref<HTMLElement | null>(null)
const openKey = ref<string | null>(null)
/** 二级列内当前展开三级菜单的分组 key，null 表示未展开 */
const openChildKey = ref<string | null>(null)
let triggerEl: HTMLElement | null = null

const openItem = computed(() => (openKey.value ? platformNav.value.find((item) => item.key === openKey.value) ?? null : null))

function isCurrent(item: NavItem) {
  if (item.route) return route.path === item.route
  return Boolean(visibleChildren(item).some((child) => isChildCurrent(child) || isGroupCurrent(child)))
}

function isChildCurrent(child: NavChild) {
  if (!child.route) return false
  return route.path === child.route || route.path.startsWith(`${child.route}/`)
}

/** 含三级菜单的二级分组是否包含当前功能 */
function isGroupCurrent(child: NavChild) {
  return Boolean(child.children?.some((leaf) => leaf.route === route.path))
}

/** 展开或收起二级列内的三级菜单；同一时间只展开一个分组 */
function toggleChildGroup(child: NavChild) {
  openChildKey.value = openChildKey.value === child.key ? null : child.key
}

function closePanel() {
  openKey.value = null
  openChildKey.value = null
  triggerEl = null
}

async function handleNavClick(item: NavItem, event: MouseEvent) {
  if (!item.expandable) {
    closePanel()
    if (item.route) await router.push(item.route)
    return
  }
  if (openKey.value === item.key) {
    closePanel()
    return
  }
  triggerEl = event.currentTarget as HTMLElement
  openKey.value = item.key
  // 切换一级项时按当前路由还原三级展开：落在某分组内则展开该分组，否则收起
  openChildKey.value = groupKeyOf(item, route.path)
  const defaultRoute = defaultRouteOf(item)
  if (defaultRoute && !isCurrent(item)) await router.push(defaultRoute)
}

/** 取一级项下第一个可直接进入的功能页路由（跳过自身不跳转的分组） */
function defaultRouteOf(item: NavItem) {
  for (const child of visibleChildren(item)) {
    if (child.route) return child.route
    const leaf = child.children?.find((node) => node.route)
    if (leaf?.route) return leaf.route
  }
  return undefined
}

/** 取当前路由在指定一级项下所属的三级分组 key；不在任何分组内时返回 null */
function groupKeyOf(item: NavItem, path: string) {
  for (const child of visibleChildren(item)) {
    if (child.children?.some((leaf) => leaf.route === path)) return child.key
  }
  return null
}

function handleChildClick(child: NavChild) {
  if (child.route) router.push(child.route)
}

function handleNavKeydown(event: KeyboardEvent) {
  if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
  const buttons = Array.from(navRef.value?.querySelectorAll<HTMLButtonElement>('.admin-nav__item') ?? [])
  const current = buttons.indexOf(document.activeElement as HTMLButtonElement)
  if (current < 0) return
  event.preventDefault()
  const next = event.key === 'ArrowDown' ? current + 1 : current - 1
  buttons[(next + buttons.length) % buttons.length]?.focus()
}

function handleDocumentClick(event: MouseEvent) {
  if (!openKey.value) return
  const target = event.target as Node
  if (navRef.value?.contains(target) || panelRef.value?.contains(target)) return
  const owner = openItem.value
  if (owner && isCurrent(owner)) return
  closePanel()
}

function handleDocumentKeydown(event: KeyboardEvent) {
  if (event.key !== 'Escape' || !openKey.value) return
  const focusTarget = triggerEl
  closePanel()
  focusTarget?.focus()
}

function syncPanelWithRoute() {
  const owner = platformNav.value.find((item) => isCurrent(item) && item.expandable)
  if (!owner) {
    if (platformNav.value.some((item) => item.route === route.path)) closePanel()
    return
  }
  openKey.value = owner.key
  // 同步二级列内三级分组的展开态，保证进入三级页时分组自动展开
  openChildKey.value = groupKeyOf(owner, route.path)
  triggerEl = navRef.value?.querySelector<HTMLElement>(`.admin-nav__item[data-key="${owner.key}"]`) ?? null
}

watch(() => route.path, syncPanelWithRoute)

onMounted(() => {
  syncPanelWithRoute()
  document.addEventListener('click', handleDocumentClick)
  document.addEventListener('keydown', handleDocumentKeydown)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', handleDocumentClick)
  document.removeEventListener('keydown', handleDocumentKeydown)
})

/* ---------- 顶栏账号区 ---------- */
const accountSession = computed(() => session.current)
const maskedIdentifier = computed(() => (session.current ? maskIdentifier(session.current.identifier) : '—'))
const displayName = computed(() => accountSession.value?.platformName || maskedIdentifier.value)
const userInitial = computed(() => displayName.value.slice(0, 1) || '平')
const roleText = computed(() => {
  const roles = accountSession.value?.platformRoles ?? []
  return roles.length ? roles.join('、') : '—'
})

const accountMenu = computed<MenuProps>(() => ({
  items: [
    { key: 'logout', danger: true, icon: () => h(LogoutOutlined), label: '退出登录' },
  ] as MenuItemType[],
}))

function handleMenuClick({ key }: { key: string }) {
  if (key === 'logout') logoutConfirmOpen.value = true
}

function handleLogout() {
  logoutConfirmOpen.value = false
  clearSession()
  message.success('已退出登录')
  router.replace({ name: 'login' })
}
</script>
