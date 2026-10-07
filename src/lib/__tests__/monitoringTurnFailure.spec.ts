/**
 * `captureTurnFailure` — the chat turn transport's Sentry report (S-F) keeps its identifiers through the S-H context
 * allowlist (#2606). CONTRAST: the same fields sent as `captureError` context are cut by `sanitizeCanvasContext`,
 * which is why the turn report carries them as tags.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const scope = vi.hoisted(() => ({ setContext: vi.fn(), setTags: vi.fn(), setExtra: vi.fn() }))
const sentry = vi.hoisted(() => ({
  withScope: vi.fn((fn: (s: unknown) => void) => fn(scope)),
  captureException: vi.fn(),
}))
vi.mock('@sentry/react', () => sentry)

import { captureTurnFailure, captureError } from '../monitoring'

const TAGS = { turn_failure: 'timeout', turn_type: 'user_message', turn_mode: 'user', request_id: 'req-123' }

describe('captureTurnFailure', () => {
  beforeEach(() => {
    vi.stubEnv('MODE', 'production')
    vi.stubEnv('VITE_SENTRY_DSN', 'https://k@o0.ingest.sentry.io/1')
    for (const f of [scope.setContext, scope.setTags, scope.setExtra, sentry.captureException]) f.mockClear()
  })
  afterEach(() => { vi.unstubAllEnvs() })

  it('sends the turn identifiers as tags, the scenario prefix in the allowlisted context, and the error itself', () => {
    const error = new Error('Chat turn failed: timeout')
    captureTurnFailure(error, { tags: TAGS, scenarioId: 'abcd1234', elapsedMs: 175_000 })
    expect(scope.setTags).toHaveBeenCalledWith(TAGS)
    expect(scope.setContext).toHaveBeenCalledWith('canvas', { component: 'chat-turn', scenarioId: 'abcd1234' })
    expect(scope.setExtra).toHaveBeenCalledWith('elapsed_ms', 175_000)
    expect(sentry.captureException).toHaveBeenCalledWith(error)
  })

  it('CONTRAST: the same fields as captureError context are dropped by the S-H allowlist', () => {
    captureError(new Error('x'), { component: 'chat-turn', ...TAGS })
    expect(scope.setContext).toHaveBeenCalledWith('canvas', { component: 'chat-turn' })
  })
})
