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
 * ⚠ BOUND TO THE ACCOUNT THAT SAW THE OFFER (Codex r1 P1-1). An identity boundary (A → B, sign-out) sweeps the ledger,
 * but a mounted banner still holds A's rows; and A's click can resolve its token after B has arrived. So the list is
 * re-read whenever the account changes, and a click sends only if the session is STILL the account that clicked and
 * the decision is STILL offered in storage; its answer is applied only if that account is still here.
 *
 * DS: the hub's banner card (`GuestDraftImportBanner`), the existing type tokens, Lucide only.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { History, Loader2 } from 'lucide-react'

import { useAuth } from '../../contexts/AuthContext'
import { typography } from '../../styles/typography'
import { isPersistenceActive } from '../../lib/persistenceActive'
import { forgetGuestWork, readGuestWork, type GuestWorkEntry } from '../../lib/guestWork'
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

export function GuestWorkOfferBanner() {
  const { user, authenticated } = useAuth()
  const accountId = user?.id ?? null
  const [offers, setOffers] = useState<GuestWorkEntry[]>(() => readGuestWork())
  const [busy, setBusy] = useState<string | null>(null)
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [listedFor, setListedFor] = useState<string | null>(accountId)
  const accountRef = useRef(accountId)
  accountRef.current = accountId

  // A different account (or none) sees what storage holds NOW, never the previous account's list: until the re-read
  // lands, nothing listed for another account is rendered, not even for one frame.
  useEffect(() => {
    setOffers(readGuestWork())
    setNotes({})
    setBusy(null)
    setListedFor(accountId)
  }, [accountId])
  const visible = listedFor === accountId ? offers : []

  const settle = useCallback((id: string, note?: string) => {
    if (note === undefined) forgetGuestWork(id)
    setOffers(readGuestWork())
    setNotes((prev) => {
      const next = { ...prev }
      if (note === undefined) delete next[id]
      else next[id] = note
      return next
    })
  }, [])

  if (!isPersistenceActive(authenticated, user) || (visible.length === 0 && Object.keys(notes).length === 0)) return null

  const handleAdd = async (id: string) => {
    if (busy || accountId === null) return
    const clickedBy = accountId
    const stillOffered = () => readGuestWork().some((entry) => entry.id === id)
    setBusy(id)
    try {
      const { userId, accessToken } = await getSessionIdentity()
      // The session must still be the account that clicked, and the decision still offered (a boundary sweeps it).
      if (userId !== clickedBy || accountRef.current !== clickedBy || !stillOffered()) {
        if (accountRef.current === clickedBy) setOffers(readGuestWork())
        return
      }
      const outcome = accessToken ? await requestGuestCopy(id, accessToken) : { kind: 'retry_later' as const, reason: 'no_session' }
      if (accountRef.current !== clickedBy) return
      if (outcome.kind === 'copied') {
        settle(id)
        const detail: GuestCopiedDetail = { sourceScenarioId: id, scenarioId: outcome.scenarioId, created: outcome.created }
        window.dispatchEvent(new CustomEvent<GuestCopiedDetail>(GUEST_COPIED_EVENT, { detail }))
      } else if (outcome.kind === 'not_copyable') {
        forgetGuestWork(id)
        setNotes((prev) => ({ ...prev, [id]: GUEST_WORK_OFFER_COPY.gone }))
        setOffers((prev) => prev.filter((o) => o.id !== id))
      } else {
        settle(id, GUEST_WORK_OFFER_COPY.retry)
      }
    } finally {
      if (accountRef.current === clickedBy) setBusy(null)
    }
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
          {visible.map((offer) => {
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
                    onClick={() => settle(offer.id)}
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
          .filter(([id]) => !visible.some((o) => o.id === id))
          .map(([id, note]) => (
            <p key={id} className={`${typography.bodySmall} mt-2 text-text-light`} role="status">{note}</p>
          ))}
      </div>
    </div>
  )
}
