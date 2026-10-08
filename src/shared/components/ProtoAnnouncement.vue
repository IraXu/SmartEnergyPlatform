<template>
  <!-- 固定顶部居中的定位容器：不参与动画，避免与 translateX(-50%) 冲突 -->
  <div class="proto-announce">
    <Transition name="proto-announce">
      <div
        v-if="visible"
        class="proto-announce__pop"
        :class="{ 'is-paused': paused }"
        role="status"
        aria-live="polite"
        @mouseenter="pause"
        @mouseleave="resume"
        @focusin="pause"
        @focusout="resume"
      >
        <a-border-beam :color="beamColor" :duration="6" :size="150" :line-width="1.5" :outset="0">
          <div class="proto-announce__card">
            <span class="proto-announce__glow" aria-hidden="true" />

            <header class="proto-announce__head">
              <span class="proto-announce__badge" aria-hidden="true">
                <NotificationOutlined />
              </span>
              <span class="proto-announce__titles">
                <strong class="proto-announce__title">原型公告</strong>
                <em class="proto-announce__subtitle">PROTOTYPE NOTICE</em>
              </span>
              <button
                type="button"
                class="proto-announce__close"
                aria-label="关闭公告"
                @click="close"
              >
                <CloseOutlined />
              </button>
            </header>

            <ul class="proto-announce__list">
              <li v-for="item in items" :key="item.text" class="proto-announce__item">
                <span class="proto-announce__icon" aria-hidden="true">
                  <component :is="item.icon" />
                </span>
                <span class="proto-announce__text">{{ item.text }}</span>
              </li>
            </ul>

            <footer class="proto-announce__footer">
              <span class="proto-announce__track" aria-hidden="true">
                <span class="proto-announce__bar" :style="{ transform: `scaleX(${progress})` }" />
              </span>
              <!-- 倒计时文案随秒变化，对读屏屏蔽，避免逐秒播报 -->
              <span class="proto-announce__hint" :class="{ 'is-paused': paused }" aria-hidden="true">
                <template v-if="paused">已暂停 · 移开鼠标继续</template>
                <template v-else><b class="proto-announce__seconds">{{ secondsLeft }}</b> 秒后自动关闭</template>
              </span>
            </footer>
          </div>
        </a-border-beam>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
/**
 * 【原型说明】公告仅服务于原型走查，不写入 PRD 与交互文档，也不影响业务流程。
 * 展示规则：登录 / 注册页共用一份「已展示」状态，每次打开原型首次进入认证页时展示一次；
 * 可手动关闭或按 Esc 关闭；未操作时 6 秒后自动关闭，鼠标悬停或键盘聚焦时暂停倒计时，便于阅读。
 */
import { onBeforeUnmount, onMounted, ref } from 'vue'
import {
  CloseOutlined,
  FileSearchOutlined,
  GlobalOutlined,
  NotificationOutlined,
  SyncOutlined,
} from '@antdv-next/icons'
import type { BorderBeamGradient } from 'antdv-next'

/** 模块级状态：同一次打开内只展示一次，刷新页面后重新可展示，便于反复走查 */
const hasShown = ref(false)

/** 未操作时自动关闭的时长（毫秒） */
const AUTO_CLOSE_MS = 6000

const visible = ref(false)
const paused = ref(false)
/** 剩余进度，1 → 0，用于底部倒计时进度条 */
const progress = ref(1)
/** 剩余整秒数，用于动态倒计时文案 */
const secondsLeft = ref(Math.ceil(AUTO_CLOSE_MS / 1000))

let remaining = AUTO_CLOSE_MS
let lastTs = 0
let rafId: number | undefined

/** 公告条目：图标 + 文案，图标仅用于辅助识别，语义由文案承载 */
const items = [
  { icon: GlobalOutlined, text: '产品原型部署至海外 GitHub Page 上，访问过慢请自行科学上网' },
  { icon: FileSearchOutlined, text: '产品原型仅供功能需求查阅，具体实现以实际开发为准' },
  { icon: SyncOutlined, text: '更多页面功能持续更新中，有疑问可联系产品部' },
]

/** 流光配色沿用品牌青绿渐变，与登录页视觉保持一致 */
const beamColor: BorderBeamGradient = [
  { color: '#0f7b6c', percent: 0 },
  { color: '#5fd4c4', percent: 55 },
  { color: '#8ff5e0', percent: 100 },
]

/** 用逐帧递减剩余时长的方式驱动倒计时，保证进度条、秒数与关闭时机三者始终一致 */
function tick(timestamp: number) {
  if (!lastTs) lastTs = timestamp
  const delta = timestamp - lastTs
  lastTs = timestamp

  if (!paused.value) {
    remaining = Math.max(0, remaining - delta)
    progress.value = remaining / AUTO_CLOSE_MS
    secondsLeft.value = Math.ceil(remaining / 1000)
    if (remaining === 0) {
      close()
      return
    }
  }
  rafId = window.requestAnimationFrame(tick)
}

function stopTick() {
  if (rafId !== undefined) window.cancelAnimationFrame(rafId)
  rafId = undefined
}

function pause() {
  paused.value = true
}

function resume() {
  // 重新计时以当前帧为基准，避免暂停期间累积的时间差导致进度条跳变
  lastTs = 0
  paused.value = false
}

function close() {
  stopTick()
  visible.value = false
  window.removeEventListener('keydown', onKeydown)
}

/** 支持 Esc 快捷关闭，键盘用户无需精确点击右上角 */
function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && visible.value) close()
}

onMounted(() => {
  if (hasShown.value) return
  hasShown.value = true
  visible.value = true
  rafId = window.requestAnimationFrame(tick)
  window.addEventListener('keydown', onKeydown)
})

onBeforeUnmount(() => {
  stopTick()
  window.removeEventListener('keydown', onKeydown)
})
</script>
