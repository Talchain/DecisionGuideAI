/**
 * THE CHAT RESULT CARD DOES NOT RANK A RUN WHOSE LEADER CLAIM WAS WITHHELD.
 *
 * Served-build witness (UI c215fc71, OpenAI path, scenario d712b756, 24 Sep
 * 2026): an explicit Run withheld the leader with `constraint_verdict_withheld`,
 * and the chat "Analysis result" card listed the shares SORTED (72% / 24% / 4%)
 * — a ranked presentation on a run whose leader claim is withheld (RC P0:
 * "suppress misleading leader/rank when leader_claim.permitted=false"). The
 * Reasoning tab on the same run kept the canonical order and said "Goal only".
 *
 * ⭐ BOUND TO THE WRITER, NOT TO A HAND-BUILT STAMP. The displayed result is
 * written the way `applyV5State` writes it (`mapV5AnalysisToReport` → report +
 * `model_card.response_hash`), and the withholding through the store's own
 * `resultsWithholdLeaderClaim(reason, producerCause)` — the one writer of
 * `results.report.producer_leader_permission`.
 *
 * ⭐ COPY BY REFERENCE. The qualifier is asserted against the Reasoning tab's
 * own constants (`ANALYSIS_NEW_COPY.optionFigures.goalOnlyQualifier`,
 * `leaderWithholdCause`), never a retyped string.
 *
 * Contrasts: another cause (canonical order, no qualifier), a permitted
 * displayed run (today's sort, unchanged), an earlier card (canonical, and never
 * the displayed run's qualifier), and nothing displayed (today's behaviour).
 */
import { describe, it, expect, afterEach } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen, cleanup, act, within } from '@testing-library/react'
import { V5AnalysisResultBlock } from '../V5AnalysisResultBlock'
import type { V5AnalysisResultBlock as V5AnalysisResultBlockType } from '../../../canvas/conversation/types'
import { mapV5AnalysisToReport } from '../../mapV5AnalysisToReport'
import { useCanvasStore } from '../../../canvas/store'
import {
  ANALYSIS_NEW_COPY as COPY,
  leaderWithholdCause,
} from '../../../components/results/analysisNew/analysisNewCopy'

afterEach(() => {
  cleanup()
  useCanvasStore.setState({ results: { status: 'idle', progress: 0 } } as never)
})

const KEEP = 'Keep current pricing'
const RAISE = 'Raise Pro to £59'
const ENTERPRISE = 'Add £89 Enterprise tier'

/** The producer's own order — deliberately NOT descending by share. */
const CANONICAL = [KEEP, RAISE, ENTERPRISE]
/** What a share sort produces from the same figures. */
const BY_SHARE = [ENTERPRISE, RAISE, KEEP]

/** The witnessed withheld run: CEE nulls `leading_option_id` on a withheld claim. */
const WITHHELD_RUN: V5AnalysisResultBlockType = {
  type: 'v5_analysis_result',
  summary: 'Ran analysis on your current scenario.',
  leading_option_id: null,
  win_probabilities: { [KEEP]: 0.04, [RAISE]: 0.24, [ENTERPRISE]: 0.72 },
  enrichment: { robustness: { level: 'low' } },
}

/**
 * A run whose block DOES name a leader the verdict separates — what the card
 * hoists today. Used to prove a withheld stamp (or an earlier card) removes the
 * hoist even where the block alone would license it.
 */
const LEADER_RUN: V5AnalysisResultBlockType = {
  type: 'v5_analysis_result',
  summary: 'Enterprise tier comes out ahead in this model.',
  leading_option_id: 'opt_ent',
  win_probabilities: { [KEEP]: 0.04, [RAISE]: 0.24, [ENTERPRISE]: 0.72 },
  enrichment: {
    option_comparison: [
      { id: 'opt_keep', option_id: 'opt_keep', label: KEEP, option_label: KEEP, win_probability: 0.04 },
      { id: 'opt_raise', option_id: 'opt_raise', label: RAISE, option_label: RAISE, win_probability: 0.24 },
      { id: 'opt_ent', option_id: 'opt_ent', label: ENTERPRISE, option_label: ENTERPRISE, win_probability: 0.72 },
    ],
    robustness: {
      near_tie: { is_tie: false, top_option_id: 'opt_ent', second_option_id: 'opt_raise', gap: 0.48, threshold: 0.1 },
    },
  },
}

/** A different result, for the earlier-card cases. */
const OTHER_RUN: V5AnalysisResultBlockType = {
  ...WITHHELD_RUN,
  win_probabilities: { [KEEP]: 0.05, [RAISE]: 0.3, [ENTERPRISE]: 0.65 },
}

/**
 * Display `block` exactly as `applyV5State` does, then (optionally) withhold its
 * leader claim through the store's own writer.
 */
function display(block: V5AnalysisResultBlockType, producerCause?: string | null) {
  const report = mapV5AnalysisToReport({
    type: 'analysis_result',
    summary: block.summary,
    leading_option_id: block.leading_option_id,
    win_probabilities: block.win_probabilities,
    enrichment: block.enrichment,
  } as never)
  useCanvasStore.setState({
    results: { status: 'complete', progress: 100, hash: report.model_card.response_hash, report },
  } as never)
  if (producerCause !== undefined) {
    useCanvasStore.getState().resultsWithholdLeaderClaim('leader_claim_withheld', producerCause)
  }
}

const cards = () => screen.getAllByTestId('v5-analysis-result')
const list = (card: HTMLElement) => within(card).getByTestId('v5-analysis-result-probabilities')
const order = (card: HTMLElement) =>
  within(list(card))
    .getAllByRole('listitem')
    .map((pill) => pill.querySelector('.font-medium')?.textContent ?? '')
const leaders = (card: HTMLElement) =>
  within(list(card))
    .getAllByRole('listitem')
    .filter((pill) => pill.getAttribute('data-leader') === 'true')
const goalOnly = (card: HTMLElement) => within(card).queryByTestId('v5-analysis-result-goal-only')

const GOAL_ONLY_LINE = `${COPY.optionFigures.goalOnlyQualifier} ${leaderWithholdCause('constraint_verdict_withheld')}`

describe('displayed run, leader withheld for `constraint_verdict_withheld`', () => {
  it('the precondition holds: the stamp the card reads is the one the writer wrote', () => {
    display(WITHHELD_RUN, 'constraint_verdict_withheld')
    expect(useCanvasStore.getState().results.report?.producer_leader_permission).toEqual({
      permitted: false,
      withheld_reason: 'leader_claim_withheld',
      producer_cause: 'constraint_verdict_withheld',
    })
    // And the copy the card must carry exists (a null cause would make the
    // qualifier assertion below pass on a truncated line).
    expect(leaderWithholdCause('constraint_verdict_withheld')).toEqual(expect.any(String))
  })

  it('keeps the producer’s order — no sort by share', () => {
    display(WITHHELD_RUN, 'constraint_verdict_withheld')
    render(<V5AnalysisResultBlock block={WITHHELD_RUN} />)
    const [card] = cards()
    expect(card).toHaveAttribute('data-run-currency', 'current')
    expect(order(card)).toEqual(CANONICAL)
    expect(list(card)).toHaveAttribute('data-option-order', 'canonical')
  })

  it('says the shares are goal-only, with the producer’s cause — the Reasoning tab’s own words', () => {
    display(WITHHELD_RUN, 'constraint_verdict_withheld')
    render(<V5AnalysisResultBlock block={WITHHELD_RUN} />)
    const [card] = cards()
    const line = goalOnly(card)
    expect(line).not.toBeNull()
    expect(line!.textContent).toBe(GOAL_ONLY_LINE)
    // Above the shares it qualifies.
    expect(line!.compareDocumentPosition(list(card)) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('no hoist and no leader border even where the block itself names a separated leader', () => {
    display(LEADER_RUN, 'constraint_verdict_withheld')
    render(<V5AnalysisResultBlock block={LEADER_RUN} />)
    const [card] = cards()
    expect(leaders(card)).toHaveLength(0)
    expect(order(card)).toEqual(CANONICAL)
    for (const pill of within(list(card)).getAllByRole('listitem')) {
      expect(pill.className).not.toContain('border-option/50')
    }
  })

  it('LIVE: a withholding that lands after the card mounted re-orders it and adds the line', () => {
    display(WITHHELD_RUN)
    render(<V5AnalysisResultBlock block={WITHHELD_RUN} />)
    const [card] = cards()
    expect(order(card)).toEqual(BY_SHARE)
    expect(goalOnly(card)).toBeNull()
    act(() => {
      useCanvasStore.getState().resultsWithholdLeaderClaim('leader_claim_withheld', 'constraint_verdict_withheld')
    })
    expect(order(card)).toEqual(CANONICAL)
    expect(goalOnly(card)!.textContent).toBe(GOAL_ONLY_LINE)
  })
})

describe('displayed run, leader withheld for any OTHER cause — unranked, and no qualifier', () => {
  it('`separation_unavailable` (a cause the copy CAN name): canonical order, no goal-only line, no cause sentence', () => {
    display(WITHHELD_RUN, 'separation_unavailable')
    render(<V5AnalysisResultBlock block={WITHHELD_RUN} />)
    const [card] = cards()
    expect(order(card)).toEqual(CANONICAL)
    expect(goalOnly(card)).toBeNull()
    // A gate keyed on "the cause is nameable" instead of on the exact token
    // would render this sentence here.
    expect(card.textContent).not.toContain(leaderWithholdCause('separation_unavailable')!)
    expect(card.textContent).not.toContain(COPY.optionFigures.goalOnlyQualifier)
  })

  it('no producer cause at all: canonical order, no qualifier', () => {
    display(WITHHELD_RUN, null)
    expect(useCanvasStore.getState().results.report?.producer_leader_permission).toEqual({
      permitted: false,
      withheld_reason: 'leader_claim_withheld',
    })
    render(<V5AnalysisResultBlock block={WITHHELD_RUN} />)
    const [card] = cards()
    expect(order(card)).toEqual(CANONICAL)
    expect(goalOnly(card)).toBeNull()
  })
})

describe('CONTRAST — displayed run whose leader was NOT withheld: unchanged', () => {
  it('no stamp (the producer permitted, or never spoke): sorted by share, no qualifier', () => {
    display(WITHHELD_RUN)
    render(<V5AnalysisResultBlock block={WITHHELD_RUN} />)
    const [card] = cards()
    expect(card).toHaveAttribute('data-run-currency', 'current')
    expect(order(card)).toEqual(BY_SHARE)
    expect(list(card)).toHaveAttribute('data-option-order', 'by-share')
    expect(goalOnly(card)).toBeNull()
  })

  it('a separated, named leader is still hoisted and marked', () => {
    display(LEADER_RUN)
    render(<V5AnalysisResultBlock block={LEADER_RUN} />)
    const [card] = cards()
    expect(leaders(card).map((p) => p.querySelector('.font-medium')?.textContent)).toEqual([ENTERPRISE])
    expect(order(card)[0]).toBe(ENTERPRISE)
  })
})

describe('an EARLIER card has no per-run permission — it makes no ranking claim and borrows no qualifier', () => {
  it('displayed run permitted: the earlier card still keeps canonical order and hoists nothing', () => {
    display(OTHER_RUN)
    render(<V5AnalysisResultBlock block={LEADER_RUN} />)
    const [card] = cards()
    expect(card).toHaveAttribute('data-run-currency', 'earlier')
    expect(order(card)).toEqual(CANONICAL)
    expect(leaders(card)).toHaveLength(0)
    expect(list(card)).toHaveAttribute('data-option-order', 'canonical')
    expect(goalOnly(card)).toBeNull()
  })

  it('displayed run withheld for limits: the qualifier goes on the DISPLAYED card only', () => {
    display(OTHER_RUN, 'constraint_verdict_withheld')
    render(
      <>
        <V5AnalysisResultBlock block={WITHHELD_RUN} />
        <V5AnalysisResultBlock block={OTHER_RUN} />
      </>,
    )
    const [earlier, current] = cards()
    expect(earlier).toHaveAttribute('data-run-currency', 'earlier')
    expect(current).toHaveAttribute('data-run-currency', 'current')
    expect(goalOnly(earlier)).toBeNull()
    expect(goalOnly(current)!.textContent).toBe(GOAL_ONLY_LINE)
  })
})

describe('nothing displayed — today’s behaviour, kept on purpose (no stamp can be bound to the card)', () => {
  it('sorted by share, no qualifier', () => {
    render(<V5AnalysisResultBlock block={WITHHELD_RUN} />)
    const [card] = cards()
    expect(card).toHaveAttribute('data-run-currency', 'unknown')
    expect(order(card)).toEqual(BY_SHARE)
    expect(goalOnly(card)).toBeNull()
  })
})
