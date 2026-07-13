/**
 * Record-the-decision modal (prototype #decisionModal) — live analysed
 * option set (read-only, stable numbering), fail-closed zero-option state,
 * the closed Number('')===0 confidence hole, scenario-keyed persistence
 * with the analysed graph hash, and the shared modal a11y contract.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'

import { DecisionRecordModal, DECISION_RECORD_COPY } from '../DecisionRecordModal'
import {
  openDecisionRecord,
  selectDecisionRecord,
  useDecisionRecordStore,
} from '../decisionRecordStore'
import { useCanvasStore } from '../../../../canvas/store'

function optionNode(id: string, label: string) {
  return { id, type: 'option', position: { x: 0, y: 0 }, data: { label } }
}

function seedAnalysedOptions(opts: { numbering?: Record<string, number> } = {}) {
  useCanvasStore.setState({
    nodes: [
      optionNode('opt_b', 'Hire senior technical lead'),
      optionNode('opt_a', 'Bring on technical co-founder'),
    ] as never,
    results: { status: 'complete', progress: 100, hash: 'hash_run_1' } as never,
    optionNumbering: opts.numbering ?? { opt_a: 1, opt_b: 2 },
    currentScenarioId: 'scn_test',
  } as never)
}

function seedNoAnalysis() {
  useCanvasStore.setState({
    nodes: [optionNode('opt_a', 'Bring on technical co-founder')] as never,
    results: { status: 'idle', progress: 0 } as never,
    optionNumbering: {},
    currentScenarioId: 'scn_test',
  } as never)
}

function openModal() {
  act(() => openDecisionRecord())
}

function fillValid() {
  fireEvent.change(screen.getByTestId('decision-record-confidence'), {
    target: { value: '70' },
  })
  fireEvent.change(screen.getByTestId('decision-record-revisit'), {
    target: { value: 'Runway falls below 9 months' },
  })
  fireEvent.change(screen.getByTestId('decision-record-rationale'), {
    target: { value: 'Best current choice given hiring constraints.' },
  })
  fireEvent.change(screen.getByTestId('decision-record-assumption'), {
    target: { value: 'The hiring market stays open.' },
  })
}

beforeEach(() => {
  sessionStorage.clear()
  useDecisionRecordStore.getState()._reset()
  seedAnalysedOptions()
})

describe('DecisionRecordModal — chrome and a11y', () => {
  it('renders nothing until opened', () => {
    render(<DecisionRecordModal />)
    expect(screen.queryByTestId('decision-record-modal')).not.toBeInTheDocument()
  })

  it('opens as an aria-modal dialog labelled by the title, focusing the option select', () => {
    render(<DecisionRecordModal />)
    openModal()
    const dialog = screen.getByTestId('decision-record-modal')
    expect(dialog).toHaveAttribute('role', 'dialog')
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    const labelledBy = dialog.getAttribute('aria-labelledby')
    expect(document.getElementById(labelledBy as string)).toHaveTextContent(
      DECISION_RECORD_COPY.title,
    )
    expect(document.activeElement).toBe(screen.getByTestId('decision-record-option'))
  })

  it('Escape closes and focus returns to the invoking element', () => {
    render(
      <>
        <button type="button" data-testid="opener">
          open
        </button>
        <DecisionRecordModal />
      </>,
    )
    const opener = screen.getByTestId('opener')
    opener.focus()
    openModal()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByTestId('decision-record-modal')).not.toBeInTheDocument()
    expect(document.activeElement).toBe(opener)
  })

  it('shows the honest prototype-persistence note', () => {
    render(<DecisionRecordModal />)
    openModal()
    expect(screen.getByTestId('decision-record-note')).toHaveTextContent(
      'Saved on this device for this scenario.',
    )
  })
})

describe('DecisionRecordModal — analysed option set (read-only)', () => {
  it('lists the analysed options with stable numbers, sorted by number', () => {
    render(<DecisionRecordModal />)
    openModal()
    const select = screen.getByTestId('decision-record-option') as HTMLSelectElement
    const labels = Array.from(select.options).map((o) => o.textContent)
    expect(labels).toEqual([
      '1. Bring on technical co-founder',
      '2. Hire senior technical lead',
    ])
  })

  it('omits numbers (never fabricates) when the numbering map is incomplete', () => {
    seedAnalysedOptions({ numbering: { opt_a: 1 } })
    render(<DecisionRecordModal />)
    openModal()
    const select = screen.getByTestId('decision-record-option') as HTMLSelectElement
    const labels = Array.from(select.options).map((o) => o.textContent)
    expect(labels).toEqual([
      'Hire senior technical lead',
      'Bring on technical co-founder',
    ])
  })

  it('fail-closed: no completed analysis renders a disabled form with honest copy', () => {
    seedNoAnalysis()
    render(<DecisionRecordModal />)
    openModal()
    expect(screen.getByTestId('decision-record-empty')).toHaveTextContent(
      DECISION_RECORD_COPY.emptyState,
    )
    expect(screen.getByTestId('decision-record-option')).toBeDisabled()
    expect(screen.getByTestId('decision-record-confidence')).toBeDisabled()
    expect(screen.getByTestId('decision-record-rationale')).toBeDisabled()
    expect(screen.getByTestId('decision-record-save')).toBeDisabled()
  })
})

describe('DecisionRecordModal — validation', () => {
  it('empty confidence blocks Save (the prototype Number("")===0 hole is closed)', () => {
    render(<DecisionRecordModal />)
    openModal()
    fillValid()
    const confidence = screen.getByTestId('decision-record-confidence')
    fireEvent.change(confidence, { target: { value: '' } })
    fireEvent.blur(confidence)
    expect(screen.getByText(DECISION_RECORD_COPY.confidenceError)).toBeInTheDocument()
    expect(screen.getByTestId('decision-record-save')).toBeDisabled()
  })

  it.each([['101'], ['-1'], ['abc'], ['70%']])(
    'confidence %j is rejected with the inline error',
    (bad) => {
      render(<DecisionRecordModal />)
      openModal()
      fillValid()
      const confidence = screen.getByTestId('decision-record-confidence')
      fireEvent.change(confidence, { target: { value: bad } })
      fireEvent.blur(confidence)
      expect(screen.getByText(DECISION_RECORD_COPY.confidenceError)).toBeInTheDocument()
      expect(screen.getByTestId('decision-record-save')).toBeDisabled()
    },
  )

  it.each([[0], [100]])('boundary confidence %d passes', (edge) => {
    render(<DecisionRecordModal />)
    openModal()
    fillValid()
    fireEvent.change(screen.getByTestId('decision-record-confidence'), {
      target: { value: String(edge) },
    })
    expect(screen.getByTestId('decision-record-save')).toBeEnabled()
  })

  it('rationale, assumption and revisit trigger are each required with their own errors', () => {
    render(<DecisionRecordModal />)
    openModal()
    fillValid()
    for (const [testId, error] of [
      ['decision-record-rationale', DECISION_RECORD_COPY.rationaleError],
      ['decision-record-assumption', DECISION_RECORD_COPY.assumptionError],
      ['decision-record-revisit', DECISION_RECORD_COPY.revisitError],
    ] as const) {
      const field = screen.getByTestId(testId)
      const previous = (field as HTMLInputElement).value
      fireEvent.change(field, { target: { value: '   ' } })
      fireEvent.blur(field)
      expect(screen.getByText(error)).toBeInTheDocument()
      expect(screen.getByTestId('decision-record-save')).toBeDisabled()
      fireEvent.change(field, { target: { value: previous } })
    }
    expect(screen.getByTestId('decision-record-save')).toBeEnabled()
  })
})

describe('DecisionRecordModal — capture', () => {
  it('saves the scenario-keyed record with the analysed graph hash, toasts the spec copy and closes', () => {
    render(<DecisionRecordModal />)
    openModal()
    fireEvent.change(screen.getByTestId('decision-record-option'), {
      target: { value: 'opt_b' },
    })
    fillValid()
    fireEvent.click(screen.getByTestId('decision-record-save'))

    const record = selectDecisionRecord(useDecisionRecordStore.getState(), 'scn_test')
    expect(record).toMatchObject({
      optionId: 'opt_b',
      optionLabel: 'Hire senior technical lead',
      optionNumber: 2,
      confidence: 70,
      rationale: 'Best current choice given hiring constraints.',
      assumptionToWatch: 'The hiring market stays open.',
      revisitTrigger: 'Runway falls below 9 months',
      analysisHash: 'hash_run_1',
    })

    expect(screen.queryByTestId('decision-record-modal')).not.toBeInTheDocument()
    expect(screen.getByTestId('decision-record-toast')).toHaveTextContent(
      DECISION_RECORD_COPY.toastSaved,
    )
  })

  it('the selector exposes the record for later "Decision recorded" surfaces, and it survives a simulated reload', () => {
    render(<DecisionRecordModal />)
    openModal()
    fillValid()
    fireEvent.click(screen.getByTestId('decision-record-save'))

    useDecisionRecordStore.setState({ byScenario: {} })
    useDecisionRecordStore.getState()._rehydrateForTests()
    const record = selectDecisionRecord(useDecisionRecordStore.getState(), 'scn_test')
    expect(record?.optionId).toBe('opt_a')
    expect(record?.analysisHash).toBe('hash_run_1')
  })

  it('reopening prefills from the existing record', () => {
    render(<DecisionRecordModal />)
    openModal()
    fireEvent.change(screen.getByTestId('decision-record-option'), {
      target: { value: 'opt_b' },
    })
    fillValid()
    fireEvent.click(screen.getByTestId('decision-record-save'))

    openModal()
    expect(screen.getByTestId('decision-record-option')).toHaveValue('opt_b')
    expect(screen.getByTestId('decision-record-confidence')).toHaveValue('70')
    expect(screen.getByTestId('decision-record-rationale')).toHaveValue(
      'Best current choice given hiring constraints.',
    )
  })
})
