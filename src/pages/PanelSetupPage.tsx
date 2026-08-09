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
 * has closed.
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
import { useParams } from 'react-router-dom'

import { useAuth } from '../contexts/AuthContext'
import {
  CollabRequestError,
  closeRound,
  fetchOwnerReveal,
  mintRound,
  participantLink,
  type MintedRound,
  type RevealView,
} from '../collab/collabService'
import { RevealBody } from './ParticipantPacketPage'

export default function PanelSetupPage(): JSX.Element {
  const { id: scenarioId } = useParams<{ id: string }>()
  const { session } = useAuth() as { session?: { access_token?: string } | null }
  const accessToken = session?.access_token ?? ''

  const [targetId, setTargetId] = useState('')
  const [targetLabel, setTargetLabel] = useState('')
  const [contextNote, setContextNote] = useState('')
  const [nameA, setNameA] = useState('')
  const [nameB, setNameB] = useState('')
  const [minted, setMinted] = useState<MintedRound | null>(null)
  const [reveal, setReveal] = useState<RevealView | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const handleMint = useCallback(async () => {
    setBusy(true)
    setError(null)
    try {
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
      setError(
        err instanceof CollabRequestError ? err.message : 'Could not open the round.',
      )
    } finally {
      setBusy(false)
    }
  }, [accessToken, scenarioId, targetId, targetLabel, contextNote, nameA, nameB])

  const handleClose = useCallback(async () => {
    if (minted === null) return
    setBusy(true)
    setError(null)
    try {
      await closeRound(accessToken, minted.round_id)
      setReveal(await fetchOwnerReveal(accessToken, minted.round_id))
    } catch (err) {
      setError(err instanceof CollabRequestError ? err.message : 'Could not close the round.')
    } finally {
      setBusy(false)
    }
  }, [accessToken, minted])

  if (reveal !== null) return <RevealBody reveal={reveal} />

  return (
    <main
      data-testid="panel-setup-page"
      style={{ maxWidth: 720, margin: '2rem auto', padding: '0 1rem' }}
    >
      <h1>Ask your team, without anchoring them</h1>
      <p>
        Everyone answers privately. Nobody &mdash; including you &mdash; sees any answer until you
        close the round. Then you see them all, side by side, in each person&rsquo;s own words.
      </p>

      {minted === null ? (
        <>
          <label>
            Which factor should they estimate?
            <input
              data-testid="panel-target-id"
              value={targetId}
              onChange={(e) => setTargetId(e.target.value)}
              placeholder="factor id from your model"
            />
          </label>
          <label>
            How should it be described to them?
            <input
              data-testid="panel-target-label"
              value={targetLabel}
              onChange={(e) => setTargetLabel(e.target.value)}
            />
          </label>
          <label>
            Anything they should know first? (optional)
            <textarea
              data-testid="panel-context-note"
              value={contextNote}
              onChange={(e) => setContextNote(e.target.value)}
            />
          </label>
          <label>
            First person&rsquo;s name
            <input
              data-testid="panel-name-a"
              value={nameA}
              onChange={(e) => setNameA(e.target.value)}
            />
          </label>
          <label>
            Second person&rsquo;s name
            <input
              data-testid="panel-name-b"
              value={nameB}
              onChange={(e) => setNameB(e.target.value)}
            />
          </label>
          <button
            type="button"
            data-testid="panel-mint"
            onClick={handleMint}
            disabled={busy || targetId.trim() === ''}
          >
            Open the round
          </button>
        </>
      ) : (
        <>
          <h2>Send each person their own link</h2>
          {/* Said once, plainly, at the only moment it can be acted on. */}
          <p data-testid="panel-token-warning">
            These links are shown once and cannot be recovered — they are not stored anywhere. Copy
            them now. Anyone holding a link can answer as that person, so send each one directly.
          </p>
          <ul>
            {minted.participants.map((p) => (
              <li key={p.participant_id} data-testid={`panel-link-${p.participant_id}`}>
                <strong>{p.display_name}</strong>
                <input readOnly value={participantLink(minted.round_id, p.token)} />
              </li>
            ))}
          </ul>
          <p style={{ opacity: 0.75 }}>
            This round is pinned to the version of your model as it is right now, so the answers
            stay meaningful even if you keep editing.
          </p>
          <button type="button" data-testid="panel-close" onClick={handleClose} disabled={busy}>
            Close the round and show everyone&rsquo;s answers
          </button>
          <p style={{ opacity: 0.75 }}>
            You will not see whether they have answered yet &mdash; that would tell you something
            about their replies before you have given yours. Check with them first.
          </p>
        </>
      )}

      {error !== null && (
        <p role="alert" data-testid="panel-error" style={{ color: 'crimson' }}>
          {error}
        </p>
      )}
    </main>
  )
}
