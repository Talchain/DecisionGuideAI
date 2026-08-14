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
 * A second witness (the 12 Aug two-person run, leg 2) found the SUBMIT side
 * equally silent: the post-submit reload remounts every card, so the card-local
 * "saved" flash died instantly and neither person could tell the contribution
 * had landed (W-F3). The confirmation is now PAGE-held, built from the 201
 * receipt, and bound to the round it was accepted for — see
 * `SubmissionConfirmation` below.
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
import { AlertTriangle, CheckCircle2, KeyRound, Loader2, Lock } from 'lucide-react'

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
  TOKEN_PARAM_NAMES,
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

/** Regex-escape a literal so a future param name cannot become an operator. */
function escapeForRegExp(literal: string): string {
  return literal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * The spellings the boot-path strip accepts — DERIVED from the single
 * authority, never spelled here.
 *
 * ⚠ This was a hand-copied twin of `TOKEN_PARAM_NAMES` until #669's review
 * demonstrated the drift (N1): a spelling added to the authority but not here
 * would make this page REFUSE a link the boot path accepts — the participant's
 * own paste-recovery path rejecting a valid invitation. Deriving it makes the
 * two agree structurally; what derivation cannot prove is that the authority
 * itself is complete (trap 12d), which is the authority's own concern.
 */
const CODE_IN_LINK = new RegExp(
  `[?&](?:${[...TOKEN_PARAM_NAMES].map(escapeForRegExp).join('|')})=([^&#\\s]+)`,
)

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

/* ── W-F3: a submission must leave a LASTING, truthful confirmation ────────
 * The two-person witness (leg 2, 12 Aug) found that after a participant
 * submits, the card silently resets: the post-submit reload remounts every
 * `TargetCard`, so card-local "saved" state died with it and neither person
 * could tell the contribution had landed. The confirmation therefore lives at
 * PAGE level, is built from the server's 201 RECEIPT (not from hope), and is
 * shown only for the round it belongs to.
 */

/**
 * What this participant has had RECORDED, per target — every claim in the
 * rendered confirmation traces to a wire fact:
 *   • that it was recorded at all — the 201 receipt;
 *   • what — the value/words this page sent in the accepted request;
 *   • when — the receipt's own `created_at` (server clock), never this
 *     device's; absent from the receipt ⇒ no time is shown;
 *   • whose — the receipt's `authored_by`, matched against the packet's
 *     `self.participant_id` before any "as <name>" claim is made.
 */
type SubmissionConfirmation = {
  /** The round the submission was ACCEPTED for — the binding identity. */
  roundId: string
  targetId: string
  kind: 'answered' | 'revised' | 'declined'
  value: number | null
  words: string | null
  /** ISO timestamp from the receipt, or null — never a client-side clock. */
  createdAt: string | null
  /** The participant the SERVER attributed the event to, from the receipt. */
  authoredBy: string | null
}

/**
 * ⚠ BOUND BY IDENTITY to the round on screen. A fresh round re-asking the same
 * factor (same target id, new round_id) must render a fresh form, not last
 * round's confirmation — a confirmation shown for the wrong round is a lie
 * about THIS round. Keyed lookup by target id, then the round_id gate.
 */
function confirmationForRound(
  held: Record<string, SubmissionConfirmation>,
  roundId: string,
  targetId: string,
): SubmissionConfirmation | null {
  const candidate = held[targetId]
  if (candidate === undefined) return null
  return candidate.roundId === roundId ? candidate : null
}

/**
 * The receipt's server timestamp, if the wire carried one.
 *
 * The producer (CEE `collab.v1.packet.ts`) sends `created_at` on every 201;
 * the UI's declared receipt type predates that field, so it is read here with
 * a runtime check rather than widened in `collabService.ts` (that file is
 * owned by open PR #674 — zero-overlap rule). An absent or unparseable value
 * returns null and the confirmation simply makes no "when" claim.
 */
function receiptCreatedAt(receipt: unknown): string | null {
  if (typeof receipt !== 'object' || receipt === null) return null
  const value = (receipt as Record<string, unknown>).created_at
  if (typeof value !== 'string') return null
  return Number.isNaN(new Date(value).getTime()) ? null : value
}

/** "18:02" in the participant's own locale, or null if the wire gave no time. */
function formatRecordedTime(createdAt: string | null): string | null {
  if (createdAt === null) return null
  const parsed = new Date(createdAt)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
}

/** One target, with its own phrase state (the field is caller-owned). */
function TargetCard({
  target,
  roundId,
  self,
  alreadyAnswered,
  confirmation,
  onConfirmed,
}: {
  target: PacketTarget
  roundId: string
  self: OpenPacket['self']
  alreadyAnswered: boolean
  /** Round-bound already — the page filters through `confirmationForRound`. */
  confirmation: SubmissionConfirmation | null
  onConfirmed: (confirmation: SubmissionConfirmation) => void
}): JSX.Element {
  const [phrase, setPhrase] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
        const words = phrase.trim() === '' ? null : phrase
        const receipt = await submitBelief(roundId, {
          targetId: target.target.id,
          targetKind: target.target.kind,
          value,
          // ⭐ VERBATIM. Not the parsed number, not a normalisation — the words
          // this person typed, which is what the reveal shows beside the number.
          expressionRaw: words,
          confidence: null,
          revision: alreadyAnswered,
        })
        // Recorded at PAGE level, from the receipt: the post-submit reload
        // remounts this card, and anything held here dies with it (W-F3).
        onConfirmed({
          roundId,
          targetId: target.target.id,
          kind: alreadyAnswered ? 'revised' : 'answered',
          value,
          words,
          createdAt: receiptCreatedAt(receipt),
          authoredBy: receipt.authored_by,
        })
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
    [roundId, target, phrase, alreadyAnswered, onConfirmed],
  )

  const handleDecline = useCallback(async () => {
    setBusy(true)
    setError(null)
    try {
      await declineTarget(roundId, { targetId: target.target.id, targetKind: target.target.kind })
      // `declineTarget` surfaces no receipt body, so this confirmation makes
      // no "when"/"whose" claim — kind and round are what the accepted request
      // established, and nothing more is asserted.
      onConfirmed({
        roundId,
        targetId: target.target.id,
        kind: 'declined',
        value: null,
        words: null,
        createdAt: null,
        authoredBy: null,
      })
    } catch (err) {
      setError(err instanceof CollabRequestError ? err.message : 'That did not save.')
    } finally {
      setBusy(false)
    }
  }, [roundId, target, onConfirmed])

  /* Every clause below is a wire fact or it is not rendered: the time comes
   * from the receipt's `created_at` (none ⇒ no time claim), and "as <name>"
   * is made only when the receipt's `authored_by` IS this packet's self. */
  const recordedTime = confirmation === null ? null : formatRecordedTime(confirmation.createdAt)
  const recordedAsSelf =
    confirmation !== null &&
    confirmation.authoredBy !== null &&
    confirmation.authoredBy === self.participant_id

  return (
    <section data-testid={`packet-target-${target.target.id}`} className={`${CARD} mt-4`}>
      <h2 className={`${typography.h4} text-text-header`}>{target.label}</h2>
      {target.description !== null && (
        <p className={`${typography.body} mt-1 text-text-light`}>{target.description}</p>
      )}

      {/* W-F3: the LASTING confirmation. Page-held, receipt-built, round-bound
          — it survives the post-submit reload that used to silently reset this
          card, and a fresh round renders a fresh form instead of it. */}
      {confirmation !== null && (
        <p
          data-testid={`packet-confirmation-${target.target.id}`}
          className={`${typography.body} mt-4 flex gap-3 rounded-md border border-success/30 bg-panel p-4 text-text-body`}
        >
          <CheckCircle2 className="mt-0.5 h-4 w-4 flex-none text-success" aria-hidden="true" />
          {confirmation.kind === 'declined' ? (
            <span>
              <strong className="font-semibold text-text-header">
                Your choice not to answer this has been recorded.
              </strong>{' '}
              You can still answer below until the round closes.
            </span>
          ) : (
            <span>
              <strong className="font-semibold text-text-header">
                {confirmation.kind === 'revised'
                  ? 'Your answer has been updated.'
                  : 'Your answer is in.'}
              </strong>{' '}
              <span data-testid={`packet-confirmation-value-${target.target.id}`}>
                You answered {confirmation.value}
                {confirmation.words !== null && (
                  <em> &mdash; &ldquo;{confirmation.words}&rdquo;</em>
                )}
                .
              </span>{' '}
              {(recordedTime !== null || recordedAsSelf) && (
                <span data-testid={`packet-confirmation-recorded-${target.target.id}`}>
                  Recorded
                  {recordedTime !== null ? ` at ${recordedTime}` : ''}
                  {recordedAsSelf ? ` as ${self.display_name}` : ''}.{' '}
                </span>
              )}
              It stays private until the round closes — you can change it below until then.
            </span>
          )}
        </p>
      )}

      {/* The weaker truth that survives even a full reload (the token does not,
          but a re-opened link lands here with the same packet): the SERVER says
          this participant has responded — `self.completed_target_ids`, which
          counts declines too, hence "responded", not "answered". What and when
          are not in the packet, so they are not claimed. */}
      {confirmation === null && alreadyAnswered && (
        <p
          data-testid={`packet-already-answered-${target.target.id}`}
          className={`${typography.body} mt-4 flex gap-3 rounded-md border border-success/30 bg-panel p-4 text-text-body`}
        >
          <CheckCircle2 className="mt-0.5 h-4 w-4 flex-none text-success" aria-hidden="true" />
          <span>
            You have already responded to this one in this round. Your response is saved and
            stays private until the round closes — answering below will update it.
          </span>
        </p>
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
   * W-F3: what this participant has had recorded, keyed by target id, held at
   * PAGE level because the post-submit reload remounts every card. Entries
   * carry the round they were accepted for and are surfaced only through
   * `confirmationForRound` — a fresh round (new round_id, even for the same
   * factor) gets a fresh form, never last round's confirmation.
   */
  const [confirmations, setConfirmations] = useState<Record<string, SubmissionConfirmation>>({})

  const handleConfirmed = useCallback((confirmation: SubmissionConfirmation) => {
    setConfirmations((prev) => ({ ...prev, [confirmation.targetId]: confirmation }))
    // Same reload as before the fix: `completed_target_ids` is re-derived from
    // the wire, so revision state stays the server's word, not this page's.
    setAnsweredTick((n) => n + 1)
  }, [])

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
    // Held confirmations die with the credential that produced them: two-person
    // trials share devices, and the next code entered may be ANOTHER
    // participant on the SAME round — round_id binding alone cannot tell them
    // apart, and Grace's receipt is not evidence about Priya (found RED-first
    // by this lane's own cross-person test, not by the witness).
    setConfirmations({})
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
              {/* N3 (#669 review): "Try again" re-sends the SAME held token, so
                  on a credential refusal it cannot succeed — the server has
                  just declined exactly what it would re-send. The honest
                  affordances there are the two the guidance names: enter the
                  code again, or ask the owner for a fresh link (#672's
                  recovery). Retry stays for every other failure, where a
                  moment later genuinely can differ. */}
              {!credential && (
                <Button
                  variant="secondary"
                  data-testid="packet-retry"
                  onClick={() => setAnsweredTick((n) => n + 1)}
                >
                  Try again
                </Button>
              )}
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
            self={packet.self}
            alreadyAnswered={packet.self.completed_target_ids.includes(t.target.id)}
            confirmation={confirmationForRound(confirmations, packet.round_id, t.target.id)}
            onConfirmed={handleConfirmed}
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
export interface RevealApplyState {
  /**
   * Apply one person's answer to the model. ABSENCE IS THE GATE: this page is
   * rendered on BOTH the participant path and the owner path, and only the
   * owner page passes a handler. A participant is therefore never offered an
   * action that would 401 — the affordance does not exist for them, rather than
   * existing and failing. No flag, no role check in this component.
   */
  onApply: (args: { targetId: string; participantId: string; value: number }) => void
  /** `${targetId}:${participantId}` while that row's apply is in flight. */
  applyingKey: string | null
  /** The row applied most recently this session, same key shape. */
  appliedKey: string | null
  /** Honest failure copy for the last apply, if it failed. */
  applyError: string | null
}

export function RevealBody({
  reveal,
  apply,
}: {
  reveal: RevealView
  apply?: RevealApplyState
}): JSX.Element {
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
                      {/* ⭐ THE APPLY. The label names the PERSON and the
                          NUMBER — never "use the best estimate", never
                          "recommended", because there is no such thing here.
                          Every row keeps its own button, including after
                          another row has been applied: the un-applied views
                          stay live, so a change of mind costs one click and
                          the minority position is never retired. */}
                      {apply !== undefined && r.value !== null && (
                        <div className="mt-3">
                          <button
                            type="button"
                            data-testid={`reveal-apply-${row.target.id}-${r.participant_id}`}
                            disabled={apply.applyingKey !== null}
                            onClick={() =>
                              apply.onApply({
                                targetId: row.target.id,
                                participantId: r.participant_id,
                                // The EXACT number served by the reveal, never a
                                // re-parsed or re-rounded one. CEE compares it to
                                // its own record with `Object.is` and refuses on
                                // any difference, so a display-rounded value here
                                // would refuse every apply.
                                value: r.value as number,
                              })
                            }
                            className="rounded-md border border-panel-border px-3 py-1.5 text-sm font-medium text-text-header hover:bg-panel-hover disabled:opacity-50"
                          >
                            {apply.applyingKey === `${row.target.id}:${r.participant_id}`
                              ? `Using ${r.display_label}\u2019s ${r.value}\u2026`
                              : `Use ${r.display_label}\u2019s ${r.value}`}
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </li>
              ))}
            </ul>

            {/* ⭐ THE DISAGREEMENT AFFORDANCE. It states the SPREAD as a fact —
                how many distinct views there are and that they were not
                combined. It never names a winner, never averages, and never
                calls anything resolved: there is no aggregate on this page at
                any nesting level, by construction. */}
            {row.responses.filter((r) => r.value !== null).length > 1 && (
              <p
                data-testid={`reveal-disagreement-${row.target.id}`}
                className={`${typography.bodySmall} mt-3 text-text-light`}
              >
                {row.responses.filter((r) => r.value !== null).length} people gave different
                answers here. They are kept as they were given &mdash; applying one to your model
                does not remove the others.
              </p>
            )}

            {/* The consequence sentence, and the reason it names the OTHER
                people: applying Grace's number must not read as the panel
                having agreed on it. */}
            {apply?.appliedKey?.startsWith(`${row.target.id}:`) === true && (
              <p
                role="status"
                data-testid={`reveal-applied-${row.target.id}`}
                className={`${typography.bodySmall} mt-3 text-text-body`}
              >
                {(() => {
                  const appliedPid = apply.appliedKey.slice(row.target.id.length + 1)
                  const applied = row.responses.find((r) => r.participant_id === appliedPid)
                  const others = row.responses.filter(
                    (r) => r.participant_id !== appliedPid && r.value !== null,
                  )
                  const label = row.label !== '' ? row.label : row.target.id
                  const head =
                    applied === undefined
                      ? `Your model has been updated for \u201c${label}\u201d.`
                      : `Your model now uses ${applied.display_label}\u2019s ${applied.value} for \u201c${label}\u201d.`
                  if (others.length === 0) return head
                  const names = others.map((o) => `${o.display_label}\u2019s ${o.value}`).join(', ')
                  return `${head} ${names} ${others.length === 1 ? 'is' : 'are'} still recorded below.`
                })()}
              </p>
            )}

            {apply?.applyError !== null && apply?.applyError !== undefined && (
              <p
                role="status"
                data-testid={`reveal-apply-error-${row.target.id}`}
                className={`${typography.bodySmall} mt-3 text-text-body`}
              >
                {apply.applyError}
              </p>
            )}
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
