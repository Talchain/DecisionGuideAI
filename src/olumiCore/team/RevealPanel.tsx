import { useState } from 'react'
import { Eye, Hourglass } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { teamApi, TeamApiError } from './api'
import { TeamSpreadStrip, figureText } from './TeamSpreadStrip'
import { ViewFindings } from './ViewFindings'
import { readFigure, revealedViews, spreadsOf, waitingNames, type ReadFigure } from './model'
import { MAY_HAVE_SAVED, runWrite, useWriteLocked } from './writes'
import { AVATAR, BODY, CARD, ERR, H, META } from './ui'
import type { TeamScenario, TeamViewRow } from './types'

/** Olumi is asked about the revealed WORDS only: a view's figures are never put in the question (Olumi never reads them). */
export const MAX_ASK_CHARS = 3900
export function askAboutViews(views: readonly TeamViewRow[]): string | null {
  const said = views.filter((v) => !v.skip && v.text !== '')
  if (said.length < 2) return null
  const text = ['We revealed our views together. Where do we differ, and what would settle it?', ...said.map((v) => `${v.by}: ${v.text}`)].join('\n')
  return text.length <= MAX_ASK_CHARS ? text : null
}

/** The figures of a view this page can read (core's shape has no `kind`; `readFigure` tells a point from a range). One it cannot read is not drawn. */
const figuresOf = (v: TeamViewRow): ReadFigure[] => (v.figures ?? []).flatMap((f) => { const r = readFigure(f); return r ? [r] : [] })
const figureLine = (f: ReadFigure, label: (id: string) => string): string =>
  `${label(f.quantity)}: ${f.kind === 'point' ? figureText(f.value, f.unit ?? null) : `${figureText(f.low, null)} to ${figureText(f.high, f.unit ?? null)}`}`

/**
 * REVEAL TOGETHER, then WHERE YOU DIFFER (design plan steps 4 and 5). `RevealBody`'s attributed answers without the page chrome and
 * without its "Use X's N" apply: a change to the model goes through Olumi's proposal, never through a button here. Anyone in the team
 * can reveal; the reveal is one write and everyone sees it on their next read.
 */
export function RevealPanel({ sid, scenario, onWrote, onAskOlumi }: { sid: string; scenario: TeamScenario; onWrote: () => Promise<boolean>; onAskOlumi?: (q: string) => void }): JSX.Element | null {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const views = revealedViews(scenario)
  const spreads = spreadsOf(scenario)
  const ready = scenario.reveal.state === 'ready'
  const showReveal = scenario.reveal.state !== 'revealed'
  const labelOf = (id: string) => scenario.version?.form.records.find((r) => r.id === id)?.label ?? id
  const ask = askAboutViews(views)

  // A reveal has no operation id in core: one whose answer was lost may have happened, and is not sent again from this page (`writes.ts`).
  const locked = useWriteLocked(`${sid}:reveal`)
  const reveal = async () => {
    setBusy(true); setError(null)
    try { await runWrite(`${sid}:reveal`, { op: false }, null, () => teamApi.reveal(sid)); await onWrote() } catch (e) {
      setError(e instanceof TeamApiError ? e.message : 'That did not go through. Nothing was revealed.')
    } finally { setBusy(false) }
  }

  if (!showReveal && views.length === 0) return null
  return (
    <section data-testid="team-reveal" aria-label="Reveal together" className="grid gap-2">
      <h3 className={H}>Reveal together</h3>
      {showReveal && (
        <div className={CARD}>
          {ready ? (
            <p className={BODY} data-testid="team-reveal-ready">Everyone has given a view. Reveal them together, so nobody sees another’s before they have given their own.</p>
          ) : (
            <p className={`${META} flex items-center gap-1.5`} data-testid="team-reveal-wait">
              <Hourglass aria-hidden="true" className="h-3 w-3 flex-none" />
              {scenario.members.length < 2 ? 'The reveal opens when two or more people have each given a view.' : scenario.waiting.length > 0 ? `Waiting for ${waitingNames(scenario).join(', ') || 'the others'}.` : 'Waiting for the others.'}
            </p>
          )}
          <div>
            <Button size="sm" data-testid="team-reveal-go" disabled={!ready || busy || locked} onClick={() => void reveal()}>
              <span className="inline-flex items-center gap-1.5"><Eye aria-hidden="true" className="h-3.5 w-3.5" />Reveal together</span>
            </Button>
          </div>
          {locked ? <p role="alert" data-testid="team-reveal-error" className={ERR}>{MAY_HAVE_SAVED}</p> : error && <p role="alert" data-testid="team-reveal-error" className={ERR}>{error}</p>}
        </div>
      )}

      {views.length > 0 && (
        <>
          <ul className="m-0 grid list-none gap-1.5 p-0" data-testid="team-revealed">
            {views.map((v) => (
              <li key={v.id} data-testid={`team-revealed-${v.id}`} className={`${CARD} grid-cols-[22px_minmax(0,1fr)] !gap-x-2.5`}>
                <span aria-hidden="true" className={AVATAR}>{v.by.slice(0, 1).toUpperCase()}</span>
                <div className="grid min-w-0 gap-1">
                  <p className={`${BODY} text-text-header`}>{v.by}{v.mine ? <span className="text-text-light"> (you)</span> : null}</p>
                  {v.skip ? <p className={META}>Chose not to answer.</p> : <p className={`${BODY} whitespace-pre-wrap break-words`}>{v.text}</p>}
                  {figuresOf(v).length > 0 && (
                    <ul className={`${META} m-0 grid list-none gap-0.5 p-0`} data-testid={`team-revealed-figures-${v.id}`}>
                      {figuresOf(v).map((f, i) => <li key={i}>{v.by}’s own figure: {figureLine(f, labelOf)}</li>)}
                    </ul>
                  )}
                </div>
              </li>
            ))}
          </ul>
          {onAskOlumi && ask !== null && (
            <div>
              <Button size="sm" variant="secondary" data-testid="team-ask-differ" onClick={() => onAskOlumi(ask)}>Ask Olumi where we differ</Button>
            </div>
          )}
        </>
      )}

      <div className="grid gap-2" data-testid="team-differ" aria-label="Where you differ">
        <h3 className={H}>Where you differ</h3>
        {spreads.length > 0 ? spreads.map((sp) => <TeamSpreadStrip key={sp.quantity} spread={sp} />) : (
          <p className={META} data-testid="team-differ-empty">
            {views.length === 0 ? 'Once views are revealed, where they differ shows here, in each person’s own words.' : views.some((v) => figuresOf(v).length > 0)
              ? 'Fewer than two people gave a figure for the same thing, so nothing is placed side by side. Read the words above, or ask Olumi where they differ.'
              : 'No figures came with these views, so there is nothing to place side by side. Read the words above, or ask Olumi where they differ.'}
          </p>
        )}
        <ViewFindings scenario={scenario} />
      </div>
    </section>
  )
}
