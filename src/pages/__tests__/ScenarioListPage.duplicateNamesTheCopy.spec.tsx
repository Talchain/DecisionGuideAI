/**
 * SD-1 J11b (DL 0df0e1, 6 Oct): "Duplicate" names the copy for what the source's card SAYS, plus " (copy)".
 *
 * J1 J11 (5 Oct): a decision with no stored title, listed by its goal as "monthly recurring revenue", was copied as
 * "Untitled decision (copy)": `duplicate_scenario` named it from the empty `title` column, never from the name the user
 * saw. The card's name is `scenarioDisplayTitle` (the one naming rule), so the caller sends THAT name to the RPC
 * (`p_title`, migration 20261006020000), which also copies the brief (J11a, asserted on the wire by J1).
 *
 * Bound by identity: the expected name is read off the rendered card, never retyped, and the untitled row first proves
 * the derivation fired (its card does not say "Untitled decision").
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

const rpc = vi.hoisted(() => vi.fn())

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => vi.fn() }
})
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'u1', email: 'test@example.com' }, profile: { display_name: 'Tester' }, authenticated: true }),
}))
vi.mock('../../hooks/useScenario', () => ({
  useScenario: () => ({ createScenario: vi.fn().mockResolvedValue('new-id'), deleteScenario: vi.fn(), isPersistenceActive: true }),
}))
const mockListScenarios = vi.fn()
const mockDuplicateScenario = vi.fn().mockResolvedValue('dup-id')
vi.mock('../../services/scenarioService', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return {
    ...actual,
    listScenarios: (...args: unknown[]) => mockListScenarios(...args),
    duplicateScenario: (...args: unknown[]) => mockDuplicateScenario(...args),
  }
})
vi.mock('../../lib/supabase', () => ({ supabase: { rpc } }))
vi.mock('../../lib/posthog', () => ({ trackEvent: vi.fn() }))

import ScenarioListPage from '../ScenarioListPage'

const now = new Date().toISOString()
const row = (over: Record<string, unknown>) => ({
  stage: 'frame' as const, analysis_status: 'none' as const, updated_at: now, created_at: now,
  is_pinned: false, is_archived: false, events: [] as unknown[], ...over,
})
/** J1's S: no stored title, named by its goal node. */
const UNTITLED = row({
  id: 's-untitled', title: null,
  graph: { nodes: [{ id: 'monthly_recurring_revenue', kind: 'goal', label: 'monthly recurring revenue' }], edges: [] },
})
const TITLED = row({ id: 's-titled', title: 'Pricing review' })

/** Duplicates from the one card whose name passes `pick`; returns the name that card shows. */
async function duplicateFromCard(pick: (name: string) => boolean): Promise<string> {
  const cards = await screen.findAllByTestId('scenario-card')
  expect(cards).toHaveLength(2)
  const named = cards.map((c) => ({ c, name: within(c).getByRole('heading', { level: 4 }).textContent!.trim() }))
  const hits = named.filter((n) => pick(n.name))
  expect(hits, `cards: ${JSON.stringify(named.map((n) => n.name))}`).toHaveLength(1)
  fireEvent.click(within(hits[0]!.c).getByRole('button', { name: 'Actions' }))
  fireEvent.click(await screen.findByRole('menuitem', { name: 'Duplicate' }))
  await waitFor(() => expect(mockDuplicateScenario).toHaveBeenCalledTimes(1))
  return hits[0]!.name
}

describe('Duplicate names the copy for the name its card shows', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockListScenarios.mockResolvedValue([UNTITLED, TITLED])
  })

  it('⭐ an untitled decision named by its goal: the copy is "<that name> (copy)", never "Untitled decision (copy)"', async () => {
    render(<MemoryRouter><ScenarioListPage /></MemoryRouter>)
    const shown = await duplicateFromCard((name) => name !== 'Pricing review')
    expect(shown, 'precondition: the card is named from the model, not the empty title').not.toBe('Untitled decision')
    expect(mockDuplicateScenario).toHaveBeenCalledWith('s-untitled', `${shown} (copy)`)
  })

  it('a titled decision: "<its title> (copy)", the name the old rule gave it', async () => {
    render(<MemoryRouter><ScenarioListPage /></MemoryRouter>)
    const shown = await duplicateFromCard((name) => name === 'Pricing review')
    expect(shown).toBe('Pricing review')
    expect(mockDuplicateScenario).toHaveBeenCalledWith('s-titled', 'Pricing review (copy)')
  })
})

describe('the RPC call', () => {
  // The REAL client (the page rows above mock it); its `supabase.rpc` is the mock.
  let realDuplicateScenario: (id: string, title?: string) => Promise<string>
  beforeEach(async () => {
    ;({ duplicateScenario: realDuplicateScenario } =
      await vi.importActual<typeof import('../../services/scenarioService')>('../../services/scenarioService'))
  })
  beforeEach(() => rpc.mockReset().mockResolvedValue({ data: 'new-id', error: null }))

  it('sends the name as p_title beside the source id', async () => {
    await realDuplicateScenario('s1', 'monthly recurring revenue (copy)')
    expect(rpc).toHaveBeenCalledWith('duplicate_scenario', { p_scenario_id: 's1', p_title: 'monthly recurring revenue (copy)' })
  })

  it('CONTRAST: with no name (or a blank one) it sends the old one-argument shape, so the RPC keeps its old rule', async () => {
    await realDuplicateScenario('s1')
    await realDuplicateScenario('s1', '   ')
    expect(rpc.mock.calls).toEqual([
      ['duplicate_scenario', { p_scenario_id: 's1' }],
      ['duplicate_scenario', { p_scenario_id: 's1' }],
    ])
  })
})
