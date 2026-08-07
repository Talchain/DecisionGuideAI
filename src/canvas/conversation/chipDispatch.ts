/**
 * Chip dispatchability — ONE predicate, for every chip row.
 *
 * ─── The defect this module exists to close (ROADMAP 2.138) ────────────────
 * A chip row must not render a chip nothing can act on: `sendChip` throws on a
 * chip with no `message`/`prompt`, so an unfiltered row would promise an action
 * and deliver an error. Both rows therefore filtered — and both filtered with
 * their OWN hand-written copy of the rule:
 *
 *     ActionChipRow.tsx   c.intent === 'undo' || !!c.message
 *     SuggestedChips.tsx  !!(c.message || c.prompt)
 *     ChatThread.tsx      !!c.message              (the hide-inline-chips mirror)
 *
 * Three copies, none agreeing, and none of them knowing about the THIRD class of
 * chip: the ones `ConversationPanel.handleChipClick` routes BY ID to a local
 * handler and which therefore never reach `sendChip` at all. Those chips carry
 * no `message` BY DESIGN — there is no message to send — so every copy of the
 * rule silently dropped them.
 *
 * 2.134's live probe caught the consequence: the stopped-draft and
 * connection-drop notices both say "start a new draft to get a model with
 * settled values" and both rendered with an EMPTY chip wrapper. The user was
 * told the remedy and given no button; the handler (`startNewDraft`) existed,
 * was correct, and had no reachable caller.
 *
 * ─── Why the fix is here and not at the mint site ──────────────────────────
 * The other available "fix" was to give the chip a `message` so it satisfies the
 * filters. That would be a decoy: `message` is documented as "Message sent to
 * orchestrator when chip is tapped", and this chip's click NEVER sends it —
 * `startNewDraft` sends `lastUserInputRef`, on a fresh scenario. The field would
 * exist purely to fool a guard, and it would arm a live regression: if the
 * id-route below were ever renamed or removed, the chip would stop failing
 * loudly and start quietly POSTing that decoy to CEE as a chat turn. The filter
 * was over-narrow; the chip's shape was right.
 */

import type { ActionChip } from './types'

/**
 * Chips `ConversationPanel.handleChipClick` routes by id to a local handler.
 * They never reach `sendChip`, so they carry no `message`.
 *
 * The union is load-bearing: `ConversationPanel` builds its router as a
 * `Record<LocallyRoutedChipId, …>`, so adding an id here without wiring a
 * handler is a TYPECHECK ERROR rather than a silently dead chip.
 */
export const RETRY_CHIP_ID = 'retry'
export const START_NEW_DRAFT_CHIP_ID = 'start_new_draft'
export type LocallyRoutedChipId = typeof RETRY_CHIP_ID | typeof START_NEW_DRAFT_CHIP_ID

/**
 * Of the locally-routed chips, the ones a chip row must RENDER.
 *
 * `retry` is deliberately absent, and the omission is a product decision, not an
 * oversight — recorded here so it cannot be mistaken for one again:
 *
 *   - `retry` is minted at NINE sites in `useConversation.ts` (transport failure,
 *     typed error, stuck-stream recovery, timeout, decline…), and every one of
 *     those bubbles ALREADY carries a retry affordance: `MessageActions` renders
 *     a hover/focus-revealed Retry on assistant messages (`ChatMessage.tsx`), and
 *     the failed-send path additionally renders "Not delivered → Retry" on the
 *     user's own bubble (`MessageBubble.tsx`), both wired to the same `retryLast`.
 *     Rendering the chip too is a change to nine error surfaces with its own copy
 *     and duplicate-affordance questions — a product slice, not this defect.
 *   - `start_new_draft` has NO alternative affordance anywhere. Resetting the
 *     canvas AND minting a fresh scenario is not something the user can do from
 *     any other control, and the notice's copy explicitly instructs them to do it.
 *
 * So: this set is what the ROWS show; the union above is what the ROUTER handles.
 * They are allowed to differ, but only on purpose and only in writing.
 */
const RENDERABLE_LOCAL_CHIP_IDS: ReadonlySet<string> = new Set<LocallyRoutedChipId>([
  START_NEW_DRAFT_CHIP_ID,
])

/**
 * Can this chip's click reach a handler that does something?
 *
 * The three routes, in the order the click takes them:
 *   1. id-routed local handler   (`ConversationPanel.handleChipClick`)
 *   2. `intent === 'undo'`       (`sendChip` → `undoDraft`, no message needed)
 *   3. `message` / `prompt`      (`sendChip` → `dispatchAction`, the normal path)
 *
 * Anything else would land in `sendChip`'s final branch and throw, so it must
 * not be rendered.
 */
export function isChipRenderable(chip: ActionChip): boolean {
  if (RENDERABLE_LOCAL_CHIP_IDS.has(chip.id)) return true
  if (chip.intent === 'undo') return true
  return !!(chip.message || chip.prompt)
}
