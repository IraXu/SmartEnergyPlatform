<template>
  <div class="admin-layout">
    <header class="admin-header">
      <div class="admin-header__left">
        <img class="admin-header__mark" :src="`${baseUrl}logo.png`" alt="智能数字化能源系统" />
        <span>智能数字化能源系统</span>
      </div>

      <div class="admin-header__right">
        <!-- 当前企业切换：点击展开该账号归属的全部企业与该企业下的角色 -->
        <a-dropdown
          :menu="orgMenu"
          :classes="{ root: 'admin-org-dropdown' }"
          :open="orgMenuOpen"
          :trigger="['click']"
          placement="bottomRight"
          @open-change="orgMenuOpen = $event"
          @menu-click="handleOrgMenuClick"
        >
          <button type="button" class="admin-org" :class="{ 'admin-org--open': orgMenuOpen }">
            <EnterpriseBadge :logo="orgLogo" :name="orgName" :size="26" :radius="7" />
            <span class="admin-org__name">{{ orgName || '未选择企业' }}</span>
            <DownOutlined class="admin-org__caret" />
          </button>
        </a-dropdown>

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
                <span class="admin-role-tag">{{ accountSession?.role || '—' }}</span>
                <span class="admin-account-popup__org">{{ orgName || '—' }}</span>
              </div>

              <component :is="menu" />
            </div>
          </template>
        </a-dropdown>
      </div>
    </header>

    <div class="admin-body">
      <nav ref="navRef" class="admin-nav" aria-label="平台主导航" @keydown="handleNavKeydown">
        <template v-for="(item, index) in navItems" :key="item.key">
          <div v-if="index === mainNav.length" class="admin-nav__spacer" />
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
            <template v-for="(child, index) in openItem.children" :key="child.key">
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
            <p v-if="!openItem.children?.length" class="admin-nav-panel__placeholder">二级功能待模块定稿</p>
          </div>
        </aside>
      </Transition>

      <main class="admin-content">
        <!-- 切换企业后按 key 强制重建当前页，使页面数据与顶栏一同刷新 -->
        <RouterView :key="`${route.path}-${orgRefreshKey}`" />
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
 * 平台后台通用布局
 * 【原型说明】承载顶栏（平台标识、所属企业、账号下拉、退出登录）、一级导航栏与二级导航列，
 * 业务模块页面统一挂载在本布局下，避免重复实现框架。
 *
 * 导航为一到三级结构：一级为业务域，二级以通高列按需展开；含下级功能的二级项
 * （如「设备用电管控」）在二级列内缩进展开三级菜单，不另开一列。
 * 二级列只做点击展开，不做悬停展开，避免一级项与列之间移动时反复闪烁，
 * 同时与键盘操作共用同一套开关。
 */
import { computed, h, onBeforeUnmount, onMounted, ref, watch, type Component } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { message, type MenuItemType, type MenuProps } from 'antdv-next'
import {
  AlertOutlined,
  ClusterOutlined,
  DownOutlined,
  HeatMapOutlined,
  HomeOutlined,
  LogoutOutlined,
  RightOutlined,
  SettingOutlined,
  ThunderboltOutlined,
} from '@antdv-next/icons'
import EnterpriseBadge from '@/shared/components/EnterpriseBadge.vue'
import { clearSession, enterOrg, findAccount, membershipsOf, session } from '@/modules/auth/store'
import { logoOf } from '@/modules/enterprise/store'
import { recordSessionLog } from '@/modules/log/store'
import { maskIdentifier } from '@/shared/utils/mask'
import { applyEnterpriseScope } from '@/shared/enterpriseScope'
import { hasPermission as hasEnergyPermission } from '@/modules/energy/store'
import { PERM as ENERGY_PERM } from '@/modules/energy/store/constants'

/** 站点部署基路径：兼容 GitHub Pages 子路径与本地根路径 */
const baseUrl = import.meta.env.BASE_URL

type NavChild = {
  key: string
  label: string
  /** 二级项对应路由；缺失时表示含三级菜单的分组，自身不可跳转 */
  route?: string
  /** 三级菜单项；仅「设备用电管控」这类分组存在，在二级列内缩进展开 */
  children?: NavChild[]
}

type NavItem = {
  key: string
  label: string
  icon: Component
  /** 模块首页路由；缺失时点击只展开二级浮层，不跳转 */
  route?: string
  /** 是否以浮层展开二级；false 表示点击直接进入模块 */
  expandable?: boolean
  children?: NavChild[]
}

/** 业务域组：自上而下排列 */
const baseNav: NavItem[] = [
  { key: 'dashboard', label: '工作台', icon: HomeOutlined, route: '/dashboard' },
  // 点位地图为一级菜单入口，点击直接进入；该模块为只读空间视图，不设二级功能页
  { key: 'location', label: '点位地图', icon: HeatMapOutlined, route: '/location' },
  // 告警中心为一级菜单入口，点击直接进入；该模块本期及后续均无二级功能页，不展开二级导航列
  { key: 'alarm', label: '告警中心', icon: AlertOutlined, route: '/alarm/center' },
  // 设备管理下含多个功能页，点击展开二级导航列；设备台账与设备OTA 已为真实页面，设备用电管控仍为占位页
  {
    key: 'device',
    label: '设备管理',
    icon: ClusterOutlined,
    expandable: true,
    children: [
      { key: 'ledger', label: '设备台账', route: '/device/ledger' },
      { key: 'ota', label: '设备OTA', route: '/device/ota' },
      // 设备用电管控为二级分组，自身不跳转，点击后在二级列内展开三级菜单
      {
        key: 'power-control',
        label: '设备用电管控',
        children: [
          { key: 'load-strategy', label: '负荷策略', route: '/device/power/load-strategy' },
          { key: 'remote', label: '远程控制', route: '/device/power/remote' },
          { key: 'billing', label: '费控账务', route: '/device/power/billing' },
        ],
      },
    ],
  },
  // 能源数据为 v1.0.1 新增业务域：其下含用能分析 / 设备数据分析 / 报表统计
]

/**
 * 能源数据一级项：目录级 `energy` + 菜单级权限分别渲染；
 * 无目录权限或无任何可见子页面时整项隐藏（UI-ENOV-04/05）。
 */
const energyNav = computed<NavItem[]>(() => {
  const children: NavChild[] = []
  if (hasEnergyPermission(ENERGY_PERM.analysis)) {
    children.push({ key: 'energy-analysis', label: '用能分析', route: '/energy/analysis' })
  }
  if (hasEnergyPermission(ENERGY_PERM.monitor)) {
    children.push({ key: 'energy-monitor', label: '设备数据分析', route: '/energy/monitor' })
  }
  if (hasEnergyPermission(ENERGY_PERM.report)) {
    children.push({ key: 'energy-report', label: '报表统计', route: '/energy/report' })
  }
  if (!hasEnergyPermission(ENERGY_PERM.energy) || !children.length) return []
  return [{ key: 'energy', label: '能源数据', icon: ThunderboltOutlined, expandable: true, children }]
})

/** 能源数据一级项位于「告警中心」下方、「设备管理」上方 */
const mainNav = computed<NavItem[]>(() => {
  const nav = [...baseNav]
  const alarmIndex = nav.findIndex((item) => item.key === 'alarm')
  if (energyNav.value.length) nav.splice(alarmIndex + 1, 0, ...energyNav.value)
  return nav
})

/** 系统组：固定在一级导航栏底部，与业务域以分割线隔离 */
const bottomNav: NavItem[] = [
  {
    key: 'system',
    label: '系统管理',
    icon: SettingOutlined,
    expandable: true,
    children: [
      { key: 'org-structure', label: '组织架构', route: '/system/org-structure' },
      { key: 'members', label: '企业成员', route: '/system/members' },
      { key: 'roles', label: '角色管理', route: '/system/roles' },
      { key: 'logs', label: '系统日志', route: '/system/logs' },
      { key: 'enterprise', label: '企业中心', route: '/system/enterprise' },
      { key: 'branding', label: '品牌设置', route: '/system/branding' },
    ],
  },
]

const navItems = computed(() => [...mainNav.value, ...bottomNav])

const router = useRouter()
const route = useRoute()
const logoutConfirmOpen = ref(false)
/** 账号下拉展开状态，用于箭头翻转等展开反馈 */
const accountMenuOpen = ref(false)

/* ---------- 一级导航与二级浮层 ---------- */
const navRef = ref<HTMLElement | null>(null)
const panelRef = ref<HTMLElement | null>(null)
/** 当前展开二级浮层的一级项 key，null 表示未展开 */
const openKey = ref<string | null>(null)
/** 二级列内当前展开三级菜单的分组 key，null 表示未展开 */
const openChildKey = ref<string | null>(null)
let triggerEl: HTMLElement | null = null

const openItem = computed(() => (openKey.value ? navItems.value.find((item) => item.key === openKey.value) ?? null : null))

/** 一级项是否对应当前所在模块：模块自身路由或任一二级项（含三级项）路由命中即视为当前模块 */
function isCurrent(item: NavItem) {
  if (item.route) return route.path === item.route
  // 能源数据：用电统计设置已取消，相关独立页仅作历史原型留存，同样归属本模块
  if (item.key === 'energy') return route.path.startsWith('/energy')
  return Boolean(item.children?.some((child) => isChildCurrent(child) || isGroupCurrent(child)))
}

/** 二级项是否对应当前功能：精确命中，或其下级页面（如设备详情 `/{二级}/:id`）命中 */
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
  // 无二级的模块直接进入，并收起已展开的浮层
  if (!item.expandable) {
    closePanel()
    if (item.route) await router.push(item.route)
    return
  }
  // 再次点击同一项收起浮层
  if (openKey.value === item.key) {
    closePanel()
    return
  }

  triggerEl = event.currentTarget as HTMLElement
  openKey.value = item.key
  // 切换一级项时重置三级展开：若当前路由落在本模块的某分组内则展开该分组，否则全部收起
  openChildKey.value = groupKeyOf(item, route.path)

  // 模块已有二级项且当前不在该模块内时，进入模块的默认页（首个可直接进入的功能页）
  const defaultRoute = defaultRouteOf(item)
  if (defaultRoute && !isCurrent(item)) await router.push(defaultRoute)
}

/** 取一级项下第一个可直接进入的功能页路由（跳过自身不跳转的分组） */
function defaultRouteOf(item: NavItem) {
  for (const child of item.children ?? []) {
    if (child.route) return child.route
    const leaf = child.children?.find((node) => node.route)
    if (leaf?.route) return leaf.route
  }
  return undefined
}

/** 取当前路由在指定一级项下所属的三级分组 key；不在任何分组内时返回 null */
function groupKeyOf(item: NavItem, path: string) {
  for (const child of item.children ?? []) {
    if (child.children?.some((leaf) => leaf.route === path)) return child.key
  }
  return null
}

function handleChildClick(child: NavChild) {
  if (child.route) router.push(child.route)
}

/** 上下方向键在一级项之间移动焦点 */
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
  // 当前路由仍属于该模块时保持展开：在模块内容区操作不应收起二级导航
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

/** 路由变化时同步浮层：进入某模块的二级或三级页则展开该模块浮层，进入无二级的模块则收起 */
function syncPanelWithRoute() {
  const owner = navItems.value.find((item) => isCurrent(item) && item.expandable)
  if (!owner) {
    if (navItems.value.some((item) => item.route === route.path)) closePanel()
    return
  }
  openKey.value = owner.key
  // 落在三级页时同步展开其所属分组，保证刷新或直接访问地址后三级项可见
  openChildKey.value = groupKeyOf(owner, route.path)
  triggerEl = navRef.value?.querySelector<HTMLElement>(`.admin-nav__item[data-key="${owner.key}"]`) ?? null
}

watch(() => route.path, syncPanelWithRoute)

onMounted(() => {
  // 首次进入（含刷新落在二级页）时同步浮层
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
const orgName = computed(() => accountSession.value?.orgName ?? '')
/** 当前企业 Logo：用于顶栏企业切换触发区（20×20）；未上传时由徽标组件回退企业名称首字 */
const orgLogo = computed(() => logoOf(accountSession.value?.orgId ?? ''))
const maskedIdentifier = computed(() => (session.current ? maskIdentifier(session.current.identifier) : '—'))

/** 展示名优先用联系人姓名，缺失时回退为脱敏账号 */
const displayName = computed(() => accountSession.value?.contactName || maskedIdentifier.value)
/** 头像文字取展示名首字，B 端场景比图形头像更易辨识责任人 */
const userInitial = computed(() => displayName.value.slice(0, 1) || '用')

/** 当前企业的切换浮层展开状态，用于箭头翻转等展开反馈 */
const orgMenuOpen = ref(false)

/**
 * 企业切换菜单：列出该账号归属的全部企业，每项展示企业徽标（Logo 优先，未上传回退首字）、
 * 企业名称与其在该企业下的角色标签。当前企业由选中态（左侧绿色色条 + 主色企业名）标识；
 * 点击其他企业即切换并刷新当前企业上下文。
 *
 * 【原型说明】label 必须是 VNode 而非函数：antdv-next 会把函数型 label 原样交给
 * MenuItem 的默认插槽，Vue 无法渲染函数，导致浮层内容显示异常。
 */
const orgMenu = computed<MenuProps>(() => {
  const currentOrgId = accountSession.value?.orgId ?? ''
  return {
    selectedKeys: currentOrgId ? [currentOrgId] : [],
    items: membershipsOf(accountOfSession.value).map((membership) => ({
      key: membership.orgId,
      label: h('span', { class: 'admin-org-menu__item' }, [
        h(EnterpriseBadge, {
          logo: logoOf(membership.orgId),
          name: membership.orgName,
          size: 32,
          radius: 8,
        }),
        h('span', { class: 'admin-org-menu__text' }, [
          h('span', { class: 'admin-org-menu__name' }, membership.orgName),
          h('span', { class: 'admin-role-tag' }, membership.role),
        ]),
      ]),
    })) as MenuItemType[],
  }
})

const accountOfSession = computed(() => findAccount(session.current?.identifier ?? ''))

/** 企业上下文版本号：切换企业后自增，用作页面 key 以强制重建当前页 */
const orgRefreshKey = ref(0)

function refreshOrgContext() {
  orgRefreshKey.value += 1
}

function handleOrgMenuClick({ key }: { key: string }) {
  orgMenuOpen.value = false
  if (key === accountSession.value?.orgId) return
  const entered = enterOrg(key)
  if (!entered) {
    message.error('该账号不属于所选企业')
    return
  }
  message.success(`已切换至「${entered.orgName}」`)
  // 切换企业按「重新进入系统」处理：按新企业上下文重载演示数据并刷新当前页面
  applyEnterpriseScope(true)
  refreshOrgContext()
}

/** 弹层正文已展示账号与企业信息，菜单仅保留操作项 */
const accountMenu = computed<MenuProps>(() => ({
  items: [
    {
      key: 'logout',
      danger: true,
      icon: () => h(LogoutOutlined),
      label: '退出登录',
    },
  ] as MenuItemType[],
}))

function handleMenuClick({ key }: { key: string }) {
  if (key === 'logout') logoutConfirmOpen.value = true
}

function handleLogout() {
  logoutConfirmOpen.value = false
  // 会话日志：记录一条退出登录记录（系统管理 › 系统日志 › 登录日志）
  if (session.current?.identifier) {
    recordSessionLog({ identifier: session.current.identifier, action: '退出登录', result: '成功' })
  }
  clearSession()
  message.success('已退出登录')
  router.replace({ name: 'login' })
}
</script>
