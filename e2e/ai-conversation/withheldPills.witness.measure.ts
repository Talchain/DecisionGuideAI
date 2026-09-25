/**
 * 14 — WITHHELD LEADER: NO WIN-SHARE RANKING ON THE CHAT RESULT CARD.
 * Bank `ef03d078` (`ai-conversation/withheld-leader-no-win-ranking`) vs its base,
 * staging `b017e3c2`. The SAME script on TWO trees:
 *
 *   fix     = the bank worktree at `ef03d078` (this file copied in, untracked)
 *   staging = a detached worktree of `origin/staging` at `b017e3c2` (control)
 *
 *   WITNESS_TREE=fix|staging GEOMETRY_PORT=<port> WITNESS_OUT_DIR=<dir> \
 *     VITE_SUPABASE_URL=http://localhost VITE_SUPABASE_ANON_KEY=test \
 *     PW_CHROMIUM_PATH=/opt/pw-browsers/chromium \
 *     pnpm exec playwright test -c playwright.aiconversation.config.ts withheldPills
 *
 * THE JOURNEY (whole app on `/#/canvas?ai=openai`, the docked Olumi tab with
 * the app's own ConversationPanel + useConversation; each turn is the composer
 * → callV5Turn → fetch the user would cause). The canvas starts EMPTY, as a user
 * starts, so C1's `draft_graph` is applied by the product's own draft path:
 *   C1: the brief, typed. Answered with the fixture's "C1 brief" body.
 *   C2: the Run, typed ("The served C2 was the typed Run", per the fixture's
 *       acceptance spec). Answered with the fixture's "C2 run" body: an
 *       `analysis_result` with `leading_option_id: null`, `win_probabilities`
 *       present, `analysis_state.leader_claim.permitted: false`
 *       (`constraint_verdict_withheld`).
 * Then the C2 result card is read (DOM facts) and photographed (element + dock).
 *
 * THE BYTES: `src/canvas/conversation/__tests__/fixtures/openai-route-coaching-
 * journey.e39f6e0.json` (in BOTH trees, identical; sha256 recorded). Real served
 * OpenAI-route bodies; each `turns[i].json` is served as `JSON.stringify` of the
 * parsed body (the fixture itself is re-serialised, UUIDs redacted — see its
 * `__provenance`). The typed user messages are the harness's.
 *
 * ⛔ NO MODEL CALLS, NO STAGING CALLS. Every `/proxy/v5/turn` POST is fulfilled
 * here from the fixture, in order; `/bff/cee/graph-readiness` gets a harness
 * READY verdict; the streamed sibling `/proxy/v5/turn/stream` (same origin) is
 * aborted, so every turn takes the buffered path; every other `/bff` / `/api`
 * call gets the hermetic 503; every
 * non-localhost request is ABORTED and counted. Each test asserts 0 completed
 * off-origin requests. The one deliberate off-origin attempt is a guard proof to
 * `https://guard-proof.invalid/` (a reserved, unresolvable TLD) — it must show up
 * as attempted AND aborted, which proves the counter can see what it counts.
 *
 * TREE SELF-CHECK: the spec asks the dev server for the card's source and
 * reads whether it contains the fix's `winShareRankingWithheld`, and reads
 * `git rev-parse HEAD` of the checkout it runs from. It REFUSES TO MEASURE if
 * either answer differs from `WITNESS_TREE`.
 *
 * Page setup is `preparePage` line for line (via `prepareOnce` from 13), except
 * the storage clear is once per test; no reload happens here, so that
 * difference is inert.
 */
import { test, expect, type Page } from '@playwright/test'
import { createHash } from 'node:crypto'
import { execSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { FROZEN_TIME, clearNotifications, freezeMotion } from '../visual/harness'
import { posturePins } from '../visual/flagPosture'
import { repoRoot } from '../visual/repoRoot'

const TREE = process.env.WITNESS_TREE
if (TREE !== 'fix' && TREE !== 'staging') throw new Error('[14] set WITNESS_TREE=fix|staging')

const EXPECTED_HEAD: Record<'fix' | 'staging', string> = {
  fix: 'ef03d0786e51e911cb699fed1f52f8aae8b5f3dd',
  staging: 'b017e3c2',
}
/** Present in the fix's V5AnalysisResultBlock.tsx, absent from staging's. */
const FIX_MARKER = 'winShareRankingWithheld'

const FIXTURE_REL = 'src/canvas/conversation/__tests__/fixtures/openai-route-coaching-journey.e39f6e0.json'
const FIXTURE_RAW = readFileSync(join(repoRoot(), FIXTURE_REL))
const FIXTURE_SHA256 = createHash('sha256').update(FIXTURE_RAW).digest('hex')
type Wire = Record<string, any>
const FIXTURE = JSON.parse(FIXTURE_RAW.toString('utf8')) as { __provenance: Record<string, unknown>; turns: Array<{ turn: string; at: string; http: number; json: Wire }> }
const turnJson = (label: string): Wire => {
  const t = FIXTURE.turns.find((x) => x.turn === label)
  if (!t) throw new Error(`[14] fixture has no turn "${label}"`)
  return t.json
}
const C1 = turnJson('C1 brief')
const C2 = turnJson('C2 run')
const C1_BYTES = JSON.stringify(C1)
const C2_BYTES = JSON.stringify(C2)
const sha = (s: string) => createHash('sha256').update(s, 'utf8').digest('hex')
const C2_RESULT = (C2.blocks as Wire[]).find((b) => b.type === 'analysis_result') as Wire
const C2_CARD_ID = String(((C2.blocks as Wire[]).find((b) => b.type === 'coaching') as Wire).block_id)
const C1_CARD_ID = String(((C1.blocks as Wire[]).find((b) => b.type === 'coaching') as Wire).block_id)

/** Harness text. The C1 brief is the one the fixture's own acceptance spec types. */
const BRIEF = 'We sell a Pro plan at £49/month. Should we raise it to £59 with the next feature release?'
const RUN_MESSAGE = 'Run the analysis'
const C2_FIRST_WORDS = 'The analysis cannot put forward a pricing option'

/** Harness READY verdict (same as `runChipGateFixtures.READINESS_READY`, inlined). */
const READINESS_READY: Record<string, unknown> = {
  readiness_score: 90, readiness_level: 'ready', confidence_level: 'high', confidence_explanation: 'ready',
  can_run_analysis: true, improvements: [], options_ready: 3, options_total: 3, goal_node_valid: true, readiness_issues: [],
}

const GUARD_PROOF_URL = 'https://guard-proof.invalid/witness-14'
const isLocalHost = (h: string) => h === 'localhost' || h === '127.0.0.1' || h === '[::1]'
const TOLERATED_ABORTED = (host: string) => host === 'fonts.googleapis.com' || host === 'fonts.gstatic.com' || host.endsWith('.invalid')

// ── Page setup (from 13: `preparePage`, storage clear once per test) ──

const PREPARED_MARKER = '__witness14_prepared_once'

async function installHermeticNetwork(page: Page): Promise<void> {
  // Verbatim from e2e/visual/harness.ts (not exported there).
  await page.route('**/bff/**', (route) => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'visreg_hermetic', detail: 'backend intentionally offline' }) }))
  await page.route('**/api/**', (route) => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'visreg_hermetic', detail: 'backend intentionally offline' }) }))
  await page.route('**/*', (route) => {
    const url = new URL(route.request().url())
    const local = url.hostname === 'localhost' || url.hostname === '127.0.0.1'
    return local ? route.fallback() : route.abort()
  })
}

async function prepareOnce(page: Page, viewport: { width: number; height: number }): Promise<void> {
  const pins = posturePins()
  await page.addInitScript(
    ({ flagPins, marker }: { flagPins: Array<{ storageKey: string; value: string }>; marker: string }) => {
      try {
        if (localStorage.getItem(marker) === '1') return
        localStorage.clear()
        sessionStorage.clear()
        for (const p of flagPins) localStorage.setItem(p.storageKey, p.value)
        localStorage.setItem('olumi_keys_seen', '1')
        localStorage.setItem('olumi-canvas-onboarding-dismissed', '1')
        localStorage.setItem('canvas-empty-state-dismissed', '1')
        localStorage.setItem(marker, '1')
      } catch {
        /* storage unavailable — the visible-anchor assertions will catch it */
      }
    },
    { flagPins: pins.map((p) => ({ storageKey: p.storageKey, value: p.value })), marker: PREPARED_MARKER },
  )
  await page.setViewportSize(viewport)
  await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: 'light' })
  await page.clock.setFixedTime(FROZEN_TIME)
  await installHermeticNetwork(page)
}

async function waitForCanvas(page: Page): Promise<void> {
  await expect(page.locator('.react-flow')).toBeVisible({ timeout: 30_000 })
  await page.waitForFunction(
    () => typeof (window as unknown as { useCanvasStore?: { getState?: () => unknown } }).useCanvasStore?.getState === 'function',
    undefined,
    { timeout: 30_000 },
  )
  await page.evaluate(() => document.fonts?.ready)
  await freezeMotion(page)
}

// ── Network ──

type TurnKind = 'C1 brief' | 'C2 run' | 'unexpected'
interface TurnRecord { seq: number; answeredWith: TurnKind; message: unknown; chip: unknown; kind: unknown; aiModeHeader: string | null; servedSha256: string | null }
interface NetLog {
  total: number
  nonLocal: string[]
  aborted: string[]
  nonLocalCompleted: string[]
  turns: TurnRecord[]
  turnSubpaths: string[]
  readinessServed: number
  backendAnswers: string[]
  websockets: string[]
  pending: Array<Promise<void>>
}

async function installWitnessNetwork(page: Page): Promise<NetLog> {
  const log: NetLog = { total: 0, nonLocal: [], aborted: [], nonLocalCompleted: [], turns: [], turnSubpaths: [], readinessServed: 0, backendAnswers: [], websockets: [], pending: [] }
  page.on('request', (req) => {
    log.total++
    const u = new URL(req.url())
    if (u.protocol !== 'data:' && u.protocol !== 'blob:' && !isLocalHost(u.hostname)) log.nonLocal.push(req.url())
  })
  page.on('response', (res) => {
    const u = new URL(res.url())
    if (u.protocol !== 'data:' && u.protocol !== 'blob:' && !isLocalHost(u.hostname)) log.nonLocalCompleted.push(res.url())
    const fixtureServed = u.pathname === '/proxy/v5/turn' || u.pathname === '/bff/cee/graph-readiness'
    if (/^\/(bff|api|proxy)\//.test(u.pathname) && !fixtureServed) {
      const tag = `${res.status()} ${res.request().method()} ${u.pathname}`
      log.pending.push(res.text()
        .then((b) => { log.backendAnswers.push(`${tag} ${b.includes('visreg_hermetic') ? 'hermetic' : 'NOT-HERMETIC'}`) })
        .catch(() => { log.backendAnswers.push(`${tag} body-unreadable`) }))
    }
  })
  page.on('websocket', (ws) => log.websockets.push(ws.url()))
  await page.route('**/*', async (route) => {
    const req = route.request()
    const u = new URL(req.url())
    if (!isLocalHost(u.hostname)) {
      log.aborted.push(req.url())
      return route.abort('blockedbyclient')
    }
    if (u.pathname === '/proxy/v5/turn') {
      let body: Record<string, unknown> | null = null
      try { body = JSON.parse(req.postData() ?? 'null') as Record<string, unknown> } catch { body = null }
      // In order: the first turn is C1, the second is C2. Anything more is unexpected.
      const kind: TurnKind = log.turns.length === 0 ? 'C1 brief' : log.turns.length === 1 ? 'C2 run' : 'unexpected'
      const bytes = kind === 'C1 brief' ? C1_BYTES : kind === 'C2 run' ? C2_BYTES : null
      log.turns.push({ seq: log.turns.length + 1, answeredWith: kind, message: body?.message, chip: body?.chip ?? null, kind: body?.kind ?? null, aiModeHeader: req.headers()['x-olumi-ai-mode'] ?? null, servedSha256: bytes ? sha(bytes) : null })
      if (bytes) return route.fulfill({ status: 200, contentType: 'application/json', body: bytes })
      return route.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"witness: no fixture for this turn"}' })
    }
    if (u.pathname.startsWith('/proxy/v5/turn/')) {
      log.turnSubpaths.push(`${req.method()} ${u.pathname}`)
      return route.abort('blockedbyclient')
    }
    if (u.pathname === '/bff/cee/graph-readiness') {
      log.readinessServed++
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(READINESS_READY) })
    }
    return route.fallback()
  })
  return log
}

function assertNoModelCalls(net: NetLog): void {
  expect(net.nonLocalCompleted, 'no off-origin request may get a response').toEqual([])
  expect([...net.aborted].sort()).toEqual([...net.nonLocal].sort())
  expect(net.nonLocal.filter((u) => !TOLERATED_ABORTED(new URL(u).hostname)), 'only the webfont and the .invalid guard proof may even be attempted off-origin').toEqual([])
  // The first-use draft tries the streamed sibling first. It is same-origin and ABORTED here,
  // so the product takes its buffered path (as the fixture's own acceptance spec models it).
  expect(net.turnSubpaths.filter((p) => p !== 'POST /proxy/v5/turn/stream'), 'no other turn sub-endpoint was touched').toEqual([])
  expect(net.turns.filter((t) => t.answeredWith === 'unexpected'), 'every turn was answered by a fixture').toEqual([])
  expect(net.backendAnswers.filter((a) => !a.endsWith(' hermetic')), 'every other backend call answered in-page').toEqual([])
  expect(net.websockets.filter((w) => !isLocalHost(new URL(w).hostname)), 'no off-origin websocket').toEqual([])
}

function outPath(name: string): string {
  const dir = process.env.WITNESS_OUT_DIR ?? join(repoRoot(), 'e2e', 'ai-conversation', 'evidence')
  mkdirSync(dir, { recursive: true })
  return join(dir, name)
}

// ── Reading the page ──

async function servingTree(page: Page): Promise<{ tree: 'fix' | 'staging'; sourceBytes: number }> {
  return page.evaluate(async (marker) => {
    const res = await fetch('/src/v5/blocks/V5AnalysisResultBlock.tsx')
    const src = await res.text()
    return { tree: src.includes(marker) ? ('fix' as const) : ('staging' as const), sourceBytes: src.length }
  }, FIX_MARKER)
}

/** Every analysis-result card, and which assistant message it sits in. */
async function readCards(page: Page) {
  return page.evaluate(async ({ c1CardId, c2CardId }) => {
    const pct = (s: string) => s.match(/(?:<\s?)?\d{1,3}(?:\.\d+)?\s?%/g) ?? []
    const assistants = [...document.querySelectorAll('[data-testid="chat-message-assistant"]')]
    const turnOf = (el: Element) => {
      const msg = el.closest('[data-testid="chat-message-assistant"]')
      if (!msg) return 'not-in-an-assistant-message'
      if (msg.querySelector(`[data-block-id="${c2CardId}"]`)) return 'C2 run'
      if (msg.querySelector(`[data-block-id="${c1CardId}"]`)) return 'C1 brief'
      return `assistant#${assistants.indexOf(msg)}`
    }
    const cards = [...document.querySelectorAll('[data-testid="v5-analysis-result"]')].map((card, index) => {
      const el = card as HTMLElement
      const probs = el.querySelector('[data-testid="v5-analysis-result-probabilities"]') as HTMLElement | null
      const summary = el.querySelector('[data-testid="v5-analysis-result-summary"]') as HTMLElement | null
      const uncertainty = el.querySelector('[data-testid="v5-analysis-result-uncertainty-copy"]') as HTMLElement | null
      const r = el.getBoundingClientRect()
      const innerText = el.innerText
      return {
        index,
        turn: turnOf(el),
        attrs: {
          'data-has-decision-review': el.getAttribute('data-has-decision-review'),
          'data-decision-review-state': el.getAttribute('data-decision-review-state'),
        },
        box: { x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height) },
        heading: (el.querySelector('[data-testid="v5-analysis-result-heading"]') as HTMLElement | null)?.innerText ?? null,
        summary: summary ? { present: true, visible: summary.offsetParent !== null, text: summary.innerText } : { present: false },
        uncertaintyCopy: uncertainty ? uncertainty.innerText : null,
        probabilities: probs
          ? {
              present: true,
              visible: probs.offsetParent !== null,
              text: probs.innerText,
              ariaLabel: probs.getAttribute('aria-label'),
              pills: [...probs.querySelectorAll('[role="listitem"]')].map((p) => ({ text: (p as HTMLElement).innerText.replace(/\s+/g, ' ').trim(), dataLeader: p.getAttribute('data-leader') })),
            }
          : { present: false },
        /** "NN%" strings in the card's RENDERED text (innerText: closed <details> and display:none excluded). */
        visiblePercentStrings: pct(innerText),
        /** Same, over textContent (includes anything hidden) — for completeness. */
        percentStringsInDomText: pct(el.textContent ?? ''),
        /** The card's structure: every descendant testid, in document order. */
        testIds: [...el.querySelectorAll('[data-testid]')].map((n) => n.getAttribute('data-testid')),
        innerText,
      }
    })
    /** The rest of the C2 reply: its assistant message with the result card removed from a CLONE
     *  (the live DOM is not touched, so nothing can move before the shutter). textContent, whitespace-collapsed. */
    const c2Msg = assistants.find((m) => m.querySelector(`[data-block-id="${c2CardId}"]`)) as HTMLElement | undefined
    let c2ReplyOutsideCard: { text: string; testIds: Array<string | null> } | null = null
    if (c2Msg) {
      const clone = c2Msg.cloneNode(true) as HTMLElement
      clone.querySelectorAll('[data-testid="v5-analysis-result"]').forEach((n) => n.remove())
      c2ReplyOutsideCard = {
        text: (clone.textContent ?? '').replace(/\s+/g, ' ').trim(),
        testIds: [...clone.querySelectorAll('[data-testid]')].map((n) => n.getAttribute('data-testid')),
      }
    }
    const storePath = '/src/canvas/store.ts'
    const mod = (await import(/* @vite-ignore */ storePath)) as { useCanvasStore: { getState: () => Record<string, any> } }
    const s = mod.useCanvasStore.getState()
    return {
      cardCount: cards.length,
      cards,
      c2ReplyOutsideCard,
      assistantMessages: assistants.length,
      userMessages: document.querySelectorAll('[data-testid="chat-message-user"]').length,
      activeDockTab: document.querySelector('[data-testid^="outputs-dock-tab-"][aria-selected="true"]')?.getAttribute('data-testid') ?? null,
      aiModeLabel: [...document.querySelectorAll('*')].find((e) => e.childElementCount === 0 && /^AI:\s*OpenAI$/.test(e.textContent?.trim() ?? ''))?.textContent?.trim() ?? null,
      store: {
        nodeCount: Array.isArray(s.nodes) ? s.nodes.length : null,
        runStateKind: s.analysisStateV1?.run_state?.kind ?? null,
        computedAt: s.analysisStateV1?.run_state?.computed_at ?? null,
        leaderClaim: s.analysisStateV1?.leader_claim ?? null,
        resultsStatus: s.results?.status ?? null,
        producerLeaderPermission: s.results?.report?.producer_leader_permission ?? null,
        currentGraphHash: s.analysisFreshness?.currentGraphHash ?? null,
        analysisFreshnessDirty: s.analysisFreshnessDirty ?? null,
      },
    }
  }, { c1CardId: C1_CARD_ID, c2CardId: C2_CARD_ID })
}

const settle = (page: Page) => page.waitForTimeout(1_500)
const VIEWPORTS = [
  { width: 1280, height: 800 },
  { width: 1440, height: 900 },
] as const

test('14 — the fixture is the e39f6e0 served journey; C2 withholds the leader and carries win shares', () => {
  expect(C2_RESULT.leading_option_id).toBeNull()
  expect(Object.keys(C2_RESULT.win_probabilities ?? {}).length).toBe(3)
  expect(C2.analysis_state.leader_claim).toMatchObject({ permitted: false, withheld_reason: 'constraint_verdict_withheld' })
  expect(C1_CARD_ID).not.toBe(C2_CARD_ID)
  expect(String(FIXTURE.__provenance.served_build)).toMatch(/^e39f6e0/)
})

for (const vp of VIEWPORTS) {
  const tag = `${vp.width}x${vp.height}`
  const base = `14-withheld-pills-${TREE}-${tag}`

  test(`14 — withheld leader, chat result card, on ${TREE} @ ${tag}`, async ({ page }) => {
    const head = execSync('git rev-parse HEAD', { cwd: repoRoot() }).toString().trim()
    expect(head.startsWith(EXPECTED_HEAD[TREE]), `this checkout's HEAD (${head}) must be the ${TREE} tree`).toBe(true)

    await prepareOnce(page, vp)
    const net = await installWitnessNetwork(page)
    await page.goto('/#/canvas?ai=openai', { waitUntil: 'domcontentloaded' })
    await waitForCanvas(page)
    const served = await servingTree(page)
    expect(served.tree, 'the dev server on this port must be serving the tree this run claims').toBe(TREE)

    // Guard proof: an off-origin attempt to a reserved .invalid host is seen AND aborted.
    const guardProof = await page.evaluate(async (url) => {
      try { const r = await fetch(url, { mode: 'no-cors' }); return `completed (${r.type})` } catch (e) { return `rejected: ${(e as Error).message}` }
    }, GUARD_PROOF_URL)

    await clearNotifications(page)

    // ── C1: the brief, typed into the first-use composer an empty canvas opens with ──
    const hero = page.getByTestId('first-use-composer')
    await expect(hero, 'an empty canvas opens the first-use composer').toBeVisible()
    const heroBox = hero.getByRole('textbox', { name: 'Describe your decision or challenge' })
    await heroBox.fill(BRIEF)
    await heroBox.press('Enter')
    await expect(page.locator(`[data-block-id="${C1_CARD_ID}"]`)).toHaveCount(1, { timeout: 30_000 })
    await settle(page)
    await clearNotifications(page)
    const olumiTab = page.getByTestId('outputs-dock-tab-olumi')
    const olumiTabSelectedAfterC1 = await olumiTab.getAttribute('aria-selected')
    if (olumiTabSelectedAfterC1 !== 'true') await olumiTab.click()
    await settle(page)
    const afterC1 = await readCards(page)

    // ── C2: the Run, typed into the Olumi tab's composer ──
    const composer = page.getByTestId('ai-input-bar-strip-textarea')
    await expect(composer).toBeVisible()
    await expect(composer).toBeEnabled({ timeout: 30_000 })
    await composer.fill(RUN_MESSAGE)
    await composer.press('Enter')
    await expect(page.locator(`[data-block-id="${C2_CARD_ID}"]`)).toHaveCount(1, { timeout: 30_000 })
    await expect(page.getByText(C2_FIRST_WORDS, { exact: false }).first()).toBeVisible()
    await settle(page)
    await clearNotifications(page)
    const onArrival = await readCards(page)

    // The C2 card: the one inside the assistant message that carries C2's coaching block.
    const c2Card = page.locator('[data-testid="chat-message-assistant"]', { has: page.locator(`[data-block-id="${C2_CARD_ID}"]`) })
      .locator('[data-testid="v5-analysis-result"]')
    await expect(c2Card, 'the C2 reply renders exactly one analysis-result card').toHaveCount(1)
    await c2Card.scrollIntoViewIfNeeded()
    await settle(page)
    const facts = await readCards(page)
    await c2Card.screenshot({ path: outPath(`${base}.png`) })
    await page.getByTestId('outputs-dock').screenshot({ path: outPath(`${base}-panel.png`) })

    await Promise.all(net.pending)
    const c2 = facts.cards.find((c) => c.turn === 'C2 run') ?? null
    const summary = {
      section: 14,
      tree: TREE,
      viewport: tag,
      checkout: { head, servedCardSource: served },
      fixture: { path: FIXTURE_REL, sha256: FIXTURE_SHA256, provenance: FIXTURE.__provenance.served_build, c1Sha256: sha(C1_BYTES), c2Sha256: sha(C2_BYTES) },
      c2Wire: {
        leading_option_id: C2_RESULT.leading_option_id,
        win_probabilities: C2_RESULT.win_probabilities,
        leader_claim: C2.analysis_state.leader_claim,
      },
      /** THE ANSWERS, for the C2 (Run) card. */
      c2Card: c2 && {
        exists: true,
        probabilitiesRowExists: c2.probabilities.present,
        probabilitiesRowText: c2.probabilities.present ? (c2.probabilities as { text: string }).text : null,
        probabilitiesPills: c2.probabilities.present ? (c2.probabilities as { pills: unknown[] }).pills : null,
        summaryRenders: c2.summary.present && (c2.summary as { visible: boolean }).visible,
        visiblePercentStrings: c2.visiblePercentStrings,
      },
      olumiTabSelectedAfterC1,
      afterC1,
      onArrival,
      final: facts,
      guardProof,
      network: {
        offOriginAttempted: net.nonLocal,
        offOriginAborted: net.aborted,
        offOriginCompleted: net.nonLocalCompleted.length,
        turns: net.turns,
        turnSubpathsAborted: net.turnSubpaths,
        readinessServed: net.readinessServed,
        backendAnswers: net.backendAnswers,
        totalRequests: net.total,
      },
    }
    writeFileSync(outPath(`${base}.json`), JSON.stringify(summary, null, 2) + '\n')
    console.log(`AICWITNESS withheld-14 ${TREE} ${tag} ${JSON.stringify(summary.c2Card)} offOriginCompleted=${net.nonLocalCompleted.length}`)

    // Harness invariants only. The PRODUCT facts are recorded, not asserted —
    // the control tree is expected to differ.
    expect(net.turns.map((t) => t.answeredWith)).toEqual(['C1 brief', 'C2 run'])
    expect(net.turns.every((t) => t.aiModeHeader === 'openai'), 'every turn went out on the ?ai=openai route').toBe(true)
    expect(facts.aiModeLabel).toBe('AI: OpenAI')
    expect(net.nonLocal, 'the guard proof was attempted').toContain(GUARD_PROOF_URL)
    expect(net.aborted, 'the guard proof was aborted').toContain(GUARD_PROOF_URL)
    expect(guardProof.startsWith('rejected'), `the guard proof must not complete (${guardProof})`).toBe(true)
    assertNoModelCalls(net)
  })
}
