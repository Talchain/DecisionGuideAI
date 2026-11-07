import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '../../components/ui/Button'
import { typography } from '../../styles/typography'
import { TeamApiError } from '../team/api'
import { accountsApi, whenOf, type MyScenario } from './api'
import { BODY, CARD, ERR, LINK, META, SignedInFrame, useWho } from './Frame'

/** Its address on this page: DGAI's scenario route (`/#/scenario/<uuid>`) as a route here; any other address as a plain link. */
function Open({ s }: { s: MyScenario }): JSX.Element {
  const cls = `${typography.h5} text-text-header hover:underline underline-offset-2`
  return s.open.startsWith('/#/') ? <Link to={s.open.slice(2)} className={cls} data-testid={`my-scenario-open-${s.id}`}>{s.label}</Link>
    : <a href={s.open} className={cls} data-testid={`my-scenario-open-${s.id}`}>{s.label}</a>
}

/**
 * MY SCENARIOS, the lane's home (core `GET /api/account/scenarios`): every scenario this person can open, most recent first, with the
 * version its model is at, when anything last happened and who is on it. Opening one goes to the scenario as it stands now, where the
 * team left it; "New scenario" starts one from a brief.
 */
export default function MyScenariosPage(): JSX.Element {
  const who = useWho()
  const navigate = useNavigate()
  const [list, setList] = useState<readonly MyScenario[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    if (who.status !== 'in') return
    let live = true
    accountsApi.scenarios().then((r) => { if (live) setList(Array.isArray(r?.scenarios) ? r.scenarios : []) }, (e) => { if (live) setError(e instanceof TeamApiError ? e.message : 'Olumi could not be read just now. Try again in a moment.') })
    return () => { live = false }
  }, [who.status])
  return (
    <SignedInFrame who={who} title="My scenarios" testid="account-home" action={<Button onClick={() => navigate('/canvas')} data-testid="my-scenarios-new">New scenario</Button>}>
      {(w) => (
        <>
          {!w.account && (
            <p className={`${CARD} ${BODY}`} data-testid="my-scenarios-no-account">
              You are signed in with a private link. <Link to="/signup" className={LINK}>Add an email and password</Link> to sign in from any browser and invite colleagues.
            </p>
          )}
          {error && <p role="alert" className={ERR}>{error}</p>}
          {list === null && !error && <p className={BODY}>Loading your scenarios…</p>}
          {list !== null && list.length === 0 && (
            <div className={`${CARD} grid gap-2`} data-testid="my-scenarios-empty">
              <p className={`${typography.h5} text-text-header m-0`}>No scenarios yet</p>
              <p className={BODY}>Start one by writing a brief: the question you are working on, in your own words. Olumi builds a model from it for you to shape.</p>
            </div>
          )}
          {list !== null && list.length > 0 && (
            <ul className="m-0 grid list-none gap-3 p-0" data-testid="my-scenarios">
              {list.map((s) => (
                <li key={s.id} className={`${CARD} grid gap-1.5`} data-testid={`my-scenario-${s.id}`}>
                  <Open s={s} />
                  <p className={META}>
                    {s.version === null ? 'No saved model yet' : `Version ${s.version}`}
                    {s.last_activity && <> · Last activity {whenOf(s.last_activity)}</>}
                    {s.your_last && <> · You were last active {whenOf(s.your_last)}</>}
                  </p>
                  <p className={`${typography.bodySmall} text-text-body m-0`}>On it: {s.members.map((m) => m.name).join(', ') || 'no one else yet'}</p>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </SignedInFrame>
  )
}
