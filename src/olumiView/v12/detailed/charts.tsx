/**
 * THE DETAILED FACE'S TWO CHARTS, each a fact said once with the options named by their letters (the option's name is said on its own card):
 *  - Rail (the question card): every option's chance on ONE 0..100% scale, a dot at core's served chance and core's range as a whisker, core's
 *    number words at the right. An option with no chance yet is its letter and core's words, with no lane (no empty track at rest): never a zero, never a run-on of names.
 *    No option with a chance: no rail (nothing to compare).
 *  - Strips (a figure worked out per option): each option's middle band on one true axis shared by the rows (SimpleFace bandRowsOf, the same
 *    numbers Simple draws), its median tick, core's value words at the right; an option core could not calculate is its letter and core's
 *    reason, with no lane; the aim's own value a gold tick where this card is what the aim measures.
 * Read only from the View (railRows.ts, SimpleFace.tsx, contract.ts); nothing is worked out, rounded or reworded here. Look: `.ok-dt-*`.
 */
import { useMemo } from 'react'
import type { ViewCard, ViewModel } from '../../client'
import { useViewStore } from '../../store'
import { chanceRailOf, type RailChallenge } from '../../railRows'
import { toggleBadge } from '../../Badge'
import { optionLetters } from '../cards/letters'
import { chanceParts } from '../cards/words'
import { bandAxisOf, bandRowsOf } from '../SimpleFace'
import { withheldValues } from '../contract'

const letterOf = (letters: ReadonlyMap<string, string>, id: string) => letters.get(id) ?? '·'

/** Core's challenge mark on an option's lane (its key's own glyph, the badge's words its name and hover); pressing it opens what the badge folds. */
function ChallengeMark({ id, c }: { id: string; c: RailChallenge }): JSX.Element {
  return (
    <button type="button" className="ok-rail-challenge nodrag nopan" title={c.title} aria-label={`${c.word}: ${c.title}`} aria-expanded={c.badge.open} data-rail-challenge={id}
      onClick={(e) => { e.stopPropagation(); void toggleBadge(id, c.badge) }}>{c.glyph}</button>
  )
}

export function Rail({ qualifier }: { qualifier: string | null }): JSX.Element | null {
  const model = useViewStore((s) => s.view?.model ?? null)
  const rail = useMemo(() => chanceRailOf(model), [model])
  const letters = useMemo(() => optionLetters(model), [model])
  if (rail === null || rail.rows.length === 0) return null
  const order = new Map((model?.cards ?? []).filter((c) => c.family === 'option').map((c, i) => [c.id, i] as const))
  const lanes = [...rail.rows.map((r) => ({ ...r, on: true as const })), ...rail.rest.map((r) => ({ ...r, on: false as const }))].sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0))
  return (
    <div className="ok-dt-rail nodrag" data-chance-rail="" data-detailed-rail="">
      <div className="ok-dt-rail-axis" aria-hidden="true">{[0, 25, 50, 75, 100].map((t) => <i key={t} style={{ left: `${t}%` }} />)}</div>
      {lanes.map((l) => {
        const head = chanceParts(l.text).head
        return (
          <div key={l.id} className="ok-dt-rail-row" data-rail-row={l.id} title={`${l.name}\n${l.text}${'range' in l && l.range ? `\n${l.range}` : ''}`}>
            <span className="ok-letter" data-letter-chip={letterOf(letters, l.id)}>{letterOf(letters, l.id)}</span>
            {l.on ? (
              <span className="ok-dt-rail-lane" role="img" aria-label={`${l.name}: ${l.text}`} data-rail-lane={l.id}>
                {l.band !== null ? <i className="ok-dt-rail-whisker" data-rail-whisker={l.id} style={{ left: `${l.band.from}%`, width: `${l.band.to - l.band.from}%` }} /> : null}
                <i className="ok-dt-rail-dot" data-rail-dot={l.id} data-at={l.at * 100} style={{ left: `${l.at * 100}%` }} />
              </span>
            ) : null}
            <span className={`ok-dt-rail-val ${l.on ? '' : 'ok-dt-rail-none'}`} data-view={`${l.id}.headline.text`}>{l.on ? head : l.text}{l.challenge === null ? null : <>{' '}<ChallengeMark id={l.id} c={l.challenge} /></>}</span>
          </div>
        )
      })}
      {qualifier === null ? null : <p className="ok-dt-said-line" data-shared-qualifier="" title={qualifier}>{qualifier}</p>}
    </div>
  )
}

export function Strips({ card, model }: { card: ViewCard; model: ViewModel | null }): JSX.Element | null {
  const rows = bandRowsOf(card, model), axis = bandAxisOf(card, model), held = withheldValues(card)
  if (rows.length === 0 && held.length === 0) return null
  const letters = optionLetters(model)
  const headingOf = (id: string) => model?.cards.find((c) => c.id === id)?.heading ?? ''
  return (
    <div className="ok-dt-strips" data-detailed-strips={card.id}>
      {rows.map((b) => (
        <div key={b.option} className="ok-dt-strip" title={`${b.heading} · ${b.text}`} data-strip={b.option} data-core-value={`${card.id}.${b.option}`}>
          <span className="ok-letter">{b.letter}</span>
          <span className="ok-dt-strip-lane">
            {b.hi > b.lo ? <i className={`ok-dt-strip-band ${b.olumi ? 'ok-dt-olumi-band' : ''}`} style={{ left: `${b.lo}%`, width: `${b.hi - b.lo}%` }} data-band-from={b.lo.toFixed(1)} data-band-to={b.hi.toFixed(1)} /> : null}
            {b.mid === null ? null : <i className="ok-dt-strip-mid" style={{ left: `${b.mid}%` }} />}
            {axis?.goalAt == null ? null : <i className="ok-dt-goal-tick" style={{ left: `${axis.goalAt}%` }} data-at={axis.goal ?? undefined} />}
          </span>
          <span className="ok-dt-strip-val">{b.text}{(() => {
            // Core's mark on a value a held proposal would change (its glyph, its words the name), by the value's own place in `values`.
            const i = (card.values ?? []).findIndex((v) => v.option === b.option), ia = i < 0 ? null : card.values![i]!.if_approved
            return ia == null ? null : <span className="ok-dt-olumi ok-dt-ia" role="img" aria-label={ia.title} title={ia.title} data-view={`${card.id}.values.${i}.if_approved.glyph`}>{ia.glyph}</span>
          })()}</span>
        </div>
      ))}
      {held.map((w) => (
        <div key={w.option} className="ok-dt-strip" title={[headingOf(w.option), w.text].filter((x) => x !== '').join(' · ')} data-strip-withheld={w.option}>
          <span className="ok-letter">{letterOf(letters, w.option)}</span>
          <span className="ok-dt-strip-val ok-dt-strip-none ok-dt-quiet">{w.text}</span>
        </div>
      ))}
      {axis === null || rows.length === 0 ? null : (
        <div className="ok-dt-strip ok-dt-strip-axis" aria-hidden="true"><span /><span className="ok-dt-strip-ends"><span>{axis.min}</span><span>{axis.max}{axis.unit === null ? '' : ` ${axis.unit}`}</span></span><span /></div>
      )}
    </div>
  )
}
