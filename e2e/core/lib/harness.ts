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
import { readFileSync } from 'node:fs'
import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'
import {
  crawlBundle, makeHttpChunkFetcher, assertCrawlIntegrity, assertControlsFired,
  BUNDLE_CONTROLS,
} from './bundleCrawl'
// ⭐ THE PRODUCT'S OWN CHUNK-FAILURE PREDICATE — pure, zero-import, single-writer.
// Imported rather than restated: a second copy is this estate's dominant defect.
import { isChunkLoadError } from '../../../src/lib/staleBuildRecovery'

export const ORIGIN = process.env.CORE_UI_URL ?? 'https://staging--olumi.netlify.app'

export const FOOTER_COPY_SOURCE = 'src/canvas/components/pre-analysis-v3/constants.ts'

/**
 * Read one `FOOTER_COPY` string FROM THE PRODUCT'S OWN SOURCE. Never retyped here.
 *
 * ⚠ WHY NOT JUST `import { FOOTER_COPY }`. Measured 2026-08-28: importing that module
 * into a Playwright spec dies in its transform — `constants.ts` pulls
 * `composeBlockedReason` -> `ceeTextGuard`, and that chain throws
 * `ReferenceError: exports is not defined in ES module scope`. A real import would be
 * better and is the right fix if that chain is ever untangled; this is the honest
 * second-best, and it keeps ONE source of truth rather than a second copy.
 *
 * ⭐ WHY DERIVE AT ALL. Hand-writing the expected sentence would reintroduce exactly
 * the hand-maintained phrase list this suite criticises in `waitForSettledDraft` — and
 * that constant now feeds three surfaces (the footer, `BaseNode`, and this spec), so a
 * copy here would be the one that silently goes stale.
 *
 * FAILS LOUD, never assume-good: a key it cannot find is a hard error, because a
 * silently-empty expectation would make every assertion built on it vacuous.
 */
export function footerCopy(key: string, source = FOOTER_COPY_SOURCE): string {
  const src = readFileSync(source, 'utf8')
  const m = new RegExp(`^\\s*${key}:\\s*'((?:[^'\\\\]|\\\\.)*)'`, 'm').exec(src)
  if (!m || m[1].length === 0) {
    throw new Error(
      `[core] FOOTER_COPY.${key} could not be derived from ${source}. Either the key was ` +
      `renamed or the literal is no longer a single-quoted string on one line. This is a HARD ` +
      `ERROR on purpose: an expectation derived from an empty string passes against anything.`,
    )
  }
  return m[1]
}

/** Regex-escape, so a derived sentence is matched literally. */
export const literalRe = (s: string): RegExp =>
  new RegExp(s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')

/**
 * ⭐⭐ THE READINESS COUPLING, AS A PURE FUNCTION — because getting it wrong is not
 * hypothetical: the first version of it shipped and was wrong.
 *
 * That version asserted `(analyseDisabled || reportsGap)` and then `reportsGap`
 * unconditionally. `(A || B) ∧ B` reduces to `B`, so `analyseDisabled` was measured but
 * never load-bearing — it only chose which failure message printed — and the state
 * "surface claims NOT READY while the button is ENABLED" passed. That is a lie, it is
 * the shape E2 exists to catch, and the ORIGINAL spec caught it.
 *
 * It lives here, pure and separately tested, for one reason: the branch that matters
 * most is the PROCEEDING one, and the deployed product usually serves the BLOCKING arm,
 * so a live run does not exercise it. A truth table run once by hand is not a guard —
 * this is, and `tests/ci-guards/core-completeness-guard.spec.ts` runs it on every PR.
 *
 * Two shapes are honest and the arms are MUTUALLY EXCLUSIVE, selected by the button:
 *   PROCEEDING (enabled)  — the run is on offer, so the surface must QUALIFY it.
 *   BLOCKING   (disabled) — the user is stopped, so the surface must say WHY.
 */
export interface ReadinessInput {
  analyseDisabled: boolean
  surface: string
  /** DERIVED from the product's own constant — see `footerCopy`. */
  qualifying: RegExp
  /** CEE-authored copy varies per run, so this arm has no constant to derive from. */
  blockingVocab: RegExp
}

export interface ReadinessVerdict { arm: 'BLOCKING' | 'PROCEEDING'; honest: boolean }

export function readinessVerdict(i: ReadinessInput): ReadinessVerdict {
  return i.analyseDisabled
    ? { arm: 'BLOCKING', honest: i.blockingVocab.test(i.surface) }
    : { arm: 'PROCEEDING', honest: i.qualifying.test(i.surface) }
}

/** The blocking arm's vocabulary. A mirror, confined to the arm with no constant. */
export const BLOCKING_VOCAB = /not ready|needs|incomplete|before|provisional|until success/i

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

  const html = await (await fetch(`${ORIGIN}/`, { cache: 'no-store' })).text()

  const crawl = await crawlBundle(html, makeHttpChunkFetcher(ORIGIN), {
    maxChunks, deadlineAt: Date.now() + timeoutMs,
  })

  // ORDER IS THE FIX: was the crawl sound, before asking what it found.
  assertCrawlIntegrity(crawl)
  const reports = assertControlsFired(crawl)

  let host: string | null = null
  let key: string | null = null
  for (const body of crawl.bodies.values()) {
    if (!host) { const h = body.match(/https:\/\/[a-z0-9]+\.supabase\.co/); if (h) host = h[0] }
    if (!key) {
      const k = body.match(/sb_publishable_[A-Za-z0-9_-]{10,}/)
        || body.match(/eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}/)
      if (k) key = k[0]
    }
    if (host && key) break
  }

  if (!host || !key) {
    throw new Error(
      `[core] crawl read ${crawl.bodies.size} of ${crawl.discovered.length} discovered chunks with ` +
      `every control FIRING (${reports.map((r) => `${r.term}×${r.chunks.length}`).join(', ')}), but ` +
      `${!host ? 'no supabase host' : 'no publishable key'} was found. The crawl is sound, so this is ` +
      `a real absence: the config SHAPE has moved.`,
    )
  }

  const control = reports.find((r) => r.term === BUNDLE_CONTROLS[0].term)
  return {
    restBase: host, key, keySha256: sha256Prefix(key),
    chunksFetched: crawl.bodies.size, controlChunks: control?.chunks ?? [],
    source: `deployed UI bundle at ${ORIGIN} (${crawl.bodies.size} chunks read of ` +
      `${crawl.discovered.length} discovered; controls ` +
      `${reports.map((r) => `${r.term}×${r.chunks.length}`).join(', ')})`,
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

/**
 * ⭐⭐ ASSET DELIVERY IS A SEPARATE FAILURE FROM PRODUCT FAILURE, AND UNTIL NOW THE
 * SUITE COULD NOT TELL THEM APART.
 *
 * MEASURED 2026-09-02 over the 100 most recent `Staging Tests` runs, every attempt
 * (94 completed Core E2E jobs, 10 failures — the jobs API serves only the LATEST
 * attempt, so a re-run hides its own red and the first sweep undercounted by two).
 * FIVE of those ten were not product failures at all: the deployed target never
 * delivered the Canvas route's chunks, so the app sat on its Suspense fallback and
 * the composer could not mount. Their page snapshots, from the uploaded artefacts:
 *
 *   run 33556631726 (E1) · run 33578060840 (E1) — `status "Loading Canvas"` only
 *   run 33581772301 (E5) · run 33546491489 (E5) — `status "Loading Scenario"` only
 *   run 33571760150 (E5) — the app's own error boundary:
 *       "Unable to preload CSS for /assets/ReactFlowGraph-CD2a-IkG.css"
 *
 * The trace for the first confirms it at the bytes: 59 requests, every one HTTP 200
 * except `/assets/ReactFlowGraph-CdifbDa0.js`, which NEVER COMPLETED — and there was
 * NO console error, so the dynamic import never rejected. It hung. The DOM agrees
 * independently: a REJECTED lazy import rethrows to the error boundary and the
 * fallback is replaced, so a fallback still on screen after 60s proves the import is
 * still PENDING.
 *
 * ⚠ WHY THIS WATCH EXISTS RATHER THAN A LONGER TIMEOUT. On a healthy run the composer
 * appears in a MEDIAN OF 587 ms (178 local entries against the same immutable
 * permalink, 178/178 pass, p90 1,127 ms, max 6,584 ms) — a ~100x margin against the
 * 60s budget it "exceeded". The failing wait resolved the locator ZERO times for its
 * whole budget. A wait that resolves nothing for 60 seconds does not need 90.
 *
 * ⚠ AND WHY IT DOES NOT SOFTEN THE VERDICT. This records; it never skips, retries or
 * downgrades. An undelivered bundle still FAILS — it simply says so by name, instead
 * of reporting `element(s) not found` against a locator and sending the next reader
 * after a timeout margin that was never the problem. That misreading cost a lane a
 * full round on 2026-09-01.
 *
 * `window.fetch` cannot see this: script and stylesheet loads never go through it.
 * These are Playwright-level listeners, so they also cannot perturb the app.
 */
export interface AssetDelivery {
  /**
   * Script/stylesheet requests outstanding for at least `minAgeMs`.
   *
   * ⚠ THE AGE IS NOT OPTIONAL AND THE FIRST VERSION OF THIS FILE THREW IT AWAY. It
   * recorded `Date.now()` on every request and then returned bare URLs, so ANY
   * request in flight at the moment of failure counted as "never completed".
   * Measured in the same corpus: the PRODUCT failure `33555675895` — which
   * successfully laid out 19 nodes — held two `/assets/*.js` still open at trace
   * close, **447 ms and 80 ms old**. An age-blind reading shouts asset delivery at
   * a run whose assets were simply still arriving.
   */
  undelivered: (minAgeMs?: number) => StalledAsset[]
  /** Requests the browser reported as outright failed, with Chromium's reason. */
  failed: () => Array<{ url: string; reason: string }>
}

export interface StalledAsset { url: string; ageMs: number }

/**
 * An asset outstanding at least this long is STALLED rather than in flight.
 *
 * ⚠ CHOSEN WITHIN A MEASURED INTERVAL — NOT DERIVED, and an earlier revision of this
 * comment overclaimed by calling it derived. What the corpus fixes is the INTERVAL:
 * observed in-flight noise 80 ms and 447 ms, observed real stall ~55 s, so any value
 * in `(447, 55_000)` separates them. **N=3 observations across two runs.** The exact
 * value inside that window is a judgement, and the guard confirms it: 500, 30_000 and
 * 50_000 all leave the suite at 18/18. So what is pinned is the interval, not 10_000.
 *
 * The failure direction is the safe one — too HIGH merely under-reports asset delivery
 * and falls back to `indeterminate`, it does not manufacture a false accusation.
 */
export const ASSET_STALL_MS = 10_000

/** Pure, so the age rule can be pinned without a browser. */
export function selectStalled(
  open: Array<{ url: string; startedAt: number }>, now: number, minAgeMs: number,
): StalledAsset[] {
  return open
    .map((o) => ({ url: o.url, ageMs: now - o.startedAt }))
    .filter((o) => o.ageMs >= minAgeMs)
    .sort((a, b) => b.ageMs - a.ageMs)
}

const ASSET_WATCH = new WeakMap<Page, AssetDelivery>()

export function installAssetWatch(page: Page): AssetDelivery {
  const existing = ASSET_WATCH.get(page)
  if (existing) return existing // idempotent: two watches would double-count

  // Keyed by the REQUEST, not the URL: two fetches of one URL would otherwise
  // overwrite each other's start time and the age would be a fiction.
  const open = new Map<unknown, { url: string; startedAt: number }>()
  const failed: Array<{ url: string; reason: string }> = []
  const isAsset = (r: { resourceType: () => string }): boolean =>
    r.resourceType() === 'script' || r.resourceType() === 'stylesheet'

  page.on('request', (r) => { if (isAsset(r)) open.set(r, { url: r.url(), startedAt: Date.now() }) })
  page.on('requestfinished', (r) => { open.delete(r) })
  page.on('requestfailed', (r) => {
    open.delete(r)
    if (isAsset(r)) failed.push({ url: r.url(), reason: r.failure()?.errorText ?? 'unknown' })
  })

  const watch: AssetDelivery = {
    undelivered: (minAgeMs = ASSET_STALL_MS) => selectStalled([...open.values()], Date.now(), minAgeMs),
    failed: () => [...failed],
  }
  ASSET_WATCH.set(page, watch)
  return watch
}

/**
 * ⭐⭐ THE VERDICT IS A PURE FUNCTION SO IT CAN BE PINNED WITHOUT A BROWSER.
 *
 * ⚠ THE FIRST VERSION OF THIS DIAGNOSIS WAS WRONG IN EXACTLY THE DIRECTION IT WAS
 * WRITTEN TO PREVENT, and shipping it would have been worse than the locator message
 * it replaced — because a SPECIFIC wrong explanation is believed, where a vague one is
 * merely unhelpful. It said `if (stuckLoading || undelivered.length || failedAssets.length)`,
 * so ANY ONE of three weak signals asserted asset delivery. Executed against it: a
 * rendered page with an absent composer and one unrelated aborted script printed
 * "THIS LOOKS LIKE ASSET DELIVERY" and "The app is still showing 'null', which is a
 * Suspense fallback" — three false sentences about a genuine product failure.
 *
 * THE RULE NOW: assert a cause ONLY on POSITIVE, NAMED evidence, and never from the
 * absence of a signal. Asset delivery requires BOTH that the app is demonstrably still
 * on a Suspense fallback AND that at least one asset can be NAMED as stalled or failed.
 * A fallback with nothing nameable is reported as CAUSE UNIDENTIFIED — not as asset
 * delivery, and not as a product defect either.
 *
 * ⚠ STATED BLIND SPOT: the watch observes script and stylesheet requests only, so a
 * stalled fetch/XHR cannot be seen by it BY CONSTRUCTION. That is precisely why a bare
 * fallback may not be blamed on `/assets/`.
 */
export type ComposerAbsenceVerdict =
  | 'asset-delivery' | 'stalled-cause-unidentified' | 'product' | 'indeterminate'

/**
 * ⭐⭐ THE APP'S OWN ERROR BOUNDARY IS NAMED EVIDENCE, AND MISSING IT ROUTED A REAL
 * ASSET FAILURE STRAIGHT INTO `product`.
 *
 * The first three-verdict version reached `product` from the ABSENCE of a `Loading…`
 * fallback — which is the very rule it was written to enforce ("never from the absence
 * of a signal"), violated in its own third branch. Corpus run `33571760150`, one of the
 * five this suite labels asset delivery, failed at `harness.ts:804` with NO
 * `role="status"` anywhere, because a REJECTED lazy import REPLACES the fallback.
 *
 * ⚠⚠ AND THE FIRST FIX FOR THAT SHIPPED A HAND-WRITTEN SECOND COPY OF A PREDICATE THE
 * PRODUCT ALREADY OWNS — this estate's dominant defect class, committed inside the fix
 * for the previous one. `isChunkLoadError` in `src/lib/staleBuildRecovery.ts` is the
 * SINGLE WRITER for "this page is running a build that no longer exists", is pure and
 * zero-import, and is already pinned by `ErrorBoundary.recovery.spec.tsx`. My parallel
 * list had already DRIFTED from it, missing three of its five shapes — including a
 * regex defect (`:? \S*` made the trailing space MANDATORY, so the bare
 * `error loading dynamically imported module` never matched).
 *
 * ⚠⚠ BUT THE REACHABILITY ARGUMENT FIRST GIVEN FOR THAT — INCLUDING IN MY OWN COMMIT
 * MESSAGE — IS WITHDRAWN, AND THE CORRECTION IS THE POINT OF THIS PARAGRAPH. It was
 * claimed those misses were reachable in BOUNDARY TEXT, and specifically that
 * `Failed to load module script … MIME type "text/html"` was "Chrome's wording for the
 * Netlify SPA fallback, on a chromium-only suite". MEASURED AFTERWARDS, BY SERVING A
 * CHUNK AS `text/html` AND DRIVING CHROME DOWN BOTH PATHS: that MIME wording is a
 * CONSOLE ERROR ONLY. It is never a thrown Error, so it cannot reach a React boundary
 * and cannot reach this DOM-text channel at all. Chrome's dynamic-import path throws
 * `Failed to fetch dynamically imported module: <url>` instead. And of the other two,
 * `Importing a module script failed.` is SAFARI and `error loading dynamically imported
 * module` is FIREFOX — neither reachable on a chromium-only suite either.
 * NONE OF THE THREE NAMED MISSES WAS REACHABLE HERE.
 *
 * ⭐⭐ THE SUBSTANCE SURVIVES AND THE JUSTIFICATION GETS BETTER. A hand-written copy that
 * had ALREADY drifted is a real defect whatever its shapes' reachability. And the
 * durable reason to delegate is not "my list was short" — it is that NOBODY HAS TO
 * REASON ABOUT WORDING REACHABILITY EVER AGAIN. Which browser throws which sentence,
 * which sentences reach a boundary versus only a console, and what a future bundler or
 * browser version changes, all stop being this file's problem the moment the product
 * owns the predicate. Two careful readers got that reasoning wrong in consecutive
 * rounds; delegation removes the need to get it right.
 *
 * SO THE DECISION IS DERIVED, NOT MIRRORED. `isModuleLoadFailureText` delegates to the
 * product's own predicate and unions in ONE observed shape the product does not yet
 * recognise. The next shape the product learns, this recognises for free — and
 * `defect 5` in the guard proves that INHERITANCE behaviourally, so a "harmless"
 * equivalent copy cannot quietly replace the delegation.
 *
 * ⚠ DECLARED BLIND SPOT OF THIS CHANNEL (raised in review; declined deliberately, not
 * missed). `isChunkLoadError` tests `name + message`, so an error distinguished ONLY by
 * its `name` — webpack's `ChunkLoadError` — is invisible here: `ErrorBoundary.tsx`
 * renders `this.state.error?.message` and NEVER renders `.name` (derived at the bytes;
 * `.name` appears nowhere in that file). No predicate work can fix that, because the
 * channel is DOM text. Not fixed because the shape looks unreachable in a VITE build —
 * Vite throws message-bearing errors and the product's own comment keeps the
 * webpack-era form only "for safety". ⚠ THAT IS A REACHABILITY CLAIM OF EXACTLY THE
 * KIND WITHDRAWN TWO PARAGRAPHS UP, so it is recorded as a declared limitation rather
 * than dismissed: if it ever does occur, the failure direction is a FALSE `product`
 * accusation, which is the harmful direction, not the safe one.
 *
 * ⚠ THE CSS-PRELOAD UNION IS A PRODUCT GAP, NOT A HARNESS QUIRK. `Unable to preload CSS
 * for …` is the one shape WITNESSED IN THE WILD here (run 33571760150) and it is
 * exactly what `isChunkLoadError` does not match — which is why that run got generic
 * crash copy instead of the stale-build Reload affordance. Rowed separately as a
 * user-facing gap; do not "fix" it by narrowing this union.
 *
 * ⚠ THIS BRANCH IS FIRST AND PRODUCES A VERDICT. It does not fail closed to
 * `indeterminate` — by design, because the app naming its own module failure is the
 * strongest evidence available and it arrives with the fallback already gone.
 */

/**
 * The ONE shape witnessed here that the product's predicate does not yet accept.
 * Kept narrow on purpose: widening it would let a generic crash win the match.
 */
export const OBSERVED_CSS_PRELOAD_FAILURE = /Unable to preload CSS for \S+/i

/**
 * DERIVED. The product decides; this only adds the witnessed gap.
 * `isChunkLoadError` tests `name + message`, so passing text as a message is faithful.
 */
export function isModuleLoadFailureText(text: string): boolean {
  if (!text) return false
  return isChunkLoadError(new Error(text)) || OBSERVED_CSS_PRELOAD_FAILURE.test(text)
}

/**
 * Quote extraction ONLY — the verdict never depends on this list.
 *
 * ⚠ WHY A LIST IS STILL SAFE HERE. A short list can no longer cause a false negative:
 * the decision is `isModuleLoadFailureText`, and when it fires without a tidy quote the
 * fallback below returns a bounded excerpt, so the answer is never null. The worst a
 * stale entry can do is make the message less precise. Completeness against the
 * product's own corpus is asserted in the guard regardless.
 */
const MODULE_FAILURE_QUOTES: readonly RegExp[] = [
  OBSERVED_CSS_PRELOAD_FAILURE,
  /Failed to fetch dynamically imported module:?\s*\S*/i,
  /error loading dynamically imported module:?\s*\S*/i,
  /Importing a module script failed\.?/i,
  /Failed to load module script[^]{0,160}/i,
  /Loading (?:CSS )?chunk [\w-]+ failed/i,
  /ChunkLoadError/i,
]

/** The matched phrase when the derived predicate fires, else null. */
export function findModuleLoadFailure(bodyText: string): string | null {
  if (!isModuleLoadFailureText(bodyText)) return null
  for (const re of MODULE_FAILURE_QUOTES) {
    const m = re.exec(bodyText)
    if (m) return m[0].trim()
  }
  // The product accepted a shape this list cannot quote. Never drop the positive.
  return bodyText.slice(0, 200).trim()
}

export interface ComposerAbsenceInput {
  where: string
  timeoutMs: number
  /** Text of EVERY `[role="status"]` on the page, already whitespace-collapsed. */
  statusTexts: string[]
  /** 0 means the page rendered NOTHING — never "product". */
  renderedChars: number
  /**
   * ⚠ FALSE ONLY WHEN `page.evaluate` THREW. Without this the classifier reported
   * "the page rendered NOTHING (0 chars)" about a page it could not read — a claim
   * about an unobserved thing, the same family as the defect above it.
   */
  pageStateRead?: boolean
  bodyHead: string
  /** Full collapsed body text, scanned for the app's own module-failure boundary. */
  bodyText?: string
  url: string
  /** ALREADY age-filtered by the caller — see ASSET_STALL_MS. */
  stalledAssets: StalledAsset[]
  failedAssets: Array<{ url: string; reason: string }>
}

const LOADING_FALLBACK = /^Loading\b.*\.\.\.$/

export function classifyComposerAbsence(
  i: ComposerAbsenceInput,
): { verdict: ComposerAbsenceVerdict; message: string } {
  const fallback = i.statusTexts.find((t) => LOADING_FALLBACK.test(t))
  const nameable = i.stalledAssets.length + i.failedAssets.length
  const moduleError = findModuleLoadFailure(i.bodyText ?? i.bodyHead)
  // ⚠ POSITIVE evidence that the app booted past its own loading state. `product` is
  // reached only from THIS, never from the absence of a fallback (see the note on
  // OBSERVED_CSS_PRELOAD_FAILURE — that absence is exactly what a rejected import looks
  // like, and reading it as "rendered fine" is how run 33571760150 was mislabelled).
  const pageRead = i.pageStateRead !== false
  const appRendered = pageRead && i.renderedChars > 0

  const named = [
    ...i.stalledAssets.map((a) => `${a.url} (open ${Math.round(a.ageMs / 1000)}s)`),
    ...i.failedAssets.map((f) => `${f.url} [${f.reason}]`),
  ]

  const head =
    `[core] the first-use composer never mounted during ${i.where} ` +
    `(${i.timeoutMs}ms, zero resolutions).`

  let verdict: ComposerAbsenceVerdict
  const lines = [head]

  if (moduleError) {
    // The APP ITSELF named the failure. Strongest evidence available, and it arrives
    // with the fallback already gone — so it must be tested BEFORE any fallback logic.
    verdict = 'asset-delivery'
    lines.push(
      `⚠ ASSET DELIVERY — the app's OWN error boundary named a module/asset failure:`,
      `    "${moduleError}"`,
      `  A REJECTED lazy import REPLACES the Suspense fallback, which is why no`,
      `  "Loading…" status is on screen. Absence of a fallback here is NOT evidence the`,
      `  app rendered fine — it is evidence the import rejected.`,
      ...(nameable > 0
        ? [`  The watch also saw ${nameable} asset(s) stalled or failed:`,
           ...named.slice(0, 8).map((n) => `    ${n}`)]
        : [`  (The watch itself named nothing — a preload rejection can complete as a`,
           `   failed request the app reports before the watch's stall threshold.)`]),
      `  ⚠ WHY the fetch failed is NOT diagnosed by this instrument.`,
    )
  } else if (!fallback && !appRendered && nameable > 0) {
    // Nothing rendered at all, and assets can be named. Distinct from the counter-
    // example that motivated the NAMED-evidence rule: there the app had demonstrably
    // booted, so an unrelated abort could not be the cause. Here it never booted.
    verdict = 'asset-delivery'
    lines.push(
      pageRead
        ? `⚠ ASSET DELIVERY — the page rendered NOTHING (0 chars) and ${nameable} asset(s)`
        : `⚠ ASSET DELIVERY — the page state was UNREADABLE and ${nameable} asset(s)`,
      `  never arrived:`,
      ...named.slice(0, 8).map((n) => `    ${n}`),
      `  ⚠ WHY those fetches did not complete is NOT diagnosed by this instrument.`,
    )
  } else if (fallback && nameable > 0) {
    verdict = 'asset-delivery'
    lines.push(
      `⚠ ASSET DELIVERY — NOT A PRODUCT DEFECT, AND NOT A TIMEOUT MARGIN.`,
      `  The app is still showing "${fallback}", a Suspense fallback, so the route's lazy`,
      `  chunk has neither resolved nor rejected — and ${nameable} asset(s) never arrived:`,
      ...named.slice(0, 8).map((n) => `    ${n}`),
      `  Raising this budget cannot help: a healthy entry mounts the composer in ~590ms,`,
      `  and this wait resolved its locator ZERO times.`,
      `  ⚠ WHY those fetches did not complete is NOT diagnosed by this instrument.`,
    )
  } else if (fallback) {
    verdict = 'stalled-cause-unidentified'
    lines.push(
      `⚠ STALLED, CAUSE UNIDENTIFIED — do not read this as asset delivery.`,
      `  The app is still showing "${fallback}", a Suspense fallback, so the route's lazy`,
      `  chunk has neither resolved nor rejected. But NO script or stylesheet was stalled`,
      `  (>=${ASSET_STALL_MS}ms) or failed, so nothing can be named as the cause.`,
      `  ⚠ This watch observes script/stylesheet only — a stalled fetch/XHR is invisible`,
      `  to it by construction, so absence of evidence here is not evidence of absence.`,
    )
  } else if (appRendered) {
    verdict = 'product'
    lines.push(
      `PRODUCT FAILURE — the page rendered ${i.renderedChars} chars of content, no loading`,
      `  fallback is on screen, the app reported no module/asset failure, and the`,
      `  composer is genuinely absent.`,
      `  On screen: "${i.bodyHead}"`,
    )
    if (nameable > 0) {
      lines.push(
        `  FYI ${nameable} asset(s) were still open or failed. NOT the verdict — the app`,
        `  rendered its own content and named no module failure, so these did not prevent`,
        `  the composer mounting:`,
        ...named.slice(0, 8).map((n) => `    ${n}`),
      )
    }
  } else {
    // ⚠ THE HONEST FOURTH STATE. Nothing rendered, no fallback, nothing nameable —
    // there is no positive evidence for ANY cause, so none is asserted. The old
    // three-verdict version emitted the self-contradiction
    // "PRODUCT FAILURE — the page IS rendered (0 chars)" here.
    verdict = 'indeterminate'
    lines.push(
      `⚠ INDETERMINATE — no verdict is available, and none is being guessed.`,
      pageRead
        ? `  The page rendered nothing (0 chars), no loading fallback is on screen, the app`
        : `  The page state was UNREADABLE — so nothing below is a claim about what rendered.`,
      pageRead
        ? `  named no module failure, and no asset could be named as stalled or failed.`
        : `  No loading fallback was seen, no module failure named, no asset nameable.`,
      `  That is an absence of evidence in every channel — which is not evidence for any`,
      `  of them.`,
      `  On screen: "${i.bodyHead}"`,
    )
  }

  lines.push(`  url=${i.url}`)
  return { verdict, message: lines.join('\n') }
}

/**
 * The first-use composer wait, shared by BOTH entry paths.
 *
 * Both `enterAsGuest` (guest) and `enterAuthenticated` (authenticated) waited on this
 * same testid with their own inline `expect`, and 5 of the 10 measured failures landed
 * on one of the two. Sharing the wait means the diagnosis is written once and neither
 * path can drift away from it. This function only GATHERS; the verdict is
 * `classifyComposerAbsence`, which is pure and pinned.
 */
export async function awaitFirstUseComposer(
  page: Page, where: string, timeoutMs: number,
): Promise<void> {
  const watch = ASSET_WATCH.get(page)
  try {
    await expect(page.getByTestId('first-use-input-bar-textarea')).toBeVisible({ timeout: timeoutMs })
  } catch (cause) {
    const state = await page.evaluate(() => {
      const text = (document.body.innerText ?? '').replace(/\s+/g, ' ').trim()
      return {
        url: location.href,
        statusTexts: [...document.querySelectorAll('[role="status"]')]
          .map((el) => ((el as HTMLElement).innerText ?? '').replace(/\s+/g, ' ').trim())
          .filter((t) => t.length > 0),
        bodyHead: text.slice(0, 300),
        // The boundary's module-failure sentence sits ~65 chars in on the observed
        // case, but a longer app shell could push it past a 300-char head — so the
        // scan gets the whole text, not the excerpt shown to the reader.
        bodyText: text,
        rendered: text.length,
      }
    }).catch(() => null)

    const { message } = classifyComposerAbsence({
      where,
      timeoutMs,
      statusTexts: state?.statusTexts ?? [],
      // A failed `page.evaluate` yields 0 — which routes to `indeterminate`, never to
      // `product`. An unreadable page is not a rendered one.
      renderedChars: state?.rendered ?? 0,
      bodyHead: state?.bodyHead ?? '(page state unreadable)',
      bodyText: state?.bodyText,
      pageStateRead: state !== null,
      url: state?.url ?? ORIGIN,
      stalledAssets: watch?.undelivered(ASSET_STALL_MS) ?? [],
      failedAssets: watch?.failed() ?? [],
    })
    throw new Error(`${message}\n\n--- original ---\n${String(cause)}`)
  }
}

export async function installWireInterceptor(page: Page): Promise<void> {
  // Every Core spec calls this first, so it is the one place that reaches them all.
  installAssetWatch(page)
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
 *
 * ⚠⚠ SCOPE — THIS FIXES ONE SPEC, NOT THE SUITE. Only `draftAsGuest` calls this, and
 * only E2 uses `draftAsGuest`. E1 waits on `waitForStableLayout`, and E5 still waits
 * on `waitForSettledDraft` — the PHRASE-LIST detector, i.e. the same inferred-idle
 * class that produced the withdrawn 33–61% draft-failure rate. That detector is
 * currently correct BY COINCIDENCE: the draft overlay's own copy escalates out of its
 * case-sensitive match set at t>=20s ("Still drafting…", lowercase d), and what keeps
 * it true is a co-rendered "Generating…" stage pill owned by a DIFFERENT component
 * that nothing pins. Unmount or restyle that pill and the ancestor defect returns with
 * no red anywhere.
 *
 * So the accurate statement is "E2 now waits for the terminal event", NOT "the suite
 * waits correctly". Migrating E1 and E5 onto this wait is rowed, not done here.
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
  await awaitFirstUseComposer(page, 'the guest entry', 60_000)
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

  const composer = page.getByTestId('first-use-input-bar-textarea')
  const start = page.getByRole('button', { name: /start a new decision/i })
    .or(page.getByRole('link', { name: /start a new decision/i }))

  // ⚠ `if (await start.count())` WAS A SNAPSHOT WITH NO WAIT. `count()` resolves
  // immediately, so a landing that had not yet committed its render scored zero, the
  // click never happened, and the 90s composer wait below could then NEVER resolve —
  // it was waiting on a click that was silently skipped. The guard above it is no
  // barrier either: `not.toContainText` is satisfied by an EMPTY body, so it passes
  // hardest exactly when nothing has rendered.
  //
  // Waiting for the START AFFORDANCE alone would be wrong in the other direction —
  // an authenticated visitor who lands straight on the composer never shows one, and
  // that is a legitimate path. So wait for EITHER, which cannot break either path.
  await expect(start.first().or(composer).first()).toBeVisible({ timeout: 30_000 })
  if (await start.count()) await start.first().click()
  await awaitFirstUseComposer(page, 'the authenticated entry', 90_000)
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
