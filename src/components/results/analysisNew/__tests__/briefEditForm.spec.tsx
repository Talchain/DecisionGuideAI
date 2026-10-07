/**
 * E1 — "Edit the full question" (prototype `edit-brief`, P:535 / P:559 / P:666).
 *
 * An at-rest pencil in the review row opens ONE inline form: "Your question",
 * prefilled with THIS decision's brief, Cancel, and a submit that hands Olumi a
 * reframing proposal through the tab's existing ask route. The Method strip's
 * "Edit decision brief" opens the SAME form.
 *
 * ⚠ WHAT IT DOES NOT DO, pinned below: it writes nothing. There is no canonical
 * writer for the brief (`brief_text` is set at registration only, and no agent
 * tool edits it), so the form's own copy says the proposal goes to the chat and
 * that the question is not changed by it.
 *
 * Bound by identity: testids, the copy constants the form renders, and the
 * store record's scenario id — never a value another element could match.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'

vi.mock('../../../../canvas/utils/focusHelpers', () => ({ focusModelTarget: () => true }))

import { ModelReviewTool } from '../sections/ModelReviewTool'
import { MethodStrip } from '../sections/MethodStrip'
vi.mock('../../../../canvas/conversation/askAi', () => ({ askAi: vi.fn(() => 'sent') }))
import { askAi } from '../../../../canvas/conversation/askAi'
import { BRIEF_EDIT_COPY } from '../sections/BriefEditForm'
import { useBriefEditStore } from '../briefEditStore'
import { WHOLE_FRAMING_ASK } from '../buildReviewQueue'
import { AnalysisNewTabBody } from '../AnalysisNewTabBody'
import { genuineDecision } from './analysisNewFixtures'
import { REVIEW_BRIEF_ASK } from '../../decision-overview/actionsCatalogue'
import { useAskOlumiStore } from '../../coaching/askOlumiStore'
import { useCanvasStore } from '../../../../canvas/store'
import { useContextIntegrityStore } from '../../../../canvas/stores/contextIntegrityStore'
import { useStrengthenStore } from '../../../../canvas/stores/strengthenStore'

const TID = 'analysis-new-review'
const STRIP = 'analysis-new-method-strip'
const SCENARIO = 'scn_brief_edit'
const BRIEF = 'Should we hire two senior engineers this quarter, or contract the work out?\n\nBudget is fixed at £400k.'

const recordBrief = (scenarioId: string, briefText: string | null) =>
  useContextIntegrityStore.setState({ scenarioId, briefText, manifest: null, modelBuildingNotices: null })

const drawTool = (onAsk = vi.fn()) => {
  render(<ModelReviewTool interventions={[]} onAsk={onAsk} />)
  return onAsk
}
const pencil = () => screen.getByTestId(`${TID}-edit-brief`)
const input = () => screen.getByTestId(`${TID}-brief-input`) as HTMLTextAreaElement

beforeEach(() => {
  useCanvasStore.setState({ currentScenarioId: SCENARIO, nodes: [], edges: [] } as never)
  recordBrief(SCENARIO, BRIEF)
  vi.mocked(askAi).mockClear()
  useBriefEditStore.setState({ isOpen: false })
  useAskOlumiStore.setState({ isOpen: false, draft: '', context: '', label: '' })
  useStrengthenStore.setState({ records: {}, priorityOrder: [] } as never)
})
afterEach(() => {
  cleanup()
  useContextIntegrityStore.getState().reset()
  useCanvasStore.setState({ currentScenarioId: null } as never)
})

describe('the pencil sits in the review row, at rest', () => {
  it('beside the framing ask, named as the prototype names it', () => {
    drawTool()
    expect(pencil()).toHaveAttribute('aria-label', BRIEF_EDIT_COPY.open)
    // CONTRAST: it is not the framing ask wearing a new label.
    expect(screen.getByTestId(`${TID}-ask-framing`)).toBeInTheDocument()
    expect(pencil()).not.toHaveAttribute('data-ai')
    // At rest: no form until it is pressed.
    expect(screen.queryByTestId(`${TID}-brief-form`)).toBeNull()
  })
})

describe('the form', () => {
  it('opens prefilled with THIS decision\'s brief, verbatim, under "Your question"', () => {
    drawTool()
    fireEvent.click(pencil())
    expect(pencil()).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByLabelText(BRIEF_EDIT_COPY.label)).toBe(input())
    expect(input().value).toBe(BRIEF)
    expect(document.activeElement).toBe(input())
  })

  it('CONTRAST: a brief recorded for ANOTHER decision is never shown — the field starts empty', () => {
    recordBrief('scn_some_other_decision', 'A different decision entirely')
    drawTool()
    fireEvent.click(pencil())
    expect(input().value).toBe('')
    expect(input()).toHaveAttribute('placeholder', BRIEF_EDIT_COPY.placeholder)
  })

  it('submit hands Olumi a reframing proposal through the ask route, then closes', () => {
    const onAsk = drawTool()
    fireEvent.click(pencil())
    fireEvent.change(input(), { target: { value: '  Should we build the capability in-house at all?  ' } })
    fireEvent.click(screen.getByTestId(`${TID}-brief-send`))
    expect(onAsk).not.toHaveBeenCalled()
    expect(askAi).toHaveBeenCalledTimes(1)
    const payload = vi.mocked(askAi).mock.calls[0][0]
    expect(payload).toEqual({ userWords: 'I propose reframing the question as:\n  Should we build the capability in-house at all?  ' })
    // CONTRAST: not the generic framing ask the row already offered.
    expect(payload).not.toEqual(WHOLE_FRAMING_ASK)
    expect(screen.queryByTestId(`${TID}-brief-form`)).toBeNull()
  })

  it('an empty question sends nothing and keeps the form open', () => {
    const onAsk = drawTool()
    fireEvent.click(pencil())
    fireEvent.change(input(), { target: { value: '   ' } })
    fireEvent.click(screen.getByTestId(`${TID}-brief-send`))
    expect(onAsk).not.toHaveBeenCalled()
    expect(askAi).not.toHaveBeenCalled()
    expect(screen.getByTestId(`${TID}-brief-form`)).toBeInTheDocument()
  })

  it('Cancel closes without asking; Escape does too', () => {
    const onAsk = drawTool()
    fireEvent.click(pencil())
    fireEvent.click(screen.getByTestId(`${TID}-brief-cancel`))
    expect(screen.queryByTestId(`${TID}-brief-form`)).toBeNull()
    fireEvent.click(pencil())
    fireEvent.keyDown(input(), { key: 'Escape' })
    expect(screen.queryByTestId(`${TID}-brief-form`)).toBeNull()
    expect(onAsk).not.toHaveBeenCalled()
    expect(askAi).not.toHaveBeenCalled()
  })

  it('says what happens: a proposal in the chat, and the question is not changed by it', () => {
    drawTool()
    fireEvent.click(pencil())
    expect(screen.getByTestId(`${TID}-brief-note`)).toHaveTextContent('This sends your wording to Olumi for discussion. It does not change your question by itself.')
    // The copy never claims a save it does not make.
    for (const text of Object.values(BRIEF_EDIT_COPY)) {
      if (typeof text !== 'string') continue
      expect(text).not.toMatch(/\b(saved|updated|applied)\b/i)
    }
  })
})

describe('"Edit decision brief" in the Method strip opens the SAME form', () => {
  it('with the review row mounted: the inline form opens, and no drawer', () => {
    render(
      <>
        <MethodStrip activeMethodId={null} onSelectMethod={vi.fn()} />
        <ModelReviewTool interventions={[]} onAsk={vi.fn()} />
      </>,
    )
    fireEvent.click(screen.getByTestId(`${STRIP}-more`))
    fireEvent.click(screen.getByTestId(`${STRIP}-menu-action-edit_brief`))
    expect(screen.getByTestId(`${TID}-brief-form`)).toBeInTheDocument()
    expect(input().value).toBe(BRIEF)
    expect(document.activeElement).toBe(input())
    expect(useAskOlumiStore.getState().isOpen).toBe(false)
  })

  it('CONTRAST: with nothing mounted to show the form, it keeps the shared review-brief ask (never a dead item)', () => {
    render(<MethodStrip activeMethodId={null} onSelectMethod={vi.fn()} />)
    fireEvent.click(screen.getByTestId(`${STRIP}-more`))
    fireEvent.click(screen.getByTestId(`${STRIP}-menu-action-edit_brief`))
    const d = useAskOlumiStore.getState()
    expect(d.isOpen).toBe(true)
    expect(d.draft).toBe(REVIEW_BRIEF_ASK.draft)
    expect(screen.queryByTestId(`${TID}-brief-form`)).toBeNull()
  })

  it('on the mounted Reasoning tab, the strip and the review row reach each other', () => {
    render(
      <AnalysisNewTabBody
        resultsSectionData={genuineDecision()}
        isPreRun={false}
        isRunning={false}
        isStale={false}
        responseHash="run_brief_edit"
      />,
    )
    // At rest, the pencil is on the tab itself.
    expect(pencil()).toBeInTheDocument()
    fireEvent.click(screen.getByTestId(`${STRIP}-more`))
    fireEvent.click(screen.getByTestId(`${STRIP}-menu-action-edit_brief`))
    expect(input().value).toBe(BRIEF)
    expect(useAskOlumiStore.getState().isOpen).toBe(false)
  })
})

/**
 * ⛔ A SCENARIO SWITCH UNDER AN OPEN FORM (review 5818752558, BLOCKING).
 * The form copied the brief into local state and only re-synced when the NEW
 * brief was non-null — so a switch to a decision whose brief had not (yet)
 * resolved left the PREVIOUS decision's question in the field, ready to be sent
 * as this decision's reframe. `contextIntegrityStore.ts` records that exact
 * shape as a shipped P0. The draft now belongs to the scenario it was opened on.
 */
describe('the draft belongs to the decision on screen', () => {
  it('an untouched form does not carry the previous decision\'s brief across a switch', () => {
    drawTool()
    fireEvent.click(pencil())
    expect(input().value, 'PRECONDITION: prefilled with this decision\'s brief').toBe(BRIEF)
    act(() => {
      useCanvasStore.setState({ currentScenarioId: 'scn_other' } as never)
    })
    expect(input().value).toBe('')
  })

  it('nor does a typed draft', () => {
    drawTool()
    fireEvent.click(pencil())
    fireEvent.change(input(), { target: { value: 'A reframing for the first decision' } })
    act(() => {
      useCanvasStore.setState({ currentScenarioId: 'scn_other' } as never)
    })
    expect(input().value).toBe('')
  })

  it('CONTRAST: the next decision\'s own brief prefills once it lands', () => {
    drawTool()
    fireEvent.click(pencil())
    act(() => {
      useCanvasStore.setState({ currentScenarioId: 'scn_other' } as never)
      recordBrief('scn_other', 'Should we open a second office?')
    })
    expect(input().value).toBe('Should we open a second office?')
  })
})

it('a busy reframe retains the exact typed wording and stays open', () => {
  drawTool(); fireEvent.click(pencil())
  const text = '  Keep my unfinished question  '
  fireEvent.change(input(), { target: { value: text } })
  vi.mocked(askAi).mockReturnValueOnce('busy')
  fireEvent.click(screen.getByTestId(`${TID}-brief-send`))
  expect(input()).toHaveValue(text)
  expect(askAi).toHaveBeenCalledWith({ userWords: 'I propose reframing the question as:\n  Keep my unfinished question  ' })
})
