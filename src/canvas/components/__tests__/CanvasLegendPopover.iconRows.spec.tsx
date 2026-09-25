/**
 * THE KEY NAMES THE CARD'S ICONS — design-gap audit row 28 (24 Sep 2026).
 *
 * Contract v3 §03, the "Icons make the next reasoning move accessible" box:
 * five icon rows — Worth reviewing, Evidence worth seeking, Behavioural check,
 * Source exception, Explore with Olumi — beside the edge rows and the shape
 * key, opened from the footer's "Visual key" link. Before this change the key
 * had the shapes and the edge rows and none of the five.
 *
 * ⭐ EVERY GLYPH IS BOUND BY IDENTITY TO THE CARD'S GLYPH, NOT TO A NAME TYPED
 * HERE. Each arm renders the REAL card component that draws the cue
 * (`NodeAttentionMarker`, `NodeSignalRailIcons`, `NodeCoachingIcon`,
 * `NodeProvenanceMark`) and the key side by side, and compares what they
 * actually paint: lucide's own identity token (`lucide-<name>`, a whole class
 * token, so `lucide-message-circle-question` can never satisfy
 * `lucide-message-circle`), the drawn paths (`innerHTML`), the stroke width and
 * the resting colour token. A key that drew a lookalike, or a card that changed
 * its glyph without the key, reds here.
 *
 * ⛔ OPPOSITE CONTROL: the shape rows and the edge rows are UNCHANGED — same
 * labels in the same order, the shape swatches still the card's own shapes —
 * and the icon rows sit after them rather than interleaved.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { CanvasLegendPopover } from '../CanvasLegendPopover'
import { NodeAttentionMarker } from '../../nodes/shared/NodeAttentionMarker'
import { NodeSignalRailIcons } from '../../nodes/shared/NodeRailIcons'
import { NodeCoachingIcon } from '../../nodes/shared/NodeCoachingIcon'
import { NodeProvenanceMark } from '../../nodes/shared/NodeProvenanceMark'
import { NodeShapeIndicator } from '../../nodes/NodeShapeIndicator'
import { classifyNodeProvenance } from '../../domain/valueProvenance'
import { DECISION_NODE_LABEL, CANVAS_STRENGTH_BANDS } from '../../domain/vocabulary'
import {
  LEGEND_SOLID_CAPTION,
  LEGEND_DASHED_CAPTION,
  LEGEND_ORANGE_CAPTION,
  LEGEND_OTHER_REVIEW_CAPTION,
} from '../../edges/connectorCopy'
import { useCanvasStore } from '../../store'
import { useGuidanceStore } from '../../stores/guidanceStore'
import type { AttentionReason } from '../../nodes/shared/nodeAttention'

// ── the contract's five rows, in the contract's order (§03 `ik`) ──────────────
const CONTRACT_ICON_ROWS = [
  ['attention', 'Worth reviewing'],
  ['evidence', 'Evidence worth seeking'],
  ['behaviour', 'Behavioural check'],
  ['source', 'Source exception'],
  ['coaching', 'Explore with Olumi'],
] as const
type CueId = (typeof CONTRACT_ICON_ROWS)[number][0]

const NODE = { id: 'node-a', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Hiring spend' } }
const EVIDENCE: AttentionReason = { kind: 'evidence_gap', order: 3, label: 'Evidence here would narrow the comparison.' }
const BEHAVIOUR: AttentionReason = { kind: 'behavioural', order: 4, label: 'Worth checking: anchoring.' }

/**
 * The three literals a card's `data.provenance` can carry — derived through the
 * card's own classifier, never a hand list of kinds — in the contract's glyph
 * order (spark, page, person).
 */
const SOURCE_LITERALS = ['ai_inferred', 'from_brief', 'user_set'] as const

// ── probes ───────────────────────────────────────────────────────────────────
const tokens = (el: Element | null | undefined): string[] =>
  (el?.getAttribute('class') ?? '').split(/\s+/).filter(Boolean)
/** lucide's identity token on a rendered glyph (`lucide-<name>`), as a whole class token. */
const lucideName = (svg: Element): string => {
  const t = tokens(svg).find((c) => c.startsWith('lucide-'))
  expect(t, 'a rendered glyph carries no lucide identity token').toBeDefined()
  return t as string
}
const RESTING_TONES = ['text-info', 'text-text-light', 'text-text-body'] as const
/** The resting colour token on the glyph or its nearest carrier (the card puts it on the button). */
const restingTone = (svg: Element): string | null => {
  let el: Element | null = svg
  for (let i = 0; el && i < 4; i += 1, el = el.parentElement) {
    const hit = tokens(el).find((t) => (RESTING_TONES as readonly string[]).includes(t))
    if (hit) return hit
  }
  return null
}
interface GlyphPrint {
  name: string
  paths: string
  stroke: string | null
  tone: string | null
}
const print = (svg: Element): GlyphPrint => ({
  name: lucideName(svg),
  paths: svg.innerHTML,
  stroke: svg.getAttribute('stroke-width'),
  tone: restingTone(svg),
})
const onlySvg = (el: Element): Element => {
  const svgs = el.querySelectorAll('svg')
  expect(svgs, 'expected exactly one glyph').toHaveLength(1)
  return svgs[0]
}

// ── the CARD's glyphs, rendered by the real components ──────────────────────
function cardPrints(id: CueId): GlyphPrint[] {
  cleanup()
  switch (id) {
    case 'attention': {
      render(<NodeAttentionMarker nodeId="n1" sentence="Worth reviewing: a top driver." />)
      return [print(onlySvg(screen.getByTestId('attention-marker-n1')))]
    }
    case 'evidence': {
      render(<NodeSignalRailIcons nodeId="f1" label="Trial conversion" reasons={[EVIDENCE]} />)
      return [print(onlySvg(screen.getByTestId('node-rail-evidence-f1')))]
    }
    case 'behaviour': {
      render(<NodeSignalRailIcons nodeId="f1" label="Trial conversion" reasons={[BEHAVIOUR]} />)
      return [print(onlySvg(screen.getByTestId('node-rail-behaviour-f1')))]
    }
    case 'coaching': {
      render(<NodeCoachingIcon nodeId="node-a" chips={[{ id: 'q', label: 'What would change this?', message: 'What would change this?', actionType: null }]} />)
      return [print(onlySvg(screen.getByTestId('node-coaching-icon-node-a')))]
    }
    case 'source': {
      return SOURCE_LITERALS.map((literal) => {
        cleanup()
        render(<NodeProvenanceMark nodeType="option" data={{ label: 'Rebuild', type: 'option', provenance: literal }} />)
        const marks = screen.getAllByTestId('node-provenance-mark')
        expect(marks, `the card draws no mark for ${literal}`).toHaveLength(1)
        expect(marks[0].getAttribute('data-provenance-kind')).toBe(classifyNodeProvenance(literal)!.kind)
        return print(onlySvg(marks[0]))
      })
    }
  }
}

// ── the KEY ──────────────────────────────────────────────────────────────────
function openKey(variant: 'icon' | 'text-link' = 'text-link'): HTMLElement {
  cleanup()
  render(<CanvasLegendPopover variant={variant} />)
  fireEvent.click(screen.getByTestId(variant === 'text-link' ? 'canvas-footer-visual-key' : 'btn-canvas-legend'))
  return screen.getByTestId('canvas-legend-popover')
}
const keyRow = (id: CueId): HTMLElement => screen.getByTestId(`legend-cue-${id}`)
function keyPrints(id: CueId): GlyphPrint[] {
  openKey()
  const glyphs = keyRow(id).querySelector(`[data-testid="legend-cue-glyphs-${id}"]`)
  expect(glyphs, `the ${id} row has no glyph column`).not.toBeNull()
  return Array.from(glyphs!.querySelectorAll('svg')).map(print)
}

function setBoard(status: 'idle' | 'complete'): void {
  useCanvasStore.setState({
    results: { status, progress: 0 },
    nodes: [NODE],
    edges: [],
    optionNumbering: {},
    viewMode: 'standard',
    lodRung: 'full',
  } as never)
}

beforeEach(() => {
  cleanup()
  setBoard('idle')
  useGuidanceStore.setState({
    _sendMessage: vi.fn(), _prefillChat: vi.fn(), _dispatchAction: vi.fn(), guidanceItems: [],
  } as never)
})
afterEach(() => {
  cleanup()
  setBoard('idle')
})

// ─────────────────────────────────────────────────────────────────────────────
describe('the five icon rows exist, opened from the footer (contract §03)', () => {
  it('the footer "Visual key" opens a key carrying all five rows, titled as the contract titles them, in its order', () => {
    const panel = openKey('text-link')
    const rows = Array.from(panel.querySelectorAll('[data-testid^="legend-cue-"][data-cue-id]'))
    expect(rows.map((r) => r.getAttribute('data-cue-id'))).toEqual(CONTRACT_ICON_ROWS.map(([id]) => id))
    for (const [id, title] of CONTRACT_ICON_ROWS) {
      const t = keyRow(id).querySelector('[data-testid="legend-cue-title"]')
      expect(t?.textContent, `row ${id}`).toBe(title)
    }
  })

  it('the toolbar key carries the same five rows (one component, two doors)', () => {
    openKey('icon')
    for (const [id] of CONTRACT_ICON_ROWS) expect(keyRow(id)).toBeInTheDocument()
  })

  it.each(['idle', 'complete'] as const)('all five rows show at %s — the key is a legend, not a findings list', (status) => {
    setBoard(status)
    openKey()
    for (const [id] of CONTRACT_ICON_ROWS) expect(keyRow(id)).toBeInTheDocument()
  })

  it('each row says, in one short plain sentence or two, what the cue means — no internal codes, no node/edge/graph', () => {
    openKey()
    for (const [id, title] of CONTRACT_ICON_ROWS) {
      const d = keyRow(id).querySelector('[data-testid="legend-cue-description"]')?.textContent ?? ''
      expect(d.length, `row ${id} has no description`).toBeGreaterThan(20)
      expect(d.length, `row ${id} description is not short`).toBeLessThanOrEqual(160)
      expect(d, `row ${id} repeats its title instead of explaining it`).not.toContain(title)
      // No wire codes (`evidence_gap`, `ai_inferred`, …) and no technical nouns.
      expect(d, `row ${id} leaks a code`).not.toMatch(/\b[a-z]+_[a-z_]+\b/)
      expect(d.toLowerCase(), `row ${id}`).not.toMatch(/\b(node|edge|graph|voi)\b/)
    }
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('each row draws the SAME glyph the card draws for that cue — bound by identity', () => {
  it.each(CONTRACT_ICON_ROWS.map(([id]) => id))('%s: lucide identity, paths, stroke and resting colour match the card', (id) => {
    const card = cardPrints(id)
    const key = keyPrints(id)
    // Positive control: the card side really drew something to compare against.
    expect(card.length).toBeGreaterThan(0)
    expect(key.map((g) => g.name), `${id}: the key draws a different glyph from the card`).toEqual(card.map((g) => g.name))
    expect(key.map((g) => g.paths), `${id}: same name, different drawing`).toEqual(card.map((g) => g.paths))
    expect(key.map((g) => g.stroke), `${id}: stroke differs from the card`).toEqual(card.map((g) => g.stroke))
    expect(key.map((g) => g.tone), `${id}: resting colour differs from the card`).toEqual(card.map((g) => g.tone))
  })

  it('CONTROL: the probe tells the five cues apart (no two rows share a glyph)', () => {
    const names = CONTRACT_ICON_ROWS.flatMap(([id]) => keyPrints(id).map((g) => g.name))
    expect(names).toHaveLength(7) // four single glyphs + the three source glyphs
    expect(new Set(names).size).toBe(names.length)
  })

  it('the source-exception row keys exactly the marks a card can draw — one per recognised provenance', () => {
    const kinds = new Set(SOURCE_LITERALS.map((l) => classifyNodeProvenance(l)!.kind))
    expect(kinds.size).toBe(SOURCE_LITERALS.length)
    expect(keyPrints('source')).toHaveLength(kinds.size)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
/**
 * The rows the key carried before this change, pinned by label and order. The
 * shape labels and connector captions come from their owners where one exists;
 * the three ribbon rows and the direction rows are literals in the component
 * (no exported owner), typed here as they stood at `52fef140`.
 */
const SHAPE_KINDS = ['decision', 'option', 'factor', 'outcome', 'risk', 'goal'] as const
const SHAPE_LABELS = [DECISION_NODE_LABEL, 'Option', 'Factor', 'Outcome', 'Risk', 'Goal', 'Outside your control']
const EDGE_GROUPS: string[][] = [
  [LEGEND_SOLID_CAPTION, LEGEND_DASHED_CAPTION],
  [...CANVAS_STRENGTH_BANDS.map((b) => `${b.label} effect`), 'No strength suggested: thin and grey'],
  [
    'Tight band (on hover or selection): this strength is fairly certain',
    'Wide band (on hover or selection): this strength is a rough guess',
    'No band (on hover or selection): nobody has said how certain this is',
  ],
  ['Raises', 'Lowers', 'Grey: direction not set yet'],
  [LEGEND_ORANGE_CAPTION, LEGEND_OTHER_REVIEW_CAPTION],
]

/** The swatch-and-label groups, in DOM order, as label lists. */
function labelGroups(panel: HTMLElement): { el: Element; labels: string[] }[] {
  const scroll = panel.querySelector('[data-testid="canvas-legend-scroll"]')!
  return Array.from(scroll.children)
    .filter((c) => tokens(c).includes('space-y-1.5') && !c.hasAttribute('data-cue-group'))
    .map((el) => ({
      el,
      labels: Array.from(el.children).map((row) => (row.children[1]?.textContent ?? row.textContent ?? '').trim()),
    }))
}

describe('⛔ OPPOSITE CONTROL — the shape rows and the edge rows are unchanged', () => {
  it('the shape key: same seven labels, in order, and its swatches are still the card shapes', () => {
    const panel = openKey()
    const [shapes] = labelGroups(panel)
    expect(shapes.labels).toEqual(SHAPE_LABELS)
    const swatches = Array.from(shapes.el.children).slice(0, SHAPE_KINDS.length).map((row) => row.children[0].innerHTML)
    const { container } = render(<>{SHAPE_KINDS.map((k) => <span key={k}><NodeShapeIndicator nodeKind={k} size={12} /></span>)}</>)
    expect(swatches).toEqual(Array.from(container.children).map((s) => s.innerHTML))
  })

  it('the edge rows: same groups, same labels, same order, directly after the shapes', () => {
    const panel = openKey()
    const groups = labelGroups(panel)
    expect(groups.slice(1, 1 + EDGE_GROUPS.length).map((g) => g.labels)).toEqual(EDGE_GROUPS)
  })

  it('the icon rows sit AFTER every edge row — added, not interleaved', () => {
    const panel = openKey()
    const groups = labelGroups(panel)
    const lastEdgeGroup = groups[EDGE_GROUPS.length].el
    const cueGroup = panel.querySelector('[data-cue-group]')
    expect(cueGroup, 'no icon-row group').not.toBeNull()
    expect(lastEdgeGroup.compareDocumentPosition(cueGroup!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    // …and no shape or edge group holds a cue row.
    for (const g of groups.slice(0, 1 + EDGE_GROUPS.length)) {
      expect(g.el.querySelector('[data-cue-id]')).toBeNull()
    }
  })
})
