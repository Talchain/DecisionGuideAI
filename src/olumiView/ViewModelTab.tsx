/**
 * THE MODEL TAB ON THE CORE LANE (DL 4 Nov, R2: Paul's staging has it): the legacy Model tab's outline (`model-tab-v2/ModelOutline.tsx`:
 * its groups, in its order, under its own titles), drawn from core's View. Question & goal: the question, the aims and limits, and the aim
 * core measures (`model.aim`); Options; Factors (the figures a person sets); Outcomes & risks (the figures core works out from others, the
 * risks); Relationships (the links, from its card to its card, with core's sign and its strength words). Every word is core's: each
 * card's number and heading as the canvas draws them, its figure or rows, and Olumi's mark where core marks it.
 *
 * View only: a row's press puts its card in front on the canvas (the canvas's own focus, `focusNodeById`). Changing the model stays the
 * card's ✎ and the chat. Assumptions and conditions are the Rests on lens's; the legacy outline has no group for them either.
 *
 * R25 (Paul 7 Nov, reinstate the crafted Model tab): each row is the crafted tab's two-line row with its mark and its Insights
 * disclosure (`model/ModelCardRow.tsx`), a link the same two lines, and a quiet key for the authorship marks on screen, in core's words.
 */
import { useMemo, useState, type ReactNode } from 'react'
import { ChevronRight } from 'lucide-react'
import { typography } from '../styles/typography'
import { ACTION_FOCUS } from '../components/results/analysisNew/panelSurfaces'
import { MODEL_GROUP_TITLE } from '../canvas/domain/vocabulary'
import { focusNodeById } from '../canvas/utils/focusHelpers'
import { NodeShapeIndicator } from '../canvas/nodes/NodeShapeIndicator'
import { KIND_GLYPH } from '../canvas/model-tab-v2/rowPresentation'
import type { ViewCard, ViewModel } from './client'
import { cardNumbersOf, drawKindOf, modelOutlineOf, outcomeRiskKinds, type OutlineGroupId } from './layout'
import { useViewStore } from './store'
import { ModelCardRow } from './model/ModelCardRow'
import { authorKeyOf } from './model/premises'

/** The previous PoC's outline chrome (legacy `ModelTabV2Panel.tsx`): its title, its filter's words and its expand control's. UI words, not
 *  model words: nothing here says anything about the model. */
export const MODEL_OUTLINE_LABELS = { title: 'Model outline', filter: 'Filter the model…', filterName: 'Filter the model', question: 'Question:',
  expand: 'Expand all', collapse: 'Collapse all', none: 'Nothing here matches the filter.' } as const

type GroupId = OutlineGroupId
const SHAPE: Partial<Record<GroupId, 'goal' | 'option' | 'factor'>> = { goal: 'goal', options: 'option', factors: 'factor' }

/** A group's kind mark, the canvas's own shape in its family colour (the previous PoC's outline, `GroupKindMark`). */
function KindMark({ id, cards, model }: { id: GroupId; cards: readonly ViewCard[]; model: ViewModel }) {
  if (id === 'relationships') return <span aria-hidden="true" className="text-text-light">{KIND_GLYPH.relationship}</span>
  if (id === 'outcomes-risks') {
    const kinds = outcomeRiskKinds(model, cards)
    return kinds.length === 0 ? null : <span className="inline-flex items-center gap-0.5">{kinds.map((k) => <NodeShapeIndicator key={k} nodeKind={k} size={8} />)}</span>
  }
  const k = SHAPE[id]
  return k === undefined ? null : <NodeShapeIndicator nodeKind={k} size={8} />
}

/** One group: a heading row that opens and closes it (chevron, kind mark, title, count), and its rows only while open. */
function Group({ id, title, count, open, onToggle, mark, children }: { id: GroupId; title: string; count: number; open: boolean; onToggle: () => void; mark: ReactNode; children: ReactNode }) {
  return (
    <section aria-label={title} data-model-group={id} data-open={open}>
      <button type="button" aria-expanded={open} aria-label={`${title}, ${count} ${count === 1 ? 'element' : 'elements'}`} onClick={onToggle}
        data-model-group-toggle={id} className={`${typography.viewPanelBody} inline-flex w-full items-center gap-1.5 rounded py-1.5 text-left text-text-body hover:bg-panel-hover ${ACTION_FOCUS}`}>
        <ChevronRight aria-hidden="true" className={`h-3.5 w-3.5 flex-none text-text-light transition-transform ${open ? 'rotate-90' : ''}`} />
        {mark}
        <span>{title}</span>
        <span className={`${typography.viewPanelMeta} ml-1 text-text-light`} data-model-group-count={id}>{count}</span>
      </button>
      {open ? <ul className="m-0 mb-2 ml-3 mt-0.5 list-none space-y-0.5 p-0">{children}</ul> : null}
    </section>
  )
}

export function ViewModelTab({ model }: { model: ViewModel }): JSX.Element {
  const numbers = useMemo(() => cardNumbersOf(model), [model])
  // Closed on open (the previous PoC's outline: five headings with counts, the question above them); a filter opens what it matches.
  const [opened, setOpened] = useState<ReadonlySet<GroupId>>(new Set())
  const [filter, setFilter] = useState('')
  const { searching, groups: shown, links, ids } = useMemo(() => modelOutlineOf(model, filter), [model, filter])
  const isOpen = (id: GroupId, count: number) => (searching ? count > 0 : opened.has(id))
  const allOpen = ids.every((id) => opened.has(id))
  const toggle = (id: GroupId) => setOpened((o) => { const n = new Set(o); if (n.has(id)) n.delete(id); else n.add(id); return n })
  const anyMatch = shown.some((g) => g.rows.length > 0 || g.question) || links.length > 0
  const authorKey = useMemo(() => authorKeyOf(model, shown.flatMap((g) => g.cards)), [model, shown])
  return (
    <div className={`${typography.viewPanelBody} space-y-2 pb-4`} data-testid="view-model-tab">
      <div className="flex items-center justify-between gap-2">
        <h3 className={`${typography.panelHeader} m-0 text-text-header`}>{MODEL_OUTLINE_LABELS.title}</h3>
        <button type="button" data-testid="view-model-toggle-all" onClick={() => setOpened(allOpen ? new Set() : new Set(ids))}
          className={`${typography.viewPanelMeta} rounded-sm py-1.5 text-text-light underline-offset-2 hover:text-text-header hover:underline ${ACTION_FOCUS}`}>
          {allOpen ? MODEL_OUTLINE_LABELS.collapse : MODEL_OUTLINE_LABELS.expand}
        </button>
      </div>
      <input type="search" value={filter} onChange={(e) => setFilter(e.target.value)} placeholder={MODEL_OUTLINE_LABELS.filter} aria-label={MODEL_OUTLINE_LABELS.filterName}
        data-testid="view-model-filter" className={`${typography.viewPanelBody} w-full min-w-0 rounded-md border border-panel-border bg-panel px-2 py-1 text-text-body placeholder:text-text-light ${ACTION_FOCUS}`} />
      <p className="m-0 py-1" data-testid="view-model-question">
        <span className={`${typography.viewPanelMeta} text-text-light`}>{MODEL_OUTLINE_LABELS.question}</span>{' '}
        <span className="text-text-header" data-view="model.question.text">{model.question.text}</span>
      </p>
      {searching && !anyMatch ? <p className={`${typography.viewPanelMeta} m-0 text-text-light`} data-testid="view-model-no-match">{MODEL_OUTLINE_LABELS.none}</p> : null}
      <div>
        {shown.map((g) => {
          if (g.cards.length === 0 && g.id !== 'goal') return null
          const count = !searching ? g.cards.length + (g.id === 'goal' ? 1 : 0) : g.rows.length + (g.question ? 1 : 0)
          return (
            <Group key={g.id} id={g.id} title={g.title} count={count} open={isOpen(g.id, count)} onToggle={() => toggle(g.id)} mark={<KindMark id={g.id} cards={g.cards} model={model} />}>
              {g.id === 'goal' && g.question ? (
                <li className="flex items-start gap-2 px-2 py-1.5">
                  <span aria-hidden="true" className="w-4 flex-none" />
                  <span className="min-w-0 flex-1">
                    <span className="block break-words text-text-header" data-view="model.question.text">{model.question.text}</span>
                    {model.aim == null ? null : <span className={`${typography.viewPanelTabular} mt-0.5 block text-text-body`} title={model.aim.title} data-view="model.aim.text">{model.aim.text}</span>}
                  </span>
                </li>
              ) : null}
              {g.rows.map((c) => <ModelCardRow key={c.id} card={c} number={numbers.get(c.id) ?? null} kind={drawKindOf(c, model)} keyEntries={model.key} />)}
            </Group>
          )
        })}
        {model.links.length === 0 ? null : (
          <Group id="relationships" title={MODEL_GROUP_TITLE.relationships} count={!searching ? model.links.length : links.length}
            open={isOpen('relationships', !searching ? model.links.length : links.length)} onToggle={() => toggle('relationships')} mark={<KindMark id="relationships" cards={[]} model={model} />}>
            {links.map(({ l, i, from, to }) => (
              <li key={i}>
                <button type="button" onClick={() => focusNodeById(l.from)} data-model-link={`links.${i}`} title={l.title}
                  className={`flex w-full cursor-pointer items-start gap-2 rounded-md px-2 py-1.5 text-left hover:bg-panel-hover ${ACTION_FOCUS}`}>
                  <span aria-hidden="true" className="w-4 flex-none text-center text-text-light">{KIND_GLYPH.relationship}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block break-words text-text-header">
                      <span>{from}</span>
                      <span aria-hidden="true" className="text-text-light"> → </span>
                      <span>{to}</span>
                    </span>
                    {l.label === '' && l.effect == null ? null : (
                      <span className={`${typography.viewPanelMeta} mt-0.5 flex flex-wrap items-baseline gap-x-2 text-text-light`}>
                        {l.label === '' ? null : <span data-view={`links.${i}.label`}>{l.label}</span>}
                        {l.effect == null ? null : <span className="tabular-nums" title={l.effect.title} data-view={`links.${i}.effect.text`}>{l.effect.text}</span>}
                      </span>
                    )}
                  </span>
                </button>
              </li>
            ))}
          </Group>
        )}
      </div>
      {/* The key to the authorship marks on screen (the crafted tab's ValueProvenanceKey: a mark nobody can read is a private code), in
          core's key words; nothing when no row carries one. */}
      {authorKey.length === 0 ? null : (
        <p className={`${typography.viewPanelMeta} m-0 flex flex-wrap gap-x-4 border-t border-panel-border pt-3 text-text-light`} data-testid="view-model-key">
          {authorKey.map((k) => <span key={k.id} data-view-key={k.id}><span aria-hidden="true">{k.glyph}</span> <span>{k.text}</span></span>)}
        </p>
      )}
    </div>
  )
}

/** The tab's body for the scenario on screen: the View's model, or nothing before core holds one. */
export function ViewModelTabBlock(): JSX.Element | null {
  const model = useViewStore((s) => s.view?.model ?? null)
  return model === null ? null : <ViewModelTab model={model} />
}
