/**
 * V5AnalysisResultBlock — the leader DESIGNATION is entitled by the shared
 * verdict, not by `leading_option_id` (ROADMAP 1.267, follow-up to PR #501).
 *
 * ## The refutation this file records
 *
 * The sweep that scoped this lane offered two acceptable outcomes for this
 * surface: wire it to `deriveDecisionVerdict`, OR prove the existing implicit
 * gate is EQUIVALENT and pin that. The implicit gate was `resolveLeaderKeys`
 * returning a non-empty set, which happens exactly when `leading_option_id`
 * is a non-empty string.
 *
 * IT IS NOT EQUIVALENT, and the difference is a live producer state rather
 * than a hypothetical. On a NEAR-TIE run PLoT sends
 * `robustness.near_tie.is_tie: true` (or a `very_close` band) TOGETHER WITH a
 * `leading_option_id` — CEE nulls that field only when the constraint verdict
 * is WITHHELD, which is a different condition. So `hasLeadingOption` was
 * false while the implicit gate stayed open, and this card hoisted, bordered
 * and `data-leader`-tagged an option the producer had just called too close
 * to call.
 *
 * The first two cases below are the proof: they are the ONLY ones in this
 * suite that the old gate fails, and they fail it in the over-claim
 * direction. Everything else is the over-suppression control.
 *
 * ## What stays on a withheld or tied run
 *
 * Every pill, every label, every probability — the DATA is not withheld, only
 * the CLAIM. The probability-descending tail order also stays: each pill
 * carries its own number, so that order restates a fact already on screen
 * rather than promoting one option above it. What goes is the leader-first
 * hoist, the `data-leader="true"` attribute and the heavier border.
 *
 * ## Scope of the claim (CLAUDE.md trap 3)
 *
 * jsdom proves DOM order, attributes and text. The border weight is asserted
 * as a class, which proves what the component emits, not what a browser
 * paints.
 */
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup, within } from '@testing-library/react'
import { V5AnalysisResultBlock } from '../V5AnalysisResultBlock'
import { buildV5VerdictReportLike } from '../../mapV5AnalysisToReport'
import { deriveDecisionVerdict } from '../../../lib/decisionVerdict'
import type { V5AnalysisResultBlock as V5AnalysisResultBlockType } from '../../../canvas/conversation/types'

afterEach(cleanup)

const MAC = 'Standardise on MacBook Pro'
const DELL = 'Standardise on Dell XPS'
const STATUS_QUO = 'Defer and Keep Current Machines (Status Quo)'

/** Label-keyed win_probabilities — the real staging shape. */
const WIN_PROBABILITIES: Record<string, number> = {
  [MAC]: 0.4276666666666667,
  [DELL]: 0.32341666666666663,
  [STATUS_QUO]: 0.24891666666666665,
}

function optionComparison(): Array<Record<string, unknown>> {
  return [
    { id: 'opt_dell', option_id: 'opt_dell', label: DELL, option_label: DELL, win_probability: 0.32341666666666663 },
    { id: 'opt_mac', option_id: 'opt_mac', label: MAC, option_label: MAC, win_probability: 0.4276666666666667 },
    { id: 'opt_status_quo', option_id: 'opt_status_quo', label: STATUS_QUO, option_label: STATUS_QUO, win_probability: 0.24891666666666665 },
  ]
}

/**
 * `robustness.near_tie` in the shape the captured V5 staging bundle carries
 * (`src/v5/__tests__/fixtures/v5-analysis-result.bundle-45c9b625.json`).
 * `is_tie` is the producer's own answer to "is there a clear leader?".
 */
function nearTie(isTie: boolean): Record<string, unknown> {
  return {
    is_tie: isTie,
    top_option_id: 'opt_mac',
    second_option_id: 'opt_dell',
    gap: isTie ? 0.041 : 0.104,
    threshold: 0.1,
  }
}

/**
 * THE DIVERGENCE FIXTURE PAIR. Both carry a non-null `leading_option_id`, so
 * the OLD implicit gate is open on BOTH. Only `near_tie.is_tie` differs — the
 * producer's own verdict, which is what now decides.
 */
function block(isTie: boolean): V5AnalysisResultBlockType {
  return {
    type: 'v5_analysis_result',
    summary: 'The three options are close on total cost of ownership.',
    leading_option_id: 'opt_mac',
    win_probabilities: WIN_PROBABILITIES,
    enrichment: {
      option_comparison: optionComparison(),
      robustness: { near_tie: nearTie(isTie) },
    },
  }
}

/** The same run with the leader claim WITHHELD (CEE #711 nulls the id). */
function withheldBlock(): V5AnalysisResultBlockType {
  return { ...block(false), leading_option_id: null }
}

const pills = (): HTMLElement[] =>
  within(screen.getByTestId('v5-analysis-result-probabilities')).getAllByRole('listitem')
const leaderPills = (): HTMLElement[] =>
  pills().filter((p) => p.getAttribute('data-leader') === 'true')

// ─────────────────────────────────────────────────────────────────────────────
// ANTI-VACUITY — the pair must differ in the verdict and NOT in the old gate,
// or the two divergence cases below prove nothing.
// ─────────────────────────────────────────────────────────────────────────────

describe('the near-tie pair isolates the verdict from the old implicit gate', () => {
  it('both blocks carry a non-null leading_option_id (old gate open on both)', () => {
    expect(block(false).leading_option_id).toBe('opt_mac')
    expect(block(true).leading_option_id).toBe('opt_mac')
  })

  it('the shared verdict DISAGREES with the old gate on the tied block', () => {
    expect(deriveDecisionVerdict(buildV5VerdictReportLike(block(false))).hasLeadingOption).toBe(true)
    const tied = deriveDecisionVerdict(buildV5VerdictReportLike(block(true)))
    expect(tied.hasLeadingOption).toBe(false)
    expect(tied.separation).toBe('tied')
    expect(tied.source).toBe('producer_near_tie')
  })

  it('the withheld block resolves to no-claim, not to a denial', () => {
    const v = deriveDecisionVerdict(buildV5VerdictReportLike(withheldBlock()))
    // leading_option_id has no bearing on the verdict — near_tie still says
    // "not a tie", so this block's verdict PERMITS. The suppression on a
    // withheld turn comes from resolveLeaderKeys having no id to resolve,
    // which is the correct division of labour: WHETHER vs WHO.
    expect(v.hasLeadingOption).toBe(true)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// THE DIVERGENCE — the two cases the old implicit gate got wrong
// ─────────────────────────────────────────────────────────────────────────────

describe('a producer NEAR-TIE gets no leader treatment (the non-equivalence)', () => {
  it('marks no leader pill', () => {
    render(<V5AnalysisResultBlock block={block(true)} />)
    expect(leaderPills()).toHaveLength(0)
  })

  it('gives no pill the heavier leader border', () => {
    render(<V5AnalysisResultBlock block={block(true)} />)
    for (const pill of pills()) {
      expect(pill.className).toContain('border-option/30')
      expect(pill.className).not.toContain('border-option/50')
    }
  })

  it('DATA PRESERVED: every option and every probability still renders', () => {
    render(<V5AnalysisResultBlock block={block(true)} />)
    const rendered = pills()
    expect(rendered).toHaveLength(3)
    expect(rendered.map((p) => p.textContent)).toEqual([
      expect.stringContaining('43%'),
      expect.stringContaining('32%'),
      expect.stringContaining('25%'),
    ])
    for (const label of [MAC, DELL, STATUS_QUO]) {
      expect(screen.getByTestId('v5-analysis-result-probabilities').textContent ?? '').toContain(label)
    }
  })

  it('DATA PRESERVED: the summary line is untouched', () => {
    render(<V5AnalysisResultBlock block={block(true)} />)
    expect(screen.getByTestId('v5-analysis-result-summary')).toHaveTextContent(
      'The three options are close on total cost of ownership.',
    )
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// THE OVER-SUPPRESSION CONTROL — the permitted twin must be unchanged
// ─────────────────────────────────────────────────────────────────────────────

describe('a producer NOT-A-TIE keeps today behaviour exactly', () => {
  it('marks exactly one leader pill, and it is the producer leader', () => {
    render(<V5AnalysisResultBlock block={block(false)} />)
    const leaders = leaderPills()
    expect(leaders).toHaveLength(1)
    expect(leaders[0]).toHaveTextContent(MAC)
  })

  it('hoists the leader to first position even when another key sorts higher', () => {
    // The leader is given the LOWEST rendered probability, so descending order
    // alone cannot produce a passing result — only the leader clause can.
    render(
      <V5AnalysisResultBlock
        block={{ ...block(false), win_probabilities: { [DELL]: 0.61, [MAC]: 0.22, [STATUS_QUO]: 0.17 } }}
      />,
    )
    const rendered = pills()
    expect(rendered[0]).toHaveTextContent(MAC)
    expect(rendered[0].getAttribute('data-leader')).toBe('true')
    expect(rendered[1]).toHaveTextContent(DELL)
    expect(rendered[2]).toHaveTextContent(STATUS_QUO)
  })

  it('gives the leader the heavier border and the others the lighter one', () => {
    render(<V5AnalysisResultBlock block={block(false)} />)
    expect(leaderPills()[0].className).toContain('border-option/50')
    for (const pill of pills().filter((p) => p.getAttribute('data-leader') === 'false')) {
      expect(pill.className).toContain('border-option/30')
    }
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// THE WITHHELD TURN — already covered by the id gate, pinned here against the
// same fixtures so the two conditions cannot be confused for one another.
// ─────────────────────────────────────────────────────────────────────────────

describe('a WITHHELD turn (leading_option_id null) still marks no leader', () => {
  it('marks no leader pill even though the verdict permits one', () => {
    render(<V5AnalysisResultBlock block={withheldBlock()} />)
    expect(leaderPills()).toHaveLength(0)
  })

  it('DATA PRESERVED: all three pills still render, in probability order', () => {
    render(<V5AnalysisResultBlock block={withheldBlock()} />)
    const rendered = pills()
    expect(rendered).toHaveLength(3)
    expect(rendered[0]).toHaveTextContent(MAC)
    expect(rendered[1]).toHaveTextContent(DELL)
    expect(rendered[2]).toHaveTextContent(STATUS_QUO)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// buildV5VerdictReportLike — the identity-space join the verdict depends on
// ─────────────────────────────────────────────────────────────────────────────

describe('buildV5VerdictReportLike — id-space join', () => {
  it('keys probabilities by option_id even when the block keys them by LABEL', () => {
    const view = buildV5VerdictReportLike(block(false))
    expect(Object.keys(view.option_probabilities ?? {}).sort()).toEqual([
      'opt_dell', 'opt_mac', 'opt_status_quo',
    ])
  })

  it('falls back to decision_brief.options[] when option_comparison is absent', () => {
    // Same fallback chain resolveLeaderKeys uses. When these two disagreed,
    // the block resolved a leader KEY with no verdict to authorise it, and
    // silently withheld a designation the producer had permitted.
    const view = buildV5VerdictReportLike({
      win_probabilities: WIN_PROBABILITIES,
      enrichment: {
        decision_brief: {
          options: [
            { option_id: 'opt_mac', label: MAC, win_probability: 0.43 },
            { option_id: 'opt_dell', label: DELL, win_probability: 0.32 },
          ],
        },
        robustness: { near_tie: nearTie(false) },
      },
    })
    expect(Object.keys(view.option_probabilities ?? {}).sort()).toEqual(['opt_dell', 'opt_mac'])
    expect(deriveDecisionVerdict(view).hasLeadingOption).toBe(true)
  })

  it('fails closed on a block with no enrichment at all', () => {
    // No id↔label source ⇒ the probabilities stay label-keyed and the
    // producer signals (id-space) cannot apply ⇒ no claim, no designation.
    const v = deriveDecisionVerdict(
      buildV5VerdictReportLike({ win_probabilities: WIN_PROBABILITIES, enrichment: undefined }),
    )
    expect(v.hasLeadingOption).toBe(false)
    expect(v.separation).toBe('unknown')
  })
})
