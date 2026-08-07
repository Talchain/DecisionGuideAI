/**
 * The retired Provenance Hub must not rehydrate.
 *
 * Its opener was removed DELIBERATELY BY THE REPO OWNER in c80f0fe8 (29 Mar
 * 2026), and PR #372 recorded the panel as RETIRED. But `showProvenanceHub`
 * was still persisted via `saveUIPreference` and read back by
 * `loadUIPreferences()` at store init, so a returning user whose browser
 * still carried `ui.showProvenanceHub=true` from a pre-c80f0fe8 build
 * rendered the panel — and it can never have content: `addCitation` has zero
 * callers in all of history, so `citations` is always [] and the panel shows
 * "0 citations" by construction.
 *
 * The panel component and the store slice are deliberately left in place
 * (the owner's ruling on retiring them is separate); only the rehydration
 * is stopped.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'

async function freshStoreState() {
  vi.resetModules()
  const { useCanvasStore } = await import('../../store')
  return useCanvasStore.getState()
}

describe('Provenance Hub rehydration (retired panel — c80f0fe8, PR #372)', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.resetModules()
  })

  it('POSITIVE CONTROL: this spec can SEE a preference rehydrate', async () => {
    // Without this, the assertion below would pass even if the whole
    // rehydration path were broken or the store never read localStorage at
    // all — an absence assertion that cannot observe a presence is vacuous.
    // `showComparePanel` is a still-live persisted preference and uses the
    // exact same loadUIPreferences path.
    localStorage.setItem('ui.showComparePanel', 'true')

    const state = await freshStoreState()

    expect(
      state.showComparePanel,
      'a live persisted preference no longer rehydrates — this spec has gone blind ' +
        'and the showProvenanceHub assertion below proves nothing',
    ).toBe(true)
  })

  it('does NOT rehydrate showProvenanceHub, even from a stale true', async () => {
    // Exactly the state a returning user carries from a pre-c80f0fe8 build.
    localStorage.setItem('ui.showProvenanceHub', 'true')

    const state = await freshStoreState()

    expect(
      state.showProvenanceHub,
      'the retired Provenance Hub rehydrated from localStorage — a returning user ' +
        'sees an empty panel that can never have content (addCitation has no callers)',
    ).toBe(false)
  })

  it('rehydrates neither panel when both stale flags are set', async () => {
    // The two stranded panels share a render region in ReactFlowGraph
    // (`!showProvenanceHub && showAIClarifier`), so pin them together.
    localStorage.setItem('ui.showProvenanceHub', 'true')
    localStorage.setItem('ui.showAIClarifier', 'true')

    const state = await freshStoreState()

    expect(state.showProvenanceHub).toBe(false)
    // showAIClarifier was ALREADY unpersistable — it has no STORAGE_KEYS
    // entry and no UIPreferences field, so nothing can rehydrate it. Pinned
    // here so that stays true rather than being re-added by symmetry with
    // its neighbours.
    expect(state.showAIClarifier).toBe(false)
  })

  it('showAIClarifier has no persistence surface at all', async () => {
    const { __test__ } = await import('../uiPreferences')
    expect(Object.values(__test__.STORAGE_KEYS)).not.toContain('ui.showAIClarifier')
    expect(Object.keys(__test__.STORAGE_KEYS)).not.toContain('SHOW_AI_CLARIFIER')
  })
})
