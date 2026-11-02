/**
 * v10 (#/canvas2), "If it failed": "Write mine first". A pre-mortem works best when the person names their own reasons
 * for failure BEFORE reading Olumi's, so Olumi's stories do not anchor theirs (de-biasing). The press only PREFILLS the
 * chat composer with the opening of the person's own sentence and brings the conversation forward: it never sends, and
 * it asks Olumi for nothing. "Imagine it failed" stays the separate press that asks for Olumi's stories.
 *
 * Mounted only when `usePresentation() === 'v10'`. With no chat to take the prefill there is no button, so it is never a
 * dead press (the same rule as the card's Olumi mark, `useOlumiMarkAsk`).
 */
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

export function V10WriteMineFirst() {
  const prefill = useGuidanceStore((s) => s._prefillChat)
  if (typeof prefill !== 'function') return null
  return (
    <button
      type="button"
      data-testid="premortem-write-mine"
      // Ink, not blue: the press is the person's own act (blue means Olumi only).
      className={`${typography.panelBody} inline-flex min-h-[24px] min-w-[24px] items-center rounded-full border border-panel-border px-3 text-text-header hover:bg-panel-hover ${ACTION_FOCUS}`}
      onClick={() => prefill(V10_WRITE_MINE_COPY.draft)}
    >
      {V10_WRITE_MINE_COPY.label}
    </button>
  )
}
