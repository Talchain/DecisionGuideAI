/**
 * ⭐ PAUL, 21 OCT 2026: no elapsed clock; two milestones driven by BRIEF_READ and GRAPH_READY. No progress bar,
 * percentage or estimate. The mark stays the 7 Oct loop for the whole wait (Paul 21 Oct, of a version that drew the
 * brief: "Can't you just restore it to the working version?").
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { FirstUseDraftingSheet } from '../FirstUseDraftingSheet'

const READING = { goal: 'reach 500 paying customers by June', options: ['partner with a reseller', 'hire two sales reps'], limits: [] }
const state = (id: string) => screen.getByTestId(`first-use-milestone-${id}`).getAttribute('data-state')

describe('the drafting sheet: two real milestones, no clock', () => {
  it('before BRIEF_READ: reading is active and the model is waiting', () => {
    render(<FirstUseDraftingSheet reading={null} userFields={null} onStop={null} />)
    expect(state('brief')).toBe('active')
    expect(state('model')).toBe('waiting')
    expect(screen.getByTestId('first-use-milestone-brief').textContent).toBe('Reading your brief')
    expect(screen.queryByTestId('first-use-drafting-elapsed')).toBeNull()
    expect(screen.getByTestId('first-use-thinking').textContent).not.toMatch(/\d+:\d\d|%|elapsed/)
  })

  it('⭐ BRIEF_READ ticks "Read your brief"; the mark is still the same loop', () => {
    render(<FirstUseDraftingSheet reading={READING} userFields={null} onStop={null} />)
    expect(state('brief')).toBe('done')
    expect(screen.getByTestId('first-use-milestone-brief').textContent).toBe('Read your brief')
    expect(state('model')).toBe('active')
    // The loop's own nodes, unchanged by the reading.
    expect(screen.getByTestId('first-use-drafting-mark').querySelectorAll('.olumi-dm-node')).toHaveLength(7)
  })

  it('GRAPH_READY ticks "Model ready"; CONTROL: no Stop once the model has landed', () => {
    render(<FirstUseDraftingSheet reading={READING} userFields={null} onStop={() => {}} ready />)
    expect(state('brief')).toBe('done')
    expect(state('model')).toBe('done')
    expect(screen.getByTestId('first-use-drafting-message').textContent).toBe('Your model is ready')
    expect(screen.queryByTestId('first-use-drafting-stop')).toBeNull()
  })
})
