/**
 * Codex P1-1 — hash-by-default: previously-lost user-editable fields survive reload.
 *
 * The autosave dirty-gate (computeGraphHash) used to hash only a hand-curated
 * PERSIST allowlist. Six user-editable node fields were never on it, so an edit
 * touching ONLY one of them never flipped the dirty hash → the 30s autosave
 * skipped → localStorage kept the pre-edit value → the edit was silently lost on
 * reload (the same loss class as #457, one allowlist-omission at a time):
 *
 *   • description         — RiskPanel/EmptyDescriptionPrompt → setDescription
 *   • category            — classification editor → setCategory
 *   • extractionType      — calibration editor → setExtractionType
 *   • factor_type         — factor editor → setFactorType
 *   • state_space         — normalisation range editor → setStateSpaceRange
 *   • uncertainty_drivers — uncertainty editor → setUncertaintyDrivers
 *
 * All six are written at the TOP LEVEL of node.data by their inspector mutations,
 * all of which route through the store `updateNode` chokepoint. Under hash-by-default
 * they are persisted automatically (none is on the ephemeral denylist).
 *
 * Each pin: edit ONLY that field via updateNode →
 *   (1) computeGraphHash flips,
 *   (2) a real saveAutosave → loadAutosave round-trip hydrates the value back.
 *
 * RED before the fix (old persist-allowlist): computeGraphHash omitted these
 * fields, so (1) failed (identical hashes).
 *
 * Mutation-check: add any one of these fields to the ephemeral denylist in
 * analyticalNodeFields.ts → EXACTLY that field's (1) goes RED here, and the
 * deny-direction safety assertion in analyticalNodeFields.registry.spec.ts also
 * fires (it is a known-editor-persist field).
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { computeGraphHash } from '../useAutosave'
import { projectAutosaveData } from '../../store/autosaveProjection'
import { saveAutosave, loadAutosave, clearAutosave } from '../../store/scenarios'

const FACTOR_ID = 'factor-1'

function baseNode() {
  return {
    id: FACTOR_ID,
    type: 'factor',
    position: { x: 40, y: 200 },
    data: { kind: 'factor', label: 'Market rate' } as Record<string, unknown>,
  }
}

interface FieldCase {
  field: string
  value: unknown
  editor: string
}

const CASES: FieldCase[] = [
  { field: 'description', value: 'Refined analyst note', editor: 'setDescription' },
  { field: 'category', value: 'external', editor: 'setCategory' },
  { field: 'extractionType', value: 'explicit', editor: 'setExtractionType' },
  { field: 'factor_type', value: 'continuous', editor: 'setFactorType' },
  { field: 'state_space', value: { range: { min: 0, max: 100 } }, editor: 'setStateSpaceRange' },
  { field: 'uncertainty_drivers', value: ['fx rate', 'demand'], editor: 'setUncertaintyDrivers' },
]

beforeEach(() => {
  clearAutosave()
})

describe('Codex P1-1 — hash-by-default persists previously-lost user fields', () => {
  for (const c of CASES) {
    describe(`${c.field} (${c.editor})`, () => {
      it('computeGraphHash flips when ONLY this field changes', () => {
        const before = computeGraphHash([baseNode()], [])
        const edited = baseNode()
        edited.data = { ...edited.data, [c.field]: c.value }
        const after = computeGraphHash([edited], [])
        // RED under the old persist-allowlist: the field was omitted from the hash,
        // so before === after and the edit was invisible to autosave.
        expect(after, `${c.field} does not flip computeGraphHash`).not.toBe(before)
      })

      it('serialize → hydrate round-trip restores the value', () => {
        const edited = baseNode()
        edited.data = { ...edited.data, [c.field]: c.value }

        const payload = projectAutosaveData({
          nodes: [edited] as any,
          edges: [],
          scenarioId: undefined,
          ceeAnalysisReady: undefined,
          // This case is about a GRAPH field surviving serialize → hydrate.
          // No analysis has run, so "persist no answer" is the honest value —
          // stated rather than omitted, per AutosaveProjectionSource's
          // all-required contract.
          analysis: null,
          selectedGoalNode: null,
        })
        clearAutosave()
        saveAutosave(payload)
        const hydrated = loadAutosave()

        const restored = hydrated?.nodes.find((n) => n.id === FACTOR_ID)
        expect((restored?.data as any)?.[c.field]).toEqual(c.value)
      })
    })
  }

  it('control: an ephemeral field (goal_threshold) does NOT flip the hash (denylist honoured)', () => {
    const before = computeGraphHash([baseNode()], [])
    const edited = baseNode()
    edited.data = { ...edited.data, goal_threshold: 0.42 }
    const after = computeGraphHash([edited], [])
    // Proves the pins above discriminate — a denylisted derived cache is excluded.
    expect(after).toBe(before)
  })
})
