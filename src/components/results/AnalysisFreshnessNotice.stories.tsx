/**
 * AnalysisFreshnessNotice — the four freshness states + the unset (hidden) case.
 * Prop-driven (the `state` override stands in for the store slice).
 */
import React from 'react'
import { AnalysisFreshnessNotice } from './AnalysisFreshnessNotice'
import type { AnalysisFreshnessState } from '@/canvas/store/analysisFreshness'

export default {
  title: 'Results/AnalysisFreshnessNotice',
  parameters: { layout: 'padded', backgrounds: { default: 'panel' } },
}

function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ width: 380, fontFamily: 'Inter, system-ui, sans-serif' }}>{children}</div>
  )
}

const story = (state: AnalysisFreshnessState | null) => () => (
  <Wrapper>
    <AnalysisFreshnessNotice state={state} />
  </Wrapper>
)

type Story = (() => React.ReactElement) & { storyName?: string }

export const Fresh: Story = story({ freshness: 'fresh' })
Fresh.storyName = '1 · fresh'

export const Stale: Story = story({ freshness: 'stale' })
Stale.storyName = '2 · stale'

export const Unknown: Story = story({ freshness: 'unknown' })
Unknown.storyName = '3 · unknown'

export const None: Story = story({ freshness: 'none' })
None.storyName = '4 · none'

export const Unset: Story = () => (
  <Wrapper>
    {/* Slice unset → renders nothing (placeholder text below is just the story note). */}
    <p style={{ fontSize: 11, color: 'var(--text-light)' }}>
      Slice unset — the notice renders nothing (no verdict to show).
    </p>
    <AnalysisFreshnessNotice state={null} />
  </Wrapper>
)
Unset.storyName = '5 · unset (missing analysis_ready → hidden)'
