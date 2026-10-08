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
        // 注意：不要设置 codeSplitting.maxSize。
        // 它会把 vue 等存在相互依赖的模块组再拆成多个 chunk，导致运行期初始化顺序错乱，
        // 构建产物在浏览器中抛 TypeError（Array.filter 收到 undefined）并白屏。
        codeSplitting: {
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
