/**
 * 【原型说明】负荷策略模块的演示数据容器与版本迁移，仅用于原型演示。
 * 数据存于 localStorage；正式实现应为服务端存储与真实的调度 / 指令下发通道。
 *
 * 设备档案与用能单元取自「设备台账」与「组织架构」的演示数据容器，本模块不重复维护。
 */

import { reactive } from 'vue'
import { readJSON, removeKeys, writeJSON } from '@/shared/utils/storage'
import { createPresetBatches, createPresetLatches, createPresetStrategies } from '../mock/seed'
import {
  STRATEGY_ALL_KEYS,
  STRATEGY_BATCH_KEY,
  STRATEGY_DATA_VERSION,
  STRATEGY_LATCH_KEY,
  STRATEGY_LIST_KEY,
  STRATEGY_LOG_KEY,
  STRATEGY_VERSION_KEY,
} from './constants'
import type { ExecBatch, LatchState, Strategy, StrategyChangeLog } from './types'

/** 演示数据结构升级时清理旧数据，避免历史结构格式不一致 */
function migrateStrategyData() {
  if (localStorage.getItem(STRATEGY_VERSION_KEY) === STRATEGY_DATA_VERSION) return
  removeKeys(STRATEGY_ALL_KEYS)
  localStorage.setItem(STRATEGY_VERSION_KEY, STRATEGY_DATA_VERSION)
}

migrateStrategyData()

export const strategies = reactive<Strategy[]>(readJSON(STRATEGY_LIST_KEY, createPresetStrategies()))
export const execBatches = reactive<ExecBatch[]>(readJSON(STRATEGY_BATCH_KEY, createPresetBatches()))
export const latches = reactive<LatchState[]>(readJSON(STRATEGY_LATCH_KEY, createPresetLatches()))
export const strategyLogs = reactive<StrategyChangeLog[]>(readJSON(STRATEGY_LOG_KEY, []))

export function persistStrategies() {
  writeJSON(STRATEGY_LIST_KEY, strategies)
}

export function persistExecBatches() {
  writeJSON(STRATEGY_BATCH_KEY, execBatches)
}

export function persistLatches() {
  writeJSON(STRATEGY_LATCH_KEY, latches)
}

export function persistStrategyLogs() {
  writeJSON(STRATEGY_LOG_KEY, strategyLogs)
}

/** 【原型说明】把负荷策略恢复为初始演示数据，并清空变更记录 */
export function resetStrategyData() {
  strategies.splice(0, strategies.length, ...createPresetStrategies())
  execBatches.splice(0, execBatches.length, ...createPresetBatches())
  latches.splice(0, latches.length, ...createPresetLatches())
  strategyLogs.splice(0, strategyLogs.length)
  persistStrategies()
  persistExecBatches()
  persistLatches()
  persistStrategyLogs()
}
