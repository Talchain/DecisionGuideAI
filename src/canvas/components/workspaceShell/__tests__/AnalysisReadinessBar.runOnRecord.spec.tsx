/**
 * The shell's run control names a Run on record exactly as the Analysis footer does (`selectRunOnRecord`; P0 Shared
 * Data builder #72 5890601642): "Re-run analysis" once the scenario has been Run, "Analyse first pass" before.
 */
import { describe, it, expect } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import { AnalysisReadinessBar } from '../AnalysisReadinessBar'
import { FOOTER_COPY } from '../../pre-analysis-v3/constants'

const bar = (runOnRecord?: boolean) =>
  render(
    <AnalysisReadinessBar
      preRunWithModel
      canRun
      isAnalysing={false}
      nothingHasAnswered={false}
      onAnalyse={() => {}}
      {...(runOnRecord === undefined ? {} : { runOnRecord })}
    />,
  )

describe('AnalysisReadinessBar — the run control after a Run', () => {
  it('a Run on record → "Re-run analysis", never a first pass', () => {
    bar(true)
    const b = screen.getByTestId('analysis-readiness-bar-analyse')
    expect(b).toHaveTextContent(FOOTER_COPY.reanalyse)
    expect(b).not.toHaveTextContent(/first pass/i)
  })
  it('CONTROL: none on record (or the flag not passed) → "Analyse first pass"', () => {
    bar(false)
    expect(screen.getByTestId('analysis-readiness-bar-analyse')).toHaveTextContent(FOOTER_COPY.analyse)
  })
  it('CONTROL: a run in flight still reads "Analysing…"', () => {
    render(<AnalysisReadinessBar preRunWithModel canRun={false} isAnalysing nothingHasAnswered={false} onAnalyse={() => {}} runOnRecord />)
    expect(screen.getByTestId('analysis-readiness-bar-analyse')).toHaveTextContent(FOOTER_COPY.analysing)
  })
})
