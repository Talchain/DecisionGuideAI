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
    signal: AbortSignal.timeout(60_000),
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

/** Account menu → Sign out (UserAvatarMenu.tsx). AuthContext.signOut clears the session first (the menu goes at once),
 * then awaits supabase signOut, then navigate('/', { replace: true }). A #/login goto inside that gap is replaced by the
 * late navigate and the form detaches under the click (runs 37341662955, 37341921615), so wait for that navigation. */
async function signOut(page: Page): Promise<void> {
  await bounded(page.evaluate(() => {
    const w = window as unknown as { __isoSignOutNav?: boolean; __isoNavWatch?: boolean }
    w.__isoSignOutNav = false
    if (w.__isoNavWatch) return
    w.__isoNavWatch = true
    const replace = history.replaceState.bind(history)
    history.replaceState = (data: unknown, unused: string, url?: string | URL | null) => {
      if (url != null && /#\/$/.test(String(url))) w.__isoSignOutNav = true
      return replace(data, unused, url)
    }
  }), 'sign-out navigation watch')
  await page.getByRole('button', { name: 'Account menu' }).click()
  await page.getByRole('menuitem', { name: 'Sign out' }).click()
  await expect(page.getByRole('button', { name: 'Account menu' }), '[iso] still signed in after Sign out').toHaveCount(0, { timeout: 30_000 })
  const settled = () => bounded(page.evaluate(() => ({
    navigated: (window as unknown as { __isoSignOutNav?: boolean }).__isoSignOutNav ?? null,
    token: Object.keys(localStorage).some((k) => /^sb-.+-auth-token$/.test(k)),
  })), 'sign-out settle read')
  await expect.poll(settled, { message: '[iso] sign-out never removed the session and navigated to #/', timeout: 30_000 }).toEqual({ navigated: true, token: false })
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
  await expect.poll(async () => (await nodeIds(page, 'draft')).length, { timeout: 60_000 }).toBeGreaterThan(0)
  return { S: scenarioIdFromUrl(page.url())!, nodes: (await nodeIds(page, 'draft')).sort() }
}

/**
 * The isolation drafts replay J1's frozen set. Every LLM call after the reuse switch must have
 * been served from it (hit / hit_reuse); a drift or miss means the product ran on a refusal, so
 * the row could not measure (run 37325381283: the GUEST draft's second call carries a function
 * call item J1's signed-in recording does not, so it drifts; a guest recording is DL-gated).
 */
function assertIsolationBoundaryClean(label: string): void {
  const rows = ledger()
  if (process.env.J1_MODE === 'record' || process.env.J1_MODE === 'fill') {
    // Recording (or filling gaps): every call so far was saved or served exactly (no 429, no error).
    const ok = process.env.J1_MODE === 'fill' ? ['index', 'hit', 'recorded'] : ['recorded']
    const bad = rows.filter((r) => !ok.includes(r.outcome))
    if (bad.length) throw new Error(`[${label}] RECORD INVALID: ${bad.length} call(s) not recorded (first: #${bad[0].seq} ${bad[0].outcome})`)
    return
  }
  const from = rows.findIndex((r) => r.outcome === 'reuse_enabled')
  const bad = rows.slice(from + 1).filter((r) => r.outcome !== 'hit' && r.outcome !== 'hit_reuse')
  if (from < 0 || bad.length) {
    throw new Error(`[${label}] COULD NOT MEASURE: ${from < 0 ? 'reuse was never enabled' : `${bad.length} LLM call(s) not served from the frozen set (first: #${bad[0].seq} ${bad[0].outcome})`}`)
  }
}

/**
 * Rejects with a NAMED error if `p` has not settled in `ms`. page.evaluate (storage scans, the
 * rendered-node-id read) has no timeout of its own: on UI bases with #2511 (thin client) ISO-1 sat
 * to its 900 s test timeout with the hang point unreported (Core Platform, runs 37337813996 et al.).
 */
function bounded<T>(p: Promise<T>, label: string, ms = 60_000): Promise<T> {
  let t: ReturnType<typeof setTimeout> | undefined
  return Promise.race([p, new Promise<T>((_, rej) => { t = setTimeout(() => rej(new Error(`${label}: no answer in ${ms / 1000}s`)), ms) })])
    .finally(() => clearTimeout(t))
}

/** Step checkpoints written to the evidence file AS THEY HAPPEN: a timeout leaves its last step on disk. */
function checkpoints(file: string, ev: Record<string, unknown>): (step: string) => void {
  const t0 = Date.now()
  const steps: { step: string; at_s: number }[] = []
  ev.steps = steps
  return (step: string) => { steps.push({ step, at_s: Math.round((Date.now() - t0) / 1000) }); writeEvidence(file, ev) }
}

/**
 * Is the UI under test the THIN client (#2511: a signed-in browser keeps no local model, so no local
 * snapshot save; #2524 GAP-2)? Read from the BUILD, never from the screen: the workflow sets J1_UI_THIN
 * from whether the UI checkout has src/canvas/thinClient/thinClient.ts. Keying on "is Save on screen"
 * would let a full build that lost Save pass as thin.
 */
function uiIsThin(): boolean {
  const v = process.env.J1_UI_THIN
  if (v !== '0' && v !== '1') throw new Error('[ISO] COULD NOT MEASURE: J1_UI_THIN is unset (derived from the UI checkout by the workflow)')
  return v === '1'
}

const nodeIds = (page: Page, label: string): Promise<string[]> => bounded(renderedNodeIds(page), `${label} (rendered node ids)`)

// CORE PLATFORM transcript measurement (v2). The conversation is mounted only while the dock shows it, so every check
// opens it first: the rail tab when the dock is collapsed, the dock tab when it is open. Null = no panel (UNMEASURED).
const conversationText = async (page: Page): Promise<string | null> => {
  const log = page.getByRole('log', { name: 'Conversation' }).first()
  if (!(await log.isVisible().catch(() => false))) {
    for (const id of ['outputs-dock-rail-tab-olumi', 'outputs-dock-tab-olumi']) {
      const tab = page.getByTestId(id)
      if (await tab.isVisible().catch(() => false)) { await tab.click(); break }
    }
  }
  return (await log.waitFor({ state: 'visible', timeout: 15_000 }).then(() => true).catch(() => false)) ? log.innerText() : null
}
// The first moment the probe entered this document's DOM, however briefly. Installed before navigation.
const WATCH = (probe: string): void => {
  const w = window as unknown as { __probeSeenAt?: number }
  const seen = (t: string | null | undefined): void => { if (!w.__probeSeenAt && t && t.includes(probe)) w.__probeSeenAt = Date.now() }
  new MutationObserver((ms) => { for (const m of ms) { if (m.type === 'characterData') seen(m.target.textContent); m.addedNodes.forEach((n) => seen(n.textContent)) } })
    .observe(document, { subtree: true, childList: true, characterData: true })
}
const probeSeenAt = (page: Page): Promise<number | null> =>
  page.evaluate(() => (window as unknown as { __probeSeenAt?: number }).__probeSeenAt ?? null)
const resetProbe = (page: Page): Promise<void> =>
  page.evaluate(() => { delete (window as unknown as { __probeSeenAt?: number }).__probeSeenAt })

const storageNaming = async (page: Page, needle: string): Promise<string[]> =>
  Object.entries(await bounded(browserStorage(page), 'storage scan')).filter(([k, v]) => k.includes(needle) || v.includes(needle)).map(([k]) => k)

// Not serial: the two rows share nothing, so one failing must not skip the other
// (231ad3ec run 37315190922: ISO-1 failed and serial mode never ran ISO-2).
test.describe('ISO · same browser, two accounts', () => {
  // Evidence is per test, written in each test's finally: a failed test restarts the worker, and
  // a describe-level afterAll in the next worker overwrote ISO-1's evidence with {} (run 37325381283).

  test('ISO-1 · A signs out, B signs in: no snapshot, coaching, storage or register crosses (Core Platform + Red-team A1–A3)', async ({ browser }) => {
    const ev: Record<string, unknown> = {}
    const mark = checkpoints('ISO-1.json', ev)
    mark('sign up A and B (local)')
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
      mark('tab 1: A signs in via the form')
      await signInViaForm(tab1, A)
      mark('tab 1: A drafts')
      const { S, nodes } = await draft(tab1)
      assertIsolationBoundaryClean('ISO-1')
      const thin = uiIsThin()
      ev.snapshot_mode = thin ? 'thin' : 'full'
      const sentinel = `ISO-SENTINEL-${Date.now().toString(36)}`
      const manager = tab1.getByRole('dialog', { name: 'Snapshot Manager' })
      if (thin) {
        // Thin client: a signed-in page offers no local snapshot save, and writes no snapshot key.
        mark('tab 1: thin client offers no local snapshot save')
        await tab1.getByRole('button', { name: 'More options' }).click()
        const entry = tab1.getByTestId('kebab-snapshots')
        if (await entry.isVisible().catch(() => false)) {
          await entry.click()
          const save = manager.getByRole('button', { name: /Save Current Canvas/ })
          const offered = (await save.count()) > 0 && (await save.first().isEnabled())
          expect(offered, '[ISO-1/thin] a signed-in thin page offers a local snapshot save').toBe(false)
          ev.snapshot_entry = 'present, Save absent or disabled'
        } else {
          ev.snapshot_entry = 'absent'
        }
        await tab1.keyboard.press('Escape')
        const snapKeys = Object.keys(await bounded(browserStorage(tab1), 'tab 1 storage (thin)')).filter((k) => k.startsWith('canvas-snapshot-'))
        expect(snapKeys, '[ISO-1/thin] a signed-in thin page wrote a local snapshot').toEqual([])
      } else {
        mark('tab 1: save + rename a snapshot')
        await tab1.getByRole('button', { name: 'More options' }).click()
        await tab1.getByTestId('kebab-snapshots').click()
        await manager.getByRole('button', { name: /Save Current Canvas/ }).click()
        await manager.getByRole('button', { name: 'Rename' }).first().click()
        await manager.getByRole('textbox').first().fill(sentinel)
        await tab1.keyboard.press('Enter')
        // Controls: the sentinel is visible and stored.
        await expect(manager.getByRole('heading', { name: sentinel }), '[ISO-1 control] the named snapshot is not listed for A').toBeVisible()
        expect((await storageNaming(tab1, sentinel)).length, '[ISO-1 control] the sentinel is not in storage for A').toBeGreaterThan(0)
      }
      mark('tab 2: opens S')
      const tProbe = BRIEF.slice(0, 40)
      await tab2.addInitScript(WATCH, tProbe)
      await tab2.goto(`${ORIGIN}/#/scenario/${S}`, { waitUntil: 'load' })
      await expect.poll(async () => (await nodeIds(tab2, 'tab 2 opens S')).sort(), { message: '[ISO-1 control] tab 2 does not show A\'s model', timeout: 120_000 }).toEqual(nodes)
      // [T control] tab 2, deep-linked to S under A: its conversation shows A's brief, and the watcher saw it arrive.
      mark('T control: tab 2 conversation under A')
      await expect.poll(async () => (await conversationText(tab2))?.includes(tProbe) ?? false, { message: '[ISO-1/T control] tab 2 under A never showed A\'s brief in its conversation', timeout: 60_000 }).toBe(true)
      ev.iso1_T_control = { tab2_A_conversation_carries_brief: true, watcher_saw_it_at: await bounded(probeSeenAt(tab2), 'T control watcher read') }
      expect((ev.iso1_T_control as { watcher_saw_it_at: number | null }).watcher_saw_it_at, '[ISO-1/T control] the DOM watcher missed A\'s brief').not.toBeNull()
      mark('controls before the switch')
      const tab2Before = await bounded(browserStorage(tab2), 'tab 2 storage before the switch')
      ev.iso1_tab2_session_before = Object.keys(tab2Before)
      // Controls for every absence checked after the switch:
      for (const [name, tab] of [['tab1', tab1], ['tab2', tab2]] as const) {
        expect((await storageNaming(tab, S)).length, `[ISO-1 control] ${name} storage does not name S before the switch`).toBeGreaterThan(0)
      }
      expect((await scenariosVisibleTo(A.accessToken)).ids, '[ISO-1 control] A cannot list its own S via PostgREST').toContain(S)
      const coachingBefore = await bounded(tab1.evaluate(() => sessionStorage.getItem('guidance.items.v1')), 'tab 1 coaching read')
      const aRegistered = registers.some((r) => r.scenario === S && r.sub === A.userId)
      ev.iso1_controls = { coaching_present_for_A: coachingBefore !== null, register_seen_for_A: aRegistered }

      // ── Switch, with Snapshots left OPEN in tab 1 (Core Platform variant). ──
      mark('tab 2: A signs out')
      await signOut(tab2)
      mark('tab 2: B signs in via the form')
      await signInViaForm(tab2, B)
      mark('tab 1: open Snapshot Manager loses A\'s rows')

      // Tab 1's open manager loses A's rows without being closed.
      if (!thin) await expect(manager.getByRole('heading', { name: sentinel }), '[ISO-1] the open Snapshot Manager still lists A\'s snapshot after B signed in').toHaveCount(0, { timeout: 30_000 })
      // No storage in either tab names the sentinel or S.
      // Evidence first, for every key that still names S: which area holds it, how big it is, and
      // whether it carries A's own words (the brief), so a leak is a finding, not a guess.
      const briefProbe = BRIEF.slice(0, 40)
      mark('storage evidence (keys naming S)')
      for (const [name, tab] of [['tab1', tab1], ['tab2', tab2]] as const) {
        ev[`iso1_${name}_keys_naming_S`] = await bounded(tab.evaluate(([needle, probe]) => {
          const out: { key: string; area: string; bytes: number; carries_brief: boolean }[] = []
          for (const [area, st] of [['local', localStorage], ['session', sessionStorage]] as const) {
            for (let i = 0; i < st.length; i++) {
              const k = st.key(i)!; const v = st.getItem(k) ?? ''
              if (k.includes(needle) || v.includes(needle)) out.push({ key: k, area, bytes: v.length, carries_brief: v.includes(probe) })
            }
          }
          return out
        }, [S, briefProbe] as const), `${name} storage evidence`)
      }
      mark('storage assertions')
      for (const [name, tab] of [['tab1', tab1], ['tab2', tab2]] as const) {
        if (!thin) expect.soft(await storageNaming(tab, sentinel), `[ISO-1] ${name} storage still holds A's snapshot`).toEqual([])
        expect.soft(await storageNaming(tab, S), `[ISO-1] ${name} storage still names A's scenario`).toEqual([])
      }
      // B's own Snapshots list is empty.
      mark('tab 2: B home + REST list')
      await tab2.goto(`${ORIGIN}/#/`, { waitUntil: 'load' })
      // [T] before B's deep link: B's conversation open on B's own canvas, and the watcher reset for B.
      mark('T: B opens the conversation before the deep link')
      ev.iso1_T_tab2_B_panel_open_before_deep_link = (await conversationText(tab2)) !== null
      await bounded(resetProbe(tab2), 'T watcher reset')
      // A3: B's list and RLS hold no S; B's deep link mounts none of A's nodes.
      expect((await scenariosVisibleTo(B.accessToken)).ids, '[ISO-1/A3] B can list A\'s scenario').not.toContain(S)
      // Terminal state first: tab 2's own CEE read of S under B is refused.
      mark('tab 2: B deep-links S')
      const uiRead = tab2.waitForResponse((r) => r.url().includes(`/bff/cee/scenarios/${S}/graph`) && r.request().method() === 'POST', { timeout: 90_000 }).catch(() => null)
      await tab2.goto(`${ORIGIN}/#/scenario/${S}`, { waitUntil: 'load' })
      const refused = await uiRead
      expect(refused, '[ISO-1/A3] COULD NOT MEASURE: B\'s tab never read S from CEE').not.toBeNull()
      expect([403, 404], `[ISO-1/A3] CEE served S to B (status ${refused!.status()})`).toContain(refused!.status())
      expect((await nodeIds(tab2, 'tab 2 under B')).filter((id) => nodes.includes(id)), '[ISO-1/A3] A\'s model rendered for B').toEqual([])
      // [T] B's tab 2 on S: A's brief is never on screen. Settle first: the transcript restore runs after mount.
      mark('T: B tab 2 on S conversation')
      await tab2.waitForTimeout(8_000)
      const t2 = await conversationText(tab2)
      ev.iso1_T_tab2_B_on_S = { conversation_open: t2 !== null, conversation_carries_A_brief: t2 === null ? null : t2.includes(tProbe), dom_ever_carried_A_brief_at: await bounded(probeSeenAt(tab2), 'T tab 2 watcher read') }
      await tab2.screenshot({ path: 'test-results/journey/evidence/ISO-1-T-tab2-B-on-S.png', fullPage: true }).catch(() => {})
      expect.soft(t2, '[ISO-1/T] COULD NOT MEASURE: no conversation panel in B\'s tab 2').not.toBeNull()
      expect.soft(t2?.includes(tProbe) ?? false, '[ISO-1/T] B\'s tab 2 on S shows A\'s brief in its conversation').toBe(false)
      expect.soft((ev.iso1_T_tab2_B_on_S as { dom_ever_carried_A_brief_at: number | null }).dom_ever_carried_A_brief_at, '[ISO-1/T] A\'s brief entered B\'s tab 2 DOM, however briefly').toBeNull()
      // A1/A2: tab 1, reloaded under B, shows nothing of A.
      mark('tab 1: reload under B')
      const tab1Read = tab1.waitForResponse((r) => r.url().includes(`/bff/cee/scenarios/${S}/graph`) && r.request().method() === 'POST', { timeout: 90_000 }).catch(() => null)
      await tab1.addInitScript(WATCH, tProbe)
      await tab1.reload({ waitUntil: 'load' })
      const tab1Refused = await tab1Read
      if (tab1Refused) {
        expect([403, 404], `[ISO-1/A2] CEE served S to tab 1 under B (status ${tab1Refused.status()})`).toContain(tab1Refused.status())
      } else {
        // Tab 1 may no longer point at S at all (the sweep cleared it): then wait for the signed-in shell.
        await expect(tab1.getByRole('button', { name: 'Account menu' }), '[ISO-1/A2] tab 1 never rendered signed in after reload').toBeVisible({ timeout: 60_000 })
        ev.iso1_tab1_reload = 'tab 1 did not read S after reload (pointer swept); shell rendered'
      }
      expect((await nodeIds(tab1, 'tab 1 under B')).filter((id) => nodes.includes(id)), '[ISO-1/A2] tab 1 restored A\'s model under B').toEqual([])
      mark('T: tab 1 reloaded under B conversation')
      await tab1.waitForTimeout(8_000)
      const t1 = await conversationText(tab1)
      ev.iso1_T_tab1_B_reload = { conversation_open: t1 !== null, conversation_carries_A_brief: t1 === null ? null : t1.includes(tProbe), dom_ever_carried_A_brief_at: await bounded(probeSeenAt(tab1), 'T tab 1 watcher read') }
      await tab1.screenshot({ path: 'test-results/journey/evidence/ISO-1-T-tab1-B-reload.png', fullPage: true }).catch(() => {})
      expect.soft(t1, '[ISO-1/T] COULD NOT MEASURE: no conversation panel in tab 1 after reload').not.toBeNull()
      expect.soft(t1?.includes(tProbe) ?? false, '[ISO-1/T] tab 1 reloaded under B shows A\'s brief in its conversation').toBe(false)
      expect.soft((ev.iso1_T_tab1_B_reload as { dom_ever_carried_A_brief_at: number | null }).dom_ever_carried_A_brief_at, '[ISO-1/T] A\'s brief entered tab 1\'s DOM after the reload under B').toBeNull()
      mark('coaching + register checks')
      if (coachingBefore !== null) {
        expect(await bounded(tab1.evaluate(() => sessionStorage.getItem('guidance.items.v1')), 'tab 1 coaching after'), '[ISO-1] A\'s coaching survived in tab 1').toBeNull()
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
      mark('done')
    } finally {
      writeEvidence('ISO-1.json', ev)
      await ctx.close()
    }
  })

  test('ISO-2 · guest → sign in as A: exactly one owned copy, guest row untouched, no transcript (Red-team A4, Core Platform ruling)', async ({ browser }) => {
    const ev: Record<string, unknown> = {}
    const mark = checkpoints('ISO-2.json', ev)
    mark('sign up A (local)')
    const A = await localUser('a4')
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
    const page = await ctx.newPage()
    await installWireInterceptor(page)
    try {
      // enterAsGuest expects the landing screen already loaded (run 37322670650: blank page).
      mark('guest enters + drafts')
      await page.goto(`${ORIGIN}/`, { waitUntil: 'load' })
      await enterAsGuest(page)
      await submitBrief(page, BRIEF)
      await waitForDraftTurnComplete(page, { timeoutMs: 420_000 })
      assertIsolationBoundaryClean('ISO-2')
      const guestId = await bounded(page.evaluate(() => localStorage.getItem('olumi-canvas-current-scenario-id')), 'guest pointer read')
      expect(guestId, '[ISO-2 control] the guest model has no scenario id').toMatch(/^[0-9a-f-]{36}$/)
      // The guest row, read with the LOCAL job's service role (no user token can read it).
      mark('guest row before sign-in')
      const guestBefore = JSON.stringify(await scenarioRowAsService(guestId!))
      const copied = page.evaluate(() => new Promise((res) => window.addEventListener('accounts:guest-copied', (e: any) => res(e.detail), { once: true })))

      mark('A signs in via the form (guest copy)')
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
      mark('A signs out + back in (no second copy)')
      await signOut(page)
      // A window flag, never a pending page.evaluate (one held the test to its 900 s timeout).
      await bounded(page.evaluate(() => {
        const w = window as unknown as { __isoSecondCopy?: boolean }
        w.__isoSecondCopy = false
        window.addEventListener('accounts:guest-copied', () => { w.__isoSecondCopy = true }, { once: true })
      }), 'second-copy flag set')
      await signInViaForm(page, A)
      await expect(page.getByRole('button', { name: 'Account menu' }), '[ISO-2] the re-sign-in never rendered signed in').toBeVisible({ timeout: 60_000 })
      await page.waitForTimeout(15_000)
      const secondCopy = await bounded(page.evaluate(() => (window as unknown as { __isoSecondCopy?: boolean }).__isoSecondCopy), 'second-copy flag read')
      // undefined = the document was replaced, so the listener is gone: the REST count below still measures.
      ev.iso2_second_copy_event = secondCopy ?? 'UNMEASURED (document replaced)'
      expect(secondCopy === true, '[ISO-2] the re-sign-in fired a second guest copy').toBe(false)
      expect((await scenariosVisibleTo(A.accessToken)).ids, '[ISO-2] a re-sign-in made a second copy').toEqual([detail.scenarioId])
      ev.iso2 = { guestId, copy: detail.scenarioId, owned: owned.length }
      mark('done')
    } finally {
      writeEvidence('ISO-2.json', ev)
      await ctx.close()
    }
  })
})
