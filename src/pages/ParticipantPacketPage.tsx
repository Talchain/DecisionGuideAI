/**
 * COLLAB — the participant's page. The whole of a panellist's experience.
 *
 * ── WHY THIS ROUTE IS OUTSIDE `AuthGuard` ─────────────────────────────────
 * A participant holds NO Supabase session. Placing this inside the guard would
 * bounce every one of them to `/login`, and the feature would be dark while
 * every test stayed green — the single most likely way to ship this page dark.
 * It copies the `/brief/:slug` precedent, which sits outside the guard for the
 * same reason.
 *
 * ⚠ For the same reason this page must NOT be gated on `isPersistenceActive`
 * (`authenticated && !!user && user.id !== 'guest'`), which is false for every
 * participant BY CONSTRUCTION.
 *
 * ── THIS IS THE FIRST SCREEN AN EXTERNAL PILOT PARTICIPANT EVER SEES ──────
 * A live browser witness on deployed build `3a4e3df2` drove it cold and found
 * three things that stop a panellist before any collaboration science matters:
 *
 *   • the page rendered with ZERO design-system classes. Tailwind preflight
 *     strips native styling and nothing restored it, so the h1 computed to
 *     16px/400 — indistinguishable from body text — and the code field had
 *     `border: 0; padding: 0`. Every surface here now carries the app's own
 *     tokens (`bg-canvas`, `bg-panel`, `typography.*`, the DS `Button`), and
 *     nothing is styled by an inline `style` attribute.
 *   • a mistyped code was a DEAD END: the entry form rendered only while no
 *     token was held, so a rejected credential could not be dropped and every
 *     retry re-sent it. Only a reload escaped, and the page never said so.
 *     `hasToken` is now STATE, and a refusal offers "Enter a different code".
 *   • "Continue" was dead on empty input with no feedback at all.
 *
 * ── WHAT THIS PAGE DELIBERATELY DOES NOT SHOW ─────────────────────────────
 * Before the round closes: no sibling answer, no model value for the target, no
 * response count, no roster. Not because the page hides them — because the
 * server never sends them, and `OpenPacket` has no member that could carry one.
 * The blindness is not a rendering decision that a future refactor could undo.
 *
 * That absence is the scientific mechanism, so the page SAYS so rather than
 * leaving it to be inferred: a person who does not know their answer is private
 * behaves as if it is not.
 *
 * ── THE REUSE SEAM ────────────────────────────────────────────────────────
 * `BeliefElicitationField` + `useBeliefElicitation`: the CALLER owns the phrase,
 * so the participant's own words survive to `expression_raw` verbatim. (The
 * older `BeliefInput` owns and clears its phrase and emits only a number — it
 * cannot return the words, which is exactly what the reveal needs.)
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { AlertTriangle, KeyRound, Loader2, Lock } from 'lucide-react'

import { BeliefElicitationField } from '../canvas/components/BeliefElicitationField'
import { useBeliefElicitation } from '../canvas/hooks/useBeliefElicitation'
import { Button } from '../components/ui/Button'
import {
  CollabRequestError,
  declineTarget,
  fetchOpenPacket,
  fetchParticipantReveal,
  submitBelief,
  type OpenPacket,
  type PacketTarget,
  type RevealView,
} from '../collab/collabService'
import {
  clearParticipantToken,
  getParticipantToken,
  setParticipantToken,
} from '../collab/participantToken'
import { typography } from '../styles/typography'

/* ── shared surface recipes ───────────────────────────────────────────────
 * Named once rather than spelled per element: five hand-assembled copies of a
 * card is how a design system drifts back into inline styles.
 */
const PAGE_SHELL = 'min-h-screen bg-canvas px-4 py-10 sm:px-6 sm:py-14'
const COLUMN = 'mx-auto w-full max-w-[640px]'
const CARD = 'rounded-[20px] border border-panel-border bg-panel p-6 shadow-1 sm:p-8'
const FIELD =
  'w-full min-h-[44px] rounded-md border border-panel-border bg-panel px-4 py-3 text-text-body placeholder:text-text-light transition-colors duration-fast focus:border-info focus:outline-none focus:ring-2 focus:ring-info/50'

type LoadState =
  | { kind: 'loading' }
  | { kind: 'packet'; packet: OpenPacket }
  | { kind: 'reveal'; reveal: RevealView }
  | { kind: 'error'; message: string; code: string; status: number }

/**
 * A refusal the participant can ACT on by supplying a different code.
 *
 * ⚠ Written against the SPEC of the seam, not against the one symptom in hand.
 * `participantHeaders()` mints `collab_token_invalid` locally when no token is
 * held; the SERVER's own code for a rejected bearer is not derivable from this
 * repo, so the predicate leans on the HTTP status — which is, and stays, the
 * transport-level truth about a credential the server would not accept.
 */
function isCredentialFailure(code: string, status: number): boolean {
  return status === 401 || status === 403 || code === 'collab_token_invalid'
}

/** Both spellings the link builder and the boot-path strip accept. */
const CODE_IN_LINK = /[?&](?:ct|collab_token)=([^&#\s]+)/

type CodeReading = { code: string } | { problem: string }

/**
 * Read an access code out of whatever a participant pasted.
 *
 * The pristine page took `raw` as the code whenever no query parameter matched
 * — so a link whose code had been trimmed in transit was adopted WHOLE as the
 * credential, and the person learned about it as an unexplained server refusal
 * several seconds later. A paste that is plainly a link and plainly carries no
 * code is refused HERE, where the reason can still be given.
 */
export function readAccessCode(raw: string): CodeReading {
  const trimmed = raw.trim()
  if (trimmed === '') {
    return { problem: 'Enter the code from your invitation, or paste the whole link you were sent.' }
  }

  const match = CODE_IN_LINK.exec(trimmed)
  if (match !== null) {
    let value = match[1]
    try {
      value = decodeURIComponent(value)
    } catch {
      /* a stray percent sign is not a reason to refuse a code that is present */
    }
    if (value.trim() !== '') return { code: value.trim() }
  }

  const looksLikeALink = /^[a-z][a-z0-9+.-]*:/i.test(trimmed) || trimmed.includes('#/panel/')
  if (looksLikeALink) {
    return {
      problem:
        'That link does not include an access code — it was probably trimmed on the way to you. Ask whoever invited you to send it again, or paste just the code.',
    }
  }

  return { code: trimmed }
}

/** One target, with its own phrase state (the field is caller-owned). */
function TargetCard({
  target,
  roundId,
  alreadyAnswered,
  onAnswered,
}: {
  target: PacketTarget
  roundId: string
  alreadyAnswered: boolean
  onAnswered: () => void
}): JSX.Element {
  const [phrase, setPhrase] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  // The hook's target shape is {nodeId, nodeLabel}: CEE refuses an empty id and
  // quotes the label back in its clarifying question. The packet's target id is
  // the factor id, which is exactly what it wants.
  const elicitation = useBeliefElicitation({
    nodeId: target.target.id,
    nodeLabel: target.label,
  })

  const handlePhraseChange = useCallback(
    (next: string) => {
      setPhrase(next)
      elicitation.request(next)
    },
    [elicitation],
  )

  const commit = useCallback(
    async (value: number) => {
      setBusy(true)
      setError(null)
      try {
        await submitBelief(roundId, {
          targetId: target.target.id,
          targetKind: target.target.kind,
          value,
          // ⭐ VERBATIM. Not the parsed number, not a normalisation — the words
          // this person typed, which is what the reveal shows beside the number.
          expressionRaw: phrase.trim() === '' ? null : phrase,
          confidence: null,
          revision: alreadyAnswered,
        })
        setSaved(true)
        onAnswered()
      } catch (err) {
        setError(
          err instanceof CollabRequestError
            ? err.message
            : 'That did not save. Please try again.',
        )
      } finally {
        setBusy(false)
      }
    },
    [roundId, target, phrase, alreadyAnswered, onAnswered],
  )

  const handleDecline = useCallback(async () => {
    setBusy(true)
    setError(null)
    try {
      await declineTarget(roundId, { targetId: target.target.id, targetKind: target.target.kind })
      setSaved(true)
      onAnswered()
    } catch (err) {
      setError(err instanceof CollabRequestError ? err.message : 'That did not save.')
    } finally {
      setBusy(false)
    }
  }, [roundId, target, onAnswered])

  return (
    <section data-testid={`packet-target-${target.target.id}`} className={`${CARD} mt-4`}>
      <h2 className={`${typography.h4} text-text-header`}>{target.label}</h2>
      {target.description !== null && (
        <p className={`${typography.body} mt-1 text-text-light`}>{target.description}</p>
      )}

      <div className="mt-4">
        <BeliefElicitationField
          label={target.label}
          phrase={phrase}
          onPhraseChange={handlePhraseChange}
          elicitation={elicitation}
          onAccept={commit}
          testId={`packet-belief-${target.target.id}`}
        />
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <Button variant="secondary" size="sm" onClick={handleDecline} disabled={busy}>
          I would rather not answer this
        </Button>
        {saved && (
          <span
            data-testid={`packet-saved-${target.target.id}`}
            className={`${typography.bodySmall} text-success`}
          >
            {alreadyAnswered ? 'Answer updated.' : 'Answer recorded.'} You can change it until the
            round closes.
          </span>
        )}
      </div>

      {error !== null && (
        <p role="alert" className={`${typography.bodySmall} mt-3 text-danger`}>
          {error}
        </p>
      )}
    </section>
  )
}

export default function ParticipantPacketPage(): JSX.Element {
  const { round_id: roundId } = useParams<{ round_id: string }>()
  const [state, setState] = useState<LoadState>({ kind: 'loading' })
  const [manualToken, setManualToken] = useState('')
  const [entryProblem, setEntryProblem] = useState<string | null>(null)
  const [answeredTick, setAnsweredTick] = useState(0)

  /**
   * ⚠ STATE, NOT A BARE MODULE READ — this is the whole of the dead-end fix.
   * The token lives in module scope (deliberately: never on disk), so React has
   * no way to learn that it changed. The pristine page recomputed
   * `getParticipantToken() !== null` on every render, which meant the entry
   * form could be reached only by never having had a token: once one was held,
   * nothing in the page could go back.
   */
  const [hasToken, setHasToken] = useState<boolean>(() => getParticipantToken() !== null)

  const load = useCallback(async () => {
    if (roundId === undefined) {
      setState({
        kind: 'error',
        code: 'no_round',
        status: 0,
        message: 'That link is incomplete.',
      })
      return
    }
    setState({ kind: 'loading' })
    try {
      const packet = await fetchOpenPacket(roundId)
      setState({ kind: 'packet', packet })
    } catch (err) {
      const code = err instanceof CollabRequestError ? err.code : 'collab_request_failed'
      const status = err instanceof CollabRequestError ? err.status : 0
      // A CLOSED round is not an error for a participant — it is the reveal.
      if (code === 'collab_round_closed') {
        try {
          const reveal = await fetchParticipantReveal(roundId)
          setState({ kind: 'reveal', reveal })
          return
        } catch (revealErr) {
          setState({
            kind: 'error',
            code,
            status: revealErr instanceof CollabRequestError ? revealErr.status : 0,
            message:
              revealErr instanceof CollabRequestError
                ? revealErr.message
                : 'Could not load the results.',
          })
          return
        }
      }
      setState({
        kind: 'error',
        code,
        status,
        message: err instanceof CollabRequestError ? err.message : 'Could not load your panel.',
      })
    }
  }, [roundId])

  useEffect(() => {
    if (hasToken) void load()
  }, [hasToken, load, answeredTick])

  /** Drop the held code and go back to the entry form, in place. */
  const forgetCode = useCallback(() => {
    clearParticipantToken()
    setManualToken('')
    setEntryProblem(null)
    setState({ kind: 'loading' })
    setHasToken(false)
  }, [])

  const submitCode = useCallback(() => {
    const reading = readAccessCode(manualToken)
    if ('problem' in reading) {
      setEntryProblem(reading.problem)
      return
    }
    setEntryProblem(null)
    setParticipantToken(reading.code)
    setHasToken(true)
  }, [manualToken])

  // Fallback for a link that lost its query string in transit (chat clients do
  // this), and the way back for anyone whose code was refused. Typed into
  // memory only — never stored.
  if (!hasToken) {
    const nothingToSubmit = manualToken.trim() === ''
    return (
      <main data-testid="packet-token-entry" className={PAGE_SHELL}>
        <div className={COLUMN}>
          <div className={CARD}>
            <p className={`${typography.label} flex items-center gap-2 text-info`}>
              <KeyRound className="h-4 w-4" aria-hidden="true" />
              Panel access
            </p>
            <h1 className={`${typography.h2} mt-3 text-text-header`}>
              Your panel link needs its access code
            </h1>
            <p className={`${typography.body} mt-3 text-text-body`}>
              The link you opened is missing its access code — some chat apps trim it. Paste the
              full link you were sent, or the code itself.
            </p>

            <div className="mt-6">
              <label
                htmlFor="packet-access-code"
                className={`${typography.label} block text-text-header`}
              >
                Panel access code
              </label>
              <input
                id="packet-access-code"
                data-testid="packet-manual-token"
                className={`${FIELD} ${typography.body} mt-2`}
                value={manualToken}
                autoComplete="off"
                spellCheck={false}
                aria-describedby="packet-access-code-hint"
                aria-invalid={entryProblem !== null}
                placeholder="Paste your link, or just the code"
                onChange={(e) => {
                  setManualToken(e.target.value)
                  if (entryProblem !== null) setEntryProblem(null)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !nothingToSubmit) submitCode()
                }}
              />
              <p
                id="packet-access-code-hint"
                data-testid="packet-manual-hint"
                className={`${typography.bodySmall} mt-2 text-text-light`}
              >
                Your code stays in this tab only — it is never saved to this device.
              </p>
              {entryProblem !== null && (
                <p
                  data-testid="packet-manual-token-error"
                  role="alert"
                  className={`${typography.bodySmall} mt-2 text-danger`}
                >
                  {entryProblem}
                </p>
              )}
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Button
                data-testid="packet-manual-continue"
                onClick={submitCode}
                disabled={nothingToSubmit}
              >
                Continue
              </Button>
              {nothingToSubmit && (
                <span
                  data-testid="packet-manual-continue-hint"
                  className={`${typography.bodySmall} text-text-light`}
                >
                  Paste your link or code to continue.
                </span>
              )}
            </div>
          </div>
        </div>
      </main>
    )
  }

  if (state.kind === 'loading') {
    return (
      <main
        data-testid="packet-loading"
        className={`${PAGE_SHELL} flex items-center justify-center`}
      >
        <p
          role="status"
          className={`${typography.body} flex items-center gap-3 text-text-light`}
        >
          <Loader2 className="h-5 w-5 animate-spin text-info" aria-hidden="true" />
          Loading your panel…
        </p>
      </main>
    )
  }

  if (state.kind === 'error') {
    const credential = isCredentialFailure(state.code, state.status)
    return (
      <main data-testid="packet-error" className={PAGE_SHELL}>
        <div className={COLUMN}>
          <div className={CARD}>
            <AlertTriangle className="h-8 w-8 text-warning" aria-hidden="true" />
            <h1 className={`${typography.h2} mt-4 text-text-header`}>
              {credential
                ? 'That access code was not recognised'
                : 'We could not open this panel'}
            </h1>
            {/* THE PART THE WITNESS FOUND MISSING: what to do next. The wire
                sentence alone ("That token could not be verified.") tells a
                first-time panellist nothing they can act on. */}
            <p
              data-testid="packet-error-guidance"
              role="alert"
              className={`${typography.body} mt-3 text-text-body`}
            >
              {credential
                ? 'Check the access code on your invitation and enter it again — a code only works for the round it was created for. If it still will not open, ask whoever invited you for a fresh link.'
                : 'This is usually temporary. Try again in a moment. If it keeps happening, ask whoever invited you for a fresh link.'}
            </p>
            {!credential && (
              <p
                data-testid="packet-error-detail"
                className={`${typography.bodySmall} mt-3 text-text-light`}
              >
                Details: {state.message}
              </p>
            )}
            <div className="mt-6 flex flex-wrap gap-3">
              <Button data-testid="packet-reenter-code" onClick={forgetCode}>
                Enter a different code
              </Button>
              <Button
                variant="secondary"
                data-testid="packet-retry"
                onClick={() => setAnsweredTick((n) => n + 1)}
              >
                Try again
              </Button>
            </div>
          </div>
        </div>
      </main>
    )
  }

  if (state.kind === 'reveal') {
    return <RevealBody reveal={state.reveal} />
  }

  const { packet } = state
  return (
    <main data-testid="participant-packet-page" className={PAGE_SHELL}>
      <div className={COLUMN}>
        <header className={CARD}>
          <h1 className={`${typography.h2} text-text-header`}>You have been asked for your view</h1>
          <p data-testid="packet-self-name" className={`${typography.body} mt-2 text-text-body`}>
            Answering as <strong className="font-semibold text-text-header">{packet.self.display_name}</strong>
          </p>

          {/* ⭐ The blindness promise, stated. A person who does not KNOW their
              answer is private behaves as though it is not — the guarantee only
              does its work if it is said out loud. Every clause here is true of the
              response this page received: it contains no sibling data at all. */}
          <p
            data-testid="packet-blindness-notice"
            className={`${typography.body} mt-4 flex gap-3 rounded-md border border-info/30 bg-panel p-4 text-text-body`}
          >
            <Lock className="mt-0.5 h-4 w-4 flex-none text-info" aria-hidden="true" />
            <span>
              Your answers are private until the round closes. You cannot see anyone
              else&rsquo;s answer, how many people have replied, or the model&rsquo;s own number —
              and they cannot see yours. That is deliberate: seeing them first would change what
              you write.
            </span>
          </p>

          {packet.context_note !== null && (
            <blockquote
              data-testid="packet-context-note"
              className={`${typography.body} mt-4 border-l-2 border-panel-border pl-4 text-text-body`}
            >
              {packet.context_note}
            </blockquote>
          )}
        </header>

        {packet.targets.map((t) => (
          <TargetCard
            key={t.target.id}
            target={t}
            roundId={packet.round_id}
            alreadyAnswered={packet.self.completed_target_ids.includes(t.target.id)}
            onAnswered={() => setAnsweredTick((n) => n + 1)}
          />
        ))}

        <p className={`${typography.bodySmall} mt-6 text-text-light`}>
          When everyone has answered, whoever invited you will close the round and you will both
          see every answer side by side.
        </p>
      </div>
    </main>
  )
}

/**
 * The reveal: every position, attributed, side by side.
 *
 * ⚠ NOTHING HERE AVERAGES, RANKS OR HIDES. There is no mean, no "recommended",
 * no winner and no consensus line — and a lone dissenter renders exactly like
 * anyone else. Disagreement is the signal this method exists to surface;
 * averaging it away would destroy the only thing it produces.
 */
export function RevealBody({ reveal }: { reveal: RevealView }): JSX.Element {
  const rows = useMemo(() => reveal.per_target, [reveal])
  return (
    <main data-testid="collab-reveal" className={PAGE_SHELL}>
      <div className="mx-auto w-full max-w-[820px]">
        <h1 className={`${typography.h2} text-text-header`}>Everyone&rsquo;s answers</h1>
        <p className={`${typography.body} mt-3 text-text-body`}>
          These are the answers as they were given, each in the words the person used. They are
          shown side by side and are not combined into a single number.
        </p>

        {rows.map((row) => (
          <section key={row.target.id} data-testid={`reveal-target-${row.target.id}`} className={`${CARD} mt-6`}>
            {/* The owner's own words for this target. A heading that read
                `factor-churn-risk` would obscure exactly what this view exists to
                make obvious: WHERE these two people disagree. Falls back to the
                id only if a round somehow carries no label. */}
            <h2 className={`${typography.h4} text-text-header`}>
              {row.label !== '' ? row.label : row.target.id}
            </h2>
            {row.model_value_at_version !== null && (
              <p className={`${typography.bodySmall} mt-1 text-text-light`}>
                The model held {row.model_value_at_version} for this when the round opened.
              </p>
            )}
            <ul className="mt-4 space-y-3">
              {row.responses.map((r) => (
                <li
                  key={r.participant_id}
                  data-testid={`reveal-response-${r.participant_id}`}
                  className={`${typography.body} rounded-md border border-panel-border bg-panel p-4 text-text-body`}
                >
                  {/* ⭐ ATTRIBUTION: the person, then their number, then THEIR
                      OWN WORDS. This line is the whole proof — a position that
                      belongs to a named human. */}
                  <strong
                    data-testid={`reveal-author-${r.participant_id}`}
                    className="font-semibold text-text-header"
                  >
                    {r.display_label}
                  </strong>
                  {r.kind === 'declined' ? (
                    <span className="text-text-light"> chose not to answer this one.</span>
                  ) : (
                    <>
                      <span data-testid={`reveal-value-${r.participant_id}`}> {r.value}</span>
                      {r.expression_raw !== null && r.expression_raw !== '' && (
                        <em data-testid={`reveal-words-${r.participant_id}`}>
                          {' '}
                          &mdash; &ldquo;{r.expression_raw}&rdquo;
                        </em>
                      )}
                      {r.kind === 'belief_revised' && (
                        <span className="text-text-light"> (revised)</span>
                      )}
                    </>
                  )}
                </li>
              ))}
            </ul>
            {row.responses.length === 1 && (
              <p
                data-testid={`reveal-single-${row.target.id}`}
                className={`${typography.bodySmall} mt-3 text-text-light`}
              >
                Only one person answered this. That is still their view, shown as given.
              </p>
            )}
          </section>
        ))}
      </div>
    </main>
  )
}
