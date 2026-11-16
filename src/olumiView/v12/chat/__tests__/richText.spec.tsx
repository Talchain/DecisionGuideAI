/**
 * V12 refinement spec §1 and §6: `**x**` is weight 500 with no asterisks, a bare http(s) address is a safe link, and a long reply folds to its
 * first two blocks behind "Show the whole reply".
 */
import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { Blocks } from '../../../ViewChat'

type Said = Parameters<typeof Blocks>[0]['parts']
const T = (text: string) => [{ text }] as unknown as Said

describe('reply text marks', () => {
  it('draws **x** as weight 500 without asterisks, and a bare address as a safe link without its trailing full stop', () => {
    const { container } = render(<Blocks parts={T('Try **the cheaper route** first, see https://example.com/a?b=1.')} at="chat.0.answer.answer" />)
    const strong = container.querySelector('strong')!
    expect([strong.textContent, strong.className]).toEqual(['the cheaper route', 'font-medium'])
    const a = container.querySelector('a')!
    expect([a.getAttribute('href'), a.getAttribute('target'), a.getAttribute('rel'), a.className]).toEqual(['https://example.com/a?b=1', '_blank', 'noopener noreferrer', expect.stringContaining('text-info')])
    expect(container.textContent).toBe('Try the cheaper route first, see https://example.com/a?b=1.')
  })
  it('leaves other text, a lone asterisk and a non-http scheme as plain words', () => {
    const { container } = render(<Blocks parts={T('2 * 3 and javascript:alert(1) stay words')} at="x" />)
    expect([container.querySelector('a'), container.querySelector('strong'), container.textContent]).toEqual([null, null, '2 * 3 and javascript:alert(1) stay words'])
  })
})

describe('a long reply folds', () => {
  const long = T(`${'First paragraph words. '.repeat(8)}\n\n${'Second paragraph words. '.repeat(8)}\n\n${'Third paragraph words. '.repeat(8)}`)
  it('shows two blocks and the toggle, then the whole reply on press', () => {
    const { container } = render(<Blocks parts={long} at="x" fold />)
    expect(container.querySelectorAll('[data-reply-para]').length).toBe(2)
    const toggle = screen.getByTestId('view-reply-fold')
    expect([toggle.textContent, toggle.getAttribute('aria-expanded')]).toEqual(['Show the whole reply', 'false'])
    fireEvent.click(toggle)
    expect(container.querySelectorAll('[data-reply-para]').length).toBe(3)
    expect(screen.getByTestId('view-reply-fold').getAttribute('aria-expanded')).toBe('true')
  })
  it('never folds a short reply, or a long one when not asked', () => {
    const short = render(<Blocks parts={T('One.\n\nTwo.\n\nThree.')} at="x" fold />)
    expect([short.container.querySelectorAll('[data-reply-para]').length, short.container.querySelector('[data-testid="view-reply-fold"]')]).toEqual([3, null])
    short.unmount()
    const plain = render(<Blocks parts={long} at="x" />)
    expect([plain.container.querySelectorAll('[data-reply-para]').length, plain.container.querySelector('[data-testid="view-reply-fold"]')]).toEqual([3, null])
  })
})

describe("a first draft reply: core's own label and heading stand apart from the prose", () => {
  it('draws the label as a caption, the heading as a block heading, and the list as a list', async () => {
    const { Blocks } = await import('../../../ViewChat')
    const { FIRST_ANSWER_LABEL, CHECK_HEADING } = await import('../replyLabels')
    const text = [FIRST_ANSWER_LABEL, 'Cash runway decides the order.', '- Ask two supporters.\n- Keep the round going.', CHECK_HEADING, 'Your model has no figure for the angel round yet.'].join('\n\n')
    const { container } = render(<Blocks parts={[{ text }]} at="t" />)
    expect(container.querySelector('[data-reply-label]')?.textContent).toBe(FIRST_ANSWER_LABEL)
    expect(container.querySelector('[data-reply-heading]')?.textContent).toBe(CHECK_HEADING)
    expect(container.querySelectorAll('[data-reply-list] li')).toHaveLength(2)
    expect(container.querySelectorAll('[data-reply-para]')).toHaveLength(2)
  })
})
