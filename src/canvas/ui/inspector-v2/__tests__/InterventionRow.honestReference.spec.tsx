/**
 * ⭐⭐ THE ORDINARY ROW STATES WHAT THIS OPTION SETS, AND MAKES NO OTHER CLAIM.
 *
 * ── THE CAPTURE THIS IS WRITTEN FROM ─────────────────────────────────────────
 * Not from my head (trap 22). Codex's joined CEE→PLoT→ISL investigation of run
 * `b0d541a9` (`output/olumi-manual-b0d541a9-20260908/MODEL-FINDINGS.md`) read the
 * stored model for Paul's own decision:
 *
 *     price factor `6d9a37f3`   value 0.59   raw_value 59   baseline 49   unit £
 *     option "Raise price"      intervention 0.59
 *     option "Status quo"       intervention 0.49
 *
 * Against that record the shipped row said, for the STATUS-QUO option:
 *
 *     Currently: £59   →   [ 0.49 ]        ↓ 17%   (in red)
 *
 * ── THREE VERSIONS OF THIS GUARD, AND THE ROUTE IS THE LESSON ────────────────
 * v1 printed `observedState.value` as "Currently" and measured a percentage from
 * it. That field's role is not declared, and on this capture it held a level
 * ANOTHER OPTION PROPOSED — so the row announced a proposal as the status quo.
 *
 * v2 withheld the percentage when a DIFFERING `observedState.baseline` was
 * present: `recordedBaseline !== baseline`. That compares a field of UNDECLARED
 * SCALE with a normalised one — `49 !== 0.59` is true TRIVIALLY — so it detected
 * nothing at all.
 *
 * v3 made it presence-based, and was still wrong in the direction that matters:
 * it treated the ABSENCE of a second quantity as LICENCE for the percentage.
 * Fewer facts do not make a claim more supportable. The review's counterexample
 * settles it — `baseline 0.2 / rawBaseline 20 / currentValue 0.3` with no
 * recorded baseline still rendered `Recorded: £20`, `model value 0.3` and
 * `+50%`: a raw figure beside a normalised one, and a ratio over a reference
 * whose role was never established.
 *
 * ── SO THE CONTRACT THIS FILE PINS ───────────────────────────────────────────
 * The ordinary row shows the TARGET — the option's own intervention, true
 * without reference to anything — and a label naming it as such. No recorded
 * value, no raw figure, no arrow, no percentage. The record's own numbers are
 * DIAGNOSTICS and appear only under `techMode`, labelled as what they are.
 *
 * ── WHAT THIS FILE DOES NOT CLAIM ────────────────────────────────────────────
 * It does not fix the upstream misbinding that put a proposal into
 * `observedState.value`; that is TC's and is stated as theirs on programme #38.
 * jsdom cannot prove visibility (trap 3) — these are rendered strings.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { InspectorModal } from '../../../components/InspectorModal'
import { useCanvasStore } from '../../../store'
import { InterventionRow, INTERVENTION_ROW_STRINGS } from '../shared/InterventionRow'

// importOriginal-spread, NOT a hand-listed factory: `vi.mock` REPLACES the
// module, so a bare `{ useViewport }` factory silently removes every other
// @xyflow/react export the subtree imports (CLAUDE.md trap 12).
vi.mock('@xyflow/react', async importOriginal => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useViewport: () => ({ x: 0, y: 0, zoom: 1 }),
}))

const NODE_INSPECTOR = 'div[role="dialog"][aria-label="Node inspector"]'

// ── The capture's ids and numbers, verbatim ──────────────────────────────────
const FACTOR_PRICE = '6d9a37f3'
const FACTOR_PRICE_LABEL = 'Pro plan price'
const OPTION_RAISE = 'opt-raise'
const OPTION_STATUS_QUO = 'opt-status-quo'

/** `observedState.value` — normalised, and on this capture a PROPOSED level. */
const OBSERVED_VALUE = 0.59
/** `observedState.raw_value` — the same quantity in real units. */
const OBSERVED_RAW = 59
/** `observedState.baseline` — a SECOND reference, role and scale undeclared. */
const OBSERVED_BASELINE = 49

const rowProps = {
  factorId: FACTOR_PRICE,
  factorLabel: FACTOR_PRICE_LABEL,
  currentValue: 0.49,
  unit: '£',
  onChange: vi.fn(),
}

/** Every input shape the row can receive, so the sweeps below are not vacuous. */
const INPUT_SHAPES = [
  {
    name: 'the live capture',
    props: { baseline: OBSERVED_VALUE, rawBaseline: OBSERVED_RAW, recordedBaseline: OBSERVED_BASELINE },
  },
  { name: 'the review counterexample', props: { baseline: 0.2, rawBaseline: 20 } },
  { name: 'normalised only', props: { baseline: OBSERVED_VALUE } },
  { name: 'nothing recorded at all', props: {} },
] as const

describe('the ordinary row claims only what this option sets', () => {
  it('names the target, on every input shape', () => {
    for (const shape of INPUT_SHAPES) {
      const { unmount } = render(<InterventionRow {...rowProps} {...shape.props} />)
      expect(
        screen.getByTestId(`intervention-sets-${FACTOR_PRICE}`),
        `${shape.name}: no target label`,
      ).toHaveTextContent(INTERVENTION_ROW_STRINGS.setsLabel)
      unmount()
    }
  })

  it('shows NO percentage — on any input, including with nothing recorded', () => {
    // ⭐ THE COUNTEREXAMPLE THAT KILLED v3 IS IN THE SWEEP. `baseline 0.2 /
    // rawBaseline 20` and no recorded baseline used to render `+50%`, because
    // the guard read the absence of a second quantity as permission. A ratio
    // needs a reference with a ROLE and a SCALE; this record establishes neither.
    for (const shape of INPUT_SHAPES) {
      const { container, unmount } = render(<InterventionRow {...rowProps} {...shape.props} />)
      expect(container.textContent, `${shape.name}: a percentage survived`).not.toMatch(/\d\s*%/)
      unmount()
    }
  })

  it('shows NO recorded or raw figure in the ordinary row', () => {
    for (const shape of INPUT_SHAPES) {
      const { container, unmount } = render(<InterventionRow {...rowProps} {...shape.props} />)
      const text = container.textContent ?? ''
      expect(text, `${shape.name}: the recorded label leaked into default mode`).not.toContain(
        INTERVENTION_ROW_STRINGS.referenceLabel,
      )
      // The specific harm on the live capture: a raw currency figure the reader
      // would pair with the normalised target beside it.
      expect(text, `${shape.name}: a raw currency figure leaked`).not.toContain('£59')
      expect(screen.queryByTestId(`intervention-diagnostics-${FACTOR_PRICE}`)).toBeNull()
      unmount()
    }
  })

  it('NEVER renders observedState.baseline as a quantity, in either mode', () => {
    // Its role AND its scale are undeclared, so formatting it with the factor's
    // unit would repeat the `£0.59` defect in the other direction. Under
    // techMode it appears only beside its own wire name, never as `£49`.
    for (const techMode of [false, true]) {
      const { container, unmount } = render(
        <InterventionRow
          {...rowProps}
          baseline={OBSERVED_VALUE}
          rawBaseline={OBSERVED_RAW}
          recordedBaseline={OBSERVED_BASELINE}
          techMode={techMode}
        />,
      )
      expect(container.textContent, `techMode=${techMode}: a formatted £49 appeared`).not.toContain(
        '£49',
      )
      unmount()
    }
  })
})

describe('the record is a diagnostic, and only an operator sees it', () => {
  it('reveals the recorded figures under techMode, labelled as what they are', () => {
    render(
      <InterventionRow
        {...rowProps}
        baseline={OBSERVED_VALUE}
        rawBaseline={OBSERVED_RAW}
        recordedBaseline={OBSERVED_BASELINE}
        techMode
      />,
    )

    const diagnostics = screen.getByTestId(`intervention-diagnostics-${FACTOR_PRICE}`)
    expect(diagnostics).toHaveTextContent(INTERVENTION_ROW_STRINGS.referenceLabel)
    expect(diagnostics.textContent).toContain('observed_state.baseline')
  })

  it('CONTRAST — the same fixture in default mode shows none of it', () => {
    // ⭐ Without the pair, the assertion above would pass just as well on a row
    // that always rendered diagnostics, and the techMode branch would be dead.
    render(
      <InterventionRow
        {...rowProps}
        baseline={OBSERVED_VALUE}
        rawBaseline={OBSERVED_RAW}
        recordedBaseline={OBSERVED_BASELINE}
      />,
    )
    expect(screen.queryByTestId(`intervention-diagnostics-${FACTOR_PRICE}`)).toBeNull()
  })
})

describe('the editable value follows the record', () => {
  it('re-seeds when the record changes underneath an unfocused input', () => {
    const { rerender } = render(<InterventionRow {...rowProps} baseline={OBSERVED_VALUE} />)
    const input = screen.getByRole('textbox') as HTMLInputElement
    expect(input.value).toBe('0.49')

    // A chat edit, an undo, a `_dispatchAction` write — none come through this
    // input, and the box used to keep showing the old number.
    rerender(<InterventionRow {...rowProps} baseline={OBSERVED_VALUE} currentValue={0.62} />)
    expect(input.value).toBe('0.62')
  })

  it('does NOT re-seed while the user is typing in it', () => {
    const { rerender } = render(<InterventionRow {...rowProps} baseline={OBSERVED_VALUE} />)
    const input = screen.getByRole('textbox') as HTMLInputElement

    input.focus()
    fireEvent.change(input, { target: { value: '0.8' } })
    rerender(<InterventionRow {...rowProps} baseline={OBSERVED_VALUE} currentValue={0.62} />)

    // Eating a half-typed number would be the fix causing a worse defect.
    expect(input.value).toBe('0.8')
  })
})

// ── The plumbing, through the DEPLOYED inspector chain ───────────────────────

function factorNode(id: string, label: string, observed: Record<string, unknown>) {
  return {
    id,
    type: 'factor',
    position: { x: 0, y: 0 },
    data: { kind: 'factor', category: 'controllable', label, observedState: observed },
  }
}

function optionNode(id: string, label: string, interventions: Record<string, unknown>) {
  return {
    id,
    type: 'option',
    position: { x: 0, y: 0 },
    data: { kind: 'option', label, provenance: 'ai_inferred', interventions },
  }
}

describe('through the mounted inspector, on the live capture', () => {
  beforeEach(() => {
    useCanvasStore.setState({
      nodes: [
        factorNode(FACTOR_PRICE, FACTOR_PRICE_LABEL, {
          value: OBSERVED_VALUE,
          raw_value: OBSERVED_RAW,
          baseline: OBSERVED_BASELINE,
          unit: '£',
        }),
        optionNode(OPTION_RAISE, 'Raise price', { [FACTOR_PRICE]: 0.59 }),
        optionNode(OPTION_STATUS_QUO, 'Status quo', { [FACTOR_PRICE]: 0.49 }),
      ] as never[],
      edges: [],
      results: { status: 'idle' },
      selection: { nodeIds: new Set(), edgeIds: new Set(), anchorPosition: { x: 0, y: 0 } },
      goalThreshold: null,
      confirmedNodeIds: new Set(),
      _internal: {},
    } as never)
  })

  it('offers the reader no comparison at all', () => {
    const utils = render(
      <InspectorModal nodeId={OPTION_STATUS_QUO} edgeId={null} onClose={vi.fn()} />,
    )
    // PRECONDITION: without the deployed chain mounted, every assertion below
    // would be about a component the product does not render (trap 3b).
    expect(
      utils.container.querySelector(NODE_INSPECTOR),
      'PRECONDITION: the node inspector dialog must be mounted',
    ).not.toBeNull()

    const row = screen.getByTestId(`inspector-intervention-${FACTOR_PRICE}`)
    expect(row).toHaveTextContent(INTERVENTION_ROW_STRINGS.setsLabel)
    expect(row.textContent).not.toContain(INTERVENTION_ROW_STRINGS.referenceLabel)
    expect(row.textContent).not.toContain('£59')
    expect(row.textContent).not.toMatch(/\d\s*%/)
  })

  it('replaces the displayed value when you switch to an option sharing the factor', () => {
    // ⚠ SCOPE, STATED. This asserts the OUTCOME. Two changes produce it — the
    // key now carrying `${optionId}:${factorId}`, and the row's own re-seed
    // effect — and this test cannot tell them apart, because either alone would
    // satisfy it. The key is the identity correction (an intervention lives at
    // `/nodes/<option>/data/interventions/<factor>`, per the contract); the
    // effect covers same-option writes the key cannot see. Both are kept, and
    // the redundancy is deliberate rather than unnoticed.
    const { rerender, container } = render(
      <InspectorModal nodeId={OPTION_RAISE} edgeId={null} onClose={vi.fn()} />,
    )
    expect(container.querySelector(NODE_INSPECTOR)).not.toBeNull()

    // ⚠⚠ READS THE VALUE, NOT AN INPUT — and it read an input until O08 landed.
    // The mounted inspector is read-only now, so the target renders as text and
    // `querySelector('input')` returns null; this arm failed on the locator, not
    // on the property. The property is unchanged: switching options must replace
    // the displayed target.
    const readTarget = () =>
      screen
        .getByTestId(`intervention-target-readonly-${FACTOR_PRICE}`)
        .textContent?.trim() ?? ''

    expect(readTarget()).toContain('0.59')

    rerender(<InspectorModal nodeId={OPTION_STATUS_QUO} edgeId={null} onClose={vi.fn()} />)
    const after = readTarget()
    expect(after).toContain('0.49')
    // ⚠ INCLUSION ALONE CANNOT SEPARATE "REPLACED" FROM "APPENDED". The
    // qualifier forced the move from exact equality to substring inclusion, and
    // that quietly dropped the half that mattered: showing BOTH values would
    // have passed. The same assertion the description switch already carries.
    expect(after, "the previous option's target survived the switch").not.toContain('0.59')
  })
})
