/**
 * WITNESS — does a `run_delta` reach the UI after a deliberate change?
 *
 * ⭐ THE OUTCOME CLAUSE. *"a person understands a consequential uncertainty, can
 * act on it from the Panel, and can SEE THAT THE RESULTING MODEL AND
 * EXPLANATION REFLECT THEIR DELIBERATE CHANGE."* Clauses 1 and 2 shipped. The
 * third rests entirely on `run_delta`, and the UI half is BUILT: responseParser
 * -> applyV5State:2297 -> store.runDelta -> buildAnalysisNewViewModel ->
 * WhatsChanged (AnalysisNewTabBody:1484), plus ViewComparisonPointer on Model.
 * Read on the DEPLOYED bundle the slice is live and empty (`runDelta: null`).
 * The question is not whether the UI can HOLD one — it is whether one ARRIVES.
 *
 * ⛔⛔ ABSENCE IS NOT A DIAGNOSIS. `buildRunDelta` withholds on five internal
 * reasons before the classifier is consulted, `attachRunDelta` strips on
 * withheld run identity, and `priorFacts` may not be in scope — SEVEN
 * conditions, byte-identical silence, reason CEE-internal. An absence seen from
 * a browser is *"absent, reason not determinable from here"*. The six bespoke
 * probes before this one did not fail by stopping; they failed by reporting a
 * true STOP with a FALSE CAUSE.
 *
 * ⭐ SO IT SEPARATES THE TWO HALVES, which have OPPOSITE remedies:
 *     on the wire, not in the store -> a UI defect, ours, fixable here
 *     not on the wire               -> a CEE question, not answerable here
 * `WireCall` carries only {url, method, status}, so the body capture is this
 * spec's own; without it the halves are indistinguishable.
 *
 * ── FIVE STOPS, EVERY ONE THE INSTRUMENT'S, EVERY ONE FIXED BELOW ──────────
 *  1. asked for `btn-run-analysis`; the control is **"Analyse first pass"**.
 *  2. read a button's label AFTER clicking it — it unmounts when the run
 *     starts, so the read could only hang BECAUSE the click worked. The worst
 *     direction for an instrument to fail in: it looks like a product hang.
 *  3. waited for `analysis-new-options` WITHOUT OPENING THE REASONING TAB,
 *     where alone it mounts. A completed run gives identical silence.
 *  4. `.first()` on the editable rows — they are NOT homogeneous: a banded row
 *     never renders the free-value `-input` the probe waited for.
 *  5. lived uncommitted, and vanished across a branch switch mid-run.
 *
 * Stage markers derive every message from the LAST SUCCESSFUL STAGE, never
 * hardcoded at the throw site.
 *
 * ⚠ NOT IN CI, deliberately — minutes-long, and the question is not one a
 * per-PR gate can settle.  `npx playwright test --config=playwright.witness.config.ts`
 */
import { test, expect } from '@playwright/test'
import {
  ORIGIN,
  draftAsGuest,
  installWireInterceptor,
  openDockTab,
  deployedBuild,
} from '../core/lib/harness'

const STAGES: string[] = []
const mark = (s: string): void => {
  STAGES.push(s)
  // eslint-disable-next-line no-console
  console.warn(`[stage] ${s}`)
}
const lastStage = (): string => (STAGES.length > 0 ? STAGES[STAGES.length - 1] : '(nothing succeeded)')
const stop = (what: string): never => {
  throw new Error(`STAGE-STOP: ${what}\nLAST SUCCESSFUL: ${lastStage()}\nALL: ${STAGES.join(' | ')}`)
}

test('WITNESS run_delta after a deliberate change', async ({ page }) => {
  /**
   * ⚠ NOT GENEROUS. A 25-minute ceiling let a single unsettleable click consume
   * the entire run in silence; every long wait below is now bounded at its own
   * step, so the ceiling only has to cover two real analyses.
   */
  test.setTimeout(1_200_000)

  /** ⚠ BODIES, NOT JUST URLS — the harness records neither body nor payload. */
  await page.addInitScript(() => {
    const W = window as unknown as { __BODIES__: Array<{ url: string; hasDelta: boolean; bytes: number }> }
    W.__BODIES__ = []
    const orig = window.fetch
    window.fetch = async (...args: Parameters<typeof fetch>) => {
      const res = await orig(...args)
      const url = typeof args[0] === 'string' ? args[0] : String((args[0] as Request)?.url ?? '')
      if (/\/turn/.test(url)) {
        try {
          const text = await res.clone().text()
          W.__BODIES__.push({ url, hasDelta: text.includes('"run_delta"'), bytes: text.length })
        } catch { /* an unclonable stream shows up as a missing entry below */ }
      }
      return res
    }
  })
  await installWireInterceptor(page)
  mark(`interceptor installed (build ${await deployedBuild()})`)

  await draftAsGuest(page)
  mark('drafted')

  // ── FIRST RUN ────────────────────────────────────────────────────────────
  const run = page.getByRole('button', { name: /analyse/i })
  if ((await run.count()) === 0) {
    const names = await page.getByRole('button').evaluateAll((els) =>
      els.map((e) => (e as HTMLElement).innerText || e.getAttribute('aria-label') || '').filter(Boolean),
    )
    stop(`no run affordance after the draft settled. Buttons: ${names.join(' | ')}`)
  }
  const runLabel = await run.first().innerText() // BEFORE the click — stop #2
  await run.first().click()
  mark(`first run dispatched (${runLabel})`)

  await openDockTab(page, 'Reasoning') // stop #3
  mark('reasoning tab opened')

  await page
    .getByTestId('analysis-new-options')
    .waitFor({ timeout: 900_000 })
    .catch(() => stop('no completed first run on the REASONING tab (opened above)'))
  mark('first run complete')

  // ── THE DELIBERATE CHANGE ────────────────────────────────────────────────
  await openDockTab(page, 'Model')
  for (const t of await page.locator('[data-testid^="model-group-v2-"][data-testid$="-toggle"]').all()) {
    if ((await t.getAttribute('aria-expanded')) === 'false') await t.click()
  }
  mark('model groups expanded')

  /**
   * ⛔ ROW BY ROW, NOT `.first()` — stop #4. A free-value row opens a text
   * `-input`; a banded row offers `-band-<n>` instead. Taking whichever row the
   * layout puts first picks the question node on some drafts and then waits out
   * the clock for an input that row never renders. It also REPORTS what it
   * tried, so a reader can tell a missing affordance from a badly-chosen one.
   */
  const editable = page.locator('button[data-testid$="-value"][aria-label^="Change "]')
  const n = await editable.count()
  if (n === 0) stop('no editable value control on the Model tab after the first run')

  /**
   * ⛔⛔ THE LOOP NOW SPANS ALL THREE BEATS, NOT JUST THE FIRST. Stopping the
   * search at "an input opened" picked the QUESTION node — its editor opens and
   * then offers no `Review change`, so the probe sat on a click that could
   * never settle, burning the whole test timeout on a row that was never the
   * arm to drive. Opening an editor is NOT evidence the row supports the edit.
   *
   * ⭐ THE GENERAL RULE, and it is the fourth face of the same mistake in this
   * file: A ROW THAT ANSWERS THE FIRST BEAT IS NOT THEREFORE THE RIGHT ROW.
   * Qualify a candidate against the WHOLE journey it has to complete, and move
   * on the moment it fails — cheaply, with a short timeout, reporting why.
   *
   * ⚠ SHORT WAITS INSIDE THE SEARCH, DELIBERATELY. A generous timeout here is
   * not patience, it is a probe that cannot change its mind.
   */
  const tried: string[] = []
  let rowId: string | null = null
  for (let i = 0; i < n && rowId === null; i += 1) {
    const btn = editable.nth(i)
    const label = (await btn.getAttribute('aria-label')) ?? `row ${i}`
    const testid = (await btn.getAttribute('data-testid')) ?? ''
    const base = testid.replace(/-value$/, '')
    await btn.click().catch(() => undefined)

    const input = page.locator(`[data-testid="${testid}-input"]`)
    if (!(await input.isVisible().catch(() => false))) {
      tried.push(`${label}: no free-value input`)
      await page.keyboard.press('Escape').catch(() => undefined)
      continue
    }
    await input.fill('42').catch(() => undefined)

    const review = page.locator(`[data-testid="${base}-review"]`)
    if (!(await review.isVisible({ timeout: 8_000 }).catch(() => false))) {
      tried.push(`${label}: input opened but NO review step`)
      await page.keyboard.press('Escape').catch(() => undefined)
      continue
    }
    await review.click().catch(() => undefined)

    const confirm = page.locator(`[data-testid="${base}-confirm"]`)
    if (!(await confirm.isVisible({ timeout: 8_000 }).catch(() => false))) {
      tried.push(`${label}: review taken but NO confirm step`)
      await page.keyboard.press('Escape').catch(() => undefined)
      continue
    }
    await confirm.click().catch(() => undefined)
    rowId = base
    tried.push(`${label}: ALL THREE BEATS`)
  }
  if (rowId === null) {
    stop(`no row completed the three-beat edit. Tried ${n}: ${tried.join(' | ')}`)
  }
  mark('edit applied (all three beats)')

  // ── RE-RUN ───────────────────────────────────────────────────────────────
  const reanalyse = page.getByTestId('reanalyse-button')
  if ((await reanalyse.count()) === 0) stop('no reanalyse-button after the edit')
  if (await reanalyse.first().isDisabled()) {
    stop(`reanalyse DISABLED after the edit — title: ${await reanalyse.first().getAttribute('title')}`)
  }
  await reanalyse.first().click()
  mark('re-run dispatched')

  /** ⚠ POLL, NEVER A FIXED SLEEP — a sleep reports "absent" for an unfinished run. */
  const deadline = Date.now() + 420_000
  let sawDelta = false
  while (Date.now() < deadline && !sawDelta) {
    sawDelta = await page.evaluate(() => {
      const w = window as unknown as { useCanvasStore?: { getState: () => { runDelta?: unknown } } }
      return (w.useCanvasStore?.getState?.().runDelta ?? null) !== null
    })
    if (!sawDelta) await page.waitForTimeout(5_000)
  }
  mark(sawDelta ? 're-run settled — DELTA OBSERVED' : 're-run settled — no delta within 420s')

  // ── BOTH HALVES ──────────────────────────────────────────────────────────
  const bodies = await page.evaluate(
    () => (window as unknown as { __BODIES__?: Array<{ url: string; hasDelta: boolean; bytes: number }> }).__BODIES__ ?? [],
  )
  const inStore = await page.evaluate(() => {
    const w = window as unknown as { useCanvasStore?: { getState: () => { runDelta?: unknown } } }
    return w.useCanvasStore?.getState?.().runDelta ?? null
  })
  await openDockTab(page, 'Reasoning')
  const rendered = await page.getByTestId('analysis-new-whats-changed').count()

  // POSITIVE CONTROL: no captured body means a blind instrument, not a finding.
  expect(bodies.length, `NO TURN BODY CAPTURED — this run measured nothing. ${lastStage()}`).toBeGreaterThan(0)

  const onWire = bodies.filter((b) => b.hasDelta)
  // eslint-disable-next-line no-console
  console.warn(
    [
      '',
      '── RUN_DELTA WITNESS ─────────────────────────────────────────────',
      `turn bodies captured : ${bodies.length}`,
      `carrying "run_delta" : ${onWire.length}`,
      `store.runDelta       : ${inStore === null ? 'null' : 'PRESENT'}`,
      `WhatsChanged rendered: ${rendered}`,
      onWire.length === 0
        ? 'VERDICT: ABSENT ON THE WIRE — reason NOT determinable from here. Next'
          + " evidence is CEE's logs at this turn's correlation id, not an inference."
        : inStore === null
          ? 'VERDICT: ON THE WIRE, NOT IN THE STORE — a UI defect, and ours to fix.'
          : `VERDICT: ARRIVED END TO END. WhatsChanged rendered ${rendered}x.`,
      '──────────────────────────────────────────────────────────────────',
      `stages: ${STAGES.join(' | ')}`,
      `origin: ${ORIGIN}`,
      '',
    ].join('\n'),
  )
})
