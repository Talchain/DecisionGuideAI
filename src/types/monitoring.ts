// src/types/monitoring.ts
// Strong types for monitoring configuration and payloads

export interface MonitoringConfig {
  enabled: {
    sentry: boolean
    webVitals: boolean
    hotjar: boolean
  }
  dsn?: string
  hotjarId?: string
  environment: string
  release?: string
}

export interface HotjarWindow extends Window {
  hj?: {
    (...args: unknown[]): void
    q?: unknown[]
  }
  _hjSettings?: {
    hjid: number
    hjsv: number
  }
}

export interface WebVitalsPayload {
  name: string
  value: number
  rating: 'good' | 'needs-improvement' | 'poor'
  delta: number
  id: string
  navigationType: string
}

export interface SentryContext {
  component?: string
  errorInfo?: string
  label?: string
  [key: string]: unknown
}
