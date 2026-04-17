/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Proxy Yahoo Finance requests in dev to avoid CORS
      '/yf-proxy': {
        target: 'https://query1.finance.yahoo.com',
        changeOrigin: true,
        rewrite: path => path.replace(/^\/yf-proxy/, ''),
      },
      // Proxy TradingView scanner requests in dev to avoid CORS
      '/tv-proxy': {
        target: 'https://scanner.tradingview.com',
        changeOrigin: true,
        rewrite: path => path.replace(/^\/tv-proxy/, ''),
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.js',
  },
})
