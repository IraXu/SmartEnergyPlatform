<!--
  【原型说明】客户&设备列表的「列设置」浮层：调整列的显示与顺序。
  - 核心列（所属企业、设备名称）常驻显示，勾选框禁用
  - 固定列（所属企业、所属用能单元、设备名称锁定左侧）不参与拖动
  - 其余列可拖动排序、可勾选隐藏；隐藏操作不改变列的顺序
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
            v-for="column in orderedPlatformColumnMetas"
            :key="column.key"
            class="devcols__item"
            :class="{
              'is-dragging': dragKey === column.key,
              'is-target': dropKey === column.key && dragKey !== column.key,
            }"
            :draggable="!isPlatformFixedColumn(column.key)"
            @dragstart="handleDragStart(column.key, $event)"
            @dragover.prevent="handleDragOver(column.key)"
            @drop.prevent="handleDrop(column.key)"
            @dragend="handleDragEnd"
          >
            <span class="devcols__handle" :class="{ 'is-locked': isPlatformFixedColumn(column.key) }">
              <HolderOutlined v-if="!isPlatformFixedColumn(column.key)" />
              <LockOutlined v-else />
            </span>
            <a-checkbox
              class="devcols__check"
              :checked="isPlatformColumnVisible(column.key)"
              :disabled="isPlatformFixedColumn(column.key) || isPlatformCoreColumn(column.key)"
              @change="(event: { target: { checked: boolean } }) => setPlatformColumnVisible(column.key, event.target.checked)"
            >
              {{ column.title }}
            </a-checkbox>
            <span v-if="isPlatformFixedColumn(column.key)" class="devcols__tag">左固定</span>
            <span v-else-if="isPlatformCoreColumn(column.key)" class="devcols__tag">核心</span>
          </li>
        </ul>

        <p class="devcols__note">核心列与固定列不可隐藏；固定列锁定在表格左侧，不参与拖动</p>
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
  isPlatformColumnVisible,
  isPlatformCoreColumn,
  isPlatformFixedColumn,
  movePlatformColumn,
  orderedPlatformColumnMetas,
  resetPlatformColumnPrefs,
  setPlatformColumnVisible,
} from '../store'

const open = ref(false)
const dragKey = ref<string | null>(null)
const dropKey = ref<string | null>(null)

function handleDragStart(key: string, event: DragEvent) {
  if (isPlatformFixedColumn(key)) return
  dragKey.value = key
  dropKey.value = null
  event.dataTransfer?.setData('text/plain', key)
}

function handleDragOver(key: string) {
  if (!dragKey.value || dragKey.value === key) return
  dropKey.value = key
}

function handleDrop(key: string) {
  if (dragKey.value) movePlatformColumn(dragKey.value, key)
  handleDragEnd()
}

function handleDragEnd() {
  dragKey.value = null
  dropKey.value = null
}

function handleReset() {
  resetPlatformColumnPrefs()
}
</script>
