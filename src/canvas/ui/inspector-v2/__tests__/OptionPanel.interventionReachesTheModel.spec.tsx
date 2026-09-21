/**
 * An effect you set on an option must reach the model.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE DEFECT — measured on the founder's board, bundle `95b92672`, 21 Sep
 * ─────────────────────────────────────────────────────────────────────────────
 * **3 of his 5 options carried ZERO interventions**, so the analysis could not
 * tell them apart and the board said so on every card: *"Not in this analysis"*,
 * *"No changes specified"*.
 *
 * This control was the reason. `OptionPanel` called `mutations.setIntervention`
 * — a pure `updateNode` with **0 dispatch symbols** — so an effect the reader
 * set landed in their browser and nowhere else. The SAME edit made in the Model
 * tab reached CEE, because that surface asks
 * `useModelEditAuthority.proposeOptionIntervention`.
 *
 * ⚠⚠ A CLAIM THAT WAS IN THIS HEADER IS WITHDRAWN, AND THE WITHDRAWAL CHANGES
 * WHAT THESE TESTS PROVE. It read *"AND THE CONTROL IS LIVE … `readOnly` …
 * defaults false"*. **False.** `InspectorRouter:542` is
 * `<PanelComponent … readOnly />` — a bare attribute on the AUTHORITY branch —
 * and `InterventionRow` gets `disabled={readOnly}`, rendering the value as TEXT
 * when disabled. **In the app today this control cannot be typed into.**
 *
 * ⭐ THESE TESTS RENDER THE PANEL WITHOUT `readOnly`, WHICH IS A STATE THE
 * DEPLOYMENT DOES NOT CURRENTLY MOUNT — and that is disclosed rather than
 * hidden, because an undisclosed version of it is CLAUDE.md trap 3b, the defect
 * that shipped twice in one feature. What they prove is narrow and still worth
 * proving: WHEN this row is writable, the write reaches the model instead of
 * dying in the browser. The fence exists because it did not; removing the
 * reason for a fence is the step before removing the fence.
 *
 * ⛔ `OptionPanel.readOnlyFence.spec.tsx` is the file that pins the DEPLOYED
 * posture, and it must stay green. If these two files ever disagree about
 * whether the row is writable, that one is right.
 *
 * ⛔ Contrast `factor-observable`, absent from `AUTHORITY_OWNING_PANELS`
 * entirely and inert for a different reason — no carrier at all. That one is
 * NOT a defect and must not be "fixed" by this pattern.
 *
 * ⚠ NOTHING NEW IS INVENTED. `option_intervention_edit` (schemas 0.54.0) ships
 * end to end — the event builder, the payload arm, and the authority's guards.
 * One surface is pointed at the owner the other already used, and the
 * authority's stale "no server carrier" header is corrected in the same change.
 *
 * ⛔ NO LOCAL STORE WRITE, by the authority's ruling: *"the goal draft never
 * changes the store before a real applied response."* The applied `graph_patch`
 * owns it. The row therefore keeps a PENDING value of its own — the same shape
 * `EdgePanel` uses for `localStrength` — because without it the number visibly
 * snaps back on every edit, which reads as a broken control and is a worse lie
 * than the one being fixed.
 *
 * CLAIM SCOPE (trap 3): jsdom assertions prove DISPATCH and TEXT, never layout.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, cleanup, screen, fireEvent } from '@testing-library/react'
import type { Node } from '@xyflow/react'

const sendSystemEvent = vi.fn()

vi.mock('../../../conversation/ConversationContext', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return { ...actual, useOptionalConversationContext: () => ({ sendSystemEvent }) }
})

import { OptionPanel } from '../panels/OptionPanel'
import { useCanvasStore } from '../../../store'

const OPTION_ID = 'opt_hire_manager'
const FACTOR_ID = 'fac_founder_time'
const noop = () => {}

/** `base_graph_hash` is REQUIRED by the builder; without it the edit refuses. */
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
            interventions: { [FACTOR_ID]: 0.2 },
          },
        } as unknown as Node,
        {
          id: FACTOR_ID,
          type: 'factor',
          position: { x: 0, y: 0 },
          data: {
            label: 'Founder Time Commitment',
            kind: 'factor',
            category: 'controllable',
            observedState: { value: 0.2, source: 'cee_inference' },
          },
        } as unknown as Node,
      ],
      edges: [{ id: 'e1', source: OPTION_ID, target: FACTOR_ID, data: {} }],
      results: { status: 'idle', report: null },
      lastServerGraphHash: graphHash,
    } as never,
    false,
  )
}

const renderPanel = () =>
  render(<OptionPanel nodeId={OPTION_ID} techMode={false} onClose={noop} onNavigate={noop} />)

/**
 * The intervention input for OUR factor — found inside that row's own testid,
 * never by scanning every input on the panel. Bound by identity (trap 19): a
 * type-only finder would happily return a different row's box.
 *
 * `InterventionRow` renders `type="text"` and commits on BLUR (`:245`), so the
 * gesture below is change-then-blur, not change alone.
 */
function interventionInput(): HTMLInputElement {
  const row = document.querySelector(`[data-testid="inspector-intervention-${FACTOR_ID}"]`)
  expect(row, 'the option panel rendered no row for this factor').toBeTruthy()
  const n = row!.querySelector('input')
  expect(n, 'the row rendered no editable input — is it disabled?').toBeTruthy()
  return n as HTMLInputElement
}

describe('an effect set on an option reaches the model', () => {
  beforeEach(() => {
    sendSystemEvent.mockClear()
    seed()
  })
  afterEach(() => cleanup())

  it('⭐ dispatches an option_intervention_edit — RED at pristine, where nothing was sent', () => {
    renderPanel()
    const input = interventionInput()
    fireEvent.change(input, { target: { value: '0.8' } })
    fireEvent.blur(input)

    expect(sendSystemEvent).toHaveBeenCalled()
    const kinds = sendSystemEvent.mock.calls.map((c) => (c[0] as { type?: string })?.type)
    expect(kinds).toContain('option_intervention_edit')
  })

  it('the dispatched event is ID-ADDRESSED to this option AND this factor', () => {
    renderPanel()
    const input = interventionInput()
    fireEvent.change(input, { target: { value: '0.8' } })
    fireEvent.blur(input)

    const call = sendSystemEvent.mock.calls.find(
      (c) => (c[0] as { type?: string })?.type === 'option_intervention_edit',
    )
    expect(call, 'no option_intervention_edit was sent').toBeTruthy()
    const payload = (call![0] as { payload?: Record<string, unknown> }).payload ?? {}
    // Bound by IDENTITY, never by a value another row could satisfy (trap 19).
    expect(payload.option_id).toBe(OPTION_ID)
    expect(payload.factor_id).toBe(FACTOR_ID)
  })

  it('⛔ DISCLOSES the refusal instead of failing silently, when there is no fresh base', () => {
    // A restore reads persistence with no CEE turn, so `lastServerGraphHash` is
    // null — the one refusal the reader CAN clear, and the authority's header
    // instructs the caller to say so rather than swallow it.
    seed({ graphHash: null })
    renderPanel()
    const input = interventionInput()
    fireEvent.change(input, { target: { value: '0.8' } })
    fireEvent.blur(input)

    const notice = screen.getByTestId('option-intervention-notice')
    expect(notice.textContent ?? '').toMatch(/not sent/i)
    // It must name the recovery, because this refusal has one.
    expect(notice.textContent ?? '').toMatch(/ask it anything|then set this again/i)
  })

  it('CONTRAST — no notice on the happy path, so the notice is not simply always on', () => {
    renderPanel()
    const input = interventionInput()
    fireEvent.change(input, { target: { value: '0.8' } })
    fireEvent.blur(input)
    expect(screen.queryByTestId('option-intervention-notice')).toBeNull()
  })
})
