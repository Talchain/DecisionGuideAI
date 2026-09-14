/**
 * ⭐⭐ "A STARTING FACTOR HAS NO CURRENT VALUE" — SAID TWICE, ABOUT TWO DIFFERENT
 * FACTORS, WORD FOR WORD IDENTICAL. THE READER CANNOT ACT ON EITHER.
 *
 * `buildAnalysisNewViewModel.ts` records this as STILL OPEN and prescribes a
 * fix in two halves: widen the selector to keep `affected_labels`, and make
 * `ROOT_NODE_DEFAULT_VALUE`'s zero-argument template take the label.
 *
 * ⛔ BOTH HALVES ARE INSUFFICIENT, AND MEASURING THE PRODUCER SAYS WHY.
 * Across every capture and fixture in this repo, 27 `inference_warnings`
 * entries carry **0** `affected_nodes` and **0** `affected_labels`. The label
 * map `buildInferenceWarningLabelMap` builds is therefore ALWAYS `undefined` on
 * this path, so a label-taking template would interpolate the unresolved
 * "This factor" — which is exactly what `humaniseCritique.ts:281` forbids, and
 * why every template ignores the label deliberately.
 *
 * ⭐ THE PREMISE HAS A THIRD OPTION ITS OWN TEXT LISTS.
 * That rule states the wire shape as `{code, message, severity, field?,
 * elapsed_ms?}`. `field` IS the identity, structured:
 *     ROOT_NODE_DEFAULT_VALUE  field="nodes[c591da5e].observed_state.value"
 *     GOAL_ANCESTOR_DATA_GAP   field="nodes[b4014d90]"
 * Measured: 6/6 and 3/3 of those entries carry a field, and every one is
 * DISTINCT — the discriminator was on the wire the whole time.
 *
 * ⚠ THIS IS NOT MESSAGE-PARSING. The file's global rule is "labels resolve via
 * nodeId → graph store lookup ONLY. Never parsed from critique message
 * strings." An id read from a structured KEY and resolved against the store is
 * that route; reading ids out of `message` prose is the banned one, and the
 * root-ancestor ids in GOAL_ANCESTOR_DATA_GAP's message stay unread.
 *
 * ⚠ AND THE GUARD THAT MUST NOT BE TRADED AWAY: interpolation happens ONLY
 * when the store resolved a REAL label. `resolveFactorLabel` otherwise returns
 * `factorIdToLabel(nodeId)` — for `e4ec3415` that is the string "E4ec3415" —
 * so an unguarded fix would print an engine id at the user, re-opening the
 * defect the surrounding code was written to close.
 */
import { describe, expect, it } from 'vitest'
import {
  nodeIdFromField,
  selectHumanisedInferenceWarningsOutsideStrip,
} from '../humaniseInferenceWarning'

/** The two rows Paul saw, verbatim from a capture: same code, different node. */
const TWO_ROOTS = [
  {
    code: 'ROOT_NODE_DEFAULT_VALUE',
    severity: 'info',
    message: "No observed value provided for root node 'c591da5e'; defaulted to 0.0",
    field: 'nodes[c591da5e].observed_state.value',
  },
  {
    code: 'ROOT_NODE_DEFAULT_VALUE',
    severity: 'info',
    message: "No observed value provided for root node '845c7d7b'; defaulted to 0.0",
    field: 'nodes[845c7d7b].observed_state.value',
  },
]

const LABELS = new Map([
  ['c591da5e', 'Data Team Capacity'],
  ['845c7d7b', 'Supplier Lead Time'],
])

describe('⭐ the id comes from the structured field, never the message', () => {
  it('reads the node id out of a field key', () => {
    expect(nodeIdFromField('nodes[c591da5e].observed_state.value')).toBe('c591da5e')
    expect(nodeIdFromField('nodes[b4014d90]')).toBe('b4014d90')
  })

  it('⛔ returns nothing for a field that is not a node path', () => {
    expect(nodeIdFromField('p_win_sensitivity')).toBeUndefined()
    expect(nodeIdFromField(undefined)).toBeUndefined()
    expect(nodeIdFromField('edges[a>b].weight')).toBeUndefined()
  })
})

describe('⭐ two rows, two factors, two sentences', () => {
  it('PRECONDITION: today the two titles are identical (the defect)', () => {
    const bare = selectHumanisedInferenceWarningsOutsideStrip(TWO_ROOTS)
    expect(bare).toHaveLength(2)
    // Without a label map nothing changes — this is the fallback contract.
    expect(bare[0].title).toBe(bare[1].title)
  })

  it('⭐ with the store map, each row names ITS OWN factor', () => {
    const named = selectHumanisedInferenceWarningsOutsideStrip(TWO_ROOTS, LABELS)
    expect(named[0].title).toContain('Data Team Capacity')
    expect(named[1].title).toContain('Supplier Lead Time')
    expect(named[0].title).not.toBe(named[1].title)
  })

  it('⭐ the CLAIM is unchanged — only the subject is named', () => {
    const named = selectHumanisedInferenceWarningsOutsideStrip(TWO_ROOTS, LABELS)
    for (const r of named) {
      expect(r.title).toContain('zero was assumed')
      expect(r.code).toBe('ROOT_NODE_DEFAULT_VALUE')
    }
  })
})

describe('⛔ THE GUARD — never print an engine identifier', () => {
  it('a node id absent from the store leaves the sentence unlabelled', () => {
    const out = selectHumanisedInferenceWarningsOutsideStrip(TWO_ROOTS, new Map())
    const bare = selectHumanisedInferenceWarningsOutsideStrip(TWO_ROOTS)
    expect(out[0].title).toBe(bare[0].title)
  })

  it('⭐ and specifically never the id-derived pseudo-label', () => {
    // `factorIdToLabel('c591da5e')` === 'C591da5e'. If that ever reaches a
    // title, this fix has re-opened the defect it was written to close.
    const out = selectHumanisedInferenceWarningsOutsideStrip(TWO_ROOTS, new Map())
    for (const r of out) {
      expect(r.title).not.toMatch(/C591da5e|845b|845c7d7b/i)
      expect(r.title).not.toMatch(/\b[0-9a-f]{8}\b/i)
    }
  })

  it('a code with no field is untouched', () => {
    const noField = [
      { code: 'EDGE_E_VALUE_NON_FINITE_DROPPED', severity: 'info', message: 'x' },
    ]
    const a = selectHumanisedInferenceWarningsOutsideStrip(noField, LABELS)
    const b = selectHumanisedInferenceWarningsOutsideStrip(noField)
    expect(a[0].title).toBe(b[0].title)
    expect(a[0].title.length).toBeGreaterThan(20)
  })
})
