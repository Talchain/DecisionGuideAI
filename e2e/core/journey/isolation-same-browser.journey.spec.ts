/**
 * ISOLATION · ONE BROWSER, TWO ACCOUNTS (advisory rows on the J1 stack).
 *
 * Asked for by Red-team (output/red-team-87/ACCEPTANCE-SCRIPT.md §A, A1–A4) and Core
 * Platform (DL decision #87 5992815524: sign-out sweep of manual snapshots, DGAI #2501).
 * J9 covers account B in a FRESH browser. These rows cover the SAME browser, where every
 * account leak so far lived: per-tab sessionStorage, the snapshot keys, the guest pointer.
 *
 * Accounts are LOCAL (the job's own Supabase), signed in through the real form with
 * passwords that exist only in this process. Nothing touches the shared project.
 *
 * Runs AFTER J1 in its own advisory step: the workflow switches the boundary's reuse on
 * (`/__journey_allow_reuse`) only now, so the draft here replays J1's frozen set
 * (`hit_reuse`), at 0 provider calls, and J1 itself could never be served a reuse.
 *
 * Every absence check has a same-run positive control: the thing must first be seen
 * present for account A. A control that cannot be established makes that check
 * UNMEASURED (recorded in the evidence), never a pass.
 */
import { expect, test, type Page, type Request } from '@playwright/test'
import { enterAsGuest, installWireInterceptor, ORIGIN, renderedNodeIds, submitBrief, waitForDraftTurnComplete } from '../lib/harness'
import { browserStorage, ledger, scenarioIdFromUrl, scenarioRowAsService, scenariosVisibleTo, storedRead, writeEvidence } from './lib/journey'

const BRIEF =
  'We are a B2B software company with £120,000 monthly recurring revenue from 400 customers paying £300 a month. ' +
  'Decision: raise prices by 10%, launch a starter tier at £49 a month, or keep pricing as it is. ' +
  'Goal: reach at least £150,000 monthly recurring revenue within 9 months. ' +
  'Facts: each 1% price rise adds £1,200 a month to monthly recurring revenue before churn. ' +
  'Each 1% price rise loses about 2 customers, between 1 and 4. ' +
  'Each lost customer removes £300 a month of monthly recurring revenue. ' +
  'The starter tier would win about 150 new subscribers, between 80 and 250. ' +
  'Each starter subscriber adds £49 a month to monthly recurring revenue. ' +
  'Each starter subscriber costs about £6 a month in support. Keeping pricing as it is adds nothing.'

interface LocalUser { email: string; password: string; userId: string; accessToken: string }

/** A local account with a password held only in memory (the job's own Supabase). */
async function localUser(label: string): Promise<LocalUser> {
  const base = process.env.CORE_SUPABASE_URL!
  const email = `olumi-iso+${label}-${Date.now().toString(36)}@example.test`
  const password = `${Math.random().toString(36).slice(2)}A7!${Math.random().toString(36).slice(2)}`
  const r = await fetch(`${base}/auth/v1/signup`, {
    method: 'POST', headers: { apikey: process.env.CORE_SUPABASE_KEY!, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  const b = (await r.json().catch(() => null)) as Record<string, any> | null
  if (!r.ok || !b?.access_token || !b?.user?.id) throw new Error(`[iso] local sign-up ${label} failed: http ${r.status}`)
  return { email, password, userId: b.user.id, accessToken: b.access_token }
}

/** The real sign-in form (LoginPage.tsx): #/login, Email, owner-password-input, owner-password-submit. */
async function signInViaForm(page: Page, u: LocalUser): Promise<void> {
  await page.goto(`${ORIGIN}/#/login`, { waitUntil: 'load' })
  await page.getByRole('textbox', { name: 'Email' }).fill(u.email)
  await page.getByTestId('owner-password-input').fill(u.password)
  await page.getByTestId('owner-password-submit').click()
  await expect.poll(() => page.url(), { message: `[iso] sign-in as ${u.email} did not leave the form`, timeout: 30_000 }).not.toContain('login')
}

/** Account menu → Sign out (UserAvatarMenu.tsx). */
async function signOut(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Account menu' }).click()
  await page.getByRole('menuitem', { name: 'Sign out' }).click()
  await expect(page.getByRole('button', { name: 'Account menu' }), '[iso] still signed in after Sign out').toHaveCount(0, { timeout: 30_000 })
}

/** A fresh scenario drafted from the frozen brief; returns its id and node ids. */
async function draft(page: Page): Promise<{ S: string; nodes: string[] }> {
  const start = page.getByRole('button', { name: /start a new decision|new decision/i }).first()
  const composer = page.getByTestId('first-use-input-bar-textarea')
  await expect(start.or(composer).first()).toBeVisible({ timeout: 30_000 })
  if (await start.count()) await start.click()
  await submitBrief(page, BRIEF)
  await waitForDraftTurnComplete(page, { timeoutMs: 420_000 })
  await expect.poll(() => scenarioIdFromUrl(page.url()), { timeout: 60_000 }).not.toBeNull()
  await expect.poll(async () => (await renderedNodeIds(page)).length, { timeout: 60_000 }).toBeGreaterThan(0)
  return { S: scenarioIdFromUrl(page.url())!, nodes: (await renderedNodeIds(page)).sort() }
}

/**
 * The isolation drafts replay J1's frozen set. Every LLM call after the reuse switch must have
 * been served from it (hit / hit_reuse); a drift or miss means the product ran on a refusal, so
 * the row could not measure (run 37325381283: the GUEST draft's second call carries a function
 * call item J1's signed-in recording does not, so it drifts; a guest recording is DL-gated).
 */
function assertIsolationBoundaryClean(label: string): void {
  const rows = ledger()
  if (process.env.J1_MODE === 'record') {
    // Recording: every call so far must have been forwarded and saved (no 429, no upstream error).
    const bad = rows.filter((r) => r.outcome !== 'recorded')
    if (bad.length) throw new Error(`[${label}] RECORD INVALID: ${bad.length} call(s) not recorded (first: #${bad[0].seq} ${bad[0].outcome})`)
    return
  }
  const from = rows.findIndex((r) => r.outcome === 'reuse_enabled')
  const bad = rows.slice(from + 1).filter((r) => r.outcome !== 'hit' && r.outcome !== 'hit_reuse')
  if (from < 0 || bad.length) {
    throw new Error(`[${label}] COULD NOT MEASURE: ${from < 0 ? 'reuse was never enabled' : `${bad.length} LLM call(s) not served from the frozen set (first: #${bad[0].seq} ${bad[0].outcome})`}`)
  }
}

const storageNaming = async (page: Page, needle: string): Promise<string[]> =>
  Object.entries(await browserStorage(page)).filter(([k, v]) => k.includes(needle) || v.includes(needle)).map(([k]) => k)

// Not serial: the two rows share nothing, so one failing must not skip the other
// (231ad3ec run 37315190922: ISO-1 failed and serial mode never ran ISO-2).
test.describe('ISO · same browser, two accounts', () => {
  // Evidence is per test, written in each test's finally: a failed test restarts the worker, and
  // a describe-level afterAll in the next worker overwrote ISO-1's evidence with {} (run 37325381283).

  test('ISO-1 · A signs out, B signs in: no snapshot, coaching, storage or register crosses (Core Platform + Red-team A1–A3)', async ({ browser }) => {
    const ev: Record<string, unknown> = {}
    const A = await localUser('a')
    const B = await localUser('b')
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
    const registers: { scenario: string; sub: string | null }[] = []
    ctx.on('request', (r: Request) => {
      const m = r.url().match(/\/bff\/cee\/scenarios\/([^/]+)\/graph\/register$/)
      if (!m || r.method() !== 'POST') return
      const tok = (r.headers()['authorization'] ?? '').replace(/^Bearer /, '')
      let sub: string | null = null
      try { sub = JSON.parse(Buffer.from(tok.split('.')[1], 'base64url').toString()).sub ?? null } catch { /* no token */ }
      registers.push({ scenario: decodeURIComponent(m[1]), sub })
    })
    const tab1 = await ctx.newPage()
    const tab2 = await ctx.newPage()
    // The harness's draft-complete wait reads the wire interceptor, which must be in
    // place before the first navigation (ISO-1 failed without it: "ZERO draft turn streams").
    await installWireInterceptor(tab1)
    await installWireInterceptor(tab2)
    try {
      // ── A, tab 1: a model, a named snapshot, coaching. ──
      await signInViaForm(tab1, A)
      const { S, nodes } = await draft(tab1)
      assertIsolationBoundaryClean('ISO-1')
      const sentinel = `ISO-SENTINEL-${Date.now().toString(36)}`
      await tab1.getByRole('button', { name: 'More options' }).click()
      await tab1.getByTestId('kebab-snapshots').click()
      const manager = tab1.getByRole('dialog', { name: 'Snapshot Manager' })
      await manager.getByRole('button', { name: /Save Current Canvas/ }).click()
      await manager.getByRole('button', { name: 'Rename' }).first().click()
      await manager.getByRole('textbox').first().fill(sentinel)
      await tab1.keyboard.press('Enter')
      // Controls: the sentinel is visible and stored; A's model is in tab 2 too.
      await expect(manager.getByRole('heading', { name: sentinel }), '[ISO-1 control] the named snapshot is not listed for A').toBeVisible()
      expect((await storageNaming(tab1, sentinel)).length, '[ISO-1 control] the sentinel is not in storage for A').toBeGreaterThan(0)
      await tab2.goto(`${ORIGIN}/#/scenario/${S}`, { waitUntil: 'load' })
      await expect.poll(async () => (await renderedNodeIds(tab2)).sort(), { message: '[ISO-1 control] tab 2 does not show A\'s model', timeout: 120_000 }).toEqual(nodes)
      const tab2Before = await browserStorage(tab2)
      ev.iso1_tab2_session_before = Object.keys(tab2Before)
      // Controls for every absence checked after the switch:
      for (const [name, tab] of [['tab1', tab1], ['tab2', tab2]] as const) {
        expect((await storageNaming(tab, S)).length, `[ISO-1 control] ${name} storage does not name S before the switch`).toBeGreaterThan(0)
      }
      expect((await scenariosVisibleTo(A.accessToken)).ids, '[ISO-1 control] A cannot list its own S via PostgREST').toContain(S)
      const coachingBefore = await tab1.evaluate(() => sessionStorage.getItem('guidance.items.v1'))
      const aRegistered = registers.some((r) => r.scenario === S && r.sub === A.userId)
      ev.iso1_controls = { coaching_present_for_A: coachingBefore !== null, register_seen_for_A: aRegistered }

      // ── Switch, with Snapshots left OPEN in tab 1 (Core Platform variant). ──
      await signOut(tab2)
      await signInViaForm(tab2, B)

      // Tab 1's open manager loses A's rows without being closed.
      await expect(manager.getByRole('heading', { name: sentinel }), '[ISO-1] the open Snapshot Manager still lists A\'s snapshot after B signed in').toHaveCount(0, { timeout: 30_000 })
      // No storage in either tab names the sentinel or S.
      // Evidence first, for every key that still names S: which area holds it, how big it is, and
      // whether it carries A's own words (the brief), so a leak is a finding, not a guess.
      const briefProbe = BRIEF.slice(0, 40)
      for (const [name, tab] of [['tab1', tab1], ['tab2', tab2]] as const) {
        ev[`iso1_${name}_keys_naming_S`] = await tab.evaluate(([needle, probe]) => {
          const out: { key: string; area: string; bytes: number; carries_brief: boolean }[] = []
          for (const [area, st] of [['local', localStorage], ['session', sessionStorage]] as const) {
            for (let i = 0; i < st.length; i++) {
              const k = st.key(i)!; const v = st.getItem(k) ?? ''
              if (k.includes(needle) || v.includes(needle)) out.push({ key: k, area, bytes: v.length, carries_brief: v.includes(probe) })
            }
          }
          return out
        }, [S, briefProbe] as const)
      }
      for (const [name, tab] of [['tab1', tab1], ['tab2', tab2]] as const) {
        expect(await storageNaming(tab, sentinel), `[ISO-1] ${name} storage still holds A's snapshot`).toEqual([])
        expect(await storageNaming(tab, S), `[ISO-1] ${name} storage still names A's scenario`).toEqual([])
      }
      // B's own Snapshots list is empty.
      await tab2.goto(`${ORIGIN}/#/`, { waitUntil: 'load' })
      // A3: B's list and RLS hold no S; B's deep link mounts none of A's nodes.
      expect((await scenariosVisibleTo(B.accessToken)).ids, '[ISO-1/A3] B can list A\'s scenario').not.toContain(S)
      // Terminal state first: tab 2's own CEE read of S under B is refused.
      const uiRead = tab2.waitForResponse((r) => r.url().includes(`/bff/cee/scenarios/${S}/graph`) && r.request().method() === 'POST', { timeout: 90_000 }).catch(() => null)
      await tab2.goto(`${ORIGIN}/#/scenario/${S}`, { waitUntil: 'load' })
      const refused = await uiRead
      expect(refused, '[ISO-1/A3] COULD NOT MEASURE: B\'s tab never read S from CEE').not.toBeNull()
      expect([403, 404], `[ISO-1/A3] CEE served S to B (status ${refused!.status()})`).toContain(refused!.status())
      expect((await renderedNodeIds(tab2)).filter((id) => nodes.includes(id)), '[ISO-1/A3] A\'s model rendered for B').toEqual([])
      // A1/A2: tab 1, reloaded under B, shows nothing of A.
      const tab1Read = tab1.waitForResponse((r) => r.url().includes(`/bff/cee/scenarios/${S}/graph`) && r.request().method() === 'POST', { timeout: 90_000 }).catch(() => null)
      await tab1.reload({ waitUntil: 'load' })
      const tab1Refused = await tab1Read
      if (tab1Refused) {
        expect([403, 404], `[ISO-1/A2] CEE served S to tab 1 under B (status ${tab1Refused.status()})`).toContain(tab1Refused.status())
      } else {
        // Tab 1 may no longer point at S at all (the sweep cleared it): then wait for the signed-in shell.
        await expect(tab1.getByRole('button', { name: 'Account menu' }), '[ISO-1/A2] tab 1 never rendered signed in after reload').toBeVisible({ timeout: 60_000 })
        ev.iso1_tab1_reload = 'tab 1 did not read S after reload (pointer swept); shell rendered'
      }
      expect((await renderedNodeIds(tab1)).filter((id) => nodes.includes(id)), '[ISO-1/A2] tab 1 restored A\'s model under B').toEqual([])
      if (coachingBefore !== null) {
        expect(await tab1.evaluate(() => sessionStorage.getItem('guidance.items.v1')), '[ISO-1] A\'s coaching survived in tab 1').toBeNull()
      } else {
        ev.iso1_coaching = 'UNMEASURED: A had no coaching items in tab 1 before the switch'
      }
      // No register from B's session to A's scenario (control: A's own session did register S).
      const crossed = registers.filter((r) => r.scenario === S && r.sub === B.userId)
      if (aRegistered) {
        expect(crossed, '[ISO-1] B\'s session registered a graph into A\'s scenario').toEqual([])
      } else {
        ev.iso1_register = `UNMEASURED: no register from A's session to S was seen (${registers.length} register(s) in all)`
      }
      ev.iso1 = { S, sentinel, registers: registers.length, crossed: crossed.length }
    } finally {
      writeEvidence('ISO-1.json', ev)
      await ctx.close()
    }
  })

  test('ISO-2 · guest → sign in as A: exactly one owned copy, guest row untouched, no transcript (Red-team A4, Core Platform ruling)', async ({ browser }) => {
    const ev: Record<string, unknown> = {}
    const A = await localUser('a4')
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
    const page = await ctx.newPage()
    await installWireInterceptor(page)
    try {
      // enterAsGuest expects the landing screen already loaded (run 37322670650: blank page).
      await page.goto(`${ORIGIN}/`, { waitUntil: 'load' })
      await enterAsGuest(page)
      await submitBrief(page, BRIEF)
      await waitForDraftTurnComplete(page, { timeoutMs: 420_000 })
      assertIsolationBoundaryClean('ISO-2')
      const guestId = await page.evaluate(() => localStorage.getItem('olumi-canvas-current-scenario-id'))
      expect(guestId, '[ISO-2 control] the guest model has no scenario id').toMatch(/^[0-9a-f-]{36}$/)
      // The guest row, read with the LOCAL job's service role (no user token can read it).
      const guestBefore = JSON.stringify(await scenarioRowAsService(guestId!))
      const copied = page.evaluate(() => new Promise((res) => window.addEventListener('accounts:guest-copied', (e: any) => res(e.detail), { once: true })))

      await signInViaForm(page, A)
      const detail = (await Promise.race([copied, new Promise((r) => setTimeout(() => r(null), 60_000))])) as any
      expect(detail?.sourceScenarioId, '[ISO-2] no guest copy event for the guest model').toBe(guestId)

      const owned = (await scenariosVisibleTo(A.accessToken)).ids
      expect(owned, '[ISO-2] A does not own exactly one scenario (the copy)').toEqual([detail.scenarioId])
      const copy = await storedRead(detail.scenarioId, A)
      expect(copy.status, '[ISO-2] A cannot read its own copy from CEE').toBe(200)
      expect(copy.body!.analysis_state?.run_state?.kind, '[ISO-2] the copy carries a Run').toBe('never_run')
      const guestAfter = JSON.stringify(await scenarioRowAsService(guestId!))
      expect(guestAfter.length, '[ISO-2 control] the guest row read is empty').toBeGreaterThan(2)
      expect(guestAfter, '[ISO-2] the guest row changed on sign-in (byte-for-byte)').toBe(guestBefore)

      // Re-sign-in makes no second copy.
      await signOut(page)
      // A window flag, never a pending page.evaluate (one held the test to its 900 s timeout).
      await page.evaluate(() => {
        const w = window as unknown as { __isoSecondCopy?: boolean }
        w.__isoSecondCopy = false
        window.addEventListener('accounts:guest-copied', () => { w.__isoSecondCopy = true }, { once: true })
      })
      await signInViaForm(page, A)
      await expect(page.getByRole('button', { name: 'Account menu' }), '[ISO-2] the re-sign-in never rendered signed in').toBeVisible({ timeout: 60_000 })
      await page.waitForTimeout(15_000)
      const secondCopy = await page.evaluate(() => (window as unknown as { __isoSecondCopy?: boolean }).__isoSecondCopy)
      // undefined = the document was replaced, so the listener is gone: the REST count below still measures.
      ev.iso2_second_copy_event = secondCopy ?? 'UNMEASURED (document replaced)'
      expect(secondCopy === true, '[ISO-2] the re-sign-in fired a second guest copy').toBe(false)
      expect((await scenariosVisibleTo(A.accessToken)).ids, '[ISO-2] a re-sign-in made a second copy').toEqual([detail.scenarioId])
      ev.iso2 = { guestId, copy: detail.scenarioId, owned: owned.length }
    } finally {
      writeEvidence('ISO-2.json', ev)
      await ctx.close()
    }
  })
})
