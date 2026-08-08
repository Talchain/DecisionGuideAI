/**
 * Row 2.951 (UI half) — no `.app`-TLD Olumi origin in any origin allowlist.
 *
 * `olumi.app` / `app.olumi.app` are owned by a THIRD PARTY (an unrelated
 * German family-tasks app) — the real product domains are `olumi.ai` and the
 * Netlify `*.netlify.app` subdomains. Measured live on 8 Aug 2026: the
 * deployed staging edge proxies echoed `access-control-allow-origin:
 * https://app.olumi.app` (HTTP 200) while a random origin got 403 — and the
 * ISL proxy injects its API key server-side, so an allowlisted third-party
 * origin can drive the proxied surface from visitors' browsers.
 *
 * This guard pins the fix. It is a source-text check because the Netlify edge
 * functions and Supabase functions run in Deno and cannot be imported into
 * vitest (same seam pattern as orchestrator-proxy.headers.test.ts).
 *
 * Anti-vacuity design (traps 12/13/19):
 * - The file list is DERIVED by scanning both function directories for
 *   `ALLOWED_ORIGINS` declarations, never hand-listed. Zero files found is a
 *   hard failure, and one independently-known carrier (isl-proxy.ts) is
 *   asserted present so a renamed declaration fails loud instead of silently
 *   scanning nothing.
 * - Every scanned file must yield a non-empty array with at least one
 *   parseable http(s) origin — proving the TLD predicate below iterates a
 *   non-empty domain in THAT file, so its absence claim cannot pass by
 *   skipping everything. A corpus-level control proves the `.netlify.app`
 *   exemption branch is actually exercised somewhere (the probe whose
 *   expected answer differs). NOTE: unquoted identifier entries (e.g.
 *   delete-account's env-derived `APP_URL`) are deployment state and outside
 *   this source-text guard's scope — named here so the gap is loud.
 * - The rejection is identity-bound to the exact origin
 *   `https://app.olumi.app` AND backed by a domain predicate (no allowlisted
 *   hostname ends in `.app` unless it ends in `.netlify.app`), so any future
 *   `.app`-TLD slip fails too. The `.netlify.app` entries staying green while
 *   `app.olumi.app` fails at the pre-fix tree is the discriminating pair.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { resolve, join } from 'node:path'

const REPO_ROOT = resolve(__dirname, '../..')
const SCAN_DIRS = ['netlify/edge-functions', 'supabase/functions']

/** All .ts files under the scanned dirs that declare an ALLOWED_ORIGINS array. */
function allowlistFiles(): string[] {
  const files: string[] = []
  for (const dir of SCAN_DIRS) {
    const abs = join(REPO_ROOT, dir)
    for (const entry of readdirSync(abs, { recursive: true }) as string[]) {
      if (!/\.(ts|tsx|js|mjs)$/.test(entry)) continue
      const rel = join(dir, entry)
      const src = readFileSync(join(REPO_ROOT, rel), 'utf8')
      if (/ALLOWED_ORIGINS\s*=\s*\[/.test(src)) files.push(rel)
    }
  }
  return files.sort()
}

/** Extract the quoted origin strings from a file's ALLOWED_ORIGINS array literal. */
function allowlistEntries(rel: string): string[] {
  const src = readFileSync(join(REPO_ROOT, rel), 'utf8')
  const match = src.match(/ALLOWED_ORIGINS\s*=\s*\[([\s\S]*?)\]/)
  expect(match, `${rel}: ALLOWED_ORIGINS array literal must be extractable`).not.toBeNull()
  const entries = [...match![1].matchAll(/['"]([^'"]+)['"]/g)].map((m) => m[1])
  expect(entries.length, `${rel}: extracted allowlist must be non-empty`).toBeGreaterThan(0)
  return entries
}

describe('origin allowlists carry no .app-TLD Olumi origin (row 2.951)', () => {
  const files = allowlistFiles()

  it('derivation finds allowlist carriers (vacuity control)', () => {
    expect(files.length).toBeGreaterThan(0)
    // Independently-known carrier: if the declaration is renamed, fail loud
    // here rather than letting every absence assertion pass over nothing.
    expect(files).toContain('netlify/edge-functions/isl-proxy.ts')
  })

  it.each(files.map((f) => [f]))('%s: allowlist is visible (positive control)', (rel) => {
    // Prove the extractor sees real content AND the TLD predicate below has a
    // non-empty domain in this file (it skips non-http entries, so zero
    // parseable origins would make its absence claim vacuous).
    const parseable = allowlistEntries(rel).filter((e) => /^https?:\/\//.test(e))
    expect(parseable.length, `${rel}: no parseable http(s) origin extracted`).toBeGreaterThan(0)
  })

  it('the .netlify.app exemption branch is exercised somewhere (discriminating control)', () => {
    // At least one scanned allowlist must carry a *.netlify.app origin, so the
    // TLD test's green is a discrimination (netlify.app passes, olumi.app
    // fails), never a predicate that stopped looking.
    const all = files.flatMap((rel) => allowlistEntries(rel))
    const netlify = all.filter(
      (e) => /^https?:\/\//.test(e) && new URL(e).hostname.endsWith('.netlify.app'),
    )
    expect(netlify.length).toBeGreaterThan(0)
  })

  it.each(files.map((f) => [f]))(
    '%s: does not allowlist https://app.olumi.app (identity-bound)',
    (rel) => {
      expect(allowlistEntries(rel)).not.toContain('https://app.olumi.app')
    },
  )

  it.each(files.map((f) => [f]))(
    '%s: no allowlisted hostname is on the .app TLD (except *.netlify.app)',
    (rel) => {
      for (const entry of allowlistEntries(rel)) {
        if (!/^https?:\/\//.test(entry)) continue
        const host = new URL(entry).hostname
        if (host.endsWith('.netlify.app')) continue
        expect(
          host.endsWith('.app'),
          `${rel}: '${entry}' is a .app-TLD origin — olumi.app is third-party-owned (row 2.951)`,
        ).toBe(false)
      }
    },
  )
})
