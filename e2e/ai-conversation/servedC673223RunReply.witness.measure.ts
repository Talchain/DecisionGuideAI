/**
 * 11 — SERVED-EQUIVALENT witness: the route-generated OpenAI agent-lane Run
 * turn from the CEE commit SERVED on staging on 2026-09-25 (`c673223`), as a
 * user sees it in the dock.
 *
 *   GEOMETRY_PORT=5297 PW_CHROMIUM_PATH=/opt/pw-browsers/chromium \
 *     pnpm exec playwright test -c playwright.aiconversation.config.ts servedC673223
 *
 * THE RUN REPLY is `fixtures/served-route-c673223-explicit-run.json`: the HTTP
 * response body of CEE `POST /agent/v1/turn` at
 * `c673223d7bc3f83fc344b68de53b44baf04c75f7`, produced by CEE's own route test
 * double with a SCRIPTED model — route-generated, NOT a live capture (no OpenAI
 * or Anthropic call was made). It is byte-identical to the c933aabf body that 09
 * served (sha256 `ca8ad216…675e`, re-derived below). Served here byte for byte.
 *
 * Same journey, same network discipline as 09 (`prbRunReply.witness.measure.ts`):
 * the whole app on `/#/canvas` via local vite; the docked Olumi tab (the app's
 * own ConversationPanel + useConversation); the Run is the chip click →
 * dispatchAction → callV5Turn → fetch, answered here. The seeded canvas, the
 * opening reply, the readiness verdict (READY) and the card-action reply are the
 * harness's.
 *
 * ⛔ NO MODEL CALLS. Every `/proxy/v5/turn` and `/bff/cee/graph-readiness` POST is
 * fulfilled here; every other `/bff` / `/api` call gets the harness's hermetic
 * 503; every non-localhost request is ABORTED; each test asserts 0 off-origin
 * responses.
 *
 * `WITNESS_OUT_DIR` redirects the images (used for the staging-only comparison
 * run, whose tree lacks the witness branch's unmerged UI).
 */
import { test, expect, type Page } from '@playwright/test'
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { clearNotifications, openCanvas, preparePage, seedStarterDraft } from '../visual/harness'
import { repoRoot } from '../visual/repoRoot'
import { OPENING_MESSAGE, READINESS_READY, RUN_CHIP, STARTER, TURN_TEXT, turnReply } from './runChipGateFixtures'

const CEE_SERVED = 'c673223d7bc3f83fc344b68de53b44baf04c75f7'
const FIXTURE_PATH = join(repoRoot(), 'e2e', 'ai-conversation', 'fixtures', 'served-route-c673223-explicit-run.json')
const fixture = JSON.parse(readFileSync(FIXTURE_PATH, 'utf8')) as Record<string, unknown>
const { _provenance: PROVENANCE, ...ROUTE_BODY } = fixture as { _provenance: { route_body_sha256: string; producer: string; c933aabf_route_body_sha256: string } } & Record<string, unknown>
const ROUTE_BYTES = JSON.stringify(ROUTE_BODY)
type Card = { type: string; block_id: string; title: string; body: string; action_label: string; action_prompt: string; created_at: string; graph_hash_at_generation: string }
const CARD = (ROUTE_BODY.blocks as Card[]).find((b) => b.type === 'coaching') as Card
const ACTION_REPLY_TEXT = '[Witness fixture, not CEE output] Card action received. This fixture carries no analysis payload.'
const FIRST_SENTENCE_START = 'This run can’t yet say which pricing path to take'
const LAST_SENTENCE = 'Next, tell me which part of the model the churn limit applies to, then run it again.'

const isLocalHost = (h: string) => h === 'localhost' || h === '127.0.0.1' || h === '[::1]'
const TOLERATED_ABORTED_HOSTS = new Set(['fonts.googleapis.com', 'fonts.gstatic.com'])

type TurnKind = 'opening' | 'run' | 'card_action' | 'unexpected'
interface TurnRecord { seq: number; answeredWith: TurnKind; message: unknown; chip: unknown }
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
      log.turns.push({ seq: log.turns.length + 1, answeredWith, message: body?.message, chip: body?.chip ?? null })
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

/** Everything the reader can check on screen, read once. `face` = the Run message's visible text. */
async function read(page: Page) {
  return page.evaluate(async ({ blockId, firstStart, last }) => {
    const visibleBox = (n: Element | null) => {
      if (!n) return false
      const r = (n as HTMLElement).getBoundingClientRect()
      const cs = getComputedStyle(n as HTMLElement)
      return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none'
    }
    const thread = document.querySelector('[data-testid="chat-thread"]') as HTMLElement | null
    const scroller = (() => {
      let n: HTMLElement | null = thread
      while (n && !(n.scrollHeight > n.clientHeight + 1 && /(auto|scroll)/.test(getComputedStyle(n).overflowY))) n = n.parentElement
      return n
    })()
    const box = scroller?.getBoundingClientRect() ?? null
    const inView = (el: Element | null) => {
      if (!el || !box) return null
      const r = el.getBoundingClientRect()
      return r.bottom > box.top && r.top < box.bottom
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
    // The first / last sentence: is its first line box inside the thread's visible band?
    const lineInView = (needle: string) => {
      if (!bodyEl || !box) return null
      const walker = document.createTreeWalker(bodyEl, NodeFilter.SHOW_TEXT)
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        const t = n as Text
        const i = t.data.indexOf(needle.slice(0, 20))
        if (i < 0) continue
        const r = document.createRange()
        r.setStart(t, i)
        r.setEnd(t, Math.min(t.data.length, i + 20))
        const rect = [...r.getClientRects()].find((x) => x.width > 0)
        if (!rect) return null
        return rect.top >= box.top - 0.5 && rect.bottom <= box.bottom + 0.5
      }
      return null
    }
    const line = document.querySelector(`[data-testid="coaching-line-${blockId}"]`) as HTMLDetailsElement | null
    const card = document.querySelector(`[data-block-id="${blockId}"]`) as HTMLElement | null
    const action = card?.querySelector('[data-testid="v5-coaching-action"]') as HTMLButtonElement | null
    const tab = document.querySelector('[data-testid^="outputs-dock-tab-"][aria-selected="true"]')
    const storePath = '/src/canvas/store.ts'
    const mod = (await import(/* @vite-ignore */ storePath)) as { useCanvasStore: { getState: () => Record<string, unknown> } }
    const s = mod.useCanvasStore.getState() as {
      analysisStateV1?: { run_state?: { kind?: string; computed_at?: string }; leader_claim?: unknown } | null
      analysisFreshness?: { currentGraphHash?: string } | null
      analysisFreshnessDirty?: boolean
      nodes?: unknown[]
    }
    const faceClone = runMsg ? (runMsg.cloneNode(true) as HTMLElement) : null
    if (faceClone) {
      for (const d of faceClone.querySelectorAll('details:not([open])')) {
        for (const c of [...d.children]) if (c.tagName !== 'SUMMARY') c.remove()
      }
      for (const el of faceClone.querySelectorAll('p, li, div, summary, button, span, h3')) { el.before(' '); el.after(' ') }
    }
    return {
      replyText,
      replyWords: replyText.split(/\s+/).filter(Boolean).length,
      face: (faceClone?.textContent ?? '').replace(/\s+/g, ' ').trim(),
      activeDockTab: tab?.getAttribute('data-testid') ?? null,
      scroll: { scrollTop: scroller?.scrollTop ?? null, scrollHeight: scroller?.scrollHeight ?? null, clientHeight: scroller?.clientHeight ?? null, atBottom: scroller ? scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 2 : null },
      firstSentenceInView: lineInView(firstStart),
      lastSentenceInView: lineInView(last),
      cardLineInView: inView(line),
      analysisResultInView: inView(runMsg?.querySelector('[data-testid="v5-analysis-result"]') ?? null),
      line: { present: Boolean(line), open: line ? line.open : null, summary: line?.querySelector('summary')?.textContent?.trim() ?? null, visible: visibleBox(line) },
      card: {
        currency: card?.getAttribute('data-currency') ?? null,
        runTurnReason: card?.getAttribute('data-run-turn-reason') ?? null,
        notice: card?.querySelector('[data-testid="v5-coaching-freshness"]')?.textContent ?? null,
        body: card?.querySelector('[data-testid="v5-coaching-body"]')?.textContent ?? null,
        actionText: action?.textContent ?? null,
        actionDisabled: action ? action.disabled : null,
        actionInert: action?.getAttribute('data-inert') ?? null,
        actionVisible: visibleBox(action),
      },
      leaderDesignations: runMsg?.querySelectorAll('[data-leader="true"]').length ?? 0,
      suggestedChips: runMsg?.querySelectorAll('[data-testid^="suggested-chip-"]').length ?? 0,
      showMoreToggle: Boolean(runMsg?.querySelector('[data-testid="message-show-more"], [data-testid="block-detail-toggle"]')),
      pillShown: Boolean(document.querySelector('[data-testid="new-messages-pill"]')),
      store: {
        runStateKind: s.analysisStateV1?.run_state?.kind ?? null,
        computedAt: s.analysisStateV1?.run_state?.computed_at ?? null,
        leaderClaim: s.analysisStateV1?.leader_claim ?? null,
        currentGraphHash: s.analysisFreshness?.currentGraphHash ?? null,
        dirty: s.analysisFreshnessDirty ?? null,
        nodeCount: Array.isArray(s.nodes) ? s.nodes.length : -1,
      },
    }
  }, { blockId: CARD.block_id, firstStart: FIRST_SENTENCE_START, last: LAST_SENTENCE })
}

const settle = (page: Page) => page.waitForTimeout(1_500)
const VIEWPORTS = [
  { width: 1280, height: 800 },
  { width: 1440, height: 900 },
] as const

test('11 — the fixture is the c673223 route body, byte for byte (and byte-identical to c933aabf)', () => {
  const sha = createHash('sha256').update(ROUTE_BYTES, 'utf8').digest('hex')
  expect(sha).toBe(PROVENANCE.route_body_sha256)
  expect(sha).toBe(PROVENANCE.c933aabf_route_body_sha256)
  expect(PROVENANCE.producer).toContain(CEE_SERVED)
  expect(CARD.created_at).toBe((ROUTE_BODY.analysis_state as { run_state: { computed_at: string } }).run_state.computed_at)
  expect(CARD.graph_hash_at_generation).toBe((ROUTE_BODY.analysis_ready as { current_graph_hash: string }).current_graph_hash)
})

for (const vp of VIEWPORTS) {
  const tag = `${vp.width}x${vp.height}`
  test(`11 — served c673223 Run reply in the dock @ ${tag}`, async ({ page }) => {
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

    // ── The Run: one chip click, one run turn, answered with the c673223 route body ──
    await runChip.click({ timeout: 5_000 })
    const line = page.getByTestId(`coaching-line-${CARD.block_id}`)
    await expect(line).toBeVisible({ timeout: 30_000 })
    const onArrival = await read(page)
    await settle(page)
    const settledRead = await read(page)
    const dockMovedOffChat = settledRead.activeDockTab !== 'outputs-dock-tab-olumi'
    await clearNotifications(page)
    // THE photo: what the user sees after the Run, the thread's own scroll position untouched.
    await page.screenshot({ path: evidencePath(`11-served-c673223-run-reply-${tag}.png`) })

    // Then the card: opened, and its action once.
    await line.scrollIntoViewIfNeeded()
    await page.getByTestId(`coaching-line-summary-${CARD.block_id}`).click()
    await settle(page)
    const opened = await read(page)
    await line.screenshot({ path: evidencePath(`11-served-c673223-run-reply-card-open-crop-${tag}.png`) })
    const action = line.getByTestId('v5-coaching-action')
    await action.click({ timeout: 5_000 })
    await expect(page.getByText(ACTION_REPLY_TEXT, { exact: true })).toBeVisible()
    await settle(page)
    await action.click({ force: true, timeout: 5_000 }).catch(() => undefined)
    await settle(page)
    const afterAction = await read(page)

    await Promise.all(net.pending)
    const { pending: _p, ...netSummary } = net
    console.log(`AICWITNESS served-c673223 ${tag} ${JSON.stringify({ seededNodes: seeded.nodeCount, dockMovedOffChat, onArrival, settled: settledRead, opened, afterAction, net: netSummary })}`)

    // Turns: opening, ONE run, ONE card action carrying the producer's prompt verbatim.
    expect(net.turns.map((t) => t.answeredWith)).toEqual(['opening', 'run', 'card_action'])
    expect(net.turns[2]!.message).toBe(CARD.action_prompt)
    expect(dockMovedOffChat).toBe(false)

    // The reply renders in full; nothing hides it; no fabricated chip; no leader designated.
    expect(settledRead.replyText).toContain(FIRST_SENTENCE_START)
    expect(settledRead.replyText).toContain(LAST_SENTENCE)
    expect(settledRead.replyWords).toBe(93)
    expect(settledRead.showMoreToggle).toBe(false)
    expect(settledRead.suggestedChips).toBe(0)
    expect(settledRead.leaderDesignations).toBe(0)

    // The card: one closed line with the producer title; CURRENT; the store holds the run as current.
    expect(settledRead.line).toMatchObject({ present: true, open: false, summary: CARD.title, visible: true })
    expect(settledRead.card.currency).toBe('current')
    expect(settledRead.store).toMatchObject({ runStateKind: 'complete_current', computedAt: CARD.created_at, currentGraphHash: CARD.graph_hash_at_generation, dirty: false })

    // Opened: body + action verbatim, no notice, action live; one click, one turn, then settled.
    expect(opened.line.open).toBe(true)
    expect(opened.card).toMatchObject({ currency: 'current', notice: null, body: CARD.body, actionText: CARD.action_label, actionDisabled: false, actionInert: null, actionVisible: true })
    expect(afterAction.card.actionDisabled).toBe(true)

    assertNoModelCalls(net)
  })
}
