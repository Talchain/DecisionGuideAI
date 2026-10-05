// J1 journey helpers. Everything signs in, drafts and waits through
// `e2e/core/lib/harness.ts`; this file adds only what a whole-stack journey needs
// on top: the checked-out tuple, the LLM boundary's ledger, and reads of CEE's
// stored state with the signed-in user's own token.
import fs from 'node:fs'
import path from 'node:path'
import type { APIRequestContext } from '@playwright/test'
import { ORIGIN } from '../../lib/harness'

export const CEE_URL = process.env.J1_CEE_URL ?? 'http://127.0.0.1:3101'

export interface Tuple { ui: string; cee: string; plot: string; isl: string; mode: string }

/** The SHAs the workflow checked out. Read from env, never transcribed. */
export function tuple(): Tuple {
  const t = {
    ui: process.env.DGAI_SHA ?? '', cee: process.env.CEE_SHA ?? '',
    plot: process.env.PLOT_SHA ?? '', isl: process.env.ISL_SHA ?? '', mode: process.env.J1_MODE ?? '',
  }
  for (const [k, v] of Object.entries(t)) {
    if (k !== 'mode' && !/^[0-9a-f]{40}$/.test(v)) throw new Error(`[j1] tuple.${k} is not a 40-char SHA: "${v}"`)
  }
  if (t.mode !== 'replay' && t.mode !== 'record') throw new Error(`[j1] J1_MODE is "${t.mode}"`)
  return t
}

export interface LedgerRow { outcome: string; seq?: number; signature?: string; recordings?: number; file?: string }

export function ledger(): LedgerRow[] {
  const p = process.env.JOURNEY_LLM_LEDGER
  if (!p) throw new Error('[j1] JOURNEY_LLM_LEDGER is unset: the LLM boundary was not started')
  if (!fs.existsSync(p)) return []
  return fs.readFileSync(p, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l) as LedgerRow)
}

/** Frozen recordings available to a replay run. */
export function frozenRecordings(): string[] {
  const dir = process.env.JOURNEY_LLM_FIXTURES
  if (!dir) throw new Error('[j1] JOURNEY_LLM_FIXTURES is unset')
  return fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => /^\d+-.*\.json$/.test(f)) : []
}

/**
 * A replay MISS means a call had no frozen answer, so the product ran on a refusal.
 * That run measured nothing: it is red as could-not-measure, never a product verdict
 * and never a pass.
 */
export function assertNoReplayMiss(step: string): void {
  if (process.env.J1_MODE !== 'replay') return
  const miss = ledger().filter((r) => r.outcome === 'miss' || r.outcome === 'unknown_host')
  if (miss.length) {
    throw new Error(
      `[j1] ${step}: COULD NOT MEASURE. ${miss.length} LLM call(s) had no frozen recording ` +
      `(first: #${miss[0].seq} ${miss[0].signature}). The frozen set is stale for this tuple; ` +
      `a record run refreshes it.`,
    )
  }
}

export const scenarioIdFromUrl = (url: string): string | null =>
  url.match(/#\/scenario\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i)?.[1] ?? null

/**
 * CEE's stored graph read (the reload path), sent exactly as the UI sends it
 * (`src/adapters/cee/scenarioGraph.ts`): POST, body `{ user_id }`, headers from the
 * one shared builder's shape (`X-User-Id` + `Authorization: Bearer`). CEE derives
 * the caller from the verified JWT, so `userId` and `accessToken` belong to one account.
 */
export async function storedRead(
  request: APIRequestContext, scenarioId: string, who: { userId: string; accessToken: string },
): Promise<{ status: number; body: Record<string, any> | null }> {
  const r = await request.post(`${ORIGIN}/bff/cee/scenarios/${encodeURIComponent(scenarioId)}/graph`, {
    headers: { 'Content-Type': 'application/json', 'X-User-Id': who.userId, Authorization: `Bearer ${who.accessToken}` },
    data: { user_id: who.userId },
  })
  let body: Record<string, any> | null = null
  try { body = (await r.json()) as Record<string, any> } catch { /* not JSON */ }
  return { status: r.status(), body }
}

export const evidenceDir = (): string => {
  const d = path.join(process.cwd(), 'test-results', 'journey', 'evidence')
  fs.mkdirSync(d, { recursive: true })
  return d
}

export function writeEvidence(name: string, value: unknown): void {
  fs.writeFileSync(path.join(evidenceDir(), name), typeof value === 'string' ? value : JSON.stringify(value, null, 1))
}

/**
 * Put an EXISTING account's session into a fresh browser context, the same way
 * `mintAndInject` does for a new one: written from a non-app same-origin document
 * (`/version.json`) so it cannot race the app's boot. The context starts empty, so
 * nothing but this key comes from the earlier browser.
 */
export async function injectSession(
  page: import('@playwright/test').Page, storageKey: string, raw: unknown,
): Promise<void> {
  await page.goto(`${ORIGIN}/version.json`, { waitUntil: 'domcontentloaded' })
  await page.evaluate(([k, v]) => {
    localStorage.clear(); sessionStorage.clear(); localStorage.setItem(k as string, v as string)
  }, [storageKey, JSON.stringify(raw)])
}

/** Every localStorage + sessionStorage key and value in the page, for leak scans. */
export const browserStorage = (page: import('@playwright/test').Page): Promise<Record<string, string>> =>
  page.evaluate(() => {
    const out: Record<string, string> = {}
    for (const s of [localStorage, sessionStorage]) {
      for (let i = 0; i < s.length; i++) { const k = s.key(i)!; out[k] = s.getItem(k) ?? '' }
    }
    return out
  })

/** PostgREST `scenarios` rows visible to a token (RLS decides). */
export async function scenariosVisibleTo(
  request: APIRequestContext, accessToken: string,
): Promise<{ status: number; ids: string[] }> {
  const base = process.env.CORE_SUPABASE_URL!
  const r = await request.get(`${base}/rest/v1/scenarios?select=id`, {
    headers: { apikey: process.env.CORE_SUPABASE_KEY!, Authorization: `Bearer ${accessToken}` },
  })
  const rows = (await r.json().catch(() => [])) as { id: string }[]
  return { status: r.status(), ids: Array.isArray(rows) ? rows.map((x) => x.id) : [] }
}
