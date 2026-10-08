<template>
  <section class="role-list" aria-label="角色列表">
    <!-- 工具区：搜索（CMP-ROL-03） -->
    <div class="role-list__tools">
      <a-input
        :value="keyword"
        class="role-list__search"
        placeholder="搜索角色名称"
        allow-clear
        :maxlength="SEARCH_MAX"
        @update:value="emit('update:keyword', $event)"
      >
        <template #prefix>
          <SearchOutlined class="role-list__search-icon" />
        </template>
      </a-input>
    </div>

    <!-- 加载中（STATE-ROL-01） -->
    <div v-if="loading" class="role-list__body">
      <a-skeleton active :paragraph="{ rows: 4 }" />
    </div>

    <!-- 加载失败（STATE-ROL-05 / EX-ROL-01） -->
    <div v-else-if="failed" class="role-list__body role-list__body--center">
      <div class="role-list__state">
        <span class="role-list__state-icon role-list__state-icon--error">
          <DisconnectOutlined />
        </span>
        <p class="role-list__state-title">角色列表加载失败</p>
        <p class="role-list__state-desc">网络异常或服务暂时不可用，请稍后重试</p>
        <a-button type="primary" class="role-list__state-action" @click="emit('retry')">
          <template #icon>
            <ReloadOutlined />
          </template>
          重新加载
        </a-button>
      </div>
    </div>

    <!-- 搜索无结果（STATE-ROL-04 / CMP-ROL-29） -->
    <div v-else-if="!roles.length" class="role-list__body role-list__body--center">
      <div class="role-list__state">
        <span class="role-list__state-icon">
          <SearchOutlined />
        </span>
        <p class="role-list__state-title">未找到匹配的角色</p>
        <p class="role-list__state-desc">换个关键字试试，或清空搜索查看全部角色</p>
      </div>
    </div>

    <!-- 角色列表（STATE-ROL-02、STATE-ROL-03）：左侧只展示角色名称与成员数，描述在右侧顶部展示 -->
    <div v-else class="role-list__body">
      <button
        v-for="role in roles"
        :key="role.id"
        type="button"
        class="role-item"
        :class="{ 'role-item--current': role.id === selectedId }"
        @click="emit('select', role.id)"
      >
        <span class="role-item__name" :title="role.name">{{ role.name }}</span>
        <a-tag v-if="isPresetRole(role)" class="role-item__tag role-item__tag--preset">
          <LockOutlined />
          预置
        </a-tag>
        <span class="role-item__count" :title="`${roleMemberCount(role.id)} 名成员`">
          {{ roleMemberCount(role.id) }}
        </span>

        <!-- 操作区常显（默认低对比度），预置角色不渲染重命名与删除（EX-ROL-12、EX-ROL-13） -->
        <a-dropdown
          :menu="{ items: menuItems(role) }"
          trigger="click"
          placement="bottomRight"
          root-class="role-item-menu"
          @menu-click="handleMenuClick(role.id, $event)"
        >
          <span class="role-item__more" title="更多操作" @click.stop>
            <EllipsisOutlined />
          </span>
        </a-dropdown>
      </button>

      <p v-if="onlyPreset" class="role-list__empty-hint">还没有自定义角色，点击「新增角色」为不同岗位建立角色</p>
    </div>

    <!-- 新增角色（CMP-ROL-10）：达上限时置灰并给出原因（EX-ROL-06） -->
    <a-tooltip
      v-if="canCreate"
      :title="limitReached ? `自定义角色数量已达上限（${ROLE_LIMIT}），请先清理不再使用的角色` : undefined"
    >
      <a-button
        type="primary"
        block
        class="role-list__add"
        :disabled="limitReached"
        @click="emit('create')"
      >
        <template #icon>
          <PlusOutlined />
        </template>
        新增角色
      </a-button>
    </a-tooltip>
  </section>
</template>

<script setup lang="ts">
/**
 * 【原型说明】角色列表面板，对齐《产品交互设计文档-角色管理》v1.0 4.1.2 AREA-ROL-03。
 * 仅保留搜索；预置角色置顶并以锁定图标与「预置」标签标识；
 * 列表只展示角色名称、类型标签与成员数（角色描述在右侧面板顶部展示）；
 * 行操作区常显（默认低对比度），预置角色不渲染「重命名」与「删除」项。
 */
import { computed } from 'vue'
import {
  DisconnectOutlined,
  EllipsisOutlined,
  LockOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
} from '@antdv-next/icons'
import type { MenuItemType } from 'antdv-next'
import { isPresetRole, roleMemberCount, ROLE_LIMIT, SEARCH_MAX } from '../store'
import type { Role } from '../store'

const props = defineProps<{
  roles: Role[]
  selectedId: string | null
  keyword: string
  loading: boolean
  failed: boolean
  limitReached: boolean
  canCreate: boolean
  canEdit: boolean
  canRemove: boolean
}>()

const emit = defineEmits<{
  'update:keyword': [value: string]
  select: [roleId: string]
  create: []
  retry: []
  menu: [roleId: string, action: string]
}>()

/** 仅有预置角色且无搜索条件时给出引导（STATE-ROL-03 / CMP-ROL-28） */
const onlyPreset = computed(
  () => !props.keyword.trim() && props.roles.every((role) => isPresetRole(role)),
)

/** 菜单点击统一由页面按角色与动作分发 */
function handleMenuClick(roleId: string, info: { key?: string | number }) {
  emit('menu', roleId, String(info.key ?? ''))
}

/** 菜单项按角色类型与权限点裁剪：预置角色不渲染「重命名」与「删除」 */
function menuItems(role: Role): MenuItemType[] {
  const preset = isPresetRole(role)
  const memberCount = roleMemberCount(role.id)
  const items: MenuItemType[] = []

  if (!preset && props.canEdit) items.push({ key: 'rename', label: '重命名' })
  items.push({
    key: 'members',
    label: '查看成员',
    disabled: memberCount === 0,
  })
  if (!preset && props.canRemove) {
    items.push({ type: 'divider' })
    // 删除入口常显可用：是否可删除在点击后由页面判定并给出具体原因（PRD F-ROL-07）
    items.push({ key: 'remove', label: '删除', danger: true })
  }
  return items
}
</script>
