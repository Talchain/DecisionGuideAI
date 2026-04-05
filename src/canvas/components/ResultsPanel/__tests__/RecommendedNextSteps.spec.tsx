/**
 * RecommendedNextSteps — "Ready to decide" gating tests.
 *
 * Verifies that the "Ready to decide" message only appears when
 * robustness level indicates a stable model (moderate/high).
 */

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { RecommendedNextSteps } from '../RecommendedNextSteps'

// keyInsight is needed to pass the hasContent guard so the component renders
// the full layout (not the empty state). "Ready to decide" only appears in the
// full layout when actions and validationItems are both empty.
const KEY_INSIGHT = 'Option A has a clear advantage in the current model.'

describe('RecommendedNextSteps — Ready to decide gating', () => {
  it('does NOT show "Ready to decide" when robustnessLevel is "very_low"', () => {
    render(
      <RecommendedNextSteps
        actions={[]}
        validationItems={[]}
        keyInsight={KEY_INSIGHT}
        robustnessLevel="very_low"
      />,
    )
    expect(screen.queryByText('Ready to decide')).not.toBeInTheDocument()
  })

  it('does NOT show "Ready to decide" when robustnessLevel is "low"', () => {
    render(
      <RecommendedNextSteps
        actions={[]}
        validationItems={[]}
        keyInsight={KEY_INSIGHT}
        robustnessLevel="low"
      />,
    )
    expect(screen.queryByText('Ready to decide')).not.toBeInTheDocument()
  })

  it('shows "Ready to decide" when robustnessLevel is "moderate"', () => {
    render(
      <RecommendedNextSteps
        actions={[]}
        validationItems={[]}
        keyInsight={KEY_INSIGHT}
        robustnessLevel="moderate"
      />,
    )
    expect(screen.getByText('Ready to decide')).toBeInTheDocument()
  })

  it('shows "Ready to decide" when robustnessLevel is "high"', () => {
    render(
      <RecommendedNextSteps
        actions={[]}
        validationItems={[]}
        keyInsight={KEY_INSIGHT}
        robustnessLevel="high"
      />,
    )
    expect(screen.getByText('Ready to decide')).toBeInTheDocument()
  })

  it('does NOT show "Ready to decide" when robustnessLevel is null', () => {
    render(
      <RecommendedNextSteps
        actions={[]}
        validationItems={[]}
        keyInsight={KEY_INSIGHT}
        robustnessLevel={null}
      />,
    )
    expect(screen.queryByText('Ready to decide')).not.toBeInTheDocument()
  })

  it('does NOT show "Ready to decide" when robustnessLevel is omitted (pre-analysis)', () => {
    render(
      <RecommendedNextSteps
        actions={[]}
        validationItems={[]}
        keyInsight={KEY_INSIGHT}
      />,
    )
    expect(screen.queryByText('Ready to decide')).not.toBeInTheDocument()
  })

  it('does NOT show "Ready to decide" when there are pending actions even with high robustness', () => {
    render(
      <RecommendedNextSteps
        actions={[{ action: 'Validate market size assumptions', type: 'validate' }]}
        validationItems={[]}
        keyInsight={KEY_INSIGHT}
        robustnessLevel="high"
      />,
    )
    expect(screen.queryByText('Ready to decide')).not.toBeInTheDocument()
  })
})
