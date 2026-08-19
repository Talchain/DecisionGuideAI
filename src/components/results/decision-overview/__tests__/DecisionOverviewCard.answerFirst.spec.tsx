/**
 * ANSWER FIRST — the framing prompt yields the first screenful to the result.
 *
 * ── The defect, measured on the DEPLOYED surface ───────────────────────────
 * Driven on staging `4d1e650b` (fresh guest, one real typed brief, one real
 * first-pass analysis, 1280x800, live DOM): with the Analysis panel scrolled to
 * the top, the verdict sentence sat 573px down a 515px-tall visible region —
 * 111% of a panel height before the answer appeared. A user who had just
 * clicked "Analyse first pass" saw no answer at all without scrolling.
 *
 * Everything above it was set-up: `Decision overview` -> `Draft decision` ->
 * `Framing needs one clarification` with four Goal/Context/Constraints/Options
 * sub-cards -> `Review your decision brief` -> `Olumi's framing question`.
 *
 * The cause is this card: `autoExpand` was `state !== 'ready' && state !==
 * 'unassessed'`, which force-expands the whole brief body on the derived
 * `thin` quality (no success measure) — and it kept doing so after a completed
 * analysis, when there is finally an answer that outranks the prompt.
 *
 * ── Why this and not a reorder ─────────────────────────────────────────────
 * The gate's remedy is "move the verdict above the framing furniture, OR
 * collapse that furniture to one line". Moving is the more invasive of the
 * two: `OutputsDock.analysis-run.spec.tsx` pins "the overview mounts FIRST,
 * above the freshness strip (canonical hierarchy)" as a RULING, with a long
 * defence in `OutputsDock.tsx` ("the card is the ORIENTATION surface"). This
 * takes the second remedy, which needs no doctrine change.
 *
 * ── ORDERING, NOT DELETION ─────────────────────────────────────────────────
 * Paul's constraint on every simplification is "less interface, not less
 * intelligence". Nothing is removed: the same four dimensions, the same brief
 * actions and the same framing question all still render, one click away
 * behind the disclosure control this card already owns. The last case pins
 * that, so a future "simplification" cannot quietly turn a collapse into a
 * deletion and stay green.
 *
 * ── What this spec pins ────────────────────────────────────────────────────
 * A DISCRIMINATING TRIPLE (CLAUDE.md trap 19), because a single case is
 * satisfiable by a card that never expands at all:
 *
 *   thin, NO result yet      -> EXPANDED   (historic behaviour, unchanged)
 *   thin, result present     -> COLLAPSED  (the fix)
 *   BLOCKED, result present  -> EXPANDED   (the deliberate exemption)
 *
 * The first row is the control that stops the fix becoming "never expand".
 * The third is the control that stops it becoming "always collapse once a
 * report exists" — a danger-severity framing problem must not be folded away
 * behind the very result it undermines.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

import { DecisionOverviewCard } from '../DecisionOverviewCard'
import { useCanvasStore } from '../../../../canvas/store'
import { useGuidanceStore } from '../../../../canvas/stores/guidanceStore'

/** `thin` = analysis_ready is 'ready' but no success measure is set. */
const READY_NO_MEASURE = { status: 'ready', options: [{ id: 'o1' }], goal_node_id: 'g1' }
const GOAL_NODE_NO_MEASURE = { id: 'g1', type: 'goal', position: { x: 0, y: 0 }, data: { label: 'G' } }
const BLOCKER_HEALTH = { issues: [{ severity: 'blocker', message: 'Goal is not reachable from any option' }] }

/** A minimal completed report — presence is the whole signal the card reads. */
const COMPLETED = { status: 'complete', progress: 100, report: { insights: { summary: 'x' } } }

function mount(opts: { hasResult: boolean; blocked?: boolean }) {
  localStorage.setItem('feature.decisionOverview', '1')
  useCanvasStore.setState({
    ceeAnalysisReady: READY_NO_MEASURE,
    nodes: [GOAL_NODE_NO_MEASURE],
    goalThreshold: null,
    goalConstraints: null,
    currentBriefText: null,
    graphHealth: opts.blocked ? BLOCKER_HEALTH : null,
    results: opts.hasResult ? COMPLETED : null,
  } as never)
  return render(<DecisionOverviewCard title="Draft decision" />)
}

/**
 * Expansion read by IDENTITY — the presence of a brief-dimension sub-card,
 * never a height, a class or page text another element could satisfy
 * (CLAUDE.md trap 19).
 */
function isExpanded(): boolean {
  return screen.queryByTestId('brief-dim-goal') !== null
}

describe('Decision overview: the answer outranks the framing prompt', () => {
  beforeEach(() => {
    useGuidanceStore.setState({ guidanceItems: [] } as never)
    localStorage.clear()
    document.body.innerHTML = ''
  })

  it('thin brief, NO result yet → still auto-expands (the prompt is the main event)', () => {
    mount({ hasResult: false })
    // Precondition: this really is the thin state the defect needs.
    expect(screen.getByTestId('brief-bar').textContent).toMatch(/needs one clarification/i)
    expect(isExpanded()).toBe(true)
  })

  it('thin brief, result present → collapses to its one-line summary', () => {
    mount({ hasResult: true })
    expect(screen.getByTestId('brief-bar').textContent).toMatch(/needs one clarification/i)
    expect(
      isExpanded(),
      'the framing sub-cards must not hold the first screenful once there is an answer to read',
    ).toBe(false)
  })

  it('BLOCKED brief, result present → still expands (danger is exempt)', () => {
    mount({ hasResult: true, blocked: true })
    expect(
      isExpanded(),
      'a blocker-severity framing problem must not be folded away behind the result it undermines',
    ).toBe(true)
  })

  it('the three states discriminate — not "never expand", not "always expand"', () => {
    mount({ hasResult: false })
    const thinNoResult = isExpanded()
    document.body.innerHTML = ''
    mount({ hasResult: true })
    const thinWithResult = isExpanded()
    document.body.innerHTML = ''
    mount({ hasResult: true, blocked: true })
    const blockedWithResult = isExpanded()

    expect(
      [thinNoResult, thinWithResult, blockedWithResult],
      `thinNoResult=${thinNoResult} thinWithResult=${thinWithResult} blockedWithResult=${blockedWithResult}`,
    ).toEqual([true, false, true])
  })

  it('LESS INTERFACE, NOT LESS INTELLIGENCE: collapsed still offers the full brief one click away', () => {
    mount({ hasResult: true })
    expect(isExpanded()).toBe(false)

    // ⚠ BOUND BY IDENTITY, and this assertion was WRONG on its first draft in
    // exactly the way this file warns about. It selected
    // `[aria-expanded]` inside the card — a predicate the ActionsMenu trigger
    // ALSO satisfies, and which precedes the disclosure control in the DOM. It
    // clicked the wrong element and reported the content as unrecoverable
    // (CLAUDE.md trap 19, caught by the test failing rather than by review).
    const toggle = screen.getByTestId('brief-bar')
    expect(
      toggle.getAttribute('aria-expanded'),
      'brief-bar IS the disclosure control; if it stops carrying aria-expanded the binding has moved',
    ).toBe('false')

    fireEvent.click(toggle)
    expect(
      isExpanded(),
      'expanding must restore the framing sub-cards — the content is deferred, never deleted',
    ).toBe(true)
  })
})
