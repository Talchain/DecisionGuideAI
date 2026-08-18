/**
 * A SAVED EXAMPLE MUST STILL BE A SAVED EXAMPLE AFTER A RELOAD.
 *
 * MEASURED DEFECT (W-1, reproduced live on the deployed staging build
 * `6524caed`, 2026-08-18, storage cleared from `/version.json` so no SPA unload
 * write could re-seed it). A guest opens the "Customer Data Platform Selection"
 * starter card and reloads. What comes back is:
 *   - the toast "Recovered unsaved changes from your last session." — the
 *     product telling a stranger a bundled demo is their own unsaved work;
 *   - NO "Saved example — Olumi drafted this model on 2026-07-28" disclosure.
 * Measured in the browser at that build: the persisted autosave held 19 nodes
 * and `nodes.filter(n => n.data.starterId).length === 0`.
 *
 * ROOT CAUSE, at the bytes. `applyDraftResult` persists the autosave itself
 * (applyDraftResult.ts, `if (!opts.skipAutosave)`), and `applyStarter` stamps
 * `starterId`/`starterTitle` only AFTER `applyDraftResult` returns. So the copy
 * that reaches localStorage — the copy the boot arbiter restores from — is the
 * UNSTAMPED graph. The stamp exists in memory and dies at the page boundary,
 * and with it BOTH honesty mechanisms `starterId` carries: the canvas
 * disclosure (StarterProvenanceBanner) and the run gate
 * (`analysisHeldOn`).
 *
 * The in-memory stamp is already pinned by `applyStarter.spec.ts`. That spec
 * stays green through the whole defect, because it never looks at what was
 * WRITTEN — which is the seam one past the guard (P1).
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { applyStarter, resolveStarterId, STARTERS } from '../loadStarter'
import { useCanvasStore } from '../../store'

const AUTOSAVE_KEY = 'olumi-canvas-autosave'

function readPersistedNodes(): Array<{ id: string; data?: Record<string, unknown> }> {
  const raw = localStorage.getItem(AUTOSAVE_KEY)
  if (raw == null) throw new Error('no autosave was persisted at all')
  const parsed = JSON.parse(raw) as { nodes?: Array<{ id: string; data?: Record<string, unknown> }> }
  return parsed.nodes ?? []
}

describe('starter identity survives the persistence boundary', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    useCanvasStore.setState({ nodes: [] as never, edges: [] as never })
  })

  it('persists starterId on EVERY node, so a reload still knows this is a saved example', async () => {
    const meta = STARTERS.find((s) => s.id === 'vendor-selection')!
    await applyStarter('vendor-selection')

    // Precondition pinned IN-TEST (trap 13b): the stamp must be present in
    // memory, otherwise this spec could pass by measuring an empty graph.
    const inMemory = useCanvasStore.getState().nodes
    expect(inMemory.length, 'precondition: the starter must have applied nodes').toBe(meta.nodeCount)
    expect(resolveStarterId(inMemory), 'precondition: the in-memory stamp must be present').toBe(
      'vendor-selection',
    )

    const persisted = readPersistedNodes()
    expect(persisted.length, 'precondition: the autosave must hold the starter graph').toBe(
      meta.nodeCount,
    )

    // Bound by IDENTITY — the starter's own id, not "some truthy provenance
    // field" another node could satisfy.
    const stamped = persisted.filter((n) => n.data?.starterId === 'vendor-selection')
    expect(
      stamped.length,
      'the PERSISTED autosave lost the saved-example stamp, so the next page load restores this ' +
        'bundled demo as the user\'s own unsaved work: no "Saved example" disclosure, and the ' +
        'recovery toast claims it came from their last session',
    ).toBe(meta.nodeCount)

    // The disclosure names the example, so the title must survive too.
    expect(persisted.every((n) => n.data?.starterTitle === meta.title)).toBe(true)

    // The predicate the product actually asks, run over the restored shape.
    expect(resolveStarterId(persisted)).toBe('vendor-selection')
  })

  it('never lets an UNSTAMPED copy reach storage, not even for an instant', async () => {
    // A mutant that lets `applyDraftResult` persist its own copy first and
    // relies on the stamped write to supersede it survived the assertion above
    // — the end state was right. It is still wrong: between the two writes the
    // stored record is an unstamped starter, and a crash, a navigation or a
    // second tab reading in that window gets exactly the W-1 state back. So
    // the pin is on EVERY write, not on the last one.
    const writes: Array<{ starterId: unknown }> = []
    const setItem = vi
      .spyOn(Storage.prototype, 'setItem')
      .mockImplementation((key: string, value: string) => {
        if (key === AUTOSAVE_KEY) {
          const parsed = JSON.parse(value) as { nodes?: Array<{ data?: Record<string, unknown> }> }
          writes.push({ starterId: parsed.nodes?.[0]?.data?.starterId })
        }
      })

    await applyStarter('market-entry')
    setItem.mockRestore()

    // Positive control: the spy must have SEEN a write, or "no unstamped
    // write" would be true of an instrument that saw nothing.
    expect(writes.length, 'precondition: at least one autosave write must be observed').toBeGreaterThan(0)
    expect(writes.length, 'the starter graph reached storage more than once').toBe(1)
    expect(writes.every(w => w.starterId === 'market-entry')).toBe(true)
  })
})
