import '@testing-library/jest-dom/vitest'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { StrengthenTheReasoning } from '../sections/StrengthenTheReasoning'
import { useCanvasStore } from '../../../../canvas/store'
import { setCurrentScenarioId } from '../../../../canvas/store/scenarios'
import { recordDissent, readDissent, clearDurableDissent } from '../../../../canvas/stores/dissentStore'
import { useStrengthenStore } from '../../../../canvas/stores/strengthenStore'
import { clearAuthStates } from '../../../../lib/auth/authUtils'
import { useDecisionRecordStore } from '../../modals/decisionRecordStore'
import type { Recommendation } from '../../strengthen/strengthenTypes'

vi.mock('../../coaching/askOlumiStore', () => ({ openAskOlumi: vi.fn() }))
vi.mock('../../../../lib/supabase', () => ({ supabase: {} }))
vi.mock('../../../../canvas/utils/focusHelpers', () => ({ focusModelTarget: vi.fn() }))
vi.mock('../nodeMarks', async (orig) => ({
  ...(await orig<typeof import('../nodeMarks')>()), markKindForTarget: () => null,
}))

const A = 'scenario-A'
const B = 'scenario-B'
const PREFIX = 'olumi.dissent.v2.'
const ID = 'strengthen:robustness'
const item: Recommendation = {
  id: ID, helpType: 'challenge', title: 'Pressure-test the leading option',
  signal: 'The ranking was fragile.', whyNow: 'Small changes flip it.',
  tryThis: 'Imagine it failed.', sourceLine: 'From the robustness check.',
  action: { kind: 'ai-dialogue', label: 'Work through this', prompt: 'Pressure-test it' },
  priority: 1,
} as Recommendation

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  useStrengthenStore.getState()._reset()
  useCanvasStore.setState({ currentScenarioId: A })
  setCurrentScenarioId(A)
})

function openCard() {
  const view = render(<StrengthenTheReasoning interventions={[item]} analysisHash="hash-A" />)
  fireEvent.click(screen.getByTestId('analysis-new-strengthen-toggle'))
  return view
}

function enterAndSave(words: string) {
  fireEvent.click(screen.getByTestId('analysis-new-strengthen-disagree'))
  fireEvent.change(screen.getByTestId('analysis-new-strengthen-disagree-input'), { target: { value: words } })
  fireEvent.click(screen.getByTestId('analysis-new-strengthen-disagree-save'))
}

describe('independent PR 1299 acceptance counterexamples', () => {
  it('CONTROL: successful overwrite renders and persists the new words', () => {
    recordDissent(A, ID, 'Old words', 'hash-A')
    openCard()
    enterAndSave('Revised words')
    expect(readDissent(A)[ID].reason).toBe('Revised words')
    expect(screen.getByTestId('analysis-new-strengthen-disagreement')).toHaveTextContent('Revised words')
  })

  it('the open tab must save under its own scenario after another tab changes the shared pointer', () => {
    openCard()
    // Models tab B completing its normal scenarios.setCurrentScenarioId(B).
    // No race needed: tab A still has its own Zustand store and visible card.
    setCurrentScenarioId(B)
    expect(useCanvasStore.getState().currentScenarioId).toBe(A)
    enterAndSave('Written about scenario A')
    expect(readDissent(B)).toEqual({})
    expect(readDissent(A)[ID].reason).toBe('Written about scenario A')
  })

  it('a rejected durable overwrite must not silently restore old words over the new session copy', () => {
    recordDissent(A, ID, 'Old words', 'hash-A')
    openCard()
    const original = Storage.prototype.setItem
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function(this: Storage, key, value) {
      if (this === localStorage && key.startsWith(PREFIX)) throw new DOMException('Full', 'QuotaExceededError')
      return original.call(this, key, value)
    })
    enterAndSave('Revised words')
    const history = useStrengthenStore.getState().records[ID].history
    expect(history[history.length - 1].disputeReason).toBe('Revised words')
    expect(screen.getByTestId('analysis-new-strengthen-disagree-input')).toHaveValue('Revised words')
    expect(screen.getByRole('alert')).toHaveTextContent('Not saved for next time')
    expect(readDissent(A)[ID].reason).toBe('Old words')
    vi.restoreAllMocks()
    fireEvent.click(screen.getByTestId('analysis-new-strengthen-disagree-save'))
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.queryByTestId('analysis-new-strengthen-disagree-input')).toBeNull()
    expect(readDissent(A)[ID].reason).toBe('Revised words')
    expect(screen.getByTestId('analysis-new-strengthen-disagreement')).toHaveTextContent('Revised words')
  })

  it('failed first save keeps the entered words available, and retry persists them', () => {
    openCard()
    const original = Storage.prototype.setItem
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function(this: Storage, key, value) {
      if (this === localStorage && key.startsWith(PREFIX)) throw new DOMException('Full', 'QuotaExceededError')
      return original.call(this, key, value)
    })
    enterAndSave('My first objection')
    expect(readDissent(A)).toEqual({})
    expect(screen.getByTestId('analysis-new-strengthen-disagree-input')).toHaveValue('My first objection')
    expect(screen.getByRole('alert')).toHaveTextContent('retry')
    vi.restoreAllMocks()
    fireEvent.click(screen.getByTestId('analysis-new-strengthen-disagree-save'))
    expect(readDissent(A)[ID].reason).toBe('My first objection')
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('reads the displayed A record even when the recovery pointer names B', () => {
    recordDissent(A, ID, 'Only about A', 'hash-A')
    recordDissent(B, ID, 'Only about B', 'hash-B')
    setCurrentScenarioId(B)
    openCard()
    expect(screen.getByTestId('analysis-new-strengthen-disagreement')).toHaveTextContent('Only about A')
    expect(screen.getByTestId('analysis-new-strengthen-disagreement')).not.toHaveTextContent('Only about B')
  })

  it('an editor opened on A cannot write into B after this tab changes models; returning to A can retry', () => {
    openCard()
    fireEvent.click(screen.getByTestId('analysis-new-strengthen-disagree'))
    fireEvent.change(screen.getByTestId('analysis-new-strengthen-disagree-input'), { target: { value: 'Composed about A' } })
    act(() => useCanvasStore.setState({ currentScenarioId: B }))
    fireEvent.click(screen.getByTestId('analysis-new-strengthen-disagree-save'))
    expect(readDissent(A)).toEqual({})
    expect(readDissent(B)).toEqual({})
    expect(screen.getByRole('alert')).toHaveTextContent('model on screen changed')
    expect(screen.getByTestId('analysis-new-strengthen-disagree-input')).toHaveValue('Composed about A')
    act(() => useCanvasStore.setState({ currentScenarioId: A }))
    fireEvent.click(screen.getByTestId('analysis-new-strengthen-disagree-save'))
    expect(readDissent(A)[ID].reason).toBe('Composed about A')
    expect(readDissent(B)).toEqual({})
  })

  it('uses the analysis visible when the composer opened, not a newer result during typing', () => {
    const view = openCard()
    fireEvent.click(screen.getByTestId('analysis-new-strengthen-disagree'))
    fireEvent.change(screen.getByTestId('analysis-new-strengthen-disagree-input'), { target: { value: 'About the earlier result' } })
    view.rerender(<StrengthenTheReasoning interventions={[item]} analysisHash="hash-new" />)
    fireEvent.click(screen.getByTestId('analysis-new-strengthen-disagree-save'))
    expect(readDissent(A)[ID].analysisHash).toBe('hash-A')
    expect(screen.getByTestId('analysis-new-strengthen-disagreement-earlier')).toBeInTheDocument()
  })

  it('a board without a scenario identity keeps session behaviour but labels its limited scope', () => {
    useCanvasStore.setState({ currentScenarioId: null })
    openCard()
    enterAndSave('Session only objection')
    expect(readDissent(null)).toEqual({})
    expect(screen.getByTestId('analysis-new-strengthen-disagreement')).toHaveTextContent('Kept in this tab only')
  })

  it('same-scenario writes to different findings survive a second completed write before the first commits', () => {
    const original = Storage.prototype.setItem
    let interleave = true
    let otherWriteSucceeded = false
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function(this: Storage, key, value) {
      if (this === localStorage && key.startsWith(PREFIX) && interleave) {
        interleave = false
        // B completes its real write before A's write commits. Per-record
        // storage must preserve both findings under this allowed schedule,
        // not a claim to have driven two native browser tabs.
        otherWriteSucceeded = recordDissent(A, 'strengthen:broaden', 'Other tab words', 'hash-A')
      }
      return original.call(this, key, value)
    })
    expect(recordDissent(A, ID, 'This tab words', 'hash-A')).toBe(true)
    expect(otherWriteSucceeded).toBe(true)
    expect(readDissent(A)[ID]?.reason).toBe('This tab words')
    expect(readDissent(A)['strengthen:broaden']?.reason).toBe('Other tab words')
  })

  it('LIMIT CONTROL: clearing durable dissent does not clear the session fallback', () => {
    const first = openCard()
    enterAndSave('Still in the session')
    clearDurableDissent()
    expect(readDissent(A)).toEqual({})
    first.unmount()
    openCard()
    expect(screen.getByTestId('analysis-new-strengthen-disagreement')).toHaveTextContent('Still in the session')
  })

  it('the actual shared auth cleanup preserves decision-record revocation and clears both dissent versions only', () => {
    useDecisionRecordStore.getState()._reset()
    const capture = useDecisionRecordStore.getState().saveRecord(A, {
      optionId: 'a', optionLabel: 'A', optionNumber: 1, confidence: 70,
      rationale: 'Private', assumptionToWatch: 'Assumption', revisitTrigger: 'Tomorrow', analysisHash: null, savedAt: 123,
    })
    expect(capture).not.toBeNull()
    recordDissent(A, ID, 'A local objection', 'hash-A')
    localStorage.setItem('olumi.dissent.v1.scenario-B', JSON.stringify({ version: 1, records: { old: { reason: 'Legacy', at: 1 } } }))
    localStorage.setItem('unrelated-model', 'keep me')
    clearAuthStates()
    expect(readDissent(A)).toEqual({})
    expect(readDissent(B)).toEqual({})
    expect(Object.keys(localStorage).some(key => key.startsWith('olumi.dissent.'))).toBe(false)
    expect(useDecisionRecordStore.getState().byScenario).toEqual({})
    expect(useDecisionRecordStore.getState().isCurrentCapture(A, capture!)).toBe(false)
    expect(localStorage.getItem('unrelated-model')).toBe('keep me')
  })

  it('LIMIT CONTROL: another scenario with no durable record still sees the unscoped session fallback', () => {
    const first = openCard()
    enterAndSave('Only about scenario A')
    first.unmount()
    act(() => useCanvasStore.setState({ currentScenarioId: B }))
    setCurrentScenarioId(B)
    openCard()
    expect(readDissent(B)).toEqual({})
    expect(screen.getByTestId('analysis-new-strengthen-disagreement')).toHaveTextContent('Only about scenario A')
  })
})
