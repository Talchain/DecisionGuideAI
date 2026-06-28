/**
 * Copy hygiene — UI-AUTHORED copy only.
 *
 * Scans FOCUS_COPY + every static row's user-facing strings against the union of
 * the canonical glossary list, the existing coaching-panel forbidden list, and
 * this task's banned vocabulary. It deliberately does NOT scan server-supplied
 * strings — those are rendered verbatim and are a CEE/Gate-Zero concern, never
 * the renderer's (F.6). Server prose is therefore explicitly NOT claim-certified
 * by this suite.
 */
import { describe, it, expect } from 'vitest'
import { findBannedTerm } from '@/test/glossaryBannedTerms'
import { FOCUS_COPY, STATIC_HYGIENE_ROWS } from '../focusConstants'

const EXISTING_FORBIDDEN = ['node', 'edge', 'graph', 'coefficient', 'weight', 'evpi', 'winner', 'recommended']
const TASK_FORBIDDEN = [
  'driver',
  'influence',
  'sensitivity',
  'fragile',
  'evpi',
  'voi',
  'value of information',
  'what would change',
  'flip',
  'high confidence',
  'stable result',
  'this matters most',
]

const UI_COPY: string[] = [
  FOCUS_COPY.panelAria,
  FOCUS_COPY.header,
  FOCUS_COPY.emptyState,
  FOCUS_COPY.tryThisLabel,
  FOCUS_COPY.askOlumi,
  FOCUS_COPY.itemFallback,
  FOCUS_COPY.showFewer,
  FOCUS_COPY.staleText,
  FOCUS_COPY.rerunLabel,
  FOCUS_COPY.cannotConfirmText,
  FOCUS_COPY.showAll(3),
  ...STATIC_HYGIENE_ROWS.flatMap((r) => [
    r.primary,
    r.whyItMatters ?? '',
    r.tryThis ?? '',
    r.action?.label ?? '',
    r.action?.prefillText ?? '',
  ]),
].filter((s) => s.length > 0)

describe('Focus Now copy hygiene (UI-authored copy only)', () => {
  it('contains no canonical glossary banned term', () => {
    for (const copy of UI_COPY) {
      const hit = findBannedTerm(copy)
      expect(hit, `"${copy}" contains banned term "${hit}"`).toBeNull()
    }
  })

  it.each([...new Set([...EXISTING_FORBIDDEN, ...TASK_FORBIDDEN])])(
    'contains no forbidden term: %s',
    (term) => {
      const re = new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i')
      for (const copy of UI_COPY) {
        expect(copy, `"${copy}" should not contain "${term}"`).not.toMatch(re)
      }
    },
  )

  it('uses no all-caps words and no em dashes (sentence case, British English)', () => {
    for (const copy of UI_COPY) {
      expect(copy).not.toMatch(/\b[A-Z]{2,}\b/)
      expect(copy).not.toContain('—')
    }
  })
})
