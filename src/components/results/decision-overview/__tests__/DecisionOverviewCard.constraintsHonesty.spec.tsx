/**
 * LINK-TRACK R1 item 1 (contradiction cluster, C7) — THE CONSTRAINTS CHIP
 * CANNOT REPORT A ZERO AS A HEALTHY STATE.
 *
 * ── THE MEASURED CONTRADICTION ─────────────────────────────────────────────
 * L3 browser lane, deployed staging `5597d867`, 2026-08-11
 * (`L3-BROWSER-TRUTH.md` §9 C7 — "the sharpest H3 evidence in the lane"):
 * the framing panel reported **"Constraints — No limits on record"** for a
 * brief that states three, two of them prefixed with the literal word
 * *constraint*:
 *
 *   "constraint: no more than one compulsory redundancy round in the next
 *    12 months … the CEO is adamant"
 *   "constraint: engineering (58 heads) is ring-fenced, board agreed"
 *   "the ops director says max two big changes in parallel"
 *
 * And the product demonstrably READ all three: the drafted graph carries
 * `risk_redundancy_breach` (40% assumed strength) and `risk_change_saturation`
 * (35%). They were extracted, silently re-typed as soft probabilistic risks,
 * and the framing panel then truthfully reported that no constraints exist —
 * because by then none did.
 *
 * ── WHAT IS AND IS NOT IN SCOPE HERE ───────────────────────────────────────
 * The semantic half — a hard boundary becoming a 40% likelihood of "breach" —
 * is WS-A's, and this lane must not touch it (BRIEF-LINK-TRACK-R1 "Explicitly
 * OUT of scope"). What IS display-side, and what this pins, is the second
 * defect on the same chip and the one L3 photographed:
 *
 *   the zero was rendered under a **`border-success`** dot.
 *
 * A previous lane already corrected this chip's SENTENCE (retiring the false
 * denial "Not captured yet") and left the dot alone. So the card said "no
 * limits" in a tone that means "all good" — the note stopped denying the
 * user's input while the DOT went on approving of the gap. Two channels, one
 * chip, and only one of them was fixed.
 *
 * A zero-constraint record is not a healthy state on any reading. It is either
 * a real gap or a loss. The chip may report it; it may not congratulate it.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

import { DecisionOverviewCard, OVERVIEW_COPY } from '../DecisionOverviewCard'
import { useCanvasStore } from '../../../../canvas/store'
import { useGuidanceStore } from '../../../../canvas/stores/guidanceStore'
import { useAskOlumiStore } from '../../coaching/askOlumiStore'

/** The card is flag-gated; the chips only exist once it renders. */
const READY = { status: 'ready', options: [{ id: 'o1' }], goal_node_id: 'g1' }
const GOAL_NODE_WITH_MEASURE = {
  id: 'g1',
  type: 'goal',
  position: { x: 0, y: 0 },
  data: { label: 'G', threshold_source: 'user', success_threshold: 20 },
}

/** The literal a reader would see, pinned so deleting the constant cannot make this vacuous. */
const DENIAL_SHAPE = /on record/i

function openBrief() {
  fireEvent.click(screen.getByTestId('brief-bar'))
}

describe('LINK-R1 C7 — the Constraints chip reports the zero without approving of it', () => {
  beforeEach(() => {
    localStorage.clear()
    localStorage.setItem('feature.decisionOverview', '1')
    useGuidanceStore.setState({ guidanceItems: [], _sendMessage: null } as never)
    useAskOlumiStore.setState({
      isOpen: false,
      context: '',
      draft: '',
      label: '',
      targetId: null,
      parameters: undefined,
      source: 'chip',
    })
    useCanvasStore.setState({
      ceeAnalysisReady: READY,
      goalThreshold: 20,
      nodes: [GOAL_NODE_WITH_MEASURE],
      goalConstraints: null,
      currentBriefText: null,
      graphHealth: null,
    } as never)
  })

  it('does NOT carry a success dot when nothing is on record', () => {
    render(<DecisionOverviewCard title="Take £4m out of opex" />)
    openBrief()

    const chip = screen.getByTestId('brief-dim-constraints')
    const dot = chip.querySelector('[data-dim-dot]')
    expect(dot, 'the constraints chip has no identifiable dot to assert on').not.toBeNull()
    expect(
      dot!.className,
      'a zero-constraint record was rendered in the tone that means "all good"',
    ).not.toContain('border-success')
  })

  it('DOES carry a success dot once limits are genuinely on record — the discriminating positive', () => {
    // Without this the fix could pass by making the dot neutral always, which
    // deletes a truthful signal instead of correcting a false one
    // (CLAUDE.md trap 13b).
    useCanvasStore.setState({
      goalConstraints: [{ id: 'c1', label: 'Max one redundancy round', operator: '<=', value: 1 }],
    } as never)
    render(<DecisionOverviewCard title="Take £4m out of opex" />)
    openBrief()

    const chip = screen.getByTestId('brief-dim-constraints')
    const dot = chip.querySelector('[data-dim-dot]')
    expect(dot!.className).toContain('border-success')
    expect(chip).toHaveTextContent('1 limit captured')
  })

  it('the empty note describes the MODEL, not the user\'s record', () => {
    // "No limits on record" is ambiguous between "my model holds none" and
    // "you supplied none", and L3 read it as the second — on a brief that
    // states three. The sentence must be unambiguously about what is set.
    render(<DecisionOverviewCard title="Take £4m out of opex" />)
    openBrief()

    const chip = screen.getByTestId('brief-dim-constraints')
    expect(chip.textContent ?? '').not.toMatch(DENIAL_SHAPE)
    expect(chip).toHaveTextContent(OVERVIEW_COPY.constraintsNoteEmpty)
  })
})
