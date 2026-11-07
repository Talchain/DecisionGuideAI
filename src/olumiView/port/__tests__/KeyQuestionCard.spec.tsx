/**
 * The ported key-question card draws core's first prompt (`model.sharpen[0]`): its lead and emphasis as the question and its rationale as the
 * grounding line, verbatim; no strength and no "general guidance" line (core holds neither); nothing when core sends no prompt.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { KeyQuestionCard } from '../KeyQuestionCard'
import { expectAllBound, viewOf } from './viewAt'

afterEach(cleanup)
const pricing = viewOf('golden/pricing')

describe('the ported key-question card', () => {
  it('catch: core\'s first prompt, lead + emphasis + rationale at their paths; the second prompt is not drawn', () => {
    const m = pricing.model!
    expect(m.sharpen.length).toBeGreaterThan(1)
    const c = render(<KeyQuestionCard model={m} />).container
    expect(c.querySelector('[data-testid="port-key-question"]')!.getAttribute('data-sharpen')).toBe(m.sharpen[0]!.id)
    expect(c.querySelector('[data-view="sharpen.0.lead"]')!.textContent).toBe(m.sharpen[0]!.lead)
    expect(c.querySelector('[data-view="sharpen.0.emphasis"]')!.textContent).toBe(m.sharpen[0]!.emphasis)
    expect(c.querySelector('[data-testid="port-key-question-grounding"]')!.textContent).toBe(m.sharpen[0]!.rationale)
    expect(c.textContent).not.toContain(m.sharpen[1]!.lead)
    expect(c.textContent).not.toMatch(/evidence$|General guidance|Grounded in/)
    expect(expectAllBound(pricing, c, expect)).toBe(3)
  })

  it('negative: no prompt from core, no card', () => {
    const m = structuredClone(pricing.model!)
    m.sharpen = []
    expect(render(<KeyQuestionCard model={m} />).container.innerHTML).toBe('')
  })
})
