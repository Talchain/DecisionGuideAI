/**
 * Login UI half (3.4) — orchestrator edge-proxy forward-allowlist pin.
 *
 * The proxy builds forwarded headers FROM SCRATCH against an explicit
 * allowlist, so any header missing from it is silently stripped before CEE
 * ever sees the request. The review of PR #268 caught exactly that failure:
 * the Authorization Bearer (the whole point of the login coordination
 * contract) was preflight-permitted but forward-stripped. This spec pins
 * the allowlist so the contract cannot silently regress.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

function allowlist(): string {
  const src = readFileSync(
    resolve(process.cwd(), 'netlify/edge-functions/orchestrator-proxy.ts'),
    'utf8',
  )
  const match = src.match(/ALLOWED_FORWARD_HEADERS\s*=\s*\[([^\]]*)\]/)
  expect(match, 'orchestrator-proxy must declare ALLOWED_FORWARD_HEADERS').not.toBeNull()
  return match![1]
}

describe('orchestrator-proxy ALLOWED_FORWARD_HEADERS', () => {
  it("forwards the user's Authorization Bearer to CEE (login 3.4 contract)", () => {
    expect(allowlist()).toContain("'authorization'")
  })

  it('keeps x-user-id until CEE confirms server-side derivation (skew-safe order)', () => {
    expect(allowlist()).toContain("'x-user-id'")
  })
})
