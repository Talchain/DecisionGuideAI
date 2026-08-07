/**
 * V5AnalysisResultBlock — leader identity-space resolution (ROADMAP 1.222).
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
import { render, screen, cleanup, within } from '@testing-library/react'
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

/** enrichment.decision_brief.options[] as the captured wire carries it. */
function decisionBriefOptions(): Array<Record<string, unknown>> {
  return [
    { option_id: 'opt_mac', label: MAC, win_probability: 0.4276666666666667, rank: 1 },
    { option_id: 'opt_dell', label: DELL, win_probability: 0.32341666666666663, rank: 2 },
    { option_id: 'opt_status_quo', label: STATUS_QUO, win_probability: 0.24891666666666665, rank: 3 },
  ]
}

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

function pills(): HTMLElement[] {
  return within(screen.getByTestId('v5-analysis-result-probabilities')).getAllByRole('listitem')
}

function leaderPills(): HTMLElement[] {
  return pills().filter((p) => p.getAttribute('data-leader') === 'true')
}

describe('V5AnalysisResultBlock — leader identity space (1.222)', () => {
  it('marks the leader when win_probabilities is keyed by LABEL and leading_option_id is an ID', () => {
    // RED before the fix: `optionKey === block.leading_option_id` never matched,
    // so this found zero leader pills.
    render(<V5AnalysisResultBlock block={block()} />)

    const leaders = leaderPills()
    expect(leaders).toHaveLength(1)
    expect(leaders[0]).toHaveTextContent(MAC)
  })

  it('hoists the leader to first position even when it is not the highest key by sort order', () => {
    // RED before the fix: the comparator's leader clause never fired, so the
    // list came back in pure descending-probability order. Give the leader a
    // LOWER probability than another option so descending order alone cannot
    // produce a passing result — the leader clause is the only thing that can.
    render(
      <V5AnalysisResultBlock
        block={block({
          win_probabilities: { [DELL]: 0.61, [MAC]: 0.22, [STATUS_QUO]: 0.17 },
        })}
      />,
    )

    const rendered = pills()
    expect(rendered[0]).toHaveTextContent(MAC)
    expect(rendered[0].getAttribute('data-leader')).toBe('true')
    // The remainder stay in descending probability order.
    expect(rendered[1]).toHaveTextContent(DELL)
    expect(rendered[2]).toHaveTextContent(STATUS_QUO)
  })

  it('resolves via decision_brief.options[] when option_comparison is absent', () => {
    render(
      <V5AnalysisResultBlock
        block={block({
          enrichment: {
            decision_brief: { options: decisionBriefOptions() },
            robustness: { near_tie: permittingNearTie() },
          },
        })}
      />,
    )

    const leaders = leaderPills()
    expect(leaders).toHaveLength(1)
    expect(leaders[0]).toHaveTextContent(MAC)
  })

  it('still marks the leader when win_probabilities is keyed by option_id', () => {
    // The other identity space must keep working — the fix is additive, not a swap.
    render(
      <V5AnalysisResultBlock
        block={block({
          win_probabilities: { opt_dell: 0.32, opt_mac: 0.43, opt_status_quo: 0.25 },
        })}
      />,
    )

    const leaders = leaderPills()
    expect(leaders).toHaveLength(1)
    expect(leaders[0]).toHaveTextContent('opt_mac')
  })

  describe('fails closed — must never become an OVER-claim (guards 1.223)', () => {
    it('marks NO leader when leading_option_id is null, label-keyed', () => {
      render(<V5AnalysisResultBlock block={block({ leading_option_id: null })} />)
      expect(pills()).toHaveLength(3)
      expect(leaderPills()).toHaveLength(0)
    })

    it('marks NO leader when leading_option_id is null, id-keyed', () => {
      render(
        <V5AnalysisResultBlock
          block={block({
            leading_option_id: null,
            win_probabilities: { opt_dell: 0.32, opt_mac: 0.43, opt_status_quo: 0.25 },
          })}
        />,
      )
      expect(pills()).toHaveLength(3)
      expect(leaderPills()).toHaveLength(0)
    })

    it('marks NO leader when leading_option_id is the empty string', () => {
      render(<V5AnalysisResultBlock block={block({ leading_option_id: '' })} />)
      expect(leaderPills()).toHaveLength(0)
    })

    it('marks NO leader when the leader label is shared by two options', () => {
      // A label-keyed Record cannot disambiguate two options sharing a label.
      // Marking both pills is false precision; marking neither is an honest miss.
      const shared = 'Standardise on a laptop'
      render(
        <V5AnalysisResultBlock
          block={block({
            win_probabilities: { [shared]: 0.55, [STATUS_QUO]: 0.45 },
            enrichment: {
              // Per-entry win probabilities are supplied here so the shared
              // verdict resolves and PERMITS a leader. Without them only one
              // option would be comparable, the verdict would be 'unknown',
              // and this case would pass for that reason instead of for the
              // duplicate-label guard it exists to prove.
              option_comparison: [
                { id: 'opt_mac', option_id: 'opt_mac', label: shared, option_label: shared, win_probability: 0.55 },
                { id: 'opt_dell', option_id: 'opt_dell', label: shared, option_label: shared, win_probability: 0.3 },
                {
                  id: 'opt_status_quo',
                  option_id: 'opt_status_quo',
                  label: STATUS_QUO,
                  option_label: STATUS_QUO,
                  win_probability: 0.15,
                },
              ],
              robustness: { near_tie: permittingNearTie() },
            },
          })}
        />,
      )
      expect(leaderPills()).toHaveLength(0)
    })

    it('marks NO leader when leading_option_id resolves to no option at all', () => {
      render(<V5AnalysisResultBlock block={block({ leading_option_id: 'opt_ghost' })} />)
      expect(pills()).toHaveLength(3)
      expect(leaderPills()).toHaveLength(0)
    })
  })

  describe('does not crash when enrichment members are absent (withheld turns)', () => {
    it('renders with no enrichment at all', () => {
      render(<V5AnalysisResultBlock block={block({ enrichment: undefined })} />)
      expect(pills()).toHaveLength(3)
      // No id↔label source ⇒ only the id itself can match; keys are labels ⇒ honest miss.
      expect(leaderPills()).toHaveLength(0)
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
      expect(pills()).toHaveLength(3)
      expect(leaderPills()).toHaveLength(0)
    })

    it('renders when option_comparison is a non-array (malformed passthrough)', () => {
      render(
        <V5AnalysisResultBlock
          block={block({ enrichment: { option_comparison: 'unavailable' } })}
        />,
      )
      expect(pills()).toHaveLength(3)
      expect(leaderPills()).toHaveLength(0)
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
          enrichment: { option_comparison: withOutcomes, robustness: { level: 'high' } },
        })}
      />,
    )
    // opt_mac is entries[1]. Its tight interval yields the confident copy;
    // entries[0] (opt_dell) straddles zero and would be downgraded to the
    // "meaningful uncertainty" wording.
    expect(screen.getByTestId('v5-analysis-result-uncertainty-copy')).toHaveTextContent(
      'This result looks fairly confident.',
    )
  })
})
