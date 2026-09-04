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
 * `rankActOnItRows` or `TriageActionCardsBody`'s two nudges — the three sites
 * below — so all three consulted the leader authority ZERO times. That is
 * CLAUDE.md trap 12d: derivation proves the copies agree, only a corpus
 * notices the list is short.
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
import { rankActOnItRows } from '../analysis-hero/actOnIt/rankActOnItRows'
import {
  analysisClaimPolicy,
  leaderClaimWithheld,
} from '../analysisClaimPolicy'
import { licensesComparativeLeaderClaim } from '../../../canvas/hooks/useAnalysisReady'
import type { PermittedAnalysisMode } from '../../../adapters/cee/types'
import type { DecisionVerdict } from '../../../lib/decisionVerdict'
import type { ResultsSectionDataReturn } from '../useResultsSectionData'

// ── The matcher ─────────────────────────────────────────────────────────────

/**
 * Anything that asserts, or presupposes, that one option is out in front.
 *
 * ⚠ UNION, NEVER REPLACE — the rule `withheldProse.spec.tsx` learned the hard
 * way. Its own `LEADER_PRESUPPOSITION_RE` is a SIBLING of this one, not a
 * parent: this file adds the two comparative VERB phrases (`could gain
 * ground`, `could overtake`) that its surfaces do not emit and mine do. A verb
 * phrase saying an option closes on another presupposes something to close on,
 * so it belongs in the ban even though it contains no leader noun. Retired
 * shapes stay here permanently; they cost one token each and they are the only
 * thing standing between a reverted file and a green suite.
 */
const LEADER_CLAIM_RE =
  /leading option|likely leader|could gain ground|could overtake|your recommendation|the recommendation/i

// ── Fixtures ────────────────────────────────────────────────────────────────

const FACTOR_ID = 'fac_tech_lead'
const FACTOR_LABEL = 'Technical Leadership Capacity'
const ALT_LABEL = 'Two Mid-Level Developers at £70k Each'

/**
 * The WITNESSED verdict: `separation: 'unknown'` is exactly the state that
 * renders the footer's "Leading option not assessed"
 * (`TriageActionCardsBody.tsx` — `winnerUndetermined`), and
 * `decisionVerdict.ts` returns `hasLeadingOption: false` with it at every
 * construction site.
 */
const WITHHELD_VERDICT: DecisionVerdict = {
  leaderId: 'opt_a',
  separation: 'unknown',
  hasLeadingOption: false,
  gapPp: null,
  source: 'none',
}

const PERMITTED_VERDICT: DecisionVerdict = {
  leaderId: 'opt_a',
  separation: 'clear',
  hasLeadingOption: true,
  gapPp: 40,
  source: 'producer_band',
}

const admission = (mode: PermittedAnalysisMode) => ({
  permitted_analysis_mode: mode,
  reasons: [],
})

/**
 * One fixture builder for BOTH surfaces, so the withheld arm and the permitted
 * arm cannot differ in anything but the two fields under test.
 *
 * Carries live findings on purpose: a fragile edge (drives the flip callout and
 * the `risk-` row) and two influence-scored drivers separated well past
 * `INFLUENCE_TIE_EPSILON` (drives the dominant nudge). Without all three the
 * suppression arms would pass by rendering nothing — the vacuity this file's
 * ANTI-VACUITY cases exist to refuse.
 */
function makeData(opts: {
  verdict: DecisionVerdict
  leaderDesignationPermitted: boolean
  mode?: PermittedAnalysisMode
}): ResultsSectionDataReturn {
  return {
    recommendation: {
      analysisStatus: 'computed',
      goalThreshold: null,
      allOptions: [{ id: 'opt_a' }, { id: 'opt_b' }],
      // No flip evidence either way ⇒ `attestsNoFactorFlip` is false ⇒ the
      // callout takes its STRONG branch ("could overtake" + the percentage).
      // That is the branch the witnessed defect rendered, and it is the branch
      // a suppression must survive rather than dodge.
      flipThresholds: undefined,
      verdict: opts.verdict,
      leaderDesignationPermitted: opts.leaderDesignationPermitted,
      analysisAdmission: opts.mode ? admission(opts.mode) : undefined,
    },
    confidence: {
      topFragileEdge: {
        edgeId: `${FACTOR_ID}->goal`,
        fromId: FACTOR_ID,
        fromLabel: FACTOR_LABEL,
        alternativeWinnerLabel: ALT_LABEL,
        switchProbability: 0.57,
      },
      challengeFragileEdges: [],
      robustnessStatus: null,
      robustnessLevel: null,
      m2BiasFindings: [],
      evidenceGaps: [],
      topEvidenceGaps: [],
      nextActions: [],
      topNextActions: [],
    },
    drivers: {
      dominantFactorLabel: FACTOR_LABEL,
      dominantFactorId: FACTOR_ID,
      drivers: [],
      topDrivers: [
        { factorLabel: FACTOR_LABEL, matchedNodeId: FACTOR_ID, influenceScore: 0.92 },
        { factorLabel: 'Runner up factor', matchedNodeId: 'fac_b', influenceScore: 0.31 },
      ],
      driversStatus: 'computed',
      totalCount: 2,
      hasMagnitudeData: true,
    },
  } as unknown as ResultsSectionDataReturn
}

/** The witnessed run: separation unknown, leader withheld, pre-admission CEE. */
const WITHHELD = () =>
  makeData({ verdict: WITHHELD_VERDICT, leaderDesignationPermitted: false })

/** The run that licenses everything. */
const PERMITTED = () =>
  makeData({
    verdict: PERMITTED_VERDICT,
    leaderDesignationPermitted: true,
    mode: 'comparative_leader',
  })

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

/** The fragile-edge row's generated reason, located by IDENTITY (its key). */
function fragileRowReason(data: ResultsSectionDataReturn): string {
  const row = rankActOnItRows(data, { readyToBrief: false })
    .find((r) => r.key === `risk-${FACTOR_ID}`)
  expect(row, 'the fragile-edge row was never built — this arm would be vacuous')
    .toBeDefined()
  return row!.reason
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

// ── §2 SURFACE A — rankActOnItRows fragile row ──────────────────────────────

describe('§2 SURFACE A — the act-on-it fragile row', () => {
  it('ANTI-VACUITY: the PERMITTED run emits the witnessed sentence verbatim', () => {
    expect(fragileRowReason(PERMITTED())).toBe(
      `If the estimate changes for ${FACTOR_LABEL}, the leading option could change.`,
    )
  })

  it('WITHHELD: the row names no leader', () => {
    expect(fragileRowReason(WITHHELD())).not.toMatch(LEADER_CLAIM_RE)
  })

  it('WITHHELD DATA SURVIVES: the factor and the finding are still there', () => {
    const reason = fragileRowReason(WITHHELD())
    expect(reason).toContain(FACTOR_LABEL)
    expect(reason).toContain('could change')
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
