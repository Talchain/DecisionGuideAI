/**
 * UI-SEM-098 — the canvas ↔ contract strength-band translation is a total,
 * order-preserving bijection, derived from BOTH sides' own runtime vocabularies
 * (the contract's zod enum and the canvas band table), never from a retyped list.
 */
import { describe, expect, it } from 'vitest'
import { StrengthBand } from '@talchain/schemas'
import { CANVAS_STRENGTH_BANDS } from '../../canvas/domain/vocabulary'
import { fromContractStrengthBand, toContractStrengthBand } from '../strengthBandWire'

const CANVAS_IDS = CANVAS_STRENGTH_BANDS.map(b => b.id)
const CONTRACT_BANDS = [...StrengthBand.options]

describe('strength band wire translation (UI-SEM-098)', () => {
  it('maps every canvas band to a valid contract band, and back to itself', () => {
    for (const id of CANVAS_IDS) {
      const wire = toContractStrengthBand(id)
      expect(StrengthBand.safeParse(wire).success).toBe(true)
      expect(fromContractStrengthBand(wire)).toBe(id)
    }
  })

  it('maps every contract band to a canvas band, and back to itself', () => {
    for (const band of CONTRACT_BANDS) {
      const id = fromContractStrengthBand(band)
      expect(CANVAS_IDS).toContain(id)
      expect(toContractStrengthBand(id)).toBe(band)
    }
  })

  it('is a bijection: the two vocabularies have the same size and no band is shared', () => {
    expect(CANVAS_IDS).toHaveLength(CONTRACT_BANDS.length)
    expect(new Set(CANVAS_IDS.map(toContractStrengthBand))).toEqual(new Set(CONTRACT_BANDS))
    expect(new Set(CONTRACT_BANDS.map(fromContractStrengthBand))).toEqual(new Set(CANVAS_IDS))
  })

  it('preserves band ORDER — a swapped pair would still be a bijection, so this is what catches it', () => {
    // The canvas table is ascending by |mean|; the contract enum is declared
    // strongest-first. Order preservation means one is the other reversed.
    expect(CANVAS_IDS.map(toContractStrengthBand)).toEqual([...CONTRACT_BANDS].reverse())
  })
})
