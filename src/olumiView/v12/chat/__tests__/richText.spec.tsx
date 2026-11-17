/**
 * V12 refinement spec §1 and §6: `**x**` is weight 500 with no asterisks, a bare http(s) address is a safe link, and a long reply folds to its
 * first two blocks behind "Show the whole first answer", and only where core marks the split (Codex 16:48Z): any other reply is drawn whole.
 */
import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { Blocks } from '../../../ViewChat'

type Said = Parameters<typeof Blocks>[0]['parts']
const T = (text: string) => [{ text }] as unknown as Said
// Core's two lines as olumi-core sends them on a first draft's turn (`answer.first_answer`, view/session.ts at wip/v12-first-answer).
const FIRST_ANSWER_LABEL = 'A first answer from your brief and general knowledge, written before the model. Not checked against the model.'
const CHECK_HEADING = "Olumi's check against the model"

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

// CHANGED BY DESIGN (sx-panel, PANEL-SPEC 2, 17 Nov: "a reply with a long body shows its lead ... at rest; the rest sits behind one press"): every
// long reply folds now, not only a first answer with core's split; at rest it shows core's label (if any), its opening paragraph and, after it,
// the first three items of a list. A first answer's check (core's heading and all after it) still always shows (Codex 16 Nov).
describe('a long reply folds its tail; its opening and a first answer\'s check always show', () => {
  const long = T(`${'First paragraph words. '.repeat(8)}\n\n${'Second paragraph words. '.repeat(8)}\n\n${'Third paragraph words. '.repeat(8)}`)
  const para = (n: number) => `Point ${n}. ` + 'This paragraph is long enough to take several lines of the panel at twelve pixels wide. '.repeat(2)
  it('shows the label, the opening paragraph, the toggle, and the check; the whole first answer on press', () => {
    const text = [FIRST_ANSWER_LABEL, para(1), para(2), para(3), CHECK_HEADING, 'The model has no figure yet.'].join('\n\n')
    const { container } = render(<Blocks parts={[{ text }]} at="x" lines={{ label: FIRST_ANSWER_LABEL, heading: CHECK_HEADING }} fold />)
    // CHANGED BY DESIGN: was the label and TWO blocks; now the opening (para 1) and the check's paragraph.
    expect([...container.querySelectorAll('[data-reply-para]')].map((e) => e.textContent?.slice(0, 8))).toEqual(['Point 1.', 'The mode'])
    const toggle = screen.getByTestId('view-reply-fold')
    expect([toggle.textContent, toggle.getAttribute('aria-expanded')]).toEqual(['Show the whole first answer', 'false'])
    fireEvent.click(toggle)
    expect(container.querySelectorAll('[data-reply-para]').length).toBe(4)
    expect(screen.getByTestId('view-reply-fold').getAttribute('aria-expanded')).toBe('true')
  })
  // CHANGED BY DESIGN (was: "never folds a reply without core's split ... drawn whole", Codex 16:48Z): a long method reply and a first answer with
  // no check heading now show their opening and fold the rest behind one press; nothing is cut, and one press draws every word.
  it('a long method reply, or a first answer with no check heading, shows its opening; one press draws it whole', () => {
    const method = render(<Blocks parts={long} at="x" fold />)
    expect(method.container.querySelectorAll('[data-reply-para]').length).toBe(1)
    expect(method.container.querySelector('[data-reply-opening]')?.textContent).toContain('First paragraph words.')
    fireEvent.click(within(method.container).getByTestId('view-reply-fold'))
    expect(method.container.querySelectorAll('[data-reply-para]').length).toBe(3)
    method.unmount()
    const text = [FIRST_ANSWER_LABEL, para(1), para(2), para(3), para(4)].join('\n\n')
    const noCheck = render(<Blocks parts={[{ text }]} at="x" lines={{ label: FIRST_ANSWER_LABEL, heading: null }} fold />)
    expect(noCheck.container.querySelectorAll('[data-reply-para]').length).toBe(1)
    fireEvent.click(within(noCheck.container).getByTestId('view-reply-fold'))
    expect(noCheck.container.querySelectorAll('[data-reply-para]').length).toBe(4)
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
    const text = [FIRST_ANSWER_LABEL, 'Cash runway decides the order.', '- Ask two supporters.\n- Keep the round going.', CHECK_HEADING, 'Your model has no figure for the angel round yet.'].join('\n\n')
    const { container } = render(<Blocks parts={[{ text }]} at="t" lines={{ label: FIRST_ANSWER_LABEL, heading: CHECK_HEADING }} />)
    expect(container.querySelector('[data-reply-label]')?.textContent).toBe(FIRST_ANSWER_LABEL)
    expect(container.querySelector('[data-reply-heading]')?.textContent).toBe(CHECK_HEADING)
    expect(container.querySelectorAll('[data-reply-list] li')).toHaveLength(2)
    expect(container.querySelectorAll('[data-reply-para]')).toHaveLength(2)
  })
  it('styles nothing by its words alone: without core\'s first_answer the same paragraphs are plain prose', async () => {
    const { Blocks } = await import('../../../ViewChat')
    const text = [FIRST_ANSWER_LABEL, 'Cash runway decides the order.', CHECK_HEADING, 'Your model has no figure yet.'].join('\n\n')
    const { container } = render(<Blocks parts={[{ text }]} at="t" />)
    expect([container.querySelector('[data-reply-label]'), container.querySelector('[data-reply-heading]')]).toEqual([null, null])
    expect(container.querySelectorAll('[data-reply-para]')).toHaveLength(4)
  })
  it('reads the lines from the turn: firstAnswerOf takes label and heading, and nothing from an answer without them', async () => {
    const { firstAnswerOf } = await import('../replyLabels')
    expect(firstAnswerOf({ first_answer: { label: 'L', heading: null } })).toEqual({ label: 'L', heading: null })
    expect([firstAnswerOf({}), firstAnswerOf(null), firstAnswerOf({ first_answer: { label: '' } })]).toEqual([null, null, null])
  })
})

describe('a folded first answer never hides Olumi\'s check against the model', () => {
  it('folds the first answer\'s later detail but keeps the heading and the check', async () => {
    const { Blocks } = await import('../../../ViewChat')
    const para = (n: number) => `Point ${n}. ` + 'This paragraph is long enough to take several lines of the panel at twelve pixels wide. '.repeat(2)
    const text = [FIRST_ANSWER_LABEL, para(1), para(2), para(3), para(4), CHECK_HEADING, 'Your model says something different about point three.'].join('\n\n')
    const { container } = render(<Blocks parts={[{ text }]} at="t" lines={{ label: FIRST_ANSWER_LABEL, heading: CHECK_HEADING }} fold />)
    expect(container.querySelector('[data-reply-heading]')?.textContent).toBe(CHECK_HEADING)
    expect(container.textContent).toContain('Your model says something different')
    expect(container.textContent).not.toContain('Point 3.')
    expect(container.querySelector('[data-testid="view-reply-fold"]')?.textContent).toBe('Show the whole first answer')
  })
})

// The reply contract (17 Nov) keeps core's markers: a "## " line must never reach the person raw on ANY reply surface. Blocks has its own row
// (panel.spec); this binds the early answer and the model-less floor, which draw each line through richText (EarlyAnswer.tsx).
describe('a "## " line is a lead-in in the early answer too (Line reviewer F1)', () => {
  it('draws two to six hashes as a quiet heading run, hashes dropped; one hash or seven stays as typed', async () => {
    const { EarlyAnswer } = await import('../../../EarlyAnswer')
    const text = ['## Fees first', 'The fees are fixed for the year.', '', '# One hash stays.', '', '####### Seven stay.'].join('\n')
    const { container } = render(<EarlyAnswer text={text} bare />)
    const leadIns = [...container.querySelectorAll('[data-reply-lead-in]')]
    expect(leadIns.map((e) => e.textContent)).toEqual(['Fees first'])
    expect(leadIns[0]!.className).toContain('font-medium')
    expect(container.textContent).not.toContain('## ')
    expect(container.textContent).toContain('# One hash stays.')
    expect(container.textContent).toContain('####### Seven stay.')
  })
})
