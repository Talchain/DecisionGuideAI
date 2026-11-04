import { Loader2, RefreshCw } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { useViewStore } from '../../olumiView/store'
import type { View } from '../../olumiView/client'
import { isForThisPage, NOT_FOR_THIS_PAGE, useMe } from '../me'
import { CommitmentPanel } from './CommitmentPanel'
import { ComparePanel } from './ComparePanel'
import { EvidencePanel } from './EvidencePanel'
import { InvitePanel } from './InvitePanel'
import { NudgesPanel } from './NudgesPanel'
import { ViewsPanel } from './ViewsPanel'
import { BODY, ERR, H, META } from './ui'

/**
 * THE TEAM TAB (olumi-core lane only). The team's views, the reveal, evidence, commitments and their outcomes, every word and state as
 * core's View carries them (`collab`, `evidence`, `members`): the same View the canvas and the chat draw, so the tab and the canvas can
 * never disagree about which version or round they show. Writes go to core's own routes; after each one the View is read again.
 * Refresh, not realtime: another member's change shows on "Check for new views".
 */
export function TeamTab(): JSX.Element {
  const view = useViewStore((s) => s.view)
  const sid = useViewStore((s) => s.sid)
  const status = useViewStore((s) => s.status)
  const error = useViewStore((s) => s.error)
  const refresh = useViewStore((s) => s.refresh)
  const me = useMe((s) => s.me)
  const shown: View | null = view !== null && isForThisPage(view, me) ? view : null

  return (
    <div data-testid="team-tab" className="grid gap-4 pb-6">
      <div className="flex items-center justify-between gap-2">
        <h2 className={H}>Team</h2>
        <button
          type="button" data-testid="team-check" disabled={!sid || status === 'loading'} onClick={() => void refresh()}
          className={`${META} inline-flex cursor-pointer items-center gap-1 underline underline-offset-2 hover:text-text-body disabled:cursor-not-allowed disabled:no-underline disabled:opacity-50`}
        >
          {status === 'loading' ? <Loader2 aria-hidden="true" className="h-3 w-3 animate-spin" /> : <RefreshCw aria-hidden="true" className="h-3 w-3" />}
          Check for new views
        </button>
      </div>

      {!sid && <p className={BODY} data-testid="team-none">Start a model in the chat first. The team works on a model that is already saved.</p>}
      {sid && status === 'loading' && view === null && <p className={BODY} data-testid="team-loading">Reading your team’s page…</p>}
      {sid && view === null && status === 'error' && (
        <div className="grid gap-2" data-testid="team-error">
          <p role="alert" className={ERR}>{error}</p>
          <Button size="sm" variant="secondary" onClick={() => void refresh()}>Try again</Button>
        </div>
      )}
      {view !== null && shown === null && <p role="alert" className={ERR} data-testid="team-not-for-page">{NOT_FOR_THIS_PAGE}</p>}
      {shown !== null && error && <p role="alert" className={ERR} data-testid="team-stale">{error} What you see may be out of date.</p>}

      {shown !== null && sid && (
        <>
          <NudgesPanel sid={sid} view={shown} onWrote={refresh} />
          <ViewsPanel sid={sid} view={shown} onWrote={refresh} />
          <InvitePanel sid={sid} />
          <EvidencePanel sid={sid} view={shown} onWrote={refresh} />
          <CommitmentPanel sid={sid} view={shown} onWrote={refresh} />
          <ComparePanel sid={sid} view={shown} />
        </>
      )}
    </div>
  )
}
