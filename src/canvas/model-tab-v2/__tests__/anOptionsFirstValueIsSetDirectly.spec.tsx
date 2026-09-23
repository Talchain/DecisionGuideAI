/**
 * ⭐⭐ AN OPTION'S FIRST EFFECT VALUE IS SET DIRECTLY — not only by a sentence
 * typed to Olumi.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE USER PROBLEM (Paul's manual test, 23 Sep 2026)
 * ─────────────────────────────────────────────────────────────────────────────
 * Paul added an option ("Reduce Feature Scope") and gave its size four times in
 * chat. It was never analysed, because it had no effect values. The Model tab's
 * options section told him, in so many words, that the value "cannot be set
 * from this section" and sent him back to chat.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE CONTRACT THIS BINDS TO
 * ─────────────────────────────────────────────────────────────────────────────
 * CEE `src/orchestrator-v5/system-events/option-intervention-edit.ts`
 * (`prepareOptionInterventionEdit`, CEE staging `140917d0`) prepares a write
 * when the option has NO existing intervention for the factor, provided
 * `linkedFactorsOf(graph, option)` includes it — an option→factor edge. The
 * UI's equivalent reader is `buildOptionInterventionCandidates` (edge source is
 * the option, target is a factor, deduped). So the input is offered for exactly
 * the linked factors with no value, and for no other factor.
 *
 * Every case drives the REAL panel against the REAL store subscription (see
 * `interventionRowTellsTheTruth.spec.tsx` for why a fixed-props render cannot
 * witness a settlement).
 *
 * CLAIM SCOPE (trap 3): jsdom proves PRESENCE, DISPATCH ARGUMENTS, TEXT and
 * FOCUS — never layout.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { Edge, Node } from '@xyflow/react'

const sendSystemEvent = vi.fn().mockResolvedValue(undefined)
vi.mock('../../conversation/ConversationContext', async importOriginal => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useOptionalConversationContext: () => ({ sendSystemEvent }),
}))
vi.mock('../../utils/focusHelpers', () => ({ focusNodeById: vi.fn(), focusEdgeById: vi.fn() }))

import { useCanvasStore } from '../../store'
import { SystemEventSendError } from '../../conversation/useConversation'
import { formatValueWithUnit } from '../../components/model-tab/utils'
import { ModelTabV2Panel } from '../ModelTabV2Panel'
import { SECTION_WRITER_NOTICE_TESTID } from '../sectionWriterNotice'
import { openOutlineGroups } from './openOutlineGroups'

const OPTION = 'opt_reduce_scope'
const OTHER_OPTION = 'opt_hold'
const UNLINKED_OPTION = 'opt_outsource'
/** Linked to OPTION, carries a user-supplied value with a unit. */
const F_A = 'fac_delivery_cost'
/** Linked to OPTION, carries no value at all. */
const F_B = 'fac_team_capacity'
/** Linked ONLY from ANOTHER option — so a loosened link test would leak it. */
const F_C = 'fac_market_size'
/** Linked from nothing. */
const F_D = 'fac_morale'
const HASH = '9f2c1b0ae4d37c5a'

function nodes(optionData: Record<string, unknown> = {}): Node[] {
  return [
    {
      id: F_A, type: 'factor', position: { x: 0, y: 0 },
      data: {
        label: 'Delivery cost',
        kind: 'factor',
        observedState: { value: 0.4, raw_value: 20000, unit: '£', source: 'user' },
      },
    },
    { id: F_B, type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Team capacity', kind: 'factor' } },
    { id: F_C, type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Market size', kind: 'factor' } },
    { id: F_D, type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Team morale', kind: 'factor' } },
    {
      id: OPTION, type: 'option', position: { x: 0, y: 0 },
      data: { label: 'Reduce Feature Scope', kind: 'option', ...optionData },
    },
    {
      id: OTHER_OPTION, type: 'option', position: { x: 0, y: 0 },
      data: { label: 'Hold', kind: 'option', interventions: { [F_C]: 0.5 } },
    },
  ] as unknown as Node[]
}

const edge = (id: string, source: string, target: string): Edge =>
  ({ id, source, target, data: {} }) as Edge

function edges(): Edge[] {
  return [edge('e1', OPTION, F_A), edge('e2', OPTION, F_B), edge('e3', OTHER_OPTION, F_C)]
}

function StoreBoundPanel({ handOff }: { handOff?: (m: string, r: string) => void }) {
  const storeNodes = useCanvasStore(s => s.nodes)
  const storeEdges = useCanvasStore(s => s.edges)
  const scenarioId = useCanvasStore(s => s.currentScenarioId)
  const baseHash = useCanvasStore(s => s.lastServerGraphHash)
  return (
    <ModelTabV2Panel
      nodes={storeNodes as Node[]}
      edges={storeEdges as Edge[]}
      goalThreshold={null}
      currentScenarioId={scenarioId}
      lastServerGraphHash={baseHash}
      onHandOffToOlumi={handOff}
    />
  )
}

function renderPanel(
  opts: { optionData?: Record<string, unknown>; extraNodes?: Node[]; handOff?: (m: string, r: string) => void } = {},
) {
  useCanvasStore.setState(
    {
      nodes: [...nodes(opts.optionData), ...(opts.extraNodes ?? [])],
      edges: edges(),
      lastServerGraphHash: HASH,
      currentScenarioId: 'scn_1',
    } as never,
    false,
  )
  render(<StoreBoundPanel handOff={opts.handOff} />)
  openOutlineGroups()
}

function selectOption(id = OPTION) {
  fireEvent.click(screen.getByTestId(`model-row-v2-${id}`))
}

const input = (factorId: string) =>
  screen.getByTestId(`model-detail-v2-intervention-${factorId}-input`) as HTMLInputElement

/** Type into the factor's input and press its Save — the real gesture, no opening click. */
function setFirstValue(factorId: string, value: string) {
  fireEvent.change(input(factorId), { target: { value } })
  fireEvent.click(screen.getByTestId(`model-detail-v2-intervention-${factorId}-save`))
}

beforeEach(() => {
  vi.clearAllMocks()
  sendSystemEvent.mockResolvedValue(undefined)
})
afterEach(() => cleanup())

describe('⭐ the input is there, on the option that needs it', () => {
  it('⭐ an option with a linked factor and NO effect values shows an input per linked factor — no click to open it', () => {
    renderPanel()
    selectOption()

    // Both linked factors, and the value box is already an input.
    expect(input(F_A).value).toBe('')
    expect(input(F_B).value).toBe('')
    // The question names the option and the factor, never their ids.
    const question = screen.getByTestId(`model-detail-v2-intervention-${F_B}-question`)
    expect(question.textContent).toBe('What does Reduce Feature Scope change Team capacity to?')
    expect(question.textContent).not.toContain(OPTION)
    expect(question.textContent).not.toContain(F_B)
  })

  it('shows the factor’s current value, with its unit, for reference — the SAME value the factor row shows', () => {
    renderPanel()
    selectOption()
    const reference = screen.getByTestId(`model-detail-v2-intervention-${F_A}-reference`)
    // Derived through the formatter the factor row itself uses, never re-typed.
    expect(reference.textContent).toContain(formatValueWithUnit(20000, '£'))
    // And the number on the scale the input takes, so the reader can answer.
    expect(reference.textContent).toContain('0.4')
    // CONTRAST: a factor with nothing recorded gets no invented reference.
    expect(screen.queryByTestId(`model-detail-v2-intervention-${F_B}-reference`)).toBeNull()
  })

  it('⛔ CONTROL — NO input for a factor the option is not linked to', () => {
    renderPanel()
    selectOption()
    // POSITIVE CONTROL in the same render, so the absences below are about
    // linkage and not about "no inputs render at all".
    expect(input(F_B)).toBeTruthy()
    // F_C has a real edge — from ANOTHER option. F_D has none.
    expect(screen.queryByTestId(`model-detail-v2-intervention-${F_C}-input`)).toBeNull()
    expect(screen.queryByTestId(`model-detail-v2-intervention-${F_D}-input`)).toBeNull()
    expect(screen.queryByTestId(`model-detail-v2-intervention-${F_C}-question`)).toBeNull()
  })

  it('⛔ CONTROL — once a value exists, the EXISTING editor shows for it, not the new input', () => {
    renderPanel({ optionData: { interventions: { [F_A]: 0.3 } } })
    selectOption()
    // F_A has a value: the existing row's value control, no question, no empty input.
    expect(screen.getByTestId(`model-detail-v2-intervention-${F_A}-value`).textContent).toBe('0.3')
    expect(screen.queryByTestId(`model-detail-v2-intervention-${F_A}-question`)).toBeNull()
    expect(screen.queryByTestId(`model-detail-v2-intervention-${F_A}-input`)).toBeNull()
    // F_B is still empty and linked, so it keeps its input.
    expect(screen.getByTestId(`model-detail-v2-intervention-${F_B}-question`)).toBeTruthy()
  })
})

describe('⭐ Save sends the one typed event, for the right factor', () => {
  it('⭐ dispatches `option_intervention_edit` with the exact payload — option, factor, value, base hash', () => {
    renderPanel()
    selectOption()
    // F_B is the SECOND candidate: a Save that sent "the first factor" or the
    // wrong row's id would fail this by identity (trap 19).
    setFirstValue(F_B, '0.6')

    expect(sendSystemEvent).toHaveBeenCalledTimes(1)
    expect(sendSystemEvent.mock.calls[0]?.[0]).toEqual({
      type: 'option_intervention_edit',
      payload: { option_id: OPTION, factor_id: F_B, value: 0.6, base_graph_hash: HASH },
    })
    expect(sendSystemEvent.mock.calls[0]?.[1]).toEqual({ deferIfBusy: false })
  })

  it('an empty input sends nothing — Save is not live until there is a number', () => {
    renderPanel()
    selectOption()
    const save = screen.getByTestId(`model-detail-v2-intervention-${F_B}-save`) as HTMLButtonElement
    expect(save.disabled).toBe(true)
    fireEvent.click(save)
    expect(sendSystemEvent).not.toHaveBeenCalled()
  })

  it('reuses the existing scale rule: off the 0–1 model scale, nothing is sent and the row says so', () => {
    renderPanel()
    selectOption()
    setFirstValue(F_B, '12')
    expect(sendSystemEvent).not.toHaveBeenCalled()
    expect(
      screen.getByTestId(`model-detail-v2-intervention-${F_B}-notice`).textContent ?? '',
    ).toMatch(/between 0 and 1/i)
  })
})

describe('⭐ the truth states — nothing is claimed before the receipt', () => {
  it('⭐ PENDING — "sent, not saved yet", and NO provenance, NO value, before the receipt', async () => {
    renderPanel()
    selectOption()
    setFirstValue(F_B, '0.6')

    const pending = await screen.findByTestId(`model-detail-v2-intervention-${F_B}-pending`)
    expect(pending.textContent ?? '').toMatch(/sent, not saved yet/i)
    const row = screen.getByTestId(`model-detail-v2-intervention-${F_B}`)
    expect(row.textContent ?? '').not.toMatch(/user edited|set by you|confirmed by you/i)
    expect(screen.queryByTestId(`model-detail-v2-intervention-${F_B}-value`)).toBeNull()
    // The store is untouched: the applied response owns that write.
    const option = useCanvasStore.getState().nodes.find(n => n.id === OPTION)
    expect((option?.data as { interventions?: unknown }).interventions).toBeUndefined()
  })

  it('⭐ APPLIED — when the receipt lands the value shows, marked as the user’s own', async () => {
    renderPanel()
    selectOption()
    setFirstValue(F_B, '0.6')
    await screen.findByTestId(`model-detail-v2-intervention-${F_B}-pending`)

    // The committed graph arriving: CEE writes `source: 'user_specified'`.
    const applied = nodes({ interventions: { [F_B]: { value: 0.6, source: 'user_specified' } } })
    await act(async () => {
      useCanvasStore.setState({ nodes: applied } as never, false)
    })

    expect(screen.getByTestId(`model-detail-v2-intervention-${F_B}-value`).textContent).toBe('0.6')
    expect(
      screen.getByTestId(`model-detail-v2-intervention-${F_B}-provenance`).textContent,
    ).toBe('User edited')
    expect(screen.queryByTestId(`model-detail-v2-intervention-${F_B}-pending`)).toBeNull()
    expect(screen.queryByTestId(`model-detail-v2-intervention-${F_B}-question`)).toBeNull()
  })

  it('⭐ REFUSED — the named reason, the input restored, nothing claimed', async () => {
    sendSystemEvent.mockRejectedValue(
      new SystemEventSendError('server', { conflictCategory: 'stale_base_graph_hash' }),
    )
    renderPanel()
    selectOption()
    setFirstValue(F_B, '0.6')

    const notice = await screen.findByTestId(`model-detail-v2-intervention-${F_B}-notice`)
    expect(notice.textContent ?? '').toMatch(/not saved/i)
    expect(notice.textContent ?? '').toMatch(/moved on/i)
    // Restored: the input is back, holding what the user typed.
    expect(input(F_B).value).toBe('0.6')
    expect(screen.queryByTestId(`model-detail-v2-intervention-${F_B}-pending`)).toBeNull()
    // Nothing claimed.
    expect(screen.queryByTestId(`model-detail-v2-intervention-${F_B}-value`)).toBeNull()
    expect(
      screen.getByTestId(`model-detail-v2-intervention-${F_B}`).textContent ?? '',
    ).not.toMatch(/user edited|set by you/i)
  })

  it('UNCONFIRMED — a failure with no no-write guarantee says it could not confirm', async () => {
    sendSystemEvent.mockRejectedValue(
      new SystemEventSendError('server', { code: 'INGRESS_CONTRACT_VIOLATION' }),
    )
    renderPanel()
    selectOption()
    setFirstValue(F_B, '0.6')

    const notice = await screen.findByTestId(`model-detail-v2-intervention-${F_B}-notice`)
    expect(notice.textContent ?? '').toMatch(/could not confirm/i)
    expect(notice.textContent ?? '').not.toMatch(/not saved/i)
    expect(input(F_B).value).toBe('0.6')
  })

  /**
   * ⚠ KNOWN CEE EDGE — NOTED, NOT FIXED. CEE refuses
   * `invalid_existing_intervention` when a stored option carries
   * `interventions: null` rather than an absent field
   * (`option-intervention-edit.ts` `prepareOptionInterventionEdit`: present and
   * not a plain object ⇒ refuse). The wire carries only the generic 422
   * `system_event_refused_no_write` (the specific reason is logged, not sent),
   * so the UI names the cause from the stored shape it can see.
   */
  it('⚠ KNOWN CEE EDGE — stored `interventions: null`: the refusal names that cause, not a generic one', async () => {
    sendSystemEvent.mockRejectedValue(
      new SystemEventSendError('server', { code: 'INGRESS_CONTRACT_VIOLATION' }),
    )
    renderPanel({ optionData: { interventions: null } })
    selectOption()
    setFirstValue(F_B, '0.6')

    const notice = await screen.findByTestId(`model-detail-v2-intervention-${F_B}-notice`)
    expect(notice.textContent ?? '').toMatch(/stored effect list/i)
    expect(notice.textContent ?? '').toMatch(/ask olumi/i)
    expect(notice.textContent ?? '').not.toMatch(/could not confirm/i)
    expect(input(F_B).value).toBe('0.6')
  })
})

describe('⭐ the section notice no longer sends a settable option to chat', () => {
  const unlinked: Node = {
    id: UNLINKED_OPTION, type: 'option', position: { x: 0, y: 0 },
    data: { label: 'Outsource it', kind: 'option' },
  } as unknown as Node

  it('⭐ a linked-but-empty option raises NO "cannot be set from this section" notice', () => {
    renderPanel({ handOff: vi.fn() })
    // POSITIVE CONTROL: the option really is blocked — the row carries the marker.
    expect(screen.getByTestId(`model-row-v2-${OPTION}`)).toBeTruthy()
    const notice = screen.queryByTestId(SECTION_WRITER_NOTICE_TESTID('options'))
    expect(notice?.textContent ?? '').not.toMatch(/cannot be set from this section/i)
    expect(notice).toBeNull()
  })

  it('⭐ an option linked to NO factor keeps a notice — and it says to link it first', () => {
    renderPanel({ handOff: vi.fn(), extraNodes: [unlinked] })
    const notice = screen.getByTestId(SECTION_WRITER_NOTICE_TESTID('options'))
    expect(notice.textContent ?? '').toContain('Link it to a factor first (ask Olumi, or add a link)')
    // Counts ONE — the linked option is not in it.
    expect(notice.textContent ?? '').toMatch(/^One of these/)
    expect(notice.textContent ?? '').not.toMatch(/cannot be set from this section/i)
  })
})
