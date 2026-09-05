/**
 * THE LIVE LEADER CONTRADICTION — Analysis-tab prose.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WITNESSED, NOT INFERRED
 * ═══════════════════════════════════════════════════════════════════════════
 * A fresh typed brief produced an auto-run analysis. In ONE panel the product
 * rendered, a few lines apart:
 *
 *   footer  "Leading option not assessed"                       ← the withholding
 *   prose   "If the estimate changes for Technical Leadership
 *            Capacity, THE LEADING OPTION could change."        ← names one
 *   prose   "If Technical Leadership Capacity shifts, Two
 *            Mid-Level Developers at £70k Each COULD GAIN
 *            GROUND."                                           ← names one
 *
 * Two references to a leader on a run that withheld one, in the same panel as
 * the withholding.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHY THE EXISTING GUARD DID NOT SEE IT
 * ═══════════════════════════════════════════════════════════════════════════
 * `withheldProse.spec.tsx` is a good guard whose SURFACE LIST is short. It
 * covers the flip-threshold status note, the stress-test patterns and
 * `certaintyCopy`; `analysis-hero/__tests__/withheldProse.hero.spec.tsx`
 * covers `HERO_COPY.evidence.flipRisksNote`. Neither reaches
 * `rankActOnItRows` or `TriageActionCardsBody`'s two nudges — the three
 * defective sites — so all three consulted the leader authority ZERO times.
 * That is CLAUDE.md trap 12d: derivation proves the copies agree, only a
 * corpus notices the list is short.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHAT THIS FILE COVERS, AND WHAT IT DOES NOT
 * ═══════════════════════════════════════════════════════════════════════════
 * Here: the claim-policy lattice (§1), `TriageActionCardsBody`'s two nudges
 * (§3, §4), the COMPOSED panel that reproduces the witness (§5) and SURFACE D,
 * `ConditionalWinnerCards` (§6).
 * NOT here: SURFACE A, `rankActOnItRows` — see
 * `analysis-hero/actOnIt/__tests__/actOnItLeaderClaim.spec.ts` and the import
 * note below for why it cannot live in this file.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * BOTH DIRECTIONS, IN THE SAME FILE
 * ═══════════════════════════════════════════════════════════════════════════
 * One control cannot cover two opposite defects. Over-suppression — a panel
 * that goes quiet on a run that licensed the claim — is how this seam has been
 * broken before, and it is a worse product than the contradiction. Every
 * withheld arm below has a `comparative_leader` twin asserting the sentence
 * STILL APPEARS, and a DATA-SURVIVES arm asserting the finding itself (the
 * fragile factor, the dominant factor, the Validate action) is untouched.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * SCOPE (CLAUDE.md trap 3)
 * ═══════════════════════════════════════════════════════════════════════════
 * jsdom proves rendered text, presence and absence. Nothing here claims a
 * layout, an order or a visual property. Nothing here claims anything about
 * the Canvas or Compare surfaces, which are a different lane on a different
 * data path.
 */
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TriageActionCardsBody } from '../TriageActionCardsBody'
import {
  analysisClaimPolicy,
  leaderClaimWithheld,
} from '../analysisClaimPolicy'
import { licensesComparativeLeaderClaim } from '../../../canvas/hooks/useAnalysisReady'
// ⚠ SURFACE A (`rankActOnItRows`) IS NOT TESTED HERE, and it is not an
// oversight. `analysis-hero/__tests__/inertness.spec.ts` permits only
// `ResultsBody` to import under `analysis-hero/`, and it caught this file's
// first draft doing exactly that. Its arms live in
// `analysis-hero/actOnIt/__tests__/actOnItLeaderClaim.spec.ts`; the fixture is
// shared below so both halves describe the same run.
import {
  ALT_LABEL,
  FACTOR_LABEL,
  LEADER_CLAIM_RE,
  LOW_BUCKET_LABEL,
  PERMITTED,
  SPLIT_VALUE,
  WITHHELD,
  admission,
} from '../__fixtures__/leaderClaim.fixtures'
import type { PermittedAnalysisMode } from '../../../adapters/cee/types'
import type { ResultsSectionDataReturn } from '../useResultsSectionData'

/** Visible text of a subtree PLUS every `title` and `aria-label` inside it. */
function allText(root: Element): string {
  const attrs = [...root.querySelectorAll('[title], [aria-label]')]
    .flatMap((el) => [el.getAttribute('title'), el.getAttribute('aria-label')])
    .filter((v): v is string => typeof v === 'string')
  return [root.textContent ?? '', ...attrs].join(' ')
}

/**
 * The composed panel, split into the two things §5 must weigh against each
 * other: the FOOTER (where the withholding is stated) and the PROSE (every
 * other sentence on the panel).
 *
 * ⚠ TWO HARNESS DEFECTS WERE FOUND HERE, BOTH BY THE RED, AND BOTH WORTH
 * RECORDING BECAUSE EITHER WOULD HAVE PRODUCED A CONFIDENT WRONG ANSWER.
 *
 * 1. `textContent` alone is BLIND TO SURFACE C. The dominant nudge's leader
 *    sentence lives only in its `title` and `aria-label`, so a text-only sweep
 *    read the withheld panel as clean while the claim sat in the tooltip a
 *    user hovers and a screen reader announces. An absence assertion is only
 *    as wide as what it can see.
 *
 * 2. The footer must be EXCLUDED from the claim sweep, and this is not a
 *    convenience. "Leading option not assessed" is the WITHHOLDING — the
 *    correct sentence, the one whose presence proves the panel is in the state
 *    under test — and it contains the substring the matcher hunts. Sweeping it
 *    would make `toContain('Leading option not assessed')` and
 *    `not.toMatch(LEADER_CLAIM_RE)` mutually unsatisfiable, so the arm could
 *    only ever be passed by DELETING the withholding: a guard that can only be
 *    satisfied by removing the honest half of the panel.
 *
 * The exclusion is scoped by IDENTITY (`t1-checks-footer`), and §0 asserts the
 * footer's own content directly, so nothing inside it goes unexamined.
 */
function renderPanel(data: ResultsSectionDataReturn): { footer: string; prose: string } {
  const { container } = render(
    <TriageActionCardsBody data={data} useV17Copy onFocusNode={() => {}} />,
  )
  const footerEl = container.querySelector('[data-testid="t1-checks-footer"]')
  expect(footerEl, 'the checks footer never rendered — §5 would be vacuous').not.toBeNull()
  // ⚠ SPLIT ON A CLONE, NEVER ON THE LIVE TREE. Removing a node React owns
  // makes its unmount throw `NotFoundError` — which surfaced as four failing
  // §5 arms that had nothing to do with the product. A harness that edits the
  // DOM under React is measuring its own damage.
  const clone = container.cloneNode(true) as Element
  clone.querySelector('[data-testid="t1-checks-footer"]')!.remove()
  return { footer: allText(footerEl!), prose: allText(clone) }
}

// ── §0 PRECONDITION PINS ────────────────────────────────────────────────────

describe('§0 PRECONDITION PINS — the fixtures reproduce the witnessed states', () => {
  it('the withheld fixture is the state that renders "Leading option not assessed"', () => {
    // Bound to the FOOTER, not to a boolean I set myself: the withholding the
    // user saw and the prose under test must come from one render.
    render(<TriageActionCardsBody data={WITHHELD()} useV17Copy onFocusNode={() => {}} />)
    expect(screen.getByTestId('checks-winner').textContent ?? '')
      .toContain('Leading option not assessed')
  })

  it('the permitted fixture renders the AFFIRMATIVE footer — the two arms really differ', () => {
    render(<TriageActionCardsBody data={PERMITTED()} useV17Copy onFocusNode={() => {}} />)
    expect(screen.getByTestId('checks-winner').textContent ?? '')
      .toContain('Has leading option')
  })

  it('the matcher is not vacuous — it matches the two witnessed sentences verbatim', () => {
    expect(
      `If the estimate changes for ${FACTOR_LABEL}, the leading option could change.`,
    ).toMatch(LEADER_CLAIM_RE)
    expect(`If ${FACTOR_LABEL} shifts, ${ALT_LABEL} could gain ground.`)
      .toMatch(LEADER_CLAIM_RE)
    // CONTRAST: the sentences that should SURVIVE a withheld run must not be
    // caught by the matcher, or every suppression arm passes for the wrong
    // reason.
    expect(`If the estimate changes for ${FACTOR_LABEL}, the result could change.`)
      .not.toMatch(LEADER_CLAIM_RE)
    expect(FACTOR_LABEL).not.toMatch(LEADER_CLAIM_RE)
    expect(ALT_LABEL).not.toMatch(LEADER_CLAIM_RE)
  })
})

// ── §1 THE READER ───────────────────────────────────────────────────────────

describe('§1 analysisClaimPolicy — THREE answers, driven from the lattice', () => {
  /**
   * ⚠ THE COMPOSED FIELD IS DERIVED HERE, NOT HAND-SET, AND THE FIRST DRAFT OF
   * THIS FILE GOT IT WRONG — usefully.
   *
   * It set `leaderDesignationPermitted: true` for every mode, which is a state
   * the producer CANNOT emit: `useResultsSectionData` composes that field as
   * `licensesComparativeLeaderClaim(admission) && verdict.hasLeadingOption`.
   * A fixture that pairs `mode: 'none'` with a permitted composed field is
   * fiction, and a table built on it would have "proved" the module wrong for
   * three of four rows.
   *
   * So the fixture calls the PRODUCER'S OWN predicate rather than encoding my
   * reading of it (CLAUDE.md trap 16-inverse: a fixture you wrote yourself is
   * not evidence about the wire). `hasLeadingOption` is held TRUE across every
   * row, so the leader column below varies with the LATTICE alone — which is
   * the property the table is for.
   */
  const rec = (mode: PermittedAnalysisMode | undefined) => {
    const a = mode ? admission(mode) : undefined
    return {
      analysisAdmission: a,
      leaderDesignationPermitted: licensesComparativeLeaderClaim(a) && true,
      verdict: { hasLeadingOption: true },
    }
  }

  /**
   * ⭐ THE WHOLE POINT OF THE MODULE IS IN THIS TABLE. If the three columns
   * were ever equal for every row, one boolean would do and the module would
   * be ceremony. `quantified_provisional` is the row that proves otherwise:
   * figures licensed, leader and stability not.
   */
  it.each([
    // mode                        figures  leader  stability
    ['none', false, false, false],
    ['exploratory', false, false, false],
    ['quantified_provisional', true, false, false],
    ['comparative_leader', true, true, true],
  ] as const)(
    '%s → figures=%s leader=%s stability=%s',
    (mode, figures, leader, stability) => {
      const p = analysisClaimPolicy(rec(mode))
      expect(p.mayShowComparativeFigures).toBe(figures)
      expect(p.mayNameOrRankLeader).toBe(leader)
      expect(p.mayStateStability).toBe(stability)
    },
  )

  it('THE THREE ANSWERS ARE NOT ONE — quantified_provisional separates them', () => {
    // Stated as its own assertion so a refactor that folds the three fields
    // into one value REDs here by name, not just somewhere in the table.
    const p = analysisClaimPolicy(rec('quantified_provisional'))
    expect(p.mayShowComparativeFigures).not.toBe(p.mayNameOrRankLeader)
    expect(p.mayShowComparativeFigures).not.toBe(p.mayStateStability)
  })

  it('ABSENT ADMISSION keeps today\'s behaviour on both lattice-only answers', () => {
    // A pre-admission CEE has not spoken. Defaulting these to false would blank
    // every legacy payload — the arm that makes this consumer safe to land
    // before the producer half.
    const p = analysisClaimPolicy(rec(undefined))
    expect(p.mayShowComparativeFigures).toBe(true)
    expect(p.mayStateStability).toBe(true)
  })

  it('the LEADER answer keeps its tri-state — no authority at all is not a denial', () => {
    // Quoted from `leaderDesignationPermitted`, whose absence arms are
    // deliberately opposite to Q1's. Coercing this to a boolean re-opens the
    // regression that module's header records.
    expect(analysisClaimPolicy({}).mayNameOrRankLeader).toBeUndefined()
    expect(analysisClaimPolicy(null).mayNameOrRankLeader).toBeUndefined()
    expect(leaderClaimWithheld({})).toBe(false)
    expect(leaderClaimWithheld(null)).toBe(false)
  })

  it('the LEADER answer is the COMPOSED one — a licensing mode does not override this result', () => {
    // `comparative_leader` + a result that did not separate the arms is still
    // withheld. Reading the lattice alone here would re-open the defect
    // `leaderDesignation.ts` exists to close.
    const p = analysisClaimPolicy({
      analysisAdmission: admission('comparative_leader'),
      leaderDesignationPermitted: false,
      verdict: { hasLeadingOption: false },
    })
    expect(p.mayNameOrRankLeader).toBe(false)
    expect(p.mayShowComparativeFigures).toBe(true) // …and the figures survive it
  })
})

// ── §3 SURFACE B — the T1 flip-risk callout ─────────────────────────────────

describe('§3 SURFACE B — the T1 flip-risk callout', () => {
  it('ANTI-VACUITY: the PERMITTED run renders the comparative claim and its number', () => {
    render(<TriageActionCardsBody data={PERMITTED()} useV17Copy onFocusNode={() => {}} />)
    const t = screen.getByTestId('t1-flip-risk-callout').textContent ?? ''
    expect(t).toContain('could overtake')
    expect(t).toContain(ALT_LABEL)
    expect(t).toContain('57% probability')
  })

  it('WITHHELD: the callout still renders, and claims no leader', () => {
    render(<TriageActionCardsBody data={WITHHELD()} useV17Copy onFocusNode={() => {}} />)
    // Bound to the element, so a suppression that DELETED the callout would
    // fail here rather than pass the absence assertion below by vanishing.
    const t = screen.getByTestId('t1-flip-risk-callout').textContent ?? ''
    expect(t).not.toMatch(LEADER_CLAIM_RE)
  })

  it('WITHHELD: the switch PERCENTAGE goes with the verb — it is a claim, not data', () => {
    // `switch_probability` means P(the alternative OVERTAKES). Printed without
    // that verb it is a number saying more than its own sentence — the rule
    // this callout's own comment already states for the attested-no-flip arm.
    render(<TriageActionCardsBody data={WITHHELD()} useV17Copy onFocusNode={() => {}} />)
    const t = screen.getByTestId('t1-flip-risk-callout').textContent ?? ''
    expect(t).not.toContain('57% probability')
    expect(t).not.toMatch(/\d+\s*%/)
  })

  it('WITHHELD DATA SURVIVES: the fragile factor and its Validate action remain', () => {
    render(<TriageActionCardsBody data={WITHHELD()} useV17Copy onFocusNode={() => {}} />)
    const t = screen.getByTestId('t1-flip-risk-callout').textContent ?? ''
    expect(t).toContain(FACTOR_LABEL)
    expect(t).toContain(`Validate ${FACTOR_LABEL}`)
  })
})

// ── §4 SURFACE C — the T1 dominant-factor nudge ─────────────────────────────

describe('§4 SURFACE C — the T1 dominant-factor nudge', () => {
  const nudgeText = (data: ResultsSectionDataReturn) => {
    render(<TriageActionCardsBody data={data} useV17Copy onFocusNode={() => {}} />)
    const el = screen.getByTestId('t1-dominant-nudge')
    // The claim lives in the tooltip/aria long form, not only in the visible
    // row — assert against BOTH so a suppression cannot hide in the attribute.
    return `${el.textContent ?? ''} ${el.getAttribute('title') ?? ''} ${el.getAttribute('aria-label') ?? ''}`
  }

  it('ANTI-VACUITY: the PERMITTED run says "the leading option could change"', () => {
    expect(nudgeText(PERMITTED())).toContain('the leading option could change')
  })

  it('WITHHELD: the nudge claims no leader', () => {
    expect(nudgeText(WITHHELD())).not.toMatch(LEADER_CLAIM_RE)
  })

  it('WITHHELD DATA SURVIVES: the dominant factor is still named and still warned about', () => {
    const t = nudgeText(WITHHELD())
    expect(t).toContain(FACTOR_LABEL)
    expect(t).toContain('the result could change')
  })
})

// ── §5 THE COMPOSED PANEL — the defect as the user met it ───────────────────

describe('§5 COMPOSED — the withholding and the claim cannot share a panel', () => {
  /**
   * ⭐ THE ARM THAT REPRODUCES THE WITNESS. Every §2-§4 case above is a
   * component test and could, individually, be pointed at a surface the panel
   * does not mount (CLAUDE.md trap 3b — a green suite about a component the
   * deployment does not render). This one asserts the CONTRADICTION itself: the
   * withholding string and the leader claim, in one composed render.
   */
  it('WITHHELD: the panel states the withholding and makes NO leader claim anywhere', () => {
    const { footer, prose } = renderPanel(WITHHELD())
    expect(footer, 'the withholding must be on screen, or this arm proves nothing')
      .toContain('Leading option not assessed')
    expect(prose).not.toMatch(LEADER_CLAIM_RE)
  })

  it('OPPOSITE DIRECTION: a licensed run keeps BOTH witnessed sentences', () => {
    const { footer, prose } = renderPanel(PERMITTED())
    expect(prose).toContain('could overtake')
    expect(prose).toContain('57% probability')
    expect(prose).toContain('the leading option could change')
    expect(footer).toContain('Has leading option')
  })

  it('WITHHELD: the panel is not silent — every finding still reaches the user', () => {
    // Over-suppression is the opposite defect and it is a worse product. The
    // fragile factor, its Validate route and the dominant warning all survive a
    // withheld run.
    const { prose } = renderPanel(WITHHELD())
    expect(prose).toContain(FACTOR_LABEL)
    expect(prose).toContain(`Validate ${FACTOR_LABEL}`)
    expect(prose).toContain('Dominant factor')
    expect(prose).toContain('the result could change')
  })

  /**
   * ⭐ THE EXCLUSION IS NOT A HOLE. §0 reads the footer directly; this arm
   * proves the two halves are genuinely different text, so the split cannot be
   * quietly hiding a claim by putting the whole panel on the wrong side of it.
   */
  it('the footer/prose split is real — each half carries what it is asked about', () => {
    const { footer, prose } = renderPanel(WITHHELD())
    expect(footer).toContain('What we checked')
    expect(prose).not.toContain('What we checked')
    expect(prose).toContain(FACTOR_LABEL)
  })
})

// ── §6 SURFACE D — the conditional-winner cards ─────────────────────────────

/**
 * ⭐ THE FOURTH SURFACE, AND IT WAS INSIDE THE FILE THE FIX ALREADY EDITED.
 *
 * `ConditionalWinnerCards` is mounted from `TriageActionCardsBody` gated on
 * NOTHING but array length. A cold review rendered the WITHHELD fixture above
 * with `conditionalWinners` populated and nothing else changed, and got the
 * witnessed defect's exact shape back:
 *
 *   footer  "Leading option not assessed"
 *   prose   "When Technical Leadership Capacity exceeds 3, Two Mid-Level
 *            Developers at £70k Each LEADS INSTEAD."
 *   prose   "Above: Two Mid-Level Developers at £70k Each (61%)"
 *
 * ⚠ TWO INDEPENDENT REASONS §5 PASSED OVER IT, AND BOTH ARE CLOSED HERE,
 * BECAUSE CLOSING ONE WOULD LEAVE THE GUARD AGREEING WITH ITSELF FOR A NEW
 * REASON.
 *   1. `LEADER_CLAIM_RE` carried no `leads`, so the sweep returned FALSE about
 *      the very sentence it was pointed at. Measured: adding `leads instead`
 *      to the matcher alone, with the product code untouched, flips §5's
 *      withheld arm GREEN → RED. Its green was vacuous.
 *   2. The fixtures never populated `conditionalWinners`, so §5 asserted "no
 *      leader claim anywhere" over a panel on which the card never mounted.
 *      It is populated on BOTH arms now.
 *
 * ⚠ AND THE ASSERTIONS BELOW DO NOT REST ON THE MATCHER. A regex over rendered
 * prose is a lexical tripwire whose bound is declared in the fixture; what
 * BINDS here is IDENTITY — the option LABELS must not appear in the withheld
 * panel at all (CLAUDE.md trap 19). The two catch different rewordings and
 * neither subsumes the other, so both are asserted.
 *
 * The remedy is the one `crossSurfaceCoherence.ts` already adjudicated for
 * this pair (CX4, `suppress_at_consumer`): STRIP THE NAME, NEVER THE ROW. So
 * every withheld arm below has a twin asserting the row's INFORMATION —
 * the factor, the split value, both bucket probabilities — is still on screen.
 * A suppression that deleted the card passes the absence assertions and fails
 * these.
 */
describe('§6 SURFACE D — ConditionalWinnerCards honours the leader claim', () => {
  const cardOf = (data: ResultsSectionDataReturn) => {
    const { container } = render(
      <TriageActionCardsBody data={data} useV17Copy onFocusNode={() => {}} />,
    )
    const card = container.querySelector('[data-testid="conditional-winner-cards"]')
    // Bound to the ELEMENT. A suppression that unmounted the card would fail
    // HERE rather than pass every absence assertion below by vanishing — the
    // over-suppression failure, which is the worse defect of the two.
    expect(card, 'the conditional card never mounted — every §6 arm would be vacuous')
      .not.toBeNull()
    return { card: card!, text: allText(card!) }
  }

  it('ANTI-VACUITY: the PERMITTED run names the winner and states the direction', () => {
    const { card, text } = cardOf(PERMITTED())
    // The exact sentence the withheld arm must NOT produce. If this ever stops
    // rendering, the arm below is passing because the product went quiet.
    expect(text).toContain(`${ALT_LABEL} leads instead`)
    expect(text).toContain(`Above: ${ALT_LABEL} (61%)`)
    expect(text).toContain(`Below: ${LOW_BUCKET_LABEL} (55%)`)
    expect(card.querySelector('[data-cw-arm]')?.getAttribute('data-cw-arm')).toBe('high-alt')
  })

  it('WITHHELD: the card names NO option — by identity, not only by matcher', () => {
    const { card, text } = cardOf(WITHHELD())
    // IDENTITY (trap 19): the option labels themselves, which no rewording can
    // dodge while still designating a winner.
    expect(text).not.toContain(ALT_LABEL)
    expect(text).not.toContain(LOW_BUCKET_LABEL)
    // The verb phrase, and the matcher, as a second and independent net.
    expect(text).not.toContain('leads instead')
    expect(text).not.toMatch(LEADER_CLAIM_RE)
    // The DIRECTION is a designation too — "exceeds" vs "falls below" says
    // which side the recommended option is on, which presupposes one.
    expect(card.querySelector('[data-cw-arm]')?.getAttribute('data-cw-arm')).toBe('neutral')
  })

  it('WITHHELD DATA SURVIVES: the row, the split value and BOTH probabilities stay', () => {
    // CX4's remedy in one assertion: strip the NAME, never the row. Delete the
    // card instead of stripping it and this REDs while the arm above still
    // passes — which is why the two must both exist.
    const { text } = cardOf(WITHHELD())
    expect(text).toContain('Conditional scenarios')
    expect(text).toContain(FACTOR_LABEL)
    expect(text).toContain(`flips at ${SPLIT_VALUE}`)
    expect(text).toContain('Above: 61%')
    expect(text).toContain('Below: 55%')
  })

  it('WITHHELD: the composed panel states the withholding and SURFACE D agrees with it', () => {
    // §5's arm, re-asserted now that the card actually mounts on it. This is
    // the arm that was green for two wrong reasons before.
    const { footer, prose } = renderPanel(WITHHELD())
    expect(footer).toContain('Leading option not assessed')
    expect(prose).toContain('Conditional scenarios')
    expect(prose).not.toMatch(LEADER_CLAIM_RE)
    expect(prose).not.toContain(ALT_LABEL)
  })
})

// ── §7 THE CHECKS FOOTER — an affirmative DENIAL needs its own licence ───────

/**
 * ⭐ THE SAME CLASS, POINTING THE OTHER WAY, AND IT IS PRE-EXISTING.
 *
 * §3-§6 are about the panel CLAIMING a leader it may not name. This is about
 * the panel DENYING one it has no authority to deny. `TriageActionCardsBody`'s
 * own comment states the rule — *"'unknown' licenses silence, never a denial"*,
 * with the denial licensed for `separation === 'tied'` ONLY — and then
 * implements it as `separation === 'unknown'`, which is the state that produced
 * the rule rather than the rule itself (CLAUDE.md trap 13d: write the invariant
 * against the SPEC, never against the failure mode you came in on).
 *
 * A MODE-withheld run walks past that: `quantified_provisional` licenses the
 * figures and not the leader, so `hasWinner` (which reads the COMPOSED answer)
 * is false while `separation` is `'clear'` — and the footer rendered
 * "No clear leader", a FINDING the run never produced.
 *
 * ⚠ NOTE WHICH FIXTURE THIS NEEDS. WITHHELD() cannot see it: its separation is
 * already `'unknown'`, so the old predicate is right about it for the wrong
 * reason. The state that discriminates is `'clear'` separation with the leader
 * withheld by the LATTICE — which is exactly the row §1 uses to prove the three
 * answers are not one.
 */
describe('§7 the checks footer denies a leader only when licensed to', () => {
  /** A run the MODE withholds: figures licensed, leader not, arms separated. */
  const modeWithheld = (): ResultsSectionDataReturn => {
    const d = PERMITTED() as unknown as { recommendation: Record<string, unknown> }
    d.recommendation.leaderDesignationPermitted = false
    d.recommendation.analysisAdmission = admission('quantified_provisional')
    return d as unknown as ResultsSectionDataReturn
  }

  it('PRECONDITION: this fixture is genuinely the divergent state', () => {
    // Pin it IN-TEST (trap 13b): assert the payload really does separate the
    // arms while withholding the leader, or the arm below could pass because
    // the fixture quietly stopped reproducing the state it names.
    const rec = modeWithheld().recommendation
    expect(rec.verdict?.separation).toBe('clear')
    expect(rec.verdict?.hasLeadingOption).toBe(true)
    expect(leaderClaimWithheld(rec)).toBe(true)
    expect(analysisClaimPolicy(rec).mayShowComparativeFigures).toBe(true)
  })

  it('MODE-WITHHELD: the footer states silence, never the denial', () => {
    render(<TriageActionCardsBody data={modeWithheld()} useV17Copy onFocusNode={() => {}} />)
    const t = screen.getByTestId('checks-winner').textContent ?? ''
    expect(t).toContain('Leading option not assessed')
    expect(t).not.toContain('No clear leader')
    expect(t).not.toContain('Has leading option')
  })

  it('THE TIE DENIAL SURVIVES — this widening withdraws no licensed claim', () => {
    // The opposite-direction twin. `'tied'` is the ONE separation that licenses
    // "No clear leader", and a fix that silenced it would trade this defect for
    // over-suppression — the worse one.
    const tied = PERMITTED() as unknown as { recommendation: Record<string, unknown> }
    tied.recommendation.leaderDesignationPermitted = false
    tied.recommendation.verdict = {
      leaderId: 'opt_a', separation: 'tied', hasLeadingOption: false,
      gapPp: 0, source: 'producer_band',
    }
    render(<TriageActionCardsBody data={tied as unknown as ResultsSectionDataReturn} useV17Copy onFocusNode={() => {}} />)
    const t = screen.getByTestId('checks-winner').textContent ?? ''
    expect(t).toContain('No clear leader')
    expect(t).not.toContain('Leading option not assessed')
  })

  it('ANTI-VACUITY: a fully licensed run still reads "Has leading option"', () => {
    render(<TriageActionCardsBody data={PERMITTED()} useV17Copy onFocusNode={() => {}} />)
    const t = screen.getByTestId('checks-winner').textContent ?? ''
    expect(t).toContain('Has leading option')
    expect(t).not.toContain('Leading option not assessed')
  })

  it('UNCHANGED: the witnessed unknown-separation run reads exactly as before', () => {
    // The `'unknown'` disjunct is kept verbatim; this pins that the widening
    // did not move the state it was already right about.
    render(<TriageActionCardsBody data={WITHHELD()} useV17Copy onFocusNode={() => {}} />)
    expect(screen.getByTestId('checks-winner').textContent ?? '')
      .toContain('Leading option not assessed')
  })
})
