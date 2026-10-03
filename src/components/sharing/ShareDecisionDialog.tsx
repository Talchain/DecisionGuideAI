/**
 * "Invite a colleague to this decision" — the owner's dialog (viewer access
 * only). Invite by email, see who has access, revoke.
 *
 * ⚠ PRIVACY: the server answers an invite identically whether or not the email
 * has an Olumi account, and this copy must not undo that. It never says "sent",
 * "invited user", "no account" or similar — only what will happen IF they have
 * an account. Revoking keeps the record server-side (`revoked_at`); here it
 * simply leaves the list.
 *
 * The server is the authority on ownership (SM403). This dialog is mounted only
 * for an owner, but a refused call still renders as "only the owner can share".
 */

import { useCallback, useEffect, useState } from 'react'
import { typography } from '../../styles/typography'
import {
  listScenarioMembers,
  shareScenario,
  unshareScenario,
  type ScenarioMember,
  type SharingFailure,
} from '../../services/scenarioSharingService'

export const SHARE_DIALOG_COPY = {
  title: 'Invite a colleague',
  lead: 'They can view this decision and its latest analysis. They cannot change it.',
  done: "Done. If they have an Olumi account, they'll see it under Shared with me.",
  membersHeading: 'People with view access',
  noMembers: 'Not shared with anyone yet.',
} as const

const FAILURE_COPY: Record<SharingFailure, string> = {
  not_owner: 'Only the owner of this decision can share it.',
  bad_email: 'Enter a valid email address, other than your own.',
  member_cap: 'This decision has reached the limit of people it can be shared with.',
  unavailable: "That didn't work just now. Try again in a moment.",
}

export function ShareDecisionDialog({
  scenarioId,
  scenarioTitle,
  onClose,
}: {
  scenarioId: string
  scenarioTitle: string
  onClose: () => void
}) {
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null)
  const [members, setMembers] = useState<ScenarioMember[] | null>(null)
  const [membersFailure, setMembersFailure] = useState<SharingFailure | null>(null)

  const refreshMembers = useCallback(async () => {
    const result = await listScenarioMembers(scenarioId)
    if (result.ok) {
      setMembers(result.members)
      setMembersFailure(null)
    } else {
      setMembersFailure(result.failure)
    }
  }, [scenarioId])

  useEffect(() => {
    void refreshMembers()
  }, [refreshMembers])

  const invite = async (e: React.FormEvent) => {
    e.preventDefault()
    if (busy) return
    setBusy(true)
    setNotice(null)
    const result = await shareScenario(scenarioId, email)
    setBusy(false)
    if (result.ok) {
      setEmail('')
      setNotice({ tone: 'ok', text: SHARE_DIALOG_COPY.done })
      void refreshMembers()
    } else {
      setNotice({ tone: 'error', text: FAILURE_COPY[result.failure] })
    }
  }

  const revoke = async (memberEmail: string) => {
    setNotice(null)
    const result = await unshareScenario(scenarioId, memberEmail)
    if (result.ok) {
      void refreshMembers()
    } else {
      setNotice({ tone: 'error', text: FAILURE_COPY[result.failure] })
    }
  }

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-decision-title"
        className="bg-panel rounded-[20px] shadow-3 p-6 max-w-md w-full mx-4"
        onClick={(e) => e.stopPropagation()}
        data-testid="share-decision-dialog"
      >
        <h3 id="share-decision-title" className={`${typography.h4} text-text-header`}>
          {SHARE_DIALOG_COPY.title}
        </h3>
        <p className={`${typography.body} text-text-light mt-1`}>&ldquo;{scenarioTitle}&rdquo;</p>
        <p className={`${typography.body} text-text-body mt-3`}>{SHARE_DIALOG_COPY.lead}</p>

        <form onSubmit={invite} className="mt-4 flex gap-2">
          <label htmlFor="share-decision-email" className="sr-only">
            Colleague&rsquo;s email
          </label>
          <input
            id="share-decision-email"
            type="email"
            autoComplete="off"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="colleague@company.com"
            className={`${typography.body} flex-1 px-3 py-2 rounded-lg border border-[rgba(38,38,38,0.16)] bg-panel text-text-body`}
            data-testid="share-decision-email"
          />
          <button
            type="submit"
            disabled={busy || email.trim() === ''}
            className={`${typography.button} px-4 py-2 rounded-pill bg-primary text-text-on-color hover:bg-primary-hover disabled:bg-primary-disabled disabled:cursor-not-allowed transition-colors duration-fast`}
            data-testid="share-decision-invite"
          >
            Invite
          </button>
        </form>

        {notice && (
          <p
            role={notice.tone === 'error' ? 'alert' : 'status'}
            className={`${typography.body} mt-3 ${notice.tone === 'error' ? 'text-danger' : 'text-text-body'}`}
            data-testid="share-decision-notice"
          >
            {notice.text}
          </p>
        )}

        <h4 className={`${typography.label} text-text-header mt-5`}>{SHARE_DIALOG_COPY.membersHeading}</h4>
        {membersFailure ? (
          <p className={`${typography.body} text-text-light mt-2`} data-testid="share-decision-members-error">
            {FAILURE_COPY[membersFailure]}
          </p>
        ) : members === null ? null : members.length === 0 ? (
          <p className={`${typography.body} text-text-light mt-2`}>{SHARE_DIALOG_COPY.noMembers}</p>
        ) : (
          <ul className="mt-2 flex flex-col gap-1" data-testid="share-decision-members">
            {members.map((m) => (
              <li key={m.email} className="flex items-center justify-between gap-2">
                <span className={`${typography.body} text-text-body truncate`}>{m.email}</span>
                <button
                  type="button"
                  onClick={() => void revoke(m.email)}
                  className={`${typography.button} px-3 py-1 rounded-pill border border-[rgba(38,38,38,0.16)] text-text-body hover:bg-panel-hover transition-colors duration-fast`}
                  aria-label={`Remove access for ${m.email}`}
                  data-testid="share-decision-revoke"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className={`${typography.button} px-4 py-2 rounded-pill border border-[rgba(38,38,38,0.16)] text-text-body hover:bg-panel-hover transition-colors duration-fast`}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
