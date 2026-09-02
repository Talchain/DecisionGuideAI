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
  MAX_LABEL_COUNTER_SCALE,
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
})
