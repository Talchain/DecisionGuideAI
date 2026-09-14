/**
 * ⭐⭐ WHO THE PRODUCT SAYS THE MISSING THINGS BELONGED TO — and the untested
 * arm that could have emptied this whole surface in silence.
 *
 * TWO defects, both found by a post-merge audit of #1499 (verdict APPROVE —
 * nothing here reverts that change; this extends it to the surfaces it did not
 * reach).
 *
 * ── DEFECT 1: THE PRODUCT ATTRIBUTED ITS OWN INVENTIONS TO THE USER ─────────
 * The headline read *"Olumi left N things FROM YOUR BRIEF out of this model"*
 * and counted exactly the two `absent` kinds. DERIVED AT THE PRODUCER
 * (`olumi-assistants-service` staging `7aa49ec8`), neither kind supports that
 * claim:
 *
 *   relationship_not_used  ALL EIGHT reasons dispose of an EDGE, and an edge is
 *                          never the user's: `ProjectedEdge.origin` is typed
 *                          `"ai" | "default"` (`projector.ts:759`) so a
 *                          user-authored edge is NOT REPRESENTABLE, the only
 *                          claim-derived mint is `origin:"ai",
 *                          provenance_source:"inferred",
 *                          provenance_class:"ai_inferred"` UNCONDITIONALLY
 *                          (`:3029-3053`), and `DroppedRecordRef` is declared
 *                          *"A reference THE MODEL EMITTED"* (`:351`).
 *   detail_not_connected   MIXED, and the wire cannot tell. The prune predicate
 *                          is `(n.kind === "factor" || n.kind === "constraint")
 *                          && !reachesGoal.has(n.id)` (`:3131-3133`) with NO
 *                          provenance filter, and it records
 *                          `claim_kind: provenance_class === "stated"
 *                          ? "stated_item" : "claim"` (`:3142`) — BOTH.
 *
 * ⚠ AND `claim_kind` DOES NOT REACH THIS WIRE. Read at the branch's own pinned
 * tarball (`vendor/talchain-schemas-0.55.0.tgz`, never `node_modules` — 46
 * minor versions stale there), `ModelBuildingNoticesSchema` is
 * `{ total_count, groups: [{ kind, count }], details_redacted: true }.strict()`.
 * Kind and count. Nothing else. So for `detail_not_connected` the product
 * CANNOT KNOW whose the item was, and must claim neither.
 *
 * ⭐ #1499 ALREADY APPLIED THIS REASONING — it demoted `alternative_consolidated`
 * on provenance grounds and wrote the rule down. It simply did not apply it to
 * the headline it rewrote, nor to the two rows the headline counts. This file
 * applies the file's own standard consistently.
 *
 * ⚠⚠ HONEST IN BOTH DIRECTIONS, WHICH IS WHY THIS IS NOT A BLANKET BAN ON THE
 * SECOND PERSON. `target_not_modelled_as_threshold` is UNANIMOUSLY the user's —
 * both reasons emit `claim_kind: "stated_item"` with the user's verbatim quote
 * (`projector.ts:2618-2626`) — so "Targets YOU SET" is EARNED and is kept. It
 * is the CONTRAST CONTROL below: a guard that reported "no attribution" for all
 * six kinds would be reporting on itself (trap 13e — a probe needs a hit whose
 * magnitude is plausible, and a discrimination it is actually making).
 *
 * ── DEFECT 2: THE ZERO-ABSENT ARM WAS ENTIRELY UNTESTED ────────────────────
 * PROVEN BY A SURVIVING MUTANT, reproduced at pristine `c5b5e86a` before this
 * file was written: replacing the whole arm with `return ''` left ALL 44 tests
 * across the three notices specs GREEN. Every assertion on that branch was a
 * NEGATIVE (`not.toMatch(/left \d+/)`, `not.toContain('14')`) and every one of
 * them passes on the empty string. `"modelling choice"` appeared in the source
 * and in ONE spec COMMENT, in ZERO assertions.
 *
 * That is trap 13 inside a new suite — an absence proved with no positive
 * control. The arm fires on `total_count: 1`, which the renderer's own comment
 * calls *"the most likely draft of all"*, and an emptied arm renders an
 * unlabelled toggle with NO ACCESSIBLE NAME and no disclosure, with nothing red.
 * The assertions below are POSITIVE and bound to the rendered string.
 *
 * MOUNT (trap 3b): every rendering assertion drives the real `MessageBubble`,
 * as both sibling suites do, so a deleted mount REDs here too.
 * IDENTITY (trap 19): rows reach their subject through `data-notice-kind` and
 * the headline through `data-testid`, and every copy assertion is a WHOLE-STRING
 * equality — `toContain('6 things')` passes on "16 things".
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ModelBuildingNoticeKindSchema } from '@talchain/schemas/boundary'
import type { ModelBuildingNoticeKind } from '@talchain/schemas/boundary'
import { MessageBubble } from '../MessageBubble'
import type { ConversationMessage } from '../types'
import {
  describeModelBuildingNoticeKind,
  modelBuildingNoticeAttribution,
  modelBuildingNoticeOutcome,
  toModelBuildingNoticesView,
} from '../modelBuildingNotices'
import { PRODUCER_CORPUS } from './producerNoticeReasons'

const noop = async () => {}

function makeMsg(overrides: Partial<ConversationMessage> = {}): ConversationMessage {
  return {
    id: 'msg-mbn-attr-1',
    role: 'assistant',
    content: "Here's a first model of your pricing decision.",
    timestamp: new Date(),
    ...overrides,
  }
}

/** Built through the PRODUCTION shaper, so the fixture cannot drift off-wire. */
function view(groups: Array<{ kind: ModelBuildingNoticeKind; count: number }>) {
  return toModelBuildingNoticesView({
    total_count: groups.reduce((s, g) => s + g.count, 0),
    groups,
    details_redacted: true,
  })
}

/** The collapsed headline, whitespace-normalised. Bound by testid, not by text. */
function headline(groups: Array<{ kind: ModelBuildingNoticeKind; count: number }>): string {
  render(
    <MessageBubble message={makeMsg({ modelBuildingNotices: view(groups) })} onChipClick={noop} />,
  )
  return (screen.getByTestId('model-building-notices-toggle').textContent ?? '')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * ⚠ A HAND-WRITTEN CORPUS, AND THAT IS THE POINT (trap 12d).
 *
 * Derivation proves the consumers agree with a list; only a corpus notices the
 * list is SHORT. These are the phrasings by which English copy claims the
 * DROPPED ITEM came from the user. They are deliberately NOT "any second
 * person": "your goal" and "this model" are the user's decision, not a
 * provenance claim about the item, and a blanket ban would RED on true copy.
 */
const USER_ATTRIBUTION_PHRASES: readonly RegExp[] = [
  /\bfrom your brief\b/i,
  /\byou mentioned\b/i,
  /\byou described\b/i,
  /\byou set\b/i,
  /\byou stated\b/i,
  /\byou gave\b/i,
  /\byou told\b/i,
  /\byou wrote\b/i,
  /\byour own words\b/i,
  /\byour alternatives\b/i,
  /\byour (?:points|details|relationships|targets|constraints|figures|numbers)\b/i,
]

const attributesToUser = (copy: string): boolean =>
  USER_ATTRIBUTION_PHRASES.some((re) => re.test(copy))

/**
 * ⭐⭐ THE ORACLE, AND IT COMES FROM THE PRODUCER, NOT FROM THIS AUTHOR.
 *
 * One row per reason in CEE's `NOTICE_KIND_BY_REASON` (21 of them — the
 * sibling suite's header says "twenty", which is a miscount; derived at
 * `model-building-notices.ts:78-176` on staging `7aa49ec8`). `statedByUser` is
 * the PRODUCER's answer to "whose was the thing this discloses?", read at its
 * emission site, never inferred from the reason's name (trap 13c).
 *
 *   true    the site emits `claim_kind: "stated_item"` unconditionally
 *   false   the site emits a CLAIM, or is gated on `ai_inferred`
 *   'either' the site emits one or the other and the wire cannot say which
 */
const PRODUCER_ATTRIBUTION: ReadonlyArray<{
  reason: string
  kind: ModelBuildingNoticeKind
  statedByUser: boolean | 'either'
  because: string
}> = [
  // ── relationship_not_used — every one disposes of an EDGE, and `ProjectedEdge
  //    .origin` is typed `"ai" | "default"`: the user cannot author one.
  { reason: 'unparseable_ref', kind: 'relationship_not_used', statedByUser: false, because: 'emitted in the claims loop with `claim_kind: claim.claim_kind` (projector.ts:2955-2967)' },
  { reason: 'ref_out_of_range', kind: 'relationship_not_used', statedByUser: false, because: 'same claims loop; the ENDPOINT may be stated, the LINK never is' },
  { reason: 'ref_target_not_a_node', kind: 'relationship_not_used', statedByUser: false, because: 'same claims loop' },
  { reason: 'self_loop', kind: 'relationship_not_used', statedByUser: false, because: '`claim_kind: claim.claim_kind` (projector.ts:2978)' },
  { reason: 'missing_ref', kind: 'relationship_not_used', statedByUser: false, because: 'same claims loop' },
  { reason: 'ambiguous_ref', kind: 'relationship_not_used', statedByUser: false, because: '"the projector has no basis for preferring either, so it refuses"' },
  { reason: 'ref_kind_illegal', kind: 'relationship_not_used', statedByUser: false, because: '`claim_kind: claim.claim_kind` (projector.ts:3012)' },
  { reason: 'endpoint_demoted_duplicate', kind: 'relationship_not_used', statedByUser: false, because: '"A link whose endpoint was demoted"; the link is the model\'s' },

  // ── detail_not_connected — the prune has NO provenance filter ─────────────
  { reason: 'unconnected_to_goal', kind: 'detail_not_connected', statedByUser: 'either', because: '`claim_kind: provenance_class === "stated" ? "stated_item" : "claim"` (projector.ts:3142)' },
  { reason: 'disconnected_by_shape_gate', kind: 'detail_not_connected', statedByUser: 'either', because: 'same emission site, same ternary' },

  // ── alternative_consolidated — MODEL-emitted in all three ─────────────────
  { reason: 'refinement_merged_into_stated_option', kind: 'alternative_consolidated', statedByUser: false, because: 'an `option_refinement` CLAIM; `claim_kind: claim.claim_kind` (projector.ts:2812)' },
  { reason: 'undeveloped_duplicate_of_stated', kind: 'alternative_consolidated', statedByUser: false, because: '"A MODEL-emitted option ... The model\'s one is withdrawn"; "a STATED option is NEVER demoted"' },
  { reason: 'undeveloped_duplicate_of_model', kind: 'alternative_consolidated', statedByUser: false, because: '"Two MODEL options ... no stated member in the group"' },

  // ── conflict_resolved_conservatively — MIXED (1 user, 2 model) ────────────
  { reason: 'parallel_intervention_conflict', kind: 'conflict_resolved_conservatively', statedByUser: false, because: '`claim_kind: "claim"` (projector.ts:3393) — the model\'s own parallel claims' },
  { reason: 'parallel_causal_link_conflict', kind: 'conflict_resolved_conservatively', statedByUser: false, because: '`claim_kind: "causal_link"` (projector.ts:3779)' },
  { reason: 'constraint_direction_unstated', kind: 'conflict_resolved_conservatively', statedByUser: true, because: '`claim_kind: "stated_item"`, `label: quote` (projector.ts:2429-2434)' },

  // ── target_not_modelled_as_threshold — UNANIMOUSLY the user's ─────────────
  { reason: 'stated_target_not_represented_as_threshold', kind: 'target_not_modelled_as_threshold', statedByUser: true, because: '`claim_kind: "stated_item"`, `label: quote` (projector.ts:2618-2626)' },
  { reason: 'stated_target_value_dropped', kind: 'target_not_modelled_as_threshold', statedByUser: true, because: 'same emission site, same `claim_kind`' },

  // ── other — MODEL-emitted in all three ────────────────────────────────────
  { reason: 'claim_label_not_a_name', kind: 'other', statedByUser: false, because: 'gated `provenance_class !== "ai_inferred" → continue` (projector.ts:4090)' },
  { reason: 'option_budget_exceeded', kind: 'other', statedByUser: false, because: '`claim_kind: "claim"`; "A STATED option is NEVER dropped for budget"' },
  { reason: 'factor_merged_into_stated_cause', kind: 'other', statedByUser: false, because: 'a `factor` CLAIM folded into the user\'s node — "MODEL-origin content into a USER-stated node"' },
]

/** A kind may attribute to the user only when EVERY reason under it is theirs. */
const unanimouslyUserStated = (kind: ModelBuildingNoticeKind): boolean => {
  const rows = PRODUCER_ATTRIBUTION.filter((r) => r.kind === kind)
  expect(rows.length, `corpus covers no reason for kind ${kind}`).toBeGreaterThan(0)
  return rows.every((r) => r.statedByUser === true)
}

describe('model-building notices — ⭐⭐ two hand corpora check each other', () => {
  it('covers exactly the same 21 producer reasons as the sibling suite', () => {
    // Neither list can notice that IT is short. Two independently written lists
    // asking different questions of the same map CAN (trap 12d).
    const mine = PRODUCER_ATTRIBUTION.map((r) => r.reason).sort()
    const theirs = PRODUCER_CORPUS.map((r) => r.reason).sort()
    expect(new Set(mine).size, 'a reason is listed twice here').toBe(mine.length)
    expect(mine).toEqual(theirs)
  })

  it('agrees with the sibling suite on which KIND each reason belongs to', () => {
    const kindOf = new Map(PRODUCER_CORPUS.map((r) => [r.reason, r.kind]))
    for (const row of PRODUCER_ATTRIBUTION) {
      expect(row.kind, `the two corpora disagree on ${row.reason}`).toBe(kindOf.get(row.reason))
    }
  })

  it('the module map agrees with this corpus for EVERY enum member', () => {
    // Derived from the corpus, so the expectation cannot be edited to match the
    // code: `user_stated` iff unanimous, `olumi_authored` iff unanimously not,
    // `mixed` otherwise.
    for (const kind of ModelBuildingNoticeKindSchema.options) {
      const rows = PRODUCER_ATTRIBUTION.filter((r) => r.kind === kind)
      expect(rows.length).toBeGreaterThan(0)
      const expected = rows.every((r) => r.statedByUser === true)
        ? 'user_stated'
        : rows.every((r) => r.statedByUser === false)
          ? 'olumi_authored'
          : 'mixed'
      expect(modelBuildingNoticeAttribution(kind), `kind ${kind}`).toBe(expected)
    }
  })

  it('an unknown kind is MIXED — fail-closed, never told to a user as their own', () => {
    expect(modelBuildingNoticeAttribution('a_seventh_kind_from_a_future_schema')).toBe('mixed')
    expect(modelBuildingNoticeAttribution('constructor')).toBe('mixed')
  })
})

describe('model-building notices — ⭐⭐ the attribution probe discriminates (trap 13 control)', () => {
  it('CONTROL: the probe SEES the historical defect strings — it is not blind', () => {
    // The two sentences the deployed build actually rendered. If the probe
    // cannot see these, every absence below is vacuous.
    expect(attributesToUser('Olumi left 14 things from your brief out of this model')).toBe(true)
    expect(attributesToUser('Details you mentioned that nothing connected to your goal')).toBe(true)
    expect(attributesToUser("Relationships you described that the model doesn't use")).toBe(true)
  })

  it('CONTROL: the probe is NOT a blanket ban on the second person', () => {
    // "your goal" is the user's decision, not a provenance claim about the
    // dropped item. A guard that reddened here would forbid true copy.
    expect(attributesToUser('Details that nothing connected to your goal')).toBe(false)
    expect(attributesToUser('Olumi left 4 things out of this model')).toBe(false)
  })

  it('CONTRAST: exactly ONE kind earns a user attribution, and it is the right one', () => {
    const earned = ModelBuildingNoticeKindSchema.options.filter(unanimouslyUserStated)
    // Derived from the corpus, so the expectation cannot be edited to match the
    // code. A probe that returned the same answer for all six would be
    // reporting on itself (trap 13e / trap 20).
    expect(earned).toEqual(['target_not_modelled_as_threshold'])
  })
})

describe('model-building notices — ⭐⭐ row copy attributes only what the producer supports', () => {
  it('no kind whose provenance is NOT unanimously the user claims that it is', () => {
    for (const kind of ModelBuildingNoticeKindSchema.options) {
      if (unanimouslyUserStated(kind)) continue
      const copy = describeModelBuildingNoticeKind(kind)
      expect(copy, `kind ${kind} has no phrasing`).not.toBeNull()
      expect(
        attributesToUser(copy!),
        `kind "${kind}" tells the user the item was theirs, and the producer says otherwise: "${copy}"`,
      ).toBe(false)
    }
  })

  it('the kind that IS unanimously the user\'s KEEPS its attribution — the discriminating twin', () => {
    // Deleting "you set" here would make the guard above pass for a second
    // reason and stop discriminating. Pinned so that under-attribution REDs too.
    const copy = describeModelBuildingNoticeKind('target_not_modelled_as_threshold')!
    expect(attributesToUser(copy)).toBe(true)
  })

  it('the two ABSENT rows name their subject without claiming whose it was', () => {
    // Bound by kind identity, not by scanning the rendered text for a phrase.
    expect(describeModelBuildingNoticeKind('relationship_not_used')).toBe(
      "Connections Olumi proposed but couldn't place in the model",
    )
    expect(describeModelBuildingNoticeKind('detail_not_connected')).toBe(
      'Details that nothing connected to your goal',
    )
  })

  it('the conflict row drops "from your brief" — two of its three reasons are Olumi\'s own claims', () => {
    expect(describeModelBuildingNoticeKind('conflict_resolved_conservatively')).toBe(
      "Points Olumi couldn't settle, so it took the cautious reading",
    )
  })
})

describe('model-building notices — ⭐⭐ the omission headline claims no provenance', () => {
  it('NO absent kind is unanimously the user\'s — so the headline may not attribute', () => {
    // The invariant the copy rests on, DERIVED rather than assumed. If a future
    // kind is both `absent` and unanimously stated, this REDs and the headline
    // becomes re-attributable on purpose rather than by accident.
    const absentKinds = ModelBuildingNoticeKindSchema.options.filter(
      (k) => modelBuildingNoticeOutcome(k) === 'absent',
    )
    expect(absentKinds.length).toBeGreaterThan(0)
    expect(absentKinds.filter(unanimouslyUserStated)).toEqual([])
  })

  it('plural: the whole sentence, bound by testid — "4 things" must not pass on "14 things"', () => {
    expect(headline([{ kind: 'relationship_not_used', count: 4 }])).toBe(
      'Olumi left 4 things out of this model',
    )
  })

  it('singular: the whole sentence', () => {
    expect(headline([{ kind: 'detail_not_connected', count: 1 }])).toBe(
      'Olumi left 1 thing out of this model',
    )
  })

  it('the deployed sentence is gone from the rendered headline', () => {
    const line = headline([
      { kind: 'detail_not_connected', count: 2 },
      { kind: 'relationship_not_used', count: 4 },
      { kind: 'alternative_consolidated', count: 8 },
    ])
    expect(line).not.toMatch(/from your brief/i)
    expect(attributesToUser(line)).toBe(false)
    // and it still counts only the absent rows
    expect(line).toBe('Olumi left 6 things out of this model')
  })
})

describe('model-building notices — ⭐⭐ the zero-absent arm is POSITIVELY asserted', () => {
  /**
   * ⚠ EVERY ASSERTION IN THIS BLOCK IS A POSITIVE. The audit's surviving mutant
   * (`return ''` for this whole arm) passed 44/44 precisely because the existing
   * assertions were all negatives, and a negative passes on the empty string.
   */
  it('plural: the whole sentence, on a payload with ZERO absent rows', () => {
    expect(headline([{ kind: 'alternative_consolidated', count: 5 }])).toBe(
      'Olumi made 5 modelling choices worth checking',
    )
  })

  it('singular at total_count 1 — the renderer\'s own "most likely draft of all"', () => {
    expect(headline([{ kind: 'other', count: 1 }])).toBe(
      'Olumi made 1 modelling choice worth checking',
    )
  })

  it('it reads the PRODUCER TOTAL, not the row count or the absent count', () => {
    // Discriminating fixture: 2 rows, absent count 0, producer total 7. Only
    // `totalCount` yields 7, so this cannot pass on either other quantity.
    render(
      <MessageBubble
        message={makeMsg({
          modelBuildingNotices: view([
            { kind: 'alternative_consolidated', count: 5 },
            { kind: 'other', count: 2 },
          ]),
        })}
        onChipClick={noop}
      />,
    )
    const root = screen.getByTestId('model-building-notices')
    expect(root.getAttribute('data-total-count')).toBe('7')
    expect(root.getAttribute('data-row-count')).toBe('2')
    expect(
      (screen.getByTestId('model-building-notices-toggle').textContent ?? '')
        .replace(/\s+/g, ' ')
        .trim(),
    ).toBe('Olumi made 7 modelling choices worth checking')
  })

  it('the toggle keeps an ACCESSIBLE NAME on this arm — the emptied-arm failure', () => {
    // The audit's failure scenario spelled out: an emptied arm leaves an
    // unlabelled button. `getByRole(name:)` reads the accessible name, which
    // `textContent` assertions alone do not prove.
    render(
      <MessageBubble
        message={makeMsg({
          modelBuildingNotices: view([{ kind: 'conflict_resolved_conservatively', count: 3 }]),
        })}
        onChipClick={noop}
      />,
    )
    const byName = screen.getByRole('button', {
      name: 'Olumi made 3 modelling choices worth checking',
    })
    expect(byName).toBe(screen.getByTestId('model-building-notices-toggle'))
  })

  it('this arm still makes NO omission claim and mints no zero', () => {
    const line = headline([{ kind: 'alternative_consolidated', count: 5 }])
    expect(line).not.toMatch(/left\s+\d+/i)
    expect(line).not.toMatch(/out of this model/i)
    // The positives above are what make these negatives mean anything.
    expect(line.length).toBeGreaterThan(0)
  })
})
