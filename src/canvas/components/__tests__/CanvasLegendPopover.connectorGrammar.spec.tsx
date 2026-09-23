/**
 * THE KEY MUST DESCRIBE THE CONNECTOR GRAMMAR THE CANVAS ACTUALLY DRAWS — in
 * BOTH phases (Experience Design, 23 Sep 2026, §6; spec §5 "Legend").
 *
 * What the canvas draws, derived at this change's own head:
 *   · dash      — existence certainty ONLY (`EDGE_DASH_RULES` has no contest rule);
 *   · orange    — an AI-review SIGN disagreement only, drawn SOLID;
 *   · width     — the relationship's modelled strength in BOTH phases. The spec
 *                 table says post-analysis width is "relative consequential
 *                 importance", but only "if the code actually switches". It does
 *                 not: `StyledEdge`'s P2.9 note pins width to weight magnitude in
 *                 both phases, and Experience Design's ruling is "thickness =
 *                 relationship magnitude". So the key must say the SAME thing
 *                 before and after a run, and must never say "importance";
 *   · fragility — a discreet icon cue, post-run only.
 *
 * ⚠ THE DRIFT THIS FILE EXISTS TO CATCH (purpose audit of the banked draft):
 * removing the contest dash put Olumi's review disagreements onto SOLID lines,
 * and a solid caption that said "no doubt recorded" was then false of an edge
 * the review doubted. The solid caption is scoped to what the LINE reads — the
 * model's own likelihood — and the key says where the review's view lives.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { CanvasLegendPopover } from '../CanvasLegendPopover'
import { useCanvasStore } from '../../store'
import {
  NOT_CONTESTED,
  readContestedState,
  resolveEdgeStroke,
  type EdgePresentationState,
} from '../../edges/edgePresentation'

type Status = 'idle' | 'complete'

function setPhase(status: Status): void {
  useCanvasStore.setState({
    results: { status, progress: 0 },
    nodes: [],
    optionNumbering: {},
    viewMode: 'standard',
  } as never)
}

function open(): HTMLElement {
  render(<CanvasLegendPopover />)
  fireEvent.click(screen.getByTestId('btn-canvas-legend'))
  return screen.getByTestId('canvas-legend-popover')
}

/** The swatch line that sits in the same row as a caption. */
function swatchLineFor(caption: string): SVGLineElement | null {
  const label = screen.getByText(caption)
  const row = label.parentElement as HTMLElement
  return row.querySelector('svg line') as SVGLineElement | null
}

/** The stroke the canvas paints for a live sign_flip, read from the real resolver. */
function canvasSignDisputeStroke(): string {
  const state: EdgePresentationState = {
    isStructural: false,
    lensMode: 'full',
    causalParams: null,
    evidenceClass: null,
    contested: readContestedState({
      status: 'contested',
      contested_reasons: ['sign_flip'],
      pass1: { strength_mean: 0.3, strength_std: 0.1, exists_probability: 0.8 },
      pass2: {
        strength_mean: -0.3, strength_std: 0.1, exists_probability: 0.8,
        reasoning: 'x', basis: 'domain_prior', needs_user_input: false,
      },
      max_divergence: 0.6,
      user_action: 'pending',
    }),
    isHighlighted: false,
    polarityStroke: 'var(--edge-positive)',
    existence: { kind: 'stated', dash: undefined },
    visualPropsDash: undefined,
  }
  const d = resolveEdgeStroke(state)
  // Discrimination: the fixture really reaches the orange rule, not polarity.
  expect(d.rule).toBe('contested_direction_disputed')
  expect(resolveEdgeStroke({ ...state, contested: NOT_CONTESTED }).rule).toBe('polarity')
  return d.value
}

beforeEach(() => setPhase('idle'))
afterEach(() => {
  cleanup()
  setPhase('idle')
})

describe('the line-style key: dash is existence only', () => {
  it('the dashed row is Experience Design\'s existence wording, with no "disagreement" in it', () => {
    open()
    expect(screen.getByText('Dashed: lower certainty that this connection exists is recorded')).toBeInTheDocument()
    expect(screen.queryByText('Dashed connection: a doubt or a disagreement was recorded')).toBeNull()
  })

  it('the solid row is scoped to what the line reads — the MODEL\'s own doubt — and the review\'s view is pointed to', () => {
    open()
    expect(screen.getByText('Solid: the model records little or no doubt that this connection exists')).toBeInTheDocument()
    // A solid line can now carry a review disagreement (a strength or existence
    // crossing). The key must say where that lives rather than let "solid" read
    // as "nobody doubts it".
    expect(screen.getByText('Other review disagreements: shown when you open the connection')).toBeInTheDocument()
  })
})

describe('the colour key: orange is a sign disagreement, drawn solid in the canvas\'s own stroke', () => {
  it('names the sign disagreement in Experience Design\'s words, without "your call"', () => {
    open()
    expect(screen.getByText("Orange: Olumi's two review passes disagree on direction")).toBeInTheDocument()
    expect(screen.queryByText('Orange: reviews disagree — your call')).toBeNull()
  })

  it('the orange swatch is SOLID and is the exact stroke the canvas paints for a sign_flip', () => {
    const expected = canvasSignDisputeStroke()
    open()
    const line = swatchLineFor("Orange: Olumi's two review passes disagree on direction")
    expect(line, 'the orange row has no swatch line').not.toBeNull()
    expect(line!.getAttribute('stroke')).toBe(expected)
    expect(line!.getAttribute('stroke-dasharray')).toBeNull()
  })
})

describe('the thickness key says the same thing in both phases, because the canvas does', () => {
  it.each(['idle', 'complete'] as const)('in phase %s, thicker = a stronger modelled relationship', (status) => {
    setPhase(status)
    const popover = open()
    const caption = screen.getByTestId('legend-caption-thickness')
    expect(caption.textContent).toBe('Thicker line: a stronger modelled relationship, before and after a run')
    // Never "importance": the canvas does not encode it in width in either phase.
    expect(popover.textContent ?? '').not.toMatch(/importance|consequential/i)
  })
})

describe('the fragility cue is keyed where it can appear: after a run', () => {
  it('pre-run the key does not describe a cue no connection can carry', () => {
    open()
    expect(screen.queryByTestId('legend-fragile-cue')).toBeNull()
    // Discrimination: the key is populated.
    expect(screen.getByText('Raises')).toBeInTheDocument()
  })

  it('post-run it names the cue, draws the canvas\'s own icon, and discloses the Standard-view budget', () => {
    setPhase('complete')
    open()
    const row = screen.getByTestId('legend-fragile-cue')
    // Paul 23 Sep contract feedback point 4: the cue's own sentence (no
    // "Sensitive" label) and the canvas's neutral mark (no warning triangle).
    expect(row.textContent).toBe(
      "If this connection's strength changes, the current model comparison could change. Standard view marks only the connection with the highest flip risk.",
    )
    const icon = row.querySelector('svg')
    expect(icon, 'the fragility row draws no icon').not.toBeNull()
    expect(icon!.getAttribute('class') ?? '').toMatch(/lucide-activity/)
    // No figure in the key: the number is the connection's own, on its cue.
    expect(row.textContent).not.toMatch(/\d/)
  })
})
