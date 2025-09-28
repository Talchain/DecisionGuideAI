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
    testTimeout: 10000,
    watch: false,
    reporters: ['default'],
    css: false,
    setupFiles: [],
    passWithNoTests: true,
  },
})
