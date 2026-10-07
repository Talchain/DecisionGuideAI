/**
 * Sentry reporting contract (system S-H) — UI half.
 *
 * Same contract as CEE, PLoT and ISL:
 *   1. environment = the deploy context's label (VITE_SENTRY_ENVIRONMENT from
 *      netlify.toml), never the Vite mode — every deployed build is
 *      MODE=production, which tagged staging events "production";
 *   2. release = the full build SHA stamped into <meta name="x-build-id">;
 *   3. every event carries service=ui;
 *   4. no user content leaves the tab: no labels in click breadcrumbs, no
 *      email on the user.
 * Plus the UI-only rule: known noise is dropped by EXACT message, and real
 * failures (e.g. Firefox's "NetworkError when attempting to fetch resource.")
 * are kept.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const sentry = vi.hoisted(() => ({
  init: vi.fn(),
  setUser: vi.fn(),
  inboundFiltersIntegration: vi.fn((opts: unknown) => ({ name: 'InboundFilters', opts })),
  eventFiltersIntegration: vi.fn((opts: unknown) => ({ name: 'EventFilters', opts })),
  withScope: vi.fn(),
  captureException: vi.fn(),
  setMeasurement: vi.fn(),
}))
vi.mock('@sentry/react', () => sentry)

import { resolveMonitoringConfig, initSentry, setSentryUser, UNLABELLED_ENVIRONMENT } from '../monitoring'

const SENTINEL = 'SENTINEL-91f4-acquire-northwind-for-40m'
const SHA40 = '0123456789abcdef0123456789abcdef01234567'
const DSN = 'https://public@o0.ingest.sentry.io/0'

type Cfg = {
  environment?: string
  release?: string
  ignoreErrors?: Array<string | RegExp>
  initialScope?: { tags?: Record<string, string> }
  integrations?: Array<{ name: string; opts?: { disableErrorDefaults?: boolean } }>
  beforeSend?: (e: Record<string, unknown>) => Record<string, unknown> | null
  beforeBreadcrumb?: (b: Record<string, unknown>, hint?: unknown) => Record<string, unknown> | null
}

function initConfig(): Cfg {
  sentry.init.mockClear()
  initSentry()
  expect(sentry.init).toHaveBeenCalledTimes(1)
  return sentry.init.mock.calls[0][0] as Cfg
}

/**
 * Would this config DISCARD the event? Mirrors the SDK: a string in
 * ignoreErrors matches as a SUBSTRING, a RegExp by test(); then beforeSend.
 */
function discards(cfg: Cfg, message: string): boolean {
  const ignored = (cfg.ignoreErrors ?? []).some((p) => (typeof p === 'string' ? message.includes(p) : p.test(message)))
  if (ignored) return true
  const event = { exception: { values: [{ type: 'TypeError', value: message }] } }
  return cfg.beforeSend ? cfg.beforeSend(event) === null : false
}

describe('UI Sentry contract (S-H)', () => {
  beforeEach(() => {
    vi.stubEnv('MODE', 'production')
    vi.stubEnv('VITE_SENTRY_DSN', DSN)
    document.head.querySelectorAll('meta[name="x-build-id"]').forEach((m) => m.remove())
  })
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  describe('environment label', () => {
    it('a staging build is labelled staging, not production', () => {
      const cfg = resolveMonitoringConfig({ MODE: 'production', VITE_SENTRY_DSN: DSN, VITE_SENTRY_ENVIRONMENT: 'staging' })
      expect(cfg.environment).toBe('staging')
    })

    it('a Netlify Deploy Preview is "preview" even when its branch context says production', () => {
      const cfg = resolveMonitoringConfig(
        { MODE: 'production', VITE_SENTRY_DSN: DSN, VITE_SENTRY_ENVIRONMENT: 'production' },
        'deploy-preview-2541--olumi.netlify.app',
      )
      expect(cfg.environment).toBe('preview')
    })

    it('control: the published production host keeps its production label', () => {
      const cfg = resolveMonitoringConfig(
        { MODE: 'production', VITE_SENTRY_DSN: DSN, VITE_SENTRY_ENVIRONMENT: 'production' },
        'olumi.netlify.app',
      )
      expect(cfg.environment).toBe('production')
    })

    it('a deployed build with no label says so instead of claiming production', () => {
      const cfg = resolveMonitoringConfig({ MODE: 'production', VITE_SENTRY_DSN: DSN })
      expect(cfg.environment).toBe(UNLABELLED_ENVIRONMENT)
      expect(cfg.environment).not.toBe('production')
    })

    it('control: development still disables Sentry and keeps its mode label', () => {
      const cfg = resolveMonitoringConfig({ MODE: 'development', VITE_SENTRY_DSN: DSN, VITE_SENTRY_ENVIRONMENT: 'staging' })
      expect(cfg.enabled.sentry).toBe(false)
      expect(cfg.environment).toBe('development')
    })

    it('netlify.toml labels the production (manual-test) and staging contexts', async () => {
      const fs = await import('node:fs')
      const path = await import('node:path')
      const toml = fs.readFileSync(path.resolve(process.cwd(), 'netlify.toml'), 'utf8')
      // The table header must start a line (the same text also appears in comments).
      const block = (name: string) => {
        const lines = toml.split('\n')
        const start = lines.findIndex((l) => l === `[context.${name}.environment]`)
        if (start === -1) return ''
        const rest = lines.slice(start + 1)
        const end = rest.findIndex((l) => l.startsWith('['))
        return (end === -1 ? rest : rest.slice(0, end)).join('\n')
      }
      expect(block('manual-test')).toMatch(/^\s*VITE_SENTRY_ENVIRONMENT = "production"$/m)
      expect(block('staging')).toMatch(/^\s*VITE_SENTRY_ENVIRONMENT = "staging"$/m)
    })
  })

  describe('release', () => {
    it('is the full SHA stamped into the loaded document', () => {
      const meta = document.createElement('meta')
      meta.name = 'x-build-id'
      meta.content = SHA40
      document.head.appendChild(meta)
      expect(resolveMonitoringConfig({ MODE: 'production', VITE_SENTRY_DSN: DSN }).release).toBe(SHA40)
    })

    it('the stamped SHA wins over an explicit VITE_RELEASE_VERSION', () => {
      const meta = document.createElement('meta')
      meta.name = 'x-build-id'
      meta.content = SHA40
      document.head.appendChild(meta)
      expect(resolveMonitoringConfig({ MODE: 'production', VITE_SENTRY_DSN: DSN, VITE_RELEASE_VERSION: '2.0.0' }).release).toBe(SHA40)
    })

    it('control: an unstamped placeholder is not a release', () => {
      const meta = document.createElement('meta')
      meta.name = 'x-build-id'
      meta.content = '%BUILD_ID%'
      document.head.appendChild(meta)
      expect(resolveMonitoringConfig({ MODE: 'production', VITE_SENTRY_DSN: DSN }).release).toBeUndefined()
    })
  })

  describe('init config', () => {
    it('every event carries service=ui', () => {
      expect(initConfig().initialScope?.tags?.service).toBe('ui')
    })

    it("keeps Firefox's failed-fetch error (was discarded by the 'NetworkError' substring)", () => {
      expect(discards(initConfig(), 'NetworkError when attempting to fetch resource.')).toBe(false)
    })

    it('control: the Chrome failed-fetch error is kept too', () => {
      expect(discards(initConfig(), 'Failed to fetch')).toBe(false)
    })

    it('drops ResizeObserver loop noise by EXACT message, in beforeSend (attributable)', () => {
      const cfg = initConfig()
      const event = { exception: { values: [{ type: 'Error', value: 'ResizeObserver loop completed with undelivered notifications.' }] } }
      expect(cfg.beforeSend!(event)).toBeNull()
    })

    it('a real error whose CAUSE is ResizeObserver noise is kept', () => {
      const cfg = initConfig()
      const event = {
        exception: {
          values: [
            { type: 'Error', value: 'ResizeObserver loop completed with undelivered notifications.' },
            { type: 'TypeError', value: 'NetworkError when attempting to fetch resource.' },
          ],
        },
      }
      expect(cfg.beforeSend!(event)).not.toBeNull()
    })

    it('a message that merely CONTAINS the noise text is kept', () => {
      expect(discards(initConfig(), 'Wrapped: ResizeObserver loop completed with undelivered notifications. in Canvas')).toBe(false)
    })

    it("switches off the SDK's default message filters so nothing else is dropped unseen", () => {
      const cfg = initConfig()
      // must carry the DEFAULT's name, or it runs alongside the default
      const filters = (cfg.integrations ?? []).find((i) => i.name === 'InboundFilters')
      expect(filters?.opts?.disableErrorDefaults).toBe(true)
    })

    it('a click breadcrumb carries no label text (aria-label / title / id)', () => {
      const cfg = initConfig()
      expect(typeof cfg.beforeBreadcrumb).toBe('function')
      const wrap = document.createElement('div')
      wrap.className = 'react-flow__node'
      wrap.id = 'node-acquire-northwind'
      const button = document.createElement('button')
      button.className = 'node-edit'
      button.setAttribute('aria-label', `Edit ${SENTINEL}`)
      button.title = SENTINEL
      wrap.appendChild(button)
      document.body.appendChild(wrap)
      const out = cfg.beforeBreadcrumb!(
        { category: 'ui.click', message: `div#node-acquire-northwind > button.node-edit[aria-label="Edit ${SENTINEL}"]` },
        { event: { target: button } },
      )
      const json = JSON.stringify(out)
      expect(json).not.toContain(SENTINEL)
      expect(json).not.toContain('northwind')
      expect(json).toContain('button.node-edit')
      wrap.remove()
    })

    it('console breadcrumbs are dropped', () => {
      expect(initConfig().beforeBreadcrumb!({ category: 'console', message: SENTINEL })).toBeNull()
    })

    it('fetch and navigation crumbs keep only their shape (no message, no query)', () => {
      const cfg = initConfig()
      const fetchCrumb = JSON.stringify(
        cfg.beforeBreadcrumb!({
          category: 'fetch',
          message: SENTINEL,
          data: { method: 'POST', url: `/proxy/v5/turn?brief=${SENTINEL}`, status_code: 502, label: SENTINEL },
        }),
      )
      expect(fetchCrumb).not.toContain(SENTINEL)
      expect(fetchCrumb).toContain('/proxy/v5/turn')
      expect(fetchCrumb).toContain('502')
      const nav = JSON.stringify(
        cfg.beforeBreadcrumb!({ category: 'navigation', data: { from: '/s/abc', to: `/s/abc?q=${SENTINEL}` } }),
      )
      expect(nav).not.toContain(SENTINEL)
      expect(nav).toContain('/s/abc')
    })
  })

  it('the Sentry user is the pseudonymous id only, never the email', () => {
    sentry.setUser.mockClear()
    setSentryUser('user-123', 'someone@example.com')
    expect(sentry.setUser).toHaveBeenCalledWith({ id: 'user-123' })
    expect(JSON.stringify(sentry.setUser.mock.calls)).not.toContain('@example.com')
  })
})

describe('noise matcher scales linearly (regex budget)', () => {
  it.each([
    ['plain text', (n: number) => 'a'.repeat(n)],
    ['near-miss prefix', (n: number) => 'ResizeObserver loop completed with undelivered notifications.' + ' '.repeat(n)],
    ['extension-like frames', (n: number) => 'chrome-extension:/'.repeat(Math.ceil(n / 18)).slice(0, n)],
  ])('%s: 20k costs < 8x of 5k', async (_shape, make) => {
    const { isKnownNoise } = await import('../monitoring')
    const time = (n: number) => {
      const text = make(n)
      const event = { message: text, exception: { values: [{ value: text, stacktrace: { frames: [{ filename: text }] } }] } }
      let best = Infinity
      for (let i = 0; i < 5; i += 1) {
        const t0 = performance.now()
        for (let j = 0; j < 50; j += 1) isKnownNoise(event)
        best = Math.min(best, performance.now() - t0)
      }
      return Math.max(best, 0.05)
    }
    expect(time(20_000) / time(5_000)).toBeLessThan(8)
  })
})

describe('real SDK: known noise reaches beforeSend (so its drop is counted as before_send)', () => {
  it('ResizeObserver noise is dropped by OUR hook, not by an SDK event processor', async () => {
    vi.stubEnv('MODE', 'production')
    vi.stubEnv('VITE_SENTRY_DSN', DSN)
    sentry.init.mockClear()
    initSentry()
    const cfg = sentry.init.mock.calls[0][0] as Record<string, unknown> & {
      beforeSend: (e: unknown, h: unknown) => unknown
      integrations: Array<{ name: string; opts?: unknown }>
    }
    const real = await vi.importActual<typeof import('@sentry/react')>('@sentry/react')
    const reached: string[] = []
    const sent: unknown[] = []
    // Rebuild the integrations with the REAL SDK factories, same options.
    const integrations = cfg.integrations.map((i) =>
      i.name === 'InboundFilters'
        ? real.inboundFiltersIntegration(i.opts as Parameters<typeof real.inboundFiltersIntegration>[0])
        : real.eventFiltersIntegration(i.opts as Parameters<typeof real.eventFiltersIntegration>[0]),
    )
    real.init({
      dsn: DSN,
      integrations,
      beforeSend: (event, hint) => {
        const value = event.exception?.values?.[0]?.value ?? ''
        reached.push(value)
        return cfg.beforeSend(event, hint) as typeof event | null
      },
      transport: () => ({ send: async (e: unknown) => { sent.push(e); return {} }, flush: async () => true }),
    })
    real.captureException(new Error('ResizeObserver loop completed with undelivered notifications.'))
    real.captureException(new TypeError('NetworkError when attempting to fetch resource.'))
    await real.flush(2000)
    await real.close()
    expect(reached).toContain('ResizeObserver loop completed with undelivered notifications.')
    expect(reached).toContain('NetworkError when attempting to fetch resource.')
    expect(JSON.stringify(sent)).toContain('NetworkError when attempting to fetch resource.')
    expect(JSON.stringify(sent)).not.toContain('ResizeObserver loop')
    vi.unstubAllEnvs()
  })
})
