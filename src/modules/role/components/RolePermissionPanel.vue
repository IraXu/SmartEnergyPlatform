<template>
  <section class="role-perm" aria-label="权限配置">
    <!-- 未选中任何角色：引导态（CMP-ROL-24） -->
    <div v-if="!role" class="role-perm__empty">
      <a-empty description="请从左侧选择一个角色查看权限配置" />
    </div>

    <template v-else>
      <!-- 面板头部（CMP-ROL-11）：角色描述在右侧顶部展示 -->
      <header class="role-perm__head">
        <div class="role-perm__title">
          <span class="role-perm__icon" :class="{ 'role-perm__icon--preset': preset }">
            <component :is="preset ? SafetyCertificateOutlined : TeamOutlined" />
          </span>
          <span class="role-perm__name" :title="role.name">{{ role.name }}</span>
          <a-tag v-if="preset" class="role-perm__tag role-perm__tag--preset">
            <LockOutlined />
            预置
          </a-tag>
          <a v-if="memberCount > 0" class="role-perm__members" @click="emit('viewMembers')">
            {{ memberCount }} 名成员
          </a>
          <span v-else class="role-perm__members role-perm__members--empty">0 名成员</span>
        </div>
        <div class="role-perm__head-actions">
          <a-button v-if="canEdit" type="link" size="small" @click="emit('rename')">编辑</a-button>
        </div>
      </header>

      <!-- 角色描述：放在右侧面板顶部，便于选中角色后直接确认其适用岗位 -->
      <p class="role-perm__desc">
        <span class="role-perm__desc-label">角色描述</span>
        <span :class="{ 'role-perm__desc-value--empty': !role.desc }">{{ role.desc || '—' }}</span>
      </p>

      <!-- 预置角色只读说明（CMP-ROL-12 / STATE-ROL-08）：主色实底警示条，与「预置」标签同色系但更醒目 -->
      <div v-if="preset" class="role-perm__lock">
        <span class="role-perm__lock-icon"><LockOutlined /></span>
        <div class="role-perm__lock-main">
          <p class="role-perm__lock-title">该角色为系统预置，权限不可修改</p>
          <p class="role-perm__lock-desc">企业超级管理员恒定拥有本企业全部功能与全部数据权限</p>
        </div>
      </div>

      <!-- 权限工具行：搜索 + 统计 + 全选 / 清空（CMP-ROL-13~CMP-ROL-15） -->
      <div class="role-perm__tools">
        <a-input
          :value="keyword"
          class="role-perm__search"
          placeholder="搜索权限点名称"
          allow-clear
          :maxlength="SEARCH_MAX"
          @update:value="emit('update:keyword', $event)"
        >
          <template #prefix>
            <SearchOutlined class="role-perm__search-icon" />
          </template>
        </a-input>
        <span v-if="keyword.trim()" class="role-perm__hits">命中 {{ hits.length }} 项</span>
        <span class="role-perm__count">
          {{
            preset
              ? `全部 ${ALL_CAPABILITY_KEYS.length} 项权限`
              : `已选 ${checkedCount} / ${ALL_CAPABILITY_KEYS.length} 项权限`
          }}
        </span>
        <a-space v-if="canConfig" size="small">
          <a-button type="link" size="small" @click="emit('selectAll')">全选</a-button>
          <a-button type="link" size="small" danger @click="emit('clearAll')">清空</a-button>
        </a-space>
      </div>

      <!-- 权限字典更新提示（CMP-ROL-16 / STATE-ROL-14） -->
      <a-alert
        v-if="permUpdated"
        type="warning"
        show-icon
        class="role-perm__update"
        message="权限项已更新，请确认该角色的权限配置"
        @close="emit('dismissUpdate')"
      />

      <!-- 加载中 -->
      <div v-if="loading" class="role-perm__body role-perm__body--center">
        <a-skeleton active :paragraph="{ rows: 6 }" />
      </div>

      <!-- 权限点加载失败（CMP-ROL-27 / EX-ROL-02、EX-ROL-03） -->
      <div v-else-if="failed" class="role-perm__body role-perm__body--center">
        <div class="role-perm__state">
          <span class="role-perm__state-icon">
            <DisconnectOutlined />
          </span>
          <p class="role-perm__state-title">{{ failedTitle }}</p>
          <p class="role-perm__state-desc">网络异常或服务暂时不可用，请稍后重试</p>
          <a-button type="primary" class="role-perm__state-action" @click="emit('retry')">
            <template #icon>
              <ReloadOutlined />
            </template>
            重新加载
          </a-button>
        </div>
      </div>

      <!-- 权限点字典为空（CMP-ROL-25 / STATE-ROL-13） -->
      <div v-else-if="!ALL_PERMISSION_KEYS.length" class="role-perm__body role-perm__body--center">
        <a-empty description="暂无可配置的权限项" />
      </div>

      <!-- 权限配置区（CMP-ROL-18~CMP-ROL-21）：
           按「目录 → 菜单（可多级嵌套）→ 按钮」逐级下钻，每一级都带勾选框，
           因此既能只配一个目录、只配一个菜单，也能下钻到单个按钮。
           菜单卡片递归渲染：菜单下若还有下级菜单，下级菜单卡片**嵌套在其内部**展示（逐级缩进）；
           菜单级节点自带「可进入该页面」语义，勾选任一按钮会自动补齐其上级菜单。 -->
      <div v-else class="role-perm__body">
        <div
          v-for="dir in PERMISSION_TREE"
          :key="dir.key"
          class="perm-module"
          :class="{ 'perm-module--dim': isNodeDim(dir) }"
        >
          <!-- 目录级：一级导航栏内的项 -->
          <div class="perm-module__head">
            <a-checkbox
              class="perm-level__box"
              :checked="stateOf(dir.key) === 'all'"
              :indeterminate="stateOf(dir.key) === 'partial'"
              :disabled="!canConfig"
              @change="toggle(dir.key, $event.target.checked)"
            />
            <span class="perm-module__icon"><AppstoreOutlined /></span>
            <span class="perm-module__name">{{ dir.name }}</span>
            <span class="perm-level__badge">目录</span>
            <span class="perm-module__count">
              {{ grantedCountOf(dir.key) }} / {{ capabilityCountOf(dir.key) }} 项权限
            </span>
          </div>

          <!-- 该目录自身即页面（无下级菜单）：其下的按钮级权限直接以勾选项呈现 -->
          <template v-if="!hasMenuChildren(dir)">
            <div v-if="actionChildrenOf(dir).length" class="perm-module__actions">
              <PermissionActionItem
                v-for="action in actionChildrenOf(dir)"
                :key="action.key"
                :node="action"
                :checked="granted.has(action.key)"
                :dim="isActionDim(action.key)"
                :keyword="keyword"
                :disabled="!canConfig"
                @toggle="toggle"
              />
            </div>
            <p v-else class="perm-module__note">勾选即获得此页面的访问权限</p>
          </template>

          <!-- 菜单级：二级及更深菜单栏内的项，以卡片网格平铺；
               含下级菜单的菜单，其下级菜单卡片嵌套在上级卡片内部 -->
          <div v-else class="perm-menus">
            <PermissionMenuCard
              v-for="child in menuChildrenOf(dir)"
              :key="child.key"
              :node="child"
              :depth="0"
              :granted="granted"
              :hit-keys="hitKeys"
              :searching="searching"
              :keyword="keyword"
              :disabled="!canConfig"
              @toggle="toggle"
            />
          </div>
        </div>

        <p v-if="keyword.trim() && !hits.length" class="role-perm__no-hit">未找到匹配的权限点</p>
      </div>

      <!-- 底部操作区：未保存摘要 + 取消 / 保存（CMP-ROL-22、CMP-ROL-23） -->
      <footer v-if="canConfig" class="role-perm__footer">
        <span v-if="dirty" class="role-perm__summary">
          已选 {{ checkedCount }} / {{ ALL_CAPABILITY_KEYS.length }} 项权限 · 新增
          {{ diff.added.length }} 项 · 移除 {{ diff.removed.length }} 项
        </span>
        <span v-else class="role-perm__summary role-perm__summary--idle">权限已是最新，无未保存修改</span>
        <a-space>
          <a-button :disabled="!dirty" @click="emit('cancel')">取消</a-button>
          <a-button type="primary" :disabled="!dirty" :loading="saving" @click="emit('save')">保存</a-button>
        </a-space>
      </footer>
    </template>
  </section>
</template>

<script setup lang="ts">
/**
 * 【原型说明】权限配置面板，对齐《产品交互设计文档-角色管理》v1.0 4.1.2 AREA-ROL-04。
 * 【交互调整】权限按「目录 → 菜单（可多级嵌套）→ 按钮」逐级下钻，**每一级都是可独立授权的权限点**：
 * - 目录级（一级导航栏内）：勾选即整块授予该目录下全部功能，因此「只想配一个一级导航」可一步到位；
 * - 菜单级（二级及更深菜单栏内）：以**菜单卡片**呈现，卡片可递归嵌套——
 *   菜单下若还有下级菜单，下级菜单卡片**嵌套在上级卡片内部**并逐级缩进（附左侧浅色条），
 *   因此「设备用电管控 › 负荷策略」这类多级菜单的归属关系一眼可辨；
 *   菜单节点自带「可进入该页面」语义，勾选即获得该菜单全部按钮；
 * - 按钮级（页面内）：最小颗粒度，勾选任一按钮会自动补齐其上级菜单的进入能力。
 * 预置角色全选只读，不渲染全选 / 清空 / 取消 / 保存。
 */
import { computed } from 'vue'
import {
  AppstoreOutlined,
  DisconnectOutlined,
  LockOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
  SearchOutlined,
  TeamOutlined,
} from '@antdv-next/icons'
import {
  ALL_CAPABILITY_KEYS,
  ALL_PERMISSION_KEYS,
  PERMISSION_TREE,
  SEARCH_MAX,
  expandPermissionKeys,
  getPermissionNode,
  getSubtreeKeys,
  hasMenuChildren,
  permissionPathText,
  subtreeCapabilityKeysOf,
} from '../store'
import type { PermissionNode, Role } from '../store'
import PermissionActionItem from './PermissionActionItem.vue'
import PermissionMenuCard from './PermissionMenuCard.vue'

const props = defineProps<{
  role: Role | null
  /** 角色已授权的**生效能力**（含菜单进入能力），预置角色为字典全集 */
  permissions: string[]
  /** 面板内的草稿授权集合（收敛态：可含目录 / 菜单 / 按钮任意层级） */
  draft: string[]
  /** 搜索关键字（受控）：命中项高亮、未命中项淡出，切换角色时由页面清空 */
  keyword: string
  loading: boolean
  failed: boolean
  failedTitle: string
  saving: boolean
  permUpdated: boolean
  canConfig: boolean
  canEdit: boolean
  memberCount: number
}>()

const emit = defineEmits<{
  /** 勾选 / 取消某个层级的权限节点：[节点标识, 是否勾选] */
  toggle: [key: string, checked: boolean]
  selectAll: []
  clearAll: []
  cancel: []
  save: []
  rename: []
  retry: []
  viewMembers: []
  dismissUpdate: []
  'update:keyword': [value: string]
}>()

const keyword = computed(() => props.keyword)

const preset = computed(() => props.role?.source === 'preset')

/** 展开后的生效能力集合：勾选态与计数都以它为准（父级授权自动覆盖其下全部能力） */
const granted = computed(() => new Set(expandPermissionKeys(props.draft)))

/** 已授权的权限项数：与面板上可勾选项的口径一致 */
const checkedCount = computed(
  () => ALL_CAPABILITY_KEYS.filter((key) => granted.value.has(key)).length,
)

/* ---------- 层级状态与计数 ---------- */

/** 节点子树的可授权能力总数（含菜单自身的进入能力） */
const capabilityCountOf = (key: string) => {
  const node = getPermissionNode(key)
  return node ? subtreeCapabilityKeysOf(node).length : 0
}

const grantedCountOf = (key: string) => {
  const node = getPermissionNode(key)
  if (!node) return 0
  return subtreeCapabilityKeysOf(node).filter((item) => granted.value.has(item)).length
}

/** 节点三态：整块授权 / 部分授权 / 未授权 */
function stateOf(key: string): 'all' | 'partial' | 'none' {
  const node = getPermissionNode(key)
  if (!node) return 'none'
  const caps = subtreeCapabilityKeysOf(node)
  const hit = caps.filter((item) => granted.value.has(item)).length
  if (hit === 0) return 'none'
  return hit === caps.length ? 'all' : 'partial'
}

/** 把勾选动作回传页面，由页面统一收敛授权集合 */
function toggle(key: string, checked: boolean) {
  emit('toggle', key, checked)
}

/* ---------- 菜单级渲染 ---------- */

/** 节点直属的按钮级权限点 */
function actionChildrenOf(node: PermissionNode): PermissionNode[] {
  return node.children.filter((child) => child.level === 'action')
}

/**
 * 目录下的菜单级子节点。菜单卡片由 PermissionMenuCard 递归渲染：
 * 菜单下若还有下级菜单，下级菜单卡片嵌套在上级卡片内部、逐级缩进展示，
 * 因此这里只需给出该目录的顶层菜单，深层菜单由组件自身递归展开。
 */
function menuChildrenOf(dir: PermissionNode): PermissionNode[] {
  return dir.children.filter((child) => child.level === 'menu')
}

/* ---------- 未保存差异（按权限项比对，口径与面板一致） ---------- */

const diff = computed(() => {
  const before = new Set(props.permissions)
  const after = ALL_CAPABILITY_KEYS.filter((key) => granted.value.has(key))
  const afterSet = new Set(after)
  return {
    added: after.filter((key) => !before.has(key)),
    removed: props.permissions.filter((key) => !afterSet.has(key)),
  }
})

const dirty = computed(() => diff.value.added.length > 0 || diff.value.removed.length > 0)

/* ---------- 搜索高亮与淡出（COMP-ROL-02） ---------- */

const keywordLower = computed(() => keyword.value.trim().toLowerCase())

/** 命中的节点：自身或任一子节点命中即算命中 */
const hits = computed(() => {
  const value = keywordLower.value
  if (!value) return []
  return ALL_PERMISSION_KEYS.filter(
    (key) =>
      permissionPathText(key).toLowerCase().includes(value) ||
      getSubtreeKeys(key).some((item) => permissionPathText(item).toLowerCase().includes(value)),
  )
})

/** 命中节点集合，供递归的菜单卡片判断是否淡出 */
const hitKeys = computed(() => new Set(hits.value))

/** 是否处于搜索中：未命中项淡出仅在此为真时生效 */
const searching = computed(() => !!keywordLower.value)

const isActionDim = (key: string) => searching.value && !hits.value.includes(key)
const isNodeDim = (node: PermissionNode) => searching.value && !hits.value.includes(node.key)
</script>
