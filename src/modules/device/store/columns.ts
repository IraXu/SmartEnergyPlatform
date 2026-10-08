/**
 * 【原型说明】设备台账列表的列元数据与展示偏好，仅用于原型交互验证。
 * - 核心列常驻显示，不支持在「列设置」中隐藏
 * - 固定列锁定在表格两端，不参与拖动排序；其余列均可拖动调整顺序
 * - 偏好保存在 localStorage（仅浏览器本地生效），正式实现应随账号在服务端保存
 */

import { computed, reactive, watch } from 'vue'
import { readJSON, writeJSON } from '@/shared/utils/storage'
import { DEVICE_COLUMN_PREFS_KEY } from './constants'

/** 列表列元数据：key 与表格列一一对应 */
export interface LedgerColumnMeta {
  key: string
  title: string
  /** 列宽（px），同时用于表格 scroll.x 的计算 */
  width: number
  /** 核心列：常驻显示，不允许隐藏 */
  core?: boolean
  /** 固定列：'start' 锁定左侧、'end' 锁定右侧；固定列不参与拖动排序 */
  fixed?: 'start' | 'end'
}

/** 默认列清单与默认顺序（行选择列的 48px 由表格自身提供，不计入本清单） */
export const LEDGER_COLUMNS: LedgerColumnMeta[] = [
  { key: 'name', title: '设备名称', width: 140, core: true, fixed: 'start' },
  { key: 'license', title: 'License', width: 176, core: true },
  { key: 'imei', title: '设备识别码（IMEI）', width: 168, core: true },
  { key: 'cardNo', title: '卡号', width: 168 },
  { key: 'type', title: '设备类型', width: 106 },
  { key: 'model', title: '规格型号', width: 130 },
  { key: 'unit', title: '所属用能单元', width: 180 },
  { key: 'accessStatus', title: '接入状态', width: 96 },
  { key: 'onlineStatus', title: '在线状态', width: 96 },
  { key: 'createdAt', title: '添加时间', width: 132 },
  { key: 'action', title: '操作', width: 130, fixed: 'end' },
]

const columnMap = new Map(LEDGER_COLUMNS.map((column) => [column.key, column]))

export const isCoreColumn = (key: string) => Boolean(columnMap.get(key)?.core)
export const isFixedColumn = (key: string) => Boolean(columnMap.get(key)?.fixed)

/** 列偏好：order 为展示顺序（固定列始终在两端），hidden 为被隐藏的列 */
interface LedgerColumnPrefs {
  order: string[]
  hidden: string[]
}

const defaultPrefs = (): LedgerColumnPrefs => ({
  order: LEDGER_COLUMNS.map((column) => column.key),
  hidden: [],
})

/** 归一化偏好：补全新列、剔除未知列、固定列回到两端、核心列与固定列不允许隐藏 */
function normalizePrefs(raw: Partial<LedgerColumnPrefs> | null): LedgerColumnPrefs {
  const stored = Array.isArray(raw?.order) ? raw.order : []
  const known = stored.filter((key) => columnMap.has(key))
  const missing = LEDGER_COLUMNS.map((column) => column.key).filter((key) => !known.includes(key))
  const all = [...known, ...missing]
  const head = all.filter((key) => columnMap.get(key)?.fixed === 'start')
  const tail = all.filter((key) => columnMap.get(key)?.fixed === 'end')
  const middle = all.filter((key) => !columnMap.get(key)?.fixed)
  const hidden = (Array.isArray(raw?.hidden) ? raw.hidden : []).filter(
    (key) => columnMap.has(key) && !isCoreColumn(key) && !isFixedColumn(key),
  )
  return { order: [...head, ...middle, ...tail], hidden }
}

const prefs = reactive<LedgerColumnPrefs>(normalizePrefs(readJSON(DEVICE_COLUMN_PREFS_KEY, null)))

watch(
  prefs,
  () => writeJSON(DEVICE_COLUMN_PREFS_KEY, { order: prefs.order, hidden: prefs.hidden }),
  { deep: true },
)

/** 当前展示顺序下的全部列（含被隐藏的列，供「列设置」面板列出） */
export const orderedColumnMetas = computed(() => prefs.order.map((key) => columnMap.get(key) as LedgerColumnMeta))

/** 表格实际渲染的列：按展示顺序过滤掉被隐藏的列 */
export const visibleColumnMetas = computed(() => orderedColumnMetas.value.filter((column) => !prefs.hidden.includes(column.key)))

export const isColumnVisible = (key: string) => !prefs.hidden.includes(key)

/** 勾选 / 取消勾选某列；核心列与固定列不允许隐藏 */
export function setColumnVisible(key: string, visible: boolean) {
  if (isCoreColumn(key) || isFixedColumn(key)) return
  const hidden = new Set(prefs.hidden)
  if (visible) hidden.delete(key)
  else hidden.add(key)
  prefs.hidden = Array.from(hidden)
}

/** 拖动排序：把 dragKey 移动到 dropKey 所在位置（仅在非固定列之间生效） */
export function moveColumn(dragKey: string, dropKey: string) {
  if (dragKey === dropKey) return
  if (isFixedColumn(dragKey) || isFixedColumn(dropKey)) return
  const movable = prefs.order.filter((key) => !isFixedColumn(key))
  const from = movable.indexOf(dragKey)
  const to = movable.indexOf(dropKey)
  if (from < 0 || to < 0) return
  movable.splice(to, 0, ...movable.splice(from, 1))
  const head = prefs.order.filter((key) => columnMap.get(key)?.fixed === 'start')
  const tail = prefs.order.filter((key) => columnMap.get(key)?.fixed === 'end')
  prefs.order = [...head, ...movable, ...tail]
}

/** 恢复默认列顺序与全部显示 */
export function resetColumnPrefs() {
  Object.assign(prefs, defaultPrefs())
}
