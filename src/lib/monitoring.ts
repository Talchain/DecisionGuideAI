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
 * exactly the six values below. Pinned by
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
    VITE_SENTRY_ENVIRONMENT: import.meta.env?.VITE_SENTRY_ENVIRONMENT,
  }
}

export function resolveMonitoringConfig(
  env: Record<string, unknown> = monitoringEnvDefaults(),
): MonitoringConfig {
  // Cast: the parameter type widened from Vite's `ImportMetaEnv` to
  // `Record<string, unknown>` when the bare-`import.meta.env` default was
  // replaced with named reads. `mode` (with its `|| 'production'` default)
  // only GATES monitoring; it no longer labels events (S-H, see below).
  const mode = (env.MODE as string | undefined) || 'production'
  const isProdLike = mode !== 'development' && mode !== 'test'
  // The Sentry LABEL is not the Vite mode: every deployed build (staging AND
  // production) is MODE=production, so labelling by mode tagged staging events
  // "production". The label comes from the Netlify deploy context
  // (netlify.toml sets VITE_SENTRY_ENVIRONMENT per branch context). A
  // prod-like build with no label says so rather than claiming "production".
  const label = (env.VITE_SENTRY_ENVIRONMENT as string | undefined)?.trim()
  const environment = isProdLike ? label || UNLABELLED_ENVIRONMENT : mode
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
    release: resolveRelease(env),
  }
}

/** Sentry environment for a deployed build whose deploy context set no label. */
export const UNLABELLED_ENVIRONMENT = 'unlabelled'

const FULL_SHA = /^[0-9a-f]{40}$/

/**
 * Release = the full build SHA. The ONE owner is scripts/build-id.mjs, which
 * stamps it into `<meta name="x-build-id">` of the document this tab loaded
 * (COMMIT_REF → GITHUB_SHA → git HEAD). An explicit VITE_RELEASE_VERSION
 * still wins. Anything that is not a full SHA is not a release.
 */
function resolveRelease(env: Record<string, unknown>): string | undefined {
  const explicit = (env.VITE_RELEASE_VERSION as string | undefined)?.trim()
  if (explicit) return explicit
  if (typeof document === 'undefined') return undefined
  const stamped = document.querySelector<HTMLMetaElement>('meta[name="x-build-id"]')?.content?.trim().toLowerCase()
  return stamped && FULL_SHA.test(stamped) ? stamped : undefined
}

/**
 * KNOWN NOISE, matched by EXACT message (anchored), never by substring.
 *
 * The previous `ignoreErrors: ['top.GLOBALS', 'chrome-extension://',
 * 'NetworkError']` was a SUBSTRING list: 'NetworkError' discarded Firefox's
 * "NetworkError when attempting to fetch resource." — a real failed request —
 * and 1,972 error events were dropped client-side from 4–7 Oct with no way to
 * see what they were. Dropping here (beforeSend) instead of in the SDK's event
 * filters also makes every drop ATTRIBUTABLE: Sentry's client reports count
 * these as reason `before_send`, separate from any SDK processor drop.
 */
export const KNOWN_NOISE_MESSAGES: readonly RegExp[] = [
  /^ResizeObserver loop completed with undelivered notifications\.?$/,
  /^ResizeObserver loop limit exceeded$/,
  /^Script error\.?$/,
]

/** Errors thrown from a browser extension's own code (frame URL, not message). */
const EXTENSION_FRAME = /^(?:chrome|moz|safari|safari-web)-extension:\/\//

type NoiseCandidate = {
  message?: string
  exception?: { values?: Array<{ type?: string; value?: string; stacktrace?: { frames?: Array<{ filename?: string }> } }> }
}

export function isKnownNoise(event: NoiseCandidate): boolean {
  const values = event.exception?.values ?? []
  const messages: string[] = []
  if (typeof event.message === 'string') messages.push(event.message)
  for (const v of values) if (typeof v.value === 'string') messages.push(v.value)
  if (messages.some((m) => KNOWN_NOISE_MESSAGES.some((re) => re.test(m)))) return true
  const frames = values.flatMap((v) => v.stacktrace?.frames ?? [])
  return frames.length > 0 && frames.every((f) => typeof f.filename === 'string' && EXTENSION_FRAME.test(f.filename))
}

type CrumbLike = {
  type?: string
  category?: string
  level?: string
  timestamp?: number
  message?: string
  data?: Record<string, unknown>
}
type DomHint = { event?: { target?: unknown } } | undefined

/** A URL with its query string and fragment removed (queries can carry content). */
function stripQuery(url: unknown): unknown {
  if (typeof url !== 'string') return url
  const cut = url.search(/[?#]/)
  return cut === -1 ? url : url.slice(0, cut)
}

/**
 * A DOM element described WITHOUT user text: tag + classes for the target and
 * up to four ancestors. No ids (node ids are label-derived slugs) and no
 * attributes (Sentry's default selector includes aria-label / title / alt,
 * which carry node and option labels on the canvas).
 */
function describeElementSafely(target: unknown): string | undefined {
  if (typeof Element === 'undefined' || !(target instanceof Element)) return undefined
  const parts: string[] = []
  let el: Element | null = target
  for (let depth = 0; el && depth < 5; depth += 1, el = el.parentElement) {
    const classes = Array.from(el.classList).slice(0, 3).filter((c) => /^[A-Za-z_-][\w-]{0,40}$/.test(c))
    parts.unshift([el.tagName.toLowerCase(), ...classes].join('.'))
  }
  return parts.join(' > ')
}

/**
 * Breadcrumb privacy rule (same contract as CEE / PLoT / ISL): a crumb keeps
 * only its SHAPE, never free text.
 *  - console crumbs are dropped;
 *  - ui.* crumbs get a text-free element description as their message;
 *  - every other crumb loses its message, and its data is cut to
 *    { method, url, status_code, from, to } with query strings stripped.
 */
export function scrubBreadcrumb<T extends CrumbLike>(crumb: T, hint?: DomHint): T | null {
  if (crumb.category === 'console') return null
  const out = { type: crumb.type, category: crumb.category, level: crumb.level, timestamp: crumb.timestamp } as T
  if (typeof crumb.category === 'string' && crumb.category.startsWith('ui.')) {
    out.message = describeElementSafely(hint?.event?.target) ?? '[element]'
    return out
  }
  const data = crumb.data
  if (data && typeof data === 'object') {
    const kept: Record<string, unknown> = {}
    if (typeof data.method === 'string') kept.method = data.method
    if (typeof data.status_code === 'number') kept.status_code = data.status_code
    for (const key of ['url', 'from', 'to'] as const) {
      if (data[key] !== undefined) kept[key] = stripQuery(data[key])
    }
    out.data = kept
  }
  return out
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
      sendDefaultPii: false,
      initialScope: { tags: { service: 'ui' } },
      // Known noise is dropped in beforeSend by exact message (see
      // KNOWN_NOISE_MESSAGES); the SDK's own default message filters are
      // switched off so nothing else is discarded unseen.
      integrations: [Sentry.eventFiltersIntegration({ disableErrorDefaults: true })],
      beforeBreadcrumb(breadcrumb, hint) {
        return scrubBreadcrumb(breadcrumb, hint as DomHint)
      },
      beforeSend(event) {
        if (isKnownNoise(event)) return null
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

/**
 * Pseudonymous id only. The email is accepted for call-site compatibility and
 * deliberately NOT sent: Sentry is a third-party ingest, and the id is enough
 * to group one person's errors.
 */
export function setSentryUser(userId: string, _email?: string): void {
  Sentry.setUser({ id: userId })
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
