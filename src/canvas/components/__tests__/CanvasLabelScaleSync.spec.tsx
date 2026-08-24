/**
 * CanvasLabelScaleSync — the transport for the label counter-scale.
 *
 * The arithmetic is proved in `zoomLegibility.counterScale.spec.ts`. What is
 * proved HERE is the seam that arithmetic travels through, because a correct
 * function written onto the wrong element, or onto every element, is the same
 * defect as no function at all.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { CanvasLabelScaleSync } from '../CanvasLabelScaleSync'
import { CANVAS_LABEL_SCALE_VAR, labelCounterScale } from '../../utils/zoomLegibility'

let zoom = 1

vi.mock('@xyflow/react', () => ({
  useStore: (selector: any) => selector({ transform: [0, 0, zoom] }),
}))

/** Mount inside a stand-in for React Flow's own root element. */
function mountAt(z: number) {
  zoom = z
  const host = document.createElement('div')
  host.className = 'react-flow'
  document.body.appendChild(host)
  const outside = document.createElement('div')
  document.body.appendChild(outside)
  const result = render(<CanvasLabelScaleSync />, { container: host })
  return { host, outside, ...result }
}

afterEach(() => {
  cleanup()
  document.body.innerHTML = ''
  zoom = 1
})

describe('CanvasLabelScaleSync', () => {
  it('writes the counter-scale for the current zoom onto the React Flow root', () => {
    const { host } = mountAt(0.5)
    expect(host.style.getPropertyValue(CANVAS_LABEL_SCALE_VAR)).toBe(String(labelCounterScale(0.5)))
  })

  it('CONTRAST CONTROL: the value differs by zoom — it is not a constant', () => {
    // A transport that writes the same string whatever it is given would pass
    // the test above and deliver nothing. Two zooms, two answers (trap 20: a
    // probe returning identical results for every input is reporting on itself).
    const a = mountAt(0.5).host.style.getPropertyValue(CANVAS_LABEL_SCALE_VAR)
    cleanup(); document.body.innerHTML = ''
    const b = mountAt(1).host.style.getPropertyValue(CANVAS_LABEL_SCALE_VAR)
    expect(a).not.toBe(b)
    expect(b).toBe('1')
  })

  it('SCOPE: never touches an element outside its own React Flow instance', () => {
    // The Compare-tab minis are separate instances and panels are outside the
    // canvas entirely. A `document.querySelector` implementation would pass
    // every other test in this file and silently rescale the whole app.
    const { outside } = mountAt(0.5)
    expect(outside.style.getPropertyValue(CANVAS_LABEL_SCALE_VAR)).toBe('')
    expect(document.body.style.getPropertyValue(CANVAS_LABEL_SCALE_VAR)).toBe('')
  })

  it('removes the property on unmount, leaving the root as it was found', () => {
    // A stale scale outliving the component would mis-size a later mount, and
    // nothing would report it.
    const { host, unmount } = mountAt(0.5)
    expect(host.style.getPropertyValue(CANVAS_LABEL_SCALE_VAR)).not.toBe('')
    unmount()
    expect(host.style.getPropertyValue(CANVAS_LABEL_SCALE_VAR)).toBe('')
  })

  it('does not throw when no React Flow root is present', () => {
    // Store doubles and isolated harnesses mount components bare. This must
    // degrade to "no counter-scale", never to a crash that takes the canvas out.
    zoom = 0.5
    expect(() => render(<CanvasLabelScaleSync />)).not.toThrow()
  })

  it('quantises to two decimals so a wheel gesture is not a write per frame', () => {
    const { host } = mountAt(0.7)
    const written = Number(host.style.getPropertyValue(CANVAS_LABEL_SCALE_VAR))
    // 1/0.7 = 1.4285714…  → 1.43
    expect(written).toBe(1.43)
    // …and the quantisation is EXACT at the auto-fit settle zoom, where it
    // matters: 1/0.5 = 2 needs no rounding at all.
    cleanup(); document.body.innerHTML = ''
    expect(Number(mountAt(0.5).host.style.getPropertyValue(CANVAS_LABEL_SCALE_VAR))).toBe(2)
  })

  it('quantises upward so a 10px label never falls below the 10px floor', () => {
    const fittedZoom = 0.738624
    const { host } = mountAt(fittedZoom)
    const written = Number(host.style.getPropertyValue(CANVAS_LABEL_SCALE_VAR))
    expect(written).toBe(1.36)
    expect(10 * written * fittedZoom).toBeGreaterThanOrEqual(10)
  })
})
