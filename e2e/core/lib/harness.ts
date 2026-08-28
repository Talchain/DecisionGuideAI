// e2e/core/lib/harness.ts
// =============================================================================
// SYSTEM E — the shared instrument for the Core PoC mounted-browser suite.
// =============================================================================
//
// WHAT THIS SUITE IS. 5-10 specs that drive the DEPLOYED staging build in a real
// browser and falsify a Core claim each. It is not a regression net and not a
// replacement for the historical e2e estate — a spec that would not falsify a
// Core claim does not belong here.
//
// WHY IT IS SEPARATE FROM playwright.staging.config.ts. That config's two specs
// are deliberately SELF-SKIPPING and one has never been executed against a live
// environment on purpose. Self-skipping is correct for an optional gate and fatal
// for a Core gate: a skipped suite exits 0 and looks exactly like a pass. This
// suite hard-fails instead, so the two semantics cannot be mixed in one config.
//
// ⛔ SECRETS. No service-role key, ever. Accounts are minted through the project's
// OPEN REST signup endpoint using the PUBLIC publishable key that every browser
// visitor already downloads, crawled from the deployed bundle. Tokens live in
// process memory only and are never logged, never written, never put in a URL.
// If a key must be identified at all, it is identified by a SHA-256 PREFIX.
//
// ⚠ ON THE ONE PLACE THIS ESTATE REACHED FOR A SERVICE-ROLE KEY. The required-login
// gate declares SMOKE_SUPABASE_SERVICE_ROLE_KEY, justified by "self-signup is
// IMPOSSIBLE: signInWithMagicLink calls signInWithOtp({ shouldCreateUser: false })".
// That premise is TRUE OF THE UI'S MAGIC-LINK PATH and FALSE OF THE PROJECT'S REST
// ENDPOINT, which is open and mints accounts today. Two honest surfaces, two
// definitions of "signup" — a correct premise whose conclusion does not follow.
// This file takes the third path and needs no privileged credential.

import { createHash } from 'node:crypto'
import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'

export const ORIGIN = process.env.CORE_UI_URL ?? 'https://staging--olumi.netlify.app'

/**
 * The commit the TARGET is currently serving.
 *
 * ⭐ ACCEPTANCE RUNS SHOULD TARGET AN IMMUTABLE DEPLOY URL, NOT A MUTABLE ALIAS.
 * `staging--olumi.netlify.app` is an alias: it can move under a running drive, and a
 * mid-run deploy silently splits a measurement into two populations (this happened
 * on 2026-08-27 and invalidated a rate). Point `CORE_UI_URL` at the SHA-pinned
 * Netlify permalink for the build under test whenever you have it.
 *
 * The permalink FORM is owned by the stale-chunk lane; this file deliberately does
 * not invent one. Until it is supplied, the run still cannot silently straddle a
 * deploy: globalSetup records the served commit and globalTeardown re-reads it and
 * FAILS the run if it moved.
 */
export async function deployedBuild(): Promise<string> {
  try {
    const r = await fetch(`${ORIGIN}/version.json`, { cache: 'no-store' })
    const j = (await r.json()) as { commit?: string; short?: string }
    return j.short ?? j.commit ?? 'unknown'
  } catch {
    return 'unreachable'
  }
}

export const sha256Prefix = (s: string, n = 16): string =>
  createHash('sha256').update(String(s)).digest('hex').slice(0, n)

// ---------------------------------------------------------------------------
// Supabase resolution — the browser's own path, with a positive control.
// ---------------------------------------------------------------------------
// Ported from scripts/golden-journey/lib/wire.mjs resolveSupabaseFromDeployedUi.
// The control is not decoration: the first version of that crawl matched only
// `/assets/...` with a LEADING SLASH, found 1 chunk of 71, and reported "no
// supabase config in the deployed UI" — a confident absence from a blind
// instrument. An absence claim must first prove it can see a presence.

// ⚠ MATCHES `assets/x.js` WITH OR WITHOUT A LEADING SLASH, and `./x.js`.
// The deployed entry chunk references siblings as "assets/AppPoC-….js" — NO leading slash.
// A leading-slash-only pattern crawls 1 chunk of 83 and reports a confident false absence.
// The golden-journey harness carries a comment warning about exactly this; I copied the comment
// and reimplemented the bug. A WARNING IS NOT A GUARD — the positive control is.
const ASSET_RE = /["'(]([^"'()\s]*[A-Za-z0-9._-]+\.js)["')]/g

const toAssetPath = (p: string): string | null => {
  if (p.startsWith('http')) { try { return new URL(p).pathname } catch { return null } }
  if (p.startsWith('/')) return p
  if (p.startsWith('./')) return `/assets/${p.slice(2)}`
  if (p.includes('assets/')) return `/${p.replace(/^\.?\//, '')}`
  return `/assets/${p}`
}

export interface SupabaseResolution {
  restBase: string
  key: string
  keySha256: string
  chunksFetched: number
  controlChunks: string[]
  source: string
}

export async function resolveSupabase(maxChunks = 400, timeoutMs = 120_000): Promise<SupabaseResolution> {
  const envUrl = process.env.CORE_SUPABASE_URL
  const envKey = process.env.CORE_SUPABASE_KEY
  if (envUrl && envKey) {
    return {
      restBase: envUrl, key: envKey, keySha256: sha256Prefix(envKey),
      chunksFetched: 0, controlChunks: ['(env override)'],
      source: 'CORE_SUPABASE_URL/CORE_SUPABASE_KEY environment override',
    }
  }

  const deadline = Date.now() + timeoutMs
  const seen = new Set<string>()
  const queue: string[] = []
  const add = (p: string) => {
    const path = toAssetPath(p)
    if (path && path.endsWith('.js') && !seen.has(path)) { seen.add(path); queue.push(path) }
  }

  let host: string | null = null
  let key: string | null = null
  const controlChunks: string[] = []
  let fetched = 0

  const html = await (await fetch(`${ORIGIN}/`, { cache: 'no-store' })).text()
  for (const m of html.matchAll(ASSET_RE)) add(m[1])

  while (queue.length && fetched < maxChunks && Date.now() < deadline) {
    const p = queue.shift() as string
    fetched++
    let body: string
    try {
      const r = await fetch(`${ORIGIN}${p}`, { cache: 'no-store' })
      if (!r.ok) continue
      body = await r.text()
    } catch { continue }
    for (const m of body.matchAll(ASSET_RE)) add(m[1])
    if (!host) { const h = body.match(/https:\/\/[a-z0-9]+\.supabase\.co/); if (h) host = h[0] }
    if (!key) {
      const k = body.match(/sb_publishable_[A-Za-z0-9_-]{10,}/)
        || body.match(/eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}/)
      if (k) key = k[0]
    }
    // POSITIVE CONTROL — a string the bundle is known to spell.
    if (body.includes('v5_handler_facts')) controlChunks.push(p)
  }

  if (controlChunks.length === 0) {
    throw new Error(
      `[core] BUNDLE CRAWL POSITIVE CONTROL DID NOT FIRE: "v5_handler_facts" appears in none of ` +
      `the ${fetched} chunks crawled (of ${seen.size} discovered). The crawler is blind, so NO ` +
      `presence or absence claim may be made from it — including "there is no Supabase config".`,
    )
  }
  if (!host || !key) {
    throw new Error(
      `[core] crawl saw ${fetched} chunks and the control FIRED (${controlChunks.join(', ')}), but ` +
      `${!host ? 'no supabase host' : 'no publishable key'} was found — the config shape has moved.`,
    )
  }

  return {
    restBase: host, key, keySha256: sha256Prefix(key),
    chunksFetched: fetched, controlChunks,
    source: `deployed UI bundle at ${ORIGIN} (${fetched} chunks crawled)`,
  }
}

// ---------------------------------------------------------------------------
// Account minting — OPEN REST signup, publishable key only.
// ---------------------------------------------------------------------------

export interface WitnessUser {
  email: string
  userId: string
  accessToken: string   // MEMORY ONLY — never log, never persist, never put in a URL
  tokenSha256: string
}

export async function mintWitnessUser(sb: SupabaseResolution, label: string): Promise<WitnessUser> {
  const token = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
  const email = `olumi-witness+core-${label}-${token}@example.test`
  // memory-only; the account is throwaway and is never re-entered
  const password = `${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2).toUpperCase()}!7`

  const res = await fetch(`${sb.restBase}/auth/v1/signup`, {
    method: 'POST',
    headers: { apikey: sb.key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  const body = (await res.json().catch(() => null)) as Record<string, unknown> | null
  const accessToken =
    (body?.access_token as string | undefined) ??
    ((body?.session as Record<string, unknown> | undefined)?.access_token as string | undefined) ??
    null
  const userId =
    ((body?.user as Record<string, unknown> | undefined)?.id as string | undefined) ??
    (body?.id as string | undefined) ?? null

  if (!res.ok || !accessToken || !userId) {
    // reason names response KEYS, never values — a failed signup must not leak a body
    throw new Error(
      `[core] mintWitnessUser(${label}) FAILED: http ${res.status}, response keys ` +
      `[${body ? Object.keys(body).join(', ') : '(unparseable)'}]. No account was created, so any ` +
      `downstream assertion would be measuring the wrong identity.`,
    )
  }
  return { email, userId, accessToken, tokenSha256: sha256Prefix(accessToken) }
}

// ---------------------------------------------------------------------------
// The wire interceptor. The recorder does NOT capture SSE turn POSTs.
// ---------------------------------------------------------------------------

export interface WireCall { url: string; method: string; status: number | string }

/**
 * A draft turn's stream, observed from OUTSIDE the app.
 *
 * `ended` is the response body closing. `sawTerminal` is a frame with
 * `"status":"complete"` — the producer's own terminal event
 * (`src/v5/streamedDraftFrames.ts`: `if (frame.status === 'complete') sawTerminal = true`,
 * and a close without one raises `StreamAbandonedError('no_terminal_frame')`).
 */
export interface TurnStream {
  url: string; method: string; status: number | string
  startedAt: number; endedAt: number | null
  ended: boolean; sawTerminal: boolean; isStream: boolean; bytes: number
}

export async function installWireInterceptor(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const W = window as unknown as {
      __WIRE__: unknown[]; __TURNS__: unknown[]; __CORE_FETCH_WRAPPED__?: boolean
    }
    // Idempotent: a spec may install this AND call a helper that installs it too.
    // Two registrations would mean two wrappers and every call recorded twice.
    if (W.__CORE_FETCH_WRAPPED__) return
    W.__CORE_FETCH_WRAPPED__ = true
    W.__WIRE__ = []
    W.__TURNS__ = []

    // The draft turn, and ONLY the draft turn. `/turn/stop` must not match, and a
    // future `/turn/<something-else>` must not silently start counting.
    const isDraftTurn = (u: string): boolean => /\/proxy\/v\d+\/turn(\/stream)?(\?|$)/.test(u)

    const orig = window.fetch
    window.fetch = async (...args: Parameters<typeof fetch>) => {
      const a0 = args[0] as unknown
      const url = typeof a0 === 'string' ? a0 : ((a0 as Request)?.url ?? String(a0))
      const method =
        ((args[1] as RequestInit | undefined)?.method) ?? ((a0 as Request)?.method) ?? 'GET'
      let r: Response
      try {
        r = await orig(...args)
      } catch (e) {
        W.__WIRE__.push({ url, method, status: 'THREW' })
        throw e
      }
      W.__WIRE__.push({ url, method, status: r.status })

      if (isDraftTurn(url)) {
        const rec = {
          url, method, status: r.status, startedAt: Date.now(), endedAt: null as number | null,
          ended: false, sawTerminal: false, isStream: /\/turn\/stream(\?|$)/.test(url), bytes: 0,
        }
        W.__TURNS__.push(rec)
        // ⚠ `clone()`, NOT `tee()` + a rebuilt Response. The app must receive the
        // EXACT object `fetch` returned; reconstructing it risks dropping something
        // the consumer reads. The clone is drained continuously here, so it cannot
        // apply backpressure to the branch the app is reading.
        // MEASURED 2026-08-28 on build 18727b64: with this clone installed the app
        // still drafted a complete 16-node model, so the observation is passive.
        try {
          const probe = r.clone()
          const body = probe.body
          if (!body) { rec.ended = true; rec.endedAt = Date.now() }
          else {
            void (async () => {
              const reader = body.getReader()
              const dec = new TextDecoder()
              let buf = ''
              for (;;) {
                const { done, value } = await reader.read()
                if (done) break
                rec.bytes += value?.length ?? 0
                buf += dec.decode(value, { stream: true })
                if (/"status"\s*:\s*"complete"/.test(buf)) rec.sawTerminal = true
                // Bound memory. Tested BEFORE truncating, and the retained tail is
                // far longer than the token, so a match cannot straddle the cut.
                if (buf.length > 262_144) buf = buf.slice(-4_096)
              }
              rec.ended = true; rec.endedAt = Date.now()
            })().catch(() => { rec.ended = true; rec.endedAt = Date.now() })
          }
        } catch { rec.ended = true; rec.endedAt = Date.now() }
      }
      return r
    }
  })
}

export const readTurnStreams = (page: Page): Promise<TurnStream[]> =>
  page.evaluate(() => ((window as unknown as { __TURNS__?: TurnStream[] }).__TURNS__ ?? []))

/**
 * ⭐⭐ WAIT FOR THE TERMINAL EVENT, NOT FOR AN INFERRED IDLE STATE.
 *
 * THE DEFECT THIS REPLACES. `draftAsGuest` used to be `waitForModel` +
 * `waitForStableLayout`, and NEITHER consults the draft's working state:
 * `waitForModel` returns as soon as any node exists, and `waitForStableLayout`
 * keys only on `nodeCount|distinctX|maxColumnOccupancy`. MEASURED on build
 * 18727b64, 2026-08-28, at exactly E2's assertion point:
 *
 *   t=30s  nodes=16  headline="Not ready for analysis yet"  Analyse DISABLED
 *          the product's own copy says "still drafting"
 *          the turn stream is STILL OPEN — ended=false, terminal frame not seen
 *   t=75s  the stream closes with its terminal frame (74.7s, 44,473 bytes)
 *
 * So E2 fired roughly forty-five seconds before the draft finished, and its
 * load-bearing assertion — Analyse disabled — was satisfiable by a TRANSIENT.
 * Analyse is disabled while streaming ANYWAY, so had the product regressed to
 * enable Analyse after settling despite a missing threshold, E2 would still have
 * printed PASS. The spec could not tell "disabled because a threshold is missing"
 * from "disabled because the draft is still streaming".
 *
 * ⚠ AND NOTE WHICH DIRECTION THIS MUST NOT BE FIXED IN. This suite's ancestor keyed
 * a settle detector on an inferred idle state, tore the context down mid-stream, and
 * manufactured a 33–61% draft-failure rate that had to be withdrawn after being
 * reported. The answer to "we settled too early" is not a longer sleep or a wider
 * phrase list — both are still inferences. It is the producer's own terminal event.
 *
 * NON-VACUITY IS ENFORCED. "No unfinished streams" is trivially true of a run that
 * observed no streams at all, so zero observed turns is a hard error: a blind
 * interceptor and a genuinely silent app produce identical output.
 */
export async function waitForDraftTurnComplete(
  page: Page, { timeoutMs = 300_000, pollMs = 2_000 } = {},
): Promise<TurnStream[]> {
  const deadline = Date.now() + timeoutMs
  let seen: TurnStream[] = []
  for (;;) {
    seen = await readTurnStreams(page)
    if (seen.length > 0 && seen.every((t) => t.ended)) break
    if (Date.now() >= deadline) break
    await page.waitForTimeout(pollMs)
  }

  expect(
    seen.length,
    `[core] ZERO draft turn streams were observed. Every claim about the draft having FINISHED ` +
    `would be unsupported — an interceptor that installed too late and an app that never called ` +
    `the turn endpoint produce identical output. Install the interceptor BEFORE the first ` +
    `navigation, and check the turn route has not moved off /proxy/v{n}/turn[/stream].`,
  ).toBeGreaterThan(0)

  const unfinished = seen.filter((t) => !t.ended)
  expect(
    unfinished.map((t) => t.url),
    `[core] the draft turn stream never closed within ${Math.round(timeoutMs / 1000)}s. Asserting ` +
    `on the model now would measure a MID-STREAM transient and report it as the product.`,
  ).toEqual([])

  // A stream that closed without its terminal frame is exactly what the producer
  // calls `no_terminal_frame` — an abandoned draft, not a finished one.
  const abandoned = seen.filter((t) => t.isStream && !t.sawTerminal)
  expect(
    abandoned.map((t) => `${t.url} (${t.bytes}B in ${(t.endedAt ?? 0) - t.startedAt}ms)`),
    `[core] a draft turn stream CLOSED WITHOUT A TERMINAL FRAME. The producer treats this as ` +
    `StreamAbandonedError('no_terminal_frame'), so the model on screen is a partial draft and ` +
    `anything asserted about it describes an interrupted stream, not the product.`,
  ).toEqual([])

  return seen
}

export const readWire = (page: Page): Promise<WireCall[]> =>
  page.evaluate(() => ((window as unknown as { __WIRE__?: WireCall[] }).__WIRE__ ?? []) as WireCall[])

/**
 * PROVE THE INTERCEPTOR IS NON-ZERO before believing any absence derived from it.
 * An interceptor that installed too late, or was replaced by the app, records
 * nothing — and "no such call was made" is indistinguishable from "I was blind".
 */
export async function assertWireLive(page: Page, context: string): Promise<WireCall[]> {
  const wire = await readWire(page)
  expect(
    wire.length,
    `[core] WIRE INTERCEPTOR RECORDED ZERO CALLS at "${context}". Every absence claim below would ` +
    `be unsupported: a blind interceptor and a genuinely silent app produce identical output.`,
  ).toBeGreaterThan(0)
  return wire
}

// ---------------------------------------------------------------------------
// Geometry- and ancestor-aware control measurement.
// ---------------------------------------------------------------------------
// A testid that RESOLVES is not a control that EXISTS: an empty 0x0 <span>
// resolves exactly where a real control is a 47x21 <button>. And a per-element
// `disabled` check is NOT an enabled check — an ancestor <fieldset disabled>
// defeats it, which is why this reads `:disabled` (which propagates), the
// nearest disabled fieldset, and aria-disabled.

export interface ControlMeasurement {
  testid: string; tag: string; w: number; h: number
  disabledSelf: boolean; disabledByAncestorFieldset: boolean; ariaDisabled: boolean
  matchesDisabledPseudo: boolean
}

export async function measureControl(page: Page, testid: string): Promise<ControlMeasurement> {
  const loc = page.getByTestId(testid)
  await expect(
    loc,
    `[core] control "${testid}" did not resolve to exactly one element`,
  ).toHaveCount(1)
  return loc.evaluate((el, id) => {
    const r = el.getBoundingClientRect()
    return {
      testid: id as string,
      tag: el.tagName.toLowerCase(),
      w: Math.round(r.width),
      h: Math.round(r.height),
      disabledSelf: Boolean((el as HTMLButtonElement).disabled),
      disabledByAncestorFieldset: Boolean(el.closest('fieldset[disabled]')),
      ariaDisabled: el.getAttribute('aria-disabled') === 'true',
      matchesDisabledPseudo: el.matches(':disabled'),
    }
  }, testid)
}

/** A real, operable control: non-zero geometry AND enabled by every mechanism. */
export async function expectOperableControl(
  page: Page, testid: string, minW = 1, minH = 1,
): Promise<ControlMeasurement> {
  const m = await measureControl(page, testid)
  expect(
    m.w >= minW && m.h >= minH,
    `[core] "${testid}" resolved as <${m.tag}> at ${m.w}x${m.h} — a resolving testid is not a ` +
    `control. Expected at least ${minW}x${minH}.`,
  ).toBe(true)
  expect(
    m.disabledSelf || m.disabledByAncestorFieldset || m.ariaDisabled || m.matchesDisabledPseudo,
    `[core] "${testid}" is DISABLED (self=${m.disabledSelf} ancestorFieldset=` +
    `${m.disabledByAncestorFieldset} aria=${m.ariaDisabled} :disabled=${m.matchesDisabledPseudo}). ` +
    `Note a per-element check alone would have missed the fieldset case.`,
  ).toBe(false)
  return m
}

// ---------------------------------------------------------------------------
// Entry paths.
// ---------------------------------------------------------------------------

/**
 * A GENUINELY fresh guest.
 *
 * ⚠ `localStorage.clear()` INSIDE the running app does NOT give you one: the app's
 * unload path rewrites `olumi-canvas-autosave` from memory within ~900ms (measured
 * by the System B drive, 2026-08-27). Clearing therefore has to happen in a
 * SAME-ORIGIN document that is not the app — `/version.json` serves that purpose —
 * and only then do we navigate in. A new TAB would not have helped: a tab is not a
 * context and shares the profile.
 */
export interface FreshGuestResult {
  keysBeforeClear: string[]
  clearedCount: number
  keysAfterClear: string[]   // measured AT /version.json — this is what proves the clear landed
  keysAfterEntry: string[]   // the app's OWN boot defaults; NOT evidence of staleness
}

export async function freshGuest(page: Page): Promise<FreshGuestResult> {
  await page.goto(`${ORIGIN}/version.json`, { waitUntil: 'domcontentloaded' })
  const keysBeforeClear = await page.evaluate(() => Object.keys(localStorage))
  const clearedCount = await page.evaluate(() => {
    const n = localStorage.length
    localStorage.clear(); sessionStorage.clear()
    return n
  })
  // VERIFY THE CLEAR WHERE IT HAPPENED, not after the app has booted and written its
  // own defaults. Measured 2026-08-27: entering the app legitimately writes
  // `sandbox.mode` and `sandbox.help.open` immediately. Asserting "zero keys after
  // entry" therefore fails on a perfectly fresh guest — it confuses the app's fresh
  // writes with a previous session's residue.
  const keysAfterClear = await page.evaluate(() => Object.keys(localStorage))
  await page.goto(`${ORIGIN}/#/`, { waitUntil: 'networkidle' })
  const keysAfterEntry = await page.evaluate(() => Object.keys(localStorage))
  return { keysBeforeClear, clearedCount, keysAfterClear, keysAfterEntry }
}

/**
 * The keys that only exist once a MODEL exists. Their presence at entry means the
 * app hydrated a previous session — the stale-guest-autosave hydration the System B
 * drive caught and voided a run over.
 */
export const MODEL_BEARING_KEYS = ['olumi-canvas-autosave', 'olumi-canvas-current-scenario-id']

export function assertNoHydratedModel(keys: string[], context: string): void {
  const carried = keys.filter((k) => MODEL_BEARING_KEYS.includes(k))
  expect(
    carried,
    `[core] a model-bearing storage key survived into ${context}: ${carried.join(', ')}. The app has ` +
    `hydrated a PREVIOUS session's model, so nothing below is about a fresh visitor.`,
  ).toHaveLength(0)
}

export async function enterAsGuest(page: Page): Promise<void> {
  const guest = page
    .getByRole('button', { name: /continue without an account/i })
    .or(page.getByRole('link', { name: /continue without an account/i }))
  await expect(
    guest.first(),
    '[core] the guest entry affordance is not on the landing screen — the entry posture has moved',
  ).toBeVisible({ timeout: 30_000 })
  await guest.first().click()
  await expect(page.getByTestId('first-use-input-bar-textarea')).toBeVisible({ timeout: 60_000 })
}

export const CORE_BRIEF =
  'We are a UK B2B SaaS deciding whether to move upmarket to enterprise or double down on SMB. ' +
  'Revenue is flat and churn is rising.'

export async function submitBrief(page: Page, brief = CORE_BRIEF): Promise<void> {
  await page.getByTestId('first-use-input-bar-textarea').fill(brief)
  await expectOperableControl(page, 'first-use-input-bar-send')
  await page.getByTestId('first-use-input-bar-send').click()
}

/** Wait for the Living Model to materialise; returns the rendered node ids. */
export async function waitForModel(page: Page, timeoutMs = 300_000): Promise<string[]> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const ids = await renderedNodeIds(page)
    if (ids.length > 0) return ids
    await page.waitForTimeout(5_000)
  }
  return []
}

/**
 * Rendered node ids, read from the react-flow node testids (`rf__node-<id>`).
 * Identity, not a value predicate: these are the ids the graph actually mounted.
 */
export const renderedNodeIds = (page: Page): Promise<string[]> =>
  page.evaluate(() =>
    [...document.querySelectorAll('[data-testid^="rf__node-"]')]
      .map((el) => (el.getAttribute('data-testid') ?? '').replace(/^rf__node-/, ''))
      .filter((id) => id && !id.startsWith('__')),
  )

/** Layout health: distinct columns and nodes-per-column, never origin-stacking. */
export async function layoutHealth(page: Page): Promise<{
  nodeCount: number; distinctX: number; nodesPerColumn: number; maxColumnOccupancy: number
}> {
  return page.evaluate(() => {
    const nodes = [...document.querySelectorAll('.react-flow__node')]
    const xs = nodes.map((n) => Math.round(n.getBoundingClientRect().x))
    const byCol = new Map<number, number>()
    xs.forEach((x) => byCol.set(x, (byCol.get(x) ?? 0) + 1))
    const distinctX = byCol.size
    return {
      nodeCount: nodes.length,
      distinctX,
      nodesPerColumn: distinctX ? nodes.length / distinctX : 0,
      maxColumnOccupancy: byCol.size ? Math.max(...byCol.values()) : 0,
    }
  })
}

/**
 * Wait for the layout to SETTLE, then report it.
 *
 * ⚠ WHY THIS EXISTS. `waitForModel` returns as soon as nodes exist, and ELK lays the
 * graph out asynchronously afterwards. Measured 2026-08-27: a sample taken at first
 * paint read `distinctX=2, maxCol=15` — 15 of 16 nodes sharing one x, i.e. a
 * collapsed column — while the SAME graph settled to `distinctX=10, maxCol=3` and
 * held there for 50+ seconds. Asserting layout health at first paint therefore
 * measures a transient and reports it as the product.
 *
 * Stability is defined as an unchanged layout signature across `stableSamples`
 * consecutive reads, which is a property of the DOM rather than a fixed sleep.
 */
export async function waitForStableLayout(
  page: Page,
  { stableSamples = 3, intervalMs = 2_000, timeoutMs = 180_000, throwOnTimeout = false } = {},
): Promise<{ nodeCount: number; distinctX: number; nodesPerColumn: number; maxColumnOccupancy: number }> {
  const deadline = Date.now() + timeoutMs
  let last = ''
  let stable = 0
  let latest = await layoutHealth(page)
  while (Date.now() < deadline) {
    latest = await layoutHealth(page)
    const sig = `${latest.nodeCount}|${latest.distinctX}|${latest.maxColumnOccupancy}`
    if (sig === last && latest.nodeCount > 0) {
      if (++stable >= stableSamples) return latest
    } else {
      stable = 0
      last = sig
    }
    await page.waitForTimeout(intervalMs)
  }
  // ⚠ THE DEFAULT IS `return latest`, DELIBERATELY, AND IT IS NOT THE SAFE OPTION.
  // A caller that reads the returned health and asserts on it (E1) gets a real
  // measurement plus its own assertion, so a never-settling layout still goes red
  // there. A caller that DISCARDS the result silently accepts a layout that never
  // settled — which is why `draftAsGuest` passes `throwOnTimeout`.
  if (throwOnTimeout) {
    throw new Error(
      `[core] the layout never settled within ${Math.round(timeoutMs / 1000)}s ` +
      `(last: nodes=${latest.nodeCount} distinctX=${latest.distinctX} ` +
      `maxCol=${latest.maxColumnOccupancy}). The draft turn had already delivered its terminal ` +
      `frame, so this is not "still arriving" — the graph is genuinely not converging, and any ` +
      `assertion made now describes a moving target.`,
    )
  }
  return latest
}

/**
 * The layout-health discriminator.
 *
 * Deliberately NOT origin-stacking (which passed a uniform column six times) and
 * deliberately NOT gap uniformity (a constant pitch across many columns is HEALTHY,
 * not a defect — penalising it would red the good case). What it measures is
 * distinctX RELATIVE TO node count, plus nodes-per-column occupancy.
 *
 * Calibrated on the settled deployed graph (16 nodes -> distinctX 10, maxCol 3) and
 * against the transient collapsed state (distinctX 2, maxCol 15), which it rejects.
 */
export function assertLayoutReadable(
  l: { nodeCount: number; distinctX: number; maxColumnOccupancy: number }, tag: string,
): void {
  expect(
    l.distinctX,
    `[${tag}] ${l.nodeCount} nodes occupy only ${l.distinctX} distinct x positions — the graph has ` +
    `collapsed into a column and there is no readable structure for a team to look at.`,
  ).toBeGreaterThanOrEqual(3)
  expect(
    l.maxColumnOccupancy,
    `[${tag}] one column holds ${l.maxColumnOccupancy} of ${l.nodeCount} nodes. Even with ` +
    `${l.distinctX} distinct x values, the graph is stacked.`,
  ).toBeLessThanOrEqual(Math.ceil(l.nodeCount / 2))
}

/**
 * Guest → composer → brief → FINISHED model. The shared preamble for E2/E3/E4/E7.
 *
 * The order is load-bearing:
 *   1. install the interceptor BEFORE the first navigation, or it observes nothing;
 *   2. wait for the model to MOUNT (nodes exist — necessary, nowhere near sufficient);
 *   3. wait for the draft turn's TERMINAL FRAME — the producer's own end-of-work
 *      event, which is why this is not another inferred idle state;
 *   4. only then let the layout settle, and re-read the ids, because nodes arriving
 *      after step 2 are part of the model a spec is about to make claims about.
 */
export async function draftAsGuest(page: Page, brief = CORE_BRIEF): Promise<string[]> {
  await installWireInterceptor(page)
  const fresh = await freshGuest(page)
  expect(fresh.keysAfterClear, '[core] the fresh-guest clear did not land').toHaveLength(0)
  assertNoHydratedModel(fresh.keysAfterEntry, 'the fresh-guest entry')
  await enterAsGuest(page)
  await submitBrief(page, brief)
  const ids = await waitForModel(page)
  expect(ids.length, '[core] no model mounted — the preamble failed before the spec began').toBeGreaterThan(2)
  await waitForDraftTurnComplete(page)
  await waitForStableLayout(page, { throwOnTimeout: true })
  // Re-read AFTER the terminal frame: `waitForModel` returns at first paint, and the
  // ids it saw are a snapshot of a model that was still being written.
  return renderedNodeIds(page)
}

/** The node id that owns a given testid, via the DOM ancestor — identity, not position. */
export const owningNodeIds = (page: Page, testid: string): Promise<(string | null)[]> =>
  page.evaluate((id) =>
    [...document.querySelectorAll(`[data-testid="${id}"]`)].map((el) => {
      const n = el.closest('[data-testid^="rf__node-"]')
      return n ? (n.getAttribute('data-testid') ?? '').replace('rf__node-', '') : null
    }), testid)

export const textOf = (page: Page, testid: string): Promise<string[]> =>
  page.evaluate((id) =>
    [...document.querySelectorAll(`[data-testid="${id}"]`)].map((e) => (e.textContent ?? '').trim()), testid)

// ---------------------------------------------------------------------------
// AUTHENTICATED ENTRY.
// ---------------------------------------------------------------------------
// The session is written to Supabase's default storage key from a NON-APP
// same-origin document (`/version.json`), then the app is navigated to. Writing
// it from inside the running app would race the app's own boot.
//
// ⛔ Publishable key only. The token is held in memory, written to storage in the
// browser under test, and never logged — evidence carries a sha256 prefix.

export interface MintedSession { raw: unknown; user: WitnessUser; storageKey: string }

export async function mintAndInject(page: Page, label: string): Promise<MintedSession> {
  const sb = await resolveSupabase()
  const projectRef = new URL(sb.restBase).hostname.split('.')[0]
  const storageKey = `sb-${projectRef}-auth-token`

  const res = await fetch(`${sb.restBase}/auth/v1/signup`, {
    method: 'POST',
    headers: { apikey: sb.key, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: `olumi-witness+core-${label}-${Date.now().toString(36)}@example.test`,
      password: `${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2).toUpperCase()}A7!`,
    }),
  })
  const body = (await res.json().catch(() => null)) as Record<string, any> | null
  const accessToken = body?.access_token ?? body?.session?.access_token ?? null
  const userId = body?.user?.id ?? null
  expect(
    res.ok && accessToken && userId,
    `[core] signup failed: http ${res.status}, keys [${body ? Object.keys(body).join(', ') : 'unparseable'}]`,
  ).toBeTruthy()

  await page.goto(`${ORIGIN}/version.json`, { waitUntil: 'domcontentloaded' })
  await page.evaluate(([k, v]) => {
    localStorage.clear(); sessionStorage.clear(); localStorage.setItem(k as string, v as string)
  }, [storageKey, JSON.stringify(body)])

  return {
    raw: body, storageKey,
    user: {
      email: body!.user.email, userId, accessToken,
      tokenSha256: sha256Prefix(accessToken),
    },
  }
}

/**
 * The AUTHENTICATED entry flow is NOT the guest one. There is no "Continue without
 * an account" landing; an authenticated visitor lands on "Welcome to Olumi … Start
 * a new decision" and the composer appears only after that click.
 */
export async function enterAuthenticated(page: Page): Promise<void> {
  await page.goto(`${ORIGIN}/#/`, { waitUntil: 'networkidle' })
  await expect(
    page.locator('body'),
    '[core] the guest landing is showing — the injected session did not authenticate the app',
  ).not.toContainText(/Continue without an account/i, { timeout: 30_000 })

  const start = page.getByRole('button', { name: /start a new decision/i })
    .or(page.getByRole('link', { name: /start a new decision/i }))
  if (await start.count()) await start.first().click()
  await expect(page.getByTestId('first-use-input-bar-textarea')).toBeVisible({ timeout: 90_000 })
}

/**
 * Wait for the draft to genuinely SETTLE — not merely for nodes to exist.
 *
 * ⚠ THE SIGNATURE IS STRUCTURAL ON PURPOSE (`generating` + node count), and an
 * earlier version was not. It also included a count of "0 est." placeholders, which
 * keeps changing while values stream in — so a draft that had FINISHED could still
 * fail to stabilise and the wait timed out at 350s on a healthy model (measured
 * 2026-08-27: 2 passes, then this exact failure). A settle condition must be a
 * property that actually converges, or it is a slow way to manufacture a flake.
 *
 * `requireValues` re-adds the placeholder check for specs that genuinely need
 * populated values; persistence and structure specs do not.
 */
export async function waitForSettledDraft(
  page: Page, { timeoutMs = 420_000, stableSamples = 3, requireValues = false } = {},
): Promise<{ nodes: number; zeroEst: number; settledAfterMs: number }> {
  const t0 = Date.now()
  const deadline = t0 + timeoutMs
  let prev = ''; let stable = 0
  let last = { generating: true, nodes: 0, zeroEst: 0 }
  while (Date.now() < deadline) {
    await page.waitForTimeout(5_000)
    last = await page.evaluate(() => ({
      // ⭐⭐ THE PHRASE LIST IS LOAD-BEARING — DO NOT SHORTEN IT.
      // "Looking for your model…" is a WORKING state. An earlier probe matched only
      // /Generating|Drafting your/, read the UI as IDLE while it was still working,
      // settled early and tore the browser context down MID-STREAM. That manufactured
      // a whole class of fake "cut stream" samples (no terminal event, ~98 bytes, last
      // byte ~20-23s) which were reported as a product defect and had to be withdrawn.
      //
      // The root cause is worth naming because the PRODUCT has the same bug one level
      // up: A READER KEYED ON AN INFERRED IDLE STATE INSTEAD OF THE TERMINAL EVENT.
      // If you add a new working-state phrase to the UI, add it here in the same commit.
      generating: /Generating|Drafting your|Looking for your model/.test(
        document.body.innerText,
      ),
      nodes: document.querySelectorAll('.react-flow__node').length,
      zeroEst: (document.body.innerText.match(/0 est\./g) ?? []).length,
    }))
    const sig = requireValues
      ? `${last.generating}|${last.nodes}|${last.zeroEst}`
      : `${last.generating}|${last.nodes}`
    if (sig === prev && !last.generating && last.nodes > 0) {
      if (++stable >= stableSamples) {
        return { nodes: last.nodes, zeroEst: last.zeroEst, settledAfterMs: Date.now() - t0 }
      }
    } else { stable = 0; prev = sig }
  }
  // ⚠ DIAGNOSTIC ONLY — the settle CONDITION above is deliberately untouched.
  // "The draft never settled" is what this function can see; it is not always what
  // happened, and reporting the wrong cause is how a red becomes a red people learn
  // to ignore. MEASURED 2026-08-28 on builds 18727b64 and 966bb267: when E5 runs as
  // the third draft of a suite run, this timeout fired while the PRODUCT ITSELF was
  // displaying "Olumi did not return a model for this decision." — an explicit
  // product-side failure, not a slow draft. The timeout was telling the truth about
  // its own instrument and a falsehood about the run.
  const visibleFailure = await page.evaluate(() => {
    const t = document.body.innerText
    const m = t.match(/[^.\n]*did not return a model[^.\n]*\.?|[^.\n]*something went wrong[^.\n]*\.?/i)
    return m ? m[0].trim().slice(0, 200) : ''
  }).catch(() => '')

  throw new Error(
    `[core] the draft never settled within ${Math.round(timeoutMs / 1000)}s ` +
    `(last: generating=${last.generating} nodes=${last.nodes} zeroEst=${last.zeroEst}).` +
    (visibleFailure
      ? `\n  ⚠ THE PRODUCT IS DISPLAYING A FAILURE, so this is NOT a slow draft:\n` +
        `    "${visibleFailure}"\n` +
        `    Treat this as a product/service finding, not as a harness timeout to be waited out.`
      : `\n  The product displayed no failure message, so this really is a draft that did not ` +
        `arrive or did not converge.`),
  )
}
