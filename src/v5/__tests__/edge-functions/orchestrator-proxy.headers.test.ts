/**
 * Regression guard: Netlify Edge proxy header forwarding.
 *
 * The orchestrator-proxy Edge Function has a static ALLOWED_FORWARD_HEADERS
 * allowlist. This test guards against regressions where x-user-id or other
 * diagnostic headers are accidentally removed.
 *
 * Since the Edge Function runs in Deno (not Node), it can't be imported
 * directly. We use a source-text check — fast, zero dependencies, and
 * sufficient to catch the regression class we care about.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const EDGE_PROXY_PATH = resolve(
  __dirname,
  '../../../../netlify/edge-functions/orchestrator-proxy.ts',
)

function readEdgeProxy(): string {
  return readFileSync(EDGE_PROXY_PATH, 'utf-8')
}

describe('orchestrator-proxy ALLOWED_FORWARD_HEADERS', () => {
  it('includes x-user-id so the header is forwarded to CEE', () => {
    const source = readEdgeProxy()
    // The header must appear within the ALLOWED_FORWARD_HEADERS array literal.
    // Match the array block so we don't accidentally match a comment or URL.
    const match = source.match(/ALLOWED_FORWARD_HEADERS\s*=\s*\[([^\]]+)\]/s)
    expect(match).not.toBeNull()
    const block = match![1]
    expect(block).toContain("'x-user-id'")
  })

  it('includes x-correlation-id and x-request-id for tracing', () => {
    const source = readEdgeProxy()
    const match = source.match(/ALLOWED_FORWARD_HEADERS\s*=\s*\[([^\]]+)\]/s)
    expect(match).not.toBeNull()
    const block = match![1]
    expect(block).toContain("'x-correlation-id'")
    expect(block).toContain("'x-request-id'")
  })

  it('CORS Access-Control-Allow-Headers includes x-user-id for preflight', () => {
    const source = readEdgeProxy()
    // The browser sends a preflight; x-user-id must be in Allow-Headers too.
    expect(source).toContain('x-user-id')
    const corsHeaderMatch = source.match(
      /Access-Control-Allow-Headers['"\s]*:['"\s]*([^'"]+)/,
    )
    expect(corsHeaderMatch).not.toBeNull()
    expect(corsHeaderMatch![1].toLowerCase()).toContain('x-user-id')
  })
})
