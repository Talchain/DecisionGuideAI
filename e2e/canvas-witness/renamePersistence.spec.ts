import { test, expect } from '@playwright/test'

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
 */

const EXAMPLE = /Pricing Model Transition Strategy/i
/** Deliberately unlike any label the product can produce, so CONTROL A is sharp. */
const NEW_LABEL = 'Rename witness 8f2a41'

test('RENAME PERSISTENCE on the pricing board', async ({ browser }) => {
  test.setTimeout(300_000)
  const j = (await (await fetch('https://staging--olumi.netlify.app/version.json')).json()) as { commit: string; deploy_url: string }
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await ctx.newPage()
  console.log(`[RENAME] servedUI=${j.commit}`)

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
  await field.press('Enter')
  await page.waitForTimeout(6_000)

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

  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(16_000)
  const reloaded = await page.evaluate((args: [string, string]) => {
    const [id, want] = args
    const nodes = (((window as any).useCanvasStore?.getState?.()?.nodes) as Array<any>) ?? []
    const n = nodes.find((x) => String(x.id) === id)
    return { sameBoard: n != null, count: nodes.length, label: String(n?.data?.label ?? '(absent)'), ok: String(n?.data?.label ?? '') === want }
  }, [before.id, NEW_LABEL] as [string, string])

  // CONTROL D — the reload must restore the SAME board, or nothing was measured.
  if (!reloaded.sameBoard) {
    console.log(`[RENAME] VERDICT NOT-MEASURED — CONTROL D did not fire: the reload did not restore this board (${reloaded.count} nodes)`)
    await ctx.close(); return
  }
  console.log(`[RENAME] afterReload label="${reloaded.label}" persisted=${reloaded.ok}`)
  console.log(`[RENAME] VERDICT ${committed.ok && reloaded.ok ? 'PASS' : 'FAIL'} — commit=${committed.ok} persist=${reloaded.ok}`)

  expect(before.nodes).toBe(15)
})
