/**
 * ModelBuildingNoticesNotice — the rendered consumer of CEE's
 * `model_building_notices`.
 *
 * FOUR PROPERTIES CARRY THIS SLICE, each pinned so it fails for the right
 * reason:
 *
 *  1. NO MINTED ZERO. A turn with no notices renders NOTHING — not a headline,
 *     not an empty panel, not "0". Pinned through the REAL `MessageBubble`,
 *     because the mount condition is where a minted zero would be introduced.
 *  2. IDENTITY BINDING, proven by a DISCRIMINATING PAIR (CLAUDE.md trap 19).
 *     A row is asserted via `data-notice-kind` — the producer's own enum member
 *     — never via description text, which is UI copy another row could be
 *     edited to carry.
 *  3. NO RAW WIRE VOCABULARY. The kind codes must not reach the DOM as text.
 *     This is the estate's live defect (`existence_boundary_crossing`), so it
 *     is pinned as an absence over the bubble's whole text content, not merely
 *     over this component's own markup.
 *  4. PROGRESSIVE DISCLOSURE. Collapsed by default; the per-kind breakdown and
 *     the next-route pointer appear only after the toggle.
 *
 * MOUNT (trap 3b — this estate has twice shipped a badge dark by testing a
 * component the deployed flags do not mount): every assertion below drives
 * `MessageBubble`, and NOTHING here sets a flag, because CEE emits
 * unconditionally and this consumer is deliberately unflagged. A test that
 * rendered `ModelBuildingNoticesNotice` directly would pass identically if the
 * mount were deleted — which is the whole failure mode.
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MessageBubble } from '../MessageBubble'
import type { ConversationMessage } from '../types'
import {
  MODEL_BUILDING_NOTICES_POINTER,
  toModelBuildingNoticesView,
  type ModelBuildingNoticesView,
} from '../modelBuildingNotices'

const noop = async () => {}

function makeMsg(overrides: Partial<ConversationMessage> = {}): ConversationMessage {
  return {
    id: 'msg-mbn-1',
    role: 'assistant',
    content: "Here's a first model of your pricing decision.",
    timestamp: new Date(),
    ...overrides,
  }
}

/**
 * Built through the PRODUCTION shaper from a payload that satisfies the
 * published schema's two cross-field rules (unique kinds; total = sum), so the
 * fixture cannot drift away from what the wire can actually carry.
 */
const twoKinds: ModelBuildingNoticesView = toModelBuildingNoticesView({
  total_count: 3,
  groups: [
    { kind: 'detail_not_connected', count: 2 },
    { kind: 'relationship_not_used', count: 1 },
  ],
  details_redacted: true,
})

describe('ModelBuildingNoticesNotice — ⭐ no minted zero (no payload ⇒ no claim)', () => {
  it('a reply with NO modelBuildingNotices renders no notice at all', () => {
    render(<MessageBubble message={makeMsg()} onChipClick={noop} />)
    expect(screen.queryByTestId('model-building-notices')).toBeNull()
    expect(screen.queryByTestId('model-building-notices-toggle')).toBeNull()
  })

  it('the reply with no attestation makes NO claim IN EITHER DIRECTION', () => {
    // The strong form: not merely "the testid is absent", but that neither
    // kind of fabrication reaches the DOM under any other markup.
    //
    // The contract CANNOT ENCODE ZERO (`total_count` positive, `groups` min 1),
    // so an absent field means NO ATTESTATION WAS SUPPLIED — not "nothing was
    // dropped". Both directions are therefore banned, and the second is the
    // more dangerous one: a completeness reassurance built on a silent field is
    // a positive claim with no evidence behind it at all.
    const { container } = render(<MessageBubble message={makeMsg()} onChipClick={noop} />)
    // (a) no minted omission
    expect(container.textContent).not.toMatch(/left\s+\d+/i)
    expect(container.textContent).not.toMatch(/out of this model/i)
    // (b) no minted completeness
    expect(container.textContent).not.toMatch(/nothing was (left|dropped|omitted)/i)
    expect(container.textContent).not.toMatch(/captured (in full|everything)/i)
    expect(container.textContent).not.toMatch(/complete model|fully represented/i)
  })

  it('a USER message never carries the notice, even with a payload attached', () => {
    // An omission is a fact about a model OLUMI built. The user's bubble is not one.
    render(
      <MessageBubble
        message={makeMsg({ role: 'user', modelBuildingNotices: twoKinds })}
        onChipClick={noop}
      />,
    )
    expect(screen.queryByTestId('model-building-notices')).toBeNull()
  })
})

describe('ModelBuildingNoticesNotice — ⭐ identity binding (DISCRIMINATING PAIR, trap 19)', () => {
  it('renders one row per producer group, bound by the producer kind', async () => {
    const user = userEvent.setup()
    render(
      <MessageBubble
        message={makeMsg({ modelBuildingNotices: twoKinds })}
        onChipClick={noop}
      />,
    )
    await user.click(screen.getByTestId('model-building-notices-toggle'))

    const rows = screen.getAllByRole('listitem').filter((li) => li.hasAttribute('data-notice-kind'))
    expect(rows).toHaveLength(2)
    // Bound BY IDENTITY to the producer's enum members, in producer order.
    expect(rows.map((r) => r.getAttribute('data-notice-kind'))).toEqual([
      'detail_not_connected',
      'relationship_not_used',
    ])
    // And the count travels with its OWN kind, not merely "a 2 appears".
    const detailRow = rows.find((r) => r.getAttribute('data-notice-kind') === 'detail_not_connected')
    expect(detailRow?.textContent).toMatch(/\b2\b/)
  })

  it('the headline count is the PRODUCER total, not the rendered row count', () => {
    // These are different quantities by design (an unnameable kind is dropped
    // from rows while total_count stays the producer's). Pinning the two
    // separately is what stops a future edit from collapsing them.
    render(
      <MessageBubble
        message={makeMsg({ modelBuildingNotices: twoKinds })}
        onChipClick={noop}
      />,
    )
    const root = screen.getByTestId('model-building-notices')
    expect(root.getAttribute('data-total-count')).toBe('3')
    expect(root.getAttribute('data-row-count')).toBe('2')
    expect(screen.getByTestId('model-building-notices-toggle').textContent).toContain('3 things')
  })

  it('singular copy at exactly one omission', () => {
    const one = toModelBuildingNoticesView({
      total_count: 1,
      groups: [{ kind: 'other', count: 1 }],
      details_redacted: true,
    })
    render(
      <MessageBubble message={makeMsg({ modelBuildingNotices: one })} onChipClick={noop} />,
    )
    const toggle = screen.getByTestId('model-building-notices-toggle')
    expect(toggle.textContent).toContain('1 thing from your brief')
    expect(toggle.textContent).not.toContain('1 things')
  })
})

/**
 * ⭐ ROW-LEVEL COPY. THIS SUITE PREVIOUSLY GUARDED ONLY THE HEADLINE.
 *
 * The singular/plural mutant (M5) pointed at `modelBuildingNoticesSummary` and
 * bit cleanly — which made the kit LOOK like it covered number agreement, while
 * every ROW was rendering "1 Alternatives that were merged into a single option"
 * at `count: 1`. A guard aimed at one of two surfaces reports on one of two
 * surfaces; the green result said nothing about the other (CLAUDE.md trap 22:
 * presence of a guard is not coverage of its input).
 *
 * `count: 1` is not an edge case here — `total_count: 1` is the most likely
 * draft the producer emits, so this was the MODAL rendering, one line beneath a
 * headline that gets singular right.
 *
 * The fix is structural rather than lexical: the count is a TRAILING quantity,
 * so it never has to agree with a fixed-number category label. These assertions
 * are therefore written against the SHAPE (no bare leading numeral), not against
 * a particular phrasing — a future copy edit that reintroduces a leading count
 * REDs even if it words the descriptions differently.
 */
describe('ModelBuildingNoticesNotice — ⭐ row copy reads correctly at EVERY count', () => {
  /** Every kind at count 1 — the modal draft, and the one that read wrongly. */
  const allKindsAtOne = toModelBuildingNoticesView({
    total_count: 6,
    groups: [
      { kind: 'detail_not_connected', count: 1 },
      { kind: 'relationship_not_used', count: 1 },
      { kind: 'alternative_consolidated', count: 1 },
      { kind: 'conflict_resolved_conservatively', count: 1 },
      { kind: 'target_not_modelled_as_threshold', count: 1 },
      { kind: 'other', count: 1 },
    ],
    details_redacted: true,
  })

  async function expandRows(view: ModelBuildingNoticesView) {
    const user = userEvent.setup()
    render(
      <MessageBubble message={makeMsg({ modelBuildingNotices: view })} onChipClick={noop} />,
    )
    await user.click(screen.getByTestId('model-building-notices-toggle'))
    return screen.getAllByRole('listitem').filter((li) => li.hasAttribute('data-notice-kind'))
  }

  it('NO row begins with a bare numeral — at count 1, for any of the six kinds', async () => {
    const rows = await expandRows(allKindsAtOne)
    expect(rows).toHaveLength(6)
    for (const row of rows) {
      const text = (row.textContent ?? '').trim()
      // The defect shape: a digit, then whitespace, then the category label.
      expect(
        text,
        `row "${row.getAttribute('data-notice-kind')}" leads with a bare numeral: ${text}`,
      ).not.toMatch(/^\d+\s/)
      // And it must still state the quantity somewhere — dropping the count to
      // dodge agreement would pass a "no leading numeral" check while losing
      // information the producer sent.
      expect(text).toMatch(/\(1\)/)
    }
  })

  it('a row states its OWN count as a trailing quantity, bound by kind', async () => {
    // Identity binding: the 4 travels with `relationship_not_used`, not merely
    // "a 4 appears somewhere in the list".
    const mixed = toModelBuildingNoticesView({
      total_count: 5,
      groups: [
        { kind: 'detail_not_connected', count: 1 },
        { kind: 'relationship_not_used', count: 4 },
      ],
      details_redacted: true,
    })
    const rows = await expandRows(mixed)
    const byKind = (k: string) =>
      (rows.find((r) => r.getAttribute('data-notice-kind') === k)?.textContent ?? '').trim()

    expect(byKind('detail_not_connected')).toMatch(/\(1\)$/)
    expect(byKind('relationship_not_used')).toMatch(/\(4\)$/)
    expect(byKind('detail_not_connected')).not.toMatch(/^\d/)
    expect(byKind('relationship_not_used')).not.toMatch(/^\d/)
  })

  it('the singular HEADLINE and the singular ROW agree on the same payload', async () => {
    // The two surfaces sit one line apart, so a mismatch is conspicuous. This
    // pins them TOGETHER — the assertion the kit was missing when the headline
    // was guarded alone.
    const one = toModelBuildingNoticesView({
      total_count: 1,
      groups: [{ kind: 'alternative_consolidated', count: 1 }],
      details_redacted: true,
    })
    const rows = await expandRows(one)
    expect(screen.getByTestId('model-building-notices-toggle').textContent).toContain(
      '1 thing from your brief',
    )
    expect(rows).toHaveLength(1)
    expect((rows[0].textContent ?? '').trim()).not.toMatch(/^1\s/)
  })
})

describe('ModelBuildingNoticesNotice — ⭐ no raw wire vocabulary reaches the user', () => {
  it('no kind code appears as text anywhere in the bubble, expanded or collapsed', async () => {
    const user = userEvent.setup()
    const all = toModelBuildingNoticesView({
      total_count: 6,
      groups: [
        { kind: 'detail_not_connected', count: 1 },
        { kind: 'relationship_not_used', count: 1 },
        { kind: 'alternative_consolidated', count: 1 },
        { kind: 'conflict_resolved_conservatively', count: 1 },
        { kind: 'target_not_modelled_as_threshold', count: 1 },
        { kind: 'other', count: 1 },
      ],
      details_redacted: true,
    })
    const { container } = render(
      <MessageBubble message={makeMsg({ modelBuildingNotices: all })} onChipClick={noop} />,
    )
    await user.click(screen.getByTestId('model-building-notices-toggle'))

    // Every enum member, checked as TEXT (attributes are provenance, not copy).
    for (const code of [
      'detail_not_connected',
      'relationship_not_used',
      'alternative_consolidated',
      'conflict_resolved_conservatively',
      'target_not_modelled_as_threshold',
    ]) {
      expect(container.textContent).not.toContain(code)
    }
    // Snake_case in general — catches a new code added without a phrasing.
    expect(container.textContent).not.toMatch(/[a-z]+_[a-z]+_[a-z]+/)
    // `details_redacted` is a wire mechanic, never user copy.
    expect(container.textContent).not.toMatch(/redact/i)
  })
})

describe('ModelBuildingNoticesNotice — ⭐ a headline with no nameable row is silence', () => {
  it('renders NOTHING when every kind is unnameable, rather than a bare count', () => {
    // "Olumi left 4 things out" with no breakdown and no route is a dead end by
    // the product's own definition — it reports a loss the user cannot act on.
    // Reached only via a future enum widening (see the wire spec), so it is
    // built through the shaper with a cast, exactly as that suite does.
    const unnameable = toModelBuildingNoticesView({
      total_count: 4,
      groups: [{ kind: 'a_kind_added_after_this_ui' as never, count: 4 }],
      details_redacted: true,
    })
    const { container } = render(
      <MessageBubble
        message={makeMsg({ modelBuildingNotices: unnameable })}
        onChipClick={noop}
      />,
    )
    expect(screen.queryByTestId('model-building-notices')).toBeNull()
    expect(container.textContent).not.toMatch(/out of this model/i)
    expect(container.textContent).not.toContain('a_kind_added_after_this_ui')
  })
})

describe('ModelBuildingNoticesNotice — ⭐ progressive disclosure', () => {
  it('collapsed by default: the summary shows, the breakdown and pointer do not', () => {
    render(
      <MessageBubble
        message={makeMsg({ modelBuildingNotices: twoKinds })}
        onChipClick={noop}
      />,
    )
    expect(screen.getByTestId('model-building-notices-toggle')).toHaveAttribute(
      'aria-expanded',
      'false',
    )
    expect(screen.queryByTestId('model-building-notices-pointer')).toBeNull()
    expect(
      screen.queryAllByRole('listitem').filter((li) => li.hasAttribute('data-notice-kind')),
    ).toHaveLength(0)
  })

  it('expanding reveals the breakdown AND the next-route pointer', async () => {
    const user = userEvent.setup()
    render(
      <MessageBubble
        message={makeMsg({ modelBuildingNotices: twoKinds })}
        onChipClick={noop}
      />,
    )
    await user.click(screen.getByTestId('model-building-notices-toggle'))

    expect(screen.getByTestId('model-building-notices-toggle')).toHaveAttribute(
      'aria-expanded',
      'true',
    )
    // The route, not a dead end — the founder's binding product constraint.
    expect(screen.getByTestId('model-building-notices-pointer').textContent).toBe(
      MODEL_BUILDING_NOTICES_POINTER,
    )
  })
})
