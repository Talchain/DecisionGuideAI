import { Loader2, RefreshCw } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { useViewStore } from '../../olumiView/store'
import type { View } from '../../olumiView/client'
import { isForThisPage, NOT_FOR_THIS_PAGE, useMe } from '../me'
import { CommitmentPanel } from './CommitmentPanel'
import { DissentPanel } from './DissentPanel'
import { ComparePanel } from './ComparePanel'
import { EvidencePanel } from './EvidencePanel'
import { InvitePanel } from './InvitePanel'
import { NudgesPanel } from './NudgesPanel'
import { ViewsPanel } from './ViewsPanel'
import { BODY, CARD, ERR, H, META } from './ui'
import { TEAM_PAST_HELD } from './writes'
import { RevealDock, revealDockShown } from '../../olumiView/RevealDock'
import { useReveal } from '../../olumiView/reveal'

/**
 * THE TEAM TAB (olumi-core lane only). The team's views, the reveal, evidence, commitments and their outcomes, every word and state as
 * core's View carries them (`collab`, `evidence`, `members`): the same View the canvas and the chat draw, so the tab and the canvas can
 * never disagree about which version or round they show. Writes go to core's own routes; after each one the View is read again.
 * Another member's change arrives on its own: while the page is seen the View is read again about every 10 s (`src/olumiView/poll.ts`,
 * POLL_MS, R2 9055eb083), and at once on "Check for new views"; not a live push, so it can take up to one poll to show.
 */
export function TeamTab(): JSX.Element {
  const view = useViewStore((s) => s.view)
  const sid = useViewStore((s) => s.sid)
  const status = useViewStore((s) => s.status)
  const error = useViewStore((s) => s.error)
  const refresh = useViewStore((s) => s.refresh)
  const past = useViewStore((s) => s.at)
  const me = useMe((s) => s.me)
  const shown: View | null = view !== null && isForThisPage(view, me) ? view : null
  // V11: a view opened from its mark on the canvas fills the tab (one focus); closing it brings the team's panels back.
  const opened = useReveal((s) => s.selected)
  if (shown !== null && sid && past === null && revealDockShown(shown, opened)) {
    return <div data-testid="team-tab" className="grid min-h-full pb-6"><RevealDock view={shown} /></div>
  }

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
          {past !== null && (
            <div className={`${CARD} flex flex-wrap items-center gap-2`} data-testid="team-past">
              <span className={BODY}>Version {past} is on the canvas, as it was. {TEAM_PAST_HELD}</span>
              <Button size="sm" variant="secondary" data-testid="team-past-back" onClick={() => void useViewStore.getState().look(null)}>Back to the latest</Button>
            </div>
          )}
          {/* The team's record is the live scenario's: its forms are held while an earlier version is drawn (the writer refuses too). */}
          {/* The nudges' reveal is the team's record too: held with the forms (R1 review 1; the writer refuses it as well). */}
          <fieldset disabled={past !== null} className="contents"><NudgesPanel sid={sid} view={shown} onWrote={refresh} /></fieldset>
          <fieldset disabled={past !== null} className="contents"><ViewsPanel sid={sid} view={shown} onWrote={refresh} /></fieldset>
          <fieldset disabled={past !== null} className="contents"><DissentPanel sid={sid} view={shown} onWrote={refresh} /></fieldset>
          <InvitePanel sid={sid} />
          <fieldset disabled={past !== null} className="contents"><EvidencePanel sid={sid} view={shown} onWrote={refresh} /></fieldset>
          <fieldset disabled={past !== null} className="contents"><CommitmentPanel sid={sid} view={shown} onWrote={refresh} /></fieldset>
          <ComparePanel sid={sid} view={shown} />
        </>
      )}
    </div>
  )
}
