/**
 * THE MODEL TAB ON THE CORE LANE (DL 4 Nov, R2: Paul's staging has it): the legacy Model tab's outline (`model-tab-v2/ModelOutline.tsx`:
 * its groups, in its order, under its own titles), drawn from core's View. Question & goal: the question, the aims and limits, and the aim
 * core measures (`model.aim`); Options; Factors (the figures a person sets); Outcomes & risks (the figures core works out from others, the
 * risks); Relationships (the links, from its card to its card). Every model word is core's: each card's number and heading as the canvas
 * draws them, its figure or rows, and Olumi's mark where core marks it. Assumptions and conditions are each card's "Rests on".
 *
 * R25 (Paul 7 Nov): the crafted tab reinstated (`model/ModelCardRow.tsx`), then made the place to change the model by hand:
 * - a figure core lets the person set carries ✎ and opens its editor where it stands; a row's press opens its detail (rename, an aim's
 *   target, its links, whose it is) and puts its card in front on the canvas; Olumi's held change is said once, with a way to set it aside;
 * - the crafted tab's one detail switch, Plain | Expert (legacy "Plain | Advanced"): Plain shows the model; Expert adds the science core
 *   sends (a figure's reading, an option's timing line, a link's strength, whose words in full, what would change an option most). What a
 *   person needs to challenge the model stays in Plain: the team's assumptions (each row's "Rests on"), Olumi's marks and companion line,
 *   a link's kind or sign. A content switch only: no row moves.
 * Every write is the canvas editors' own (route, body, key, base rule); core's answer is the only verdict (`model/editors.tsx`).
 */
import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { ChevronRight } from 'lucide-react'
import { typography } from '../styles/typography'
import { ACTION_FOCUS } from '../components/results/analysisNew/panelSurfaces'
import { MODEL_GROUP_TITLE } from '../canvas/domain/vocabulary'
import { NodeShapeIndicator } from '../canvas/nodes/NodeShapeIndicator'
import { KIND_GLYPH } from '../canvas/model-tab-v2/rowPresentation'
import type { ViewCard, ViewModel } from './client'
import { cardNumbersOf, drawKindOf, modelOutlineOf, outcomeRiskKinds, type OutlineGroupId } from './layout'
import { useViewStore } from './store'
import { ModelCardRow } from './model/ModelCardRow'
import { LinkRow } from './model/LinkRow'
import { HeldNotice } from './model/detail'
import { MODEL_EDIT_WORDS } from './model/editing'
import { authorKeyOf } from './model/premises'
import { useModelTab } from './model/state'

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
        data-model-group-toggle={id} className={`${typography.viewPanelBody} inline-flex w-full items-center gap-1.5 rounded-md px-1 py-1.5 text-left text-text-body hover:bg-panel-hover ${ACTION_FOCUS}`}>
        <ChevronRight aria-hidden="true" className={`h-3.5 w-3.5 flex-none text-text-light transition-transform ${open ? 'rotate-90' : ''}`} />
        {mark}
        <span>{title}</span>
        <span className={`${typography.viewPanelMeta} ml-1 text-text-light`} data-model-group-count={id}>{count}</span>
      </button>
      {open ? <ul className="m-0 mb-2 ml-2 mt-0.5 list-none space-y-0.5 p-0">{children}</ul> : null}
    </section>
  )
}

/**
 * Plain | Expert: the crafted tab's one detail switch, drawn as the lane's own segmented control (the lens bar's radiogroup recipe,
 * `ViewLensBar.tsx`): arrow keys move along it, the chosen arm is the only one in the tab order.
 */
function ExpertSwitch() {
  const expert = useModelTab((s) => s.expert)
  const setExpert = useModelTab((s) => s.setExpert)
  const arms = useRef<(HTMLButtonElement | null)[]>([])
  const choose = (next: boolean) => { setExpert(next); arms.current[next ? 1 : 0]?.focus() }
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); choose(true) }
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); choose(false) }
  }
  const arm = (on: boolean) => `${typography.viewPanelMeta} inline-flex h-7 items-center rounded-full border px-2.5 transition-colors duration-fast ${ACTION_FOCUS} ${on
    ? 'border-panel-border bg-[var(--panel-tab-active-bg)] text-text-header' : 'border-transparent text-text-light hover:text-text-body'}`
  return (
    <div role="radiogroup" aria-label={MODEL_EDIT_WORDS.detail} onKeyDown={onKey} data-testid="view-model-expert"
      className="inline-flex flex-none items-center gap-0.5 rounded-full border border-panel-border bg-panel p-0.5">
      {[false, true].map((on, k) => (
        <button key={k} ref={(el) => { arms.current[k] = el }} type="button" role="radio" aria-checked={expert === on} tabIndex={expert === on ? 0 : -1}
          onClick={() => setExpert(on)} className={arm(expert === on)} data-model-expert-arm={on ? 'expert' : 'plain'}>
          {on ? MODEL_EDIT_WORDS.expert : MODEL_EDIT_WORDS.plain}
        </button>
      ))}
    </div>
  )
}

export function ViewModelTab({ model }: { model: ViewModel }): JSX.Element {
  const numbers = useMemo(() => cardNumbersOf(model), [model])
  // Another scenario starts with nothing open, no editor and no receipt (review a4d73faf): ids are scenario-local.
  const sid = useViewStore((s) => s.sid)
  useEffect(() => { useModelTab.getState().follow(sid) }, [sid])
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
        <ExpertSwitch />
      </div>
      <input type="search" value={filter} onChange={(e) => setFilter(e.target.value)} placeholder={MODEL_OUTLINE_LABELS.filter} aria-label={MODEL_OUTLINE_LABELS.filterName}
        data-testid="view-model-filter" className={`${typography.viewPanelBody} w-full min-w-0 rounded-md border border-field bg-panel px-3 py-1.5 text-text-body placeholder:text-text-light ${ACTION_FOCUS}`} />
      <p className="m-0 py-1" data-testid="view-model-question">
        <span className={`${typography.viewPanelMeta} text-text-light`}>{MODEL_OUTLINE_LABELS.question}</span>{' '}
        <span className="text-text-header" data-view="model.question.text">{model.question.text}</span>
      </p>
      <HeldNotice />
      <div className="flex justify-end">
        <button type="button" data-testid="view-model-toggle-all" onClick={() => setOpened(allOpen ? new Set() : new Set(ids))}
          className={`${typography.viewPanelMeta} rounded-sm py-1 text-text-light underline-offset-2 hover:text-text-header hover:underline ${ACTION_FOCUS}`}>
          {allOpen ? MODEL_OUTLINE_LABELS.collapse : MODEL_OUTLINE_LABELS.expand}
        </button>
      </div>
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
              {g.rows.map((c) => <ModelCardRow key={c.id} card={c} number={numbers.get(c.id) ?? null} kind={drawKindOf(c, model)} model={model} />)}
            </Group>
          )
        })}
        {model.links.length === 0 ? null : (
          <Group id="relationships" title={MODEL_GROUP_TITLE.relationships} count={!searching ? model.links.length : links.length}
            open={isOpen('relationships', !searching ? model.links.length : links.length)} onToggle={() => toggle('relationships')} mark={<KindMark id="relationships" cards={[]} model={model} />}>
            {links.map(({ l, i, from, to }) => <LinkRow key={i} model={model} link={l} i={i} from={from} to={to} />)}
          </Group>
        )}
      </div>
      {/* The key to the authorship marks on screen (the crafted tab's ValueProvenanceKey: a mark nobody can read is a private code), in
          core's key words; nothing when no row carries one. Spacing, not a rule, sets it apart (DS v5 §6: no one-sided borders). */}
      {authorKey.length === 0 ? null : (
        <p className={`${typography.viewPanelMeta} m-0 flex flex-wrap gap-x-4 pt-3 text-text-light`} data-testid="view-model-key">
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
