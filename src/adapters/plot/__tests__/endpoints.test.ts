/**
 * Endpoints Test
 *
 * Verify centralized endpoint definitions return correct URLs
 */

import { describe, it, expect } from 'vitest'
import { PLOT_ENDPOINTS, withQuery, PLOT_PROXY_BASE } from '../endpoints'

describe('PLOT_ENDPOINTS', () => {
  it('returns correct health endpoint', () => {
    expect(PLOT_ENDPOINTS.health()).toBe(`${PLOT_PROXY_BASE}/v1/health`)
  })

  it('returns correct limits endpoint', () => {
    expect(PLOT_ENDPOINTS.limits()).toBe(`${PLOT_PROXY_BASE}/v1/limits`)
  })

  it('returns correct validate endpoint', () => {
    expect(PLOT_ENDPOINTS.validate()).toBe(`${PLOT_PROXY_BASE}/v1/validate`)
  })

  it('returns correct run endpoint', () => {
    expect(PLOT_ENDPOINTS.run()).toBe(`${PLOT_PROXY_BASE}/v1/run`)
  })

  it('returns correct stream endpoint', () => {
    expect(PLOT_ENDPOINTS.stream()).toBe(`${PLOT_PROXY_BASE}/v1/stream`)
  })

  it('returns correct templates endpoint', () => {
    expect(PLOT_ENDPOINTS.templates()).toBe(`${PLOT_PROXY_BASE}/v1/templates`)
  })

  it('returns correct template endpoint with ID', () => {
    expect(PLOT_ENDPOINTS.template('foo')).toBe(`${PLOT_PROXY_BASE}/v1/templates/foo`)
  })

  it('URL-encodes template ID', () => {
    expect(PLOT_ENDPOINTS.template('foo/bar')).toBe(`${PLOT_PROXY_BASE}/v1/templates/foo%2Fbar`)
  })

  it('returns correct template graph endpoint', () => {
    expect(PLOT_ENDPOINTS.templateGraph('foo')).toBe(`${PLOT_PROXY_BASE}/v1/templates/foo/graph`)
  })

  it('returns correct share endpoint', () => {
    expect(PLOT_ENDPOINTS.share()).toBe(`${PLOT_PROXY_BASE}/v1/share`)
  })

  it('returns correct resolve share endpoint', () => {
    expect(PLOT_ENDPOINTS.resolveShare('abc123')).toBe(`${PLOT_PROXY_BASE}/v1/share/abc123`)
  })
})

describe('withQuery', () => {
  it('adds query params to endpoint', () => {
    const url = withQuery(PLOT_ENDPOINTS.run(), { seed: 42, foo: 'bar' })
    expect(url).toBe(`${PLOT_PROXY_BASE}/v1/run?seed=42&foo=bar`)
  })

  it('skips undefined params', () => {
    const url = withQuery(PLOT_ENDPOINTS.run(), { seed: 42, foo: undefined })
    expect(url).toBe(`${PLOT_PROXY_BASE}/v1/run?seed=42`)
  })

  it('handles boolean params', () => {
    const url = withQuery(PLOT_ENDPOINTS.run(), { include_debug: true })
    expect(url).toBe(`${PLOT_PROXY_BASE}/v1/run?include_debug=true`)
  })

  it('returns original URL if no params', () => {
    const url = withQuery(PLOT_ENDPOINTS.run(), {})
    expect(url).toBe(`${PLOT_PROXY_BASE}/v1/run`)
  })
})

describe('Endpoint consistency', () => {
  it('all endpoints use the proxy base', () => {
    const endpoints = [
      PLOT_ENDPOINTS.health(),
      PLOT_ENDPOINTS.limits(),
      PLOT_ENDPOINTS.validate(),
      PLOT_ENDPOINTS.run(),
      PLOT_ENDPOINTS.stream(),
      PLOT_ENDPOINTS.templates(),
      PLOT_ENDPOINTS.template('test'),
      PLOT_ENDPOINTS.templateGraph('test'),
      PLOT_ENDPOINTS.share(),
      PLOT_ENDPOINTS.resolveShare('test')
    ]

    endpoints.forEach(endpoint => {
      expect(endpoint).toMatch(/^\/api\/plot\/v1\//)
    })
  })

  it('all endpoints are properly versioned', () => {
    const endpoints = [
      PLOT_ENDPOINTS.health(),
      PLOT_ENDPOINTS.limits(),
      PLOT_ENDPOINTS.validate(),
      PLOT_ENDPOINTS.run(),
      PLOT_ENDPOINTS.stream(),
      PLOT_ENDPOINTS.templates(),
      PLOT_ENDPOINTS.template('test'),
      PLOT_ENDPOINTS.templateGraph('test'),
      PLOT_ENDPOINTS.share(),
      PLOT_ENDPOINTS.resolveShare('test')
    ]

    endpoints.forEach(endpoint => {
      expect(endpoint).toContain('/v1/')
    })
  })
})
