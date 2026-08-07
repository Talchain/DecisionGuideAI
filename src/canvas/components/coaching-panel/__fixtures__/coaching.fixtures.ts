/**
 * Coaching panel fixtures — the render-only test/Storybook corpus.
 *
 * Typed `Coaching` objects exercising the full taxonomy: realistic/minimal,
 * one-per-source, one-per-move, future-field-present, absent-optional,
 * malformed/partial, safety (forbidden-term data + XSS-ish), and the F.6
 * ordering trap. Enum values for move/source/target_kind are illustrative and
 * UNCONFIRMED until Lane A lands; the UI must tolerate any of them.
 *
 * Observations are written free of the forbidden glossary terms EXCEPT the
 * dedicated `forbiddenTermInLabel` fixture, which deliberately injects them
 * into MODEL data to prove the UI renders model strings verbatim and never
 * sanitises them.
 */
import type { Coaching } from '../types'

// ── Realistic / minimal ────────────────────────────────────────────────────

export const minimalSignal: Coaching = {
  version: '0.3',
  signals: [
    {
      signal_id: 'sig-min-1',
      move: 'check_assumption',
      source: 'observation',
      grounding: { observation: 'The retention estimate rests on a single quarter of data.' },
    },
  ],
}

export const typicalPanel: Coaching = {
  version: '0.3',
  summary: 'A few estimates are worth a second look before you analyse.',
  signals: [
    {
      signal_id: 'sig-1',
      move: 'check_assumption',
      source: 'observation',
      grounding: {
        observation: 'The retention estimate rests on a single quarter of data.',
        field_refs: ['ref:retention'],
      },
      target_kind: 'factor',
      target_label: 'Customer retention',
    },
    {
      signal_id: 'sig-2',
      move: 'gather_evidence',
      source: 'base_rate',
      grounding: { observation: 'Similar launches usually take longer than first planned.' },
      target_kind: 'option',
      target_label: 'Launch in spring',
    },
    {
      signal_id: 'sig-3',
      move: 'reframe',
      source: 'pattern',
      grounding: { observation: 'The success measure mixes two outcomes that move apart over time.' },
      target_kind: 'goal',
      target_label: 'Grow active users',
    },
    {
      signal_id: 'sig-4',
      move: 'reconsider',
      source: 'observation',
      grounding: { observation: 'One supplier carries most of the delivery exposure.' },
      target_kind: 'risk',
      target_label: 'Supplier concentration',
    },
    {
      signal_id: 'sig-5',
      move: 'gather_evidence',
      source: 'user_input',
      grounding: { observation: 'The budget figure has not been revisited since the first draft.' },
      target_kind: 'factor',
      target_label: 'Marketing budget',
    },
  ],
}

// ── One per source (representative spread + unknown) ────────────────────────

export const bySource: Coaching = {
  version: '0.3',
  signals: [
    {
      signal_id: 'src-observation',
      move: 'check_assumption',
      source: 'observation',
      grounding: { observation: 'This figure was entered by hand and has not changed since.' },
    },
    {
      signal_id: 'src-base-rate',
      move: 'gather_evidence',
      source: 'base_rate',
      grounding: { observation: 'Comparable efforts tend to land below this hopeful figure.' },
    },
    {
      signal_id: 'src-pattern',
      move: 'reframe',
      source: 'pattern',
      grounding: { observation: 'Two of your measures tend to pull in opposite directions.' },
    },
    {
      signal_id: 'src-unknown',
      move: 'reconsider',
      source: 'some_new_source', // UNCONFIRMED enum — must render, never coerced.
      grounding: { observation: 'A new kind of insight the UI has not seen before.' },
    },
  ],
}

// ── One per move (representative spread + unknown) ──────────────────────────

export const byMove: Coaching = {
  version: '0.3',
  signals: [
    {
      signal_id: 'move-check',
      move: 'check_assumption',
      source: 'observation',
      grounding: { observation: 'Worth confirming this still holds.' },
    },
    {
      signal_id: 'move-gather',
      move: 'gather_evidence',
      source: 'observation',
      grounding: { observation: 'A little more data would firm this up.' },
    },
    {
      signal_id: 'move-reframe',
      move: 'reframe',
      source: 'observation',
      grounding: { observation: 'There may be a cleaner way to frame this.' },
    },
    {
      signal_id: 'move-unknown',
      move: 'frobnicate', // UNCONFIRMED enum — must render, never coerced.
      source: 'observation',
      grounding: { observation: 'An unfamiliar suggested move the UI tolerates.' },
    },
  ],
}

// ── Future-field-present ────────────────────────────────────────────────────

export const withLifecycle: Coaching = {
  version: '0.3',
  signals: [
    {
      signal_id: 'fut-lifecycle',
      move: 'check_assumption',
      source: 'observation',
      grounding: { observation: 'This was flagged in an earlier pass.' },
      target_kind: 'factor',
      target_label: 'Churn rate',
      lifecycle_state: 'Reopened',
    },
  ],
}

export const withPriority: Coaching = {
  version: '0.3',
  signals: [
    {
      signal_id: 'fut-priority',
      move: 'gather_evidence',
      source: 'base_rate',
      grounding: { observation: 'The headline figure looks optimistic against comparable cases.' },
      priority: 1,
      priority_reason: 'This estimate moves the result more than the others.',
    },
  ],
}

export const withSuggestedActions: Coaching = {
  version: '0.3',
  signals: [
    {
      signal_id: 'fut-actions',
      move: 'gather_evidence',
      source: 'observation',
      grounding: { observation: 'A quick check would settle the open question here.' },
      suggested_actions: [
        { id: 'a1', label: 'Pull last year of figures' },
        { id: 'a2', label: 'Ask the finance team to confirm' },
      ],
    },
  ],
}

export const withEvidence: Coaching = {
  version: '0.3',
  signals: [
    {
      signal_id: 'fut-evidence',
      move: 'check_assumption',
      source: 'pattern',
      grounding: { observation: 'Past results point the other way.' },
      evidence: [
        { label: 'Last three launches ran over time', ref: 'ev:1' },
        { label: 'Industry survey, 2025', ref: 'ev:2' },
      ],
    },
  ],
}

export const withStaleness: Coaching = {
  version: '0.3',
  signals: [
    {
      signal_id: 'fut-staleness',
      move: 'reconsider',
      source: 'observation',
      grounding: { observation: 'This was true earlier, but the figures have since moved.' },
      staleness: { label: 'Based on figures from an earlier draft.' },
    },
  ],
}

export const withAllFuture: Coaching = {
  version: '0.3',
  summary: 'Every roadmap field at once, for visual tolerance.',
  signals: [
    {
      signal_id: 'fut-all',
      move: 'gather_evidence',
      source: 'base_rate',
      grounding: {
        observation: 'The most influential estimate also has the least support behind it.',
        field_refs: ['ref:influence', 'ref:support'],
      },
      target_kind: 'factor',
      target_label: 'Conversion rate',
      priority: 1,
      priority_reason: 'It shifts the result more than anything else.',
      lifecycle_state: 'New',
      suggested_actions: [{ id: 'a1', label: 'Gather two more data points' }],
      evidence: [{ label: 'Pilot cohort, small sample', ref: 'ev:pilot' }],
      staleness: { label: 'From the first draft of figures.' },
    },
  ],
}

// ── Absent-optional ─────────────────────────────────────────────────────────

export const noSummary: Coaching = {
  version: '0.3',
  signals: [
    {
      signal_id: 'no-summary',
      move: 'check_assumption',
      source: 'observation',
      grounding: { observation: 'No orientation summary on this envelope.' },
      target_kind: 'factor',
      target_label: 'Order value',
    },
  ],
}

export const noTargetKind: Coaching = {
  version: '0.3',
  summary: 'Signals without a target entity render with a neutral marker.',
  signals: [
    {
      signal_id: 'no-target-kind',
      move: 'reframe',
      source: 'observation',
      grounding: { observation: 'There is no entity attached to this one.' },
    },
  ],
}

export const noFutureFields: Coaching = {
  version: '0.3',
  summary: 'The live-shape baseline: required fields plus an entity label only.',
  signals: [
    {
      signal_id: 'no-future-1',
      move: 'check_assumption',
      source: 'observation',
      grounding: { observation: 'A plain signal with nothing optional set beyond its label.' },
      target_kind: 'option',
      target_label: 'Keep the current plan',
    },
    {
      signal_id: 'no-future-2',
      move: 'gather_evidence',
      source: 'base_rate',
      grounding: { observation: 'Another plain signal, no roadmap fields.' },
      target_kind: 'goal',
      target_label: 'Reduce wait times',
    },
  ],
}

// ── Malformed / partial (tolerance) ─────────────────────────────────────────

export const missingGrounding: Coaching = {
  version: '0.3',
  signals: [
    {
      signal_id: 'malformed-grounding',
      move: 'check_assumption',
      source: 'observation',
      // Empty observation: the row must still render its header without throwing.
      grounding: { observation: '' },
      target_kind: 'factor',
      target_label: 'A factor with no observation text',
    },
  ],
}

export const emptySignals: Coaching = {
  version: '0.3',
  summary: 'There is nothing to coach on yet.',
  signals: [],
}

export const nullCoaching = null

export const unknownTargetKind: Coaching = {
  version: '0.3',
  signals: [
    {
      signal_id: 'unknown-kind',
      move: 'reframe',
      source: 'observation',
      grounding: { observation: 'The target kind is something the UI does not recognise.' },
      target_kind: 'mystery_kind', // UNCONFIRMED — degrades to neutral marker, no raw string shown.
      target_label: 'Something unusual',
    },
  ],
}

const LONG = 'This observation is deliberately long so the collapsed row clamps it to a single line and the panel does not break its layout when the text runs well past a sensible width for a card.'

export const veryLongStrings: Coaching = {
  version: '0.3',
  summary:
    'A long orientation summary that should wrap gracefully across multiple lines without overflowing the panel or pushing other content out of view in any way.',
  signals: [
    {
      signal_id: 'long-1',
      move: 'check_assumption',
      source: 'observation',
      grounding: { observation: LONG },
      target_kind: 'factor',
      target_label: 'A target label that is itself quite long and descriptive for testing wrap behaviour',
    },
  ],
}

// ── Safety ──────────────────────────────────────────────────────────────────

/**
 * MODEL data containing forbidden glossary terms. The UI must render it
 * VERBATIM (it never rewrites model strings — that is a CEE concern). The
 * copyHygiene test scopes to UI-authored copy only and must NOT flag this.
 */
export const forbiddenTermInLabel: Coaching = {
  version: '0.3',
  signals: [
    {
      signal_id: 'forbidden-1',
      move: 'check_assumption',
      source: 'observation',
      grounding: {
        observation: 'The edge between these two carries an unusually large coefficient weight.',
      },
      target_kind: 'factor',
      target_label: 'the graph node',
    },
  ],
}

/** Strings that would be dangerous if interpreted as HTML. Must render as text. */
export const xssish: Coaching = {
  version: '0.3',
  summary: '<script>alert(1)</script> stays as literal text.',
  signals: [
    {
      signal_id: 'xss-1',
      move: 'check_assumption',
      source: 'observation',
      grounding: { observation: '<img src=x onerror="alert(1)"> should appear as text.' },
      target_kind: 'factor',
      target_label: '<b>bold</b>',
    },
  ],
}

// ── F.6 ordering trap ────────────────────────────────────────────────────────

/**
 * priority values are 3, 1, 2 in ARRAY order. The UI must render rows in array
 * order (priorityOutOfOrder-first, then -second, then -third) — proving it does
 * not sort by priority. Render-not-compute test asserts the DOM order.
 */
export const priorityOutOfOrder: Coaching = {
  version: '0.3',
  signals: [
    {
      signal_id: 'order-first',
      move: 'check_assumption',
      source: 'observation',
      grounding: { observation: 'First in the array, priority three.' },
      priority: 3,
    },
    {
      signal_id: 'order-second',
      move: 'gather_evidence',
      source: 'observation',
      grounding: { observation: 'Second in the array, priority one.' },
      priority: 1,
    },
    {
      signal_id: 'order-third',
      move: 'reframe',
      source: 'observation',
      grounding: { observation: 'Third in the array, priority two.' },
      priority: 2,
    },
  ],
}

/** Named record so tests can iterate the whole corpus. `nullCoaching` excluded (it is not a Coaching). */
export const coachingFixtures = {
  minimalSignal,
  typicalPanel,
  bySource,
  byMove,
  withLifecycle,
  withPriority,
  withSuggestedActions,
  withEvidence,
  withStaleness,
  withAllFuture,
  noSummary,
  noTargetKind,
  noFutureFields,
  missingGrounding,
  emptySignals,
  unknownTargetKind,
  veryLongStrings,
  forbiddenTermInLabel,
  xssish,
  priorityOutOfOrder,
} satisfies Record<string, Coaching>
