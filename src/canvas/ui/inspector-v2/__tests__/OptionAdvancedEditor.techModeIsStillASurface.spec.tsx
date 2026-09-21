/**
 * The tech-mode intervention rows reach the model too.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY THIS EXISTS SEPARATELY FROM `OptionPanel.interventionReachesTheModel`
 * ─────────────────────────────────────────────────────────────────────────────
 * The option-effect defect had TWO writers, not one. `OptionPanel:487` was the
 * one measured on the founder's board; `OptionAdvancedEditor:66` was the same
 * `mutations.setIntervention` call on the tech-mode surface, and a fix that
 * landed on only the first would have left a control that silently does
 * nothing — the same defect wearing a different face.
 *
 * ⚠ A THIRD writer was examined and LEFT LOCAL DELIBERATELY:
 * `OptionPanel.handleAddFactor:370` seeds a new row at the factor's own
 * baseline. Dispatching `baseline ?? 0` would assert an effect nobody stated,
 * and the product's own copy already says so (*"Linked to 3 factors below, but
 * no change values are set yet"*). ⛔ Do not "complete" the fix by wiring it.
 *
 * The two live writers now share ONE owner — `useOptionInterventionCommit` —
 * so the dispatch decision, the pending value and the refusal copy cannot
 * drift into two versions of one refusal.
 *
 * CLAIM SCOPE (trap 3): jsdom proves DISPATCH and TEXT, never layout.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, cleanup, screen, fireEvent } from '@testing-library/react'
import type { Node } from '@xyflow/react'

const sendSystemEvent = vi.fn()

vi.mock('../../../conversation/ConversationContext', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return { ...actual, useOptionalConversationContext: () => ({ sendSystemEvent }) }
})

import { OptionAdvancedEditor } from '../editors/OptionAdvancedEditor'
import { useCanvasStore } from '../../../store'

const OPTION_ID = 'opt_hire_manager'
const TARGET_FACTOR = 'fac_founder_time'
const OTHER_FACTOR = 'fac_lead_volume'

function seed({ graphHash = 'gh-1' }: { graphHash?: string | null } = {}) {
  useCanvasStore.setState(
    {
      nodes: [
        {
          id: OPTION_ID,
          type: 'option',
          position: { x: 0, y: 0 },
          data: {
            label: 'Hire a Marketing Manager',
            kind: 'option',
            // TWO rows on purpose: a payload assertion that reads the right
            // factor id by accident is not a binding (trap 19).
            interventions: { [TARGET_FACTOR]: 0.2, [OTHER_FACTOR]: 0.4 },
          },
        } as unknown as Node,
        {
          id: TARGET_FACTOR,
          type: 'factor',
          position: { x: 0, y: 0 },
          data: {
            label: 'Founder Time Commitment',
            kind: 'factor',
            category: 'controllable',
            observedState: { value: 0.2, source: 'cee_inference' },
          },
        } as unknown as Node,
        {
          id: OTHER_FACTOR,
          type: 'factor',
          position: { x: 0, y: 0 },
          data: {
            label: 'Inbound Lead Volume',
            kind: 'factor',
            category: 'controllable',
            observedState: { value: 0.4, source: 'cee_inference' },
          },
        } as unknown as Node,
      ],
      edges: [],
      results: { status: 'idle', report: null },
      lastServerGraphHash: graphHash,
    } as never,
    false,
  )
}

/**
 * The input belonging to ONE named factor's row, reached through that factor's
 * own visible label rather than by taking the first input on the panel.
 * `AdvancedField` renders `type="text"` and commits on BLUR.
 */
function rowInput(factorLabel: string): HTMLInputElement {
  const labels = Array.from(document.querySelectorAll('div')).filter(
    (d) => d.textContent?.trim() === factorLabel && d.children.length === 0,
  )
  expect(labels.length, `no row rendered for "${factorLabel}"`).toBe(1)
  const row = labels[0].parentElement
  const input = row?.querySelector('input')
  expect(input, `the row for "${factorLabel}" rendered no editable input`).toBeTruthy()
  return input as HTMLInputElement
}

const edit = (factorLabel: string, value: string) => {
  const input = rowInput(factorLabel)
  fireEvent.change(input, { target: { value } })
  fireEvent.blur(input)
}

describe('the tech-mode intervention rows reach the model', () => {
  beforeEach(() => {
    sendSystemEvent.mockClear()
    seed()
  })
  afterEach(() => cleanup())

  it('⭐ dispatches an option_intervention_edit — RED at pristine, where this surface wrote locally', () => {
    render(<OptionAdvancedEditor nodeId={OPTION_ID} />)
    edit('Founder Time Commitment', '0.8')

    const kinds = sendSystemEvent.mock.calls.map((c) => (c[0] as { type?: string })?.type)
    expect(kinds).toContain('option_intervention_edit')
  })

  it('addresses the event to the row the reader typed in, not merely to some row', () => {
    render(<OptionAdvancedEditor nodeId={OPTION_ID} />)
    edit('Inbound Lead Volume', '0.9')

    const call = sendSystemEvent.mock.calls.find(
      (c) => (c[0] as { type?: string })?.type === 'option_intervention_edit',
    )
    expect(call, 'no option_intervention_edit was sent').toBeTruthy()
    const payload = (call![0] as { payload?: Record<string, unknown> }).payload ?? {}
    expect(payload.option_id).toBe(OPTION_ID)
    expect(payload.factor_id).toBe(OTHER_FACTOR)
  })

  it('⛔ says the refusal out loud here too, when there is no fresh base', () => {
    seed({ graphHash: null })
    render(<OptionAdvancedEditor nodeId={OPTION_ID} />)
    edit('Founder Time Commitment', '0.8')

    const notice = screen.getByTestId('option-advanced-intervention-notice')
    expect(notice.textContent ?? '').toMatch(/not sent/i)
    expect(notice.textContent ?? '').toMatch(/ask it anything|then set this again/i)
  })

  it('CONTRAST — silent on the happy path, so the notice is not simply always on', () => {
    render(<OptionAdvancedEditor nodeId={OPTION_ID} />)
    edit('Founder Time Commitment', '0.8')
    expect(screen.queryByTestId('option-advanced-intervention-notice')).toBeNull()
  })
})
