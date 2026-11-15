/**
 * "Olumi's suggestion" on a card the waiting proposal adds or changes (old look, Paul 15 Nov ~13:10Z). One tap each: Accept and Reject set
 * that change's tick in the review's list (reviewTicks.ts); Edit puts "About <card>:" in the composer (the product's own card prefill), so the
 * person tells Olumi what to change. Nothing is saved by a tap: after one the chip says the choice applies on "Approve ticked", the review's
 * one commit, and offers Review (one tap to it) and Undo. Shown only where the review has ticks (two lines or more) and core supports approval.
 */
import { useViewStore } from '../store'
import { useGuidanceStore } from '../../canvas/stores/guidanceStore'
import { chooseFromCard, lineKey, openReview, ticksFor, useReviewTicks } from '../reviewTicks'
import { typography } from '../../styles/typography'

export const SUGGESTION_WORDS = { label: 'Olumi’s suggestion', accept: 'Accept', edit: 'Edit', reject: 'Reject', accepted: 'Accepted', rejected: 'Rejected', applies: 'applies on Approve ticked', review: 'Review', undo: 'Undo' } as const

const BTN = 'nodrag nopan min-h-[24px] cursor-pointer rounded border border-border-emphasis bg-panel px-1.5 text-text-header hover:border-info'

export function SuggestionChip({ id, name }: { id: string; name: string }): JSX.Element | null {
  const p = useViewStore((s) => s.view?.proposal ?? null)
  const busy = useViewStore((s) => s.status !== 'ready')
  const ticks = useReviewTicks()
  const changes = p?.changes ?? []
  const c = changes.find((x) => !x.top && x.id === id)
  if (p === null || c === undefined || changes.length < 2) return null
  const s = ticksFor(ticks, p.id), k = lineKey(c)
  const state = s.ticked.has(k) ? 'accepted' : s.rejected.has(k) ? 'rejected' : null
  const stop = (e: { stopPropagation: () => void }) => e.stopPropagation()
  const press = (what: 'accept' | 'reject' | 'undo') => (e: { stopPropagation: () => void }) => { stop(e); chooseFromCard(p.id, changes, c, what) }
  return (
    <div className={`${typography.nodeLabel} mt-1 flex flex-wrap items-center gap-1 text-text-body`} data-suggestion={id} data-suggestion-state={state ?? 'open'} onClick={stop}>
      {state === null ? (
        <>
          <span className="text-info" data-testid={`${id}-suggestion-label`}>{SUGGESTION_WORDS.label}</span>
          <button type="button" className={BTN} disabled={busy} data-testid={`${id}-suggestion-accept`} onClick={press('accept')}>{SUGGESTION_WORDS.accept}</button>
          <button type="button" className={BTN} disabled={busy} data-testid={`${id}-suggestion-edit`}
            onClick={(e) => { stop(e); useGuidanceStore.getState()._prefillChat?.(`About ${name}: `) }}>{SUGGESTION_WORDS.edit}</button>
          <button type="button" className={BTN} disabled={busy} data-testid={`${id}-suggestion-reject`} onClick={press('reject')}>{SUGGESTION_WORDS.reject}</button>
        </>
      ) : (
        <>
          <span role="status" data-testid={`${id}-suggestion-said`}>{state === 'accepted' ? SUGGESTION_WORDS.accepted : SUGGESTION_WORDS.rejected} · {SUGGESTION_WORDS.applies}</span>
          <button type="button" className={BTN} data-testid={`${id}-suggestion-review`} onClick={(e) => { stop(e); openReview() }}>{SUGGESTION_WORDS.review}</button>
          <button type="button" className={BTN} disabled={busy} data-testid={`${id}-suggestion-undo`} onClick={press('undo')}>{SUGGESTION_WORDS.undo}</button>
        </>
      )}
    </div>
  )
}
