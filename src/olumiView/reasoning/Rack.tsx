/**
 * The option rack (the redesign's Z3: reasoning-redesign-SPEC.md §3; DL ruling 1, 7 Nov): each option's chance of meeting the aim, in
 * this model on current information, beside what it rests on, so people argue about the inputs and not the answer.
 *   - Options in core's order, never sorted by chance. The header is core's lens label for the chance (`run.lenses`, id `goal`) where core
 *     gives one, its hover core's title.
 *   - Each option: its heading as the one control (press: the canvas selects and centres its card, press again to let it go; hover or
 *     focus: its card is ringed), then each of its rows: the aim in core's words, and the readout the Analysis tab's option row draws
 *     (`HeroReadout`, the one drawing of a chance: core's ◉, value and marks; a limit's value; or core's words for what it waits on, never
 *     0, never blank), core's definition of the chance on hover. No track: a chance is not a range (the served row's own rule).
 *   - What it rests on (`cards[].rests_on`): one mark per card, in core's order, by whose it is (core's own key glyph for Olumi's, `olumi`,
 *     and partly Olumi's, `partly_olumi`, matched by id; a plain dot for the person's own); hover rings that card and names it. An id that
 *     no card on the canvas draws has no heading to name it by, so it is not drawn. Up to 8, then "+N".
 * Nothing is ranked, recommended or composed: the words are core's and the lane's own labels.
 */
import { useEffect, useState } from 'react'
import type { ViewCard, ViewModel } from '../client'
import { optionCards } from '../layout'
import { HeroReadout } from '../port/HeroOptionRow'
import { pressCard, ringFrom } from './tabRing'
import { useCanvasStore } from '../../canvas/store'
import { LENS_COPY } from '../../canvas/artefacts/lenses'
import { typography } from '../../styles/typography'
import { TYPE } from '../port/type'
import { ACTION_FOCUS } from '../../components/results/analysisNew/panelSurfaces'

export const RACK_LABEL = "Each option's chance"
export const RESTS_SHOWN = 8

type Whose = ViewCard['rests_on'][number]['whose']
const KEY_ID: Record<Whose, string | null> = { olumi: 'olumi', mixed: 'partly_olumi', theirs: null }

/** What an option rests on, in core's order: each id's card on the canvas (by id), with core's key mark for whose it is. */
export function restsOfOption(model: ViewModel, option: ViewCard): { card: ViewCard; whose: Whose; mark: { glyph: string; text: string; i: number } | null }[] {
  const key = model.key ?? []
  return (option.rests_on ?? []).flatMap((r) => {
    const card = model.cards.find((c) => c.id === r.id)
    if (card === undefined) return []
    const k = KEY_ID[r.whose], i = k === null ? -1 : key.findIndex((x) => x.id === k)
    return [{ card, whose: r.whose, mark: i < 0 ? null : { glyph: key[i]!.glyph, text: key[i]!.text, i } }]
  })
}

export function Rack({ model }: { model: ViewModel }) {
  const options = optionCards(model)
  const selected = useCanvasStore((s) => s.selection.nodeIds)
  const [hover, setHover] = useState<string | null>(null)
  const [focus, setFocus] = useState<string | null>(null)
  const present = new Set(model.cards.map((c) => c.id))
  const key = [hover, focus].filter((x): x is string => x !== null && present.has(x)).join('\n')
  useEffect(() => { ringFrom('rack', key === '' ? [] : key.split('\n')) }, [key])
  useEffect(() => () => ringFrom('rack', []), [])
  if (options.length === 0) return null
  const lenses = model.run?.lenses ?? [], li = lenses.findIndex((l) => l.id === 'goal'), lens = li < 0 ? null : lenses[li]!
  const point = (id: string) => ({
    onMouseEnter: () => setHover(id), onMouseLeave: () => setHover((h) => (h === id ? null : h)),
  })
  return (
    <section data-testid="view-reasoning-rack" aria-label={lens?.label ?? RACK_LABEL} className="space-y-2">
      {lens === null ? null : <p className={`${TYPE.meta} m-0 text-text-body`} title={lens.title} data-view={`run.lenses.${li}.label`}>{lens.label}</p>}
      {options.map((o) => {
        const rests = restsOfOption(model, o), shown = rests.slice(0, RESTS_SHOWN), more = rests.length - shown.length
        return (
          <div key={o.id} className="space-y-1 rounded-xl border border-panel-border p-2" data-rack-option={o.id}>
            <button type="button" aria-pressed={selected.has(o.id)} data-rack-press={o.id} onClick={() => pressCard(o.id)} {...point(o.id)}
              onFocus={() => setFocus(o.id)} onBlur={() => setFocus((f) => (f === o.id ? null : f))}
              className={`${typography.panelHeader} -mx-1 block min-h-[24px] w-[calc(100%+0.5rem)] rounded px-1 text-left text-text-header hover:bg-panel-hover ${ACTION_FOCUS} ${selected.has(o.id) ? 'ring-2 ring-text-header' : ''}`}>
              <span data-view={`${o.id}.heading`}>{o.heading}</span>
            </button>
            {o.rows.map((row, i) => (
              <div key={i} className="space-y-0.5" title={row.title} data-view-row={`${o.id}.rows.${i}`}>
                {row.kind === 'none' || row.aim === '' ? null : <p className={`${TYPE.meta} m-0 text-text-light`} data-view={`${o.id}.rows.${i}.aim`}>{row.aim}</p>}
                <p className="m-0 flex w-full items-baseline gap-1.5"><HeroReadout entry={{ card: o, row, i }} lens="goal" /></p>
              </div>
            ))}
            {shown.length === 0 ? null : (
              <div className="flex flex-wrap items-center gap-1" role="list" aria-label={LENS_COPY.label.rests_on} data-rack-rests={o.id}>
                {shown.map(({ card, whose, mark }) => (
                  <span key={card.id} role="listitem" title={card.heading} aria-label={mark === null ? card.heading : `${card.heading}, ${mark.text}`}
                    data-rack-rest={card.id} data-whose={whose} {...point(card.id)}
                    className={`${TYPE.meta} inline-flex h-6 min-w-6 cursor-default items-center justify-center rounded-full ${whose === 'theirs' ? 'text-text-header' : 'text-info'}`}>
                    {mark === null ? <span aria-hidden="true" className="block h-2 w-2 rounded-full bg-text-header" /> : <span aria-hidden="true" data-view={`key.${mark.i}.glyph`}>{mark.glyph}</span>}
                  </span>
                ))}
                {more <= 0 ? null : <span className={`${TYPE.meta} tabular-nums text-text-light`} data-rack-rests-more data-count>{`+${more}`}</span>}
              </div>
            )}
          </div>
        )
      })}
    </section>
  )
}
