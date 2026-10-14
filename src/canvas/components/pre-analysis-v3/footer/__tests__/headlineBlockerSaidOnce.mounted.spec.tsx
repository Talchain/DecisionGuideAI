/**
 * THE HEADLINE'S BLOCKER IS SAID ONCE, ON THE MOUNTED FOOTER.
 *
 * Served (marketing post3011, journey steps 7 and 10, `pre-analysis-v3-footer`): the footer's headline was the risk's
 * question, and the same three sentences came again beneath it. The headline IS the readiness record's first blocker
 * (`blockers[0].message`); the gate's list itemises every blocker, that one included. So the line that blocker
 * authored (`analysisBlockedItems`' rule: its exact message) leaves the list.
 *
 * Bound to `PanelFooter`, the surface the deployed flags mount (see `analyseControlHonesty.mounted.spec.tsx`), fed by
 * the real gate (`canRunAnalysis`) from the readiness record the headline reads. The served words are the blocker's
 * `message`; its code, category and repairability are this fixture's (the capture did not record them, and the gate
 * reads only the message).
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { PanelFooter } from '../PanelFooter'
import { useCanvasStore } from '../../../../store'
import { canRunAnalysis } from '../../../../utils/canRunAnalysis'

/** marketing post3011 `journey.json` step 7, `pre_analysis_footer` text, its first paragraph. */
const SERVED =
  'How likely or how large is "Campaign delayed by marketing inexperience" today? The numerical analysis is withheld until this risk has a supported value. You can also ask Olumi to propose a labelled starting assumption for review.'
/** A second producer sentence (`PanelFooter.sentenceList.spec.tsx`'s `REAL[0]`). */
const OTHER = 'Choose the missing effect value for "keep what we have" on "Current CRM Capability Gap".'

const blocker = (message: string) => ({ code: 'fixture_code', category: 'fixture', repairability: 'user', message })

function mountFooter(messages: readonly string[]) {
  const blockers = messages.map(blocker)
  useCanvasStore.setState({ analysisStateV1: { readiness: { status: 'blocked', blockers } } as never })
  const gate = canRunAnalysis({
    graphHealth: null,
    readiness: null,
    analysisReadiness: { status: 'blocked', blockers },
    hasBlockers: false,
    nodeCount: 12,
    isRunning: false,
  } as never)
  expect(gate.allowed).toBe(false)
  render(
    <PanelFooter
      footer={{ dot: 'success', headline: 'Ready', subline: 'resting' }}
      onAnalyse={vi.fn()}
      isAnalysing={false}
      canRun={false}
      blockedReason={gate.reason}
      blockedListing={gate.blockedListing}
    />,
  )
  return gate
}

const timesIn = (text: string | null, line: string) => (text ?? '').split(line).length - 1

afterEach(() => {
  cleanup()
  useCanvasStore.setState({ analysisStateV1: null as never })
})

describe('the mounted footer says the headline blocker once', () => {
  it('RED (served marketing post3011): one blocker → its sentences once, as the headline; the tooltip keeps the reason', () => {
    const gate = mountFooter([SERVED])
    expect(gate.blockedListing?.sentences.map((item) => item.text), 'PRECONDITION: the gate lists that blocker').toEqual([SERVED])
    expect(screen.getByTestId('pre-analysis-v3-footer-headline')).toHaveTextContent(SERVED)
    expect(timesIn(screen.getByTestId('pre-analysis-v3-footer').textContent, SERVED)).toBe(1)
    expect(screen.getByTestId('pre-analysis-v3-analyse')).toHaveAttribute('title', gate.reason)
  })

  it('two blockers → the headline is the first, and beneath it only the second, once each', () => {
    mountFooter([SERVED, OTHER])
    const footer = screen.getByTestId('pre-analysis-v3-footer').textContent
    expect(screen.getByTestId('pre-analysis-v3-footer-headline')).toHaveTextContent(SERVED)
    expect(screen.getByTestId('pre-analysis-v3-footer-subline')).toHaveTextContent(OTHER)
    expect(timesIn(footer, SERVED)).toBe(1)
    expect(timesIn(footer, OTHER)).toBe(1)
  })
})
