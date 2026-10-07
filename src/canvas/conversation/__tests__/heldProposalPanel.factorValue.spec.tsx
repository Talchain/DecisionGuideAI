/** CEE #2756 S-D slice 2: byte-for-byte route captures; `_proposal_fields` is at the route root. */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { SuggestedChips } from '../zones/SuggestedChips'
import { factorValueAllowed, readProposalFields, type Proposal } from '../proposalFields'
import { useCanvasStore } from '../../store'
import { buildSuggestedActionChips } from '../../../v5/blocks/suggestedActionChips'
import * as scenarios from '../../store/scenarios'

vi.mock('../../../lib/supabase', () => ({
  getUserId: async () => null,
  getSessionIdentity: async () => ({ userId: null, accessToken: null }),
  supabase: { auth: { onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }) } },
}))
vi.mock('../../../lib/posthog', () => ({ trackEvent: vi.fn() }))

type FactorValueField = Extract<Proposal['fields'][number], { kind: 'factor_value' }>
type CapturedAction = { id: string; label: string; message: string; detail?: string }
type RawField = { field_id: string; kind: string; [key: string]: unknown }
type CapturedProposal = {
  proposal_id: string; revision: string; digest: string
  approve_action: CapturedAction; decline_action: CapturedAction
  fields: RawField[]; missing: unknown[]
}
type CapturedEnvelope = { version: number; graph_hash: string; proposals: CapturedProposal[] }
type CapturedTurn = { suggested_actions: CapturedAction[]; _proposal_fields: CapturedEnvelope }

const SID = '66666666-8888-4999-aaaa-bbbbbbbbbbbb'
const A1_PID = 'prop_b7542aa96cc5a4133732832615003b7f'
const A6_PID = 'prop_9bf52ed7cfd93aa25d5ab994f8e45c00'
const COST = 'factor_value:fac_cost'
const HOURS = 'factor_value:fac_hours'
const HOURS_LINK = 'link_strength:fac_hours::goal_x'
const COST_LINK = 'link_strength:fac_cost::goal_x'
const originalScrollIntoView = HTMLElement.prototype.scrollIntoView

function capture<T>(name: string): T {
  return JSON.parse(readFileSync(join(__dirname, 'fixtures', name), 'utf8')) as T
}
function a1() { return capture<CapturedTurn>('sd-s2-a1-proposing-turn.json') }
function a6() { return capture<CapturedTurn>('sd-s2-a6-proposing-turn.json') }
function rawProposal(turn: CapturedTurn, proposalId: string) {
  const proposal = turn._proposal_fields.proposals.find(p => p.proposal_id === proposalId)
  if (!proposal) throw new Error(`Capture has no proposal ${proposalId}`)
  return proposal
}
function factor(turn: CapturedTurn, fieldId: string): FactorValueField {
  const field = rawProposal(turn, A1_PID).fields.find(f => f.field_id === fieldId)
  if (!field || field.kind !== 'factor_value') throw new Error(`Capture has no factor field ${fieldId}`)
  return field as unknown as FactorValueField
}
function parsedProposal(envelope: CapturedEnvelope, proposalId: string) {
  const parsed = readProposalFields(envelope)
  expect(parsed).not.toBeNull()
  const proposal = parsed?.proposals.find(p => p.proposal_id === proposalId)
  expect(proposal?.proposal_id).toBe(proposalId)
  if (!proposal) throw new Error(`Reader dropped proposal ${proposalId}`)
  return proposal
}
function mount(turn: CapturedTurn = a1()) {
  const send = vi.fn().mockResolvedValue(undefined)
  const chips = buildSuggestedActionChips([], turn.suggested_actions)
  return { ...render(<SuggestedChips chips={chips} proposalFields={turn._proposal_fields} replyId="captured-reply" onChipClick={send} />), send }
}
function open(turn: CapturedTurn) {
  const amend = turn.suggested_actions.find(action => action.id === 'agent-amend-proposal')!
  fireEvent.click(screen.getByRole('button', { name: amend.label }))
}
function panel() { return screen.getByRole('region', { name: 'What this change assumes' }) }
function row(proposalId: string, fieldId: string, label: string) {
  const element = within(panel()).getByTestId(`proposal-field-${proposalId}-${fieldId}`)
  expect(within(element).getByText(label, { exact: true })).toBeTruthy()
  return element
}
function revealHours(proposalId = A1_PID) {
  const element = row(proposalId, HOURS, 'Hours')
  fireEvent.click(within(element).getByRole('button', { name: 'Enter my own' }))
  const input = within(element).getByRole('textbox', { name: 'Your figure for Hours (hours)' })
  expect(input.getAttribute('data-testid')).toBe(`proposal-field-input-${proposalId}-${HOURS}`)
  expect(input.getAttribute('type')).toBe('text')
  expect(input.getAttribute('inputmode')).toBe('decimal')
  return input
}
function editHours(value: string, proposalId = A1_PID) {
  const input = revealHours(proposalId)
  fireEvent.change(input, { target: { value } })
  return input
}
function submit() { return within(panel()).getByRole('button', { name: 'Submit' }) as HTMLButtonElement }

beforeEach(() => {
  HTMLElement.prototype.scrollIntoView = vi.fn()
  localStorage.clear(); sessionStorage.clear()
  vi.stubEnv('VITE_ENABLE_V5_ORCHESTRATOR', 'true')
  scenarios.setCurrentScenarioId(SID)
  useCanvasStore.setState({ currentScenarioId: SID, nodes: [{ id: 'f', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Factor' } }], edges: [], serverGraphIdentity: null, lastAuthoritativeGraph: null, scenarioPersistedToDb: true, _hydratedThread: null })
})
afterEach(() => {
  HTMLElement.prototype.scrollIntoView = originalScrollIntoView
  cleanup(); vi.unstubAllEnvs()
})

describe('S-D slice 2 held factor values (captured CEE route wire)', () => {
  it('R1 reads the captured prop_ proposal with both factor_value fields', () => {
    const turn = a1()
    const proposal = parsedProposal(turn._proposal_fields, A1_PID)
    expect(proposal.fields).toHaveLength(2)
    expect(proposal.fields.find(field => field.field_id === COST)).toEqual(factor(turn, COST))
    expect(proposal.fields.find(field => field.field_id === HOURS)).toEqual(factor(turn, HOURS))
  })

  it('R2 renders each captured label, stored figure and estimate provenance by field identity', () => {
    const turn = a1(); mount(turn); open(turn)
    const cost = row(A1_PID, COST, 'Cost')
    const hours = row(A1_PID, HOURS, 'Hours')
    expect(within(cost).getByText('Cost', { exact: true }).tagName).toBe('LABEL')
    expect(within(hours).getByText('Hours', { exact: true }).tagName).toBe('LABEL')
    expect(within(cost).getByText('£200', { exact: true })).toBeTruthy()
    expect(within(hours).getByText('10 hours', { exact: true })).toBeTruthy()
    for (const element of [cost, hours]) expect(within(element).getByText("Olumi's estimate", { exact: true })).toBeTruthy()
  })

  it('R3 submits exactly the captured Hours edit and approve action, leaving Cost absent', () => {
    const turn = a1()
    const proposal = rawProposal(turn, A1_PID)
    const request = capture<{ chip: { id: string }; message: string; proposal_edits: unknown }>('sd-s2-a1-submit-request.json')
    const { send } = mount(turn); open(turn); editHours('12')
    expect(within(row(A1_PID, HOURS, 'Hours')).getByText('Yours', { exact: true })).toBeTruthy()
    expect(within(row(A1_PID, COST, 'Cost')).getByText("Olumi's estimate", { exact: true })).toBeTruthy()
    fireEvent.click(submit())
    expect(send).toHaveBeenCalledTimes(1)
    expect(send.mock.calls[0][0].id).toBe(proposal.approve_action.id)
    expect(send.mock.calls[0][0].message).toBe(proposal.approve_action.message)
    expect(send.mock.calls[0][0].id).toBe(request.chip.id)
    expect(send.mock.calls[0][0].message).toBe(request.message)
    expect(send.mock.calls[0][0].proposalEdits).toEqual(request.proposal_edits)
  })

  it("R4 Use Olumi's suggestions approves with no edits even after entering a figure", () => {
    const turn = a1(); const proposal = rawProposal(turn, A1_PID)
    const { send } = mount(turn); open(turn); editHours('12')
    fireEvent.click(within(panel()).getByRole('button', { name: "Use Olumi's suggestions" }))
    expect(send).toHaveBeenCalledTimes(1)
    expect(send.mock.calls[0][0].id).toBe(proposal.approve_action.id)
    expect(send.mock.calls[0][0].message).toBe(proposal.approve_action.message)
    expect(send.mock.calls[0][0].proposalEdits).toBeUndefined()
  })

  it('R5 Not now sends the exact decline identity and sentence', () => {
    const turn = a1(); const { send } = mount(turn); open(turn)
    fireEvent.click(within(panel()).getByRole('button', { name: 'Not now' }))
    expect(send).toHaveBeenCalledTimes(1)
    expect(send.mock.calls[0][0].id).toBe(`agent-decline-proposal:${A1_PID}`)
    expect(send.mock.calls[0][0].message).toBe('Not now.')
    expect(send.mock.calls[0][0].proposalEdits).toBeUndefined()
  })

  it('R6 skips an unknown kind without dropping the card or sending that field', () => {
    const turn = a1(); const unknownId = 'future_kind:fac_unknown'
    rawProposal(turn, A1_PID).fields.push({ field_id: unknownId, kind: 'future_kind', label: 'Unrendered factor' })
    const proposal = parsedProposal(turn._proposal_fields, A1_PID)
    expect(proposal.fields.map(field => field.field_id)).toEqual([COST, HOURS])
    const { send } = mount(turn); open(turn)
    expect(within(panel()).queryByTestId(`proposal-field-${A1_PID}-${unknownId}`)).toBeNull()
    expect(within(panel()).queryByText('Unrendered factor', { exact: true })).toBeNull()
    editHours('12'); fireEvent.click(submit())
    expect(send).toHaveBeenCalledTimes(1)
    expect(send.mock.calls[0][0].proposalEdits).toEqual(capture<{ proposal_edits: unknown }>('sd-s2-a1-submit-request.json').proposal_edits)
  })

  it.each([['yours', 'Yours'], ['from_brief', 'From your brief']] as const)('R7 renders %s provenance on the identified factor rows', (source, words) => {
    const turn = a1()
    factor(turn, COST).current.source = source
    factor(turn, HOURS).current.source = source
    mount(turn); open(turn)
    expect(within(row(A1_PID, COST, 'Cost')).getByText(words, { exact: true })).toBeTruthy()
    expect(within(row(A1_PID, HOURS, 'Hours')).getByText(words, { exact: true })).toBeTruthy()
  })

  it.each([
    { name: 'cap refuses above 40', limits: { cap: 40 }, value: 41, allowed: false },
    { name: 'cap includes 40', limits: { cap: 40 }, value: 40, allowed: true },
    { name: 'unit interval refuses a negative', limits: { declared_scale: 'unit_interval' }, value: -1, allowed: false },
    { name: 'unit interval has no implicit upper cap', limits: { declared_scale: 'unit_interval' }, value: 2, allowed: true },
    { name: 'unbounded permits a negative', limits: {}, value: -1, allowed: true },
    { name: 'object min refuses 4', limits: { declared_scale: { min: 5, max: 9 } }, value: 4, allowed: false },
    { name: 'object max includes 9', limits: { declared_scale: { min: 5, max: 9 } }, value: 9, allowed: true },
    { name: 'object max refuses 10', limits: { declared_scale: { min: 5, max: 9 } }, value: 10, allowed: false },
    { name: 'NaN is refused', limits: {}, value: Number.NaN, allowed: false },
    { name: 'Infinity is refused', limits: {}, value: Number.POSITIVE_INFINITY, allowed: false },
  ])('R8 factorValueAllowed mirrors CEE: $name', ({ limits, value, allowed }) => {
    const field = { ...factor(a1(), HOURS), ...limits }
    expect(field.field_id).toBe(HOURS)
    expect(field.label).toBe('Hours')
    expect(factorValueAllowed(field, value)).toBe(allowed)
  })

  it('R8 an above-cap figure disables Submit and explains the factor boundary', () => {
    const turn = a1(); factor(turn, HOURS).cap = 40
    const { send } = mount(turn); open(turn); const input = editHours('41')
    expect(submit().disabled).toBe(true)
    expect(within(row(A1_PID, HOURS, 'Hours')).getByText('That figure is outside what this factor allows.', { exact: true })).toBeTruthy()
    fireEvent.click(submit()); expect(send).not.toHaveBeenCalled()
    fireEvent.change(input, { target: { value: '40' } })
    expect(submit().disabled).toBe(false)
    expect(within(row(A1_PID, HOURS, 'Hours')).queryByText('That figure is outside what this factor allows.', { exact: true })).toBeNull()
  })

  it('R9 retains the captured Hours to Revenue link edit as a band, with Cost absent', () => {
    const turn = a6(); const proposal = rawProposal(turn, A6_PID)
    const { send } = mount(turn); open(turn)
    const hours = row(A6_PID, HOURS_LINK, 'Hours → Revenue')
    row(A6_PID, COST_LINK, 'Cost → Revenue')
    fireEvent.click(within(hours).getByRole('button', { name: /^Very strong/ }))
    fireEvent.click(submit())
    expect(send).toHaveBeenCalledTimes(1)
    expect(send.mock.calls[0][0].id).toBe(proposal.approve_action.id)
    expect(send.mock.calls[0][0].message).toBe(proposal.approve_action.message)
    expect(send.mock.calls[0][0].proposalEdits).toEqual({ proposal_id: A6_PID, revision: proposal.revision, digest: proposal.digest, graph_hash: turn._proposal_fields.graph_hash, fields: [{ field_id: HOURS_LINK, band: 'very_strong' }] })
  })

  it('R10 accepts the reload gmh_ identity with both matching action ids', () => {
    const turn = a6(); const reloadId = 'gmh_9bf52ed7cfd9'
    const raw = rawProposal(turn, A6_PID)
    raw.proposal_id = reloadId
    raw.approve_action.id = `agent-approve-proposal:${reloadId}`
    raw.decline_action.id = `agent-decline-proposal:${reloadId}`
    const proposal = parsedProposal(turn._proposal_fields, reloadId)
    expect(proposal.approve_action.id).toBe(`agent-approve-proposal:${reloadId}`)
    expect(proposal.decline_action.id).toBe(`agent-decline-proposal:${reloadId}`)
    expect(proposal.fields.find(field => field.field_id === HOURS_LINK)).toMatchObject({ from_label: 'Hours', to_label: 'Revenue' })
    expect(proposal.fields.find(field => field.field_id === COST_LINK)).toMatchObject({ from_label: 'Cost', to_label: 'Revenue' })
  })

  it.each(['', '   '])('a revealed, still-empty Hours input %j disables Submit without an error line', value => {
    const turn = a1(); const { send } = mount(turn); open(turn); editHours(value)
    expect(submit().disabled).toBe(true)
    expect(within(row(A1_PID, HOURS, 'Hours')).queryByText('Type a number.', { exact: true })).toBeNull()
    fireEvent.click(submit()); expect(send).not.toHaveBeenCalled()
  })

  it.each(['not a number', 'NaN', 'Infinity'])('a revealed Hours input with %j disables Submit and asks for a number', value => {
    const turn = a1(); const { send } = mount(turn); open(turn); editHours(value)
    expect(submit().disabled).toBe(true)
    expect(within(row(A1_PID, HOURS, 'Hours')).getByText('Type a number.', { exact: true })).toBeTruthy()
    fireEvent.click(submit()); expect(send).not.toHaveBeenCalled()
  })

  it("Olumi's own figure typed back is not labelled Yours (nothing is sent for it)", () => {
    const turn = a1(); mount(turn); open(turn); editHours('10')
    const hours = row(A1_PID, HOURS, 'Hours')
    expect(within(hours).queryByText('Yours', { exact: true })).toBeNull()
    expect(within(hours).getByText("Olumi's estimate", { exact: true })).toBeTruthy()
  })

  it.each([false, true])('Submit has no edits when figures stay unchanged (revealed=%s)', revealed => {
    const turn = a1(); const proposal = rawProposal(turn, A1_PID)
    const { send } = mount(turn); open(turn)
    if (revealed) editHours('10')
    fireEvent.click(submit())
    expect(send).toHaveBeenCalledTimes(1)
    expect(send.mock.calls[0][0].id).toBe(proposal.approve_action.id)
    expect(send.mock.calls[0][0].message).toBe(proposal.approve_action.message)
    expect(send.mock.calls[0][0].proposalEdits).toBeUndefined()
  })

  it('a non-editable captured factor is a read-only figure with no edit control', () => {
    const turn = a1(); factor(turn, COST).editable = false
    mount(turn); open(turn)
    const cost = row(A1_PID, COST, 'Cost')
    expect(within(cost).getByText('£200', { exact: true })).toBeTruthy()
    expect(within(cost).getByText("Olumi's estimate", { exact: true })).toBeTruthy()
    expect(within(cost).queryByRole('button')).toBeNull()
    expect(within(cost).queryByRole('textbox')).toBeNull()
  })

  it('renders a percent figure without converting the stored value', () => {
    const turn = a1(); const hours = factor(turn, HOURS)
    hours.unit = '%'; hours.current.unit = '%'
    mount(turn); open(turn)
    expect(within(row(A1_PID, HOURS, 'Hours')).getByText('10%', { exact: true })).toBeTruthy()
  })

  it.each(['factor_value', 'future_kind'])('rejects duplicate raw field identity even for %s', kind => {
    const turn = a1(); const raw = rawProposal(turn, A1_PID)
    raw.fields.push({ ...raw.fields.find(field => field.field_id === HOURS)!, kind })
    expect(readProposalFields(turn._proposal_fields)?.proposals.find(proposal => proposal.proposal_id === A1_PID)).toBeUndefined()
  })

  it.each([
    { kind: 'factor_value', load: a1, proposalId: A1_PID, fieldId: HOURS, current: { value: 'twelve', unit: 'hours', source: 'estimate' } },
    { kind: 'link_strength', load: a6, proposalId: A6_PID, fieldId: HOURS_LINK, current: { band: 'not_a_band', source: 'estimate' } },
  ])('rejects malformed known $kind without treating it as an unknown field', ({ load, proposalId, fieldId, current }) => {
    const turn = load(); const raw = rawProposal(turn, proposalId)
    raw.fields.find(entry => entry.field_id === fieldId)!.current = current
    expect(readProposalFields(turn._proposal_fields)?.proposals.find(proposal => proposal.proposal_id === proposalId)).toBeUndefined()
  })
})
