/**
 * The `est.` provenance tag — re-homed from the retired V7 evidence disclosure.
 *
 * ⭐ WHAT THIS IS FOR. Until this landed, the hero's driver rows had no
 * `isEstimate` concept at all: a number the PRODUCT estimated and a number the
 * USER supplied rendered identically. The tag marks the first kind. It is the
 * one trust claim in this disclosure, so it gets a spec of its own and the
 * wording is V7's, unchanged.
 *
 * ⭐⭐ AND THE PART THAT IS NOT A STRAIGHT PORT — §3, read it before touching
 * the derivation. V7 computed `isEstimate` as
 * `isDefaultedConfidence === true || valueDefaulted === true`, a BOOLEAN. That
 * expression is right about its TRUE arm and silently wrong about its FALSE
 * arm, because `DriverItem.valueDefaulted` is written under a strict
 * `typeof === 'boolean'` guard whose own comment in `useResultsSectionData`
 * says it "never coerce[s] an absent value → false". So V7's `false` conflated
 * "the producer says this is the user's number" with "the producer said
 * nothing".
 *
 * That is not hypothetical. §3.4 reads the committed LIVE CAPTURE
 * `src/v5/__tests__/fixtures/live-analysis-turn-T3-20260808T155759Z.json` and
 * pins what it actually contains: of six factor-sensitivity rows, three carry
 * `value_defaulted: true`, and the other three OMIT the field while carrying a
 * `value_source` — two of them `cee_inference`, i.e. values the product
 * inferred. Under V7's expression those two render with NO tag, which is
 * precisely the claim of user-authorship the tag exists to prevent.
 *
 * The model therefore keeps three states and this suite pins all three. The
 * SURFACE still renders the tag on `'estimated'` only — no new copy is authored
 * here, because a positive marker on producer silence would be the same defect
 * pointing the other way. What changed is that the model can no longer be READ
 * as a denial it never made, and the next lane that wants to say "you gave us
 * this" has a state to gate on instead of an absence to misread.
 *
 * CLAIM TYPE: rendered DOM presence in jsdom + pure mapper output. NOT a
 * visibility claim.
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { HeroEvidenceDisclosure } from '../HeroEvidenceDisclosure'
import { HERO_COPY } from '../heroCopy'
import { buildHeroModel } from '../buildHeroModel'
import { makeHeroData } from '../__fixtures__/hero.fixtures'
import { heroEvidenceModel as model, heroDriverRow } from '../__fixtures__/heroEvidenceModel'
import { openDisclosureHeader } from './helpers/heroEvidenceView'
import type { DriverItem } from '../../types'
import type { HeroChartModel } from '../heroTypes'
import type { ResultsSectionDataReturn } from '../../useResultsSectionData'
import liveTurn from '../../../../v5/__tests__/fixtures/live-analysis-turn-T3-20260808T155759Z.json'

// ─── § 1 · the rendered tag ─────────────────────────────────────────────────

describe('§1 the est. tag renders on an estimated driver, and only on one', () => {
  /**
   * All three provenance states in ONE render, each on a row identified by its
   * own LABEL. Binding by label rather than by row index is the point
   * (CLAUDE.md trap 19): with one estimated row among three, an assertion that
   * merely counted tags would still pass if the tag moved to the wrong row.
   */
  const THREE_STATES = [
    heroDriverRow('estimated', { rank: 1, label: 'Price', targetId: null }),
    heroDriverRow('not_estimated', { rank: 2, label: 'Demand', targetId: null }),
    heroDriverRow('undetermined', { rank: 3, label: 'Cost', targetId: null }),
  ]

  it('§1.1 renders exactly one tag, carrying V7’s wording', () => {
    render(<HeroEvidenceDisclosure evidence={model({ drivers: THREE_STATES })} />)
    openDisclosureHeader()

    const tags = screen.getAllByTestId('hero-driver-est')
    expect(tags).toHaveLength(1)
    expect(tags[0]).toHaveTextContent(HERO_COPY.evidence.estimateTag)
    expect(HERO_COPY.evidence.estimateTag).toBe('est.')
  })

  it('§1.2 the tag sits on the ESTIMATED row, not merely somewhere on screen', () => {
    render(<HeroEvidenceDisclosure evidence={model({ drivers: THREE_STATES })} />)
    openDisclosureHeader()

    // The row body is the span that carries the label; the tag is its child.
    const estimatedRow = screen.getByText('Price').parentElement
    const notEstimatedRow = screen.getByText('Demand').parentElement
    const undeterminedRow = screen.getByText('Cost').parentElement

    expect(estimatedRow?.querySelector('[data-testid="hero-driver-est"]')).not.toBeNull()
    expect(notEstimatedRow?.querySelector('[data-testid="hero-driver-est"]')).toBeNull()
    expect(undeterminedRow?.querySelector('[data-testid="hero-driver-est"]')).toBeNull()
  })

  it('§1.3 carries an accessible name, so the tag is not glyph-only', () => {
    render(<HeroEvidenceDisclosure evidence={model({ drivers: THREE_STATES })} />)
    openDisclosureHeader()
    expect(screen.getByLabelText(HERO_COPY.evidence.estimateTagAria)).toBeInTheDocument()
    expect(HERO_COPY.evidence.estimateTagAria).toBe('estimated value')
  })

  it('§1.4 NEITHER non-estimated state renders a tag (both directions, one render)', () => {
    render(
      <HeroEvidenceDisclosure
        evidence={model({
          drivers: [
            heroDriverRow('not_estimated', { rank: 1, label: 'Demand' }),
            heroDriverRow('undetermined', { rank: 2, label: 'Cost' }),
          ],
        })}
      />,
    )
    openDisclosureHeader()
    expect(screen.queryAllByTestId('hero-driver-est')).toHaveLength(0)
    // Positive control: the rows themselves DID render, so the absence above is
    // an absence of tags and not an absence of drivers (trap 13).
    expect(screen.getByText('Demand')).toBeInTheDocument()
    expect(screen.getByText('Cost')).toBeInTheDocument()
  })
})

// ─── § 2 · the producer read, through the real mapper ───────────────────────

/** A driver row shaped like the ones `useResultsSectionData` builds. */
function driver(label: string, provenance: Partial<DriverItem>): DriverItem {
  return {
    factorKey: `fac_${label.toLowerCase().replace(/\s+/g, '_')}`,
    factorLabel: label,
    rawElasticity: 0.8,
    normalisedInfluence: 1,
    rank: 1,
    semanticLabel: 'strongest',
    canFocus: false,
    ...provenance,
  } as unknown as DriverItem
}

/**
 * ⚠⚠ §2 WAS REWRITTEN WHEN THE DERIVATION MOVED TO THE NODE. It used to drive
 * `isEstimate` from `isDefaultedConfidence` / `valueDefaulted` on the factor
 * ROW. Those are producer booleans about the CONFIDENCE and about defaulting —
 * neither answers who authored the value, and the first is ISL bootstrap
 * degeneracy. On the very capture §3 below reads, `fac_switch_cost` carries
 * `value_source: 'brief_extraction'` with `sampling_stability: 0`, so the old
 * expression tagged a figure taken from the USER'S OWN BRIEF as Olumi's
 * estimate. The authority is the node's `observed_state.source`.
 *
 * §3 is untouched and still passes: it pins what the WIRE contains, which is a
 * historic record, not a claim about this derivation.
 */
function provenanceOf(
  drivers: DriverItem[],
  sources: Record<string, string> = {},
): Array<string> {
  const data = { ...makeHeroData({ drivers: { drivers, topDrivers: drivers } }) } as ResultsSectionDataReturn
  const m = buildHeroModel(data, undefined, undefined, new Map(Object.entries(sources)))
  expect(m.kind, 'fixture must produce a chart model, else every assertion below is vacuous').toBe('chart')
  return (m as HeroChartModel).evidence.drivers.map((d) => d.isEstimate)
}

describe('§2 buildHeroModel derives value provenance from the NODE that owns the value', () => {
  it('§2.1 a value the product inferred => estimated', () => {
    expect(provenanceOf([driver('Alpha', {})], { fac_alpha: 'cee_inference' })).toEqual(['estimated'])
  })

  it('§2.2 ⭐ a value the user owns => not_estimated, and never wears the tag', () => {
    expect(provenanceOf([driver('Beta', {})], { fac_beta: 'user_confirmed' })).toEqual([
      'not_estimated',
    ])
    expect(provenanceOf([driver('Beta', {})], { fac_beta: 'user_override' })).toEqual([
      'not_estimated',
    ])
  })

  it('§2.3 ⭐ brief extraction => undetermined — neither claim, pending the ruling', () => {
    // `brief_extraction` is deliberately NOT in `USER_OWNED_KINDS`: extraction
    // from the user's brief is not the user stating a figure, and it is not the
    // product inventing one. No tag, and no counter-claim either.
    expect(provenanceOf([driver('Gamma', {})], { fac_gamma: 'brief_extraction' })).toEqual([
      'undetermined',
    ])
  })

  it('§2.4 no source on the node => undetermined, never a denial', () => {
    expect(provenanceOf([driver('Delta', {})], {})).toEqual(['undetermined'])
  })

  it('§2.5 a literal the shared classifier does not know => undetermined', () => {
    // It is reported as a finding, never patched into the contract's map here.
    expect(provenanceOf([driver('Epsilon', {})], { fac_epsilon: 'some_future_literal' })).toEqual([
      'undetermined',
    ])
  })

  it('§2.6 ⭐⭐ THE DEFECT THIS CLOSES — the degeneracy signal no longer speaks', () => {
    // Both row booleans say "estimated" under the OLD expression. The node says
    // the user confirmed the number. The user wins, because the node is the
    // only field that answers authorship.
    expect(
      provenanceOf(
        [driver('Switch cost', { isDefaultedConfidence: true, valueDefaulted: true })],
        { fac_switch_cost: 'user_confirmed' },
      ),
    ).toEqual(['not_estimated'])
    // And with no node source the same row is undetermined, not estimated —
    // the degeneracy booleans cannot manufacture a tag on their own.
    expect(
      provenanceOf([driver('Switch cost', { isDefaultedConfidence: true, valueDefaulted: true })], {}),
    ).toEqual(['undetermined'])
  })

  it('§2.7 ⭐ THE DISCRIMINATING PAIR — two named ids, opposite directions, one payload', () => {
    // Bound by id, never by "some driver shows estimated" (trap 19). A rule
    // that blanket-returned `undetermined` fails on Two; one that
    // blanket-returned `estimated` fails on One. Only a rule that reads each
    // node's own source passes both.
    expect(
      provenanceOf(
        [driver('Switch cost', {}), driver('Crm capability', {})],
        { fac_switch_cost: 'brief_extraction', fac_crm_capability: 'cee_inference' },
      ),
    ).toEqual(['undetermined', 'estimated'])
  })

  it('§2.8 provenance is PER ROW — a mixed set does not smear', () => {
    expect(
      provenanceOf([driver('One', {}), driver('Two', {}), driver('Three', {})], {
        fac_one: 'cee_inference',
        fac_two: 'user_confirmed',
      }),
    ).toEqual(['estimated', 'not_estimated', 'undetermined'])
  })
})

// ─── § 3 · the premise, measured on a committed live capture ────────────────

describe('§3 the live wire really does omit value_defaulted (the premise, not an assumption)', () => {
  /**
   * ⚠ A FIXTURE YOU WROTE YOURSELF IS NOT EVIDENCE ABOUT THE WIRE (CLAUDE.md
   * trap 16). §2 above is a mapper spec over rows this file authored; it can
   * only show the mapper is faithful to a shape, never that the shape occurs.
   * These read a CAPTURE — a dated, committed live analysis turn — and pin the
   * producer behaviour the three-state model exists for.
   *
   * ⚠ HISTORIC RECORD, NOT A FIXTURE TO KEEP CURRENT (CLAUDE.md 14b). The JSON
   * below is a record of bytes a real run produced on 2026-08-08. If a future
   * producer change makes these assertions fail, the correct response is a NEW
   * dated capture and a re-derived claim — never an edit to that file.
   */
  const rows = (liveTurn as unknown as {
    blocks: Array<{ enrichment?: { factor_sensitivity?: Array<Record<string, unknown>> } }>
  }).blocks
    .flatMap((b) => b.enrichment?.factor_sensitivity ?? [])

  it('§3.1 the capture actually carries factor rows (else §3.2-3.4 are vacuous)', () => {
    expect(rows.length).toBeGreaterThan(0)
  })

  it('§3.2 value_defaulted appears ONLY as true — the producer never sends false', () => {
    const present = rows
      .map((r) => r.value_defaulted)
      .filter((v) => v !== undefined)
    expect(present.length).toBeGreaterThan(0)
    expect(present.every((v) => v === true)).toBe(true)
  })

  it('§3.3 some rows OMIT value_defaulted entirely — absence is the common case', () => {
    const absent = rows.filter((r) => r.value_defaulted === undefined)
    expect(absent.length).toBeGreaterThan(0)
  })

  it('§3.4 at least one omitting row is a value the PRODUCT inferred (cee_inference)', () => {
    // The load-bearing one. A row with no `value_defaulted` and
    // `value_source: 'cee_inference'` is a number the product invented — and
    // under V7's boolean it rendered with no tag, indistinguishable from a
    // number the user supplied. It is `undetermined` here, not `not_estimated`.
    const inferred = rows.filter(
      (r) => r.value_defaulted === undefined && r.value_source === 'cee_inference',
    )
    expect(
      inferred.length,
      'the capture must contain a product-inferred value with no value_defaulted flag, ' +
        'or the three-state model has no measured motivation in this repo',
    ).toBeGreaterThan(0)
  })
})
