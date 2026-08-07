/**
 * plotAuthHeaders — unit pins for the optional env-injected PLoT Bearer helper.
 *
 * The helper is the single source of the Authorization header wired into both
 * PLoT-direct seams (CEE client + readiness store). These pins fix its
 * contract: a Bearer header when the env var is a non-empty string, and the
 * fail-safe empty object otherwise (today's behaviour before provisioning).
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { plotAuthHeaders } from '../plotAuthHeaders'

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('plotAuthHeaders', () => {
  it('returns a Bearer Authorization header when VITE_PLOT_BEARER is a non-empty string', () => {
    vi.stubEnv('VITE_PLOT_BEARER', 'staging-token-123')
    expect(plotAuthHeaders()).toEqual({ Authorization: 'Bearer staging-token-123' })
  })

  it('returns {} when VITE_PLOT_BEARER is unset (fail-safe: no header, today\'s behaviour)', () => {
    // Intentionally not stubbed — the default import.meta.env has no
    // VITE_PLOT_BEARER (stubEnv(undefined) would inject the string "undefined").
    expect(plotAuthHeaders()).toEqual({})
  })

  it('returns {} for an empty-string token (never emits a bare "Bearer ")', () => {
    vi.stubEnv('VITE_PLOT_BEARER', '')
    expect(plotAuthHeaders()).toEqual({})
  })
})
