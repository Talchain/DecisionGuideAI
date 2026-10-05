// J1 journey helpers. Everything signs in, drafts and waits through
// `e2e/core/lib/harness.ts`; this file adds only what a whole-stack journey needs
// on top: the checked-out tuple, the LLM boundary's ledger, and reads of CEE's
// stored state with the signed-in user's own token.
import fs from 'node:fs'
import path from 'node:path'
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
 * The LLM boundary must have answered EVERY call so far exactly as frozen: in replay, the
 * only rows allowed are the index and exact `hit`s; in record, only `recorded`. A miss,
 * a drift (the request changed since the recording), an exhausted recording, a reuse,
 * an upstream error or a 429 all mean the product ran on something other than the
 * frozen answer to ITS request. That run measured nothing: red as could-not-measure,
 * never a product verdict and never a pass. (Allow-list, not deny-list: a new outcome
 * is red until named here. Codex buddy #2513 findings 6+7.)
 */
export function assertBoundaryClean(step: string): void {
  const allowed = process.env.J1_MODE === 'record' ? ['recorded'] : ['index', 'hit']
  const bad = ledger().filter((r) => !allowed.includes(r.outcome))
  if (bad.length) {
    const counts = bad.reduce<Record<string, number>>((c, r) => ({ ...c, [r.outcome]: (c[r.outcome] ?? 0) + 1 }), {})
    throw new Error(
      `[j1] ${step}: COULD NOT MEASURE. The LLM boundary answered ${bad.length} call(s) other than exactly as frozen ` +
      `(${JSON.stringify(counts)}; first: #${bad[0].seq} ${bad[0].outcome} ${bad[0].signature ?? ''}). ` +
      `A drift row names its diagnosis file in the ledger directory.`,
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
  scenarioId: string, who: { userId: string; accessToken: string },
): Promise<{ status: number; body: Record<string, any> | null }> {
  const r = await credentialedFetch('CEE stored read', `${ORIGIN}/bff/cee/scenarios/${encodeURIComponent(scenarioId)}/graph`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-User-Id': who.userId, Authorization: `Bearer ${who.accessToken}` },
    body: JSON.stringify({ user_id: who.userId }),
  })
  const body = r.body && typeof r.body === 'object' && !Array.isArray(r.body) ? (r.body as Record<string, any>) : null
  return { status: r.status, body }
}

/**
 * EVERY request that carries a credential goes through here (Codex buddy r2 + r3, #2513):
 * Node fetch, never Playwright `request`, which appends the request's headers to a thrown
 * error, and errors reach the uploaded HTML report. A transport failure is rethrown with a
 * message built here, which holds no header and no body.
 */
async function credentialedFetch(label: string, url: string, init: RequestInit): Promise<{ status: number; body: unknown }> {
  let r: Response
  try {
    r = await fetch(url, init)
  } catch (e) {
    throw new Error(`[j1] ${label} could not measure: transport ${(e as Error)?.name ?? 'error'}`)
  }
  let body: unknown = null
  try { body = await r.json() } catch { /* not JSON: the caller judges the status */ }
  return { status: r.status, body }
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

/**
 * PostgREST `scenarios` rows visible to a token (RLS decides). Anything but a 200 with
 * an array THROWS: a refused or broken probe sees nothing, and nothing is not absence.
 */
export async function scenariosVisibleTo(accessToken: string): Promise<{ status: number; ids: string[] }> {
  const r = await credentialedFetch('PostgREST scenarios probe', `${process.env.CORE_SUPABASE_URL!}/rest/v1/scenarios?select=id`, {
    headers: { apikey: process.env.CORE_SUPABASE_KEY!, Authorization: `Bearer ${accessToken}` },
  })
  if (r.status !== 200 || !Array.isArray(r.body)) {
    throw new Error(`[j1] PostgREST scenarios probe could not measure: http ${r.status}, body ${Array.isArray(r.body) ? 'array' : typeof r.body}`)
  }
  return { status: r.status, ids: (r.body as { id: string }[]).map((x) => x.id) }
}

/**
 * One `scenarios` row read with the LOCAL job's service role (this run's own Supabase;
 * the key is minted per run and masked). For rows no user token can read, e.g. a guest's.
 * Node fetch, never Playwright `request`: Playwright appends the request's headers to a
 * thrown error, and errors reach the uploaded HTML report (Codex buddy r2, #2513). Every
 * failure is rethrown with a message built here, which holds no header.
 */
export async function scenarioRowAsService(scenarioId: string): Promise<Record<string, unknown>> {
  const key = process.env.J1_SB_SERVICE_ROLE_KEY
  if (!key) throw new Error('[j1] J1_SB_SERVICE_ROLE_KEY is unset: cannot read the row')
  const r = await credentialedFetch(`service read of scenario ${scenarioId}`,
    `${process.env.CORE_SUPABASE_URL!}/rest/v1/scenarios?id=eq.${encodeURIComponent(scenarioId)}&select=*`,
    { headers: { apikey: key, Authorization: `Bearer ${key}` } })
  const rows = Array.isArray(r.body) ? (r.body as Record<string, unknown>[]) : null
  if (r.status !== 200 || !rows || rows.length !== 1) {
    throw new Error(`[j1] service read of scenario ${scenarioId} could not measure: http ${r.status}, ${rows ? rows.length : 'no'} row(s)`)
  }
  return rows[0]
}

/**
 * `v5_handler_facts` rows for one scenario visible to a user token (RLS decides). The UI
 * reads this table directly (analysisRunHistoryService.ts:95). Throws unless 200 + array.
 */
export async function handlerFactsVisibleTo(scenarioId: string, accessToken: string): Promise<number> {
  const r = await credentialedFetch('PostgREST v5_handler_facts probe',
    `${process.env.CORE_SUPABASE_URL!}/rest/v1/v5_handler_facts?scenario_id=eq.${encodeURIComponent(scenarioId)}&select=scenario_id`,
    { headers: { apikey: process.env.CORE_SUPABASE_KEY!, Authorization: `Bearer ${accessToken}` } })
  if (r.status !== 200 || !Array.isArray(r.body)) {
    throw new Error(`[j1] PostgREST v5_handler_facts probe could not measure: http ${r.status}`)
  }
  return (r.body as unknown[]).length
}

// ── Turn capture ─────────────────────────────────────────────────────────────
// The served turn bodies, read from OUTSIDE the app (Playwright's response
// listener), so the app receives exactly what CEE sent. A streamed draft's body is
// the terminal frame's `payload` (`event: stage`, `status: "complete"`).

export interface CapturedTurn { url: string; status: number; at: number; body: Record<string, any> | null }

export function captureTurns(page: import('@playwright/test').Page): CapturedTurn[] {
  const turns: CapturedTurn[] = []
  page.on('response', async (r) => {
    const url = r.url()
    if (!/\/proxy\/v\d+\/turn(\/stream)?(\?|$)/.test(url)) return
    const rec: CapturedTurn = { url, status: r.status(), at: Date.now(), body: null }
    turns.push(rec)
    try {
      const text = await r.text()
      if (/\/turn\/stream/.test(url)) {
        for (const line of text.split('\n')) {
          if (!line.startsWith('data:')) continue
          try {
            const frame = JSON.parse(line.slice(5).trim())
            if (frame?.status === 'complete' && frame?.payload) rec.body = frame.payload
          } catch { /* partial frame */ }
        }
      } else {
        rec.body = JSON.parse(text)
      }
    } catch { /* body unavailable: the assertion that needs it fails by name */ }
  })
  return turns
}

/** The `analysis_result` block of a turn body, if it carries one. */
export const analysisResultOf = (body: Record<string, any> | null): Record<string, any> | null =>
  (Array.isArray(body?.blocks) ? body!.blocks.find((b: any) => b?.type === 'analysis_result') : null) ?? null

/** Wait until a turn that started after `since` has a parsed body. */
export async function nextTurn(
  turns: CapturedTurn[], since: number, label: string, timeoutMs = 240_000,
): Promise<CapturedTurn> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const t = turns.find((x) => x.at >= since && x.body)
    if (t) return t
    await new Promise((r) => setTimeout(r, 1_000))
  }
  throw new Error(`[j1] ${label}: no turn with a parsed body arrived within ${Math.round(timeoutMs / 1000)}s ` +
    `(${turns.filter((x) => x.at >= since).length} turn response(s) seen, none parsed)`)
}

/** `from::to` pairs, the only edge identity the stored graph carries. */
export const edgeKey = (e: { from: string; to: string }): string => `${e.from}::${e.to}`
