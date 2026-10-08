<template>
  <!--
    【原型说明】企业 Logo 徽标（「选择登录企业」页 / 顶栏「企业切换」组件触发区与浮层企业项三处共用）。
    对齐《产品交互设计文档-企业中心》v1.0 的 COMP-ENT-02：
    有 Logo 时按正方形展示同一张图片；无 Logo、已删除或图片加载失败时回退为
    「品牌渐变底 + 企业名称首字」，三处回退规则一致，仅尺寸与圆角不同。
    企业中心本页是 Logo 的维护入口，无值时展示「未上传 Logo」空态、不使用本组件。
  -->
  <span
    class="ent-badge"
    :class="{ 'ent-badge--fallback': !showImage }"
    :style="badgeStyle"
    aria-hidden="true"
  >
    <img v-if="showImage" :src="logo" :alt="''" class="ent-badge__img" @error="handleError" />
    <template v-else>{{ initial }}</template>
  </span>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'

const props = withDefaults(
  defineProps<{
    /** 企业 Logo 图片地址；空串表示未上传 */
    logo?: string
    /** 企业名称，用于取首字回退 */
    name?: string
    /** 徽标边长（正方形），三处分别为 64 / 44 / 24 / 20 */
    size?: number
    /** 圆角 */
    radius?: number
    /** 首字字号；不传时按边长自动推算 */
    fontSize?: number
  }>(),
  { logo: '', name: '', size: 44, radius: 6, fontSize: 0 },
)

/** 图片加载失败时回退首字徽标（EX-ENT-11） */
const failed = ref(false)
watch(
  () => props.logo,
  () => {
    failed.value = false
  },
)

const showImage = computed(() => Boolean(props.logo) && !failed.value)
const initial = computed(() => props.name.trim().slice(0, 1) || '企')

const badgeStyle = computed(() => ({
  width: `${props.size}px`,
  height: `${props.size}px`,
  borderRadius: `${props.radius}px`,
  fontSize: `${props.fontSize || Math.round(props.size * 0.42)}px`,
}))

function handleError() {
  failed.value = true
}
</script>
