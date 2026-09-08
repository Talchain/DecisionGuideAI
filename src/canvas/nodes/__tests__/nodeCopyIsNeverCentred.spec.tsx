/**
 * ⭐⭐ NODE COPY IS NEVER HORIZONTALLY CENTRED — mechanism-derived, and FIVE
 * COMPONENTS DEEP. Read the coverage block below before trusting a green run:
 * this file is not the whole guarantee and an earlier draft of this header
 * claimed it was.
 *
 * Paul, 5 Sep 2026, on the deployed canvas: *"It should NEVER be centrally
 * aligned. Strip any formatting that says central alignment within the nodes."*
 *
 * ── WHY THIS IS A WALKER AND NOT A LIST OF ASSERTIONS ──────────────────────
 *
 * The obvious spec is `expect(badge.className).not.toContain('text-center')`,
 * one line per known offender. That is the hand-maintained mirror CLAUDE.md
 * trap 12 exists to ban: it pins the two sites we happened to find today and is
 * blind to the third one added next week. Worse, it is blind RIGHT NOW — see
 * mechanism 4 below.
 *
 * So this enumerates the MECHANISMS by which copy can end up centred and walks
 * the rendered subtree looking for any of them.
 *
 * ── ⚠⚠ WHAT THIS COVERS, AND THE 9-OF-14 GAP IT DOES NOT ───────────────────
 *
 * An earlier draft of this header said a new centred string "fails this
 * whatever file it is written in and whichever mechanism it uses". That is
 * FALSE about this walker and it is the sentence a later session would have
 * inherited. This is a jsdom render of FIVE components — the five imported
 * below — out of the 14 `.tsx` node components in this directory. Derived at
 * `11f8f594`: `ls src/canvas/nodes/*.tsx` = 14, imports below = 5.
 *
 * The real guarantee is a PAIR of instruments, and it is UNEVEN PER MECHANISM:
 *
 *   ✅ mechanisms 1, 2 and 4 — `text-center`, inline `textAlign`, and `flex-col`
 *      co-occurring with `items-center` — are asserted at ZERO across the WHOLE
 *      node surface by the sibling `nodeCopyNeverCentred.sourceScan.spec.ts`
 *      (43 non-test `.ts`/`.tsx` files under this directory, walked
 *      recursively). Those three do fail "whatever file it is written in".
 *
 *   ⚠ mechanisms 3 and 5 — `mx-auto`, and a flex ROW plus `justify-center` —
 *      are covered ONLY here, i.e. only inside those five components. That scan
 *      deliberately does not assert `justify-center` globally — its own header
 *      is AUTHORITATIVE on why, and on how many uses remain, because it derives
 *      that count from the same comment-blanked sources it tests; this file
 *      does not restate it. `mx-auto` is asserted NOWHERE outside this file.
 *
 * Concretely: centring copy with `mx-auto`, or with a `justify-center` flex row,
 * inside `ActionNode`, `ConstraintBadge`, `EvidenceGapBadge`, `FactorNode`,
 * `GoalNode`, `NodeShapeIndicator`, `OptionNode`, `OutcomeNode` or
 * `nodeKeyboardScope` fails NEITHER instrument today. Nine of the fourteen, two
 * of the five mechanisms. Closing it means mounting those components here or
 * widening the static scan — not editing this sentence.
 *
 * ── THE FIVE MECHANISMS, AND WHY A CLASS-NAME SWEEP MISSES TWO ─────────────
 *
 *  1. `text-center` on the element (or any ancestor — `text-align` inherits).
 *  2. inline `style={{ textAlign: 'center' }}` — invisible to a Tailwind grep.
 *  3. `mx-auto` on the element's own box.
 *  4. ⭐ an ancestor that is `flex flex-col items-center`. In a COLUMN flex
 *     container `items-center` is the HORIZONTAL axis. This is the one that
 *     defeats a `text-center` sweep: `GhostTierNode` carries BOTH, so deleting
 *     `text-center` alone changes nothing on screen and a class-absence
 *     assertion would go green over an unchanged canvas.
 *  5. an ancestor that is `flex` (row) + `justify-center`.
 *
 * ── WHY THE EXEMPTION IS A DECLARATION AND NOT A LIST IN THIS FILE ─────────
 *
 * Some centred glyphs are correct: the `#2` key-driver badge, the option
 * ordinal, the `?` reliability marker — fixed square boxes where centring IS
 * the design. Listing them here would be a second hand-maintained mirror, and
 * it would go stale silently in the safe direction (the guard quietly stops
 * covering a badge that grew copy).
 *
 * Instead the component DECLARES it: `data-node-glyph` on the box. The
 * declaration is visible in the diff, so centring new copy costs a reviewer's
 * attention rather than nothing. A guard whose exemptions must be argued for in
 * review is the fail-loud form of trap 12.
 *
 * ── WHAT THIS IS AND IS NOT EVIDENCE ABOUT (CLAUDE.md trap 3) ──────────────
 *
 * jsdom has no layout and no Tailwind stylesheet, so nothing here measures a
 * pixel. This asserts the DECLARED ALIGNMENT MECHANISMS present in the rendered
 * markup. That is the right instrument for this rule: the rule is about what
 * the source declares, and the browser evidence for the two sites it fixes is
 * recorded in the PR.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import type { NodeProps } from '@xyflow/react'
import { Target } from 'lucide-react'

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return { ...actual, Handle: () => null }
})

const makeStoreState = (overrides: Record<string, unknown> = {}) => ({
  results: { status: 'idle', report: null },
  highlightedNodes: new Set(),
  dimmedNodeIds: new Set(),
  lens: { _dimmedNodeIds: new Set(), _hiddenNodeIds: new Set(), active: 'full' },
  goalThreshold: null,
  goalConstraints: [],
  edges: [],
  nodes: [],
  viewMode: 'standard',
  currentScenarioId: null,
  selectNodeWithoutHistory: vi.fn(),
  ...overrides,
})

vi.mock('../../store', () => ({
  useCanvasStore: Object.assign(
    vi.fn((selector: (s: unknown) => unknown) => selector(makeStoreState())),
    { getState: () => makeStoreState() },
  ),
}))

vi.mock('../../hooks/useNodeDisplayMetadata', () => ({
  useNodeDisplayMetadata: vi.fn(() => ({
    sensitivityRank: 2,
    influence: null,
    confidence: null,
    inSensitivityAnalysis: false,
    achievementProbability: null,
    stabilityPercentage: null,
    winRate: null,
    isResultsMode: false,
    predictedOutcome: null,
    valueOfInformation: null,
    voiRank: null,
  })),
}))

import { RiskNode } from '../RiskNode'
import { GhostTierNode } from '../GhostTierNode'
import { GhostOptionNode } from '../GhostOptionNode'
import { DecisionNode } from '../DecisionNode'
import { BaseNode } from '../BaseNode'

// ---------------------------------------------------------------------------
// The walker
// ---------------------------------------------------------------------------

/** The copy an element OWNS — its direct text children, not its subtree's. */
function ownCopy(el: Element): string {
  return Array.from(el.childNodes)
    .filter((n) => n.nodeType === Node.TEXT_NODE)
    .map((n) => n.textContent ?? '')
    .join('')
    .trim()
}

const has = (el: Element, cls: string) => el.classList.contains(cls)
const isFlex = (el: Element) => has(el, 'flex') || has(el, 'inline-flex')
const isFlexCol = (el: Element) => isFlex(el) && has(el, 'flex-col')
const isFlexRow = (el: Element) => isFlex(el) && !has(el, 'flex-col')

/**
 * Every reason this element's copy renders centred, named. Returns [] when the
 * copy is left to sit where the reading order puts it.
 *
 * ⚠ Ancestors are walked, not just the parent. `text-align` inherits, and a
 * centring flex container is frequently two levels above the span that owns
 * the words (`GhostOptionNode` puts an icon+label group inside the door).
 */
function centringReasons(el: Element, root: Element): string[] {
  const reasons: string[] = []
  if (has(el, 'mx-auto')) reasons.push('mx-auto on the element itself')

  let node: Element | null = el
  while (node && node !== root.parentElement) {
    const where = node === el ? 'itself' : `ancestor <${node.tagName.toLowerCase()}>`
    if (has(node, 'text-center')) reasons.push(`text-center on ${where}`)
    if ((node as HTMLElement).style?.textAlign === 'center') {
      reasons.push(`inline textAlign:center on ${where}`)
    }
    // ⚠ THE ELEMENT ITSELF COUNTS, and my first cut of this walker excluded it.
    // A flex container with a raw text child makes that text an ANONYMOUS FLEX
    // ITEM, so `justify-center` centres it exactly as it centres a `<span>`.
    // Excluding self let `<div className="flex justify-center">#2</div>` pass —
    // i.e. the guard was blind to the very badges the glyph exemption exists to
    // declare, and would have been blind to any future copy written that way.
    if (isFlexCol(node) && has(node, 'items-center')) {
      reasons.push(`flex-col + items-center on ${where} (items-center is the HORIZONTAL axis in a column)`)
    }
    if (isFlexRow(node) && has(node, 'justify-center')) {
      reasons.push(`flex row + justify-center on ${where}`)
    }
    node = node.parentElement
  }
  return reasons
}

const isDeclaredGlyph = (el: Element, root: Element): boolean => {
  let node: Element | null = el
  while (node && node !== root.parentElement) {
    if (node.hasAttribute('data-node-glyph')) return true
    node = node.parentElement
  }
  return false
}

interface Violation { copy: string; reasons: string[] }

/**
 * Copy is anything of two characters or more. One character is a glyph by
 * construction (`?`, `+`, `2`), and a two-digit ordinal or a `#2` rank badge is
 * a glyph by DECLARATION — `data-node-glyph` — never by this function guessing.
 */
function centredCopy(container: HTMLElement): Violation[] {
  const out: Violation[] = []
  for (const el of Array.from(container.querySelectorAll('*'))) {
    if (el.getAttribute('aria-hidden') === 'true' && ownCopy(el).length === 0) continue
    const copy = ownCopy(el)
    if (copy.length < 2) continue
    if (isDeclaredGlyph(el, container)) continue
    const reasons = centringReasons(el, container)
    if (reasons.length > 0) out.push({ copy, reasons })
  }
  return out
}

const report = (v: Violation[]) =>
  v.map((x) => `  "${x.copy}" — ${x.reasons.join('; ')}`).join('\n')

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const nodeProps = (over: Record<string, unknown>) =>
  ({
    id: 'n-1', position: { x: 0, y: 0 }, selected: false, isConnectable: true,
    positionAbsoluteX: 0, positionAbsoluteY: 0, dragging: false, zIndex: 0,
    ...over,
  }) as unknown as NodeProps

/** BaseNode is not a react-flow node type — it takes the full prop set
 *  directly, exactly as `BaseNode.maxWidth.spec.tsx` supplies it. */
const baseNodeProps = {
  id: 'n-1', type: 'factor', selected: false, dragging: false, zIndex: 0,
  isConnectable: true, positionAbsoluteX: 0, positionAbsoluteY: 0,
  deletable: true, draggable: true, selectable: true,
} as unknown as NodeProps

const mount = (ui: React.ReactElement) =>
  render(<ReactFlowProvider>{ui}</ReactFlowProvider>).container

// ---------------------------------------------------------------------------

describe('the walker can see a centring it is pointed at (positive control)', () => {
  // CLAUDE.md trap 13: an absence assertion is vacuous until it has proved it
  // can see a presence. All four mechanisms, on copy this file authored.
  it.each([
    ['text-center class', <div key="a" className="text-center">Centred copy</div>],
    ['inline textAlign', <div key="b" style={{ textAlign: 'center' }}>Centred copy</div>],
    ['mx-auto', <div key="c" className="mx-auto">Centred copy</div>],
    ['flex-col + items-center', <div key="d" className="flex flex-col items-center"><span>Centred copy</span></div>],
    ['flex row + justify-center', <div key="e" className="flex justify-center"><span>Centred copy</span></div>],
    // The self case: raw text inside the flex container is an anonymous flex
    // item and is centred just the same. This control is why the walker checks
    // the element itself and not only its ancestors.
    ['justify-center on the copy element itself', <div key="f" className="flex justify-center">Centred copy</div>],
  ])('detects %s', (_name, ui) => {
    const { container } = render(<div>{ui}</div>)
    expect(centredCopy(container)).toHaveLength(1)
  })

  it('leaves left-aligned copy alone, and does not fire on a declared glyph', () => {
    const { container } = render(
      <div>
        <div className="flex items-center gap-1"><span>Left aligned copy</span></div>
        <span data-node-glyph className="flex items-center justify-center">#2</span>
      </div>,
    )
    expect(centredCopy(container)).toEqual([])
  })
})

describe('the five walked components render no centred copy (see header: 9 of 14 unwalked)', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('RiskNode — the severity badge is body copy in the always-visible Standard view', () => {
    const container = mount(
      <RiskNode {...nodeProps({
        type: 'risk',
        data: { type: 'risk', label: 'Key engineer leaves', probability: 0.9, impact: 'high' },
      })} />,
    )
    // Pin the precondition IN-TEST (trap 13b): assert the badge this case is
    // about actually rendered, so a fixture that stopped producing a severity
    // cannot pass this by rendering nothing.
    expect(container.textContent).toContain('High Risk')
    const found = centredCopy(container)
    expect(found, `RiskNode centres copy:\n${report(found)}`).toEqual([])
  })

  it('GhostTierNode — the door label is a whole sentence', () => {
    const container = mount(
      <GhostTierNode {...nodeProps({ id: '__ghost-risk__', type: 'ghost-tier', data: { tier: 'risk', label: 'What else could go wrong?' } })} />,
    )
    expect(container.textContent).toContain('What else could go wrong?')
    const found = centredCopy(container)
    expect(found, `GhostTierNode centres copy:\n${report(found)}`).toEqual([])
  })

  it('GhostOptionNode — same sentence-length copy as the tier door', () => {
    const container = mount(
      <GhostOptionNode {...nodeProps({ id: '__ghost-option__', type: 'ghost-option', data: {} })} />,
    )
    expect(container.textContent?.length ?? 0).toBeGreaterThan(2)
    const found = centredCopy(container)
    expect(found, `GhostOptionNode centres copy:\n${report(found)}`).toEqual([])
  })

  it('DecisionNode — the anchor card, title and body', () => {
    const container = mount(
      <DecisionNode {...(nodeProps({ type: 'decision', data: { type: 'decision', label: 'Should we hire a tech lead?' } }) as any)} />,
    )
    expect(container.textContent).toContain('Should we hire a tech lead?')
    const found = centredCopy(container)
    expect(found, `DecisionNode centres copy:\n${report(found)}`).toEqual([])
  })

  it('BaseNode — the shared card chrome every node type inherits', () => {
    const container = mount(
      <BaseNode
        {...baseNodeProps}
        nodeType="factor"
        icon={Target}
        data={{ type: 'factor', label: 'Developer headcount', description: 'How many engineers are funded.' }}
      >
        <div>Body copy that must read left to right</div>
      </BaseNode>,
    )
    expect(container.textContent).toContain('Developer headcount')
    // The `#2` rank badge is mounted by the mocked metadata above, so the
    // declared-glyph exemption is EXERCISED here rather than assumed.
    expect(container.textContent).toContain('#2')
    const found = centredCopy(container)
    expect(found, `BaseNode centres copy:\n${report(found)}`).toEqual([])
  })
})

describe('the card DECLARES its alignment rather than inheriting it', () => {
  /**
   * ⭐ THE STRUCTURAL HALF, and it is worth more than the two deletions.
   *
   * `BaseNode`'s root carried NO `text-align` at all, so today's left alignment
   * is INHERITED from whatever mounts the canvas. Any ancestor or third-party
   * stylesheet that centres text would centre every node title, and nothing in
   * the node components would resist it — `node_modules` is not swept by any
   * grep we run, so `@xyflow/react`'s own stylesheet is an unaudited route in.
   *
   * Deleting two classes cannot enforce Paul's rule. A declaration can.
   */
  it('BaseNode declares text-left on its root, so no ancestor can centre a node', () => {
    const container = mount(
      <BaseNode {...baseNodeProps} nodeType="factor" icon={Target} data={{ type: 'factor', label: 'Developer headcount' }}>
        <div>Body</div>
      </BaseNode>,
    )
    const root = container.firstElementChild as HTMLElement
    expect(root.getAttribute('role')).toBe('group')
    expect(root.className).toContain('text-left')
  })
})
