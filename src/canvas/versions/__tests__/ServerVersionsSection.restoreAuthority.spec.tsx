/**
 * RESTORE AUTHORITY — a restored value must survive the apply.
 *
 * ⚠ THIS SPEC DELIBERATELY DOES **NOT** MOCK `reconcileAppliedGraph`.
 *
 * Its sibling `ServerVersionsSection.spec.tsx` mocks the reconcile, which is
 * right for what that file pins (the confirm gate, identity binding, which
 * function is called). It is also precisely why that file could not see this
 * defect: the overwrite happens INSIDE the reconcile, three lines after it has
 * committed the restored graph. A spec that stubs the reconcile stubs out the
 * bug. So this file drives the panel against the REAL reconcile, the REAL
 * backfill and the REAL store, and mocks only the network and the session.
 *
 * THE DEFECT THIS PINS, as measured on the deployed build (UI 138d9560,
 * CEE df3e5424) by an external audit — a read-only store subscriber captured
 * two real mounted-store transitions 3ms apart:
 *
 *   0.2 → { value: 0.7, … }   via the reconcile's setState
 *   { value: 0.7, … } → 0.2   via batchUpdateNodes ← useScenario ← restore handler
 *
 * Mechanism: `reconcileAppliedGraph` commits the restored graph, then reads the
 * CURRENT store `ceeAnalysisReady` (`mergeAppliedGraph.ts:746`) — stale, left
 * over from before the restore — and calls
 * `backfillInterventionsOntoOptionNodes`, which REPLACES a differing
 * interventions map (`applyDraftResult.ts:569-594`). The restore reported
 * success while the canvas reverted.
 *
 * MOUNT PATH. The surface driven here is the one the deployed flags mount: the
 * audit's own stack carries `assets/VersionsPanelHost-*.js`, and the panel text
 * it captured — "Restored. The shared model and this canvas now show that
 * version." — is `ServerVersionsSection.tsx`'s own success string. The
 * `server-versions-shared` mount is asserted in every test below, so a change
 * that stops mounting this section fails here rather than passing silently
 * against a component nobody renders.
 *
 * FIXTURE PROVENANCE. The ids and values are the real ones from the captured
 * staging bodies (`shared-return-stale-ready-overwrite.json`,
 * `shared-return-null-ready-control.json`): option `70180763` "Coverage Pilot",
 * factor `0d2a1d17`, stale `0.2`, restored `0.7` / control `0.3`. The seeded
 * canvas nodes are built by the REAL `mapDraftNodeToCanvas`, not hand-written,
 * so the fixture cannot encode a node shape the product does not produce
 * (trap 16-inverse: a fixture you wrote yourself is not evidence about the wire).
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'

const SCENARIO = 'a6ccf5cf-aab0-4f01-b889-e0d6c072067c'
const USER = '0f8a1b2c-3d4e-4f50-9a6b-7c8d9e0f1a2b'
const VERSION_HEAD = 'bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb'
const VERSION_OLD = 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa'
const UNDO_VERSION = 'cccccccc-3333-4333-8333-cccccccccccc'
const HASH_HEAD = 'b'.repeat(64)
const HASH_OLD = 'a'.repeat(64)

/** Real ids from the captured staging restore. */
const PILOT = '70180763'
const BASELINE = '4bba0554'
const FACTOR = '0d2a1d17'

const listModelVersions = vi.fn()
const saveModelVersion = vi.fn()
const restoreModelVersion = vi.fn()
vi.mock('../../../adapters/cee/modelVersions', () => ({
  listModelVersions: (...args: unknown[]) => listModelVersions(...args),
  saveModelVersion: (...args: unknown[]) => saveModelVersion(...args),
  restoreModelVersion: (...args: unknown[]) => restoreModelVersion(...args),
}))

vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: USER } }),
}))

vi.mock('../../../lib/supabase', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  getSessionIdentity: async () => ({ userId: USER, accessToken: 'token-for-USER' }),
}))

import {
  ServerVersionsSection,
  RESTORE_CANVAS_VALUES_NOT_APPLIED,
  SERVER_VERSIONS_DISCLOSURE,
} from '../ServerVersionsSection'
import { useCanvasStore } from '../../store'
import { mapDraftNodeToCanvas } from '../../utils/applyDraftResult'
import { interventionTargetValue } from '../../domain/interventions'

const TWO_VERSIONS = [
  {
    id: VERSION_HEAD,
    versionNumber: 2,
    label: null,
    provenance: 'commit',
    restoredFromVersionId: null,
    createdAt: '2026-08-30T03:30:00.000Z',
    graphIdentityHash: HASH_HEAD,
  },
  {
    id: VERSION_OLD,
    versionNumber: 1,
    label: 'First cut',
    provenance: 'user_save',
    restoredFromVersionId: null,
    createdAt: '2026-08-30T03:20:00.000Z',
    graphIdentityHash: HASH_OLD,
  },
]

/** A CEE-shaped option node, `interventions` at the NODE ROOT as on the wire. */
function wireOption(id: string, label: string, target: string, entry: unknown) {
  return { id, kind: 'option', label, interventions: { [target]: entry } }
}

/** The rich object CEE actually sends — not a bare number. */
function richIntervention(value: number, source: string) {
  return {
    value,
    source,
    raw_value: value,
    target_match: { node_id: FACTOR, confidence: 'high', match_type: 'exact_id' },
  }
}

/**
 * Seed the canvas through the REAL mapper, so the node shape under test is the
 * shape the product creates.
 */
function seedCanvas(nodes: unknown[]) {
  useCanvasStore.setState({
    nodes: nodes.map((n) => mapDraftNodeToCanvas(n)),
    edges: [],
  } as never)
}

function canvasValue(optionId: string, target = FACTOR): number | undefined {
  const node = useCanvasStore.getState().nodes.find((n) => n.id === optionId) as
    | { data?: { interventions?: Record<string, unknown> } }
    | undefined
  return interventionTargetValue(node?.data?.interventions?.[target])
}

function restoredResponse(nodes: unknown[], overrides: Record<string, unknown> = {}) {
  return {
    status: 'restored',
    graph: { nodes, edges: [] },
    deduped: false,
    version: { versionId: 'dddddddd-4444-4444-8444-dddddddddddd', versionNumber: 3, deduped: false },
    undoVersionId: UNDO_VERSION,
    requestId: 'req-2',
    ...overrides,
  }
}

async function restoreVersionOne() {
  render(<ServerVersionsSection />)
  await waitFor(() => expect(screen.getAllByTestId('server-version-row')).toHaveLength(2))
  // MOUNT-PATH ASSERTION — bind to the SURFACE, not merely to the function
  // under test. This section's own disclosure line is what identifies it, and
  // it is the same string the deployed capture behind this fix contains
  // ("Shared versions are stored with the scenario…"). If a flag or a refactor
  // stops mounting this section, every test in this file fails here rather than
  // passing against a component nobody renders.
  expect(screen.getByTestId('server-versions-disclosure')).toHaveTextContent(
    SERVER_VERSIONS_DISCLOSURE,
  )
  fireEvent.click(screen.getByRole('button', { name: /restore version 1/i }))
  fireEvent.click(screen.getByRole('button', { name: /confirm restore/i }))
}

beforeEach(() => {
  vi.clearAllMocks()
  useCanvasStore.setState({
    currentScenarioId: SCENARIO,
    nodes: [],
    edges: [],
    lastAuthoritativeGraph: null,
  } as never)
  useCanvasStore.getState().setCeeAnalysisReady(null)
  listModelVersions.mockResolvedValue({
    status: 'list',
    versions: TWO_VERSIONS,
    currentVersionId: VERSION_HEAD,
    requestId: 'req-1',
  })
})

afterEach(() => {
  cleanup()
  useCanvasStore.getState().setCeeAnalysisReady(null)
  useCanvasStore.setState({ currentScenarioId: null, nodes: [], edges: [] } as never)
})

describe('restore authority — the restored value survives the apply', () => {
  /**
   * ARM 1 — THE FAILING CASE. A ready map holding the PRE-RESTORE value is in
   * the store when the restore lands. This is the measured defect.
   */
  it('ARM 1 (populated-old-ready): the restored value lands AND STAYS, and the canvas is not reverted by the pre-restore ready snapshot', async () => {
    seedCanvas([
      wireOption(PILOT, 'Coverage Pilot', FACTOR, 0.2),
      wireOption(BASELINE, 'Current Coverage', FACTOR, 0.4),
    ])
    // The stale snapshot — the exact shape captured on staging, describing the
    // model as it was BEFORE the restore.
    useCanvasStore.getState().setCeeAnalysisReady({
      status: 'ready',
      goal_node_id: 'goal-1',
      options: [
        { id: PILOT, label: 'Coverage Pilot', interventions: { [FACTOR]: 0.2 }, is_baseline: false },
        { id: BASELINE, label: 'Current Coverage', interventions: { [FACTOR]: 0.4 }, is_baseline: true },
      ],
    } as never)
    expect(canvasValue(PILOT)).toBe(0.2)

    restoreModelVersion.mockResolvedValue(
      restoredResponse([
        wireOption(PILOT, 'Coverage Pilot', FACTOR, richIntervention(0.7, 'cee_hypothesis')),
        wireOption(BASELINE, 'Current Coverage', FACTOR, richIntervention(0.4, 'cee_hypothesis')),
      ]),
    )

    await restoreVersionOne()
    await waitFor(() => expect(restoreModelVersion).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(screen.getByTestId('server-versions-message')).toBeInTheDocument())

    // THE PIN: bound to the option BY ID, and to the value the restore stated.
    expect(canvasValue(PILOT)).toBe(0.7)
    // It STAYS — the defect's second transition landed 3ms after the first, so
    // a single read immediately after the apply could pass while the product
    // still reverted. Flush the microtask/timer queue and read again.
    await new Promise((r) => setTimeout(r, 0))
    expect(canvasValue(PILOT)).toBe(0.7)
    // The untouched sibling is unchanged — the fix is not a blanket rewrite.
    expect(canvasValue(BASELINE)).toBe(0.4)
  })

  /**
   * ARM 2 — THE POSITIVE CONTROL THAT MUST NOT REGRESS. With no ready snapshot
   * in the store the product already worked; the audit proved it in the same
   * browser and scenario. This arm CAN fire: it exercises the same apply path
   * and would go RED if the fix broke the working case.
   */
  it('ARM 2 (null-ready control): the case that already worked keeps working', async () => {
    seedCanvas([wireOption(PILOT, 'Coverage Pilot', FACTOR, richIntervention(0.7, 'cee_hypothesis'))])
    expect(useCanvasStore.getState().ceeAnalysisReady).toBeNull()
    expect(canvasValue(PILOT)).toBe(0.7)

    restoreModelVersion.mockResolvedValue(
      restoredResponse([
        wireOption(PILOT, 'Coverage Pilot', FACTOR, richIntervention(0.3, 'user_specified')),
      ]),
    )

    await restoreVersionOne()
    await waitFor(() => expect(canvasValue(PILOT)).toBe(0.3))
    await new Promise((r) => setTimeout(r, 0))
    expect(canvasValue(PILOT)).toBe(0.3)
    expect(screen.getByTestId('server-versions-message')).toHaveTextContent(/restored/i)
  })

  /**
   * The stale snapshot is RETIRED, not merely out-ordered. This is what stops
   * the cold path replaying the defect: `setCeeAnalysisReady(null)` also clears
   * the `olumi-cee-analysis-ready` sessionStorage keys, so a reload cannot
   * rehydrate a snapshot describing the model the user just replaced.
   */
  it('retires the pre-restore ready snapshot (store AND sessionStorage), so a reload cannot replay it', async () => {
    seedCanvas([wireOption(PILOT, 'Coverage Pilot', FACTOR, 0.2)])
    useCanvasStore.getState().setCeeAnalysisReady({
      status: 'ready',
      goal_node_id: 'goal-1',
      options: [{ id: PILOT, label: 'Coverage Pilot', interventions: { [FACTOR]: 0.2 } }],
    } as never)
    expect(useCanvasStore.getState().ceeAnalysisReady).not.toBeNull()
    expect(sessionStorage.getItem('olumi-cee-analysis-ready')).not.toBeNull()

    restoreModelVersion.mockResolvedValue(
      restoredResponse([
        wireOption(PILOT, 'Coverage Pilot', FACTOR, richIntervention(0.7, 'cee_hypothesis')),
      ]),
    )

    await restoreVersionOne()
    await waitFor(() => expect(canvasValue(PILOT)).toBe(0.7))
    expect(useCanvasStore.getState().ceeAnalysisReady).toBeNull()
    expect(sessionStorage.getItem('olumi-cee-analysis-ready')).toBeNull()
  })

  /**
   * THE POST-CONDITION FIRES. Reached through a REAL state, not a stub: the
   * reconcile's zero-overlap guard (`mergeAppliedGraph.ts:487`) drops an apply
   * whose graph shares no node id with a populated canvas, so the restored
   * values genuinely do not land. Before this change the panel printed a
   * "Restored on the server…" line; it now refuses the success claim outright.
   */
  it('refuses the success claim when the canvas did not take the restored values', async () => {
    seedCanvas([wireOption(PILOT, 'Coverage Pilot', FACTOR, 0.2)])
    restoreModelVersion.mockResolvedValue(
      restoredResponse([
        wireOption('9f9f9f9f', 'Unrelated option', FACTOR, richIntervention(0.7, 'cee_hypothesis')),
      ]),
    )

    await restoreVersionOne()
    await waitFor(() =>
      expect(screen.getByTestId('server-versions-message')).toHaveTextContent(
        RESTORE_CANVAS_VALUES_NOT_APPLIED,
      ),
    )
    // And it must NOT claim the canvas shows that version.
    expect(screen.getByTestId('server-versions-message')).not.toHaveTextContent(
      /this canvas now show/i,
    )
  })

  /**
   * ACCEPTANCE 3 — UNDO. The undo is itself a restore, so it must clear the
   * snapshot and land its own values the same way; an undo that reverted like
   * the original defect would be the same failure one gesture later.
   */
  it('ARM 3 (undo): undoing a restore lands the pre-restore values and keeps them', async () => {
    seedCanvas([wireOption(PILOT, 'Coverage Pilot', FACTOR, 0.2)])
    useCanvasStore.getState().setCeeAnalysisReady({
      status: 'ready',
      goal_node_id: 'goal-1',
      options: [{ id: PILOT, label: 'Coverage Pilot', interventions: { [FACTOR]: 0.2 } }],
    } as never)

    restoreModelVersion.mockResolvedValue(
      restoredResponse([
        wireOption(PILOT, 'Coverage Pilot', FACTOR, richIntervention(0.7, 'cee_hypothesis')),
      ]),
    )
    await restoreVersionOne()
    await waitFor(() => expect(canvasValue(PILOT)).toBe(0.7))
    await waitFor(() => expect(screen.getByTestId('server-restore-undo')).toBeInTheDocument())

    // The undo restores the PRE-restore snapshot — 0.2, the value we started on.
    restoreModelVersion.mockClear()
    restoreModelVersion.mockResolvedValue(
      restoredResponse(
        [wireOption(PILOT, 'Coverage Pilot', FACTOR, richIntervention(0.2, 'user_specified'))],
        { undoVersionId: null },
      ),
    )
    fireEvent.click(screen.getByTestId('server-restore-undo'))

    await waitFor(() => expect(restoreModelVersion).toHaveBeenCalledTimes(1))
    expect(restoreModelVersion.mock.calls[0][1]).toMatchObject({ versionId: UNDO_VERSION })
    await waitFor(() => expect(canvasValue(PILOT)).toBe(0.2))
    await new Promise((r) => setTimeout(r, 0))
    expect(canvasValue(PILOT)).toBe(0.2)
  })
})
