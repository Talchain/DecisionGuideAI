/**
 * v10 (#/canvas2), "If it failed": "Write mine first". A pre-mortem works best when the person names their own reasons
 * for failure BEFORE reading Olumi's, so Olumi's stories do not anchor theirs (de-biasing). The press only puts the
 * opening of the person's own sentence in the chat composer and brings the conversation forward: it never sends, and it
 * asks Olumi for nothing. "Imagine it failed" stays the separate press that asks for Olumi's stories.
 *
 * ⛔ IT NEVER ERASES WHAT THE PERSON HAS TYPED. The store's `_prefillChat` REPLACES the composer text, so the press reads
 * the composer's current text first (`writeMineDraft`): empty gets the opening; text that already opens with it stays
 * exactly as it is (a second press changes nothing); any other text keeps every character, with the opening put in front.
 *
 * Mounted only when `usePresentation() === 'v10'`. With no chat to take the prefill there is no button, so it is never a
 * dead press (the same rule as the card's Olumi mark, `useOlumiMarkAsk`).
 */
import { useOptionalConversationContext } from '../canvas/conversation/ConversationContext'
import { revealOlumiSurface } from '../canvas/conversation/revealOlumi'
import { useGuidanceStore } from '../canvas/stores/guidanceStore'
import { typography } from '../styles/typography'
import { ACTION_FOCUS } from '../components/results/analysisNew/panelSurfaces'

export const V10_WRITE_MINE_COPY = {
  imagine: 'Imagine it failed',
  label: 'Write mine first',
  /** The opening of the person's own sentence. */
  draft: 'My reasons it failed: ',
  intro: 'A pre-mortem asks the opposite question: suppose this model failed. What happened? Write your own reasons first, or ask Olumi to imagine it.',
} as const

/** What the composer should hold after the press, given what it holds now. Pure; never drops a character of `current`. */
export function writeMineDraft(current: string): string {
  if (current.length === 0) return V10_WRITE_MINE_COPY.draft
  if (current.startsWith(V10_WRITE_MINE_COPY.draft.trimEnd())) return current
  return V10_WRITE_MINE_COPY.draft + current
}

/**
 * The composer's current text. The chat's draft lives in the conversation context (the AI panel's composer and the Olumi
 * tab); the older chat composer keeps its own text in its textarea, so that is read when the context holds none.
 */
function composerText(contextDraft: string | undefined): string {
  if (contextDraft) return contextDraft
  if (typeof document === 'undefined') return ''
  return document.querySelector<HTMLTextAreaElement>('[data-testid="chat-composer"] textarea')?.value ?? ''
}

export function V10WriteMineFirst() {
  const prefill = useGuidanceStore((s) => s._prefillChat)
  const contextDraft = useOptionalConversationContext()?.draft
  if (typeof prefill !== 'function') return null
  return (
    <button
      type="button"
      data-testid="premortem-write-mine"
      // Ink, not blue: the press is the person's own act (blue means Olumi only).
      className={`${typography.panelBody} inline-flex min-h-[24px] min-w-[24px] items-center rounded-full border border-panel-border px-3 text-text-header hover:bg-panel-hover ${ACTION_FOCUS}`}
      onClick={() => {
        const current = composerText(contextDraft)
        const next = writeMineDraft(current)
        // Unchanged text is not written back: nothing the person typed is ever replaced, not even with itself.
        if (next !== current) prefill(next)
        // The composer may be on a hidden surface (floating panel closed, another dock tab): front it and focus it.
        revealOlumiSurface()
      }}
    >
      {V10_WRITE_MINE_COPY.label}
    </button>
  )
}
