#!/usr/bin/env node
/**
 * Consistency check for the layout-diagnostic fixtures.
 *
 * For every node in `renderedBoxes`, compute the expected on-screen Y from
 * the pipeline's `afterCollisionAndTranslation` Y and the post-fitView
 * `viewportTransform` (translate + scale), then assert it matches the
 * captured `domY` within a small tolerance. Same for X. Fails the run if
 * any node drifts beyond ±3 px without an explicit override.
 *
 * Run:
 *   node docs/layout-diagnostic-fixtures/check-pipeline-vs-dom.mjs
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const TOLERANCE = 3
const here = path.dirname(fileURLToPath(import.meta.url))

let totalNodes = 0
let mismatches = 0

for (const label of ['A', 'B']) {
  const f = path.join(here, `graph-${label}-layout-diagnostics.json`)
  const data = JSON.parse(readFileSync(f, 'utf8'))
  const m = (data.viewportTransform || '').match(/translate\(([\d.-]+)px, ([\d.-]+)px\) scale\(([\d.-]+)\)/)
  if (!m) {
    console.log(`graph ${label}: no viewport transform parsed; skipping`)
    continue
  }
  const tx = parseFloat(m[1])
  const ty = parseFloat(m[2])
  const sc = parseFloat(m[3])

  const finalStage = data.diagnostics[data.diagnostics.length - 1]
  const pipelineByNode = {}
  for (const tierNodes of Object.values(finalStage.byTier)) {
    for (const n of tierNodes) {
      pipelineByNode[n.id] = { x: n.x, y: n.y }
    }
  }

  console.log(`\nGraph ${label} — viewport translate(${tx}, ${ty}) scale(${sc.toFixed(3)})`)
  console.log('id'.padEnd(30), 'pipeY', 'expDomY', 'domY', 'dY', 'X✓Y✓')
  for (const box of data.renderedBoxes) {
    const p = pipelineByNode[box.id]
    if (!p) continue
    totalNodes++
    const expDomX = Math.round(tx + p.x * sc)
    const expDomY = Math.round(ty + p.y * sc)
    const dX = box.domX - expDomX
    const dY = box.domY - expDomY
    const okX = Math.abs(dX) <= TOLERANCE
    const okY = Math.abs(dY) <= TOLERANCE
    if (!okX || !okY) mismatches++
    console.log(
      box.id.padEnd(30),
      String(p.y).padStart(5),
      String(expDomY).padStart(7),
      String(box.domY).padStart(4),
      String(dY).padStart(3),
      `${okX ? '✓' : '✗'} ${okY ? '✓' : '✗'}`,
    )
  }
}

console.log(`\nResult: ${totalNodes - mismatches}/${totalNodes} nodes within ±${TOLERANCE}px`)
process.exit(mismatches === 0 ? 0 : 1)
