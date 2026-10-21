/**
 * 【原型说明】权限点字典，对齐《产品需求文档-角色管理》v1.8 的 7.4 权限点字典（共 50 项）。
 *
 * 【层级模型】权限树的层级与导航一一对应，且深度不受限制：
 * - 目录级（`dir`）：一级导航栏内的项（如「系统管理」）——仅作分组容器；
 *   若它没有下级菜单，则自身即一个页面（如「工作台」）
 * - 菜单级（`menu`）：二级及更深菜单栏内的项（如「企业成员」）——本身即一个可进入的页面；
 *   若其下还有下级菜单（如「设备用电管控」），则自身无页面、仅承载其下级菜单，可继续嵌套
 * - 按钮级（`action`）：页面内的具体操作——最小颗粒度
 *
 * 【查看权限的归属】菜单节点自带「可进入该页面」语义，因此不再单列「查看」类权限点。
 * 勾选任一按钮时会自动补齐其所属菜单的进入能力，保证「能用按钮 = 能进入该页面」。
 *
 * 【存储语义】授权集合（收敛态）中每个标识的含义唯一，不存在歧义：
 * - 目录级标识（如 `system`）＝ 整块授权该目录下全部功能
 * - 菜单级标识（如 `system:member`）＝ 仅「可进入该页面」，不含其下任何按钮
 * - 按钮级标识（如 `system:member:create`）＝ 该操作
 * 因此只有「整目录」会被折叠为目录标识；「整菜单」会保存为菜单标识 + 其下全部按钮标识，
 * 这样「只读进入页面」与「整块授权页面」两种配置能够被区分开。
 *
 * 【标识命名】路径式：按导航路径逐段拼接，末段为动作，父子关系可用「前缀 + 冒号」直接判定。
 * - 目录：`system`
 * - 菜单：`system:member`
 * - 按钮：`system:member:create`
 * - 多级菜单只是路径多一段：`system:log:operation:export`
 *
 * 权限点由系统定义，企业不可新增或改名；后续模块定稿时在此追加。
 */

import type { PermissionNode } from '../store/types'

/** 按钮级节点的构造助手：减少字典中的重复字面量 */
function action(key: string, name: string): PermissionNode {
  return { key, name, level: 'action', children: [] }
}

/** 菜单级节点的构造助手 */
function menu(key: string, name: string, children: PermissionNode[]): PermissionNode {
  return { key, name, level: 'menu', children }
}

export const PERMISSION_TREE: PermissionNode[] = [
  {
    // 一级导航栏内的项，无下级菜单 → 自身即页面
    key: 'dashboard',
    name: '工作台',
    level: 'dir',
    children: [],
  },
  {
    /**
     * 一级导航栏内的项，无下级菜单 → 自身即页面。
     * 点位地图为**只读空间视图**，具备进入权限即完整可用全部只读能力，
     * 故只登记目录级权限点、不设按钮级权限点。
     */
    key: 'location',
    name: '点位地图',
    level: 'dir',
    children: [],
  },
  {
    /**
     * 一级导航栏内的项，无下级菜单 → 自身即页面。
     * 其下直接挂按钮级权限点：「查看/进入告警中心」由 `alarm` 自身承载，
     * 导出与删除则是最小颗粒度的按钮级权限。
     */
    key: 'alarm',
    name: '告警中心',
    level: 'dir',
    children: [
      action('alarm:export', '导出告警'),
      action('alarm:delete', '删除告警'),
    ],
  },
  {
    // 一级导航栏内的项，含下级菜单 → 纯分组容器
    key: 'device',
    name: '设备管理',
    level: 'dir',
    children: [
      menu('device:ledger', '设备台账', [
        action('device:ledger:create', '新增设备'),
        action('device:ledger:import', '批量添加设备'),
        action('device:ledger:importdelete', '批量删除设备'),
        action('device:ledger:edit', '编辑设备'),
        action('device:ledger:move', '迁移设备'),
        action('device:ledger:delete', '删除设备'),
        /**
         * 设备控制：弹窗入口本身不设权限点（入口常显，便于随时查看设备可用能力），
         * 5 个指令各自独立授权，最小颗粒度落到指令级——
         * 例如只授予「分闸」即可让一线人员停电而不具备送电能力。
         */
        action('device:ledger:control:timesync', '设备控制 · 校时'),
        action('device:ledger:control:meterread', '设备控制 · 抄表'),
        action('device:ledger:control:switchon', '设备控制 · 合闸'),
        action('device:ledger:control:switchoff', '设备控制 · 分闸'),
        action('device:ledger:control:reconnect', '设备控制 · 重连'),
        action('device:ledger:control:powerclear', '设备控制 · 电量清零'),
        action('device:ledger:control:eventclear', '设备控制 · 设备事件清零'),
        action('device:ledger:param', '设备参数配置'),
        // MQTT 通讯日志为只读；「查看」随设备台账菜单进入能力，导出单独授权
        action('device:ledger:mqtt:export', '导出 MQTT 通讯日志'),
      ]),
      menu('device:ota', '设备OTA', [
        action('device:ota:detect', '检测设备升级'),
        action('device:ota:upgrade', '设备OTA升级'),
        action('device:ota:content', '查看升级内容'),
        action('device:ota:record', '查看升级进度与记录'),
      ]),
      /**
       * 设备用电管控：含三级菜单的二级分组，自身无页面（纯分组容器），
       * 勾选它即整块授权其下全部子功能，便于后续「远程控制」「费控账务」按同一容器扩充。
       * 三级菜单即「负荷策略」页面，其下挂 5 个按钮级权限点。
       */
      menu('device:power', '设备用电管控', [
        menu('device:power:strategy', '负荷策略', [
          action('device:power:strategy:create', '新建策略'),
          action('device:power:strategy:edit', '编辑策略'),
          action('device:power:strategy:toggle', '启用/停用策略'),
          action('device:power:strategy:delete', '删除策略'),
          action('device:power:strategy:record', '查看执行记录'),
        ]),
      ]),
    ],
  },
  {
    key: 'system',
    name: '系统管理',
    level: 'dir',
    children: [
      menu('system:org', '组织架构', [
        action('system:org:node:create', '新增下级节点'),
        action('system:org:node:rename', '重命名节点'),
        action('system:org:node:move', '移动节点'),
        action('system:org:node:sort', '同级排序'),
        action('system:org:node:delete', '删除节点'),
        action('system:org:node:attr:edit', '编辑节点属性'),
      ]),
      menu('system:member', '企业成员', [
        action('system:member:create', '新增成员'),
        action('system:member:edit', '编辑成员'),
        action('system:member:role:assign', '分配角色'),
        action('system:member:scope:bind', '绑定数据范围'),
        action('system:member:toggle', '启停用成员'),
        action('system:member:password:reset', '重置密码'),
        action('system:member:delete', '删除成员'),
      ]),
      menu('system:role', '角色管理', [
        action('system:role:create', '新增角色'),
        action('system:role:edit', '编辑角色'),
        action('system:role:delete', '删除角色'),
        action('system:role:permission:config', '配置角色权限'),
      ]),
      menu('system:enterprise', '企业中心', [
        action('system:enterprise:profile:edit', '编辑企业档案与企业 Logo'),
        action('system:enterprise:contact:edit', '维护企业联系人'),
        action('system:enterprise:qualification:edit', '维护企业资质信息'),
      ]),
      /**
       * 系统日志为**只读视图**：两类日志的**查看共用菜单级标识 `system:log`**
       * （不按日志类型拆分查看权限），**导出按日志类型拆分为两个独立按钮级权限点**；
       * 本菜单不设新增 / 编辑 / 删除类权限点。
       */
      menu('system:log', '系统日志', [
        action('system:log:login:export', '导出登录日志'),
        action('system:log:operation:export', '导出操作行为日志'),
      ]),
    ],
  },
]

/** 深度优先展开全部节点（含目录级与菜单级） */
function flatten(nodes: PermissionNode[]): PermissionNode[] {
  return nodes.flatMap((node) => [node, ...flatten(node.children)])
}

export const ALL_PERMISSION_NODES: PermissionNode[] = flatten(PERMISSION_TREE)

/** 字典中的全部权限节点标识（含目录级与菜单级） */
export const ALL_PERMISSION_KEYS: string[] = ALL_PERMISSION_NODES.map((node) => node.key)

/** 按标识定位节点 */
export const getPermissionNode = (key: string): PermissionNode | null =>
  ALL_PERMISSION_NODES.find((node) => node.key === key) ?? null

/**
 * 节点下是否还有菜单。这是区分「分组容器」与「页面」的唯一依据，
 * 而不是节点挂在哪一级导航——因为一级导航项也可能直接就是页面（如「工作台」「告警中心」）：
 * - 有下级菜单：该节点是纯分组容器（如「系统管理」），自身没有页面，勾选它代表整块授权
 * - 无下级菜单（其下只有按钮，或完全没有下级）：该节点自身即页面，自带「可进入」能力
 */
export function hasMenuChildren(node: PermissionNode): boolean {
  return node.children.some((child) => child.level === 'menu')
}

/**
 * 节点自身是否是一个独立能力（可作为最小授权单元被单独勾选）：
 * 自身即页面的节点（无下级菜单）都带有「可进入该页面」语义，因此都是能力。
 */
export function isSelfCapability(node: PermissionNode): boolean {
  return !hasMenuChildren(node)
}

/** 纯分组容器（有下级菜单）：勾选它代表整块授权，因此可被折叠为自身标识 */
export const isCollapsible = (node: PermissionNode) => hasMenuChildren(node)

/** 节点自身单独构成的能力（不含下级）；目录级含下级时为空 */
export const selfCapabilityKeysOf = (node: PermissionNode): string[] =>
  isSelfCapability(node) ? [node.key] : []

/** 节点子树的全部能力标识（自身能力 + 其下全部能力） */
export function subtreeCapabilityKeysOf(node: PermissionNode): string[] {
  return [...selfCapabilityKeysOf(node), ...node.children.flatMap(subtreeCapabilityKeysOf)]
}

/**
 * 某个存储标识所代表的能力集合：
 * - 目录级标识代表整棵子树（勾「系统管理」即获得其下全部功能）
 * - 菜单级标识只代表「可进入该页面」，其下按钮必须单独存储
 * - 按钮级标识即该操作
 * 这一区分是「只读进入页面」与「整块授权页面」能被分开表达的前提。
 */
export function expandGrantKey(key: string): string[] {
  const node = getPermissionNode(key)
  if (!node) return []
  return isCollapsible(node) ? subtreeCapabilityKeysOf(node) : [node.key]
}

/**
 * 字典中的全部可授权能力：面板上每个可勾选项对应一项。
 * = 各按钮 + 各菜单的「可进入」能力 + 无下级的目录自身。用于「已选 N / M 项」统计与差异比对。
 */
export const ALL_CAPABILITY_KEYS: string[] = PERMISSION_TREE.flatMap(subtreeCapabilityKeysOf)

/** 节点的全部下级节点标识（不含自身） */
export const getDescendantKeys = (key: string): string[] => {
  const node = getPermissionNode(key)
  if (!node) return []
  return flatten(node.children).map((item) => item.key)
}

/** 节点与其全部下级（含自身） */
export const getSubtreeKeys = (key: string): string[] => {
  const node = getPermissionNode(key)
  return node ? [node.key, ...getDescendantKeys(key)] : []
}

/** 节点 → 父节点标识：由字典结构一次性推导，用于判断权限归属与继承 */
const PERMISSION_PARENT: Record<string, string> = (() => {
  const map: Record<string, string> = {}
  const walk = (nodes: PermissionNode[], parent: string | null) => {
    nodes.forEach((node) => {
      if (parent) map[node.key] = parent
      walk(node.children, node.key)
    })
  }
  walk(PERMISSION_TREE, null)
  return map
})()

/** 节点到根的全部上级节点标识（不含自身），由近及远 */
export function getAncestorKeys(key: string): string[] {
  const ancestors: string[] = []
  let cursor = PERMISSION_PARENT[key]
  while (cursor) {
    ancestors.push(cursor)
    cursor = PERMISSION_PARENT[cursor]
  }
  return ancestors
}

/** 节点到根的层级路径（用于差异清单等只读展示） */
export function permissionPathText(key: string): string {
  const path: string[] = []
  const walk = (nodes: PermissionNode[], trail: string[]): boolean =>
    nodes.some((node) => {
      const next = [...trail, node.name]
      if (node.key === key) {
        path.push(...next)
        return true
      }
      return walk(node.children, next)
    })
  walk(PERMISSION_TREE, [])
  return path.length ? path.join(' / ') : key
}

/** 权限点名称，用于日志与差异清单 */
export function permissionName(key: string): string {
  return getPermissionNode(key)?.name ?? key
}
