import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

// 部署到 GitHub Pages 时站点位于子路径 /SmartEnergyPlatform/，本地开发保持根路径。
// 构建工作流通过 VITE_BASE 注入，默认 '/'。
const base = process.env.VITE_BASE ?? '/'

export default defineConfig({
  base,
  plugins: [vue()],
  resolve: {
    alias: {
      '@': resolve(import.meta.dirname, 'src'),
    },
  },
  server: {
    host: true,
    port: 5173,
    open: false,
  },
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          maxSize: 400 * 1024,
          groups: [
            { name: 'vue', test: /node_modules[\\/](vue|vue-router|@vue|@antdv-next[\\/]cssinjs)[\\/]/ },
            { name: 'v-c', test: /node_modules[\\/]@v-c[\\/]/ },
            { name: 'antdv-next', test: /node_modules[\\/](antdv-next|@antdv-next)[\\/]/ },
            { name: 'vendor', test: /node_modules[\\/]/ },
          ],
        },
      },
    },
  },
})
