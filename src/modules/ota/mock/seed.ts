/**
 * 【原型说明】设备管理 › 设备OTA 模块的演示数据，仅用于原型交互验证。
 * 固件基线为平台运营方维护的演示数据，不代表真实固件发布通道；
 * 设备与设备类型取自「设备管理 › 设备台账」的演示数据，本模块不重复维护设备档案。
 */

import type { FirmwareBaseline, OtaState, UpgradeTask } from '../store/types'

/**
 * 【原型演示数据】固件基线：按「设备类型 + 规格型号」匹配设备可用的固件版本。
 * 版本号按 V{主}.{次}.{修订} 递增；更新说明为条目化纯文本。
 */
export const FIRMWARE_BASELINES: FirmwareBaseline[] = [
  {
    type: '三相智能电表',
    model: 'DTZ341-3×220/380V',
    releases: [
      {
        version: 'V1.4.0',
        releasedAt: '2026-03-18',
        size: '2.1 MB',
        notes: ['优化计量精度校准流程', '修复偶发通信重连问题'],
      },
      {
        version: 'V1.4.2',
        releasedAt: '2026-06-10',
        size: '2.3 MB',
        notes: ['修复 A 相电压采集偶发跳变', '提升 Modbus 转发稳定性'],
      },
      {
        version: 'V1.4.5',
        releasedAt: '2026-09-20',
        size: '2.4 MB',
        notes: [
          '修复 C 相过压事件误报问题',
          '优化通信稳定性，降低弱信号环境下的丢包率',
          '新增本地事件缓存，断网恢复后自动补传',
          '调整需量计算周期，与现场抄见口径一致',
        ],
      },
    ],
  },
  {
    type: '智能电表',
    model: 'DDS341-220V',
    releases: [
      {
        version: 'V2.1.0',
        releasedAt: '2026-04-02',
        size: '1.6 MB',
        notes: ['优化单相电量计量算法', '修复清零后首次抄读异常'],
      },
      {
        version: 'V2.1.3',
        releasedAt: '2026-08-28',
        size: '1.8 MB',
        notes: ['修复高温环境下时钟走时偏差', '提升 NB-IoT 入网成功率'],
      },
    ],
  },
  {
    type: '智能网关',
    model: 'GW-200',
    releases: [
      {
        version: 'V3.0.1',
        releasedAt: '2026-05-12',
        size: '6.8 MB',
        notes: ['新增多规约并发转发能力', '优化下行采集任务调度'],
      },
      {
        version: 'V3.2.0',
        releasedAt: '2026-09-15',
        size: '7.4 MB',
        notes: [
          '新增本地边缘缓存，断网期间数据不丢失',
          '提升带载能力，单网关上限制提升至 64 台表计',
          '修复长时间运行后内存占用缓慢增长',
        ],
      },
    ],
  },
]

/**
 * 【原型演示数据】设备维度的固件与升级状态。
 * 设备标识与「设备台账」演示数据一一对应（DEV-0001 ~ DEV-0009）。
 * 未在清单中的设备（后续新增 / 导入）由 store 按规则惰性初始化。
 */
export const PRESET_OTA_STATES: Array<Omit<OtaState, 'detectedAt' | 'lastUpgradedAt'>> = [
  // DEV-0001 三相智能电表：有新固件（V1.4.2 < V1.4.5）
  {
    deviceId: 'DEV-0001',
    currentVersion: 'V1.4.2',
    upgradeStatus: '未升级',
    progress: 0,
    failReason: '',
    taskId: null,
  },
  // DEV-0002 三相智能电表（离线）：有新固件，用于演示升级失败路径
  {
    deviceId: 'DEV-0002',
    currentVersion: 'V1.4.2',
    upgradeStatus: '未升级',
    progress: 0,
    failReason: '',
    taskId: null,
  },
  // DEV-0003 三相智能电表：已是最新
  {
    deviceId: 'DEV-0003',
    currentVersion: 'V1.4.5',
    upgradeStatus: '未升级',
    progress: 0,
    failReason: '',
    taskId: null,
  },
  // DEV-0004 智能电表：有新固件，且最近一次升级失败
  {
    deviceId: 'DEV-0004',
    currentVersion: 'V2.1.0',
    upgradeStatus: '升级失败',
    progress: 0,
    failReason: '设备离线或通信失败',
    taskId: 'OTA-20260926-0001',
  },
  // DEV-0005 待接入：无固件信息
  {
    deviceId: 'DEV-0005',
    currentVersion: '',
    upgradeStatus: '未升级',
    progress: 0,
    failReason: '',
    taskId: null,
  },
  // DEV-0006 智能网关：有新固件
  {
    deviceId: 'DEV-0006',
    currentVersion: 'V3.0.1',
    upgradeStatus: '未升级',
    progress: 0,
    failReason: '',
    taskId: null,
  },
  // DEV-0007 智能网关（离线）：已是最新
  {
    deviceId: 'DEV-0007',
    currentVersion: 'V3.2.0',
    upgradeStatus: '升级成功',
    progress: 100,
    failReason: '',
    taskId: 'OTA-20260918-0001',
  },
  // DEV-0008 智能电表：已是最新，且历史上已升级成功（对应历史任务 OTA-20260926-0001）
  {
    deviceId: 'DEV-0008',
    currentVersion: 'V2.1.3',
    upgradeStatus: '升级成功',
    progress: 100,
    failReason: '',
    taskId: 'OTA-20260926-0001',
  },
  // DEV-0009 待接入：无固件信息
  {
    deviceId: 'DEV-0009',
    currentVersion: '',
    upgradeStatus: '未升级',
    progress: 0,
    failReason: '',
    taskId: null,
  },
]

/** 生成初始 OTA 状态：补充检测时间与升级时间，使演示数据的时间始终「新鲜」 */
export function createPresetOtaStates(): OtaState[] {
  const DAY = 24 * 60 * 60 * 1000
  return PRESET_OTA_STATES.map((item) => ({
    ...item,
    detectedAt: item.currentVersion ? Date.now() - 2 * DAY : null,
    lastUpgradedAt: item.upgradeStatus === '升级成功' || item.upgradeStatus === '升级失败'
      ? Date.now() - 8 * DAY
      : null,
  }))
}

/**
 * 【原型演示数据】历史升级任务（已进入终态）。
 * 每个任务含成功 / 失败 / 已跳过的设备，用于演示「升级进度与记录」中的历史任务与失败原因。
 * deviceId 与设备台账演示数据一一对应。
 */
export function createPresetTasks(): UpgradeTask[] {
  const DAY = 24 * 60 * 60 * 1000
  return [
    {
      id: 'OTA-20260926-0001',
      targetVersions: ['V2.1.0'],
      account: '吕建成',
      createdAt: Date.now() - 2 * DAY,
      // 部分失败：1 台失败（离线）、1 台成功
      status: '部分失败',
      devices: [
        {
          deviceId: 'DEV-0004',
          deviceName: '华东园区总配电表',
          deviceImei: '864512030001004',
          fromVersion: 'V2.1.0',
          toVersion: 'V2.1.3',
          progress: 100,
          status: '升级失败',
          failReason: '设备离线或通信失败',
          willFail: true,
        },
        {
          deviceId: 'DEV-0008',
          deviceName: 'A 栋照明分表',
          deviceImei: '864512031001001',
          fromVersion: 'V2.1.0',
          toVersion: 'V2.1.3',
          progress: 100,
          status: '升级成功',
          failReason: '',
          willFail: false,
        },
      ],
    },
    {
      id: 'OTA-20260918-0001',
      targetVersions: ['V3.2.0'],
      account: '徐志诚',
      createdAt: Date.now() - 10 * DAY,
      // 已完成：1 台成功、1 台跳过（已是最新）
      status: '已完成',
      devices: [
        {
          deviceId: 'DEV-0007',
          deviceName: '华东园区接入网关',
          deviceImei: '864512039001002',
          fromVersion: 'V3.0.1',
          toVersion: 'V3.2.0',
          progress: 100,
          status: '升级成功',
          failReason: '',
          willFail: false,
        },
        {
          deviceId: 'DEV-0003',
          deviceName: '中央空调机房总表',
          deviceImei: '864512030001003',
          fromVersion: 'V1.4.5',
          toVersion: 'V1.4.5',
          progress: 100,
          status: '已跳过',
          failReason: '已是最新版本',
          willFail: false,
        },
      ],
    },
  ]
}
