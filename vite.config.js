import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0', // 添加这一行
    port: 5173,      // 确保端口固定为 5173，防止自动跳到 5174
  }
})
