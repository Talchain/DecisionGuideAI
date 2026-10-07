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
  hostname: string | undefined = typeof location === 'undefined' ? undefined : location.hostname,
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
  // A Netlify Deploy Preview is a preview whatever its branch: branch
  // contexts in netlify.toml outrank the deploy-preview context, so a preview
  // built from manual-test would otherwise claim "production".
  const isDeployPreview = typeof hostname === 'string' && /^deploy-preview-\d{1,6}--/.test(hostname)
  const label = (env.VITE_SENTRY_ENVIRONMENT as string | undefined)?.trim()
  const environment = !isProdLike ? mode : isDeployPreview ? PREVIEW_ENVIRONMENT : label || UNLABELLED_ENVIRONMENT
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

/** Sentry environment for a Netlify Deploy Preview (deploy-preview-N--site). */
export const PREVIEW_ENVIRONMENT = 'preview'

const FULL_SHA = /^[0-9a-f]{40}$/

/**
 * Release = the full build SHA. The ONE owner is scripts/build-id.mjs, which
 * stamps it into `<meta name="x-build-id">` of the document this tab loaded
 * (COMMIT_REF → GITHUB_SHA → git HEAD), and it WINS: nothing else names the
 * build this tab loaded. VITE_RELEASE_VERSION is used only with no stamp.
 */
function resolveRelease(env: Record<string, unknown>): string | undefined {
  const stamped =
    typeof document === 'undefined'
      ? undefined
      : document.querySelector<HTMLMetaElement>('meta[name="x-build-id"]')?.content?.trim().toLowerCase()
  if (stamped && FULL_SHA.test(stamped)) return stamped
  // No stamped SHA (dev server, tests): an explicit label is the only identity.
  return (env.VITE_RELEASE_VERSION as string | undefined)?.trim() || undefined
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
  // Noise only when EVERY message is noise: a chain whose cause is a
  // ResizeObserver loop but whose outer error is real must be kept.
  if (messages.length > 0 && messages.every((m) => KNOWN_NOISE_MESSAGES.some((re) => re.test(m)))) return true
  // Extension origin must be PROVEN for every exception in the chain: each
  // value needs frames, all from an extension. A value with no frames (or an
  // app frame) keeps the whole event.
  return (
    values.length > 0 &&
    values.every((v) => {
      const frames = v.stacktrace?.frames ?? []
      return frames.length > 0 && frames.every((f) => typeof f.filename === 'string' && EXTENSION_FRAME.test(f.filename))
    })
  )
}

/**
 * Context fields captureError may send (`canvas` context). `label` is a
 * component IDENTITY ('PanelErrorBoundary:inspector', 'canvas.layout.failed')
 * and is sent only in that namespaced, space-free shape; anything else is
 * treated as possible user text and replaced.
 */
const CANVAS_CONTEXT_FIELDS: ReadonlySet<string> = new Set([
  'component', 'label', 'componentStack', 'errorInfo', 'nodeCount', 'scenarioId',
  'migration', 'validation', 'isRecurring', 'errorCount',
])
const IDENTITY_LABEL = /^[A-Za-z][\w-]{0,60}(?:[.:][\w-]{1,60}){1,4}$/

/** Contexts the SDK (or @sentry/react) fills, plus DGAI's own `canvas`. */
const ALLOWED_CONTEXTS: ReadonlySet<string> = new Set([
  'trace', 'react', 'canvas', 'culture', 'os', 'browser', 'device', 'runtime', 'app', 'cloud_resource',
])

export function sanitizeCanvasContext(ctx: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(ctx)) {
    if (!CANVAS_CONTEXT_FIELDS.has(k)) continue
    if (k === 'label') out.label = typeof v === 'string' && IDENTITY_LABEL.test(v) ? v : '[redacted]'
    else out[k] = typeof v === 'string' ? sanitizeForMonitoring(v) : v
  }
  return out
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
      // - InboundFilters: same NAME as the SDK default, so it REPLACES it
      //   (eventFiltersIntegration is named 'EventFilters' and would run
      //   alongside the default, which still drops noise as event_processor).
      // - Dedupe removed: it runs BEFORE beforeSend, so a real error whose
      //   cause matches a just-dropped noise event was swallowed unseen. A
      //   repeated real error now arrives twice and Sentry groups it.
      integrations: (defaults) => [
        ...defaults.filter((i) => i.name !== 'Dedupe' && i.name !== 'InboundFilters'),
        Sentry.inboundFiltersIntegration({ disableErrorDefaults: true }),
      ],
      beforeBreadcrumb(breadcrumb, hint) {
        return scrubBreadcrumb(breadcrumb, hint as DomHint)
      },
      beforeSend(event) {
        if (isKnownNoise(event)) return null
        if (event.contexts) {
          for (const key of Object.keys(event.contexts)) {
            if (!ALLOWED_CONTEXTS.has(key)) delete event.contexts[key]
          }
          if (event.contexts.canvas) {
            event.contexts.canvas = sanitizeCanvasContext(event.contexts.canvas as Record<string, unknown>)
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
      scope.setContext('canvas', sanitizeCanvasContext({ ...context }))
    }
    Sentry.captureException(error)
  })
}

/**
 * The chat turn transport's failure report (S-F). The turn's identifiers travel as TAGS: the `canvas` context is cut to
 * `CANVAS_CONTEXT_FIELDS` by `sanitizeCanvasContext` (S-H, #2606), which would drop them, and tags are searchable.
 * Identifiers only — never user text.
 */
export function captureTurnFailure(
  error: Error,
  report: { tags: Record<string, string>; scenarioId: string | null; elapsedMs: number },
): void {
  const config = resolveMonitoringConfig()
  if (!config.enabled.sentry) {
    logger.error('[Monitoring] Chat turn failure (Sentry disabled):', error, report.tags)
    return
  }
  Sentry.withScope(scope => {
    scope.setContext('canvas', sanitizeCanvasContext({ component: 'chat-turn', scenarioId: report.scenarioId }))
    scope.setTags(report.tags)
    scope.setExtra('elapsed_ms', report.elapsedMs)
    Sentry.captureException(error)
  })
}

/**
 * A breadcrumb on the trail a later captured error carries (S-F: a chip press, a turn starting). `scrubBreadcrumb`
 * (S-H) keeps only its category, so it records THAT a chip was pressed / a turn started, never what. No-op when Sentry
 * is disabled.
 */
export function addBreadcrumb(category: string, message: string, data?: Record<string, unknown>): void {
  if (!resolveMonitoringConfig().enabled.sentry) return
  Sentry.addBreadcrumb({ category, message, data, level: 'info' })
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
