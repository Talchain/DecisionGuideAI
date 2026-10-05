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
 * Runs AFTER J1 in its own advisory step: the draft here replays J1's frozen set
 * (`hit_reuse`), at 0 provider calls.
 *
 * Every absence check has a same-run positive control: the thing must first be seen
 * present for account A.
 */
import { expect, test, type Page, type Request } from '@playwright/test'
import { enterAsGuest, ORIGIN, renderedNodeIds, submitBrief, waitForDraftTurnComplete } from '../lib/harness'
import { browserStorage, scenarioIdFromUrl, scenariosVisibleTo, storedRead, writeEvidence } from './lib/journey'

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

const storageNaming = async (page: Page, needle: string): Promise<string[]> =>
  Object.entries(await browserStorage(page)).filter(([k, v]) => k.includes(needle) || v.includes(needle)).map(([k]) => k)

test.describe.serial('ISO · same browser, two accounts', () => {
  const ev: Record<string, unknown> = {}
  test.afterAll(() => writeEvidence('ISO-same-browser.json', ev))

  test('ISO-1 · A signs out, B signs in: no snapshot, coaching, storage or register crosses (Core Platform + Red-team A1–A3)', async ({ browser, request }) => {
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
    try {
      // ── A, tab 1: a model, a named snapshot, coaching. ──
      await signInViaForm(tab1, A)
      const { S, nodes } = await draft(tab1)
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

      // ── Switch, with Snapshots left OPEN in tab 1 (Core Platform variant). ──
      await signOut(tab2)
      await signInViaForm(tab2, B)

      // Tab 1's open manager loses A's rows without being closed.
      await expect(manager.getByRole('heading', { name: sentinel }), '[ISO-1] the open Snapshot Manager still lists A\'s snapshot after B signed in').toHaveCount(0, { timeout: 30_000 })
      // No storage in either tab names the sentinel or S.
      for (const [name, tab] of [['tab1', tab1], ['tab2', tab2]] as const) {
        expect(await storageNaming(tab, sentinel), `[ISO-1] ${name} storage still holds A's snapshot`).toEqual([])
        expect(await storageNaming(tab, S), `[ISO-1] ${name} storage still names A's scenario`).toEqual([])
      }
      // B's own Snapshots list is empty.
      await tab2.goto(`${ORIGIN}/#/`, { waitUntil: 'load' })
      // A3: B's list and RLS hold no S; B's deep link mounts none of A's nodes.
      expect((await scenariosVisibleTo(request, B.accessToken)).ids, '[ISO-1/A3] B can list A\'s scenario').not.toContain(S)
      await tab2.goto(`${ORIGIN}/#/scenario/${S}`, { waitUntil: 'load' })
      await tab2.waitForTimeout(20_000)
      expect((await renderedNodeIds(tab2)).filter((id) => nodes.includes(id)), '[ISO-1/A3] A\'s model rendered for B').toEqual([])
      // A1/A2: tab 1, reloaded under B, shows nothing of A.
      await tab1.reload({ waitUntil: 'load' })
      await tab1.waitForTimeout(10_000)
      expect((await renderedNodeIds(tab1)).filter((id) => nodes.includes(id)), '[ISO-1/A2] tab 1 restored A\'s model under B').toEqual([])
      expect(await tab1.evaluate(() => sessionStorage.getItem('guidance.items.v1')), '[ISO-1] A\'s coaching survived in tab 1').toBeNull()
      // No register from B's session to A's scenario.
      const crossed = registers.filter((r) => r.scenario === S && r.sub === B.userId)
      expect(crossed, '[ISO-1] B\'s session registered a graph into A\'s scenario').toEqual([])
      ev.iso1 = { S, sentinel, registers: registers.length, crossed: crossed.length }
    } finally {
      await ctx.close()
    }
  })

  test('ISO-2 · guest → sign in as A: exactly one owned copy, guest row untouched, no transcript (Red-team A4, Core Platform ruling)', async ({ browser, request }) => {
    const A = await localUser('a4')
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
    const page = await ctx.newPage()
    try {
      await enterAsGuest(page)
      await submitBrief(page, BRIEF)
      await waitForDraftTurnComplete(page, { timeoutMs: 420_000 })
      const guestId = await page.evaluate(() => localStorage.getItem('olumi-canvas-current-scenario-id'))
      expect(guestId, '[ISO-2 control] the guest model has no scenario id').toMatch(/^[0-9a-f-]{36}$/)
      const guestBefore = await storedRead(request, guestId!, { userId: '', accessToken: '' })
      const copied = page.evaluate(() => new Promise((res) => window.addEventListener('accounts:guest-copied', (e: any) => res(e.detail), { once: true })))

      await signInViaForm(page, A)
      const detail = (await Promise.race([copied, new Promise((r) => setTimeout(() => r(null), 60_000))])) as any
      expect(detail?.sourceScenarioId, '[ISO-2] no guest copy event for the guest model').toBe(guestId)

      const owned = (await scenariosVisibleTo(request, A.accessToken)).ids
      expect(owned, '[ISO-2] A does not own exactly one scenario (the copy)').toEqual([detail.scenarioId])
      const copy = await storedRead(request, detail.scenarioId, A)
      expect(copy.status).toBe(200)
      expect(copy.body!.analysis_state?.run_state?.kind, '[ISO-2] the copy carries a Run').toBe('never_run')
      const guestAfter = await storedRead(request, guestId!, { userId: '', accessToken: '' })
      expect(guestAfter.body?.graph_hash, '[ISO-2] the guest row changed on sign-in').toBe(guestBefore.body?.graph_hash)

      // Re-sign-in makes no second copy.
      await signOut(page)
      await signInViaForm(page, A)
      await page.waitForTimeout(10_000)
      expect((await scenariosVisibleTo(request, A.accessToken)).ids, '[ISO-2] a re-sign-in made a second copy').toEqual([detail.scenarioId])
      ev.iso2 = { guestId, copy: detail.scenarioId, owned: owned.length }
    } finally {
      await ctx.close()
    }
  })
})
