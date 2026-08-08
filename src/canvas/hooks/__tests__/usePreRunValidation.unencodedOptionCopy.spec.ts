/**
 * ROADMAP 2.924 — pre-run validation copy must name the REAL state, and its
 * remedy must not destroy the user's work.
 *
 * Measured by the 2.427 diagnosis lane against deployed `bc997f50`: a user adds
 * an option in chat, CEE returns `analysis_ready.status = 'needs_encoding'` with
 * that option at `status: 'needs_encoding'` and `interventions: {}`. The shipped
 * build then produced:
 *   (1) "Some options have categorical values that need encoding" — there are no
 *       categorical values; there are no values at all;
 *   (2) an `action` of `retry_draft` / "Retry Draft" — which would DISCARD the
 *       option the user had just added.
 *
 * The fixture below IS that capture state. Assertions bind to the blocker by its
 * CODE and to the option by its ID/label — never by a value predicate another
 * option could satisfy (verification trap 19).
 *
 * Reachability, stated honestly: under the DEPLOYED staging flag posture
 * (`VITE_FEATURE_PRE_ANALYSIS_V3=1`) the surfaces that render this blocker's
 * message are NOT mounted — see the reachability note in the PR. These tests pin
 * the producer's behaviour; they are not evidence of a user-visible change.
 */

import { describe, it, expect } from 'vitest'
import type { Node } from '@xyflow/react'
import type { CEEAnalysisReady } from '../../../adapters/cee/types'
import { validateBeforeRun } from '../usePreRunValidation'

// ---------------------------------------------------------------------------
// Fixtures — the measured capture state
// ---------------------------------------------------------------------------

const GOAL_ID = 'goal_revenue'

/** The option the user added in chat. Deliberately carries NO baseline keyword. */
const CHAT_ADDED_ID = 'opt_partnerships'
const CHAT_ADDED_LABEL = 'Grow via partnerships'

/** "Do nothing" is a baseline keyword, so this option is legitimately empty. */
const BASELINE_ID = 'opt_status_quo'
const BASELINE_LABEL = 'Do nothing'

function nodes(): Node[] {
  return [
    { id: GOAL_ID, type: 'goal', position: { x: 0, y: 0 }, data: { label: 'Revenue', kind: 'goal' } },
    { id: CHAT_ADDED_ID, type: 'option', position: { x: 0, y: 0 }, data: { label: CHAT_ADDED_LABEL, kind: 'option' } },
    { id: BASELINE_ID, type: 'option', position: { x: 0, y: 0 }, data: { label: BASELINE_LABEL, kind: 'option' } },
  ]
}

/**
 * The capture: overall `needs_encoding`, the chat-added option un-encoded with
 * empty interventions, and a baseline option that is legitimately empty. No
 * non-baseline option carries interventions, so this reaches the BLOCKER branch.
 */
function unEncodedCapture(
  overallStatus: CEEAnalysisReady['status'] = 'needs_encoding'
): CEEAnalysisReady {
  return {
    options: [
      { id: BASELINE_ID, label: BASELINE_LABEL, status: 'ready', interventions: {} },
      { id: CHAT_ADDED_ID, label: CHAT_ADDED_LABEL, status: 'needs_encoding', interventions: {} },
    ],
    goal_node_id: GOAL_ID,
    status: overallStatus,
  } as CEEAnalysisReady
}

/** Find the blocker by IDENTITY (its code), asserting it is unambiguous. */
function theAnalysisNotReadyBlocker(result: ReturnType<typeof validateBeforeRun>) {
  const matches = result.blockers.filter(b => b.code === 'ANALYSIS_NOT_READY')
  expect(matches).toHaveLength(1)
  return matches[0]
}

// ---------------------------------------------------------------------------

describe('ROADMAP 2.924 — un-encoded option: truthful copy + non-destructive remedy', () => {
  describe('defect 1: the copy must not assert categorical values that do not exist', () => {
    it('does not claim "categorical" anything for an option with no values at all', () => {
      const result = validateBeforeRun(GOAL_ID, nodes(), [], unEncodedCapture())
      const blocker = theAnalysisNotReadyBlocker(result)

      expect(blocker.message.toLowerCase()).not.toContain('categorical')
      expect(blocker.message.toLowerCase()).not.toContain('encoding')
    })

    it('names the real state and the specific un-encoded option by its label', () => {
      const result = validateBeforeRun(GOAL_ID, nodes(), [], unEncodedCapture())
      const blocker = theAnalysisNotReadyBlocker(result)

      // Bound to the option by its exact label — the baseline option must not
      // be the one named, and a generic "some options" sentence must not pass.
      expect(blocker.message).toContain(`"${CHAT_ADDED_LABEL}"`)
      expect(blocker.message).not.toContain(BASELINE_LABEL)
      expect(blocker.message).toContain('values set as numbers')
    })

    it('uses mapping-specific wording for needs_user_mapping', () => {
      const capture = unEncodedCapture('needs_user_mapping')
      capture.options![1].status = 'needs_user_mapping' as CEEAnalysisReady['options'][number]['status']

      const blocker = theAnalysisNotReadyBlocker(
        validateBeforeRun(GOAL_ID, nodes(), [], capture)
      )

      expect(blocker.message).toContain(`"${CHAT_ADDED_LABEL}"`)
      expect(blocker.message).toContain('which factors it affects')
      // The old copy prescribed the destructive remedy inside the sentence.
      expect(blocker.message.toLowerCase()).not.toContain('re-draft')
    })
  })

  describe('defect 2: the remedy must not discard the option the user just added', () => {
    it('offers configure_option pointing at the un-encoded option, not retry_draft', () => {
      const result = validateBeforeRun(GOAL_ID, nodes(), [], unEncodedCapture())
      const blocker = theAnalysisNotReadyBlocker(result)

      expect(blocker.action?.type).toBe('configure_option')
      // Identity binding: the remedy must target the chat-added option, not the
      // baseline one and not "whichever option happened to sort first".
      expect(blocker.action?.optionId).toBe(CHAT_ADDED_ID)
      expect(blocker.action?.label).toContain(CHAT_ADDED_LABEL)
    })

    it('never offers the destructive retry_draft action on this branch', () => {
      const result = validateBeforeRun(GOAL_ID, nodes(), [], unEncodedCapture())
      const blocker = theAnalysisNotReadyBlocker(result)

      expect(blocker.action?.type).not.toBe('retry_draft')
      expect(blocker.action?.label).not.toBe('Retry Draft')
    })
  })

  describe('predicate domain: paths where re-drafting IS the right remedy are untouched', () => {
    it("keeps retry_draft for a recognised-but-unhandled status ('unknown')", () => {
      const capture = unEncodedCapture('unknown' as CEEAnalysisReady['status'])
      const blocker = theAnalysisNotReadyBlocker(
        validateBeforeRun(GOAL_ID, nodes(), [], capture)
      )

      // 'unknown' is not a soft-bypass status: no option is named, nothing of the
      // user's is at risk, and re-drafting is the correct move.
      expect(blocker.action?.type).toBe('retry_draft')
      expect(blocker.message).toBe('Analysis not ready')
    })

    it('keeps the brief-editing remedy for needs_user_input', () => {
      const capture = unEncodedCapture('needs_user_input' as CEEAnalysisReady['status'])
      const blocker = theAnalysisNotReadyBlocker(
        validateBeforeRun(GOAL_ID, nodes(), [], capture)
      )

      expect(blocker.message).toContain('brief needs changes')
      expect(blocker.action?.type).toBe('retry_draft')
      expect(blocker.action?.label).toBe('Edit brief')
    })

    it('still allows the run when the soft status is contradicted by resolved options', () => {
      const capture = unEncodedCapture()
      capture.options![1].status = 'ready'
      capture.options![1].interventions = { fac_reach: { value: 0.4, source: 'brief_extraction' } } as never

      const result = validateBeforeRun(GOAL_ID, nodes(), [], capture)

      expect(result.canRun).toBe(true)
      expect(result.blockers.some(b => b.code === 'ANALYSIS_NOT_READY')).toBe(false)
    })
  })

  describe('warning twin (same copy map; renderer is currently unmounted)', () => {
    it('carries the truthful message and a non-destructive suggestion', () => {
      // A third option WITH interventions flips the branch to the warning twin.
      const capture = unEncodedCapture()
      capture.options!.push({
        id: 'opt_direct_sales',
        label: 'Build a direct sales team',
        status: 'ready',
        interventions: { fac_reach: { value: 0.6, source: 'brief_extraction' } },
      } as never)

      const result = validateBeforeRun(GOAL_ID, nodes(), [], capture)
      const warnings = result.warnings.filter(w => w.code === 'ANALYSIS_NOT_READY')
      expect(warnings).toHaveLength(1)

      expect(warnings[0].message.toLowerCase()).not.toContain('categorical')
      expect(warnings[0].message).toContain(`"${CHAT_ADDED_LABEL}"`)
      expect(warnings[0].suggestion).toContain(`Configure "${CHAT_ADDED_LABEL}"`)
      expect(warnings[0].suggestion).toContain('re-drafting would replace')
    })
  })
})
