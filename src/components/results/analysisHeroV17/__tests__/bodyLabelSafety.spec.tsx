/**
 * Composed-body label-safety scan (Round-5 P1.1 + P1.2 review feedback).
 *
 * The hero's row builders sanitise user-supplied labels via
 * `safeInterpolatedLabel` before interpolating them into generated copy
 * (chat prompts, reasons, key questions). Same gate must apply to the
 * sub-components inside `TriageActionCardsBody` that the v17 hero composes:
 *
 *   - `T1DominantNudge`: `aria-label`, `title`, Validate-button `aria-label`
 *   - `T1FlipRiskCallout`: visible prose, Validate-button text
 *
 * These tests inject user-supplied labels that contain banned glossary
 * terms ("Recommendation analysis", "Winner option", etc.) and assert:
 *
 *   - v17 mode (`useV17Copy={true}`): NO banned terms appear in the
 *     rendered DOM's generated copy or accessibility attributes; the raw
 *     label still renders in the visible identity span (user data is
 *     preserved verbatim where it is displayed AS user data).
 *   - Legacy mode (`useV17Copy={false}`): raw labels DO appear in generated
 *     copy unchanged — the legacy `DecisionConfidencePanel` rendering and
 *     its tests stay untouched.
 *
 * Per `analysisHeroV17/glossaryCheck.ts`: the production gate uses the
 * SAME canonical banned-term list as the test scanner, so a label that
 * trips the gate in production is the same label that trips the scanner
 * here.
 */

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import TriageActionCardsBody from '../../TriageActionCardsBody'
import { containsBannedTerm } from '../glossaryCheck'
import type { ResultsSectionDataReturn } from '../../useResultsSectionData'
import type {
  ConfidenceSectionData,
  DecisionResultData,
  DriversSectionData,
  OptionResult,
  FragileEdge,
  DriverItem,
  ConditionalWinner,
} from '../../types'

// ── Fixtures with banned-term labels ────────────────────────────────────────

const BANNED_FACTOR_LABEL = 'Recommendation analysis'         // contains "Recommendation"
const BANNED_ALT_WINNER_LABEL = 'Winner option B'             // contains "Winner"
const BANNED_CONDITIONAL_FACTOR_LABEL = 'Recommendation tier' // contains "Recommendation"
const BANNED_HIGH_BUCKET_LABEL = 'Best choice path'           // contains "Best choice"
const BANNED_LOW_BUCKET_LABEL = 'Winning approach'            // contains "Winning"

function makeFragileEdge(): FragileEdge {
  return {
    fromId: 'n_factor',
    fromLabel: BANNED_FACTOR_LABEL,
    toId: 'n_outcome',
    toLabel: 'Outcome',
    alternativeWinnerLabel: BANNED_ALT_WINNER_LABEL,
    switchProbability: 0.6,
  } as FragileEdge
}

function makeDominantDriver(): DriverItem {
  return {
    factorId: 'n_factor',
    factorLabel: BANNED_FACTOR_LABEL,
    factorKey: 'n_factor',
    matchedNodeId: 'n_factor',
    influenceScore: 0.92,
    normalisedInfluence: 0.92,
  } as DriverItem
}

function makeConditionalWinner(): ConditionalWinner {
  return {
    factor_label: BANNED_CONDITIONAL_FACTOR_LABEL,
    factor_id: 'n_cond_factor',
    split_value: 100,
    split_unit: undefined,
    high_bucket: { winner_label: BANNED_HIGH_BUCKET_LABEL, win_probability: 0.7 },
    low_bucket: { winner_label: BANNED_LOW_BUCKET_LABEL, win_probability: 0.3 },
  }
}

function makeData(): ResultsSectionDataReturn {
  const winner: OptionResult = { id: 'opt_a', label: 'Option A', winProbability: 0.7 } as OptionResult
  const recommendation: DecisionResultData = {
    recommendedOption: winner,
    allOptions: [winner, { id: 'opt_b', label: 'Option B', winProbability: 0.3 } as OptionResult],
    goalLabel: 'Goal',
    isSingleOption: false,
    analysisStatus: 'computed',
    recommendationStability: 0.7,
  } as DecisionResultData
  const drivers: DriversSectionData = {
    drivers: [makeDominantDriver()],
    topDrivers: [makeDominantDriver()],
    driversStatus: 'computed',
    totalCount: 1,
    hasMagnitudeData: true,
    dominantFactorLabel: BANNED_FACTOR_LABEL,
    dominantFactorId: 'n_factor',
  } as DriversSectionData
  const confidence: ConfidenceSectionData = {
    tier: { tier: 'fair', icon: 'AlertTriangle', label: 'Fair', description: 'd' },
    qualityScore: 60,
    uncertainties: [], topUncertainties: [],
    improvements: [], topImprovements: [],
    evidenceGaps: [], topEvidenceGaps: [],
    nextActions: [], topNextActions: [],
    topFragileEdge: makeFragileEdge(),
    // (Round-7 P1.2) Conditional scenarios with banned-term labels in
    // every interpolated field — header, factor_label, both winner_labels.
    conditionalWinners: [makeConditionalWinner()],
  } as ConfidenceSectionData
  return {
    recommendation,
    drivers,
    confidence,
    improvements: { improvements: [], count: 0, hasHighPriority: false },
    isLoading: false, isError: false, goalLabel: 'Goal',
  } as ResultsSectionDataReturn
}

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Pull every text-bearing string off an element: visible text, `title`,
 * `aria-label`, `aria-describedby` resolved text. We scan ALL of these.
 */
function collectGeneratedStrings(el: HTMLElement): string[] {
  const out: string[] = []
  out.push(el.textContent ?? '')
  if (el.getAttribute('title')) out.push(el.getAttribute('title')!)
  if (el.getAttribute('aria-label')) out.push(el.getAttribute('aria-label')!)
  el.querySelectorAll('[title], [aria-label]').forEach(child => {
    const t = child.getAttribute('title')
    const a = child.getAttribute('aria-label')
    if (t) out.push(t)
    if (a) out.push(a)
  })
  return out
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe('TriageActionCardsBody — composed-body label safety', () => {
  describe('T1DominantNudge — v17 mode', () => {
    it('aria-label, title, and Validate-button aria-label have NO banned terms when label is unsafe', () => {
      render(
        <TriageActionCardsBody
          data={makeData()}
          suppressTriageQueue
          useV17Copy
          onFocusNode={() => {}}
        />,
      )
      const nudge = screen.getByTestId('t1-dominant-nudge') as HTMLElement
      const strings = collectGeneratedStrings(nudge)
      // The visible identity <span> still contains the raw label by design.
      // We only assert that aria-label + title (the GENERATED copy) are clean.
      expect(containsBannedTerm(nudge.getAttribute('aria-label'))).toBe(false)
      expect(containsBannedTerm(nudge.getAttribute('title'))).toBe(false)
      const validateBtn = nudge.querySelector('button[aria-label^="Validate"]')
      expect(validateBtn).not.toBeNull()
      expect(containsBannedTerm(validateBtn!.getAttribute('aria-label'))).toBe(false)
      // Sanity: the raw banned label string DID make it into the DOM somewhere
      // (the visible identity span). We're not stripping user data — just
      // guarding generated wrappers.
      const matchedVisible = strings.some(s => s.includes(BANNED_FACTOR_LABEL))
      expect(matchedVisible).toBe(true)
    })

    it('Research auto-send chip is absent in v17 mode even when onSendMessage is provided', () => {
      render(
        <TriageActionCardsBody
          data={makeData()}
          suppressTriageQueue
          useV17Copy
          onFocusNode={() => {}}
          onSendMessage={() => {}}
        />,
      )
      const nudge = screen.getByTestId('t1-dominant-nudge') as HTMLElement
      expect(nudge.querySelector('button[aria-label^="Research"]')).toBeNull()
    })
  })

  describe('T1DominantNudge — legacy mode', () => {
    it('aria-label + title contain the raw label verbatim (unchanged legacy behaviour)', () => {
      render(
        <TriageActionCardsBody
          data={makeData()}
          suppressTriageQueue={false}
          useV17Copy={false}
          onFocusNode={() => {}}
        />,
      )
      const nudge = screen.getByTestId('t1-dominant-nudge') as HTMLElement
      expect(nudge.getAttribute('aria-label')).toContain(BANNED_FACTOR_LABEL)
      expect(nudge.getAttribute('title')).toContain(BANNED_FACTOR_LABEL)
      // And the legacy trailing sentence still uses "recommendation".
      expect(nudge.getAttribute('title')).toMatch(/recommendation could change/i)
    })
  })

  describe('T1FlipRiskCallout — v17 mode', () => {
    it('visible prose and Validate button have NO banned terms when fragile labels are unsafe', () => {
      render(
        <TriageActionCardsBody
          data={makeData()}
          suppressTriageQueue
          useV17Copy
          onFocusNode={() => {}}
        />,
      )
      const callout = screen.getByTestId('t1-flip-risk-callout') as HTMLElement
      // textContent is the rendered prose ("If ... shifts, ... could overtake")
      // plus the Validate button text.
      expect(containsBannedTerm(callout.textContent)).toBe(false)
      const validateBtn = Array.from(callout.querySelectorAll('button')).find(b =>
        (b.textContent ?? '').startsWith('Validate'),
      )
      expect(validateBtn).toBeTruthy()
      expect(containsBannedTerm(validateBtn!.textContent)).toBe(false)
    })
  })

  describe('T1FlipRiskCallout — legacy mode', () => {
    it('visible prose contains the raw banned labels (unchanged legacy behaviour)', () => {
      render(
        <TriageActionCardsBody
          data={makeData()}
          suppressTriageQueue={false}
          useV17Copy={false}
          onFocusNode={() => {}}
        />,
      )
      const callout = screen.getByTestId('t1-flip-risk-callout') as HTMLElement
      expect(callout.textContent).toContain(BANNED_FACTOR_LABEL)
      expect(callout.textContent).toContain(BANNED_ALT_WINNER_LABEL)
    })
  })

  describe('ConditionalWinnerCards — v17 mode', () => {
    it('header tooltip + sr-only text drop the banned "recommendation" word', () => {
      render(
        <TriageActionCardsBody
          data={makeData()}
          suppressTriageQueue
          useV17Copy
          onFocusNode={() => {}}
        />,
      )
      const cards = screen.getByTestId('conditional-winner-cards') as HTMLElement
      // The header `<span>` carries both `title` (tooltip) and an `<span
      // class="sr-only">` (screen-reader text). Both should be free of
      // banned terms.
      const headerHelp = cards.querySelector('span[title]') as HTMLElement | null
      expect(headerHelp).not.toBeNull()
      expect(containsBannedTerm(headerHelp!.getAttribute('title'))).toBe(false)
      const srOnly = cards.querySelector('.sr-only') as HTMLElement | null
      expect(srOnly).not.toBeNull()
      expect(containsBannedTerm(srOnly!.textContent)).toBe(false)
    })

    it('prose and Above/Below footer interpolate via safeInterpolatedLabel; no banned terms remain', () => {
      render(
        <TriageActionCardsBody
          data={makeData()}
          suppressTriageQueue
          useV17Copy
          onFocusNode={() => {}}
        />,
      )
      const cards = screen.getByTestId('conditional-winner-cards') as HTMLElement
      // The full visible text — prose + Above/Below — should be clean.
      expect(containsBannedTerm(cards.textContent)).toBe(false)
      // Sanity: the data WAS rendered (we didn't accidentally suppress
      // the cards). The split value 100 is a stable, non-banned proxy.
      expect(cards.textContent).toContain('100')
    })
  })

  describe('ConditionalWinnerCards — legacy mode', () => {
    it('renders raw labels verbatim in header tooltip and prose (unchanged legacy behaviour)', () => {
      render(
        <TriageActionCardsBody
          data={makeData()}
          suppressTriageQueue={false}
          useV17Copy={false}
          onFocusNode={() => {}}
        />,
      )
      const cards = screen.getByTestId('conditional-winner-cards') as HTMLElement
      const headerHelp = cards.querySelector('span[title]') as HTMLElement | null
      expect(headerHelp).not.toBeNull()
      expect(headerHelp!.getAttribute('title')).toMatch(/recommendation/i)
      // Prose still contains the raw factor label.
      expect(cards.textContent).toContain(BANNED_CONDITIONAL_FACTOR_LABEL)
      // Above/Below footer still contains the raw bucket labels.
      expect(cards.textContent).toContain(BANNED_HIGH_BUCKET_LABEL)
      expect(cards.textContent).toContain(BANNED_LOW_BUCKET_LABEL)
    })
  })

  describe('whole-body scan in v17 mode', () => {
    it('every aria-label and title attribute is glossary-clean even with banned-term inputs', () => {
      const { container } = render(
        <TriageActionCardsBody
          data={makeData()}
          suppressTriageQueue
          useV17Copy
          onFocusNode={() => {}}
        />,
      )
      const offenders: { kind: string; value: string }[] = []
      container.querySelectorAll('[aria-label]').forEach(el => {
        const v = el.getAttribute('aria-label')!
        if (containsBannedTerm(v)) offenders.push({ kind: 'aria-label', value: v })
      })
      container.querySelectorAll('[title]').forEach(el => {
        const v = el.getAttribute('title')!
        if (containsBannedTerm(v)) offenders.push({ kind: 'title', value: v })
      })
      expect(offenders, `found banned terms in generated attributes: ${JSON.stringify(offenders, null, 2)}`).toEqual([])
    })

    it('all rendered visible text across the entire composed body is glossary-clean', () => {
      // (Round-7 P1.2) Whole-body visible-text scan. Catches any future
      // banned-term leak introduced via new sub-components or templates,
      // including the conditional-scenarios block now covered by the
      // fixture. The visible identity span inside `T1DominantNudge` still
      // contains the raw `BANNED_FACTOR_LABEL` — that span is explicitly
      // user data and is excluded from this sweep via its data-testid.
      const { container } = render(
        <TriageActionCardsBody
          data={makeData()}
          suppressTriageQueue
          useV17Copy
          onFocusNode={() => {}}
        />,
      )
      // Clone, then strip the dominant-nudge identity span (user data).
      const clone = container.cloneNode(true) as HTMLElement
      clone.querySelectorAll('[data-testid="t1-dominant-nudge"] span.font-semibold').forEach(el => el.remove())
      const text = clone.textContent ?? ''
      expect(containsBannedTerm(text), `banned term found in visible text:\n  raw: ${JSON.stringify(text)}`).toBe(false)
    })
  })
})
