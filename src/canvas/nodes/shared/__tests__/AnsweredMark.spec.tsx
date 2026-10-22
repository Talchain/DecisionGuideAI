/**
 * The answered tick: an item whose Olumi question the person answered keeps a quiet tick, its question and answer as the
 * tick's description; only in the scenario it was answered in; and still there after a reload of this browser.
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { AnsweredMark } from '../AnsweredMark'
import { useCanvasStore } from '../../../store'
import { useAnsweredQuestionsStore } from '../../../stores/answeredQuestionsStore'

const ANSWER = { question: 'How much funding do you need?', answer: '£250,000 committed', at: '2026-10-22T14:00:00.000Z' }

afterEach(() => { cleanup(); localStorage.clear(); useAnsweredQuestionsStore.setState({ byScenario: {} }) })

describe('the answered tick', () => {
  it('⭐ shows on the answered item with its question and answer', () => {
    useCanvasStore.setState({ currentScenarioId: 's1' } as never)
    useAnsweredQuestionsStore.getState().record('s1', 'goal', ANSWER)
    render(<AnsweredMark nodeId="goal" />)
    const tick = screen.getByTestId('answered-mark-goal')
    expect(tick.getAttribute('aria-label')).toBe('You answered Olumi')
    expect(tick.getAttribute('aria-description')).toBe('How much funding do you need? — £250,000 committed')
  })

  it('CONTRAST: another item, or the same item in another scenario, has no tick', () => {
    useAnsweredQuestionsStore.getState().record('s1', 'goal', ANSWER)
    useCanvasStore.setState({ currentScenarioId: 's1' } as never)
    render(<AnsweredMark nodeId="factor" />)
    expect(screen.queryByTestId('answered-mark-factor')).toBeNull()
    cleanup()
    useCanvasStore.setState({ currentScenarioId: 's2' } as never)
    render(<AnsweredMark nodeId="goal" />)
    expect(screen.queryByTestId('answered-mark-goal')).toBeNull()
  })

  it('⭐ survives a reload of this browser (the store reads what it saved)', async () => {
    useAnsweredQuestionsStore.getState().record('s1', 'goal', ANSWER)
    vi.resetModules()
    const fresh = await import('../../../stores/answeredQuestionsStore')
    expect(fresh.useAnsweredQuestionsStore.getState().byScenario.s1?.goal).toEqual(ANSWER)
  })
})
