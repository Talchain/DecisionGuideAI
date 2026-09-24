/**
 * ⭐ AN EXPLICIT ZOOM CLAIMS THE CAMERA — Codex CR 5811958756 on #1932 (24 Sep 2026).
 *
 * Canvas Browser Gate `nodeKeyboardBleed` clicked "Zoom level 53%. Click to reset
 * to 100%" and the camera stayed at 53%: the zoom controls never claimed the
 * camera, so a same-model correction layout re-ran the product's automatic fit.
 *
 * Two halves, each pinned where it lives:
 *   · the three zoom controls and the gesture move-end claim, in ReactFlowGraph —
 *     pinned at the handler BODIES (comments blanked), since rendering the whole
 *     graph for three callbacks would test the harness, not the wiring;
 *   · a gesture is told apart from a programmatic move by xyflow's event
 *     (`isUserCameraMove`), so the product's own fits never claim.
 * `useFitViewOnLayoutVersion.*` specs already pin that an automatic layout of the
 * claimed model does not re-fit, and that a new model / Auto-arrange still do.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { blankNonCode } from '../../../tests/helpers/stripSourceComments'
import { isUserCameraMove } from '../utils/userCameraClaim'

const GRAPH = blankNonCode(readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'ReactFlowGraph.tsx'), 'utf8'))

function handlerBody(name: string): string {
  const start = GRAPH.indexOf(`const ${name} = useCallback(`)
  expect(start, `PRECONDITION: ${name} exists`).toBeGreaterThan(-1)
  return GRAPH.slice(start, GRAPH.indexOf('}, [])', start))
}

describe('an explicit zoom claims the camera for this model', () => {
  it.each(['handleZoomIn', 'handleZoomOut', 'handleZoomReset'])('%s claims before it moves', (name) => {
    const body = handlerBody(name)
    const claim = body.indexOf('claimCameraForUser(currentModelKey())')
    expect(claim, `${name} claims the camera`).toBeGreaterThan(-1)
    expect(claim, `${name} claims BEFORE it moves the camera`).toBeLessThan(body.search(/zoom(In|Out|To)Ref\.current\(/))
  })

  it('the gesture move-end claims only for a person\'s move, and is wired to ReactFlow', () => {
    expect(GRAPH).toMatch(/onMoveEnd=\{\(event\) => \{ if \(isUserCameraMove\(event\)\) claimCameraForUser\(currentModelKey\(\)\) \}\}/)
  })

  it('CONTRAST — the Fit-to-view claim is unchanged (the scan sees an existing claim)', () => {
    expect(handlerBody('handleFitView')).toMatch(/claimCameraForUser\(currentModelKey\(\)\)/)
  })
})

describe('isUserCameraMove — a gesture, not a programmatic move', () => {
  it('xyflow\'s null for fitView / zoomTo / the product fit does NOT claim', () => {
    expect(isUserCameraMove(null)).toBe(false)
    expect(isUserCameraMove(undefined)).toBe(false)
  })
  it('a wheel / pointer event does', () => {
    expect(isUserCameraMove(new MouseEvent('wheel'))).toBe(true)
  })
})
