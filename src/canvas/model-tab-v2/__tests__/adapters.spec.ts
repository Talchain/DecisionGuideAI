/**
 * Model tab v2 — THE STORE → PROJECTION ADAPTER (adapters.ts).
 *
 * Fixtures are built to the PRODUCER's shapes, derived at the bytes from
 * `domain/nodes.ts` (`ObservedStateSchema`, `FactorNodeDataSchema`,
 * `OptionNodeDataSchema`), `domain/edges.ts` (`EdgeDataSchema` and its
 * set-vs-defaulted source stamps) and `store.ts:388` (`goalThreshold`, raw user
 * units). A fixture invented from this file's own idea of the store would prove
 * only that the adapter agrees with my imagination.
 *
 * Two things carry this file:
 *   · THE PORT PIN — the one predicate copied out of the live tree is asserted
 *     to agree with the live original over a corpus, so the copy cannot drift;
 *   · THE DISCRIMINATING PAIR — a store change that MUST reach the projection,
 *     and one that MUST NOT, so a frozen or over-eager projection both fail.
 */

import { describe, it, expect } from 'vitest'
import type { Edge, Node } from '@xyflow/react'
import type { EdgeData } from '../../domain/edges'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { countFactorsToVerify } from '../../components/model-tab/utils'
import { factorNeedsVerification } from '../../domain/valueProvenance'
import {
  edgeIsContested,
  nodeKind,
  optionHasNoInterventions,
  toModelRows,
  toRepairQueueItems,
  toRowDetail,
  type ModelProjectionInput,
} from '../adapters'

// ── Fixtures, shaped like the producer ───────────────────────────────────────

function factorNode(
  id: string,
  label: string,
  observedState: Record<string, unknown> | null,
): Node {
  return {
    id,
    type: 'factor',
    position: { x: 0, y: 0 },
    data: { label, type: 'factor', observedState },
  }
}

function optionNode(id: string, label: string, interventions?: Record<string, number>): Node {
  return {
    id,
    type: 'option',
    position: { x: 0, y: 0 },
    data: { label, type: 'option', ...(interventions ? { interventions } : {}) },
  }
}

function goalNode(id = 'g1', label = 'Reach £2m ARR'): Node {
  return { id, type: 'goal', position: { x: 0, y: 0 }, data: { label, type: 'goal' } }
}

function edge(id: string, source: string, target: string, data: Partial<EdgeData> = {}): Edge<EdgeData> {
  return { id, source, target, data: data as EdgeData }
}

function input(over: Partial<ModelProjectionInput> = {}): ModelProjectionInput {
  return { nodes: [], edges: [], goalThreshold: null, ...over }
}

/** A factor whose value the user has confirmed — the "no attention" baseline. */
const CONFIRMED_OBS = { raw_value: 45, unit: 'days', source: 'user_confirmed' }

// ── Kind and grouping ────────────────────────────────────────────────────────

describe('nodeKind — resolved the way the live tree resolves it', () => {
  it('reads node.type first, then data.kind, then data.type', () => {
    expect(nodeKind({ type: 'factor', data: {} })).toBe('factor')
    expect(nodeKind({ data: { kind: 'option' } })).toBe('option')
    expect(nodeKind({ data: { type: 'risk' } })).toBe('risk')
  })

  it('returns null for kinds this surface has no group for, rather than guessing', () => {
    // `action` and `constraint` are real NodeTypeEnum members. Filing them under
    // an arbitrary group would put them on screen in the wrong place.
    expect(nodeKind({ type: 'action', data: {} })).toBeNull()
    expect(nodeKind({ type: 'constraint', data: {} })).toBeNull()
  })
})

describe('toModelRows — every element lands in its declared group', () => {
  it('maps kinds onto the seven groups', () => {
    const rows = toModelRows(
      input({
        nodes: [goalNode(), optionNode('o1', 'Hire two AEs'), factorNode('f1', 'Sales cycle', CONFIRMED_OBS)],
        edges: [edge('e1', 'f1', 'g1', { weight: 0.6, weightSource: 'cee' })],
      }),
    )
    const byId = Object.fromEntries(rows.map(r => [r.id, r.group]))
    expect(byId).toEqual({ g1: 'goal', o1: 'options', f1: 'factors', e1: 'relationships' })
  })

  it('drops action/constraint nodes entirely', () => {
    const rows = toModelRows(
      input({
        nodes: [
          factorNode('f1', 'Kept', CONFIRMED_OBS),
          { id: 'a1', type: 'action', position: { x: 0, y: 0 }, data: { label: 'Dropped' } },
        ],
      }),
    )
    expect(rows.map(r => r.id)).toEqual(['f1'])
  })
})

// ── Factors ──────────────────────────────────────────────────────────────────

describe('toModelRows — factor values and attention', () => {
  it('carries THIS factor\'s value, bound by id, with a confusable sibling present', () => {
    const rows = toModelRows(
      input({
        nodes: [
          factorNode('f1', 'Sales cycle', { raw_value: 45, unit: 'days', source: 'user_confirmed' }),
          factorNode('f2', 'Other cycle', { raw_value: 90, unit: 'days', source: 'user_confirmed' }),
        ],
      }),
    )
    const byId = Object.fromEntries(rows.map(r => [r.id, r.primaryValue]))
    expect(byId.f1).toContain('45')
    expect(byId.f2).toContain('90')
  })

  it('a factor with no observed state has NO value and says so', () => {
    const rows = toModelRows(input({ nodes: [factorNode('f1', 'Unset', null)] }))
    expect(rows[0].primaryValue).toBeNull()
    // Not 0, not '', not 'unknown' — an explicit absence the queue can act on.
    expect(rows[0].attention).toContain('no-value')
  })

  it('an AI estimate is flagged unconfirmed; a confirmed value is not', () => {
    const rows = toModelRows(
      input({
        nodes: [
          factorNode('f1', 'AI', { raw_value: 45, unit: 'days', source: 'cee_inference' }),
          factorNode('f2', 'Confirmed', CONFIRMED_OBS),
        ],
      }),
    )
    const byId = Object.fromEntries(rows.map(r => [r.id, r.attention]))
    expect(byId.f1).toContain('unconfirmed-estimate')
    expect(byId.f2).toEqual([])
  })

  it('carries the RAW provenance stamp, not a classified kind', () => {
    const rows = toModelRows(input({ nodes: [factorNode('f1', 'X', CONFIRMED_OBS)] }))
    // The pill classifies; the projection must not pre-classify (types.ts).
    expect(rows[0].provenanceSource).toBe('user_confirmed')
  })
})

// ── ⭐ THE PORT PIN, RETIRED AND REPLACED (18 Aug 2026) ──────────────────────
//
// This block used to pin a COPY: `adapters.ts` carried its own
// `factorNeedsVerification`, ported from the filter body inside
// `countFactorsToVerify`, and these tests asserted the two agreed over a corpus.
//
// ⚠ THE PIN WAS HONEST AND IT WAS STILL A MIRROR. Agreement is all a derived
// guard can ever prove — never that either side is RIGHT — and it needed a
// hand-written corpus to prove even that (trap 12d). The REHOME → DELETE lane
// removed the copy: the predicate now lives once, in `domain/valueProvenance`,
// and both readers import it.
//
// So the corpus-agreement assertions became TAUTOLOGIES — the same function on
// both sides of the equals sign — and a tautology that reads as a guard is
// worse than no guard. They are replaced by the claim that actually matters
// now: THERE IS EXACTLY ONE DEFINITION, and the count still delegates to it.
// The corpus is kept, because it is the thing that would notice the surviving
// definition being wrong (trap 12d's other half: derivation and corpus are not
// redundant — ship both).

describe('⭐ ONE definition of "needs verification", and the count delegates to it', () => {
  /**
   * A corpus spanning every shape the live filter distinguishes, INCLUDING the
   * snake_case wire spelling and a factor with no observed state at all.
   */
  const CORPUS: Node[] = [
    factorNode('a', 'no source', { raw_value: 1 }),
    factorNode('b', 'cee_inference', { raw_value: 1, source: 'cee_inference' }),
    factorNode('c', 'user', { raw_value: 1, source: 'user' }),
    factorNode('d', 'user_confirmed', { raw_value: 1, source: 'user_confirmed' }),
    factorNode('e', 'brief', { raw_value: 1, source: 'brief_extraction' }),
    factorNode('f', 'no observed state', null),
    {
      id: 'g',
      type: 'factor',
      position: { x: 0, y: 0 },
      // The WIRE spelling. Reading only camelCase here would under-count.
      data: { label: 'snake_case', type: 'factor', observed_state: { raw_value: 1, source: 'cee_inference' } },
    },
  ]

  it('the badge COUNT is the domain predicate applied N times — it holds no copy', () => {
    // Still worth asserting after the move: it goes RED the day
    // `countFactorsToVerify` grows its own inline predicate back.
    const viaPredicate = CORPUS.filter(n => factorNeedsVerification(n.data)).length
    expect(countFactorsToVerify(CORPUS)).toBe(viaPredicate)
    // ⚠ AND THE COUNT IS NOT TRIVIAL. Without this the line above would pass on
    // a corpus where nothing needs verification, i.e. on two functions that both
    // return false for everything (trap 13 — an absence assertion needs a
    // positive control).
    expect(viaPredicate).toBeGreaterThan(0)
    expect(viaPredicate).toBeLessThan(CORPUS.length)
  })

  it('⭐ the predicate is DEFINED exactly once in the tree — the mirror is gone, not relocated', () => {
    const read = (rel: string) => readFileSync(join(__dirname, rel), 'utf8')
    const DEFINITION = /export function factorNeedsVerification\s*\(/
    const domain = read('../../domain/valueProvenance.ts')
    const adapters = read('../adapters.ts')
    const utils = read('../../components/model-tab/utils.ts')

    // POSITIVE CONTROL: the matcher can see a definition when one is present —
    // otherwise "no definition here" would be reported by a blind regex.
    expect(DEFINITION.test(domain)).toBe(true)

    // The two former copy sites hold NEITHER a definition NOR a re-export. A
    // re-export would keep the name reachable from three places with one owner,
    // which is the shim this lane exists to refuse.
    for (const [name, src] of [['adapters.ts', adapters], ['model-tab/utils.ts', utils]] as const) {
      expect(`${name}: ${DEFINITION.test(src)}`).toBe(`${name}: false`)
      expect(`${name}: ${/export\s*\{[^}]*factorNeedsVerification/.test(src)}`).toBe(`${name}: false`)
    }
  })

  it('and they agree on the empty case', () => {
    expect([].filter(() => true).length).toBe(countFactorsToVerify([]))
  })

  it('the predicate identifies WHICH factors, which is what a queue needs', () => {
    // The corpus survives the move DELIBERATELY. A single definition cannot be
    // wrong-and-consistent-with-itself into a red; only a hand-written corpus
    // notices the surviving definition being wrong. Note `d` (`user_confirmed`)
    // is absent — which is what makes the rehomed Confirm ✓ clear the badge.
    const flagged = CORPUS.filter(n => factorNeedsVerification(n.data)).map(n => n.id)
    expect(flagged).toEqual(['a', 'b', 'f', 'g'])
  })
})

// ── Edges: the read-side gates are not re-implemented here ───────────────────

describe('toModelRows — edge values pass through the live honesty gates', () => {
  it('an UNSTAMPED weight renders nothing rather than the UI default', () => {
    const rows = toModelRows(
      input({ nodes: [factorNode('f1', 'A', CONFIRMED_OBS), goalNode()], edges: [edge('e1', 'f1', 'g1', { weight: 0.6 })] }),
    )
    const e = rows.find(r => r.id === 'e1')!
    // No `weightSource` ⇒ nobody set it ⇒ the number is not fit to speak.
    expect(e.primaryValue).toBeNull()
  })

  it('POSITIVE CONTROL: a STAMPED weight does render a label', () => {
    // Without this the assertion above would also pass on an adapter that never
    // renders an edge value at all.
    const rows = toModelRows(
      input({
        nodes: [factorNode('f1', 'A', CONFIRMED_OBS), goalNode()],
        edges: [edge('e1', 'f1', 'g1', { weight: 0.6, weightSource: 'cee', direction: 'positive', directionSource: 'cee' })],
      }),
    )
    expect(rows.find(r => r.id === 'e1')!.primaryValue).toBeTruthy()
  })

  it('a direction nobody stated is not turned into a positive effect', () => {
    const rows = toModelRows(
      input({
        nodes: [factorNode('f1', 'A', CONFIRMED_OBS), goalNode()],
        // `direction: 'positive'` with NO directionSource is the UI default —
        // the exact fabrication the Model tab shipped as "Strong positive effect".
        edges: [edge('e1', 'f1', 'g1', { weight: 0.9, weightSource: 'cee', direction: 'positive' })],
      }),
    )
    expect(rows.find(r => r.id === 'e1')!.primaryValue).not.toMatch(/positive/i)
  })
})

describe('edgeIsContested — BOTH conjuncts, as the live tab reads them', () => {
  it('is contested only while the disagreement is still pending', () => {
    expect(edgeIsContested({ validation: { status: 'contested', user_action: 'pending' } })).toBe(true)
  })

  it('is NOT contested once the user has acted, though the status remains', () => {
    // Dropping this conjunct would refill Queue C with decisions already made.
    expect(edgeIsContested({ validation: { status: 'contested', user_action: 'accepted_pass1' } })).toBe(false)
  })

  it('is not contested with no validation metadata at all', () => {
    expect(edgeIsContested({})).toBe(false)
    expect(edgeIsContested(undefined)).toBe(false)
  })
})

// ── Options ──────────────────────────────────────────────────────────────────

describe('options — missing interventions are surfaced, present ones counted', () => {
  it('flags an option that changes nothing', () => {
    const rows = toModelRows(input({ nodes: [optionNode('o1', 'Hire two AEs')] }))
    expect(rows[0].attention).toContain('missing-intervention')
    expect(rows[0].primaryValue).toBeNull()
  })

  it('counts an option\'s interventions', () => {
    const rows = toModelRows(input({ nodes: [optionNode('o1', 'Hire', { f1: 30, f2: 4 })] }))
    expect(rows[0].primaryValue).toBe('2 changes')
    expect(rows[0].attention).toEqual([])
  })

  it('says "1 change" for a single one', () => {
    const rows = toModelRows(input({ nodes: [optionNode('o1', 'Hire', { f1: 30 })] }))
    expect(rows[0].primaryValue).toBe('1 change')
  })

  it('optionHasNoInterventions matches the live allUnmapped body', () => {
    expect(optionHasNoInterventions({})).toBe(true)
    expect(optionHasNoInterventions({ interventions: {} })).toBe(true)
    expect(optionHasNoInterventions({ interventions: { f1: 1 } })).toBe(false)
  })
})

// ── Goal ─────────────────────────────────────────────────────────────────────

describe('goal — the threshold is read raw and absence is a fact', () => {
  it('renders the raw threshold without converting it', () => {
    const rows = toModelRows(input({ nodes: [goalNode()], goalThreshold: 2000000 }))
    // Raw user units per the store's own contract — never divided by a cap here.
    expect(rows[0].primaryValue).toBeTruthy()
    expect(rows[0].attention).toEqual([])
  })

  it('a goal with no threshold reports no value', () => {
    const rows = toModelRows(input({ nodes: [goalNode()], goalThreshold: null }))
    expect(rows[0].primaryValue).toBeNull()
    expect(rows[0].attention).toContain('no-value')
  })
})

// ── ⭐ THE DISCRIMINATING PAIR ───────────────────────────────────────────────

describe('⭐ the projection tracks the store — and only where it should', () => {
  const base = () =>
    input({
      nodes: [
        factorNode('f1', 'Sales cycle', { raw_value: 45, unit: 'days', source: 'user_confirmed' }),
        factorNode('f2', 'Win rate', { raw_value: 22, unit: '%', source: 'user_confirmed' }),
      ],
    })

  it('A CHANGE THAT MUST REACH THE PROJECTION does: f1\'s value changes f1\'s row', () => {
    const before = toModelRows(base()).find(r => r.id === 'f1')!
    const after = toModelRows(
      input({
        nodes: [
          factorNode('f1', 'Sales cycle', { raw_value: 60, unit: 'days', source: 'user_confirmed' }),
          factorNode('f2', 'Win rate', { raw_value: 22, unit: '%', source: 'user_confirmed' }),
        ],
      }),
    ).find(r => r.id === 'f1')!

    // A frozen projection — one that ignored the store — fails exactly here.
    expect(after.primaryValue).not.toBe(before.primaryValue)
    expect(after.primaryValue).toContain('60')
  })

  it('AN UNRELATED CHANGE DOES NOT: editing f2 leaves f1\'s row byte-identical', () => {
    const before = toModelRows(base()).find(r => r.id === 'f1')!
    const after = toModelRows(
      input({
        nodes: [
          factorNode('f1', 'Sales cycle', { raw_value: 45, unit: 'days', source: 'user_confirmed' }),
          // f2 changed in both value and label.
          factorNode('f2', 'Renamed', { raw_value: 99, unit: '%', source: 'cee_inference' }),
        ],
      }),
    ).find(r => r.id === 'f1')!

    // This is the discrimination: without it, the assertion above would also
    // pass on a projection that changed every row whenever anything moved.
    expect(after).toEqual(before)
  })

  it('and the unrelated change DOES reach its own row', () => {
    const after = toModelRows(
      input({
        nodes: [
          factorNode('f1', 'Sales cycle', { raw_value: 45, unit: 'days', source: 'user_confirmed' }),
          factorNode('f2', 'Renamed', { raw_value: 99, unit: '%', source: 'cee_inference' }),
        ],
      }),
    ).find(r => r.id === 'f2')!
    expect(after.label).toBe('Renamed')
    expect(after.attention).toContain('unconfirmed-estimate')
  })
})

// ── Queues ───────────────────────────────────────────────────────────────────

describe('toRepairQueueItems — each queue derives from the same predicate as its chip', () => {
  const nodes = [
    factorNode('f1', 'Unconfirmed', { raw_value: 45, unit: 'days', source: 'cee_inference' }),
    factorNode('f2', 'Confirmed', CONFIRMED_OBS),
    factorNode('f3', 'No value', null),
    optionNode('o1', 'Unmapped'),
    optionNode('o2', 'Mapped', { f1: 30 }),
  ]

  it('confirm-estimates returns exactly the unconfirmed factors, in order', () => {
    const items = toRepairQueueItems(input({ nodes }), 'confirm-estimates')
    // f3 has no source either, so it is also unconfirmed — identity, not count.
    expect(items.map(i => i.rowId)).toEqual(['f1', 'f3'])
  })

  it('no-value returns exactly the factors with nothing set', () => {
    const items = toRepairQueueItems(input({ nodes }), 'no-value')
    expect(items.map(i => i.rowId)).toEqual(['f3'])
  })

  it('set-option-values returns exactly the options that change nothing', () => {
    const items = toRepairQueueItems(input({ nodes }), 'set-option-values')
    expect(items.map(i => i.rowId)).toEqual(['o1'])
  })

  it('contested returns exactly the pending contested edges', () => {
    const items = toRepairQueueItems(
      input({
        nodes: [factorNode('f1', 'A', CONFIRMED_OBS), goalNode()],
        edges: [
          edge('e1', 'f1', 'g1', { validation: { status: 'contested', user_action: 'pending' } } as Partial<EdgeData>),
          edge('e2', 'f1', 'g1', { validation: { status: 'contested', user_action: 'accepted_pass1' } } as Partial<EdgeData>),
        ],
      }),
      'contested',
    )
    expect(items.map(i => i.rowId)).toEqual(['e1'])
  })

  it('a queue item carries the factor\'s CURRENT value, not an invented suggestion', () => {
    const items = toRepairQueueItems(input({ nodes }), 'confirm-estimates')
    const f1 = items.find(i => i.rowId === 'f1')!
    expect(f1.currentValue).toContain('45')
    // Confirming ratifies what is there; the adapter must not propose a number.
    expect(f1.suggestedValue).toBeNull()
  })
})

// ── Detail ───────────────────────────────────────────────────────────────────

describe('toRowDetail — id-addressed, and absent rather than approximate', () => {
  it('echoes the requested rowId so the region\'s identity gate can check it', () => {
    const detail = toRowDetail(input({ nodes: [factorNode('f1', 'A', CONFIRMED_OBS)] }), 'f1')!
    expect(detail.rowId).toBe('f1')
  })

  it('returns null for an id that is not in the model', () => {
    // Not a neighbour, not an empty shell — nothing.
    expect(toRowDetail(input({ nodes: [factorNode('f1', 'A', CONFIRMED_OBS)] }), 'nope')).toBeNull()
  })

  it('renders a missing advanced parameter as absence, never as zero', () => {
    const detail = toRowDetail(input({ nodes: [factorNode('f1', 'A', { raw_value: 1, source: 'user' })] }), 'f1')!
    const cap = detail.advancedParameters.find(p => p.label === 'Cap')!
    expect(cap.value).toBeNull()
  })

  it('lists what an element affects, id-addressed', () => {
    const detail = toRowDetail(
      input({
        nodes: [factorNode('f1', 'A', CONFIRMED_OBS), goalNode()],
        edges: [edge('e1', 'f1', 'g1', { weight: 0.5, weightSource: 'cee' })],
      }),
      'f1',
    )!
    expect(detail.affects.map(a => a.id)).toEqual(['e1'])
  })
})
