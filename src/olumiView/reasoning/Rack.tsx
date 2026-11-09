/**
 * The option rack (the redesign's Z3: reasoning-redesign-SPEC.md §3; DL ruling 1, 7 Nov): what each option rests on, so people argue
 * about the inputs and not the answer. DL ruling 9 Nov: the chances belong to Analysis; the rack draws none (it repeated the Analysis
 * tab's option cards) and opens with one link, "See chances in Analysis". An option that rests on nothing core names is not drawn.
 *   - Options in core's order, never sorted by chance.
 *   - Each option: its heading as the one control (press: the canvas selects and centres its card, press again to let it go; hover or
 *     focus: its card is ringed).
 *   - What it rests on (`cards[].rests_on`): one mark per card, in core's order, by whose it is (core's own key glyph for Olumi's, `olumi`,
 *     and partly Olumi's, `partly_olumi`, matched by id; a plain dot for the person's own); hover rings that card and names it. An id that
 *     no card on the canvas draws has no heading to name it by, so it is not drawn. Up to 8, then "+N".
 * Nothing is ranked, recommended or composed: the words are core's and the lane's own labels.
 */
import { useEffect, useState } from 'react'
import type { ViewCard, ViewModel } from '../client'
import { optionCards } from '../layout'
import { useUIStore } from '../../stores/uiStore'
import { pressCard, ringFrom } from './tabRing'
import { useCanvasStore } from '../../canvas/store'
import { LENS_COPY } from '../../canvas/artefacts/lenses'
import { typography } from '../../styles/typography'
import { TYPE } from '../port/type'
import { ACTION_FOCUS } from '../../components/results/analysisNew/panelSurfaces'

export const RACK_LABEL = 'What each option rests on'
export const SEE_CHANCES = 'See chances in Analysis'
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
  const point = (id: string) => ({
    onMouseEnter: () => setHover(id), onMouseLeave: () => setHover((h) => (h === id ? null : h)),
  })
  return (
    <section data-testid="view-reasoning-rack" aria-label={RACK_LABEL} className="space-y-2">
      <button type="button" data-testid="view-reasoning-see-chances" onClick={() => useUIStore.getState().forceActivateOutputTab('results')}
        className={`${TYPE.meta} inline-flex min-h-[24px] cursor-pointer items-center text-text-body underline underline-offset-2 hover:text-text-header ${ACTION_FOCUS}`}>{SEE_CHANCES}</button>
      {options.map((o) => {
        const rests = restsOfOption(model, o), shown = rests.slice(0, RESTS_SHOWN), more = rests.length - shown.length
        if (shown.length === 0) return null
        return (
          <div key={o.id} className="space-y-1 rounded-xl border border-panel-border p-2" data-rack-option={o.id}>
            <button type="button" aria-pressed={selected.has(o.id)} data-rack-press={o.id} onClick={() => pressCard(o.id)} {...point(o.id)}
              onFocus={() => setFocus(o.id)} onBlur={() => setFocus((f) => (f === o.id ? null : f))}
              className={`${typography.panelHeader} -mx-1 block min-h-[24px] w-[calc(100%+0.5rem)] rounded px-1 text-left text-text-header hover:bg-panel-hover ${ACTION_FOCUS} ${selected.has(o.id) ? 'ring-2 ring-text-header' : ''}`}>
              <span data-view={`${o.id}.heading`}>{o.heading}</span>
            </button>
            {(
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
