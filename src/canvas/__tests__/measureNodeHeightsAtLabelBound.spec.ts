/**
 * The measurer must (a) pin the counter-scale to its BOUND while it reads, and
 * (b) leave the property exactly as it found it — including "not set at all".
 *
 * ⚠ `CanvasLabelScaleSync` writes `--canvas-label-scale` in an effect keyed on
 * the QUANTISED scale, so it does not re-write unless the zoom moves. A value
 * left behind here would silently mis-size every later render at that zoom, and
 * nothing would go red. That is the property the restore tests below pin.
 *
 * ⚠ jsdom has no layout, so `offsetHeight` is 0 for everything. That is why the
 * height reads are STUBBED per element: this spec is about the protocol (pin →
 * read → restore) and about absence handling. The real numbers are a browser
 * question and are measured in `e2e/geometry/heightVsZoom.measure.ts`.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { measureNodeHeightsAtLabelBound } from '../utils/measureNodeHeightsAtLabelBound'
import {
  CANVAS_LABEL_SCALE_VAR,
  CANVAS_LABEL_SCALE_MARKER_TESTID,
  LOD_BLANKED_BODY_ATTR,
  LOD_BLANKED_BODY_SELECTOR,
  MAX_LABEL_COUNTER_SCALE,
  MAX_NORMAL_RUNG_LABEL_SCALE,
  NODE_RUNG_PADDING_ATTR,
} from '../utils/zoomLegibility'

/**
 * @param withMarker mount the `CanvasLabelScaleSync` marker inside this root.
 *   A `<MiniCanvas>` is a bare `<ReactFlow>` and carries NO marker — that
 *   asymmetry is the whole contract, so it has to be expressible here.
 */
function mountCanvas(
  ids: string[],
  heights: Record<string, number>,
  scaleSeen: string[],
  withMarker = true,
): HTMLElement {
  const root = document.createElement('div')
  root.className = 'react-flow'
  if (withMarker) {
    const marker = document.createElement('span')
    marker.dataset.testid = CANVAS_LABEL_SCALE_MARKER_TESTID
    root.appendChild(marker)
  }
  for (const id of ids) {
    const el = document.createElement('div')
    el.className = 'react-flow__node'
    el.dataset.id = id
    // Reading offsetHeight is what forces layout in a real browser; here it is
    // the hook that lets the spec observe WHAT SCALE WAS IN FORCE at read time.
    Object.defineProperty(el, 'offsetHeight', {
      // `configurable` so a test that needs to observe something OTHER than the
      // scale at read time (the LOD body cases below observe the inline height)
      // can re-point this hook rather than duplicating the whole mount.
      configurable: true,
      get() {
        scaleSeen.push(root.style.getPropertyValue(CANVAS_LABEL_SCALE_VAR))
        return heights[id] ?? 0
      },
    })
    root.appendChild(el)
  }
  document.body.appendChild(root)
  return root
}

describe('measureNodeHeightsAtLabelBound', () => {
  beforeEach(() => { document.body.innerHTML = '' })
  afterEach(() => { document.body.innerHTML = '' })

  it('reads every mounted node WHILE the counter-scale is pinned to its bound', () => {
    const seen: string[] = []
    mountCanvas(['a', 'b'], { a: 300, b: 210 }, seen)

    const out = measureNodeHeightsAtLabelBound()

    expect(out.get('a')).toBe(300)
    expect(out.get('b')).toBe(210)
    // Not "the property was set at some point" — the value in force AT EACH READ.
    expect(seen).toEqual([String(MAX_LABEL_COUNTER_SCALE), String(MAX_LABEL_COUNTER_SCALE)])
  })

  it('restores an ABSENT property to absent, not to a literal', () => {
    const root = mountCanvas(['a'], { a: 300 }, [])
    measureNodeHeightsAtLabelBound()
    expect(root.style.getPropertyValue(CANVAS_LABEL_SCALE_VAR)).toBe('')
  })

  it('restores a PRE-EXISTING property to its own value', () => {
    const root = mountCanvas(['a'], { a: 300 }, [])
    root.style.setProperty(CANVAS_LABEL_SCALE_VAR, '1.43')
    measureNodeHeightsAtLabelBound()
    expect(root.style.getPropertyValue(CANVAS_LABEL_SCALE_VAR)).toBe('1.43')
  })

  it('returns an EMPTY map when there is no canvas — never a map of zeroes', () => {
    // The distinction is load-bearing: a zero HEIGHT would become a 40 px floor
    // in `getNodeDimensions` and collapse every row. Absence must fall through.
    expect(measureNodeHeightsAtLabelBound().size).toBe(0)
  })

  it('omits a node that measures zero rather than recording it as a height', () => {
    mountCanvas(['a', 'zero'], { a: 300, zero: 0 }, [])
    const out = measureNodeHeightsAtLabelBound()
    expect(out.get('a')).toBe(300)
    expect(out.has('zero')).toBe(false)
  })

  // ── WHICH INSTANCE (review finding F1) ────────────────────────────────────
  // `ReactFlowGraph` renders comparison mode as a TERNARY: while it is on, the
  // main canvas is UNMOUNTED and the only roots on the page are two
  // `<MiniCanvas>` instances rendering THE SAME node ids, un-re-keyed. A
  // document-rooted `.react-flow` lookup returns the FIRST of those.
  //
  // ⚠ These are not "nice to have". `getNodeDimensions` PREFERS a supplied bound
  // over `measured.height`, so the module's "absent ⇒ fall through" safety only
  // protects against a MISSING id. A mini-map's height under a real node's id is
  // present, wrong, and taken.

  it('measures NOTHING when the main canvas is unmounted and only mini-maps remain', () => {
    // The reviewer's reproduction, as a corpus: two marker-less roots carrying
    // the same ids at mini-map heights.
    mountCanvas(['n1', 'n2'], { n1: 90, n2: 84 }, [], false)
    mountCanvas(['n1', 'n2'], { n1: 90, n2: 84 }, [], false)

    const out = measureNodeHeightsAtLabelBound()

    expect(
      out.size,
      'a mini-map height arrived under a real node id — the caller PREFERS it over measured.height, so nothing downstream can recover',
    ).toBe(0)
  })

  it('measures the MARKER\'s root, not the first root in the document', () => {
    // The discriminating twin of the case above, and the reason the first one is
    // not merely "returns empty when the DOM is odd": a mini-map is mounted
    // FIRST and the real canvas second, so `document.querySelector` and the
    // marker walk disagree, and the assertion says which one is right.
    mountCanvas(['n1', 'n2'], { n1: 90, n2: 84 }, [], false)
    mountCanvas(['n1', 'n2'], { n1: 300, n2: 280 }, [], true)

    const out = measureNodeHeightsAtLabelBound()

    expect(Object.fromEntries(out)).toEqual({ n1: 300, n2: 280 })
  })

  it('the marker must be INSIDE a React Flow root to select one', () => {
    // A marker portalled out of the canvas (or left behind by an unmount) must
    // not resolve to some ancestor that happens to exist. No root, empty map.
    const stray = document.createElement('span')
    stray.dataset.testid = CANVAS_LABEL_SCALE_MARKER_TESTID
    document.body.appendChild(stray)
    expect(measureNodeHeightsAtLabelBound().size).toBe(0)
  })

  // ── THE LOD BODY COLLAPSE, RELEASED FOR THE READ (16 Sep 2026) ────────────
  //
  // `LOD_BLANKED_BODY_STYLE` collapses a blanked card body to ONE LINE. Below
  // `LABEL_LEGIBLE_ZOOM` that is what the DOM holds — and it is the DEFAULT on
  // three of the five shipped starters, whose fit zoom is 0.4935/~0.35. This
  // module's contract is the height AT THE BOUND, where the body is visible and
  // full height, so it must release that collapse while it reads or it reserves
  // a stride the card overflows the moment the reader zooms in. Measured in
  // Chromium before this was closed: worst per-card delta 430px against 45px of
  // sub-row slack (`e2e/geometry/heightVsZoom.measure.ts`).
  //
  // ⚠ jsdom performs no layout, so these pin the PROTOCOL — what is in force at
  // read time, and what is left behind — exactly as the scale tests above do.
  // The NUMBER is a browser question and is measured in the geometry harness.

  /** Give a node a blanked body wrapper carrying the marker the measurer reads. */
  function blankBody(root: HTMLElement, id: string, inlineHeight = 'calc(16px * var(--canvas-label-scale, 1))'): HTMLElement {
    const node = root.querySelector(`.react-flow__node[data-id="${id}"]`) as HTMLElement
    const body = document.createElement('div')
    body.setAttribute(LOD_BLANKED_BODY_ATTR, 'true')
    if (inlineHeight !== '') body.style.height = inlineHeight
    node.appendChild(body)
    return body
  }

  it('RELEASES the blanked body height while it reads', () => {
    const seen: string[] = []
    const root = mountCanvas(['a'], { a: 300 }, [])
    const body = blankBody(root, 'a')
    // Observe the inline height IN FORCE at the moment of the read, the same
    // way the scale tests observe the custom property.
    const node = root.querySelector('.react-flow__node') as HTMLElement
    Object.defineProperty(node, 'offsetHeight', { get() { seen.push(body.style.height); return 300 } })

    measureNodeHeightsAtLabelBound()

    expect(seen, 'the collapsed body was still collapsed at read time — the map is the SHORT height, which is the defect this closes').toEqual(['auto'])
  })

  it('restores the blanked body height to its own value afterwards', () => {
    const root = mountCanvas(['a'], { a: 300 }, [])
    const body = blankBody(root, 'a')
    measureNodeHeightsAtLabelBound()
    // React owns this inline style and will not rewrite it until the rung
    // flips, so a value left behind un-collapses the card silently.
    expect(body.style.height).toBe('calc(16px * var(--canvas-label-scale, 1))')
  })

  // S5 (24 Sep): the product's collapse is now a MAX-height (a short body is
  // never made taller by blanking), so the release must lift that cap too.
  it('RELEASES a blanked body MAX-height while it reads, and restores it after', () => {
    const seen: string[] = []
    const root = mountCanvas(['a'], { a: 300 }, [])
    const body = blankBody(root, 'a', '')
    body.style.maxHeight = 'calc(16px * var(--canvas-label-scale, 1))'
    const node = root.querySelector('.react-flow__node') as HTMLElement
    Object.defineProperty(node, 'offsetHeight', { get() { seen.push(body.style.maxHeight); return 300 } })

    measureNodeHeightsAtLabelBound()

    expect(seen, 'the capped body was still capped at read time').toEqual(['none'])
    expect(body.style.maxHeight).toBe('calc(16px * var(--canvas-label-scale, 1))')
  })

  it('restores an ABSENT max-height to absent', () => {
    const root = mountCanvas(['a'], { a: 300 }, [])
    const body = blankBody(root, 'a', '')
    measureNodeHeightsAtLabelBound()
    expect(body.getAttribute('style') ?? '').not.toContain('max-height')
  })

  it('restores an ABSENT body height to absent, not to a literal', () => {
    const root = mountCanvas(['a'], { a: 300 }, [])
    const body = blankBody(root, 'a', '')
    measureNodeHeightsAtLabelBound()
    expect(body.style.height).toBe('')
    expect(body.getAttribute('style') ?? '').not.toContain('height')
  })

  it('touches ONLY marked bodies — an unmarked element keeps its height throughout', () => {
    // ⭐ THE CONTRAST CONTROL whose expected answer DIFFERS (CLAUDE.md trap 13e).
    // "Every height became auto" and "the marked height became auto" are
    // different claims, and a measurer that blanket-cleared inline heights
    // across the card would satisfy the first test above while corrupting every
    // other element on the node. Only a probe that expects a NON-`auto` answer
    // somewhere can tell them apart.
    const seen: string[] = []
    const root = mountCanvas(['a'], { a: 300 }, [])
    const marked = blankBody(root, 'a')
    const unmarked = document.createElement('div')
    unmarked.style.height = '42px'
    ;(root.querySelector('.react-flow__node') as HTMLElement).appendChild(unmarked)
    const node = root.querySelector('.react-flow__node') as HTMLElement
    Object.defineProperty(node, 'offsetHeight', {
      get() { seen.push(`${marked.style.height}|${unmarked.style.height}`); return 300 },
    })

    measureNodeHeightsAtLabelBound()

    expect(seen, 'the measurer reached past its own marker — an unmarked height was cleared').toEqual(['auto|42px'])
    expect(unmarked.style.height).toBe('42px')
  })

  it('finds the body by the SHARED constant, which is what BaseNode writes', () => {
    // ⚠ The writer and the reader live in different modules. If they ever stop
    // agreeing on the attribute, the measurer simply finds nothing and silently
    // returns to reserving the short height — with every test above still green,
    // because they all mount the marker from this same constant. Binding to the
    // rendered product is what makes the pair fail loud, and
    // `BaseNode.lodQuietIsNoOp.spec.tsx` is where the card is actually rendered
    // at the `line` rung; this asserts the constant those specs' literal means.
    expect(LOD_BLANKED_BODY_ATTR).toBe('data-lod-hidden')
    expect(LOD_BLANKED_BODY_SELECTOR).toBe(`[${LOD_BLANKED_BODY_ATTR}]`)
  })

  // ── EACH RUNG AT ITS OWN BOUND (24 Sep 2026, bounded anatomy) ─────────────
  //
  // Measured in Chromium: the landing layout ran at xyflow's mount zoom (2.85,
  // the Normal rung) ~0.9s before the fit reached 0.53, so every card reserved
  // its Normal-rung band at scale 2 — a state no zoom draws — and the board's
  // row gaps were 64–109 units against 48. Re-laying out at the landing rung
  // took vendor-selection from 1344 to 1230 units tall.
  //
  // ⛔ "A STATE NO ZOOM DRAWS" STOPPED BEING TRUE THE SAME DAY (gap-audit row
  // 3, `canvas/gap-landing-normal`: "the landing view counts as Normal zoom").
  // `resolveLodRung`'s `full` floor moved to the landing floor, so a card at
  // rest on the landing view now uses NORMAL padding at scale
  // `MAX_LABEL_COUNTER_SCALE` — exactly the state this section's tests used to
  // call unreachable. `MAX_NORMAL_RUNG_LABEL_SCALE` moved with it (now equal
  // to `MAX_LABEL_COUNTER_SCALE`, see `zoomLegibility.ts`), so the two
  // measurement passes below now run at the SAME scale; only the two tests
  // that depended on them being DIFFERENT scales changed, and they are marked
  // where they do.

  function declareRungs(root: HTMLElement, id: string, landing: string, normal: string): HTMLElement {
    const node = root.querySelector(`.react-flow__node[data-id="${id}"]`) as HTMLElement
    const card = document.createElement('div')
    card.setAttribute(NODE_RUNG_PADDING_ATTR, JSON.stringify({
      landing: { paddingBottom: landing }, normal: { paddingBottom: normal },
    }))
    node.appendChild(card)
    return card
  }

  it('reads a declaring card at BOTH rungs\' bounds — now the SAME scale — each with its own padding, and reserves the larger', () => {
    const root = mountCanvas(['a'], {}, [])
    const card = declareRungs(root, 'a', '12px', 'calc(6px + 22px * var(--canvas-label-scale, 1))')
    const node = root.querySelector('.react-flow__node[data-id="a"]') as HTMLElement
    const reads: Array<[string, string]> = []
    Object.defineProperty(node, 'offsetHeight', {
      get() {
        const scale = root.style.getPropertyValue(CANVAS_LABEL_SCALE_VAR)
        reads.push([scale, card.style.paddingBottom])
        // ⛔ THE DISCRIMINATOR MOVED FROM SCALE TO PADDING (gap-audit row 3, 24
        // Sep 2026): `MAX_NORMAL_RUNG_LABEL_SCALE` now equals
        // `MAX_LABEL_COUNTER_SCALE` (asserted below), so a mock keyed on scale
        // alone could no longer tell the two passes apart.
        return card.style.paddingBottom === '12px' ? 138 : 141
      },
    })
    const out = measureNodeHeightsAtLabelBound()
    expect(reads).toEqual([
      [String(MAX_LABEL_COUNTER_SCALE), '12px'],
      [String(MAX_NORMAL_RUNG_LABEL_SCALE), 'calc(6px + 22px * var(--canvas-label-scale, 1))'],
    ])
    expect(reads[0]![0], 'both passes now run at the same scale').toBe(reads[1]![0])
    expect(out.get('a')).toBe(141)
  })

  it('⭐ THE REVERSAL: a layout run at the Normal rung correctly reserves the Normal band at scale 2 — because Normal DOES draw there now', () => {
    // ⛔ THIS TEST USED TO PIN THE OPPOSITE VALUE, UNDER THE TITLE "THE DEFECT".
    // It asserted `141`, on the premise that "the Normal band at scale 2" was
    // a state no zoom ever draws, so reserving for it would be over-cautious.
    // Gap-audit row 3 (24 Sep 2026, "the landing view counts as Normal zoom")
    // makes that state the COMMON one: every card at rest on the landing view
    // now uses Normal's own padding at `MAX_LABEL_COUNTER_SCALE`. `181` is the
    // correct reservation for that real state, not a defect to avoid.
    const BAND = 'calc(6px + 22px * var(--canvas-label-scale, 1))'
    const root = mountCanvas(['a'], {}, [])
    const card = declareRungs(root, 'a', '12px', BAND)
    card.style.paddingBottom = BAND
    const node = root.querySelector('.react-flow__node[data-id="a"]') as HTMLElement
    Object.defineProperty(node, 'offsetHeight', {
      // Both passes pin the same scale now, so the only thing distinguishing
      // them is which padding `measureNodeHeightsAtLabelBound` has applied.
      get() { return card.style.paddingBottom === BAND ? 181 : 138 },
    })
    expect(measureNodeHeightsAtLabelBound().get('a')).toBe(181)
    expect(card.style.paddingBottom, 'the live padding is restored').toBe(BAND)
  })

  it('the taller padding wins the max, whichever rung it belongs to — both now read at the same scale', () => {
    // ⛔ RENAMED FROM "the LANDING read wins … never the Normal band at scale
    // 2" (gap-audit row 3, 24 Sep 2026): that claim is now false by
    // construction — Normal DOES read at scale 2 — and the old mock keyed
    // purely on scale could no longer discriminate landing's padding from
    // Normal's, so it was passing without proving anything (CLAUDE.md trap
    // 13b). Keyed on padding instead, which is the only thing that still
    // varies between the two passes.
    const root = mountCanvas(['a'], {}, [])
    const card = declareRungs(root, 'a', '12px', '40px')
    const node = root.querySelector('.react-flow__node[data-id="a"]') as HTMLElement
    Object.defineProperty(node, 'offsetHeight', {
      get() { return card.style.paddingBottom === '12px' ? 136 : 143 },
    })
    expect(measureNodeHeightsAtLabelBound().get('a')).toBe(143)
  })

  it('restores the card\'s inline padding EXACTLY — a set side to its value, an absent side to absent', () => {
    const root = mountCanvas(['a'], { a: 100 }, [])
    const card = declareRungs(root, 'a', '12px', '40px')
    card.style.paddingBottom = 'calc(6px + 22px * var(--canvas-label-scale, 1))'
    measureNodeHeightsAtLabelBound()
    expect(card.style.paddingBottom).toBe('calc(6px + 22px * var(--canvas-label-scale, 1))')
    expect(card.style.paddingTop).toBe('')
  })

  it('CONTRAST — a card that declares nothing is read ONCE, at the landing bound', () => {
    const seen: string[] = []
    mountCanvas(['a'], { a: 120 }, seen)
    expect(measureNodeHeightsAtLabelBound().get('a')).toBe(120)
    expect(seen).toEqual([String(MAX_LABEL_COUNTER_SCALE)])
  })

  it("Normal's own bound now EQUALS the landing bound — Normal draws at the cap too (gap-audit row 3, 24 Sep 2026: landing counts as Normal)", () => {
    // ⛔ THIS PINNED THE OPPOSITE BEFORE: `toBeLessThan(MAX_LABEL_COUNTER_SCALE)`,
    // titled "Normal never draws at scale 2". `resolveLodRung`'s `full` floor
    // moved to `LABEL_LEGIBLE_ZOOM` (the landing floor), so Normal's dead-band
    // exit (`LABEL_LEGIBLE_ZOOM / LOD_REENTRY_MARGIN`) now sits BELOW the
    // landing floor, where `labelCounterScale` is already capped — so the two
    // constants are provably equal, not merely close.
    expect(MAX_NORMAL_RUNG_LABEL_SCALE).toBe(MAX_LABEL_COUNTER_SCALE)
  })
})
