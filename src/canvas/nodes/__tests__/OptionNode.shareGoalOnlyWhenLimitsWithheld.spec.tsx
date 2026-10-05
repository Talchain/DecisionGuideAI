/**
 * ⭐ AN OPTION'S SHARE SAYS IT IS GOAL-ONLY WHEN THE LIMIT VERDICT WITHHOLDS THE
 * LEADER CLAIM (RC #63 5803875794, P0 #3(c); Paul's staging test 23 Sep).
 *
 * Paul's run: goal "£20k MRR in 12 months" AND a guardrail "churn < 4%". CEE
 * answered `leader_claim: { permitted: false, withheld_reason:
 * 'constraint_verdict_withheld' }` — yet every option card still showed its
 * share ("81% / 17% / 2%") with nothing saying the guardrail was not in it,
 * which reads as a ranking of the whole decision.
 *
 * The qualifier is true in ALL THREE producer states behind that token
 * (evaluated_infeasible / unevaluated / identity_unresolved —
 * `analysisNewCopy.ts` LEADER_WITHHOLD_CAUSE): the win share is computed on the
 * goal outcome alone. It claims nothing about WHICH of the three happened.
 *
 * ⭐ ED #63 5806207128 / 5806266691 choice 3 + NODE-ANATOMY v3.2 (Option): the
 * qualifier is the SHORT form `Goal only`, ON THE SHARE LINE — the same row as
 * `Current model ▬ N% of runs` — replacing #1921's second line ("Goal only ·
 * your limits aren’t in this share"). The full meaning ("your limits aren’t in
 * this share") is on hover AND keyboard focus AND in the accessible name. It
 * must not look like endorsement: muted text, no colour. The producer_cause
 * gating and the reload survival (RESULT-BOUND) are unchanged.
 *
 * ⭐⭐ SUPERSEDED BY CURRENT-READ row 9 (AIQ 5912710392; Paul's test 4276f3f9,
 * finding 9): a share that singles one option out names the leader in numbers,
 * so when the producer withholds the leader (`permitted === false`, for ANY
 * `producer_cause`) the card shows NO share. Its slot shows `Not ranked`, with the
 * reason (`winShareGate.ts` `winShareWithheldReason`) in the name and tooltip.
 * `Goal only` and `Provisional` only ever qualified a share on a withheld run, so
 * neither can appear any more. Each withheld row below now pins that rule on the
 * SAME withheld run; the wording/focus rows that still hold for a share are kept
 * on a PERMITTED run. The gating on the RESULT's stamp (RESULT-BOUND) and the
 * ED choice 3 properties (label in name, focus as well as hover, muted and
 * colourless, one line) now apply to the marker.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import { OptionNode } from '../OptionNode'
import { useCanvasStore } from '../../store'
import { leaderWithholdCause } from '../../../components/results/analysisNew/analysisNewCopy'
import { EXPLORATORY_REASON_LINE, NOT_RANKED_MARKER, WITHHELD_REASON_FALLBACK } from '../../state/winShareGate'

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return { ...actual, Handle: () => null }
})

const candidate = { id: 'candidate', type: 'option', position: { x: 0, y: 0 }, data: { label: 'Grandfather existing customers', type: 'option' } }

const envelope = (leaderClaim: Record<string, unknown>) => ({
  run_state: { kind: 'complete_current', computed_at: '2026-09-23T21:40:00.000Z' },
  readiness: { status: 'ready', blockers: [] },
  leader_claim: leaderClaim,
  robustness: { aggregate_level: 'low' },
  usable_for_prose: true, usable_for_chips: true, usable_for_followup: true,
  requires_rerun: false, blocked_unusable: false, contradictions: [],
})

const seed = (analysisStateV1: unknown, permission?: Record<string, unknown>) => {
  useCanvasStore.setState({
    nodes: [candidate, { ...candidate, id: 'alternative', data: { label: 'Usage-based for all', type: 'option' } }],
    edges: [], ceeAnalysisReady: null, viewMode: 'standard',
    analysisStateV1,
    analysisFreshness: { freshness: 'fresh', freshnessReason: 'graph_hash_match', computedAt: '2026-09-23T21:40:00.000Z' },
    analysisFreshnessDirty: false, importPendingServerRegistration: false, currentScenarioId: 'limits-scenario',
    v5AnalysisFact: { scenarioId: 'limits-scenario', analysisHash: 'run-1', hasRunAnalysisFact: true },
    hasCompletedFirstRun: true,
    results: { status: 'complete', hash: 'run-1', report: {
      option_probabilities: {
        candidate: { status: 'computed', win_probability: 0.81 },
        alternative: { status: 'computed', win_probability: 0.19 },
      },
      robustness: { near_tie: { is_tie: false, top_option_id: 'candidate' } },
      ...(permission ? { producer_leader_permission: permission } : {}),
    } },
  } as never)
}

const renderCard = () => render(<ReactFlowProvider><OptionNode
  id={candidate.id} type="option" data={candidate.data as never} selected={false}
  isConnectable positionAbsoluteX={0} positionAbsoluteY={0}
  dragging={false} zIndex={0} deletable selectable draggable
/></ReactFlowProvider>)

const readout = () => screen.getByTestId('option-win-readout-candidate')
const qualifier = () => screen.queryByTestId('option-share-goal-only-candidate')
const shareRow = () => screen.getByTestId('option-analysis-currency-candidate')
const label = () => shareRow().getAttribute('aria-label') ?? ''
const tokens = (el: Element) => new Set((el.getAttribute('class') ?? '').split(/\s+/).filter(Boolean))
const WITHHELD_FOR_LIMITS = { permitted: false, withheld_reason: 'leader_claim_withheld', producer_cause: 'constraint_verdict_withheld' }
const slot = () => screen.getByTestId('option-share-slot-candidate')
const notRanked = () => screen.queryByTestId('option-not-ranked-candidate')
const provisional = () => screen.queryByTestId('option-share-provisional-candidate')
/**
 * CURRENT-READ row 9 (AIQ 5912710392), on a withheld run: no share figure in the
 * slot, no share row, and `Not ranked` + `reason` in the SAME reserved one-line
 * slot (`h-[1lh]`), so the card neither grows nor shrinks after the Run.
 */
const expectNotRanked = (reason: string) => {
  expect(slot().textContent).not.toMatch(/\d\s*%/)
  expect(screen.queryByTestId('option-analysis-currency-candidate'), 'no share row on a withheld run').toBeNull()
  const marker = notRanked()
  expect(marker, 'the `Not ranked` marker renders').not.toBeNull()
  expect(marker!.textContent).toBe(NOT_RANKED_MARKER)
  expect(marker!.getAttribute('aria-label')).toBe(`${NOT_RANKED_MARKER}. ${reason}`)
  expect(slot().contains(marker)).toBe(true)
  expect(tokens(slot()).has('h-[1lh]')).toBe(true)
  expect(slot().getAttribute('aria-hidden')).toBeNull()
}

afterEach(() => {
  cleanup()
  useCanvasStore.setState({
    analysisStateV1: null, analysisFreshness: null, analysisFreshnessDirty: false,
    v5AnalysisFact: null, results: { status: 'idle', report: null },
  } as never)
})

describe('an option share under a withheld limit verdict says it is goal-only (RC P0 #3c)', () => {
  // CURRENT-READ row 9 (AIQ 5912710392): WAS "the share keeps its number AND carries the goal-only
  // qualifier". A withheld leader now withholds the share; the reason is said instead.
  it('constraint_verdict_withheld → NO share: `Not ranked`, with the exploratory reason (visible + accessible)', () => {
    seed(envelope({ permitted: false, withheld_reason: 'constraint_verdict_withheld' }), WITHHELD_FOR_LIMITS)
    renderCard()
    expectNotRanked(EXPLORATORY_REASON_LINE)
    expect(qualifier()).toBeNull()
    // ⛔ The token also covers a withhold on a brief with NO limits (DL #63
    // 5825413732; Panel bundle 3): the reason must not presume limits exist.
    expect(notRanked()!.getAttribute('aria-label')).not.toMatch(/your limits/i)
  })

  // CURRENT-READ row 9 (AIQ 5912710392): WAS "`Goal only` sits in the same row as the share, after it".
  // The one-line property now holds for the marker: it IS the slot's one line.
  it('ED choice 3 — ONE LINE: `Not ranked` sits in the share slot itself, never wraps; no second line, no `Goal only` anywhere', () => {
    seed(null, WITHHELD_FOR_LIMITS)
    renderCard()
    const marker = notRanked()!
    expect(marker.parentElement).toBe(slot())
    expect(tokens(marker).has('whitespace-nowrap')).toBe(true)
    expect(marker.tagName).not.toBe('P')
    // #1921's own paragraph is gone, and the qualifier cannot come back on a withheld run.
    expect(document.body.textContent).not.toContain('Goal only')
  })

  // CURRENT-READ row 9 (AIQ 5912710392): WAS the share's name opening "… · Goal only. This share compares …".
  it('ED choice 3 — label in name: the spoken string opens with the visible `Not ranked`, then the reason', () => {
    seed(null, WITHHELD_FOR_LIMITS)
    renderCard()
    const marker = notRanked()!
    const visible = marker.textContent!
    expect(visible).toBe(NOT_RANKED_MARKER)
    expect(marker.getAttribute('aria-label')!.startsWith(`${visible}. `)).toBe(true)
    expect(marker.getAttribute('aria-label')).toBe(`${NOT_RANKED_MARKER}. ${EXPLORATORY_REASON_LINE}`)
  })

  // CURRENT-READ row 9 (AIQ 5912710392): WAS the share row's focus tooltip carrying "Goal only. …".
  it('ED choice 3 — the reason is on keyboard FOCUS as well as hover', async () => {
    seed(null, WITHHELD_FOR_LIMITS)
    renderCard()
    const marker = notRanked()!
    expect(marker.getAttribute('tabindex')).toBe('0')
    act(() => marker.focus())
    expect(document.activeElement).toBe(marker)
    const tip = await screen.findByRole('tooltip')
    expect(tip).toHaveTextContent(EXPLORATORY_REASON_LINE)
  })

  // MOVED TO A PERMITTED RUN: the share's label-in-name and its focus tooltip still hold wherever a
  // share renders, which after CURRENT-READ row 9 is only a permitted run (no qualifier on it).
  it('PERMITTED run — the share row still opens its name with the visible line, and its tooltip opens on focus', async () => {
    seed(envelope({ permitted: true, separation: 'separated' }), { permitted: true })
    renderCard()
    // R3 5903852225 / AIQ 5903874730: the share says "best in" (it is not a chance).
    expect(label().startsWith('Current model · best in 81% of runs.')).toBe(true)
    expect(shareRow().getAttribute('tabindex')).toBe('0')
    act(() => shareRow().focus())
    expect(document.activeElement).toBe(shareRow())
    const tip = await screen.findByRole('tooltip')
    expect(tip).toHaveTextContent('Current model · best in 81% of runs.')
  })

  // CURRENT-READ row 9 (AIQ 5912710392): WAS checked on the `Goal only` qualifier; now on the marker.
  it('ED choice 3 — it must not look like endorsement: muted text, no colour channel', () => {
    seed(null, WITHHELD_FOR_LIMITS)
    renderCard()
    const marker = notRanked()!
    const words = marker.querySelector('span')!
    expect(words.textContent).toBe(NOT_RANKED_MARKER)
    expect(tokens(words).has('text-text-light')).toBe(true)
    for (const el of [marker, words]) {
      const t = tokens(el)
      for (const cls of [...t]) {
        expect(/^(text|bg|border)-(info|success|warning|danger|primary|option)/.test(cls), `colour token ${cls}`).toBe(false)
      }
      expect(t.has('font-medium')).toBe(false)
      expect(t.has('font-semibold')).toBe(false)
    }
  })

  it('CONTRAST — leader permitted: same numbers, no qualifier', () => {
    seed(envelope({ permitted: true, separation: 'separated' }))
    renderCard()
    expect(readout().textContent).toBe('81% of runs')
    expect(qualifier()).toBeNull()
    expect(notRanked()).toBeNull()
    expect(label()).not.toContain('goal alone')
    expect(label()).not.toContain('Goal only')
    expect(label()).not.toContain('your limits')
  })

  // CURRENT-READ row 9 (AIQ 5912710392): WAS "the share keeps its number, no goal-only qualifier".
  it('CONTRAST — withheld for a DIFFERENT reason (separation_unavailable): no share, no goal-only qualifier, that reason\'s own words', () => {
    seed(envelope({ permitted: false, withheld_reason: 'separation_unavailable' }),
      { permitted: false, withheld_reason: 'leader_claim_withheld', producer_cause: 'separation_unavailable' })
    renderCard()
    const words = leaderWithholdCause('separation_unavailable')
    expect(words).not.toBeNull()
    expectNotRanked(words!)
    expect(words).not.toBe(EXPLORATORY_REASON_LINE)
    expect(qualifier()).toBeNull()
  })

  // CURRENT-READ row 9 (AIQ 5912710392): WAS "the share keeps its number AND reads `Provisional`".
  it('⭐ C46 (served on Paul\'s pricing brief): nonlinear_identity_sign_unproven → NO share, `Not ranked` with the fallback reason, never `Provisional`', () => {
    seed(envelope({ permitted: false, withheld_reason: 'nonlinear_identity_sign_unproven', separation: 'separated' }),
      { permitted: false, withheld_reason: 'leader_claim_withheld', producer_cause: 'nonlinear_identity_sign_unproven' })
    renderCard()
    // No words are minted for this cause, so the fallback is said (never raw producer text).
    expect(leaderWithholdCause('nonlinear_identity_sign_unproven')).toBeNull()
    expectNotRanked(WITHHELD_REASON_FALLBACK)
    expect(provisional()).toBeNull()
    expect(qualifier()).toBeNull()
    expect(document.body.textContent).not.toContain('these shares are not a verdict')
    // Union, never replace: the provisional note's direction-neutral words (5 Oct).
    expect(document.body.textContent).not.toContain('these shares are findings in this model, not a verdict')
  })

  // CURRENT-READ row 9 (AIQ 5912710392): WAS "`Provisional`, not `Goal only`".
  it('separation_unavailable is also a withheld claim → `Not ranked`, neither `Provisional` nor `Goal only`', () => {
    seed(envelope({ permitted: false, withheld_reason: 'separation_unavailable' }),
      { permitted: false, withheld_reason: 'leader_claim_withheld', producer_cause: 'separation_unavailable' })
    renderCard()
    expectNotRanked(leaderWithholdCause('separation_unavailable')!)
    expect(provisional()).toBeNull()
    expect(qualifier()).toBeNull()
  })

  // One row per code (Canonical 5851166756 / DL 5851172106): the F-LIMIT codes outrank
  // C46 on Paul's F9 re-run, the near-tie and unrequested codes are CEE's other
  // "withheld" kinds, the run-identity codes its "not evaluated" kinds, and an
  // unminted code is fail-closed. Keyed on `permitted === false`, so no list can miss one.
  // CURRENT-READ row 9 (AIQ 5912710392): WAS "`Provisional` beside the share". Each code now hides the
  // share and says its OWN minted words where they exist, else the fallback — named per row, not derived.
  it.each([
    ['nonlinear_identity_sign_unproven', 'fallback'],
    ['no_option_meets_limit', 'own words'],
    ['every_option_likely_breaks_limit', 'own words'],
    ['near_tie', 'fallback'],
    ['unrequested_analysis', 'fallback'],
    ['run_identity_unconfirmed', 'fallback'],
    ['a_code_this_ui_has_never_seen', 'fallback'],
  ] as const)('withheld for %s → no share, `Not ranked` with the %s, never `Provisional`, never `Goal only`', (cause, said) => {
    seed(envelope({ permitted: false, withheld_reason: cause }),
      { permitted: false, withheld_reason: 'leader_claim_withheld', producer_cause: cause })
    renderCard()
    const words = leaderWithholdCause(cause)
    if (said === 'own words') {
      expect(words, `${cause} has minted words`).not.toBeNull()
      expectNotRanked(words!)
    } else {
      expect(words, `${cause} has no minted words`).toBeNull()
      expectNotRanked(WITHHELD_REASON_FALLBACK)
    }
    expect(provisional()).toBeNull()
    expect(qualifier()).toBeNull()
  })

  // CURRENT-READ row 9 (AIQ 5912710392) is "for ANY producer_cause", so an out-of-date withhold also
  // hides the share. B1's intent is kept: it is still not told it "could not put an option forward".
  it('AIC #2154 B1: an OUT-OF-DATE run (analysis_out_of_date) is not told it "could not put an option forward" — no "Provisional"', () => {
    seed(envelope({ permitted: false, withheld_reason: 'analysis_out_of_date' }),
      { permitted: false, withheld_reason: 'leader_claim_withheld', producer_cause: 'analysis_out_of_date' })
    renderCard()
    expect(provisional()).toBeNull()
    expectNotRanked(WITHHELD_REASON_FALLBACK)
    expect(notRanked()!.getAttribute('aria-label')).not.toContain('could not put an option forward')
    expect(document.body.textContent).not.toContain('could not put an option forward')
    // Union, never replace: the provisional note's direction-neutral words (5 Oct) are not said either.
    expect(notRanked()!.getAttribute('aria-label')).not.toContain('This run names no option, so these shares')
    expect(document.body.textContent).not.toContain('This run names no option, so these shares')
  })

  // CURRENT-READ row 9 (AIQ 5912710392): WAS "the goal-only case keeps `Goal only`". Neither qualifier
  // can appear now: the withheld run says `Not ranked`, the permitted run shows its share.
  it('CONTRAST — the goal-only case says neither `Goal only` nor `Provisional` (it says `Not ranked`); a permitted leader says neither and is ranked', () => {
    seed(null, WITHHELD_FOR_LIMITS)
    renderCard()
    expect(qualifier()).toBeNull()
    expect(provisional()).toBeNull()
    expect(notRanked()).not.toBeNull()
    cleanup()
    seed(envelope({ permitted: true, separation: 'separated' }))
    renderCard()
    expect(provisional()).toBeNull()
    expect(qualifier()).toBeNull()
    expect(notRanked()).toBeNull()
    expect(readout().textContent).toBe('81% of runs')
  })

  it('CONTRAST — no wire state at all: no qualifier (nothing is inferred)', () => {
    seed(null)
    renderCard()
    expect(readout().textContent).toBe('81% of runs')
    expect(qualifier()).toBeNull()
  })
  // CURRENT-READ row 9 (AIQ 5912710392): WAS "the stamped cause still qualifies the share". The stamp on
  // the RESULT still governs after a reload; it now withholds the share.
  it('RESULT-BOUND — no live envelope (reload / a later turn without analysis_state): the stamped cause still withholds the share', () => {
    seed(null, { permitted: false, withheld_reason: 'leader_claim_withheld', producer_cause: 'constraint_verdict_withheld' })
    renderCard()
    expectNotRanked(EXPLORATORY_REASON_LINE)
  })

  it('CONTRAST — a live withheld envelope but NO stamped cause on the result: nothing (the card reads the result, not the session)', () => {
    seed(envelope({ permitted: false, withheld_reason: 'constraint_verdict_withheld' }))
    renderCard()
    expect(qualifier()).toBeNull()
    // Row 9 reads the same stamp: no stamp on the result, so the share stays and nothing is withheld.
    expect(notRanked()).toBeNull()
    expect(readout().textContent).toBe('81% of runs')
  })
})
