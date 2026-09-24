/**
 * #1968 — served-browser witness: the run-turn coaching card's currency notice
 * and action chip, in the real chat, fed the producer's v3 golden payload.
 *
 * Named `*.measure.ts` because `playwright.aiconversation.config.ts` collects
 * `testMatch: '**\/*.measure.ts'` only.
 *
 *   GEOMETRY_PORT=5297 WITNESS_OUT_DIR=<dir> PW_CHROMIUM_PATH=/opt/pw-browsers/chromium \
 *     pnpm exec playwright test -c playwright.aiconversation.config.ts runTurnCard
 *
 * ⛔ NO MODEL CALLS. Every `/proxy/v5/turn` request is fulfilled here from the
 * fixture (`runTurnEnvelopes.ts`); every request to a non-localhost host is
 * ABORTED and recorded; every request is logged and counted, and each test
 * asserts the non-localhost count is zero. (The dev server's proxy targets are
 * the discard port too — see the config.)
 *
 * Promotion is OFF (`RUN_TURN_COACHING_PROMOTION_ENABLED = false`), so the card
 * renders as a collapsed coaching line; the test opens every disclosure with a
 * real click before photographing and reading it.
 */
import { test, expect, type Page } from '@playwright/test'
import { mkdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { openCanvas, preparePage } from '../visual/harness'
import { repoRoot } from '../visual/repoRoot'
import {
  EDITED_GRAPH_HASH,
  LATER_RUN_AT,
  laterTurnEnvelope,
  producerCard,
  runTurnEnvelope,
  type ProducerV3Payload,
  type RunCardState,
} from './runTurnEnvelopes'

const VP = { width: 1280, height: 800 }
const PROBE = '/e2e/ai-conversation/runTurnCardProbe.ts'
const FIXTURE = join(
  repoRoot(),
  'src/canvas/conversation/__tests__/fixtures/run-turn-coaching-fragile-link.producer-v3.json',
)
const producer = JSON.parse(readFileSync(FIXTURE, 'utf8')) as ProducerV3Payload
const CARD = producerCard(producer)
const RUN_HASH = String(CARD.graph_hash_at_generation)
const RUN_AT = String(CARD.created_at)

// The exact sentences the brief names (not imported: the witness checks the copy, it does not borrow it).
const EARLIER_RUN = 'Written about an earlier run of this model — the latest run may point somewhere else.'
const MODEL_CHANGED = 'Your model has changed since this was written — it may no longer apply.'
const EARLIER_ANALYSIS = 'Written about an earlier analysis — re-run to check it still holds.'

interface Case {
  state: RunCardState
  notice: string | null
  disabled: boolean
  reason: string | null
  runStateKind: string
  runComputedAt: string | null
  currentGraphHash: string
}

const CASES: Case[] = [
  { state: 'current', notice: null, disabled: false, reason: null, runStateKind: 'complete_current', runComputedAt: RUN_AT, currentGraphHash: RUN_HASH },
  { state: 'later_run', notice: EARLIER_RUN, disabled: true, reason: 'earlier_run', runStateKind: 'complete_current', runComputedAt: LATER_RUN_AT, currentGraphHash: RUN_HASH },
  { state: 'model_changed', notice: MODEL_CHANGED, disabled: true, reason: 'model_changed', runStateKind: 'complete_stale', runComputedAt: RUN_AT, currentGraphHash: EDITED_GRAPH_HASH },
  { state: 'not_current', notice: EARLIER_ANALYSIS, disabled: true, reason: 'earlier_analysis', runStateKind: 'running', runComputedAt: null, currentGraphHash: RUN_HASH },
]

// ── Network: log + count everything; fulfil turns from the fixture; abort off-origin ──

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
  turnFulfilled: string[]
  backendPaths: string[]
  /**
   * How each non-turn `/bff|/api|/proxy` call was answered. The harness's
   * hermetic routes fulfil them in-page with a fixed 503 whose body names
   * `visreg_hermetic` — so `hermetic` proves the call never reached the dev
   * server's proxy (whose targets are the discard port anyway).
   */
  backendAnswers: string[]
  websockets: string[]
  /** Body reads still in flight; awaited before the log is read. */
  pending: Array<Promise<void>>
}

const isLocalHost = (h: string) => h === 'localhost' || h === '127.0.0.1' || h === '[::1]'
/**
 * The ONLY off-origin attempts this page is allowed to make: `index.html` links
 * the Inter webfont stylesheet from Google Fonts. The handler aborts it like
 * any other off-origin request; it is named here so that ANY other host —
 * a CEE/PLoT/ISL host, a model provider — fails the test outright.
 */
const TOLERATED_ABORTED_HOSTS = new Set(['fonts.googleapis.com', 'fonts.gstatic.com'])

async function installWitnessNetwork(page: Page): Promise<NetLog> {
  const log: NetLog = { total: 0, local: 0, inline: 0, nonLocal: [], aborted: [], nonLocalCompleted: [], turnFulfilled: [], backendPaths: [], backendAnswers: [], websockets: [], pending: [] }
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
    if (/^\/(bff|api|proxy)\//.test(u.pathname) && u.pathname !== '/proxy/v5/turn') {
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
      const which = u.searchParams.get('witness')
      const body = which === 'run'
        ? runTurnEnvelope(producer)
        : laterTurnEnvelope(producer, u.searchParams.get('state') as RunCardState)
      if (!body) return route.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"witness: no envelope"}' })
      log.turnFulfilled.push(`${req.method()} ${u.pathname}${u.search}`)
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })
    }
    if (/^\/(bff|api|proxy)\//.test(u.pathname)) log.backendPaths.push(`${req.method()} ${u.pathname}`)
    return route.fallback()
  })
  return log
}

function outPath(info: { outputPath: (...p: string[]) => string }, name: string): string {
  const dir = process.env.WITNESS_OUT_DIR
  if (!dir) return info.outputPath(name)
  mkdirSync(dir, { recursive: true })
  return join(dir, name)
}

for (const c of CASES) {
  test(`run-turn coaching card — ${c.state}`, async ({ page }, info) => {
    await preparePage(page, VP)
    const net = await installWitnessNetwork(page)
    await openCanvas(page)

    const r = await page.evaluate(
      async ([p, st]) => (await import(/* @vite-ignore */ p)).renderRunTurn(st),
      [PROBE, c.state] as const,
    )
    expect(r.cardId, 'the producer card must reach the chat through the shipped chain').toBe(String(CARD.block_id))
    const cardId = r.cardId as string

    // ── Open every disclosure between the reader and the card, with real clicks ──
    const clicks: string[] = []
    if (!r.initially.cardInDom) {
      const toggle = page.getByTestId('block-detail-toggle')
      if ((await toggle.count()) > 0) {
        await toggle.click()
        clicks.push(`block-detail-toggle ("${r.initially.detailToggle}")`)
      }
    }
    const line = page.getByTestId(`coaching-line-${cardId}`)
    if ((await line.count()) > 0 && !(await line.evaluate((d) => (d as HTMLDetailsElement).open))) {
      await page.getByTestId(`coaching-line-summary-${cardId}`).click()
      clicks.push('coaching-line-summary')
    }
    await page.evaluate(async ([p, id]) => (await import(/* @vite-ignore */ p)).scrollCardIntoView(id), [PROBE, cardId] as const)

    const reading = await page.evaluate(
      async ([p, id]) => (await import(/* @vite-ignore */ p)).readRunCard(id),
      [PROBE, cardId] as const,
    )
    await page.locator('#aic-host').screenshot({ path: outPath(info, `06-runcard-${c.state}.png`) })
    await page.locator(`#aic-host [data-block-id="${cardId}"]`).screenshot({ path: outPath(info, `06-runcard-${c.state}-card.png`) })

    // ── Activate the chip like a user: live ⇒ one dispatch; inert ⇒ none ──
    const chip = page.locator(`#aic-host [data-block-id="${cardId}"] [data-testid="v5-coaching-action"]`)
    await chip.click(c.disabled ? { force: true, timeout: 5_000 } : { timeout: 5_000 })
    const after = await page.evaluate(
      async ([p, id]) => (await import(/* @vite-ignore */ p)).readRunCard(id),
      [PROBE, cardId] as const,
    )

    await Promise.all(net.pending)
    const { pending: _pending, ...netSummary } = net
    console.log(`AICWITNESS runcard-${c.state} ${JSON.stringify({ render: r, clicks, reading, afterClick: { chipDisabled: after.chipDisabled, dispatched: after.dispatched }, net: netSummary })}`)

    // Ingestion: the producer's run identity survived the chain; the store holds this state's verdict.
    expect(r.promotionEnabled, 'promotion ships OFF').toBe(false)
    expect(r.adapted).toMatchObject({ source_handler: 'run_analysis', created_at: RUN_AT, graph_hash_at_generation: RUN_HASH, freshness: 'fresh' })
    expect(r.runTurnApplied).toContain('analysis_state:set')
    if (c.state !== 'current') expect(r.laterTurnApplied).toContain('analysis_state:set')
    expect((r.store.runState as { kind?: string } | null)?.kind).toBe(c.runStateKind)
    expect((r.store.runState as { computed_at?: string } | null)?.computed_at ?? null).toBe(c.runComputedAt)
    expect(r.store.currentGraphHash).toBe(c.currentGraphHash)

    // The card as rendered.
    expect(reading.cardInDom).toBe(true)
    expect(reading.lineOpen).not.toBe(false)
    expect(reading.chipTag).toBe('BUTTON')
    expect(reading.chipText).toBe(String(CARD.action_label))
    expect(reading.chipVisible).toBe(true)
    expect(reading.runTurnReason).toBe(c.reason)
    expect(reading.noticeText).toBe(c.notice)
    expect(reading.noticeVisible).toBe(c.notice !== null)
    expect(reading.chipDisabled).toBe(c.disabled)
    if (c.disabled) {
      expect(reading.chipInert).toBe('true')
      expect(reading.chipDescribedBy).toBeTruthy()
      expect(reading.chipDescribedBy).toBe(reading.noticeId)
      expect(reading.describedByResolvesToNotice).toBe(true)
    } else {
      expect(reading.chipDescribedBy).toBeNull()
    }
    expect.soft(reading.hostScrollWidthOverflow, 'no horizontal overflow in the dock').toBeLessThanOrEqual(0)

    // The click.
    if (c.disabled) {
      expect(after.dispatched).toEqual([])
    } else {
      expect(after.dispatched).toEqual([{ label: String(CARD.action_label), message: String(CARD.action_prompt) }])
    }

    // No model calls: nothing left localhost; every off-origin attempt was aborted
    // by the handler and was the webfont stylesheet; the turns came from the fixture.
    expect(net.nonLocalCompleted, 'no off-origin request may get a response').toEqual([])
    expect([...net.aborted].sort()).toEqual([...net.nonLocal].sort())
    expect(net.nonLocal.filter((u) => !TOLERATED_ABORTED_HOSTS.has(new URL(u).hostname))).toEqual([])
    expect(net.turnFulfilled).toHaveLength(c.state === 'current' ? 1 : 2)
    expect(net.backendAnswers.filter((a) => !a.endsWith(' hermetic')), 'every backend call answered in-page').toEqual([])
  })
}
