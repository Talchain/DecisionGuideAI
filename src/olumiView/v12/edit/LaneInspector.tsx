/**
 * THE CARD'S ONE BOX (surfaces step A, 18 Nov; it was the lane's details panel and, separately, the card's hover pop-up). On the lane ONE component
 * says everything about a card beside it, in two states of the SAME box in the same place:
 *   - a PREVIEW while the pointer rests on the card or it holds keyboard focus (the card's own hover rule, usePopoverHover): read only, nothing to press;
 *   - PINNED once the card is pressed: the same box gains its close, the Value row (the one place a figure is changed), its folds and one row of actions.
 * The order is the same in both: name and kind; value and whose it is; a commitment; where the team differs; what it is connected to; where it comes
 * from (pinned, folded); actions (pinned). Every sentence about the model is core's own field; the labels are the board's fixed words.
 * A link's details are the same box, pinned only. Editing works at every level (Simple or the whole model).
 *
 * The older look (off the lane) keeps its details panel at its fixed corner and its own pop-up, unchanged (`OlderInspector`).
 * "Take out of comparison" is NOT offered: core has no route for an option's status or an exclusion (MANUAL-EDITING-MAP, headline 4).
 */
import { controls } from '../../../styles/controls'
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { isOlumiCoreLane } from '../../../olumiCore/lane'
import { OkIcon, OkIconButton } from '../../look/icons'
import { Hover, HoverButton } from '../../look/Hover'
import { useCanvasCardTip } from '../../look/Tip'
import { FOLD_SUMMARY, FoldChevron } from '../../look/FoldChevron'
import { typography } from '../../../styles/typography'
import { VIEW_CHIP_CLASS } from '../../../v5/blocks/chipClass'
import { viewLinkDataOf } from '../../canvas'
import { cardEditRows, linkEditRows } from '../../../canvas/contextMenu/laneMenu'
import { useLaneCtx } from '../../../canvas/contextMenu/useLaneMenu'
import { useShowToast } from '../../../canvas/ToastContext'
import { useCanvasStore } from '../../../canvas/store'
import { CANVAS_LAYER_CLASS } from '../../../canvas/layers'
import { NodeShapeIndicator } from '../../../canvas/nodes/NodeShapeIndicator'
import type { NodeTarget } from '../../../canvas/contextMenu/types'
import type { ViewCard } from '../../client'
import type { FigureRange } from '../contract'
import { figureRange } from '../contract'
import { WhereYouDiffer } from '../../../olumiCore/team/CardDispute'
import { CommitToThisButton } from '../team/CommitForm'
import { useCommitted } from '../team/CommittedMark'
import { FigureInspector, INSPECTOR_WORDS, WhatItMoves } from '../inspect/FigureInspector'
import { ValueRow } from '../inspect/ValueRow'
import { connectionsOf } from '../inspect/connections'
import { openWhatIf } from '../inspect/whatIfFocus'
import { isOlumis } from '../lenses/layers'
import { kindWordsOf } from '../chat/CardMenuHeader'
import { useViewStore } from '../../store'
import { useDriverOf } from '../../lens'
import { drawKindOf, triableCards } from '../../layout'
import { isDashedCardKind } from '../cards/kind'
import { coreHoverValueOf, leadLineOf } from '../../previous/CoreCard'
import { isSizeEdit, type EditSpec } from './EditForm'
import { OLDER_DETAILS_FORM_ANCHOR, openLaneForm, openLinkRemoval } from './structuralEdits'
import { RenameHeading } from './RenameHeading'
import { canRenameCard } from './renameCard'
import { CardWords } from '../../SelectedRename'
import { changesNoFigure, movedBy, SelectedExplain } from '../../look/SelectedExplain'
import { detailsOf, useLaneInspector } from './inspectorStore'
import { optionValuesOf } from './optionValues'
import { DETAILS_H, DETAILS_X, DETAILS_Y, PEEK_RESERVE, stayBeside } from './placeBeside'

const NOOP = () => undefined
/** The box's own fixed words (chrome): its row labels and its one fold. */
export const BOX_WORDS = { value: 'Value', from: 'Where this comes from', more: 'More options', actions: 'Actions', edit: 'Edit' } as const
/**
 * The one small form, from the box's buttons: it takes the box's place (one thing open at a time). On the lane it is placed beside the same
 * card by the same rule as the box (`beside`: never over the card, inside the free canvas); the older look keeps its fixed anchor, as before.
 */
const openFormHere = (spec: EditSpec): void => {
  const open = useLaneInspector.getState().current
  const lane = isOlumiCoreLane()
  const beside = lane && open?.kind === 'details' ? open.target : undefined
  openLaneForm(spec, lane ? undefined : OLDER_DETAILS_FORM_ANCHOR, beside)
}

type Range = (card: ViewCard, r: FigureRange) => ReactNode
/** `range`: the slot for a figure's range chart (the scale lane's RangeBar); called only for a card whose View carries a numeric range. */
export function LaneInspector({ range }: { range?: Range } = {}): JSX.Element | null {
  return isOlumiCoreLane() ? <LaneBox range={range} /> : <OlderInspector range={range} />
}

/**
 * What the box says a card's value is and whose THAT VALUE is (core's own attribution, `coreHoverValueOf`: a figure's or a bound's, never borrowed from
 * the card's author, who may only own the aim); an option's is its own lead line (its chance in this model), which is nobody's idea and carries no source.
 * `stateOnly`: core sent no figure, only its state line for it ("Olumi's question, not yet sized"), which is the card's author line and is drawn once, as that.
 */
const valueOf = (card: ViewCard): { text: string; source: string | null } | null => {
  const v = coreHoverValueOf(card)
  if (v !== null) return v.source === null && v.text === card.author?.text ? null : v
  const lead = card.family === 'option' ? leadLineOf(card) : null
  return lead === null ? null : { text: lead, source: null }
}

const row = 'flex gap-2 py-2.5'
const rowLabel = `${typography.viewPanelMeta} w-16 flex-none text-text-light`

function Committed({ card }: { card: string }): JSX.Element | null {
  const k = useCommitted(card)
  if (k === null) return null
  return (
    <p className="m-0 flex items-start gap-1.5 text-text-body" data-testid="lane-inspector-committed" data-commitment={k.id}>
      <OkIcon id="committed" size={14} decorative className="mt-0.5" /><span className="min-w-0 break-words">{k.lines.join(' · ')}</span>
    </p>
  )
}

function Connections({ card, peek }: { card: ViewCard; peek: boolean }): JSX.Element | null {
  const model = useViewStore((s) => s.view?.model ?? null)
  const edges = useCanvasStore((s) => s.edges)
  const groups = useMemo(() => (model === null ? [] : connectionsOf(model, card, edges)), [model, card, edges])
  if (groups.length === 0) return null
  return (
    <dl className={`m-0 ${peek ? 'space-y-4' : 'space-y-3'}`} data-testid="lane-inspector-connections">
      {groups.map((g) => (
        <div key={g.heading} className={row} data-connections={g.heading}>
          <dt className={rowLabel}>{g.heading}</dt>
          <dd className="m-0 min-w-0">
            <ul className={`m-0 list-none p-0 ${peek ? 'space-y-3' : 'space-y-2'}`}>
              {g.items.map((i) => (
                <li key={i.id} className="flex items-start gap-1.5 text-text-body" data-connected={i.id} data-connected-kind={i.kind}>
                  <NodeShapeIndicator nodeKind={i.kind} dashedOutline={i.dashed} size={10} className="mt-1 flex-none" /><span className="min-w-0 break-words">{i.name}</span>
                </li>
              ))}
              {g.more > 0 ? <li className={`${typography.viewPanelMeta} text-text-light`} data-connections-more={g.more}>{`+${g.more}`}</li> : null}
            </ul>
          </dd>
        </div>
      ))}
    </dl>
  )
}

/** The lane: ONE box for the card pressed (pinned) or, while nothing at all is open, the card previewed. */
function LaneBox({ range }: { range?: Range }): JSX.Element | null {
  const pinnedOn = useLaneInspector(detailsOf)
  const cardTipOpen = useCanvasCardTip((s) => s.tipId !== null)
  const peeked = useLaneInspector((s) => (s.current === null && !cardTipOpen ? s.peek : null))
  const section = useLaneInspector((s) => (s.current !== null && s.current.kind === 'details' ? s.current.section ?? null : null))
  const close = useLaneInspector((s) => s.close)
  const target = pinnedOn ?? peeked, pinned = pinnedOn !== null
  const view = useViewStore((s) => s.view)
  const showToast = useShowToast()
  const ctx = useLaneCtx({ showToast, onClose: NOOP, openForm: openFormHere, openRemove: openLinkRemoval })
  const model = view?.model ?? null
  const card = target?.kind === 'card' ? model?.cards.find((c) => c.id === target.id) ?? null : null
  const link = useCanvasStore((s) => target?.kind === 'link' ? viewLinkDataOf(s.edges.find((e) => e.id === target.id))?.link ?? null : null)
  // The item gone from the model: pinned details close rather than show what is not there (another scenario closes them in LaneEditingLayer).
  useEffect(() => { if (pinnedOn !== null && card === null && link === null) close() }, [pinnedOn, card, link, close])
  // The Value row is the one place a figure, a risk's size or a link's strength is changed (surfaces step 5), so no button here opens a form for them.
  const rows = useMemo(() => (card !== null ? cardEditRows(card, ctx) : link !== null ? linkEditRows(link, ctx, target!.id) : []).filter((r) => r.id !== 'size' && r.id !== 'change-figure'), [card, link, ctx, target?.id])
  const [more, setMore] = useState(false)
  // While "What would change" is on: core's own sentence for each option this card's figure moves most (what the card's pop-up said then).
  const drives = useDriverOf(target?.kind === 'card' ? target.id : '')
  // BESIDE ITS ITEM, AND IT FOLLOWS (surfaces step 3): placed before paint, then re-placed whenever the item, the box or the free canvas moves. The preview
  // and the pinned box are one element under one placement, so a press on a previewed card changes what the box holds and never where it stands.
  const shown = target !== null && (card !== null || link !== null)
  const box = useRef<HTMLElement>(null)
  const at = target !== null && shown ? `${target.kind}:${target.id}` : ''
  useEffect(() => { setMore(false) }, [at, pinned])
  useLayoutEffect(() => {
    if (at === '' || target === null) return
    return stayBeside(() => box.current, target, { x: DETAILS_X, y: DETAILS_Y, h: DETAILS_H }, undefined, undefined,
      () => box.current?.dataset.state === 'peek' ? PEEK_RESERVE : 0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [at])
  if (target === null || (card === null && link === null)) return null
  const frame = `nodrag nopan fixed ${CANVAS_LAYER_CLASS.sheet} ok-float w-[280px] ${typography.viewPanelBody} left-[var(--lane-details-x,76px)] top-[var(--lane-details-y,112px)] flex max-h-[min(60vh,var(--lane-details-h,60vh))] flex-col overflow-hidden`
  const closeX = <button type="button" aria-label="Close details" onClick={() => close()} className={`${controls.chipIcon} grid flex-none cursor-pointer place-items-center text-text-light hover:bg-panel-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-header`}><OkIcon id="cancel-close" size={14} decorative inherit /></button>
  const chip = (r: (typeof rows)[number]) => {
    const Icon = r.icon
    return <HoverButton key={r.id} type="button" disabled={!r.enabled} words={r.enabled ? r.tooltip : (r.disabledReason ?? r.tooltip)} data-testid={`lane-inspector-${r.id}`} onClick={() => { if (!r.enabled) return; setMore(false); r.action() }}
      className={VIEW_CHIP_CLASS}>{Icon && <Icon size={14} />}{r.label}</HoverButton>
  }

  if (link !== null) return (
    <aside ref={box} role="complementary" aria-label="Details" data-testid="lane-inspector" data-state="pinned" data-kind="link" className={frame}>
      <div className="flex items-start justify-between gap-2">
        <h2 className={`${typography.panelHeader} min-w-0 break-words text-text-header`} data-testid="lane-inspector-title">{link.title}</h2>
        {closeX}
      </div>
      <div className="min-h-0 space-y-3 overflow-y-auto">
        {link.size === undefined ? null : <Hover as="p" className="m-0 text-text-body" words={link.size.title} data-testid="lane-inspector-strength">{link.size.text}</Hover>}
        <ValueRow key={target.id} item={{ kind: 'link', id: target.id, edit: link.size?.edit ?? null, subject: link.size?.text ?? '' }} />
        {link.causal?.author == null ? null : <Hover as="p" className={`${typography.viewPanelMeta} m-0 text-text-light`} words={link.causal.author.title} data-testid="lane-inspector-source">{link.causal.author.text}</Hover>}
      </div>
      {rows.length === 0 ? null : <div className="flex flex-wrap gap-1" role="group" aria-label={BOX_WORDS.edit}>{rows.map(chip)}</div>}
    </aside>
  )

  const c = card!
  const kind = drawKindOf(c, model), kindWord = kindWordsOf(c, kind)
  const value = valueOf(c)
  // A calculated card's value is one per option, each with core's own mark where a held proposal moves it (optionValues.ts): the preview and the pinned
  // box both draw it so, never the joined line alone, which loses which value a proposal moves (final-pair P1, 18 Nov). Null: the one line, as before.
  const perOption = optionValuesOf(c, model)
  // The card's author line is the value's own source on a quantity (core says so): it is then drawn once, beside the value, and not in the header too.
  const authorAtValue = value !== null && value.source !== null && value.source === c.author?.text
  // Olumi's mark in words is not said a second time where the value's source or the author line already says it. PINNED, a source that is Olumi's own
  // account of the card (`olumi.title`) is not drawn beside the value: the fold says it once (below); the preview has no fold, so it keeps it there.
  const sourceIsOlumis = c.olumi !== null && value?.source === c.olumi.title
  const sourceBesideValue = value?.source != null && !(pinned && sourceIsOlumis)
  const said = new Set([sourceBesideValue ? value?.source : null, c.author?.text])
  const option = c.family === 'option'
  const r = c.figure === null ? null : figureRange(c)
  // The card's own ask action (the right-click menu's "Explain"), pointed at this card's canvas node.
  const node = useCanvasStore.getState().nodes.find((n) => n.id === c.id)
  const ask = node === undefined ? null : () => ctx.act.ask({ kind: 'node', nodeId: node.id, nodeType: node.type as NodeTarget['nodeType'], node, screenPos: { x: 0, y: 0 } }, 'explain_element')
  const canTry = model !== null && c.figure !== null && triableCards(model).some((x) => x.id === c.id)
  // What the fold holds: core's own account of the card (its detail, the figure's own explanation) and, for an option, what it changes, rests on and how it is worked out.
  // C6 (20 Nov, said once): a sentence core's `detail` already holds is the detail's, drawn once there, never again as its own line.
  const inDetail = (s: string | null | undefined): boolean => s != null && s !== '' && c.detail.includes(s)
  const figureSaid = c.figure !== null && c.figure.title !== '' && c.figure.title !== c.figure.text && !inDetail(c.figure.title) ? c.figure.title : null
  const explain = option && view !== null && ((c.sets ?? []).length > 0 || (c.premises ?? []).length > 0 || movedBy(view, c).length > 0 || changesNoFigure(view, c))
  // The rest of what the card's old pop-up said, in core's words, each once: an option's own line, the reason, and (lens on) what it drives.
  // (A person's author line carries core's account of it, their own words quoted: drawn here, not left to a browser tip.)
  const also = [c.author != null && c.author.by !== 'olumi' && c.author.title !== c.author.text ? c.author.title : null, option ? c.face?.line?.text ?? null : null, c.figure === null && c.rows.length === 0 ? null : c.reason ?? null, ...(drives ?? []).map((o) => o.driver?.title ?? null)]
    // Said once: core's `detail` (drawn first in the fold) usually ends with the author's account whole; a line the detail already holds is not drawn again.
    .filter((x, i, a): x is string => x != null && x !== '' && x !== value?.text && x !== c.headline?.title && !c.detail.includes(x) && a.indexOf(x) === i)
  const olumiSaid = c.olumi === null || said.has(c.olumi.title) || inDetail(c.olumi.title) ? null : c.olumi.title
  const hasFrom = olumiSaid !== null || c.detail !== '' || figureSaid !== null || explain || also.length > 0
  return (
    <aside ref={box} role={pinned ? 'complementary' : 'tooltip'} aria-label="Details" data-testid={pinned ? 'lane-inspector' : 'lane-peek'} data-state={pinned ? 'pinned' : 'peek'} data-kind="card" data-box-card={c.id}
      className={`${frame}${pinned ? '' : ' pointer-events-none'}`}>
      {/* 1. Name and kind (and, pinned, the close). */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          {pinned && canRenameCard(c) ? <RenameHeading key={c.id} card={c} gate={ctx.gate} />
            : <h2 className={`${typography.panelHeader} break-words text-text-header`} data-testid="lane-inspector-title">{c.heading}</h2>}
          <p className={`${typography.viewPanelMeta} m-0 mt-2 flex flex-wrap items-center gap-1.5 text-text-light`} data-testid="lane-inspector-kind">
            <NodeShapeIndicator nodeKind={kind} dashedOutline={isDashedCardKind(c)} size={10} />{kindWord}
            {c.olumi === null ? null : <span role="img" aria-label={c.olumi.title} className="inline-flex" data-testid="lane-inspector-olumi"><OkIcon id="olumi-mark" size={14} decorative /></span>}
            {/* Whose the card is. Where the value's own source is this same line (a quantity's figure), it is said once, beside the value. */}
            {authorAtValue ? null : <CardWords id={c.id} ids={{ author: 'lane-inspector-author', basis: 'lane-inspector-basis' }} only="author" />}
            {c.status === null ? null : <span data-testid="lane-inspector-status">{c.status}</span>}
          </p>
        </div>
        {pinned ? closeX : null}
      </div>
      <div className={`min-h-0 overflow-y-auto ${pinned ? 'space-y-3' : 'space-y-4'}`}>
        {/* A held proposal's change to this card (core's `change`, the card's own ↻ or + mark, ViewCardNode.tsx:317/:429): said here too, so a value waiting for approval never reads as settled. */}
        {c.change == null ? null : <p className={`m-0 whitespace-pre-line break-words ${typography.viewPanelMeta} text-info`} data-testid="lane-inspector-change" data-change-kind={c.change.kind}><span aria-hidden="true">{c.change.glyph} </span>{c.change.title}</p>}
        {/* 2. Value and whose it is; pinned, what it rests on, its chart and the one editor. */}
        {value === null ? null : (
          <div className={row} data-testid="lane-inspector-value">
            <span className={rowLabel}>{BOX_WORDS.value}</span>
            <div className="min-w-0 break-words">
              {perOption === null ? <span className="text-text-header" data-testid="lane-inspector-figure">{value.text}</span> : (
                <ul className="m-0 list-none space-y-3 p-0 text-text-header" data-testid="lane-inspector-figure">
                  {perOption.map((o) => (
                    <li key={o.option} data-option-value={o.option} data-option-withheld={o.withheld || undefined}>
                      {o.heading === '' ? null : `${o.heading}: `}<span className={o.withheld ? 'text-text-light' : undefined}>{o.text}</span>
                      {o.ifApproved === null ? null : (
                        <>{' '}<span className="text-info" data-testid="lane-inspector-if-approved" data-view={`${c.id}.values.${o.at}.if_approved`}><span aria-hidden="true">{o.ifApproved.glyph} </span>{o.ifApproved.title}</span></>
                      )}
                    </li>
                  ))}
                </ul>
              )}{' '}
              {authorAtValue ? <CardWords id={c.id} ids={{ author: 'lane-inspector-author', basis: 'lane-inspector-basis' }} only="author" />
                : !sourceBesideValue ? null : <span className={`${typography.viewPanelMeta} text-info`} data-testid="lane-inspector-value-source">{value.source}</span>}
            </div>
          </div>
        )}
        {!pinned ? null : (
          <>
            {/* The basis sentence, unless it IS the Value row's line (core withholds the chance and its one sentence says why): said once. */}
            {c.headline?.title === value?.text ? null : <CardWords id={c.id} ids={{ author: 'lane-inspector-author', basis: 'lane-inspector-basis' }} only="basis" />}
            {option && c.headline?.add != null && c.headline.add !== '' ? <p className="m-0 whitespace-pre-wrap break-words text-text-body" data-testid="lane-inspector-add">{c.headline.add}</p> : null}
            {range === undefined || r === null ? null : <div data-testid="inspector-range">{range(c, r)}</div>}
            {c.figure === null ? null : <ValueRow key={c.id} item={{ kind: 'card', id: c.id, edit: c.figure.edit ?? null, subject: c.heading, olumis: isOlumis(c) }} />}
          </>
        )}
        <div className="space-y-4 empty:hidden">
          {!pinned || c.figure === null ? null : <WhatItMoves figure={c.id} />}
          {/* 3. A commitment. 4. Where the team differs. 5. What it is connected to. */}
          {option ? <Committed card={c.id} /> : null}
          <WhereYouDiffer card={c.id} peek={!pinned} open={section === 'differ'} />
          <Connections card={c} peek={!pinned} />
          {/* 6. Where it comes from: core's own account, folded. */}
          {!pinned || !hasFrom ? null : (
            <details className="space-y-3" data-testid="lane-inspector-from">
              <summary className={`${FOLD_SUMMARY} ${typography.viewPanelMeta} cursor-pointer py-2.5 text-text-light`}><FoldChevron />{BOX_WORDS.from}</summary>
              {/* Olumi's own account of what it proposed (its mark is in the header, and the value says whose it is): whole here, in Olumi's blue. */}
              {olumiSaid === null ? null : <p className="m-0 break-words text-info" data-testid="lane-inspector-source">{olumiSaid}</p>}
              {c.detail === '' ? null : <p className="m-0 break-words text-text-body" data-testid="lane-inspector-detail">{c.detail}</p>}
              {figureSaid === null ? null : <p className="m-0 break-words text-text-body" data-testid="lane-inspector-figure-said">{figureSaid}</p>}
              {also.map((x) => <p key={x} className="m-0 break-words text-text-body" data-testid="lane-inspector-also">{x}</p>)}
              {view === null ? null : <SelectedExplain view={view} id={c.id} testid="lane-inspector-explain" />}
            </details>
          )}
        </div>
      </div>
      {/* 7. One row of actions, outside the scrolling body so it is never cut off. */}
      {!pinned ? null : (
        <div className="space-y-1" data-testid="lane-inspector-actions">
          <div className="flex flex-wrap items-center gap-1" role="group" aria-label={BOX_WORDS.actions}>
            {option && c.status === null ? <CommitToThisButton option={c.id} /> : null}
            {ask === null ? null : <button type="button" data-testid="inspector-ask" onClick={ask} className={VIEW_CHIP_CLASS}><OkIcon id="ask-about-this" size={14} decorative inherit />{INSPECTOR_WORDS.ask}</button>}
            {!canTry ? null : <button type="button" data-testid="inspector-what-if" onClick={() => { openWhatIf(c.id); close() }} className={VIEW_CHIP_CLASS}><OkIcon id="what-if" size={14} decorative inherit />{INSPECTOR_WORDS.whatIf}</button>}
            {rows.length === 0 ? null : <OkIconButton id="more" size={14} tone="ghost" className="focus-visible:ring-text-header" pressed={more} onClick={() => setMore((m) => !m)} testid="lane-inspector-more" />}
          </div>
          {more && rows.length > 0 ? <div className="flex flex-wrap gap-1" role="group" aria-label={BOX_WORDS.edit}>{rows.map(chip)}</div> : null}
        </div>
      )}
    </aside>
  )
}

/** The older look (off the lane): the details panel at its fixed corner, one scrolling box, with its own figure field and form buttons, as before. */
function OlderInspector({ range }: { range?: Range }): JSX.Element | null {
  const target = useLaneInspector(detailsOf), close = useLaneInspector((s) => s.close)
  const view = useViewStore((s) => s.view)
  const showToast = useShowToast()
  const ctx = useLaneCtx({ showToast, onClose: NOOP, openForm: openFormHere })
  const model = view?.model ?? null
  const card = target?.kind === 'card' ? model?.cards.find((c) => c.id === target.id) ?? null : null
  const link = useCanvasStore((s) => target?.kind === 'link' ? viewLinkDataOf(s.edges.find((e) => e.id === target.id))?.link ?? null : null)
  useEffect(() => { if (target !== null && card === null && link === null) close() }, [target, card, link, close])
  // The "Your figure" field below carries its own "Change figure" button, so the edit row for it is not drawn as well (said once).
  const figureField = card?.figure?.edit != null && !isSizeEdit(card.figure.edit)
  const rows = useMemo(() => (card !== null ? cardEditRows(card, ctx) : link !== null ? linkEditRows(link, ctx, target!.id) : []).filter((r) => !(figureField && r.id === 'change-figure')), [card, link, ctx, figureField, target?.id])
  if (target === null || (card === null && link === null)) return null
  const title = card !== null ? card.heading : link!.title
  const node = card === null ? undefined : useCanvasStore.getState().nodes.find((n) => n.id === card.id)
  const ask = node === undefined ? null : () => ctx.act.ask({ kind: 'node', nodeId: node.id, nodeType: node.type as NodeTarget['nodeType'], node, screenPos: { x: 0, y: 0 } }, 'explain_element')
  return (
    <aside role="complementary" aria-label="Details" data-testid="lane-inspector" data-kind={target.kind}
      className={`nodrag nopan fixed left-[76px] top-[112px] ${CANVAS_LAYER_CLASS.sheet} max-h-[60vh] w-[280px] space-y-2 overflow-y-auto rounded-lg border border-panel-border bg-panel p-3 shadow-2 ${typography.viewPanelBody}`}>
      <div className="flex items-start justify-between gap-2">
        <h2 className={`${typography.viewPanelBody} min-w-0 break-words text-text-header`} data-testid="lane-inspector-title">{title}</h2>
        <button type="button" aria-label="Close details" onClick={() => close()} className={`${controls.chipIcon} grid flex-none cursor-pointer place-items-center text-text-light hover:bg-panel-hover`}><OkIcon id="cancel-close" decorative inherit /></button>
      </div>
      {card === null ? null : (
        <>
          {card.detail === '' ? null : <p className="text-text-body" data-testid="lane-inspector-detail">{card.detail}</p>}
          {card.figure === null ? null : <Hover as="p" className="text-text-body" words={card.figure.title} data-testid="lane-inspector-figure">{card.figure.text}</Hover>}
          {card.olumi === null ? null : <p className={`${typography.viewPanelMeta} text-info`} data-testid="lane-inspector-source"><span aria-hidden="true">{card.olumi.glyph} </span>{card.olumi.title}</p>}
          {card.status === null ? null : <p className={`${typography.viewPanelMeta} text-text-light`}>{card.status}</p>}
          <FigureInspector card={card} range={range} onAsk={ask} onClose={() => close()} />
        </>
      )}
      {link === null ? null : (
        <>
          {link.size === undefined ? null : <Hover as="p" className="text-text-body" words={link.size.title} data-testid="lane-inspector-strength">{link.size.text}</Hover>}
          {link.causal?.author == null ? null : <Hover as="p" className={`${typography.viewPanelMeta} text-text-light`} words={link.causal.author.title} data-testid="lane-inspector-source">{link.causal.author.text}</Hover>}
        </>
      )}
      {rows.length === 0 ? null : (
        <div className="flex flex-wrap gap-1 pt-1" role="group" aria-label="Edit">
          {rows.map((r) => (
            <HoverButton key={r.id} type="button" disabled={!r.enabled} words={r.enabled ? r.tooltip : (r.disabledReason ?? r.tooltip)} data-testid={`lane-inspector-${r.id}`} onClick={r.enabled ? r.action : undefined}
              className={`${controls.chipText} cursor-pointer border border-panel-border text-text-body hover:bg-panel-hover`}>{r.label}</HoverButton>
          ))}
        </div>
      )}
    </aside>
  )
}
