<!--
  【原型说明】能源数据柱状图（基于 ECharts）
  - 圆角柱体、浅色底槽、顶部数值标签与悬浮提示，用于分时（尖峰平谷）与分项构成占比
  - 颜色由调用方传入；悬浮提示同时给出数值与占比，不依赖颜色表达
-->
<template>
  <div class="energy-bar" role="img" :aria-label="ariaLabel">
    <div ref="chartRef" class="energy-bar__chart" :style="{ height: `${height}px` }" />
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import * as echarts from 'echarts'
import type { ECharts, EChartsOption } from 'echarts'

const props = withDefaults(
  defineProps<{
    items: Array<{ name: string; value: number; color: string }>
    unit?: string
    /** 柱体区域高度（px），默认 180 */
    height?: number
  }>(),
  { unit: 'kWh', height: 180 },
)

const chartRef = ref<HTMLDivElement | null>(null)
let chart: ECharts | null = null
let resizeObserver: ResizeObserver | null = null

const total = computed(() => props.items.reduce((sum, item) => sum + item.value, 0) || 1)

const ariaLabel = computed(
  () =>
    `柱状图：${props.items
      .map((item) => `${item.name} ${item.value.toLocaleString('en-US')} ${props.unit}`)
      .join('，')}`,
)

function ratioText(value: number) {
  return `${((value / total.value) * 100).toFixed(1)}%`
}

function buildOption(): EChartsOption {
  return {
    animationDuration: 420,
    animationEasing: 'cubicOut',
    grid: { left: 6, right: 6, top: 30, bottom: 2, containLabel: true },
    tooltip: {
      trigger: 'item',
      backgroundColor: 'rgba(255, 255, 255, 0.98)',
      borderColor: '#e7edec',
      borderWidth: 1,
      padding: [10, 12],
      textStyle: { color: 'rgba(0, 0, 0, 0.78)', fontSize: 12 },
      extraCssText: 'box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08); border-radius: 8px;',
      formatter: (params: unknown) => {
        const item = params as { name?: string; value?: number; color?: string }
        const value = Number(item.value ?? 0)
        return `<div style="display:flex;align-items:center;gap:8px;min-width:140px;">
          <span style="width:8px;height:8px;border-radius:2px;background:${item.color ?? '#0f7b6c'};"></span>
          <span style="flex:1;color:rgba(0,0,0,.6);">${item.name ?? ''}</span>
          <span style="font-weight:600;color:rgba(0,0,0,.88);">${value.toLocaleString('en-US')} ${props.unit}</span>
        </div>
        <div style="margin-top:4px;font-size:12px;color:rgba(0,0,0,.45);">占比 ${ratioText(value)}</div>`
      },
    },
    xAxis: {
      type: 'category',
      data: props.items.map((item) => item.name),
      axisTick: { show: false },
      axisLine: { lineStyle: { color: '#e7edec' } },
      axisLabel: { color: 'rgba(0, 0, 0, 0.55)', fontSize: 12, margin: 10 },
    },
    yAxis: {
      type: 'value',
      show: false,
    },
    series: [
      {
        type: 'bar',
        barWidth: props.items.length > 6 ? '36%' : '42%',
        data: props.items.map((item) => ({
          value: item.value,
          itemStyle: { color: item.color, borderRadius: [6, 6, 0, 0] },
        })),
        showBackground: true,
        backgroundStyle: { color: '#f6faf9', borderRadius: [6, 6, 0, 0] },
        label: {
          show: true,
          position: 'top',
          distance: 6,
          color: 'rgba(0, 0, 0, 0.68)',
          fontSize: 12,
          fontWeight: 600,
          formatter: (params: unknown) => {
            const item = params as { value?: number }
            return Number(item.value ?? 0).toLocaleString('en-US')
          },
        },
        emphasis: {
          itemStyle: { shadowBlur: 10, shadowColor: 'rgba(15, 123, 108, 0.18)' },
        },
      },
    ],
  }
}

function render() {
  if (!chart) return
  chart.setOption(buildOption(), true)
}

onMounted(() => {
  if (!chartRef.value) return
  chart = echarts.init(chartRef.value, undefined, { renderer: 'canvas' })
  render()
  resizeObserver = new ResizeObserver(() => chart?.resize())
  resizeObserver.observe(chartRef.value)
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  resizeObserver = null
  chart?.dispose()
  chart = null
})

watch([() => props.items, () => props.height, () => props.unit], render, { deep: true })
</script>
