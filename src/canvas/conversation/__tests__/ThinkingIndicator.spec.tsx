import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen } from '@testing-library/react'
import { boardKindsOf } from '../../../olumiView/boardKindsOf'
import type { View } from '../../../olumiView/client'
import fixture from '../../../olumiView/fixtures/j1/bookshop-v1-turn-failed.core-172e23ae.view3.json'
import { ThinkingIndicator } from '../zones/ThinkingIndicator'

const board = fixture as unknown as View
const mark = () => screen.getByTestId('thinking-indicator')
const advance = (ms: number) => act(() => { vi.advanceTimersByTime(ms) })
const prefersReducedMotion = (matches: boolean) => vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({
  matches,
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
}))

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('ThinkingIndicator', () => {
  it('steps one 14 px shape through the distinct kinds on a fixture board, in board kind order', () => {
    vi.useFakeTimers()
    prefersReducedMotion(false)
    // This slice of the bookshop board has a risk followed by two options.
    const model = { ...board.model!, cards: board.model!.cards.filter((card) => card.family !== 'quantity') }
    const kinds = boardKindsOf({ ...board, model })
    expect(kinds).toEqual(['option', 'risk'])
    const { unmount } = render(<ThinkingIndicator kinds={kinds} />)
    expect(mark()).toHaveAttribute('data-kind', 'option')
    expect(mark().querySelector('svg > rect')).not.toBeNull()
    expect(mark().querySelector('svg')).toHaveAttribute('width', '14')
    advance(899)
    expect(mark()).toHaveAttribute('data-kind', 'option')
    advance(1)
    expect(mark()).toHaveAttribute('data-kind', 'risk')
    expect(mark().querySelectorAll('svg')).toHaveLength(1)
    expect(mark().querySelector('svg > polygon')).not.toBeNull()
    advance(900)
    expect(mark()).toHaveAttribute('data-kind', 'option')
    unmount()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('cycles through all six default kinds when the board has no model or cards', () => {
    vi.useFakeTimers()
    prefersReducedMotion(false)
    const all = ['goal', 'decision', 'option', 'factor', 'risk', 'outcome']
    expect(boardKindsOf({ ...board, model: null })).toEqual(all)
    expect(boardKindsOf({ ...board, model: { ...board.model!, cards: [] } })).toEqual(all)
    render(<ThinkingIndicator />)
    for (const kind of all) {
      expect(mark()).toHaveAttribute('data-kind', kind)
      advance(900)
    }
    expect(mark()).toHaveAttribute('data-kind', 'goal')
  })

  it('keeps the first kind static with reduced motion', () => {
    vi.useFakeTimers()
    prefersReducedMotion(true)
    render(<ThinkingIndicator kinds={['risk', 'outcome']} />)
    const shape = mark().querySelector('svg')
    expect(shape).not.toHaveClass('ok-thinking-shape')
    advance(2700)
    expect(mark()).toHaveAttribute('data-kind', 'risk')
    expect(mark().querySelector('svg')).toBe(shape)
  })

  it('shows the label when provided and hides it when null or omitted', () => {
    const { rerender } = render(<ThinkingIndicator label="Still working…" />)
    expect(screen.getByTestId('thinking-label')).toHaveTextContent('Still working…')
    rerender(<ThinkingIndicator label={null} />)
    expect(screen.queryByTestId('thinking-label')).toBeNull()
    rerender(<ThinkingIndicator />)
    expect(screen.queryByTestId('thinking-label')).toBeNull()
  })
})
