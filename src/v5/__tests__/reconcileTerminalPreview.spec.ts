/**
 * `reconcileTerminalPreview` — the branch that decides whether a
 * SERVER-COMMITTED MODEL IS DESTROYED. Proved row by row against the exact
 * expression it replaced.
 *
 * ── WHY THIS FILE EXISTS ──────────────────────────────────────────────────
 * The decision used to live inline in `useConversation.runStreamedDraftTurn`
 * as:
 *
 *   const terminalErrorKeepsModel = A && G && !P
 *   if (A && G && !terminalErrorKeepsModel) discardStreamedPreview(...)
 *
 * `A && G && !(A && G && !P)` reduces to `A && G && P`, but a reader had to
 * perform that reduction to see it — on the one branch in this codebase whose
 * wrong answer removed a committed graph from the canvas and told the user
 * nothing was drafted (the measured 8 Aug 2026 journey: GRAPH_READY 96.981 s,
 * terminal COMPLETE 504 UPSTREAM_TIMEOUT 125.202 s).
 *
 * A shape change on THAT branch is only safe if it is proved equivalent, and
 * an inline branch inside an unexported network-driven function cannot carry
 * such a proof. So the decision (pure) was lifted out; the effects stayed.
 *
 * ── WHAT THIS SPEC IS, AND IS NOT ─────────────────────────────────────────
 * It is a TRUTH TABLE over the three booleans, complete at 8 of 8 rows, with
 * the OLD expression transcribed literally as the oracle. That is what makes
 * it an equivalence proof rather than a restatement of the new code's opinion
 * of itself — the oracle is the code that shipped, not the code under test.
 *
 * It is NOT a claim that the decision is the RIGHT one (trap 13c: a mutant kit
 * validates sensitivity, never correctness). The rightness of "discard only on
 * proven commit failure" is adjudicated in `terminalProvesCommitFailed`'s
 * docblock and pinned end-to-end by `streamedDraftTurn.spec.ts`'s two
 * behavioural cases. This file pins that the REWRITE changed nothing.
 */
import { describe, it, expect } from 'vitest'

import {
  reconcileTerminalPreview,
  terminalProvesCommitFailed,
} from '../consumeStreamedDraftTurn'
import type { StageGraph } from '../streamedDraftFrames'

// ---------------------------------------------------------------------------
// The three booleans, and the wire values that produce them
// ---------------------------------------------------------------------------

/** G = true. A real preview object, as `onGraphReady` recorded it. */
const GRAPH: StageGraph = { nodes: [{ id: 'n1' }], edges: [] }

/** P = true. The captured route-v2 `!dg.commitPerformed` envelope (§1.4). */
const PROVES_COMMIT_FAILED = {
  error: 'INTERNAL_ERROR',
  validator: 'turn_commit',
  details: { retryable: true, reason: 'draft_graph_commit_failed' },
}

/** P = false. The measured 504 UPSTREAM_TIMEOUT class — proves nothing. */
const PROVES_NOTHING = { error: 'UPSTREAM_TIMEOUT', status: 504 }

/**
 * ANTI-VACUITY (trap 13: an absence assertion must first prove it can see a
 * presence). If both payload fixtures produced the same `P`, every row below
 * would still pass while testing only two of the three dimensions.
 */
describe('the fixtures actually discriminate P', () => {
  it('the two payloads produce OPPOSITE commit-failure verdicts', () => {
    expect(terminalProvesCommitFailed(PROVES_COMMIT_FAILED)).toBe(true)
    expect(terminalProvesCommitFailed(PROVES_NOTHING)).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// The oracle: the pre-change expression, transcribed literally
// ---------------------------------------------------------------------------

/**
 * VERBATIM from `useConversation.ts` at 084ff1f7, with the variable names kept:
 *
 *   const terminalErrorKeepsModel =
 *     outcome.terminalError &&
 *     outcome.renderedGraph !== null &&
 *     !terminalProvesCommitFailed(outcome.terminalPayload)
 *   if (outcome.terminalError && outcome.renderedGraph && !terminalErrorKeepsModel) {
 *     discardStreamedPreview(outcome.renderedGraph)
 *   }
 *
 * Transcribed, not re-derived: the point is to compare against what SHIPPED,
 * so any simplification here would defeat the whole exercise. The `!!` on the
 * discard line reproduces the original's TRUTHINESS test on `renderedGraph`
 * (the old line tested the object, not `!== null`) — that distinction is
 * itself part of what the table proves is immaterial.
 */
function oldDecision(
  terminalError: boolean,
  renderedGraph: StageGraph | null,
  terminalPayload: unknown,
): { discardPreview: boolean; terminalErrorKeepsModel: boolean } {
  const terminalErrorKeepsModel =
    terminalError && renderedGraph !== null && !terminalProvesCommitFailed(terminalPayload)
  const discardPreview = !!(terminalError && renderedGraph && !terminalErrorKeepsModel)
  return { discardPreview, terminalErrorKeepsModel }
}

// ---------------------------------------------------------------------------
// The table
// ---------------------------------------------------------------------------

interface Row {
  A: boolean
  G: boolean
  P: boolean
  /** What the branch must do — stated independently of both implementations. */
  discardPreview: boolean
  terminalErrorKeepsModel: boolean
}

/**
 * All 8 rows. `discardPreview` is true on EXACTLY ONE of them — the row where
 * the wire said "nothing was written". Every other row keeps the graph,
 * because keeping is the direction that cannot destroy a committed model.
 */
const TABLE: readonly Row[] = [
  { A: false, G: false, P: false, discardPreview: false, terminalErrorKeepsModel: false },
  { A: false, G: false, P: true, discardPreview: false, terminalErrorKeepsModel: false },
  { A: false, G: true, P: false, discardPreview: false, terminalErrorKeepsModel: false },
  { A: false, G: true, P: true, discardPreview: false, terminalErrorKeepsModel: false },
  { A: true, G: false, P: false, discardPreview: false, terminalErrorKeepsModel: false },
  { A: true, G: false, P: true, discardPreview: false, terminalErrorKeepsModel: false },
  { A: true, G: true, P: false, discardPreview: false, terminalErrorKeepsModel: true },
  { A: true, G: true, P: true, discardPreview: true, terminalErrorKeepsModel: false },
]

const label = (r: Row) => `A=${r.A ? 1 : 0} G=${r.G ? 1 : 0} P=${r.P ? 1 : 0}`
const argsFor = (r: Row) =>
  [r.A, r.G ? GRAPH : null, r.P ? PROVES_COMMIT_FAILED : PROVES_NOTHING] as const

describe('reconcileTerminalPreview — the 8-row truth table', () => {
  it('covers the whole input space (2^3 rows, no duplicates)', () => {
    expect(TABLE).toHaveLength(8)
    expect(new Set(TABLE.map(label)).size).toBe(8)
  })

  for (const row of TABLE) {
    it(`${label(row)} → discard=${row.discardPreview ? 1 : 0} keepsModel=${row.terminalErrorKeepsModel ? 1 : 0}`, () => {
      expect(reconcileTerminalPreview(...argsFor(row))).toEqual({
        discardPreview: row.discardPreview,
        terminalErrorKeepsModel: row.terminalErrorKeepsModel,
      })
    })
  }

  it('AGREES WITH THE PRE-CHANGE EXPRESSION on every row (old === new, 8/8)', () => {
    let compared = 0
    for (const row of TABLE) {
      const args = argsFor(row)
      expect(reconcileTerminalPreview(...args), label(row)).toEqual(oldDecision(...args))
      compared += 1
    }
    // The loop must actually have run (trap 13: a comparison loop that ran
    // zero times passes by testing nothing).
    expect(compared).toBe(8)
  })

  it('DISCARDS ON EXACTLY ONE ROW — the one where the wire proved the commit failed', () => {
    const discarding = TABLE.filter((r) => reconcileTerminalPreview(...argsFor(r)).discardPreview)
    expect(discarding.map(label)).toEqual(['A=1 G=1 P=1'])
  })

  it('the two outputs are never both true — a discarded preview is not a kept model', () => {
    for (const row of TABLE) {
      const out = reconcileTerminalPreview(...argsFor(row))
      expect(out.discardPreview && out.terminalErrorKeepsModel, label(row)).toBe(false)
    }
  })
})

describe('the payload is only walked when it can matter', () => {
  it('an unreadable payload is harmless on every row that does not read it', () => {
    // Not a performance claim — a CORRECTNESS one. The old `&&` chain
    // short-circuited before `terminalProvesCommitFailed`, and the nested form
    // must too, or a hostile/garbage 200 payload gains a say it never had.
    for (const payload of [undefined, null, 'nonsense', [], 0]) {
      expect(reconcileTerminalPreview(false, GRAPH, payload)).toEqual({
        discardPreview: false,
        terminalErrorKeepsModel: false,
      })
      expect(reconcileTerminalPreview(true, null, payload)).toEqual({
        discardPreview: false,
        terminalErrorKeepsModel: false,
      })
    }
  })
})
