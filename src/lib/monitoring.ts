// Production monitoring: Sentry, Web Vitals, Hotjar, PostHog
import * as Sentry from '@sentry/react'
import { onCLS, onLCP, onINP, type Metric } from 'web-vitals'
import { logger } from './logger'
import type { MonitoringConfig, HotjarWindow, SentryContext } from '../types/monitoring'
import { initPostHog } from './posthog'
import { trackMeasurement } from '../telemetry/measurementEvents'
import { resolveParticipantTag } from '../telemetry/measurementConfig'

/**
 * The named env values this module reads, captured as LITERAL
 * `import.meta.env?.VITE_…` reads.
 *
 * ⚠ Do NOT collapse this back to a bare `import.meta.env` reference (the previous
 * default parameter was `env = import.meta.env`). Vite cannot statically narrow a
 * bare reference, so it inlined the ENTIRE env object — every `VITE_*` the deploy
 * defines, with its value — into this module's chunk. Named reads are narrowed to
 * exactly the five values below. Pinned by
 * `scripts/ci/assert-bundle-env-allowlist.mjs`.
 *
 * The injectable `env` parameter is preserved verbatim: it is the unit-test seam
 * (`resolveMonitoringConfig({ MODE: 'production', … })`), and callers that pass an
 * explicit env are unaffected.
 */
function monitoringEnvDefaults(): Record<string, unknown> {
  return {
    MODE: import.meta.env?.MODE,
    VITE_SENTRY_DSN: import.meta.env?.VITE_SENTRY_DSN,
    VITE_HOTJAR_ID: import.meta.env?.VITE_HOTJAR_ID,
    VITE_ENABLE_WEB_VITALS: import.meta.env?.VITE_ENABLE_WEB_VITALS,
    VITE_RELEASE_VERSION: import.meta.env?.VITE_RELEASE_VERSION,
  }
}

export function resolveMonitoringConfig(
  env: Record<string, unknown> = monitoringEnvDefaults(),
): MonitoringConfig {
  // Cast, not a behaviour change: the parameter type widened from Vite's
  // `ImportMetaEnv` to `Record<string, unknown>` when the bare-`import.meta.env`
  // default was replaced with named reads. `|| 'production'` is preserved verbatim.
  const environment = (env.MODE as string | undefined) || 'production'
  const isProdLike = environment !== 'development' && environment !== 'test'
  const dsn = env.VITE_SENTRY_DSN as string | undefined
  const hotjarId = env.VITE_HOTJAR_ID as string | undefined
  const hotjarIdValid = hotjarId ? /^[0-9]{6,9}$/.test(hotjarId) : false

  return {
    enabled: {
      sentry: isProdLike && !!dsn,
      webVitals: isProdLike && env.VITE_ENABLE_WEB_VITALS !== 'false',
      hotjar: isProdLike && hotjarIdValid,
    },
    dsn,
    hotjarId: hotjarIdValid ? hotjarId : undefined,
    environment,
    release: env.VITE_RELEASE_VERSION as string | undefined,
  }
}

function sanitizeForMonitoring(text: string): string {
  return text.length > 100 ? text.slice(0, 97) + '...' : text
}

export function initSentry(): void {
  const config = resolveMonitoringConfig()
  if (!config.enabled.sentry) {
    logger.debug('[Monitoring] Sentry disabled')
    return
  }

  try {
    Sentry.init({
      dsn: config.dsn,
      environment: config.environment,
      release: config.release,
      tracesSampleRate: 0.1,
      ignoreErrors: ['top.GLOBALS', 'chrome-extension://', 'NetworkError'],
      beforeSend(event) {
        if (event.contexts?.canvas) {
          const canvas = event.contexts.canvas as Record<string, unknown>
          if (typeof canvas.label === 'string') {
            canvas.label = sanitizeForMonitoring(canvas.label)
          }
        }
        if (event.breadcrumbs) {
          event.breadcrumbs = event.breadcrumbs.map(crumb => {
            if (crumb.data && 'localStorage' in crumb.data) {
              return { ...crumb, data: { ...crumb.data, localStorage: '[REDACTED]' } }
            }
            return crumb
          })
        }
        return event
      },
    })
    logger.info('[Monitoring] Sentry initialized', { environment: config.environment, release: config.release })
  } catch (error) {
    logger.error('[Monitoring] Sentry init failed', error)
  }
}

export function captureError(error: Error, context?: SentryContext): void {
  const config = resolveMonitoringConfig()
  if (!config.enabled.sentry) {
    logger.error('[Monitoring] Error (Sentry disabled):', error, context)
    return
  }

  Sentry.withScope(scope => {
    if (context) {
      const sanitized = { ...context }
      if (typeof sanitized.label === 'string') {
        sanitized.label = sanitizeForMonitoring(sanitized.label)
      }
      scope.setContext('canvas', sanitized)
    }
    Sentry.captureException(error)
  })
}

export function initWebVitals(): void {
  const config = resolveMonitoringConfig()
  if (!config.enabled.webVitals) {
    logger.debug('[Monitoring] Web Vitals disabled')
    return
  }

  const sendToAnalytics = (metric: Metric) => {
    if (config.enabled.sentry) {
      Sentry.setMeasurement(metric.name, metric.value, metric.rating)
    }
    logger.debug('[Web Vitals]', { name: metric.name, value: metric.value, rating: metric.rating })
  }

  onCLS(sendToAnalytics)
  onLCP(sendToAnalytics)
  try { onINP(sendToAnalytics) } catch {}
  logger.info('[Monitoring] Web Vitals initialized')
}

export function initHotjar(): void {
  const config = resolveMonitoringConfig()
  if (!config.enabled.hotjar) {
    logger.debug('[Monitoring] Hotjar disabled')
    return
  }

  if (navigator.doNotTrack === '1' || (window as { doNotTrack?: string }).doNotTrack === '1') {
    logger.info('[Monitoring] Hotjar disabled (DNT enabled)')
    return
  }

  const w = window as unknown as HotjarWindow
  w.hj = w.hj || function(...args: unknown[]) { (w.hj!.q = w.hj!.q || []).push(args) }
  w._hjSettings = { hjid: parseInt(config.hotjarId!), hjsv: 6 }

  const script = document.createElement('script')
  script.async = true
  script.referrerPolicy = 'no-referrer'
  script.crossOrigin = 'anonymous'
  script.src = `https://static.hotjar.com/c/hotjar-${w._hjSettings.hjid}.js?sv=${w._hjSettings.hjsv}`
  document.getElementsByTagName('head')[0]?.appendChild(script)
  logger.info('[Monitoring] Hotjar initialized', { id: config.hotjarId })
}

export function setSentryUser(userId: string, email: string): void {
  Sentry.setUser({ id: userId, email })
}

export function clearSentryUser(): void {
  Sentry.setUser(null)
}

export function initMonitoring(): void {
  initSentry()
  initWebVitals()
  initHotjar()
  initPostHog()

  // ── session_started (ROADMAP 1.68) ──────────────────────────────────────
  //
  // The anchor every duration measure is relative to. Paired with the
  // re-routed `run_completed` it gives time-to-first-insight for free.
  //
  // Emitted AFTER initPostHog so the SDK is initialised — `trackEvent` returns
  // early otherwise and this would be the first event silently lost.
  //
  // NEVER-CAPTURE: no user id, no email, no display name. `participant_tag` is
  // a pseudonym from `measurementConfig` (null while the vocabulary is empty,
  // which is the shipped state), and the two env values are non-secret deploy
  // labels already on the bundle allowlist. Named LITERAL reads, per this
  // module's own narrowing rule above.
  trackMeasurement('session_started', {
    participant_tag: resolveParticipantTag(),
    build_id: (import.meta.env?.VITE_BUILD_ID as string | undefined) ?? 'unknown',
    auth_mode: (import.meta.env?.VITE_AUTH_MODE as string | undefined) ?? 'unknown',
  })
}

export function isMonitoringEnabled(): boolean {
  const config = resolveMonitoringConfig()
  return config.enabled.sentry || config.enabled.webVitals || config.enabled.hotjar
}
