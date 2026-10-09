<!--
  【原型说明】设备台账列表的「列设置」浮层：调整列的显示与顺序。
  - 核心列（设备名称）常驻显示，勾选框禁用
  - 固定列（所属用能单元与设备名称锁定左侧、操作列锁定右侧）不参与拖动
  - 其余列（含 License、设备识别码（IMEI））可拖动排序、可勾选隐藏；隐藏操作不改变列的顺序
-->
<template>
  <a-popover v-model:open="open" trigger="click" placement="bottomRight" :arrow="false">
    <template #content>
      <div class="devcols">
        <div class="devcols__head">
          <span class="devcols__title">列设置</span>
          <a-button type="link" size="small" @click="handleReset">恢复默认</a-button>
        </div>

        <ul class="devcols__list">
          <li
            v-for="column in orderedColumnMetas"
            :key="column.key"
            class="devcols__item"
            :class="{
              'is-fixed': isFixedColumn(column.key),
              'is-dragging': dragKey === column.key,
              'is-target': dropKey === column.key && dragKey !== column.key,
            }"
            :draggable="!isFixedColumn(column.key)"
            @dragstart="handleDragStart(column.key, $event)"
            @dragover.prevent="handleDragOver(column.key)"
            @drop.prevent="handleDrop(column.key)"
            @dragend="handleDragEnd"
          >
            <span class="devcols__handle" :class="{ 'is-locked': isFixedColumn(column.key) }">
              <HolderOutlined v-if="!isFixedColumn(column.key)" />
              <LockOutlined v-else />
            </span>
            <a-checkbox
              class="devcols__check"
              :checked="isColumnVisible(column.key)"
              :disabled="isFixedColumn(column.key) || isCoreColumn(column.key)"
              @change="(event: { target: { checked: boolean } }) => setColumnVisible(column.key, event.target.checked)"
            >
              {{ column.title }}
            </a-checkbox>
            <span v-if="isFixedColumn(column.key)" class="devcols__tag">
              {{ column.fixed === 'start' ? '左固定' : '右固定' }}
            </span>
            <span v-else-if="isCoreColumn(column.key)" class="devcols__tag">核心</span>
          </li>
        </ul>

        <p class="devcols__note">核心列与固定列不可隐藏；固定列锁定在表格两端，不参与拖动</p>
      </div>
    </template>
    <a-button size="small">
      <template #icon><SettingOutlined /></template>
      列设置
    </a-button>
  </a-popover>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { HolderOutlined, LockOutlined, SettingOutlined } from '@antdv-next/icons'
import {
  isColumnVisible,
  isCoreColumn,
  isFixedColumn,
  moveColumn,
  orderedColumnMetas,
  resetColumnPrefs,
  setColumnVisible,
} from '../store'

const open = ref(false)
const dragKey = ref<string | null>(null)
const dropKey = ref<string | null>(null)

function handleDragStart(key: string, event: DragEvent) {
  if (isFixedColumn(key)) return
  dragKey.value = key
  dropKey.value = null
  // 部分浏览器要求设置 dataTransfer 才会触发后续 drag 事件
  event.dataTransfer?.setData('text/plain', key)
}

function handleDragOver(key: string) {
  if (!dragKey.value || dragKey.value === key) return
  dropKey.value = key
}

function handleDrop(key: string) {
  if (dragKey.value) moveColumn(dragKey.value, key)
  handleDragEnd()
}

function handleDragEnd() {
  dragKey.value = null
  dropKey.value = null
}

function handleReset() {
  resetColumnPrefs()
}
</script>
