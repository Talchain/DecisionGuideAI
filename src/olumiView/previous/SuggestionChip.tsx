/**
 * "Olumi's suggestion" on every card the waiting proposal adds or changes (old look, Paul 15 Nov ~13:10Z). One tap each: Accept and Reject set
 * that change's choice in the review (reviewTicks.ts); Edit puts "About <card>:" in the composer (the product's own card prefill), so the
 * person tells Olumi what to change. Nothing is saved by a tap: the chip then says which of the review's buttons applies it (Approve ticked;
 * with one change, Approve or Set aside), and offers Review (the Olumi tab, the review opened at its buttons) and Undo. No chip on a proposal
 * core does not support (it has no approval), and no tap while a write is in flight.
 */
import { useViewStore } from '../store'
import { useViewChat } from '../ViewChat'
import { verdictOf } from '../verdict'
import { useGuidanceStore } from '../../canvas/stores/guidanceStore'
import { useUIStore } from '../../stores/uiStore'
import { chooseFromCard, lineKey, openReview, rejectedPartner, ticksFor, ticksKey, useReviewTicks } from '../reviewTicks'
import { typography } from '../../styles/typography'

export const SUGGESTION_WORDS = { label: 'Olumi’s suggestion', accept: 'Accept', edit: 'Edit', reject: 'Reject', accepted: 'Accepted', rejected: 'Rejected', applies: 'applies on', review: 'Review', undo: 'Undo' } as const

const BTN = 'nodrag nopan min-h-[24px] cursor-pointer rounded border border-border-emphasis bg-panel px-1.5 text-text-header hover:border-info disabled:cursor-default disabled:opacity-60'

export function SuggestionChip({ id, name }: { id: string; name: string }): JSX.Element | null {
  const p = useViewStore((s) => s.view?.proposal ?? null)
  const sid = useViewStore((s) => s.sid)
  const busy = useViewChat((s) => s.busy)
  const ticks = useReviewTicks()
  const changes = p?.changes ?? []
  const c = changes.find((x) => !x.top && x.id === id)
  if (p === null || c === undefined || verdictOf(p)?.supported === false) return null
  const key = ticksKey(sid, p.id), s = ticksFor(ticks, key), k = lineKey(c)
  const state = s.ticked.has(k) ? 'accepted' : s.rejected.has(k) ? 'rejected' : null
  // The button that applies the choice: the ticked lines' commit, or with one change the proposal's own Approve or Set aside.
  const commit = changes.length > 1 ? 'Approve ticked' : state === 'rejected' ? 'Set aside' : 'Approve'
  const held = rejectedPartner(s, changes, c)
  const stop = (e: { stopPropagation: () => void }) => e.stopPropagation()
  const press = (what: 'accept' | 'reject' | 'undo') => (e: { stopPropagation: () => void }) => { stop(e); if (!useViewChat.getState().busy) chooseFromCard(key, changes, c, what) }
  return (
    <div className={`${typography.nodeLabel} mt-1 flex flex-wrap items-center gap-1 text-text-body`} data-suggestion={id} data-suggestion-state={state ?? 'open'} onClick={stop}>
      {state === null ? (
        <>
          <span className="text-info" data-testid={`${id}-suggestion-label`}>{SUGGESTION_WORDS.label}</span>
          <button type="button" className={BTN} disabled={busy || held !== null} title={held === null ? undefined : `Goes with ${held.id}, which you rejected`} data-testid={`${id}-suggestion-accept`} onClick={press('accept')}>{SUGGESTION_WORDS.accept}</button>
          <button type="button" className={BTN} disabled={busy} data-testid={`${id}-suggestion-edit`}
            onClick={(e) => { stop(e); useGuidanceStore.getState()._prefillChat?.(`About ${name}: `) }}>{SUGGESTION_WORDS.edit}</button>
          <button type="button" className={BTN} disabled={busy} data-testid={`${id}-suggestion-reject`} onClick={press('reject')}>{SUGGESTION_WORDS.reject}</button>
        </>
      ) : (
        <>
          <span role="status" data-testid={`${id}-suggestion-said`}>{state === 'accepted' ? SUGGESTION_WORDS.accepted : SUGGESTION_WORDS.rejected} · {SUGGESTION_WORDS.applies} {commit}</span>
          <button type="button" className={BTN} data-testid={`${id}-suggestion-review`}
            onClick={(e) => { stop(e); useUIStore.getState().forceActivateOutputTab('olumi'); openReview() }}>{SUGGESTION_WORDS.review}</button>
          <button type="button" className={BTN} disabled={busy} data-testid={`${id}-suggestion-undo`} onClick={press('undo')}>{SUGGESTION_WORDS.undo}</button>
        </>
      )}
    </div>
  )
}
