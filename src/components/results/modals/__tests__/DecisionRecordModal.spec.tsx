/**
 * Record-the-decision modal (prototype #decisionModal) — live analysed
 * option set (read-only, stable numbering), fail-closed zero-option state,
 * the closed Number('')===0 confidence hole, scenario-keyed persistence
 * with the analysed graph hash, and the shared modal a11y contract.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'

const authState = vi.hoisted(() => ({
  user: { id: 'guest' } as { id: string } | null,
  loading: false,
  // Optional auth deliberately grants route access to guests too.
  authenticated: true,
}))
vi.mock('../../../../contexts/AuthContext', () => ({ useAuth: () => authState }))

// The DURABLE half is exercised end-to-end in
// DecisionRecordModal.durableCommit.spec.tsx (real service, mocked fetch).
// Here the commit is stubbed to the GUEST result so this file keeps testing
// exactly what it was written to test: local capture, validation and a11y.
// ⚠ PARTIAL: the modal also reads the service's text limits, which must stay real.
vi.mock('../../../../services/decisionRecordCommitService', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../../services/decisionRecordCommitService')>()),
  commitDecisionRecord: vi.fn(async () => ({ status: 'guest' as const })),
}))

import { DecisionRecordModal, DECISION_RECORD_COPY } from '../DecisionRecordModal'
import {
  NOT_READY_POSITION_LABEL,
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
  fireEvent.change(screen.getByTestId('decision-record-expectation'), {
    target: { value: 'Runway holds above 9 months through Q1.' },
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
  authState.user = { id: 'guest' }
  authState.loading = false
  authState.authenticated = true
  sessionStorage.clear()
  // The decision record persists to localStorage (it must outlive the tab), so
  // clearing only sessionStorage would leak a record between cases in this file.
  localStorage.clear()
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

  it.each(['guest', null, ''])('keeps guest %j recording device-only even when route access is authenticated', (id) => {
    authState.user = id === null ? null : { id }
    render(<DecisionRecordModal />)
    openModal()
    const note = screen.getByTestId('decision-record-note')
    expect(note).toHaveTextContent('Signed out')
    expect(note).toHaveTextContent('this record stays on this device for this scenario')
    expect(note).toHaveTextContent('not saved to an account')
    expect(note).not.toHaveTextContent('saved to your account')
    expect(note).not.toHaveTextContent('Sign in to')
    const revisitHelp = screen.getByTestId('decision-record-revisit-help')
    expect(revisitHelp).toHaveTextContent('kept as text')
    expect(revisitHelp).toHaveTextContent('No review date is set automatically')
    expect(revisitHelp).not.toHaveTextContent('90 days')
  })

  it('names only the signed-in save attempt and the exact durable/local field split', () => {
    authState.user = { id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' }
    render(<DecisionRecordModal />)
    openModal()
    const note = screen.getByTestId('decision-record-note')
    expect(note).toHaveTextContent('try to save your choice, confidence, expectation and review date to your account')
    // ⚠ Superseded: ~~'rationale, assumption and revisit trigger stay on this
    // device for this scenario'~~. Since 24 Sep 2026 the text is SENT with the
    // commit, so "stay on this device" would deny a transmission that happens.
    // The note says it is sent AND kept here, and never that the account keeps it.
    expect(note).toHaveTextContent('rationale, assumption, next action and revisit trigger are sent with them, and kept on this device for this scenario')
    expect(note).not.toHaveTextContent('stay on this device')
    expect(note).not.toHaveTextContent('are saved')
    expect(note.textContent ?? '').not.toContain('Prototype only')
    const revisitHelp = screen.getByTestId('decision-record-revisit-help')
    expect(revisitHelp).toHaveTextContent('If the account save succeeds')
    expect(revisitHelp).toHaveTextContent('recognised date')
    expect(revisitHelp).toHaveTextContent('90 days')
  })

  it.each(['guest', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'])('does not guess account saving while identity %s is unresolved', (id) => {
    authState.user = { id }
    authState.loading = true
    const { rerender } = render(<DecisionRecordModal />)
    openModal()
    const note = screen.getByTestId('decision-record-note')
    expect(note).toHaveTextContent('checking your sign-in')
    expect(note).not.toHaveTextContent('Signed out')
    expect(note).not.toHaveTextContent('try to save')
    expect(note).not.toHaveTextContent('saved to your account')
    expect(screen.getByTestId('decision-record-revisit-help')).toHaveTextContent('Enter a date or a trigger')
    expect(screen.getByTestId('decision-record-revisit-help')).not.toHaveTextContent('90 days')
    authState.loading = false
    rerender(<DecisionRecordModal />)
    expect(note).toHaveTextContent(id === 'guest' ? 'Signed out' : 'try to save')
    expect(screen.getByTestId('decision-record-revisit-help')).toHaveTextContent(
      id === 'guest' ? 'No review date is set automatically' : 'If the account save succeeds',
    )
  })

  it.each([null, ''])('does not offer account saving without a scenario identity (%j)', (currentScenarioId) => {
    authState.user = { id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' }
    useCanvasStore.setState({ currentScenarioId })
    render(<DecisionRecordModal />)
    openModal()
    const note = screen.getByTestId('decision-record-note')
    expect(note).toHaveTextContent('Account saving is unavailable for this model')
    expect(note).toHaveTextContent('record stays on this device')
    expect(note).not.toHaveTextContent('Signed out')
    expect(note).not.toHaveTextContent('try to save')
    expect(screen.getByTestId('decision-record-revisit-help')).toHaveTextContent('No review date is set automatically')
    expect(screen.getByTestId('decision-record-revisit-help')).not.toHaveTextContent('90 days')
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

  it('expectation, rationale, assumption and revisit trigger are each required with their own errors', () => {
    render(<DecisionRecordModal />)
    openModal()
    fillValid()
    for (const [testId, error] of [
      ['decision-record-expectation', DECISION_RECORD_COPY.expectationError],
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
  it('saves the scenario-keyed record with the analysed graph hash, toasts the spec copy and closes', async () => {
    render(<DecisionRecordModal />)
    openModal()
    fireEvent.change(screen.getByTestId('decision-record-option'), {
      target: { value: 'opt_b' },
    })
    fillValid()
    await act(async () => {
      fireEvent.click(screen.getByTestId('decision-record-save'))
    })

    const record = selectDecisionRecord(useDecisionRecordStore.getState(), 'scn_test')
    expect(record).toMatchObject({
      optionId: 'opt_b',
      optionLabel: 'Hire senior technical lead',
      optionNumber: 2,
      confidence: 70,
      rationale: 'Best current choice given hiring constraints.',
      assumptionToWatch: 'The hiring market stays open.',
      revisitTrigger: 'Runway falls below 9 months',
      expectation: 'Runway holds above 9 months through Q1.',
      analysisHash: 'hash_run_1',
    })

    expect(screen.queryByTestId('decision-record-modal')).not.toBeInTheDocument()
    // A GUEST is told the local story, never "saved to your account" — the
    // two outcomes are never merged.
    expect(screen.getByTestId('decision-record-toast')).toHaveTextContent(
      DECISION_RECORD_COPY.toastSavedLocal,
    )
  })

  it('the selector exposes the record for later "Decision recorded" surfaces, and it survives a simulated reload', async () => {
    render(<DecisionRecordModal />)
    openModal()
    fillValid()
    await act(async () => {
      fireEvent.click(screen.getByTestId('decision-record-save'))
    })

    useDecisionRecordStore.setState({ byScenario: {} })
    useDecisionRecordStore.getState()._rehydrateForTests()
    const record = selectDecisionRecord(useDecisionRecordStore.getState(), 'scn_test')
    expect(record?.optionId).toBe('opt_a')
    expect(record?.analysisHash).toBe('hash_run_1')
  })

  it('reopening prefills from the existing record', async () => {
    render(<DecisionRecordModal />)
    openModal()
    fireEvent.change(screen.getByTestId('decision-record-option'), {
      target: { value: 'opt_b' },
    })
    fillValid()
    await act(async () => {
      fireEvent.click(screen.getByTestId('decision-record-save'))
    })

    openModal()
    expect(screen.getByTestId('decision-record-option')).toHaveValue('opt_b')
    expect(screen.getByTestId('decision-record-confidence')).toHaveValue('70')
    expect(screen.getByTestId('decision-record-rationale')).toHaveValue(
      'Best current choice given hiring constraints.',
    )
    expect(screen.getByTestId('decision-record-expectation')).toHaveValue(
      'Runway holds above 9 months through Q1.',
    )
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 24 Sep 2026: the first choice is a POSITION (an option, or "Not ready to
// choose"), and every record may carry a NEXT ACTION.
// ─────────────────────────────────────────────────────────────────────────────

function fillNotReady() {
  fireEvent.click(screen.getByTestId('decision-record-position-not_ready'))
  fireEvent.change(screen.getByTestId('decision-record-revisit'), {
    target: { value: 'When the hiring market data lands' },
  })
  fireEvent.change(screen.getByTestId('decision-record-rationale'), {
    target: { value: 'The two options depend on a hiring market we have not sized.' },
  })
  fireEvent.change(screen.getByTestId('decision-record-assumption'), {
    target: { value: 'Senior candidates are available this quarter.' },
  })
}

describe('DecisionRecordModal — position: not ready to choose', () => {
  it('offers the two positions first, defaulting to an option, labelled as the user’s view', () => {
    render(<DecisionRecordModal />)
    openModal()
    const option = screen.getByTestId('decision-record-position-option') as HTMLInputElement
    const notReady = screen.getByTestId('decision-record-position-not_ready') as HTMLInputElement
    expect(option.checked).toBe(true)
    expect(notReady.checked).toBe(false)
    expect(notReady.closest('label')).toHaveTextContent(NOT_READY_POSITION_LABEL)
    expect(screen.getByTestId('decision-record-your-view')).toHaveTextContent(
      DECISION_RECORD_COPY.yourViewNote,
    )
  })

  it('not-ready HIDES the option, confidence and expectation, and keeps the reasoning fields', () => {
    render(<DecisionRecordModal />)
    openModal()
    fireEvent.click(screen.getByTestId('decision-record-position-not_ready'))
    expect(screen.queryByTestId('decision-record-option')).not.toBeInTheDocument()
    expect(screen.queryByTestId('decision-record-confidence')).not.toBeInTheDocument()
    expect(screen.queryByTestId('decision-record-expectation')).not.toBeInTheDocument()
    for (const kept of ['rationale', 'assumption', 'revisit', 'next-action']) {
      expect(screen.getByTestId(`decision-record-${kept}`)).toBeInTheDocument()
    }
    expect(screen.getByTestId('decision-record-rationale')).toHaveAttribute(
      'placeholder',
      DECISION_RECORD_COPY.notReadyRationalePlaceholder,
    )
    expect(screen.getByTestId('decision-record-revisit-help')).toHaveTextContent(
      DECISION_RECORD_COPY.notReadyRevisitHelp,
    )
    expect(screen.getByTestId('decision-record-save')).toHaveTextContent(
      DECISION_RECORD_COPY.saveNotReady,
    )
  })

  it('a signed-in not-ready note names the position, never a choice, confidence or expectation', () => {
    authState.user = { id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' }
    render(<DecisionRecordModal />)
    openModal()
    const note = screen.getByTestId('decision-record-note')
    expect(note).toHaveTextContent(DECISION_RECORD_COPY.persistenceNote)
    fireEvent.click(screen.getByTestId('decision-record-position-not_ready'))
    expect(note).toHaveTextContent(DECISION_RECORD_COPY.notReadyPersistenceNote)
    expect(note).not.toHaveTextContent(/choice|confidence|expectation|review date/i)
  })

  it('CONTRAST: the option position still shows all three, with today’s copy', () => {
    render(<DecisionRecordModal />)
    openModal()
    expect(screen.getByTestId('decision-record-option')).toBeInTheDocument()
    expect(screen.getByTestId('decision-record-confidence')).toBeInTheDocument()
    expect(screen.getByTestId('decision-record-expectation')).toBeInTheDocument()
    expect(screen.getByTestId('decision-record-rationale')).toHaveAttribute(
      'placeholder',
      DECISION_RECORD_COPY.rationalePlaceholder,
    )
    expect(screen.getByTestId('decision-record-save')).toHaveTextContent(DECISION_RECORD_COPY.save)
  })

  it('saves WITHOUT a confidence or expectation, and the record carries no option at all', async () => {
    render(<DecisionRecordModal />)
    openModal()
    fillNotReady()
    fireEvent.change(screen.getByTestId('decision-record-next-action'), {
      target: { value: '  Size the senior hiring market by Friday.  ' },
    })
    expect(screen.getByTestId('decision-record-save')).toBeEnabled()
    await act(async () => {
      fireEvent.click(screen.getByTestId('decision-record-save'))
    })
    const record = selectDecisionRecord(useDecisionRecordStore.getState(), 'scn_test')
    expect(record).not.toBeNull()
    expect(record!.position).toBe('not_ready')
    // ⭐ ABSENT, not blank: a not-ready record states no choice, belief or forecast.
    for (const absent of ['optionId', 'optionLabel', 'optionNumber', 'confidence', 'expectation']) {
      expect(Object.prototype.hasOwnProperty.call(record, absent)).toBe(false)
    }
    expect(record).toMatchObject({
      rationale: 'The two options depend on a hiring market we have not sized.',
      assumptionToWatch: 'Senior candidates are available this quarter.',
      revisitTrigger: 'When the hiring market data lands',
      nextAction: 'Size the senior hiring market by Friday.',
      analysisHash: 'hash_run_1',
    })
    expect(screen.getByTestId('decision-record-toast')).toHaveTextContent(
      DECISION_RECORD_COPY.toastSavedLocalNotReady,
    )
    expect(screen.getByTestId('decision-record-toast')).not.toHaveTextContent(/decision/i)
  })

  it('not-ready still requires the rationale, assumption and revisit trigger', () => {
    render(<DecisionRecordModal />)
    openModal()
    fillNotReady()
    expect(screen.getByTestId('decision-record-save')).toBeEnabled()
    fireEvent.change(screen.getByTestId('decision-record-rationale'), { target: { value: '  ' } })
    expect(screen.getByTestId('decision-record-save')).toBeDisabled()
  })

  it('reopening a not-ready record prefills the position and its fields', async () => {
    render(<DecisionRecordModal />)
    openModal()
    fillNotReady()
    fireEvent.change(screen.getByTestId('decision-record-next-action'), {
      target: { value: 'Size the senior hiring market.' },
    })
    await act(async () => {
      fireEvent.click(screen.getByTestId('decision-record-save'))
    })
    openModal()
    expect((screen.getByTestId('decision-record-position-not_ready') as HTMLInputElement).checked).toBe(true)
    expect(screen.queryByTestId('decision-record-option')).not.toBeInTheDocument()
    expect(screen.getByTestId('decision-record-next-action')).toHaveValue('Size the senior hiring market.')
    expect(screen.getByTestId('decision-record-rationale')).toHaveValue(
      'The two options depend on a hiring market we have not sized.',
    )
  })

  it('switching back to an option loses no draft: the hidden fields were kept', () => {
    render(<DecisionRecordModal />)
    openModal()
    fillValid()
    fireEvent.click(screen.getByTestId('decision-record-position-not_ready'))
    fireEvent.click(screen.getByTestId('decision-record-position-option'))
    expect(screen.getByTestId('decision-record-confidence')).toHaveValue('70')
    expect(screen.getByTestId('decision-record-expectation')).toHaveValue(
      'Runway holds above 9 months through Q1.',
    )
  })
})

describe('DecisionRecordModal — next action', () => {
  it('the option path is UNCHANGED when no next action is given: no position, no nextAction key', async () => {
    render(<DecisionRecordModal />)
    openModal()
    fireEvent.change(screen.getByTestId('decision-record-option'), { target: { value: 'opt_b' } })
    fillValid()
    await act(async () => {
      fireEvent.click(screen.getByTestId('decision-record-save'))
    })
    const record = selectDecisionRecord(useDecisionRecordStore.getState(), 'scn_test')!
    // ⭐ The exact key set a pre-24-Sep save produced, in the same order.
    expect(Object.keys(record)).toEqual([
      'optionId', 'optionLabel', 'optionNumber', 'confidence', 'expectation',
      'rationale', 'assumptionToWatch', 'revisitTrigger', 'analysisHash', 'savedAt', 'remote',
    ])
    expect(screen.getByTestId('decision-record-toast')).toHaveTextContent(
      DECISION_RECORD_COPY.toastSavedLocal,
    )
  })

  it('an option record carries the next action when one is given, trimmed', async () => {
    render(<DecisionRecordModal />)
    openModal()
    fillValid()
    fireEvent.change(screen.getByTestId('decision-record-next-action'), {
      target: { value: ' Brief the board on Tuesday. ' },
    })
    await act(async () => {
      fireEvent.click(screen.getByTestId('decision-record-save'))
    })
    const record = selectDecisionRecord(useDecisionRecordStore.getState(), 'scn_test')!
    expect(record.nextAction).toBe('Brief the board on Tuesday.')
    expect(record.position).toBeUndefined()
  })

  it('a whitespace-only next action is not stored, and does not block saving', async () => {
    render(<DecisionRecordModal />)
    openModal()
    fillValid()
    fireEvent.change(screen.getByTestId('decision-record-next-action'), { target: { value: '   ' } })
    expect(screen.getByTestId('decision-record-save')).toBeEnabled()
    await act(async () => {
      fireEvent.click(screen.getByTestId('decision-record-save'))
    })
    const record = selectDecisionRecord(useDecisionRecordStore.getState(), 'scn_test')!
    expect(Object.prototype.hasOwnProperty.call(record, 'nextAction')).toBe(false)
  })

  it('bounds all four texts at CEE\'s 1,000 characters (superseded: 500 for the next action, 2,000 for the rest)', () => {
    render(<DecisionRecordModal />)
    openModal()
    for (const id of ['next-action', 'rationale', 'assumption', 'revisit']) {
      expect(screen.getByTestId(`decision-record-${id}`)).toHaveAttribute('maxLength', '1000')
    }
    // The expectation is not one of the four stored texts and carries no bound.
    expect(screen.getByTestId('decision-record-expectation')).not.toHaveAttribute('maxLength')
  })
})
