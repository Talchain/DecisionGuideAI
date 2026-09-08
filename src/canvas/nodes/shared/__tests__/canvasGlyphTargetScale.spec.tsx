/**
 * ⭐⭐⭐ EVERY IN-NODE GLYPH AND TARGET, MEASURED IN THE px THE USER GETS.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ⚠⚠ WHAT THE GUARD THIS REPLACES ASSERTED, AND WHY IT COULD NOT SEE THE DEFECT
 * ─────────────────────────────────────────────────────────────────────────────
 * `NodeQuickActions.targetSize.spec.tsx` asserted `visual + 2 x expansion >= 24`
 * — a correct invariant, in **CSS pixels**, on DOM that lives inside React
 * Flow's viewport transform. Its own header named `zoom 0.5` in prose and then
 * asserted in unscaled units, so `h-5` + `before:-inset-[2px]` scored 24 while
 * the user was handed **12**. A sibling lane measured exactly that: the arithmetic
 * passed and the target was half the size it claimed.
 *
 * **A guard written in the producer's units cannot see a defect that lives in
 * the consumer's units.** So every assertion below is in RENDERED px, via
 * `renderedLabelPx` — the module that exists precisely because jsdom has no
 * layout and an honest legibility claim has to be arithmetic.
 *
 * And the zoom is DERIVED (`LABEL_LEGIBLE_ZOOM`), never spelled `0.5` here: a
 * post-draft auto-fit parks at that constant because `useFitViewOnLayoutVersion`
 * passes it as `minZoom`, and a hand-copied second `0.5` is the mirror this
 * estate keeps paying for (CLAUDE.md trap 12).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ⚠ THE OTHER HALF OF THE OLD GUARD'S BLINDNESS: IT WATCHED ONE COMPONENT
 * ─────────────────────────────────────────────────────────────────────────────
 * 80 of 117 icon buttons failed the minimum on the deployed build and all 80 sat
 * on nodes — yet only `NodeQuickActions` was pinned. The contrast control is
 * blunt: exactly two spec files in this repo contained `before:-inset-`, and both
 * were `NodeQuickActions.*`. So the fleet was unwatched by construction.
 *
 * This file therefore drives a REGISTRY of node-surface components and
 * enumerates their targets and glyphs FROM THE DOM, never from a list here — a
 * button added to any registered component is covered the day it is added.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ⭐ EVIDENCE CARRIED FORWARD FROM THE GUARD THIS REPLACES — DO NOT LOSE IT
 * ─────────────────────────────────────────────────────────────────────────────
 * `NodeQuickActions.targetSize.spec.tsx` is retired INTO this file, and its
 * header held a dated browser measurement that no later run can reproduce. Real
 * Chrome against staging `a2fd0656`, founder fixture, 1280x800, canvas at its
 * default `zoom 0.5`, hard-fail rAF/`innerWidth` control passed:
 *
 *     button                       css     rendered   gap to next   ::before
 *     node-action-ask-*           20x20      10x10          1px      (none)
 *     node-action-inspect-*       20x20      10x10          1px      (none)
 *     node-action-menu-*          20x20      10x10           —       -2px
 *
 * `document.elementFromPoint` two pixels right of **ask**'s edge returned
 * **inspect**. `handleAsk` AUTO-SENDS a turn to the AI while its neighbours only
 * open a panel or a menu: **a one-pixel slip on a ten-pixel target sent an
 * unintended message.** That is why SEPARATION is asserted here alongside size —
 * enlarging abutting targets makes each easier to hit and does nothing for
 * telling them APART. A dated capture is evidence, not a fixture to refresh
 * (CLAUDE.md trap 14b), so it is reproduced verbatim rather than restated.
 *
 * ⛔ WHAT THIS FILE DOES NOT COVER, stated rather than implied (CLAUDE.md trap
 * 20 — a row minted from an UNKNOWN must restate the UNKNOWN's exact scope):
 * the registry holds the five node-surface components in this change's scope.
 * `BaseNode`, `GoalNode`, `OptionNode`, `StyledEdge` and the per-kind node files
 * render their own controls and are NOT asserted here. This guard's claim is
 * "every target in the registered components", never "every target on the
 * canvas".
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { NodeQuickActions } from '../NodeQuickActions'
import { ScienceIcon } from '../ScienceIcon'
import { EdgePills } from '../EdgePills'
import { BriefIcon } from '../BriefIcon'
import { EvidenceGapBadge } from '../../EvidenceGapBadge'
import { useCanvasStore } from '../../../store'
import { useGuidanceStore } from '../../../stores/guidanceStore'
import { LABEL_LEGIBLE_ZOOM, MAX_LABEL_COUNTER_SCALE, renderedLabelPx } from '../../../utils/zoomLegibility'
import { NODE_LAYOUT_MIN_W } from '../../../utils/nodeLayoutConstants'
import { PROVENANCE_ICON_SIZE_CLASSES } from '../../../domain/valueProvenanceIcon'
import {
  CANVAS_GLYPH_SIZE_CLASSES,
  CANVAS_HIT_SLOP_CLASSES,
  CANVAS_GAP_CLASSES,
  MIN_TARGET_RENDERED_PX,
} from '../canvasGlyphScale'
import { Sparkles } from 'lucide-react'

/**
 * ⚠ A THIN WRAPPER, NOT `Sparkles` ITSELF. `ScienceIcon`'s prop is
 * `ComponentType<{ size?: number; className?: string }>` and a `LucideIcon` is
 * a `ForwardRefExoticComponent` carrying ref attributes, so passing it directly
 * is a TS2322. The wrapper forwards BOTH props, which is the part that matters
 * here: the counter-scale reaches the glyph through `className`, so a fixture
 * that dropped it would make the glyph assertion vacuous.
 */
const StubIcon = (props: { size?: number; className?: string }) => <Sparkles {...props} />

/** The zoom a post-draft auto-fit actually parks at. Derived, never spelled. */
const ZOOM = LABEL_LEGIBLE_ZOOM

/**
 * ⭐⭐ THE ONE TARGET THIS CHANGE COULD NOT TAKE TO 24px, RECORDED RATHER THAN
 * ROUNDED UP — and asserted EXACTLY, so the suite stays green for the right
 * reason and REDs if the set GROWS or SHRINKS (CLAUDE.md trap 22f).
 *
 * `ScienceIcon` renders into `<span className="inline-flex items-center gap-1">`
 * in FactorNode, RiskNode, GoalNode, OptionNode and OutcomeNode — a **4px** gap,
 * in five files this change does not own. The separation invariant is
 * `gap > 2 x slop`, so 4px admits at most a 1px expansion: a 14px target, not
 * 24. A 6px expansion per side would overlap its neighbour by 8px, and because
 * each ScienceIcon opens a DIFFERENT bias popover, a near miss would open the
 * wrong one — buying WCAG size with the exact mis-target defect the separation
 * rule exists to prevent.
 *
 * What this change DID deliver for it: the glyph goes from a measured 9.3px
 * (6px at the settle zoom) to a true 12px. The size half is fixed; the target
 * half needs the container gap widened to > 13px, which is a five-file change
 * in node components owned elsewhere.
 */
const KNOWN_SHORT_TARGETS = new Set<string>(['science-icon-trigger'])

type Sized = { px: number; scaled: boolean }

/**
 * ⚠ `getAttribute('class')`, NEVER `.className`. On an SVG element `className`
 * is an `SVGAnimatedString`, not a string — `.includes` on it throws and a
 * regex against it silently matches nothing, which would read as "no size
 * class" for every icon in the suite. Half the elements measured here are SVGs.
 */
const cls = (el: Element): string => el.getAttribute('class') ?? ''

/** px + whether the value carries the canvas counter-scale, from one axis. */
function sizeFromClass(c: string, axis: 'h' | 'w'): Sized | null {
  const scaled = new RegExp(`(?:^|\\s)${axis}-\\[calc\\((\\d+(?:\\.\\d+)?)px\\*var\\(--canvas-label-scale`).exec(c)
  if (scaled) return { px: parseFloat(scaled[1]), scaled: true }
  const arbitrary = new RegExp(`(?:^|\\s)${axis}-\\[(\\d+(?:\\.\\d+)?)px\\]`).exec(c)
  if (arbitrary) return { px: parseFloat(arbitrary[1]), scaled: false }
  // Tailwind spacing token (0.25rem = 4px steps).
  const token = new RegExp(`(?:^|\\s)${axis}-(\\d+(?:\\.\\d+)?)(?:\\s|$)`).exec(c)
  if (token) return { px: parseFloat(token[1]) * 4, scaled: false }
  return null
}

/** Hit expansion per side. Absent slop is `0px`, for which scaling is a no-op. */
function slopFromClass(c: string): Sized {
  const scaled = /before:-inset-\[calc\((\d+(?:\.\d+)?)px\*var\(--canvas-label-scale/.exec(c)
  if (scaled) return { px: parseFloat(scaled[1]), scaled: true }
  const fixed = /before:-inset-\[(\d+(?:\.\d+)?)px\]/.exec(c)
  if (fixed) return { px: parseFloat(fixed[1]), scaled: false }
  return { px: 0, scaled: true }
}

function gapFromClass(c: string): Sized | null {
  const scaled = /(?:^|\s)gap-\[calc\((\d+(?:\.\d+)?)px\*var\(--canvas-label-scale/.exec(c)
  if (scaled) return { px: parseFloat(scaled[1]), scaled: true }
  const token = /(?:^|\s)gap-(\d+(?:\.\d+)?)(?:\s|$)/.exec(c)
  if (token) return { px: parseFloat(token[1]) * 4, scaled: false }
  return null
}

/**
 * ⭐ THE WHOLE POINT OF THIS FILE, IN ONE FUNCTION.
 *
 * A counter-scaled value renders at its declared size (`declared x scale x zoom`
 * with `scale = 1/zoom`); an un-counter-scaled one is simply multiplied by the
 * zoom and reaches the user HALVED at the settle zoom. The old guard computed
 * neither — it read the declared number and stopped.
 */
const effectivePx = (s: Sized): number => (s.scaled ? renderedLabelPx(s.px, ZOOM) : s.px * ZOOM)

/**
 * Every ICON-ONLY element a user can hit or focus: real buttons and tabbable
 * graphics that carry no visible text.
 *
 * ⚠ THE TEXT EXCLUSION IS A SCOPE DECISION, NOT A CONVENIENCE. A labelled
 * control ("Discuss with AI") takes its target size from its TEXT box, which
 * jsdom cannot measure and which the transform defect never touched — asserting
 * an `h-` class on it would force a size onto a control that correctly has
 * none, and the guard would be measuring something other than the defect. The
 * 80 failing targets on the deployed board were all icon-only.
 */
const targetsIn = (root: ParentNode): HTMLElement[] =>
  [...root.querySelectorAll<HTMLElement>('button, [tabindex="0"]')].filter(
    el => (el.textContent ?? '').trim() === '',
  )
/** Every icon drawn inside the surface, whether or not it is a control. */
const glyphsIn = (root: ParentNode): SVGElement[] => [...root.querySelectorAll<SVGElement>('svg')]

const idOf = (el: Element): string =>
  el.getAttribute('data-testid') ?? el.getAttribute('aria-label') ?? el.tagName.toLowerCase()

const NODE = { id: 'node-a', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Hiring spend' } }

/**
 * The registry. Each entry mounts a real component and PINS ITS OWN
 * PRECONDITION: how many targets and glyphs the fixture must produce. Without
 * that, a fixture whose gating store went unseeded renders nothing, every
 * `for` loop below iterates zero times, and the file passes by measuring
 * nothing — trap 13's classic vacuity, and the reason the guard this replaces
 * asserted a button count before looping.
 */
const SURFACES: {
  name: string
  mount: () => void
  minTargets: number
  minGlyphs: number
  /** Bound by IDENTITY, never by a count a sibling could satisfy. */
  identities: string[]
}[] = [
  {
    name: 'NodeQuickActions',
    mount: () => {
      render(<NodeQuickActions nodeId="node-a" nodeType="factor" label="Hiring spend" />)
    },
    minTargets: 4,
    minGlyphs: 4,
    identities: [
      'node-action-ask-node-a',
      'node-action-challenge-node-a',
      'node-action-inspect-node-a',
      'node-action-menu-node-a',
    ],
  },
  {
    name: 'ScienceIcon (popover open — covers the discuss glyph too)',
    mount: () => {
      render(<ScienceIcon icon={StubIcon} tooltip="Anchoring risk" action="Discuss anchoring" />)
      // The discuss button and its glyph exist only in the open branch. A
      // fixture that never opens the popover cannot observe them, and an
      // unobserved branch is an unguarded one.
      fireEvent.click(screen.getByRole('button', { name: 'Anchoring risk' }))
    },
    // ONE icon-only target: the trigger. The discuss button carries text, so
    // `targetsIn` excludes it by design — but it is still asserted PRESENT by
    // identity below, which is what proves the popover actually opened and the
    // glyph assertions are not measuring a closed component.
    minTargets: 1,
    minGlyphs: 2,
    identities: ['science-icon-trigger', 'science-icon-discuss'],
  },
  {
    name: 'EdgePills',
    mount: () => {
      render(<EdgePills nodeId="f1" />)
    },
    minTargets: 0,
    minGlyphs: 2,
    identities: [],
  },
  {
    name: 'BriefIcon',
    mount: () => {
      render(<BriefIcon />)
    },
    minTargets: 0,
    minGlyphs: 1,
    identities: [],
  },
  {
    name: 'EvidenceGapBadge',
    mount: () => {
      render(<EvidenceGapBadge label="Churn rate" escalation="critical" />)
    },
    minTargets: 1,
    minGlyphs: 0,
    identities: ['evidence-gap-badge-hover'],
  },
]

beforeEach(() => {
  useCanvasStore.setState({
    nodes: [
      NODE,
      { id: 'f1', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Price' } },
      { id: 'o1', type: 'outcome', position: { x: 0, y: 0 }, data: { label: 'Revenue' } },
    ],
    edges: [
      {
        id: 'e1',
        source: 'f1',
        target: 'o1',
        data: { weight: 0.9, direction: 'positive', weightSource: 'cee' },
      },
    ],
  } as never)
  // Seeds BOTH gates: `canAsk` (`_sendMessage`) and `canChallenge`
  // (`canReceiveAsk`). Unseeded, NodeQuickActions renders 2 of its 4 buttons and
  // ScienceIcon renders no discuss button at all.
  useGuidanceStore.setState({ _sendMessage: vi.fn(), _prefillChat: vi.fn(), _dispatchAction: vi.fn() } as never)
})

describe('canvas glyphs and targets survive the viewport transform', () => {
  it('CONTROL: the measurement discriminates counter-scaled from bare', () => {
    // Trap 13e: an absence/threshold probe needs a control that PASSES and one
    // that FAILS, or it may simply be blind. A bare 20px box and a
    // counter-scaled 20px box must NOT measure the same, or every assertion
    // below is agreeing with itself.
    expect(effectivePx({ px: 20, scaled: false })).toBe(10)
    expect(effectivePx({ px: 20, scaled: true })).toBe(20)
    expect(effectivePx({ px: 24, scaled: true })).toBeGreaterThanOrEqual(MIN_TARGET_RENDERED_PX)
    expect(effectivePx({ px: 24, scaled: false })).toBeLessThan(MIN_TARGET_RENDERED_PX)

    // …and the parsers must read both spellings, or "scaled" would be a
    // constant and the discrimination above would never be exercised.
    expect(sizeFromClass('h-5 w-5', 'h')).toEqual({ px: 20, scaled: false })
    expect(sizeFromClass(CANVAS_GLYPH_SIZE_CLASSES[20], 'h')).toEqual({ px: 20, scaled: true })
    expect(slopFromClass('before:-inset-[2px]')).toEqual({ px: 2, scaled: false })
    expect(slopFromClass(CANVAS_HIT_SLOP_CLASSES[2])).toEqual({ px: 2, scaled: true })
    expect(gapFromClass('gap-1.5')).toEqual({ px: 6, scaled: false })
    expect(gapFromClass(CANVAS_GAP_CLASSES[6])).toEqual({ px: 6, scaled: true })
  })

  it('the size map spells exactly the px each key claims', () => {
    // The map is a mirror; this is the derivation that stops it drifting. A
    // typo'd entry (`12: '…14px…'`) REDs here rather than shipping a glyph that
    // is the wrong size everywhere it is used (CLAUDE.md trap 12d).
    for (const [key, value] of Object.entries(CANVAS_GLYPH_SIZE_CLASSES)) {
      expect(value, `size map key ${key} does not spell ${key}px`).toBe(
        `w-[calc(${key}px*var(--canvas-label-scale,1))] h-[calc(${key}px*var(--canvas-label-scale,1))]`,
      )
    }
  })

  it('does NOT become a second authority on the counter-scale', () => {
    // `NodeProvenanceMark` solved this once, for 14px, in `domain/`. Pinning the
    // two EQUAL is what keeps one idea from acquiring two spellings free to
    // drift (CLAUDE.md trap 12/21) — the defect that gave this estate two
    // `generateGraphHash` twins.
    expect(CANVAS_GLYPH_SIZE_CLASSES[14]).toBe(PROVENANCE_ICON_SIZE_CLASSES)
  })

  for (const surface of SURFACES) {
    describe(surface.name, () => {
      it('renders the fixture it claims to measure', () => {
        surface.mount()
        const targets = targetsIn(document.body)
        const glyphs = glyphsIn(document.body)
        expect(targets.length, `${surface.name}: fixture produced no targets`).toBeGreaterThanOrEqual(
          surface.minTargets,
        )
        expect(glyphs.length, `${surface.name}: fixture produced no glyphs`).toBeGreaterThanOrEqual(
          surface.minGlyphs,
        )
        // Identity, not count: a sibling button could satisfy a count.
        for (const id of surface.identities) {
          expect(screen.queryByTestId(id), `${surface.name}: ${id} did not render`).not.toBeNull()
        }
      })

      it(`gives every target >= ${MIN_TARGET_RENDERED_PX}px AS RENDERED, not as declared`, () => {
        surface.mount()
        const targets = targetsIn(document.body)
        expect(targets.length).toBeGreaterThanOrEqual(surface.minTargets)
        for (const t of targets) {
          if (KNOWN_SHORT_TARGETS.has(idOf(t))) continue
          const c = cls(t)
          const box = sizeFromClass(c, 'h')
          expect(box, `${idOf(t)}: no height class to size from`).not.toBeNull()
          const slop = slopFromClass(c)
          if (slop.px > 0) {
            expect(c, `${idOf(t)}: a ::before slop needs 'relative' to anchor`).toContain('relative')
          }
          const rendered = effectivePx(box!) + 2 * effectivePx(slop)
          expect(
            rendered,
            `${idOf(t)}: declared ${box!.px}px${slop.px ? ` + 2x${slop.px}px slop` : ''} reaches the user as ` +
              `${rendered}px at zoom ${ZOOM} — WCAG 2.2 AA 2.5.8 asks ${MIN_TARGET_RENDERED_PX}px. ` +
              `Counter-scale the box AND the slop (canvasGlyphScale.ts).`,
          ).toBeGreaterThanOrEqual(MIN_TARGET_RENDERED_PX)
        }
      })

      it('draws every glyph at its declared size, not half of it', () => {
        surface.mount()
        const glyphs = glyphsIn(document.body)
        expect(glyphs.length).toBeGreaterThanOrEqual(surface.minGlyphs)
        for (const g of glyphs) {
          const c = cls(g)
          const size = sizeFromClass(c, 'w')
          expect(
            size,
            `${idOf(g)}: no counter-scaled width class — a lucide 'size' prop alone is ` +
              `multiplied by the zoom and reaches the user halved`,
          ).not.toBeNull()
          expect(
            effectivePx(size!),
            `${idOf(g)}: declared ${size!.px}px reaches the user as ${effectivePx(size!)}px at zoom ${ZOOM}`,
          ).toBe(size!.px)
        }
      })

      it('keeps adjacent hit areas apart IN RENDERED px', () => {
        surface.mount()
        // Only surfaces that lay targets out in a gapped row have this to prove;
        // the assertion is skipped honestly rather than faked for the others.
        const rows = [...document.querySelectorAll<HTMLElement>('*')].filter(
          el => gapFromClass(cls(el)) !== null && el.querySelectorAll('button').length > 1,
        )
        for (const row of rows) {
          const gap = gapFromClass(cls(row))!
          const worst = Math.max(
            ...[...row.querySelectorAll('button')].map(b => effectivePx(slopFromClass(cls(b)))),
          )
          expect(
            effectivePx(gap),
            `row gap renders as ${effectivePx(gap)}px but two expansions consume ` +
              `${2 * worst}px — the hit areas overlap and a near miss fires the neighbour`,
          ).toBeGreaterThan(2 * worst)
        }
      })
    })
  }

  /**
   * ⚠ THE SURFACE LOOP ABOVE CANNOT SEE THIS ONE, AND SAYING SO IS THE POINT.
   * `EvidenceGapBadge` draws no `<svg>` at all — its mark is a `<div>` circle
   * holding a text "?" — so `glyphsIn` returns EMPTY for it and the generic
   * glyph assertion passes by iterating nothing. That is trap 13 vacuity: the
   * WORST-measured element on the deployed board (5.5px rendered, from a 7px
   * design) sat in the one shape the enumeration could not observe.
   *
   * Bound by IDENTITY to the two elements that carry the badge's size.
   */
  describe('EvidenceGapBadge — the div+text mark the svg sweep cannot see', () => {
    it('counter-scales the circle and the "?" it holds', () => {
      render(<EvidenceGapBadge label="Churn rate" escalation="critical" />)
      const circle = screen.getByTestId('evidence-gap-badge')
      const box = sizeFromClass(cls(circle), 'h')
      expect(box, 'evidence-gap-badge: no height class to size from').not.toBeNull()
      expect(
        effectivePx(box!),
        `evidence-gap-badge: declared ${box!.px}px reaches the user as ${effectivePx(box!)}px at zoom ${ZOOM}`,
      ).toBe(box!.px)

      // The "?" is TEXT, so its size rides the canvas type scale rather than a
      // w-/h- class. `text-[length:calc(Npx*var(--canvas-label-scale,1))]` is
      // the spelling `typography.ts` uses for all three canvas tokens.
      const glyph = circle.querySelector('span')
      expect(glyph, 'evidence-gap-badge: no "?" span').not.toBeNull()
      const font = /text-\[length:calc\((\d+(?:\.\d+)?)px\*var\(--canvas-label-scale/.exec(
        cls(glyph!),
      )
      expect(
        font,
        `evidence-gap-badge "?": font size does not carry the counter-scale — class was "${cls(glyph!)}"`,
      ).not.toBeNull()
      // DS v5 §2.4 floors canvas type at 10px; the 7px this shipped with was
      // below the floor BEFORE the transform halved it to 3.5px.
      expect(
        parseFloat(font![1]),
        'evidence-gap-badge "?": below the DS v5 §2.4 10px canvas floor',
      ).toBeGreaterThanOrEqual(10)
    })
  })

  /**
   * ⭐ THE PIN ITSELF, ASSERTED IN BOTH DIRECTIONS.
   *
   * The per-surface test above SKIPS the known-short set, which on its own would
   * let the set quietly absorb a new failure. This recomputes the short targets
   * across every registered surface and asserts the set EXACTLY: a newly-short
   * target REDs here, and so does fixing `science-icon-trigger` without deleting
   * its pin. A gap recorded in the suite is honest; a gap invisible to it is how
   * this defect reached 80 buttons.
   */
  it('the known-shortfall set is EXACTLY what is still short', () => {
    const short: string[] = []
    for (const surface of SURFACES) {
      document.body.innerHTML = ''
      surface.mount()
      for (const t of targetsIn(document.body)) {
        const box = sizeFromClass(cls(t), 'h')
        const rendered = box === null ? 0 : effectivePx(box) + 2 * effectivePx(slopFromClass(cls(t)))
        if (rendered < MIN_TARGET_RENDERED_PX) short.push(idOf(t))
      }
    }
    expect([...new Set(short)].sort()).toEqual([...KNOWN_SHORT_TARGETS].sort())
  })

  /**
   * Migrated from the retired `NodeQuickActions.targetSize.spec.tsx`, which
   * bound this pair BY IDENTITY on the grounds that their consequences differ:
   * `ask` auto-sends a turn to the AI, `inspect` only opens a panel. A value
   * predicate a sibling could satisfy would not have caught the 1px separation
   * the deployed capture in this file's header measured.
   */
  it('keeps ask and inspect distinguishable — the pair whose consequences differ', () => {
    render(<NodeQuickActions nodeId="node-a" nodeType="factor" label="Hiring spend" />)
    const ask = screen.getByTestId('node-action-ask-node-a')
    const inspect = screen.getByTestId('node-action-inspect-node-a')
    for (const [name, el] of [['ask', ask], ['inspect', inspect]] as const) {
      const slop = slopFromClass(cls(el))
      expect(slop.px, `${name} has no hit expansion`).toBeGreaterThan(0)
      expect(slop.scaled, `${name}'s hit expansion is not counter-scaled`).toBe(true)
    }
  })

  /**
   * ⭐⭐⭐ THE ROW'S FOOTPRINT AGAINST THE CARD IT SITS ON — the bound the
   * 7 Sep review asked for, and the reason it is here rather than in the
   * browser gate that found it.
   *
   * ─── WHAT WAS MEASURED, AND BY WHOM ─────────────────────────────────────
   *
   * Counter-scaling this row's boxes and gap (this PR) doubled its footprint.
   * The `Canvas Browser Gate` felt it immediately: the Shift-drag arm probed one
   * pixel at `(centre-x, bottom - 6)`, that pixel is inside this row by
   * construction (`bottom-1.5 right-1.5`), and once the row crossed centre-x
   * **every one of 13 on-screen nodes was skipped**. The independent reviewer
   * re-derived the geometry from source and it checks out exactly:
   *
   *     row, before   4 x 20px + 3 x 6px               =  98 CSS px
   *     row, after    4 x 40px + 3 x 12px              = 196 CSS px
   *     occupied      6 (inset) + 196 + 4 (slop)       = 206 CSS px
   *     narrowest card  93 x 2 + 20 + 24 = NODE_LAYOUT_MIN_W = 230 CSS px
   *
   * So on the narrowest card the row went from **43% to 90% of the card's
   * width**. It does not overflow — that was checked — but it is a measured 2x
   * growth in the footprint of the primary in-node control row, on a layer that
   * hit-tests while it is invisible.
   *
   * ⛔ AND IT WAS BOUND BY NOTHING. The e2e comment states the mechanism and the
   * numbers in prose and asserts none of them; `blockedBy` is built for a
   * failure message and never asserted on. This file's own rule
   * (`KNOWN_SHORT_TARGETS`) is that *a gap recorded in the suite is honest; a
   * gap invisible to it is how this defect reached 80 buttons.* That rule,
   * applied to this PR itself, is this test.
   *
   * ─── WHY THE BOUND LIVES HERE AND NOT IN THE BROWSER GATE ───────────────
   *
   * The review said "bind it in the gate that found it". It is bound here
   * instead, deliberately and for two reasons that make it STRONGER, not weaker:
   *
   *   1. `Canvas Browser Gate` is ADVISORY. `Staging Gate` is the only required
   *      check, and this file runs in it. A bound in an advisory job does not
   *      stop the next widening.
   *   2. The gate's one-pixel probe was never a bound on purpose — it was a
   *      PRECONDITION that happened to fail when the row got wide. PR #1301
   *      widens that probe to 20 candidate points per card and says so plainly:
   *      *"A wider control row now costs the gate nothing."* That is correct for
   *      what that arm tests (the pane's marquee behaviour) and it retires the
   *      accident. This test is the deliberate replacement, and it is immune to
   *      that change because it does not go through the probe at all.
   *
   * ─── WHAT IS PINNED, AND IN WHICH DIRECTION ─────────────────────────────
   *
   * The occupied width is DERIVED FROM THE RENDERED ROW — button count from the
   * DOM, box/gap/slop/inset from the class strings the component actually
   * carries — and pinned EXACTLY, in both directions, against a card floor
   * imported from `nodeLayoutConstants`. Nothing here is a second copy of a
   * number: a change to the box size, the gap, the inset, the counter-scale, the
   * card floor, or the NUMBER OF BUTTONS moves the computed value and REDs.
   *
   * ⚠ THE FOUR-BUTTON ROW IS NOW REACHED BY EVERY NODE KIND, WHICH IT WAS NOT
   * WHEN THE 206px WAS MEASURED. `hasChallengePrompt` derived from
   * `FULL_MENU_KINDS.has(kind) || kind === 'goal'` — `factor | risk | outcome |
   * goal`. Staging #1292 re-derived it from `CHALLENGE_KINDS`, which holds all
   * seven kinds, so `decision`, `option` and `constraint` went from a
   * three-button row (144 CSS px) to the full four-button row (196). The worst
   * case did not get worse; the number of cards that reach it did. That is an
   * integration consequence of the base move, it is measured here rather than
   * inherited, and this test is bound to the four-button row because that is now
   * every kind's row.
   *
   * ⛔ THIS IS AN ACCEPTED TRADE, NOT A CLEAN RESULT. 90% of the narrowest card
   * is a lot, and the honest reason it is accepted is that the alternative is
   * handing the user back the 12px targets that caused the founder's report. It
   * is recorded at this number so the NEXT widening has to be decided rather
   * than discovered. If this test REDs, do not retune the constant — price the
   * change against the card first.
   */
  describe('the control row against the card it sits on', () => {
    /**
     * Occupied width of the row in CSS px at the settle zoom, computed from the
     * ROW AND ITS BUTTONS AS RENDERED.
     *
     * `scaled` values are multiplied by the bound counter-scale; unscaled ones
     * are not — which is exactly the asymmetry the inset relies on (it is
     * breathing room against the card edge and deliberately does not scale).
     * The left-most button's `::before` slop overhangs the visual row, so it is
     * part of what the row takes from the card.
     */
    const atBound = (v: Sized): number => (v.scaled ? v.px * MAX_LABEL_COUNTER_SCALE : v.px)

    const measureRow = () => {
      const row = screen.getByTestId('node-quick-actions-node-a')
      const buttons = targetsIn(row)
      const gap = gapFromClass(cls(row))
      expect(gap, 'the row carries no gap class to measure from').not.toBeNull()
      // `bottom-1.5 right-1.5` -> 6px, unscaled. Read from the row, not restated.
      const inset = sizeFromClass(cls(row).replace(/(^|\s)(bottom|right)-/g, '$1h-'), 'h')
      expect(inset, 'the row carries no corner inset to measure from').not.toBeNull()
      let visual = 0
      for (const b of buttons) {
        const box = sizeFromClass(cls(b), 'w')
        expect(box, `${idOf(b)}: no width class to size from`).not.toBeNull()
        visual += atBound(box!)
      }
      visual += (buttons.length - 1) * atBound(gap!)
      const slop = atBound(slopFromClass(cls(buttons[0])))
      return { buttons, occupied: atBound(inset!) + visual + slop, visual }
    }

    /**
     * Trap 13: an assertion about a magnitude needs a probe that can be shown to
     * DISCRIMINATE. An un-counter-scaled row must measure smaller, or the
     * measurement is not reading the scale at all and every number below is
     * arithmetic about nothing.
     */
    it('CONTROL: the measurement discriminates a scaled row from a bare one', () => {
      expect(atBound({ px: 20, scaled: true })).toBe(40)
      expect(atBound({ px: 20, scaled: false })).toBe(20)
      expect(MAX_LABEL_COUNTER_SCALE).toBeGreaterThan(1)
    })

    /**
     * The precondition, pinned BY IDENTITY rather than by a count a sibling
     * could satisfy (trap 19). A fixture rendering two buttons would compute a
     * comfortable footprint and pass a test that had measured nothing.
     */
    it('measures the FULL four-button row, named one by one', () => {
      render(<NodeQuickActions nodeId="node-a" nodeType="factor" label="Hiring spend" />)
      const { buttons } = measureRow()
      expect(buttons.map(idOf).sort()).toEqual([
        'node-action-ask-node-a',
        'node-action-challenge-node-a',
        'node-action-inspect-node-a',
        'node-action-menu-node-a',
      ])
    })

    /**
     * ⚠ THE FOURTH BUTTON IS NOW ON EVERY KIND — asserted, not assumed, because
     * the whole point of pinning the four-button row is that it is the row every
     * card gets. If a kind stops reaching it this REDs and the footprint claim
     * has to be re-scoped.
     */
    it('every node kind reaches the same four-button row', () => {
      for (const kind of ['factor', 'risk', 'outcome', 'goal', 'decision', 'option', 'constraint'] as const) {
        document.body.innerHTML = ''
        render(<NodeQuickActions nodeId="node-a" nodeType={kind} label="Hiring spend" />)
        expect(
          targetsIn(screen.getByTestId('node-quick-actions-node-a')).length,
          `${kind} does not render the four-button row the footprint is pinned to`,
        ).toBe(4)
      }
    })

    it('takes EXACTLY the accepted share of the narrowest card, and no more', () => {
      render(<NodeQuickActions nodeId="node-a" nodeType="factor" label="Hiring spend" />)
      const { occupied, visual } = measureRow()

      // The three numbers the reviewer derived from source, now asserted.
      expect(visual, 'the row visual width moved').toBe(196)
      expect(occupied, 'the row footprint moved').toBe(206)
      expect(NODE_LAYOUT_MIN_W, 'the narrowest card moved').toBe(230)

      // …and the RELATIONSHIP, which is the thing that actually matters and the
      // thing a change to either side would break silently.
      expect(occupied).toBeLessThan(NODE_LAYOUT_MIN_W)
      expect(
        Math.round((occupied / NODE_LAYOUT_MIN_W) * 1000) / 10,
        'the row footprint as a % of the narrowest card is the accepted trade — re-decide it, do not retune it',
      ).toBe(89.6)
    })
  })
})
