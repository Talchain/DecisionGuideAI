/**
 * Vision spec §3 (23 Oct 2026): the lane labels (EXPLORATION / ALTERNATIVES / FACTORS / OUTCOMES / RISKS / GOAL) are
 * retired. Card colour and glyph carry the type. The tier GEOMETRY in `utils/tierLanes.ts` stays: layout and the edge
 * label keep-outs still read it, so only the drawn words go.
 */
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = path.resolve(__dirname, '../../..')
const GRAPH = readFileSync(path.join(ROOT, 'src/canvas/ReactFlowGraph.tsx'), 'utf8')

describe('the canvas draws no lane labels', () => {
  it('the canvas mounts no lane-title layer, and the renderer is gone', () => {
    expect(GRAPH).not.toMatch(/<TierLanes[\s/>]/)
    expect(GRAPH).not.toMatch(/from '\.\/nodes\/TierLanes'/)
    expect(existsSync(path.join(ROOT, 'src/canvas/nodes/TierLanes.tsx'))).toBe(false)
  })

  it('CONTRAST: the graph-space layers that stay are still mounted', () => {
    expect(GRAPH).toMatch(/<ProposalGhostLayer \/>/)
    expect(GRAPH).toMatch(/<WhatIfMarkLayer \/>/)
  })
})
