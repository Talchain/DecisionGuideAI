/**
 * The auto-fit must never park the camera in the band the product itself
 * declares unreadable.
 *
 * LIVE DEFECT (deployed staging `039f479a`, 25 Jul 2026, measured in a real
 * browser): after a ~60 s first draft the post-layout auto-fit landed a
 * 19-node model at **0.4456** zoom. `LodSync` hides node labels below 0.5, so
 * 16 of 18 titles and ALL 18 bodies rendered `visibility: hidden` — the first
 * thing the user saw after a minute of waiting was a page of blank boxes. The
 * same defect fires on the templates entry path, measured at **0.4509**.
 *
 * CLAIM TYPE (trap 3): this spec is a CONTRACT assertion in jsdom — it proves
 * the auto-fit ASKS xyflow for a floor at or above the legibility threshold.
 * It cannot and does not prove anything about rendered visibility; that claim
 * is only ever made from a real browser (see the live-acceptance evidence).
 *
 * WHY IT IS NOT A TAUTOLOGY: the captured `minZoom` is fed through
 * `isLodZoom` — the ACTUAL predicate `LodSync` uses to hide labels, imported
 * from the other module. If someone drops `minZoom`, hardcodes a lower
 * number, or raises the LOD threshold without raising the floor, this goes
 * RED. The `typeof === 'number'` assertion is load-bearing and must stay:
 * `isLodZoom(undefined)` is `undefined < 0.5` === `false`, so a predicate-only
 * guard would PASS on a dropped `minZoom` — the precise regression it exists
 * to catch (trap 13: an absence assertion needs a positive control).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useCanvasStore } from '../store'
import { useFitViewOnLayoutVersion } from '../hooks/useFitViewOnLayoutVersion'
import { isLodZoom, LOD_ZOOM_THRESHOLD } from '../components/LodSync'
import { AUTO_FIT_MAX_ZOOM } from '../utils/zoomLegibility'

const fitViewSpy = vi.fn()

const FIT_PADDING = { top: '10px', right: '20px', bottom: '10px', left: '20px' }

vi.mock('@xyflow/react', () => ({
  useReactFlow: () => ({ fitView: fitViewSpy }),
}))

vi.mock('../utils/computeFitPadding', () => ({
  computeFitPadding: () => FIT_PADDING,
}))

/** The zoom the live 19-node first view actually landed on, before the fix. */
const LIVE_FIRST_VIEW_ZOOM = 0.4456
/** The zoom the live 18-node templates entry path landed on, before the fix. */
const LIVE_TEMPLATE_ENTRY_ZOOM = 0.4509

/** Drive one completed layout and hand back the options the hook passed fitView. */
function captureAutoFitOptions(): Record<string, unknown> {
  let rafCallback: (() => void) | null = null
  const rafSpy = vi
    .spyOn(globalThis, 'requestAnimationFrame')
    .mockImplementation((cb: FrameRequestCallback) => {
      rafCallback = cb as unknown as () => void
      return 1
    })

  renderHook(() => useFitViewOnLayoutVersion())
  act(() => {
    useCanvasStore.setState({ layoutVersion: 1 } as never)
  })
  act(() => {
    rafCallback?.()
  })

  rafSpy.mockRestore()

  expect(fitViewSpy).toHaveBeenCalledTimes(1)
  return fitViewSpy.mock.calls[0]![0] as Record<string, unknown>
}

describe('the LOD predicate discriminates (positive control)', () => {
  it('judges the live pre-fix zooms UNREADABLE — so a "readable" verdict means something', () => {
    // If these ever read false the guard below is vacuous: it would be
    // "proving" a floor clears a bar nothing can fail.
    expect(isLodZoom(LIVE_FIRST_VIEW_ZOOM)).toBe(true)
    expect(isLodZoom(LIVE_TEMPLATE_ENTRY_ZOOM)).toBe(true)
  })
})

describe('the post-layout auto-fit is floored at the legibility threshold', () => {
  beforeEach(() => {
    useCanvasStore.getState().resetCanvas()
    useCanvasStore.setState({ layoutVersion: 0 } as never)
    fitViewSpy.mockReset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('passes a finite numeric minZoom (a DROPPED floor must not pass silently)', () => {
    const options = captureAutoFitOptions()
    expect(typeof options.minZoom).toBe('number')
    expect(Number.isFinite(options.minZoom as number)).toBe(true)
  })

  it("the floor it asks for is NOT a LOD zoom, judged by LodSync's own predicate", () => {
    const options = captureAutoFitOptions()
    expect(isLodZoom(options.minZoom as number)).toBe(false)
  })

  it('the floor lifts the live pre-fix zooms out of the hidden-label band', () => {
    const options = captureAutoFitOptions()
    const floor = options.minZoom as number
    expect(floor).toBeGreaterThan(LIVE_FIRST_VIEW_ZOOM)
    expect(floor).toBeGreaterThan(LIVE_TEMPLATE_ENTRY_ZOOM)
    // and the label threshold is what the floor is derived FROM, not a
    // coincidence: the floor is exactly the zoom at which labels start rendering.
    expect(floor).toBe(LOD_ZOOM_THRESHOLD)
  })

  it('still fits with the panel-aware padding and the guarded duration', () => {
    const options = captureAutoFitOptions()
    expect(options.padding).toBe(FIT_PADDING)
    expect(options.duration).toBe(400)
  })
})

/**
 * ⭐⭐ THE CEILING — the other end of the band this file already guards.
 *
 * The floor above stops the product parking the camera too small to read.
 * Nothing stopped the opposite, and the opposite shipped: on a fresh
 * fundraising brief the layout engine threw, the product's fit never ran, and
 * the canvas kept xyflow's bare mount `fitView` — bounded only by the instance's
 * `maxZoom={4}`. Framing one ~300px node in a 1092×878 canvas gave **328%**.
 *
 * These assertions are written the same way as the floor's, and for the same
 * stated reason: a DROPPED ceiling must not pass silently, so the value is fed
 * through the same predicate the product uses rather than compared to a literal
 * copied from the other module.
 */
describe('the auto-fit asks for a ceiling as well as a floor', () => {
  beforeEach(() => {
    fitViewSpy.mockReset()
  })

  it('passes a finite numeric maxZoom (a DROPPED ceiling must not pass silently)', () => {
    const options = captureAutoFitOptions()
    expect(typeof options.maxZoom).toBe('number')
    expect(Number.isFinite(options.maxZoom as number)).toBe(true)
  })

  it('the ceiling is the module constant, bound by identity rather than by value', () => {
    // Binding to `AUTO_FIT_MAX_ZOOM` and not to `1`: if the constant's own
    // derivation ever moves, this follows it instead of pinning a stale number
    // — and a hand-typed `maxZoom: 1` at the call site would fail here.
    const options = captureAutoFitOptions()
    expect(options.maxZoom).toBe(AUTO_FIT_MAX_ZOOM)
  })

  it('the ceiling refuses the witnessed 328% and stays above the floor', () => {
    const options = captureAutoFitOptions()
    const ceiling = options.maxZoom as number
    const floor = options.minZoom as number
    // The incident's own number, kept as the case this exists to prevent.
    expect(ceiling).toBeLessThan(3.28)
    // …and the band is a band: a ceiling at or below the floor would clamp
    // every fit to one zoom, which is a different bug wearing this fix's face.
    expect(ceiling).toBeGreaterThan(floor)
  })
})
