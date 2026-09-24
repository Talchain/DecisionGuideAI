/**
 * #1973 — served-browser witness: a "Run analysis" suggested chip SHOWS the run
 * gate instead of refusing after the click.
 *
 * Named `*.measure.ts` because `playwright.aiconversation.config.ts` collects
 * `testMatch: '**\/*.measure.ts'` only.
 *
 *   GEOMETRY_PORT=5297 PW_CHROMIUM_PATH=/opt/pw-browsers/chromium \
 *     pnpm exec playwright test -c playwright.aiconversation.config.ts runChipGate
 *
 * WHAT IS REAL: the whole app on `/#/canvas`, served by local vite. The graph is
 * a captured CEE draft applied by the product's own `applyDraftResult`. The chat
 * is the docked Olumi tab — the app's own `ConversationPanel` on the app's own
 * `useConversation` singleton — driven by typing in its composer and clicking
 * its chips. The gate is the panel's own `canRunAnalysis` verdict. A dispatched
 * run is the hook's real `dispatchAction` → `callV5Turn` → `fetch`.
 *
 * ⛔ NO MODEL CALLS. Every `/proxy/v5/turn` POST is fulfilled here from
 * `runChipGateFixtures.ts`, and so is every `/bff/cee/graph-readiness` POST
 * (the readiness verdict is the gate input that differs between the two
 * states). Every other `/bff` / `/api` call is answered in-page by the
 * harness's hermetic 503 (`preparePage`). Every non-localhost request is
 * ABORTED, Google Fonts included. Each test asserts that 0 off-origin requests
 * got a response.
 *
 * The CLOSED state is readiness `can_run_analysis: false` (one owed repair) —
 * the "readiness can_run_analysis:false" rung. The OPEN state is the same
 * journey with `can_run_analysis: true`. Each state is a fresh page, so no
 * verdict leaks from one into the other.
 */
import { test, expect, type Page } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { clearNotifications, openCanvas, preparePage, seedStarterDraft } from '../visual/harness'
import { repoRoot } from '../visual/repoRoot'
import {
  OPENING_MESSAGE,
  OWED_REPAIR_SENTENCE,
  READINESS_BLOCKED,
  READINESS_READY,
  RUN_CHIP,
  STARTER,
  TALK_CHIP,
  TURN_TEXT,
  turnReply,
  type TurnKind,
} from './runChipGateFixtures'

const VP = { width: 1280, height: 800 }

// ── Network: log + count everything; fulfil turns + readiness from fixtures; abort off-origin ──

interface TurnRecord {
  seq: number
  /** Which fixture answered it; `unexpected` = none did (the test fails on it). */
  answeredWith: TurnKind | 'unexpected'
  isRun: boolean
  kind: unknown
  source: unknown
  message: unknown
  chip: unknown
}

interface NetLog {
  total: number
  local: number
  inline: number
  /** Off-origin requests the PAGE ATTEMPTED (the `request` event fires before routing). */
  nonLocal: string[]
  /** …of which the route handler aborted. Must equal `nonLocal`. */
  aborted: string[]
  /** Off-origin requests that got a RESPONSE, i.e. actually left the machine. Must be empty. */
  nonLocalCompleted: string[]
  turns: TurnRecord[]
  /** `/proxy/v5/turn/*` (stream, stop). None expected; aborted if seen. */
  turnSubpaths: string[]
  readinessServed: string[]
  /** How each other `/bff|/api|/proxy` call was answered (`hermetic` = the harness's in-page 503). */
  backendAnswers: string[]
  websockets: string[]
  pending: Array<Promise<void>>
}

const isLocalHost = (h: string) => h === 'localhost' || h === '127.0.0.1' || h === '[::1]'
const TOLERATED_ABORTED_HOSTS = new Set(['fonts.googleapis.com', 'fonts.gstatic.com'])

function classifyTurn(body: Record<string, unknown> | null): TurnKind | 'unexpected' {
  const chip = (body?.chip ?? null) as { action_type?: unknown } | null
  if (chip?.action_type === 'run_analysis') return 'run'
  if (body?.message === TALK_CHIP.message) return 'explain'
  if (body?.message === OPENING_MESSAGE) return 'opening'
  return 'unexpected'
}

async function installWitnessNetwork(
  page: Page,
  readiness: { name: string; body: Record<string, unknown> },
): Promise<NetLog> {
  const log: NetLog = {
    total: 0, local: 0, inline: 0, nonLocal: [], aborted: [], nonLocalCompleted: [],
    turns: [], turnSubpaths: [], readinessServed: [], backendAnswers: [], websockets: [], pending: [],
  }
  page.on('request', (req) => {
    log.total++
    const u = new URL(req.url())
    if (u.protocol === 'data:' || u.protocol === 'blob:') log.inline++
    else if (isLocalHost(u.hostname)) log.local++
    else log.nonLocal.push(req.url())
  })
  page.on('response', (res) => {
    const u = new URL(res.url())
    if (u.protocol !== 'data:' && u.protocol !== 'blob:' && !isLocalHost(u.hostname)) log.nonLocalCompleted.push(res.url())
    const fixtureServed = u.pathname === '/proxy/v5/turn' || u.pathname === '/bff/cee/graph-readiness'
    if (/^\/(bff|api|proxy)\//.test(u.pathname) && !fixtureServed) {
      const tag = `${res.status()} ${res.request().method()} ${u.pathname}`
      log.pending.push(
        res.text()
          .then((body) => { log.backendAnswers.push(`${tag} ${body.includes('visreg_hermetic') ? 'hermetic' : 'NOT-HERMETIC'}`) })
          .catch(() => { log.backendAnswers.push(`${tag} body-unreadable`) }),
      )
    }
  })
  page.on('websocket', (ws) => log.websockets.push(ws.url()))
  // Registered AFTER preparePage's hermetic routes, so it runs FIRST.
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
      log.turns.push({
        seq: log.turns.length + 1,
        answeredWith,
        isRun: answeredWith === 'run',
        kind: body?.kind, source: body?.source, message: body?.message, chip: body?.chip ?? null,
      })
      if (answeredWith === 'unexpected') {
        return route.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"witness: no fixture for this turn"}' })
      }
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(turnReply(answeredWith)) })
    }
    if (u.pathname.startsWith('/proxy/v5/turn/')) {
      log.turnSubpaths.push(`${req.method()} ${u.pathname}`)
      return route.abort('blockedbyclient')
    }
    if (u.pathname === '/bff/cee/graph-readiness') {
      log.readinessServed.push(readiness.name)
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(readiness.body) })
    }
    return route.fallback()
  })
  return log
}

function evidencePath(name: string): string {
  const dir = process.env.WITNESS_OUT_DIR ?? join(repoRoot(), 'e2e', 'ai-conversation', 'evidence')
  mkdirSync(dir, { recursive: true })
  return join(dir, name)
}

// ── The journey both states share: a real graph, the docked Olumi tab, one typed message ──

async function openChatOnSeededModel(page: Page): Promise<{ nodeCount: number }> {
  await openCanvas(page)
  const seeded = await seedStarterDraft(page, STARTER)
  await clearNotifications(page)
  await page.getByTestId('outputs-dock-tab-olumi').click()
  const composer = page.getByTestId('ai-input-bar-strip-textarea')
  await expect(composer).toBeVisible()
  await composer.fill(OPENING_MESSAGE)
  await composer.press('Enter')
  await expect(page.getByText(TURN_TEXT.opening, { exact: true })).toBeVisible()
  await expect(page.getByTestId(`suggested-chip-${RUN_CHIP.id}`)).toBeVisible()
  return { nodeCount: seeded.nodeCount }
}

interface ChipReading {
  runChip: {
    text: string | null
    disabled: boolean | null
    ariaDisabled: string | null
    runGated: string | null
    describedBy: string | null
    describedByResolvesToReason: boolean
    focusable: boolean
  }
  talkChip: { text: string | null; disabled: boolean | null; ariaDisabled: string | null; runGated: string | null }
  reason: { count: number; id: string | null; text: string | null; visible: boolean; belowChipRow: boolean | null }
  /** The dock's own Analyse control, read beside the chip — the SAME gate on another surface. */
  dockAnalyse: { present: boolean; disabled: boolean | null; reasonText: string | null }
  toasts: string[]
  userBubbles: string[]
  readinessStore: { canRun: boolean | null; stale: boolean | null; issues: string[] }
}

async function readChips(page: Page): Promise<ChipReading> {
  return page.evaluate(async ({ runId, talkId }) => {
    const visible = (n: Element | null) => {
      if (!n) return false
      const r = (n as HTMLElement).getBoundingClientRect()
      const cs = getComputedStyle(n as HTMLElement)
      return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none'
    }
    const run = document.querySelector(`[data-testid="suggested-chip-${runId}"]`) as HTMLButtonElement | null
    const talk = document.querySelector(`[data-testid="suggested-chip-${talkId}"]`) as HTMLButtonElement | null
    const reasons = [...document.querySelectorAll('[data-testid="suggested-chips-run-gate-reason"]')]
    const reason = (reasons[0] as HTMLElement | undefined) ?? null
    const describedBy = run?.getAttribute('aria-describedby') ?? null
    const described = describedBy ? document.getElementById(describedBy) : null
    const row = run?.parentElement ?? null
    let focusable = false
    if (run) { run.focus(); focusable = document.activeElement === run; run.blur() }
    const dockBtn = document.querySelector('[data-testid="analysis-readiness-bar-analyse"]') as HTMLButtonElement | null
    const dockReason = document.querySelector('[data-testid="analysis-readiness-bar-reason"]')
    const region = document.querySelector('[role="region"][aria-label="Notifications"]')
    const bubbles = [...document.querySelectorAll('[data-testid="chat-message-user"]')].map(
      (b) => (b.querySelector('[data-testid="message-body-text"]') ?? b).textContent?.trim() ?? '',
    )
    const storePath = '/src/canvas/stores/readinessStore.ts'
    const rs = (await import(/* @vite-ignore */ storePath)) as {
      useReadinessStore: { getState: () => { readiness: { can_run_analysis?: boolean; readiness_issues?: Array<{ message: string }> } | null; stale: boolean } }
    }
    const r = rs.useReadinessStore.getState()
    return {
      runChip: {
        text: run?.textContent?.trim() ?? null,
        disabled: run ? run.disabled : null,
        ariaDisabled: run?.getAttribute('aria-disabled') ?? null,
        runGated: run?.getAttribute('data-run-gated') ?? null,
        describedBy,
        describedByResolvesToReason: Boolean(described && reason && described === reason),
        focusable,
      },
      talkChip: {
        text: talk?.textContent?.trim() ?? null,
        disabled: talk ? talk.disabled : null,
        ariaDisabled: talk?.getAttribute('aria-disabled') ?? null,
        runGated: talk?.getAttribute('data-run-gated') ?? null,
      },
      reason: {
        count: reasons.length,
        id: reason?.id ?? null,
        text: reason?.textContent?.trim() ?? null,
        visible: visible(reason),
        belowChipRow: reason && row ? reason.getBoundingClientRect().top >= row.getBoundingClientRect().bottom - 1 : null,
      },
      dockAnalyse: {
        present: Boolean(dockBtn),
        disabled: dockBtn ? dockBtn.disabled : null,
        reasonText: dockReason?.textContent?.trim() ?? null,
      },
      toasts: region ? [...region.children].map((c) => c.textContent?.trim() ?? '').filter(Boolean) : [],
      userBubbles: bubbles,
      readinessStore: {
        canRun: r.readiness?.can_run_analysis ?? null,
        stale: r.stale,
        issues: (r.readiness?.readiness_issues ?? []).map((i) => i.message),
      },
    }
  }, { runId: RUN_CHIP.id, talkId: TALK_CHIP.id })
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

function summarise(net: NetLog): Record<string, unknown> {
  const { pending: _pending, ...rest } = net
  const count = (xs: string[]) => xs.reduce<Record<string, number>>((m, x) => ({ ...m, [x]: (m[x] ?? 0) + 1 }), {})
  return { ...rest, backendAnswers: count(net.backendAnswers), readinessServed: count(net.readinessServed) }
}

const settle = (page: Page) => page.waitForTimeout(1_500)

// ────────────────────────────────────────────────────────────────────────────

test('Run chip — gate CLOSED (readiness can_run_analysis:false): disabled, reason shown + described, no run on any click; the talk chip stays live', async ({ page }) => {
  await preparePage(page, VP)
  const net = await installWitnessNetwork(page, { name: 'READINESS_BLOCKED', body: READINESS_BLOCKED })
  const { nodeCount } = await openChatOnSeededModel(page)

  const runChip = page.getByTestId(`suggested-chip-${RUN_CHIP.id}`)
  const reason = page.getByTestId('suggested-chips-run-gate-reason')
  // The verdict can read "stale" for one debounce after the turn creates the
  // scenario; wait for the fixture's answer to be the one in force.
  await expect(reason).toHaveText(OWED_REPAIR_SENTENCE)
  await expect(runChip).toBeDisabled()
  const before = await readChips(page)

  await page.screenshot({ path: evidencePath('07-runchip-gate-closed.png') })
  await page.getByTestId('response-chip-group').last().screenshot({ path: evidencePath('07-runchip-gate-closed-crop.png') })

  // ── Try to start the run anyway: forced pointer click, then DOM click + synthetic event ──
  const attempts: string[] = []
  await runChip.click({ force: true, timeout: 5_000 })
  attempts.push('playwright click({ force: true })')
  await settle(page)
  await runChip.evaluate((b) => (b as HTMLButtonElement).click())
  attempts.push('HTMLElement.click()')
  await runChip.evaluate((b) => b.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })))
  attempts.push('dispatchEvent(new MouseEvent("click"))')
  await settle(page)
  const afterForced = await readChips(page)
  const runTurnsAfterForced = net.turns.filter((t) => t.isRun).length
  const turnsAfterForced = net.turns.length

  // ── The chip beside it is live: click it, it sends its turn; the Run chip on the reply is still gated ──
  const talkChip = page.getByTestId(`suggested-chip-${TALK_CHIP.id}`)
  await expect(talkChip).toBeEnabled()
  await talkChip.click({ timeout: 5_000 })
  await expect(page.getByText(TURN_TEXT.explain, { exact: true })).toBeVisible()
  await expect(runChip).toBeVisible()
  await expect(reason).toHaveText(OWED_REPAIR_SENTENCE)
  await settle(page)
  const afterTalk = await readChips(page)

  await Promise.all(net.pending)
  console.log(`AICWITNESS runchip-gate-closed ${JSON.stringify({ nodeCount, before, attempts, afterForced, runTurnsAfterForced, turnsAfterForced, afterTalk, net: summarise(net) })}`)

  // The chip as rendered with the gate closed.
  expect(before.runChip.text).toBe(RUN_CHIP.label)
  expect(before.runChip.disabled).toBe(true)
  expect(before.runChip.ariaDisabled).toBe('true')
  expect(before.runChip.runGated).toBe('true')
  expect(before.runChip.focusable, 'a disabled chip takes no focus, so no keyboard activation').toBe(false)
  // The gate's own sentence, visible under the row, and the chip's accessible description.
  expect(before.reason.count).toBe(1)
  expect(before.reason.text).toBe(OWED_REPAIR_SENTENCE)
  expect(before.reason.visible).toBe(true)
  expect(before.reason.belowChipRow).toBe(true)
  expect(before.runChip.describedBy).toBeTruthy()
  expect(before.runChip.describedBy).toBe(before.reason.id)
  expect(before.runChip.describedByResolvesToReason).toBe(true)
  // The input that closed it is the fixture's, and it is the one in force.
  expect(before.readinessStore.canRun).toBe(false)
  expect(before.readinessStore.issues).toEqual([OWED_REPAIR_SENTENCE])
  // The chip beside it answers to no gate.
  expect(before.talkChip.text).toBe(TALK_CHIP.label)
  expect(before.talkChip.disabled).toBe(false)
  expect(before.talkChip.ariaDisabled).toBe('false')
  expect(before.talkChip.runGated).toBeNull()

  // No click started a run, and none produced a refusal-after-the-fact toast.
  expect(runTurnsAfterForced).toBe(0)
  expect(turnsAfterForced).toBe(1)
  expect(afterForced.runChip.disabled).toBe(true)
  expect(afterForced.toasts.filter((t) => t.includes(OWED_REPAIR_SENTENCE))).toEqual([])
  expect(afterForced.userBubbles).toEqual([OPENING_MESSAGE])

  // The talk chip dispatched its own (non-run) turn; the reply's Run chip is gated again.
  expect(net.turns.map((t) => t.answeredWith)).toEqual(['opening', 'explain'])
  expect(net.turns.filter((t) => t.isRun)).toEqual([])
  expect(afterTalk.userBubbles).toEqual([OPENING_MESSAGE, TALK_CHIP.label])
  expect(afterTalk.runChip.disabled).toBe(true)
  expect(afterTalk.runChip.runGated).toBe('true')
  expect(afterTalk.reason.text).toBe(OWED_REPAIR_SENTENCE)

  assertNoModelCalls(net)
})

test('Run chip — gate OPEN (readiness can_run_analysis:true): enabled, no reason; one click = exactly one run, echoed with the chip\'s own label', async ({ page }) => {
  await preparePage(page, VP)
  const net = await installWitnessNetwork(page, { name: 'READINESS_READY', body: READINESS_READY })
  const { nodeCount } = await openChatOnSeededModel(page)

  const runChip = page.getByTestId(`suggested-chip-${RUN_CHIP.id}`)
  await expect(runChip).toBeEnabled()
  await expect.poll(async () => (await readChips(page)).readinessStore.canRun).toBe(true)
  await settle(page)
  const before = await readChips(page)

  await page.screenshot({ path: evidencePath('07-runchip-gate-open.png') })
  await page.getByTestId('response-chip-group').last().screenshot({ path: evidencePath('07-runchip-gate-open-crop.png') })

  await runChip.click({ timeout: 5_000 })
  await expect(page.getByText(TURN_TEXT.run, { exact: true })).toBeVisible()
  // Give a second dispatch every chance to happen before counting.
  await settle(page)
  await settle(page)
  const after = await readChips(page)

  await page.screenshot({ path: evidencePath('07-runchip-gate-open-dispatched.png') })
  await page.getByTestId('chat-thread').screenshot({ path: evidencePath('07-runchip-gate-open-dispatched-crop.png') })

  await Promise.all(net.pending)
  console.log(`AICWITNESS runchip-gate-open ${JSON.stringify({ nodeCount, before, after, net: summarise(net) })}`)

  // The chip as rendered with the gate open.
  expect(before.runChip.text).toBe(RUN_CHIP.label)
  expect(before.runChip.disabled).toBe(false)
  expect(before.runChip.ariaDisabled).toBe('false')
  expect(before.runChip.runGated).toBeNull()
  expect(before.runChip.describedBy).toBeNull()
  expect(before.reason.count).toBe(0)
  expect(before.talkChip.disabled).toBe(false)
  expect(before.readinessStore.canRun).toBe(true)

  // Exactly one run, carrying the canonical run action; the bubble echoes the CHIP.
  const runs = net.turns.filter((t) => t.isRun)
  expect(runs).toHaveLength(1)
  expect(runs[0]).toMatchObject({ kind: 'message', message: RUN_CHIP.message, chip: { action_type: 'run_analysis' } })
  expect(net.turns.map((t) => t.answeredWith)).toEqual(['opening', 'run'])
  expect(after.userBubbles).toEqual([OPENING_MESSAGE, RUN_CHIP.label])

  assertNoModelCalls(net)
})
