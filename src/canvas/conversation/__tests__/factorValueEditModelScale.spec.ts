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
  acceptsElicitedBelief,
  buildFactorValueEditEvent,
  isMagnitudeScaledFactor,
  resolveValueInputSeed,
} from '../factorValueEdit'

/** CEE's own draft fixture shape — a factor with a real user-unit scale. */
const CAPPED = {
  kind: 'factor',
  label: 'Team Size',
  observedState: { value: 0.4, raw_value: 8, unit: 'engineers', cap: 20 },
}

/**
 * ⭐ THE THIRD SHAPE — staging-witnessed, and the one the first cut of this
 * feature corrupted. `{value: 40000, unit: '£', raw_value: 40000}`, NO cap:
 * CEE stores model and raw identically, so this factor's model scale IS
 * £40,000. Verbatim-committing a 0.7 here makes it £0.70.
 * (`PHASE0-EVIDENCE-2026-07-28/diagnosis-2308-raw/probe-P1-res.json` and
 * `journey-rewalk-2026-08-03-raw/wire-cfg-own-format-0-res.txt`.)
 */
const UNCAPPED_MAGNITUDE = {
  kind: 'factor',
  label: 'Monthly spend',
  observedState: { value: 40000, unit: '£', raw_value: 40000 },
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

  it('⭐ REFUSES the uncapped unit-bearing shape outright — £40,000 must not become £0.70', () => {
    expect(isMagnitudeScaledFactor(UNCAPPED_MAGNITUDE)).toBe(true)
    // Fails CLOSED: no event ⇒ no local write, no wire, no receipt, no
    // "checked by you" stamp. Nothing at all beats a 57,000x corruption
    // wearing a provenance badge.
    expect(
      buildFactorValueEditEvent({
        nodeId: 'fac_spend',
        typedValue: 0.7,
        nodeData: UNCAPPED_MAGNITUDE,
        seedBasis: 'model_scale',
      }),
    ).toBeNull()
  })

  it('the magnitude predicate is about UNIT-WITHOUT-CAP, not about units or caps alone', () => {
    // A cap makes the model scale normalised again — CEE inverts with it.
    expect(isMagnitudeScaledFactor(CAPPED)).toBe(false)
    // No unit ⇒ nothing claims the number is an amount.
    expect(isMagnitudeScaledFactor(WALK)).toBe(false)
    // A cap of 0 is NOT a cap (normaliseRawFactorValue ignores cap <= 0), so a
    // unit-bearing factor with cap 0 is still magnitude-scaled.
    expect(
      isMagnitudeScaledFactor({ observedState: { value: 5, unit: '£', cap: 0 } }),
    ).toBe(true)
    // A whitespace-only unit is not a unit.
    expect(
      isMagnitudeScaledFactor({ observedState: { value: 0.4, unit: '  ' } }),
    ).toBe(false)
  })

  it('the OFFER predicate is narrower than the refusal — a capped factor commits correctly but cannot be SHOWN', () => {
    // Both are safe to commit…
    expect(isMagnitudeScaledFactor(CAPPED)).toBe(false)
    // …but only the capless/unitless shape can display the accepted number
    // afterwards without deriving `value * cap` in the client. See
    // `acceptsElicitedBelief`'s own docstring.
    expect(acceptsElicitedBelief(CAPPED)).toBe(false)
    expect(acceptsElicitedBelief(UNCAPPED_MAGNITUDE)).toBe(false)
    expect(acceptsElicitedBelief(WALK)).toBe(true)
    expect(acceptsElicitedBelief(undefined)).toBe(true)
  })

  it('REFUSES a model_scale value outside [0,1], whatever the factor shape', () => {
    // Covers every route a number can take that is NOT `suggested_value` —
    // a clarification chip, or any future caller of this basis.
    for (const bad of [1.5, -0.1, 5, 70]) {
      expect(
        buildFactorValueEditEvent({
          nodeId: 'fac_content_marketing',
          typedValue: bad,
          nodeData: WALK,
          seedBasis: 'model_scale',
        }),
      ).toBeNull()
    }
    // Boundaries still commit: the refusal is out-of-range, not near-range.
    for (const ok of [0, 1]) {
      expect(
        (buildFactorValueEditEvent({
          nodeId: 'fac_content_marketing',
          typedValue: ok,
          nodeData: WALK,
          seedBasis: 'model_scale',
        })!.payload as Record<string, unknown>).value,
      ).toBe(ok)
    }
  })

  it('CONTROL — the other two bases are UNTOUCHED on the uncapped magnitude shape', () => {
    // The refusals are scoped to `model_scale`. A typed £45,000 on this factor
    // must still commit exactly as it does today.
    const typed = buildFactorValueEditEvent({
      nodeId: 'fac_spend',
      typedValue: 45000,
      nodeData: UNCAPPED_MAGNITUDE,
      seedBasis: 'raw_only',
    })
    const payload = typed!.payload as Record<string, unknown>
    expect(payload.value).toBe(45000)
    expect(payload.raw_value).toBe(45000)
    expect(payload.unit).toBe('£')
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
