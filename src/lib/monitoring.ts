// Production monitoring: Sentry, Web Vitals, Hotjar
// Only active in production; respects env flags

import * as Sentry from '@sentry/react'
import { onCLS, onLCP, onINP, type Metric } from 'web-vitals'

interface MonitoringConfig {
  sentryDsn?: string
  hotjarId?: string
  environment: string
  release?: string
  enableSentry: boolean
  enableWebVitals: boolean
  enableHotjar: boolean
}

function getConfig(): MonitoringConfig {
  const isDev = import.meta.env.DEV
  const isTest = import.meta.env.MODE === 'test'
  
  return {
    sentryDsn: import.meta.env.VITE_SENTRY_DSN,
    hotjarId: import.meta.env.VITE_HOTJAR_ID,
    environment: import.meta.env.MODE || 'production',
    release: import.meta.env.VITE_RELEASE_VERSION,
    enableSentry: !isDev && !isTest && !!import.meta.env.VITE_SENTRY_DSN,
    enableWebVitals: !isDev && !isTest,
    enableHotjar: !isDev && !isTest && !!import.meta.env.VITE_HOTJAR_ID,
  }
}

/**
 * Sanitize label for monitoring (PII safety)
 * Redact labels longer than 100 chars
 */
function sanitizeForMonitoring(text: string): string {
  if (text.length > 100) {
    return text.slice(0, 97) + '...'
  }
  return text
}

/**
 * Initialize Sentry error tracking
 */
export function initSentry(): void {
  const config = getConfig()
  
  if (!config.enableSentry) {
    console.log('[Monitoring] Sentry disabled (dev/test or missing DSN)')
    return
  }

  Sentry.init({
    dsn: config.sentryDsn,
    environment: config.environment,
    release: config.release,
    
    // Performance monitoring
    tracesSampleRate: 0.1, // 10% of transactions
    
    // Session replay (optional)
    replaysSessionSampleRate: 0.0, // Disabled by default
    replaysOnErrorSampleRate: 1.0, // 100% of error sessions
    
    // Integrations configured via Sentry.init defaults
    // BrowserTracing and Replay require @sentry/tracing package
    
    // Filter out noise
    ignoreErrors: [
      // Browser extensions
      'top.GLOBALS',
      'chrome-extension://',
      'moz-extension://',
      // Network errors
      'NetworkError',
      'Failed to fetch',
    ],
    
    beforeSend(event) {
      // Sanitize user-provided data
      if (event.contexts?.canvas) {
        const canvas = event.contexts.canvas as Record<string, unknown>
        if (typeof canvas.label === 'string') {
          canvas.label = sanitizeForMonitoring(canvas.label)
        }
      }
      
      // Redact localStorage keys
      if (event.breadcrumbs) {
        event.breadcrumbs = event.breadcrumbs.map(crumb => {
          if (crumb.data && typeof crumb.data === 'object') {
            const data = { ...crumb.data }
            if ('localStorage' in data) {
              data.localStorage = '[REDACTED]'
            }
            return { ...crumb, data }
          }
          return crumb
        })
      }
      
      return event
    },
  })

  console.log('[Monitoring] Sentry initialized', {
    environment: config.environment,
    release: config.release,
  })
}

/**
 * Capture error to Sentry with context
 */
export function captureError(
  error: Error,
  context?: Record<string, unknown>
): void {
  const config = getConfig()
  
  if (!config.enableSentry) {
    console.error('[Monitoring] Error (Sentry disabled):', error, context)
    return
  }

  Sentry.withScope(scope => {
    if (context) {
      // Sanitize context
      const sanitized = { ...context }
      if (typeof sanitized.label === 'string') {
        sanitized.label = sanitizeForMonitoring(sanitized.label)
      }
      scope.setContext('canvas', sanitized)
    }
    Sentry.captureException(error)
  })
}

/**
 * Initialize Web Vitals monitoring
 */
export function initWebVitals(): void {
  const config = getConfig()
  
  if (!config.enableWebVitals) {
    console.log('[Monitoring] Web Vitals disabled (dev/test)')
    return
  }

  const sendToAnalytics = (metric: Metric) => {
    // Send to Sentry as custom metric
    if (config.enableSentry) {
      Sentry.setMeasurement(metric.name, metric.value, metric.rating)
    }

    // Log for debugging (can be sent to Datadog/GA)
    console.log('[Web Vitals]', {
      name: metric.name,
      value: metric.value,
      rating: metric.rating,
      delta: metric.delta,
    })

    // Optional: Send to custom endpoint
    // navigator.sendBeacon('/api/vitals', JSON.stringify(metric))
  }

  // Core Web Vitals
  onCLS(sendToAnalytics)
  onLCP(sendToAnalytics)
  
  // Interaction to Next Paint (Chrome 96+)
  try {
    onINP(sendToAnalytics)
  } catch {
    // INP not available in older browsers
  }

  console.log('[Monitoring] Web Vitals initialized')
}

/**
 * Initialize Hotjar (or similar analytics)
 */
export function initHotjar(): void {
  const config = getConfig()
  
  if (!config.enableHotjar) {
    console.log('[Monitoring] Hotjar disabled (dev/test or missing ID)')
    return
  }

  // Respect Do Not Track
  if (navigator.doNotTrack === '1') {
    console.log('[Monitoring] Hotjar disabled (DNT enabled)')
    return
  }

  // Inject Hotjar script
  const hotjarId = config.hotjarId
  if (!hotjarId) return

  // Inject Hotjar script with proper typing
  interface HotjarWindow extends Window {
    hj?: {
      (...args: unknown[]): void
      q?: unknown[]
    }
    _hjSettings?: { hjid: number; hjsv: number }
  }
  
  const w = window as unknown as HotjarWindow
  w.hj = w.hj || function(...args: unknown[]) {
    (w.hj!.q = w.hj!.q || []).push(args)
  }
  w._hjSettings = { hjid: parseInt(hotjarId), hjsv: 6 }
  
  const script = document.createElement('script')
  script.async = true
  script.src = `https://static.hotjar.com/c/hotjar-${w._hjSettings.hjid}.js?sv=${w._hjSettings.hjsv}`
  document.getElementsByTagName('head')[0]?.appendChild(script)

  console.log('[Monitoring] Hotjar initialized', { id: hotjarId })
}

/**
 * Initialize all monitoring services
 * Call this once at app startup
 */
export function initMonitoring(): void {
  initSentry()
  initWebVitals()
  initHotjar()
}

/**
 * Check if monitoring is enabled (for tests)
 */
export function isMonitoringEnabled(): boolean {
  const config = getConfig()
  return config.enableSentry || config.enableWebVitals || config.enableHotjar
}
