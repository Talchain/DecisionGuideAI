/**
 * ⭐⭐ THREE FALSE STATEMENTS ON THE FIRST SCREEN A VISITOR READS.
 *
 * WITNESSED on deployed `3b2df4ce`: open the saved example "Customer Data
 * Platform Selection", touch nothing, run nothing. The store holds
 * `hasCompletedFirstRun: false` — and this bar is already on screen saying
 * *"Model changed. Results may be out of date."* beside a button labelled
 * *"Re-analyse"*.
 *
 *   • the user changed nothing — they opened a saved example
 *   • there are no results to be out of date
 *   • nothing has been analysed, so nothing can be analysed AGAIN
 *
 * ⭐ THE BAR IS RIGHT TO APPEAR. `useAnalysisTrust` answers "can these results
 * be trusted?" and correctly says no — there is genuinely nothing fresh to
 * read. What it lacked is that ABSENCE and STALENESS arrive under one name, so
 * the bar knew it could not vouch for the results and assumed that meant they
 * had gone stale. One name, two questions.
 *
 * ⚠ Nothing about WHEN the bar shows is changed here, and no gate is weakened:
 * blocked still disables and still carries the gate's sentence, and a run in
 * flight still reads "Analysing…".
 */
import '@testing-library/jest-dom/vitest'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

let hasRun = false
let semantic = 'changed'

vi.mock('../../../store', () => ({
  useCanvasStore: (sel: (s: unknown) => unknown) =>
    sel({ importPendingServerRegistration: false, hasCompletedFirstRun: hasRun }),
}))
vi.mock('../../../hooks/useAnalysisTrust', () => ({
  useAnalysisTrust: () => ({ semantic }),
}))

import { ReanalyseBar } from '../ReanalyseBar'

const at = (run: boolean, extra: Record<string, unknown> = {}) => {
  hasRun = run
  return render(<ReanalyseBar onReanalyse={() => {}} canRun blockedReason={undefined} isAnalysing={false} {...extra} />)
}

beforeEach(() => { semantic = 'changed' })

describe('⭐ a model that has never been analysed', () => {
  it('PRECONDITION: the bar renders at all in this state', () => {
    // Without this the absence assertions below would pass on an unmounted bar.
    at(false)
    expect(screen.getByTestId('reanalyse-bar')).toBeInTheDocument()
  })

  it('⛔ does not claim the model changed', () => {
    at(false)
    expect(screen.getByTestId('reanalyse-bar')).not.toHaveTextContent(/model changed/i)
  })

  it('⛔ does not claim results may be out of date — there are none', () => {
    at(false)
    expect(screen.getByTestId('reanalyse-bar')).not.toHaveTextContent(/out of date/i)
  })

  it('⛔ the button does not offer to analyse AGAIN', () => {
    at(false)
    expect(screen.getByTestId('reanalyse-button')).not.toHaveTextContent(/re-analyse/i)
  })

  it('⭐ says what is actually true, and offers the action', () => {
    at(false)
    expect(screen.getByTestId('reanalyse-bar')).toHaveTextContent(/hasn't been analysed yet/i)
    expect(screen.getByTestId('reanalyse-button')).toHaveTextContent('Analyse')
    expect(screen.getByTestId('reanalyse-bar')).toHaveAttribute('data-reason', 'never-run')
  })
})

describe('⛔ THE TWIN — a model that HAS run is untouched', () => {
  it('still says the model changed and offers Re-analyse', () => {
    at(true)
    expect(screen.getByTestId('reanalyse-bar')).toHaveTextContent(/model changed/i)
    expect(screen.getByTestId('reanalyse-bar')).toHaveTextContent(/out of date/i)
    expect(screen.getByTestId('reanalyse-button')).toHaveTextContent('Re-analyse')
    expect(screen.getByTestId('reanalyse-bar')).toHaveAttribute('data-reason', 'model-changed')
  })
})

describe('⛔ nothing else is weakened', () => {
  it('a run in flight still reads Analysing…, in BOTH states', () => {
    const a = at(false, { isAnalysing: true })
    expect(screen.getByTestId('reanalyse-button')).toHaveTextContent('Analysing…')
    a.unmount()
    at(true, { isAnalysing: true })
    expect(screen.getByTestId('reanalyse-button')).toHaveTextContent('Analysing…')
  })

  it('a blocked gate still disables the control on a never-run model', () => {
    at(false, { canRun: false, blockedReason: 'needs a goal' })
    expect(screen.getByTestId('reanalyse-button')).toBeDisabled()
  })
})
