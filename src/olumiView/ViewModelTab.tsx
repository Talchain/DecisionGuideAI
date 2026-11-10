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
import { shownModel, useViewStore } from './store'
import { ModelCardRow } from './model/ModelCardRow'
import { LinkRow } from './model/LinkRow'
import { HeldNotice } from './model/detail'
import { AddFigureRow, AskOlumi } from './model/structure'
import { useModelWords } from './model/editing'
import { authorKeyOf } from './model/premises'
import { groupRow, useModelTab, type Receipt } from './model/state'
import { focusIsWith, sayReceipt } from './model/editors'
import { linkRowOf } from './model/targets'
import { ModelSections } from './model/sections'

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

/** One group: a heading row that opens and closes it (chevron, kind mark, title, count), a note under it whether open or closed (what a
 *  change to the group came to), and its rows only while open. */
function Group({ id, title, count, open, onToggle, mark, note, children }: { id: GroupId; title: string; count: number; open: boolean; onToggle: () => void; mark: ReactNode; note?: ReactNode; children: ReactNode }) {
  return (
    <section aria-label={title} data-model-group={id} data-open={open}>
      <button type="button" aria-expanded={open} aria-label={`${title}, ${count} ${count === 1 ? 'element' : 'elements'}`} onClick={onToggle}
        data-model-group-toggle={id} className={`${typography.viewPanelBody} inline-flex w-full items-center gap-1.5 rounded-md px-1 py-1.5 text-left text-text-body hover:bg-panel-hover ${ACTION_FOCUS}`}>
        <ChevronRight aria-hidden="true" className={`h-3.5 w-3.5 flex-none text-text-light transition-transform ${open ? 'rotate-90' : ''}`} />
        {mark}
        <span>{title}</span>
        <span className={`${typography.viewPanelMeta} ml-1 text-text-light`} data-model-group-count={id}>{count}</span>
      </button>
      {note}
      {open ? <ul className="m-0 mb-2 ml-2 mt-0.5 list-none space-y-0.5 p-0">{children}</ul> : null}
    </section>
  )
}

/**
 * Plain | Expert: the crafted tab's one detail switch, in its own look (legacy `ModelTabV2Panel`: a pill pair, the chosen arm filled), with
 * the lens bar's keyboard (`ViewLensBar.tsx`): arrow keys move along it, the chosen arm is the only one in the tab order.
 */
function ExpertSwitch() {
  const W = useModelWords()!
  const expert = useModelTab((s) => s.expert)
  const setExpert = useModelTab((s) => s.setExpert)
  const arms = useRef<(HTMLButtonElement | null)[]>([])
  const choose = (next: boolean) => { setExpert(next); arms.current[next ? 1 : 0]?.focus() }
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); choose(true) }
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); choose(false) }
  }
  const arm = (on: boolean) => `${typography.viewPanelMeta} inline-flex h-7 items-center rounded-full px-2.5 transition-colors duration-fast ${ACTION_FOCUS} ${on
    ? 'bg-text-header text-text-on-color' : 'text-text-light hover:text-text-body'}`
  return (
    <div role="radiogroup" aria-label={W?.detail} onKeyDown={onKey} data-testid="view-model-expert"
      className="inline-flex flex-none items-center gap-0.5 rounded-full border border-panel-border bg-panel p-0.5">
      {[false, true].map((on, k) => (
        <button key={k} ref={(el) => { arms.current[k] = el }} type="button" role="radio" aria-checked={expert === on} tabIndex={expert === on ? 0 : -1}
          onClick={() => setExpert(on)} className={arm(expert === on)} data-model-expert-arm={on ? 'expert' : 'plain'}>
          {on ? W?.expert : W?.plain}
        </button>
      ))}
    </div>
  )
}

type Outline = ReturnType<typeof modelOutlineOf>

/**
 * The card groups as the tab draws them: each with its count and whether it is open, by one rule, read both by the rows on screen and by
 * the key that explains their marks, so the two can never drift apart (UI review of ddaedeed). A group with no card is not drawn, except
 * Question & goal and Factors (where the first figure is added). The count is the group's cards (and the question), or while a filter is
 * typed, what the filter leaves.
 */
export function groupsDrawn(outline: Outline, isOpen: (id: GroupId, count: number) => boolean, hasAim = true) {
  return outline.groups.flatMap((g) => {
    if (g.cards.length === 0 && g.id !== 'goal' && g.id !== 'factors') return []
    // The Goal group's own row is the aim (the question is said once, above the outline): counted only where it is drawn.
    const aimRow = g.id === 'goal' && hasAim ? 1 : 0
    const count = !outline.searching ? g.cards.length + aimRow : g.rows.length + (g.question ? aimRow : 0)
    return [{ g, count, open: isOpen(g.id, count) }]
  })
}

/** What a write on a group came to, said under its heading (`groupRow`): core's version, or core's refusal when its form left the screen. */
function GroupNote({ said }: { said: Receipt | null }) {
  if (said === null) return null
  return (
    <p role={said.tone === 'failed' ? 'alert' : 'status'} className={`${typography.viewPanelMeta} m-0 ml-6 ${said.tone === 'failed' ? 'text-danger' : 'text-text-light'}`}
      data-model-saved={said.tone === 'saved' ? said.row : undefined} data-model-failed={said.tone === 'failed' ? said.row : undefined}>{said.words}</p>
  )
}

/**
 * While the View is not valid (`model` null: a read on its way after a change, or one that failed), the tab draws no value of it and offers
 * no edit (Codex review-ui 6): one line says what is happening, and what a write came to if it could not be shown. The tab itself stays
 * on screen, so its open groups and filter are as the person left them when the next View lands; their drafts stay in the tab's state
 * (`editing`, `adding`). Focus that was on a control the tab no longer draws goes to what the write came to; focus put elsewhere stays.
 */
function NotCurrent() {
  const W = useModelWords()!
  const error = useViewStore((s) => s.error)
  const saving = useModelTab((s) => s.busy !== null)
  const unshown = useModelTab((s) => (s.receipt?.tone === 'failed' ? s.receipt.words : null))
  const said = useRef<HTMLParagraphElement>(null)
  useEffect(() => { if (unshown !== null && focusIsWith(null)) said.current?.focus() }, [unshown])
  const calm = error === null || saving
  return (
    <div className="space-y-1" data-testid="view-model-not-current">
      <p role={calm ? 'status' : 'alert'} className={`${typography.viewPanelMeta} m-0 ${calm ? 'text-text-light' : 'text-danger'}`} data-testid="view-model-not-current-why">
        {saving ? W?.saving : error ?? W?.reading}
      </p>
      {unshown === null ? null : <p ref={said} tabIndex={-1} role="alert" className={`${typography.viewPanelMeta} m-0 text-danger ${ACTION_FOCUS}`} data-testid="view-model-not-current-unshown">{unshown}</p>}
    </div>
  )
}

export function ViewModelTab({ model }: { model: ViewModel | null }): JSX.Element {
  const W = useModelWords()!
  const numbers = useMemo<ReadonlyMap<string, string>>(() => (model === null ? new Map() : cardNumbersOf(model)), [model])
  // Another scenario starts with nothing open, no editor and no receipt (review a4d73faf): ids are scenario-local.
  const sid = useViewStore((s) => s.sid)
  useEffect(() => { useModelTab.getState().follow(sid) }, [sid])
  // A write said as saved but not shown (it landed while the tab drew nothing) is shown by any later View this tab draws: core's version is
  // said in its place, on the same row or group.
  const view = useViewStore((s) => s.view)
  const unseen = useModelTab((s) => (s.receipt?.unseen !== undefined ? s.receipt : null))
  useEffect(() => {
    if (model === null || unseen === null || unseen.unseen === undefined || sid === null || view === unseen.unseen.view) return
    if (unseen.unseen.n === null) useModelTab.getState().say(null)
    else sayReceipt(sid, unseen.row, { n: unseen.unseen.n })
  }, [model, unseen, view, sid])
  // Closed on open (the previous PoC's outline: five headings with counts, the question above them); a filter opens what it matches.
  const [opened, setOpened] = useState<ReadonlySet<GroupId>>(new Set())
  const [filter, setFilter] = useState('')
  const outline = useMemo(() => (model === null ? null : modelOutlineOf(model, filter)), [model, filter])
  const groupSaid = useModelTab((s) => (s.receipt !== null && s.receipt.row.startsWith('group:') ? s.receipt : null))
  if (model === null || outline === null) return (
    <div className={`${typography.viewPanelBody} space-y-2 pb-4`} data-testid="view-model-tab">
      <div className="flex items-center justify-between gap-2">
        <h3 className={`${typography.panelHeader} m-0 text-text-header`}>{MODEL_OUTLINE_LABELS.title}</h3>
        <ExpertSwitch />
      </div>
      <NotCurrent />
    </div>
  )
  const { searching, groups: shown, links, ids } = outline
  const isOpen = (id: GroupId, count: number) => (searching ? count > 0 : opened.has(id))
  const allOpen = ids.every((id) => opened.has(id))
  const toggle = (id: GroupId) => setOpened((o) => { const n = new Set(o); if (n.has(id)) n.delete(id); else n.add(id); return n })
  const anyMatch = shown.some((g) => g.rows.length > 0 || g.question) || links.length > 0
  // The key names only the marks of the rows actually drawn: an open group's rows, as the filter leaves them (authorKeyOf's own rule),
  // from the same groups the rows are drawn from.
  const groups = groupsDrawn(outline, isOpen, model.aim != null)
  const authorKey = authorKeyOf(model, groups.flatMap(({ g, open }) => (open ? g.rows : [])))
  const linkCount = !searching ? model.links.length : links.length
  // A write a group's own row cannot answer for says what it came to on its group (UI audit of e8ebab94): a link removed (its row is gone);
  // Add a figure or Remove link refused after their form left the screen. Relationships stays drawn while it says so.
  const saidOn = (id: GroupId) => (groupSaid?.row === groupRow(id) ? groupSaid : null)
  const linksSaid = saidOn('relationships')
  return (
    <div className={`${typography.viewPanelBody} space-y-2 pb-4`} data-testid="view-model-tab">
      <div className="flex items-center justify-between gap-2">
        <h3 className={`${typography.panelHeader} m-0 text-text-header`}>{MODEL_OUTLINE_LABELS.title}</h3>
        <ExpertSwitch />
      </div>
      <input type="search" value={filter} onChange={(e) => setFilter(e.target.value)} placeholder={MODEL_OUTLINE_LABELS.filter} aria-label={MODEL_OUTLINE_LABELS.filterName}
        data-testid="view-model-filter" className={`${typography.viewPanelBody} w-full min-w-0 rounded-md border border-field bg-panel px-3 py-1.5 text-text-body placeholder:text-text-light ${ACTION_FOCUS}`} />
      {/* R25 (Paul's finish line, no cut text): the question whole, wrapping; never two lines with the rest on hover only. */}
      <p className="m-0 break-words py-1" data-testid="view-model-question">
        <span className={`${typography.viewPanelMeta} font-medium text-text-body`}>{MODEL_OUTLINE_LABELS.question}</span>{' '}
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
        {groups.map(({ g, count, open }) => {
          return (
            <Group key={g.id} id={g.id} title={g.title} count={count} open={open} onToggle={() => toggle(g.id)} mark={<KindMark id={g.id} cards={g.cards} model={model} />}
              note={<GroupNote said={saidOn(g.id)} />}>
              {/* The question is said once, on its own line above the outline (SC-02); the Goal group keeps the aim it is measured by. */}
              {g.id === 'goal' && g.question && model.aim != null ? (
                <li className="flex items-start gap-2 px-2 py-1.5">
                  <span aria-hidden="true" className="w-4 flex-none" />
                  <span className="min-w-0 flex-1">
                    <span className={`${typography.viewPanelTabular} block text-text-body`} title={model.aim.title} data-view="model.aim.text">{model.aim.text}</span>
                  </span>
                </li>
              ) : null}
              {g.rows.map((c) => <ModelCardRow key={c.id} card={c} number={numbers.get(c.id) ?? null} kind={drawKindOf(c, model)} model={model} />)}
              {searching ? null : g.id === 'factors' ? <AddFigureRow />
                : g.id === 'options' ? <li className="px-2 pt-1"><AskOlumi at="options" label={W.askOption} draft={W.askOptionDraft} /></li>
                  : g.id === 'outcomes-risks' ? <li className="px-2 pt-1"><AskOlumi at="risks" label={W.askRisk} draft={W.askRiskDraft} /></li> : null}
            </Group>
          )
        })}
        {model.links.length === 0 && linksSaid === null ? null : (
          <Group id="relationships" title={MODEL_GROUP_TITLE.relationships} count={linkCount}
            open={isOpen('relationships', linkCount)} onToggle={() => toggle('relationships')} mark={<KindMark id="relationships" cards={[]} model={model} />}
            note={<GroupNote said={linksSaid} />}>
            {links.map(({ l, i, from, to }) => { const row = linkRowOf(model, i); return <LinkRow key={row} model={model} link={l} i={i} row={row} from={from} to={to} /> })}
            {searching ? null : <li className="px-2 pt-1"><AskOlumi at="links" label={W.askLink} draft={W.askLinkDraft} /></li>}
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
      {/* The previous tab's sections under its outline (DL brief A4): Limits, structural issues, the model card, the audit, from the View. */}
      {searching ? null : <ModelSections model={model} version={view?.version ?? null} />}
    </div>
  )
}

/**
 * The tab's body for the scenario on screen: the View's model while it is valid (store.ts `shownModel`, the shared gate the Analysis and
 * Reasoning tabs draw from: no failed read, nothing changed since it was read), the tab saying why while it is not, or nothing before core
 * holds a View at all.
 */
export function ViewModelTabBlock(): JSX.Element | null {
  const model = useViewStore(shownModel)
  const hadView = useViewStore((s) => s.view !== null)
  return model === null && !hadView ? null : <ViewModelTab model={model} />
}
