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

/** CEE's stored graph read, the reload path, as the signed-in user. */
export async function storedRead(
  request: APIRequestContext, scenarioId: string, accessToken: string,
): Promise<{ status: number; body: Record<string, any> | null }> {
  const r = await request.get(`${ORIGIN}/bff/cee/scenarios/${scenarioId}/graph`, {
    headers: { Authorization: `Bearer ${accessToken}` },
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
