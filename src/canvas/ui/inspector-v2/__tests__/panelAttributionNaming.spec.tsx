/**
 * D1 — the attribution pill NAMES the colleague whose answer it is.
 *
 * ── WHAT THE EXISTING SUITE ALREADY COVERS, AND WHY THAT IS NOT ENOUGH ─────
 * `domain/__tests__/panelProvenance.spec.ts` pins that a `panel_elicited` value
 * is never credited to Olumi, never pilled "Set by you", and never leaks the raw
 * wire literal. Every one of those assertions is about what the pill must NOT
 * say, and all of them pass on the unnamed copy — which is why the copy stayed
 * unnamed for a whole slice while reading as fully covered. This file is the
 * positive half: it pins what the pill DOES say when the person is known, and
 * that it degrades to the truthful unnamed sentence when they are not.
 *
 * ⚠ THE COMPONENT TEST SETS `data.category` EXPLICITLY, AND MUST.
 * `InspectorRouter.resolvePanelType` (`InspectorRouter.tsx:82-89`) falls through
 * to `'factor-controllable'` for a missing or misspelled category, so a fixture
 * that omits it renders a DIFFERENT panel than the test names and passes anyway.
 * The panels are imported directly here, which sidesteps that — but the fixtures
 * carry the category regardless, so this file cannot start lying if it is ever
 * rewritten to go through the router.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { getProvenanceLabel, getExtractionLabel } from '../inspectorStrings'
import type { ParticipantNameResolution } from '../../../../collab/participantNames'

const GRACE_ID = '9f1c7d2e-4b3a-4c11-8e6f-0a2b5c8d7e10'
const ROUND_ID = 'c3d4e5f6-a7b8-4901-9234-56789abcdef0'

const NAMED: ParticipantNameResolution = { state: 'named', label: 'Grace' }
const UNRESOLVED: ParticipantNameResolution = {
  state: 'unresolved',
  reason: 'roster_unavailable',
}

describe('the label functions — named attribution', () => {
  it.each([
    ['getProvenanceLabel', getProvenanceLabel],
    ['getExtractionLabel', getExtractionLabel],
  ])('%s names the participant for panel_elicited', (_name, fn) => {
    expect(fn('panel_elicited', NAMED)).toBe("From Grace's panel answer")
  })

  it.each([
    ['getProvenanceLabel', getProvenanceLabel],
    ['getExtractionLabel', getExtractionLabel],
  ])('%s falls back to the TRUTHFUL unnamed sentence when unresolved', (_name, fn) => {
    // Still says the value came from the panel — the fallback is not a neutral
    // shrug, and it is not "Estimated by Olumi".
    expect(fn('panel_elicited', UNRESOLVED)).toBe('From your panel')
    expect(fn('panel_elicited')).toBe('From your panel')
  })

  it.each([
    ['getProvenanceLabel', getProvenanceLabel],
    ['getExtractionLabel', getExtractionLabel],
  ])('%s never renders the raw literal or an id, resolved or not', (_name, fn) => {
    for (const arg of [NAMED, UNRESOLVED, undefined]) {
      const label = fn('panel_elicited', arg)
      expect(label).not.toContain('panel_elicited')
      expect(label).not.toContain(GRACE_ID)
      expect(label).not.toContain(ROUND_ID)
    }
  })

  it('⭐ ATTRIBUTES WITHOUT ENDORSING — "apply Grace\'s value" is not "Grace was correct"', () => {
    const label = getProvenanceLabel('panel_elicited', NAMED)
    expect(label).toContain('Grace')
    // Any of these would convert a provenance label into a verdict on whose
    // number is right. The owner adopting a value is the owner's decision.
    for (const verdict of ['correct', 'verified', 'validated', 'confirmed', 'agreed', 'best']) {
      expect(label.toLowerCase()).not.toContain(verdict)
    }
  })

  it('⭐ a resolution does NOT relabel a value that is not a panel value', () => {
    // The discriminating case for the `cls.kind === 'panel'` gate. A stale or
    // unrelated resolution in scope must not touch the owner's own edit — this
    // fails if the gate is dropped and the name is applied to any attributed
    // kind.
    expect(getProvenanceLabel('user_override', NAMED)).toBe('Set by you')
    expect(getProvenanceLabel('user_confirmed', NAMED)).toBe('Confirmed by you')
    expect(getExtractionLabel('brief_extraction', NAMED)).toBe('From your brief')
    expect(getProvenanceLabel('cee_inference', NAMED)).toBe('Estimated by Olumi')
  })

  it('an unknown literal is unaffected by a resolution', () => {
    expect(getProvenanceLabel('some_new_source', NAMED)).toBe('Source: some_new_source')
  })
})

/* ────────────────────────────────────────────────────────────────────────────
 * The DEPLOYED-MOUNTED surface. FactorObservablePanel reaches a real user via
 * InspectorRouter → InspectorModal (`USE_INSPECTOR_V2` is a hardcoded `true`,
 * no flag gates it) → ReactFlowGraph → CanvasMVP.
 * ──────────────────────────────────────────────────────────────────────────── */

const ROSTER_RESPONSE = {
  round_id: ROUND_ID,
  status: 'closed',
  targets: [],
  roster: [{ participant_id: GRACE_ID, display_name: 'Grace', status: 'active' }],
}

vi.mock('../../../../lib/supabase', async (importOriginal) => {
  // importOriginal-spread, not a hand-listed mock: a `vi.mock` factory REPLACES
  // the module, so any other export this file's import graph needs would go
  // silently missing (CLAUDE.md trap 12 — it has killed 51 tests here before).
  const actual = await importOriginal<Record<string, unknown>>()
  return {
    ...actual,
    getSessionIdentity: vi.fn(async () => ({ userId: 'owner-1', accessToken: 'tok' })),
  }
})

function factorNode(observedState: Record<string, unknown>) {
  return {
    id: 'factor-1',
    type: 'factor',
    position: { x: 0, y: 0 },
    data: {
      label: 'Churn risk',
      kind: 'factor',
      // EXPLICIT — see the file header. Never rely on the router's default.
      category: 'observable',
      observedState,
    },
  }
}

async function renderObservablePanel(observedState: Record<string, unknown>) {
  const { useCanvasStore } = await import('../../../store')
  const { FactorObservablePanel } = await import('../panels/FactorObservablePanel')
  useCanvasStore.setState({ nodes: [factorNode(observedState)] as never, edges: [] })
  return render(
    <FactorObservablePanel nodeId="factor-1" techMode={false} onClose={() => {}} onNavigate={() => {}} />,
  )
}

describe('FactorObservablePanel — render-time name resolution on a live surface', () => {
  beforeEach(async () => {
    const { __resetRosterCacheForTests } = await import('../../../../collab/roundRosterCache')
    __resetRosterCacheForTests()
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify(ROSTER_RESPONSE), { status: 200 })),
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('⭐ names Grace once the roster lands, on the deployed-mounted panel', async () => {
    await renderObservablePanel({
      value: 0.85,
      source: 'panel_elicited',
      elicited_from: { round_id: ROUND_ID, participant_id: GRACE_ID },
    })

    // The first paint is honest before the roster arrives...
    expect(screen.getAllByText('From your panel').length).toBeGreaterThan(0)
    // ...and the name replaces it when round data resolves.
    expect(
      (await screen.findAllByText("From Grace's panel answer")).length,
    ).toBeGreaterThan(0)
    expect(screen.queryByText('From your panel')).toBeNull()
  })

  it('⭐ requests the ROSTER route, with the owner bearer and no name in the URL', async () => {
    await renderObservablePanel({
      value: 0.85,
      source: 'panel_elicited',
      elicited_from: { round_id: ROUND_ID, participant_id: GRACE_ID },
    })
    await screen.findAllByText("From Grace's panel answer")

    const calls = (globalThis.fetch as unknown as { mock: { calls: unknown[][] } }).mock.calls
    expect(calls.length).toBe(1)
    const [url, init] = calls[0] as [string, RequestInit]
    expect(url).toBe(`/bff/collab/rounds/${ROUND_ID}/preview`)
    // The roster read, not the reveal — one round's names, not every belief.
    expect(url).not.toContain('/reveal')
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer tok')
  })

  it('stays on the truthful unnamed sentence when the roster read fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 403 })))
    await renderObservablePanel({
      value: 0.85,
      source: 'panel_elicited',
      elicited_from: { round_id: ROUND_ID, participant_id: GRACE_ID },
    })
    // Deliberately NOT "Estimated by Olumi" and NOT a blank pill: the value did
    // come from the panel, and that remains true when the name cannot be read.
    expect(screen.getAllByText('From your panel').length).toBeGreaterThan(0)
    expect(screen.queryByText(/Estimated by Olumi/)).toBeNull()
  })

  it('⭐ fetches NOTHING for an ordinary value — the hook is inert off the panel path', async () => {
    await renderObservablePanel({ value: 0.5, source: 'user_override' })
    expect(screen.getAllByText('Set by you').length).toBeGreaterThan(0)
    expect((globalThis.fetch as unknown as { mock: { calls: unknown[][] } }).mock.calls.length).toBe(0)
  })
})
