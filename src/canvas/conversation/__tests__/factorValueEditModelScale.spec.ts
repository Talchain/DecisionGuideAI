/**
 * `factorValueEdit` — the `'model_scale'` seed basis (ROADMAP 2.364).
 *
 * WHAT IT IS FOR. CEE's belief-elicitation engine answers with a PROBABILITY in
 * [0,1] — already the scale `observed_state.value` holds. Committing it as a
 * "typed" number would run it through the user-unit rule and silently rescale
 * it, so this basis states plainly that the number is already model scale.
 *
 * WHY THE ORDER MATTERS (the whole reason this file exists). The basis is
 * answered BEFORE the `raw_value` rule. Move it after, and a factor that stores
 * `raw_value: 8, cap: 20` would classify an elicited 0.7 as eight-engineers-
 * scale and normalise it to 0.035 — a 20x silent corruption on the commonest
 * CEE draft shape. The order test below is the one that dies on that mutant.
 *
 * WHY THE UI DOES NOT INVERT. `raw = value * cap` is real, but it already has
 * exactly one owner: CEE's `resolveUserUnitInput`
 * (`orchestrator-v5/system-events/factor-value-edit.ts`, read at `staging`
 * 2026-08-03) does `cap !== undefined ? value * cap : value` when the wire
 * carries no `raw_value`. So the ABSENCE of `raw_value`/`unit` on this basis is
 * a contract, not an omission, and it is asserted as one.
 *
 * RED-first at pristine `0c4e2cc3`: `ValueInputSeedBasis` has two members and
 * `'model_scale'` is not one of them.
 */

import { describe, it, expect } from 'vitest'
import {
  buildFactorValueEditEvent,
  resolveValueInputSeed,
} from '../factorValueEdit'

/** CEE's own draft fixture shape — a factor with a real user-unit scale. */
const CAPPED = {
  kind: 'factor',
  label: 'Team Size',
  observedState: { value: 0.4, raw_value: 8, unit: 'engineers', cap: 20 },
}

/** The 2026-08-03 walk shape — normalised-scale only. */
const WALK = {
  kind: 'factor',
  label: 'Content Marketing Investment',
  observedState: { value: 0, display_value: 'Low (0)' },
}

describe("factorValueEdit — 'model_scale' basis", () => {
  it('reports the number as already-model-scale even when the node stores a raw_value', () => {
    // The ORDER pin. With the branch placed after the `raw_value` rule this
    // reads `true`, and every scale claim below collapses.
    expect(resolveValueInputSeed(CAPPED, 'model_scale').inUserUnits).toBe(false)
    expect(resolveValueInputSeed(WALK, 'model_scale').inUserUnits).toBe(false)
  })

  it('leaves the other two bases exactly as they were (no behaviour moved)', () => {
    expect(resolveValueInputSeed(CAPPED).inUserUnits).toBe(true)
    expect(resolveValueInputSeed(CAPPED).seed).toBe(8)
    expect(resolveValueInputSeed(CAPPED, 'raw_only').inUserUnits).toBe(true)
    expect(resolveValueInputSeed(WALK).inUserUnits).toBe(false)
    expect(resolveValueInputSeed(WALK).seed).toBe(0)
    expect(resolveValueInputSeed(WALK, 'raw_only').seed).toBeUndefined()
  })

  it('emits the probability VERBATIM as `value` on a cap-bearing factor, with no raw_value/unit', () => {
    const event = buildFactorValueEditEvent({
      nodeId: 'fac_team_size',
      typedValue: 0.7,
      nodeData: CAPPED,
      seedBasis: 'model_scale',
    })

    expect(event).not.toBeNull()
    const payload = event!.payload as Record<string, unknown>
    expect(payload.target_id).toBe('fac_team_size')
    expect(payload.field).toBe('value')
    expect(payload.value).toBe(0.7)
    // The two absences ARE the contract: CEE inverts with its own stored cap.
    expect(payload).not.toHaveProperty('raw_value')
    expect(payload).not.toHaveProperty('unit')
  })

  it('emits the probability verbatim on the capless walk shape too', () => {
    const event = buildFactorValueEditEvent({
      nodeId: 'fac_content_marketing',
      typedValue: 0.7,
      nodeData: WALK,
      seedBasis: 'model_scale',
    })

    const payload = event!.payload as Record<string, unknown>
    expect(payload.value).toBe(0.7)
    expect(payload).not.toHaveProperty('raw_value')
  })

  it('CONTROL — the default basis still normalises a typed magnitude by the cap (unchanged)', () => {
    const event = buildFactorValueEditEvent({
      nodeId: 'fac_team_size',
      typedValue: 14,
      nodeData: CAPPED,
    })

    const payload = event!.payload as Record<string, unknown>
    expect(payload.value).toBe(0.7)
    expect(payload.raw_value).toBe(14)
    expect(payload.unit).toBe('engineers')
  })

  it('CONTROL — what the design\'s original plan would have emitted, and why it was retired', () => {
    // `Math.round(0.7 * 100)` = 70, committed through the drill-in's typed
    // basis on a factor capped at 20 engineers.
    const event = buildFactorValueEditEvent({
      nodeId: 'fac_team_size',
      typedValue: 70,
      nodeData: CAPPED,
      seedBasis: 'raw_only',
    })

    const payload = event!.payload as Record<string, unknown>
    // SEVENTY ENGINEERS against a cap of 20 — model scale 3.5, i.e. 350%.
    expect(payload.raw_value).toBe(70)
    expect(payload.value).toBe(3.5)
    // This is what the `'model_scale'` basis exists to prevent; it is pinned
    // rather than described so the retirement cannot be undone by inheritance.
  })

  it('still fails CLOSED on an unencodable edit', () => {
    expect(
      buildFactorValueEditEvent({
        nodeId: '',
        typedValue: 0.7,
        nodeData: CAPPED,
        seedBasis: 'model_scale',
      }),
    ).toBeNull()
    expect(
      buildFactorValueEditEvent({
        nodeId: 'fac_team_size',
        typedValue: Number.NaN,
        nodeData: CAPPED,
        seedBasis: 'model_scale',
      }),
    ).toBeNull()
  })
})
