/**
 * AnalysisStateCue — Paul 23 Sep contract feedback point 14.
 *
 * ⚠ THE AUTHORITY IS DRIVEN, NOT STUBBED. The mock sits one level BELOW the
 * cue's own predicate: it replaces `useAnalysisTrust` (the composed verdict)
 * and lets the REAL `useModelChangedSinceRun` — the hook the cards ask before
 * prefixing `Last run ·` — decide. Stubbing `useModelChangedSinceRun` itself
 * would test that the cue reads a boolean, not that it reads the cards' one.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { FreshnessDisplaySemantic } from '../../store/analysisFreshness'

const trust: { semantic: FreshnessDisplaySemantic | undefined } = { semantic: 'changed' }

vi.mock('../../hooks/useAnalysisTrust', () => ({
  useAnalysisTrust: () => ({ semantic: trust.semantic }),
}))

import {
  AnalysisStateCue,
  ANALYSIS_STATE_CUE_TESTID,
  ANALYSIS_STATE_CUE_COPY,
  ANALYSIS_STATE_CUE_LABEL,
} from '../AnalysisStateCue'
import { LAST_RUN_PREFIX, OPTION_RESULT_COPY } from '../../nodes/shared/metricVocabulary'
import { optionResultCaption, runCurrencyOf } from '../../nodes/shared/runCurrency'

beforeEach(() => {
  trust.semantic = 'changed'
})

describe('AnalysisStateCue — Paul 23 Sep point 14', () => {
  it('model KNOWN to have changed since the run → one status line, in Paul’s words', () => {
    render(<AnalysisStateCue />)
    const cue = screen.getByTestId(ANALYSIS_STATE_CUE_TESTID)
    expect(cue).toHaveAttribute('role', 'status')
    expect(cue.textContent).toBe('Model changed · previous findings shown as Last run')
    expect(cue.textContent).toBe(ANALYSIS_STATE_CUE_COPY)
    // The status is findable by role, and its name is the visible sentence.
    expect(screen.getByRole('status')).toBe(cue)
  })

  it.each<[string, FreshnessDisplaySemantic | undefined]>([
    ['current', 'current'],
    ['cannot confirm', 'cannot_confirm'],
    ['no run', 'none'],
    ['never run', 'never_run'],
    ['no verdict yet', undefined],
  ])('%s → renders NOTHING (no past-analysis claim, no currency claim)', (_label, semantic) => {
    trust.semantic = semantic
    render(<AnalysisStateCue />)
    expect(screen.queryByTestId(ANALYSIS_STATE_CUE_TESTID)).toBeNull()
    expect(screen.queryByRole('status')).toBeNull()
    expect(document.body.textContent ?? '').not.toContain('Model changed')
  })

  it('tracks the authority live — the cue leaves when the model becomes current again', () => {
    const { rerender } = render(<AnalysisStateCue />)
    expect(screen.getByTestId(ANALYSIS_STATE_CUE_TESTID)).toBeInTheDocument()
    trust.semantic = 'current'
    rerender(<AnalysisStateCue />)
    expect(screen.queryByTestId(ANALYSIS_STATE_CUE_TESTID)).toBeNull()
  })

  it('shows on EXACTLY the state in which the cards say `Last run` — never more, never less', () => {
    // Identity with the cards, both surfaces: the factor prefix and the option
    // caption. For every semantic, cue present ⇔ option caption is `Last run`.
    const all: Array<FreshnessDisplaySemantic | undefined> = [
      'current', 'changed', 'cannot_confirm', 'none', 'never_run', undefined,
    ]
    let positives = 0
    for (const semantic of all) {
      trust.semantic = semantic
      const { unmount } = render(<AnalysisStateCue />)
      const cueShown = screen.queryByTestId(ANALYSIS_STATE_CUE_TESTID) !== null
      const cardsSayLastRun = optionResultCaption(runCurrencyOf(semantic)) === OPTION_RESULT_COPY.lastRun
      expect(cueShown, `semantic ${String(semantic)}`).toBe(cardsSayLastRun)
      if (cueShown) positives += 1
      unmount()
    }
    // Contrast control: the loop saw the cue at least once, and not every time.
    expect(positives).toBe(1)
  })

  it('names the label the cards actually render, built from their own prefix', () => {
    expect(ANALYSIS_STATE_CUE_LABEL).toBe('Last run')
    expect(LAST_RUN_PREFIX.startsWith(ANALYSIS_STATE_CUE_LABEL)).toBe(true)
    expect(ANALYSIS_STATE_CUE_LABEL).toBe(OPTION_RESULT_COPY.lastRun)
    expect(ANALYSIS_STATE_CUE_COPY).toContain(ANALYSIS_STATE_CUE_LABEL)
  })

  it('copy invents no count and gives no instruction or recommendation', () => {
    expect(ANALYSIS_STATE_CUE_COPY).not.toMatch(/\d/)
    expect(ANALYSIS_STATE_CUE_COPY).not.toMatch(/\b(edits?|since|should|re-?run|recommend|best|warning|stale|out of date)\b/i)
  })

  it('accessible and neutral: decorative icon hidden, readable text token, clickable surface', () => {
    render(<AnalysisStateCue />)
    const cue = screen.getByTestId(ANALYSIS_STATE_CUE_TESTID)
    const svg = cue.querySelector('svg')
    expect(svg, 'the clock icon renders').not.toBeNull()
    expect(svg).toHaveAttribute('aria-hidden', 'true')
    const sentence = cue.querySelector('p')
    expect(sentence?.className).toContain('text-text-body')
    expect(sentence?.className).not.toContain('text-text-light')
    // Neutral: no danger / warning / info channel on the cue.
    expect(cue.outerHTML).not.toMatch(/\b(text|bg|border)-(danger|warning|error|info)\b/)
    // The band and its cells set pointer-events: none; the cue re-enables it.
    expect(cue.className).toContain('pointer-events-auto')
  })

  it('⭐ contract v3.1 CHR-6: the overlay band’s floating-chrome recipe — warm DS shadow-2, not Tailwind’s cool shadow-sm', () => {
    render(<AnalysisStateCue />)
    const cls = screen.getByTestId(ANALYSIS_STATE_CUE_TESTID).className.split(/\s+/)
    for (const c of ['bg-panel', 'border', 'border-panel-border', 'shadow-2', 'rounded-lg']) expect(cls).toContain(c)
    expect(cls).not.toContain('shadow-sm')
  })
})
