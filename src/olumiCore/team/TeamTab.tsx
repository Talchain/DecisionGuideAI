import { useEffect } from 'react'
import { Loader2, RefreshCw } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { heldOf, heldWords } from './model'
import { TeamMembers } from './TeamMembers'
import { RevealPanel } from './RevealPanel'
import { ViewComposer } from './ViewComposer'
import { useTeamStore } from './store'
import { BODY, ERR, H, META } from './ui'

/**
 * THE TEAM TAB (olumi-core lane only; design plan TEAM-PANELS-PLAN r2). One dock tab holds the team journey: who is here, your
 * private view, the reveal, where you differ, evidence, the commitment and its outcome. It reads olumi-core's scenario view and
 * writes through the `/api` proxy. Refresh, not realtime: it reads when opened, after each write and on "Check for new views".
 * Olumi is not asked anything from here except through the chat (`onAskOlumi`).
 */
export function TeamTab({ scenarioUuid, onAskOlumi }: { scenarioUuid: string | null; onAskOlumi?: (question: string) => void }): JSX.Element {
  const { scenario, sid, status, error } = useTeamStore()
  const use = useTeamStore((s) => s.use)
  const refresh = useTeamStore((s) => s.refresh)
  useEffect(() => { void use(scenarioUuid).then(() => refresh()) }, [scenarioUuid, use, refresh])

  const held = scenario ? heldOf(scenario) : null
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

      {status === 'none' && <p className={BODY} data-testid="team-none">Start a model in the chat first. The team works on a model that is already saved.</p>}
      {status === 'loading' && !scenario && <p className={BODY} data-testid="team-loading">Reading your team’s page…</p>}
      {status === 'error' && !scenario && (
        <div className="grid gap-2" data-testid="team-error">
          <p role="alert" className={ERR}>{error}</p>
          <Button size="sm" variant="secondary" onClick={() => void refresh()}>Try again</Button>
        </div>
      )}
      {error && scenario && <p role="alert" className={ERR} data-testid="team-stale">{error} What you see may be out of date.</p>}

      {scenario && sid && (
        <>
          <TeamMembers scenario={scenario} />
          <ViewComposer sid={sid} scenario={scenario} onWrote={refresh} />
          {held && held.given > 0 && <p className={META} data-testid="team-held-count">{heldWords(held)}</p>}
          <RevealPanel sid={sid} scenario={scenario} onWrote={refresh} onAskOlumi={onAskOlumi} />
        </>
      )}
    </div>
  )
}
