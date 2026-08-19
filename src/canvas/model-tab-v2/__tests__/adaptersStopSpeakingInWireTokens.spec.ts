/**
 * THE CANONICAL EDITOR STOPS SPEAKING IN WIRE TOKENS — and stops laundering a
 * default it never measured (18 Aug 2026, the REHOME → DELETE lane).
 *
 * ## Why these four, together
 *
 * The consolidation's acceptance conditions include *"relationships readable in
 * plain English"* and *"no raw ids shown to the user"*. Deriving them at the
 * bytes found the CANONICAL editor — the one that survives — failing all four
 * of the following, while the DUPLICATE it replaces got each of them right.
 * Deleting the duplicate first would have made every one of them permanent.
 *
 *   1. NODE ROWS AND REPAIR-QUEUE ITEMS NAMED THE USER'S ELEMENTS BY WIRE ID.
 *      `typeof data?.label === 'string' ? data.label : node.id` — four sites.
 *      ⭐ The directory's own raw-id scan certified it at ZERO, because that
 *      scan matched `??` and this is a TERNARY. Measured against the pristine
 *      file: `??` shape 0, ternary shape 4. The guard had the code's blind spot.
 *   2. `Source: cee_inference` WAS RENDERED AS BODY COPY. v1 never showed the
 *      enum: `SourceProvenancePill` renders `mapSourceToDisplay` ("AI
 *      estimate") and the raw token lives only in a `title`.
 *   3. EDGE PROVENANCE WAS UNGATED. v1 prints a source only when it is
 *      EVIDENCE (`RelationshipsSection.tsx:213`); `assumption` / `template` /
 *      `ai-suggested` are placeholders, and "Source: assumption" announces a
 *      basis that does not exist.
 *   4. THE ADVANCED EDGE PARAMETERS READ RAW, AND ONE READ THE WRONG FIELD.
 *      Unstamped `strengthStd` is `USER_EDGE_DEFAULTS.strengthStd = 0.15` — the
 *      exact default v1 suppresses under ROADMAP 2.296 C4 — and the likelihood
 *      row read `exists_probability` while every write in the product lands on
 *      `beliefExists` (`useInspectorMutations.ts:429-435`).
 *
 * ## Binding
 *
 * Every absence assertion carries a CONTRAST CONTROL that must read non-zero in
 * the same test — an absence alone is satisfiable by projecting nothing. Values
 * are bound to their row BY ID, never by a value predicate another row could
 * satisfy.
 */

import { describe, it, expect } from 'vitest'
import type { Edge, Node } from '@xyflow/react'
import { toModelRows, toRepairQueueItems, toRowDetail, type ModelProjectionInput } from '../adapters'
import { UNNAMED_ELEMENT_LABEL } from '../../domain/canvasLabels'

// ── Fixtures, shaped like the producer ───────────────────────────────────────

const RAW_ID = 'fac_uk_arr_retention'

/**
 * ⚠ CONFIRM-QUEUE FIXTURES CARRY `raw_value`, AND THAT IS NOT DECORATION.
 * `getPrimaryValue` (the live displayed-value rule) returns `null` without it,
 * so a factor lacking it shows "No value set" and is — correctly — not a
 * confirmation candidate. A fixture without `raw_value` would silently test the
 * empty queue while appearing to test a populated one.
 */

function factorNode(id: string, label: unknown, observedState?: Record<string, unknown>): Node {
  return {
    id,
    type: 'factor',
    position: { x: 0, y: 0 },
    data: { ...(label === undefined ? {} : { label }), type: 'factor', observedState },
  } as unknown as Node
}

function optionNode(id: string, label: unknown): Node {
  return {
    id,
    type: 'option',
    position: { x: 0, y: 0 },
    data: { ...(label === undefined ? {} : { label }), type: 'option' },
  } as unknown as Node
}

function edgeBetween(data: Record<string, unknown>): Edge {
  return { id: 'e1', source: 'a', target: 'b', data } as unknown as Edge
}

function project(nodes: Node[], edges: Edge[] = []): ModelProjectionInput {
  return { nodes, edges: edges as never, goalThreshold: null }
}

function rowById(input: ModelProjectionInput, id: string) {
  const row = toModelRows(input).find(r => r.id === id)
  expect(row, `no row projected for ${id} — the fixture is wrong, not the code`).toBeDefined()
  return row!
}

// ── 1. Element names ─────────────────────────────────────────────────────────

describe('the canonical editor names elements in the user’s words, never by wire id', () => {
  it('a factor with no label renders the unnamed placeholder — NOT its id', () => {
    const row = rowById(project([factorNode(RAW_ID, undefined)]), RAW_ID)
    // Present: an honest placeholder.
    expect(row.label).toBe(UNNAMED_ELEMENT_LABEL)
    // Absent: the identifier. Asserted beside the presence above, so this
    // cannot pass by projecting nothing.
    expect(row.label).not.toContain(RAW_ID)
  })

  it('a factor whose stored label IS id-shaped is still not shown as an id', () => {
    // The leak one hop upstream: producers sometimes seed `label` from the id.
    // `resolveCanvasLabel` rejects it; a bare `data.label` read would not.
    const row = rowById(project([factorNode(RAW_ID, RAW_ID)]), RAW_ID)
    expect(row.label).toBe(UNNAMED_ELEMENT_LABEL)
  })

  it('CONTRAST CONTROL: a real label survives verbatim', () => {
    // Without this, every assertion above is satisfied by returning a constant.
    expect(rowById(project([factorNode(RAW_ID, 'UK ARR retention')]), RAW_ID).label).toBe(
      'UK ARR retention',
    )
  })

  it('repair-queue items name their element the same way — all three producers', () => {
    // Bound by rowId, so each assertion is about the element it names.
    const unverified = factorNode(RAW_ID, undefined, { value: 0.4, raw_value: 40, source: 'cee_inference' })
    const confirm = toRepairQueueItems(project([unverified]), 'confirm-estimates')
    expect(confirm.map(i => i.rowId)).toContain(RAW_ID)
    expect(confirm.find(i => i.rowId === RAW_ID)!.label).toBe(UNNAMED_ELEMENT_LABEL)

    const valueless = factorNode(RAW_ID, undefined)
    const noValue = toRepairQueueItems(project([valueless]), 'no-value')
    expect(noValue.map(i => i.rowId)).toContain(RAW_ID)
    expect(noValue.find(i => i.rowId === RAW_ID)!.label).toBe(UNNAMED_ELEMENT_LABEL)

    const opt = optionNode('opt_hire_two_aes', undefined)
    const setValues = toRepairQueueItems(project([opt]), 'set-option-values')
    expect(setValues.map(i => i.rowId)).toContain('opt_hire_two_aes')
    expect(setValues.find(i => i.rowId === 'opt_hire_two_aes')!.label).toBe(UNNAMED_ELEMENT_LABEL)

    // CONTRAST CONTROL, same shape, same run: a labelled element reads its label.
    const named = toRepairQueueItems(
      project([factorNode(RAW_ID, 'UK ARR retention', { value: 0.4, raw_value: 40, source: 'cee_inference' })]),
      'confirm-estimates',
    )
    expect(named.find(i => i.rowId === RAW_ID)!.label).toBe('UK ARR retention')
  })
})

// ── 2. Provenance is a label, not an enum ────────────────────────────────────

describe('provenance reaches the user as a label, never as the wire token', () => {
  it('the confirm queue’s basis reads "AI estimate", not "cee_inference"', () => {
    const items = toRepairQueueItems(
      project([factorNode(RAW_ID, 'UK ARR retention', { value: 0.4, raw_value: 40, source: 'cee_inference' })]),
      'confirm-estimates',
    )
    const basis = items.find(i => i.rowId === RAW_ID)!.basis
    // Present: the classified label — the same policy the pill renders.
    expect(basis).toBe('Source: AI estimate')
    // Absent: the enum. Beside the presence, so it cannot pass on null.
    expect(basis).not.toContain('cee_inference')
  })

  it('⭐ F1 — the NODE DETAIL pane reads the label too, not just the queue', () => {
    /*
     * The instance the previous commit MISSED while announcing the class fixed.
     * `toRowDetail`'s node branch carried the identical expression 82 lines
     * below the one that was repaired, and it renders at
     * `ModelDetailRegion.tsx:250-263` under "Where it came from" — DIRECTLY
     * BENEATH the `SourceProvenancePill` humanising the same field. The panel
     * said both.
     */
    const node = factorNode(RAW_ID, 'UK ARR retention', { value: 0.4, raw_value: 40, source: 'cee_inference' })
    const detail = toRowDetail(project([node]), RAW_ID)
    expect(detail, 'no detail projected — the fixture is wrong, not the code').not.toBeNull()
    expect(detail!.basis).toBe('Source: AI estimate')
    expect(detail!.basis).not.toContain('cee_inference')
  })

  it('⭐ the detail pane and the queue agree — the same node, the same words', () => {
    /*
     * The contrast control that makes the pin above about the CLASS rather than
     * one call site. Two independent producers, one node, one sentence: if a
     * future change repairs one and not the other, this fails where a
     * single-path assertion would not.
     */
    const node = factorNode(RAW_ID, 'UK ARR retention', { value: 0.4, raw_value: 40, source: 'cee_inference' })
    const input = project([node])
    const fromDetail = toRowDetail(input, RAW_ID)!.basis
    const fromQueue = toRepairQueueItems(input, 'confirm-estimates').find(
      i => i.rowId === RAW_ID,
    )!.basis
    expect(fromDetail).toBe(fromQueue)
    // …and non-null, so the equality above cannot be satisfied by two nulls.
    expect(fromDetail).toBe('Source: AI estimate')
  })
})

// ── 2b. F2 — a factor with no value is not a confirmation candidate ──────────

describe('a factor with NO VALUE cannot be confirmed, and is not offered as if it could', () => {
  const VALUELESS = 'fac_no_value_yet'

  it('⭐ it is ABSENT from confirm-estimates — confirming endorses nothing', () => {
    // `factorNeedsVerification` is `!source || source === 'cee_inference'`, which
    // a factor with no `observedState` at all satisfies. It was entering this
    // queue and rendering an enabled Confirm over "No value set" (P8).
    const input = project([factorNode(VALUELESS, 'Churn rate')])
    expect(toRepairQueueItems(input, 'confirm-estimates').map(i => i.rowId)).not.toContain(
      VALUELESS,
    )
  })

  it('CONTRAST CONTROL: it is still surfaced — in the queue that describes it', () => {
    // The absence above must be a re-homing, not a drop. Without this the fix
    // could have been "filter it out everywhere" and the gap would vanish.
    const input = project([factorNode(VALUELESS, 'Churn rate')])
    expect(toRepairQueueItems(input, 'no-value').map(i => i.rowId)).toContain(VALUELESS)
  })

  it('CONTRAST CONTROL: a factor WITH a value is still a confirmation candidate', () => {
    // The discriminating half — proves the new conjunct did not empty the queue.
    const input = project([
      factorNode(RAW_ID, 'UK ARR retention', { value: 0.4, raw_value: 40, source: 'cee_inference' }),
    ])
    expect(toRepairQueueItems(input, 'confirm-estimates').map(i => i.rowId)).toContain(RAW_ID)
  })

  it('⭐ it no longer stands in TWO queues at once', () => {
    // It satisfied both predicates, so it was simultaneously "confirm this
    // estimate" and "this has no value" — two contradictory instructions about
    // one factor.
    const input = project([factorNode(VALUELESS, 'Churn rate')])
    const inConfirm = toRepairQueueItems(input, 'confirm-estimates').some(
      i => i.rowId === VALUELESS,
    )
    const inNoValue = toRepairQueueItems(input, 'no-value').some(i => i.rowId === VALUELESS)
    expect([inConfirm, inNoValue]).toEqual([false, true])
  })
})

// ── 3. The edge provenance gate ──────────────────────────────────────────────

describe('an edge states a source only when it HAS one', () => {
  const nodes = [factorNode('a', 'ARR'), factorNode('b', 'Retention')]

  it('a placeholder provenance states nothing — all three non-evidence markers', () => {
    for (const placeholder of ['assumption', 'template', 'ai-suggested']) {
      const input = project(nodes, [edgeBetween({ provenance: placeholder })])
      const detail = toRowDetail(input, 'e1')
      expect(detail, `no detail projected for the ${placeholder} edge`).not.toBeNull()
      expect(detail!.basis, `"${placeholder}" is a placeholder, not a basis`).toBeNull()
    }
  })

  it('CONTRAST CONTROL: a real evidence provenance IS stated — VERBATIM, and that is the honest limit', () => {
    /*
     * ⚠ F4 — THIS PINS A WIRE-ISH TOKEN AS EXPECTED OUTPUT, DELIBERATELY, AND
     * THAT IS A NARROWER PROPERTY THAN THIS FILE'S §2 HEADING CLAIMS.
     *
     * What was ported from v1 is the GATE (evidence vs placeholder), not a
     * vocabulary. A factor's `source` is a closed enum with a classifier; an
     * edge's `provenance` is `z.string().max(100)` (`edges.ts:198`) with no
     * classifier anywhere in the estate. So an evidence provenance reaches the
     * user verbatim — v1's behaviour, preserved on purpose.
     *
     * Recorded rather than quietly asserted, because "the canonical editor never
     * shows a wire token" is TRUE of factor provenance and NOT YET TRUE of edge
     * provenance, and a reader who takes the heading at face value would be
     * wrong. Closing it needs an edge-provenance vocabulary — a product
     * decision, not a scan fix.
     */
    const input = project(nodes, [edgeBetween({ provenance: 'customer_interviews' })])
    expect(toRowDetail(input, 'e1')!.basis).toBe('Source: customer_interviews')
  })
})

// ── 4. Advanced edge parameters: gated, and on the edited field ──────────────

describe('the advanced edge parameters never launder a default', () => {
  const nodes = [factorNode('a', 'ARR'), factorNode('b', 'Retention')]

  function advanced(data: Record<string, unknown>) {
    const detail = toRowDetail(project(nodes, [edgeBetween(data)]), 'e1')
    expect(detail, 'no detail projected — the fixture is wrong, not the code').not.toBeNull()
    const out = new Map<string, string | null>()
    for (const p of detail!.advancedParameters) out.set(p.label, p.value)
    return out
  }

  it('an UNSTAMPED strengthStd is withheld — 0.15 is the default, not a measurement', () => {
    // USER_EDGE_DEFAULTS.strengthStd. Printing it asserts an uncertainty
    // nobody computed (ROADMAP 2.296 C4).
    expect(advanced({ strengthStd: 0.15 }).get('Std')).toBeNull()
  })

  it('CONTRAST CONTROL: a STAMPED strengthStd is shown', () => {
    // Same field, same value, one stamp different — so the assertion above is
    // about provenance and not about the number being unreachable.
    expect(advanced({ strengthStd: 0.15, strengthStdSource: 'user' }).get('Std')).toBe('0.15')
  })

  it('the likelihood row reads `beliefExists` — the field every write lands on', () => {
    // A user who set a likelihood wrote `beliefExists` via `setExistsProbability`.
    // The read this replaces was `exists_probability`, so their own number was
    // invisible here.
    expect(
      advanced({ beliefExists: 0.8, beliefExistsSource: 'user' }).get('Exists probability'),
    ).toBe('0.8')
  })

  it('CONTRAST CONTROL: an unstamped likelihood is withheld, so the row is gated too', () => {
    expect(advanced({ beliefExists: 0.8 }).get('Exists probability')).toBeNull()
  })

  it('the Edge ID row still renders — the advanced grid itself is not empty', () => {
    // Guards the four absences above against a projection that returns no
    // parameters at all, which would satisfy every one of them.
    expect(advanced({ strengthStd: 0.15 }).get('Edge ID')).toBe('e1')
  })
})
