// e2e/global.d.ts
// Global type declarations for E2E tests

interface Window {
  __webVitals?: {
    lcp?: number
    cls?: number
    fcp?: number
    inp?: number
    fid?: number
  }
  __testGraph?: {
    nodes: any[]
    edges: any[]
  }
  __fpsData?: {
    frames: number
    startTime: number
    duration: number
  }
  __longTasks?: Array<{
    duration: number
    startTime: number
  }>
  showToast?: (options: { message: string; duration: number }) => void
}
