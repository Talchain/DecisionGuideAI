/**
 * P2 — FEWER PERSISTENT LABELS. A PINNED STRENGTH LABEL MUST SPEAK A STRENGTH.
 *
 * THE RULING THIS IMPLEMENTS
 * --------------------------
 * Paul ruled on canvas principle P2 ("every label legible at the zoom the
 * product parks at") on 6 Sep 2026: the answer is FEWER PERSISTENT LABELS —
 * explicitly NOT sideways resolver movement, and NOT a shorter vocabulary,
 * because a shorter vocabulary changes what the label MEANS. This suite is the
 * subtraction, and it is the same shape as `selectPersistentStrengthIds`
 * itself: rank exactly as before, then REFUSE a class, rather than invent a
 * new heuristic or re-word anything.
 *
 * THE DEFECT
 * ----------
 * `selectPersistentStrengthIds` is the one owner of "which edges pin a label".
 * Three branches in `StyledEdge` feed it, and only ONE of them — the
 * pre-analysis ranker — refused an edge whose strength nobody set. The other
 * two (the "3 or fewer causal edges, label them all" branch, and the
 * post-analysis composite-importance branch, which scores from
 * `ed?.weight ?? 0.5`) had no provenance gate at all. So an edge with no
 * sourced strength could take one of the three PERSISTENT slots and render
 * "Boost, strength not set" — a label pinned to the map by the STRENGTH
 * channel that names no strength.
 *
 * One question — "may this edge pin a strength label?" — with a gate on one of
 * its three answers is CLAUDE.md trap 21 in its plainest form. The gate now
 * lives in the selector, and `RankedCausalEdge.strengthIsSet` is REQUIRED, so
 * a fourth branch cannot be added without answering it: forgetting is a type
 * error, not a silent label.
 *
 * MEASURED, ON DEPLOYED STAGING (2026-09-07, https://staging--olumi.netlify.app)
 * -----------------------------------------------------------------------------
 * The chip's row is capped at a REAL 123px (`span.clientWidth`; the container
 * is `maxWidth: 160px` less 8px padding either side), `white-space: nowrap`,
 * `text-overflow: ellipsis`. Measured two ways — canvas `measureText` in the
 * product's own computed font (`500 16.2px Inter`), and a clone of the LIVE
 * span re-measured by the layout engine — agreeing within ~1.5%:
 *
 *     "Moderate boost"           121.0px   fits   (observed on screen, un-truncated)
 *     "Strong boost"              98.4px   fits   (observed on screen, un-truncated)
 *     "Boost, strength not set"  173.5px   141% OF THE CAP — truncated
 *     "Drag, strength not set"   166.3px   truncated
 *
 * ⚠ AND THE HONEST LIMIT OF THAT MEASUREMENT, because it bounds what this
 * suite may claim: `"Weak drag (uncertain)"` measures 170.8px and IS still
 * admitted here, because its strength IS set. **Truncation is not unique to
 * the unset-strength labels and this change does not end it.** This suite
 * therefore asserts a PROVENANCE property — a pinned label speaks a strength —
 * and asserts NOTHING about width. A width assertion in a jsdom suite would be
 * exactly the claim platform trap 3 forbids.
 *
 * DERIVED, NOT MIRRORED (CLAUDE.md trap 12)
 * -----------------------------------------
 * The label vocabulary is not listed here. It is ENUMERATED by running the real
 * `describeEdge` over the cartesian product of its own three inputs' provenance
 * states, and the band words are read back out of that same enumeration. Add an
 * arm to `describeEdge`, or make a "not set" arm reachable from the persistent
 * channel, and this suite REDs without anyone remembering to edit a list.
 *
 * CLAIM TYPE: pure-function return values only. Nothing here claims visibility,
 * layout, or what a reader perceives.
 */
import { describe, it, expect } from 'vitest'
import { describeEdge, LABEL_HEDGE_CUT, nothingIsStated } from '../../domain/edgeLabels'
import type {
  EdgeDirectionDisplay,
  EdgeValueDisplay,
} from '../../domain/edgeValueProvenance'
import {
  selectPersistentStrengthIds,
  PERSISTENT_LABEL_LIMIT,
  type RankedCausalEdge,
} from '../edgeLabelVisibility'

// ---------------------------------------------------------------------------
// The enumeration. These are `describeEdge`'s OWN input types, so the product
// of them is its complete provenance state space — not a sample of it.
// ---------------------------------------------------------------------------

const STRENGTH_STATES: ReadonlyArray<{ name: string; v: EdgeValueDisplay }> = [
  { name: 'strength:set-strong', v: { show: true, value: 0.85, source: 'cee' } },
  { name: 'strength:set-moderate', v: { show: true, value: 0.45, source: 'user' } },
  { name: 'strength:set-weak', v: { show: true, value: 0.1, source: 'cee' } },
  { name: 'strength:set-negative-magnitude', v: { show: true, value: -0.8, source: 'cee' } },
  { name: 'strength:not_set', v: { show: false, reason: 'not_set' } },
  { name: 'strength:absent', v: { show: false, reason: 'absent' } },
]

const LIKELIHOOD_STATES: ReadonlyArray<{ name: string; v: EdgeValueDisplay }> = [
  { name: 'likelihood:confident', v: { show: true, value: LABEL_HEDGE_CUT + 0.2, source: 'cee' } },
  { name: 'likelihood:hedged', v: { show: true, value: LABEL_HEDGE_CUT - 0.2, source: 'cee' } },
  { name: 'likelihood:not_set', v: { show: false, reason: 'not_set' } },
  { name: 'likelihood:absent', v: { show: false, reason: 'absent' } },
]

/**
 * ⚠ TYPED EXPLICITLY, AND THE FIRST DRAFT WAS NOT — the repo's typecheck gate
 * caught it (TS2345). Written as bare `as const` literals, the array's inferred
 * element type was a union whose `show: false` member carried
 * `direction?: undefined`, which `EdgeDirectionDisplay` does not admit, and
 * whose `show: true` members omitted the REQUIRED `source`. Annotating the
 * array makes the discriminated union do its job here exactly as it does at the
 * call sites: an unstated direction cannot be written without saying WHY, and a
 * stated one cannot be written without a provenance.
 */
const DIRECTION_STATES: ReadonlyArray<{ name: string; v: EdgeDirectionDisplay }> = [
  { name: 'direction:positive', v: { show: true, direction: 'positive', source: 'cee' } },
  { name: 'direction:negative', v: { show: true, direction: 'negative', source: 'cee' } },
  { name: 'direction:unstated', v: { show: false, reason: 'unknown' } },
]

interface EnumeratedLabel {
  name: string
  label: string
  strengthIsSet: boolean
  nothingIsStated: boolean
}

const ENUMERATED: readonly EnumeratedLabel[] = STRENGTH_STATES.flatMap(s =>
  LIKELIHOOD_STATES.flatMap(l =>
    DIRECTION_STATES.map(d => ({
      name: `${s.name} | ${l.name} | ${d.name}`,
      label: describeEdge(s.v, l.v, d.v).label,
      strengthIsSet: s.v.show,
      // The SAME predicate `describeEdge` uses for its empty-state arm — not a
      // restatement of it here.
      nothingIsStated: nothingIsStated(s.v, l.v, d.v),
    })),
  ),
)

/**
 * ⭐⭐ ASKED OF THE REAL SELECTOR, NOT OF A COPY OF ITS RULE. THIS IS THE FIX
 * FOR A DEFECT THIS FILE SHIPPED WITH.
 *
 * These two lists previously read `ENUMERATED.filter(e => e.strengthIsSet)` and
 * its negation — a LOCAL RE-IMPLEMENTATION of the gate that never called
 * `selectPersistentStrengthIds`. Every assertion below them therefore described
 * the rule as spelled IN THIS FILE rather than the rule the product runs, and
 * the whole block would have stayed green if the gate in
 * `edgeLabelVisibility.ts` had been deleted outright. That is CLAUDE.md trap 12
 * — a hand-maintained mirror reading green while it drifts — sitting inside the
 * assertions this file is most emphatic about.
 *
 * Now each enumerated state is put THROUGH the selector, one edge at a time on
 * its own target so the per-target cap and the three-slot limit cannot
 * confound the answer. If the gate changes, these lists change with it, and the
 * identity assertions below either follow or RED.
 */
const admittedByGate = (e: EnumeratedLabel): boolean =>
  selectPersistentStrengthIds([
    { id: 'e', target: 't', strengthIsSet: e.strengthIsSet, nothingIsStated: e.nothingIsStated },
  ]).has('e')

const persistentReachable = ENUMERATED.filter(admittedByGate)
const refusedByGate = ENUMERATED.filter(e => !admittedByGate(e))

/**
 * The band words, READ BACK OUT of the enumeration rather than typed here. If
 * `describeEdge` renames a band, this set follows it.
 */
const EMPTY_STATE_LABEL = 'Strength and likelihood not set'

/**
 * The one persistent label that is NOT a strength claim.
 *
 * ⛔ WHY THIS ONE IS EXEMPT, SO THE NEXT PERSON CANNOT ADD A SECOND BY
 * PATTERN-MATCHING IT. Every other reachable label ASSERTS something about the
 * effect — "Strong boost", "Weak drag (uncertain)" — and therefore owes a band
 * word, which is what the invariant below checks. `Strength and likelihood not
 * set` asserts nothing: it is a DISCLOSURE OF ABSENCE, the sentence the product
 * says when it knows nothing, and it has no band because there is no magnitude
 * to band. The exemption is that ONE property, not "labels that look
 * different" — a second label belongs here only if it likewise makes no claim,
 * and then it needs this paragraph rewritten, not extended.
 *
 * ⛔ AND THE TWO GUARDS HERE ARE NOT REDUNDANT — DROP EITHER AND A CLASS GOES
 * UNWATCHED.
 *   · The exemption is BY NAME, not by a predicate like "starts with a
 *     capital". A predicate would silently absorb the next non-band label
 *     someone admits; a name cannot absorb anything it was not given.
 *   · The `offenders` assertion below then still REDs on that next label. The
 *     name stops this one label being a false alarm; the assertion stops every
 *     other one being a silent pass. One answers "is this exemption correct",
 *     the other answers "is the list complete", and no single guard answers
 *     both (CLAUDE.md trap 12d).
 *
 * It is also asserted below to be a label `describeEdge` actually produces, so
 * the constant cannot rot into a string the product stopped emitting.
 */
const CLAIM_LABELS = persistentReachable.filter(e => e.label !== EMPTY_STATE_LABEL)

const BAND_WORDS = new Set(
  CLAIM_LABELS.map(e => e.label.split(' ')[0]).filter(w => /^[A-Z]/.test(w)),
)

const ranked = (
  id: string,
  target: string,
  strengthIsSet: boolean,
  nothingIsStated = false,
): RankedCausalEdge => ({
  id,
  target,
  strengthIsSet,
  nothingIsStated,
})

describe('PRECONDITIONS — the enumeration can actually discriminate', () => {
  it('enumerates the full product of the three provenance axes, non-empty on both sides', () => {
    expect(ENUMERATED).toHaveLength(
      STRENGTH_STATES.length * LIKELIHOOD_STATES.length * DIRECTION_STATES.length,
    )
    expect(ENUMERATED).toHaveLength(72)
    // Both partitions must be populated or every assertion below is vacuous.
    expect(persistentReachable.length).toBeGreaterThan(0)
    expect(refusedByGate.length).toBeGreaterThan(0)
  })

  it('the refused partition really does contain "not set" labels — otherwise there is nothing to catch', () => {
    const notSet = refusedByGate.filter(e => /not set/i.test(e.label))
    // Every unset-strength state produces a label that says so; if a future
    // edit made these arms silent, this suite would be guarding nothing.
    expect(notSet.length).toBe(refusedByGate.length)
    // The specific string the ruling named must be among them, bound by identity.
    expect(refusedByGate.map(e => e.label)).toContain('Boost, strength not set')
    expect(refusedByGate.map(e => e.label)).toContain('Drag, strength not set')
  })

  it('the band vocabulary is derived from describeEdge, not typed into this file', () => {
    expect([...BAND_WORDS].sort()).toEqual(['Moderate', 'Strong', 'Weak'])
  })
})

describe('THE GATE — an edge whose strength nobody set may not pin a label', () => {
  it('THE DEFECT: an unset strength that STATES A DIRECTION is refused a label', () => {
    // "Boost, strength not set" — a claim with a hole in it, and the 173.5px
    // furniture the P2 ruling removed. Still refused, and this is the arm that
    // must never loosen.
    const out = selectPersistentStrengthIds([ranked('unset', 'goal', false)])
    expect(out.size).toBe(0)
  })

  it('NARROWED, NOT WEAKENED: an edge that states NOTHING is admitted', () => {
    // ⭐ Its label is `Strength and likelihood not set` — a disclosure of
    // absence, making no strength claim to be wrong about. #1318 ruled that
    // this belongs ON THE LINE; refusing it removed a disclosure rather than a
    // claim and left the class with no worded surface outside hover.
    //
    // ⛔ THE PAIR IS THE POINT. This assertion and the one above differ in
    // exactly one input and expect opposite outcomes, so a gate that simply
    // stopped refusing — or simply stopped admitting — reds one of them. A
    // single looser assertion in place of the two would be a weakening.
    const out = selectPersistentStrengthIds([ranked('blank', 'goal', false, true)])
    expect([...out]).toEqual(['blank'])
  })

  it('CONTROL (non-vacuity): a sourced-strength edge in the same shape IS admitted', () => {
    const out = selectPersistentStrengthIds([ranked('sourced', 'goal', true)])
    expect([...out]).toEqual(['sourced'])
  })

  it('DISCRIMINATING PAIR, bound by IDENTITY: only the sourced ids survive a mixed graph', () => {
    // Ranked order deliberately puts the UNSET edges FIRST, so a selector that
    // merely took the top N would keep exactly the wrong ones.
    const out = selectPersistentStrengthIds([
      ranked('unset-a', 'g1', false),
      ranked('unset-b', 'g2', false),
      ranked('sourced-a', 'g3', true),
      ranked('sourced-b', 'g4', true),
    ])
    expect([...out].sort()).toEqual(['sourced-a', 'sourced-b'])
    // Bound by identity, not by size: name the ids that must NOT be there.
    expect(out.has('unset-a')).toBe(false)
    expect(out.has('unset-b')).toBe(false)
  })

  it('an unset edge does not consume a slot the sourced edges could have used', () => {
    // Four sourced edges behind two unset ones: the cap must still be filled
    // with sourced edges, not spent on the refused ones.
    const out = selectPersistentStrengthIds([
      ranked('unset-a', 'g0', false),
      ranked('unset-b', 'g9', false),
      ranked('s1', 'g1', true),
      ranked('s2', 'g2', true),
      ranked('s3', 'g3', true),
      ranked('s4', 'g4', true),
    ])
    expect([...out]).toEqual(['s1', 's2', 's3'])
    expect(out.size).toBe(PERSISTENT_LABEL_LIMIT)
  })

  it('an unset edge does not claim a TARGET and lock a sourced sibling out of it', () => {
    // The per-target cap and the provenance gate must compose in the right
    // order: refuse FIRST, then claim. Claiming first would let a refused edge
    // silently delete its target's only legible label.
    const out = selectPersistentStrengthIds([
      ranked('unset-first', 'goal', false),
      ranked('sourced-same-target', 'goal', true),
    ])
    expect([...out]).toEqual(['sourced-same-target'])
  })

  it('a graph where NOTHING has a sourced strength pins ZERO labels', () => {
    const many = Array.from({ length: 20 }, (_, i) => ranked(`e${i}`, `t${i}`, false))
    expect(selectPersistentStrengthIds(many).size).toBe(0)
  })
})

describe('THE VOCABULARY GUARD — derived, fails loud if a "not set" label becomes pinnable', () => {
  /**
   * ⚠ THIS ASSERTION WAS WRONG WHEN FIRST WRITTEN, AND THE CORRECTION IS THE
   * POINT. It read `/not set/i.test(label)` — and RED at pristine on
   * "Weak boost (likelihood not set)", which is a PERFECTLY LEGITIMATE pinned
   * label: its strength IS sourced, and the parenthetical is a true statement
   * about the LIKELIHOOD. I had written the invariant against the WORDING of
   * the defect ("not set") instead of against the PROPERTY ("the strength is
   * spoken") — CLAUDE.md trap 13d, in the guard written to enforce the rule.
   *
   * The property, stated derivedly and with no regex at all: the labels
   * `describeEdge` produces for an UNSET strength are exactly the strings the
   * persistent channel must never show. So the two partitions' label sets must
   * not intersect. Add an unset-strength arm and it joins `refusedByGate`
   * automatically; make one reachable and this REDs by name.
   */
  it('no label the unset-strength arms produce is reachable on the persistent channel', () => {
    const refusedLabels = new Set(refusedByGate.map(e => e.label))
    const offenders = persistentReachable.filter(e => refusedLabels.has(e.label))
    expect(offenders.map(e => `${e.name} -> ${e.label}`)).toEqual([])
    // Non-vacuity: the two sets must both be populated, or an empty
    // intersection proves nothing.
    expect(refusedLabels.size).toBeGreaterThan(0)
    expect(new Set(persistentReachable.map(e => e.label)).size).toBeGreaterThan(0)
  })

  it('the strength-unset vocabulary is refused BY IDENTITY, string by string', () => {
    // The ruling named these two. Bind to them by identity so a rename that
    // quietly reopened the channel cannot pass on a set-difference alone.
    const reachable = new Set(persistentReachable.map(e => e.label))
    expect(reachable.has('Boost, strength not set')).toBe(false)
    expect(reachable.has('Drag, strength not set')).toBe(false)
    // ⭐ FLIPPED 9 Sep 2026, DELIBERATELY, AND IT IS THE WHOLE NARROWING.
    // These three used to read `false` together. The first two are claims with
    // a hole in them and stay refused; this one is a DISCLOSURE OF ABSENCE and
    // is now admitted, because #1318 ruled it belongs on the line and #1265's
    // own rule — a pinned label must SPEAK A STRENGTH — is not violated by a
    // label that makes no strength claim at all.
    expect(reachable.has(EMPTY_STATE_LABEL)).toBe(true)
    // The constant is a real product string, not a stale one this file kept.
    expect(ENUMERATED.some(e => e.label === EMPTY_STATE_LABEL)).toBe(true)
    // CONTRAST, same command shape: a label whose strength IS sourced but
    // whose likelihood is not stays reachable. Without this the assertion
    // above would also pass if the persistent channel showed nothing at all.
    expect(reachable.has('Weak boost (likelihood not set)')).toBe(true)
  })

  it('every label reachable on the persistent channel opens with a derived band word', () => {
    // ⛔ ASKED OF THE CLAIM LABELS, AND THE EXEMPTION IS A SINGLE NAMED
    // STRING. The empty-state disclosure is the one persistent label that is
    // not a strength claim, so it has no band word by design. Exempting it by
    // identity — rather than by loosening the predicate — means the next label
    // admitted without a band word REDS here instead of slipping through.
    const offenders = CLAIM_LABELS.filter(e => !BAND_WORDS.has(e.label.split(' ')[0]))
    expect(offenders.map(e => `${e.name} -> ${e.label}`)).toEqual([])
    // Non-vacuity: the exemption must not have emptied the set it guards.
    expect(CLAIM_LABELS.length).toBeGreaterThan(0)
  })

  it('the count of DISTINCT persistent label strings does not grow unnoticed', () => {
    // A snapshot of the SIZE, not a copy of the list: the strings themselves
    // stay derived. Growing the pinnable vocabulary is a P2 decision and must
    // be made deliberately, against the ruling, not arrive as a side effect.
    //
    // 27 was MEASURED at this tip, not predicted — the first draft of this
    // line guessed 12 and RED. It is the deliberate tripwire the ruling asks
    // for: "a change that ADDS a persistent label now owes an argument against
    // itself", so moving this number is the moment that argument gets written.
    // ⭐ 27 -> 28 on 9 Sep 2026, and the +1 is NAMED rather than merely
    // re-measured: the empty-state disclosure is now admitted, and it is one
    // distinct string however many enumerated states produce it. Deriving the
    // delta rather than re-snapshotting is what makes this a tripwire and not
    // a rubber stamp — if the number moved by anything other than this one
    // label, the argument this comment owes has not been written.
    const distinct = new Set(persistentReachable.map(e => e.label))
    expect(distinct.size).toBe(28)
    // Bind the +1 to its cause, so a coincidental 28 cannot pass.
    expect(distinct.has(EMPTY_STATE_LABEL)).toBe(true)
    expect(new Set(CLAIM_LABELS.map(e => e.label)).size).toBe(27)
  })
})
