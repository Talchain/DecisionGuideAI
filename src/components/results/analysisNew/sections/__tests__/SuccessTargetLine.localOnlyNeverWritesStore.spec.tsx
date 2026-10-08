import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { ToastProvider } from '../../../../../canvas/ToastContext'
import { ANALYSIS_NEW_COPY as COPY } from '../../analysisNewCopy'

const setGoalThresholdAndUpdateNode = vi.fn()
const proposeGoalTarget = vi.fn()
const onCommitOutcome = vi.fn()
let available = false
vi.mock('../../../../../canvas/store', () => {
  const read = () => ({
    nodes: [{ id: 'g1', type: 'goal', data: { goal_threshold_raw: 110, goal_threshold_unit: '%' } }],
    goalThreshold: null,
    goalThresholdRepresentation: null,
    setGoalThresholdAndUpdateNode,
  })
  const useCanvasStore = (select: (s: ReturnType<typeof read>) => unknown) => select(read())
  useCanvasStore.getState = read
  return { useCanvasStore }
})
vi.mock('../../../../../canvas/hooks/useModelEditAuthority', () => ({
  useModelEditAuthority: () => ({
    goalTargetDispatchAvailable: available,
    captureScenarioId: () => 'scenario-1',
    proposeGoalTarget,
  }),
}))

import { SuccessTargetLine } from '../SuccessTargetLine'
import { useShowToast } from '../../../../../canvas/ToastContext'

function Target() {
  const showToast = useShowToast()
  return <SuccessTargetLine goalNodeId="g1" testId="target" onCommitOutcome={outcome => {
    onCommitOutcome(outcome)
    showToast(outcome === 'dispatched' ? COPY.successTarget.dispatched :
      outcome === 'local_only' ? COPY.successTarget.changedLocally : COPY.successTarget.notEncodable)
  }} />
}
function commit(value = '125') {
  render(<ToastProvider><Target /></ToastProvider>)
  fireEvent.click(screen.getByTestId('target-edit'))
  fireEvent.change(screen.getByTestId('target-input'), { target: { value } })
  fireEvent.click(screen.getByTestId('target-save'))
}
beforeEach(() => {
  available = false
  setGoalThresholdAndUpdateNode.mockReset()
  proposeGoalTarget.mockReset().mockReturnValue('dispatched')
  onCommitOutcome.mockReset()
})
afterEach(cleanup)

describe('SuccessTargetLine local-only refusal', () => {
  it('never writes without dispatch and renders the refusal disclosure', () => {
    commit()
    expect(onCommitOutcome).toHaveBeenCalledOnce()
    expect(onCommitOutcome).toHaveBeenCalledWith('local_only')
    expect(setGoalThresholdAndUpdateNode).not.toHaveBeenCalled()
    expect(proposeGoalTarget).not.toHaveBeenCalled()
    expect(COPY.successTarget.changedLocally).toBe("Not saved: this target can't be sent to Olumi right now.")
    expect(screen.getByRole('alert')).toHaveTextContent("Not saved: this target can't be sent to Olumi right now.")
    expect(screen.getByTestId('target-editor')).toBeInTheDocument()
    expect(screen.getByTestId('target-input')).toHaveValue('125')
  })
  it('refuses a blank draft with the original not_encodable sentence', () => {
    commit('')
    expect(onCommitOutcome).toHaveBeenCalledOnce()
    expect(onCommitOutcome).toHaveBeenCalledWith('not_encodable')
    expect(setGoalThresholdAndUpdateNode).not.toHaveBeenCalled()
    expect(proposeGoalTarget).not.toHaveBeenCalled()
    expect(COPY.successTarget.notEncodable).toBe('That target could not be applied, so nothing changed.')
    expect(screen.getByRole('alert')).toHaveTextContent('That target could not be applied, so nothing changed.')
    expect(screen.getByTestId('target-editor')).toBeInTheDocument()
    expect(screen.getByTestId('target-input')).toHaveValue('')
  })
  it('keeps the dispatched path and makes no local echo', () => {
    available = true
    commit()
    expect(onCommitOutcome).toHaveBeenCalledWith('dispatched')
    expect(proposeGoalTarget).toHaveBeenCalledWith('125', '%', 'scenario-1', 'at_least', { onSendSettled: undefined })
    expect(setGoalThresholdAndUpdateNode).not.toHaveBeenCalled()
    expect(screen.queryByTestId('target-editor')).toBeNull()
    expect(screen.getByRole('alert')).toHaveTextContent(COPY.successTarget.dispatched)
  })
})
