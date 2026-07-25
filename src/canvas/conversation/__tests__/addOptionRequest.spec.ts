/**
 * addOptionRequest — the pure producer seam.
 *
 * The load-bearing test in this file is `wire seam`: it drives the builder's
 * output through the REAL buildChipMeta → buildV5Payload chain and asserts the
 * final wire payload. Asserting the builder's return value alone would let a
 * dropped `intent` survive anywhere downstream (chipMeta lift, the send gate,
 * the chip sub-object) — the exact escape a recent UI lane hit when removing a
 * provenance stamp left 27 tests green.
 */
import { describe, expect, it } from 'vitest'
import type { Node } from '@xyflow/react'

import {
  ADD_OPTION_CHIP_ID,
  buildAddOptionDispatch,
  describeAddOptionRefusal,
  detectAddOptionRequest,
  resolveAddOptionTargets,
  NO_OUTCOME_CLAIM_VOCABULARY,
} from '../addOptionRequest'
import { buildChipMeta } from '../chipMeta'
import { normaliseRawFactorValue } from '../../utils/observedStateHelpers'
import { buildV5Payload } from '../../../v5/buildPayload'
import { MAX_ADD_OPTION_INTERVENTIONS } from '../../../v5/chipParameters'

// --- fixtures ---------------------------------------------------------------

function node(id: string, kind: string, label: string, observed?: Record<string, unknown>): Node {
  return {
    id,
    type: kind,
    position: { x: 0, y: 0 },
    data: { label, kind, ...(observed ? { observedState: observed } : {}) },
  } as unknown as Node
}

const GRAPH: Node[] = [
  node('dec_bakery', 'decision', 'Open Second Bakery Location in Leeds'),
  node('fac_capex', 'factor', 'Capital Investment', { value: 0.65, raw_value: 26000, unit: '£', cap: 40000 }),
  node('fac_timing', 'factor', 'Speed of Launch', { value: 0.4 }),
  node('goal_x', 'goal', 'Profitable Expansion'),
  node('opt_a', 'option', 'Open Next Quarter'),
]

// --- 1. detection -----------------------------------------------------------

describe('detectAddOptionRequest', () => {
  it.each([
    ['Add an option called Hybrid Pilot', 'Hybrid Pilot'],
    ['add a new option called Hybrid Pilot', 'Hybrid Pilot'],
    ['Create an option named Franchise Model', 'Franchise Model'],
    ['Include another option titled Slow Rollout', 'Slow Rollout'],
    ['Can you add an option called Hybrid Pilot', 'Hybrid Pilot'],
    ['Please add an option called Hybrid Pilot', 'Hybrid Pilot'],
    ["I'd like to add an option called Hybrid Pilot", 'Hybrid Pilot'],
    ['Add an option "Hybrid Pilot"', 'Hybrid Pilot'],
    ['Add an option “Hybrid Pilot”', 'Hybrid Pilot'],
    ['Add an alternative called Hybrid Pilot', 'Hybrid Pilot'],
    ['Add a choice called Hybrid Pilot', 'Hybrid Pilot'],
    // A trailing descriptive clause names the option, not the clause.
    ['Add an option called Hybrid Pilot that cuts cost by 20%', 'Hybrid Pilot'],
    ['Add an option called Hybrid Pilot.', 'Hybrid Pilot'],
  ])('matches %j → %j', (text, label) => {
    expect(detectAddOptionRequest(text)).toEqual({ label })
  })

  it.each([
    // Deliberation, not an instruction.
    ['Should I add an option called Hybrid Pilot?'],
    ['Do you think we should add an option called Hybrid?'],
    ['Is it worth adding an option called Hybrid'],
    ['What if I add an option called Hybrid?'],
    // ISOLATES THE QUESTION-MARK RULE. Every case above is also blocked by the
    // imperative test, so without these the '?' rejection is untested — a
    // mutation removing it escaped 68 green tests until they were added.
    ['Can you add an option called Hybrid Pilot?'],
    ['Please add an option called Hybrid Pilot?'],
    ['Add an option called Hybrid Pilot?'],
    // Plural = a brainstorm request for the coach, not one resolved option.
    ['Add more options'],
    ['Add some alternatives to consider'],
    ['Create three new options'],
    // ISOLATES THE SINGULAR RULE. The three above are all blocked by the
    // quantifier word ("more"/"some"/"three"), not by the plural — so without
    // these the singular constraint is untested, and a mutation admitting
    // plurals escaped 68 green tests.
    ['Add options called Hybrid and Franchise'],
    ['Add alternatives called Hybrid'],
    ['Create choices called Hybrid'],
    ['Add the options called Hybrid'],
    // No nameable label — the free-text lane still handles it.
    ['Add an option'],
    ['Add an option to the model'],
    // Not an add-option request at all.
    ['What are my options?'],
    ['Remove the option called Hybrid Pilot'],
    ['Explain the option called Hybrid Pilot'],
    ['Add a factor called Shipping costs'],
    ['Add a risk called Supplier failure'],
    [''],
    ['   '],
  ])('does NOT match %j', (text) => {
    expect(detectAddOptionRequest(text)).toBeNull()
  })

  it('never throws on non-string input', () => {
    expect(detectAddOptionRequest(undefined as unknown as string)).toBeNull()
    expect(detectAddOptionRequest(null as unknown as string)).toBeNull()
    expect(detectAddOptionRequest(42 as unknown as string)).toBeNull()
  })
})

// --- 2. canvas resolution ---------------------------------------------------

describe('resolveAddOptionTargets', () => {
  it('derives the decision node and every factor, and nothing else', () => {
    const t = resolveAddOptionTargets(GRAPH)
    expect(t.decisionId).toBe('dec_bakery')
    expect(t.decisionLabel).toBe('Open Second Bakery Location in Leeds')
    expect(t.factors.map((f) => f.id)).toEqual(['fac_capex', 'fac_timing'])
  })

  it('carries the raw figure, unit and cap when the factor has an honest scale', () => {
    const capex = resolveAddOptionTargets(GRAPH).factors[0]
    expect(capex).toMatchObject({ currentRaw: 26000, unit: '£', cap: 40000 })
  })

  it('falls back to model space when there is no cap', () => {
    const timing = resolveAddOptionTargets(GRAPH).factors[1]
    expect(timing).toMatchObject({ currentRaw: 0.4, unit: undefined, cap: undefined })
  })

  it('resolves kind from data.kind even when the ReactFlow type disagrees', () => {
    const mislabelled = [
      { ...node('d1', 'default', 'Decision'), data: { label: 'Decision', kind: 'decision' } },
    ] as unknown as Node[]
    expect(resolveAddOptionTargets(mislabelled).decisionId).toBe('d1')
  })

  it('reports no decision node on an empty canvas', () => {
    expect(resolveAddOptionTargets([]).decisionId).toBeNull()
  })
})

// --- 2b. the raw→model-space rule -------------------------------------------

describe('normaliseRawFactorValue', () => {
  it('divides by a genuine positive cap', () => {
    expect(normaliseRawFactorValue(20000, 40000)).toBe(0.5)
  })

  // A cap of 0 divides to Infinity and a negative cap flips the sign — both
  // would reach CEE as a "genuine finite number" and commit silently. The
  // guard, not the caller, is what stops them.
  it.each([
    ['zero', 0],
    ['negative', -40000],
    ['NaN', Number.NaN],
    ['Infinity', Number.POSITIVE_INFINITY],
  ])('treats a %s cap as no scale and returns the raw figure', (_name, cap) => {
    expect(normaliseRawFactorValue(20000, cap)).toBe(20000)
  })

  it('treats a missing cap as no scale', () => {
    expect(normaliseRawFactorValue(0.8, undefined)).toBe(0.8)
    expect(normaliseRawFactorValue(0.8, null)).toBe(0.8)
  })

  it('never invents a value from a non-finite input', () => {
    expect(normaliseRawFactorValue(Number.NaN, 40000)).toBeNaN()
  })
})

describe('a zero cap cannot produce a non-finite intervention', () => {
  const ZERO_CAP: Node[] = [
    node('dec_1', 'decision', 'D'),
    node('fac_zero', 'factor', 'Zero Cap', { value: 0, cap: 0, unit: '£' }),
  ]
  it('sends the typed figure, never Infinity', () => {
    const r = buildAddOptionDispatch({
      label: 'X',
      changes: [{ factorId: 'fac_zero', rawValue: 500 }],
      nodes: ZERO_CAP,
    })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    const value = r.dispatch.parameters.interventions[0].value
    expect(Number.isFinite(value)).toBe(true)
    expect(value).toBe(500)
  })
})

// --- 3. dispatch construction ----------------------------------------------

describe('buildAddOptionDispatch', () => {
  it('builds the typed add_option chip with canvas-resolved ids', () => {
    const r = buildAddOptionDispatch({
      label: 'Hybrid Pilot',
      changes: [{ factorId: 'fac_capex', rawValue: 20000 }],
      nodes: GRAPH,
    })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.dispatch.id).toBe(ADD_OPTION_CHIP_ID)
    expect(r.dispatch.intent).toBe('add_option')
    expect(r.dispatch.parameters).toEqual({
      parent_decision_id: 'dec_bakery',
      label: 'Hybrid Pilot',
      // 20000 / cap 40000 — the same raw→model rule every other value-edit path
      // in the UI applies, with the raw figure and unit preserved alongside.
      interventions: [{ factor_id: 'fac_capex', value: 0.5, unit: '£', raw_value: 20000 }],
    })
  })

  it('sends the typed number in model space, never the raw figure', () => {
    const r = buildAddOptionDispatch({
      label: 'X',
      changes: [{ factorId: 'fac_capex', rawValue: 40000 }],
      nodes: GRAPH,
    })
    expect(r.ok && r.dispatch.parameters.interventions[0].value).toBe(1)
  })

  it('treats the typed number AS model space when the factor has no cap', () => {
    const r = buildAddOptionDispatch({
      label: 'X',
      changes: [{ factorId: 'fac_timing', rawValue: 0.8 }],
      nodes: GRAPH,
    })
    expect(r.ok && r.dispatch.parameters.interventions[0]).toEqual({
      factor_id: 'fac_timing',
      value: 0.8,
    })
  })

  it('accepts an option with no changes at all', () => {
    const r = buildAddOptionDispatch({ label: 'Status Quo Plus', changes: [], nodes: GRAPH })
    expect(r.ok).toBe(true)
    expect(r.ok && r.dispatch.parameters.interventions).toEqual([])
    expect(r.ok && r.dispatch.message).toBe('Add an option called "Status Quo Plus".')
  })

  it('names every changed factor in the message, truthfully', () => {
    const r = buildAddOptionDispatch({
      label: 'Hybrid',
      changes: [
        { factorId: 'fac_capex', rawValue: 20000 },
        { factorId: 'fac_timing', rawValue: 0.9 },
      ],
      nodes: GRAPH,
    })
    expect(r.ok && r.dispatch.message).toBe(
      'Add an option called "Hybrid" that changes "Capital Investment" and "Speed of Launch".',
    )
  })

  // ⭐ THE GUARD. Proven on the live wire 2026-07-25: an id CEE cannot find does
  // NOT error — it silently falls through to the LLM edit lane (18–27s,
  // exit_path 'edit_graph'), same 200, same held_proposal shape. Refusing here
  // is the only thing standing between a stale id and an invisible degradation.
  it('REFUSES a factor id that is not on the canvas', () => {
    const r = buildAddOptionDispatch({
      label: 'Hybrid',
      changes: [{ factorId: 'fac_deleted', rawValue: 1 }],
      nodes: GRAPH,
    })
    expect(r.ok).toBe(false)
    expect(!r.ok && r.refusal).toEqual({ kind: 'unknown_factor', factorId: 'fac_deleted' })
  })

  it('REFUSES an id that exists but is not a factor', () => {
    const r = buildAddOptionDispatch({
      label: 'Hybrid',
      changes: [{ factorId: 'opt_a', rawValue: 1 }],
      nodes: GRAPH,
    })
    expect(!r.ok && r.refusal.kind).toBe('unknown_factor')
  })

  it('REFUSES when the canvas has no decision node', () => {
    const r = buildAddOptionDispatch({ label: 'Hybrid', changes: [], nodes: [] })
    expect(!r.ok && r.refusal).toEqual({ kind: 'no_decision_node' })
  })

  it('REFUSES an empty or whitespace label', () => {
    expect(buildAddOptionDispatch({ label: '   ', changes: [], nodes: GRAPH })).toEqual({
      ok: false,
      refusal: { kind: 'label_required' },
    })
  })

  it('REFUSES more changes than CEE can hold in one proposal', () => {
    const many = Array.from({ length: MAX_ADD_OPTION_INTERVENTIONS + 1 }, (_, i) => ({
      factorId: `fac_${i}`,
      rawValue: 1,
    }))
    const r = buildAddOptionDispatch({ label: 'Hybrid', changes: many, nodes: GRAPH })
    expect(!r.ok && r.refusal).toEqual({
      kind: 'too_many_changes',
      max: MAX_ADD_OPTION_INTERVENTIONS,
    })
  })

  it('REFUSES a non-finite value rather than coercing it', () => {
    const r = buildAddOptionDispatch({
      label: 'Hybrid',
      changes: [{ factorId: 'fac_timing', rawValue: Number.NaN }],
      nodes: GRAPH,
    })
    expect(!r.ok && r.refusal).toEqual({ kind: 'parameters', reason: 'value_not_finite' })
  })

  it('REFUSES the same factor twice', () => {
    const r = buildAddOptionDispatch({
      label: 'Hybrid',
      changes: [
        { factorId: 'fac_timing', rawValue: 0.2 },
        { factorId: 'fac_timing', rawValue: 0.3 },
      ],
      nodes: GRAPH,
    })
    expect(!r.ok && r.refusal).toEqual({ kind: 'parameters', reason: 'duplicate_factor' })
  })

  it('gives every refusal a specific, non-generic explanation', () => {
    const refusals = [
      { kind: 'label_required' },
      { kind: 'no_decision_node' },
      { kind: 'unknown_factor', factorId: 'x' },
      { kind: 'too_many_changes', max: 6 },
      { kind: 'parameters', reason: 'value_not_finite' },
      { kind: 'parameters', reason: 'duplicate_factor' },
    ] as const
    const texts = refusals.map((r) => describeAddOptionRefusal(r))
    expect(new Set(texts).size).toBe(texts.length)
    for (const t of texts) {
      expect(t.length).toBeGreaterThan(10)
      expect(t).not.toMatch(/something went wrong|unknown error|try again later/i)
    }
  })
})

// --- 4. ⭐ THE WIRE SEAM ----------------------------------------------------

describe('wire seam — builder output through the REAL chipMeta → buildV5Payload chain', () => {
  function toWire(dispatchLike: { id: string; intent: string; parameters: Record<string, unknown>; message: string }) {
    const chipMeta = buildChipMeta(dispatchLike)
    const built = buildV5Payload({
      turnId: 't-1',
      scenarioId: 's-1',
      stage: 'frame',
      turnClass: 'propose',
      mode: 'user',
      message: dispatchLike.message,
      source: 'chip',
      chipMeta,
    })
    expect(built.ok).toBe(true)
    return built.ok ? built.payload : null
  }

  it('puts intent AND the full parameter spec on the wire chip', () => {
    const r = buildAddOptionDispatch({
      label: 'Hybrid Pilot',
      changes: [{ factorId: 'fac_capex', rawValue: 20000 }],
      nodes: GRAPH,
    })
    expect(r.ok).toBe(true)
    if (!r.ok) return

    const payload = toWire(r.dispatch)
    expect(payload).not.toBeNull()
    expect(payload!.kind).toBe('message')
    const chip = (payload as { chip?: Record<string, unknown> }).chip
    // If `intent` is dropped ANYWHERE — the builder, buildChipMeta, or the
    // CEE_ACCEPTED_INTENTS send gate — this assertion is the one that goes RED.
    expect(chip?.intent).toBe('add_option')
    expect(chip?.id).toBe(ADD_OPTION_CHIP_ID)
    expect(chip?.parameters).toEqual({
      parent_decision_id: 'dec_bakery',
      label: 'Hybrid Pilot',
      interventions: [{ factor_id: 'fac_capex', value: 0.5, unit: '£', raw_value: 20000 }],
    })
  })

  it('emits GENUINE finite numbers on the wire, never strings', () => {
    const r = buildAddOptionDispatch({
      label: 'Hybrid',
      changes: [{ factorId: 'fac_capex', rawValue: 20000 }],
      nodes: GRAPH,
    })
    if (!r.ok) throw new Error('expected ok')
    const chip = (toWire(r.dispatch) as { chip?: { parameters?: { interventions: unknown[] } } }).chip
    const iv = chip!.parameters!.interventions[0] as Record<string, unknown>
    expect(typeof iv.value).toBe('number')
    expect(Number.isFinite(iv.value as number)).toBe(true)
    expect(typeof iv.raw_value).toBe('number')
    // Round-trips through JSON as a number, not "0.5".
    const roundTripped = JSON.parse(JSON.stringify(chip)) as { parameters: { interventions: Record<string, unknown>[] } }
    expect(typeof roundTripped.parameters.interventions[0].value).toBe('number')
  })

  it('carries no key CEE does not expect in the add_option spec', () => {
    const r = buildAddOptionDispatch({ label: 'Hybrid', changes: [], nodes: GRAPH })
    if (!r.ok) throw new Error('expected ok')
    // Chip identity rides `chip.id`, NOT the parameter spec: an extra key in
    // `parameters` is read by CEE's AddOptionParamsSchema, and polluting it is
    // how a typed chip quietly becomes a free-text one.
    expect(Object.keys(r.dispatch.parameters).sort()).toEqual([
      'interventions',
      'label',
      'parent_decision_id',
    ])
  })
})

// --- 5. no-outcome-claim vocabulary ----------------------------------------

describe('the producer never claims an outcome', () => {
  it('keeps outcome verbs out of every string the builder emits', () => {
    const r = buildAddOptionDispatch({
      label: 'Hybrid',
      changes: [{ factorId: 'fac_capex', rawValue: 20000 }],
      nodes: GRAPH,
    })
    if (!r.ok) throw new Error('expected ok')
    // SUBSTRING, not a word-boundary regex. A boundary assertion is the weaker
    // prohibition (it misses "addedA", "successfully"), and weaker is the wrong
    // direction for a rule whose whole job is to catch a claim.
    for (const s of [r.dispatch.label, r.dispatch.message]) {
      for (const banned of NO_OUTCOME_CLAIM_VOCABULARY) {
        expect(s.toLowerCase()).not.toContain(banned)
      }
    }
  })

  it('positive control — the vocabulary check can SEE a violation', () => {
    const claim = 'Added option "Hybrid"'.toLowerCase()
    expect(NO_OUTCOME_CLAIM_VOCABULARY.filter((w) => claim.includes(w))).toContain('added')
  })
})
