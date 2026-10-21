/**
 * 【原型说明】工作台的数据聚合与演示数据，仅用于原型交互验证，非生产代码。
 *
 * 工作台为**只读看板**：全部指标与清单均由已定稿模块的演示数据派生，
 * 本模块**不维护独立数据容器**，也不写入任何业务数据。
 * 业务规则对齐《产品需求文档-工作台》v0.3 与《产品交互设计文档-工作台》v0.4。
 */

import { alarms } from '@/modules/alarm/store'
import type { Alarm } from '@/modules/alarm/store'
import { session } from '@/modules/auth/store'
import { devices } from '@/modules/device/store'
import { memberList } from '@/modules/member/store'
import { nodes } from '@/modules/org/store'
import { allRows as otaRows } from '@/modules/ota/store'
import { execBatches } from '@/modules/power/store'
import { roleList } from '@/modules/role/store'

/* ---------- 时间口径 ---------- */

/** 今日 00:00 的时间戳：工作台「今日」类口径的统一起点 */
export function todayStart() {
  const date = new Date()
  date.setHours(0, 0, 0, 0)
  return date.getTime()
}

/* ---------- 核心指标统计面板（六项，按当前企业口径） ---------- */

export interface WorkbenchMetrics {
  /** 设备总数：本企业在册设备总数 */
  deviceTotal: number
  /** 在线设备数：与平台建连且在线 */
  deviceOnline: number
  /** 离线设备数 */
  deviceOffline: number
  /** 在线率：在线 / 总数，无设备时为 null（展示占位符） */
  onlineRate: number | null
  /** 今日告警数：当日 00:00 起 */
  todayAlarms: number
  /** 可升级设备数：新固件标识为「有新固件」的设备台数 */
  upgradableDevices: number
  /** 今日策略执行次数：当日 00:00 起负荷策略执行批次次数 */
  todayExecutions: number
}

export function workbenchMetrics(): WorkbenchMetrics {
  const start = todayStart()
  const online = devices.filter((device) => device.onlineStatus === '在线').length
  const upgradable = otaRows().filter((row) => row.firmwareState === '有新固件').length
  const executions = execBatches.filter((batch) => batch.at >= start).length
  return {
    deviceTotal: devices.length,
    deviceOnline: online,
    deviceOffline: devices.length - online,
    onlineRate: devices.length > 0 ? (online / devices.length) * 100 : null,
    todayAlarms: alarms.filter((alarm) => alarm.reportAt >= start).length,
    upgradableDevices: upgradable,
    todayExecutions: executions,
  }
}

/* ---------- 最新告警（当日实时清单） ---------- */

/** 工作台告警区展示上限（PRD Q-WB-02：10 条、动态覆盖） */
export const LATEST_ALARM_LIMIT = 10

/** 当日告警：按告警时间倒序，取前 N 条 */
export function latestAlarms(): Alarm[] {
  const start = todayStart()
  return alarms
    .filter((alarm) => alarm.reportAt >= start)
    .sort((a, b) => b.reportAt - a.reportAt)
    .slice(0, LATEST_ALARM_LIMIT)
}

/**
 * 【原型演示】构造一条「实时推送」告警：以现有当日告警为样板克隆，更新时间与事件类型。
 * 真实实现为订阅告警通知推送通道；原型内用于演示「收到推送即插入顶部并高亮」。
 */
const PUSH_EVENT_TYPES = ['A相过压', '过温', 'C相过流', '开表盖']

export function buildPushedAlarm(base: Alarm, seq: number): Alarm {
  return {
    ...base,
    id: `ALM-PUSH-${Date.now()}-${seq}`,
    eventType: PUSH_EVENT_TYPES[seq % PUSH_EVENT_TYPES.length],
    content: '【实时推送】设备上报告警，已即时进入本清单',
    reportAt: Date.now(),
  }
}

/* ---------- 平台使用引导（固定四步，按本企业实际数据判定完成态） ---------- */

export type OnboardingKey = 'org' | 'role' | 'member' | 'device'

export interface OnboardingStep {
  key: OnboardingKey
  /** 步骤序号（1 起） */
  index: number
  /** 步骤名称 */
  title: string
  /** 一句动作说明 */
  desc: string
  /** 跳转路由 */
  route: string
  /** 是否已完成（按本企业实际数据判定） */
  done: boolean
}

/**
 * 引导四步及完成判定（PRD F-WB-03）：
 * - 新建组织架构：存在组织节点（不含企业根节点）
 * - 新建角色：存在企业自建角色（source 为 custom，非系统预置）
 * - 新建成员：存在成员账号（不含当前登录账号本人）
 * - 添加设备：设备台账存在在册设备
 */
export function onboardingSteps(): OnboardingStep[] {
  const hasOrg = nodes.some((node) => node.kind !== 'root')
  const hasCustomRole = roleList.some((role) => role.source === 'custom')
  const currentIdentifier = session.current?.identifier ?? ''
  const hasMember = memberList.some((member) => member.identifier !== currentIdentifier)
  const hasDevice = devices.length > 0
  return [
    {
      key: 'org',
      index: 1,
      title: '新建组织架构',
      desc: '搭建企业层级与用能单元',
      route: '/system/org-structure',
      done: hasOrg,
    },
    {
      key: 'role',
      index: 2,
      title: '新建角色',
      desc: '为不同岗位配置权限',
      route: '/system/roles',
      done: hasCustomRole,
    },
    {
      key: 'member',
      index: 3,
      title: '新建成员',
      desc: '邀请成员并分配角色',
      route: '/system/members',
      done: hasMember,
    },
    {
      key: 'device',
      index: 4,
      title: '添加设备',
      desc: '录入设备并完成接入',
      route: '/device/ledger',
      done: hasDevice,
    },
  ]
}

/* ---------- 未开工模块占位（Q-WB-04：逐块替换；碳排管理已取消） ---------- */

export interface PlaceholderModule {
  name: string
  desc: string
}

export const PLACEHOLDER_MODULES: PlaceholderModule[] = [
  { name: '能耗数据采集与监测', desc: '采集并监测各用能单元的实时能耗数据' },
  { name: '能源分析与报表', desc: '对历史用能数据做分析并生成报表' },
  { name: '运维工单', desc: '告警转工单、派单与处理闭环' },
]
