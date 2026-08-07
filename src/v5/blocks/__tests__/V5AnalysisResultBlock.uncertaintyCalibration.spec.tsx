/**
 * Sci-4B verbal uncertainty calibration — V5AnalysisResultBlock (conversational
 * analysis_result surface) integration.
 *
 * Reads the SAME wire fields as the results-panel headline (DecisionConfidencePanel):
 * `enrichment.robustness.level`/`.label` + the headline option's
 * `outcome.p10`/`outcome.p90` from `enrichment.option_comparison[]` (matched
 * by `leading_option_id`, falling back to the first entry) — via the shared
 * `calibrateUncertaintyCopy` pure mapper. RED per tier + honest-render absence.
 */

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { V5AnalysisResultBlock } from '../V5AnalysisResultBlock'
import type { V5AnalysisResultBlock as V5AnalysisResultBlockType } from '../../../canvas/conversation/types'

function makeBlock(
  overrides: {
    robustnessLevel?: string
    robustnessLabel?: string
    p10?: number | null
    p90?: number | null
  } = {},
): V5AnalysisResultBlockType {
  return {
    type: 'v5_analysis_result',
    summary: 'Hire Two Senior Engineers Locally looks strongest.',
    leading_option_id: 'opt_hire_local',
    win_probabilities: { opt_hire_local: 0.72 },
    enrichment: {
      option_comparison: [
        {
          id: 'opt_hire_local',
          option_id: 'opt_hire_local',
          option_label: 'Hire Two Senior Engineers Locally',
          win_probability: 0.72,
          outcome: {
            p10: overrides.p10 ?? undefined,
            p50: 0.25,
            p90: overrides.p90 ?? undefined,
          },
        },
      ],
      robustness: {
        ...(overrides.robustnessLevel ? { level: overrides.robustnessLevel } : {}),
        ...(overrides.robustnessLabel ? { label: overrides.robustnessLabel } : {}),
      },
    },
  }
}

describe('V5AnalysisResultBlock — Sci-4B verbal uncertainty calibration', () => {
  it('renders "fairly confident" copy for high robustness + tight interval', () => {
    render(<V5AnalysisResultBlock block={makeBlock({ robustnessLevel: 'high', p10: 0.1, p90: 0.4 })} />)
    expect(screen.getByTestId('v5-analysis-result-uncertainty-copy')).toHaveTextContent(
      'This result looks fairly confident.',
    )
  })

  it('renders "meaningful uncertainty" copy for moderate robustness', () => {
    render(<V5AnalysisResultBlock block={makeBlock({ robustnessLevel: 'moderate' })} />)
    expect(screen.getByTestId('v5-analysis-result-uncertainty-copy')).toHaveTextContent(
      "It appears the result holds, though there's meaningful uncertainty in the estimate.",
    )
  })

  it('renders "tentative" copy for fragile robustness label', () => {
    render(<V5AnalysisResultBlock block={makeBlock({ robustnessLabel: 'fragile' })} />)
    expect(screen.getByTestId('v5-analysis-result-uncertainty-copy')).toHaveTextContent(
      'This result is tentative. The uncertainty is substantial.',
    )
  })

  it('downgrades "high" band to moderate framing when the interval straddles zero', () => {
    render(<V5AnalysisResultBlock block={makeBlock({ robustnessLevel: 'high', p10: -0.03, p90: 0.48 })} />)
    expect(screen.getByTestId('v5-analysis-result-uncertainty-copy')).toHaveTextContent(
      "It appears the result holds, though there's meaningful uncertainty in the estimate.",
    )
  })

  it('honest-render: renders nothing when enrichment carries no robustness signal', () => {
    render(<V5AnalysisResultBlock block={makeBlock({})} />)
    expect(screen.queryByTestId('v5-analysis-result-uncertainty-copy')).toBeNull()
  })

  it('honest-render: renders nothing when enrichment is entirely absent', () => {
    const block: V5AnalysisResultBlockType = {
      type: 'v5_analysis_result',
      summary: 'No enrichment on this turn.',
      leading_option_id: null,
      win_probabilities: {},
    }
    render(<V5AnalysisResultBlock block={block} />)
    expect(screen.queryByTestId('v5-analysis-result-uncertainty-copy')).toBeNull()
  })
})
