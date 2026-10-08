/** SELF-AUTHORED (contract): §15 types + §10 sample, NOT a served capture. Replace before merge. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, renderHook, screen, waitFor, within } from '@testing-library/react'
import { SuggestedChips } from '../zones/SuggestedChips'
import { ChatThread } from '../zones/ChatThread'
import type { ProposalPanelAction } from '../HeldProposalPanel'
import { useConversation } from '../useConversation'
import { useCanvasStore } from '../../store'
import { fetchScenarioGraph } from '../../../adapters/cee/scenarioGraph'
import { buildSuggestedActionChips } from '../../../v5/blocks/suggestedActionChips'
import { buildV5Payload } from '../../../v5/buildPayload'
import { readServerHeldProposalOffers, reconcileRestoredHeldControls } from '../serverConversationTurns'
import { saveTranscript, loadTranscript, TRANSCRIPT_STORAGE_KEY, __resetTranscriptTombstonesForTests } from '../utils/transcriptStore'
import * as scenarios from '../../store/scenarios'
import liveJson from './fixtures/t1/live-recorded.json?raw'

vi.mock('../../../lib/supabase', () => ({
  getUserId: async () => null,
  getSessionIdentity: async () => ({ userId: null, accessToken: null }),
  supabase: { auth: { onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }) } },
}))
vi.mock('../../../lib/posthog', () => ({ trackEvent: vi.fn() }))

const SID = '66666666-8888-4999-aaaa-bbbbbbbbbbbb'
const PID = 'gmh_5c3ad0cdb55a'
const APPROVE = { id: `agent-approve-proposal:${PID}`, label: 'Approve 2 changes', message: "Yes, add risk 'Recruitment process taking a long time' and link 'Recruitment process taking a long time' to 'meet our next feature-launch deadline'." }
const AMEND = { id: 'agent-amend-proposal', label: 'Change something first', message: 'Before you apply it, I want to change some of it.' }
const DECLINE = { id: `agent-decline-proposal:${PID}`, label: 'Not now', message: 'Not now.' }
const CHIPS = buildSuggestedActionChips([], [APPROVE, AMEND, DECLINE])
const FIELD = 'link_strength:risk_recruitment_process_taking_a_long_time::goal_1'
const field = { field_id: FIELD, kind: 'link_strength', from_id: 'risk_recruitment_process_taking_a_long_time', to_id: 'goal_1', from_label: 'Recruitment process taking a long time', to_label: 'meet our next feature-launch deadline', direction: 'negative', current: { band: 'strong', source: 'placeholder' }, allowed_bands: ['slight', 'moderate', 'strong', 'very_strong'], editable: true }
const wire = (digest = 'a'.repeat(32)) => ({ version: 1, graph_hash: 'b'.repeat(64), proposals: [{ proposal_id: PID, revision: '22222222-3333-4444-aaaa-bbbbbbbbbbbb', digest, approve_action: APPROVE, decline_action: DECLINE, fields: [field, { ...field, field_id: 'link_strength:other::goal_1', from_id: 'other', from_label: 'Other', current: { band: 'moderate', source: 'estimate' } }, { ...field, field_id: 'link_strength:own::goal_1', from_id: 'own', from_label: 'Own', current: { band: 'slight', source: 'yours' }, editable: false }], missing: [{ node_id: field.from_id, label: field.from_label, kind: 'risk', what: 'level_today' }] }] })
const expectedEdits = (digest = 'a'.repeat(32)) => ({ proposal_id: PID, revision: wire().proposals[0].revision, digest, graph_hash: wire().graph_hash, fields: [{ field_id: FIELD, band: 'very_strong' }] })
const fetchSpy = vi.fn()
const originalScrollIntoView = HTMLElement.prototype.scrollIntoView
const response = (body: unknown) => new Response(JSON.stringify(body), { status: 200 })
const reply = (fields: unknown = wire()) => ({ ...JSON.parse(liveJson), suggested_actions: [APPROVE, AMEND, DECLINE], ...(fields === undefined ? {} : { _proposal_fields: fields }) })
const graph = () => ({ schema: 'scenario_graph.v1', scenario_id: SID, graph_present: true, graph: { nodes: [{ id: 'f', kind: 'factor', label: 'Factor' }], edges: [] }, proposal_fields: wire() })
const Chips = SuggestedChips
const panel = () => screen.getByRole('region', { name: 'What this change assumes' })
const row = () => within(panel()).getByTestId(`proposal-field-${PID}-${FIELD}`)
const choose = () => fireEvent.click(within(row()).getByRole('button', { name: /^Very strong/ }))
function mount(fields: unknown = wire(), send = vi.fn().mockResolvedValue(undefined)) {
  return { ...render(<Chips chips={CHIPS} proposalFields={fields} replyId="reply-1" onChipClick={send} />), send }
}
function open() { fireEvent.click(screen.getByRole('button', { name: AMEND.label })) }
function built(chip: ProposalPanelAction) {
  const result = buildV5Payload({ turnId: 'turn', scenarioId: SID, mode: 'user', stage: 'frame', turnClass: 'frame', source: 'chip', message: chip.message, chipMeta: { id: chip.id }, proposalEdits: chip.proposalEdits })
  expect(result.ok).toBe(true)
  return result.ok ? result.payload : null
}

beforeEach(() => {
  HTMLElement.prototype.scrollIntoView = vi.fn()
  localStorage.clear(); sessionStorage.clear(); __resetTranscriptTombstonesForTests()
  vi.stubEnv('VITE_ENABLE_V5_ORCHESTRATOR', 'true'); vi.stubEnv('VITE_V5_ENDPOINT', 'https://cee.test/proxy/v5/turn')
  fetchSpy.mockReset(); fetchSpy.mockImplementation(async () => response(reply()))
  vi.stubGlobal('fetch', fetchSpy)
  scenarios.setCurrentScenarioId(SID)
  useCanvasStore.setState({ currentScenarioId: SID, nodes: [{ id: 'f', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Factor' } }], edges: [], serverGraphIdentity: null, lastAuthoritativeGraph: null, scenarioPersistedToDb: true, _hydratedThread: null })
})
afterEach(() => { HTMLElement.prototype.scrollIntoView = originalScrollIntoView; cleanup(); vi.unstubAllGlobals(); vi.unstubAllEnvs() })

describe('S-D held proposal panel (SELF-AUTHORED contract)', () => {
  it('opens matching proposal client-side with 0 turn POSTs', () => {
    const { send } = mount(); open(); expect(panel()).toBeTruthy(); expect(send).not.toHaveBeenCalled(); expect(fetchSpy).not.toHaveBeenCalled()
    // Science 393023 LICENCE ruling 3: a placeholder (the wire still carries current.band 'strong') shows NO size.
    expect(within(row()).getAllByRole('button').filter(b => b.getAttribute('aria-pressed') === 'true')).toHaveLength(0)
    expect(within(row()).getByText('Not sized yet')).toBeTruthy()
    expect(row().textContent).not.toMatch(/Olumi's (placeholder|estimate)/)
    fireEvent.click(within(row()).getByRole('button', { name: 'Enter my own' }))
    expect(within(row()).queryByText('Not sized yet')).toBeNull()
    expect(within(row()).getAllByRole('button').filter(b => b.getAttribute('aria-pressed') === 'true')).toHaveLength(0)
  })
  it('CONTROL: an estimate field (same band on the wire) lights its band and names whose it is', () => {
    const w = structuredClone(wire()); w.proposals[0].fields[0] = { ...w.proposals[0].fields[0], current: { band: 'strong', source: 'estimate' } }
    mount(w); open()
    expect(within(row()).getByRole('button', { name: /^Strong/ }).getAttribute('aria-pressed')).toBe('true')
    expect(within(row()).getByText("Olumi's estimate")).toBeTruthy()
    expect(within(row()).queryByText('Not sized yet')).toBeNull()
  })
  it('a placeholder picked by the user lights the picked band, sent as an edit', () => {
    mount(); open(); choose()
    expect(within(row()).getByRole('button', { name: /^Very strong/ }).getAttribute('aria-pressed')).toBe('true')
  })
  it.each([undefined, { version: 1, proposals: [] }, { ...wire(), proposals: [{ ...wire().proposals[0], digest: 'bad' }] }])('no valid entry retains the exact amend sentence (%j)', (fields) => {
    const send = vi.fn().mockResolvedValue(undefined)
    render(<Chips chips={CHIPS} proposalFields={fields} replyId="none" onChipClick={send} />)
    open(); expect(send).toHaveBeenCalledWith(CHIPS[1]); expect(screen.queryByRole('region')).toBeNull()
  })
  // Served 8 Oct (UI 42652ba4, CEE 78cad18): a held card with nothing the panel can show (e.g. the deadline question, whose
  // option ops are card-only) opened an EMPTY "What this change assumes" (title + three buttons). Design §9: with nothing to
  // show, today's amend sentence stays, so Olumi asks what to change.
  it.each([
    ['no fields and no missing data', { ...wire(), proposals: [{ ...wire().proposals[0], fields: [], missing: [] }] }],
    ['only field kinds the panel does not draw', { ...wire(), proposals: [{ ...wire().proposals[0], fields: [{ field_id: 'option_level:o1', kind: 'option_level' }], missing: [] }] }],
  ])('an entry with %s keeps the exact amend sentence and opens no empty panel', (_name, fields) => {
    const send = vi.fn().mockResolvedValue(undefined)
    render(<Chips chips={CHIPS} proposalFields={fields} replyId="empty" onChipClick={send} />)
    open(); expect(send).toHaveBeenCalledWith(CHIPS[1]); expect(screen.queryByRole('region', { name: 'What this change assumes' })).toBeNull()
  })
  it('Submit body is §15 JSON, with ONLY the changed row and rendered digest', () => {
    const { send } = mount(); open(); choose(); fireEvent.click(within(panel()).getByRole('button', { name: 'Submit' }))
    expect(built(send.mock.calls[0][0])).toEqual({ kind: 'message', turn_id: 'turn', scenario_id: SID, stage: 'frame', turn_class: 'frame', source: 'chip', message: APPROVE.message, chip: { id: APPROVE.id }, proposal_edits: expectedEdits() })
  })
  it.each(['Use Olumi\'s suggestions', 'Submit'])('%s without edits has NO proposal_edits key', (label) => {
    const { send } = mount(); open(); if (label !== 'Submit') choose()
    fireEvent.click(within(panel()).getByRole('button', { name: label }))
    expect(built(send.mock.calls[0][0])).toEqual({ kind: 'message', turn_id: 'turn', scenario_id: SID, stage: 'frame', turn_class: 'frame', source: 'chip', message: APPROVE.message, chip: { id: APPROVE.id } })
  })
  it('Not now sends the exact decline payload', () => {
    const { send } = mount(); open(); fireEvent.click(within(panel()).getByRole('button', { name: 'Not now' }))
    expect(built(send.mock.calls[0][0])).toEqual({ kind: 'message', turn_id: 'turn', scenario_id: SID, stage: 'frame', turn_class: 'frame', source: 'chip', message: 'Not now.', chip: { id: DECLINE.id } })
  })
  it('new reply updates the same proposal and echoes the NEW rendered digest', () => {
    const send = vi.fn().mockResolvedValue(undefined)
    const props = { isThinking: false, longRunningHint: null, nodeCount: 1, patchBlockStates: new Map(), patchRejections: new Map(), onChipClick: send, onPatchAccept: vi.fn(), onPatchDismiss: vi.fn(), onFeedback: vi.fn(), onRetry: vi.fn(), compact: true }
    const first = { id: 'reply-1', role: 'assistant' as const, content: 'Held', timestamp: new Date(), actionChips: CHIPS, proposalFields: wire() }
    const { rerender } = render(<ChatThread {...props} messages={[first]} />)
    open(); choose()
    const next = wire('c'.repeat(32)); next.proposals[0].fields[0].from_label = 'Updated recruitment process'
    rerender(<ChatThread {...props} messages={[first, { ...first, id: 'reply-2', proposalFields: next }]} />)
    expect(panel().textContent).toContain('Updated recruitment process'); choose()
    fireEvent.click(within(panel()).getByRole('button', { name: 'Submit' }))
    expect(built(send.mock.calls[0][0])).toMatchObject({ proposal_edits: expectedEdits('c'.repeat(32)) })
  })
  it('read-only rows have no band buttons; missing data is exact and read-only; chat tokens only', () => {
    mount(); open()
    const readonly = within(panel()).getByTestId(`proposal-field-${PID}-link_strength:own::goal_1`)
    expect(within(readonly).queryByRole('button')).toBeNull(); expect(readonly.textContent).toContain('Yours')
    expect(panel().textContent).toContain(`Olumi has no figure for how likely '${field.from_label}' is today; the analysis treats it as zero`)
    expect(within(panel()).getByText("Olumi's estimate")).toBeTruthy()
    expect(within(row()).getByRole('button', { name: /^Strong/ }).className).toContain('text-xs')
    expect(panel().innerHTML).not.toContain('text-[11px]')
  })
  it('replay and reload read the graph opt-in when card has no fields', async () => {
    fetchSpy.mockImplementation(async () => response(graph()))
    render(<Chips chips={CHIPS} replyId="replayed" onChipClick={vi.fn().mockResolvedValue(undefined)} />)
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1))
    expect(JSON.parse(fetchSpy.mock.calls[0][1].body).include_conversation_turns).toBe(true)
    await act(async () => {})
    open(); expect(panel()).toBeTruthy()
    const read = await fetchScenarioGraph(SID, { includeConversationTurns: true })
    expect(read).toMatchObject({ status: 'graph', proposalFields: wire() })
  })
  it.each([PID, `prop_${'d'.repeat(32)}`])('held card %s survives actual transcript save/load and restore', (id) => {
    const actions = [{ ...APPROVE, id: `agent-approve-proposal:${id}` }, AMEND, { ...DECLINE, id: `agent-decline-proposal:${id}` }]
    saveTranscript(SID, [{ id: 'answer', role: 'assistant', content: 'Held', timestamp: new Date(), heldTurnId: 'turn-1', actionChips: buildSuggestedActionChips([], actions) }])
    const storage = JSON.parse(localStorage.getItem(TRANSCRIPT_STORAGE_KEY)!); storage[SID].pageLoadId = 'earlier'; localStorage.setItem(TRANSCRIPT_STORAGE_KEY, JSON.stringify(storage))
    const restored = loadTranscript(SID)!.messages
    expect(restored[0]).toMatchObject({ heldProposalId: id, heldTurnId: 'turn-1' })
    const offers = [{ proposal_id: id, turn_id: 'turn-1', suggested_actions: actions }]
    expect(readServerHeldProposalOffers(offers)).toHaveLength(1)
    expect(reconcileRestoredHeldControls(restored, offers)[0].actionChips?.map(c => c.id)).toEqual(actions.map(c => c.id))
  })
  it('rejects malformed held ids', () => {
    expect(readServerHeldProposalOffers([{ proposal_id: 'gmh_bad', turn_id: 'turn-1', suggested_actions: [APPROVE, AMEND] }])).toEqual([])
  })
  it('real parser → live hook → sendChip → transport keeps edits and retry exact', async () => {
    const hook = renderHook(() => useConversation())
    await act(async () => { await hook.result.current.sendMessage('Add this risk') })
    const answer = hook.result.current.messages.find(m => m.role === 'assistant' && !m.synthetic)!
    expect(answer.proposalFields).toEqual(wire())
    render(<Chips chips={answer.actionChips ?? []} proposalFields={answer.proposalFields} replyId={answer.id} onChipClick={hook.result.current.sendChip} />)
    fetchSpy.mockClear(); open(); expect(fetchSpy).not.toHaveBeenCalled(); choose()
    await act(async () => { fireEvent.click(within(panel()).getByRole('button', { name: 'Submit' })) })
    const post = fetchSpy.mock.calls.find(c => String(c[0]) === 'https://cee.test/proxy/v5/turn')!
    expect(JSON.parse(post[1].body)).toMatchObject({ message: APPROVE.message, chip: { id: APPROVE.id }, proposal_edits: expectedEdits() })
    fetchSpy.mockClear()
    await act(async () => { await hook.result.current.retryLast() })
    const retried = fetchSpy.mock.calls.find(c => String(c[0]) === 'https://cee.test/proxy/v5/turn')!
    expect(JSON.parse(retried[1].body)).toMatchObject({ message: APPROVE.message, chip: { id: APPROVE.id }, proposal_edits: expectedEdits() })
  })
})
