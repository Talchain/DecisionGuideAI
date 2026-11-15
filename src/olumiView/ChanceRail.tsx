/**
 * The shared chance rail (railRows.ts), on the question bar above the options: one 0..100% scale with quarter ticks, one lane per option
 * with a worked-out result (core's name and words on the left; its dot and core's range whisker on the rail), and the options with no result
 * yet as one group with no rail. Core's sentences stay reachable: the whole headline on the name's hover, core's range words on the whisker's.
 */
import { useMemo } from 'react'
import { useViewStore } from './store'
import { toggleBadge } from './Badge'
import { chanceRailOf, type RailChallenge } from './railRows'

/** Core's challenge glyph (its key), the badge's words on hover and as its name; pressing it opens what the badge folds, as the badge does. */
function ChallengeMark({ id, c }: { id: string; c: RailChallenge }): JSX.Element {
  return (
    <button type="button" className="ok-rail-challenge nodrag nopan" title={c.title} aria-label={`${c.word}: ${c.title}`} aria-expanded={c.badge.open} data-rail-challenge={id}
      onClick={(e) => { e.stopPropagation(); void toggleBadge(id, c.badge) }}>{c.glyph}</button>
  )
}

export function ChanceRail(): JSX.Element | null {
  const model = useViewStore((s) => s.view?.model ?? null)
  const rail = useMemo(() => chanceRailOf(model), [model])
  if (rail === null) return null
  const n = rail.rows.length
  return (
    <div className="ok-rail nodrag" data-chance-rail="">
      {n === 0 ? null : (
        <div className="ok-rail-grid" style={{ gridTemplateRows: `repeat(${n}, auto)` }}>
          {rail.rows.map((r, i) => (
            <p key={r.id} className="ok-rail-label" style={{ gridRow: i + 1 }} data-rail-row={r.id}>
              <span className="ok-rail-name" title={r.title} data-view={`${r.id}.heading`}>{r.name}</span>{' '}
              <b className="ok-rail-fig" data-view={`${r.id}.headline.text`}>{r.text}</b>
              {r.challenge === null ? null : <>{' '}<ChallengeMark id={r.id} c={r.challenge} /></>}
            </p>
          ))}
          {/* ONE rail for every lane: its ticks span them all, so every dot and whisker is read on the same scale. */}
          <div className="ok-rail-track" style={{ gridRow: `1 / span ${n}` }} role="img" data-chance-rail-track=""
            aria-label={rail.rows.map((r) => (r.range == null ? `${r.name}: ${r.text}` : `${r.name}: ${r.text}; ${r.range}`)).join('. ')}>
            <i className="ok-rail-axis" aria-hidden="true" />
            {[25, 50, 75].map((t) => <i key={t} className="ok-rail-tick" style={{ left: `${t}%` }} aria-hidden="true" />)}
            {rail.rows.map((r, i) => (
              <span key={r.id} className="ok-rail-lane" style={{ top: `${((i + 0.5) / n) * 100}%` }} data-rail-lane={r.id}>
                {r.band === null ? null : <i className="ok-rail-whisker" title={r.range ?? undefined} data-rail-whisker={r.id} data-from={r.band.from} data-to={r.band.to}
                  style={{ left: `${r.band.from}%`, width: `${r.band.to - r.band.from}%` }} />}
                <i className="ok-rail-dot" title={r.text} data-rail-dot={r.id} data-at={r.at * 100} style={{ left: `${r.at * 100}%` }} />
              </span>
            ))}
          </div>
        </div>
      )}
      {rail.rest.length === 0 ? null : (
        <p className="ok-rail-rest" data-rail-rest="">
          {rail.caption === null ? null : <span className="ok-rail-caption" data-rail-caption="">{rail.caption}: </span>}
          {rail.rest.map((r, i) => (
            <span key={r.id} data-rail-unworked={r.id}>
              {i === 0 ? null : ', '}
              <span tabIndex={0} title={r.title} data-view={`${r.id}.heading`}>{r.name}</span>
              {rail.caption === null ? <> <span data-view={`${r.id}.headline.text`}>{r.text}</span></> : null}
              {r.challenge === null ? null : <>{' '}<ChallengeMark id={r.id} c={r.challenge} /></>}
            </span>
          ))}
        </p>
      )}
    </div>
  )
}
