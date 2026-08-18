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
    const unverified = factorNode(RAW_ID, undefined, { value: 0.4, source: 'cee_inference' })
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
      project([factorNode(RAW_ID, 'UK ARR retention', { value: 0.4, source: 'cee_inference' })]),
      'confirm-estimates',
    )
    expect(named.find(i => i.rowId === RAW_ID)!.label).toBe('UK ARR retention')
  })
})

// ── 2. Provenance is a label, not an enum ────────────────────────────────────

describe('provenance reaches the user as a label, never as the wire token', () => {
  it('the confirm queue’s basis reads "AI estimate", not "cee_inference"', () => {
    const items = toRepairQueueItems(
      project([factorNode(RAW_ID, 'UK ARR retention', { value: 0.4, source: 'cee_inference' })]),
      'confirm-estimates',
    )
    const basis = items.find(i => i.rowId === RAW_ID)!.basis
    // Present: the classified label — the same policy the pill renders.
    expect(basis).toBe('Source: AI estimate')
    // Absent: the enum. Beside the presence, so it cannot pass on null.
    expect(basis).not.toContain('cee_inference')
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

  it('CONTRAST CONTROL: a real evidence provenance IS stated', () => {
    // The discriminating half. Without it, the gate could be a hard `null` and
    // every assertion above would still pass.
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
