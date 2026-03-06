import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '../src'),
    },
  },
  test: {
    environment: 'jsdom',
    include: ['src/canvas/components/__tests__/OutputsDock.dom.spec.tsx'],
    exclude: [],
    globals: true,
    setupFiles: ['tests/setup/rtl.ts'],
  },
})
