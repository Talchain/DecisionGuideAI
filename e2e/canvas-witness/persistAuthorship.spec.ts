/**
 * ⭐⭐⭐ RE-ADMITTED ON ITS OWN EVIDENCE, 22 Sep 2026.
 *
 * This file was swept into `staging` by a `git add -A` in #1859 and removed
 * again by #1868 along with 23 genuine throwaway probes. It comes back under
 * the rule that removed it: **a witness earns its place in the suite by
 * producing a verdict, not by existing.** It was run against the served build
 * before this restore, and it produced one:
 *
 *     [PERSIST] servedUI=db758d83  scenario=1f28738a  nodes=15 edges=30
 *     [PERSIST] target=fac_adoption_friction
 *     [PERSIST] before={"value":0.8,"source":"cee_inference","extractionType":"inferred",…}
 *     [PERSIST] inspectorValueWriterPresent=true
 *     [PERSIST] after ={"value":0.42,"source":"user_override","raw_value":0.42,…}
 *     [PERSIST] turnOutcomes=[200]
 *     [PERSIST] afterReload={"value":0.42,"source":"user_override",…}
 *     [PERSIST] valueLanded=true authoredToUser=true retainedAfterReload=true
 *               authorshipRetained=true noFalseEstAfterReload=true
 *     [PERSIST] VERDICT PASS
 *
 * ⭐ READ THE `extractionType` IN THAT PAIR. It is `"inferred"` BEFORE the edit
 * and ABSENT after it, through a reload. That is the Canvas goal's first
 * criterion measured on the wire rather than asserted: the `est.` marker is not
 * left sitting on a number the user has since typed.
 *
 * It is a sibling of `renamePersistence.spec.ts`, not a duplicate: that one
 * covers a node's LABEL, this one covers a factor's VALUE and its AUTHORSHIP.
 *
 * ⛔⛔⛔ UPGRADED 22 Sep 2026: IT NOW ASSERTS THE SYSTEM, NOT THE COMPONENT.
 *
 * The run quoted above asserted only the RELOADED value. That is how a
 * value-edit FAIL was blamed on CEE's `dispatchFactorValueEdit` for an hour
 * when the 748-byte response it was blamed on carried `_agent` — the Agent
 * route had answered `unsupported_kind` — and how, once the route was fixed, a
 * whole-graph `graph/register` sent in the SAME MILLISECOND as the edit turn
 * made CEE's CAS roll the edit back while the register stored the user's number
 * under Olumi's authorship. None of that was visible to a reload-only witness.
 *
 * The edit leg now prints one line per clause, from the captured wire
 * (`_editWire.ts`):
 *   ROUTE        — the edit turn's response has no `_agent` key. `_agent` ⇒
 *                  NOT-MEASURED (wrong route), never a Canvas FAIL.
 *   RECEIPT      — HTTP 200 carrying `graph_patch` `status:"applied"`,
 *                  `operation:"set_factor_value"`, `target_id` = the edited
 *                  factor, `after.value` = the sent value. A 5xx carrying a CEE
 *                  code (e.g. `system_event_commit_failed`) is a FAIL, not
 *                  "infrastructure": that is the edit the user lost. Only a
 *                  502/503/504 gateway answer stays NOT-MEASURED.
 *   SIDE-CHANNEL — no `graph/register` sent between the gesture and 5 s after
 *                  the response carries the edited value UNCONFIRMED (before the
 *                  response, or after a non-applied one). ⚠ Expected to FAIL
 *                  intermittently on the 22 Sep served build — a known race.
 *   SETTLEMENT   — applied: the store holds the sent value as `user_override`
 *                  after settlement AND after a reload, with no `est.` left.
 *                  Not applied: the refused value must NOT come back on reload
 *                  ("failed edits do not leave misleading local state").
 * Evidence: output/canvas-review-20260922/EVIDENCE-edits-refused-on-served-staging.md
 */
import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import {
  blocksOf, captureEditWire, errorCodeOf, isGatewayStatus, printClauses, printRegisterRows,
  printWireLog, rollUp, routeClause, sideChannelClause, sideChannelRows,
} from './_editWire'
import type { ClauseResult } from './_editWire'

const EXAMPLE = /Pricing Model Transition Strategy/i
const SENT = 0.42

async function pinnedOrigin() {
  const j = (await (await fetch('https://staging--olumi.netlify.app/version.json')).json()) as { commit: string; deploy_url: string }
  return { origin: j.deploy_url, build: j.commit }
}
async function clickNode(page: Page, id: string): Promise<boolean> {
  const fit = page.getByRole('button', { name: /fit to view/i }).first()
  if (await fit.count() > 0) { await fit.click().catch(() => {}); await page.waitForTimeout(2_500) }
  const box = await page.locator(`[data-id="${id}"]`).boundingBox().catch(() => null)
  if (!box) return false
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down(); await page.mouse.up()
  await page.waitForTimeout(3_500)
  return true
}
async function obs(page: Page, id: string) {
  return page.evaluate((nid: string) => {
    const n = ((window as any).useCanvasStore.getState().nodes as Array<any>).find((x) => String(x.id) === nid)
    return n?.data?.observedState ?? null
  }, id)
}
const near = (v: unknown, want: number) => typeof v === 'number' && Math.abs(v - want) < 1e-9

test('PERSIST + AUTHORSHIP on the pricing board', async ({ page }) => {
  test.setTimeout(300_000)
  const wire = captureEditWire(page)

  const { origin, build } = await pinnedOrigin()
  console.log(`[PERSIST] servedUI=${build} origin=${origin}`)
  await page.goto(origin, { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: /continue without an account/i }).click()
  const card = page.getByRole('button', { name: EXAMPLE })
  await card.waitFor({ state: 'visible', timeout: 45_000 })
  await card.click()
  await page.waitForTimeout(14_000)

  // CONTAMINATION GUARD: the scenario must be pristine. 15 nodes, 30 edges.
  const shape = await page.evaluate(() => {
    const st = (window as any).useCanvasStore.getState()
    const real = ((st.nodes ?? []) as Array<any>).filter((n) => !String(n.id).startsWith('__ghost-'))
    return { nodes: real.length, edges: (st.edges ?? []).length, scenario: st.currentScenarioId ?? null }
  })
  console.log(`[PERSIST] scenario=${shape.scenario} nodes=${shape.nodes} edges=${shape.edges}`)
  if (shape.nodes !== 15 || shape.edges !== 30) {
    console.log(`[PERSIST] VERDICT NOT-MEASURED — scenario is not pristine (expected 15/30, got ${shape.nodes}/${shape.edges}); a contaminated scenario voids the run`)
    return
  }

  // Pick a factor the product itself says is editable.
  const target = await page.evaluate(() => {
    const st = (window as any).useCanvasStore.getState()
    const real = ((st.nodes ?? []) as Array<any>).filter((n) => !String(n.id).startsWith('__ghost-'))
    for (const n of real) {
      const el = document.querySelector(`[data-id="${String(n.id)}"]`)
      const hay = Array.from(el?.querySelectorAll('[title],[aria-label]') ?? [])
        .map((e) => (e.getAttribute('title') || e.getAttribute('aria-label') || '')).join(' ~~ ')
      if (/click to edit/i.test(hay)) return String(n.id)
    }
    return null
  })
  console.log(`[PERSIST] target=${target}`)
  expect(target, 'CONTROL: no factor advertises an edit affordance').not.toBeNull()
  const targetId = target as string

  const before = await obs(page, targetId)
  console.log(`[PERSIST] before=${JSON.stringify(before)}`)
  // CONTROL: the sent value must differ from the value already held, or an
  // "applied" receipt and a persisted value would prove nothing.
  expect(near((before as any)?.value, SENT), `CONTROL: the factor already holds ${SENT}`).toBe(false)
  expect(await clickNode(page, targetId), 'CONTROL: node had no box').toBe(true)
  const field = page.getByPlaceholder(/enter value/i).first()
  const hasWriter = await field.count() > 0
  console.log(`[PERSIST] inspectorValueWriterPresent=${hasWriter}`)
  expect(hasWriter, 'CONTROL: the advertised affordance leads to no writer — leg is vacuous').toBe(true)
  console.log(`[PERSIST] registersBeforeGesture=${wire.registers.length} turnsBeforeGesture=${wire.turns.length}`)

  // ── THE EDIT, BOUND TO ITS OWN TURN BY IDENTITY ──────────────────────────
  await field.click(); await field.fill(String(SENT))
  const mark = wire.mark()
  const gestureMs = Date.now()
  await page.keyboard.press('Enter')
  const turn = await wire.waitForTurn(
    mark,
    (b) => {
      const ev = b.event as Record<string, unknown> | undefined
      return b.kind === 'system_event' && ev?.kind === 'factor_value_edit' && ev?.target_id === targetId
    },
    90_000,
  )
  // Settlement: the receipt has been applied (or not); wait out the 5 s
  // side-channel window from the response's end, plus a margin for the apply.
  await page.waitForTimeout(turn?.endMs != null ? Math.max(0, turn.endMs + 7_000 - Date.now()) : 12_000)
  await wire.drain()
  const settled = await obs(page, targetId)

  console.log(`[PERSIST] editTurn=${turn ? `${turn.path} HTTP ${turn.status ?? turn.failure} requestBody.event=${JSON.stringify((turn.reqBody as any)?.event)} responseBytes=${turn.resText?.length ?? 0}` : 'NONE'}`)
  console.log(`[PERSIST] allTurnOutcomes=${JSON.stringify(wire.turns.map((t) => t.status ?? t.failure))}`)
  if (turn) console.log(`[PERSIST] responseBody=${(turn.resText ?? '').slice(0, 1_500)}`)

  // ── CLAUSE 1 — ROUTE ─────────────────────────────────────────────────────
  const route = routeClause(turn)

  // ── CLAUSE 2 — RECEIPT ───────────────────────────────────────────────────
  const patches = blocksOf(turn).filter((b) => b.type === 'graph_patch')
  const receiptBlock = patches.find((b) =>
    b.status === 'applied' && b.operation === 'set_factor_value' && b.target_id === targetId &&
    near((b.after as Record<string, unknown> | null)?.value, SENT))
  console.log(`[PERSIST] RECEIPT blockTypes=${JSON.stringify(blocksOf(turn).map((b) => b.type))} graphPatches=${JSON.stringify(patches)}`)
  let receipt: ClauseResult
  if (!turn || turn.failure || turn.status == null) {
    receipt = { verdict: 'NOT-MEASURED', voids: turn != null, detail: turn ? `transport failure (${turn.failure})` : 'no factor_value_edit turn for this factor reached the wire within 90 s' }
  } else if (isGatewayStatus(turn.status)) {
    receipt = { verdict: 'NOT-MEASURED', voids: true, detail: `HTTP ${turn.status} — a gateway/availability answer, not the edit protocol's; re-run` }
  } else if (turn.status !== 200) {
    receipt = { verdict: 'FAIL', detail: `HTTP ${turn.status} code=${errorCodeOf(turn)} — the backend did not commit the edit` }
  } else if (receiptBlock) {
    /**
     * ⭐ `before.value` IS CEE'S STORED VALUE WHEN THE EDIT ARRIVED. Printed, not
     * asserted: if it already equals the sent value rather than the value the
     * board opened with, something other than this edit wrote it to the stored
     * graph first — the side-channel clause says what.
     */
    const storedBefore = (receiptBlock.before as any)?.value
    const preempted = near(storedBefore, SENT) && !near((before as any)?.value, SENT)
    receipt = { verdict: 'PASS', detail: `HTTP 200; graph_patch applied set_factor_value target_id=${targetId} after.value=${JSON.stringify((receiptBlock.after as any)?.value)} before.value=${JSON.stringify(storedBefore)}${preempted ? ` (OBSERVED: the stored graph ALREADY held ${SENT} when the edit arrived; the board opened at ${JSON.stringify((before as any)?.value)})` : ''}` }
  } else {
    receipt = { verdict: 'FAIL', detail: `HTTP 200 but NO applied set_factor_value graph_patch for ${targetId} at ${SENT}; assistant_text=${JSON.stringify(String((turn.resJson as any)?.assistant_text ?? '').slice(0, 200))}` }
  }
  const confirmed = receipt.verdict === 'PASS'

  // ── CLAUSE 3 — SIDE-CHANNEL ──────────────────────────────────────────────
  const rows = sideChannelRows(
    wire.registersInWindow(mark, turn), turn, targetId,
    (n) => near((n.observed_state as Record<string, unknown> | undefined)?.value, SENT),
    confirmed,
  )
  printRegisterRows('[PERSIST]', rows)
  printWireLog('[PERSIST]', wire, gestureMs)

  // ── CLAUSE 4 — SETTLEMENT + RELOAD ───────────────────────────────────────
  console.log(`[PERSIST] settled=${JSON.stringify(settled)}`)
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(15_000)
  const reloaded = await obs(page, targetId)
  console.log(`[PERSIST] afterReload=${JSON.stringify(reloaded)}`)
  const side = sideChannelClause(rows, wire.bffFamilySeen())

  /**
   * ⛔⛔ THE IMMEDIATE LOCAL WRITE IS STILL NOT ASSERTED — the contract does not
   * promise it. `useModelEditAuthority.ts:503-542`: on a DISPATCHED
   * `factor_value_edit` the client writes neither value nor authorship until
   * `confirmOptimisticFactorEdit` runs AGAINST CEE'S RECEIPT ("THE STAMP IS
   * WRITTEN LOCALLY ONLY WHERE NOTHING ELSE WILL EVER OWN IT"). What IS promised
   * once an applied receipt is in hand is asserted: `settled` is read after the
   * receipt and the 5 s window, so the stamp has had its chance to land.
   */
  const settledValue = near((settled as any)?.value, SENT)
  const settledUser = (settled as any)?.source === 'user_override'
  const retained = near((reloaded as any)?.value, SENT)
  const retainedAuthorship = /user/.test(String((reloaded as any)?.source ?? ''))
  const retainedOverride = (reloaded as any)?.source === 'user_override'
  const noFalseEst = (reloaded as any)?.extractionType !== 'inferred'
  console.log(`[PERSIST] ASSERTED settledValue=${settledValue} settledUserOverride=${settledUser} retainedAfterReload=${retained} authorshipRetained=${retainedAuthorship} userOverrideAfterReload=${retainedOverride} noFalseEstAfterReload=${noFalseEst}`)
  let settlement: ClauseResult
  if (confirmed) {
    const ok = settledValue && settledUser && retained && retainedAuthorship && retainedOverride && noFalseEst
    settlement = {
      verdict: ok ? 'PASS' : 'FAIL',
      detail: `applied edit ⇒ expect ${SENT} user_override settled and after reload; settled=${JSON.stringify((settled as any)?.value)}/${JSON.stringify((settled as any)?.source)} reloaded=${JSON.stringify((reloaded as any)?.value)}/${JSON.stringify((reloaded as any)?.source)} extractionType=${JSON.stringify((reloaded as any)?.extractionType)}`,
    }
  } else if (receipt.verdict === 'NOT-MEASURED' && receipt.voids) {
    settlement = { verdict: 'NOT-MEASURED', detail: `the receipt could not be measured, so there is no expectation to hold the store to; observed settled=${JSON.stringify((settled as any)?.value)}/${JSON.stringify((settled as any)?.source)} reloaded=${JSON.stringify((reloaded as any)?.value)}/${JSON.stringify((reloaded as any)?.source)}` }
  } else if (turn == null) {
    // No edit turn was ever sent: the pre-upgrade assertion, on the
    // user-visible outcome — the SIDE-CHANNEL clause says how it got there.
    const ok = retained && retainedAuthorship && noFalseEst
    settlement = { verdict: ok ? 'PASS' : 'FAIL', detail: `NO edit turn was sent ⇒ judged on the user-visible outcome (retained, user authorship, no est.): reloaded=${JSON.stringify((reloaded as any)?.value)}/${JSON.stringify((reloaded as any)?.source)}` }
  } else {
    settlement = {
      verdict: retained ? 'FAIL' : 'PASS',
      detail: `edit answered but NOT confirmed ⇒ the refused value must not come back on reload; settled=${JSON.stringify((settled as any)?.value)}/${JSON.stringify((settled as any)?.source)} reloaded=${JSON.stringify((reloaded as any)?.value)}/${JSON.stringify((reloaded as any)?.source)}${retained ? ' — THE UNCONFIRMED VALUE PERSISTED' : ''}`,
    }
  }

  const clauses = { ROUTE: route, RECEIPT: receipt, 'SIDE-CHANNEL': side, SETTLEMENT: settlement }
  printClauses('[PERSIST]', clauses)
  const overall = rollUp(clauses)
  console.log(`[PERSIST] VERDICT ${overall.verdict} — ${overall.why}`)
  if (side.verdict === 'FAIL') {
    console.log(`[PERSIST] ⛔ THE FAILING CLAUSE IS SIDE-CHANNEL: a whole-graph graph/register carried ${SENT} before the backend confirmed it. That is a second writer to canonical state, outside the edit protocol, receipts and authorship.`)
  }
  if (confirmed && !retainedOverride) {
    console.log(`[PERSIST] ⛔ THE FAILING CLAUSE IS AUTHORSHIP: CEE applied the edit (receipt above) yet the value came back as source=${JSON.stringify((reloaded as any)?.source)}.`)
  }
})
