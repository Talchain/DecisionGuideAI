// e2e/core/E5-persistence-reload.core.spec.ts
// =============================================================================
// E5 — the model persists DURABLY. Journey step 6.
// =============================================================================
//
// THE CORE CLAIM THIS FALSIFIES:
//   "A team's shared model is kept. They can come back to it."
//
// The trap this spec exists to avoid is a WORD PROBLEM, not a code problem.
// "Persistence" can honestly mean two different things — the browser remembered,
// or the platform remembered — and a localStorage-only implementation satisfies a
// naive reload test perfectly while satisfying no team on earth. So this spec
// WIPES BROWSER STORAGE between the write and the read, keeping only the auth
// session. What comes back after that came from the server or did not come at all.
//
// Measured 2026-08-27 and the reason this spec is authenticated: a GUEST's
// `POST /bff/cee/scenarios/<id>/graph` returns 404 — a guest's graph is never
// persisted server-side. E5's first assertion re-measures that AUTHENTICATED,
// because that 404 is the whole premise and an inherited premise is not evidence.

import { test, expect } from '@playwright/test'
import {
  installWireInterceptor, assertWireLive, mintAndInject, enterAuthenticated,
  submitBrief, waitForSettledDraft, renderedNodeIds, ORIGIN,
} from './lib/harness'
import { recordSpecRan } from './lib/manifest'

test.beforeAll(() => recordSpecRan('E5-persistence-reload'))

test.describe('E5 · the model persists beyond this browser', () => {
  test('an authenticated model survives a full storage wipe and reload', async ({ page }) => {
    await installWireInterceptor(page)
    const session = await mintAndInject(page, 'e5')
    await enterAuthenticated(page)

    await submitBrief(page)
    // BUDGET, deliberately: draft <=240s + read-back <=90s + overhead < the 420s test
    // timeout. If the phases can sum past the test timeout, a genuine failure is
    // reported as a TIMEOUT and the assertion's message never runs — a verdict never
    // computed. Measured: this mutant timed out twice before the budget was made to fit.
    await waitForSettledDraft(page, { timeoutMs: 240_000 })

    const before = await renderedNodeIds(page)
    expect(before.length, '[E5] nothing was drafted, so there is nothing to persist').toBeGreaterThan(2)
    const href = page.url()

    // ---- ASSERTION 1: the authenticated graph write is not refused -----------
    // Re-measured here rather than inherited. A guest gets 404 on this path; if an
    // authenticated user does too, nothing below can possibly be durable and the
    // spec should say THAT rather than fail confusingly two steps later.
    const wire = await assertWireLive(page, 'after the authenticated draft')
    const graphWrites = wire.filter((c) => /\/scenarios\/[^/]+\/graph/.test(c.url))
    expect(
      graphWrites.length,
      '[E5] no scenario graph write was attempted at all — the persistence seam was never exercised, ' +
      'so a passing reload below would prove only that the browser remembered.',
    ).toBeGreaterThan(0)
    const refused = graphWrites.filter((c) => c.status === 404)
    expect(
      refused.length,
      `[E5] the authenticated graph write was REFUSED 404 on ${refused.length} of ` +
      `${graphWrites.length} attempts (${refused.map((c) => c.url).join(', ')}). This is the same ` +
      `refusal a GUEST gets, so signing in buys the user no durability.`,
    ).toBe(0)

    // ---- wipe the browser, keep only the identity ---------------------------
    // From /version.json, never from inside the app: the app's unload path rewrites
    // its autosave from memory within ~900ms, so an in-app clear does not clear.
    await page.goto(`${ORIGIN}/version.json`, { waitUntil: 'domcontentloaded' })
    await page.evaluate(([k, v]) => {
      localStorage.clear(); sessionStorage.clear(); localStorage.setItem(k as string, v as string)
    }, [session.storageKey, JSON.stringify(session.raw)])

    const keysAfterWipe = await page.evaluate(() => Object.keys(localStorage))
    expect(
      keysAfterWipe,
      `[E5] storage after the wipe holds ${JSON.stringify(keysAfterWipe)} — it must hold EXACTLY the ` +
      `auth session and nothing else, or the model could return from the browser and the spec ` +
      `would credit the server for it.`,
    ).toEqual([session.storageKey])

    // ---- read it back -------------------------------------------------------
    // domcontentloaded, NOT networkidle. This app polls, so `networkidle` is already
    // fragile — and when a request is blocked it retries and networkidle NEVER arrives,
    // so the navigation itself consumes the test timeout and the assertion below never
    // runs. That converts a clean, diagnostic RED into an uninformative timeout.
    await page.goto(href, { waitUntil: 'domcontentloaded' })
    // 90s, not 180s. A read-back window long enough to overrun the test timeout turns a
    // real failure into a TIMEOUT, and a timeout is a verdict never computed — the exact
    // thing this suite exists to remove. Measured: a healthy restore lands well inside 60s.
    const deadline = Date.now() + 90_000
    let after: string[] = []
    while (Date.now() < deadline) {
      after = await renderedNodeIds(page)
      if (after.length > 0) break
      await page.waitForTimeout(5_000)
    }

    expect(
      after.length,
      `[E5] after wiping browser storage the model did not come back (0 nodes). The ${before.length} ` +
      `nodes drafted a moment ago lived only in this browser — a teammate, another device, or this ` +
      `same user tomorrow would see nothing.`,
    ).toBeGreaterThan(0)

    // IDENTITY: the SAME nodes, not merely "some model". A different scenario
    // rendering here would satisfy a count check and would still be data loss.
    const missing = before.filter((id) => !after.includes(id))
    expect(
      missing,
      `[E5] ${missing.length} of ${before.length} node ids did not survive the wipe ` +
      `(${missing.slice(0, 6).join(', ')}${missing.length > 6 ? ', …' : ''}). What came back is not ` +
      `the model that was saved.`,
    ).toHaveLength(0)

    // eslint-disable-next-line no-console
    console.log(
      `[E5] user=${session.user.userId} tokenSha=${session.user.tokenSha256} ` +
      `nodes=${before.length} survived=${after.length} graphWrites=${graphWrites.length} ` +
      `statuses=${[...new Set(graphWrites.map((c) => c.status))].join(',')}`,
    )
  })
})
