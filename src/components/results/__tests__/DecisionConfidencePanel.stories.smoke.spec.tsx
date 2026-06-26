/**
 * DecisionConfidencePanel.stories — smoke + freshness-state coverage.
 *
 * Renders every story from the live-hero story file so the stories can't rot,
 * and locks the component-integration freshness states the story drives through
 * the real canvas store (DecisionConfidencePanel → HeroQualifier reads it,
 * AnalysisFreshnessNotice renders above): fresh / changed-stale / cannot-confirm.
 * Trust logic is untouched — these assert display output only.
 */
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import * as stories from '../DecisionConfidencePanel.stories'

afterEach(() => cleanup())

type StoryFn = () => JSX.Element
const storyEntries = Object.entries(stories).filter(
  ([name, val]) => name !== 'default' && typeof val === 'function',
) as Array<[string, StoryFn]>

describe('DecisionConfidencePanel stories', () => {
  it('exposes the expected live-hero stories', () => {
    const names = storyEntries.map(([n]) => n)
    expect(names).toEqual(
      expect.arrayContaining([
        'Fresh',
        'ChangedStale',
        'CannotConfirm',
        'RobustnessUnknown',
        'CloseCall',
        'Rich',
        'MinimalDegraded',
        'NarrowPanel',
      ]),
    )
  })

  it.each(storyEntries)('story %s renders the hero without crashing', (_name, Story) => {
    render(<Story />)
    expect(screen.getByTestId('decision-confidence-panel')).toBeInTheDocument()
  })

  it('Fresh: shows the current-model freshness notice', () => {
    render(<stories.Fresh />)
    expect(screen.getByTestId('analysis-freshness-notice')).toHaveTextContent(
      /reflects the current model/i,
    )
  })

  it('ChangedStale: shows the model-changed freshness notice', () => {
    render(<stories.ChangedStale />)
    expect(screen.getByTestId('analysis-freshness-notice')).toHaveTextContent(/model changed/i)
  })

  it('CannotConfirm: shows the cannot-confirm freshness notice (never fabricates stale)', () => {
    render(<stories.CannotConfirm />)
    const notice = screen.getByTestId('analysis-freshness-notice')
    expect(notice).toHaveTextContent(/cannot confirm/i)
    expect(notice).not.toHaveTextContent(/model changed/i)
  })

  it('RobustnessUnknown: the robustness check renders the neutral "Robustness unknown" glyph', () => {
    render(<stories.RobustnessUnknown />)
    expect(screen.getByTestId('checks-robust')).toHaveTextContent('Robustness unknown')
  })
})
