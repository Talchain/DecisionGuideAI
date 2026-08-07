/**
 * Scenario/thread continuity fix — store + scenarios coverage.
 *
 * Covers the localStorage-side guarantees of the fix:
 *  - new scenario IDs are UUID-format (generateId → crypto.randomUUID);
 *  - saving the current *unsaved* model ADOPTS the existing conversation UUID
 *    rather than minting a replacement or silently no-opping (highest-risk path);
 *  - existing legacy-format saved models still load and remain usable, with the
 *    deliberate "save creates a new UUID-backed record" PoC compatibility behaviour;
 *  - the autosave-recovery preserve gate (UUID kept, legacy/null cleared) — the
 *    classification the ReactFlowGraph init effect applies.
 *
 * The full ReactFlowGraph render is not exercised here (ReactFlow DOM mounts are
 * fragile/excluded locally); the recovery gate's classification is unit-tested
 * against the real modules and the end-to-end refresh behaviour is proven by the
 * runtime browser re-trace on staging.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { useCanvasStore } from '../../store'
import {
  createScenario,
  saveScenarios,
  loadScenarios,
  getScenario,
  getCurrentScenarioId,
  setCurrentScenarioId,
  clearCurrentScenarioId,
  type Scenario,
} from '../scenarios'
import { isUUID } from '../../../services/turn-request-builder'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const LS_KEYS = ['olumi-canvas-scenarios', 'olumi-canvas-autosave', 'olumi-canvas-current-scenario-id']

function aNode(id = 'n1') {
  return { id, type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Factor' } } as any
}

function legacyRecord(id: string): Scenario {
  const now = Date.now()
  return {
    id,
    name: 'Legacy model',
    createdAt: now,
    updatedAt: now,
    graph: { nodes: [aNode('legacy-node')], edges: [] },
  } as Scenario
}

beforeEach(() => {
  for (const k of LS_KEYS) localStorage.removeItem(k)
  useCanvasStore.getState().reset()
})

// ---------------------------------------------------------------------------
// New-ID format
// ---------------------------------------------------------------------------

describe('new scenario ID format', () => {
  it('createScenario mints a UUID-format id (no legacy "scenario-" prefix)', () => {
    const s = createScenario({ name: 'Fresh', nodes: [aNode()], edges: [] })
    expect(UUID_RE.test(s.id)).toBe(true)
    expect(s.id.startsWith('scenario-')).toBe(false)
  })

  it('createScenario adopts an explicit id when provided', () => {
    const id = '11111111-2222-4333-8444-555555555555'
    const s = createScenario({ id, name: 'Adopted', nodes: [aNode()], edges: [] })
    expect(s.id).toBe(id)
    expect(getScenario(id)).toBeDefined()
  })
})

// ---------------------------------------------------------------------------
// Highest-risk: save current unsaved model preserves the UUID
// ---------------------------------------------------------------------------

describe('saveCurrentScenario — preserve/adopt UUID', () => {
  it('adopts the existing conversation UUID; same id before and after, no replacement, no no-op', () => {
    const X = 'a0a0a0a0-b1b1-4c2c-8d3d-e4e4e4e4e4e4'
    useCanvasStore.setState({ currentScenarioId: X as any, nodes: [aNode('keep')], edges: [] })
    // Precondition: a lazily-allocated conversation UUID with NO saved record yet.
    expect(getScenario(X)).toBeUndefined()

    const returned = useCanvasStore.getState().saveCurrentScenario('My model')

    expect(returned).toBe(X)                                   // returned id unchanged
    expect(useCanvasStore.getState().currentScenarioId).toBe(X) // store id unchanged
    const record = getScenario(X)
    expect(record).toBeDefined()                               // not a silent no-op
    expect(record!.graph.nodes.some(n => n.id === 'keep')).toBe(true)
    expect(loadScenarios()).toHaveLength(1)                    // no replacement minted
    expect(loadScenarios()[0].id).toBe(X)
  })

  it('updates in place when a record already exists (id preserved, no duplicate)', () => {
    const X = 'a0a0a0a0-b1b1-4c2c-8d3d-e4e4e4e4e4e4'
    createScenario({ id: X, name: 'Existing', nodes: [aNode('old')], edges: [] })
    useCanvasStore.setState({ currentScenarioId: X as any, nodes: [aNode('new')], edges: [] })

    const returned = useCanvasStore.getState().saveCurrentScenario()

    expect(returned).toBe(X)
    expect(loadScenarios()).toHaveLength(1)
    expect(getScenario(X)!.graph.nodes.some(n => n.id === 'new')).toBe(true)
  })

  it('mints a fresh UUID when there is no current id at all (brand-new model)', () => {
    useCanvasStore.setState({ currentScenarioId: null as any, nodes: [aNode()], edges: [] })
    const returned = useCanvasStore.getState().saveCurrentScenario()
    expect(returned).not.toBeNull()
    expect(UUID_RE.test(returned as string)).toBe(true)
    expect(useCanvasStore.getState().currentScenarioId).toBe(returned)
  })
})

// ---------------------------------------------------------------------------
// Existing legacy saved models
// ---------------------------------------------------------------------------

describe('legacy saved models', () => {
  it('a legacy-format saved model still loads and is usable', () => {
    const legacyId = 'scenario-1709827200000-abc'
    saveScenarios([legacyRecord(legacyId)])

    const ok = useCanvasStore.getState().loadScenario(legacyId)

    expect(ok).toBe(true)
    expect(useCanvasStore.getState().currentScenarioId).toBe(legacyId)
    expect(useCanvasStore.getState().nodes.some(n => n.id === 'legacy-node')).toBe(true)
    // Its id fails the UUID guard, so the next CEE turn will mint a fresh UUID
    // (proven by the useConversation "replaces legacy non-UUID scenario_id" test).
    expect(isUUID(legacyId)).toBe(false)
  })

  it('ACCEPTED PoC behaviour: after the guard mints a UUID, saving creates a NEW UUID record; the legacy record is not mutated', () => {
    const legacyId = 'scenario-1709827200000-abc'
    saveScenarios([legacyRecord(legacyId)])
    useCanvasStore.getState().loadScenario(legacyId)

    // Simulate the next CEE turn's lazy-allocation guard swapping in a UUID.
    const mintedUuid = 'c8146c5c-3a92-4ae4-8a89-9a633efa3d93'
    useCanvasStore.setState({ currentScenarioId: mintedUuid as any })
    setCurrentScenarioId(mintedUuid)

    useCanvasStore.getState().saveCurrentScenario()

    const records = loadScenarios()
    expect(records).toHaveLength(2)                            // new UUID record + untouched legacy
    expect(getScenario(mintedUuid)).toBeDefined()
    expect(getScenario(legacyId)).toBeDefined()               // legacy record NOT migrated/rewritten
    expect(getScenario(legacyId)!.id).toBe(legacyId)
  })
})

// ---------------------------------------------------------------------------
// Autosave-recovery preserve gate (classification the init effect applies)
// ---------------------------------------------------------------------------

describe('autosave-recovery preserve gate', () => {
  it('preserves a UUID-format persisted current id; clears a legacy or absent one', () => {
    // UUID → preserved
    const uuid = 'a0a0a0a0-b1b1-4c2c-8d3d-e4e4e4e4e4e4'
    setCurrentScenarioId(uuid)
    const persisted = getCurrentScenarioId()
    expect(persisted && isUUID(persisted)).toBe(true) // recovery keeps it

    // legacy → not preserved (would be cleared to null / draft mode)
    setCurrentScenarioId('scenario-1709827200000-abc')
    const legacy = getCurrentScenarioId()
    expect(!!(legacy && isUUID(legacy))).toBe(false)

    // absent → not preserved
    clearCurrentScenarioId()
    const absent = getCurrentScenarioId()
    expect(!!(absent && isUUID(absent))).toBe(false)
  })
})
