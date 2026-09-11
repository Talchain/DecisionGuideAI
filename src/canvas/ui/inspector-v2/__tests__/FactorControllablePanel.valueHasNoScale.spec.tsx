/**
 * ⭐ A NUMBER THE ENGINE CANNOT PLACE NOW SAYS SO, ON THE FACTOR ITSELF.
 *
 * ── THE DEFECT ────────────────────────────────────────────────────────────
 * A factor with NO cap, NO unit and NO FRAME RECOVERABLE FROM ITS
 * `{value, raw_value}` PAIR holds `value` AS the model scale. So a recorded
 * `70` beside `raw_value: 70` is a model-scale quantity seventy times the top
 * of the scale, with nothing saying seventy of what.
 *
 * ⚠⚠ THE CLAUSE IN CAPITALS WAS MISSING, and this header stated the premise
 * that made it missing: *"CEE persists `raw_value = value` on exactly that
 * shape."* **False, and corrected in place rather than deleted (trap 14).**
 * CEE's records projector writes magnitude-scaled factors as CAPLESS FRAMED
 * PAIRS — `value` is the level (raw ÷ frame), `raw_value` the user's magnitude
 * — and deliberately does not persist the frame as a `cap`. So capless is
 * precisely where the pair CARRIES the frame, and CASE 5 below is the shape
 * this panel used to warn about while CEE's run gate exempted it.
 * (`olumi-assistants-service` `staging` @ `c6c16885`,
 * `src/orchestrator-v5/tools/handlers/d1-shared/scale-frame.ts:1-52`.)
 *
 * `buildFactorValueEditEvent` already REFUSES to send such a commit
 * (`typedValue < 0 || typedValue > 1` on a `model_scale` basis). The gap was
 * that nothing SAID so on the surface where the number lives, so an analysis
 * could refuse on a scale ground while the factor carrying it looked ordinary.
 *
 * Driven on staging before this change: an analysis refused with
 * `blockedReason: 'baseline_scale_unresolved'` naming a factor whose stored
 * state was exactly `{ raw_value: 70, value: 70 }`, no cap, no unit. The
 * inspector for that factor offered one editable field and no word about scale.
 *
 * ⛔ WHAT THIS DOES NOT CLAIM, and the spec is written so it cannot drift into
 * claiming it: that this is WHY any given analysis refused. Refusal codes are
 * produced server-side from the whole graph. The disclosure is a statement
 * about one factor's recorded number, nothing more.
 *
 * ── WHY FOUR CASES ────────────────────────────────────────────────────────
 * Case 1 alone would pass against a disclosure that rendered unconditionally,
 * which would put a scale warning on every well-formed factor in the model —
 * louder and more wrong than saying nothing. Each twin kills a different wrong
 * implementation:
 *
 *   · predicate inverted, or disclosure removed        → CASE 1 REDs
 *   · rendered unconditionally                         → CASES 2, 3 and 4 RED
 *   · [0,1] bound dropped (any value discloses)        → CASE 2 REDs
 *   · cap ignored (a scaled factor still warns)        → CASE 3 REDs
 *   · unit ignored (a "£40,000" factor warns)          → CASE 4 REDs
 *   · `raw_value` ignored (a FRAMED factor warns)       → CASE 5 REDs
 *
 * ⚠ ASSERTIONS BIND BY IDENTITY — `factor-value-no-scale` is an exact test id
 * on the element under test, never a substring of panel prose that other copy
 * could satisfy (CLAUDE.md trap 19).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { InspectorModal } from '../../../components/InspectorModal'
import { useCanvasStore } from '../../../store'

// importOriginal-spread, NOT a hand-listed factory: `vi.mock` REPLACES the
// module, so a bare factory silently removes every other @xyflow/react export
// the subtree imports (CLAUDE.md trap 12).
vi.mock('@xyflow/react', async importOriginal => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useViewport: () => ({ x: 0, y: 0, zoom: 1 }),
}))

const NODE_INSPECTOR = 'div[role="dialog"][aria-label="Node inspector"]'
const FACTOR_ID = 'fac_quality'
const MARKER = 'factor-value-no-scale'

function seedWith(observedState: Record<string, unknown>) {
  useCanvasStore.setState({
    nodes: [
      {
        id: FACTOR_ID,
        type: 'factor',
        position: { x: 0, y: 0 },
        data: {
          kind: 'factor',
          category: 'controllable',
          label: 'Tier-1 Outsource Quality Control',
          observedState,
        },
      },
    ] as never[],
    edges: [] as never[],
    results: { status: 'idle' },
    selection: { nodeIds: new Set(), edgeIds: new Set(), anchorPosition: { x: 0, y: 0 } },
    goalThreshold: null,
    confirmedNodeIds: new Set(),
    _internal: {},
  } as never)
}

function openFactor() {
  const utils = render(<InspectorModal nodeId={FACTOR_ID} edgeId={null} onClose={vi.fn()} />)
  // PRECONDITION: without the deployed chain mounted, every assertion below is
  // about a component the product does not render (CLAUDE.md trap 3b).
  expect(
    utils.container.querySelector(NODE_INSPECTOR),
    'PRECONDITION: the node inspector dialog must be mounted',
  ).not.toBeNull()
  return utils
}

beforeEach(() => {
  vi.clearAllMocks()
  cleanup()
})

describe('a value with nothing to measure it against says so', () => {
  it('CASE 1 — no cap, no unit, value 70: the factor discloses that it has no scale', () => {
    // The exact shape measured on staging, including `source: user`.
    seedWith({ value: 70, raw_value: 70, source: 'user' })
    openFactor()
    expect(screen.getByTestId(MARKER)).toBeTruthy()
  })
})

describe('⛔ THE TWINS — it tracks the SHAPE, so it cannot just be always-on', () => {
  it('CASE 2 — a value INSIDE [0,1] is a coherent model-scale belief: no disclosure', () => {
    seedWith({ value: 0.7, raw_value: 0.7, source: 'user' })
    openFactor()
    expect(screen.queryByTestId(MARKER)).toBeNull()
  })

  it('CASE 3 — a positive cap IS the scale, so 70 needs no warning', () => {
    seedWith({ value: 0.7, raw_value: 70, cap: 100, source: 'user' })
    openFactor()
    expect(screen.queryByTestId(MARKER)).toBeNull()
  })

  it('CASE 4 — a unit makes the magnitude readable without a cap: no disclosure', () => {
    seedWith({ value: 40000, raw_value: 40000, unit: '£', source: 'user' })
    openFactor()
    expect(screen.queryByTestId(MARKER)).toBeNull()
  })

  /**
   * ⭐⭐ CASE 5 — THE FALSE ALARM THAT DEAD-ENDED, ON THE RENDERED SURFACE.
   *
   * `{value: 7, raw_value: 70}` with no cap and no unit is a CAPLESS FRAMED
   * PAIR: CEE's `recoverScaleFrame` returns `10` and the run gate
   * `findScaleIncoherentBaselineFactorIds` EXEMPTS the factor. The panel warned
   * anyway, and the remedy it prescribed — "Ask Olumi to set the range it can
   * move between" — is one Olumi refuses, so the user was walked into a dead
   * end by a warning about a scale the engine had already resolved.
   *
   * This is the panel-level twin of the predicate table in
   * `canvas/conversation/__tests__/factorValueScaleFrameAgreement.spec.ts`. It
   * is asserted HERE as well because a predicate can be correct while the
   * surface consuming it is not the one the deployed flags mount — the
   * `openFactor()` precondition above is what binds this to the mounted
   * inspector rather than to a component nothing renders (trap 3b).
   */
  it('CASE 5 — a capless FRAMED pair {value: 7, raw_value: 70} has a resolved scale: no disclosure', () => {
    seedWith({ value: 7, raw_value: 70, source: 'user' })
    openFactor()
    expect(screen.queryByTestId(MARKER)).toBeNull()
  })
})
