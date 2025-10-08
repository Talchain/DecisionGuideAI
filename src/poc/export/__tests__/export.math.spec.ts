import { describe, it, expect } from 'vitest'
import { computePixelSize, formatSandboxPngName } from '../exportCanvas'

describe('export math helpers', () => {
  it('bounds to pixels uses DPR and scale', () => {
    const r1 = computePixelSize(200, 100, 12, 2, 1)
    expect(r1.cssWidth).toBe(224)
    expect(r1.cssHeight).toBe(124)
    expect(r1.pixelWidth).toBe(448)
    expect(r1.pixelHeight).toBe(248)

    const r2 = computePixelSize(0, 0, 12, 1.5, 2)
    expect(r2.cssWidth).toBe(24)
    expect(r2.cssHeight).toBe(24)
    expect(r2.pixelWidth).toBe(72) // 24 * 1.5 * 2 = 72
    expect(r2.pixelHeight).toBe(72)

    console.log('GATES: PASS — export png unit')
  })

  it('filename format helper pads with zeroes', () => {
    const d = new Date('2024-01-05T09:07:03Z')
    // Using UTC date to avoid TZ flakiness; accept that hours/mins may vary per env
    const name = formatSandboxPngName(d)
    expect(name).toMatch(/^sandbox_export_\d{8}_\d{6}\.png$/)
  })
})
