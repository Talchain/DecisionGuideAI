/**
 * The canvas element's own mount `fitView` is a PRODUCT fit, bounded like one
 * (#70 5841781894).
 *
 * Served probes (UI c95694de and c7234091, Paul's brief, 1280×800) all showed
 * zoom 2.53 at first paint: the pre-layout arrangement framed at 253%, one card
 * filling the canvas, for about 1–2 s, and for good when the layout never ran.
 * The cause was the element's bare `fitView`, which passed no options and so had
 * the instance's `maxZoom={4}` as its only ceiling.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { AUTO_FIT_MAX_ZOOM, CANVAS_MOUNT_FIT_OPTIONS, LABEL_LEGIBLE_ZOOM, fitBoundsFor } from '../utils/zoomLegibility'

describe('the canvas mount fit is bounded', () => {
  it('is the product class, bound by identity: ceiling AUTO_FIT_MAX_ZOOM, floor LABEL_LEGIBLE_ZOOM', () => {
    expect(CANVAS_MOUNT_FIT_OPTIONS).toEqual(fitBoundsFor('product'))
    expect(CANVAS_MOUNT_FIT_OPTIONS.maxZoom).toBe(AUTO_FIT_MAX_ZOOM)
    expect(CANVAS_MOUNT_FIT_OPTIONS.minZoom).toBe(LABEL_LEGIBLE_ZOOM)
  })

  it('refuses the witnessed 253% (and 19 Sep\'s 328%)', () => {
    expect(CANVAS_MOUNT_FIT_OPTIONS.maxZoom!).toBeLessThan(2.53)
  })

  it('the LIVE <ReactFlow> element (the one given the canvas nodes) passes it next to its fitView', () => {
    const src = readFileSync(resolve(__dirname, '../ReactFlowGraph.tsx'), 'utf8')
    // The live element is the one wired to the store's change handler; the
    // others in the file are debug isolation variants behind false constants.
    const handler = src.indexOf('onNodesChange={handleNodesChange}')
    expect(handler, 'the live <ReactFlow> element was not found').toBeGreaterThan(-1)
    const start = src.lastIndexOf('<ReactFlow', handler)
    const props = src.slice(start, src.indexOf('\n          >', handler))
    expect(props).toMatch(/\n\s+fitView\n/)
    expect(props).toContain('fitViewOptions={CANVAS_MOUNT_FIT_OPTIONS}')
  })
})
