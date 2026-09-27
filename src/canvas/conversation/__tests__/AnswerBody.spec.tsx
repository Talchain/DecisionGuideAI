/**
 * F1 — AnswerBody structured render (headline + ≤3 bullets + Show-more detail).
 *
 * Verifies:
 *  - headline + bullets render; detail hidden behind a collapsed Show-more
 *  - Show-more toggles the detail open/closed
 *  - UI-SEM-090: bullets are clamped to at most 3 (a 5-bullet payload → 3)
 *  - no detail → no Show-more toggle
 *  - CEE markup (**bold**) is sanitised via safeRichText (no raw script exec)
 */
import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { AnswerBody } from '../AnswerBody'
import type { AnswerShape } from '../answerShape'

function make(overrides: Partial<AnswerShape> = {}): AnswerShape {
  return { headline: 'Option B is strongest', bullets: ['a', 'b'], detail: 'the long tail', ...overrides }
}

describe('AnswerBody', () => {
  it('renders the headline and bullets; detail is collapsed by default', () => {
    render(<AnswerBody answer={make()} />)
    expect(screen.getByTestId('answer-headline').textContent).toContain('Option B is strongest')
    const bullets = screen.getByTestId('answer-bullets').querySelectorAll('li')
    expect(bullets).toHaveLength(2)
    // Show-more present, detail not yet rendered
    expect(screen.getByTestId('answer-show-more').getAttribute('aria-expanded')).toBe('false')
    expect(screen.queryByTestId('answer-detail')).toBeNull()
  })

  it('reveals and re-hides the detail on Show-more toggle', () => {
    render(<AnswerBody answer={make({ detail: 'Across 10,000 runs...' })} />)
    const toggle = screen.getByTestId('answer-show-more')
    fireEvent.click(toggle)
    expect(toggle.getAttribute('aria-expanded')).toBe('true')
    expect(screen.getByTestId('answer-detail').textContent).toContain('Across 10,000 runs...')
    fireEvent.click(toggle)
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    expect(screen.queryByTestId('answer-detail')).toBeNull()
  })

  it('UI-SEM-090: clamps bullets to at most 3', () => {
    render(<AnswerBody answer={make({ bullets: ['1', '2', '3', '4', '5'] })} />)
    const bullets = screen.getByTestId('answer-bullets').querySelectorAll('li')
    expect(bullets).toHaveLength(3)
    expect(bullets[0].textContent).toContain('1')
    expect(bullets[2].textContent).toContain('3')
    // 4th/5th are dropped, not rendered anywhere
    expect(screen.getByTestId('answer-body').textContent).not.toContain('4')
    expect(screen.getByTestId('answer-body').textContent).not.toContain('5')
  })

  it('renders no Show-more toggle when there is no detail (defensive: empty detail)', () => {
    render(<AnswerBody answer={make({ detail: '' })} />)
    expect(screen.queryByTestId('answer-show-more')).toBeNull()
    expect(screen.queryByTestId('answer-detail')).toBeNull()
    // headline + bullets still render
    expect(screen.getByTestId('answer-headline')).toBeTruthy()
    expect(screen.getByTestId('answer-bullets')).toBeTruthy()
  })

  it('renders no bullets list when bullets is empty (headline + detail only)', () => {
    render(<AnswerBody answer={make({ bullets: [], detail: 'd' })} />)
    expect(screen.queryByTestId('answer-bullets')).toBeNull()
    expect(screen.getByTestId('answer-show-more')).toBeTruthy()
  })

  it('sanitises CEE markup — **bold** becomes <strong>, a literal <script> never executes', () => {
    render(
      <AnswerBody
        answer={make({ headline: '**Strong** lead', bullets: ['<script>alert(1)</script> item'], detail: 'd' })}
      />,
    )
    const headline = screen.getByTestId('answer-headline')
    expect(headline.querySelector('strong')?.textContent).toBe('Strong')
    const bullets = screen.getByTestId('answer-bullets')
    expect(bullets.querySelector('script')).toBeNull()
    expect(bullets.innerHTML).toContain('&lt;script&gt;')
  })

  // Paul's test, 27 Sep (UI e8ba18e6): an options reply split its list around the toggle — three bullets, then
  // "Show less", then the rest ("None has been added… · £59 with an annual-plan discount… · Segmented pricing…").
  // Expanded, the answer reads straight on and the toggle closes it from the end.
  it('expanded, the detail follows the bullets directly and "Show less" comes after it', () => {
    const answer: AnswerShape = {
      headline: 'Five options are worth considering.',
      bullets: ['£59 for new Pro customers only.', 'Keep Pro at £49; sell AI as a paid add-on.'],
      detail: 'None has been added. I can add any you choose as separate options.',
    }
    render(<AnswerBody answer={answer} />)
    const toggle = screen.getByTestId('answer-show-more')
    toggle.focus()
    fireEvent.click(toggle)
    const detail = screen.getByTestId('answer-detail')
    const bullets = screen.getByTestId('answer-bullets')
    const after = screen.getByTestId('answer-show-more')
    expect(bullets.compareDocumentPosition(detail) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(detail.compareDocumentPosition(after) & Node.DOCUMENT_POSITION_FOLLOWING, 'Show less closes it from the end').toBeTruthy()
    expect(after.textContent).toContain('Show less')
    // The SAME button moved nothing but its label: a keyboard user keeps their place.
    expect(after).toBe(toggle)
    expect(document.activeElement).toBe(toggle)
  })

  it('CONTRAST: collapsed, the toggle sits under the bullets and no detail is rendered', () => {
    render(<AnswerBody answer={{ headline: 'H.', bullets: ['One.'], detail: 'More.' }} />)
    expect(screen.queryByTestId('answer-detail')).toBeNull()
    const bullets = screen.getByTestId('answer-bullets')
    expect(bullets.compareDocumentPosition(screen.getByTestId('answer-show-more')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })
})
