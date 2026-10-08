<template>
  <a-config-provider :locale="zhCN" :theme="themeConfig">
    <a-app>
      <router-view />
    </a-app>
  </a-config-provider>
</template>

<script setup lang="ts">
import { theme } from 'antdv-next'
import zhCN from 'antdv-next/locale/zh_CN'

const themeConfig = {
  token: {
    colorPrimary: '#0f7b6c',
    borderRadius: 6,
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", "Helvetica Neue", Arial, sans-serif',
  },
  /**
   * 【原型说明】组织架构树按交互文档 3.1 / 4.1.2 调整：节点行高 32px、每级缩进 16px、
   * 选中底色 #ecf4f3 配主色文字、悬停底色 #f5f7fa。
   */
  components: {
    Tree: {
      titleHeight: 32,
      switcherSize: 16,
      indentSize: 16,
      nodeSelectedBg: '#ecf4f3',
      nodeSelectedColor: '#0f7b6c',
      nodeHoverBg: '#f5f7fa',
    },
  },
  algorithm: theme.defaultAlgorithm,
}
</script>
