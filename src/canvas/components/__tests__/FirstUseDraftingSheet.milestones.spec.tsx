/**
 * ⭐ PAUL, 21 OCT 2026: no elapsed clock; two milestones driven by BRIEF_READ and GRAPH_READY; and the mark draws the
 * user's own goal and options once BRIEF_READ arrives. No progress bar, percentage or estimate.
 */
import { describe, it, expect } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { FirstUseDraftingSheet } from '../FirstUseDraftingSheet'

const READING = { goal: 'reach 500 paying customers by June', options: ['partner with a reseller', 'hire two sales reps'], limits: [] }
const state = (id: string) => screen.getByTestId(`first-use-milestone-${id}`).getAttribute('data-state')

describe('the drafting sheet: two real milestones, no clock', () => {
  it('before BRIEF_READ: reading is active, the model is waiting, and the mark is the generic loop', () => {
    render(<FirstUseDraftingSheet reading={null} userFields={null} onStop={null} />)
    expect(state('brief')).toBe('active')
    expect(state('model')).toBe('waiting')
    expect(screen.getByTestId('first-use-milestone-brief').textContent).toBe('Reading your brief')
    expect(screen.getByTestId('first-use-drafting-mark').getAttribute('data-mark')).toBeNull()
    expect(screen.queryByTestId('first-use-drafting-elapsed')).toBeNull()
    expect(screen.getByTestId('first-use-thinking').textContent).not.toMatch(/\d+:\d\d|%|elapsed/)
  })

  it('⭐ BRIEF_READ ticks "Read your brief" and the mark draws the user\'s numbered options and goal', () => {
    render(<FirstUseDraftingSheet reading={READING} userFields={null} onStop={null} />)
    expect(state('brief')).toBe('done')
    expect(screen.getByTestId('first-use-milestone-brief').textContent).toBe('Read your brief')
    expect(state('model')).toBe('active')
    const mark = screen.getByTestId('first-use-drafting-mark')
    expect(mark.getAttribute('data-mark')).toBe('brief')
    const options = within(mark as unknown as HTMLElement).getAllByTestId('drafting-mark-option')
    expect(options.map((o) => o.querySelector('title')?.textContent)).toEqual(READING.options)
    expect(options.map((o) => o.querySelector('text')?.textContent)).toEqual(['1', '2'])
    expect(within(mark as unknown as HTMLElement).getByTestId('drafting-mark-goal').querySelector('title')?.textContent).toBe(READING.goal)
    // The factors are unknown until GRAPH_READY: dashed placeholders, never filled.
    for (const f of within(mark as unknown as HTMLElement).getAllByTestId('drafting-mark-factor')) {
      expect(f.getAttribute('fill')).toBe('none')
    }
  })

  it('GRAPH_READY ticks "Model ready" and fills the factors; CONTROL: no Stop once the model has landed', () => {
    render(<FirstUseDraftingSheet reading={READING} userFields={null} onStop={() => {}} ready />)
    expect(state('brief')).toBe('done')
    expect(state('model')).toBe('done')
    expect(screen.getByTestId('first-use-drafting-message').textContent).toBe('Your model is ready')
    for (const f of screen.getAllByTestId('drafting-mark-factor')) expect(f.getAttribute('fill')).toBe('var(--factor)')
    expect(screen.queryByTestId('first-use-drafting-stop')).toBeNull()
  })

  it('a brief with no goal draws a dashed goal; the user\'s own Options field is never numbered', () => {
    const fields = { context: '', goal: '', options: 'one thing; another', considerations: '' }
    render(<FirstUseDraftingSheet reading={{ goal: null, options: ['one thing', 'another'], limits: [] }} userFields={fields} onStop={null} />)
    const goal = screen.getByTestId('drafting-mark-goal')
    expect(goal.querySelector('title')).toBeNull()
    expect(goal.querySelector('polygon')?.getAttribute('fill')).toBe('none')
    expect(screen.getAllByTestId('drafting-mark-option').map((o) => o.querySelector('text'))).toEqual([null, null])
  })
})
