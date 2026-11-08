/**
 * ONE ROW OF THE MODEL TAB, IN THE CRAFTED TAB'S SHAPE, FROM CORE'S VIEW, AND EDITABLE WHERE IT STANDS (Paul 7 Nov: reinstate the crafted
 * Model tab; then "make it so much easier and slicker for users to actually manually edit the model through this interface").
 *
 * Ported, layout and marks only (every word below is core's, drawn verbatim from olumi.view/3; nothing is composed, rounded or formatted):
 * - the two-line row of `canvas/model-tab-v2/ModelRowView.tsx` (MODEL-1): the kind's canvas shape in a fixed gutter, the card's number and
 *   name on line 1, its figure on line 2 in tabular type, so a long name never fights its value for width;
 * - its provenance mark (`ValueProvenanceMark.tsx`): who stated a figure is a mark with its hover, never a sentence, and a figure nobody
 *   marked draws no mark (absence drawn as absence). Core marks Olumi's (◆) and partly Olumi's (◐); a person's or the brief's is an
 *   icon named in core's `author` words (`./author.ts`);
 * - the Insights disclosure of `components/results/FactorInsights.tsx`: closed by default, independent per row, a real button with
 *   aria-expanded, here holding the card's `premises[]`.
 *
 * Editing (the crafted tab's inline edit, R25 routes): a figure core lets the person set carries ✎ at rest (Paul's R25 rule: the ✎ is the
 * cue) and opens its editor where it stands; the row's press opens its detail (rename, an aim's target, links, whose it is) and puts its
 * card in front on the canvas. One editor and one detail at a time (`./state.ts`). Plain shows the model; Expert adds the science.
 */
import { useId, useMemo, useState } from 'react'
import { ChevronRight, FileText, Pencil, User } from 'lucide-react'
import { typography } from '../../styles/typography'
import { ACTION_FOCUS } from '../../components/results/analysisNew/panelSurfaces'
import { focusNodeById } from '../../canvas/utils/focusHelpers'
import { NodeShapeIndicator } from '../../canvas/nodes/NodeShapeIndicator'
import type { ViewCard, ViewModel, ViewRow } from '../client'
import { authorOf } from './author'
import { premiseGroupsOf } from './premises'
import { useModelWords, openEditor, useModelEdit } from './editing'
import { FigureEditor, RenameEditor, WithdrawnNote } from './editors'
import { CardDetail } from './detail'
import { useModelTab } from './state'
import { targetCardOf } from './targets'

const NBSP = ' '

/** UI words, not model words: the disclosure's name is the Rests on lens's own. */
export const MODEL_ROW_LABELS = { restsOn: 'Rests on' } as const

type Mark = { glyph: string; title: string }

/** Core's mark (◆, ◐, ↻ …) with core's hover, as the canvas card draws it. It follows the last word after a no-break space (R5). */
export function CoreMark({ at, mark }: { at: string; mark: Mark | null }) {
  if (mark === null) return null
  return <>{NBSP}<span role="img" aria-label={mark.title} title={mark.title} className="text-text-light" data-view={`${at}.glyph`}>{mark.glyph}</span></>
}

/** A person's or the brief's card (core's `cards[].author`): an icon with core's words as its name, and its words then its quote on hover. */
function AuthorMark({ card }: { card: ViewCard }) {
  const a = authorOf(card)
  if (a === null) return null
  const Icon = a.by === 'brief' ? FileText : User
  return (
    <>{NBSP}<span role="img" aria-label={a.text} title={a.title === '' ? a.text : `${a.text}\n${a.title}`} data-view-author={card.id} data-author-by={a.by}
      className="inline-flex align-middle text-text-light"><Icon aria-hidden="true" className="h-3.5 w-3.5" /></span></>
  )
}

/** ✎, the cue that a figure can be changed: shown on the row's hover, on focus, and while its row is open, in the quiet grey of the row's
 *  other marks (the crafted tab showed no pencils at rest; Paul 7 Nov: "the previous model tab was better looking"). */
const EditCue = ({ open }: { open: boolean }) => (
  <Pencil aria-hidden="true" data-model-edit-cue="" className={`ml-1.5 inline h-3.5 w-3.5 flex-none align-middle text-text-light transition-opacity duration-fast ${open ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100'}`} />
)

/** An option's line for one aim, compact: the aim on the left, core's value and its marks on the right (the crafted value column); the
 *  whole sentence on hover. A row core gives no chance (`none`) draws its words whole in both views (R25: no cut text). Core's companion
 *  line (how much the chance owes to a suggestion of Olumi's) shows in both: Olumi's part must stay visible to be challenged. Expert
 *  adds the timing line. */
function OptionLine({ card, row, i, expert }: { card: ViewCard; row: ViewRow; i: number; expert: boolean }) {
  const at = `${card.id}.rows.${i}`
  if (row.kind === 'none') {
    const words = row.text ?? row.title
    return (
      <span className={`${typography.viewPanelMeta} block text-text-light`} title={row.title === words ? undefined : row.title} data-view-row={at}>
        {/* R25 (Paul's finish line, no cut text): core's words whole, wrapping, never clamped with the rest on hover only. */}
        <span data-view={row.text == null ? `${at}.title` : `${at}.text`}>{words}</span>
      </span>
    )
  }
  return (
    <span className="block" title={row.title} data-view-row={at}>
      <span className="flex items-baseline justify-between gap-3">
        <span className={`${typography.viewPanelMeta} min-w-0 text-text-light`} data-view={`${at}.aim`}>{row.aim}</span>
        <span className={`${typography.viewPanelTabular} flex-none text-text-body`}>
          {row.kind === 'chance' && row.approx !== '' ? <span data-view={`${at}.approx`}>{row.approx}</span> : null}
          <span data-view={`${at}.value`}>{row.value}</span>
          <CoreMark at={`${at}.olumi`} mark={row.olumi} />
          {row.kind === 'chance' ? <CoreMark at={`${at}.likely`} mark={row.likely} /> : null}
          {row.kind === 'chance' && row.if_approved != null ? <CoreMark at={`${at}.if_approved`} mark={row.if_approved} /> : null}
        </span>
      </span>
      {row.kind === 'chance' && row.companion != null ? <span className={`${typography.viewPanelMeta} block text-text-light`} title={row.companion_title ?? row.companion} data-view={`${at}.companion`}>{row.companion}</span> : null}
      {expert && row.kind === 'chance' && row.timing != null ? <span className={`${typography.viewPanelMeta} block text-text-light`} title={row.timing_title ?? row.timing} data-view={`${at}.timing`}>{row.timing}</span> : null}
    </span>
  )
}

/** The card's premises behind the crafted Insights disclosure. Plain lists them with their glyphs; Expert groups them under core's key word
 *  for each glyph (assumption, prerequisite, challenge…). The team's assumptions stay one press away in both: they are there to be challenged. */
function Premises({ card, keyEntries, expert }: { card: ViewCard; keyEntries: ViewModel['key']; expert: boolean }) {
  const [open, setOpen] = useState(false)
  const id = useId()
  const groups = useMemo(() => premiseGroupsOf(card, keyEntries), [card, keyEntries])
  if (card.premises.length === 0) return null
  const kindOf = (glyph: string) => keyEntries.find((k) => k.glyph === glyph)?.text ?? null
  const item = (premise: ViewCard['premises'][number], i: number, glyph: boolean) => (
    <li key={i} className="flex gap-1.5 text-text-body" title={premise.title === premise.text ? undefined : premise.title} data-view-premise={`${card.id}.premises.${i}`}>
      {!glyph ? null : kindOf(premise.glyph) === null
        ? <span aria-hidden="true" className="w-3 flex-none text-center text-text-light">{premise.glyph}</span>
        : <span role="img" aria-label={kindOf(premise.glyph)!} title={kindOf(premise.glyph)!} className="w-3 flex-none text-center text-text-light">{premise.glyph}</span>}
      <span className="min-w-0" data-view={`${card.id}.premises.${i}.text`}>{premise.text}{(premise.olumi ?? null) === null ? null : <>{' '}<span title={premise.olumi!.title} aria-label={premise.olumi!.title} data-view={`${card.id}.premises.${i}.olumi.glyph`}>{premise.olumi!.glyph}</span></>}</span>
    </li>
  )
  return (
    <div className="pb-1 pl-8 pr-2" data-model-premises={card.id}>
      <button type="button" aria-expanded={open} aria-controls={open ? id : undefined} onClick={() => setOpen((o) => !o)} data-model-premises-toggle={card.id}
        className={`${typography.viewPanelMeta} inline-flex min-h-[24px] items-center gap-1 rounded-sm text-text-light transition-colors hover:text-text-body ${ACTION_FOCUS}`}>
        <ChevronRight aria-hidden="true" className={`h-3.5 w-3.5 flex-none transition-transform ${open ? 'rotate-90' : ''}`} />
        <span>{MODEL_ROW_LABELS.restsOn}</span>
        <span className="tabular-nums" data-model-premises-count={card.id}>{card.premises.length}</span>
      </button>
      {!open ? null : expert ? (
        <div id={id} className="mb-1 mt-1.5 space-y-2.5 pl-5">
          {groups.map((g) => (
            <div key={g.key?.id ?? g.items[0]!.premise.glyph}>
              {g.key === null ? null : (
                <p className={`${typography.viewPanelMeta} m-0 mb-1 text-text-light`} data-view-key={g.key.id}>
                  <span aria-hidden="true">{g.key.glyph}</span> <span>{g.key.text}</span>
                </p>
              )}
              <ul className="m-0 list-none space-y-1 p-0">{g.items.map(({ premise, i }) => item(premise, i, g.key === null))}</ul>
            </div>
          ))}
        </div>
      ) : (
        <ul id={id} className="m-0 mb-1 mt-1.5 list-none space-y-1 p-0 pl-5">{card.premises.map((p, i) => item(p, i, true))}</ul>
      )}
    </div>
  )
}

export function ModelCardRow({ card, number, kind, model }: {
  card: ViewCard; number: string | null; kind: 'factor' | 'outcome' | 'risk' | 'goal' | 'option' | 'constraint'; model: ViewModel
}) {
  const W = useModelWords()!
  const expert = useModelTab((s) => s.expert)
  const open = useModelTab((s) => s.open === card.id)
  const editing = useModelTab((s) => (s.editing?.row === card.id ? s.editing : null))
  const receipt = useModelTab((s) => (s.receipt?.row === card.id ? s.receipt : null))
  const { base } = useModelEdit()
  const canEdit = base !== null
  const figureEdit = canEdit ? card.figure?.edit ?? null : null
  const target = canEdit ? targetCardOf(model, card) : null
  const editingFigure = editing?.what === 'figure' ? model.cards.find((c) => c.id === editing.quantity)?.figure?.edit ?? null : null
  const select = () => { useModelTab.getState().toggle(card.id); focusNodeById(card.id) }
  const editFigure = (quantity: string) => openEditor({ row: card.id, what: 'figure', quantity })
  // Whose the figure is sits beside the figure (the crafted value cell's mark); a card with no figure carries it beside its name.
  const onFigure = card.figure !== null
  const reading = expert && card.figure !== null && card.figure.title !== '' && card.figure.title !== card.figure.text ? card.figure.title : null
  return (
    <li data-model-item={card.id}>
      <div data-model-row={card.id} data-open={open} onClick={select}
        className={`group flex cursor-pointer items-start gap-2 rounded-md px-2 py-1.5 transition-colors duration-fast hover:bg-panel-hover ${open ? 'ring-1 ring-inset ring-border-emphasis' : ''}`}>
        <span aria-hidden="true" className="mt-1.5 flex w-4 flex-none justify-center"><NodeShapeIndicator nodeKind={kind} size={11} /></span>
        <span className="min-w-0 flex-1">
          {editing?.what === 'rename' ? <RenameEditor mine={editing} /> : (
            <span className="flex items-baseline gap-1.5">
              {number === null ? null : <span className={`${typography.viewPanelMeta} flex-none tabular-nums text-text-light`} data-model-row-number={card.id}>{number}</span>}
              <span className="min-w-0 break-words text-text-header">
                {/* A real inline control (role=button, Enter and Space), not a <button>: a browser lays a <button> out as inline-block, so a long
                    name wrapped as one block and its number dropped to the name's last line. */}
                <span role="button" tabIndex={0} aria-expanded={open} aria-controls={open ? `model-detail-${card.id}` : undefined} data-model-select={card.id}
                  onClick={(e) => { e.stopPropagation(); select() }}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); select() } }}
                  onDoubleClick={canEdit ? (e) => { e.stopPropagation(); openEditor({ row: card.id, what: 'rename' }, card.heading) } : undefined}
                  className={`cursor-pointer rounded-sm ${ACTION_FOCUS}`}>
                  <span title={card.detail === '' ? undefined : card.detail} data-view={`${card.id}.heading`}>{card.heading}</span>
                </span>
                {onFigure ? null : <><CoreMark at={`${card.id}.olumi`} mark={card.olumi} /><AuthorMark card={card} /></>}
                <CoreMark at={`${card.id}.change`} mark={card.change} />
              </span>
            </span>
          )}
          {/* An aim's or limit's target, as its card on the canvas says it (core's `bound`, Olumi's mark where Olumi gave it). Where core
              offers an edit on the figure it reads (`./targets.ts`), the target itself opens that figure's editor. */}
          {card.bound === null ? null : target === null ? (
            <span className={`${typography.viewPanelTabular} mt-0.5 block text-text-body`} title={card.bound.title}>
              <span data-view={`${card.id}.bound.text`}>{card.bound.text}</span><CoreMark at={`${card.id}.bound.olumi`} mark={card.bound.olumi} />
            </span>
          ) : (
            <button type="button" onClick={(e) => { e.stopPropagation(); editFigure(target.id) }} title={card.bound.title} data-model-value-edit={card.id}
              className={`${typography.viewPanelTabular} mt-0.5 block min-h-[24px] cursor-pointer rounded-sm text-left text-text-body hover:text-text-header ${ACTION_FOCUS}`}>
              <span className="sr-only">{card.family === 'limit' ? W.changeLimit : W.changeTarget}: </span><span data-view={`${card.id}.bound.text`}>{card.bound.text}</span><CoreMark at={`${card.id}.bound.olumi`} mark={card.bound.olumi} /><EditCue open={open} />
            </button>
          )}
          {card.figure === null ? null : figureEdit === null ? (
            <span className={`${typography.viewPanelTabular} mt-0.5 block break-words text-text-body`} title={card.figure.title}>
              <span data-view={`${card.id}.figure.text`}>{card.figure.text}</span><CoreMark at={`${card.id}.olumi`} mark={card.olumi} /><AuthorMark card={card} />
            </span>
          ) : (
            <button type="button" onClick={(e) => { e.stopPropagation(); editFigure(card.id) }} title={card.figure.title} data-model-value-edit={card.id}
              className={`${typography.viewPanelTabular} mt-0.5 block min-h-[24px] cursor-pointer break-words rounded-sm text-left text-text-body hover:text-text-header ${ACTION_FOCUS}`}>
              <span className="sr-only">{W.changeFigure}: </span><span data-view={`${card.id}.figure.text`}>{card.figure.text}</span><CoreMark at={`${card.id}.olumi`} mark={card.olumi} /><AuthorMark card={card} /><EditCue open={open} />
            </button>
          )}
          {reading === null ? null : <span className={`${typography.viewPanelMeta} mt-0.5 block break-words text-text-light`} data-view={`${card.id}.figure.title`}>{reading}</span>}
          {card.rows.length === 0 ? null : (
            <span className="mt-1 block space-y-0.5">{card.rows.map((row, i) => <OptionLine key={i} card={card} row={row} i={i} expert={expert} />)}</span>
          )}
          {receipt === null ? null : (
            <span role={receipt.tone === 'failed' ? 'alert' : 'status'} className={`${typography.viewPanelMeta} mt-0.5 block ${receipt.tone === 'failed' ? 'text-danger' : 'text-text-light'}`}
              data-model-saved={receipt.tone === 'saved' ? card.id : undefined} data-model-failed={receipt.tone === 'failed' ? card.id : undefined}>{receipt.words}</span>
          )}
        </span>
      </div>
      {editing?.what !== 'figure' ? null : editingFigure !== null ? (
        <div className="pb-2 pl-8 pr-2"><FigureEditor key={editing.quantity} mine={editing} edit={editingFigure} /></div>
      ) : <div className="pb-2 pl-8 pr-2"><WithdrawnNote mine={editing} /></div>}
      <Premises card={card} keyEntries={model.key} expert={expert} />
      {open ? <CardDetail model={model} card={card} /> : null}
    </li>
  )
}
