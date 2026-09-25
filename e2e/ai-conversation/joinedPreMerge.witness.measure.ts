/**
 * 13 — JOINED PRE-MERGE witness: #1968 (run-turn coaching currency) + #1981
 * (reply start in view) + #1985 (G1, a taken card action stays settled across a
 * reload), measured on ONE journey, on TWO trees:
 *
 *   combined = origin/staging 64a3b385 + the three PR branches merged (scratch tree)
 *   staging  = origin/staging 64a3b385 alone (control)
 *
 *   WITNESS_TREE=combined|staging GEOMETRY_PORT=5301 WITNESS_OUT_DIR=<dir> \
 *     PW_CHROMIUM_PATH=/opt/pw-browsers/chromium \
 *     pnpm exec playwright test -c playwright.aiconversation.config.ts joinedPreMerge
 *
 * The journey (whole app, `/#/canvas?ai=openai`, docked Olumi tab, the app's own
 * ConversationPanel + useConversation; every turn is the chip/composer → callV5Turn
 * → fetch the user would cause):
 *   1. Run #1: the Run chip; the turn is answered with the c673223 route body,
 *      byte for byte. Read on arrival: is the reply's first sentence in view?
 *   2. Run #2 on the SAME model: the Olumi tab's own post-run control, "Re-run
 *      analysis" (`ai-input-bar-strip-analyse` → the canonical runner → a
 *      `run_analysis` chip turn). The suggested Run chip cannot be used: the
 *      product suppresses it while the analysis is confirmed current. The turn
 *      is answered with the c673223 body with its RUN IDENTITY moved on
 *      (run_state.computed_at, analysis_ready.computed_at, the card's
 *      created_at / signal_id / block_id). Read card #1.
 *   3. Card #2's action chip, clicked once; answered with a short harness reply.
 *   4. A real `page.reload()`. The transcript restores from localStorage. Read
 *      card #2's chip; click it; count the turns that click sent.
 *   4b. ISOLATING G1 FROM #1968. After a reload the store holds no
 *      `analysis_state` (it is turn-scoped and not persisted), so on a tree with
 *      #1968 every run-turn card is inert ("earlier analysis") and a disabled
 *      chip there cannot, on its own, be credited to G1. So: a second real
 *      reload, then ONE typed turn whose harness reply restates run #2's verdict
 *      (its `analysis_state` / `analysis_ready` / `graph_hash`, verbatim) — as
 *      CEE does on every turn — which makes card #2 current again. Now the only
 *      thing that can hold its chip is the transcript. Read it; click it; count.
 *
 * ⛔ NO MODEL CALLS. Every `/proxy/v5/turn` and `/bff/cee/graph-readiness` POST
 * is fulfilled here; every other `/bff` / `/api` call gets the harness's
 * hermetic 503; every non-localhost request is ABORTED and counted. The only
 * off-origin attempt tolerated is the Google Fonts stylesheet (aborted). Each
 * test asserts 0 completed off-origin requests.
 *
 * ⚠ ONE DEPARTURE FROM `preparePage`, and why: `preparePage` clears
 * localStorage in an init script that runs on EVERY navigation, a reload
 * included — which would wipe the saved transcript and make step 4 measure
 * nothing. `prepareOnce` below is `preparePage` line for line, except that the
 * clear runs only on the test's FIRST navigation (a marker key survives the
 * reload, as the rest of localStorage does in a real browser).
 *
 * ⚠ WHAT IS THE PRODUCER'S AND WHAT IS THE HARNESS'S:
 *   - Run #1 body: CEE c673223 route body (scripted model), verbatim.
 *   - Run #2 body: the SAME bytes with only the run-identity fields moved to
 *     `LATER_RUN_AT` and a new block_id (harness-made, UUID-shaped). Its prose,
 *     result card and coaching card are otherwise identical — a later run of the
 *     same model that reached the same finding.
 *   - The opening reply, the card-action reply and the readiness verdict are
 *     the harness's; their text says so in brackets.
 */
import { test, expect, type Page } from '@playwright/test'
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { FROZEN_TIME, clearNotifications, freezeMotion, seedStarterDraft } from '../visual/harness'
import { posturePins } from '../visual/flagPosture'
import { repoRoot } from '../visual/repoRoot'
import { OPENING_MESSAGE, READINESS_READY, RUN_CHIP, STARTER, TURN_TEXT, turnReply } from './runChipGateFixtures'

const TREE = process.env.WITNESS_TREE
if (TREE !== 'combined' && TREE !== 'staging') throw new Error('[13] set WITNESS_TREE=combined|staging')

const FIXTURE_PATH = join(repoRoot(), 'e2e', 'ai-conversation', 'fixtures', 'served-route-c673223-explicit-run.json')
const fixture = JSON.parse(readFileSync(FIXTURE_PATH, 'utf8')) as Record<string, unknown>
const { _provenance: PROVENANCE, ...ROUTE_BODY } = fixture as { _provenance: { route_body_sha256: string } } & Record<string, unknown>
const RUN1_BYTES = JSON.stringify(ROUTE_BODY)

type Card = { type: string; block_id: string; signal_id: string; title: string; body: string; action_label: string; action_prompt: string; created_at: string; graph_hash_at_generation: string }
const CARD1 = (ROUTE_BODY.blocks as Card[]).find((b) => b.type === 'coaching') as Card

/** The later run: same instant the #1968 witness (06) and its unit spec use. */
const LATER_RUN_AT = '2026-09-24T17:02:11.004Z'
/** Harness-made, UUID-shaped (the schema requires a UUID). */
const CARD2_BLOCK_ID = 'a13b0002-0000-4000-8000-000000000002'

function laterRunBody(): Record<string, unknown> {
  const b = JSON.parse(RUN1_BYTES) as Record<string, any>
  b.analysis_state.run_state.computed_at = LATER_RUN_AT
  b.analysis_ready.computed_at = LATER_RUN_AT
  for (const blk of b.blocks as Array<Record<string, any>>) {
    if (blk.type !== 'coaching') continue
    blk.created_at = LATER_RUN_AT
    blk.block_id = CARD2_BLOCK_ID
    blk.signal_id = String(blk.signal_id).replace(CARD1.created_at, LATER_RUN_AT)
  }
  return b
}
const RUN2_BODY = laterRunBody()
const RUN2_BYTES = JSON.stringify(RUN2_BODY)
const CARD2 = (RUN2_BODY.blocks as Card[]).find((b) => b.type === 'coaching') as Card

const ACTION_REPLY_TEXT = '[Witness fixture, not CEE output] Card action received. This fixture carries no analysis payload.'
const RESTATE_MESSAGE = 'Is the latest run still current?'
const RESTATE_TEXT = '[Witness fixture, not CEE output] Verdict restated: this turn carries run #2’s analysis_state and analysis_ready verbatim, and no blocks.'
const FIRST_SENTENCE_START = 'This run can’t yet say which pricing path to take'

const isLocalHost = (h: string) => h === 'localhost' || h === '127.0.0.1' || h === '[::1]'
const TOLERATED_ABORTED_HOSTS = new Set(['fonts.googleapis.com', 'fonts.gstatic.com'])

// ── Page setup: `preparePage`, except the storage clear runs once per test ──

const PREPARED_MARKER = '__witness13_prepared_once'

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
        if (localStorage.getItem(marker) === '1') return // a reload: leave what the page saved
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

/** `openCanvas`, on the OpenAI comparison route (`?ai=openai`). */
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

type TurnKind = 'opening' | 'run1' | 'run2' | 'card_action' | 'restate' | 'unexpected'
type Phase = 'before-reload' | 'after-reload' | 'after-second-reload'
interface TurnRecord { seq: number; phase: Phase; answeredWith: TurnKind; message: unknown; chip: unknown; aiModeHeader: string | null }
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
  phase: Phase
}

async function installWitnessNetwork(page: Page): Promise<NetLog> {
  const log: NetLog = { total: 0, nonLocal: [], aborted: [], nonLocalCompleted: [], turns: [], turnSubpaths: [], readinessServed: 0, backendAnswers: [], websockets: [], pending: [], phase: 'before-reload' }
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
      const chip = (body?.chip ?? null) as { action_type?: unknown } | null
      const runsSoFar = log.turns.filter((t) => t.answeredWith === 'run1' || t.answeredWith === 'run2').length
      let kind: TurnKind = 'unexpected'
      if (chip?.action_type === 'run_analysis') kind = runsSoFar === 0 ? 'run1' : runsSoFar === 1 ? 'run2' : 'unexpected'
      else if (body?.message === CARD1.action_prompt) kind = 'card_action'
      else if (body?.message === OPENING_MESSAGE) kind = 'opening'
      else if (body?.message === RESTATE_MESSAGE) kind = 'restate'
      log.turns.push({ seq: log.turns.length + 1, phase: log.phase, answeredWith: kind, message: body?.message, chip: body?.chip ?? null, aiModeHeader: req.headers()['x-olumi-ai-mode'] ?? null })
      const json = (o: unknown) => route.fulfill({ status: 200, contentType: 'application/json', body: typeof o === 'string' ? o : JSON.stringify(o) })
      if (kind === 'run1') return json(RUN1_BYTES)
      if (kind === 'run2') return json(RUN2_BYTES)
      if (kind === 'opening') return json(turnReply('opening'))
      if (kind === 'card_action') return json({ response_version: 2, assistant_text: ACTION_REPLY_TEXT, blocks: [], suggested_actions: [], insights: [], stage_indicator: 'frame' })
      if (kind === 'restate') {
        return json({ response_version: 2, assistant_text: RESTATE_TEXT, blocks: [], suggested_actions: [], insights: [], stage_indicator: 'frame',
          graph_hash: RUN2_BODY.graph_hash, analysis_ready: RUN2_BODY.analysis_ready, analysis_state: RUN2_BODY.analysis_state })
      }
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
  expect(net.nonLocal.filter((u) => !TOLERATED_ABORTED_HOSTS.has(new URL(u).hostname)), 'only the webfont may even be attempted off-origin').toEqual([])
  expect(net.turnSubpaths, 'no streamed / stop turn endpoint was touched').toEqual([])
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

/** DOM + store facts, read once. Card ids are passed so each card is read by identity. */
async function read(page: Page) {
  return page.evaluate(async ({ ids, firstStart }) => {
    const thread = document.querySelector('[data-testid="chat-thread"]') as HTMLElement | null
    const scroller = (() => {
      let n: HTMLElement | null = thread
      while (n && !(n.scrollHeight > n.clientHeight + 1 && /(auto|scroll)/.test(getComputedStyle(n).overflowY))) n = n.parentElement
      return n
    })()
    const box = scroller?.getBoundingClientRect() ?? null
    const assistants = [...document.querySelectorAll('[data-testid="chat-message-assistant"]')]
    const replyFacts = (blockId: string) => {
      const msg = assistants.find((a) => a.querySelector(`[data-block-id="${blockId}"]`)) as HTMLElement | undefined
      if (!msg || !box) return { present: Boolean(msg) }
      const r = msg.getBoundingClientRect()
      const bodyEl = msg.querySelector('[data-testid="message-body-text"]')
      let firstLine: { top: number; bottom: number } | null = null
      let firstSentenceInView: boolean | null = null
      if (bodyEl) {
        const walker = document.createTreeWalker(bodyEl, NodeFilter.SHOW_TEXT)
        for (let n = walker.nextNode(); n; n = walker.nextNode()) {
          const t = n as Text
          const i = t.data.indexOf(firstStart.slice(0, 20))
          if (i < 0) continue
          const range = document.createRange()
          range.setStart(t, i)
          range.setEnd(t, Math.min(t.data.length, i + 20))
          const rect = [...range.getClientRects()].find((x) => x.width > 0)
          if (rect) {
            firstLine = { top: Math.round(rect.top - box.top), bottom: Math.round(rect.bottom - box.top) }
            firstSentenceInView = rect.top >= box.top - 0.5 && rect.bottom <= box.bottom + 0.5
          }
          break
        }
      }
      return {
        present: true,
        messageId: msg.getAttribute('data-message-id'),
        /** px from the scroller's visible top to the reply's top (negative = above the fold). */
        replyTopMinusScrollerTop: Math.round(r.top - box.top),
        replyTopInsideBand: r.top >= box.top - 0.5 && r.top <= box.bottom,
        firstSentenceLineFromScrollerTop: firstLine,
        firstSentenceInView,
      }
    }
    const cardFacts = (blockId: string) => {
      const line = document.querySelector(`[data-testid="coaching-line-${blockId}"]`) as HTMLDetailsElement | null
      const card = document.querySelector(`[data-block-id="${blockId}"]`) as HTMLElement | null
      const action = card?.querySelector('[data-testid="v5-coaching-action"]') as HTMLButtonElement | null
      const notice = card?.querySelector('[data-testid="v5-coaching-freshness"]') as HTMLElement | null
      return {
        linePresent: Boolean(line),
        lineOpen: line ? line.open : null,
        lineSummary: line?.querySelector('summary')?.textContent?.trim() ?? null,
        cardPresent: Boolean(card),
        currency: card?.getAttribute('data-currency') ?? null,
        runTurnReason: card?.getAttribute('data-run-turn-reason') ?? null,
        notice: notice?.textContent ?? null,
        noticeId: notice?.id || null,
        chip: action
          ? {
              text: action.textContent,
              disabled: action.disabled,
              dataSettled: action.getAttribute('data-settled'),
              dataInert: action.getAttribute('data-inert'),
              ariaDescribedBy: action.getAttribute('aria-describedby'),
            }
          : null,
      }
    }
    const tab = document.querySelector('[data-testid^="outputs-dock-tab-"][aria-selected="true"]')
    const storePath = '/src/canvas/store.ts'
    const mod = (await import(/* @vite-ignore */ storePath)) as { useCanvasStore: { getState: () => Record<string, unknown> } }
    const s = mod.useCanvasStore.getState() as {
      analysisStateV1?: { run_state?: { kind?: string; computed_at?: string } } | null
      analysisFreshness?: { currentGraphHash?: string } | null
      currentScenarioId?: string | null
    }
    let transcript: { key: boolean; userMessagesWithSourceBlockKey: string[]; messageCount: number } = { key: false, userMessagesWithSourceBlockKey: [], messageCount: 0 }
    try {
      const raw = localStorage.getItem('olumi-canvas-transcript')
      if (raw) {
        const file = JSON.parse(raw) as Record<string, { messages?: Array<{ role: string; sourceBlockKey?: string }> }>
        const all = Object.values(file).flatMap((t) => t.messages ?? [])
        transcript = { key: true, messageCount: all.length, userMessagesWithSourceBlockKey: all.filter((m) => m.role === 'user' && m.sourceBlockKey).map((m) => String(m.sourceBlockKey)) }
      }
    } catch { /* recorded as absent */ }
    return {
      activeDockTab: tab?.getAttribute('data-testid') ?? null,
      scroll: scroller
        ? { scrollTop: Math.round(scroller.scrollTop), scrollHeight: scroller.scrollHeight, clientHeight: scroller.clientHeight, atBottom: scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 2 }
        : null,
      newMessagesPill: Boolean(document.querySelector('[data-testid="new-messages-pill"]')),
      assistantMessages: assistants.length,
      userMessages: document.querySelectorAll('[data-testid="chat-message-user"]').length,
      run1Reply: replyFacts(ids[0]),
      run2Reply: replyFacts(ids[1]),
      card1: cardFacts(ids[0]),
      card2: cardFacts(ids[1]),
      store: {
        runStateKind: s.analysisStateV1?.run_state?.kind ?? null,
        computedAt: s.analysisStateV1?.run_state?.computed_at ?? null,
        currentGraphHash: s.analysisFreshness?.currentGraphHash ?? null,
        currentScenarioId: s.currentScenarioId ?? null,
      },
      transcript,
      /** The dock's comparison-mode label ("AI: OpenAI"), read as rendered. */
      aiModeLabel: [...document.querySelectorAll('*')].find((e) => e.childElementCount === 0 && /^AI:\s*OpenAI$/.test(e.textContent?.trim() ?? ''))?.textContent?.trim() ?? null,
    }
  }, { ids: [CARD1.block_id, CARD2.block_id] as [string, string], firstStart: FIRST_SENTENCE_START })
}

/** Which tree is on the other end of the port? Asked of the server, not assumed. */
async function servingTree(page: Page): Promise<'combined' | 'staging'> {
  return page.evaluate(async () => {
    const res = await fetch('/src/canvas/conversation/utils/transcriptStore.ts')
    const src = await res.text()
    return src.includes('settledSourceBlockKeys') ? 'combined' : 'staging'
  })
}

const settle = (page: Page) => page.waitForTimeout(1_500)
const VIEWPORTS = [
  { width: 1280, height: 800 },
  { width: 1440, height: 900 },
] as const

test('13 — run #1 is the c673223 route body; run #2 moves only the run identity', () => {
  expect(createHash('sha256').update(RUN1_BYTES, 'utf8').digest('hex')).toBe(PROVENANCE.route_body_sha256)
  expect(CARD1.created_at).toBe((ROUTE_BODY.analysis_state as { run_state: { computed_at: string } }).run_state.computed_at)
  expect(CARD2.created_at).toBe(LATER_RUN_AT)
  expect(CARD2.created_at).not.toBe(CARD1.created_at)
  expect(CARD2.graph_hash_at_generation).toBe(CARD1.graph_hash_at_generation)
  expect((RUN2_BODY.analysis_ready as { current_graph_hash: string }).current_graph_hash).toBe(CARD1.graph_hash_at_generation)
  expect(CARD2.action_prompt).toBe(CARD1.action_prompt)
  // Nothing else moved: undo the identity fields and the bytes are run #1's.
  const back = JSON.parse(RUN2_BYTES) as Record<string, any>
  back.analysis_state.run_state.computed_at = CARD1.created_at
  back.analysis_ready.computed_at = CARD1.created_at
  const c = (back.blocks as Array<Record<string, any>>).find((b) => b.type === 'coaching')!
  c.created_at = CARD1.created_at; c.block_id = CARD1.block_id; c.signal_id = CARD1.signal_id
  expect(JSON.stringify(back)).toBe(RUN1_BYTES)
})

for (const vp of VIEWPORTS) {
  const tag = `${vp.width}x${vp.height}`
  const name = (step: string, ext: 'png' | 'json') => `13-joined-${step}-${TREE}-${tag}.${ext}`
  const facts = (step: string, o: unknown) => writeFileSync(outPath(name(step, 'json')), JSON.stringify(o, null, 2) + '\n')

  test(`13 — joined journey on ${TREE} @ ${tag}`, async ({ page }) => {
    await prepareOnce(page, vp)
    const net = await installWitnessNetwork(page)
    await page.goto('/#/canvas?ai=openai', { waitUntil: 'domcontentloaded' })
    await waitForCanvas(page)
    const served = await servingTree(page)
    expect(served, 'the dev server on this port must be serving the tree this run claims').toBe(TREE)
    const seeded = await seedStarterDraft(page, STARTER)
    await clearNotifications(page)
    await page.getByTestId('outputs-dock-tab-olumi').click()
    const composer = page.getByTestId('ai-input-bar-strip-textarea')
    await expect(composer).toBeVisible()
    await composer.fill(OPENING_MESSAGE)
    await composer.press('Enter')
    await expect(page.getByText(TURN_TEXT.opening, { exact: true })).toBeVisible()

    // ── STEP 1: Run #1 lands ──
    const runChip = page.getByTestId(`suggested-chip-${RUN_CHIP.id}`)
    await expect(runChip).toBeEnabled()
    await runChip.click({ timeout: 5_000 })
    await expect(page.getByTestId(`coaching-line-${CARD1.block_id}`)).toBeVisible({ timeout: 30_000 })
    const s1Arrival = await read(page)
    await settle(page)
    const s1Settled = await read(page)
    await clearNotifications(page)
    await page.screenshot({ path: outPath(name('1-run1-arrival', 'png')) })
    facts('1-run1-arrival', { tree: TREE, viewport: tag, seeded, onArrival: s1Arrival, after1500ms: s1Settled, turnsSoFar: net.turns })

    // ── STEP 2: Run #2, same model, later run ──
    const suggestedRunChipAfterRun1 = await page.getByTestId(`suggested-chip-${RUN_CHIP.id}`).count()
    const rerun = page.getByTestId('ai-input-bar-strip-analyse')
    await expect(rerun).toBeEnabled()
    const rerunLabel = await rerun.getAttribute('aria-label')
    await rerun.click({ timeout: 5_000 })
    await expect(page.getByTestId(`coaching-line-${CARD2.block_id}`)).toBeVisible({ timeout: 30_000 })
    const s2Arrival = await read(page)
    await settle(page)
    await clearNotifications(page)
    await page.screenshot({ path: outPath(name('2-run2-arrival', 'png')) })
    // Card #1, opened by a real click and brought into view.
    const line1 = page.getByTestId(`coaching-line-${CARD1.block_id}`)
    await line1.scrollIntoViewIfNeeded()
    await page.getByTestId(`coaching-line-summary-${CARD1.block_id}`).click()
    await settle(page)
    await line1.scrollIntoViewIfNeeded()
    const s2Card1 = await read(page)
    await page.screenshot({ path: outPath(name('2-later-run-card1', 'png')) })
    await line1.screenshot({ path: outPath(name('2-later-run-card1-crop', 'png')) })
    facts('2-later-run', { tree: TREE, viewport: tag, suggestedRunChipAfterRun1, rerunControl: { testId: 'ai-input-bar-strip-analyse', ariaLabel: rerunLabel }, run2OnArrival: s2Arrival, card1Opened: s2Card1, turnsSoFar: net.turns })

    // ── STEP 3: card #2's action, clicked once ──
    const line2 = page.getByTestId(`coaching-line-${CARD2.block_id}`)
    await line2.scrollIntoViewIfNeeded()
    await page.getByTestId(`coaching-line-summary-${CARD2.block_id}`).click()
    await settle(page)
    const s3Before = await read(page)
    const chip2 = line2.getByTestId('v5-coaching-action')
    const cardActionsBefore = net.turns.filter((t) => t.answeredWith === 'card_action').length
    await chip2.click({ timeout: 5_000 })
    await expect(page.getByText(ACTION_REPLY_TEXT, { exact: true })).toBeVisible()
    await settle(page)
    await line2.scrollIntoViewIfNeeded()
    const s3After = await read(page)
    await page.screenshot({ path: outPath(name('3-card2-action-clicked', 'png')) })
    await line2.screenshot({ path: outPath(name('3-card2-action-clicked-crop', 'png')) })
    const cardActionsFromClick = net.turns.filter((t) => t.answeredWith === 'card_action').length - cardActionsBefore
    facts('3-card-action', { tree: TREE, viewport: tag, card2OpenedBeforeClick: s3Before, afterClick: s3After, cardActionTurnsSentByClick: cardActionsFromClick, turnsSoFar: net.turns })

    // ── STEP 4: a real reload; the transcript restores from localStorage ──
    const transcriptBeforeReload = s3After.transcript
    net.phase = 'after-reload'
    await page.reload({ waitUntil: 'domcontentloaded' })
    await waitForCanvas(page)
    expect(await servingTree(page)).toBe(TREE)
    await clearNotifications(page)
    const olumiTab = page.getByTestId('outputs-dock-tab-olumi')
    if ((await olumiTab.getAttribute('aria-selected')) !== 'true') await olumiTab.click()
    const line2r = page.getByTestId(`coaching-line-${CARD2.block_id}`)
    await expect(line2r, 'the restored transcript must carry card #2').toHaveCount(1, { timeout: 30_000 })
    await settle(page)
    const s4Restored = await read(page)
    await line2r.scrollIntoViewIfNeeded()
    if (!(await line2r.evaluate((d) => (d as HTMLDetailsElement).open))) await page.getByTestId(`coaching-line-summary-${CARD2.block_id}`).click()
    await settle(page)
    await line2r.scrollIntoViewIfNeeded()
    const s4Opened = await read(page)
    await page.screenshot({ path: outPath(name('4-after-reload-card2', 'png')) })
    await line2r.screenshot({ path: outPath(name('4-after-reload-card2-crop', 'png')) })
    const turnsBeforeClick = net.turns.length
    const chip2r = line2r.getByTestId('v5-coaching-action')
    const clickNote = await chip2r.click({ force: true, timeout: 5_000 }).then(() => 'clicked (force)').catch((e: Error) => `click threw: ${e.message.split('\n')[0]}`)
    await settle(page)
    const s4AfterClick = await read(page)
    const turnsSentByPostReloadClick = net.turns.slice(turnsBeforeClick)
    facts('4-after-reload', { tree: TREE, viewport: tag, transcriptBeforeReload, restored: s4Restored, card2Opened: s4Opened, postReloadClick: clickNote, afterPostReloadClick: s4AfterClick, turnPostsSentByPostReloadClick: turnsSentByPostReloadClick.length, turnsSentByPostReloadClick })

    // ── STEP 4b: second reload; the verdict restated; the chip read and clicked again ──
    net.phase = 'after-second-reload'
    await page.reload({ waitUntil: 'domcontentloaded' })
    await waitForCanvas(page)
    expect(await servingTree(page)).toBe(TREE)
    await clearNotifications(page)
    if ((await olumiTab.getAttribute('aria-selected')) !== 'true') await olumiTab.click()
    await expect(line2r).toHaveCount(1, { timeout: 30_000 })
    await settle(page)
    const s4bRestored = await read(page)
    await composer.fill(RESTATE_MESSAGE)
    await composer.press('Enter')
    await expect(page.getByText(RESTATE_TEXT, { exact: true })).toBeVisible()
    await settle(page)
    await line2r.scrollIntoViewIfNeeded()
    if (!(await line2r.evaluate((d) => (d as HTMLDetailsElement).open))) await page.getByTestId(`coaching-line-summary-${CARD2.block_id}`).click()
    await settle(page)
    await line2r.scrollIntoViewIfNeeded()
    const s4bRestated = await read(page)
    await page.screenshot({ path: outPath(name('4b-verdict-restated-card2', 'png')) })
    await line2r.screenshot({ path: outPath(name('4b-verdict-restated-card2-crop', 'png')) })
    const turnsBefore4bClick = net.turns.length
    const click4b = await chip2r.click({ force: true, timeout: 5_000 }).then(() => 'clicked (force)').catch((e: Error) => `click threw: ${e.message.split('\n')[0]}`)
    await settle(page)
    const s4bAfterClick = await read(page)
    const turnsSentBy4bClick = net.turns.slice(turnsBefore4bClick)
    facts('4b-verdict-restated', { tree: TREE, viewport: tag, restoredAfterSecondReload: s4bRestored, afterRestatedVerdict: s4bRestated, click: click4b, afterClick: s4bAfterClick, turnPostsSentByClick: turnsSentBy4bClick.length, turnsSentByClick: turnsSentBy4bClick })

    await Promise.all(net.pending)
    const { pending: _p, ...netSummary } = net
    const summary = {
      tree: TREE, viewport: tag,
      offOriginAttempted: net.nonLocal, offOriginAborted: net.aborted, offOriginCompleted: net.nonLocalCompleted.length,
      turns: net.turns, readinessServed: net.readinessServed, totalRequests: net.total,
    }
    writeFileSync(outPath(`13-joined-network-${TREE}-${tag}.json`), JSON.stringify(summary, null, 2) + '\n')
    console.log(`AICWITNESS joined-13 ${TREE} ${tag} ${JSON.stringify({ net: netSummary })}`)

    // Harness invariants only. The PRODUCT facts are recorded, not asserted —
    // the control tree is expected to differ.
    expect(net.turns.filter((t) => t.phase === 'before-reload').map((t) => t.answeredWith)).toEqual(['opening', 'run1', 'run2', 'card_action'])
    expect(net.turns.every((t) => t.aiModeHeader === 'openai'), 'every turn went out on the ?ai=openai route').toBe(true)
    expect(s1Arrival.aiModeLabel).toBe('AI: OpenAI')
    assertNoModelCalls(net)
  })
}
