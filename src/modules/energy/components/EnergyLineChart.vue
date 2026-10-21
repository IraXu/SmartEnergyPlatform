<!--
  【原型说明】能源数据折线图（基于 ECharts）
  - 平滑曲线 + 面积渐变、坐标轴与网格轻量化，悬浮提示跟随数据点
  - 保留业务语义：缺失断点、估算 / 异常质量标记、图例筛选、0 基线切换
  - 图例仍使用 DOM 按钮，便于键盘操作与读屏；ECharts 内置图例关闭
-->
<template>
  <div
    class="energy-chart"
    :class="{
      'energy-chart--legend-bottom': legendPosition === 'bottom',
      'energy-chart--compact': !showQualityLegend,
    }"
  >
    <div class="energy-chart__legend" role="group" aria-label="图例（点击可筛选系列）">
      <button
        v-for="item in series"
        :key="item.name"
        type="button"
        class="energy-chart__legend-item energy-chart__legend-item--toggle"
        :class="{ 'is-off': hiddenNames.includes(item.name) }"
        :aria-pressed="!hiddenNames.includes(item.name)"
        :title="`${item.name}：点击${hiddenNames.includes(item.name) ? '显示' : '隐藏'}该系列`"
        @click="toggleSeries(item.name)"
      >
        <i class="energy-chart__legend-dot" :style="{ background: item.color }" />
        {{ item.name }}
      </button>
      <span v-if="showMissingLegend" class="energy-chart__legend-item">
        <i class="energy-chart__legend-dash" />
        缺失
      </span>
      <template v-if="showQualityLegend">
        <span class="energy-chart__legend-item">
          <i class="energy-chart__legend-dash" />
          缺失
        </span>
        <span class="energy-chart__legend-item">
          <i class="energy-chart__legend-dash energy-chart__legend-dash--est" />
          估算·展示补齐
        </span>
        <span class="energy-chart__legend-item">
          <i class="energy-chart__legend-dot energy-chart__legend-dot--abnormal" />
          异常
        </span>
      </template>
      <button
        v-if="showBaselineToggle"
        type="button"
        class="energy-chart__baseline"
        :aria-pressed="zeroBaseline"
        :title="zeroBaseline ? '当前为 0 基线，点击切换为自动范围' : '当前为自动范围，点击切换为 0 基线'"
        @click="zeroBaseline = !zeroBaseline"
      >
        {{ zeroBaseline ? '0 基线' : '自动范围' }}
      </button>
    </div>

    <div class="energy-chart__canvas">
      <div
        ref="chartRef"
        class="energy-chart__echart"
        :style="{ height: `${height}px` }"
        role="img"
        :aria-label="ariaLabel"
      />
      <div v-if="!hasData" class="energy-chart__empty">暂无数据</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import * as echarts from 'echarts'
import type { ECharts, EChartsOption } from 'echarts'
import type { Series } from '../store/types'

const props = withDefaults(
  defineProps<{
    series: Series[]
    /** 图表区高度（px），默认按最小视觉基准 260px（不含 60px 图例区） */
    height?: number
    unit?: string
    showXAxis?: boolean
    /** 图例位置：监测页置于图表上方，分析页置于底部居中 */
    legendPosition?: 'top' | 'bottom'
    /** 是否提供「自动范围 / 0 基线」切换（Q-IXD-MON-03） */
    showBaselineToggle?: boolean
    /** 是否展示数据质量图例（能源页为 true；设备原始指标页为 false） */
    showQualityLegend?: boolean
    /** 是否在曲线上叠加缺失 / 估算 / 异常标记（用能分析页不展示质量概念） */
    showQualityMarks?: boolean
    /** 是否展示「缺失」图例（无值缺口区间，曲线断点） */
    showMissingLegend?: boolean
    /** 纵轴与悬浮数值的小数位；不传时按整数展示（能源页口径） */
    precision?: number
  }>(),
  {
    height: 260,
    unit: '',
    showXAxis: true,
    legendPosition: 'top',
    showBaselineToggle: false,
    showQualityLegend: true,
    showQualityMarks: true,
  },
)

const chartRef = ref<HTMLDivElement | null>(null)
const hiddenNames = ref<string[]>([])
const zeroBaseline = ref(false)

let chart: ECharts | null = null
let resizeObserver: ResizeObserver | null = null

const ariaLabel = computed(
  () => `${props.series.map((item) => item.name).join('、')}趋势图${props.unit ? `，单位 ${props.unit}` : ''}`,
)

const hasData = computed(() =>
  props.series.some(
    (item) =>
      !hiddenNames.value.includes(item.name) &&
      item.points.some((point) => point.value !== null && Number.isFinite(point.value)),
  ),
)

function toggleSeries(name: string) {
  hiddenNames.value = hiddenNames.value.includes(name)
    ? hiddenNames.value.filter((item) => item !== name)
    : [...hiddenNames.value, name]
}

/** 纵轴与悬浮数值格式：能源页取整，设备原始指标按传入精度展示 */
function formatAxisValue(value: number) {
  if (props.precision === undefined) return Math.round(value).toLocaleString('en-US')
  return value.toLocaleString('en-US', {
    minimumFractionDigits: props.precision,
    maximumFractionDigits: props.precision,
  })
}

/** 给系列主色追加透明度，用于面积渐变 */
function withAlpha(color: string, alpha: number) {
  if (!color.startsWith('#')) return color
  const hex = color.slice(1)
  const full = hex.length === 3 ? hex.split('').map((char) => char + char).join('') : hex
  const value = Number.parseInt(full, 16)
  if (!Number.isFinite(value)) return color
  return `rgba(${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}, ${alpha})`
}

function buildOption(): EChartsOption {
  const labels = props.series[0]?.points.map((point) => point.label) ?? []
  const visible = props.series.filter((item) => !hiddenNames.value.includes(item.name))

  const lineSeries = visible.map((item) => ({
    name: item.name,
    type: 'line' as const,
    data: item.points.map((point) => point.value),
    smooth: 0.28,
    symbol: 'circle',
    symbolSize: 6,
    showSymbol: item.points.length <= 60,
    connectNulls: false,
    lineStyle: { width: 2.4, color: item.color, type: item.dash ?? 'solid' },
    itemStyle: { color: item.color, borderColor: '#fff', borderWidth: 1.5 },
    emphasis: { focus: 'series' as const },
    areaStyle:
      visible.length === 1
        ? {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: withAlpha(item.color, 0.24) },
              { offset: 1, color: withAlpha(item.color, 0.01) },
            ]),
          }
        : undefined,
    z: 3,
  }))

  // 估算 / 异常点单独用散点覆盖，避免破坏主曲线连续性
  const qualitySeries = !props.showQualityMarks ? [] : visible.flatMap((item) => {
    const data = item.points
      .map((point, index) => ({ point, index }))
      .filter(({ point }) => point.value !== null && point.quality !== 'valid')
      .map(({ point, index }) => ({
        value: [index, point.value],
        itemStyle: {
          color: point.quality === 'estimated' ? '#faad14' : '#ff4d4f',
          borderColor: '#fff',
          borderWidth: 1.5,
        },
      }))
    if (!data.length) return []
    return [
      {
        name: `${item.name}·质量`,
        type: 'scatter' as const,
        data,
        symbolSize: 9,
        silent: true,
        tooltip: { show: false },
        z: 5,
      },
    ]
  })

  return {
    animationDuration: 380,
    animationEasing: 'cubicOut',
    color: visible.map((item) => item.color),
    grid: {
      left: 8,
      right: 18,
      top: 18,
      bottom: props.showXAxis ? 6 : 6,
      containLabel: true,
    },
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: 'line',
        lineStyle: { color: '#c9d6d3', width: 1, type: 'dashed' },
      },
      backgroundColor: 'rgba(255, 255, 255, 0.98)',
      borderColor: '#e7edec',
      borderWidth: 1,
      padding: [10, 12],
      textStyle: { color: 'rgba(0, 0, 0, 0.78)', fontSize: 12 },
      extraCssText: 'box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08); border-radius: 8px;',
      formatter: (params: unknown) => {
        const rows = params as Array<{ dataIndex?: number }>
        const index = rows[0]?.dataIndex ?? 0
        const label = labels[index] ?? ''
        const body = visible
          .map((item) => {
            const value = item.points[index]?.value
            const valueText = value === null || value === undefined
              ? '缺数'
              : `${formatAxisValue(value)}${props.unit ? ` ${props.unit}` : ''}`
            return `<div style="display:flex;align-items:center;gap:8px;margin-top:6px;min-width:150px;">
              <span style="width:8px;height:8px;border-radius:50%;background:${item.color};flex:none;"></span>
              <span style="flex:1;color:rgba(0,0,0,.6);">${item.name}</span>
              <span style="font-weight:600;color:rgba(0,0,0,.88);font-variant-numeric:tabular-nums;">${valueText}</span>
            </div>`
          })
          .join('')
        return `<div style="font-size:12px;color:rgba(0,0,0,.45);">${label}</div>${body}`
      },
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: labels,
      show: props.showXAxis,
      axisLine: { lineStyle: { color: '#e7edec' } },
      axisTick: { show: false },
      axisLabel: {
        color: 'rgba(0, 0, 0, 0.45)',
        fontSize: 12,
        margin: 12,
        hideOverlap: true,
      },
    },
    yAxis: {
      type: 'value',
      scale: !zeroBaseline.value,
      min: zeroBaseline.value ? 0 : undefined,
      splitNumber: 4,
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: {
        color: 'rgba(0, 0, 0, 0.45)',
        fontSize: 12,
        formatter: (value: number) => formatAxisValue(value),
      },
      splitLine: { lineStyle: { color: '#f1f5f4', type: 'dashed' } },
    },
    series: [...lineSeries, ...qualitySeries],
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

watch(
  [() => props.series, () => props.height, () => props.unit, () => props.showXAxis, () => props.precision, () => props.showQualityMarks, hiddenNames, zeroBaseline],
  render,
  { deep: true },
)
</script>
