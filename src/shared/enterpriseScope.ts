/**
 * 【原型说明】企业级演示数据隔离，仅用于原型交互验证，非生产代码。
 *
 * 真实系统中组织架构、角色、成员、设备、告警、设备OTA 与负荷策略均按企业维度隔离；
 * 本模块把这层隔离补进原型：不同企业使用各自的数据容器，
 * **新注册企业以「未初始化」呈现**（空组织 / 仅预置角色 / 仅本人成员 / 无设备），
 * 使工作台的平台使用引导自然显示为「四步未完成」；已预置演示数据的企业保持「已初始化」。
 *
 * 触发时机：路由守卫（进入企业端页面时）与顶栏切换企业处调用 `applyEnterpriseScope()`；
 * 以 localStorage 记录「当前数据容器所属企业」，据此判断是否需要重新装载。
 */

import { hasEnteredOrg, session } from '@/modules/auth/store'
import {
  ROOT_ID,
  logs as orgLogs,
  nodes,
  persistLogs as persistOrgLogs,
  persistNodes,
  resetOrgData,
} from '@/modules/org/store'
import { createPresetNodes } from '@/modules/org/mock/seed'
import { PRESET_ROLES } from '@/modules/role/mock/seed'
import {
  PRESET_ROLE_ID,
  persistRoleLogs,
  persistRoles,
  resetRoleData,
  roleList,
  roleLogs,
} from '@/modules/role/store'
import {
  memberList,
  memberLogs,
  persistMemberLogs,
  persistMembers,
  resetMemberData,
} from '@/modules/member/store'
import type { Member } from '@/modules/member/store'
import {
  devices,
  logs as deviceLogs,
  mqttLogs,
  persistDevices,
  persistLogs as persistDeviceLogs,
  persistMqttLogs,
  persistSessions,
  resetDeviceLedgerData,
  sessions,
} from '@/modules/device/store'
import {
  alarms,
  logs as alarmLogs,
  persistAlarms,
  persistLogs as persistAlarmLogs,
  resetAlarmData,
} from '@/modules/alarm/store'
import {
  otaLogs,
  otaStates,
  otaTasks,
  persistOtaLogs,
  persistOtaStates,
  persistOtaTasks,
  resetOtaDemoData,
} from '@/modules/ota/store'
import {
  execBatches,
  latches,
  persistExecBatches,
  persistLatches,
  persistStrategies,
  persistStrategyLogs,
  resetStrategyData,
  strategies,
  strategyLogs,
} from '@/modules/power/store'

/** 【原型说明】记录「当前数据容器所属企业」的存储键 */
const SCOPE_ORG_KEY = 'proto_enterprise_scope_org'

/**
 * 【原型说明】记录「当前数据容器播种日期」的存储键。
 * 演示数据包含「今日」口径（今日告警数 / 最新告警 / 今日策略执行次数等），
 * 且以绝对时间戳持久化；跨天后旧数据会落在「今日」范围之外，导致工作台与
 * 告警中心的「今日」视图为空（表现为「一个告警都没有」）。故跨天须重新播种演示数据。
 */
const SCOPE_DAY_KEY = 'proto_enterprise_scope_day'

/** 当天标识（按本地时区，YYYY-MM-DD） */
function todayKey() {
  const date = new Date()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

/** 【原型说明】已带完整演示数据的预置企业；其余企业视为新注册、按未初始化装载 */
const PRESET_ORG_IDS = new Set(['ORG-1001', 'ORG-1002', 'ORG-1003', 'ORG-1004', 'ORG-1005', 'ORG-9001'])

const isPresetOrg = (orgId: string) => PRESET_ORG_IDS.has(orgId)

/** 【原型说明】按企业上下文装载演示数据；企业与日期均未变化时跳过（`force` 强制重载） */
export function applyEnterpriseScope(force = false) {
  if (!hasEnteredOrg()) return
  const orgId = session.current?.orgId ?? ''
  if (!orgId) return
  const sameScope = localStorage.getItem(SCOPE_ORG_KEY) === orgId
  const sameDay = localStorage.getItem(SCOPE_DAY_KEY) === todayKey()
  if (!force && sameScope && sameDay) return

  if (isPresetOrg(orgId)) seedPresetEnterprise()
  else seedFreshEnterprise()

  localStorage.setItem(SCOPE_ORG_KEY, orgId)
  localStorage.setItem(SCOPE_DAY_KEY, todayKey())
}

/** 预置企业：装载完整演示数据（沿用各模块既有的重置 / 播种逻辑） */
function seedPresetEnterprise() {
  resetOrgData()
  resetRoleData()
  resetMemberData()
  resetDeviceLedgerData()
  resetAlarmData()
  resetOtaDemoData()
  resetStrategyData()
}

/** 新注册企业：装载「未初始化」数据集 */
function seedFreshEnterprise() {
  const current = session.current
  const orgName = current?.orgName || '未命名企业'

  // 组织架构：仅保留企业根节点（名称取当前企业名）
  nodes.splice(0, nodes.length, ...createPresetNodes(orgName).filter((node) => node.kind === 'root'))
  orgLogs.splice(0, orgLogs.length)
  persistNodes()
  persistOrgLogs()

  // 角色：仅保留系统预置角色（企业超级管理员）
  roleList.splice(
    0,
    roleList.length,
    ...PRESET_ROLES.filter((role) => role.source === 'preset').map((role) => ({
      ...role,
      permissions: [...role.permissions],
    })),
  )
  roleLogs.splice(0, roleLogs.length)
  persistRoles()
  persistRoleLogs()

  // 成员：仅当前注册账号本人，绑定预置角色、数据范围为根节点
  const self: Member = {
    id: 'MEM-01',
    name: current?.contactName || '企业管理员',
    accountType: current?.accountType ?? 'phone',
    identifier: current?.identifier ?? '',
    countryCode: current?.countryCode ?? '',
    roleIds: [PRESET_ROLE_ID],
    scopeIds: [ROOT_ID],
    status: 'normal',
    mustChangePassword: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
  memberList.splice(0, memberList.length, self)
  memberLogs.splice(0, memberLogs.length)
  persistMembers()
  persistMemberLogs()

  // 设备与派生数据：全部为空
  devices.splice(0, devices.length)
  deviceLogs.splice(0, deviceLogs.length)
  mqttLogs.splice(0, mqttLogs.length)
  sessions.splice(0, sessions.length)
  persistDevices()
  persistDeviceLogs()
  persistMqttLogs()
  persistSessions()

  alarms.splice(0, alarms.length)
  alarmLogs.splice(0, alarmLogs.length)
  persistAlarms()
  persistAlarmLogs()

  otaStates.splice(0, otaStates.length)
  otaTasks.splice(0, otaTasks.length)
  otaLogs.splice(0, otaLogs.length)
  persistOtaStates()
  persistOtaTasks()
  persistOtaLogs()

  strategies.splice(0, strategies.length)
  execBatches.splice(0, execBatches.length)
  latches.splice(0, latches.length)
  strategyLogs.splice(0, strategyLogs.length)
  persistStrategies()
  persistExecBatches()
  persistLatches()
  persistStrategyLogs()
}
