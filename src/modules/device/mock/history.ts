/**
 * 【原型说明】设备详情底部两张曲线卡（每日用电量 / 历史数据曲线）的演示数据。
 *
 * 指标字典对齐智能电表上报的计量数据（功率 / 相电压 / 线电压 / 电流 / 电量 / 象限无功等）；
 * 数值按设备标识、指标名与时间戳确定性生成，切换时间范围时刻度可复现，
 * 刷新页面结果稳定，不涉及真实采集接口。
 */

import type { Series } from '@/modules/energy/store/types'

/** 指标数值形态：决定演示数据的取值范围与变化幅度 */
type MetricKind =
  | 'voltage'
  | 'current'
  | 'power'
  | 'frequency'
  | 'phase'
  | 'powerFactor'
  | 'thd'
  | 'energy'
  | 'residualEnergy'

export interface MetricOption {
  name: string
  unit: string
  kind: MetricKind
}

export interface MetricGroup {
  title: string
  options: MetricOption[]
}

/** 时间粒度：时 / 日 / 周 / 月 */
export type Granularity = 'hour' | 'day' | 'week' | 'month'

export const GRANULARITY_OPTIONS: Array<{ label: string; value: Granularity }> = [
  { label: '时', value: 'hour' },
  { label: '日', value: 'day' },
  { label: '周', value: 'week' },
  { label: '月', value: 'month' },
]

/** 不同粒度允许查询的最大天数，避免单条曲线点数过多 */
export const MAX_RANGE_DAYS: Record<Granularity, number> = {
  hour: 31,
  day: 366,
  week: 730,
  month: 1826,
}

/** 指标构造器：统一把 [名称, 单位, 形态] 转成字典项 */
const metric = (name: string, unit: string, kind: MetricKind): MetricOption => ({ name, unit, kind })

/**
 * 智能电表上报指标字典（按业务含义分组）。
 * 同一时间仅展示一个指标，避免不同量纲共用纵轴造成误读。
 */
export const METRIC_GROUPS: MetricGroup[] = [
  {
    title: '功率',
    options: [
      metric('A 相有功功率', 'kW', 'power'),
      metric('B 相有功功率', 'kW', 'power'),
      metric('C 相有功功率', 'kW', 'power'),
      metric('A 相无功功率', 'kVar', 'power'),
      metric('B 相无功功率', 'kVar', 'power'),
      metric('C 相无功功率', 'kVar', 'power'),
      metric('A 相视在功率', 'kVA', 'power'),
      metric('B 相视在功率', 'kVA', 'power'),
      metric('C 相视在功率', 'kVA', 'power'),
    ],
  },
  {
    title: '相电压',
    options: [
      metric('A 相电压', 'V', 'voltage'),
      metric('B 相电压', 'V', 'voltage'),
      metric('C 相电压', 'V', 'voltage'),
    ],
  },
  {
    title: '线电压',
    options: [
      metric('AB 线电压', 'V', 'voltage'),
      metric('BC 线电压', 'V', 'voltage'),
      metric('CA 线电压', 'V', 'voltage'),
    ],
  },
  {
    title: '电流',
    options: [
      metric('A 相电流', 'A', 'current'),
      metric('B 相电流', 'A', 'current'),
      metric('C 相电流', 'A', 'current'),
    ],
  },
  {
    title: '相位与频率',
    options: [
      metric('频率', 'Hz', 'frequency'),
      metric('AB 线电压相位', '°', 'phase'),
      metric('BC 线电压相位', '°', 'phase'),
      metric('CA 线电压相位', '°', 'phase'),
    ],
  },
  {
    title: '功率因数',
    options: [
      metric('A 相功率因数', '', 'powerFactor'),
      metric('B 相功率因数', '', 'powerFactor'),
      metric('C 相功率因数', '', 'powerFactor'),
    ],
  },
  {
    title: '谐波失真度',
    options: [
      metric('A 相电流总谐波失真度', '%', 'thd'),
      metric('B 相电流总谐波失真度', '%', 'thd'),
      metric('C 相电流总谐波失真度', '%', 'thd'),
      metric('A 相电压总谐波失真度', '%', 'thd'),
      metric('B 相电压总谐波失真度', '%', 'thd'),
      metric('C 相电压总谐波失真度', '%', 'thd'),
    ],
  },
  {
    title: '正向有功电量',
    options: [
      metric('有功总电能', 'kWh', 'energy'),
      metric('总有功电量', 'kWh', 'energy'),
      metric('正向有功电量', 'kWh', 'energy'),
      metric('A 相正向有功电量', 'kWh', 'energy'),
      metric('B 相正向有功电量', 'kWh', 'energy'),
      metric('C 相正向有功电量', 'kWh', 'energy'),
      metric('视在正向有功电量', 'kVAh', 'energy'),
      metric('A 相视在正向有功电量', 'kVAh', 'energy'),
      metric('B 相视在正向有功电量', 'kVAh', 'energy'),
      metric('C 相视在正向有功电量', 'kVAh', 'energy'),
      metric('正向有功尖电量', 'kWh', 'energy'),
      metric('正向有功峰电量', 'kWh', 'energy'),
      metric('正向有功平电量', 'kWh', 'energy'),
      metric('正向有功谷电量', 'kWh', 'energy'),
      metric('正向有功深谷电量', 'kWh', 'energy'),
    ],
  },
  {
    title: '反向有功电量',
    options: [
      metric('反向有功电量', 'kWh', 'energy'),
      metric('A 相反向有功电量', 'kWh', 'energy'),
      metric('B 相反向有功电量', 'kWh', 'energy'),
      metric('C 相反向有功电量', 'kWh', 'energy'),
      metric('视在反向有功电量', 'kVAh', 'energy'),
      metric('A 相视在反向有功电量', 'kVAh', 'energy'),
      metric('B 相视在反向有功电量', 'kVAh', 'energy'),
      metric('C 相视在反向有功电量', 'kVAh', 'energy'),
      metric('反向有功尖电量', 'kWh', 'energy'),
      metric('反向有功峰电量', 'kWh', 'energy'),
      metric('反向有功平电量', 'kWh', 'energy'),
      metric('反向有功谷电量', 'kWh', 'energy'),
      metric('反向有功深谷电量', 'kWh', 'energy'),
      metric('反向有功平谷电量', 'kWh', 'energy'),
    ],
  },
  {
    title: '无功与象限电量',
    options: [
      metric('第 1 象限无功电量', 'kvarh', 'energy'),
      metric('第 2 象限无功电量', 'kvarh', 'energy'),
      metric('第 3 象限无功电量', 'kvarh', 'energy'),
      metric('第 4 象限无功电量', 'kvarh', 'energy'),
      metric('正向无功电量', 'kvarh', 'energy'),
      metric('反向无功电量', 'kvarh', 'energy'),
      metric('总无功电量', 'kvarh', 'energy'),
      metric('正向无功尖电量', 'kvarh', 'energy'),
      metric('正向无功峰电量', 'kvarh', 'energy'),
      metric('正向无功平电量', 'kvarh', 'energy'),
      metric('正向无功谷电量', 'kvarh', 'energy'),
      metric('正向无功深谷电量', 'kvarh', 'energy'),
      metric('正向无功平谷电量', 'kvarh', 'energy'),
      metric('反向无功尖电量', 'kvarh', 'energy'),
      metric('反向无功峰电量', 'kvarh', 'energy'),
      metric('反向无功平电量', 'kvarh', 'energy'),
      metric('反向无功谷电量', 'kvarh', 'energy'),
      metric('反向无功深谷电量', 'kvarh', 'energy'),
      metric('反向无功平谷电量', 'kvarh', 'energy'),
    ],
  },
  {
    title: '其他',
    options: [
      metric('剩余电流', 'A', 'current'),
      metric('剩余电量/金额', 'kWh/元', 'residualEnergy'),
    ],
  },
]

/** 名称 → 指标项索引，用于取单位与数值形态 */
export const METRIC_INDEX: Record<string, MetricOption> = Object.fromEntries(
  METRIC_GROUPS.flatMap((group) => group.options.map((item) => [item.name, item])),
)

/** 名称 → 所属指标分组，用于「同一分组内多选」约束 */
export const METRIC_GROUP_OF: Record<string, string> = Object.fromEntries(
  METRIC_GROUPS.flatMap((group) => group.options.map((item) => [item.name, group.title])),
)

export const DEFAULT_METRIC = 'A 相有功功率'

const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR
/** 累计电量的起算时刻，保证任意时间窗口读到的累计读数一致 */
const ENERGY_EPOCH = new Date(2026, 0, 1).getTime()

/** 字符串哈希 → 32 位种子，保证同一设备同一指标的演示数据稳定 */
function hashSeed(text: string) {
  let hash = 2166136261
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

/** mulberry32：轻量确定性随机数 */
function createRandom(seed: number) {
  let value = seed
  return () => {
    value += 0x6d2b79f5
    let next = Math.imul(value ^ (value >>> 15), 1 | value)
    next ^= next + Math.imul(next ^ (next >>> 7), 61 | next)
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296
  }
}

/** 把时间戳对齐到粒度起点（周以周一为起点） */
function floorTo(timestamp: number, granularity: Granularity) {
  const date = new Date(timestamp)
  if (granularity === 'hour') {
    date.setMinutes(0, 0, 0)
    return date.getTime()
  }
  if (granularity === 'day') {
    date.setHours(0, 0, 0, 0)
    return date.getTime()
  }
  if (granularity === 'week') {
    date.setHours(0, 0, 0, 0)
    const offset = (date.getDay() + 6) % 7
    date.setDate(date.getDate() - offset)
    return date.getTime()
  }
  date.setDate(1)
  date.setHours(0, 0, 0, 0)
  return date.getTime()
}

/** 按粒度推进到下一个桶 */
function nextBucket(timestamp: number, granularity: Granularity) {
  const date = new Date(timestamp)
  if (granularity === 'hour') date.setHours(date.getHours() + 1)
  else if (granularity === 'day') date.setDate(date.getDate() + 1)
  else if (granularity === 'week') date.setDate(date.getDate() + 7)
  else date.setMonth(date.getMonth() + 1)
  return date.getTime()
}

/** 桶的横轴标签 */
function labelOf(timestamp: number, granularity: Granularity) {
  const date = new Date(timestamp)
  const month = date.getMonth() + 1
  const day = date.getDate()
  if (granularity === 'hour') {
    return `${month}/${day} ${String(date.getHours()).padStart(2, '0')}:00`
  }
  if (granularity === 'day') return `${month}/${day}`
  if (granularity === 'week') return `${month}/${day} 起`
  return `${date.getFullYear()}/${String(month).padStart(2, '0')}`
}

/** 生成时间桶；最多保留 4000 个点，避免极端范围拖慢渲染 */
function makeBuckets(startMs: number, endMs: number, granularity: Granularity) {
  const start = floorTo(Math.min(startMs, endMs), granularity)
  const end = floorTo(Math.max(startMs, endMs), granularity)
  const list: number[] = []
  let cursor = start
  while (cursor <= end && list.length < 4000) {
    list.push(cursor)
    cursor = nextBucket(cursor, granularity)
  }
  return list
}

/** 单日用电量（kWh）：按日期确定性生成，兼顾工作日 / 周末与季节波动 */
function dayEnergy(deviceId: string, dayMs: number) {
  const date = new Date(dayMs)
  const key = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`
  const random = createRandom(hashSeed(`${deviceId}:energy:${key}`))
  const weekday = date.getDay()
  const weekdayFactor = weekday === 0 || weekday === 6 ? 0.72 : 1
  const seasonFactor = 1 + Math.sin(((date.getMonth() + 1) / 12) * Math.PI * 2 - 1.2) * 0.12
  return (320 + random() * 760) * weekdayFactor * seasonFactor
}

/** 逐日累加，用于周 / 月粒度 */
function sumDayEnergy(deviceId: string, startMs: number, days: number) {
  let total = 0
  for (let index = 0; index < days; index += 1) {
    total += dayEnergy(deviceId, startMs + index * DAY)
  }
  return total
}

/** 24 小时负荷分布，用于把日电量拆分到小时 */
const HOUR_PROFILE = [
  0.2, 0.18, 0.16, 0.16, 0.18, 0.24, 0.36, 0.52, 0.72, 0.9, 1.0, 1.05,
  0.98, 0.9, 0.92, 0.96, 1.0, 1.02, 0.94, 0.82, 0.7, 0.55, 0.4, 0.28,
]
const HOUR_PROFILE_SUM = HOUR_PROFILE.reduce((sum, value) => sum + value, 0)

/** 按所选粒度统计用电量（时 / 日 / 周 / 月） */
export function createEnergySeries(
  deviceId: string,
  startMs: number,
  endMs: number,
  granularity: Granularity,
): Series {
  const points = makeBuckets(startMs, endMs, granularity).map((start) => {
    let value = 0
    if (granularity === 'hour') {
      const hour = new Date(start).getHours()
      value = (dayEnergy(deviceId, floorTo(start, 'day')) * HOUR_PROFILE[hour]) / HOUR_PROFILE_SUM
    } else if (granularity === 'day') {
      value = dayEnergy(deviceId, start)
    } else if (granularity === 'week') {
      value = sumDayEnergy(deviceId, start, 7)
    } else {
      const date = new Date(start)
      const days = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
      value = sumDayEnergy(deviceId, start, days)
    }
    return {
      label: labelOf(start, granularity),
      value: Math.round(value * 10) / 10,
      quality: 'valid' as const,
    }
  })
  return { name: '用电量', color: '#0f7b6c', points }
}

/** 按指标形态给出基准值与波动幅度 */
function baseOf(option: MetricOption, seed: number) {
  const random = createRandom(seed)
  switch (option.kind) {
    case 'voltage':
      return { base: /线电压|AB|BC|CA/.test(option.name) ? 384 : 230, amplitude: 3.2 }
    case 'current':
      return option.name === '剩余电流'
        ? { base: 0.12 + random() * 0.2, amplitude: 0.03 }
        : { base: 8 + random() * 18, amplitude: 2.4 }
    case 'power':
      if (option.unit === 'kVar') return { base: 0.6 + random() * 3.2, amplitude: 0.8 }
      if (option.unit === 'kVA') return { base: 2 + random() * 8, amplitude: 1.8 }
      return { base: 2.5 + random() * 9, amplitude: 1.6 }
    case 'frequency':
      return { base: 50, amplitude: 0.045 }
    case 'phase':
      return { base: 30 + random() * 300, amplitude: 6 }
    case 'powerFactor':
      return { base: 0.86 + random() * 0.1, amplitude: 0.025 }
    case 'thd':
      return { base: 2 + random() * 4, amplitude: 0.9 }
    case 'residualEnergy':
      return { base: 800 + random() * 1600, amplitude: 90 }
    case 'energy':
    default:
      return { base: 12000 + random() * 38000, amplitude: 420 }
  }
}

const DAY_OF_YEAR = (() => {
  const start = new Date(2026, 0, 1).getTime()
  return (timestamp: number) => Math.floor((timestamp - start) / DAY)
})()

/** 指标在某个时间桶的取值：累计电量按绝对时间单调递增，其余为桶内快照 */
function metricValueAt(
  deviceId: string,
  option: MetricOption,
  seed: number,
  timestamp: number,
  granularity: Granularity,
) {
  const { base, amplitude } = baseOf(option, seed)
  const random = createRandom(hashSeed(`${deviceId}:${option.name}:${floorTo(timestamp, granularity)}`))
  const dayIndex = DAY_OF_YEAR(timestamp)
  const hour = new Date(timestamp).getHours()
  const wave = Math.sin((dayIndex / 26) * Math.PI * 2 + (seed % 9)) * amplitude * 0.45
  const noise = (random() - 0.5) * amplitude

  if (option.kind === 'energy') {
    // 累计读数：与绝对时间挂钩，切换时间范围时读数保持连续
    const days = Math.max(0, (timestamp - ENERGY_EPOCH) / DAY)
    const rate = 20 + amplitude * 0.18
    return base + days * rate
  }

  let value = base + wave + noise
  if (option.kind === 'current' || option.kind === 'power') {
    // 叠加日内负荷曲线，让小时粒度更贴近现场用电规律
    const load = 0.62 + 0.38 * Math.max(0, Math.sin(((hour - 5) / 24) * Math.PI))
    value = base * load + wave * 0.5 + noise * 0.5
  }
  if (option.kind === 'powerFactor') value = Math.min(1, Math.max(0.75, value))
  if (option.kind === 'frequency') value = Math.min(50.1, Math.max(49.9, value))
  if (option.kind === 'phase') value = ((value % 360) + 360) % 360
  return value
}

/** 历史数据曲线：按指标与粒度生成序列 */
export function createMetricSeries(
  deviceId: string,
  metricName: string,
  startMs: number,
  endMs: number,
  granularity: Granularity,
): Series {
  const option = METRIC_INDEX[metricName] ?? METRIC_INDEX[DEFAULT_METRIC]
  const seed = hashSeed(`${deviceId}:${metricName}`)
  const points = makeBuckets(startMs, endMs, granularity).map((start) => ({
    label: labelOf(start, granularity),
    value: Math.round(metricValueAt(deviceId, option, seed, start, granularity) * 100) / 100,
    quality: 'valid' as const,
  }))
  return { name: option.name, color: '#0f7b6c', points }
}

/** 数值格式化：按量级保留合适小数位 */
export function formatMetricValue(value: number | null, unit: string) {
  if (value === null || !Number.isFinite(value)) return '—'
  const digits = unit === '' || unit === 'Hz' ? 3 : 2
  return value.toLocaleString('zh-CN', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
}

/** 序列统计：末值 / 均值 / 峰值，供卡片头部摘要 */
export function summarizeSeries(series: Series) {
  const values = series.points
    .map((point) => point.value)
    .filter((value): value is number => value !== null && Number.isFinite(value))
  if (!values.length) return { last: null, average: null, max: null, total: null }
  const total = values.reduce((sum, value) => sum + value, 0)
  return {
    last: values[values.length - 1],
    average: total / values.length,
    max: Math.max(...values),
    total,
  }
}
