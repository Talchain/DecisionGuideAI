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
import type { ModelElementKind } from '../types'

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

  it('⭐ F1 — the NODE DETAIL pane states provenance ONCE, and never as a token', () => {
    /*
     * ⚠⚠ THIS ASSERTION WAS REVERSED ON 9 Sep, AND THE OLD COMMENT IS WHY.
     * It read `expect(detail!.basis).toBe('Source: AI estimate')`, under a
     * comment whose own words were:
     *
     *   "…it renders under 'Where it came from' — DIRECTLY BENEATH the
     *    `SourceProvenancePill` humanising the same field. **The panel said
     *    both.**"
     *
     * The author saw the duplication, NAMED it as the defect, and then fixed
     * only the half where the two DISAGREED — the pill said "AI estimate" while
     * this line printed the wire token. Routing it through the same classifier
     * made them agree, and the assertion pinned that agreement. Nobody asked
     * whether the panel should say it twice.
     *
     * Witnessed on deployed `14276d5b`, factor "Annual Platform Cost":
     *   y=712  span  "User edited"            ← the pill
     *   y=733  p     "Source: User edited"    ← this field, 21px below
     *
     * ⭐ THE HARM F1 EXISTS TO PREVENT IS "a wire token rendered as body copy",
     * and a null basis closes it STRICTLY MORE than a classified one: there is
     * no string on that line to leak. So this now binds to the HARM rather than
     * to the remedy — writing the invariant against the spec, not against the
     * failure mode that happened to be in hand (trap 13d).
     *
     * ⚠ IDENTICAL BY CONSTRUCTION, so no fixture could ever have caught this.
     * The row's `provenanceSource` is `obs?.source` and `sourceBasis` is
     * `"Source: " + mapSourceToDisplay(obs?.source)` — one field, one
     * classifier. Only reading the rendered page could show it.
     */
    const node = factorNode(RAW_ID, 'UK ARR retention', { value: 0.4, raw_value: 40, source: 'cee_inference' })
    const detail = toRowDetail(project([node]), RAW_ID)
    expect(detail, 'no detail projected — the fixture is wrong, not the code').not.toBeNull()

    // Said ONCE: the pill's field carries it; the body line does not repeat it.
    expect(detail!.basis).toBeNull()

    // ⚠ THE CONTRAST CONTROL, so the null above cannot pass by projecting
    // nothing: the row STILL carries the raw stamp for the pill to classify.
    const row = toModelRows(project([node])).find(r => r.id === RAW_ID)
    expect(row?.provenanceSource).toBe('cee_inference')
  })

  it('⭐ the QUEUE still states it, because there it is the ONLY statement', () => {
    /*
     * ⚠ THE ASYMMETRY IS THE POINT, and it is why the detail's null above is a
     * narrowing rather than a deletion of the class.
     *
     *   detail region — renders `SourceProvenancePill` AND `basis`. Two
     *                   statements of one fact; the second is redundant.
     *   repair queue  — renders `basis` and NO pill (`RepairQueueList.tsx:205`).
     *                   Removing it there would leave provenance unstated.
     *
     * A change that nulled both would look tidier and would silently drop a
     * fact from the queue. This case is what makes that fail.
     */
    const node = factorNode(RAW_ID, 'UK ARR retention', { value: 0.4, raw_value: 40, source: 'cee_inference' })
    const input = project([node])

    const fromQueue = toRepairQueueItems(input, 'confirm-estimates').find(
      i => i.rowId === RAW_ID,
    )!.basis
    expect(fromQueue).toBe('Source: AI estimate')
    expect(fromQueue).not.toContain('cee_inference')

    // The detail says it once, through the pill's field — not twice.
    expect(toRowDetail(input, RAW_ID)!.basis).toBeNull()
  })

  it('⛔ AN EDGE KEEPS ITS BASIS — two different fields, not one said twice', () => {
    /*
     * ⚠ THE CASE THAT STOPS THE TIDY, WRONG GENERALISATION. An edge's pill reads
     * `data.weightSource` and its basis reads `data.provenance` — DIFFERENT
     * fields carrying different facts, so the second line earns its place there.
     * Nulling every basis "for consistency" would delete an edge's evidence
     * provenance, and this is the assertion that would go red.
     */
    const a = factorNode('fac_a', 'A', { value: 0.4, raw_value: 40, source: 'user' })
    const b = factorNode('fac_b', 'B', { value: 0.4, raw_value: 40, source: 'user' })
    const input = project([a, b], [
      { id: 'e_1', source: 'fac_a', target: 'fac_b', data: { weightSource: 'user', provenance: 'Q3 board pack' } },
    ] as unknown as Edge[])

    const detail = toRowDetail(input, 'e_1')
    expect(detail, 'no edge detail projected — the fixture is wrong').not.toBeNull()
    expect(detail!.basis).toBe('Source: Q3 board pack')
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

// ── 6. Provenance is stated EXACTLY ONCE, on every kind ──────────────────────

/**
 * ⛔⛔ THE NULL BASIS WAS CORRECT FOR FACTORS AND WRONG FOR EVERY OTHER NODE KIND.
 *
 * `toRowDetail`'s node branch is entered for ANY node found by id. The
 * duplication argument that justified nulling `basis` holds only where the pill
 * also speaks — and `toModelRows` sets `provenanceSource` in the factor branch
 * and the EDGE branch only. Goal, decision, risk and outcome rows get none, so
 * for them `hasProvenanceContent` went false and the whole "Where it came from"
 * section disappeared, heading included. A true statement was deleted, not a
 * duplicate one.
 *
 * ⚠ AND THE CORPUS COULD NOT SEE IT. Every `toRowDetail` case in this file and
 * in `adapters.spec.ts` used `factorNode(...)` or an edge; `model-tab-v2/
 * __tests__/` had ZERO non-factor node coverage. The corpus shared the code's
 * blind spot, which is exactly why a green suite was consistent with the defect
 * (trap 22). These cases are the non-factor coverage.
 *
 * ⚠ IT IS LIVE ON COMMITTED DATA. Census of every tracked JSON carrying
 * `observed_state.source`: 92 carriers — 84 `factor`, **8 `risk`**. Named:
 * `risk_time`/`brief_extraction` in `golden-path-staging-2026-04-05.json`, and
 * `risk_budget_overrun` / `risk_deadline_miss` across three
 * `draft-graph.success.*` fixtures and the `v5-turn.draft-graph.staging-smoke`
 * capture.
 */
function nodeOfKind(
  id: string,
  kind: Exclude<ModelElementKind, 'relationship'>,
  observedState?: Record<string, unknown>,
): Node {
  return {
    id,
    type: kind,
    position: { x: 0, y: 0 },
    data: { label: `A ${kind}`, type: kind, observedState },
  } as unknown as Node
}

/**
 * ⚠ A TOTAL RECORD, NOT AN ARRAY — so adding a node kind to
 * `ModelElementKind` is a TYPE ERROR here rather than a silently unexercised
 * case. A hand-listed array is the mirror this repo's own
 * `KIND_LABELS`/`provenanceKeyIsTotal` pattern exists to abolish, and the thing
 * it would hide is precisely a new kind that loses its provenance line.
 */
const EVERY_NODE_KIND: Record<Exclude<ModelElementKind, 'relationship'>, true> = {
  goal: true,
  decision: true,
  option: true,
  factor: true,
  risk: true,
  outcome: true,
}

describe('the detail pane states provenance exactly once, whatever the kind', () => {
  /**
   * ⭐ THE CASE THE BARE NULL BROKE. Revert `basis` to a bare `null` and this
   * REDs; it is green both before this PR and after the repair, which is what
   * makes it a regression pin rather than a restatement of the new behaviour.
   */
  it('⛔ a RISK keeps its basis — nothing else on that row states provenance', () => {
    const input = project([
      nodeOfKind('risk_budget_overrun', 'risk', { value: 0.3, source: 'cee_inference' }),
    ])
    const detail = toRowDetail(input, 'risk_budget_overrun')

    // The statement survives, humanised — never the wire token.
    expect(detail!.basis).toBe('Source: AI estimate')
    expect(detail!.basis).not.toContain('cee_inference')

    /*
     * ⚠ THE PRECONDITION, PINNED IN-TEST. The assertion above is only about the
     * DUPLICATION question if nothing else on this row speaks. It does not:
     * `toModelRows` never sets `provenanceSource` for a risk, so the pill cannot
     * render and `basis` is the row's sole provenance statement. Without this,
     * the case above would pass just as happily on a row that says it twice.
     */
    const row = toModelRows(input).find(r => r.id === 'risk_budget_overrun')
    expect(row?.provenanceSource).toBeUndefined()
  })

  it('⭐ a FACTOR still says it ONCE, through the pill — the PR’s own fix, unchanged', () => {
    const input = project([nodeOfKind('fac_arr', 'factor', { value: 0.4, source: 'cee_inference' })])
    expect(toRowDetail(input, 'fac_arr')!.basis).toBeNull()
    expect(toModelRows(input).find(r => r.id === 'fac_arr')?.provenanceSource).toBe('cee_inference')
  })

  /**
   * ⭐⭐ THE INVARIANT, DERIVED OVER EVERY KIND RATHER THAN LISTED.
   *
   * The property is not "factors are null and risks are not" — that is the
   * remedy, and writing the invariant against the remedy is how the first
   * version of this change shipped a hole (trap 13d: write it against the
   * SPEC). The spec is: **the pane makes exactly one statement of where a value
   * came from.** Never two (the duplication this PR removes), never zero (the
   * deletion it nearly introduced).
   *
   * Because it iterates the kind Record, a new kind that sets neither — or both
   * — REDs here without anyone remembering to add a case.
   */
  it('⭐⭐ EVERY node kind with a stamped source makes exactly ONE provenance statement', () => {
    const kinds = Object.keys(EVERY_NODE_KIND) as Exclude<ModelElementKind, 'relationship'>[]
    expect(kinds.length).toBe(6)

    for (const kind of kinds) {
      const id = `n_${kind}`
      const input = project([nodeOfKind(id, kind, { value: 0.4, source: 'cee_inference' })])
      const row = toModelRows(input).find(r => r.id === id)
      expect(row, `no row projected for kind=${kind} — the fixture is wrong, not the code`).toBeDefined()
      const detail = toRowDetail(input, id)

      const pillSpeaks = typeof row!.provenanceSource === 'string' && row!.provenanceSource !== ''
      const basisSpeaks = detail!.basis !== null

      // NEVER TWICE — the defect this PR was opened to fix.
      expect(
        pillSpeaks && basisSpeaks,
        `kind=${kind} states provenance TWICE (pill and basis)`,
      ).toBe(false)

      // AND NEVER ZERO — the defect the first version of the fix introduced.
      expect(
        pillSpeaks || basisSpeaks,
        `kind=${kind} states provenance NOT AT ALL — "Where it came from" would not render`,
      ).toBe(true)
    }
  })

  /**
   * ⚠ THE CONTRAST CONTROL FOR THE INVARIANT ABOVE. Without it, "exactly one"
   * would pass on an implementation that states provenance unconditionally,
   * including for a row whose producer stamped nothing — which would be an
   * invented claim. An unstamped node must state it ZERO times, and the section
   * must not render at all.
   */
  it('CONTROL: an UNSTAMPED node of any kind states provenance zero times', () => {
    for (const kind of Object.keys(EVERY_NODE_KIND) as Exclude<ModelElementKind, 'relationship'>[]) {
      const id = `u_${kind}`
      const input = project([nodeOfKind(id, kind, { value: 0.4 })])
      const row = toModelRows(input).find(r => r.id === id)
      const detail = toRowDetail(input, id)
      expect(row!.provenanceSource, `kind=${kind}`).toBeUndefined()
      expect(detail!.basis, `kind=${kind}`).toBeNull()
    }
  })
})
