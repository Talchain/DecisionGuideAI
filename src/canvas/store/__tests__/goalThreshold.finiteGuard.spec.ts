/**
 * The success target must be a FINITE number, at the one writer every caller
 * funnels through.
 *
 * ⚠ THIS BOUND WAS ALREADY DECLARED — ON THE SIBLING WRITER ONLY.
 * `AdvancedField.tsx` records the defect measured by driving it on 3 Sep 2026:
 * `Infinity`, `-Infinity`, `1e400` and `9e999` ALL COMMITTED, because
 * `parseFloat` returns `±Infinity` for each and `isNaN(Infinity)` is `false`.
 * It fixed its own path with `Number.isFinite` and recorded that this "one
 * predicate is the reachable source of every non-finite magnitude in the
 * model".
 *
 * That last claim is incomplete, and this spec is the evidence. `AdvancedField`
 * guards `goal_threshold_raw` via `useInspectorMutations.setThreshold`.
 * `success_threshold` reaches the model through a DIFFERENT writer,
 * `setGoalThresholdAndUpdateNode`, which had no finiteness check at all — and
 * its live caller on the Model tab validates with `!isNaN(n) && n >= 0`, which
 * admits `Infinity` (`GoalSection.tsx:133-136`, another lane's file, read
 * only). The value then rides the node-data passthrough to PLoT and CEE, since
 * neither `V2_NODE_BLOCKLIST` nor `CANVAS_ONLY_NODE_KEYS` lists it.
 *
 * ⚠ FINITENESS, NOT A RANGE. `success_threshold` under `threshold_source:
 * 'user'` is RAW USER UNITS, deliberately not normalised — a `[0, 1]` bound
 * here would be wrong, and no range bound is declared for it anywhere in the
 * repo. This asserts only the bound that IS written down.
 *
 * Seven product call sites reach this action across four different areas, so
 * the guard belongs at the store choke point: a per-caller fix would be the
 * hand-maintained mirror this estate keeps paying for.
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { useCanvasStore } from '../../store'

const goalNode = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  type: 'goal',
  position: { x: 0, y: 0 },
  data: { label: id, ...extra },
})

/**
 * ⚠ `goalThreshold: null` IS EXPLICIT ON PURPOSE — `reset()` DOES NOT CLEAR IT.
 *
 * Measured at this tip: set a target of 60, call `reset()`, and the scalar is
 * still 60. Without this line each test inherits the previous one's value, and
 * the leak is invisible while the guard works (every write is refused, so the
 * scalar never moves) and only appears under mutation — which is exactly the
 * shape of an isolation defect that survives review. Found while explaining an
 * unaccounted-for failure count in the mutant kit.
 */
const seed = () =>
  useCanvasStore.setState({
    nodes: [goalNode('goal_1')],
    edges: [],
    outcomeNodeId: 'goal_1',
    goalThreshold: null,
    goalThresholdRepresentation: null,
  } as never)

const nodeThreshold = () =>
  (useCanvasStore.getState().nodes.find(n => n.id === 'goal_1')?.data as
    | { success_threshold?: unknown }
    | undefined)?.success_threshold

describe('setGoalThresholdAndUpdateNode — finiteness guard', () => {
  beforeEach(() => {
    useCanvasStore.getState().reset()
    seed()
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  /**
   * The values driven and measured as committing on the sibling path.
   *
   * ⚠ `1e400` GOES THROUGH `parseFloat`, NOT A LITERAL — and that is the more
   * faithful test, not merely a lint workaround. A bare `1e400` literal trips
   * `no-loss-of-precision` (correctly: it IS `Infinity`), but more importantly
   * the production path never sees a literal. Every writer reaching this action
   * parses a typed string, and `parseFloat('1e400') === Infinity` is exactly
   * the mechanism `AdvancedField.tsx` recorded when it drove the defect:
   * `isNaN(Infinity)` is `false`, so the value sailed through. Building the
   * case the way the product builds it keeps the fixture honest about the wire.
   */
  const nonFinite: Array<[string, number]> = [
    ['Infinity', Infinity],
    ['-Infinity', -Infinity],
    ["parseFloat('1e400') — the fat-finger path", parseFloat('1e400')],
    ['NaN', Number.NaN],
  ]

  for (const [label, value] of nonFinite) {
    it(`refuses ${label} rather than writing it to the model`, () => {
      useCanvasStore.getState().setGoalThresholdAndUpdateNode('goal_1', value)
      expect(useCanvasStore.getState().goalThreshold).toBeNull()
      expect(nodeThreshold()).toBeUndefined()
    })
  }

  it('leaves an EXISTING good target untouched when a non-finite value arrives', () => {
    // The dangerous case: a refusal that still clears is a silent data loss.
    useCanvasStore.getState().setGoalThresholdAndUpdateNode('goal_1', 60)
    expect(useCanvasStore.getState().goalThreshold).toBe(60)

    useCanvasStore.getState().setGoalThresholdAndUpdateNode('goal_1', Infinity)
    expect(useCanvasStore.getState().goalThreshold).toBe(60)
    expect(nodeThreshold()).toBe(60)
  })

  it('says why it refused, rather than failing silently', () => {
    useCanvasStore.getState().setGoalThresholdAndUpdateNode('goal_1', Infinity)
    expect(console.warn).toHaveBeenCalled()
    const said = (console.warn as unknown as { mock: { calls: unknown[][] } }).mock.calls
      .flat()
      .filter(a => typeof a === 'string')
      .join(' ')
    expect(said).toContain('finite')
  })
})

describe('setGoalThresholdAndUpdateNode — the guard does not narrow the field', () => {
  beforeEach(() => {
    useCanvasStore.getState().reset()
    seed()
  })

  it('still accepts an ordinary target', () => {
    useCanvasStore.getState().setGoalThresholdAndUpdateNode('goal_1', 60)
    expect(useCanvasStore.getState().goalThreshold).toBe(60)
    expect(nodeThreshold()).toBe(60)
  })

  it('still accepts null, which CLEARS the target', () => {
    useCanvasStore.getState().setGoalThresholdAndUpdateNode('goal_1', 60)
    useCanvasStore.getState().setGoalThresholdAndUpdateNode('goal_1', null)
    expect(useCanvasStore.getState().goalThreshold).toBeNull()
    expect(nodeThreshold()).toBeNull()
  })

  it('still accepts zero, and a negative raw target', () => {
    // ⚠ RAW USER UNITS. A target may legitimately be 0 or negative (reduce
    // churn to -2%), so the guard must not smuggle in a `>= 0` range the way
    // the Model tab's own validator does.
    useCanvasStore.getState().setGoalThresholdAndUpdateNode('goal_1', 0)
    expect(useCanvasStore.getState().goalThreshold).toBe(0)
    useCanvasStore.getState().setGoalThresholdAndUpdateNode('goal_1', -2)
    expect(useCanvasStore.getState().goalThreshold).toBe(-2)
  })

  it('still accepts a very large but finite target', () => {
    useCanvasStore.getState().setGoalThresholdAndUpdateNode('goal_1', 1e308)
    expect(useCanvasStore.getState().goalThreshold).toBe(1e308)
  })
})
