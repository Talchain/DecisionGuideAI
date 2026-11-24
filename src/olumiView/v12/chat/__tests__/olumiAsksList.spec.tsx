/**
 * W3 (24 Nov) buddy rows for OlumiAsks, mounted alone:
 *  - a folded row carries no display class, so the base [hidden] rule (Tailwind preflight) hides it in a real browser (jsdom applies no CSS,
 *    so the attribute alone proved nothing);
 *  - the chosen question follows its IDENTITY: after an answer, core serves the list without the answered question, and the card is on the next
 *    one, never one further on.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it } from 'vitest'
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { OlumiAsks, resetRemovedQuestions, type AskedQuestion } from '../OlumiAsks'

const ask = (k: string): AskedQuestion => ({ key: 'c:' + k, view: 'model.coaching_questions.' + k, text: `Question ${k}?`, id: null, edit: null, answers: null })
const A = ask('A'), B = ask('B'), C = ask('C')
const mount = (questions: readonly AskedQuestion[], onAnswer = async () => true) =>
  render(<OlumiAsks questions={questions} scope="s_test" held={false} body={(x) => <span>{x.text}</span>} onAnswer={onAnswer} />)
const rows = (c: HTMLElement) => [...c.querySelectorAll<HTMLLIElement>('[data-testid="view-question-list"] > li')]
const chosen = (c: HTMLElement) => rows(c).find((li) => li.getAttribute('aria-current') === 'step')?.querySelector('[data-view]')?.textContent ?? null

afterEach(() => { cleanup(); resetRemovedQuestions() })

describe('W3 OlumiAsks list (buddy rows)', () => {
  it('a folded row has the hidden attribute and NO display class; the shown row and every row when opened are flex', () => {
    const { container: c } = mount([A, B, C])
    const folded = rows(c)
    expect(folded.map((li) => [li.hidden, li.className])).toEqual([[false, 'flex items-start gap-2'], [true, ''], [true, '']])
    fireEvent.click(c.querySelector('[data-testid="view-question-toggle"]')!)
    expect(rows(c).map((li) => [li.hidden, li.className])).toEqual([[false, 'flex items-start gap-2'], [false, 'flex items-start gap-2'], [false, 'flex items-start gap-2']])
  })
  it('after answering A, core serves [B, C] and the card is on B (by identity); CONTRAST: when core still serves A, the card is on B too', async () => {
    for (const after of [[B, C], [A, B, C]]) {
      const { container: c, rerender } = mount([A, B, C])
      fireEvent.click(c.querySelector('[data-testid="view-question-toggle"]')!)
      fireEvent.change(c.querySelector('[data-testid="view-question-answer"]')!, { target: { value: 'An answer' } })
      await act(async () => { fireEvent.click(c.querySelector('[data-testid="view-question-use"]')!) })
      rerender(<OlumiAsks questions={after} scope="s_test" held={false} body={(x) => <span>{x.text}</span>} onAnswer={async () => true} />)
      expect([chosen(c), c.querySelector('[data-testid="view-question-count"]')!.textContent]).toEqual(['Question B?', `${after.length} left to check`])
      cleanup()
    }
  })
  it('a failed send keeps the question chosen and its words (a send failure earns nothing)', async () => {
    const { container: c } = mount([A, B, C], async () => false)
    fireEvent.click(c.querySelector('[data-testid="view-question-toggle"]')!)
    fireEvent.change(c.querySelector('[data-testid="view-question-answer"]')!, { target: { value: 'An answer' } })
    await act(async () => { fireEvent.click(c.querySelector('[data-testid="view-question-use"]')!) })
    expect([chosen(c), (c.querySelector('[data-testid="view-question-answer"]') as HTMLTextAreaElement).value]).toEqual(['Question A?', 'An answer'])
  })
})
