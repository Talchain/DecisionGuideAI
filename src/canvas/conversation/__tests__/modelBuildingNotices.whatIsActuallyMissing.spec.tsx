/**
 * ⭐⭐ THE HEADLINE COUNTED THINGS THAT ARE STILL IN THE MODEL.
 *
 * Witnessed on the deployed build, 11 Sep 2026, on a ~60-word brief:
 *
 *     "Olumi left 14 things from your brief out of this model"
 *
 * ── WHAT THE 14 ACTUALLY ARE, DERIVED AT THE PRODUCER ───────────────────────
 * `total_count` is the size of `projection.dropped[]` — every disclosure the
 * record projector emits while turning a draft into a graph. CEE maps 20
 * producer reasons onto the contract's 6 kinds
 * (`cee/draft/records/model-building-notices.ts:78-176`), and the reasons are
 * declared with their semantics at `cee/draft/records/projector.ts:352-615`.
 *
 * Read there, NINE of the twenty describe content that IS IN THE MODEL, and
 * two whole KINDS are unanimous about it. The producer says so in its own
 * words, quoted below at `PRODUCER_CORPUS`; the sharpest are:
 *
 *   constraint_direction_unstated       "The node keeps the user's words; the
 *                                        THRESHOLD is withheld until the
 *                                        direction is known. THIS IS THE ASK,
 *                                        NOT A LOSS."
 *   claim_label_not_a_name              "The node IS on the graph ... NOTHING
 *                                        WAS DROPPED, refused or shortened."
 *   refinement_merged_into_stated_option "The projector BINDS IT TO THE
 *                                        PARENT'S NODE."
 *
 * ⚠ AND A SECOND FALSE CLAIM IN THE SAME SENTENCE: "FROM YOUR BRIEF". Every
 * reason under `alternative_consolidated` disposes of MODEL-EMITTED content —
 * "a MODEL-emitted option whose intervention signature is IDENTICAL to a
 * USER-STATED option's" — and `option_budget_exceeded` cannot touch the user's
 * words at all ("A STATED option is NEVER dropped for budget"). So the headline
 * told users their own words were dropped while Olumi was tidying its own
 * duplicate suggestions.
 *
 * ── WHAT THIS SUITE PINS ────────────────────────────────────────────────────
 * The headline may only count what the wire supports the claim for: kinds where
 * EVERY producer reason mapped to them puts the content outside the model. That
 * is `relationship_not_used` and `detail_not_connected`, and nothing else.
 *
 * ⚠ BOUND BY IDENTITY, NEVER BY THE COUNT STRING (trap 19). Every assertion
 * below reaches its subject through `data-notice-kind` — the producer's own
 * enum member — or through a payload built for ONE kind. An assertion that
 * matched "14" or "6" in the text would pass on any row that happened to carry
 * that number, which is exactly the defect this file exists to close.
 *
 * MOUNT (trap 3b): every rendering assertion drives the real `MessageBubble`,
 * as its sibling suite does, so a deleted mount REDs here too.
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ModelBuildingNoticeKindSchema } from '@talchain/schemas/boundary'
import type { ModelBuildingNoticeKind } from '@talchain/schemas/boundary'
import { MessageBubble } from '../MessageBubble'
import type { ConversationMessage } from '../types'
import {
  OUTCOME_HEADINGS,
  absentCountOf,
  modelBuildingNoticeOutcome,
  modelBuildingNoticesSummary,
  toModelBuildingNoticesView,
  type ModelBuildingNoticesView,
} from '../modelBuildingNotices'

const noop = async () => {}

function makeMsg(overrides: Partial<ConversationMessage> = {}): ConversationMessage {
  return {
    id: 'msg-mbn-missing-1',
    role: 'assistant',
    content: "Here's a first model of your pricing decision.",
    timestamp: new Date(),
    ...overrides,
  }
}

function view(groups: Array<{ kind: ModelBuildingNoticeKind; count: number }>) {
  return toModelBuildingNoticesView({
    total_count: groups.reduce((s, g) => s + g.count, 0),
    groups,
    details_redacted: true,
  })
}

async function expand(v: ModelBuildingNoticesView) {
  const user = userEvent.setup()
  const { container } = render(
    <MessageBubble message={makeMsg({ modelBuildingNotices: v })} onChipClick={noop} />,
  )
  await user.click(screen.getByTestId('model-building-notices-toggle'))
  return container
}

/**
 * ⭐⭐ THE ORACLE, AND IT COMES FROM THE PRODUCER, NOT FROM THIS AUTHOR.
 *
 * One row per reason in CEE's `NOTICE_KIND_BY_REASON`. `inModel` is the
 * PRODUCER's answer to "is the thing this discloses still in the graph?",
 * quoted from its declaration at `projector.ts`, never inferred from the
 * reason's name (trap 13c: a mutant kit measures whether a test can detect a
 * change, never whether the expectation is right).
 *
 * ⚠ THIS IS A HAND-WRITTEN CORPUS AND THAT IS DELIBERATE (trap 12d). The
 * classification under test is DERIVED from this table's shape; derivation
 * proves the consumers agree with the list and can never prove the list is
 * right. A corpus is the only thing that notices the list is short, so it is
 * written out in full with the producer's own words beside each entry.
 */
const PRODUCER_CORPUS: ReadonlyArray<{
  reason: string
  kind: ModelBuildingNoticeKind
  inModel: boolean
  because: string
}> = [
  // ── relationship_not_used — the LINK is absent in all eight ────────────────
  { reason: 'unparseable_ref', kind: 'relationship_not_used', inModel: false, because: 'unresolved reference; no edge minted' },
  { reason: 'ref_out_of_range', kind: 'relationship_not_used', inModel: false, because: 'unresolved reference; no edge minted' },
  { reason: 'ref_target_not_a_node', kind: 'relationship_not_used', inModel: false, because: 'unresolved reference; no edge minted' },
  { reason: 'self_loop', kind: 'relationship_not_used', inModel: false, because: 'refused; no edge minted' },
  { reason: 'missing_ref', kind: 'relationship_not_used', inModel: false, because: 'unresolved reference; no edge minted' },
  { reason: 'ambiguous_ref', kind: 'relationship_not_used', inModel: false, because: '"the projector has no basis for preferring either, so it refuses"' },
  { reason: 'ref_kind_illegal', kind: 'relationship_not_used', inModel: false, because: '"cannot form a legal edge under any repair"' },
  { reason: 'endpoint_demoted_duplicate', kind: 'relationship_not_used', inModel: false, because: '"a link whose endpoint was demoted"' },

  // ── detail_not_connected — the RECORD is withdrawn in both ─────────────────
  { reason: 'unconnected_to_goal', kind: 'detail_not_connected', inModel: false, because: '"projected as a node and then WITHDRAWN"' },
  { reason: 'disconnected_by_shape_gate', kind: 'detail_not_connected', inModel: false, because: '"the connectivity prune WITHDRAWS any factor/constraint that cannot reach the goal"' },

  // ── alternative_consolidated — PRESENT in all three ────────────────────────
  { reason: 'refinement_merged_into_stated_option', kind: 'alternative_consolidated', inModel: true, because: '"the projector BINDS IT TO THE PARENT\'S NODE"; "every link ... lands on the parent"' },
  { reason: 'undeveloped_duplicate_of_stated', kind: 'alternative_consolidated', inModel: true, because: 'a MODEL option duplicating a STATED one; "a STATED option is NEVER demoted"' },
  { reason: 'undeveloped_duplicate_of_model', kind: 'alternative_consolidated', inModel: true, because: 'two MODEL options, "the lowest claim index is KEPT"; no stated member in the group' },

  // ── conflict_resolved_conservatively — PRESENT in all three ────────────────
  { reason: 'parallel_intervention_conflict', kind: 'conflict_resolved_conservatively', inModel: true, because: '"One was CHOSEN canonically"' },
  { reason: 'parallel_causal_link_conflict', kind: 'conflict_resolved_conservatively', inModel: true, because: '"One is chosen canonically"' },
  { reason: 'constraint_direction_unstated', kind: 'conflict_resolved_conservatively', inModel: true, because: '"The node KEEPS THE USER\'S WORDS ... THIS IS THE ASK, NOT A LOSS."' },

  // ── target_not_modelled_as_threshold — MIXED ───────────────────────────────
  { reason: 'stated_target_not_represented_as_threshold', kind: 'target_not_modelled_as_threshold', inModel: true, because: '"It is ON THE GRAPH as the user\'s own words"' },
  { reason: 'stated_target_value_dropped', kind: 'target_not_modelled_as_threshold', inModel: false, because: '"that number reached the graph NOWHERE ... the 8 discarded"' },

  // ── other — MIXED ──────────────────────────────────────────────────────────
  { reason: 'claim_label_not_a_name', kind: 'other', inModel: true, because: '"The node IS on the graph ... NOTHING WAS DROPPED, refused or shortened"' },
  { reason: 'factor_merged_into_stated_cause', kind: 'other', inModel: true, because: '"MODEL-origin content into a USER-stated node"' },
  { reason: 'option_budget_exceeded', kind: 'other', inModel: false, because: '"left OFF the graph to bring it inside the bound"' },
]

describe('model-building notices — ⭐⭐ the classification answers the PRODUCER, not the kind name', () => {
  it('classifies a kind ABSENT only when EVERY producer reason under it is absent', () => {
    // Derived from the corpus, so the expectation cannot be quietly edited to
    // match the code: the set is COMPUTED here and compared to the module's.
    const kinds = ModelBuildingNoticeKindSchema.options
    const unanimouslyAbsent = new Set(
      kinds.filter((kind) => {
        const rows = PRODUCER_CORPUS.filter((r) => r.kind === kind)
        expect(rows.length).toBeGreaterThan(0) // the corpus covers every kind
        return rows.every((r) => !r.inModel)
      }),
    )

    // This is the load-bearing claim. `alternative_consolidated` and
    // `conflict_resolved_conservatively` have ZERO absent reasons, so the
    // headline may never count them as things left out.
    expect([...unanimouslyAbsent].sort()).toEqual(
      ['detail_not_connected', 'relationship_not_used'].sort(),
    )

    for (const kind of kinds) {
      expect(modelBuildingNoticeOutcome(kind) === 'absent').toBe(unanimouslyAbsent.has(kind))
    }
  })

  it('never classifies as ABSENT a kind whose producer reasons are all in-model', () => {
    for (const kind of ['alternative_consolidated', 'conflict_resolved_conservatively'] as const) {
      expect(PRODUCER_CORPUS.filter((r) => r.kind === kind).every((r) => r.inModel)).toBe(true)
      expect(modelBuildingNoticeOutcome(kind)).toBe('present_changed')
    }
  })

  it('a MIXED kind is neither claimed absent nor claimed present', () => {
    for (const kind of ['target_not_modelled_as_threshold', 'other'] as const) {
      const rows = PRODUCER_CORPUS.filter((r) => r.kind === kind)
      expect(rows.some((r) => r.inModel)).toBe(true)
      expect(rows.some((r) => !r.inModel)).toBe(true)
      expect(modelBuildingNoticeOutcome(kind)).toBe('other_notes')
    }
  })

  it('every enum member has an outcome — a seventh kind cannot render unclassified', () => {
    for (const kind of ModelBuildingNoticeKindSchema.options) {
      expect(['absent', 'present_changed', 'other_notes']).toContain(
        modelBuildingNoticeOutcome(kind),
      )
    }
  })
})

describe('model-building notices — ⭐⭐ the headline counts only what is genuinely missing', () => {
  it('counts the ABSENT kinds, not total_count', () => {
    // 6 absent (2 + 4), 8 not (5 + 3). total_count is 14 — the deployed figure.
    const v = view([
      { kind: 'detail_not_connected', count: 2 },
      { kind: 'relationship_not_used', count: 4 },
      { kind: 'alternative_consolidated', count: 5 },
      { kind: 'conflict_resolved_conservatively', count: 3 },
    ])
    expect(v.totalCount).toBe(14)
    expect(absentCountOf(v.rows)).toBe(6)

    const line = modelBuildingNoticesSummary(v)
    expect(line).toContain('6 things')
    // ⭐ THE DEPLOYED DEFECT, PINNED. 14 is a true total and a FALSE omission
    // count, and this is the assertion that reddens if it comes back.
    expect(line).not.toContain('14')
  })

  it('a payload of ONLY in-model kinds makes NO omission claim at all', async () => {
    // Bound by identity: one kind, and the producer says all three of its
    // reasons leave the content in the model. Whatever the copy says, it may
    // not say anything was left out.
    const v = view([{ kind: 'alternative_consolidated', count: 9 }])
    expect(absentCountOf(v.rows)).toBe(0)

    const container = await expand(v)
    expect(container.textContent).not.toMatch(/left\s+\d+\s+thing/i)
    expect(container.textContent).not.toMatch(/out of this model/i)
    // And no minted zero in the other direction either.
    expect(container.textContent).not.toMatch(/left\s+0\b/i)
    // The rows are still shown — silence would be its own dishonesty.
    expect(container.querySelectorAll('[data-notice-kind]')).toHaveLength(1)
  })

  it('a MIXED-only payload makes no omission claim either — the wire cannot support one', () => {
    const v = view([
      { kind: 'target_not_modelled_as_threshold', count: 2 },
      { kind: 'other', count: 1 },
    ])
    expect(absentCountOf(v.rows)).toBe(0)
    expect(modelBuildingNoticesSummary(v)).not.toMatch(/left\s+\d+/i)
  })

  it('singular and plural agree with the ABSENT count, not the total', () => {
    const one = view([
      { kind: 'relationship_not_used', count: 1 },
      { kind: 'alternative_consolidated', count: 7 },
    ])
    const line = modelBuildingNoticesSummary(one)
    expect(line).toContain('1 thing from your brief')
    expect(line).not.toContain('1 things')
    expect(line).not.toContain('8')
  })
})

describe('model-building notices — ⭐ the breakdown separates loss from handling', () => {
  const mixed = view([
    { kind: 'detail_not_connected', count: 2 },
    { kind: 'relationship_not_used', count: 4 },
    { kind: 'alternative_consolidated', count: 5 },
    { kind: 'conflict_resolved_conservatively', count: 3 },
    { kind: 'target_not_modelled_as_threshold', count: 1 },
    { kind: 'other', count: 1 },
  ])

  it('groups every row under the heading its PRODUCER semantics earn', async () => {
    const container = await expand(mixed)

    for (const outcome of ['absent', 'present_changed', 'other_notes'] as const) {
      const group = container.querySelector(`[data-notice-outcome="${outcome}"]`)
      expect(group, `group missing: ${outcome}`).not.toBeNull()
      expect(group!.textContent).toContain(OUTCOME_HEADINGS[outcome])

      // BOUND BY IDENTITY: the kinds inside this group are exactly the enum
      // members the classification assigns to it — never "the rows that look
      // right".
      const kindsInGroup = [...group!.querySelectorAll('[data-notice-kind]')]
        .map((el) => el.getAttribute('data-notice-kind') as ModelBuildingNoticeKind)
        .sort()
      const expected = ModelBuildingNoticeKindSchema.options
        .filter((k) => modelBuildingNoticeOutcome(k) === outcome)
        .sort()
      expect(kindsInGroup).toEqual(expected)
    }
  })

  it('the LOSS group comes first — it is the one the user can act on', async () => {
    const container = await expand(mixed)
    const order = [...container.querySelectorAll('[data-notice-outcome]')].map((el) =>
      el.getAttribute('data-notice-outcome'),
    )
    expect(order).toEqual(['absent', 'present_changed', 'other_notes'])
  })

  it('renders no empty group — a heading with no rows under it says nothing true', async () => {
    const container = await expand(view([{ kind: 'relationship_not_used', count: 2 }]))
    expect(
      [...container.querySelectorAll('[data-notice-outcome]')].map((el) =>
        el.getAttribute('data-notice-outcome'),
      ),
    ).toEqual(['absent'])
    expect(container.textContent).not.toContain(OUTCOME_HEADINGS.present_changed)
    expect(container.textContent).not.toContain(OUTCOME_HEADINGS.other_notes)
  })

  it('every group heading and row description stays free of wire vocabulary', async () => {
    const container = await expand(mixed)
    expect(container.textContent).not.toMatch(/[a-z]+_[a-z]+_[a-z]+/)
  })
})

describe('model-building notices — ⭐ the row copy is true of EVERY reason mapped to its kind', () => {
  /**
   * The two descriptions that were false against the producer, pinned as
   * absences so a revert REDs. Neither is a phrasing preference:
   *
   *  · `detail_not_connected` read "aren't LINKED to anything else yet", which
   *    says the detail is on the graph and unlinked. The producer WITHDRAWS it.
   *  · `other` read "didn't FIT the model", which is false for
   *    `claim_label_not_a_name` ("the node IS on the graph") and for
   *    `factor_merged_into_stated_cause`.
   */
  it('does not claim a withdrawn detail is merely unlinked', async () => {
    const container = await expand(view([{ kind: 'detail_not_connected', count: 1 }]))
    const row = container.querySelector('[data-notice-kind="detail_not_connected"]')!
    expect(row.textContent).not.toMatch(/linked to anything else/i)
  })

  it('does not claim in-model content "didn\'t fit"', async () => {
    const container = await expand(view([{ kind: 'other', count: 1 }]))
    const row = container.querySelector('[data-notice-kind="other"]')!
    expect(row.textContent).not.toMatch(/didn't fit|did not fit/i)
  })

  it('does not tell the user their own alternatives were merged', async () => {
    // Every reason under this kind disposes of MODEL-emitted content. Copy
    // saying "your alternatives" would be the exact mis-attribution the
    // producer refuses to make at `factor_merged_into_stated_cause`.
    const container = await expand(view([{ kind: 'alternative_consolidated', count: 1 }]))
    const row = container.querySelector('[data-notice-kind="alternative_consolidated"]')!
    expect(row.textContent).not.toMatch(/your alternatives/i)
  })
})
