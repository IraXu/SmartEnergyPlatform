/**
 * 【原型说明】组织架构模块的数据结构定义，仅用于原型交互验证。
 * 信息项对齐《产品需求文档-组织架构》v1.0 与《产品交互设计文档-组织架构》v1.0，
 * 不涉及数据库表、字段类型或接口设计。
 *
 * 节点负责人所选成员的数据结构见 `@/modules/member/store/types` 的 Member。
 */

/** 节点类型：企业根节点 / 组织节点 / 用能单元 */
export type NodeKind = 'root' | 'org' | 'unit'

export interface OrgNode {
  id: string
  parentId: string | null
  name: string
  kind: NodeKind
  /** 同级顺序，值越小越靠前 */
  order: number
  /** 节点负责人，取自本企业成员（成员数据来自企业成员模块）；为空表示未指定 */
  ownerId: string | null
  /** 详细地址，手动填写 */
  address: string
  /** GPS 经度，由地图选点自动填入；为空表示未选点 */
  lng: number | null
  /** GPS 纬度，由地图选点自动填入；为空表示未选点 */
  lat: number | null
  /** 用能单元编码，仅用能单元有值；创建时按规则自动生成 */
  unitCode: string
  remark: string
  createdAt: number
}

export type ChangeType = '新增下级' | '重命名' | '移动' | '同级排序' | '删除' | '属性编辑'

/** 【原型说明】结构与属性变更记录，对应 PRD F-ORG-09（正式查看入口为「系统管理 › 系统日志」） */
export interface OrgChangeLog {
  id: string
  at: number
  account: string
  type: ChangeType
  /** 节点层级路径 */
  path: string
  detail: string
}

export interface NodeAttrsInput {
  ownerId: string | null
  address: string
  lng: number | null
  lat: number | null
  remark: string
}

export interface NodeCreateInput extends NodeAttrsInput {
  parentId: string
  name: string
  kind: Exclude<NodeKind, 'root'>
}

/** 用能单元列表行：用于右侧「当前节点的用能单元」表格 */
export interface UnitRow {
  id: string
  name: string
  unitCode: string
  /** GPS 坐标展示文本，未选点时显示占位符 */
  coordinate: string
  /** 所属组织节点的完整层级路径（不含自身） */
  orgPath: string
}

/**
 * 【权限】当前账号在组织架构页可执行的操作集合，由页面按权限点推导（PRD 5.3 / 角色管理 7.4 权限点字典）。
 * 对应权限点：`system:org`（进入）、`system:org:node:create` / `:rename` / `:move` / `:sort` / `:delete` / `:attr:edit`。
 */
export interface OrgPerms {
  /** 可进入组织架构并查看 */
  view: boolean
  create: boolean
  rename: boolean
  move: boolean
  sort: boolean
  remove: boolean
  editAttr: boolean
}
