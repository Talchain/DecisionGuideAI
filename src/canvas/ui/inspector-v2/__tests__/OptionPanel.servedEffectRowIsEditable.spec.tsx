/**
 * The option card says "3 factor targets. Open the inspector to change them."
 * This file asserts that the inspector it opens can in fact change them — on
 * the shape the served board actually holds — and that a change which does not
 * land stops being shown.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * MEASURED on served `28d2745e`, guest, saved pricing example, `opt_hybrid`:
 * ─────────────────────────────────────────────────────────────────────────────
 * every intervention carries a CEE `display_value` —
 * `{ value: 0.5, source: 'brief_extraction', display_value: 'Moderate (0.5)' }`
 * — and every `inspector-intervention-*` row rendered **0 inputs**. The row's
 * `disabled` is `false` (lifted by #1822); the fence the reader hit is
 * `showNumericSurface = !hasDisplayValue || techMode`, which hides the only
 * editor whenever the producer wrote prose. `OptionPanel.interventionReachesTheModel`
 * seeds BARE numbers, the one shape the served board does not have, so it stayed
 * green over a dead end.
 *
 * The carrier behind the row is real and was witnessed on the same build: the
 * Model tab's editor, which calls the same `proposeOptionIntervention`, moved
 * `opt_hybrid / fac_usage_exposure` 0.5 → 0.6 and the applied receipt carried
 * it into the store.
 *
 * ⛔ AND A PENDING NUMBER MUST BE ABLE TO END. `settleSystemEventSend`'s own
 * header: *"a caller that renders a pending state MUST pass it, or that state
 * has no way to end."* `useOptionInterventionCommit` rendered `pending` and
 * passed nothing, so a refused edit went on showing the number the model had
 * just declined. The cases below drive each settlement through the real panel.
 *
 * Bound by identity throughout: the option id, the factor id, and the exact
 * value sent. CLAIM SCOPE: jsdom proves dispatch and text, never layout.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, cleanup, screen, fireEvent, act, within } from '@testing-library/react'
import type { Node } from '@xyflow/react'

const sendSystemEvent = vi.fn()

vi.mock('../../../conversation/ConversationContext', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return { ...actual, useOptionalConversationContext: () => ({ sendSystemEvent }) }
})

import { OptionPanel } from '../panels/OptionPanel'
import { InterventionRow } from '../shared/InterventionRow'
import { INSPECTOR_OPTION_READ_ONLY_REASON } from '../useInspectorMutations'
import { useCanvasStore } from '../../../store'
import { SEND_BLOCKED, SystemEventSendError } from '../../../conversation/useConversation'

const OPTION_ID = 'opt_hybrid'
const FACTOR_ID = 'fac_usage_exposure'
const FACTOR_LABEL = 'Usage-Based Pricing Exposure'
const noop = () => {}

/** The served shape, verbatim from the store on `28d2745e`. */
const SERVED_ENTRY = { value: 0.5, source: 'brief_extraction', display_value: 'Moderate (0.5)' }

function seed(entry: unknown = SERVED_ENTRY) {
  useCanvasStore.setState(
    {
      nodes: [
        {
          id: OPTION_ID,
          type: 'option',
          position: { x: 0, y: 0 },
          data: { label: 'Hybrid Platform Fee Plus Usage', kind: 'option', interventions: { [FACTOR_ID]: entry } },
        } as unknown as Node,
        {
          id: FACTOR_ID,
          type: 'factor',
          position: { x: 0, y: 0 },
          data: {
            label: FACTOR_LABEL,
            kind: 'factor',
            category: 'controllable',
            observedState: { value: 0.3, source: 'brief_extraction' },
          },
        } as unknown as Node,
      ],
      edges: [{ id: 'e1', source: OPTION_ID, target: FACTOR_ID, data: {} }],
      results: { status: 'idle', report: null },
      lastServerGraphHash: '90323858c4d69153',
      currentScenarioId: 'scn-1',
    } as never,
    false,
  )
}

/** Sets this option's entry for this factor, as an applied receipt (or a chat edit) would. */
function storeSets(entry: unknown) {
  act(() => {
    useCanvasStore.setState({
      nodes: useCanvasStore.getState().nodes.map(n =>
        n.id === OPTION_ID
          ? { ...n, data: { ...n.data, interventions: { [FACTOR_ID]: entry } } }
          : n,
      ),
    } as never)
  })
}

/** `readOnly` passed exactly as `InspectorRouter` passes it to an authority-owning pane. */
const renderPanel = () =>
  render(<OptionPanel nodeId={OPTION_ID} techMode={false} onClose={noop} onNavigate={noop} readOnly />)

const row = () => {
  const r = screen.getByTestId(`inspector-intervention-${FACTOR_ID}`)
  return r
}

/** Open the editor from the served (prose) row, set a value, and commit on blur. */
function editTo(value: string) {
  const open = within(row()).queryByRole('button', { name: `Change the target for ${FACTOR_LABEL}` })
  if (open) fireEvent.click(open)
  const input = within(row()).getByRole('textbox')
  fireEvent.change(input, { target: { value } })
  fireEvent.blur(input)
}

const flush = () => act(async () => { await Promise.resolve(); await Promise.resolve() })

function sentEvents() {
  return sendSystemEvent.mock.calls
    .map(c => c[0] as { type?: string; payload?: Record<string, unknown> })
    .filter(e => e?.type === 'option_intervention_edit')
}

describe('the served option row: a target carrying display_value can be changed from the pane', () => {
  beforeEach(() => {
    sendSystemEvent.mockReset()
    sendSystemEvent.mockResolvedValue(undefined)
    seed()
  })
  afterEach(() => cleanup())

  it('⭐ offers a control on the prose target, and it opens an editor seeded from the MODEL value, not the prose', () => {
    renderPanel()
    // The prose stays the thing a reader sees first.
    expect(row()).toHaveTextContent('Moderate (0.5)')
    expect(within(row()).queryByRole('textbox'), 'no raw editor before the reader asks for one').toBeNull()

    const open = within(row()).getByRole('button', { name: `Change the target for ${FACTOR_LABEL}` })
    fireEvent.click(open)
    const input = within(row()).getByRole('textbox') as HTMLInputElement
    expect(input.value).toBe('0.5')
  })

  it('⭐ the change is sent as option_intervention_edit, addressed to THIS option and THIS factor with the exact value', () => {
    renderPanel()
    editTo('0.6')
    const events = sentEvents()
    expect(events).toHaveLength(1)
    expect(events[0].payload).toMatchObject({ option_id: OPTION_ID, factor_id: FACTOR_ID, value: 0.6 })
  })

  it('while in flight the row shows the number sent, not the prose it replaces', async () => {
    // Genuinely in flight: the turn has not been processed yet.
    sendSystemEvent.mockImplementation(() => new Promise(() => undefined))
    renderPanel()
    editTo('0.6')
    await flush()
    expect(row()).not.toHaveTextContent('Moderate (0.5)')
    expect((within(row()).getByRole('textbox') as HTMLInputElement).value).toBe('0.6')
  })

  it('⛔ ESCAPE CANCELS — nothing is sent, and the prose comes back', () => {
    // Measured before this case existed: the Escape handler reset the draft and
    // blurred, but the blur ran the commit with the TYPED value still in its
    // closure, so "cancel" sent the number the reader was abandoning.
    renderPanel()
    fireEvent.click(within(row()).getByRole('button', { name: `Change the target for ${FACTOR_LABEL}` }))
    const input = within(row()).getByRole('textbox') as HTMLInputElement
    input.focus()
    fireEvent.change(input, { target: { value: '0.9' } })
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(sentEvents()).toHaveLength(0)
    expect(row()).toHaveTextContent('Moderate (0.5)')
  })

  it('CONTRAST — Enter commits the same typed value Escape abandons', () => {
    renderPanel()
    fireEvent.click(within(row()).getByRole('button', { name: `Change the target for ${FACTOR_LABEL}` }))
    const input = within(row()).getByRole('textbox') as HTMLInputElement
    input.focus()
    fireEvent.change(input, { target: { value: '0.9' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(sentEvents().map(e => e.payload?.value)).toEqual([0.9])
  })

  it('⛔ a disabled row offers no control — the reveal never outranks a fence', () => {
    render(
      <InterventionRow
        factorId={FACTOR_ID}
        factorLabel={FACTOR_LABEL}
        currentValue={0.5}
        displayValue="Moderate (0.5)"
        onChange={noop}
        disabled
      />,
    )
    expect(screen.queryByRole('button', { name: `Change the target for ${FACTOR_LABEL}` })).toBeNull()
    expect(screen.queryByRole('textbox')).toBeNull()
  })
})

describe('a pending effect ends — confirmed by the store, or reverted with a notice', () => {
  beforeEach(() => {
    sendSystemEvent.mockReset()
    seed(0.2)
  })
  afterEach(() => cleanup())

  const shown = () => (within(row()).getByRole('textbox') as HTMLInputElement).value

  it('⛔ REFUSED (proven no-write): the unsaved number is withdrawn and the refusal is said', async () => {
    sendSystemEvent.mockRejectedValue(new SystemEventSendError('server', { conflictCategory: 'stale_base_graph_hash' }))
    renderPanel()
    editTo('0.8')
    await flush()
    expect(shown()).toBe('0.2')
    expect(screen.getByTestId('option-intervention-notice').textContent ?? '').toMatch(/not saved/i)
  })

  it('⛔ BLOCKED (busy lock): withdrawn, and the notice names the lock rather than a refusal', async () => {
    sendSystemEvent.mockResolvedValue(SEND_BLOCKED)
    renderPanel()
    editTo('0.8')
    await flush()
    expect(shown()).toBe('0.2')
    expect(screen.getByTestId('option-intervention-notice').textContent ?? '').toMatch(/another change is still in flight/i)
  })

  it('⛔ UNVERIFIED (transport): withdrawn, and the notice claims neither saved nor unsaved', async () => {
    sendSystemEvent.mockRejectedValue(new SystemEventSendError('transport'))
    renderPanel()
    editTo('0.8')
    await flush()
    expect(shown()).toBe('0.2')
    const text = screen.getByTestId('option-intervention-notice').textContent ?? ''
    expect(text).toMatch(/could not confirm/i)
    expect(text).not.toMatch(/not saved|saved to/i)
  })

  it('⛔ SENT, TURN DONE, VALUE NOT IN THE MODEL: CEE answered without applying it — withdrawn, and said', async () => {
    // `sendSystemEvent` resolves only after `sendTurn` has processed the reply,
    // and an applied `option_intervention_edit` always carries its committed
    // `draft_graph`, which that processing reconciles into the store. So a send
    // that settled with the store NOT holding the number is CEE's 200 refusal
    // (`refused_no_write`). Before this, the unsaved number stayed on screen
    // until some unrelated store change (lane note, 22 Sep).
    sendSystemEvent.mockResolvedValue(undefined)
    renderPanel()
    editTo('0.8')
    await flush()
    expect(shown()).toBe('0.2')
    expect(screen.getByTestId('option-intervention-notice').textContent ?? '').toMatch(/not saved/i)
  })

  it('CONTRAST — SENT with the receipt applied before the send settles: no notice, the row follows the record', async () => {
    sendSystemEvent.mockImplementation(async () => {
      useCanvasStore.setState({
        nodes: useCanvasStore.getState().nodes.map(n =>
          n.id === OPTION_ID
            ? { ...n, data: { ...n.data, interventions: { [FACTOR_ID]: { value: 0.8, source: 'user_specified' } } } }
            : n,
        ),
      } as never)
      return undefined
    })
    renderPanel()
    editTo('0.8')
    await flush()
    expect(shown()).toBe('0.8')
    expect(screen.queryByTestId('option-intervention-notice')).toBeNull()
  })

  it('⭐ APPLIED: once the store carries the sent value the row follows the RECORD, so a later change shows', async () => {
    let finish!: () => void
    sendSystemEvent.mockImplementation(() => new Promise<void>(r => { finish = r }))
    renderPanel()
    editTo('0.8')
    await flush()
    storeSets(0.8) // the applied receipt, while the turn is still being processed
    await act(async () => { finish(); await Promise.resolve() })
    storeSets(0.3) // a later chat edit to the same target
    expect(shown()).toBe('0.3')
  })

  it('CONTRAST — a receipt for a DIFFERENT value does not confirm this send (while in flight)', async () => {
    sendSystemEvent.mockImplementation(() => new Promise<void>(() => undefined))
    renderPanel()
    editTo('0.8')
    await flush()
    storeSets(0.7)
    expect(shown()).toBe('0.8')
  })
})

describe('the pane notice beside a live target writer', () => {
  it('does not call every non-name field read-only — it says what a target change does', () => {
    expect(INSPECTOR_OPTION_READ_ONLY_REASON).toMatch(/target/i)
  })
})
