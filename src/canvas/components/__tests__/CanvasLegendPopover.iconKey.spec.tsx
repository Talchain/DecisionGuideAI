/**
 * THE VISUAL KEY NAMES THE CARD ICONS — contract v3.1 §03 "Icons make the next
 * reasoning move accessible" (DESIGN-GAP-AUDIT row 28, chrome cluster,
 * 25 Sep 2026).
 *
 * The contract's icon key lists five rows: Worth reviewing · Evidence worth
 * seeking · Behavioural check · Source exception · Explore with Olumi. The key
 * had the provenance glyphs (the "Source exception" marks) and none of the
 * other four, although every one of them ships on the canvas today:
 *   · Worth reviewing     — `NodeAttentionMarker` (BaseNode corner stack);
 *   · Worth checking — `NodeSignalRailIcons` evidence icon (rail);
 *   · Behavioural check   — `NodeSignalRailIcons` behaviour icon (rail);
 *   · (retired from the key, vision spec §3: the coaching icon is the card actions' "Ask Olumi" door, not a mark.)
 *
 * ⭐ BOUND TO THE CARD, NOT TO A LIST. Each pair below renders the REAL card
 * component and the key, and compares the glyph's lucide identity class and
 * its resting ink token. A key row that drew a different glyph, or the same
 * glyph in a different colour, is exactly the private code a key exists to
 * prevent — and a hand-listed expectation would agree with a wrong key.
 *
 * ⚠ PHASE: the evidence icon is RUN-DERIVED (`evidence_gap` is read from a
 * completed report only — `useNodeAttention`), so its row follows the same
 * post-run rule as the fragility row. The other three can carry a mark before
 * any run (CEE bias findings; the coaching door on every card).
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react'
import { CanvasLegendPopover } from '../CanvasLegendPopover'
import { NodeAttentionMarker } from '../../nodes/shared/NodeAttentionMarker'
import { NodeSignalRailIcons } from '../../nodes/shared/NodeRailIcons'
import { NodeBiasMarks } from '../../nodes/shared/NodeBiasMarks'
import { NodeCoachingMarker } from '../../nodes/shared/NodeCoachingMarker'
import type { AttentionReason } from '../../nodes/shared/nodeAttention'
import { useCanvasStore } from '../../store'
import { useGuidanceStore } from '../../stores/guidanceStore'
import { NODE_RAIL_BEHAVIOUR_TONE_CLASS, NODE_RAIL_REST_TONE_CLASS } from '../../nodes/shared/nodeCardRailStyles'

const tokens = (el: Element | null | undefined): string[] =>
  (el?.getAttribute('class') ?? '').split(/\s+/).filter(Boolean)
/**
 * The glyph's identity: its one lucide class (`lucide-<name>`), or, for the Olumi brand mark the coaching door
 * draws since Paul's 1 Oct 2026 ask (a full-colour <img>, not a Lucide svg), its `data-icon`.
 */
const lucideName = (svg: Element | null | undefined) =>
  tokens(svg).find((t) => t.startsWith('lucide-') && t !== 'lucide') ?? svg?.getAttribute('data-icon') ?? null
/**
 * The resting ink — the one `text-<colour>` token that is not a hover/focus variant.
 * The rail's own grey and violet (gap 34, `nodeCardRailStyles`) are inks too: without
 * them the evidence, behaviour and coaching pairs compared null with null.
 */
const INKS = ['text-info', 'text-text-light', 'text-text-body', NODE_RAIL_REST_TONE_CLASS, NODE_RAIL_BEHAVIOUR_TONE_CLASS] as const
const ink = (el: Element | null | undefined) => tokens(el).find((t) => (INKS as readonly string[]).includes(t)) ?? null

const NODE = 'n-card'
const EVIDENCE: AttentionReason = { kind: 'evidence_gap', order: 3, label: 'Evidence here would narrow the comparison.' }
const BEHAVIOUR: AttentionReason = { kind: 'behavioural', order: 4, label: 'Worth checking: anchoring.' }

function setPhase(status: 'idle' | 'complete'): void {
  useCanvasStore.setState({
    results: { status, progress: 0 },
    nodes: [{ id: NODE, type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Hiring spend' } }],
    lodRung: 'full',
  } as never)
}

function openKey(): HTMLElement {
  render(<CanvasLegendPopover />)
  fireEvent.click(screen.getByTestId('btn-canvas-legend'))
  return screen.getByTestId('canvas-legend-popover')
}

/** The card's glyph owner, rendered for real: the button (ink) and its svg (identity). */
function cardGlyph(testId: string): { button: HTMLElement; svg: SVGElement } {
  const button = screen.getByTestId(testId)
  const svg = button.querySelector('svg, img') as SVGElement | null
  expect(svg, `${testId} rendered no glyph`).not.toBeNull()
  return { button, svg: svg! }
}

function keyRow(key: HTMLElement, testId: string): { row: HTMLElement; svg: SVGElement } {
  const row = within(key).getByTestId(testId)
  const svg = row.querySelector('svg, img') as SVGElement | null
  expect(svg, `${testId} rendered no glyph`).not.toBeNull()
  return { row, svg: svg! }
}

beforeEach(() => {
  useGuidanceStore.getState().clearGuidanceItems()
  // A conversation surface that can receive the ask — the coaching icon's own gate.
  useGuidanceStore.setState({ _sendMessage: () => {}, _prefillChat: null, _dispatchAction: null } as never)
  setPhase('complete')
})

afterEach(() => {
  cleanup()
  useGuidanceStore.setState({ _sendMessage: null, _prefillChat: null, _dispatchAction: null } as never)
  useCanvasStore.setState({ results: { status: 'idle', progress: 0 }, nodes: [], lodRung: 'full' } as never)
})

describe('the icon rows, in the contract’s words', () => {
  it.each([
    ['template', 'From brief', 'lucide-file-text'],
    ['cee', "Olumi's estimate", 'lucide-sparkles'],
    ['user', 'Set by you', 'lucide-user-check'],
  ] as const)('keys the %s link-source glyph from the shared register', (source, words, glyph) => {
    const key = openKey()
    const row = keyRow(key, `legend-edge-source-${source}`)
    expect(row.row).toHaveTextContent(words)
    expect(row.svg).toHaveClass(glyph)
  })

  it.each([
    ['legend-icon-attention', 'Olumi has something here'],
    ['legend-icon-evidence', 'Worth checking'],
    // Paul (24 Oct): one row per bias glyph, naming every bias the registry draws with it, in the card hover's words.
    ['legend-icon-bias-anchoring', 'Worth checking: anchoring, authority bias, sunk cost'],
    ['legend-icon-bias-framing', 'Worth checking: narrow framing, confirmation bias, availability bias'],
    ['legend-icon-bias-confidence', 'Worth checking: overconfidence, optimism bias'],
    ['legend-icon-bias-blind_spots', 'Worth checking: blind spots, status quo bias'],
  ])('%s reads "%s"', (testId, words) => {
    const key = openKey()
    expect(within(key).getByTestId(testId).textContent).toBe(words)
  })

  it('the provenance marks are headed "Source exception" — their own rows unchanged', () => {
    const key = openKey()
    expect(within(key).getByTestId('legend-caption-source-exception').textContent).toBe('Source exception')
    // CONTRAST: the three provenance rows keep the structural wording they had.
    for (const words of ['Olumi suggested this', 'You added this']) {
      expect(within(key).getByText(words)).toBeDefined()
    }
  })

  it('the new rows keep the key’s vocabulary ban (no node / edge / graph)', () => {
    const key = openKey()
    const text = (key.textContent ?? '').toLowerCase()
    expect(text).toContain('olumi has something here') // positive control: the rows are in the text read
    expect(text).not.toMatch(/\bnode\b/)
    expect(text).not.toMatch(/\bedge\b/)
    expect(text).not.toMatch(/\bgraph\b/)
  })
})

describe('⭐ each row draws the glyph the card draws, in the card’s resting ink', () => {
  it('Olumi has something here ⇄ the ONE Olumi badge (vision spec §3): the "Worth reviewing" cue and the coaching badge draw the Olumi mark', () => {
    render(<NodeAttentionMarker nodeId={NODE} sentence="Worth reviewing: a top driver." />)
    const card = cardGlyph(`attention-marker-${NODE}`)
    const key = keyRow(openKey(), 'legend-icon-attention')
    expect(lucideName(card.svg)).toBe('olumi-brand-mark')
    expect(lucideName(key.svg)).toBe(lucideName(card.svg))
    expect(ink(card.button)).not.toBeNull()
    // The coaching badge (a producer item) draws the same mark: one slot, one glyph.
    useGuidanceStore.setState({ guidanceItems: [{ item_id: 'g1', source: 'cee', title: 'Is this plausible?', category: 'must_fix', primary_action: { type: 'discuss', prompt: 'Why?' }, target_object: { id: NODE, type: 'factor' } }] } as never)
    render(<NodeCoachingMarker nodeId={NODE} />)
    expect(lucideName(cardGlyph(`node-coaching-marker-${NODE}`).svg)).toBe('olumi-brand-mark')
    useGuidanceStore.setState({ guidanceItems: [] } as never)
  })

  it('Worth checking ⇄ the rail’s evidence icon', () => {
    render(<NodeSignalRailIcons nodeId={NODE} reasons={[EVIDENCE]} />)
    const card = cardGlyph(`node-rail-evidence-${NODE}`)
    const key = keyRow(openKey(), 'legend-icon-evidence')
    expect(lucideName(key.svg)).toBe(lucideName(card.svg))
    expect(ink(card.button)).not.toBeNull()
    expect(ink(key.svg)).toBe(ink(card.button))
  })

  it('a bias mark ⇄ its own key row: same glyph, same ink (Paul 24 Oct: the bias\'s own glyph in the card\'s row)', () => {
    render(<NodeBiasMarks nodeId={NODE} label="Hiring spend" reasons={[{ ...BEHAVIOUR, biasCode: 'anchoring' }]} />)
    const card = cardGlyph(`node-bias-${NODE}`)
    const key = keyRow(openKey(), 'legend-icon-bias-anchoring')
    expect(lucideName(key.svg)).toBe(lucideName(card.svg))
    expect(ink(card.button)).not.toBeNull()
    expect(ink(key.svg)).toBe(ink(card.button))
  })

  it('the resting coaching icon has no key row: it is the card actions\' "Ask Olumi" door now (vision spec §3)', () => {
    const key = openKey()
    expect(within(key).queryByTestId('legend-icon-coaching')).toBeNull()
    expect(key.textContent).not.toContain('Explore with Olumi')
    expect(within(key).getByTestId('legend-icon-attention')).toBeDefined() // positive control
  })

  it('CONTRAST: the six glyphs are six different marks, so a pair cannot pass by sharing one', () => {
    const key = openKey()
    const names = ['attention', 'evidence', 'bias-anchoring', 'bias-framing', 'bias-confidence', 'bias-blind_spots'].map((k) =>
      lucideName(keyRow(key, `legend-icon-${k}`).svg),
    )
    expect(new Set(names).size).toBe(6)
  })
})

describe('the evidence row follows its icon’s phase', () => {
  it('PRE-RUN: no evidence row (the icon is run-derived); the other three are present', () => {
    setPhase('idle')
    const key = openKey()
    expect(within(key).queryByTestId('legend-icon-evidence')).toBeNull()
    for (const k of ['attention', 'bias-anchoring', 'bias-framing', 'bias-confidence', 'bias-blind_spots']) {
      expect(within(key).getByTestId(`legend-icon-${k}`)).toBeDefined()
    }
  })

  it('POST-RUN: the evidence row is shown', () => {
    const key = openKey()
    expect(within(key).getByTestId('legend-icon-evidence')).toBeDefined()
  })
})
