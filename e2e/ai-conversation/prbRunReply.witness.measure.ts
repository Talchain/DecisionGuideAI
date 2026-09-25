/**
 * PR-B — served-browser witness: the first ROUTE-GENERATED OpenAI agent-lane
 * Run turn that carries the run-turn coaching card, as a user sees it in the dock.
 *
 * Named `*.measure.ts` because `playwright.aiconversation.config.ts` collects
 * `testMatch: '**\/*.measure.ts'` only.
 *
 *   GEOMETRY_PORT=5297 PW_CHROMIUM_PATH=/opt/pw-browsers/chromium \
 *     pnpm exec playwright test -c playwright.aiconversation.config.ts prbRunReply
 *
 * THE RUN REPLY is `fixtures/prb-route-c933aabf-explicit-run.json`: the HTTP
 * response body of CEE `POST /agent/v1/turn` at PR #1854's approved head
 * `c933aabf` (byte-identical on `c933aabf` + staging `caf7d1a3`), produced by
 * CEE's own route test double with a SCRIPTED model — route-generated, NOT a
 * live capture. Served here byte for byte (the spec re-derives the sha256 its
 * `_provenance` records).
 *
 * WHAT IS REAL: the whole app on `/#/canvas`, served by local vite; the docked
 * Olumi tab — the app's own `ConversationPanel` on the app's own
 * `useConversation`; the Run is the chip click → `dispatchAction` →
 * `callV5Turn` → `fetch`; the reply goes through the shipped chain
 * (`applyV5State`, phase-3 extraction, composition, `ChatThread`).
 *
 * WHAT IS THE HARNESS'S: the seeded canvas (the `pricing-model` starter — a
 * DIFFERENT model from the one the route body analysed; the route body's
 * `draft_graph` is the CEE harness's 5-node READY_GRAPH, which the product's
 * zero-overlap guard declines to apply over the seeded canvas); the opening
 * turn's reply and the reply to the card's action (both labelled
 * "[Witness fixture, not CEE output]"); the readiness verdict (`READY`).
 *
 * ⛔ NO MODEL CALLS. Every `/proxy/v5/turn` POST is fulfilled here, and so is
 * every `/bff/cee/graph-readiness` POST. Every other `/bff` / `/api` call is
 * answered in-page by the harness's hermetic 503. Every non-localhost request
 * is ABORTED. Each test asserts that 0 off-origin requests got a response.
 */
import { test, expect, type Page } from '@playwright/test'
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { clearNotifications, openCanvas, preparePage, seedStarterDraft } from '../visual/harness'
import { repoRoot } from '../visual/repoRoot'
import { OPENING_MESSAGE, READINESS_READY, RUN_CHIP, STARTER, TURN_TEXT, turnReply } from './runChipGateFixtures'

// ── The route body, byte for byte ───────────────────────────────────────────

const FIXTURE_PATH = join(repoRoot(), 'e2e', 'ai-conversation', 'fixtures', 'prb-route-c933aabf-explicit-run.json')
const fixture = JSON.parse(readFileSync(FIXTURE_PATH, 'utf8')) as Record<string, unknown>
const { _provenance: PROVENANCE, ...ROUTE_BODY } = fixture as { _provenance: { route_body_sha256: string } } & Record<string, unknown>
/** The exact bytes the route sent (JSON.stringify of the body in the route's key order). */
const ROUTE_BYTES = JSON.stringify(ROUTE_BODY)
type Card = { type: string; block_id: string; title: string; body: string; action_label: string; action_prompt: string; created_at: string; graph_hash_at_generation: string }
const CARD = (ROUTE_BODY.blocks as Card[]).find((b) => b.type === 'coaching') as Card
const ACTION_REPLY_TEXT = '[Witness fixture, not CEE output] Card action received. This fixture carries no analysis payload.'

const isLocalHost = (h: string) => h === 'localhost' || h === '127.0.0.1' || h === '[::1]'
const TOLERATED_ABORTED_HOSTS = new Set(['fonts.googleapis.com', 'fonts.gstatic.com'])

type TurnKind = 'opening' | 'run' | 'card_action' | 'unexpected'
interface TurnRecord { seq: number; answeredWith: TurnKind; kind: unknown; source: unknown; message: unknown; chip: unknown }
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

function classifyTurn(body: Record<string, unknown> | null): TurnKind {
  const chip = (body?.chip ?? null) as { action_type?: unknown } | null
  if (chip?.action_type === 'run_analysis') return 'run'
  if (body?.message === CARD.action_prompt) return 'card_action'
  if (body?.message === OPENING_MESSAGE) return 'opening'
  return 'unexpected'
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
      const answeredWith = classifyTurn(body)
      log.turns.push({ seq: log.turns.length + 1, answeredWith, kind: body?.kind, source: body?.source, message: body?.message, chip: body?.chip ?? null })
      if (answeredWith === 'run') return route.fulfill({ status: 200, contentType: 'application/json', body: ROUTE_BYTES })
      if (answeredWith === 'opening') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(turnReply('opening')) })
      if (answeredWith === 'card_action') {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ response_version: 2, assistant_text: ACTION_REPLY_TEXT, blocks: [], suggested_actions: [], insights: [], stage_indicator: 'frame' }) })
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

function evidencePath(name: string): string {
  const dir = process.env.WITNESS_OUT_DIR ?? join(repoRoot(), 'e2e', 'ai-conversation', 'evidence')
  mkdirSync(dir, { recursive: true })
  return join(dir, name)
}

interface Reading {
  replyText: string
  replyWords: number
  activeDockTab: string | null
  line: { present: boolean; open: boolean | null; summary: string | null; visible: boolean }
  card: { currency: string | null; runTurnReason: string | null; notice: string | null; body: string | null; actionText: string | null; actionDisabled: boolean | null; actionInert: string | null; actionVisible: boolean }
  analysisResult: { present: boolean; summaryStart: string | null }
  suggestedChips: number
  showMoreToggle: boolean
  store: { runStateKind: string | null; computedAt: string | null; currentGraphHash: string | null; dirty: boolean | null; nodeCount: number }
  assistantMessages: number
}

async function read(page: Page): Promise<Reading> {
  return page.evaluate(async ({ blockId }) => {
    const visible = (n: Element | null) => {
      if (!n) return false
      const r = (n as HTMLElement).getBoundingClientRect()
      const cs = getComputedStyle(n as HTMLElement)
      return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none'
    }
    const assistants = [...document.querySelectorAll('[data-testid="chat-message-assistant"]')]
    const runMsg = assistants.find((a) => a.querySelector(`[data-block-id="${blockId}"]`)) ?? null
    const bodyEl = runMsg?.querySelector('[data-testid="message-body-text"]') ?? null
    let replyText = ''
    if (bodyEl) {
      const clone = bodyEl.cloneNode(true) as HTMLElement
      for (const el of clone.querySelectorAll('p, li, ul, ol, div, br')) { el.before(' '); el.after(' ') }
      replyText = (clone.textContent ?? '').replace(/\s+/g, ' ').trim()
    }
    const line = document.querySelector(`[data-testid="coaching-line-${blockId}"]`) as HTMLDetailsElement | null
    const card = document.querySelector(`[data-block-id="${blockId}"]`) as HTMLElement | null
    const action = card?.querySelector('[data-testid="v5-coaching-action"]') as HTMLButtonElement | null
    const tab = document.querySelector('[data-testid^="outputs-dock-tab-"][aria-selected="true"]')
    const storePath = '/src/canvas/store.ts'
    const mod = (await import(/* @vite-ignore */ storePath)) as { useCanvasStore: { getState: () => Record<string, unknown> } }
    const s = mod.useCanvasStore.getState() as {
      analysisStateV1?: { run_state?: { kind?: string; computed_at?: string } } | null
      analysisFreshness?: { currentGraphHash?: string } | null
      analysisFreshnessDirty?: boolean
      nodes?: unknown[]
    }
    return {
      replyText,
      replyWords: replyText.split(/\s+/).filter(Boolean).length,
      activeDockTab: tab?.getAttribute('data-testid') ?? null,
      line: { present: Boolean(line), open: line ? line.open : null, summary: line?.querySelector('summary')?.textContent?.trim() ?? null, visible: visible(line) },
      card: {
        currency: card?.getAttribute('data-currency') ?? null,
        runTurnReason: card?.getAttribute('data-run-turn-reason') ?? null,
        notice: card?.querySelector('[data-testid="v5-coaching-freshness"]')?.textContent ?? null,
        body: card?.querySelector('[data-testid="v5-coaching-body"]')?.textContent ?? null,
        actionText: action?.textContent ?? null,
        actionDisabled: action ? action.disabled : null,
        actionInert: action?.getAttribute('data-inert') ?? null,
        actionVisible: visible(action),
      },
      analysisResult: {
        present: Boolean(runMsg?.querySelector('[data-testid="v5-analysis-result"]')),
        summaryStart: runMsg?.querySelector('[data-testid="v5-analysis-result-summary"]')?.textContent?.slice(0, 80) ?? null,
      },
      suggestedChips: runMsg?.querySelectorAll('[data-testid^="suggested-chip-"]').length ?? 0,
      showMoreToggle: Boolean(runMsg?.querySelector('[data-testid="message-show-more"], [data-testid="block-detail-toggle"]')),
      store: {
        runStateKind: s.analysisStateV1?.run_state?.kind ?? null,
        computedAt: s.analysisStateV1?.run_state?.computed_at ?? null,
        currentGraphHash: s.analysisFreshness?.currentGraphHash ?? null,
        dirty: s.analysisFreshnessDirty ?? null,
        nodeCount: Array.isArray(s.nodes) ? s.nodes.length : -1,
      },
      assistantMessages: assistants.length,
    }
  }, { blockId: CARD.block_id })
}

/** Bring the assistant Run reply's top into view inside the thread (the thread auto-scrolls to the bottom). */
async function scrollReplyIntoView(page: Page, where: 'start' | 'end'): Promise<void> {
  await page.evaluate(({ blockId, where: w }) => {
    const assistants = [...document.querySelectorAll('[data-testid="chat-message-assistant"]')]
    const runMsg = assistants.find((a) => a.querySelector(`[data-block-id="${blockId}"]`))
    runMsg?.scrollIntoView({ block: w })
  }, { blockId: CARD.block_id, where })
  await page.waitForTimeout(300)
}

const settle = (page: Page) => page.waitForTimeout(1_500)

const VIEWPORTS = [
  { width: 1280, height: 800 },
  { width: 1440, height: 900 },
] as const

test('the fixture is the route body, byte for byte', () => {
  expect(createHash('sha256').update(ROUTE_BYTES, 'utf8').digest('hex')).toBe(PROVENANCE.route_body_sha256)
  expect(CARD.created_at).toBe((ROUTE_BODY.analysis_state as { run_state: { computed_at: string } }).run_state.computed_at)
  expect(CARD.graph_hash_at_generation).toBe((ROUTE_BODY.analysis_ready as { current_graph_hash: string }).current_graph_hash)
})

for (const vp of VIEWPORTS) {
  const tag = `${vp.width}x${vp.height}`
  test(`PR-B route Run reply in the dock @ ${tag}: reply renders, the card is a current line with a live action`, async ({ page }) => {
    await preparePage(page, vp)
    const net = await installWitnessNetwork(page)
    await openCanvas(page)
    const seeded = await seedStarterDraft(page, STARTER)
    await clearNotifications(page)
    await page.getByTestId('outputs-dock-tab-olumi').click()
    const composer = page.getByTestId('ai-input-bar-strip-textarea')
    await expect(composer).toBeVisible()
    await composer.fill(OPENING_MESSAGE)
    await composer.press('Enter')
    await expect(page.getByText(TURN_TEXT.opening, { exact: true })).toBeVisible()
    const runChip = page.getByTestId(`suggested-chip-${RUN_CHIP.id}`)
    await expect(runChip).toBeEnabled()

    // ── The Run: the chip dispatches ONE run turn; the route body answers it ──
    await runChip.click({ timeout: 5_000 })
    const line = page.getByTestId(`coaching-line-${CARD.block_id}`)
    await expect(line).toBeVisible({ timeout: 30_000 })
    await settle(page)
    const afterRun = await read(page)
    // If the reply moved the dock off the chat, bring it back — and say so in the log.
    const dockMovedOffChat = afterRun.activeDockTab !== 'outputs-dock-tab-olumi'
    if (dockMovedOffChat) {
      await page.getByTestId('outputs-dock-tab-olumi').click()
      await settle(page)
    }
    await clearNotifications(page)

    // What the user sees the moment the reply lands — the thread's own scroll position, untouched.
    const asArrived = await page.evaluate(({ blockId }) => {
      const thread = document.querySelector('[data-testid="chat-thread"]') as HTMLElement | null
      const scroller = (() => {
        let n: HTMLElement | null = thread
        while (n && !(n.scrollHeight > n.clientHeight + 1 && /(auto|scroll)/.test(getComputedStyle(n).overflowY))) n = n.parentElement
        return n
      })()
      const box = scroller?.getBoundingClientRect()
      const inView = (el: Element | null) => {
        if (!el || !box) return null
        const r = el.getBoundingClientRect()
        return r.bottom > box.top && r.top < box.bottom
      }
      const assistants = [...document.querySelectorAll('[data-testid="chat-message-assistant"]')]
      const runMsg = assistants.find((a) => a.querySelector(`[data-block-id="${blockId}"]`)) ?? null
      const body = runMsg?.querySelector('[data-testid="message-body-text"]') ?? null
      return {
        scrollTop: scroller?.scrollTop ?? null,
        scrollHeight: scroller?.scrollHeight ?? null,
        clientHeight: scroller?.clientHeight ?? null,
        replyTopInView: body ? (() => { const r = body.getBoundingClientRect(); return box ? r.top >= box.top && r.top < box.bottom : null })() : null,
        cardLineInView: inView(document.querySelector(`[data-testid="coaching-line-${blockId}"]`)),
        analysisResultInView: inView(runMsg?.querySelector('[data-testid="v5-analysis-result"]') ?? null),
      }
    }, { blockId: CARD.block_id })
    await page.screenshot({ path: evidencePath(`09-prb-run-reply-${tag}-as-arrived.png`) })

    await scrollReplyIntoView(page, 'start')
    await page.screenshot({ path: evidencePath(`09-prb-run-reply-${tag}.png`) })
    await scrollReplyIntoView(page, 'end')
    await page.screenshot({ path: evidencePath(`09-prb-run-reply-${tag}-bottom.png`) })
    await line.scrollIntoViewIfNeeded()
    await line.screenshot({ path: evidencePath(`09-prb-run-reply-card-crop-${tag}.png`) })
    const closed = await read(page)

    // ── Open the line: the card's face; then its action, once ──
    await page.getByTestId(`coaching-line-summary-${CARD.block_id}`).click()
    await settle(page)
    const opened = await read(page)
    await line.scrollIntoViewIfNeeded()
    await line.screenshot({ path: evidencePath(`09-prb-run-reply-card-open-crop-${tag}.png`) })

    const action = line.getByTestId('v5-coaching-action')
    await action.click({ timeout: 5_000 })
    await expect(page.getByText(ACTION_REPLY_TEXT, { exact: true })).toBeVisible()
    await settle(page)
    await action.click({ force: true, timeout: 5_000 }).catch(() => undefined)
    await settle(page)
    const afterAction = await read(page)

    await Promise.all(net.pending)
    const { pending: _p, ...netSummary } = net
    console.log(`AICWITNESS prb-run-reply ${tag} ${JSON.stringify({ seededNodes: seeded.nodeCount, dockMovedOffChat, asArrived, afterRun, closed, opened, afterAction, net: netSummary })}`)

    // The turns: opening, ONE run, ONE card action carrying the producer's prompt verbatim.
    expect(net.turns.map((t) => t.answeredWith)).toEqual(['opening', 'run', 'card_action'])
    expect(net.turns[2]!.message).toBe(CARD.action_prompt)

    // The reply renders in full, and nothing hides it.
    expect(closed.replyText).toContain('This run can’t yet say which pricing path to take')
    expect(closed.replyText).toContain('Next, tell me which part of the model the churn limit applies to, then run it again.')
    expect(closed.replyWords).toBe(93)
    expect(closed.showMoreToggle).toBe(false)
    expect(closed.suggestedChips, 'the route offered no action on the completed Run').toBe(0)
    expect(closed.analysisResult.present).toBe(true)

    // The card: a closed line on the face, its title verbatim; CURRENT.
    expect(closed.line).toMatchObject({ present: true, open: false, summary: CARD.title, visible: true })
    expect(closed.card.currency).toBe('current')
    expect(closed.store).toMatchObject({ runStateKind: 'complete_current', computedAt: CARD.created_at, currentGraphHash: CARD.graph_hash_at_generation, dirty: false })

    // Opened: body + action verbatim, no notice, chip live.
    expect(opened.line.open).toBe(true)
    expect(opened.card).toMatchObject({ currency: 'current', runTurnReason: null, notice: null, body: CARD.body, actionText: CARD.action_label, actionDisabled: false, actionInert: null, actionVisible: true })
    // One click, one turn; the chip settles.
    expect(afterAction.card.actionDisabled).toBe(true)

    assertNoModelCalls(net)
  })
}

// ── 10 — the reply's START is in view on arrival (branch ai-conversation/reply-start-in-view) ──
//
// Same journey, same route body, same network discipline as above. The only
// question asked: the moment the Run reply lands — the thread's own scroll
// position, untouched by the spec — is the reply's FIRST SENTENCE (its
// conclusion) inside the thread's visible band? At 09 it was not: the thread
// pinned to the bottom. Measured with a DOM Range over the sentence's own text,
// every line box, against the scroll container's box, plus a hit test at the
// first line so "in view" cannot mean "in view but covered".

const FIRST_SENTENCE_START = 'This run can’t yet say which pricing path to take'
const FIRST_SENTENCE_END = 'checked against it.'
const FIRST_BULLET_START = 'On the MRR goal alone'

interface StartReading {
  scrollTop: number | null
  scrollHeight: number | null
  clientHeight: number | null
  atBottom: boolean | null
  replyTopFromThreadTop: number | null
  firstSentence: { found: boolean; lines: number; allLinesInView: boolean; hitTestable: boolean }
  firstBulletInView: boolean | null
  analysisResultTopInView: boolean | null
  pillShown: boolean
}

async function readReplyStart(page: Page): Promise<StartReading> {
  return page.evaluate(({ blockId, start, end, bullet }) => {
    const thread = document.querySelector('[data-testid="chat-thread"]') as HTMLElement | null
    const scroller = (() => {
      let n: HTMLElement | null = thread
      while (n && !(n.scrollHeight > n.clientHeight + 1 && /(auto|scroll)/.test(getComputedStyle(n).overflowY))) n = n.parentElement
      return n
    })()
    const box = scroller?.getBoundingClientRect() ?? null
    const within = (r: DOMRect) => !!box && r.top >= box.top - 0.5 && r.bottom <= box.bottom + 0.5
    const assistants = [...document.querySelectorAll('[data-testid="chat-message-assistant"]')]
    const runMsg = assistants.find((a) => a.querySelector(`[data-block-id="${blockId}"]`)) ?? null
    const body = runMsg?.querySelector('[data-testid="message-body-text"]') ?? null

    // A Range from the first character of `from` to the last character of `to`.
    const rangeFor = (from: string, to: string | null): Range | null => {
      if (!body) return null
      const walker = document.createTreeWalker(body, NodeFilter.SHOW_TEXT)
      const texts: Text[] = []
      for (let n = walker.nextNode(); n; n = walker.nextNode()) texts.push(n as Text)
      const full = texts.map((t) => t.data).join('')
      const s = full.indexOf(from)
      if (s < 0) return null
      const e = to === null ? s + from.length : full.indexOf(to, s) + to.length
      if (e < s) return null
      const locate = (offset: number) => {
        let acc = 0
        for (const t of texts) {
          if (offset <= acc + t.data.length) return { node: t, off: offset - acc }
          acc += t.data.length
        }
        return null
      }
      const a = locate(s)
      const b = locate(e)
      if (!a || !b) return null
      const r = document.createRange()
      r.setStart(a.node, a.off)
      r.setEnd(b.node, b.off)
      return r
    }

    const sentence = rangeFor(start, end)
    const lines = sentence ? [...sentence.getClientRects()].filter((r) => r.width > 0 && r.height > 0) : []
    const first = lines[0]
    const hit = first ? document.elementFromPoint(first.left + Math.min(8, first.width / 2), first.top + first.height / 2) : null
    const bulletRange = rangeFor(bullet, null)
    const bulletRects = bulletRange ? [...bulletRange.getClientRects()].filter((r) => r.width > 0) : []
    const card = runMsg?.querySelector('[data-testid="v5-analysis-result"]') ?? null
    const cardTop = card?.getBoundingClientRect().top ?? null
    return {
      scrollTop: scroller?.scrollTop ?? null,
      scrollHeight: scroller?.scrollHeight ?? null,
      clientHeight: scroller?.clientHeight ?? null,
      atBottom: scroller ? scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 2 : null,
      replyTopFromThreadTop: runMsg && box ? Math.round((runMsg.getBoundingClientRect().top - box.top) * 10) / 10 : null,
      firstSentence: {
        found: lines.length > 0,
        lines: lines.length,
        allLinesInView: lines.length > 0 && lines.every(within),
        hitTestable: !!hit && !!body && body.contains(hit),
      },
      firstBulletInView: bulletRects.length > 0 ? within(bulletRects[0]) : null,
      analysisResultTopInView: cardTop === null || !box ? null : cardTop >= box.top && cardTop < box.bottom,
      pillShown: !!document.querySelector('[data-testid="new-messages-pill"]'),
    }
  }, { blockId: CARD.block_id, start: FIRST_SENTENCE_START, end: FIRST_SENTENCE_END, bullet: FIRST_BULLET_START })
}

for (const vp of VIEWPORTS) {
  const tag = `${vp.width}x${vp.height}`
  test(`reply start in view @ ${tag}: the Run reply's first sentence is on screen the moment it lands`, async ({ page }) => {
    await preparePage(page, vp)
    const net = await installWitnessNetwork(page)
    await openCanvas(page)
    await seedStarterDraft(page, STARTER)
    await clearNotifications(page)
    await page.getByTestId('outputs-dock-tab-olumi').click()
    const composer = page.getByTestId('ai-input-bar-strip-textarea')
    await expect(composer).toBeVisible()
    await composer.fill(OPENING_MESSAGE)
    await composer.press('Enter')
    await expect(page.getByText(TURN_TEXT.opening, { exact: true })).toBeVisible()
    const runChip = page.getByTestId(`suggested-chip-${RUN_CHIP.id}`)
    await expect(runChip).toBeEnabled()

    await runChip.click({ timeout: 5_000 })
    await expect(page.getByTestId(`coaching-line-${CARD.block_id}`)).toBeVisible({ timeout: 30_000 })
    // Read at once, and again after the thread has settled: the first reading
    // is "on arrival"; the second proves nothing later pulled it to the bottom.
    const onArrival = await readReplyStart(page)
    await settle(page)
    const activeTab = await page.evaluate(() => document.querySelector('[data-testid^="outputs-dock-tab-"][aria-selected="true"]')?.getAttribute('data-testid') ?? null)
    const dockMovedOffChat = activeTab !== 'outputs-dock-tab-olumi'
    await clearNotifications(page)
    const settled = await readReplyStart(page)
    await page.screenshot({ path: evidencePath(`10-reply-start-in-view-${tag}.png`) })

    await Promise.all(net.pending)
    const { pending: _p, ...netSummary } = net
    console.log(`AICWITNESS reply-start-in-view ${tag} ${JSON.stringify({ dockMovedOffChat, onArrival, settled, net: netSummary })}`)

    expect(dockMovedOffChat, 'the Run kept the dock on the chat, so this is the arrival view').toBe(false)
    expect(net.turns.map((t) => t.answeredWith)).toEqual(['opening', 'run'])
    for (const [when, r] of [['on arrival', onArrival], ['after settling', settled]] as const) {
      expect(r.firstSentence.found, `${when}: the first sentence is in the DOM`).toBe(true)
      expect(r.firstSentence.allLinesInView, `${when}: every line of the first sentence is inside the thread`).toBe(true)
      expect(r.firstSentence.hitTestable, `${when}: the first line is not covered`).toBe(true)
      expect(r.atBottom, `${when}: the reply is taller than the thread, so it is NOT pinned to the bottom`).toBe(false)
      expect(r.pillShown, `${when}: no "New messages" pill for the reader's own reply`).toBe(false)
    }
    assertNoModelCalls(net)
  })
}
