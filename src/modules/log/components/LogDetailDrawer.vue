<!--
  OVERLAY-01 日志详情抽屉（PRD F-LOG-03）
  【原型说明】从日志列表行打开，右侧滑出；只读展示单条日志的完整信息。
  分区：基本信息 → 类型特有信息（登录特有信息 / 变更明细）。
  抽屉内不提供任何写入口（编辑、删除、导出、跳转业务页）。
-->
<template>
  <a-drawer
    :open="open"
    placement="right"
    :size="640"
    :closable="false"
    @close="close"
  >
    <template #title />
    <div class="logd">
      <!-- 头部：标题 + 关闭 -->
      <header class="logd__head">
        <h3 class="logd__title">日志详情</h3>
        <a-button type="text" size="small" aria-label="关闭" @click="close">
          <template #icon><CloseOutlined /></template>
        </a-button>
      </header>

      <!-- 加载中 -->
      <div v-if="loading" class="logd__body">
        <a-skeleton active :paragraph="{ rows: 8 }" />
      </div>

      <!-- 加载失败 -->
      <div v-else-if="failed" class="logd__body">
        <div class="logd__state">
          <span class="logd__state-icon"><DisconnectOutlined /></span>
          <p class="logd__state-title">日志详情加载失败</p>
          <p class="logd__state-desc">网络异常或服务暂时不可用，请稍后重试</p>
          <a-button type="primary" size="small" @click="reload">
            <template #icon><ReloadOutlined /></template>
            重新加载
          </a-button>
        </div>
      </div>

      <div v-else-if="record" class="logd__body">
        <!-- 分区一：基本信息 -->
        <section class="logd__section">
          <h4 class="logd__section-title">基本信息</h4>
          <dl class="logd__grid">
            <div class="logd__field">
              <dt>日志编号</dt>
              <dd class="logd__mono">{{ record.id }}</dd>
            </div>
            <div class="logd__field">
              <dt>操作时间</dt>
              <dd>{{ formatTime(record.at) }}</dd>
            </div>
            <div class="logd__field">
              <dt>操作账号</dt>
              <dd class="logd__mono">{{ record.account }}</dd>
            </div>
            <div class="logd__field">
              <dt>账号姓名</dt>
              <dd>{{ record.accountName || '—' }}</dd>
            </div>

            <template v-if="kind === 'operation' && operation">
              <div class="logd__field">
                <dt>所属模块</dt>
                <dd>{{ operation.module }}</dd>
              </div>
              <div class="logd__field">
                <dt>功能</dt>
                <dd>{{ operation.feature }}</dd>
              </div>
              <div class="logd__field">
                <dt>变更类型</dt>
                <dd>{{ operation.changeType }}</dd>
              </div>
              <div class="logd__field">
                <dt>操作对象</dt>
                <dd>
                  {{ operation.objectType }} / {{ operation.objectName }}
                  <a-tag v-if="operation.objectDeleted" class="logd__tag">已删除</a-tag>
                </dd>
              </div>
            </template>
          </dl>
          <p v-if="kind === 'operation' && operation?.objectDeleted" class="logd__note">该对象已被删除</p>
        </section>

        <!-- 分区二（登录日志）：会话行为信息 -->
        <section v-if="kind === 'login' && login" class="logd__section">
          <h4 class="logd__section-title">会话行为</h4>
          <dl class="logd__grid">
            <div class="logd__field">
              <dt>操作类型</dt>
              <dd>
                <a-tag :class="['logd__tag', login.action === '登录' ? 'logd__tag--ok' : 'logd__tag--muted']">
                  {{ login.action }}
                </a-tag>
              </dd>
            </div>
            <div class="logd__field">
              <dt>登录方式</dt>
              <dd>{{ login.method || '—' }}</dd>
            </div>
            <div class="logd__field">
              <dt>结果</dt>
              <dd>
                <a-tag :class="['logd__tag', `logd__tag--${resultTone(login.result)}`]">{{ login.result }}</a-tag>
              </dd>
            </div>
            <div class="logd__field">
              <dt>失败原因</dt>
              <dd>{{ login.failReason || '—' }}</dd>
            </div>
            <div class="logd__field">
              <dt>来源 IP</dt>
              <dd class="logd__mono">{{ login.ip }}</dd>
            </div>
            <div class="logd__field">
              <dt>来源终端</dt>
              <dd>{{ login.terminal || '—' }}</dd>
            </div>
          </dl>
        </section>

        <!-- 分区二（操作行为日志）：变更明细 -->
        <section v-if="kind === 'operation' && operation" class="logd__section">
          <h4 class="logd__section-title">变更明细</h4>

          <!-- 字段级前后值表 -->
          <template v-if="operation.detail.kind === 'field'">
            <table class="logd__table">
              <thead>
                <tr>
                  <th>变更字段</th>
                  <th>变更前</th>
                  <th>变更后</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in operation.detail.rows" :key="row.field">
                  <td>{{ row.field }}</td>
                  <td class="logd__mono">{{ row.before || '—' }}</td>
                  <td class="logd__mono">{{ row.after || '—' }}</td>
                </tr>
              </tbody>
            </table>
          </template>

          <!-- 权限点增删清单 -->
          <template v-else-if="operation.detail.kind === 'permission'">
            <div v-if="operation.detail.added.length" class="logd__perm">
              <p class="logd__perm-head">新增权限点（{{ operation.detail.added.length }}）</p>
              <ul class="logd__perm-list">
                <li v-for="item in operation.detail.added" :key="item">
                  <span class="logd__perm-add">＋</span>{{ item }}
                </li>
              </ul>
            </div>
            <div v-if="operation.detail.removed.length" class="logd__perm">
              <p class="logd__perm-head">移除权限点（{{ operation.detail.removed.length }}）</p>
              <ul class="logd__perm-list">
                <li v-for="item in operation.detail.removed" :key="item">
                  <span class="logd__perm-remove">－</span>{{ item }}
                </li>
              </ul>
            </div>
            <p v-if="!operation.detail.added.length && !operation.detail.removed.length" class="logd__empty">
              本次无权限点变化
            </p>
          </template>

          <!-- 状态变更条 -->
          <template v-else-if="operation.detail.kind === 'state'">
            <div class="logd__strip">
              <span class="logd__strip-label">原状态</span>
              <span class="logd__strip-value">{{ operation.detail.before }}</span>
              <span class="logd__strip-arrow">→</span>
              <span class="logd__strip-label">新状态</span>
              <span class="logd__strip-value logd__strip-value--after">{{ operation.detail.after }}</span>
            </div>
          </template>

          <!-- 归属变更条 -->
          <template v-else-if="operation.detail.kind === 'ownership'">
            <div class="logd__owner">
              <div class="logd__owner-row">
                <span class="logd__strip-label">原归属</span>
                <span class="logd__strip-value">{{ operation.detail.before }}</span>
              </div>
              <div class="logd__owner-row">
                <span class="logd__strip-label">新归属</span>
                <span class="logd__strip-value logd__strip-value--after">{{ operation.detail.after }}</span>
              </div>
            </div>
          </template>

          <!-- 对象清单表 -->
          <template v-else-if="operation.detail.kind === 'objects'">
            <p v-if="operation.detail.total > OBJECT_DETAIL_LIMIT" class="logd__hint">
              共 {{ operation.detail.total }} 条，已展示前 {{ OBJECT_DETAIL_LIMIT }} 条，完整明细请导出
            </p>
            <table class="logd__table">
              <thead>
                <tr>
                  <th>对象名称</th>
                  <th>结果</th>
                  <th>说明</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(row, index) in visibleObjectRows" :key="index">
                  <td>{{ row.name }}</td>
                  <td>
                    <a-tag :class="['logd__tag', `logd__tag--${objectTone(row.result)}`]">{{ row.result }}</a-tag>
                  </td>
                  <td>{{ row.note || '—' }}</td>
                </tr>
              </tbody>
            </table>
          </template>

          <!-- 文字说明 -->
          <template v-else>
            <p class="logd__text">{{ operation.detail.text }}</p>
          </template>

          <!-- 同步影响说明：仅企业名称变更类记录展示 -->
          <p v-if="showSyncNote" class="logd__sync">
            <InfoCircleOutlined />
            企业名称变更已同步组织架构企业根节点、顶栏企业名称与选择登录企业列表
          </p>
        </section>
      </div>

      <!-- 底部：仅「关闭」 -->
      <footer class="logd__foot">
        <a-button @click="close">关闭</a-button>
      </footer>
    </div>
  </a-drawer>
</template>

<script setup lang="ts">
/**
 * OVERLAY-01 日志详情抽屉
 * 【原型说明】两类日志共用一个只读详情抽屉：
 * - 登录日志展示「基本信息 + 登录信息」
 * - 操作行为日志展示「基本信息 + 变更明细」（按变更类型呈现五类形态之一）
 * 抽屉内不提供复制、导出、跳转业务页、编辑、删除等任何入口。
 */
import { computed, ref, watch } from 'vue'
import { CloseOutlined, DisconnectOutlined, InfoCircleOutlined, ReloadOutlined } from '@antdv-next/icons'
import { OBJECT_DETAIL_LIMIT, formatTime } from '../store'
import type { LogTab, LoginLog, OperationLog } from '../store'

const props = defineProps<{
  open: boolean
  /** 日志类型：决定详情分区 */
  kind: LogTab
  /** 当前查看的记录（两类日志之一） */
  record: LoginLog | OperationLog | null
}>()

const emit = defineEmits<{ 'update:open': [boolean] }>()

const loading = ref(false)
const failed = ref(false)

const login = computed(() => (props.kind === 'login' ? (props.record as LoginLog | null) : null))
const operation = computed(() => (props.kind === 'operation' ? (props.record as OperationLog | null) : null))

/** 对象清单超过上限时仅展示前 N 条，顶部说明总数 */
const visibleObjectRows = computed(() => {
  const detail = operation.value?.detail
  if (detail?.kind !== 'objects') return []
  return detail.rows.slice(0, OBJECT_DETAIL_LIMIT)
})

/** 企业名称变更类记录追加同步影响说明（PRD 6.2 OVERLAY-01） */
const showSyncNote = computed(
  () => operation.value?.feature === '企业中心' && operation.value?.changeType === '编辑企业档案',
)

/** 登录结果标签配色：成功 / 失败 / 已锁定 */
function resultTone(result: string) {
  if (result === '成功') return 'ok'
  if (result === '失败') return 'fail'
  return 'warn'
}

/** 对象清单结果标签配色：成功 / 失败 / 已跳过 */
function objectTone(result: string) {
  if (result === '成功') return 'ok'
  if (result === '失败') return 'fail'
  return 'warn'
}

/** 【原型说明】模拟详情加载耗时，无真实接口调用 */
function load() {
  loading.value = true
  failed.value = false
  window.setTimeout(() => {
    loading.value = false
  }, 260)
}

function reload() {
  load()
}

/** 【原型说明】模拟详情加载失败，用于验证错误态与重试 */
function simulateFail() {
  loading.value = true
  failed.value = false
  window.setTimeout(() => {
    loading.value = false
    failed.value = true
  }, 360)
}

watch(
  () => [props.open, props.record?.id],
  ([open]) => {
    if (open) load()
  },
  { immediate: true },
)

function close() {
  emit('update:open', false)
}

defineExpose({ simulateFail })
</script>
