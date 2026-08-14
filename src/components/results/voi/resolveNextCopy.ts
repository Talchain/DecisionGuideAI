/**
 * resolveNextCopy — the ONE spelling of the "Resolve next" register, now that
 * the surface renders on TWO hosts.
 *
 * WHY THIS FILE EXISTS. The value-of-information ranking was ratified once
 * (V7-C slice 1, ROADMAP 2.141) and lived as string literals inside
 * `v7/v7LensCopy.ts`, whose host is the TEMPORARY "Alt view" dock tab. Paul's
 * 14-Aug ruling promotes the surface onto the DEFAULT Analysis tab, whose copy
 * deck is `analysis-hero/heroCopy.ts`. Two decks, one ratified register: copying
 * the sentences into the second deck would be the hand-maintained mirror
 * CLAUDE.md trap 12 is about, and the drift would be SILENT — two tabs quietly
 * making differently-worded claims about the same producer rows, each with a
 * green suite.
 *
 * This is the pattern `heroCopy.ts` already uses for the flip-threshold register
 * (`switchMeta: FLIP_THRESHOLD_COPY.switchMeta`), and for the same stated
 * reason: "the hero module is mount-guarded, so the shared spelling has to live
 * OUTSIDE it". It lives beside `voiRanking.ts`/`decisionVoi.ts` because the
 * readers are what license the sentences.
 *
 * ⚠ `v7LensCopy.ts` STILL HOLDS ITS OWN COPY of the eight pre-existing strings.
 * Folding it onto this register is a one-line-per-constant change in a file this
 * lane does not own, so it is NOT done here — instead
 * `__tests__/decisionVoi.spec.ts` asserts the two are BYTE-IDENTICAL, so a drift
 * in either direction REDs instead of shipping two registers. Folding the V7
 * deck onto this one is rowed as a follow-on.
 *
 * ⭐ THE HONESTY DOCTRINE THESE SENTENCES ANSWER TO (unchanged from the V7 deck,
 * restated because a register with no doctrine attached is a register that gets
 * "improved"):
 *
 *   · NO MAGNITUDE, EVER. `evppi` and `decision_evpi` are in the decision's
 *     OUTCOME units and there is no goal-unit ruling, so no sentence here
 *     contains a digit and none ever may. The ranking is carried STRUCTURALLY by
 *     an ordered list, not by narrated numerals.
 *   · BELOW-RESOLUTION ≠ WORTHLESS. `resolveNextBelow` attributes the shortfall
 *     to THIS RUN'S PRECISION, never to the factors' worth. "not worth
 *     resolving" / "no value" / "zero value" are banned phrasings, not merely
 *     disfavoured ones.
 *   · CANNOT-RANK ≠ NO-EFFECT (L61). `resolveNextNoneAboveResolution` says the
 *     run lacked the precision to tell the unknowns apart. It must never say
 *     that no unknown "would change the recommendation" — that is a conclusion
 *     the estimator did not establish and cannot, from rows it could not
 *     resolve. Mechanically pinned in the V7 suite's §5 sweep and in this
 *     lane's hero-side sweep.
 *   · The em dashes are the design's and are kept deliberately, matching the
 *     ratified wording rather than mirroring it inexactly.
 */

export const RESOLVE_NEXT_COPY = {
  /** View-chip label, on both hosts. */
  tab: 'Resolve next',
  /**
   * Lead-in note. LICENSED BY `method: 'regression_evppi_v1'` on every row —
   * the honesty disclosure IS that we name the basis and the restraint.
   */
  note:
    'Ranked by value of information — what a run says it is worth learning before deciding. No amounts shown.',
  /** Rank-1 of the `status: 'resolved'` rows, in producer wire order. */
  lead: 'Most worth resolving next',
  /** Ranks 2..n, producer wire order. */
  then: 'then',
  /**
   * `status: 'below_resolution'`. NEVER "zero value" and never "not worth
   * resolving": below-resolution means indistinguishable from noise AT THIS
   * RUN'S RESOLUTION. Plain register on purpose — this line sits behind no
   * expert affordance on either host.
   */
  below: (labels: string) => `Not enough precision this run to rank: ${labels}`,
  /**
   * `inference_warnings[].code === 'FACTOR_EVPPI_PARTIAL'`, or any row the
   * reader had to drop. Never names WHICH factors: the producer's id lists are
   * dropped at the PLoT hop and an id-shaped name is banned regardless.
   */
  partial: "Some factors couldn't be assessed for this ranking.",
  /**
   * `factor_evppi` absent / null / empty / unusable. An honest gate, never a
   * fabricated ranking and never a heuristic substitute — this surface exists
   * to retire the `gap.voi` heuristic regime, not to fall back on it.
   */
  gate: "Value-of-information ranking wasn't produced for this run.",
  /**
   * The arrived-and-all-sub-resolution empty state. LICENSED BY a NON-NULL
   * ranking whose `resolved` band is empty — the estimator ran, rows arrived
   * and were label-resolved, and not one cleared its noise floor. NOT licensed
   * by an absent/unusable block: that is `gate` above, and claiming anything at
   * all about factors nothing assessed would fabricate the assessment.
   *
   * "yet" is load-bearing: it leaves open that a longer run resolves something.
   */
  noneAboveResolution:
    'Nothing stands out to resolve yet — this run does not have the precision to tell these unknowns apart.',

  // ── V7-C slice 2a — THE DECISION-LEVEL LINE ────────────────────────────────
  //
  // ⭐ WHY THIS LINE EXISTS AT ALL. On 5 of 5 live payloads captured in this
  // repo (4-8 Aug), `decision_evpi` came back NON-ZERO while not one
  // `factor_evppi` row cleared its own noise floor. In every one of those runs
  // the only thing this surface said was `noneAboveResolution` — and a
  // reasonable reader takes "nothing stands out to resolve yet" as "the
  // analysis looked and there is nothing more to learn, go decide". The run's
  // own whole-decision measurement was sitting in the browser saying it did NOT
  // come back at zero, and nothing on screen said so. These two sentences are
  // the entire product of the slice: they make the "nothing stands out" run and
  // the genuinely-nothing-to-learn run DISTINGUISHABLE on screen, which today
  // they are not.
  //
  // Both are verified against all three live guards: no digit (so the magnitude
  // sweeps and PP_TOKEN cannot bite), none of the six refuted-EVPI-claim
  // patterns, and none of the eight L61 no-effect literals.

  /**
   * LICENSED BY: `decision_evpi` finite and `!== 0`, on a run whose resolved
   * band is empty.
   *
   * Says the run DID NOT MEASURE ZERO. It does NOT say there is value — that
   * claim needs a decision-level precision handle (a noise floor, CI or
   * `n_samples`) which the wire does not carry, so a small positive value is
   * not distinguishable from estimator noise. "Did not come back at zero" is
   * the ceiling of what this field can support; see `decisionVoi.ts`.
   *
   * The second sentence is a SCOPE statement, licensed verbatim by the pinned
   * schema's own `FACTOR_EVPPI_ABSENCE_RULE` ("A factor ABSENT from this array
   * was not assessed — a lever an option intervenes on…" / "one row per
   * non-lever uncertain factor"). It tells the user what the ranking leaves
   * out; it deliberately does NOT tell them what to do instead, because the
   * estimator made no such recommendation.
   */
  decisionNotZero:
    'Measured for the decision as a whole, this run did not come back at zero — so "nothing stands ' +
    'out here" is not the same as "nothing left to learn". This ranking scores unknowns one at a ' +
    'time, and leaves out anything an option already controls.',

  /**
   * LICENSED BY: `decision_evpi === 0` exactly — a MEASURED zero, never an
   * absence. The contract's own words for this state are "a real result
   * (nothing about this decision is worth learning)", so this is the one place
   * in the whole VOI family where a no-effect claim is genuinely licensed.
   *
   * ⚠ IT STILL MUST NOT MATCH THE L61 BANNED LITERALS, and the wording is
   * chosen for exactly that: "would leave the same choice" makes the licensed
   * claim WITHOUT saying "would not change" / "makes no difference" / "no
   * value". The ban is on phrasings that assert no-effect from rows we could
   * not resolve; here the producer measured it. Keeping the literal ban intact
   * anyway is deliberate — a sweep with a carve-out is a sweep that widens.
   */
  decisionZero:
    'Measured for the decision as a whole, this run came back at zero — on this model, learning ' +
    'every unknown would leave the same choice.',
} as const
