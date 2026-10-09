/**
 * 【原型说明】组织架构模块的演示数据，仅用于原型交互验证。
 * 结构与文案贴近《产品需求文档-组织架构》v1.0 的页面信息项与业务规则，
 * 不涉及真实客户数据、接口或数据库设计。
 *
 * 节点负责人所选成员统一来自「系统管理 › 企业成员」的演示数据
 * （见 `@/modules/member/mock/seed`），本文件不再维护成员清单。
 */

import type { OrgNode } from '../store/types'

/** 节点 id 前缀，便于在演示数据中一眼辨识层级 */
const ROOT_ID = 'NODE-ROOT'

/** 【原型演示数据】西部园区（第三个园区）：1 个园区 + 3 个厂房，每个厂房下 4 个用能单元 */
export const BULK_PARK_ID = 'NODE-P3'

/** 厂房与其下属用能单元：单元按现场用途命名，并自带该单元下的设备名称 */
const BULK_PLAN = [
  {
    building: '1 号厂房',
    units: [
      { name: '注塑车间', devices: ['注塑车间接入网关', '注塑机主回路配电表'] },
      { name: '模具车间', devices: ['模具车间接入网关', 'CNC 加工中心组计量表'] },
      { name: '装配车间', devices: ['装配车间接入网关', '装配线动力配电表'] },
      { name: '空压机房', devices: ['空压机房接入网关', '1 号空压机计量表'] },
    ],
  },
  {
    building: '2 号厂房',
    units: [
      { name: '焊装车间', devices: ['焊装车间接入网关', '焊接机器人配电表'] },
      { name: '涂装车间', devices: ['涂装车间接入网关', '喷涂线动力配电表'] },
      { name: '总装车间', devices: ['总装车间接入网关', '总装线动力配电表'] },
      { name: '动力配电房', devices: ['动力配电房接入网关', '2 号厂房进线总表'] },
    ],
  },
  {
    building: '3 号厂房',
    units: [
      { name: '冲压车间', devices: ['冲压车间接入网关', '冲压机主回路配电表'] },
      { name: '热处理车间', devices: ['热处理车间接入网关', '热处理炉计量表'] },
      { name: '原材料库', devices: ['原材料库接入网关', '原材料库照明计量表'] },
      { name: '成品库', devices: ['成品库接入网关', '成品库照明计量表'] },
    ],
  },
] as const

const BULK_UNITS_PER_BUILDING = 4

const BULK_BUILDINGS: string[] = BULK_PLAN.map((item) => item.building)

export interface BulkUnit {
  id: string
  /** 所属厂房的节点 id */
  parentId: string
  /** 所属厂房名称，用于拼装设备安装位置等展示文案 */
  buildingName: string
  name: string
  /** 用能单元编码 */
  code: string
  /** 该单元下的设备名称：第 1 台为网关，第 2 台为计量表计 */
  deviceNames: readonly string[]
}

/**
 * 【原型演示数据】西部园区的 12 个用能单元、24 台设备。
 * 用途：单元数与设备数均刚好超过单页（各 10 条一页），
 * 用于验证负荷策略列表计数、策略详情与作用对象抽屉的分页与折叠收口是否正常。
 */
export const BULK_UNITS: BulkUnit[] = BULK_PLAN.flatMap((item, buildingIndex) =>
  item.units.map((unit, unitIndex) => ({
    id: `NODE-P3-B${buildingIndex + 1}-U${unitIndex + 1}`,
    parentId: `NODE-P3-B${buildingIndex + 1}`,
    buildingName: item.building,
    name: unit.name,
    code: `UNIT-XB-${buildingIndex + 1}0${unitIndex + 1}`,
    deviceNames: unit.devices,
  })),
)

/** 坐标保留 6 位小数：直接相加会产生浮点误差（如 30.572499999999998） */
const coord = (value: number) => Number(value.toFixed(6))

/**
 * 【原型演示数据】生成初始组织架构：企业根节点 + 两个园区 + 建筑 + 用能单元。
 * 根节点名称取当前登录企业的名称（对齐「根节点由企业注册信息自动生成」的规则）。
 * 用能单元自带编码与详细位置，供右侧「用能单元」列表展示。
 */
export function createPresetNodes(rootName: string): OrgNode[] {
  const base = Date.now() - 3 * 24 * 60 * 60 * 1000
  const rows: Array<Omit<OrgNode, 'createdAt'> & { createdAt?: number }> = [
    {
      id: ROOT_ID,
      parentId: null,
      name: rootName,
      kind: 'root',
      order: 0,
      ownerId: 'MEM-01',
      address: '广东省深圳市南山区科技园示例路 100 号',
      lng: 113.9432,
      lat: 22.5331,
      unitCode: '',
      remark: '企业根节点由注册信息自动生成，名称不可修改',
    },
    {
      id: 'NODE-P1',
      parentId: ROOT_ID,
      name: '华南园区',
      kind: 'org',
      order: 0,
      ownerId: 'MEM-05',
      address: '广东省深圳市宝安区示例工业路 8 号',
      lng: 113.8831,
      lat: 22.5646,
      unitCode: '',
      remark: '含 2 栋厂房与 1 个配电房',
    },
    {
      id: 'NODE-P1-B1',
      parentId: 'NODE-P1',
      name: 'A 栋',
      kind: 'org',
      order: 0,
      ownerId: 'MEM-05',
      address: '华南园区内东侧',
      lng: 113.8845,
      lat: 22.5652,
      unitCode: '',
      remark: '一层为生产车间，二层为办公区',
    },
    {
      id: 'NODE-P1-B1-U1',
      parentId: 'NODE-P1-B1',
      name: '1 号车间',
      kind: 'unit',
      order: 0,
      ownerId: 'MEM-04',
      address: 'A 栋一层东侧，1 号门进入后直行 30 米',
      lng: 113.8847,
      lat: 22.5654,
      unitCode: 'UNIT-HN-A-001',
      remark: '空压机与注塑机主要用能点',
    },
    {
      id: 'NODE-P1-B1-U2',
      parentId: 'NODE-P1-B1',
      name: '2 号车间',
      kind: 'unit',
      order: 1,
      ownerId: null,
      address: 'A 栋一层西侧，2 号门进入',
      lng: 113.8849,
      lat: 22.5658,
      unitCode: 'UNIT-HN-A-002',
      remark: '',
    },
    {
      id: 'NODE-P1-B2',
      parentId: 'NODE-P1',
      name: 'B 栋',
      kind: 'org',
      order: 1,
      ownerId: null,
      address: '华南园区内西侧',
      lng: 113.8816,
      lat: 22.5641,
      unitCode: '',
      remark: '',
    },
    {
      id: 'NODE-P1-B2-U1',
      parentId: 'NODE-P1-B2',
      name: '中央空调机房',
      kind: 'unit',
      order: 0,
      ownerId: 'MEM-02',
      address: 'B 栋地下一层制冷机房',
      lng: 113.8814,
      lat: 22.5639,
      unitCode: 'UNIT-HN-B-001',
      remark: '全园区集中供冷',
    },
    {
      id: 'NODE-P1-B2-U2',
      parentId: 'NODE-P1-B2',
      name: '二次供水泵房',
      kind: 'unit',
      order: 1,
      ownerId: null,
      address: 'B 栋地下一层水泵房',
      lng: 113.8818,
      lat: 22.5643,
      unitCode: 'UNIT-HN-B-002',
      // 【演示】该用能单元不在任何负荷策略的作用范围内，用于验证「设备不关联负荷策略」的展示
      remark: '生活供水加压，暂未纳入负荷策略管控',
    },
    {
      id: 'NODE-P2',
      parentId: ROOT_ID,
      name: '华东园区',
      kind: 'org',
      order: 1,
      ownerId: 'MEM-03',
      address: '浙江省杭州市余杭区示例产业园 3 号',
      lng: 120.0432,
      lat: 30.2815,
      unitCode: '',
      remark: '在建，预计下季度投产',
    },
    {
      id: 'NODE-P2-U1',
      parentId: 'NODE-P2',
      name: '总配电房',
      kind: 'unit',
      order: 0,
      ownerId: null,
      address: '园区北侧独立配电房',
      lng: 120.0435,
      lat: 30.2818,
      unitCode: 'UNIT-HD-001',
      remark: '',
    },
  ]

  // 西部园区：1 个园区 + 3 个厂房 + 6 个用能单元，用于验证超出单页时的策略作用对象展示
  rows.push({
    id: BULK_PARK_ID,
    parentId: ROOT_ID,
    name: '西部园区',
    kind: 'org',
    order: 2,
    ownerId: 'MEM-02',
    address: '四川省成都市高新区示例大道 66 号',
    lng: 104.0665,
    lat: 30.5723,
    unitCode: '',
    remark: '含 3 个厂房与 6 个车间级用能单元',
  })
  BULK_BUILDINGS.forEach((building, index) => {
    rows.push({
      id: `NODE-P3-B${index + 1}`,
      parentId: BULK_PARK_ID,
      name: building,
      kind: 'org',
      order: index,
      ownerId: null,
      address: `西部园区${index + 1} 号厂房`,
      lng: coord(104.0665 + index * 0.0004),
      lat: coord(30.5723 + index * 0.0003),
      unitCode: '',
      remark: '',
    })
  })
  BULK_UNITS.forEach((unit, index) => {
    const unitIndex = index % BULK_UNITS_PER_BUILDING
    rows.push({
      id: unit.id,
      parentId: unit.parentId,
      name: unit.name,
      kind: 'unit',
      order: unitIndex,
      ownerId: null,
      address: `${unit.buildingName}内`,
      lng: coord(104.0665 + Math.floor(index / BULK_UNITS_PER_BUILDING) * 0.0004),
      lat: coord(30.5723 + unitIndex * 0.0001),
      unitCode: unit.code,
      remark: '',
    })
  })

  return rows.map((row, index) => ({ ...row, createdAt: base + index * 60 * 1000 }))
}

export { ROOT_ID }
