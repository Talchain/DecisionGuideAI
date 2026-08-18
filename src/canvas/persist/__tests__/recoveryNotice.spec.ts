/**
 * The recovery notice may not claim authorship it cannot ground.
 *
 * MEASURED DEFECT (W-1) — deployed staging `6524caed`, 2026-08-18, live
 * browser, storage cleared from `/version.json` so no SPA unload write could
 * re-seed it. A guest opened the bundled "Customer Data Platform Selection"
 * saved example and reloaded; the product said "Recovered unsaved changes from
 * your last session." about Olumi's own demo model.
 *
 * BOTH DIRECTIONS ARE PINNED HERE, and the second is not optional. The notice
 * is CORRECT for the case it was built for — a real user with real unsaved work
 * — and deleting recovery would be the same defect facing the other way. Every
 * case below has its opposite-direction twin.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { useCanvasStore } from '../../store'
import {
  RECOVERY_NOTICE_COPY,
  RECOVERY_NOTICE_KEY,
  armRecoveryNotice,
  classifyRecoveredGraph,
  consumeRecoveryNotice,
} from '../recoveryNotice'

/** A node as the autosave stores it. */
const node = (id: string, data: Record<string, unknown> = {}) => ({
  id,
  data: { label: id, ...data },
})

/** The shape `applyStarter` persists once its stamp survives the write. */
const STARTER_GRAPH = [
  node('dec_cdp', { starterId: 'vendor-selection', starterTitle: 'Customer Data Platform Selection' }),
  node('fac_snowflake', { starterId: 'vendor-selection', starterTitle: 'Customer Data Platform Selection' }),
]

/** A model the user actually built. Same shape, no starter stamp. */
const USER_GRAPH = [node('n1'), node('n2', { provenance: 'brief_extraction' })]

describe('classifyRecoveredGraph', () => {
  it('calls a restored saved example a saved example', () => {
    expect(classifyRecoveredGraph(STARTER_GRAPH)).toBe('saved_example')
  })

  it("calls a restored user model unsaved work — the case the notice was built for", () => {
    expect(classifyRecoveredGraph(USER_GRAPH)).toBe('unsaved_work')
  })

  it('finds the stamp wherever it sits, not only on the first node', () => {
    // The disclosure and the run gate both scan every node; a classification
    // that read nodes[0] would disagree with them the moment an unstamped node
    // sat first — the exact split `resolveStarterId` was written to end.
    expect(classifyRecoveredGraph([node('plain'), ...STARTER_GRAPH])).toBe('saved_example')
  })

  it('does not treat an empty or unstamped graph as an example', () => {
    expect(classifyRecoveredGraph([])).toBe('unsaved_work')
    expect(classifyRecoveredGraph([node('n1', { starterId: '' })])).toBe('unsaved_work')
  })
})

/**
 * `armRecoveryNotice` reads the graph the boot arbiter has just hydrated, so
 * these drive it the way boot does: put the restored graph in the store, then
 * arm. Hand-writing the flag instead would test the string, not the decision.
 */
function restoreIntoCanvas(nodes: ReadonlyArray<unknown>): void {
  useCanvasStore.setState({
    nodes: nodes.map(n => ({ ...(n as object), position: { x: 0, y: 0 } })) as never,
    edges: [] as never,
  })
}

describe('arm → consume, the whole handoff', () => {
  beforeEach(() => {
    sessionStorage.clear()
    useCanvasStore.setState({ nodes: [] as never, edges: [] as never })
  })

  it('NEVER tells a visitor a bundled example was their own unsaved work', () => {
    restoreIntoCanvas(STARTER_GRAPH)
    armRecoveryNotice()
    // Precondition pinned in-test: a notice must actually be pending, else the
    // absence of the false sentence would prove nothing (trap 13).
    expect(sessionStorage.getItem(RECOVERY_NOTICE_KEY), 'precondition: a notice must be armed').toBe(
      'saved_example',
    )

    const message = consumeRecoveryNotice()
    expect(message).not.toBeNull()
    expect(
      message,
      'the product announced Olumi\'s own bundled demo as the visitor\'s recovered unsaved work',
    ).not.toBe(RECOVERY_NOTICE_COPY.unsaved_work)
    expect(message).not.toMatch(/your last session/i)
    expect(message).not.toMatch(/unsaved/i)
    expect(message).toBe(RECOVERY_NOTICE_COPY.saved_example)
  })

  it('STILL recovers, and STILL says so, for genuine unsaved work', () => {
    restoreIntoCanvas(USER_GRAPH)
    armRecoveryNotice()
    expect(sessionStorage.getItem(RECOVERY_NOTICE_KEY)).toBe('unsaved_work')
    expect(consumeRecoveryNotice()).toBe('Recovered unsaved changes from your last session.')
  })

  it('the two sentences are genuinely different', () => {
    // Guards a "fix" that returns one string for both and satisfies the
    // negative assertion by accident.
    expect(RECOVERY_NOTICE_COPY.saved_example).not.toBe(RECOVERY_NOTICE_COPY.unsaved_work)
  })

  it('says nothing at all when nothing was restored', () => {
    expect(consumeRecoveryNotice()).toBeNull()
  })

  it('is consumed exactly once, so a remount cannot repeat it', () => {
    restoreIntoCanvas(USER_GRAPH)
    armRecoveryNotice()
    expect(consumeRecoveryNotice()).not.toBeNull()
    expect(consumeRecoveryNotice()).toBeNull()
    expect(sessionStorage.getItem(RECOVERY_NOTICE_KEY)).toBeNull()
  })

  it("reads a previous build's bare 'true' as unsaved work rather than falling silent", () => {
    // A tab that armed the flag before this deploy and consumed it after must
    // not lose its notice. Read-side alias only — never written.
    sessionStorage.setItem(RECOVERY_NOTICE_KEY, 'true')
    expect(consumeRecoveryNotice()).toBe(RECOVERY_NOTICE_COPY.unsaved_work)
  })

  it('ignores a value it does not recognise instead of guessing', () => {
    sessionStorage.setItem(RECOVERY_NOTICE_KEY, 'yes-please')
    expect(consumeRecoveryNotice()).toBeNull()
  })
})

describe('storage failures never break the canvas', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('arming survives a throwing sessionStorage', () => {
    useCanvasStore.setState({
      nodes: STARTER_GRAPH.map(n => ({ ...n, position: { x: 0, y: 0 } })) as never,
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })
    expect(() => armRecoveryNotice()).not.toThrow()
  })

  it('consuming survives a throwing sessionStorage', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError')
    })
    expect(consumeRecoveryNotice()).toBeNull()
  })
})
