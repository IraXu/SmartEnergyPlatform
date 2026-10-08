/**
 * 【原型说明】认证模块的演示数据容器与版本迁移。
 * 所有数据存于 localStorage，仅用于原型演示。
 */

import { reactive } from 'vue'
import { PRESET_ACCOUNTS, type PrototypeAccount } from '@/modules/auth/mock/seed'
import { readJSON, removeKeys, writeJSON } from '@/shared/utils/storage'
import {
  ACCOUNTS_KEY,
  ALL_STORAGE_KEYS,
  CODE_KEY,
  DATA_VERSION,
  LOCK_KEY,
  RECENT_ORG_KEY,
  REMEMBER_ORG_KEY,
  SESSION_KEY,
  VERSION_KEY,
} from './constants'
import type { CodeRecord, LockState, RecentOrgRecord, SessionState } from './types'

/** 演示数据结构升级时清理旧数据，避免历史账号标识格式不一致导致校验异常 */
function migratePrototypeData() {
  if (localStorage.getItem(VERSION_KEY) === DATA_VERSION) return
  removeKeys(ALL_STORAGE_KEYS)
  localStorage.setItem(VERSION_KEY, DATA_VERSION)
}

migratePrototypeData()

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * 【原型演示数据】为多企业预置账号补一条「最近登录企业」记录，
 * 使「选择登录企业」页首次进入即能看到「最近登录」标签与默认选中效果。
 * 该记录不写入「记住选择」，因此本页仍会正常展示（自动进入只由记住选择驱动）。
 */
const PRESET_RECENT_ORGS: Record<string, RecentOrgRecord> = {
  '+8613800138000': { orgId: 'ORG-1002', at: Date.now() - DAY_MS },
}

/** 重置演示数据时把「最近登录」记录恢复为预置值，保证走查可复现「最近登录」标签 */
export function presetRecentOrgs(): Record<string, RecentOrgRecord> {
  return { ...PRESET_RECENT_ORGS, '+8613800138000': { orgId: 'ORG-1002', at: Date.now() - DAY_MS } }
}

/** 原型内账号池：预置账号 + 演示过程中新注册的账号 */
export const accounts = reactive<PrototypeAccount[]>(readJSON(ACCOUNTS_KEY, PRESET_ACCOUNTS))
export const lockMap = reactive<Record<string, LockState>>(readJSON(LOCK_KEY, {}))
export const codeMap = reactive<Record<string, CodeRecord>>(readJSON(CODE_KEY, {}))

/**
 * 【原型说明】各账号的最近登录企业记录，key 为账号标识。
 * 核心定义：最近登录 = 该账号最近一次「成功选择某企业并进入系统」的时间。
 * 每次成功进入都会更新，用于「选择登录企业」页打「最近登录」标签与默认选中。
 */
export const recentOrgMap = reactive<Record<string, RecentOrgRecord>>(
  readJSON(RECENT_ORG_KEY, PRESET_RECENT_ORGS),
)

/**
 * 【原型说明】各账号「记住选择」的企业，key 为账号标识。
 * 仅在选择页勾选「记住选择」并进入时写入，是下次登录自动进入的唯一依据。
 * 与「最近登录」拆开：这样未勾选时仍会展示选择页，也才能看到「最近登录」标签。
 */
export const rememberedOrgMap = reactive<Record<string, string>>(readJSON(REMEMBER_ORG_KEY, {}))

export const session = reactive<{ current: SessionState | null }>({
  current: readJSON<SessionState | null>(SESSION_KEY, null),
})

export function persistAccounts() {
  writeJSON(ACCOUNTS_KEY, accounts)
}

export function persistLocks() {
  writeJSON(LOCK_KEY, lockMap)
}

export function persistCodes() {
  writeJSON(CODE_KEY, codeMap)
}

export function persistRecentOrgs() {
  writeJSON(RECENT_ORG_KEY, recentOrgMap)
}

export function persistRememberedOrgs() {
  writeJSON(REMEMBER_ORG_KEY, rememberedOrgMap)
}

export function persistSession() {
  writeJSON(SESSION_KEY, session.current)
}
