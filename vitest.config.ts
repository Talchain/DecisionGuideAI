import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: [
      'src/**/__tests__/**/*.{test,spec}.?(c|m)[jt]s?(x)',
      'src/**/tests/**/*.{test,spec}.?(c|m)[jt]s?(x)',
      'tests/**/*.{test,spec}.?(c|m)[jt]s?(x)'
    ],
    exclude: [
      'src/__tests__/sanity.test.ts'
    ],
    environment: 'jsdom',
    watch: false,
    reporters: ['default'],
    css: false,
    setupFiles: ['tests/setup/rtl.ts'],
    restoreMocks: true,
    clearMocks: true,
    mockReset: true,
    isolate: true,
    passWithNoTests: true,
  },
})
