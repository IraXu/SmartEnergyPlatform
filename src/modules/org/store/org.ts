/**
 * 【原型说明】组织架构的结构与属性维护逻辑，仅用于原型交互验证。
 * 业务规则对齐《产品需求文档-组织架构》v1.0：
 * - 根节点（企业）在本页完全只读：不可重命名、不可移动、不可删除
 * - 组织节点下可继续新增；用能单元为叶子节点，不可新增下级
 * - 层级不限，单企业节点数上限 500；节点名称同级唯一
 * - 有子节点不可删除；不提供级联删除
 * - 所有结构与属性变更写入变更记录（对应 F-ORG-09）
 */

import { session } from '@/modules/auth/store'
import { maskIdentifier } from '@/shared/utils/mask'
// 成员数据统一来自企业成员模块，避免组织架构模块单独维护一份成员清单
import {
  memberName as memberNameFromStore,
  memberOptions as memberOptionsFromStore,
} from '@/modules/member/store/member'
import {
  ADDRESS_MAX,
  NAME_MAX,
  NAME_MIN,
  NODE_LIMIT,
  REMARK_MAX,
  SEARCH_MAX,
} from './constants'
import { logs, nodes, persistLogs, persistNodes } from './storage'
import type { ChangeType, NodeAttrsInput, NodeCreateInput, OrgNode, UnitRow } from './types'

/* ---------- 通用 ---------- */

/** 【原型说明】模拟异步保存耗时，无真实接口调用 */
function delay(ms = 320) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms)
  })
}

/** 当前操作账号展示名，用于变更记录 */
function currentOperator() {
  const current = session.current
  if (!current) return '未知账号'
  return current.contactName || maskIdentifier(current.identifier)
}

/** 输入内容按纯文本处理：去除首尾空格，仅空格视为未填写 */
export function normalizeText(value: string) {
  return value.replace(/\s+/g, ' ').trim()
}

/* ---------- 查询 ---------- */

const siblingsOf = (parentId: string | null) =>
  nodes.filter((node) => node.parentId === parentId).sort((a, b) => a.order - b.order)

export const getRoot = () => nodes.find((node) => node.kind === 'root') ?? null

export const getNode = (id: string) => nodes.find((node) => node.id === id) ?? null

/** 节点所在同级的全部节点（按同级顺序排列），用于排序按钮的可用性判断 */
export const getSiblings = (id: string) => {
  const node = getNode(id)
  return node ? siblingsOf(node.parentId) : []
}

/** 节点及全部子孙，用于移动时的不可选范围与删除校验 */
export function getSubtreeIds(id: string): string[] {
  const result: string[] = [id]
  const walk = (parentId: string) => {
    siblingsOf(parentId).forEach((child) => {
      result.push(child.id)
      walk(child.id)
    })
  }
  walk(id)
  return result
}

/** 层级路径：由根节点到当前节点 */
export function getPath(id: string): OrgNode[] {
  const path: OrgNode[] = []
  let cursor = getNode(id)
  while (cursor) {
    path.unshift(cursor)
    cursor = cursor.parentId ? getNode(cursor.parentId) : null
  }
  return path
}

export const getPathText = (id: string) => getPath(id).map((node) => node.name).join(' / ')

/** 下级节点数量（仅直接下级） */
export const getChildCount = (id: string) => nodes.filter((node) => node.parentId === id).length

/**
 * 当前节点及其全部下级的用能单元列表（含深层下级），用于右侧「用能单元」表格。
 * 所选节点本身为用能单元时，仅返回自身。
 */
export function getUnitRows(id: string): UnitRow[] {
  return getSubtreeIds(id)
    .map((nodeId) => getNode(nodeId))
    .filter((node): node is OrgNode => !!node && node.kind === 'unit')
    .map((node) => ({
      id: node.id,
      name: node.name,
      unitCode: node.unitCode || '—',
      coordinate: hasCoordinate(node.lng, node.lat) ? `${node.lng}, ${node.lat}` : '—',
      // 所属组织节点的完整层级路径，不含用能单元自身
      orgPath: node.parentId ? getPathText(node.parentId) : '—',
    }))
}

export const isLimitReached = () => nodes.length >= NODE_LIMIT

/* ---------- 成员选择器 ---------- */

/**
 * 成员选择器选项，供节点负责人选择（PRD Q-ORG-02：成员选择器、选填）。
 * 【原型说明】成员数据统一来自「系统管理 › 企业成员」的演示容器，
 * 保证跨模块同一人在两处的展示一致。
 */
export function memberOptions() {
  return memberOptionsFromStore()
}

export const memberName = (ownerId: string | null) => memberNameFromStore(ownerId)

/** 成员选择器的空态判定：企业成员全部停用时视为无可选成员 */
export const hasSelectableMember = () => memberOptionsFromStore().length > 0

/* ---------- 校验 ---------- */

/** 节点名称校验：必填、2-30 字符、同级唯一 */
export function validateName(name: string, parentId: string | null, excludeId?: string): string | null {
  const value = normalizeText(name)
  if (!value) return '请输入节点名称'
  if (value.length < NAME_MIN || value.length > NAME_MAX) return `节点名称需 ${NAME_MIN}-${NAME_MAX} 个字符`
  const duplicated = nodes.some(
    (node) => node.parentId === parentId && node.id !== excludeId && node.name === value,
  )
  if (duplicated) return '同级下已存在同名节点，请修改名称'
  return null
}

export function validateAddress(address: string): string | null {
  return normalizeText(address).length > ADDRESS_MAX ? `最多输入 ${ADDRESS_MAX} 个字符` : null
}

export function validateRemark(remark: string): string | null {
  return normalizeText(remark).length > REMARK_MAX ? `最多输入 ${REMARK_MAX} 个字符` : null
}

/** 经纬度取值范围校验：经度 -180~180，纬度 -90~90 */
export function validateLng(value: number | null): string | null {
  if (value === null || value === undefined) return null
  if (!Number.isFinite(value) || value < -180 || value > 180) return '经度需在 -180 ~ 180 之间'
  return null
}

export function validateLat(value: number | null): string | null {
  if (value === null || value === undefined) return null
  if (!Number.isFinite(value) || value < -90 || value > 90) return '纬度需在 -90 ~ 90 之间'
  return null
}

/** 经纬度成对存在：选点后两者同时有值 */
export const hasCoordinate = (lng: number | null, lat: number | null) => lng !== null && lat !== null

/** GPS 坐标为必填：未选点时给出提示（PRD 走查确认） */
export function validateCoordinate(lng: number | null, lat: number | null): string | null {
  if (!hasCoordinate(lng, lat)) return '请通过地图选点确定 GPS 坐标'
  return validateLng(lng) ?? validateLat(lat)
}

/* ---------- 变更记录（F-ORG-09） ---------- */

/**
 * 【原型说明】记录结构与属性变更，对应 PRD F-ORG-09。
 * 正式实现中该记录写入「系统管理 › 系统日志」，本页不展示独立界面。
 */
function writeLog(type: ChangeType, path: string, detail: string) {
  logs.unshift({
    id: `LOG-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    at: Date.now(),
    account: currentOperator(),
    type,
    path,
    detail,
  })
  if (logs.length > 200) logs.splice(200)
  persistLogs()
}

/* ---------- 结构维护 ---------- */

/** 用能单元编码自动生成：UNIT-{4 位序号}，创建时按当前单元总数递增 */
function nextUnitCode() {
  const used = nodes
    .filter((node) => node.kind === 'unit' && node.unitCode)
    .map((node) => Number(node.unitCode.replace(/\D/g, '').slice(-4)))
    .filter((value) => Number.isFinite(value))
  const max = used.length ? Math.max(...used) : 0
  return `UNIT-${String(max + 1).padStart(4, '0')}`
}

/** 新增下级节点；挂在上级末尾 */
export async function createNode(input: NodeCreateInput): Promise<OrgNode> {
  await delay()
  if (isLimitReached()) throw new Error('节点数量已达上限')
  const parent = getNode(input.parentId)
  if (!parent) throw new Error('上级节点不存在')
  const name = normalizeText(input.name)
  const endOrder = siblingsOf(input.parentId).length
  const node: OrgNode = {
    id: `NODE-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    parentId: input.parentId,
    name,
    kind: input.kind,
    order: endOrder,
    ownerId: input.ownerId,
    address: normalizeText(input.address),
    lng: input.lng,
    lat: input.lat,
    unitCode: input.kind === 'unit' ? nextUnitCode() : '',
    remark: normalizeText(input.remark),
    createdAt: Date.now(),
  }
  nodes.push(node)
  persistNodes()
  writeLog('新增下级', getPathText(node.id), `新增${input.kind === 'unit' ? '用能单元' : '组织节点'}「${name}」`)
  return node
}

/** 重命名节点；根节点不支持（PRD Q-ORG-01） */
export async function renameNode(id: string, name: string): Promise<void> {
  await delay()
  const node = getNode(id)
  if (!node) throw new Error('节点不存在')
  if (node.kind === 'root') throw new Error('根节点名称不可修改')
  const before = node.name
  node.name = normalizeText(name)
  persistNodes()
  writeLog('重命名', getPathText(id), `名称由「${before}」改为「${node.name}」`)
}

/**
 * 移动节点（连同其下级）到目标上级下；
 * 目标上级不能是节点自身或其子孙节点（PRD F-ORG-05）。
 */
export async function moveNode(id: string, targetParentId: string): Promise<void> {
  await delay()
  const node = getNode(id)
  const target = getNode(targetParentId)
  if (!node || !target) throw new Error('节点不存在')
  if (node.kind === 'root') throw new Error('根节点不可移动')
  if (getSubtreeIds(id).includes(targetParentId)) throw new Error('不能移动到自身或其下级节点下')
  if (target.kind === 'unit') throw new Error('用能单元不能作为目标上级')

  const fromPath = getPathText(node.id)
  const duplicate = validateName(node.name, targetParentId, node.id)
  if (duplicate) throw new Error('目标层级下已存在同名节点，请先重命名')

  node.parentId = targetParentId
  node.order = siblingsOf(targetParentId).filter((item) => item.id !== id).length
  persistNodes()
  writeLog('移动', getPathText(node.id), `由「${fromPath}」移动至「${getPathText(targetParentId)}」`)
}

/** 同级排序：与相邻兄弟节点交换顺序 */
export async function sortNode(id: string, direction: 'up' | 'down'): Promise<void> {
  const node = getNode(id)
  if (!node) throw new Error('节点不存在')
  const siblings = siblingsOf(node.parentId)
  const index = siblings.findIndex((item) => item.id === id)
  const swapIndex = direction === 'up' ? index - 1 : index + 1
  const target = siblings[swapIndex]
  if (!target) return

  const beforeIndex = index
  // 交换两者的 order，保持同级其余节点顺序不变
  const currentOrder = node.order
  node.order = target.order
  target.order = currentOrder
  // order 出现重复时按当前顺序重排，保证顺序稳定
  const reordered = siblingsOf(node.parentId)
  if (new Set(reordered.map((item) => item.order)).size !== reordered.length) {
    reordered.forEach((item, order) => {
      item.order = order
    })
  }
  persistNodes()
  writeLog(
    '同级排序',
    getPathText(id),
    `${direction === 'up' ? '上移' : '下移'}一位，由第 ${beforeIndex + 1} 位调整至第 ${swapIndex + 1} 位`,
  )
}

/** 删除节点；有下级时不可删除，不提供级联删除（PRD F-ORG-07） */
export async function removeNode(id: string): Promise<void> {
  await delay()
  const node = getNode(id)
  if (!node) throw new Error('节点不存在')
  if (node.kind === 'root') throw new Error('根节点不可删除')
  if (getChildCount(id) > 0) throw new Error('该节点下存在下级节点')

  const path = getPathText(id)
  const index = nodes.findIndex((item) => item.id === id)
  nodes.splice(index, 1)
  persistNodes()
  writeLog('删除', path, `删除节点「${node.name}」`)
}

/** 保存节点属性（负责人、详细地址、GPS 经纬度、备注） */
export async function saveAttributes(id: string, attrs: NodeAttrsInput): Promise<void> {
  await delay()
  const node = getNode(id)
  if (!node) throw new Error('节点不存在')

  const changes: string[] = []
  if (node.ownerId !== attrs.ownerId) {
    changes.push(`负责人由「${memberName(node.ownerId) || '未指定'}」改为「${memberName(attrs.ownerId) || '未指定'}」`)
  }
  if (node.address !== normalizeText(attrs.address)) changes.push('修改了详细地址')
  if (node.lng !== attrs.lng || node.lat !== attrs.lat) {
    const before = hasCoordinate(node.lng, node.lat) ? `${node.lng}, ${node.lat}` : '未选点'
    const after = hasCoordinate(attrs.lng, attrs.lat) ? `${attrs.lng}, ${attrs.lat}` : '未选点'
    changes.push(`GPS 坐标由「${before}」改为「${after}」`)
  }
  if (node.remark !== normalizeText(attrs.remark)) changes.push('修改了备注')

  node.ownerId = attrs.ownerId
  node.address = normalizeText(attrs.address)
  node.lng = attrs.lng
  node.lat = attrs.lat
  node.remark = normalizeText(attrs.remark)
  persistNodes()
  if (changes.length) writeLog('属性编辑', getPathText(id), changes.join('；'))
}

/* ---------- 搜索 ---------- */

export interface SearchHit {
  node: OrgNode
  pathText: string
}

/** 按名称模糊匹配（不区分大小写），命中范围为当前企业全部节点 */
export function searchNodes(keyword: string): SearchHit[] {
  const value = keyword.trim().slice(0, SEARCH_MAX).toLowerCase()
  if (!value) return []
  return nodes
    .filter((node) => node.name.toLowerCase().includes(value))
    .map((node) => ({ node, pathText: getPathText(node.id) }))
}
