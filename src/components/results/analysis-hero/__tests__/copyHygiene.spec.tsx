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

/**
 * Lens-NAMING copy — the only sanctioned "stability" occurrences: the
 * prototype tab label and its unavailable-state explainer NAME the
 * stability view, they do not claim stability for this run. Scanned with
 * the full checks below except the literal word "stability"; every other
 * trust word stays banned here too.
 */
const LENS_NAMING_COPY: string[] = [
  HERO_COPY.lensLabel.stability,
  HERO_COPY.lensUnavailable.stability,
]

const UI_COPY: string[] = [
  HERO_COPY.panelAria,
  HERO_COPY.tablistAria,
  HERO_COPY.lensLabel.goal,
  HERO_COPY.lensLabel.outcome,
  HERO_COPY.lensLabel.whatChanged,
  HERO_COPY.lensUnavailable.goalNoTarget,
  HERO_COPY.lensUnavailable.goalProducerGap,
  HERO_COPY.lensUnavailable.outcome,
  HERO_COPY.lensUnavailable.whatChanged,
  HERO_COPY.srLensUnavailable,
  HERO_COPY.fixtureBanner,
  HERO_COPY.ghostLegend,
  HERO_COPY.headline.goalWithLimits(L),
  HERO_COPY.headline.goalOnly(L),
  HERO_COPY.headline.analysisLeads(L),
  HERO_COPY.headline.mostLikelyStrongest(L),
  HERO_COPY.headline.slightlyAhead(L),
  HERO_COPY.headline.noClearLeader,
  HERO_COPY.headline.outcomeLeader(L),
  HERO_COPY.headline.noneOnTrack,
  HERO_COPY.headline.noneOnTrackWithLimits,
  HERO_COPY.headline.singleOption(L),
  HERO_COPY.headline.noLeader,
  HERO_COPY.subline.highestOutcome(L),
  HERO_COPY.subline.aligned(L),
  HERO_COPY.subline.closeOnOutcome(L),
  HERO_COPY.subline.compareTop,
  HERO_COPY.subline.overlapAdvisory,
  HERO_COPY.labelFallback,
  HERO_COPY.factorFallback,
  ...Object.values(HERO_COPY.axis).flatMap((a) => [a.left, a.mid, a.right]),
  HERO_COPY.caption.goalWithLimits,
  HERO_COPY.caption.goalOnly,
  HERO_COPY.caption.outcome,
  HERO_COPY.caption.outcomeOverlap,
  HERO_COPY.caption.outcomeSingleRange,
  HERO_COPY.caption.outcomeDotsOnly,
  // HERO_COPY.readout.missing is deliberately NOT scanned: it is the
  // app-wide missing-value placeholder glyph ('—', matching format.ts
  // nullPlaceholder), not prose — the no-em-dash rule targets sentences.
  HERO_COPY.readout.goalSuffix,
  HERO_COPY.readout.subOnePercent,
  HERO_COPY.detail.whyLabel,
  HERO_COPY.detail.couldChangeIfLabel,
  HERO_COPY.detail.watchLabel,
  HERO_COPY.detail.tradeOffLabel,
  HERO_COPY.detail.couldChangeIf('Team capacity', '30%'),
  HERO_COPY.detail.winChance('58%'),
  HERO_COPY.detail.range('54', '82'),
  HERO_COPY.detail.goalFit('34%'),
  HERO_COPY.detail.goalFitWithLimits('34%'),
  HERO_COPY.footer.mainReason('Team capacity'),
  HERO_COPY.footer.focusNext,
  HERO_COPY.footer.focusNextAria,
  HERO_COPY.footer.focusTarget,
  HERO_COPY.footer.targetInputAria,
  HERO_COPY.footer.targetApply,
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
    for (const copy of [...UI_COPY, ...LENS_NAMING_COPY]) {
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
    // Lens-naming copy gets the same ban EXCEPT the sanctioned lens name
    // itself — "Stability" names the view, it never claims stability.
    if (term !== 'stability') {
      for (const copy of LENS_NAMING_COPY) {
        expect(copy, `"${copy}" should not contain "${term}"`).not.toMatch(re)
      }
    }
  })

  it('uses no all-caps words and no em dashes (sentence case, British English)', () => {
    for (const copy of [...UI_COPY, ...LENS_NAMING_COPY]) {
      expect(copy).not.toMatch(/\b[A-Z]{2,}\b/)
      expect(copy).not.toContain('—')
    }
  })

  it('never authors "looks strongest" (retired: implied outcome-lens evidence for a win-probability leader)', () => {
    for (const copy of [...UI_COPY, ...LENS_NAMING_COPY]) {
      expect(copy, `"${copy}" must not use the retired phrase`).not.toMatch(/looks strongest/i)
    }
  })
})
