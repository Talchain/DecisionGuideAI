/**
 * Which links the canvas marks as tested (accel P24 / SCI-10; the mark itself is the Canvas lane's, P36(1)).
 *
 * A link is marked only from a result the conversation SHOWS (`displayableMethodResult`: a figure-bearing outcome,
 * every row in its reply) and only while that result's Run is the Run on screen (Science 393023 ruling 3). A
 * "What would change this?" result marks every link its rows name; CEE sends rows only for links with a measured
 * tipping point, never a `no_change` link. A later result for the same link replaces an earlier one.
 */
import { displayableMethodResult, sameMethodRun, type MethodResultV1, type MethodRunStamp } from '../../v5/readMethodResult'

export const TESTED_LINK_MARK_LABEL = { test_link: 'Tested without this link', what_changes: 'Checked: what would change this' } as const

export type TestedLinkMark = {
  readonly fromId: string
  readonly toId: string
  readonly actionId: keyof typeof TESTED_LINK_MARK_LABEL
  readonly label: string
  /** The card's message, so a click can bring the reply into view. */
  readonly messageId: string
}

export const testedLinkKey = (fromId: string, toId: string): string => `${fromId}->${toId}`

export function testedLinkMarks(
  messages: ReadonlyArray<{ id: string; content: string; methodResult?: MethodResultV1 | null }>,
  current: MethodRunStamp | null | undefined,
): ReadonlyMap<string, TestedLinkMark> {
  const marks = new Map<string, TestedLinkMark>()
  for (const message of messages) {
    const m = displayableMethodResult(message.methodResult, message.content)
    if (!m || !sameMethodRun(m, current)) continue
    const actionId = m.action_id as keyof typeof TESTED_LINK_MARK_LABEL
    for (const row of m.rows) for (const ref of row.item_refs) {
      if (ref.kind !== 'link') continue
      marks.set(testedLinkKey(ref.from_id, ref.to_id), {
        fromId: ref.from_id, toId: ref.to_id, actionId, label: TESTED_LINK_MARK_LABEL[actionId], messageId: message.id,
      })
    }
  }
  return marks
}
