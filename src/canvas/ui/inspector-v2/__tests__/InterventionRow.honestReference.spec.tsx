/**
 * ⭐⭐ THE ROW MAY NOT CLAIM A PRESENT STATE, A COMPARISON, OR A DIRECTION IT
 * CANNOT SUPPORT.
 *
 * ── THE CAPTURE THIS IS WRITTEN FROM ─────────────────────────────────────────
 * Not from my head (trap 22). Codex's joined CEE→PLoT→ISL investigation of run
 * `b0d541a9` (`output/olumi-manual-b0d541a9-20260908/MODEL-FINDINGS.md`, 8 Sep
 * 2026) read the stored model for Paul's own decision:
 *
 *     price factor `6d9a37f3`   value 0.59   raw_value 59   baseline 49   unit £
 *     option "Raise price"      intervention 0.59
 *     option "Status quo"       intervention 0.49
 *
 * Against that record the shipped row said, for the STATUS-QUO option:
 *
 *     Currently: £59   →   [ 0.49 ]        ↓ 17%   (in red)
 *
 * Four separate claims, and the model licenses none of them:
 *
 *  1. **"Currently"** asserts a present state. It prints `observedState.value`,
 *     which here holds the level ANOTHER OPTION PROPOSES. The row announced a
 *     proposal as the status quo — and then measured every option against it.
 *  2. **The arrow** spans `raw_value` (real units) and `currentValue`, which
 *     this component's own prop doc declares is on the NORMALISED scale. Both
 *     numbers were formatted correctly; the comparison between them was not
 *     licensed. #1339 is what put them at opposite ends of one arrow, and this
 *     file is the follow-up its own PR body said it needed.
 *  3. **"↓ 17%"** is measured from that same unlicensed reference, while the
 *     record separately holds `baseline: 49`. A confident figure about a
 *     reference the model never established.
 *  4. **The red** said the fall was bad. On a cost, a churn rate or a risk that
 *     is backwards, and nothing on this row knows which way is good — a factor's
 *     direction of merit lives on its EDGES.
 *
 * ── WHAT THIS FILE DOES NOT CLAIM ────────────────────────────────────────────
 * It does not fix the upstream misbinding that put a proposal in
 * `observedState.value`; that is TC's, and stated as theirs on programme #38.
 * It pins that the SURFACE stops asserting what the record does not say.
 * jsdom cannot prove visibility or colour rendering (CLAUDE.md trap 3) — the
 * colour assertions are about the class the element carries.
 *
 * ── HOW IT BINDS ─────────────────────────────────────────────────────────────
 * Every claim gets its OPPOSITE-DIRECTION TWIN, because each of these guards can
 * pass by simply never rendering anything (trap 22b): the contested case must
 * hide the percentage AND the uncontested case must still show it; the
 * cross-scale case must drop the arrow AND the same-scale case must keep it.
 * Rows are resolved by `factorId`, never by a value predicate a sibling row
 * could satisfy (trap 19).
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
/** `observedState.baseline` — a SECOND reference, differing, role undeclared. */
const OBSERVED_BASELINE = 49

const rowProps = {
  factorId: FACTOR_PRICE,
  factorLabel: FACTOR_PRICE_LABEL,
  currentValue: 0.49,
  unit: '£',
  onChange: vi.fn(),
}

describe('the row names its reference instead of asserting the present state', () => {
  it('says "Recorded", never "Currently"', () => {
    render(<InterventionRow {...rowProps} baseline={OBSERVED_VALUE} rawBaseline={OBSERVED_RAW} />)

    const reference = screen.getByTestId(`intervention-reference-${FACTOR_PRICE}`)
    expect(reference).toHaveTextContent(`${INTERVENTION_ROW_STRINGS.referenceLabel}: £59`)
    // The word itself, because the word IS the claim.
    expect(reference.textContent).not.toContain('Currently')
  })

  it('NEVER renders observedState.baseline — its role and scale are undeclared', () => {
    const { container } = render(
      <InterventionRow
        {...rowProps}
        baseline={OBSERVED_VALUE}
        rawBaseline={OBSERVED_RAW}
        recordedBaseline={OBSERVED_BASELINE}
      />,
    )

    // The specific harm: printing it with the factor's unit would be a
    // confident, well-formatted number the model never claimed — the `£0.59`
    // defect in the other direction.
    expect(screen.queryByText('£49')).toBeNull()
    expect(container.textContent).not.toContain('£49')
  })
})

describe('a percentage needs a reference the record actually establishes', () => {
  it('shows NO percentage when the record holds a second, differing reference', () => {
    render(
      <InterventionRow
        {...rowProps}
        baseline={OBSERVED_VALUE}
        rawBaseline={OBSERVED_RAW}
        recordedBaseline={OBSERVED_BASELINE}
      />,
    )

    expect(screen.queryByTestId(`intervention-delta-${FACTOR_PRICE}`)).toBeNull()
    expect(
      screen.getByTestId(`intervention-reference-contested-${FACTOR_PRICE}`),
    ).toHaveTextContent(INTERVENTION_ROW_STRINGS.contestedNote)
  })

  it('STILL shows it when nothing contests the reference — the twin', () => {
    // ⭐ Without this, the guard above would pass just as well on a change that
    // deleted the percentage outright, which is a different defect.
    render(<InterventionRow {...rowProps} baseline={OBSERVED_VALUE} rawBaseline={OBSERVED_RAW} />)

    expect(screen.getByTestId(`intervention-delta-${FACTOR_PRICE}`)).toBeInTheDocument()
    expect(screen.queryByTestId(`intervention-reference-contested-${FACTOR_PRICE}`)).toBeNull()
  })

  it('shows it when a recorded baseline AGREES with the reference', () => {
    // A second reference is only a problem when it DISAGREES. Same-valued means
    // the record is consistent and the percentage is as good as it ever was.
    render(
      <InterventionRow
        {...rowProps}
        baseline={OBSERVED_VALUE}
        rawBaseline={OBSERVED_RAW}
        recordedBaseline={OBSERVED_VALUE}
      />,
    )

    expect(screen.getByTestId(`intervention-delta-${FACTOR_PRICE}`)).toBeInTheDocument()
  })

  it('does not colour the change good or bad', () => {
    render(<InterventionRow {...rowProps} baseline={OBSERVED_VALUE} rawBaseline={OBSERVED_RAW} />)

    const delta = screen.getByTestId(`intervention-delta-${FACTOR_PRICE}`)
    // A fall in churn and a fall in revenue would have been painted the same
    // colour, and only one of them is good news.
    expect(delta.className).not.toContain('text-success')
    expect(delta.className).not.toContain('text-danger')
  })

  it('names the percentage against the RECORDED value, not "baseline"', () => {
    // `observedState.baseline` is a different field that may also be present.
    // Calling the first one "baseline" put two questions under one name on the
    // surface where the answer is read (trap 21).
    render(<InterventionRow {...rowProps} baseline={OBSERVED_VALUE} rawBaseline={OBSERVED_RAW} />)

    const delta = screen.getByTestId(`intervention-delta-${FACTOR_PRICE}`)
    expect(delta.getAttribute('title')).toBe(INTERVENTION_ROW_STRINGS.deltaTitle)
    expect(delta.getAttribute('aria-label')).toContain(INTERVENTION_ROW_STRINGS.deltaTitle)
  })
})

describe('an arrow may only span two values on one scale', () => {
  it('drops the arrow when the reference is in real units and the target is not', () => {
    render(<InterventionRow {...rowProps} baseline={OBSERVED_VALUE} rawBaseline={OBSERVED_RAW} />)

    // The editable target is normalised; `rawBaseline` is not. Naming the input
    // is honest, an arrow between them is not.
    expect(
      screen.getByTestId(`intervention-model-value-label-${FACTOR_PRICE}`),
    ).toHaveTextContent(INTERVENTION_ROW_STRINGS.modelValueLabel)
  })

  it('KEEPS the arrow when both ends share the normalised scale — the twin', () => {
    // ⭐ The pair is what proves the choice is made by SCALE and not by a
    // constant: no `rawBaseline`, so the reference and the target agree.
    render(<InterventionRow {...rowProps} baseline={OBSERVED_VALUE} />)

    expect(screen.queryByTestId(`intervention-model-value-label-${FACTOR_PRICE}`)).toBeNull()
    expect(screen.getByTestId(`intervention-reference-${FACTOR_PRICE}`)).toHaveTextContent(
      `${INTERVENTION_ROW_STRINGS.referenceLabel}: 0.59`,
    )
  })
})

describe('the editable value follows the record', () => {
  it('re-seeds when the record changes underneath an unfocused input', () => {
    const { rerender } = render(<InterventionRow {...rowProps} baseline={OBSERVED_VALUE} />)
    const input = screen.getByRole('textbox') as HTMLInputElement
    expect(input.value).toBe('0.49')

    // A chat edit, an undo, a `_dispatchAction` write — none of them come
    // through this input, and the box used to keep showing the old number.
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

describe('OptionPanel carries the record and keys rows by option AND factor', () => {
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

  it('reaches the row with observedState.baseline, so the row can decline to claim', () => {
    const utils = render(
      <InspectorModal nodeId={OPTION_STATUS_QUO} edgeId={null} onClose={vi.fn()} />,
    )
    // PRECONDITION: without the deployed chain mounted, every assertion below
    // would be about a component the product does not render (trap 3b).
    expect(
      utils.container.querySelector(NODE_INSPECTOR),
      'PRECONDITION: the node inspector dialog must be mounted',
    ).not.toBeNull()

    // The whole point of carrying it: the percentage disappears.
    expect(screen.queryByTestId(`intervention-delta-${FACTOR_PRICE}`)).toBeNull()
    expect(
      screen.getByTestId(`intervention-reference-contested-${FACTOR_PRICE}`),
    ).toBeInTheDocument()
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

    const readInput = () =>
      (screen.getByTestId(`inspector-intervention-${FACTOR_PRICE}`).querySelector('input') as HTMLInputElement).value

    expect(readInput()).toBe('0.59')

    rerender(<InspectorModal nodeId={OPTION_STATUS_QUO} edgeId={null} onClose={vi.fn()} />)
    expect(readInput()).toBe('0.49')
  })
})
