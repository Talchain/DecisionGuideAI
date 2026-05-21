/**
 * Unit tests for `src/lib/v5TraceMatching.ts` — the single source of
 * truth for V5 CEE turn endpoint classification on the SELECTOR side
 * (`detectService` in `contract-validators.ts` is the CLASSIFIER
 * side; both layers must agree on what counts as a V5 turn).
 *
 * Round-4 (PR #152 series) introduced the path-boundary regex.
 * Round-5 (PR #152 follow-up) introduced pathname-only matching.
 * V5 proxy classification (PR #156 / PR #159 follow-up) added the
 * `/proxy/v5/turn` variant. These tests cover all three layers and
 * the look-alike rejection contract.
 */

import { describe, it, expect } from 'vitest'

import {
  extractPathname,
  isCeeService,
  isV5TurnEndpoint,
  isV5TurnProxyEndpoint,
  matchServiceCaseInsensitive,
  V5_TURN_ENDPOINT_PATTERN,
  V5_TURN_PROXY_ENDPOINT_PATTERN,
} from '../v5TraceMatching'

describe('v5TraceMatching — extractPathname', () => {
  it('returns pathname from an absolute URL', () => {
    expect(
      extractPathname('https://cee-staging.onrender.com/proxy/v5/turn?x=1'),
    ).toBe('/proxy/v5/turn')
  })

  it('strips query string from path-only endpoint', () => {
    expect(extractPathname('/proxy/v5/turn?nonce=abc')).toBe('/proxy/v5/turn')
  })

  it('strips fragment from path-only endpoint', () => {
    expect(extractPathname('/proxy/v5/turn#frag')).toBe('/proxy/v5/turn')
  })

  it('returns the path verbatim when no query / fragment', () => {
    expect(extractPathname('/proxy/v5/turn')).toBe('/proxy/v5/turn')
  })

  it('returns null on empty input', () => {
    expect(extractPathname('')).toBeNull()
  })
})

describe('v5TraceMatching — isCeeService / matchServiceCaseInsensitive', () => {
  it('matches CEE service case-insensitively', () => {
    expect(isCeeService({ service: 'CEE' })).toBe(true)
    expect(isCeeService({ service: 'cee' })).toBe(true)
    expect(isCeeService({ service: 'Cee' })).toBe(true)
  })

  it('rejects non-CEE services', () => {
    expect(isCeeService({ service: 'PLoT' })).toBe(false)
    expect(isCeeService({ service: 'ISL' })).toBe(false)
    expect(isCeeService({ service: 'unknown' })).toBe(false)
    expect(isCeeService({})).toBe(false)
  })

  it('matches PLoT service case-insensitively', () => {
    expect(matchServiceCaseInsensitive({ service: 'PLoT' }, 'PLOT')).toBe(true)
    expect(matchServiceCaseInsensitive({ service: 'plot' }, 'PLOT')).toBe(true)
  })
})

describe('v5TraceMatching — isV5TurnEndpoint (canonical + proxy)', () => {
  // Canonical V5 turn (round-3+ baseline) ------------------------------

  it('returns true for canonical /bff/orchestrate/v2/turn (CEE)', () => {
    expect(
      isV5TurnEndpoint({
        service: 'CEE',
        endpoint: '/bff/orchestrate/v2/turn',
      }),
    ).toBe(true)
  })

  it('returns true for absolute canonical V5 URL (CEE)', () => {
    expect(
      isV5TurnEndpoint({
        service: 'CEE',
        endpoint: 'https://cee.example.com/orchestrate/v2/turn',
      }),
    ).toBe(true)
  })

  it('returns true for canonical V5 URL with query string', () => {
    expect(
      isV5TurnEndpoint({
        service: 'CEE',
        endpoint: '/orchestrate/v2/turn?nonce=abc',
      }),
    ).toBe(true)
  })

  it('returns true for canonical V5 sub-path (defensive)', () => {
    expect(
      isV5TurnEndpoint({
        service: 'CEE',
        endpoint: '/orchestrate/v2/turn/legacy-sub',
      }),
    ).toBe(true)
  })

  // V5 proxy variant (PR #156 / PR #159 follow-up) ---------------------

  it('returns true for staging absolute proxy URL (CEE)', () => {
    expect(
      isV5TurnEndpoint({
        service: 'CEE',
        endpoint: 'https://cee-staging.onrender.com/proxy/v5/turn',
      }),
    ).toBe(true)
  })

  it('returns true for bare /proxy/v5/turn (CEE)', () => {
    expect(
      isV5TurnEndpoint({ service: 'CEE', endpoint: '/proxy/v5/turn' }),
    ).toBe(true)
  })

  it('returns true for /proxy/v5/turn with query string', () => {
    expect(
      isV5TurnEndpoint({
        service: 'CEE',
        endpoint: '/proxy/v5/turn?nonce=abc',
      }),
    ).toBe(true)
  })

  it('returns true for /proxy/v5/turn with fragment', () => {
    expect(
      isV5TurnEndpoint({ service: 'CEE', endpoint: '/proxy/v5/turn#frag' }),
    ).toBe(true)
  })

  it('returns true for /proxy/v5/turn sub-path (defensive)', () => {
    expect(
      isV5TurnEndpoint({
        service: 'CEE',
        endpoint: '/proxy/v5/turn/legacy-sub',
      }),
    ).toBe(true)
  })

  // Rejection contract --------------------------------------------------

  it('rejects look-alike /orchestrate/v2/turning (path boundary)', () => {
    expect(
      isV5TurnEndpoint({
        service: 'CEE',
        endpoint: '/orchestrate/v2/turning',
      }),
    ).toBe(false)
  })

  it('rejects look-alike /proxy/v5/turning (path boundary)', () => {
    expect(
      isV5TurnEndpoint({ service: 'CEE', endpoint: '/proxy/v5/turning' }),
    ).toBe(false)
  })

  it('rejects look-alike /proxy/v5/turn-legacy (hyphen suffix)', () => {
    expect(
      isV5TurnEndpoint({
        service: 'CEE',
        endpoint: '/proxy/v5/turn-legacy',
      }),
    ).toBe(false)
  })

  it('rejects query-string-only false positive (pathname-only matching)', () => {
    // Even if the query value contains the V5 path, the actual
    // pathname is `/legacy/turn` — selector must reject.
    expect(
      isV5TurnEndpoint({
        service: 'CEE',
        endpoint: '/legacy/turn?next=/orchestrate/v2/turn',
      }),
    ).toBe(false)
    expect(
      isV5TurnEndpoint({
        service: 'CEE',
        endpoint: '/legacy/turn?next=/proxy/v5/turn',
      }),
    ).toBe(false)
  })

  it('rejects non-CEE service even on V5 paths (defensive)', () => {
    expect(
      isV5TurnEndpoint({
        service: 'PLoT',
        endpoint: '/orchestrate/v2/turn',
      }),
    ).toBe(false)
    expect(
      isV5TurnEndpoint({ service: 'PLoT', endpoint: '/proxy/v5/turn' }),
    ).toBe(false)
    expect(
      isV5TurnEndpoint({ service: 'unknown', endpoint: '/proxy/v5/turn' }),
    ).toBe(false)
  })

  it('rejects missing/empty endpoint and missing service', () => {
    expect(isV5TurnEndpoint({ service: 'CEE' })).toBe(false)
    expect(isV5TurnEndpoint({ service: 'CEE', endpoint: '' })).toBe(false)
    expect(isV5TurnEndpoint({ endpoint: '/proxy/v5/turn' })).toBe(false)
  })
})

describe('v5TraceMatching — isV5TurnProxyEndpoint (discriminator)', () => {
  it('returns true ONLY for the proxy variant (not canonical)', () => {
    expect(
      isV5TurnProxyEndpoint({ service: 'CEE', endpoint: '/proxy/v5/turn' }),
    ).toBe(true)
    expect(
      isV5TurnProxyEndpoint({
        service: 'CEE',
        endpoint: 'https://cee-staging.onrender.com/proxy/v5/turn',
      }),
    ).toBe(true)
    // Canonical canonical: false (use isV5TurnEndpoint for either variant)
    expect(
      isV5TurnProxyEndpoint({
        service: 'CEE',
        endpoint: '/bff/orchestrate/v2/turn',
      }),
    ).toBe(false)
    expect(
      isV5TurnProxyEndpoint({
        service: 'CEE',
        endpoint: '/orchestrate/v2/turn',
      }),
    ).toBe(false)
  })

  it('rejects look-alike /proxy/v5/turning', () => {
    expect(
      isV5TurnProxyEndpoint({
        service: 'CEE',
        endpoint: '/proxy/v5/turning',
      }),
    ).toBe(false)
  })

  it('rejects query-string false positives', () => {
    expect(
      isV5TurnProxyEndpoint({
        service: 'CEE',
        endpoint: '/legacy/turn?next=/proxy/v5/turn',
      }),
    ).toBe(false)
  })

  it('rejects non-CEE service (defensive)', () => {
    expect(
      isV5TurnProxyEndpoint({
        service: 'PLoT',
        endpoint: '/proxy/v5/turn',
      }),
    ).toBe(false)
  })

  it('rejects missing service or empty endpoint', () => {
    expect(isV5TurnProxyEndpoint({ endpoint: '/proxy/v5/turn' })).toBe(false)
    expect(isV5TurnProxyEndpoint({ service: 'CEE', endpoint: '' })).toBe(false)
    expect(isV5TurnProxyEndpoint({ service: 'CEE' })).toBe(false)
  })
})

describe('v5TraceMatching — exported pattern constants', () => {
  it('canonical V5 turn pattern is /orchestrate/v2/turn', () => {
    expect(V5_TURN_ENDPOINT_PATTERN).toBe('/orchestrate/v2/turn')
  })

  it('proxy V5 turn pattern is /proxy/v5/turn', () => {
    expect(V5_TURN_PROXY_ENDPOINT_PATTERN).toBe('/proxy/v5/turn')
  })
})
