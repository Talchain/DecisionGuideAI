/**
 * ONE ICON-BUTTON LANGUAGE ON THE CARD — contract v3.1 wave 3, group "rail"
 * (24 Sep 2026).
 *
 * Contract v3.1 `<style>`: `.icon-btn{color:#777B77}` (muted at rest),
 * `.icon-btn:hover{color:var(--info);background:var(--info-soft)}`,
 * `.icon-btn svg{width:15px;height:15px}` (one glyph size), `.icon-btn.revealed`
 * (an edit route is hidden until hover/focus), `.node .attention` (a
 * borderless, shadowless Info glyph), `.node .state-word` (an outlined word, no
 * wash). Paul 23 Sep: pt 4 (dash = existence doubt only), pt 6 (coaching muted
 * at rest; hidden at quiet/far zoom), pt 9 (attention = Info; no new colours),
 * pt 12 (hover AND focus labels).
 *
 * Every assertion binds by IDENTITY — a testid, the exported class constant, or
 * the exact class token — and each block was run RED against the base
 * (3eb22326 + the gap-icons slice) before the source change (see the PR notes).
 * Delta ids are cited per block.
 *
 * ⛔ UPDATED 25 Sep 2026 (gap 34, DESIGN-GAP-AUDIT-20260924.md row 34; Visual
 * Contract §02 `.icon-btn{width:25px;height:25px;color:#777B77}`,
 * `.icon-btn svg{width:15px;height:15px}`): the DESIGN changed the pinned
 * values, so these pins moved with it — box 20 → 25, glyph 14 → 15, resting
 * grey `text-text-light` (#6E6B6B) → the contract's #777B77
 * (`NODE_RAIL_REST_TONE_CLASS`, a brand.css token). Every assertion still binds
 * the same element by the same identity; only the value it expects moved.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent, cleanup, renderHook } from '@testing-library/react'
import { SearchCheck } from 'lucide-react'
import { NODE_RAIL_BUTTON_CLASSES, NODE_RAIL_GLYPH_CLASSES, NODE_RAIL_GLYPH_PX, NODE_RAIL_REST_TONE_CLASS } from '../nodeCardRailStyles'
import { CANVAS_GLYPH_SIZE_CLASSES } from '../canvasGlyphScale'
import { NodeRailIcon, NodeSignalRailIcons, NODE_RAIL_REVEAL_CLASSES } from '../NodeRailIcons'
import { NodeQuickActions } from '../NodeQuickActions'
import { NodeAttentionMarker } from '../NodeAttentionMarker'
import { NodeCoachingMarker } from '../NodeCoachingMarker'
import { NodeStructuralMarker } from '../NodeStructuralMarker'
import { StatusPill, STATE_WORD_CLASSES, STATE_WORD_STYLE } from '../StatusPill'
import { ScienceIcon } from '../ScienceIcon'
import { EvidenceGapBadge } from '../../EvidenceGapBadge'
import { SaveStatusPill } from '../../../components/SaveStatusPill'
import { useScienceIcons, SCIENCE_ICON_COLOUR } from '../../../hooks/useScienceIcons'
import { useCanvasStore } from '../../../store'
import { useGuidanceStore, guidanceCategoryIcon, type GuidanceItem } from '../../../stores/guidanceStore'
import { typography } from '../../../../styles/typography'
import type { AttentionReason } from '../nodeAttention'

const tokens = (el: Element | null | undefined): string[] =>
  (el?.getAttribute('class') ?? '').split(/\s+/).filter(Boolean)
const has = (el: Element | null | undefined, cls: string) => tokens(el).includes(cls)
/** The one lucide identity class on a rendered glyph (`lucide-<name>`). */
const lucideName = (svg: Element | null | undefined) => tokens(svg).find((t) => t.startsWith('lucide-')) ?? null

const EVIDENCE: AttentionReason = { kind: 'evidence_gap', order: 3, label: 'Evidence here would narrow the comparison.' }
const BEHAVIOUR: AttentionReason = { kind: 'behavioural', order: 4, label: 'Worth checking: anchoring.' }

const noop = () => {}
/** `ScienceIcon` types its glyph as `size?: number`; a thin wrapper, as `canvasGlyphTargetScale.spec` does. */
const StubIcon = ({ size, className }: { size?: number; className?: string }) => <SearchCheck size={size} className={className} />
const setRung = (lodRung: 'full' | 'quiet' | 'line') => useCanvasStore.setState({ lodRung } as never, false)

beforeEach(() => {
  cleanup()
  useGuidanceStore.getState().clearGuidanceItems()
  useGuidanceStore.setState({ _sendMessage: null, _prefillChat: null, _dispatchAction: null } as never)
  useCanvasStore.setState({ nodes: [], edges: [], lodRung: 'full' } as never, false)
})

// ─────────────────────────────────────────────────────────────────────────────
describe('ICON-01 / OPT-13 / F12 / FRAME-11 / OPT-11 — one hover language for every rail button', () => {
  it('the shared rail class: Info on an info-soft ground on hover AND focus, never the invisible panel-hover', () => {
    const c = NODE_RAIL_BUTTON_CLASSES.split(/\s+/)
    for (const t of ['hover:bg-info/10', 'hover:text-info', 'focus-visible:bg-info/10', 'focus-visible:text-info', 'focus-visible:ring-2', 'focus-visible:ring-info', 'focus-visible:ring-offset-1']) {
      expect(c, t).toContain(t)
    }
    expect(c).not.toContain('hover:bg-panel-hover')
  })

  it.each(['muted', 'behaviour', 'info'] as const)('a %s rail icon carries the shared hover (no tone is hover-inert)', (tone) => {
    render(<NodeRailIcon testId="rail-x" label="Do the thing" icon={SearchCheck} tone={tone} onActivate={noop} />)
    const b = screen.getByTestId('rail-x')
    expect(has(b, 'hover:text-info')).toBe(true)
    expect(has(b, 'hover:bg-info/10')).toBe(true)
  })

  it('the hover quick actions ARE rail buttons: shared class + muted, no private hover copy', () => {
    useGuidanceStore.setState({ _sendMessage: () => {} } as never)
    useCanvasStore.setState({ nodes: [{ id: 'node-a', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Hiring spend' } }] } as never, false)
    // Contrast control: the Ask button renders only when the coaching icon does
    // not; `lodRung: 'quiet'` withholds the icon so all three quick actions mount.
    setRung('quiet')
    render(<NodeQuickActions nodeId="node-a" nodeType="factor" label="Hiring spend" />)
    const ids = ['node-action-ask-node-a', 'node-action-challenge-node-a', 'node-action-menu-node-a']
    for (const id of ids) {
      const b = screen.getByTestId(id)
      expect(b.className, id).toBe(`${NODE_RAIL_BUTTON_CLASSES} ${NODE_RAIL_REST_TONE_CLASS}`)
      expect(has(b, 'hover:text-text-body'), id).toBe(false)
      expect(has(b, 'nopan'), id).toBe(true)
    }
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('ICON-02 / OPT-14 / F12 / FRAME-11 — one glyph size across the rail row', () => {
  it('the rail glyph is the contract 15px counter-scaled (was 14 before gap 34), not 12', () => {
    expect(NODE_RAIL_GLYPH_PX).toBe(15)
    expect(NODE_RAIL_GLYPH_CLASSES).toBe(CANVAS_GLYPH_SIZE_CLASSES[15])
  })

  it('quick-action glyphs and resting glyphs are the SAME size (no 11px member left)', () => {
    useGuidanceStore.setState({ _sendMessage: () => {} } as never)
    useCanvasStore.setState({ nodes: [{ id: 'node-a', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Hiring spend' } }] } as never, false)
    setRung('full')
    const { container } = render(
      <NodeQuickActions
        nodeId="node-a"
        nodeType="factor"
        label="Hiring spend"
        restingIcons={<NodeRailIcon testId="rail-ev" label="Evidence" icon={SearchCheck} tone="muted" onActivate={noop} />}
        coaching={null}
      />,
    )
    const svgs = [...container.querySelectorAll('button svg')]
    // Positive control: challenge + more + the resting icon + the coaching icon.
    expect(svgs.length).toBeGreaterThanOrEqual(4)
    for (const svg of svgs) {
      expect(svg.getAttribute('class'), lucideName(svg) ?? 'svg').toContain(CANVAS_GLYPH_SIZE_CLASSES[15])
      expect(svg.getAttribute('class')).not.toContain(CANVAS_GLYPH_SIZE_CLASSES[11])
      expect(svg.getAttribute('width')).toBe('15')
    }
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('OPT-02 / ICON-03 — an edit route is revealed on hover/focus, never resting', () => {
  it('reveal: hidden at rest by opacity, with the pointer-events mirror and the touch override', () => {
    render(<NodeRailIcon testId="rail-edit" label="Edit targets" icon={SearchCheck} tone="muted" onActivate={noop} reveal />)
    const b = screen.getByTestId('rail-edit')
    expect(b).toHaveAttribute('data-rail-reveal', 'true')
    for (const t of NODE_RAIL_REVEAL_CLASSES.split(/\s+/)) expect(has(b, t), t).toBe(true)
    for (const t of ['opacity-0', 'pointer-events-none', 'group-hover:opacity-100', 'group-hover:pointer-events-auto', 'group-focus-within:opacity-100', 'group-focus-within:pointer-events-auto', '[@media(pointer:coarse)]:opacity-100', '[@media(pointer:coarse)]:pointer-events-auto']) {
      expect(has(b, t), t).toBe(true)
    }
    // Still a named, focusable control (opacity, never display:none).
    expect(b).toHaveAccessibleName('Edit targets')
    expect(b.tagName).toBe('BUTTON')
  })

  it('CONTRAST: without `reveal` the icon rests visible (no opacity-0)', () => {
    render(<NodeRailIcon testId="rail-plain" label="Evidence" icon={SearchCheck} tone="muted" onActivate={noop} />)
    const b = screen.getByTestId('rail-plain')
    expect(has(b, 'opacity-0')).toBe(false)
    expect(b.hasAttribute('data-rail-reveal')).toBe(false)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('ICON-06 / F11 — the evidence rail icon is muted at rest; Info at rest is the attention cue alone', () => {
  it('evidence icon: the rail grey at rest (#777B77 since gap 34), Info only on hover/focus', () => {
    render(<NodeSignalRailIcons nodeId="f1" label="Trial conversion" reasons={[EVIDENCE]} />)
    const b = screen.getByTestId('node-rail-evidence-f1')
    expect(has(b, NODE_RAIL_REST_TONE_CLASS)).toBe(true)
    expect(has(b, 'text-info')).toBe(false)
    expect(has(b, 'hover:text-info')).toBe(true)
  })

  it('CONTRAST: the attention marker for the same element IS Info at rest', () => {
    render(<NodeAttentionMarker nodeId="f1" sentence="Worth reviewing: evidence here would narrow the comparison." />)
    expect(has(screen.getByTestId('attention-marker-f1'), 'text-info')).toBe(true)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('ICON-04 (fallback) — the rail data icons leave with the coaching icon at quiet/far zoom', () => {
  it('CONTRAST (full): evidence and behaviour icons render', () => {
    setRung('full')
    render(<NodeSignalRailIcons nodeId="f1" label="Trial conversion" reasons={[EVIDENCE, BEHAVIOUR]} />)
    expect(screen.getByTestId('node-rail-evidence-f1')).toBeInTheDocument()
    expect(screen.getByTestId('node-rail-behaviour-f1')).toBeInTheDocument()
  })

  it.each(['quiet', 'line'] as const)('at %s neither renders', (rung) => {
    setRung(rung)
    const { container } = render(<NodeSignalRailIcons nodeId="f1" label="Trial conversion" reasons={[EVIDENCE, BEHAVIOUR]} />)
    expect(screen.queryByTestId('node-rail-evidence-f1')).toBeNull()
    expect(screen.queryByTestId('node-rail-behaviour-f1')).toBeNull()
    expect(container.innerHTML).toBe('')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('PILL-03 / ICON-05 / F13 — the attention marker is the contract glyph, not a bordered donut', () => {
  it('borderless, shadowless, counter-scaled contract 25px box (20 before gap 34); a LocateFixed target glyph at the rail size', () => {
    render(<NodeAttentionMarker nodeId="n1" sentence="Worth reviewing: a top driver." />)
    const b = screen.getByTestId('attention-marker-n1')
    for (const t of tokens(b)) {
      expect(t, 'no border').not.toMatch(/^border/)
      expect(t, 'no shadow').not.toMatch(/^shadow/)
    }
    expect(has(b, 'rounded-full')).toBe(false)
    expect(b.getAttribute('class')).toContain(CANVAS_GLYPH_SIZE_CLASSES[25])
    // Contract `.node .attention{background:none}`: inside the card (gap 11) it
    // has no panel fill of its own.
    expect(tokens(b).some((t) => t.startsWith('bg-'))).toBe(false)
    expect(has(b, 'hover:bg-info/10')).toBe(true)
    expect(b.getAttribute('style') ?? '').not.toMatch(/18px/)
    const ring = screen.getByTestId('attention-marker-ring')
    expect(ring.tagName.toLowerCase()).toBe('svg')
    expect(lucideName(ring)).toBe('lucide-locate-fixed')
    expect(ring.getAttribute('class')).toContain(NODE_RAIL_GLYPH_CLASSES)
    expect(ring.getAttribute('stroke-width')).toBe('1.6')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
function producerItem(over: Partial<GuidanceItem> = {}): GuidanceItem {
  return {
    item_id: 'g1',
    category: 'must_fix',
    source: 'structural',
    title: 'Check the price',
    priority: 50,
    primary_action: { type: 'discuss', prompt: 'Let us discuss.' },
    target_object: { type: 'node', id: 'node-a' },
    ...over,
  } as GuidanceItem
}

describe('PILL-07 / PILL-08 (colour) / T14(b) / ICON-09 — the coaching marker speaks the corner language', () => {
  it('must_fix: no Danger paint, no border, no shadow, no scale bounce; muted at rest, Info on hover/focus', () => {
    useGuidanceStore.getState().setGuidanceItems([producerItem()])
    render(<NodeCoachingMarker nodeId="node-a" />)
    const m = screen.getByTestId('node-coaching-marker-node-a')
    expect(m).toHaveAttribute('data-guidance-category', 'must_fix')
    for (const t of tokens(m)) {
      expect(t).not.toMatch(/^border/)
      expect(t).not.toMatch(/^shadow/)
      expect(t).not.toMatch(/(^|:)scale-/)
      expect(t).not.toBe('transition-transform')
      expect(t).not.toMatch(/danger/)
    }
    expect(has(m, NODE_RAIL_REST_TONE_CLASS)).toBe(true)
    expect(has(m, 'hover:text-info')).toBe(true)
    expect(has(m, 'hover:bg-info/10')).toBe(true)
    expect(has(m, 'h-[calc(25px*var(--canvas-label-scale,1))]')).toBe(true)
    const svg = m.querySelector('svg')
    expect(tokens(svg).some((t) => /danger/.test(t))).toBe(false)
    expect(svg?.getAttribute('class')).toContain(NODE_RAIL_GLYPH_CLASSES)
  })

  it('the glyph SHAPE still names the category — identical to the inspector card glyph', () => {
    useGuidanceStore.getState().setGuidanceItems([producerItem()])
    render(<NodeCoachingMarker nodeId="node-a" />)
    const markerGlyph = lucideName(screen.getByTestId('node-coaching-marker-node-a').querySelector('svg'))
    const { Icon } = guidanceCategoryIcon('must_fix')
    const { container } = render(<Icon />)
    expect(markerGlyph).not.toBeNull()
    expect(markerGlyph).toBe(lucideName(container.querySelector('svg')))
  })

  it('a "+N" count is counter-scaled canvas type, and the label is the shared Tooltip (no native title)', () => {
    useGuidanceStore.getState().setGuidanceItems([
      producerItem({ item_id: 'a' }),
      producerItem({ item_id: 'b', category: 'could_fix' }),
    ])
    render(<NodeCoachingMarker nodeId="node-a" />)
    const m = screen.getByTestId('node-coaching-marker-node-a')
    const count = m.querySelector('span')!
    expect(count.textContent).toBe('2')
    expect(count.getAttribute('class')).toContain(typography.edgeLabel)
    expect(count.getAttribute('class')).not.toContain(typography.caption)
    expect(m.getAttribute('title') ?? '').toBe('')
    expect(m).toHaveAccessibleName(/^2 coaching suggestions for this node/)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('PILL-07 / ICON-09 — the structural marker drops the dash and gains a focus label', () => {
  const node = (id: string, kind: string, data: Record<string, unknown> = {}) =>
    ({ id, type: kind, position: { x: 0, y: 0 }, data: { kind, label: id, ...data } })
  beforeEach(() => {
    useCanvasStore.setState({
      nodes: [node('o1', 'option'), node('o2', 'option'), node('f1', 'factor', { category: 'external' }), node('f2', 'factor', { category: 'controllable' }), node('r1', 'risk')],
      edges: [{ id: 'e1', source: 'o1', target: 'f1', data: {} }, { id: 'e2', source: 'o2', target: 'f2', data: {} }],
    } as never, false)
  })

  it('no dashed or any border, no shadow; counter-scaled box; muted at rest', () => {
    render(<NodeStructuralMarker nodeId="r1" />)
    const m = screen.getByTestId('node-structural-marker-r1')
    for (const t of tokens(m)) {
      expect(t).not.toMatch(/^border/)
      expect(t).not.toMatch(/^shadow/)
    }
    expect(m.getAttribute('class')).toContain(CANVAS_GLYPH_SIZE_CLASSES[25])
    expect(has(m, NODE_RAIL_REST_TONE_CLASS)).toBe(true)
    expect(m.querySelector('svg')?.getAttribute('class')).toContain(NODE_RAIL_GLYPH_CLASSES)
  })

  it('keyboard-reachable graphic: tabIndex 0, still role=img (not a control), label via Tooltip not title', () => {
    render(<NodeStructuralMarker nodeId="r1" />)
    const m = screen.getByTestId('node-structural-marker-r1')
    expect(m).toHaveAttribute('tabindex', '0')
    expect(m).toHaveAttribute('role', 'img')
    expect(m.tagName).not.toBe('BUTTON')
    expect(m.getAttribute('title') ?? '').toBe('')
    expect(has(m, 'focus-visible:ring-2')).toBe(true)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('T04 / T06 / F14 / FRAME-07 / PILL-01 — StatusPill is the contract state word', () => {
  it('outlined on the panel, pill radius, 11px canvas type at normal weight; no amber wash', () => {
    render(<StatusPill label="Needs input" />)
    const p = screen.getByTestId('needs-input-pill')
    expect(p.className).toBe(STATE_WORD_CLASSES)
    for (const t of ['bg-panel', 'rounded-full', 'font-normal', 'text-text-body', 'border-warning-ink/35']) expect(has(p, t), t).toBe(true)
    for (const t of ['bg-warning/15', 'font-medium', 'rounded-[10px]', 'border-warning/40']) expect(has(p, t), t).toBe(false)
    expect(p.className).toContain(typography.edgeLabel)
    expect(p.style.padding).toBe('0.1em 0.6em')
    expect(p.style.borderWidth).toBe(STATE_WORD_STYLE.borderWidth)
    expect(p.style.borderWidth).not.toBe('0.5px')
  })

  it('the interactive variant keeps the anatomy; its hover is no longer an amber wash', () => {
    render(<StatusPill label="Needs input" title="Needs input — set a value" onActivate={noop} />)
    const b = screen.getByTestId('needs-input-pill')
    expect(b.tagName).toBe('BUTTON')
    expect(b.className.startsWith(STATE_WORD_CLASSES)).toBe(true)
    expect(has(b, 'hover:bg-warning/25')).toBe(false)
    expect(has(b, 'hover:bg-panel-hover')).toBe(true)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('PILL-06 — the evidence-gap "?" is a neutral outlined badge (no fill, no amber)', () => {
  it.each([
    ['none', 'border-field'],
    ['warning', 'border-warning-ink'],
    ['critical', 'border-warning-ink'],
  ] as const)('%s → %s on bg-panel', (escalation, border) => {
    setRung('full')
    render(<EvidenceGapBadge label="Trial conversion" escalation={escalation} />)
    const b = screen.getByTestId('evidence-gap-badge')
    expect(has(b, border)).toBe(true)
    expect(has(b, 'bg-panel')).toBe(true)
    for (const t of tokens(b)) {
      expect(t).not.toMatch(/^bg-warning/)
      expect(t).not.toMatch(/^border-warning(\/|$)/)
    }
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('ICON-08 / T14(a) — science/bias glyphs are neutral, and label on focus as well as hover', () => {
  it('every local-rule science icon is text-text-light (DS v5 §9.2), never amber', () => {
    useCanvasStore.setState({
      nodes: [{ id: 'f1', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Churn', category: 'controllable' } }],
      edges: [],
    } as never, false)
    const { result } = renderHook(() => useScienceIcons('f1', 'factor'))
    // Positive control: the unvalued factor raises the evidence-gap trigger.
    expect(result.current.map((i) => i.id)).toContain('evidence-gap')
    for (const icon of result.current) expect(icon.colour, icon.id).toBe('text-text-light')
    expect(SCIENCE_ICON_COLOUR).toBe('text-text-light')
  })

  it('keyboard focus opens the same glance label hover does; blur closes it', () => {
    render(<ScienceIcon icon={StubIcon} tooltip="No observed data for this factor." action="Help me estimate Churn" />)
    const b = screen.getByTestId('science-icon-trigger')
    expect(screen.queryByRole('tooltip')).toBeNull()
    fireEvent.focus(b)
    expect(screen.getByRole('tooltip')).toHaveTextContent('No observed data for this factor.')
    fireEvent.blur(b)
    expect(screen.queryByRole('tooltip')).toBeNull()
    for (const t of ['hover:text-info', 'focus-visible:text-info', 'hover:bg-info/10', 'focus-visible:ring-2']) expect(has(b, t), t).toBe(true)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('PILL-14 — SaveStatusPill is a DS v5 §8.5 outlined pill', () => {
  it('Saving…: text-body on the panel with a border; no legacy greys, no fill', () => {
    render(<SaveStatusPill isSaving lastSavedAt={null} />)
    const p = screen.getByTestId('save-status-saving')
    for (const t of ['text-text-body', 'bg-panel', 'border', 'border-panel-border']) expect(has(p, t), t).toBe(true)
    for (const t of tokens(p)) expect(t).not.toMatch(/gray/)
  })

  it('Saved: text-body text; the success hue only on the border and the glyph', () => {
    render(<SaveStatusPill isSaving={false} lastSavedAt={Date.now()} />)
    const p = screen.getByTestId('save-status-saved')
    expect(has(p, 'text-text-body')).toBe(true)
    expect(has(p, 'text-success-700')).toBe(false)
    expect(has(p, 'border-success/30')).toBe(true)
    expect(has(p.querySelector('svg'), 'text-success')).toBe(true)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('RHY-08 — node title line-height is the contract 1.25', () => {
  it('nodeTitle carries leading-tight, not leading-snug', () => {
    const t = typography.nodeTitle.split(/\s+/)
    expect(t).toContain('leading-tight')
    expect(t).not.toContain('leading-snug')
  })
})
