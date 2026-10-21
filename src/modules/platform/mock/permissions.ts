/**
 * 【原型说明】平台权限点字典，对齐《产品需求文档-平台管理端总览》v1.0 第 4.6 节（共 15 项）。
 *
 * 采用与企业端「角色管理」一致的**三层模型**（目录 / 菜单 / 按钮），但为**独立字典**，
 * 标识统一以 `platform` 为目录前缀，与企业端权限点互不影响。
 * 层级由「平台端导航位置」决定：目录级 = 一级导航、菜单级 = 二级菜单、按钮级 = 页面内操作。
 */

import type { PlatformPermissionNode } from '../store/types'

function action(key: string, name: string): PlatformPermissionNode {
  return { key, name, level: 'action', children: [] }
}

function menu(key: string, name: string, children: PlatformPermissionNode[]): PlatformPermissionNode {
  return { key, name, level: 'menu', children }
}

export const PLATFORM_PERMISSION_TREE: PlatformPermissionNode[] = [
  {
    // 一级导航「首页」，无下级菜单 → 自身即页面
    key: 'platform:home',
    name: '首页',
    level: 'dir',
    children: [],
  },
  {
    // 一级导航「客户&设备」，只读，无下级菜单 → 自身即页面；不设按钮级权限点
    key: 'platform:customer',
    name: '客户&设备',
    level: 'dir',
    children: [],
  },
  {
    // 一级导航「平台管理」，含下级菜单 → 纯分组容器；勾选即整块授权其下全部子功能
    key: 'platform:permission',
    name: '平台管理',
    level: 'dir',
    children: [
      // 二级分组「权限管理」：自身无页面，仅承载平台成员与平台角色两个菜单
      menu('platform:permission:manage', '权限管理', [
        menu('platform:member', '平台成员管理', [
          action('platform:member:create', '新增平台成员'),
          action('platform:member:edit', '编辑平台成员'),
          action('platform:member:toggle', '启停用平台成员'),
          action('platform:member:delete', '删除平台成员'),
          action('platform:member:resetpwd', '重置平台成员密码'),
        ]),
        menu('platform:role', '平台角色管理', [
          action('platform:role:create', '新增平台角色'),
          action('platform:role:edit', '编辑平台角色'),
          action('platform:role:delete', '删除平台角色'),
          action('platform:role:permission', '配置角色权限'),
        ]),
      ]),
    ],
  },
]

function flatten(nodes: PlatformPermissionNode[]): PlatformPermissionNode[] {
  return nodes.flatMap((node) => [node, ...flatten(node.children)])
}

export const ALL_PLATFORM_PERMISSION_NODES = flatten(PLATFORM_PERMISSION_TREE)
export const ALL_PLATFORM_PERMISSION_KEYS = ALL_PLATFORM_PERMISSION_NODES.map((node) => node.key)

export const getPlatformPermissionNode = (key: string): PlatformPermissionNode | null =>
  ALL_PLATFORM_PERMISSION_NODES.find((node) => node.key === key) ?? null

/** 节点下是否还有菜单：区分「分组容器」与「页面」的唯一依据 */
export const hasPlatformMenuChildren = (node: PlatformPermissionNode): boolean =>
  node.children.some((child) => child.level === 'menu')

export const isPlatformSelfCapability = (node: PlatformPermissionNode): boolean =>
  !hasPlatformMenuChildren(node)

export const isPlatformCollapsible = (node: PlatformPermissionNode): boolean =>
  hasPlatformMenuChildren(node)

export const platformSelfKeysOf = (node: PlatformPermissionNode): string[] =>
  isPlatformSelfCapability(node) ? [node.key] : []

export function platformSubtreeKeysOf(node: PlatformPermissionNode): string[] {
  return [...platformSelfKeysOf(node), ...node.children.flatMap(platformSubtreeKeysOf)]
}

/** 某个存储标识所代表的能力集合（目录级 = 整棵子树；菜单 / 页面级 = 自身） */
export function expandPlatformGrantKey(key: string): string[] {
  const node = getPlatformPermissionNode(key)
  if (!node) return []
  return isPlatformCollapsible(node) ? platformSubtreeKeysOf(node) : [node.key]
}

/** 字典中的全部可授权能力（面板可勾选项全集） */
export const ALL_PLATFORM_CAPABILITY_KEYS: string[] = PLATFORM_PERMISSION_TREE.flatMap(
  platformSubtreeKeysOf,
)

const PLATFORM_PERMISSION_PARENT: Record<string, string> = (() => {
  const map: Record<string, string> = {}
  const walk = (nodes: PlatformPermissionNode[], parent: string | null) => {
    nodes.forEach((node) => {
      if (parent) map[node.key] = parent
      walk(node.children, node.key)
    })
  }
  walk(PLATFORM_PERMISSION_TREE, null)
  return map
})()

export function getPlatformAncestorKeys(key: string): string[] {
  const ancestors: string[] = []
  let cursor = PLATFORM_PERMISSION_PARENT[key]
  while (cursor) {
    ancestors.push(cursor)
    cursor = PLATFORM_PERMISSION_PARENT[cursor]
  }
  return ancestors
}

/** 节点到根的层级路径（用于只读展示） */
export function platformPermissionPathText(key: string): string {
  const path: string[] = []
  const walk = (nodes: PlatformPermissionNode[], trail: string[]): boolean =>
    nodes.some((node) => {
      const next = [...trail, node.name]
      if (node.key === key) {
        path.push(...next)
        return true
      }
      return walk(node.children, next)
    })
  walk(PLATFORM_PERMISSION_TREE, [])
  return path.length ? path.join(' / ') : key
}
