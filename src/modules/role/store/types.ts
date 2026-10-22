/**
 * 【原型说明】角色管理模块的数据结构定义，仅用于原型交互验证。
 * 信息项对齐《产品需求文档-角色管理》v1.0 与《产品交互设计文档-角色管理》v1.0，
 * 不涉及数据库表、字段类型或接口设计。
 */

/** 角色来源：系统预置 / 平台默认 / 企业自定义 */
export type RoleSource = 'preset' | 'default' | 'custom'

/**
 * 角色：一组权限点的集合。
 * 集合中记录的是「已授权的权限节点标识」，节点可位于任意层级（一级菜单 / 页面 / 操作），
 * 因此角色既能只配一个一级菜单，也能精确到某个操作按钮（PRD F-ROL-02）。
 */
export interface Role {
  id: string
  name: string
  desc: string
  source: RoleSource
  /** 已授权的权限节点标识集合（收敛态，见 role.ts 的 collapsePermissions） */
  permissions: string[]
  createdAt: number
}

export type RoleChangeType = '新增角色' | '重命名' | '删除角色' | '权限配置'

/** 【原型说明】角色与权限变更记录，对应 PRD F-ROL-09（正式查看入口为「系统管理 › 系统日志」） */
export interface RoleChangeLog {
  id: string
  at: number
  account: string
  type: RoleChangeType
  /** 目标角色名称 */
  roleName: string
  detail: string
}

/**
 * 权限节点层级。层级由节点在导航中的位置决定，而不是由树的深度决定：
 * - `dir` 目录级：一级导航栏内的项，作为分组容器；若无下级菜单，则它自身即页面（如「工作台」）
 * - `menu` 菜单级：二级及更深菜单栏内的项。若其下没有下级菜单，则自身即一个可进入的页面（如「企业成员」）；
 *   若其下还有下级菜单（如「设备用电管控」），则自身无页面、仅承载下级菜单。两者同属菜单级。
 * - `action` 按钮级：页面内的具体操作，最小颗粒度
 */
export type PermissionLevel = 'dir' | 'menu' | 'action'

/**
 * 权限节点：树形结构，每一级都是可独立授权的权限点。
 * - 勾选某节点即授权该节点及其全部下级（整块授权）
 * - 取消下级即在上级授权的基础上做细化
 * - 菜单级节点自带「可进入该页面」语义，因此不再单列「查看」类权限点
 * - children 为空表示叶节点
 */
export interface PermissionNode {
  key: string
  name: string
  level: PermissionLevel
  children: PermissionNode[]
}

export interface RoleInput {
  name: string
  desc: string
}
