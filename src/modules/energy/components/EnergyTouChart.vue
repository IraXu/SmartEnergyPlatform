<!--
  【原型说明】分时用电构成图（基于 ECharts）
  - 按所选时间粒度（日 / 周 / 月 / 年）逐段展示尖、峰、平、谷的堆叠构成
  - 悬浮提示同时给出分段合计、各时段电量与占比，不依赖颜色表达
-->
<template>
  <div class="energy-tou" role="img" :aria-label="ariaLabel">
    <div ref="chartRef" class="energy-tou__chart" :style="{ height: `${height}px` }" />
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import * as echarts from 'echarts'
import type { ECharts, EChartsOption } from 'echarts'

interface TouSeries {
  name: string
  color: string
  /** 缺失时段为 null，堆叠柱在该时段留空 */
  values: Array<number | null>
}

const props = withDefaults(
  defineProps<{
    /** 横轴标签：按所选时间粒度生成 */
    labels: string[]
    /** 尖 / 峰 / 平 / 谷四条堆叠序列 */
    series: TouSeries[]
    unit?: string
    /** 图表区高度（px），默认 240 */
    height?: number
  }>(),
  { unit: 'kWh', height: 240 },
)

const chartRef = ref<HTMLDivElement | null>(null)
let chart: ECharts | null = null
let resizeObserver: ResizeObserver | null = null

const ariaLabel = computed(
  () =>
    `分时用电构成堆叠柱状图，共 ${props.labels.length} 个统计区间，包含${props.series
      .map((item) => item.name)
      .join('、')}，单位 ${props.unit}`,
)

function buildOption(): EChartsOption {
  const totals = props.labels.map((_, index) =>
    props.series.reduce((sum, item) => sum + (item.values[index] ?? 0), 0),
  )

  return {
    animationDuration: 420,
    animationEasing: 'cubicOut',
    grid: { left: 6, right: 8, top: 34, bottom: 2, containLabel: true },
    legend: {
      top: 0,
      itemWidth: 10,
      itemHeight: 10,
      icon: 'roundRect',
      textStyle: { color: 'rgba(0, 0, 0, 0.65)', fontSize: 12 },
    },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow', shadowStyle: { color: 'rgba(15, 123, 108, 0.06)' } },
      backgroundColor: 'rgba(255, 255, 255, 0.98)',
      borderColor: '#e7edec',
      borderWidth: 1,
      padding: [10, 12],
      textStyle: { color: 'rgba(0, 0, 0, 0.78)', fontSize: 12 },
      extraCssText: 'box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08); border-radius: 8px;',
      formatter: (params: unknown) => {
        const rows = params as Array<{ dataIndex?: number }>
        const index = rows[0]?.dataIndex ?? 0
        const total = totals[index] || 1
        const body = props.series
          .map((item) => {
            const value = item.values[index] ?? 0
            const ratio = ((value / total) * 100).toFixed(1)
            return `<div style="display:flex;align-items:center;gap:8px;margin-top:6px;min-width:170px;">
              <span style="width:8px;height:8px;border-radius:2px;background:${item.color};flex:none;"></span>
              <span style="flex:1;color:rgba(0,0,0,.6);">${item.name}</span>
              <span style="color:rgba(0,0,0,.88);font-variant-numeric:tabular-nums;">${value.toLocaleString('en-US')}</span>
              <span style="width:44px;text-align:right;color:rgba(0,0,0,.45);font-variant-numeric:tabular-nums;">${ratio}%</span>
            </div>`
          })
          .join('')
        return `<div style="display:flex;justify-content:space-between;gap:16px;font-size:12px;color:rgba(0,0,0,.45);">
            <span>${props.labels[index] ?? ''}</span>
            <span>合计 ${totals[index]?.toLocaleString('en-US')} ${props.unit}</span>
          </div>${body}`
      },
    },
    xAxis: {
      type: 'category',
      data: props.labels,
      axisTick: { show: false },
      axisLine: { lineStyle: { color: '#e7edec' } },
      axisLabel: {
        color: 'rgba(0, 0, 0, 0.45)',
        fontSize: 12,
        margin: 10,
        hideOverlap: true,
      },
    },
    yAxis: {
      type: 'value',
      splitNumber: 4,
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: {
        color: 'rgba(0, 0, 0, 0.45)',
        fontSize: 12,
        formatter: (value: number) => Math.round(value).toLocaleString('en-US'),
      },
      splitLine: { lineStyle: { color: '#f1f5f4', type: 'dashed' } },
    },
    series: props.series.map((item, index) => ({
      name: item.name,
      type: 'bar' as const,
      stack: 'tou',
      data: item.values,
      barMaxWidth: 26,
      itemStyle: {
        color: item.color,
        borderRadius: index === props.series.length - 1 ? [4, 4, 0, 0] : 0,
      },
      emphasis: { focus: 'series' as const },
    })),
  }
}

function render() {
  if (!chart) return
  chart.setOption(buildOption(), true)
}

/** 导出当前图表为 PNG（供页面「下载图片」使用） */
function getDataURL(): string {
  return chart?.getDataURL({ type: 'png', pixelRatio: 2, backgroundColor: '#fff' }) ?? ''
}

defineExpose({ getDataURL })

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

watch([() => props.labels, () => props.series, () => props.height, () => props.unit], render, {
  deep: true,
})
</script>

<style scoped>
.energy-tou__chart {
  width: 100%;
}
</style>
