/**
 * Login UI half (3.4) item 4 — CSP hygiene pin.
 *
 * The browser has NO legitimate direct path to ISL (all ISL traffic is
 * same-origin /bff/isl → server-side edge proxy, adapters/isl/client.ts:29),
 * so isl-staging.onrender.com must not appear in connect-src. The other
 * service origins stay: they can be direct browser targets via VITE_ base
 * overrides.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

function connectSrc(): string {
  const toml = readFileSync(resolve(process.cwd(), 'netlify.toml'), 'utf8')
  const match = toml.match(/connect-src[^;"]*/)
  expect(match, 'netlify.toml must declare a connect-src').not.toBeNull()
  return match![0]
}

describe('netlify.toml CSP connect-src', () => {
  it('does not allow direct browser connections to ISL', () => {
    expect(connectSrc()).not.toContain('isl-staging.onrender.com')
  })

  it('keeps the legitimate service origins', () => {
    const src = connectSrc()
    expect(src).toContain("'self'")
    expect(src).toContain('plot-lite-service-staging.onrender.com')
    expect(src).toContain('olumi-assistants-service.onrender.com')
    expect(src).toContain('cee-staging.onrender.com')
    expect(src).toContain('supabase.co')
  })
})
