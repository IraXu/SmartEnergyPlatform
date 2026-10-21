<!--
  【原型说明】用能排名行展开内容：展示该对象下（含下级用能单元）的计量设备与本期用电量。
  总表在设备名称后以「总表」标签标识；设备操作可进入历史曲线与告警。
-->
<template>
  <div class="ana-drill">
    <div class="ana-drill__title">
      设备明细 · {{ record.name }}（含下级用能单元）
    </div>
    <a-table
      :columns="drillColumns"
      :data-source="rows"
      :pagination="false"
      size="small"
      row-key="key"
    >
      <template #bodyCell="{ column, record: drill }">
        <template v-if="column.key === 'name'">
          <span class="ana-cell__name">{{ drill.name }}</span>
          <a-tag v-if="drill.role === '总表'" class="ana-cell__tag ana-cell__tag--total">总表</a-tag>
        </template>
        <template v-else-if="column.key === 'unitPath'">
          <span class="ana-cell__path" :title="drill.unitPath">{{ drill.unitPath }}</span>
        </template>
        <template v-else-if="column.key === 'license'">
          <span class="ana-code">{{ drill.license }}</span>
        </template>
        <template v-else-if="column.key === 'imei'">
          <span class="ana-code">{{ drill.imei }}</span>
        </template>
        <template v-else-if="column.key === 'value'">
          <span class="ana-num">{{ fmt(drill.value) }} kWh</span>
        </template>
        <template v-else-if="column.key === 'action'">
          <span class="ana-cell__actions">
            <a-button type="link" size="small" @click="goCurve(drill)">查看历史曲线</a-button>
            <a-button type="link" size="small" @click="goAlarm(drill)">查看告警</a-button>
          </span>
        </template>
      </template>
    </a-table>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import type { TableColumnsType } from 'antdv-next'
import { meters, units } from '../store'
import type { RankRow } from '../store/types'

const props = defineProps<{ record: RankRow }>()

const router = useRouter()
const unitMap = new Map(units.map((unit) => [unit.id, unit]))

interface DrillRow {
  key: string
  name: string
  unitPath: string
  license: string
  imei: string
  role: string
  value: number
}

/** childId 是否等于 ancestorId 或位于其下级 */
function isWithinUnit(childId: string, ancestorId: string): boolean {
  let cursor = unitMap.get(childId)
  while (cursor) {
    if (cursor.id === ancestorId) return true
    cursor = cursor.parentId ? unitMap.get(cursor.parentId) : undefined
  }
  return false
}

/** 所属用能单元完整路径：企业 / 组织节点 / … / 用能单元 */
function unitPathOf(unitId: string): string {
  const names: string[] = []
  let cursor = unitMap.get(unitId)
  while (cursor) {
    names.unshift(cursor.name)
    cursor = cursor.parentId ? unitMap.get(cursor.parentId) : undefined
  }
  return names.join(' / ')
}

/** 该对象及其下级用能单元的计量设备（不含网关） */
const rows = computed<DrillRow[]>(() => {
  const list = meters.filter(
    (meter) => !meter.isGateway && isWithinUnit(meter.unitId, props.record.unitId),
  )
  if (!list.length) return []
  const base = Math.floor(props.record.current / list.length)
  return list.map((meter, index) => ({
    key: meter.id,
    name: meter.name,
    unitPath: unitPathOf(meter.unitId),
    license: meter.license,
    imei: meter.imei,
    role: meter.role,
    value: index === list.length - 1 ? props.record.current - base * (list.length - 1) : base,
  }))
})

const drillColumns: TableColumnsType<DrillRow> = [
  { title: '设备名称', key: 'name', width: 190 },
  { title: '所属用能单元', key: 'unitPath', width: 250 },
  { title: 'License', key: 'license', width: 165 },
  { title: 'IMEI', key: 'imei', width: 135 },
  { title: '用电量（kWh）', key: 'value', align: 'right', width: 110 },
  { title: '操作', key: 'action', align: 'right', width: 170 },
]

function fmt(value: number): string {
  return Math.round(value).toLocaleString('en-US')
}

function goCurve(record: DrillRow) {
  router.push({ path: '/energy/monitor', query: { from: '用能分析', object: record.name } })
}

function goAlarm(record: DrillRow) {
  router.push({ path: '/alarm/center', query: { from: '用能分析', meter: record.name } })
}
</script>

<style scoped>
.ana-drill {
  padding: 12px 16px;
  background: #f8fbfa;
  border-radius: 8px;
}

.ana-drill__title {
  margin-bottom: 8px;
  font-size: 13px;
  color: rgba(0, 0, 0, 0.65);
}

.ana-num {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12px;
}

.ana-code {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12px;
  color: rgba(0, 0, 0, 0.65);
}

.ana-cell__actions {
  display: inline-flex;
  gap: 8px;
  justify-content: flex-end;
  white-space: nowrap;
}

.ana-cell__name {
  color: rgba(0, 0, 0, 0.88);
}

.ana-cell__path {
  display: block;
  font-size: 12px;
  line-height: 18px;
  color: rgba(0, 0, 0, 0.55);
  white-space: normal;
  word-break: break-word;
}

.ana-cell__tag {
  margin-left: 8px;
  font-size: 12px;
}

.ana-cell__tag--total {
  color: #0f7b6c;
  background: #e9f4f1;
  border-color: #d5ebe5;
}
</style>
