// e2e/core/E1-entry-living-model.core.spec.ts
// =============================================================================
// E1 — a natural strategic challenge becomes a visible Living Model.
// Journey steps 1 and 2.
// =============================================================================
//
// THE CORE CLAIM THIS FALSIFIES:
//   "A team brings Olumi a messy strategic challenge and a shared visual model is
//    visibly created."
//
// If the composer is not a real mounted control, if the brief never reaches CEE, if
// no nodes mount, or if the nodes mount stacked on one another so there is nothing a
// team could read, this spec goes RED and the claim is false for a fresh visitor on
// the deployed build.
//
// WHAT IT DELIBERATELY DOES NOT ASSERT: anything about the CONTENT or quality of the
// model. "The right nodes" is a different claim needing a different instrument, and
// asserting it here by keyword would be a value predicate another graph could satisfy.

import { test, expect } from '@playwright/test'
import {
  installWireInterceptor, assertWireLive, freshGuest, assertNoHydratedModel, enterAsGuest, submitBrief,
  waitForModel, waitForStableLayout, assertLayoutReadable, expectOperableControl, ORIGIN,
} from './lib/harness'
import { recordSpecRan } from './lib/manifest'

test.beforeAll(() => recordSpecRan('E1-entry-living-model'))

test.describe('E1 · a strategic challenge becomes a visible Living Model', () => {
  test('a fresh guest can state a challenge and watch a readable model appear', async ({ page }) => {
    await installWireInterceptor(page)

    // ---- step 1a: a GENUINELY fresh guest -----------------------------------
    // Not `localStorage.clear()` in-app: the unload path rewrites the autosave from
    // memory within ~900ms. Cleared from /version.json, then navigated in.
    const fresh = await freshGuest(page)
    expect(
      fresh.keysAfterClear,
      `[E1] the clear did not land: ${fresh.keysAfterClear.join(', ')} survived at /version.json. ` +
      `Clearing from inside the running app would NOT have been enough either — the unload path ` +
      `rewrites the autosave from memory within ~900ms.`,
    ).toHaveLength(0)
    // The app writes its own boot defaults on entry (sandbox.mode, sandbox.help.open).
    // Those are FRESH writes; only a model-bearing key means a hydrated previous session.
    assertNoHydratedModel(fresh.keysAfterEntry, 'the fresh-guest entry')

    await enterAsGuest(page)

    // ---- step 1b: the composer is a CONTROL, not just a testid ---------------
    const composer = await expectOperableControl(page, 'first-use-input-bar-textarea', 200, 20)
    expect(composer.tag, '[E1] the composer must be a real text control').toBe('textarea')

    await submitBrief(page)

    // ---- the brief actually reached CEE -------------------------------------
    // Proven on the fetch interceptor, because the recorder does not capture SSE
    // turn POSTs — and the interceptor is proven non-zero before any absence.
    let turn: { url: string; status: number | string } | undefined
    for (let i = 0; i < 45 && !turn; i++) {
      await page.waitForTimeout(2_000)
      const wire = await assertWireLive(page, 'after submitting the brief')
      turn = wire.find((c) => /\/proxy\/v5\/turn/.test(c.url))
    }
    expect(turn, '[E1] no turn POST was observed — the brief never left the browser').toBeTruthy()
    expect(
      turn?.status,
      `[E1] the turn POST to ${turn?.url} returned ${turn?.status}. The composer accepted a brief ` +
      `the platform then refused, which is a broken promise on the deployed build.`,
    ).toBe(200)

    // ---- step 2: the Living Model is VISIBLY created -------------------------
    const nodeIds = await waitForModel(page)
    expect(
      nodeIds.length,
      '[E1] no model nodes mounted within the window — the challenge produced nothing visible',
    ).toBeGreaterThan(2)

    // IDENTITY, not a count another render could satisfy: every mounted react-flow
    // node must carry its own addressable id, and no id may mount twice. A count
    // alone is satisfiable by duplicates of one node.
    const dup = nodeIds.filter((id, i) => nodeIds.indexOf(id) !== i)
    expect(dup, `[E1] the same node id mounted more than once: ${dup.join(', ')}`).toHaveLength(0)

    const rfCount = await page.evaluate(
      () => document.querySelectorAll('.react-flow__node').length,
    )
    // Ghost/placeholder nodes carry `__`-prefixed ids and are excluded by
    // renderedNodeIds, so identified <= mounted, and the gap must be only ghosts.
    const ghosts = await page.evaluate(
      () => [...document.querySelectorAll('[data-testid^="rf__node-__"]')].length,
    )
    expect(
      nodeIds.length + ghosts,
      `[E1] ${rfCount} react-flow nodes mounted but only ${nodeIds.length} carry an addressable ` +
      `id (+${ghosts} ghosts). An unaddressable node cannot be asserted about by identity.`,
    ).toBe(rfCount)

    // ---- the model is READABLE, not stacked ---------------------------------
    // Layout health = distinctX relative to node count PLUS nodes-per-column.
    // NOT origin-stacking (which passed a uniform column six times) and NOT gap
    // uniformity (a constant pitch across many columns is HEALTHY, not a defect).
    const layout = await waitForStableLayout(page)
    assertLayoutReadable(layout, 'E1')

    // eslint-disable-next-line no-console
    console.log(
      `[E1] origin=${ORIGIN} nodes=${layout.nodeCount} distinctX=${layout.distinctX} ` +
      `perColumn=${layout.nodesPerColumn.toFixed(2)} maxCol=${layout.maxColumnOccupancy}`,
    )
  })
})
