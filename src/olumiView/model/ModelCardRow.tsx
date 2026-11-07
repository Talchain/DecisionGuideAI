/**
 * ONE ROW OF THE MODEL TAB, IN THE CRAFTED TAB'S SHAPE, FROM CORE'S VIEW (Paul 7 Nov: reinstate the crafted Model tab on the alpha).
 *
 * Ported, layout and marks only (every word below is core's, drawn verbatim from olumi.view/3; nothing is composed, rounded or formatted):
 * - the two-line row of `canvas/model-tab-v2/ModelRowView.tsx` (MODEL-1): the kind's canvas shape in a fixed gutter, the card's number and
 *   name on line 1, its figure on line 2 in tabular type, so a long name never fights its value for width;
 * - its provenance mark (`ValueProvenanceMark.tsx`): who stated a figure is a mark with its hover, never a sentence, and a figure nobody
 *   marked draws no mark (absence drawn as absence). Core marks Olumi's (◆) and partly Olumi's (◐); a person's or the brief's waits on
 *   core's `author` field (`./author.ts`);
 * - the Insights disclosure of `components/results/FactorInsights.tsx`: closed by default, independent per row, a real button with
 *   aria-expanded, here holding the card's `premises[]` grouped under core's key words.
 *
 * View only. The row's press puts its card in front on the canvas (`focusNodeById`); the disclosure is a sibling of that button, never
 * inside it, so opening it never moves the canvas. Changing the model stays the card's ✎ and the chat.
 */
import { useId, useMemo, useState } from 'react'
import { ChevronRight, FileText, User } from 'lucide-react'
import { typography } from '../../styles/typography'
import { ACTION_FOCUS } from '../../components/results/analysisNew/panelSurfaces'
import { focusNodeById } from '../../canvas/utils/focusHelpers'
import { NodeShapeIndicator } from '../../canvas/nodes/NodeShapeIndicator'
import type { ViewCard, ViewModel, ViewRow } from '../client'
import { authorOf } from './author'
import { premiseGroupsOf } from './premises'

const NBSP = ' '

/** UI words, not model words: the disclosure's name is the Rests on lens's own. */
export const MODEL_ROW_LABELS = { restsOn: 'Rests on' } as const

type Mark = { glyph: string; title: string }

/** Core's mark (◆, ◐, ↻ …) with core's hover, as the canvas card draws it. It follows the last word after a no-break space (R5). */
export function CoreMark({ at, mark }: { at: string; mark: Mark | null }) {
  if (mark === null) return null
  return <>{NBSP}<span role="img" aria-label={mark.title} title={mark.title} className="text-text-light" data-view={`${at}.glyph`}>{mark.glyph}</span></>
}

/** A person's or the brief's figure (core's `cards[].author`): an icon with core's words as its name and hover. */
function AuthorMark({ card }: { card: ViewCard }) {
  const a = authorOf(card)
  if (a === null) return null
  const Icon = a.by === 'brief' ? FileText : User
  return (
    <>{NBSP}<span role="img" aria-label={a.text} title={a.title === '' ? a.text : `${a.text}\n${a.title}`} data-view-author={card.id} data-author-by={a.by}
      className="inline-flex align-middle text-text-light"><Icon aria-hidden="true" className="h-3.5 w-3.5" /></span></>
  )
}

/** An option's line for one aim, compact: the aim on the left, core's value and its marks on the right (the crafted value column); the
 *  whole sentence on hover. The companion and timing lines stay the Analysis tab's. */
function OptionLine({ card, row, i }: { card: ViewCard; row: ViewRow; i: number }) {
  const at = `${card.id}.rows.${i}`
  if (row.kind === 'none') {
    const words = row.text ?? row.title
    return (
      <span className={`${typography.viewPanelMeta} block text-text-light`} title={row.title === words ? undefined : row.title} data-view-row={at}>
        <span className="line-clamp-2" title={words} data-view={row.text == null ? `${at}.title` : `${at}.text`}>{words}</span>
      </span>
    )
  }
  return (
    <span className="flex items-baseline justify-between gap-3" title={row.title} data-view-row={at}>
      <span className={`${typography.viewPanelMeta} min-w-0 text-text-light`} data-view={`${at}.aim`}>{row.aim}</span>
      <span className={`${typography.viewPanelTabular} flex-none text-text-body`}>
        {row.kind === 'chance' && row.approx !== '' ? <span data-view={`${at}.approx`}>{row.approx}</span> : null}
        <span data-view={`${at}.value`}>{row.value}</span>
        <CoreMark at={`${at}.olumi`} mark={row.olumi} />
        {row.kind === 'chance' ? <CoreMark at={`${at}.likely`} mark={row.likely} /> : null}
        {row.kind === 'chance' && row.if_approved != null ? <CoreMark at={`${at}.if_approved`} mark={row.if_approved} /> : null}
      </span>
    </span>
  )
}

/** The card's premises behind the crafted Insights disclosure, each group under core's key word for its glyph. */
function Premises({ card, keyEntries }: { card: ViewCard; keyEntries: ViewModel['key'] }) {
  const [open, setOpen] = useState(false)
  const id = useId()
  const groups = useMemo(() => premiseGroupsOf(card, keyEntries), [card, keyEntries])
  if (card.premises.length === 0) return null
  return (
    <div className="pb-1 pl-8 pr-2" data-model-premises={card.id}>
      <button type="button" aria-expanded={open} aria-controls={id} onClick={() => setOpen((o) => !o)} data-model-premises-toggle={card.id}
        className={`${typography.viewPanelMeta} inline-flex items-center gap-1 rounded-sm py-0.5 text-text-light transition-colors hover:text-text-body ${ACTION_FOCUS}`}>
        <ChevronRight aria-hidden="true" className={`h-3.5 w-3.5 flex-none transition-transform ${open ? 'rotate-90' : ''}`} />
        <span>{MODEL_ROW_LABELS.restsOn}</span>
        <span className="tabular-nums" data-model-premises-count={card.id}>{card.premises.length}</span>
      </button>
      {open ? (
        <div id={id} className="mb-1 mt-1.5 space-y-2.5 pl-5">
          {groups.map((g) => (
            <div key={g.key?.id ?? g.items[0]!.premise.glyph}>
              {g.key === null ? null : (
                <p className={`${typography.viewPanelMeta} m-0 mb-1 text-text-light`} data-view-key={g.key.id}>
                  <span aria-hidden="true">{g.key.glyph}</span> <span>{g.key.text}</span>
                </p>
              )}
              <ul className="m-0 list-none space-y-1 p-0">
                {g.items.map(({ premise, i }) => (
                  <li key={i} className="text-text-body" title={premise.title === premise.text ? undefined : premise.title} data-view-premise={`${card.id}.premises.${i}`}>
                    {g.key === null ? <span aria-hidden="true" className="text-text-light">{premise.glyph} </span> : null}
                    <span data-view={`${card.id}.premises.${i}.text`}>{premise.text}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}

export function ModelCardRow({ card, number, kind, keyEntries }: {
  card: ViewCard; number: string | null; kind: 'factor' | 'outcome' | 'risk' | 'goal' | 'option' | 'constraint'; keyEntries: ViewModel['key']
}) {
  // Whose the figure is sits beside the figure (the crafted value cell's mark); a card with no figure carries it beside its name.
  const onFigure = card.figure !== null
  return (
    <li>
      <button type="button" onClick={() => focusNodeById(card.id)} data-model-row={card.id}
        className={`flex w-full cursor-pointer items-start gap-2 rounded-md px-2 py-1.5 text-left hover:bg-panel-hover ${ACTION_FOCUS}`}>
        <span aria-hidden="true" className="mt-1.5 flex w-4 flex-none justify-center"><NodeShapeIndicator nodeKind={kind} size={11} /></span>
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline gap-1.5">
            {number === null ? null : <span className={`${typography.viewPanelMeta} flex-none tabular-nums text-text-light`} data-model-row-number={card.id}>{number}</span>}
            <span className="min-w-0 break-words text-text-header">
              <span title={card.detail === '' ? undefined : card.detail} data-view={`${card.id}.heading`}>{card.heading}</span>
              {onFigure ? null : <><CoreMark at={`${card.id}.olumi`} mark={card.olumi} /><AuthorMark card={card} /></>}
              <CoreMark at={`${card.id}.change`} mark={card.change} />
            </span>
          </span>
          {/* An aim's or limit's target, as its card on the canvas says it (core's `bound`, Olumi's mark where Olumi gave it): an aim in
              the outline without its target was half of it (Model-tab port contract, 7 Nov). Nothing when core sends none. */}
          {card.bound === null ? null : (
            <span className={`${typography.viewPanelTabular} mt-0.5 block text-text-body`} title={card.bound.title}>
              <span data-view={`${card.id}.bound.text`}>{card.bound.text}</span><CoreMark at={`${card.id}.bound.olumi`} mark={card.bound.olumi} />
            </span>
          )}
          {card.figure === null ? null : (
            <span className={`${typography.viewPanelTabular} mt-0.5 block break-words text-text-body`} title={card.figure.title}>
              <span data-view={`${card.id}.figure.text`}>{card.figure.text}</span><CoreMark at={`${card.id}.olumi`} mark={card.olumi} /><AuthorMark card={card} />
            </span>
          )}
          {card.rows.length === 0 ? null : (
            <span className="mt-1 block space-y-0.5">{card.rows.map((row, i) => <OptionLine key={i} card={card} row={row} i={i} />)}</span>
          )}
        </span>
      </button>
      <Premises card={card} keyEntries={keyEntries} />
    </li>
  )
}
