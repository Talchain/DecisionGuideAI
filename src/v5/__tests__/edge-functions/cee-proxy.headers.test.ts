/**
 * The cee-proxy Edge Function forwards the staging engine selector (DL-3, 20 Oct). The graph read (`/bff/cee/scenarios/:id/graph`)
 * reaches CEE through it; without `x-olumi-ai-mode` a reopen in `core` is read in the default lane (CEE #3488 gates the host
 * action bar on it). Source-text check, as `orchestrator-proxy.headers.test.ts` (the Edge Function runs in Deno).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const allowlist = (): string => {
  const source = readFileSync(resolve(__dirname, '../../../../netlify/edge-functions/cee-proxy.ts'), 'utf-8')
  const match = source.match(/ALLOWED_FORWARD_HEADERS\s*=\s*\[([^\]]+)\]/s)
  expect(match).not.toBeNull()
  return match![1]!
}

describe('cee-proxy ALLOWED_FORWARD_HEADERS', () => {
  it('forwards x-olumi-ai-mode, so CEE reads a reopen in the session\u2019s own lane', () => {
    expect(allowlist()).toContain("'x-olumi-ai-mode'")
  })
  it('CONTRAST: the existing forwards are unchanged', () => {
    for (const h of ['content-type', 'accept', 'authorization', 'x-correlation-id', 'x-request-id', 'x-user-id']) expect(allowlist()).toContain(`'${h}'`)
  })
})
