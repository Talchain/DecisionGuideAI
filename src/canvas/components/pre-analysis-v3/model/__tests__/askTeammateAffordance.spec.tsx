/**
 * Capability A — "Ask a teammate" from an unresolved estimate row.
 *
 * The ONE new hop: an unresolved unknown in the pre-analysis panel links to
 * the EXISTING blind-round setup page with `{factorId, label, unit}`
 * pre-filled through `ownerPanelHash` (the single href authority). Everything
 * downstream — mint, blindness, reveal — is untouched machinery.
 *
 * THE GUARD (the #672 pattern, TopBar:403/CanvasMVP:276): the affordance
 * renders ONLY where the mint can succeed — a PERSISTED scenario under a
 * SIGNED-IN (non-guest) user. CEE's mint is owner-JWT and refuses guests and
 * unpersisted scenarios; an affordance shown there would be an advertised
 * action terminating in refusal (the Research-CTA anti-pattern).
 *
 * THE IDENTITY BINDING (trap 19): the href must carry THE ROW'S OWN factor id
 * — the discriminating fixture puts a DIFFERENT factor FIRST in the store, so
 * a mutant that binds to "the first row" REDs here while every value-predicate
 * assertion would have stayed green.
 *
 * ANTI-ANCHORING IS INHERITED, NOT RE-IMPLEMENTED: the href carries no value
 * field — pinned by the query-key manifest test, and structurally refused at
 * CEE's `parseTargets` even if a future caller tried.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen, cleanup } from '@testing-library/react'
import type { Node } from '@xyflow/react'

vi.mock('../../../../../contexts/AuthContext', async (importOriginal) => {
  // Spread the real module (trap 12): a hand-listed factory REPLACES it and
  // silently drops every export added later.
  const actual = await importOriginal<typeof import('../../../../../contexts/AuthContext')>()
  return { ...actual, useAuth: vi.fn() }
})

import { useAuth } from '../../../../../contexts/AuthContext'
import { CalibrateDrillIn } from '../CalibrateDrillIn'
import { ownerPanelHash, readPanelPrefill } from '../../../../../collab/panelRoute'
import { useCanvasStore } from '../../../../store'
import type { EstimateRowModel } from '../../types'

const SCENARIO_ID = 'scn-persisted-11111111'
/** The DECOY sits FIRST in the store — a first-row binding must RED. */
const DECOY_FIRST_FACTOR = 'fac_decoy_first_in_store'
const ROW_FACTOR = 'fac_churn_risk_THE_ROW'
const ROW_LABEL = 'Churn risk after a price rise'

const row: EstimateRowModel = {
  nodeId: ROW_FACTOR,
  label: ROW_LABEL,
  rankLabel: 'top',
  weight: 1,
  reviewed: false,
  aiSourced: true,
  attribution: { kind: 'olumi' },
  displayText: '30%',
  rawPrefill: 30,
  cap: 100,
  canEditValue: true,
  needsValue: false,
}

function factorNode(id: string, label: string, unit: string | null): Node {
  return {
    id,
    type: 'factor',
    position: { x: 0, y: 0 },
    data: {
      kind: 'factor',
      label,
      provenance: 'ai_inferred',
      observedState: {
        value: 0.3,
        raw_value: 30,
        cap: 100,
        source: 'cee_inference',
        ...(unit !== null ? { unit } : {}),
      },
    },
  } as Node
}

function seedStore(over: { scenarioId?: string | null; rowUnit?: string | null } = {}): void {
  useCanvasStore.setState({
    nodes: [
      // Decoy FIRST: the wrong-factor mutant binds here and must RED.
      factorNode(DECOY_FIRST_FACTOR, 'A decoy factor', 'engineers'),
      factorNode(ROW_FACTOR, ROW_LABEL, over.rowUnit === undefined ? '%' : over.rowUnit),
    ] as never,
    edges: [] as never,
    currentScenarioId: over.scenarioId === undefined ? SCENARIO_ID : over.scenarioId,
  } as never)
}

function signIn(kind: 'owner' | 'guest' | 'signed-out'): void {
  const value =
    kind === 'owner'
      ? { user: { id: 'user-real-owner-1' }, authenticated: true }
      : kind === 'guest'
        ? { user: { id: 'guest' }, authenticated: true } // guests ARE authenticated in this app
        : { user: null, authenticated: false }
  vi.mocked(useAuth).mockReturnValue(value as ReturnType<typeof useAuth>)
}

function renderDrillIn(overrides: Partial<EstimateRowModel> = {}) {
  return render(<CalibrateDrillIn row={{ ...row, ...overrides }} onDone={vi.fn()} />)
}

const TESTID = `pre-analysis-v3-ask-team-${ROW_FACTOR}`

beforeEach(() => {
  cleanup()
  seedStore()
  signIn('owner')
})

describe('the affordance renders where the mint can succeed', () => {
  it('signed-in owner + persisted scenario + unresolved row → "Ask a teammate" is offered', () => {
    renderDrillIn()
    const link = screen.getByTestId(TESTID)
    expect(link.tagName).toBe('A')
    expect(link).toHaveTextContent('Ask a teammate')
  })

  it('a row that still NEEDS a value is exactly the ask-a-teammate case — offered', () => {
    renderDrillIn({ needsValue: true, displayText: null, rawPrefill: null, canEditValue: true })
    expect(screen.getByTestId(TESTID)).toBeInTheDocument()
  })
})

describe('the guard — never an advertised action ending in refusal', () => {
  it('GUEST: authenticated-but-guest cannot mint (owner-JWT) → no affordance', () => {
    signIn('guest')
    renderDrillIn()
    expect(screen.queryByTestId(TESTID)).toBeNull()
  })

  it('SIGNED OUT: no affordance', () => {
    signIn('signed-out')
    renderDrillIn()
    expect(screen.queryByTestId(TESTID)).toBeNull()
  })

  it('UNPERSISTED: no scenario id → CEE has no immutable model version to pin → no affordance', () => {
    seedStore({ scenarioId: null })
    renderDrillIn()
    expect(screen.queryByTestId(TESTID)).toBeNull()
  })

  it('RESOLVED: a reviewed row is not an unresolved unknown → no affordance', () => {
    renderDrillIn({ reviewed: true, provenanceKind: 'confirmed', aiSourced: false })
    expect(screen.queryByTestId(TESTID)).toBeNull()
  })
})

describe('the href is bound to THIS row by identity (trap 19)', () => {
  function hrefOf(): string {
    const href = screen.getByTestId(TESTID).getAttribute('href')
    expect(href).not.toBeNull()
    return href as string
  }

  it('DISCRIMINATING: carries the ROW factor id — not the store-first decoy', () => {
    renderDrillIn()
    const search = hrefOf().slice(hrefOf().indexOf('?'))
    const prefill = readPanelPrefill(search)
    expect(prefill?.factorId).toBe(ROW_FACTOR)
    expect(prefill?.factorId).not.toBe(DECOY_FIRST_FACTOR)
    expect(hrefOf()).not.toContain(DECOY_FIRST_FACTOR)
  })

  it('the whole href is the single authority’s output for THIS scenario, factor, label and unit', () => {
    renderDrillIn()
    expect(hrefOf()).toBe(
      ownerPanelHash(SCENARIO_ID, { factorId: ROW_FACTOR, label: ROW_LABEL, unit: '%' }),
    )
  })

  it('a factor with no unit sends unit null — never an invented one', () => {
    seedStore({ rowUnit: null })
    renderDrillIn()
    const search = hrefOf().slice(hrefOf().indexOf('?'))
    expect(readPanelPrefill(search)?.unit).toBeNull()
  })

  it('NO VALUE RIDES: the query carries only factor/label/unit — no value, no estimate, no anchor', () => {
    renderDrillIn()
    const search = hrefOf().slice(hrefOf().indexOf('?'))
    const keys = [...new URLSearchParams(search).keys()].sort()
    expect(keys.every((k) => ['factor', 'label', 'unit'].includes(k))).toBe(true)
    expect(keys).toContain('factor')
  })
})
