/**
 * S-G — "Decisions from before you signed in": the OFFER half of guest → account continuity.
 *
 * Sign-in copies the guest work from the last day automatically (`lib/pendingGuestCopy.capturePendingGuestCopies`).
 * Older guest work, and a decision this browser pointed at without the ledger ever seeing a turn for it, is never
 * copied silently: it is listed here, and the user adds what is theirs or says it is not. That is the 7 Oct case:
 * Paul's 28 Sep guest decision was copied into his account without a word, nine days after he last worked on it.
 *
 * Add uses the same copy route as sign-in (`services/guestCopyService`). The guest row is never written, so declining
 * loses nothing that was the user's account's.
 *
 * ⚠ BOUND TO THE ACCOUNT THAT SAW THE OFFER (Codex r1 P1-1, r2 P2). An identity boundary (A → B, sign-out) sweeps the
 * ledger, but a mounted banner could still hold A's rows, and A's click can resolve its token after B has arrived. So
 * the list is read from storage on every render (never held), and a click sends only if the session is STILL the
 * account that clicked, in the same identity epoch, and the decision is STILL offered; its answer is applied only then.
 *
 * DS: the hub's banner card (`GuestDraftImportBanner`), the existing type tokens, Lucide only.
 */
import { useCallback, useReducer, useRef, useState } from 'react'
import { History, Loader2 } from 'lucide-react'

import { useAuth } from '../../contexts/AuthContext'
import { typography } from '../../styles/typography'
import { isPersistenceActive } from '../../lib/persistenceActive'
import { forgetGuestWork, readGuestWork, readIdentityEpoch } from '../../lib/guestWork'
import { GUEST_COPIED_EVENT, type GuestCopiedDetail } from '../../lib/guestCopyOnSignIn'
import { requestGuestCopy } from '../../services/guestCopyService'
import { getSessionIdentity } from '../../lib/supabase'

export const GUEST_WORK_OFFER_COPY = {
  heading: 'Decisions from before you signed in',
  body: 'You worked on these as a guest. Add the ones that are yours to your decisions.',
  unnamed: 'A decision from an earlier visit',
  add: 'Add to my decisions',
  decline: 'Not mine',
  retry: "Couldn't add it just now. Please try again.",
  gone: 'That decision can no longer be added.',
} as const

/** A fixed table, not `toLocaleDateString`: ICU versions disagree on "Sep" vs "Sept". */
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const

function lastWorkedOn(at: number | null): string | null {
  if (at === null) return null
  const date = new Date(at)
  if (Number.isNaN(date.getTime())) return null
  return `Last worked on ${date.getDate()} ${MONTHS[date.getMonth()]}`
}

function withoutNote(notes: Record<string, string>, id: string): Record<string, string> {
  const next = { ...notes }
  delete next[id]
  return next
}

export function GuestWorkOfferBanner() {
  const { user, authenticated } = useAuth()
  const accountId = user?.id ?? null
  // Read from storage on EVERY render, never held in state: after an identity boundary (which sweeps the ledger) the
  // next render cannot show the previous account's rows, not even for one frame (Codex r1 P1-1).
  const offers = readGuestWork()
  const [, refresh] = useReducer((n: number) => n + 1, 0)
  // Notes and the busy row belong to the account (and identity epoch) that produced them.
  const [ui, setUi] = useState<{ owner: string; busy: string | null; notes: Record<string, string> }>({ owner: '', busy: null, notes: {} })
  const owner = `${accountId ?? ''}|${readIdentityEpoch() ?? ''}`
  const busy = ui.owner === owner ? ui.busy : null
  const notes = ui.owner === owner ? ui.notes : {}
  const ownerRef = useRef(owner)
  ownerRef.current = owner

  const update = useCallback((forOwner: string, change: (prev: { busy: string | null; notes: Record<string, string> }) => { busy: string | null; notes: Record<string, string> }) => {
    setUi((prev) => {
      const base = prev.owner === forOwner ? prev : { owner: forOwner, busy: null, notes: {} }
      return { owner: forOwner, ...change(base) }
    })
  }, [])

  if (!isPersistenceActive(authenticated, user) || (offers.length === 0 && Object.keys(notes).length === 0)) return null

  const handleAdd = async (id: string) => {
    if (busy || accountId === null) return
    const clickedBy = accountId
    const clickedAs = owner
    // The account that clicked, in the SAME identity epoch: A→B→A rotates the epoch twice, so an old A request's answer
    // is never applied to the new A session (Codex r2 P2).
    const sameSession = () => ownerRef.current === clickedAs && `${clickedBy}|${readIdentityEpoch() ?? ''}` === clickedAs
    const stillOffered = () => readGuestWork().some((entry) => entry.id === id)
    update(clickedAs, (prev) => ({ ...prev, busy: id }))
    try {
      const { userId, accessToken } = await getSessionIdentity()
      // The session must still be the account that clicked, and the decision still offered (a boundary sweeps it).
      if (userId !== clickedBy || !sameSession() || !stillOffered()) return
      const outcome = accessToken ? await requestGuestCopy(id, accessToken) : { kind: 'retry_later' as const, reason: 'no_session' }
      if (!sameSession()) return
      if (outcome.kind === 'copied') {
        forgetGuestWork(id)
        update(clickedAs, (prev) => ({ ...prev, notes: withoutNote(prev.notes, id) }))
        const detail: GuestCopiedDetail = { sourceScenarioId: id, scenarioId: outcome.scenarioId, created: outcome.created }
        window.dispatchEvent(new CustomEvent<GuestCopiedDetail>(GUEST_COPIED_EVENT, { detail }))
      } else if (outcome.kind === 'not_copyable') {
        forgetGuestWork(id)
        update(clickedAs, (prev) => ({ ...prev, notes: { ...prev.notes, [id]: GUEST_WORK_OFFER_COPY.gone } }))
      } else {
        update(clickedAs, (prev) => ({ ...prev, notes: { ...prev.notes, [id]: GUEST_WORK_OFFER_COPY.retry } }))
      }
    } finally {
      update(clickedAs, (prev) => ({ ...prev, busy: null }))
      refresh()
    }
  }

  const handleDecline = (id: string) => {
    forgetGuestWork(id)
    update(owner, (prev) => ({ ...prev, notes: withoutNote(prev.notes, id) }))
    refresh()
  }

  return (
    <div
      className="mt-4 mb-4 flex items-start gap-3 rounded-md border border-panel-border bg-panel p-4"
      data-testid="guest-work-offer-banner"
    >
      <History className="mt-0.5 h-5 w-5 flex-shrink-0 text-info" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className={`${typography.label} text-text-header`}>{GUEST_WORK_OFFER_COPY.heading}</p>
        <p className={`${typography.bodySmall} mt-1 text-text-body`}>{GUEST_WORK_OFFER_COPY.body}</p>
        <ul className="mt-3 space-y-3">
          {offers.map((offer) => {
            const when = lastWorkedOn(offer.lastActiveAt)
            return (
              <li key={offer.id} data-testid="guest-work-offer" data-scenario-id={offer.id}>
                <p className={`${typography.bodySmall} text-text-header break-words`}>
                  {offer.label ?? GUEST_WORK_OFFER_COPY.unnamed}
                </p>
                {when && <p className={`${typography.bodySmall} text-text-light`}>{when}</p>}
                {notes[offer.id] && (
                  <p className={`${typography.bodySmall} mt-1 text-danger`} role="alert">{notes[offer.id]}</p>
                )}
                <div className="mt-2 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => { void handleAdd(offer.id) }}
                    disabled={busy !== null}
                    className={`${typography.button} inline-flex items-center gap-1.5 px-4 py-1.5 rounded-pill bg-primary text-text-on-color hover:bg-primary-hover disabled:bg-primary-disabled disabled:cursor-not-allowed transition-colors duration-fast`}
                  >
                    {busy === offer.id && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                    {GUEST_WORK_OFFER_COPY.add}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDecline(offer.id)}
                    disabled={busy !== null}
                    className={`${typography.button} px-4 py-1.5 rounded-pill text-text-body hover:text-text-header disabled:cursor-not-allowed transition-colors duration-fast`}
                  >
                    {GUEST_WORK_OFFER_COPY.decline}
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
        {Object.entries(notes)
          .filter(([id]) => !offers.some((o) => o.id === id))
          .map(([id, note]) => (
            <p key={id} className={`${typography.bodySmall} mt-2 text-text-light`} role="status">{note}</p>
          ))}
      </div>
    </div>
  )
}
