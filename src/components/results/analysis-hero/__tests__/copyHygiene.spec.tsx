/**
 * Copy hygiene — UI-AUTHORED copy only (HERO_COPY). Scanned against the
 * canonical glossary banned-term list plus the trust vocabulary this panel
 * must never author (trust words render only from producer labels, and no
 * producer label exists at launch). Producer-supplied strings (story
 * headlines, option labels rendered verbatim in row titles) are deliberately
 * NOT scanned — they are rendered as data, never authored here.
 */
import { describe, expect, it } from 'vitest'
import { findBannedTerm } from '@/test/glossaryBannedTerms'
import { HERO_COPY } from '../heroCopy'

// Neutral placeholders so template output — not the arguments — is scanned.
const L = 'Option Alpha'

const UI_COPY: string[] = [
  HERO_COPY.panelAria,
  HERO_COPY.tablistAria,
  HERO_COPY.lensLabel.goal,
  HERO_COPY.lensLabel.outcome,
  HERO_COPY.headline.goalWithLimits(L),
  HERO_COPY.headline.goalOnly(L),
  HERO_COPY.headline.outcomeOnly(L),
  HERO_COPY.headline.singleOption(L),
  HERO_COPY.headline.noLeader,
  HERO_COPY.subline.diverged(L, 'Option Beta', true),
  HERO_COPY.subline.diverged(L, 'Option Beta', false),
  HERO_COPY.subline.aligned(L),
  HERO_COPY.labelFallback,
  HERO_COPY.factorFallback,
  ...Object.values(HERO_COPY.axis).flatMap((a) => [a.left, a.mid, a.right]),
  HERO_COPY.caption.goalWithLimits,
  HERO_COPY.caption.goalOnly,
  HERO_COPY.caption.outcome,
  HERO_COPY.caption.outcomeTarget('120'),
  HERO_COPY.readout.goalSuffix,
  HERO_COPY.detail.whyLabel,
  HERO_COPY.detail.couldChangeIfLabel,
  HERO_COPY.detail.couldChangeIf('Team capacity', '30%'),
  HERO_COPY.detail.winChance('58%'),
  HERO_COPY.footer.mainReason('Team capacity'),
  HERO_COPY.footer.focusNext,
  HERO_COPY.footer.focusNextAria,
  HERO_COPY.footer.rerun,
  HERO_COPY.status.partial.headline,
  HERO_COPY.status.partial.body,
  HERO_COPY.status.failed.headline,
  HERO_COPY.status.failed.body,
  HERO_COPY.status.blocked.headline,
  HERO_COPY.status.blocked.body,
  HERO_COPY.srLeader,
].filter((s) => s.length > 0)

/**
 * Trust/banding vocabulary this panel must never author (correction 8 of the
 * review). The canonical glossary covers some of these; the rest are pinned
 * here explicitly.
 */
const TRUST_FORBIDDEN = [
  'trust',
  'provisional',
  'firm',
  'moderate',
  'fragile',
  'confidence',
  'stability',
  'robust',
]

describe('Analysis hero copy hygiene (UI-authored copy only)', () => {
  it('contains no canonical glossary banned term', () => {
    for (const copy of UI_COPY) {
      const hit = findBannedTerm(copy)
      expect(hit, `"${copy}" contains banned term "${hit}"`).toBeNull()
    }
  })

  it('positive control: the scanner fires on bad copy', () => {
    expect(findBannedTerm('the recommended winner uses the graph')).not.toBeNull()
  })

  it.each(TRUST_FORBIDDEN)('authors no trust/banding word: %s', (term) => {
    const re = new RegExp(`\\b${term}\\b`, 'i')
    expect(`a ${term} b`, `regex for "${term}" must fire`).toMatch(re)
    for (const copy of UI_COPY) {
      expect(copy, `"${copy}" should not contain "${term}"`).not.toMatch(re)
    }
  })

  it('uses no all-caps words and no em dashes (sentence case, British English)', () => {
    for (const copy of UI_COPY) {
      expect(copy).not.toMatch(/\b[A-Z]{2,}\b/)
      expect(copy).not.toContain('—')
    }
  })
})
