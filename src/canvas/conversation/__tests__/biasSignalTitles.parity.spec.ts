/**
 * PR #356 fast-follow 2 — bias-title canonical-map parity.
 *
 * BIAS_SIGNAL_TITLES (conversation cards, draftBiasSignalBlocks.ts) was a
 * hand-maintained mirror of the titles inside BIAS_TYPE_ICON
 * (PreAnalysisPanel.tsx) — the repo's dominant defect class. The ratified
 * fix: ONE shared canonical map (src/canvas/shared/biasSignalTitles.ts)
 * both surfaces import, so one bias renders one name everywhere by
 * construction. These pins hold that:
 *   - the conversation map IS the canonical object (identity, not a copy);
 *   - the pre-analysis surface resolves every canonical code to the
 *     canonical title, through its real public mappers (both wire
 *     conventions: lowercase `type` and uppercase `code`);
 *   - every icon-map key resolves a canonical title (drift in either
 *     direction fails loud here, never silently).
 */
import { describe, it, expect, vi } from 'vitest'

import { BIAS_SIGNAL_TITLES } from '../../shared/biasSignalTitles'
import {
  BIAS_SIGNAL_TITLES as CONVERSATION_TITLES,
  humaniseBiasSignalCode,
} from '../draftBiasSignalBlocks'
import {
  BIAS_TYPE_ICON,
  mapDraftBiasSignalToTrigger,
  normaliseCeeBiasFinding,
} from '../../components/pre-analysis/PreAnalysisPanel'

// PreAnalysisPanel imports the canvas store transitively; keep the module
// import light and deterministic (the functions under test are pure).
vi.mock('../../store', () => {
  const mockState = { nodes: [] as Array<{ id: string }> }
  return {
    useCanvasStore: Object.assign(
      (selector: (s: unknown) => unknown) => selector(mockState),
      { getState: () => mockState },
    ),
  }
})

describe('bias-signal titles — one canonical map (#356 fast-follow 2)', () => {
  it('the conversation surface uses the canonical map itself, not a copy', () => {
    expect(CONVERSATION_TITLES).toBe(BIAS_SIGNAL_TITLES)
  })

  it('canonical keys are lowercase and titles are non-empty sentence-case strings', () => {
    const entries = Object.entries(BIAS_SIGNAL_TITLES)
    expect(entries.length).toBeGreaterThanOrEqual(15)
    for (const [key, title] of entries) {
      expect(key).toBe(key.toLowerCase())
      expect(title.trim().length).toBeGreaterThan(0)
      expect(title[0]).toBe(title[0].toUpperCase())
    }
  })

  it('the pre-analysis draft-signal mapper resolves every canonical code to the canonical title', () => {
    for (const [code, title] of Object.entries(BIAS_SIGNAL_TITLES)) {
      const trigger = mapDraftBiasSignalToTrigger(
        { type: code, detail: 'A grounded detail sentence.' },
        0,
        () => null,
      )
      expect(trigger, `code ${code} produced no trigger`).not.toBeNull()
      expect(trigger!.title, `title drift for code ${code}`).toBe(title)
      // Case-insensitive: the uppercase wire convention lands on the same title.
      const upper = mapDraftBiasSignalToTrigger(
        { type: code.toUpperCase(), detail: 'A grounded detail sentence.' },
        0,
        () => null,
      )
      expect(upper!.title, `uppercase title drift for code ${code}`).toBe(title)
    }
  })

  it('the conversation resolver agrees with the canonical map, case-insensitively', () => {
    for (const [code, title] of Object.entries(BIAS_SIGNAL_TITLES)) {
      expect(humaniseBiasSignalCode(code)).toBe(title)
      expect(humaniseBiasSignalCode(code.toUpperCase())).toBe(title)
    }
  })

  it('the CEE-findings mapper (uppercase `code` convention) resolves canonical titles', () => {
    for (const code of ['AUTHORITY_BIAS', 'CONFIRMATION_BIAS', 'SUNK_COST', 'NARROW_FRAMING', 'STATUS_QUO_BIAS']) {
      const trigger = normaliseCeeBiasFinding(
        { code, explanation: 'A grounded explanation.' },
        0,
        () => null,
      )
      expect(trigger, `code ${code} produced no trigger`).not.toBeNull()
      expect(trigger!.title).toBe(BIAS_SIGNAL_TITLES[code.toLowerCase()])
    }
  })

  it('DRIFT TRAP: every icon-map key resolves a canonical title', () => {
    for (const [key, entry] of Object.entries(BIAS_TYPE_ICON)) {
      const canonical = BIAS_SIGNAL_TITLES[key.toLowerCase()]
      expect(canonical, `icon key ${key} has no canonical title`).toBeDefined()
      expect(entry.title, `icon-map title drift for key ${key}`).toBe(canonical)
    }
  })
})
