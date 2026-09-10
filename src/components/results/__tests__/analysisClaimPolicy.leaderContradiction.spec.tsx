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
 * (§3, §4), the COMPOSED panel that reproduces the witness (§5), SURFACE D,
 * `ConditionalWinnerCards` (§6), the checks footer's affirmative DENIAL (§7)
 * and the STRENGTH WORD (§8, issue #1206).
 * NOT here: SURFACE A, `rankActOnItRows` — see
 * `analysis-hero/actOnIt/__tests__/actOnItLeaderClaim.spec.ts` and the import
 * note below for why it cannot live in this file.
 * NOT here either: the Reasoning tab (`analysisNew`), which renders the SAME
 * unlicensed "Stable" / "Robust" #1206 witnessed and reads none of these
 * answers. Those files are held by open PR #1192 and the surface has a named
 * owner on #1206 — so that half is a LIVE GAP deliberately left open, not a
 * covered one.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚠ WHICH SURFACE EMITTED THE WITNESSED SENTENCE — CORRECTED
 * ═══════════════════════════════════════════════════════════════════════════
 * This header presented "the leading option could change" as SURFACE C's
 * sentence. It is not. `useV17Copy` DEFAULTS TO FALSE and the single production
 * mount (`ResultsBody`) passes none, so SURFACE C's conjunct
 * (`useV17Copy && !leaderClaimWithheld(...)`) cannot fire on the deployed path
 * at all. The witnessed sentence is emitted by SURFACE A (`rankActOnItRows`),
 * which is v17-INDEPENDENT. SURFACE C's gate is correct and is defence in
 * depth against the day that branch mounts — it is not the fix for the witness,
 * and a reader who inherits the old attribution would be chasing the wrong
 * component. §7's three DEPLOYED POSTURE arms render with `useV17Copy` ABSENT
 * so the gates that actually reach a user are pinned at the posture that
 * reaches them (CLAUDE.md trap 3b).
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
  FACTOR_ID,
  FACTOR_LABEL,
  LEADER_CLAIM_RE,
  LOW_BUCKET_LABEL,
  MODE_WITHHELD,
  PERMITTED,
  PERMITTED_STABILITY,
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

  it('WITHHELD DATA SURVIVES: the row, the factor and the split value stay', () => {
    // CX4's remedy in one assertion: strip the NAME, never the row. Delete the
    // card instead of stripping it and this REDs while the arm above still
    // passes — which is why the two must both exist.
    const { text } = cardOf(WITHHELD())
    expect(text).toContain('Conditional scenarios')
    expect(text).toContain(FACTOR_LABEL)
    expect(text).toContain(`flips at ${SPLIT_VALUE}`)
  })

  /**
   * ⚠⚠ THIS ARM USED TO ASSERT THE OPPOSITE — it required `Above: 61%` and
   * `Below: 55%` to survive, and called that "information preserved". A cold
   * review measured what it actually preserved:
   *
   *     Above: 61%   Below: 55%
   *
   * Those are two DIFFERENT options' win probabilities (the row's own
   * `winner_flips: true` precondition guarantees it), printed side by side with
   * both subjects removed — so they read as one quantity under two conditions.
   * On this fixture the larger belongs to the option that is NOT recommended,
   * so a reader anchoring on the recommendation reads it backwards. The label
   * filter did not preserve the information; it minted a new and wrong reading.
   *
   * The row keeps everything that survives the withholding on its own terms —
   * the factor, the threshold, the flip — which is the science. A number whose
   * subject has been stripped is not a measurement this surface may still show.
   */
  it('WITHHELD: an ORPHANED probability is dropped with its subject', () => {
    const { text } = cardOf(WITHHELD())
    expect(text).not.toContain('61%')
    expect(text).not.toContain('55%')
    expect(text).not.toContain('Above:')
    expect(text).not.toContain('Below:')
  })

  it('SCOPED: a probability that never had a label is UNTOUCHED', () => {
    // The opposite-direction twin, and the reason the suppression is written
    // against `labelSuppressed` rather than against `mayNameLeader`. Where the
    // producer sent no `winner_label`, there was never a subject to lose — that
    // side must render exactly as it does today, or the fix has quietly become
    // a blanket ban on percentages (the over-suppression this component
    // refuses).
    const d = WITHHELD() as unknown as { confidence: Record<string, unknown> }
    d.confidence.conditionalWinners = [
      {
        factor_label: FACTOR_LABEL,
        factor_id: FACTOR_ID,
        split_value: SPLIT_VALUE,
        winner_flips: true,
        high_bucket: { winner_id: 'opt_b', win_probability: 0.61 },
        low_bucket: { winner_id: 'opt_a', win_probability: 0.55 },
      },
    ]
    const { text } = cardOf(d as unknown as ResultsSectionDataReturn)
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
  // Promoted to `__fixtures__/leaderClaim.fixtures.ts` so §8 and the Strengthen
  // caller guard read the SAME definition of this run. Two copies of the state
  // that discriminates would be two chances for one of them to stop
  // reproducing it silently.
  const modeWithheld = MODE_WITHHELD

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

  /**
   * ⭐⭐ THE DEPLOYED POSTURE, AND EVERY ARM ABOVE MISSES IT.
   *
   * `TriageActionCardsBody`'s `useV17Copy` DEFAULTS TO FALSE, and the single
   * production JSX mount — `ResultsBody.tsx` — passes no `useV17Copy` at all.
   * The element then travels on as an opaque `actOnItQueueSlot?: ReactNode` and
   * nothing clones it (the only `cloneElement` in `src/` is the canvas
   * tooltip). So the posture a user actually loads is `useV17Copy={false}`,
   * and EVERY render in this file passes `useV17Copy` — 13 of them at the cold
   * review, none at the deployed posture. That is CLAUDE.md trap 3b: a green
   * suite about a branch the deployment does not render.
   *
   * ⚠ AND IT CHANGES AN ATTRIBUTION IN THIS FILE'S OWN HEADER. §4's SURFACE C
   * conjunct (`useV17Copy && !leaderClaimWithheld(...)`) CANNOT FIRE on the
   * production mount: with v17 off the trailing clause takes the legacy arm
   * regardless. The witnessed sentence "the leading option could change" is
   * emitted by SURFACE A (`rankActOnItRows`), which is v17-INDEPENDENT and
   * correctly gated. SURFACE C's branch is v17-only and currently unmounted;
   * its gate is correct and is defence in depth, not the fix for the witness.
   *
   * These arms therefore pin the two gates that DO reach a user, at the posture
   * that reaches them.
   */
  it('DEPLOYED POSTURE: the footer withholds with useV17Copy absent', () => {
    render(<TriageActionCardsBody data={modeWithheld()} onFocusNode={() => {}} />)
    const t = screen.getByTestId('checks-winner').textContent ?? ''
    expect(t).toContain('Leading option not assessed')
    expect(t).not.toContain('No clear leader')
  })

  it('DEPLOYED POSTURE: SURFACE D still names no option with useV17Copy absent', () => {
    const { container } = render(
      <TriageActionCardsBody data={WITHHELD()} onFocusNode={() => {}} />,
    )
    const card = container.querySelector('[data-testid="conditional-winner-cards"]')
    expect(card, 'the card never mounted at the deployed posture — this arm would be vacuous')
      .not.toBeNull()
    const text = allText(card!)
    expect(text).not.toContain(ALT_LABEL)
    expect(text).not.toContain(LOW_BUCKET_LABEL)
    expect(text).not.toMatch(LEADER_CLAIM_RE)
  })

  it('DEPLOYED POSTURE ANTI-VACUITY: a licensed run still names the winner', () => {
    const { container } = render(
      <TriageActionCardsBody data={PERMITTED()} onFocusNode={() => {}} />,
    )
    const card = container.querySelector('[data-testid="conditional-winner-cards"]')
    expect(card).not.toBeNull()
    // Proves the deployed posture can render the claim at all — without this,
    // the two arms above would pass on a surface that says nothing to anyone.
    expect(allText(card!)).toContain(ALT_LABEL)
  })
})

// ── §8 THE STRENGTH WORD — "Robust" and "Stability: n%" need their own licence ─

/**
 * ⭐⭐ THE THIRD ANSWER, WIRED — issue #1206, witnessed on deployed `91724b01`.
 *
 * The producer's own admission carried the rule in words:
 *
 *   "Figures can be shown as provisional, but no option can be called the
 *    leader and NO RESULT CAN BE CALLED STABLE OR ROBUST until you have set at
 *    least one of them."
 *
 * On that run (`permitted_analysis_mode: 'quantified_provisional'`, zero
 * user-stated parameters) the panel rendered "Robust" and "Stable" — while the
 * glyph BESIDE it correctly rendered "Leading option not assessed". Half of one
 * admission consumed and half not, which is why `mayStateStability` had to be a
 * separate answer rather than a second reading of the leader gate.
 *
 * ⚠ THE ORIGINAL AUTHOR DEFERRED THIS FOR A STATED REASON — "no deployed run
 * was witnessed at `quantified_provisional`, and gating the robustness glyph
 * risks the over-suppression defect". The first half is now false: #1206 IS
 * that witness. The second half is honoured rather than dismissed — every arm
 * below has a PERMITTED twin carrying the identical robustness payload, so a
 * gate jammed shut fails just as loudly as a gate removed.
 *
 * ⚠ WHY NOT `robustness_not_assessed` OR `robustness_unknown`. Both are FALSE
 * here, and that is the whole argument for a fourth state. The run DID test
 * ("did not test how the result behaves" — false) and a verdict DID come back
 * ("no robustness verdict came back" — false). What is missing is the
 * AUTHORSHIP that entitles this panel to state it, so the label names what is
 * unestablished rather than something that failed to happen.
 */
describe('§8 the strength word is licensed by the admission, not by the verdict', () => {
  const STABILITY = { verdict: 'robust' as const, score: 0.78 }

  it('PRECONDITION: the producer DID return a strength verdict on this run', () => {
    // Pin it in-test (trap 13b). Without this, every suppression arm below
    // could pass because the fixture quietly stopped carrying a verdict — a
    // gate proven against a run that had nothing to say proves nothing.
    const rec = MODE_WITHHELD(STABILITY).recommendation as unknown as Record<string, unknown>
    expect(rec.robustnessVerdict).toBe('robust')
    expect(rec.recommendationStability).toBe(0.78)
    expect(analysisClaimPolicy(rec).mayStateStability).toBe(false)
    // …and the LEADER answer is a separate read. If these two ever collapse
    // into one field, this assertion is what notices.
    expect(analysisClaimPolicy(rec).mayShowComparativeFigures).toBe(true)
  })

  it('MODE-WITHHELD: the glyph states what is unestablished, not "Robust"', () => {
    render(<TriageActionCardsBody data={MODE_WITHHELD(STABILITY)} onFocusNode={() => {}} />)
    const t = screen.getByTestId('checks-robust').textContent ?? ''
    expect(t).toContain('Robustness not established')
    expect(t).not.toContain('Robust ')
    expect(t).not.toBe('Robust')
    // The two states that would be FALSE here.
    expect(t).not.toContain('Robustness not assessed')
    expect(t).not.toContain('Robustness unknown')
  })

  /**
   * ⭐⭐ THE GLYPH STATE, NOT ONLY THE LABEL — ADDED AFTER A MUTANT SURVIVED.
   *
   * Removing `mayStateStability` from `robustKnown` alone left every arm above
   * GREEN. The label was still right — `notOkLabel` carries the fourth state
   * independently — but `unknown` flipped to false, so the row rendered
   * "Robustness not established" beside the **red danger X** instead of the
   * muted help glyph.
   *
   * That is the exact harm this component's own comment forbids: *"an
   * undetermined check is not a failure and must never render as one."* An
   * absence of authority would have been presented to the user as a negative
   * finding about their model — a denial minted from a silence, which is the
   * same class of lie as the crown, pointing the other way.
   *
   * A text-only assertion cannot see it. This arm binds the STATE.
   */
  it('MODE-WITHHELD: the glyph is NEUTRAL, never the failure state', () => {
    const { container } = render(
      <TriageActionCardsBody data={MODE_WITHHELD(STABILITY)} onFocusNode={() => {}} />,
    )
    const icon = container.querySelector('[data-testid="checks-robust"] svg')
    expect(icon, 'the robustness glyph never rendered — this arm would be vacuous').not.toBeNull()
    const cls = icon!.getAttribute('class') ?? ''
    expect(cls).toContain('text-text-light')
    expect(cls).not.toContain('text-danger')
    expect(cls).not.toContain('text-success')
  })

  it('ANTI-VACUITY: the failure state is still reachable on a licensed run', () => {
    // Without this twin the arm above could pass on a component that had
    // stopped rendering the danger colour at all.
    const { container } = render(
      <TriageActionCardsBody
        data={PERMITTED_STABILITY({ verdict: 'fragile', score: 0.4 })}
        onFocusNode={() => {}}
      />,
    )
    expect(
      container.querySelector('[data-testid="checks-robust"] svg')?.getAttribute('class') ?? '',
    ).toContain('text-danger')
  })

  it('MODE-WITHHELD: "Sensitive to assumptions" is withheld too — the gate is not editorial', () => {
    // The unflattering verdict is a stability verdict as well. A gate that
    // suppressed only the favourable word would be a preference, not a licence.
    render(
      <TriageActionCardsBody
        data={MODE_WITHHELD({ verdict: 'fragile', score: 0.4 })}
        onFocusNode={() => {}}
      />,
    )
    const t = screen.getByTestId('checks-robust').textContent ?? ''
    expect(t).toContain('Robustness not established')
    expect(t).not.toContain('Sensitive to assumptions')
  })

  it('MODE-WITHHELD: the producer reason is REPLACED, not carried through the tooltip', () => {
    const { container } = render(
      <TriageActionCardsBody data={MODE_WITHHELD(STABILITY)} onFocusNode={() => {}} />,
    )
    const title = container
      .querySelector('[data-testid="checks-robust"]')
      ?.getAttribute('title') ?? ''
    // The reason for the verdict we are declining to state must not survive in
    // an attribute after the label withdrew it.
    expect(title).not.toContain('held up across the ranges we varied')
    // The reason, then the action. Both halves pinned so a later edit cannot
    // drop the actionable one and leave a dead end.
    expect(title).toContain('there is no basis for calling the result robust')
    expect(title).toContain('Set a value you know')
  })

  it('THE COPY COMMITS NO AUTHORSHIP CLAIM AND MINTS NO METRIC', () => {
    const { container } = render(
      <TriageActionCardsBody data={MODE_WITHHELD(STABILITY)} onFocusNode={() => {}} />,
    )
    const title = container
      .querySelector('[data-testid="checks-robust"]')
      ?.getAttribute('title') ?? ''
    // 1. Attributes the figures to NOBODY. The witnessed payload was
    //    user_stated 0, machine_authored 9, UNATTRIBUTED 8 of 17 — so naming
    //    Olumi as the author would be false of nearly half of them, and it is
    //    the exact claim `glanceProvenanceCopy.ts` exists to prevent.
    for (const forbidden of ['our estimate', 'our own', "Olumi's", 'we estimated', 'your figures']) {
      expect(title.toLowerCase()).not.toContain(forbidden.toLowerCase())
    }
    // 2. No number and no count — the wire licenses a per-input provenance
    //    flag, not a proportion, and this surface has had invented metrics
    //    caught on it before.
    expect(title).not.toMatch(/\d/)
    // 3. No promised OUTCOME. Setting a value buys permission to state a
    //    verdict, not a favourable one.
    expect(title).toContain('whether it is')
    expect(title).not.toMatch(/we (can|will) (say|show|confirm) (that )?it is robust/i)
  })

  it('MODE-WITHHELD: the stability PERCENTAGE is withdrawn, the section is not', () => {
    render(<TriageActionCardsBody data={MODE_WITHHELD(STABILITY)} onFocusNode={() => {}} />)
    const el = screen.getByTestId('stability-narrative')
    const t = el.textContent ?? ''
    expect(t).not.toContain('Stability:')
    expect(t).not.toContain('78%')
    // Over-suppression guard: the line still introduces the queue. Deleting the
    // section instead of the figure REDs here.
    expect(t).toContain('Inputs worth confirming:')
  })

  // ── PERMITTED TWINS — every arm above, pointing the other way ──────────────

  it('ANTI-VACUITY: a licensed run still reads "Robust"', () => {
    render(
      <TriageActionCardsBody data={PERMITTED_STABILITY(STABILITY)} onFocusNode={() => {}} />,
    )
    const t = screen.getByTestId('checks-robust').textContent ?? ''
    expect(t).toContain('Robust')
    expect(t).not.toContain('Robustness not established')
  })

  it('ANTI-VACUITY: a licensed run still reads "Sensitive to assumptions"', () => {
    render(
      <TriageActionCardsBody
        data={PERMITTED_STABILITY({ verdict: 'fragile', score: 0.4 })}
        onFocusNode={() => {}}
      />,
    )
    expect(screen.getByTestId('checks-robust').textContent ?? '')
      .toContain('Sensitive to assumptions')
  })

  it('ANTI-VACUITY: a licensed run still states the stability percentage', () => {
    render(
      <TriageActionCardsBody data={PERMITTED_STABILITY(STABILITY)} onFocusNode={() => {}} />,
    )
    expect(screen.getByTestId('stability-narrative').textContent ?? '')
      .toContain('Stability: 78%')
  })

  it('ANTI-VACUITY: a licensed run keeps the producer reason in the tooltip', () => {
    const { container } = render(
      <TriageActionCardsBody data={PERMITTED_STABILITY(STABILITY)} onFocusNode={() => {}} />,
    )
    expect(
      container.querySelector('[data-testid="checks-robust"]')?.getAttribute('title') ?? '',
    ).toContain('held up across the ranges we varied')
  })

  it('UNCHANGED: the two honest absence states still render on a licensed run', () => {
    // The gate must not have swallowed the states that were already correct.
    // `not_assessed` is the producer SAYING it did not assess; an absent field
    // is the producer saying nothing. Both survive.
    render(
      <TriageActionCardsBody
        data={PERMITTED_STABILITY({ verdict: 'not_assessed', score: 0.78 })}
        onFocusNode={() => {}}
      />,
    )
    expect(screen.getByTestId('checks-robust').textContent ?? '')
      .toContain('Robustness not assessed')

    const noVerdict = PERMITTED() as unknown as { recommendation: Record<string, unknown> }
    expect(noVerdict.recommendation.robustnessVerdict).toBeUndefined()
    render(
      <TriageActionCardsBody
        data={noVerdict as unknown as ResultsSectionDataReturn}
        onFocusNode={() => {}}
      />,
    )
    expect(screen.getAllByTestId('checks-robust').at(-1)?.textContent ?? '')
      .toContain('Robustness unknown')
  })

  it('THE ABSENT ADMISSION KEEPS TODAY’S BEHAVIOUR — this consumer lands ahead of any producer', () => {
    // `WITHHELD()` carries NO admission. The lattice-only answers default TRUE
    // on absence, so a pre-admission CEE must see the strength word exactly as
    // it does today. This is the arm that makes the change safe to deploy in
    // either order.
    const d = WITHHELD() as unknown as { recommendation: Record<string, unknown> }
    d.recommendation.robustnessVerdict = 'robust'
    d.recommendation.recommendationStability = 0.78
    d.recommendation.analysisAdmission = undefined
    const c = (d as unknown as { confidence: Record<string, unknown> }).confidence
    c.evidenceGaps = [{ factorId: FACTOR_ID, factorLabel: FACTOR_LABEL, confidence: 40, voi: 0.5, targetNodeId: FACTOR_ID }]
    c.topEvidenceGaps = c.evidenceGaps
    render(
      <TriageActionCardsBody
        data={d as unknown as ResultsSectionDataReturn}
        onFocusNode={() => {}}
      />,
    )
    expect(screen.getByTestId('checks-robust').textContent ?? '').toContain('Robust')
    expect(screen.getByTestId('stability-narrative').textContent ?? '').toContain('Stability: 78%')
  })
})
