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

import { BeliefElicitationField } from '../canvas/components/BeliefElicitationField'
import { useBeliefElicitation } from '../canvas/hooks/useBeliefElicitation'
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
import { getParticipantToken, setParticipantToken } from '../collab/participantToken'

type LoadState =
  | { kind: 'loading' }
  | { kind: 'packet'; packet: OpenPacket }
  | { kind: 'reveal'; reveal: RevealView }
  | { kind: 'error'; message: string; code: string }

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
    <section data-testid={`packet-target-${target.target.id}`} style={{ marginBottom: '2rem' }}>
      <h2 style={{ fontSize: '1.05rem', margin: '0 0 0.25rem' }}>{target.label}</h2>
      {target.description !== null && (
        <p style={{ margin: '0 0 0.75rem', opacity: 0.8 }}>{target.description}</p>
      )}

      <BeliefElicitationField
        label={target.label}
        phrase={phrase}
        onPhraseChange={handlePhraseChange}
        elicitation={elicitation}
        onAccept={commit}
        testId={`packet-belief-${target.target.id}`}
      />

      <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
        <button type="button" onClick={handleDecline} disabled={busy}>
          I would rather not answer this
        </button>
        {saved && (
          <span data-testid={`packet-saved-${target.target.id}`}>
            {alreadyAnswered ? 'Answer updated.' : 'Answer recorded.'} You can change it until the
            round closes.
          </span>
        )}
      </div>

      {error !== null && (
        <p role="alert" style={{ color: 'crimson' }}>
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
  const [answeredTick, setAnsweredTick] = useState(0)

  const hasToken = getParticipantToken() !== null

  const load = useCallback(async () => {
    if (roundId === undefined) {
      setState({ kind: 'error', code: 'no_round', message: 'That link is incomplete.' })
      return
    }
    setState({ kind: 'loading' })
    try {
      const packet = await fetchOpenPacket(roundId)
      setState({ kind: 'packet', packet })
    } catch (err) {
      const code = err instanceof CollabRequestError ? err.code : 'collab_request_failed'
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
        message: err instanceof CollabRequestError ? err.message : 'Could not load your panel.',
      })
    }
  }, [roundId])

  useEffect(() => {
    if (hasToken) void load()
  }, [hasToken, load, answeredTick])

  // Fallback for a link that lost its query string in transit (chat clients do
  // this). Typed into memory only — never stored.
  if (!hasToken) {
    return (
      <main style={{ maxWidth: 640, margin: '3rem auto', padding: '0 1rem' }}>
        <h1>Your panel link needs its access code</h1>
        <p>
          The link you opened is missing its access code — some chat apps trim it. Paste the full
          link you were sent, or the code itself.
        </p>
        <input
          aria-label="Panel access code"
          data-testid="packet-manual-token"
          value={manualToken}
          onChange={(e) => setManualToken(e.target.value)}
        />
        <button
          type="button"
          onClick={() => {
            const raw = manualToken.trim()
            const match = /[?&](?:ct|collab_token)=([^&#]+)/.exec(raw)
            setParticipantToken(match !== null ? decodeURIComponent(match[1]) : raw)
            setAnsweredTick((t) => t + 1)
          }}
        >
          Continue
        </button>
      </main>
    )
  }

  if (state.kind === 'loading') {
    return <main data-testid="packet-loading">Loading your panel…</main>
  }

  if (state.kind === 'error') {
    return (
      <main data-testid="packet-error" style={{ maxWidth: 640, margin: '3rem auto' }}>
        <h1>We could not open this panel</h1>
        <p role="alert">{state.message}</p>
      </main>
    )
  }

  if (state.kind === 'reveal') {
    return <RevealBody reveal={state.reveal} />
  }

  const { packet } = state
  return (
    <main
      data-testid="participant-packet-page"
      style={{ maxWidth: 720, margin: '2rem auto', padding: '0 1rem' }}
    >
      <h1>You have been asked for your view</h1>
      <p data-testid="packet-self-name">
        Answering as <strong>{packet.self.display_name}</strong>
      </p>

      {/* ⭐ The blindness promise, stated. A person who does not KNOW their
          answer is private behaves as though it is not — the guarantee only
          does its work if it is said out loud. Every clause here is true of the
          response this page received: it contains no sibling data at all. */}
      <p data-testid="packet-blindness-notice">
        Your answers are private until the round closes. You cannot see anyone else&rsquo;s answer,
        how many people have replied, or the model&rsquo;s own number — and they cannot see yours.
        That is deliberate: seeing them first would change what you write.
      </p>

      {packet.context_note !== null && (
        <blockquote data-testid="packet-context-note">{packet.context_note}</blockquote>
      )}

      {packet.targets.map((t) => (
        <TargetCard
          key={t.target.id}
          target={t}
          roundId={packet.round_id}
          alreadyAnswered={packet.self.completed_target_ids.includes(t.target.id)}
          onAnswered={() => setAnsweredTick((n) => n + 1)}
        />
      ))}

      <p style={{ opacity: 0.75 }}>
        When everyone has answered, whoever invited you will close the round and you will both see
        every answer side by side.
      </p>
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
    <main
      data-testid="collab-reveal"
      style={{ maxWidth: 820, margin: '2rem auto', padding: '0 1rem' }}
    >
      <h1>Everyone&rsquo;s answers</h1>
      <p>
        These are the answers as they were given, each in the words the person used. They are shown
        side by side and are not combined into a single number.
      </p>

      {rows.map((row) => (
        <section key={row.target.id} data-testid={`reveal-target-${row.target.id}`}>
          {/* The owner's own words for this target. A heading that read
              `factor-churn-risk` would obscure exactly what this view exists to
              make obvious: WHERE these two people disagree. Falls back to the
              id only if a round somehow carries no label. */}
          <h2>{row.label !== '' ? row.label : row.target.id}</h2>
          {row.model_value_at_version !== null && (
            <p style={{ opacity: 0.75 }}>
              The model held {row.model_value_at_version} for this when the round opened.
            </p>
          )}
          <ul>
            {row.responses.map((r) => (
              <li key={r.participant_id} data-testid={`reveal-response-${r.participant_id}`}>
                {/* ⭐ ATTRIBUTION: the person, then their number, then THEIR
                    OWN WORDS. This line is the whole proof — a position that
                    belongs to a named human. */}
                <strong data-testid={`reveal-author-${r.participant_id}`}>{r.display_label}</strong>
                {r.kind === 'declined' ? (
                  <span> chose not to answer this one.</span>
                ) : (
                  <>
                    <span data-testid={`reveal-value-${r.participant_id}`}> {r.value}</span>
                    {r.expression_raw !== null && r.expression_raw !== '' && (
                      <em data-testid={`reveal-words-${r.participant_id}`}>
                        {' '}
                        &mdash; &ldquo;{r.expression_raw}&rdquo;
                      </em>
                    )}
                    {r.kind === 'belief_revised' && <span> (revised)</span>}
                  </>
                )}
              </li>
            ))}
          </ul>
          {row.responses.length === 1 && (
            <p data-testid={`reveal-single-${row.target.id}`} style={{ opacity: 0.75 }}>
              Only one person answered this. That is still their view, shown as given.
            </p>
          )}
        </section>
      ))}
    </main>
  )
}
