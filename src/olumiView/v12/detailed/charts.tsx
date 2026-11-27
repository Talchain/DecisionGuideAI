/**
 * THE DETAILED FACE'S TWO CHARTS, each a fact said once with the options named by their letters (the option's name is said on its own card):
 *  - Rail (the question card): every option's chance on ONE 0..100% scale, a dot at core's served chance and core's range as a whisker, core's
 *    chance words at the right, WHOLE: the number and, after it, the row's own condition ("60% chance, if capacity is available"). Only where every
 *    option with a result is a chance carrying the same condition (said.ts sharedQualifier) is it drawn once under the rail, the rows keeping the number alone.
 *    An option with no chance yet is its letter and core's words, with no lane (no empty track at rest): never a zero, never a run-on of names.
 *    No option with a chance: no rail (nothing to compare).
 *  - Strips (a figure worked out per option): each option's middle band on one true axis shared by the rows (SimpleFace bandRowsOf, the same
 *    numbers Simple draws), its median tick, core's value words at the right; an option core could not calculate is its letter and core's
 *    reason, with no lane; the aim's own value a gold tick where this card is what the aim measures.
 * Read only from the View (railRows.ts, SimpleFace.tsx, contract.ts); nothing is worked out, rounded or reworded here. Look: `.ok-dt-*`.
 */
import type { CSSProperties } from 'react'
import { useMemo } from 'react'
import type { ViewCard, ViewModel } from '../../client'
import { useViewStore } from '../../store'
import { Hover, HoverButton } from '../../look/Hover'
import { chanceRailOf, type RailChallenge } from '../../railRows'
import { toggleBadge } from '../../Badge'
import { optionLetters } from '../cards/letters'
import { chanceParts, fixedParts } from '../cards/words'
import { bandAxisOf, bandRowsOf } from '../SimpleFace'
import { withheldValues } from '../contract'

/** The longest result words the rail's narrow words column holds on one line ('about 23% chance'); longer words widen the column. */
const RAIL_WORDS_NARROW = 20
/** Past this many characters a row's number-and-condition is drawn under its lane, across the rail, not in the words column. */
const RAIL_WORDS_STACK = 60

const letterOf = (letters: ReadonlyMap<string, string>, id: string) => letters.get(id) ?? '·'

/** Core's challenge mark on an option's lane (its key's own glyph, the badge's words its name and hover); pressing it opens what the badge folds. */
function ChallengeMark({ id, c }: { id: string; c: RailChallenge }): JSX.Element {
  return (
    <HoverButton type="button" className="ok-rail-challenge nodrag nopan" words={c.title} aria-label={`${c.word}: ${c.title}`} aria-expanded={c.badge.open} data-rail-challenge={id}
      onClick={(e) => { e.stopPropagation(); void toggleBadge(id, c.badge) }}>{c.glyph}</HoverButton>
  )
}

export function Rail({ qualifier }: { qualifier: string | null }): JSX.Element | null {
  const model = useViewStore((s) => s.view?.model ?? null)
  const rail = useMemo(() => chanceRailOf(model), [model])
  const letters = useMemo(() => optionLetters(model), [model])
  if (rail === null || rail.rows.length === 0) return null
  const order = new Map((model?.cards ?? []).filter((c) => c.family === 'option').map((c, i) => [c.id, i] as const))
  const lanes = [...rail.rows.map((r) => ({ ...r, on: true as const })), ...rail.rest.map((r) => ({ ...r, on: false as const }))].sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0))
  // Layout only (Codex 13:27Z, Detailed at 1232): where a result's words are longer than a number ("never met in this model if …", a row's own
  // condition), the words column widens for every row together, so the lanes stay aligned and the words wrap in three lines rather than nine.
  const wide = rail.rows.some((r) => (qualifier === null ? r.text : chanceParts(r.text).head).length > RAIL_WORDS_NARROW)
  return (
    <div className={`ok-dt-rail nodrag${wide ? ' ok-dt-rail-wide' : ''}`} data-chance-rail="" data-detailed-rail="" data-rail-wide={wide ? '' : undefined}>
      <div className="ok-dt-rail-axis" aria-hidden="true"><i /><i /><i /><i /><i /></div>
      {lanes.map((l) => {
        // Core's line is drawn whole: its number, then its own condition in the quiet ink (both are slices of core's string, nothing re-joined).
        // The number alone only where the one condition every row shares is said once under the rail (`qualifier`).
        // A fixed result's condition is the same kind of tail (words.ts fixedParts): "never met in this model", then " if …" in the quiet ink.
        const parts = chanceParts(l.text), fx = fixedParts(l.text), head = parts.qualifier !== null ? parts.head : fx.head
        const tail = l.text.slice(head.length)
        const words = !l.on ? l.text : (qualifier !== null && parts.qualifier !== null) || tail === '' ? head : <>{head}<span className="ok-dt-quiet" data-rail-qualifier={l.id}>{tail}</span></>
        // Layout only: words too long for the words column go under the lane across the rail's width (the lane keeps its place on the axis).
        const stack = l.on && typeof words !== 'string' && l.text.length > RAIL_WORDS_STACK
        return (
          <Hover as="div" key={l.id} className={`ok-dt-rail-row${stack ? ' ok-dt-rail-stack' : ''}`} data-rail-stack={stack ? '' : undefined} data-rail-row={l.id} words={`${l.name}\n${l.text}${'range' in l && l.range ? `\n${l.range}` : ''}`}>
            <span className="ok-letter" data-letter-chip={letterOf(letters, l.id)}>{letterOf(letters, l.id)}</span>
            {l.on ? (
              <span className="ok-dt-rail-lane" role="img" aria-label={`${l.name}: ${l.text}`} data-rail-lane={l.id}>
                {l.band !== null ? <i className="ok-dt-rail-whisker" data-rail-whisker={l.id} style={{ '--chart-x': `${l.band.from}%`, '--chart-width': `${l.band.to - l.band.from}%` } as CSSProperties} /> : null}
                <i className="ok-dt-rail-dot" data-rail-dot={l.id} data-at={l.at * 100} style={{ '--chart-x': `${l.at * 100}%` } as CSSProperties} />
              </span>
            ) : null}
            {/* The value cell wraps and clips nothing; core's words are their own element and the challenge mark sits beside them, never inside them. */}
            <span className={`ok-dt-rail-val ${l.on ? '' : 'ok-dt-rail-none'}`}><span data-view={`${l.id}.headline.text`}>{words}</span>{l.challenge === null ? null : <>{' '}<ChallengeMark id={l.id} c={l.challenge} /></>}</span>
          </Hover>
        )
      })}
      {qualifier === null ? null : <Hover as="p" className="ok-dt-said-line" data-shared-qualifier="" words={qualifier}>{qualifier}</Hover>}
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
        <Hover as="div" key={b.option} className="ok-dt-strip" words={`${b.heading} · ${b.text}`} data-strip={b.option} data-core-value={`${card.id}.${b.option}`}>
          <span className="ok-letter">{b.letter}</span>
          <span className="ok-dt-strip-lane">
            {b.hi > b.lo ? <i className={`ok-dt-strip-band ${b.olumi ? 'ok-dt-olumi-band' : ''}`} style={{ '--chart-x': `${b.lo}%`, '--chart-width': `${b.hi - b.lo}%` } as CSSProperties} data-band-from={b.lo.toFixed(1)} data-band-to={b.hi.toFixed(1)} /> : null}
            {b.mid === null ? null : <i className="ok-dt-strip-mid" style={{ '--chart-x': `${b.mid}%` } as CSSProperties} />}
            {axis?.goalAt == null ? null : <i className="ok-dt-goal-tick" style={{ '--chart-x': `${axis.goalAt}%` } as CSSProperties} data-at={axis.goal ?? undefined} />}
          </span>
          <span className="ok-dt-strip-val">{b.text}{(() => {
            // Core's mark on a value a held proposal would change (its glyph, its words the name), by the value's own place in `values`.
            const i = (card.values ?? []).findIndex((v) => v.option === b.option), ia = i < 0 ? null : card.values![i]!.if_approved
            return ia == null ? null : <Hover className="ok-dt-olumi ok-dt-ia" role="img" aria-label={ia.title} words={ia.title} data-view={`${card.id}.values.${i}.if_approved.glyph`}>{ia.glyph}</Hover>
          })()}</span>
        </Hover>
      ))}
      {held.map((w) => (
        <Hover as="div" key={w.option} className="ok-dt-strip" words={[headingOf(w.option), w.text].filter((x) => x !== '').join(' · ')} data-strip-withheld={w.option}>
          <span className="ok-letter">{letterOf(letters, w.option)}</span>
          <span className="ok-dt-strip-val ok-dt-strip-none ok-dt-quiet">{w.text}</span>
        </Hover>
      ))}
    </div>
  )
}
