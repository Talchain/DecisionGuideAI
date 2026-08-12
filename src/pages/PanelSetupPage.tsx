/**
 * COLLAB — the owner's side: open a blind round, hand out the links, close it,
 * read the reveal.
 *
 * ── THE ONE-TIME TOKEN DISCLOSURE ─────────────────────────────────────────
 * Participant tokens are returned by the mint response and exist NOWHERE else —
 * not in the database (only a SHA-256 hash), not in a log, and behind no
 * read-back route. This page shows them once so the owner can send the links,
 * and says plainly that they cannot be recovered. A lost link is re-minted.
 *
 * ⚠ The page does not store them. Navigating away loses them, deliberately: the
 * alternative is a bearer capability sitting in browser storage after the round
 * has closed. That is exactly why each link now has a COPY BUTTON: a one-shot,
 * unrecoverable secret that a person must select by hand is a design that
 * guarantees a re-mint.
 *
 * ── WHAT A LIVE WITNESS FOUND ON DEPLOYED BUILD `3a4e3df2` ────────────────
 *   • the page rendered with ZERO design-system classes — Tailwind preflight
 *     strips native styling, so the five labels collapsed into a run-on wall of
 *     text with unstyled inline inputs and the h1 read as body copy. Every
 *     surface here now carries the app's own tokens; nothing is styled by an
 *     inline `style` attribute.
 *   • opening a round took ~8 seconds with NO busy indicator, then showed the
 *     raw wire sentence. There is now a busy region, and every failure is
 *     translated into copy that says what to do next.
 *   • the "Sign in again…" message had no way to sign in ON THE PAGE.
 *
 * ── WHAT THE OWNER CANNOT SEE BEFORE CLOSE ────────────────────────────────
 * Nothing anyone has written — not even whether they have written. The owner is
 * a panellist too and is not exempt from anchoring; that is a property of the
 * method, not a permission decision, so it holds for the person who owns the
 * account.
 *
 * A consequence, ruled and accepted for this slice: the owner closes without
 * knowing whether the others have finished, and coordinates out of band. Two
 * people running a panel are talking to each other. The fix is NOT to add a
 * submitted-count to the packet — that is precisely how the anchor gets back in.
 */

import { useCallback, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { AlertTriangle, Check, Copy, Loader2, LogIn, Users } from 'lucide-react'

import { Button } from '../components/ui/Button'
import {
  CollabRequestError,
  closeRound,
  fetchOwnerReveal,
  mintRound,
  ownerSignInRequired,
  participantLink,
  type MintedRound,
  type RevealView,
} from '../collab/collabService'
import { requireOwnerAccessToken } from '../collab/ownerAccessToken'
import { typography } from '../styles/typography'
import { RevealBody } from './ParticipantPacketPage'

const PAGE_SHELL = 'min-h-screen bg-canvas px-4 py-10 sm:px-6 sm:py-14'
const COLUMN = 'mx-auto w-full max-w-[680px]'
const CARD = 'rounded-[20px] border border-panel-border bg-panel p-6 shadow-1 sm:p-8'
const FIELD =
  'w-full min-h-[44px] rounded-md border border-panel-border bg-panel px-4 py-3 text-text-body placeholder:text-text-light transition-colors duration-fast focus:border-info focus:outline-none focus:ring-2 focus:ring-info/50'

/**
 * ⚠ DERIVED FROM THE SEAM, NOT RETYPED. `ownerSignInRequired()` is the one
 * place a credential refusal is minted; spelling its sentence again here would
 * be the hand-maintained mirror this estate keeps paying for — two copies of
 * one sentence, and the copy that drifts is always the one a user reads.
 */
const SIGN_IN_SENTENCE = ownerSignInRequired().message

type OwnerAction = 'open' | 'close'

interface OwnerFailure {
  /** The headline. Human, and for a credential refusal the seam's own sentence. */
  title: string
  /** What to do next — the part the witness found missing entirely. */
  guidance: string
  /** Whether a sign-in affordance is the right next step. */
  credential: boolean
  /** The server's own words, shown as secondary detail — never as the message. */
  detail: string | null
}

/**
 * Translate a failure into something an owner can act on.
 *
 * ⚠ THE PREDICATE'S DOMAIN, NOT JUST THE CASE IN HAND. A credential refusal is
 * `sign_in_required` (minted locally, before any request leaves) OR an HTTP
 * 401/403 (the server declining the bearer) — two different paths that call for
 * the SAME next step. Everything else is a different question and must not be
 * routed to "sign in again", which would be a confident lie about a round whose
 * target simply does not exist.
 */
function describeOwnerFailure(err: unknown, action: OwnerAction): OwnerFailure {
  const fallbackTitle =
    action === 'open' ? 'We could not open the round.' : 'We could not close the round.'

  if (!(err instanceof CollabRequestError)) {
    return {
      title: fallbackTitle,
      guidance:
        'Something went wrong before we heard back. Check your connection and try again — nothing has been sent to anyone.',
      credential: false,
      detail: null,
    }
  }

  if (err.code === 'sign_in_required' || err.status === 401 || err.status === 403) {
    return {
      title: SIGN_IN_SENTENCE,
      guidance:
        'Your session has ended. Sign in again in the new tab, then come back here and try again — what you have typed on this page is kept.',
      credential: true,
      // The wire sentence for a credential refusal ("That token could not be
      // verified.") tells the owner nothing they can act on, and repeating it
      // beside the guidance would only muddy it.
      detail: null,
    }
  }

  return {
    title: fallbackTitle,
    guidance:
      action === 'open'
        ? 'Check that the factor id matches your model, then try again. Nothing has been sent to anyone yet.'
        : 'The round is still open. Try again in a moment — nobody has seen anything they should not.',
    credential: false,
    detail: err.message,
  }
}

/** Best-effort clipboard write. Returns false when the browser refuses. */
async function writeToClipboard(text: string): Promise<boolean> {
  try {
    if (typeof navigator === 'undefined' || navigator.clipboard === undefined) return false
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

export default function PanelSetupPage(): JSX.Element {
  const { id: scenarioId } = useParams<{ id: string }>()

  // ⚠ The token is read PER ACTION, from `requireOwnerAccessToken()`, and never
  // held in component state. Two reasons, and the second is the one that bit:
  //   • a token read at mount is stale by the time a round is closed;
  //   • this page previously destructured `session` off `useAuth()` behind an
  //     `as` cast. AuthContext has no such member, so the token was always ''
  //     and every owner call shipped `Authorization: "Bearer "` — a 401 at CEE,
  //     indistinguishable from sending no header. There is now no cast here and
  //     no `?? ''`: an absent session throws, and the owner is told to sign in.

  const [targetId, setTargetId] = useState('')
  const [targetLabel, setTargetLabel] = useState('')
  const [contextNote, setContextNote] = useState('')
  const [nameA, setNameA] = useState('')
  const [nameB, setNameB] = useState('')
  const [minted, setMinted] = useState<MintedRound | null>(null)
  const [reveal, setReveal] = useState<RevealView | null>(null)
  const [failure, setFailure] = useState<OwnerFailure | null>(null)
  const [busyAction, setBusyAction] = useState<OwnerAction | null>(null)
  const [copiedIds, setCopiedIds] = useState<ReadonlySet<string>>(() => new Set())
  const [copyRefused, setCopyRefused] = useState<ReadonlySet<string>>(() => new Set())

  const handleMint = useCallback(async () => {
    setBusyAction('open')
    setFailure(null)
    try {
      const accessToken = await requireOwnerAccessToken()
      const result = await mintRound(accessToken, {
        scenarioId: scenarioId ?? '',
        contextNote: contextNote.trim() === '' ? null : contextNote,
        targets: [
          {
            target: { kind: 'factor', id: targetId.trim() },
            label: targetLabel.trim() === '' ? targetId.trim() : targetLabel.trim(),
            description: null,
            unit: null,
          },
        ],
        participants: [{ display_name: nameA.trim() }, { display_name: nameB.trim() }].filter(
          (p) => p.display_name !== '',
        ),
      })
      setMinted(result)
    } catch (err) {
      setFailure(describeOwnerFailure(err, 'open'))
    } finally {
      setBusyAction(null)
    }
  }, [scenarioId, targetId, targetLabel, contextNote, nameA, nameB])

  const handleClose = useCallback(async () => {
    if (minted === null) return
    setBusyAction('close')
    setFailure(null)
    try {
      // ONE getSession() round-trip for the whole action, reused across both
      // requests — the identity seam's stated contract ("one call per turn;
      // callers must never make a second getSession() round-trip for the token").
      const accessToken = await requireOwnerAccessToken()
      await closeRound(accessToken, minted.round_id)
      setReveal(await fetchOwnerReveal(accessToken, minted.round_id))
    } catch (err) {
      setFailure(describeOwnerFailure(err, 'close'))
    } finally {
      setBusyAction(null)
    }
  }, [minted])

  const handleCopy = useCallback(async (participantId: string, link: string) => {
    const ok = await writeToClipboard(link)
    if (ok) {
      setCopiedIds((prev) => new Set(prev).add(participantId))
      setCopyRefused((prev) => {
        if (!prev.has(participantId)) return prev
        const next = new Set(prev)
        next.delete(participantId)
        return next
      })
      return
    }
    setCopyRefused((prev) => new Set(prev).add(participantId))
  }, [])

  if (reveal !== null) return <RevealBody reveal={reveal} />

  const targetIdHasSpaces = targetId.trim() !== '' && /\s/.test(targetId.trim())

  return (
    <main data-testid="panel-setup-page" className={PAGE_SHELL}>
      <div className={COLUMN}>
        <div className={CARD}>
          <p className={`${typography.label} flex items-center gap-2 text-info`}>
            <Users className="h-4 w-4" aria-hidden="true" />
            Blind panel
          </p>
          <h1 className={`${typography.h2} mt-3 text-text-header`}>
            Ask your team, without anchoring them
          </h1>
          <p className={`${typography.body} mt-3 text-text-body`}>
            Everyone answers privately. Nobody &mdash; including you &mdash; sees any answer until
            you close the round. Then you see them all, side by side, in each person&rsquo;s own
            words.
          </p>

          {minted === null ? (
            <div className="mt-8 space-y-6">
              <div>
                <label
                  htmlFor="panel-target-id-input"
                  className={`${typography.label} block text-text-header`}
                >
                  Which factor should they estimate?
                </label>
                <input
                  id="panel-target-id-input"
                  data-testid="panel-target-id"
                  className={`${FIELD} ${typography.body} mt-2`}
                  value={targetId}
                  autoComplete="off"
                  spellCheck={false}
                  aria-describedby="panel-target-id-hint"
                  onChange={(e) => setTargetId(e.target.value)}
                  placeholder="factor-churn-risk"
                />
                <p
                  id="panel-target-id-hint"
                  data-testid="panel-target-id-hint"
                  className={`${typography.bodySmall} mt-2 text-text-light`}
                >
                  The factor&rsquo;s id in your model, for example{' '}
                  <span className="text-text-body">factor-churn-risk</span>.
                </p>
                {targetIdHasSpaces && (
                  <p
                    data-testid="panel-target-id-warning"
                    className={`${typography.bodySmall} mt-2 text-warning`}
                  >
                    Factor ids do not usually contain spaces. If you meant to describe the factor
                    to your panel, use the next field instead.
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="panel-target-label-input"
                  className={`${typography.label} block text-text-header`}
                >
                  How should it be described to them?
                </label>
                <input
                  id="panel-target-label-input"
                  data-testid="panel-target-label"
                  className={`${FIELD} ${typography.body} mt-2`}
                  value={targetLabel}
                  onChange={(e) => setTargetLabel(e.target.value)}
                  aria-describedby="panel-target-label-hint"
                  placeholder="Churn risk after a price rise"
                />
                <p
                  id="panel-target-label-hint"
                  className={`${typography.bodySmall} mt-2 text-text-light`}
                >
                  This is the wording your panel sees. Leave it blank and they see the id above.
                </p>
              </div>

              <div>
                <label
                  htmlFor="panel-context-note-input"
                  className={`${typography.label} block text-text-header`}
                >
                  Anything they should know first? (optional)
                </label>
                <textarea
                  id="panel-context-note-input"
                  data-testid="panel-context-note"
                  rows={3}
                  className={`${FIELD} ${typography.body} mt-2`}
                  value={contextNote}
                  onChange={(e) => setContextNote(e.target.value)}
                  placeholder="One or two lines of context — the same for everyone."
                />
              </div>

              <fieldset className="rounded-md border border-panel-border p-4">
                <legend className={`${typography.label} px-1 text-text-header`}>
                  Who is answering?
                </legend>
                <div className="mt-2 grid gap-4 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor="panel-name-a-input"
                      className={`${typography.label} block text-text-header`}
                    >
                      First person&rsquo;s name
                    </label>
                    <input
                      id="panel-name-a-input"
                      data-testid="panel-name-a"
                      className={`${FIELD} ${typography.body} mt-2`}
                      value={nameA}
                      onChange={(e) => setNameA(e.target.value)}
                      placeholder="Ada"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="panel-name-b-input"
                      className={`${typography.label} block text-text-header`}
                    >
                      Second person&rsquo;s name
                    </label>
                    <input
                      id="panel-name-b-input"
                      data-testid="panel-name-b"
                      className={`${FIELD} ${typography.body} mt-2`}
                      value={nameB}
                      onChange={(e) => setNameB(e.target.value)}
                      placeholder="Grace"
                    />
                  </div>
                </div>
                <p className={`${typography.bodySmall} mt-3 text-text-light`}>
                  Names are what everyone sees beside each answer when the round closes.
                </p>
              </fieldset>

              <div className="flex flex-wrap items-center gap-3">
                <Button
                  data-testid="panel-mint"
                  onClick={handleMint}
                  disabled={busyAction !== null || targetId.trim() === ''}
                >
                  Open the round
                </Button>
                {targetId.trim() === '' && (
                  <span
                    data-testid="panel-mint-hint"
                    className={`${typography.bodySmall} text-text-light`}
                  >
                    Name the factor above to open the round.
                  </span>
                )}
              </div>
            </div>
          ) : (
            <div className="mt-8">
              <h2 className={`${typography.h4} text-text-header`}>
                Send each person their own link
              </h2>
              {/* Said once, plainly, at the only moment it can be acted on. */}
              <p
                data-testid="panel-token-warning"
                className={`${typography.body} mt-3 rounded-md border border-warning/30 bg-panel p-4 text-text-body`}
              >
                These links are shown once and cannot be recovered — they are not stored anywhere.
                Copy them now. Anyone holding a link can answer as that person, so send each one
                directly.
              </p>

              <ul className="mt-5 space-y-4">
                {minted.participants.map((p) => {
                  const link = participantLink(minted.round_id, p.token)
                  const copied = copiedIds.has(p.participant_id)
                  return (
                    <li
                      key={p.participant_id}
                      data-testid={`panel-link-${p.participant_id}`}
                      className="rounded-md border border-panel-border bg-panel p-4"
                    >
                      <p className={`${typography.label} text-text-header`}>{p.display_name}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-3">
                        <input
                          readOnly
                          aria-label={`Panel link for ${p.display_name}`}
                          value={link}
                          onFocus={(e) => e.currentTarget.select()}
                          className={`${FIELD} ${typography.bodySmall} min-w-0 flex-1`}
                        />
                        <Button
                          variant="secondary"
                          size="sm"
                          data-testid={`panel-copy-${p.participant_id}`}
                          onClick={() => void handleCopy(p.participant_id, link)}
                        >
                          <span className="flex items-center gap-2">
                            {copied ? (
                              <Check className="h-4 w-4" aria-hidden="true" />
                            ) : (
                              <Copy className="h-4 w-4" aria-hidden="true" />
                            )}
                            {copied ? 'Copied' : 'Copy link'}
                          </span>
                        </Button>
                      </div>
                      {copied && (
                        <p
                          data-testid={`panel-copied-${p.participant_id}`}
                          role="status"
                          className={`${typography.bodySmall} mt-2 text-success`}
                        >
                          Link copied. Send it to {p.display_name} now — it cannot be shown again.
                        </p>
                      )}
                      {copyRefused.has(p.participant_id) && (
                        <p
                          data-testid={`panel-copy-failed-${p.participant_id}`}
                          role="status"
                          className={`${typography.bodySmall} mt-2 text-warning`}
                        >
                          This browser would not let us copy it. Select the link above and copy it
                          by hand.
                        </p>
                      )}
                    </li>
                  )
                })}
              </ul>

              <p className={`${typography.bodySmall} mt-5 text-text-light`}>
                This round is pinned to the version of your model as it is right now, so the
                answers stay meaningful even if you keep editing.
              </p>

              <div className="mt-6">
                <Button data-testid="panel-close" onClick={handleClose} disabled={busyAction !== null}>
                  Close the round and show everyone&rsquo;s answers
                </Button>
              </div>
              <p className={`${typography.bodySmall} mt-3 text-text-light`}>
                You will not see whether they have answered yet &mdash; that would tell you
                something about their replies before you have given yours. Check with them first.
              </p>
            </div>
          )}

          {busyAction !== null && (
            <p
              data-testid="panel-busy"
              role="status"
              aria-live="polite"
              className={`${typography.body} mt-6 flex items-center gap-3 text-text-light`}
            >
              <Loader2 className="h-5 w-5 animate-spin text-info" aria-hidden="true" />
              {busyAction === 'open'
                ? 'Opening the round… this can take a few seconds.'
                : 'Closing the round and gathering everyone’s answers…'}
            </p>
          )}

          {failure !== null && (
            <div
              data-testid="panel-error"
              className="mt-6 rounded-md border border-danger/30 bg-panel p-4"
            >
              <p
                role="alert"
                className={`${typography.body} flex items-start gap-3 text-text-header`}
              >
                <AlertTriangle className="mt-0.5 h-5 w-5 flex-none text-danger" aria-hidden="true" />
                <span>{failure.title}</span>
              </p>
              <p
                data-testid="panel-error-guidance"
                className={`${typography.bodySmall} mt-2 text-text-body`}
              >
                {failure.guidance}
              </p>
              {failure.detail !== null && (
                <p
                  data-testid="panel-error-detail"
                  className={`${typography.bodySmall} mt-2 text-text-light`}
                >
                  Details: {failure.detail}
                </p>
              )}
              {failure.credential && (
                <Link
                  to="/login"
                  target="_blank"
                  rel="noopener noreferrer"
                  data-testid="panel-sign-in"
                  className={`${typography.button} mt-4 inline-flex items-center gap-2 rounded-full border border-panel-border px-4 py-2 text-text-body transition-colors hover:bg-panel-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info/40`}
                >
                  <LogIn className="h-4 w-4" aria-hidden="true" />
                  Sign in (opens a new tab)
                </Link>
              )}
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
