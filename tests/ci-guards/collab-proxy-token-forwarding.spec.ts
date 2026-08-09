/**
 * CI GUARD — the collab transport, which is the difference between this feature
 * working and this feature being registered-and-dark.
 *
 * Three independent declarations have to agree, and NOTHING derives them from
 * one another:
 *   1. `netlify/edge-functions/collab-proxy.ts` — forwards the participant
 *      token header and rewrites `/bff/collab/*` → `/collab/v1/*`;
 *   2. `netlify.toml` — binds the function to that path;
 *   3. `vite.config.ts` — the SAME rewrite, in BOTH dev-proxy blocks.
 *
 * That is a hand-maintained mirror by construction, so it gets a guard that
 * fails loud rather than a comment asking people to remember.
 *
 * ⚠ The `vite.config.ts` dev-proxy block is DUPLICATED in that file. Declaring
 * the route in only one silently diverges dev from preview — a class of defect
 * that looks like "works on my machine" and costs a day.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = process.cwd()
const read = (p: string): string => readFileSync(resolve(root, p), 'utf8')

const TOKEN_HEADER = 'x-collab-participant-token'

describe('collab proxy transport', () => {
  const proxy = read('netlify/edge-functions/collab-proxy.ts')

  it('forwards the participant token header — without this the whole feature 401s, invisibly', () => {
    const forwardBlock = /const ALLOWED_FORWARD_HEADERS = \[([\s\S]*?)\]/.exec(proxy)
    expect(forwardBlock, 'ALLOWED_FORWARD_HEADERS not found').not.toBeNull()
    // The constant is referenced by name in the array, so assert the binding
    // resolves rather than that a literal appears somewhere in the file.
    expect(forwardBlock?.[1]).toContain('COLLAB_TOKEN_HEADER')
    expect(proxy).toContain(`const COLLAB_TOKEN_HEADER = '${TOKEN_HEADER}'`)
  })

  it('advertises the same header in Access-Control-Allow-Headers (kept in step so it cannot rot)', () => {
    const acah = /'Access-Control-Allow-Headers':\s*\n?\s*'([^']+)'/.exec(proxy)
    expect(acah, 'Access-Control-Allow-Headers not found').not.toBeNull()
    expect(acah?.[1]).toContain(TOKEN_HEADER)
  })

  it('rewrites /bff/collab/* to the contract-pinned /collab/v1/* prefix', () => {
    expect(proxy).toContain("replace(/^\\/bff\\/collab/, '/collab/v1')")
    expect(proxy).toContain("path: '/bff/collab/*'")
  })

  it('injects the caller key server-side and never returns it to the client', () => {
    expect(proxy).toContain("Deno.env.get('ASSIST_API_KEY')")
    expect(proxy).toContain("headers.set('X-Olumi-Assist-Key', assistKey)")
  })

  it('never logs the token — the proxy is a place a credential could be echoed and is not', () => {
    const consoleLines = proxy.split('\n').filter((l) => l.includes('console.'))
    // POSITIVE CONTROL: there ARE console lines to inspect, so an empty result
    // below means "none of them carries the token", not "there is nothing here".
    expect(consoleLines.length).toBeGreaterThan(0)
    for (const line of consoleLines) {
      expect(line).not.toContain(TOKEN_HEADER)
      expect(line.toLowerCase()).not.toContain('token')
      expect(line).not.toContain('targetUrl')
    }
  })

  it('is bound in netlify.toml at the path its own config declares', () => {
    const toml = read('netlify.toml')
    expect(toml).toContain('function = "collab-proxy"')
    expect(toml).toContain('path = "/bff/collab/*"')
  })

  it('is declared in BOTH vite dev-proxy blocks — one alone diverges dev from preview', () => {
    const vite = read('vite.config.ts')
    const declarations = vite.split("'/bff/collab'").length - 1
    // POSITIVE CONTROL: the sibling seam is duplicated exactly twice, which is
    // what establishes 2 as the correct expectation rather than a guess.
    const ceeDeclarations = vite.split("'/bff/cee'").length - 1
    expect(ceeDeclarations).toBe(2)
    expect(declarations).toBe(2)

    const rewrites = vite.split("replace(/^\\/bff\\/collab/, '/collab/v1')").length - 1
    expect(rewrites).toBe(2)
  })
})
