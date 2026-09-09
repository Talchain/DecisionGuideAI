/**
 * ⭐⭐ THE REGRESSION FOR A BLIND SPOT, NOT FOR A BUG.
 *
 * `nameTheDefaultedFactor.spec.ts` passes while the feature is DARK on the
 * mounted path. It feeds RAW PRODUCER shapes straight into the terminal
 * selector, and the real route rebuilds every warning first:
 *
 *   OutputsDock:1082 → useResultsSectionData → data.confidence.inferenceWarnings
 *     → buildAnalysisNewViewModel:1357 → selectHumanisedInferenceWarningsOutsideStrip
 *
 * That adapter emitted `{code, affected_nodes: safeArray(...), affected_labels,
 * message, severity}` — **no `field`** — and `safeArray` yields `[]` for the
 * defaulting family. Two independent losses, either one fatal:
 *
 *   1. `field` was dropped, so the only identity these codes carry was gone.
 *   2. `w.affected_nodes ?? [fromField]` — `[] ?? x` is `[]`, so even a carried
 *      field stayed suppressed. Absent and EMPTY must resolve identically.
 *
 * A fixture you wrote yourself is not evidence about the wire. Every case below
 * is therefore built in the shape the ADAPTER EMITS — empty arrays and all —
 * not the shape the producer sends.
 *
 * Producer contract (checked in producer source by the #1369 reviewer, not
 * inferred from a fixture census): ISL `robustness_analyzer_v2.py:2018-2032`
 * sets `field=nodes[<node_id>].observed_state.value` per defaulted root, and
 * `:3360-3378` sets `field=nodes[<goal_id>]` for GOAL_ANCESTOR_DATA_GAP with
 * ancestor ids confined to detail/message. PLoT `run.ts:3941-3994` forwards the
 * string verbatim and keeps per-node warnings distinct.
 */
import { describe, expect, it } from 'vitest'
import { selectHumanisedInferenceWarningsOutsideStrip } from '../humaniseInferenceWarning'

/** Exactly what `useResultsSectionData` emits: field carried, arrays EMPTY. */
const asAdapterEmits = (code: string, field: string | undefined) => ({
  code,
  field,
  affected_nodes: [] as string[],
  affected_labels: [] as string[],
  message: `producer prose mentioning '4d579e02' and '845c7d7b'`,
  severity: 'info',
})

const TWO_ROOTS = [
  asAdapterEmits('ROOT_NODE_DEFAULT_VALUE', 'nodes[c591da5e].observed_state.value'),
  asAdapterEmits('ROOT_NODE_DEFAULT_VALUE', 'nodes[845c7d7b].observed_state.value'),
]

const STORE_LABELS = new Map([
  ['c591da5e', 'Data Team Capacity'],
  ['845c7d7b', 'Supplier Lead Time'],
  ['goal_cdp', 'Replace CDP Within Budget'],
])

describe('⭐ adapter shape → Reasoning: two roots become two findings', () => {
  it('PRECONDITION: the fixture really does carry empty arrays', () => {
    // If this ever stops holding, the cases below stop testing the mounted
    // path and quietly become the unit test that already passed.
    for (const w of TWO_ROOTS) {
      expect(w.affected_nodes).toHaveLength(0)
      expect(w.affected_labels).toHaveLength(0)
      expect(typeof w.field).toBe('string')
    }
  })

  it('⭐ each row names its own factor', () => {
    const out = selectHumanisedInferenceWarningsOutsideStrip(TWO_ROOTS, STORE_LABELS)
    expect(out[0].title).toContain('Data Team Capacity')
    expect(out[1].title).toContain('Supplier Lead Time')
    expect(out[0].title).not.toBe(out[1].title)
  })
})

describe('⛔ unknown identity stays anonymous', () => {
  it('no field → the anonymous sentence, unchanged', () => {
    const noField = [asAdapterEmits('ROOT_NODE_DEFAULT_VALUE', undefined)]
    const a = selectHumanisedInferenceWarningsOutsideStrip(noField, STORE_LABELS)
    const b = selectHumanisedInferenceWarningsOutsideStrip(noField)
    expect(a[0].title).toBe(b[0].title)
  })

  it('⭐ field present but the node is NOT in the store → still anonymous', () => {
    const unknown = [asAdapterEmits('ROOT_NODE_DEFAULT_VALUE', 'nodes[deadbeef].observed_state.value')]
    const out = selectHumanisedInferenceWarningsOutsideStrip(unknown, STORE_LABELS)
    const bare = selectHumanisedInferenceWarningsOutsideStrip(unknown)
    expect(out[0].title).toBe(bare[0].title)
    expect(out[0].title).not.toMatch(/deadbeef/i)
  })

  it('⭐ THE SIDE DOOR: an id used as its own label is refused', () => {
    // The adapter fills labels with `nodeLabelMap.get(id) ?? id`, so an
    // unresolved node arrives carrying its raw id in the LABEL position.
    // Admitting it would report a genuine label and print an engine id.
    const idAsLabel = [{
      ...asAdapterEmits('ROOT_NODE_DEFAULT_VALUE', undefined),
      affected_nodes: ['c591da5e'],
      affected_labels: ['c591da5e'],
    }]
    const out = selectHumanisedInferenceWarningsOutsideStrip(idAsLabel, STORE_LABELS)
    expect(out[0].title).not.toMatch(/c591da5e/i)
    expect(out[0].title).not.toMatch(/C591da5e/)
  })

  it('a real label in that position is still honoured', () => {
    const realLabel = [{
      ...asAdapterEmits('ROOT_NODE_DEFAULT_VALUE', undefined),
      affected_nodes: ['c591da5e'],
      affected_labels: ['Data Team Capacity'],
    }]
    const out = selectHumanisedInferenceWarningsOutsideStrip(realLabel)
    expect(out[0].title).toContain('Data Team Capacity')
  })
})

describe('⛔ a goal gap names the GOAL, never an ancestor guessed from prose', () => {
  it('⭐ names the goal from its field', () => {
    const goal = [asAdapterEmits('GOAL_ANCESTOR_DATA_GAP', 'nodes[goal_cdp]')]
    const out = selectHumanisedInferenceWarningsOutsideStrip(goal, STORE_LABELS)
    expect(out[0].title).toContain('Replace CDP Within Budget')
  })

  it('⛔ and never the ancestor ids that appear ONLY in the message', () => {
    const goal = [asAdapterEmits('GOAL_ANCESTOR_DATA_GAP', 'nodes[goal_cdp]')]
    const out = selectHumanisedInferenceWarningsOutsideStrip(goal, STORE_LABELS)
    // The message quotes '4d579e02' and '845c7d7b'. Parsing them is the banned
    // route, and '845c7d7b' is even resolvable in STORE_LABELS — so a prose
    // parser would produce a plausible, wrong name here rather than failing.
    expect(out[0].title).not.toMatch(/4d579e02/i)
    expect(out[0].title).not.toContain('Supplier Lead Time')
  })
})
