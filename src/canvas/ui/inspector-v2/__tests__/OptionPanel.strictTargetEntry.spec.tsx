/**
 * ⛔ A TYPED OPTION TARGET IS ONE AMOUNT IN THE ROW'S OWN UNIT, OR IT IS REFUSED — through the REAL inspector chain.
 *
 * THE DEFECT (DL ruled blocking, 23 Oct 2026, staging `fc60b62a`): on the café spend factor ("£ per customer")
 * `admitOptionTargetEntry` read ".5" as 5, "-£6.80" as +6.8, "6.8junk" as 6, and accepted "6.80 EUR" on a £ row.
 * The parser underneath reads prose, so it picked one number out of whatever was typed.
 *
 * WHAT IS REAL: `OptionPanel` (readOnly, as `InspectorRouter` mounts it) → `InterventionRow` →
 * `useOptionInterventionCommit` → `proposeOptionIntervention` → `ConversationProvider` → `callV5Turn`. Only global
 * `fetch` is a double. Expected values are spelled inline (raw ÷ cap 20), never computed with the production helper.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, cleanup, screen, fireEvent, waitFor, act } from '@testing-library/react'
import type { Node } from '@xyflow/react'

vi.mock('../../../conversation/turnService', () => ({
  callOrchestratorTurn: vi.fn(),
  streamOrchestratorTurn: vi.fn(),
  OrchestratorError: class OrchestratorError extends Error {},
}))
vi.mock('../../../../lib/supabase', () => ({
  getUserId: async () => null,
  getSessionIdentity: async () => ({ userId: null, accessToken: null }),
}))
vi.mock('../../../../services/scenarioService', () => ({
  loadScenario: async () => null,
  storeAnalysis: async () => undefined,
}))
vi.mock('../../../../lib/posthog', () => ({ trackEvent: () => undefined }))
vi.mock('../../../../flags', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../../flags')>()
  return { ...actual, isOrchestratorV2Enabled: () => true, isOrchestratorStreamingEnabled: () => false }
})
vi.mock('../../../../v5/eligibility', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../../v5/eligibility')>()
  return { ...actual, isV5Eligible: () => ({ eligible: true }), isV5CanonicalRunPath: () => false }
})

import { OptionPanel } from '../panels/OptionPanel'
import { ConversationProvider } from '../../../conversation/ConversationContext'
import { useCanvasStore } from '../../../store'

const SCENARIO = 'c0c0c0c0-b1b1-4c2c-8d3d-e4e4e4e4e4e4'
const OPTION_ID = 'opt_loyalty'
/** The café spend factor: "£ per customer", cap 20, recorded at £5 (0.25). */
const SPEND = 'fac_spend_per_customer'

const sentBodies: Array<Record<string, unknown>> = []

const OK_BODY = {
  response_version: 2,
  assistant_text: 'Noted.',
  blocks: [],
  suggested_actions: [],
  insights: [],
  stage_indicator: 'frame',
}

function stubFetch() {
  vi.stubGlobal('fetch', vi.fn(async (_url: unknown, init?: { body?: unknown }) => {
    if (typeof init?.body === 'string') sentBodies.push(JSON.parse(init.body))
    return {
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => OK_BODY,
      text: async () => JSON.stringify(OK_BODY),
    } as unknown as Response
  }))
}

function sentOptionTargetEdits(): Array<Record<string, unknown>> {
  return sentBodies
    .map((b) => (b.system_event ?? b.event ?? null) as Record<string, unknown> | null)
    .filter((e): e is Record<string, unknown> => e !== null)
    .filter((e) => e.kind === 'option_intervention_edit' || e.type === 'option_intervention_edit')
}

function seed() {
  useCanvasStore.setState(
    {
      currentScenarioId: SCENARIO,
      lastServerGraphHash: '88e16cc4bbbbbbbb',
      nodes: [
        {
          id: OPTION_ID,
          type: 'option',
          position: { x: 0, y: 0 },
          data: { label: 'Loyalty card', kind: 'option', interventions: { [SPEND]: { value: 0.25 } } },
        } as unknown as Node,
        {
          id: SPEND,
          type: 'factor',
          position: { x: 0, y: 0 },
          data: {
            label: 'Spend per customer',
            kind: 'factor',
            category: 'controllable',
            observedState: { value: 0.25, raw_value: 5, cap: 20, unit: '£ per customer' },
          },
        } as unknown as Node,
      ],
      edges: [{ id: 'e1', source: OPTION_ID, target: SPEND, data: {} }],
      results: { status: 'idle', report: null },
      selection: { nodeIds: new Set(), edgeIds: new Set(), anchorPosition: null },
    } as never,
    false,
  )
}

const renderPanel = () =>
  render(
    <ConversationProvider>
      <OptionPanel nodeId={OPTION_ID} techMode onClose={() => {}} onNavigate={() => {}} readOnly />
    </ConversationProvider>,
  )

function spendInput(): HTMLInputElement {
  const row = document.querySelector(`[data-testid="inspector-intervention-${SPEND}"]`)
  expect(row, 'no spend row').toBeTruthy()
  const input = row!.querySelector('input')
  expect(input, 'no editable input on the spend row').toBeTruthy()
  return input as HTMLInputElement
}

async function typeAndEnter(text: string) {
  const input = spendInput()
  await act(async () => {
    input.focus()
    fireEvent.change(input, { target: { value: text } })
    fireEvent.keyDown(input, { key: 'Enter' })
  })
  // Let any send settle before asserting there was none.
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0))
  })
}

beforeEach(() => {
  sentBodies.length = 0
  stubFetch()
  seed()
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

describe('the café "£ per customer" row reads the whole entry, or says why not', () => {
  it('⭐ ".5" reaches the wire as £0.50 (0.025 of the cap of 20) — RED at fc60b62a (sent 0.25, read as £5)', async () => {
    renderPanel()
    await typeAndEnter('.5')
    await waitFor(() => expect(sentOptionTargetEdits()).toHaveLength(1))
    expect(sentOptionTargetEdits()[0].factor_id).toBe(SPEND)
    expect(sentOptionTargetEdits()[0].value as number).toBeCloseTo(0.025, 12)
    expect(screen.queryByTestId(`intervention-entry-refusal-${SPEND}`)).toBeNull()
  })

  it('⭐ "-£6.80" keeps its sign, so it is refused on this 0-or-more row and nothing is sent — RED at fc60b62a (sent +£6.80)', async () => {
    renderPanel()
    await typeAndEnter('-£6.80')
    const refusal = await screen.findByTestId(`intervention-entry-refusal-${SPEND}`)
    expect(refusal.textContent).toBe('Not saved · must be between £0 / customer and £20 / customer for this factor.')
    expect(spendInput().value).toBe('-£6.80')
    expect(sentOptionTargetEdits()).toHaveLength(0)
  })

  it('⭐ "6.8junk" is refused as unreadable and nothing is sent — RED at fc60b62a (sent £6)', async () => {
    renderPanel()
    await typeAndEnter('6.8junk')
    const refusal = await screen.findByTestId(`intervention-entry-refusal-${SPEND}`)
    expect(refusal.textContent).toBe('Not saved · not a number this row can read. Enter an amount such as £5 / customer.')
    expect(sentOptionTargetEdits()).toHaveLength(0)
  })

  it('⭐ "6.80 EUR" on a £ row is refused with the row\'s unit named and nothing is sent — RED at fc60b62a (sent £6.80)', async () => {
    renderPanel()
    await typeAndEnter('6.80 EUR')
    const refusal = await screen.findByTestId(`intervention-entry-refusal-${SPEND}`)
    expect(refusal.textContent).toBe('Not saved · this row is in £ per customer. Enter the amount without another unit.')
    expect(sentOptionTargetEdits()).toHaveLength(0)
  })

  it('CONTRAST — "$6.80" is refused with the same sentence, as before', async () => {
    renderPanel()
    await typeAndEnter('$6.80')
    const refusal = await screen.findByTestId(`intervention-entry-refusal-${SPEND}`)
    expect(refusal.textContent).toBe('Not saved · this row is in £ per customer. Enter the amount without another unit.')
    expect(sentOptionTargetEdits()).toHaveLength(0)
  })

  it.each(['£6.80', '6.80', '6.80 GBP'])('CONTRAST — "%s" reaches the wire as £6.80 (0.34 of the cap of 20)', async (typed) => {
    renderPanel()
    await typeAndEnter(typed)
    await waitFor(() => expect(sentOptionTargetEdits()).toHaveLength(1))
    expect(sentOptionTargetEdits()[0].value as number).toBeCloseTo(0.34, 12)
    expect(screen.queryByTestId(`intervention-entry-refusal-${SPEND}`)).toBeNull()
  })
})
