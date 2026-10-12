/**
 * V5AnalysisResultBlock — leader identity-space resolution (ROADMAP 1.222).
 *
 * #2747 re-scope 2 (DL ruling (A)): the pill row whose leader mark this file pinned is gone from the card in C.
 * The rows that pinned it are deleted in place (each leaves a comment); the label-keyed leader row is rewritten as
 * the absence check, and the no-row negatives and the crash-resistance rows stay.
 *
 * DEFECT: `leading_option_id` is an option ID (`opt_mac`); `block.win_probabilities`
 * is keyed by option LABEL (`"Standardise on MacBook Pro"`) on real staging
 * payloads. The component compared the map KEY to `leading_option_id`, so
 * `isLeader` was ALWAYS false and the `data-leader="true"` branch was
 * unreachable in production — an UNDER-claim: no error, no warning, the leader
 * simply never got marked.
 *
 * The fixtures below are taken from a real captured staging turn
 * (proxy/v5/turn, 2026-07-26): `leading_option_id: "opt_mac"` with
 * `win_probabilities` keyed by the three option labels, and
 * `enrichment.option_comparison[]` carrying BOTH `id`/`option_id` and
 * `label`/`option_label`. The pre-existing spec in this directory keys
 * win_probabilities by option_id — a shape the wire does not produce — which is
 * why the whole suite stayed green over a dead branch.
 *
 * The withheld-turn control (leading_option_id: null ⇒ NO leader) is the
 * regression guard for the opposite direction (ROADMAP 1.223, over-claim
 * suppression). It must hold under every keying.
 */

import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { V5AnalysisResultBlock } from '../V5AnalysisResultBlock'
import type { V5AnalysisResultBlock as V5AnalysisResultBlockType } from '../../../canvas/conversation/types'

afterEach(cleanup)

const MAC = 'Standardise on MacBook Pro'
const DELL = 'Standardise on Dell XPS'
const STATUS_QUO = 'Defer and Keep Current Machines (Status Quo)'

/** enrichment.option_comparison[] exactly as the captured wire carries it. */
function optionComparison(): Array<Record<string, unknown>> {
  return [
    {
      id: 'opt_dell',
      option_id: 'opt_dell',
      label: DELL,
      option_label: DELL,
      win_probability: 0.32341666666666663,
    },
    {
      id: 'opt_mac',
      option_id: 'opt_mac',
      label: MAC,
      option_label: MAC,
      win_probability: 0.4276666666666667,
    },
    {
      id: 'opt_status_quo',
      option_id: 'opt_status_quo',
      label: STATUS_QUO,
      option_label: STATUS_QUO,
      win_probability: 0.24891666666666665,
    },
  ]
}

/**
 * `enrichment.robustness.near_tie` — PLoT's own answer to "is there a clear
 * leader?", exactly as the captured V5 staging bundle carries it
 * (`src/v5/__tests__/fixtures/v5-analysis-result.bundle-45c9b625.json`).
 *
 * ADDED 2026-07-27 (ROADMAP 1.267). These fixtures previously carried the
 * identity fields only, which was sufficient while the leader treatment was
 * gated on `leading_option_id` alone. It is now gated on the shared verdict
 * (`deriveDecisionVerdict`), because `leading_option_id` answers WHO leads
 * and not WHETHER anyone does — a near-tie run carries a leading_option_id
 * and still denies a leading option.
 *
 * So a fixture that wants the leader treatment must now depict a run where
 * the producer PERMITS it. That is not a weakening: it is the same
 * producer-permission rule the results panel has applied since ROADMAP 1.223,
 * and these fixtures were previously depicting only half a run.
 */
function permittingNearTie(): Record<string, unknown> {
  return {
    is_tie: false,
    top_option_id: 'opt_mac',
    second_option_id: 'opt_dell',
    gap: 0.104,
    threshold: 0.1,
  }
}

// #2747 re-scope 2: the `decision_brief.options[]` fixture went with the only row that used it, below.

/** Label-keyed win_probabilities — the real staging shape. */
function labelKeyedProbs(): Record<string, number> {
  return {
    [DELL]: 0.32341666666666663,
    [MAC]: 0.4276666666666667,
    [STATUS_QUO]: 0.24891666666666665,
  }
}

function block(overrides: Partial<V5AnalysisResultBlockType> = {}): V5AnalysisResultBlockType {
  return {
    type: 'v5_analysis_result',
    summary: 'MacBook Pro leads on total cost of ownership.',
    leading_option_id: 'opt_mac',
    win_probabilities: labelKeyedProbs(),
    enrichment: {
      option_comparison: optionComparison(),
      robustness: { near_tie: permittingNearTie() },
    },
    ...overrides,
  }
}

describe('V5AnalysisResultBlock — leader identity space (1.222)', () => {
  // #2747 re-scope 2 (U0 rewrite): was "marks the leader when win_probabilities is keyed by LABEL and
  // leading_option_id is an ID". The same leader-named mount (the real staging keying), which used to SHOW the pill
  // row with its leader marked, now pins that C shows no win share (DL ruling (A)).
  it('a leader named (LABEL-keyed shares, ID leader): still no win-share row in C (ruling (A))', () => {
    render(<V5AnalysisResultBlock block={block()} />)
    // Non-vacuity: the card itself rendered, with its summary.
    expect(screen.getByTestId('v5-analysis-result-summary')).toHaveTextContent(
      'MacBook Pro leads on total cost of ownership.',
    )
    expect(screen.queryByTestId('v5-analysis-result-probabilities')).toBeNull()
    expect(screen.getByTestId('v5-analysis-result').textContent ?? '').not.toMatch(/of runs/)
  })

  // #2747 re-scope 2 (DL ruling (A), pre-accepted): row deleted —
  // "hoists the leader to first position even when it is not the highest key by sort order".
  // Its only subject was the chat card's win-share pill row, which C does not show on any Run. Census rows:
  // chat analysis card, with and without a named leader.

  // #2747 re-scope 2 (DL ruling (A), pre-accepted): row deleted —
  // "resolves via decision_brief.options[] when option_comparison is absent".
  // Its only subject was the chat card's win-share pill row, which C does not show on any Run. Census rows:
  // chat analysis card, with and without a named leader.

  // #2747 re-scope 2 (DL ruling (A), pre-accepted): row deleted —
  // "still marks the leader when win_probabilities is keyed by option_id".
  // Its only subject was the chat card's win-share pill row, which C does not show on any Run. Census rows:
  // chat analysis card, with and without a named leader.

  describe('fails closed — must never become an OVER-claim (guards 1.223)', () => {
    // UI-SEM-097: a run that named no leader shows no win-share row at all,
    // so there is nothing left to mark. This is stronger than "no leader pill".
    // #2747 re-scope 2: the three no-row negatives below are kept as written. They still hold, now because C shows no
    // win-share row on any Run (DL ruling (A)), not only on a run that named no leader.
    it('marks NO leader, and ranks nothing, when leading_option_id is null, label-keyed', () => {
      render(<V5AnalysisResultBlock block={block({ leading_option_id: null })} />)
      expect(screen.queryByTestId('v5-analysis-result-probabilities')).toBeNull()
    })

    it('marks NO leader, and ranks nothing, when leading_option_id is null, id-keyed', () => {
      render(
        <V5AnalysisResultBlock
          block={block({
            leading_option_id: null,
            win_probabilities: { opt_dell: 0.32, opt_mac: 0.43, opt_status_quo: 0.25 },
          })}
        />,
      )
      expect(screen.queryByTestId('v5-analysis-result-probabilities')).toBeNull()
    })

    it('marks NO leader, and ranks nothing, when leading_option_id is the empty string', () => {
      render(<V5AnalysisResultBlock block={block({ leading_option_id: '' })} />)
      expect(screen.queryByTestId('v5-analysis-result-probabilities')).toBeNull()
    })

    // #2747 re-scope 2 (DL ruling (A), pre-accepted): row deleted —
    // "marks NO leader when the leader label is shared by two options".
    // Its only subject was the chat card's win-share pill row, which C does not show on any Run. Census rows:
    // chat analysis card, with and without a named leader.

    // #2747 re-scope 2 (DL ruling (A), pre-accepted): row deleted —
    // "marks NO leader when leading_option_id resolves to no option at all".
    // Its only subject was the chat card's win-share pill row, which C does not show on any Run. Census rows:
    // chat analysis card, with and without a named leader.
  })

  describe('does not crash when enrichment members are absent (withheld turns)', () => {
    it('renders with no enrichment at all', () => {
      render(<V5AnalysisResultBlock block={block({ enrichment: undefined })} />)
      // #2747 re-scope 2 (mixed row, DL ruling (A)): the pill assertions are deleted (3 pills, none marked leader: the
      // card shows no win-share row in C). Their "it rendered" control moves to the summary, which still renders.
      expect(screen.getByTestId('v5-analysis-result-summary')).toHaveTextContent(
        'MacBook Pro leads on total cost of ownership.',
      )
    })

    it('renders when decision_brief is present but stripped of options', () => {
      // CEE PR #711 strips decision_brief members on withheld turns.
      render(
        <V5AnalysisResultBlock
          block={block({
            leading_option_id: null,
            enrichment: { decision_brief: { brief_id: 'b1', analysis_summary: 'x' } },
          })}
        />,
      )
      // Withheld (UI-SEM-097): the card renders, with no win-share row.
      expect(screen.getByTestId('v5-analysis-result-summary')).toBeDefined()
      expect(screen.queryByTestId('v5-analysis-result-probabilities')).toBeNull()
    })

    it('renders when option_comparison is a non-array (malformed passthrough)', () => {
      render(
        <V5AnalysisResultBlock
          block={block({ enrichment: { option_comparison: 'unavailable' } })}
        />,
      )
      // #2747 re-scope 2 (mixed row, DL ruling (A)): the pill assertions are deleted (3 pills, none marked leader: the
      // card shows no win-share row in C). Their "it rendered" control moves to the summary, which still renders.
      expect(screen.getByTestId('v5-analysis-result-summary')).toHaveTextContent(
        'MacBook Pro leads on total cost of ownership.',
      )
    })
  })
})

/**
 * CONTROL — NOT a regression pin for this change.
 *
 * Paul's brief listed `resolveUncertaintyInputs` (headline-option resolution)
 * as a fourth dead site. It is NOT: it matches `option_comparison[].id ??
 * .option_id` against `leading_option_id`, which is ID-space on BOTH sides, and
 * the deployed chunk shows the same. These assertions pass before and after the
 * fix; they exist so the refutation is executable rather than asserted, and so a
 * future edit that "helpfully" points that lookup at the label space fails here.
 */
describe('CONTROL: headline-option resolution was already ID↔ID (refutes brief site 3)', () => {
  it('picks the LEADER option outcome, not entries[0], under label-keyed probabilities', () => {
    const withOutcomes = optionComparison().map((e) =>
      e.option_id === 'opt_mac'
        ? { ...e, outcome: { p10: 0.1, p50: 0.25, p90: 0.4 } }
        : { ...e, outcome: { p10: -0.9, p50: 0.0, p90: 0.9 } },
    )
    render(
      <V5AnalysisResultBlock
        block={block({
          enrichment: { option_comparison: withOutcomes, robustness: { level: 'high', near_tie: permittingNearTie() } },
        })}
      />,
    )
    // The near-tie block keeps this a PERMITTED run: the confident tier renders
    // only when the card may name a leader (withheldIsNotConfident.spec.tsx).
    // opt_mac is entries[1]. Its tight interval yields the confident copy;
    // entries[0] (opt_dell) straddles zero and would be downgraded to the
    // "meaningful uncertainty" wording.
    expect(screen.getByTestId('v5-analysis-result-uncertainty-copy')).toHaveTextContent(
      "Under this model's assumptions, the result held in most simulated futures. It is only as sound as the inputs it rests on.",
    )
  })
})
