/**
 * ROADMAP 2.973 — "what I was given / what I used": behaviour + mount path.
 *
 * ## What this spec is defending
 *
 * The 2026-08-08 context-integrity trace measured that the user's brief is
 * persisted byte-verbatim, served by the cold-read seam, and read by NOTHING —
 * while the model silently drops most of what the user quantified. This surface
 * is the answer. The assertions below fall into two families, and both are
 * load-bearing for different reasons.
 *
 * ### Family 1 — the honesty invariants
 *
 * THREE DIFFERENT ZEROS MUST NEVER RENDER THE SAME WAY:
 *   1. no manifest at all (CEE predates the field) — WE KNOW NOTHING
 *   2. `unavailable` (CEE looked, could not) — STILL NOTHING
 *   3. `derived` with an empty list — we looked, there was nothing to check
 *
 * Only (3) may reassure. The live case today is (1), for as long as staging CEE
 * predates this field, so a component that rendered it as an empty list would
 * tell every current user their brief survived intact. `renders-nothing` is not
 * an acceptable answer either — silence reads as "all good".
 *
 * ### Family 2 — the mount path
 *
 * ⚠ THIS ESTATE HAS SHIPPED A FEATURE DARK TWICE BY BINDING A SPEC TO A
 * COMPONENT THE DEPLOYED FLAGS SWITCH OFF (CLAUDE.md trap 3b). `ResultsBody`
 * forks on `analysisHeroPanel`, staging deploys `=1`, and the two arms are
 * mutually exclusive by construction — so a section hosted on the `=0` arm is
 * invisible in production while every render test passes. This section is
 * mounted in the UNCONDITIONAL `v7-top-group`, and the spec asserts it under
 * BOTH postures so that a flag move cannot make it disappear silently.
 *
 * Flags are injected through the flag system's OWN seam (localStorage, which
 * `makeFlag` reads at call time), never `vi.mock('@/flags')` — a mocked flag
 * proves the mock, not the posture. The parity test below proves the injection
 * actually flips the real predicate.
 *
 * ## The fixtures
 *
 * `fixtures/b{1,2,3}-cold-read.not-modelled.json`. The `brief_text` half is
 * REAL deployed bytes from the trace's cold-read captures (CEE build 4b57b8f).
 * The `not_modelled` half is the deterministic output of CEE's derivation over
 * those same real bytes — NOT a deployed-wire capture, because CEE has not
 * shipped the field yet. That limitation is stated in each fixture's
 * `_provenance` and is the honest bound on what this spec proves: it proves the
 * UI renders what CEE's derivation produces from real briefs, not that the
 * deployed wire carries it.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'

import { ResultsBody } from '../../ResultsBody'
import { V7WhatIWasGivenSection } from '../V7WhatIWasGivenSection'
import { isAnalysisHeroPanelEnabled } from '@/flags'
import { useCanvasStore } from '@/canvas/store'
import { useUIStore } from '@/stores/uiStore'
import type { ResultsSectionDataReturn } from '../../useResultsSectionData'
import type { OptionResult } from '../../types'
import { useContextIntegrityStore } from '@/canvas/stores/contextIntegrityStore'
import { parseNotModelled } from '@/adapters/cee/notModelled'

import b1Fixture from './fixtures/b1-cold-read.not-modelled.json'
import b2Fixture from './fixtures/b2-cold-read.not-modelled.json'
import b3Fixture from './fixtures/b3-cold-read.not-modelled.json'

vi.mock('../../../../canvas/utils/focusHelpers', () => ({
  focusNodeById: vi.fn(),
  focusByTarget: vi.fn(),
  focusExistingTarget: vi.fn(),
  focusModelTarget: vi.fn(() => true),
}))

// ── Identity anchors, hand-pinned from the captures, never derived at runtime
// (a value read from the fixture at runtime is an oracle agreeing with itself).
const B1_DROPPED_ARR = '£11.2m' // trace atom B1-A03, graded HIGH
const B1_DROPPED_NRR = '112%' // trace atom B1-A22, graded SEVERE
const B1_KEPT_CAP = '£1.5m' // trace atom B1-A20, faithful (cap 1.5 £m)
const B2_DANA = "Dana's across-the-board RIF option"

const PROVENANCE_KEYS = ['_provenance']
function coldReadOf(fixture: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(fixture).filter(([k]) => !PROVENANCE_KEYS.includes(k)),
  ) as { brief_text: string; not_modelled: unknown }
}

/** Seed the store exactly as `serverGraphHydration` does, through the REAL
 *  boundary parser — never a hand-built manifest object. */
function seedFrom(fixture: Record<string, unknown>): void {
  const cold = coldReadOf(fixture)
  useContextIntegrityStore.getState().setContextIntegrity({
    scenarioId: 'a6ccf5cf-aab0-4f01-b889-e0d6c072067c',
    briefText: cold.brief_text,
    manifest: parseNotModelled(cold.not_modelled),
  })
}

function openPanel(): void {
  fireEvent.click(screen.getByTestId('what-i-was-given-toggle'))
}

beforeEach(() => {
  localStorage.removeItem('feature.analysisHeroPanel')
  useContextIntegrityStore.getState().reset()
})
afterEach(() => {
  localStorage.removeItem('feature.analysisHeroPanel')
  useContextIntegrityStore.getState().reset()
  cleanup()
})

describe('the fixtures carry the case they are used to prove (anti-vacuity)', () => {
  it('the B1 capture really states the figures asserted below', () => {
    const cold = coldReadOf(b1Fixture as never)
    for (const literal of [B1_DROPPED_ARR, B1_DROPPED_NRR, B1_KEPT_CAP]) {
      expect(cold.brief_text.includes(literal), `brief states ${literal}`).toBe(true)
    }
    // And the manifest survives the REAL parser — if it did not, every
    // rendering assertion below would be exercising the null branch instead.
    expect(parseNotModelled(cold.not_modelled)?.status).toBe('derived')
  })
})

describe('what I was given — the brief, verbatim', () => {
  it('shows the user their own words, byte-for-byte', () => {
    seedFrom(b1Fixture as never)
    render(<V7WhatIWasGivenSection />)
    openPanel()

    const quote = screen.getByTestId('what-i-was-given-brief')
    // The WHOLE brief, unedited and un-summarised. This is the raw material the
    // trace found persisted losslessly and read by nothing.
    expect(quote.textContent).toBe(coldReadOf(b1Fixture as never).brief_text)
  })
})

describe('what I used — the verdicts, bound by identity', () => {
  it('lists a dropped figure under "not in the model", addressed by its offset', () => {
    const cold = coldReadOf(b1Fixture as never)
    seedFrom(b1Fixture as never)
    render(<V7WhatIWasGivenSection />)
    openPanel()

    // The group is truncated by default (progressive disclosure), so reveal it
    // first. Asserting without this would pass or fail on list POSITION rather
    // than on the verdict under test.
    fireEvent.click(screen.getByTestId('what-i-was-given-absent-show-all'))

    const group = screen.getByTestId('what-i-was-given-absent')
    // Identity binding: the row is found by its char offset in the brief, not
    // by matching text a different quantity could also produce (trap 19).
    const offset = cold.brief_text.indexOf(B1_DROPPED_NRR)
    const row = group.querySelector(`[data-char-offset="${offset}"]`)
    expect(row, `absent row at offset ${offset}`).not.toBeNull()
    expect(row!.textContent).toContain(B1_DROPPED_NRR)
  })

  it('does not cry loss over a figure that DID reach the model', () => {
    const cold = coldReadOf(b1Fixture as never)
    seedFrom(b1Fixture as never)
    render(<V7WhatIWasGivenSection />)
    openPanel()

    fireEvent.click(screen.getByTestId('what-i-was-given-absent-show-all'))

    const capOffset = cold.brief_text.indexOf(B1_KEPT_CAP)
    expect(
      screen.getByTestId('what-i-was-given-absent').querySelector(`[data-char-offset="${capOffset}"]`),
      'the surviving cap must NOT appear in the absent group',
    ).toBeNull()
    expect(
      screen.getByTestId('what-i-was-given-kept').querySelector(`[data-char-offset="${capOffset}"]`),
    ).not.toBeNull()
  })

  it('summarises with a count, never with reassurance', () => {
    seedFrom(b1Fixture as never)
    render(<V7WhatIWasGivenSection />)
    const summary = screen.getByTestId('what-i-was-given-summary')
    expect(summary.textContent).toMatch(/\d+ of \d+ figures you stated are not in the model/)
  })
})

describe("the model's own declared exclusions — the sharpest loss class", () => {
  it("shows the dissenting proposal the trace graded SEVERE, in the model's words", () => {
    // B2 atom A21. The trace graded it SEVERE and noted `"Dana" 0 hits` in the
    // turn response — but the PERSISTED graph carries the model's own sentence
    // saying it excluded her option, and why. This is the plumbing that was
    // missing, and it covers the loss class a figure check cannot see.
    seedFrom(b2Fixture as never)
    render(<V7WhatIWasGivenSection />)
    openPanel()

    const list = screen.getByTestId('what-i-was-given-declared')
    expect(list.textContent).toContain(B2_DANA)
    // Verbatim: the model's reason travels with the claim, not our paraphrase.
    expect(list.textContent).toContain('excluded because')
  })

  it('says an EMPTY exclusion list is not evidence of a clean draft (B3)', () => {
    // B3 is the discriminator. Its coaching pass produced nothing, so it
    // reports no exclusions — on the brief the trace measured as losing 16 of
    // 26 atoms. Rendering that silence as "nothing was left out" would be the
    // surface at its most confident exactly where it is most wrong.
    seedFrom(b3Fixture as never)
    render(<V7WhatIWasGivenSection />)
    openPanel()

    expect(screen.queryByTestId('what-i-was-given-declared')).toBeNull()
    const note = screen.getByTestId('what-i-was-given-declared-unknown')
    expect(note.textContent).toContain('not the same as leaving nothing out')
    // ...while the figure half is still reporting heavy loss on this brief.
    expect(screen.getByTestId('what-i-was-given-absent')).toBeInTheDocument()
  })
})

describe('the caveat travels with the findings', () => {
  it('names the loss classes the check cannot see', () => {
    seedFrom(b1Fixture as never)
    render(<V7WhatIWasGivenSection />)
    openPanel()

    const caveat = screen.getByTestId('what-i-was-given-not-tracked')
    expect(caveat.textContent).toContain("colleagues' competing proposals")
    expect(caveat.textContent).toContain('corrections and second thoughts')
  })
})

describe('THE THREE ZEROS MUST NOT COLLAPSE', () => {
  it('no manifest at all (the live case today) says so explicitly', () => {
    // CEE has not deployed the field. The brief is on file; the manifest is
    // null. The surface must say "we cannot tell you" — not show an empty list,
    // and not stay silent, both of which read as "nothing was dropped".
    useContextIntegrityStore.getState().setContextIntegrity({
      scenarioId: 'a6ccf5cf-aab0-4f01-b889-e0d6c072067c',
      briefText: coldReadOf(b1Fixture as never).brief_text,
      manifest: null,
    })
    render(<V7WhatIWasGivenSection />)

    expect(screen.getByTestId('what-i-was-given-summary').textContent).toBe(
      'We cannot show what was left out',
    )
    openPanel()
    expect(screen.getByTestId('what-i-was-given-unknown').textContent).toContain(
      'nothing here should be read as "nothing was dropped"',
    )
    // The brief itself is still shown — the raw material is not in doubt.
    expect(screen.getByTestId('what-i-was-given-brief')).toBeInTheDocument()
    // And no findings groups exist to be mistaken for a clean bill of health.
    expect(screen.queryByTestId('what-i-was-given-absent')).toBeNull()
    expect(screen.queryByTestId('what-i-was-given-kept')).toBeNull()
  })

  it('an "unavailable" manifest renders as unknown, never as a zero tally', () => {
    const manifest = parseNotModelled({
      schema: 'not_modelled.v1',
      status: 'unavailable',
      unavailable_reason: 'no_brief_text',
      quantities: null,
      declared_exclusions: { status: 'not_recorded', items: [] },
      not_tracked: ['competing_or_dissenting_proposals'],
    })
    expect(manifest?.status).toBe('unavailable')
    expect(manifest?.quantities).toBeNull()

    useContextIntegrityStore.getState().setContextIntegrity({
      scenarioId: 'a6ccf5cf-aab0-4f01-b889-e0d6c072067c',
      briefText: 'We need £4m out by March 2027.',
      manifest,
    })
    render(<V7WhatIWasGivenSection />)
    expect(screen.getByTestId('what-i-was-given-summary').textContent).toBe(
      'We cannot show what was left out',
    )
  })

  it('a DERIVED manifest over a brief with no figures is the only zero allowed to reassure', () => {
    const manifest = parseNotModelled({
      schema: 'not_modelled.v1',
      status: 'derived',
      unavailable_reason: null,
      quantities: { total: 0, in_model: 0, prose_only: 0, absent: 0, truncated: false, items: [] },
      declared_exclusions: { status: 'none_reported', items: [] },
      not_tracked: ['competing_or_dissenting_proposals'],
    })
    useContextIntegrityStore.getState().setContextIntegrity({
      scenarioId: 'a6ccf5cf-aab0-4f01-b889-e0d6c072067c',
      briefText: 'Should I take the job or stay put?',
      manifest,
    })
    render(<V7WhatIWasGivenSection />)
    expect(screen.getByTestId('what-i-was-given-summary').textContent).toBe(
      '0 of 0 figures you stated are not in the model',
    )
  })

  it('renders nothing only when there is genuinely nothing on file', () => {
    render(<V7WhatIWasGivenSection />)
    expect(screen.queryByTestId('what-i-was-given-section')).toBeNull()
  })
})

// ── MOUNT PATH ──────────────────────────────────────────────────────────────

/**
 * `ResultsBody` renders `v7-top-group` unconditionally, and `V7TopMatter`
 * inside it returns null until analysis exists (`allOptions.length > 0`). This
 * is the repo's own harness for that component (`ResultsBody.v7TopMatter.spec`),
 * reused verbatim in shape so the mount proof is about the FLAG, not about a
 * bespoke data shape.
 */
function makeAnalysedData(): ResultsSectionDataReturn {
  const winner = {
    id: 'opt_a',
    label: 'Enter Germany in 2027',
    expected: 0.8,
    outcome: { mean: 0.8, p10: 0.6, p50: 0.78, p90: 0.95 },
    p10: 0.6,
    p50: 0.78,
    p90: 0.95,
    isRecommended: true,
    winProbability: 0.71,
  } as unknown as OptionResult
  const runnerUp = {
    id: 'opt_b',
    label: 'Double down on UK depth',
    isRecommended: false,
    winProbability: 0.29,
  } as unknown as OptionResult

  return {
    recommendation: {
      recommendedOption: winner,
      allOptions: [winner, runnerUp],
      goalLabel: 'Reach £20m ARR by FY28',
      goalText: 'Reach £20m ARR by FY28',
      goalThreshold: 0.6,
      isSingleOption: false,
      analysisStatus: 'computed',
      recommendationStability: 0.92,
      robustnessLevel: 'high',
      isNormalised: false,
    },
    drivers: {
      drivers: [],
      topDrivers: [],
      driversStatus: 'computed',
      totalCount: 0,
      hasMagnitudeData: false,
    },
    confidence: {
      tier: { tier: 'strong', icon: 'Check', label: 'Tier', description: 'd' },
      qualityScore: 80,
      uncertainties: [],
      topUncertainties: [],
      improvements: [],
      topImprovements: [],
      evidenceGaps: [],
      topEvidenceGaps: [],
      nextActions: [],
      topNextActions: [],
      challengeFragileEdges: [],
    },
    improvements: { improvements: [], count: 0, hasHighPriority: false },
    isLoading: false,
    isError: false,
    goalLabel: 'Reach £20m ARR by FY28',
    completeness: { status: 'full', missing: [], reasons: [] },
    autoNoiseProvenance: null,
  } as unknown as ResultsSectionDataReturn
}

function renderBody() {
  return render(
    <ResultsBody
      resultsSectionData={makeAnalysedData()}
      tornadoData={{ rows: [], expectedOutcome: null }}
      onSendMessage={() => {}}
      onFocusNode={() => {}}
    />,
  )
}

describe('MOUNT PATH — live under the DEPLOYED flag posture, and under its opposite', () => {
  beforeEach(() => {
    useCanvasStore.setState({
      analysisFreshness: { freshness: 'fresh', computedAt: '2026-08-08T00:00:00Z' },
      analysisFreshnessDirty: false,
    } as never)
    useUIStore.setState({ activeOutputTab: 'results', activeOutputTabVersion: 0 })
  })

  it('flag injection parity — localStorage "1" flips the REAL isAnalysisHeroPanelEnabled', () => {
    // Without this, the two posture tests below could both be exercising the
    // same code path and agreeing with each other (trap 13b).
    expect(isAnalysisHeroPanelEnabled()).toBe(false)
    localStorage.setItem('feature.analysisHeroPanel', '1')
    expect(isAnalysisHeroPanelEnabled()).toBe(true)
  })

  it('DEPLOYED POSTURE (analysisHeroPanel=1): the section mounts inside the unconditional group', () => {
    localStorage.setItem('feature.analysisHeroPanel', '1')
    seedFrom(b1Fixture as never)
    renderBody()

    expect(isAnalysisHeroPanelEnabled()).toBe(true)
    const section = screen.getByTestId('what-i-was-given-section')
    expect(section).toBeInTheDocument()
    // Assert the MOUNT PATH itself, not merely presence: the section must be
    // inside `v7-top-group`, which is the slot ResultsBody renders on BOTH
    // arms of the flag. Presence alone would still pass if a later change
    // re-hosted it onto the flag-on arm, which is how this estate shipped a
    // feature dark twice.
    expect(screen.getByTestId('v7-top-group').contains(section)).toBe(true)
  })

  it('OPPOSITE POSTURE (analysisHeroPanel=0): the section STILL mounts, in the same slot', () => {
    // The point of hosting in the unconditional group. If a future flag move
    // flips the deployed arm, this surface must not vanish with it.
    localStorage.setItem('feature.analysisHeroPanel', '0')
    seedFrom(b1Fixture as never)
    renderBody()

    expect(isAnalysisHeroPanelEnabled()).toBe(false)
    const section = screen.getByTestId('what-i-was-given-section')
    expect(section).toBeInTheDocument()
    expect(screen.getByTestId('v7-top-group').contains(section)).toBe(true)
  })

  it('CONTROL — the two postures really do render different heroes', () => {
    // Proves the flag injection reaches ResultsBody's fork, so the two tests
    // above are genuinely two postures and not the same render twice.
    localStorage.setItem('feature.analysisHeroPanel', '1')
    seedFrom(b1Fixture as never)
    const on = renderBody()
    const heroOn = on.container.querySelector('[data-testid="analysis-hero-panel"]')
    cleanup()

    localStorage.setItem('feature.analysisHeroPanel', '0')
    seedFrom(b1Fixture as never)
    const off = renderBody()
    const heroOff = off.container.querySelector('[data-testid="analysis-hero-panel"]')

    expect(heroOn, 'flag-on arm renders the hero panel').not.toBeNull()
    expect(heroOff, 'flag-off arm does not').toBeNull()
  })
})
