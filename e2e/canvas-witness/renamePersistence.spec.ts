import { test, expect } from '@playwright/test'
import {
  blocksOf, captureEditWire, errorCodeOf, isGatewayStatus, printClauses, printRegisterRows,
  printWireLog, rollUp, routeClause, sideChannelClause, sideChannelRows,
} from './_editWire'
import type { ClauseResult } from './_editWire'

/**
 * ⭐⭐⭐ THE AFFORDANCE ADVERTISES AN EDIT. THIS WITNESS ASKS WHETHER IT LANDS.
 *
 * `renameReachability` proves the rename FIELD OPENS on all six node kinds.
 * It proves nothing about whether the rename COMMITS, or survives a reload —
 * which is what the Canvas goal's second criterion actually asks for:
 * *"successful edits persist and survive reload with correct authorship;
 * failed/rejected edits do not leave misleading local state."*
 *
 * ⚠ AND THERE WAS A NAMED REASON TO DOUBT IT. `canvasNodeRenameWithServerHash`
 * resolves to `'server_graph'` authority, and that authority is CONDITIONAL on
 * a CEE-stamped `graph_hash` having been seen this session. A guest who has not
 * run an analysis might have no stamp — in which case every card would be
 * advertising, in its tooltip and its accessible name, an edit the model
 * refuses. Measured: it does not refuse. This file keeps that true.
 *
 * ⛔ THE LOCATOR IS THE PROVEN ONE, NOT A NEW GUESS. The first version of this
 * probe double-clicked `[data-testid="node-title"]` and looked for the field
 * INSIDE the node's own subtree; it reported NOT-MEASURED on a card that
 * `renameReachability` opens 15 times out of 15. The field is not rendered
 * inside the node subtree. So: fit the view, double-click the NODE DIV, then
 * find the field DOCUMENT-WIDE and bind it BY IDENTITY — its value must equal
 * this node's own label, which no other enabled input on the page satisfies.
 *
 * ## Verdict discipline (the suite's rule)
 *   PASS         — the label committed to the store AND survived the reload.
 *   FAIL         — every control fired and one of those two is false.
 *   NOT-MEASURED — a control did not fire: the scenario was not pristine, the
 *                  field never opened, or the reload did not restore the same
 *                  board. A control that does not fire is never a FAIL.
 *
 * ⛔ A CONTAMINATED SCENARIO VOIDS THE RUN. This witness MUTATES the board, so
 * it demands the pristine 15/30 shape before it touches anything — a re-run
 * against its own leftovers would be measuring the previous run.
 *
 * ⛔⛔⛔ ITS FIRST PASS (#1869, ≈19:30Z 22 Sep) MEASURED A SIDE-CHANNEL, NOT THE
 * EDIT. At 20:46:21.088Z the served backend answered this rename with the Agent
 * route's refusal (`_agent.stopped_reason: "unsupported_kind"`), and in the SAME
 * millisecond the UI posted its whole local graph to
 * `/bff/cee/scenarios/{id}/graph/register` → 200. The label "persisted" because
 * the register stored it, not because the edit protocol accepted it — and a
 * witness that read only the store could not tell the difference. So the rename
 * leg now also prints, from the captured wire (`_editWire.ts`), one line per
 * clause:
 *   ROUTE        — no `_agent` key in the rename turn's response; `_agent` ⇒
 *                  NOT-MEASURED for the Canvas (wrong route), never a FAIL.
 *   RECEIPT      — the HTTP status. The response body is PRINTED, not asserted:
 *                  the contract promises no rename block. What is classified is
 *                  the product's own reading (`readStructuralRenameReceipt`,
 *                  bound by node id): the committed graph carries this node at
 *                  the new label (proven), at another label (refuted — a FAIL,
 *                  the server's own bytes refused it), or not at all (unproven —
 *                  printed, not a FAIL, because nothing promises the graph).
 *   SIDE-CHANNEL — no `graph/register` sent between the gesture and 5 s after
 *                  the response carries the new label UNCONFIRMED (before the
 *                  response, or after a refusing one).
 *   SETTLEMENT   — confirmed: committed AND survived the reload (unchanged from
 *                  #1869). Answered but refused: the refused label must NOT come
 *                  back. Never sent: judged on the user-visible outcome, as
 *                  #1869 did — SIDE-CHANNEL then says how it persisted.
 *
 * ⭐ WHAT THE UPGRADE SAW ON ITS FIRST RUNS (UI 28d2745e, CEE 9c16e8c): on a
 * fresh guest board NO rename turn is sent at all — `lastServerGraphHash` is
 * null, so `useStructuralRenameEvents` HOLDS the intent (`pendingForNode=1`) —
 * and the label survives the reload only because a `graph/register` ~65 ms
 * after the gesture stores it. ROUTE/RECEIPT print NOT-MEASURED (there is no
 * turn to measure) and SIDE-CHANNEL FAILs, which is the verdict.
 * Evidence: output/canvas-review-20260922/EVIDENCE-edits-refused-on-served-staging.md §4
 */

const EXAMPLE = /Pricing Model Transition Strategy/i
/** Deliberately unlike any label the product can produce, so CONTROL A is sharp. */
const NEW_LABEL = 'Rename witness 8f2a41'

test('RENAME PERSISTENCE on the pricing board', async ({ browser }) => {
  test.setTimeout(300_000)
  const j = (await (await fetch('https://staging--olumi.netlify.app/version.json')).json()) as { commit: string; deploy_url: string }
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await ctx.newPage()
  const wire = captureEditWire(page)
  console.log(`[RENAME] servedUI=${j.commit} origin=${j.deploy_url}`)

  await page.goto(j.deploy_url, { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: /continue without an account/i }).click()
  const picker = page.getByRole('button', { name: EXAMPLE })
  await picker.first().waitFor({ state: 'visible', timeout: 45_000 })
  if (await picker.count() !== 1) {
    console.log(`[RENAME] VERDICT NOT-MEASURED — the picker matched ${await picker.count()} controls; a restored board voids the scenario`)
    await ctx.close(); return
  }
  await picker.first().click()
  await page.waitForTimeout(14_000)

  const before = await page.evaluate((needle: string) => {
    const st = (window as any).useCanvasStore.getState()
    const nodes = ((st.nodes ?? []) as Array<any>).filter((n) => !String(n.id).startsWith('__ghost-'))
    const subject = nodes.find((n) => String(n.type) === 'factor') ?? nodes[0]
    return {
      nodes: nodes.length,
      edges: ((st.edges ?? []) as Array<unknown>).length,
      id: String(subject?.id ?? ''),
      kind: String(subject?.type ?? '?'),
      label: String(subject?.data?.label ?? ''),
      fabricatedHits: (document.body.innerHTML.match(new RegExp(needle, 'gi')) ?? []).length,
    }
  }, NEW_LABEL)

  // CONTAMINATION GUARD — the pristine pricing board is 15 nodes / 30 edges.
  if (before.nodes !== 15 || before.edges !== 30) {
    console.log(`[RENAME] VERDICT NOT-MEASURED — scenario is not pristine (expected 15/30, got ${before.nodes}/${before.edges})`)
    await ctx.close(); return
  }
  // CONTROL A — the fabricated label must appear nowhere before the edit.
  if (before.fabricatedHits !== 0) {
    console.log(`[RENAME] VERDICT NOT-MEASURED — CONTROL A did not fire: "${NEW_LABEL}" already on the page ${before.fabricatedHits}x`)
    await ctx.close(); return
  }
  console.log(`[RENAME] subject=${before.kind}:${before.id} label="${before.label}" CONTROL A fabricatedHitsBefore=0`)

  await page.getByRole('button', { name: /fit to view/i }).first().click().catch(() => {})
  await page.waitForTimeout(1_500)
  await page.locator(`[data-id="${before.id}"]`).first().dblclick({ timeout: 8_000 }).catch(() => {})
  await page.waitForTimeout(1_500)

  // CONTROL B — the field must open, bound BY IDENTITY to this node's label.
  const handle = await page.evaluateHandle((wantLabel: string) => {
    const fields = Array.from(document.querySelectorAll('input[type="text"],input:not([type]),textarea,[contenteditable="true"]')) as HTMLElement[]
    return fields.find((f) => (((f as HTMLInputElement).value ?? f.textContent ?? '').trim() === String(wantLabel).trim())) ?? null
  }, before.label)
  const field = handle.asElement()
  if (field === null) {
    console.log('[RENAME] VERDICT NOT-MEASURED — CONTROL B did not fire: no field opened carrying this node\'s own label')
    await ctx.close(); return
  }
  console.log('[RENAME] CONTROL B renameFieldOpened=true (seeded with the node\'s own label)')

  await field.fill(NEW_LABEL)
  console.log(`[RENAME] registersBeforeGesture=${wire.registers.length} turnsBeforeGesture=${wire.turns.length}`)
  const mark = wire.mark()
  const gestureMs = Date.now()
  await field.press('Enter')
  const turn = await wire.waitForTurn(
    mark,
    (b) => {
      const ev = b.event as Record<string, unknown> | undefined
      return b.kind === 'system_event' && ev?.kind === 'structural_rename' && ev?.node_id === before.id && ev?.label === NEW_LABEL
    },
    90_000,
  )
  // Never shorter than the original 6 s; otherwise the response's end + the
  // 5 s side-channel window + a margin for the settle.
  await page.waitForTimeout(Math.max(6_000 - (Date.now() - gestureMs), turn?.endMs != null ? turn.endMs + 7_000 - Date.now() : 6_000, 0))
  await wire.drain()

  // ⛔ THE STORE, NOT THE DOM. A card can repaint optimistically; the canonical
  // node is the subject of the claim.
  const committed = await page.evaluate((args: [string, string]) => {
    const [id, want] = args
    const n = ((window as any).useCanvasStore.getState().nodes as Array<any>).find((x) => String(x.id) === id)
    const data = (n?.data ?? {}) as Record<string, unknown>
    return {
      label: String(data.label ?? '(node gone)'),
      ok: String(data.label ?? '') === want,
      // Recorded, not asserted: this witness does not yet know which key the
      // product uses to stamp a label's author, so it reports what is there
      // rather than inventing a field to assert against.
      authorshipKeys: Object.keys(data).filter((k) => /source|origin|author|provenance|edited|user/i.test(k)).map((k) => `${k}=${String((data as Record<string, unknown>)[k])}`),
      refusals: (document.body.innerText.match(/could not|couldn't|failed|not saved|try again|refused|out of date|stale/gi) ?? []).slice(0, 6),
    }
  }, [before.id, NEW_LABEL] as [string, string])
  console.log(`[RENAME] afterCommit storeLabel="${committed.label}" committed=${committed.ok}`)
  console.log(`[RENAME] authorshipKeys=${JSON.stringify(committed.authorshipKeys)}`)
  console.log(`[RENAME] refusalWordsOnScreen=${JSON.stringify(committed.refusals)}`)

  /**
   * WHY A RENAME MAY NEVER REACH THE WIRE — printed, because it decides how to
   * read ROUTE/RECEIPT. `useStructuralRenameEvents.ts` HOLDS a rename while the
   * store has no `lastServerGraphHash` ("HOLD, DO NOT DISCARD … the next turn's
   * `graph_hash` re-runs this effect"). A fresh guest board that has had no turn
   * has no hash, so the intent waits in `pendingStructuralRenames`.
   */
  const renameQueue = await page.evaluate((id: string) => {
    const st = (window as any).useCanvasStore.getState()
    return {
      lastServerGraphHash: st.lastServerGraphHash ?? null,
      pendingForNode: ((st.pendingStructuralRenames ?? []) as Array<any>).filter((i) => i?.nodeId === id).length,
      lifecycleForNode: ((st.structuralRenameLifecycle ?? []) as Array<any>).filter((r) => r?.intent?.nodeId === id).map((r) => r.status),
    }
  }, before.id)
  console.log(`[RENAME] renameQueue=${JSON.stringify(renameQueue)}`)
  console.log(`[RENAME] editTurn=${turn ? `${turn.path} HTTP ${turn.status ?? turn.failure} requestBody.event=${JSON.stringify((turn.reqBody as any)?.event)} responseBytes=${turn.resText?.length ?? 0}` : 'NONE'}`)
  console.log(`[RENAME] allTurnOutcomes=${JSON.stringify(wire.turns.map((t) => t.status ?? t.failure))}`)
  if (turn) console.log(`[RENAME] responseBody=${(turn.resText ?? '').slice(0, 1_500)}`)

  // ── CLAUSE 1 — ROUTE ─────────────────────────────────────────────────────
  const route = routeClause(turn)

  // ── CLAUSE 2 — RECEIPT: status asserted, body printed ────────────────────
  const res = (turn?.resJson ?? null) as Record<string, unknown> | null
  const dg = (res?.draft_graph ?? null) as { nodes?: unknown } | null
  const dgNode = Array.isArray(dg?.nodes) ? (dg!.nodes as Array<Record<string, unknown>>).find((n) => n?.id === before.id) : undefined
  const committedGraph: 'proven' | 'refuted' | 'unproven' =
    dgNode === undefined || typeof dgNode.label !== 'string' ? 'unproven' : dgNode.label === NEW_LABEL ? 'proven' : 'refuted'
  console.log(`[RENAME] RECEIPT OBSERVED topLevelKeys=${JSON.stringify(res ? Object.keys(res) : null)} blockTypes=${JSON.stringify(blocksOf(turn).map((b) => b.type))} draftGraph=${dg ? 'present' : 'absent'} committedGraphReceipt=${committedGraph}${dgNode ? ` (node label ${JSON.stringify(dgNode.label)})` : ''} graphHash=${JSON.stringify(res?.graph_hash ?? null)} assistantText=${JSON.stringify(String(res?.assistant_text ?? '').slice(0, 240))}`)
  let receipt: ClauseResult
  if (!turn || turn.failure || turn.status == null) {
    receipt = { verdict: 'NOT-MEASURED', voids: turn != null, detail: turn ? `transport failure (${turn.failure})` : 'no structural_rename turn for this node reached the wire within 90 s' }
  } else if (isGatewayStatus(turn.status)) {
    receipt = { verdict: 'NOT-MEASURED', voids: true, detail: `HTTP ${turn.status} — a gateway/availability answer, not the edit protocol's; re-run` }
  } else if (turn.status !== 200) {
    receipt = { verdict: 'FAIL', detail: `HTTP ${turn.status} code=${errorCodeOf(turn)} — the backend did not commit the rename` }
  } else if (committedGraph === 'refuted') {
    receipt = { verdict: 'FAIL', detail: `HTTP 200 but the committed graph carries ${before.id} at ${JSON.stringify(dgNode?.label)}, not the new label — refused in the server's own bytes` }
  } else {
    receipt = { verdict: 'PASS', detail: `HTTP 200; committedGraphReceipt=${committedGraph} (a rename block is not promised by the contract — body printed above)` }
  }
  const confirmed = receipt.verdict === 'PASS'

  // ── CLAUSE 3 — SIDE-CHANNEL ──────────────────────────────────────────────
  const rows = sideChannelRows(wire.registersInWindow(mark, turn), turn, before.id, (n) => n.label === NEW_LABEL, confirmed)
  printRegisterRows('[RENAME]', rows)
  printWireLog('[RENAME]', wire, gestureMs)

  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(16_000)
  const reloaded = await page.evaluate((args: [string, string]) => {
    const [id, want] = args
    const nodes = (((window as any).useCanvasStore?.getState?.()?.nodes) as Array<any>) ?? []
    const n = nodes.find((x) => String(x.id) === id)
    return { sameBoard: n != null, count: nodes.length, label: String(n?.data?.label ?? '(absent)'), ok: String(n?.data?.label ?? '') === want }
  }, [before.id, NEW_LABEL] as [string, string])

  const side = sideChannelClause(rows, wire.bffFamilySeen())
  // CONTROL D — the reload must restore the SAME board, or nothing was measured.
  // The wire clauses were measured before the reload, so they are still printed.
  if (!reloaded.sameBoard) {
    printClauses('[RENAME]', {
      ROUTE: route, RECEIPT: receipt, 'SIDE-CHANNEL': side,
      SETTLEMENT: { verdict: 'NOT-MEASURED', detail: `CONTROL D did not fire: the reload did not restore this board (${reloaded.count} nodes)` },
    })
    console.log(`[RENAME] VERDICT NOT-MEASURED — CONTROL D did not fire: the reload did not restore this board (${reloaded.count} nodes)`)
    await ctx.close(); return
  }
  console.log(`[RENAME] afterReload label="${reloaded.label}" persisted=${reloaded.ok}`)

  // ── CLAUSE 4 — SETTLEMENT + RELOAD ───────────────────────────────────────
  const settlement: ClauseResult = confirmed
    ? { verdict: committed.ok && reloaded.ok ? 'PASS' : 'FAIL', detail: `confirmed rename ⇒ commit=${committed.ok} persist=${reloaded.ok} (store "${committed.label}" → reload "${reloaded.label}")` }
    : receipt.verdict === 'NOT-MEASURED' && receipt.voids
      ? { verdict: 'NOT-MEASURED', detail: `the receipt could not be measured; observed commit=${committed.ok} persist=${reloaded.ok}` }
      : turn == null
        // No rename turn was ever sent: the pre-upgrade assertion, on the
        // user-visible outcome — the SIDE-CHANNEL clause says how it got there.
        ? { verdict: committed.ok && reloaded.ok ? 'PASS' : 'FAIL', detail: `NO rename turn was sent ⇒ judged on the user-visible outcome: commit=${committed.ok} persist=${reloaded.ok} (store "${committed.label}" → reload "${reloaded.label}")` }
        : { verdict: reloaded.ok ? 'FAIL' : 'PASS', detail: `rename answered but NOT confirmed ⇒ the refused label must not come back; reload "${reloaded.label}"${reloaded.ok ? ' — THE UNCONFIRMED LABEL PERSISTED' : ''}` }

  const clauses = { ROUTE: route, RECEIPT: receipt, 'SIDE-CHANNEL': side, SETTLEMENT: settlement }
  printClauses('[RENAME]', clauses)
  const overall = rollUp(clauses)
  console.log(`[RENAME] VERDICT ${overall.verdict} — ${overall.why}; commit=${committed.ok} persist=${reloaded.ok}`)
  if (side.verdict === 'FAIL') {
    console.log(`[RENAME] ⛔ THE FAILING CLAUSE IS SIDE-CHANNEL: a whole-graph graph/register carried the new label before the backend confirmed it.`)
  }

  expect(before.nodes).toBe(15)
})
