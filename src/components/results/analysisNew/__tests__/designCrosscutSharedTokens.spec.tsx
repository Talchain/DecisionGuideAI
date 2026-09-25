/**
 * ⭐⭐ CROSS-CUTTING SHARED-TOKEN GAPS (design-audit-20260925) that landed in
 * `panelSurfaces.ts` / `typography.ts`, which no single build bundle owned.
 * Pinned by identity, same method as `designShellTokensModelStrip.spec.tsx`.
 */
import { describe, expect, it } from 'vitest'

import { ACTION_TIER } from '../panelSurfaces'

// ─────────────────────────────────────────────────────────────────────────
// gap TYPE-4 — a disclosure door is body ink, never an underlined link.
// TOKEN ONLY: no consumer in this pass; ReasoningSignals.tsx is owned by a
// different bundle and is not on this pass's editable-file list.
// ─────────────────────────────────────────────────────────────────────────
describe('gap TYPE-4: panelSurfaces declares the disclose tier — body ink, no underline, no info colour at rest', () => {
  it('⭐⭐ `disclose` exists, carries a 24px touch target, and is not blue or underlined at rest', () => {
    expect(ACTION_TIER).toHaveProperty('disclose')
    expect(ACTION_TIER.disclose).toContain('min-h-[24px]')
    expect(ACTION_TIER.disclose).toContain('min-w-[24px]')
    // body ink at rest
    expect(ACTION_TIER.disclose).toMatch(/\btext-text-body\b/)
    // never a link: no underline class, and no info-blue OUTSIDE a hover: prefix
    expect(ACTION_TIER.disclose).not.toMatch(/\bunderline\b/)
    expect(ACTION_TIER.disclose.replace(/hover:\S*/g, '')).not.toMatch(/text-info/)
  })

  it('⭐ `disclose` is distinct from every other tier string, so the register stays injective', () => {
    const values = Object.values(ACTION_TIER)
    const distinct = new Set(values)
    expect(distinct.size).toBe(values.length)
  })
})
