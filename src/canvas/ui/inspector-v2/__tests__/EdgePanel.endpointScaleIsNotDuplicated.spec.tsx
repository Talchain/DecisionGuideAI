/**
 * EdgePanel — the strength track carries EXACTLY ONE endpoint scale, in every
 * reachable state of the tech toggle.
 *
 * ── THE DEFECT THIS PINS, MEASURED BEFORE THE FIX ─────────────────────────
 * At pristine staging `a40ca56a`, rendering this panel at `techMode={false}` —
 * the real default, since `useTechToggle` starts `false`, i.e. EVERY default
 * user — put each of "Strong negative" / "No effect" / "Strong positive" into
 * the DOM **twice**:
 *
 *   counts @ techMode=false  →  {"Strong negative":2,"No effect":2,"Strong positive":2}
 *   counts @ techMode=true   →  {"Strong negative":1,"No effect":1,"Strong positive":1}
 *
 * One copy is this panel's own `EDGE_COPY` row; the other is
 * `SignedStrengthSlider`'s internal `{!techMode && …}` block.
 *
 * ── WHY IT WAS A CALL-SITE ERROR, NOT A SLIDER ERROR ──────────────────────
 * `techMode` on `SignedStrengthSlider` has exactly ONE consumer: that caption
 * block. On that component the flag therefore means *"suppress my own captions,
 * my host renders its own scale"* — it gates no figure, and the component
 * renders no visible number at all. `EdgePanel` was passing the inspector's
 * tech TOGGLE into it, which answers a different question (CLAUDE.md trap 21),
 * and at the toggle's default it asserted "this host has no scale" while the
 * `EDGE_COPY` row sat unconditionally two lines below.
 *
 * The introduction is datable. `bd1991dd9` (31 Mar 2026) added the slider's
 * gate with the commit line *"hidden when techMode is on — EdgePanel's numeric
 * scale replaces them"*. EdgePanel's row has never been a numeric scale: it has
 * carried these same three WORDS since `c28477e5a` (6 Mar 2026). The gate was
 * written on a false premise about its only caller, and the premise is still
 * quoted in the slider's inline comment.
 *
 * ── CLAIM TYPE ────────────────────────────────────────────────────────────
 * ⚠ Presence, exact COUNT, and containment by `data-testid` — nothing more.
 * jsdom cannot prove visibility or layout (platform trap 3), the captions sit
 * inside a collapsed `<details>`, and NOTHING here claims any caption is on
 * screen, legible, or unclipped. Rung: CODE-DERIVED. No render or journey
 * witness on a deployed build is claimed.
 *
 * ⚠ The strength vocabulary collision recorded as LATENT in
 * `inspector/coachingText.ts` (`ContestedEdgeCard` bands the same number on
 * 0.6/0.25/0.05 against `CANVAS_STRENGTH_BANDS`' 0.70/0.40/0.20) is NOT touched
 * and NOT lit: no band word is added anywhere, these three strings are
 * DIRECTION ANCHORS the slider's header deliberately names apart from that
 * table, and `techMode` is a per-instance prop that `ContestedEdgeCard` omits.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { EdgePanel } from '../panels/EdgePanel'
import { SignedStrengthSlider } from '../../inspector/SignedStrengthSlider'
import { useCanvasStore } from '../../../store'
import { useGuidanceStore } from '../../../stores/guidanceStore'

/** The exact strings, from the two places that render them. */
const CAPTIONS = ['Strong negative', 'No effect', 'Strong positive'] as const

const NODES = [
  { id: 'fac1', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Marketing budget' } },
  { id: 'out1', type: 'outcome', position: { x: 100, y: 0 }, data: { label: 'Revenue' } },
]

/** An edge with a stated strength — the branch that renders the fine-tune slider. */
function setStore(edgeData: Record<string, unknown> = {}) {
  const state = useCanvasStore.getState()
  useCanvasStore.setState({
    ...state,
    nodes: NODES,
    edges: [{
      id: 'e1',
      source: 'fac1',
      target: 'out1',
      data: { weight: 0.35, direction: 'positive', beliefExists: 0.82, beliefExistsSource: 'cee', strengthStd: 0.15, ...edgeData },
    }],
    results: { status: 'none', report: null },
  } as any)
}

const panelProps = { edgeId: 'e1', techMode: false, onClose: vi.fn(), onNavigate: vi.fn() }

function scaleRow(container: HTMLElement): HTMLElement {
  const row = container.querySelector('[data-testid="edge-strength-endpoint-scale"]')
  if (!row) throw new Error('panel endpoint-scale row absent — every count assertion below would be vacuous')
  return row as HTMLElement
}

beforeEach(() => {
  useCanvasStore.setState(useCanvasStore.getState(), true)
  useGuidanceStore.setState({ guidanceItems: [], _prefillChat: null, _sendMessage: null })
})

describe('EdgePanel — endpoint scale: the discriminator has power', () => {
  /**
   * ⭐ WITHOUT THIS, EVERY "EXACTLY ONE" BELOW IS A TAUTOLOGY WAITING TO HAPPEN.
   * If a sibling change ever made `SignedStrengthSlider` stop rendering captions
   * altogether, the counts would still read 1 and this file would be green while
   * proving nothing. This pins that the slider IS capable of adding a second
   * copy, so a count of 1 is `EdgePanel`'s doing.
   *
   * `techMode` is passed EXPLICITLY so the control does not depend on the
   * component's default, which #1751 is changing `true` → `false`.
   */
  it('PRECONDITION: an unsuppressed SignedStrengthSlider does render all three captions', () => {
    render(<SignedStrengthSlider value={0.35} onChange={vi.fn()} techMode={false} />)
    CAPTIONS.forEach((c) => {
      expect(screen.queryAllByText(c).length, `bare slider, techMode=false: "${c}"`).toBe(1)
    })
  })

  it('PRECONDITION: a suppressed SignedStrengthSlider renders none of them', () => {
    render(<SignedStrengthSlider value={0.35} onChange={vi.fn()} techMode={true} />)
    CAPTIONS.forEach((c) => {
      expect(screen.queryAllByText(c).length, `bare slider, techMode=true: "${c}"`).toBe(0)
    })
  })

  it('PRECONDITION: the panel state under test actually renders the fine-tune slider', () => {
    setStore()
    const { container } = render(<EdgePanel {...panelProps} />)
    expect(container.querySelector('input[aria-label="Effect on target"]')).not.toBeNull()
    expect(container.querySelector('[data-testid="edge-strength-endpoint-scale"]')).not.toBeNull()
  })
})

describe('EdgePanel — exactly one endpoint scale, whatever the tech toggle says', () => {
  /** The defect: this read 2/2/2 before the fix. */
  it('techMode=false (the useTechToggle default — every default user) renders each caption ONCE', () => {
    setStore()
    render(<EdgePanel {...panelProps} techMode={false} />)
    CAPTIONS.forEach((c) => {
      expect(screen.queryAllByText(c).length, `techMode=false: "${c}"`).toBe(1)
    })
  })

  /**
   * Already true before the fix, and kept so the fix cannot simply MOVE the
   * duplication into the other state — a de-duplication that trades one
   * doubled state for another is not one.
   */
  it('techMode=true renders each caption ONCE', () => {
    setStore()
    render(<EdgePanel {...panelProps} techMode={true} />)
    CAPTIONS.forEach((c) => {
      expect(screen.queryAllByText(c).length, `techMode=true: "${c}"`).toBe(1)
    })
  })

  /**
   * ⭐ BINDS BY IDENTITY, NOT BY VALUE (CLAUDE.md trap 19). "Exactly one
   * 'Strong negative' somewhere in the panel" is satisfied just as well by the
   * SLIDER's copy surviving and the panel's row being deleted — the opposite
   * change. This asserts the survivor is the panel's own `EDGE_COPY` row.
   */
  it.each([false, true])('the surviving caption is the panel\'s own row, not the slider\'s (techMode=%s)', (techMode) => {
    setStore()
    const { container } = render(<EdgePanel {...panelProps} techMode={techMode} />)
    const row = scaleRow(container)
    CAPTIONS.forEach((c) => {
      const found = screen.queryAllByText(c)
      expect(found.length, `techMode=${techMode}: "${c}"`).toBe(1)
      expect(row.contains(found[0]), `techMode=${techMode}: "${c}" must live inside the panel's scale row`).toBe(true)
    })
  })
})

describe('EdgePanel — the state where there is no track to label', () => {
  /**
   * `structuralAddStandDown === 'strength_not_stated'` swaps the whole edit
   * fieldset for the ADD control, so the slider and the scale row — unconditional
   * SIBLINGS in one `<details>` — disappear together. Recorded because it is the
   * only state with zero captions, and it is zero BY DESIGN: there is no track on
   * screen to label. It also refutes the "the panel cannot assume the slider is
   * present" reading of the duplicate: within this subtree the panel can, because
   * nothing renders one without the other.
   */
  it('awaiting a stated strength: no slider, no scale row, and so no captions', () => {
    setStore({ structuralAddStandDown: 'strength_not_stated' })
    const { container } = render(<EdgePanel {...panelProps} techMode={false} />)
    expect(container.querySelector('input[aria-label="Effect on target"]')).toBeNull()
    expect(container.querySelector('[data-testid="edge-strength-endpoint-scale"]')).toBeNull()
    CAPTIONS.forEach((c) => {
      expect(screen.queryAllByText(c).length, `awaiting stated strength: "${c}"`).toBe(0)
    })
  })
})
