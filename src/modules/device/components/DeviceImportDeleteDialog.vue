<template>
  <a-modal
    :open="open"
    title="批量导入删除"
    :width="560"
    :mask-closable="!deleting"
    :ok-button-props="{ loading: deleting, danger: true, disabled: !matchCount }"
    ok-text="确认删除"
    cancel-text="取消"
    @ok="handleSubmit"
    @cancel="handleClose"
  >
    <div class="devimpdel">
      <!-- 影响说明：与单条 / 批量删除同一口径，明确不可恢复且不影响历史告警 -->
      <a-alert
        class="devimpdel__alert"
        type="warning"
        show-icon
        message="删除后不可恢复，请确认后再操作。"
      />

      <!-- 步骤 1：下载模板 -->
      <div class="devimpdel__step">
        <p class="devimpdel__step-title">1. 下载模板</p>
        <p class="devimpdel__step-desc">模板仅含 License 一列，按格式填写需要删除的设备</p>
        <a-button @click="handleDownloadTemplate">
          <template #icon><DownloadOutlined /></template>
          下载模板
        </a-button>
      </div>

      <!-- 步骤 2：上传文件 -->
      <div class="devimpdel__step">
        <p class="devimpdel__step-title">2. 上传文件</p>
        <a-upload-dragger
          :file-list="[]"
          :before-upload="handleBeforeUpload"
          :show-upload-list="false"
          :accept="IMPORT_ACCEPT_EXTS.join(',')"
        >
          <p class="devimpdel__upload-icon"><InboxOutlined /></p>
          <p class="devimpdel__upload-text">点击或拖拽文件到此处上传</p>
          <p class="devimpdel__upload-hint">
            仅支持 .xlsx / .xls，大小不超过 {{ IMPORT_FILE_MAX_MB }}MB，单次最多 {{ IMPORT_MAX_ROWS }} 行
          </p>
        </a-upload-dragger>
        <p v-if="fileName" class="devimpdel__file">已选择：{{ fileName }}</p>
      </div>

      <!-- 步骤 3：核对结果 -->
      <div v-if="rows.length" class="devimpdel__step">
        <p class="devimpdel__step-title">3. 核对结果</p>
        <p class="devimpdel__result">
          命中 <strong class="devimpdel__ok">{{ matchCount }}</strong> 条，未命中
          <strong class="devimpdel__skip">{{ missRows.length }}</strong> 条
        </p>

        <div v-if="missRows.length" class="devimpdel__errors">
          <p v-for="row in missRows" :key="row.lineNo" class="devimpdel__error">
            第 {{ row.lineNo }} 行：{{ row.error }}
          </p>
        </div>

        <a-button v-if="missRows.length" class="devimpdel__report" @click="handleDownloadReport">
          <template #icon><DownloadOutlined /></template>
          下载未命中报告
        </a-button>
      </div>
    </div>
  </a-modal>
</template>

<script setup lang="ts">
/**
 * 【原型说明】OVERLAY-12 批量导入删除。
 * 流程：下载模板（仅 License 列）→ 上传文件 → 逐行核对（命中 / 未命中）→ 确认删除。
 * 语义为部分成功：命中行被删除，未命中行（License 不存在 / 重复 / 为空）跳过并给出原因。
 * 本组件自行发起删除，完成后通过 done 事件通知父级刷新列表。
 */
import { computed, ref, watch } from 'vue'
import { message } from 'antdv-next'
import { DownloadOutlined, InboxOutlined } from '@antdv-next/icons'
import {
  IMPORT_ACCEPT_EXTS,
  IMPORT_FILE_MAX_MB,
  IMPORT_MAX_ROWS,
  buildImportDeleteReport,
  buildImportDeleteTemplate,
  deleteDevicesByLicense,
  downloadText,
  parseImportDeleteRows,
} from '../store'
import type { ImportDeleteRow } from '../store'

const props = defineProps<{ open: boolean }>()

const emit = defineEmits<{ 'update:open': [boolean]; done: [void] }>()

const rows = ref<ImportDeleteRow[]>([])
const fileName = ref('')
const deleting = ref(false)

/** 命中行：库内存在该 License，可被删除 */
const matchRows = computed(() => rows.value.filter((row) => row.device))
const missRows = computed(() => rows.value.filter((row) => row.error))
const matchCount = computed(() => matchRows.value.length)

// 关闭后清空状态，避免下次打开看到上一次的文件与结果
watch(
  () => props.open,
  (value) => {
    if (!value) {
      rows.value = []
      fileName.value = ''
      deleting.value = false
    }
  },
)

function handleDownloadTemplate() {
  downloadText('设备批量删除模板.csv', buildImportDeleteTemplate())
  message.success('模板已下载')
}

/** 上传前校验扩展名与大小；通过后读取文本并逐行核对 */
function handleBeforeUpload(file: File) {
  const name = file.name.toLowerCase()
  if (!IMPORT_ACCEPT_EXTS.some((ext) => name.endsWith(ext))) {
    message.error('仅支持 .xlsx / .xls 格式的模板文件')
    return false
  }
  if (file.size > IMPORT_FILE_MAX_MB * 1024 * 1024) {
    message.error(`文件大小不能超过 ${IMPORT_FILE_MAX_MB}MB`)
    return false
  }

  const reader = new FileReader()
  reader.onload = () => {
    const parsed = parseImportDeleteRows(String(reader.result ?? ''))
    if (!parsed.length) {
      message.error('未读取到有效数据，请使用最新模板填写')
      return
    }
    if (parsed.length > IMPORT_MAX_ROWS) {
      message.error(`单次最多删除 ${IMPORT_MAX_ROWS} 条，请分批上传`)
      return
    }
    rows.value = parsed
    fileName.value = file.name
  }
  reader.readAsText(file)
  // 阻止组件自身的上传请求：原型仅在前端解析文件内容
  return false
}

function handleDownloadReport() {
  downloadText(`设备批量删除未命中报告-${Date.now()}.csv`, buildImportDeleteReport(rows.value))
  message.success('未命中报告已下载')
}

function handleClose() {
  if (deleting.value) return
  emit('update:open', false)
}

async function handleSubmit() {
  if (!matchCount.value) {
    message.warning('文件中没有可删除的设备，请核对 License')
    return
  }
  deleting.value = true
  try {
    const result = await deleteDevicesByLicense(rows.value)
    if (result.skipped) {
      message.warning(`已删除 ${result.success} 台，跳过 ${result.skipped} 条（未命中）`)
    } else {
      message.success(`已删除 ${result.success} 台设备`)
    }
    emit('done')
    emit('update:open', false)
  } catch (error) {
    message.error(error instanceof Error ? error.message : '删除失败，请重试')
  } finally {
    deleting.value = false
  }
}
</script>
