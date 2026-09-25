/**
 * ⭐ THE RECORD BUTTON SAYS WHAT IS STILL MISSING.
 *
 * Witnessed 25 Sep 2026 02:44Z on a local build (pricing brief, OpenAI):
 * "Not ready to choose" plus a next action and a revisit trigger left "Record
 * your position" grey. The position also needs a rationale and an assumption
 * to watch, and nothing on screen said so. `handleSave` would show every
 * field's error, but it cannot run while the button is disabled.
 *
 * The button stays disabled; the rule is unchanged. A line beside it names
 * the fields still missing, and the button is described by that line.
 */
import '@testing-library/jest-dom/vitest'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'

const authState = vi.hoisted(() => ({
  user: { id: 'guest' } as { id: string } | null,
  loading: false,
  authenticated: true,
}))
vi.mock('../../../../contexts/AuthContext', () => ({ useAuth: () => authState }))
vi.mock('../../../../services/decisionRecordCommitService', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../../services/decisionRecordCommitService')>()),
  commitDecisionRecord: vi.fn(async () => ({ status: 'guest' as const })),
}))

import { DecisionRecordModal } from '../DecisionRecordModal'
import { openDecisionRecord, useDecisionRecordStore } from '../decisionRecordStore'
import { useCanvasStore } from '../../../../canvas/store'

const optionNode = (id: string, label: string) => ({ id, type: 'option', position: { x: 0, y: 0 }, data: { label } })

function seed(analysed: boolean) {
  useCanvasStore.setState({
    nodes: [optionNode('opt_a', 'Keep £40 price'), optionNode('opt_b', 'Raise to £50')] as never,
    results: (analysed ? { status: 'complete', progress: 100, hash: 'hash_run_1' } : { status: 'idle', progress: 0 }) as never,
    optionNumbering: analysed ? { opt_a: 1, opt_b: 2 } : {},
    currentScenarioId: 'scn_test',
  } as never)
}

const open = () => {
  render(<DecisionRecordModal />)
  act(() => openDecisionRecord())
}
const type = (testId: string, value: string) => fireEvent.change(screen.getByTestId(testId), { target: { value } })
const missingLine = () => screen.queryByTestId('decision-record-missing')
const save = () => screen.getByTestId('decision-record-save')

beforeEach(() => {
  sessionStorage.clear()
  localStorage.clear()
  useDecisionRecordStore.getState()._reset()
  seed(true)
})

describe('the Record button says what is still missing', () => {
  it('⭐ "Not ready to choose" with a next action and a trigger names the two fields left, and describes the button', () => {
    open()
    fireEvent.click(screen.getByTestId('decision-record-position-not_ready'))
    type('decision-record-next-action', 'Test £45 on 10% of new sign-ups')
    type('decision-record-revisit', 'When the £45 test has a month of churn data')
    expect(save()).toBeDisabled()
    expect(missingLine()).toHaveTextContent('Still needed to record: a rationale and an assumption to watch.')
    expect(save()).toHaveAttribute('aria-describedby', missingLine()!.id)
  })

  it('the line shrinks as fields are filled, and goes when the button enables', () => {
    open()
    fireEvent.click(screen.getByTestId('decision-record-position-not_ready'))
    expect(missingLine()).toHaveTextContent(
      'Still needed to record: a revisit trigger or date, a rationale and an assumption to watch.',
    )
    type('decision-record-revisit', 'Next quarter')
    type('decision-record-rationale', 'Churn is still an estimate')
    expect(missingLine()).toHaveTextContent('Still needed to record: an assumption to watch.')
    type('decision-record-assumption', 'Churn stays near today')
    expect(save()).toBeEnabled()
    expect(missingLine()).toBeNull()
    expect(save()).not.toHaveAttribute('aria-describedby')
  })

  it('"Choose an option" names its own required fields', () => {
    open()
    expect(missingLine()).toHaveTextContent(
      'Still needed to record: a confidence from 0 to 100, what you expect to happen, a revisit trigger or date, a rationale and an assumption to watch.',
    )
  })

  it('CONTROL: with no analysed options the door\'s own gate speaks, not this line', () => {
    seed(false)
    open()
    expect(save()).toBeDisabled()
    expect(missingLine()).toBeNull()
  })
})
