/**
 * canRunAnalysis — a stale verdict may not be quoted as current
 * (ROADMAP 2.635, invariant I-3).
 *
 * ── The limb ─────────────────────────────────────────────────────────────
 * ROADMAP 2.332 gave the store a `stale` flag: true the moment a
 * payload-affecting mutation is detected, cleared only when a fresh verdict
 * lands. Its docstring says `stale` "is what stops a surface presenting that
 * verdict as current".
 *
 * The V3 footer honours it. THE GATE DID NOT — `stale` was not an input to
 * `canRunAnalysis` at all. So when a retained verdict blocks, the gate composed
 * its refusal from that verdict's STRUCTURED FIELDS (`options_total`,
 * `options_ready`, the named option labels) as if the fields described the model
 * now on the canvas. The user follows the named remedy — describes what the
 * option changes — the canvas mutates, `stale` goes true, and the SAME sentence
 * naming the SAME option is still on screen, because the verdict behind it has
 * not been re-asked. That is a false reason, and by POC-DONE's PC1 language a
 * false reason is exactly what makes a dead end:
 *
 *     "a truthful 'can't yet, here's why + the remedy' is not a dead end;
 *      a false reason is"
 *
 * ── The chosen direction ─────────────────────────────────────────────────
 * Staleness does NOT open or close the gate — it is not evidence about
 * runnability, and per Ruling 3 uncertainty must not lock the user out. It
 * changes only what the refusal is allowed to CLAIM: while the verdict is
 * outgrown, the gate may say that it is re-checking, and may not make a
 * specific claim (an option name, a count, a missing goal) sourced from a
 * verdict that was never asked about the current model.
 *
 * ── What these tests pin ─────────────────────────────────────────────────
 *   1. a fresh blocking verdict still names the specific remedy (control);
 *   2. a STALE blocking verdict names no option, no count, no goal claim;
 *   3. it says instead that the model changed and the check is being redone;
 *   4. the gate direction is unchanged by staleness in BOTH directions —
 *      stale + blocking stays shut, stale + runnable stays open. Staleness is
 *      not a new blocker.
 *
 * Binding note (CLAUDE.md trap 19): the control asserts the EXACT composed
 * sentence for a NAMED option, so it cannot be satisfied by some other
 * blocked-copy rung that happens to be non-empty.
 */
import { describe, it, expect } from 'vitest'
import { canRunAnalysis } from '../canRunAnalysis'
import { BLOCKED_REASON_COPY } from '../composeBlockedReason'
import type { GraphReadiness } from '../../hooks/useGraphReadiness'

/**
 * The verdict from Paul's failing journey: five options, four ready, goal
 * present, `can_run_analysis: false`. Its structured fields are what the
 * specific copy is composed from — which is precisely why quoting them from a
 * stale verdict is a factual claim about a model nobody graded.
 */
const BLOCKED_VERDICT: GraphReadiness = {
  readiness_score: 90,
  readiness_level: 'ready',
  can_run_analysis: false,
  confidence_explanation: 'V3 analysis not ready: 1 option(s) blocked: opt_extend',
  improvements: [],
  scaffold_plan: { will_scaffold_options: false },
  options_ready: 4,
  options_total: 5,
  goal_node_valid: true,
} as GraphReadiness

const RUNNABLE_VERDICT: GraphReadiness = {
  readiness_score: 90,
  readiness_level: 'ready',
  can_run_analysis: true,
  confidence_explanation: 'Ready to analyse',
  improvements: [],
} as GraphReadiness

const ONE_OPTION_NEEDING_VALUES = [
  { id: 'opt_extend', label: 'Partner with a consultancy' },
] as const

function gate(overrides: Record<string, unknown> = {}) {
  return canRunAnalysis({
    graphHealth: { status: 'healthy', score: 100, issues: [] },
    readiness: BLOCKED_VERDICT,
    hasBlockers: false,
    nodeCount: 8,
    optionsNeedingValues: ONE_OPTION_NEEDING_VALUES,
    ...overrides,
  } as never)
}

describe('canRunAnalysis — a stale verdict is not quoted as current (I-3)', () => {
  // ── Control (traps 13 / 13b) ─────────────────────────────────────
  // Prove the specific sentence is REACHABLE here before asserting it is
  // withheld. Without this, every assertion below could pass on a gate that
  // never composes specific copy at all.
  describe('control — a FRESH blocking verdict still names the remedy', () => {
    it('composes the exact one-option sentence when the verdict is current', () => {
      const result = gate({ readinessStale: false })

      expect(result.allowed).toBe(false)
      expect(result.reason).toBe(
        BLOCKED_REASON_COPY.oneOption('Partner with a consultancy', true),
      )
    })

    it('composes the same sentence when staleness is not supplied at all', () => {
      // Omission must behave as "current", or every existing call site silently
      // loses its specific copy the day this parameter lands.
      const result = gate()

      expect(result.reason).toBe(
        BLOCKED_REASON_COPY.oneOption('Partner with a consultancy', true),
      )
    })
  })

  // ── RED 1 — the specific claim must be withheld while stale ──────
  describe('a stale blocking verdict makes no specific claim', () => {
    it('does not name the option the stale verdict graded', () => {
      const result = gate({ readinessStale: true })

      expect(result.reason ?? '').not.toContain('Partner with a consultancy')
      expect(result.blockingReasons ?? []).not.toContain(
        BLOCKED_REASON_COPY.oneOption('Partner with a consultancy', true),
      )
    })

    it('does not publish the stale verdict’s count', () => {
      const result = canRunAnalysis({
        graphHealth: { status: 'healthy', score: 100, issues: [] },
        readiness: { ...BLOCKED_VERDICT, options_ready: 1, options_total: 4 } as GraphReadiness,
        hasBlockers: false,
        nodeCount: 8,
        readinessStale: true,
        optionsNeedingValues: [
          { id: 'a', label: 'Alpha' },
          { id: 'b', label: 'Beta' },
          { id: 'c', label: 'Gamma' },
        ],
      } as never)

      expect(result.reason ?? '').not.toMatch(/\b3 options\b/)
      expect(result.reason ?? '').not.toMatch(/\bhave no effect values yet\b/)
    })

    it('does not claim the goal is missing from a verdict it never re-asked', () => {
      const result = canRunAnalysis({
        graphHealth: { status: 'healthy', score: 100, issues: [] },
        readiness: { ...BLOCKED_VERDICT, goal_node_valid: false } as GraphReadiness,
        hasBlockers: false,
        nodeCount: 8,
        readinessStale: true,
      } as never)

      expect(result.reason ?? '').not.toBe(BLOCKED_REASON_COPY.goalMissing)
    })

    it('does not claim there are too few options from a stale count', () => {
      const result = canRunAnalysis({
        graphHealth: { status: 'healthy', score: 100, issues: [] },
        readiness: { ...BLOCKED_VERDICT, options_total: 1 } as GraphReadiness,
        hasBlockers: false,
        nodeCount: 8,
        readinessStale: true,
      } as never)

      expect(result.reason ?? '').not.toBe(BLOCKED_REASON_COPY.tooFewOptions)
    })
  })

  // ── RED 2 — it must say what it actually knows ───────────────────
  describe('the stale refusal states the state it is in', () => {
    it('tells the user the model changed and the check is being redone', () => {
      const result = gate({ readinessStale: true })

      expect(result.allowed).toBe(false)
      expect(result.reason).toBe(BLOCKED_REASON_COPY.staleRecheck)
      // Non-negotiable: it must not be an empty or absent reason. A blocked Run
      // button with no reason is the dead end PC1 names.
      expect((result.reason ?? '').length).toBeGreaterThan(0)
    })

    it('the stale sentence makes no claim about the model', () => {
      // The whole point of this rung: it describes the CHECK, never the graph.
      const sentence = BLOCKED_REASON_COPY.staleRecheck

      expect(sentence).not.toMatch(/option|goal|factor|decision/i)
      expect(sentence).toMatch(/chang/i)
    })
  })

  // ── RED 3 — the gate direction is a decision, both ways ──────────
  describe('staleness does not move the gate', () => {
    it('stale + blocking stays shut', () => {
      expect(gate({ readinessStale: true }).allowed).toBe(false)
    })

    it('stale + runnable stays OPEN — staleness is not a new blocker', () => {
      // Ruling 3: uncertainty must not lock the user out. A user whose model is
      // mid-recheck and whose last verdict said "yes" keeps their Run button.
      const result = canRunAnalysis({
        graphHealth: { status: 'healthy', score: 100, issues: [] },
        readiness: RUNNABLE_VERDICT,
        hasBlockers: false,
        nodeCount: 8,
        readinessStale: true,
      } as never)

      expect(result.allowed).toBe(true)
    })

    it('stale does not suppress a NON-readiness blocking reason', () => {
      // Staleness is evidence about the readiness verdict only. A validation
      // blocker is the canvas's own fact and must survive untouched.
      const result = canRunAnalysis({
        graphHealth: {
          status: 'error',
          score: 10,
          issues: [{ severity: 'error', message: 'Cycle detected' }],
        },
        readiness: BLOCKED_VERDICT,
        hasBlockers: true,
        nodeCount: 8,
        readinessStale: true,
      } as never)

      expect(result.allowed).toBe(false)
      // Bound by the validator's own message (trap 19), not by "some reason
      // exists" — the stale rung also produces a reason, so a length check
      // could pass on the wrong object.
      expect(result.blockingReasons).toContain('Cycle detected')
      expect(result.reason).toContain('Cycle detected')
    })
  })
})
