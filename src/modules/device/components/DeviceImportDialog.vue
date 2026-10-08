<template>
  <div class="devimport">
    <!-- 导入中：进度反馈 -->
    <template v-if="importing">
      <div class="devimport__progress">
        <a-progress :percent="60" status="active" />
        <p class="devimport__progress-tip">正在导入，请勿关闭</p>
      </div>
    </template>

    <template v-else>
      <!-- 步骤 1：下载模板 -->
      <div class="devimport__step">
        <p class="devimport__step-title">1. 下载模板</p>
        <p class="devimport__step-desc">请先下载模板，按模板格式填写后再上传</p>
        <a-button @click="handleDownloadTemplate">
          <template #icon><DownloadOutlined /></template>
          下载模板
        </a-button>
        <p class="devimport__step-note">
          必填列：设备名称、License、所属用能单元编码（填用能单元编码，可在「组织架构 › 用能单元」列表中查看）；
          设备识别码（IMEI）在导入后由平台按 License 查询带出，无需填写
        </p>
      </div>

      <!-- 步骤 2：上传文件 -->
      <div class="devimport__step">
        <p class="devimport__step-title">2. 上传文件</p>
        <a-upload-dragger
          :file-list="[]"
          :before-upload="handleBeforeUpload"
          :show-upload-list="false"
          :accept="IMPORT_ACCEPT_EXTS.join(',')"
        >
          <p class="devimport__upload-icon"><InboxOutlined /></p>
          <p class="devimport__upload-text">点击或拖拽文件到此处上传</p>
          <p class="devimport__upload-hint">
            仅支持 .xlsx / .xls，大小不超过 {{ IMPORT_FILE_MAX_MB }}MB，单次最多 {{ IMPORT_MAX_ROWS }} 行
          </p>
        </a-upload-dragger>
        <p v-if="fileName" class="devimport__file">已选择：{{ fileName }}</p>
      </div>

      <!-- 步骤 3：校验结果 -->
      <div v-if="rows.length" class="devimport__step">
        <p class="devimport__step-title">3. 校验结果</p>
        <p class="devimport__result">
          有效行 <strong class="devimport__ok">{{ validCount }}</strong> 条，无效行
          <strong class="devimport__fail">{{ failedRows.length }}</strong> 条
        </p>

        <div v-if="failedRows.length" class="devimport__errors">
          <p v-for="row in failedRows" :key="row.lineNo" class="devimport__error">
            第 {{ row.lineNo }} 行：{{ row.error }}
          </p>
        </div>

        <a-button v-if="failedRows.length" class="devimport__report" @click="handleDownloadReport">
          <template #icon><DownloadOutlined /></template>
          下载失败报告
        </a-button>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
/**
 * 【原型说明】批量导入面板（内嵌于「新增设备」弹窗的「批量导入」方式中）。
 * 下载模板 → 上传文件 → 逐行校验 → 确认导入（部分成功语义，失败行可下载报告）。
 * 只允许新增，不更新已有设备（设备识别码与 License 重复的行按失败处理）。
 * 确认导入由外层的「新增设备」弹窗统一触发：本组件通过 change 事件回传状态，供外层控制主按钮。
 */
import { computed, ref, watch } from 'vue'
import { message } from 'antdv-next'
import { DownloadOutlined, InboxOutlined } from '@antdv-next/icons'
import {
  IMPORT_ACCEPT_EXTS,
  IMPORT_FILE_MAX_MB,
  IMPORT_MAX_ROWS,
  buildFailedReport,
  buildImportTemplate,
  downloadText,
  importDevices,
  parseImportRows,
} from '../store'
import type { ImportRow } from '../store'

const emit = defineEmits<{
  done: [{ success: number; failed: number }]
  /** 状态变化：是否已有可导入的行 / 是否正在导入，供外层控制「开始导入」按钮 */
  change: [{ ready: boolean; running: boolean }]
}>()

const rows = ref<ImportRow[]>([])
const fileName = ref('')
const importing = ref(false)

const validCount = computed(() => rows.value.filter((row) => row.input).length)
const failedRows = computed(() => rows.value.filter((row) => row.error))

watch([rows, importing], () => {
  emit('change', { ready: rows.value.length > 0, running: importing.value })
})

function handleDownloadTemplate() {
  downloadText('设备批量添加模板.csv', buildImportTemplate())
  message.success('模板已下载')
}

/** 上传前校验：扩展名与文件大小；通过后读取文本内容并解析 */
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
    const parsed = parseImportRows(String(reader.result ?? ''))
    if (!parsed.length) {
      message.error('未读取到有效数据，请使用最新模板填写')
      return
    }
    if (parsed.length > IMPORT_MAX_ROWS) {
      message.error(`单次最多导入 ${IMPORT_MAX_ROWS} 条，请分批导入`)
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
  downloadText(`设备导入失败报告-${Date.now()}.csv`, buildFailedReport(rows.value))
  message.success('失败报告已下载')
}

/** 由外层弹窗在点击「保存」时调用：执行导入 */
async function submit() {
  if (!rows.value.length) {
    message.warning('请先上传模板文件')
    return false
  }
  importing.value = true
  try {
    const result = await importDevices(rows.value)
    if (!result.success) {
      message.error('导入失败，所有数据均未通过校验，请下载失败报告查看原因')
      return false
    }
    if (result.failed) {
      message.warning(`导入完成：成功 ${result.success} 条，失败 ${result.failed} 条`)
    } else {
      message.success(`导入完成：成功 ${result.success} 条`)
    }
    emit('done', result)
    return true
  } catch (error) {
    message.error(error instanceof Error ? error.message : '导入失败，请重试')
    return false
  } finally {
    importing.value = false
  }
}

/** 弹窗关闭或切换添加方式时清空状态，避免下次打开看到旧数据 */
function reset() {
  rows.value = []
  fileName.value = ''
  importing.value = false
}

defineExpose({ submit, reset })
</script>
