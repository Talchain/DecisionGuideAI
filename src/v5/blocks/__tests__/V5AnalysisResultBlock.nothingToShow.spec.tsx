/**
 * Paul's pre-flight (22 Oct, served 60ee5601 / CEE 7b0af1a9): with every chance withheld and an empty summary, the chat
 * showed a framed "Analysis result" card holding only its heading. The reply above already says why; nothing is framed,
 * and the unframed anchor stays for `scrollAnalysisResultIntoView`.
 */
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { V5AnalysisResultBlock } from '../V5AnalysisResultBlock'
import type { V5AnalysisResultBlock as V5AnalysisResultBlockType } from '../../../canvas/conversation/types'

afterEach(cleanup)
const block = (summary: string) => ({ type: 'analysis_result', summary, leading_option_id: null, computed_against_hash: 'ad68eda0ec688da6' }) as unknown as V5AnalysisResultBlockType

describe('an analysis result with nothing to show', () => {
  it('⭐ an empty summary and nothing else: no framed card and no heading, only the anchor', () => {
    render(<V5AnalysisResultBlock block={block('')} />)
    expect(screen.queryByTestId('v5-analysis-result-heading')).toBeNull()
    expect(screen.getByTestId('v5-analysis-result').getAttribute('data-presentation')).toBe('empty')
  })
  it('CONTRAST: a summary to show keeps the card and its heading', () => {
    render(<V5AnalysisResultBlock block={block('Both options run; neither has a chance shown yet.')} />)
    expect(screen.getByTestId('v5-analysis-result-heading').textContent).toBe('Analysis result')
    expect(screen.getByTestId('v5-analysis-result-summary').textContent).toBe('Both options run; neither has a chance shown yet.')
  })
})
