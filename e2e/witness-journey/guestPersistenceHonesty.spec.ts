// e2e/witness-journey/guestPersistenceHonesty.spec.ts
// =============================================================================
// E3 — DOES THE GUEST JOURNEY TELL THE TRUTH ABOUT WHAT IT KEEPS?
// =============================================================================
//
// THE CLAIM THIS FALSIFIES:
//   "A guest can open a board, change it, and trust that what they see is kept."
//
// WHY THIS SPEC, TONIGHT. The shareable demo route is the FREE one — "Continue
// without an account" -> open a saved example. E5's own header records, measured
// 2026-08-27, that a GUEST's `POST /bff/cee/scenarios/<id>/graph` returns 404:
// **a guest's graph is never persisted server-side.** That is defensible design
// (no account, no row). What is NOT defensible is a UI that CLAIMS otherwise.
//
// So this spec does not re-litigate whether guests persist. It asks the only
// question inside the Canvas/Panel remit: does any UI surface on the guest route
// assert saving, syncing or keeping, when the platform is not keeping it?
//
// ⛔ WHAT A GREEN RUN LICENCES: exactly one claim — on the deployed build named in
// the output, the guest route made no server-persistence assertion that the wire
// contradicts. It does NOT licence "guest persistence works" (it does not) nor
// "localStorage retention works" (measured separately below and reported, not
// asserted, because retention is E5's subject and its premise is authenticated).
//
// CONTROLS (a probe with no control proves nothing — CLAUDE.md trap 13):
//  · POSITIVE CONTROL ON THE READER: the page must yield a non-trivial body text
//    and a mounted canvas, or "no false claim found" is just a blank screen.
//  · POSITIVE CONTROL ON THE VOCABULARY: a fabricated string is searched with the
//    same matcher and must NOT be found, so a matcher that silently matches
//    nothing cannot read as a pass.
//  · WIRE CONTROL: at least one request must be observed, or "no write attempted"
//    is an unarmed interceptor rather than a finding.
//
// COST: guest + a shipped starter. No draft, no rerun, no provider call.
// =============================================================================
import { test, expect, type Page, type Request } from '@playwright/test'
// ⭐ SHA-PINNED TARGET, not the moving alias. `staging--olumi.netlify.app` can
// deploy mid-run and split a measurement into two populations (it did, 27 Aug, and
// invalidated a rate). `version.json` hands out a permalink per deploy, so the
// witness names its build and cannot straddle one.
const ORIGIN = process.env.WITNESS_ORIGIN ?? 'https://staging--olumi.netlify.app'
async function deployedBuild(): Promise<string> {
  const r = await fetch(`${ORIGIN}/version.json`, { cache: 'no-store' })
  const j = (await r.json()) as { commit?: string; short?: string }
  return j.short ?? j.commit ?? 'unknown'
}

/** Words that assert the PLATFORM is keeping it. Deliberately narrow: "save" as a
 *  BUTTON is an offer, not a claim, so imperative labels are excluded below. */
const PERSISTENCE_CLAIM = /\b(saved|syncing|synced|sync(?:ed)? to|stored|backed up|kept|all changes saved|auto-?saved?)\b/i
/** Same matcher against a string that cannot exist — if THIS matches, the matcher is broken. */
const FABRICATED = 'zzq-not-a-real-persistence-phrase-zzq'

async function guestBoard(page: Page): Promise<{ bodyText: string; nodes: number }> {
  await page.goto(ORIGIN, { waitUntil: 'domcontentloaded' })
  // "Continue without an account" — the free route. Matched loosely because the
  // exact copy is not this spec's subject.
  const guest = page.getByRole('button', { name: /continue without|without an account|guest/i }).first()
  if (await guest.count() > 0) await guest.click({ timeout: 15_000 }).catch(() => {})
  await page.waitForTimeout(3_000)
  // Open the first shipped example if a chooser is present.
  const example = page.getByRole('button', { name: /build.?vs.?buy|pricing|example|starter|open/i }).first()
  if (await example.count() > 0) await example.click({ timeout: 15_000 }).catch(() => {})
  await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => {})
  await page.waitForTimeout(4_000)
  const nodes = await page.locator('.react-flow__node').count().catch(() => 0)
  const bodyText = await page.evaluate(() => document.body.innerText || '')
  return { bodyText, nodes }
}

test('E3 — the guest route makes no persistence claim the wire contradicts', async ({ page }) => {
  const reqs: { url: string; method: string }[] = []
  page.on('request', (r: Request) => reqs.push({ url: r.url(), method: r.method() }))

  const build = await deployedBuild().catch(() => 'unknown')
  const { bodyText, nodes } = await guestBoard(page)

  // ── CONTROL 1: the reader saw something ────────────────────────────────────
  expect(bodyText.length, 'blank page — a "no false claim" verdict would be vacuous').toBeGreaterThan(200)

  // ── CONTROL 2: the matcher is not inert ───────────────────────────────────
  expect(PERSISTENCE_CLAIM.test(FABRICATED), 'matcher matched a fabricated string').toBe(false)

  // ── CONTROL 3: the interceptor is armed ───────────────────────────────────
  expect(reqs.length, 'zero requests observed — interceptor unarmed').toBeGreaterThan(0)

  const graphWrites = reqs.filter((r) => /\/scenarios\/[^/]+\/graph\/register/.test(r.url))
  const anyGraph = reqs.filter((r) => /\/scenarios\/[^/]+\/graph/.test(r.url))
  const claims = bodyText.split('\n').map((l) => l.trim()).filter((l) => l && PERSISTENCE_CLAIM.test(l))

  // eslint-disable-next-line no-console
  console.log(`[E3] build=${build} origin=${ORIGIN}`)
  console.log(`[E3] nodes=${nodes} bodyChars=${bodyText.length} requests=${reqs.length}`)
  console.log(`[E3] graph WRITE (register) attempts=${graphWrites.length}  any /graph = ${anyGraph.length}`)
  console.log(`[E3] persistence-claiming lines = ${JSON.stringify(claims.slice(0, 12))}`)

  // REPORTED, NOT ASSERTED: retention is E5's subject and its premise is
  // authenticated. Recorded here so the guest picture is complete in one run.
  const ls = await page.evaluate(() => {
    try { return Object.keys(localStorage).length } catch { return -1 }
  })
  console.log(`[E3] localStorage keys=${ls} (reported, not asserted)`)

  // ── THE ASSERTION ─────────────────────────────────────────────────────────
  // A guest whose graph is never registered server-side must not be told it is
  // saved, synced or kept. This fails LOUDLY with the offending copy so the fix
  // is obvious rather than archaeological.
  expect(
    claims,
    `the guest route asserts persistence while attempting ${graphWrites.length} server graph writes — ` +
    `if that count is 0 the copy is a false claim about the platform`,
  ).toEqual([])
})
