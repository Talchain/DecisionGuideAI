/**
 * WHEN THE FOOTER ROW RUNS OUT OF WIDTH, THE CONTROLS GIVE WAY — NOT THE SENTENCE.
 *
 * The row lays out a status dot, the readiness line, and one or two buttons.
 * The buttons are `flex-none` and the line was `flex-1` — which is
 * `flex-basis: 0%`, so the line claims NO width of its own and absorbs one
 * hundred per cent of any squeeze. In a narrow panel showing both buttons the
 * readiness sentence is the only thing that can shrink, and it shrinks until
 * the headline breaks mid-phrase while ~250px of button sits beside it,
 * untouched. The sentence is the part carrying the meaning.
 *
 * ⚠ WHAT THIS FILE CAN AND CANNOT PROVE. jsdom does not lay out: it cannot
 * measure a single pixel, and no assertion here is evidence about the rendered
 * result (trap 3 — presence is not layout). What it pins is the STRUCTURE the
 * layout depends on, in three parts, each of which was false before this fix:
 *   1. the buttons are ONE GROUP, so they wrap as a unit and cannot be split
 *      across lines with the sentence stranded between them;
 *   2. the row is allowed to WRAP, so there is a second line for that group to
 *      go to instead of the sentence being crushed on the first;
 *   3. the sentence declares a NON-ZERO BASIS, so it claims a floor width
 *      before anything shrinks it.
 * A browser is the only witness for the pixels, and this file does not claim to
 * be one.
 *
 * ⚠ PRE-EXISTING, NOT A REGRESSION. The same crush is present in the 2 Sep
 * reference capture. Nothing in the open PR set touches this file (40 open PRs
 * swept, contrast control fired on 29 that touch `src/`).
 */
import { describe, it, expect } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import { PanelFooter } from '../PanelFooter'

/**
 * The failed-readiness-check state — the ONLY state that renders two buttons,
 * and therefore the only state in which the crush is at its worst. Pinned as a
 * fixture here so the precondition below can prove the two-button row is really
 * what is under test, rather than the test passing on a one-button row where
 * "the buttons share a parent" is true of any single child.
 */
const FAILED_CHECK = {
  message: 'the readiness service could not be reached',
  verdictRetained: false,
  stale: false,
  verdictAtMs: null,
  retry: () => {},
}

const renderFooter = (withCheck: boolean) =>
  render(
    <PanelFooter
      footer={{ dot: 'warning', headline: 'Ready', subline: 'resting' }}
      onAnalyse={() => {}}
      isAnalysing={false}
      canRun
      readinessCheck={withCheck ? FAILED_CHECK : null}
    />,
  )

/** The row's flexible text column — addressed through the headline it owns. */
const sentenceColumn = () => {
  const headline = screen.getByTestId('pre-analysis-v3-footer-headline')
  const column = headline.parentElement
  if (!column) throw new Error('the footer headline has no parent column')
  return column
}

describe('PanelFooter — the controls give way, not the sentence', () => {
  it('PRECONDITION: the failed-check fixture really does render TWO buttons', () => {
    renderFooter(true)
    expect(screen.getByTestId('pre-analysis-v3-readiness-retry')).toBeInTheDocument()
    expect(screen.getByTestId('pre-analysis-v3-analyse')).toBeInTheDocument()
  })

  it('PRECONDITION: without a failed check there is exactly ONE button', () => {
    renderFooter(false)
    expect(screen.queryByTestId('pre-analysis-v3-readiness-retry')).toBeNull()
    expect(screen.getByTestId('pre-analysis-v3-analyse')).toBeInTheDocument()
  })

  // ⚠ THIS ONE PASSES AT PRISTINE AND IS NOT EVIDENCE ON ITS OWN. Before the fix
  // both buttons are direct children of the row, so they trivially "share a
  // parent". It is the PAIR — this plus "the group is NOT the footer row" — that
  // discriminates; kept because together they say the buttons are siblings AND
  // that their shared parent is a real group.
  it('BOTH BUTTONS SHARE ONE GROUP, so they wrap together instead of splitting', () => {
    renderFooter(true)
    const retry = screen.getByTestId('pre-analysis-v3-readiness-retry')
    const analyse = screen.getByTestId('pre-analysis-v3-analyse')
    expect(retry.parentElement).not.toBeNull()
    expect(retry.parentElement).toBe(analyse.parentElement)
  })

  it('the group is NOT the footer row itself — it is a child of it', () => {
    renderFooter(true)
    const row = screen.getByTestId('pre-analysis-v3-footer')
    const group = screen.getByTestId('pre-analysis-v3-analyse').parentElement
    expect(group).not.toBe(row)
    expect(group?.parentElement).toBe(row)
  })

  it('THE ONE-BUTTON TWIN keeps the group, so grouping is not conditional on two', () => {
    renderFooter(false)
    const row = screen.getByTestId('pre-analysis-v3-footer')
    const group = screen.getByTestId('pre-analysis-v3-analyse').parentElement
    expect(group).not.toBe(row)
    expect(group?.parentElement).toBe(row)
  })

  it('THE ROW MAY WRAP, so the group has a second line to move to', () => {
    renderFooter(true)
    const row = screen.getByTestId('pre-analysis-v3-footer')
    expect(row.className.split(/\s+/)).toContain('flex-wrap')
  })

  it('THE SENTENCE CLAIMS A NON-ZERO BASIS — it may grow, and never starts at zero', () => {
    renderFooter(true)
    const classes = sentenceColumn().className.split(/\s+/)
    // `flex-1` is `flex: 1 1 0%`: a basis of ZERO, which is exactly the defect —
    // the column claims no width of its own and is squeezed to its `min-w-0`.
    expect(classes).not.toContain('flex-1')
    expect(classes).toContain('grow')
    expect(classes.some(c => /^basis-(?!0$)[^\s]+$/.test(c))).toBe(true)
  })

  it('the sentence column may still shrink below its content width', () => {
    renderFooter(true)
    // Without `min-w-0` a flex child refuses to shrink past its longest word,
    // which would push the group off the row entirely rather than wrapping it.
    expect(sentenceColumn().className.split(/\s+/)).toContain('min-w-0')
  })
})
