/**
 * SPIKE (UI restore, 11 Nov 2026; Paul: "having the previous UI but plugged into the alpha data model"). A CORE CARD ON THE PREVIOUS
 * PRODUCT'S CARD FRAME. The frame is the previous product's own (`BaseNode`: its box, kind mark, title, level-of-detail line, corner marks,
 * selection and handles). The BODY is core's View card, core's words verbatim: the previous cards' own bodies (FactorNode, OptionNode,
 * GoalNode, DecisionNode) read the previous data model and say things about it ("Needs input · Value not set yet", "No changes specified")
 * that are not true of a core model, so they are not mounted on this lane.
 *
 * Rulings applied here (output/ui-restore-20261111/RULINGS.md): an empty slot is silent unless core sends its own words for the gap; an
 * option's headline is core's chance of meeting the goal, verbatim; an outcome shows each option's worked-out value once; an aim or limit
 * shows its bound; only Olumi's cards say who they are from, in Olumi's blue; dashes mean core doubts it or it is proposed.
 * Nothing here formats, rounds, orders or works out a value.
 */
import { memo, useMemo } from 'react'
import type { NodeProps } from '@xyflow/react'
import { BaseNode } from '../../canvas/nodes/BaseNode'
import { NODE_REGISTRY, type NodeType } from '../../canvas/domain/nodes'
import { typography } from '../../styles/typography'
import type { ViewCard } from '../client'
import { CARD_WIDTH, drawKindOf, QUESTION, readingOf } from '../layout'
import { useViewStore } from '../store'
import { useDriverOf, usePreMortemOf, useRestsOnItem, useTriedOn, useTryOn } from '../lens'
import { failedOf, failedReasonOf } from '../k5'
import { clearWhatIf } from '../whatif'
import { WHAT_IF_COPY } from '../../canvas/artefacts/whatIfCopy'
import { ViewDriverBadge, ViewValuesBand } from '../v10'
import { CardEvidenceMarks, CardViewChips, CardViewInitials, OptionMarkLine } from '../RevealMarks'
import { StrategyChips } from '../strategy/StrategyChips'
import { FigureEdit, HeldEditOffer, useOpenFigureEdits } from '../FigureEdit'
import { Badge } from '../Badge'
import { StatedFigure } from '../StatedFigure'
import { nodeColors } from '../../canvas/nodes/colors'
import { isWorkedOut, WorkedSteps } from '../look/WorkedSteps'
import { targetCardOf } from '../model/targets'

/** One of core's marks (its glyph), with core's words for it as its hover and its accessible name: never a bare glyph. */
const Glyph = ({ at, mark, className = '' }: { at: string; mark: { glyph: string; title: string } | null | undefined; className?: string }) => (
  mark == null ? null : <span role="img" aria-label={mark.title} title={mark.title} className={className} data-view={`${at}.glyph`}>{mark.glyph}</span>
)

/**
 * What the retired card said only when opened (its aside: a person's author, a route's own line, its reason, an option's status). The face is
 * the same at rest, hovered and opened (DL 9 Nov), so on this card they are the body's hover, after core's detail. Core's words, verbatim.
 */
export function openedWordsOf(card: ViewCard): string[] {
  const theirs = card.author != null && card.author.by !== 'olumi' ? card.author : null
  return [
    theirs === null ? null : theirs.title === '' ? theirs.text : `${theirs.text} · ${theirs.title}`,
    card.family === 'option' ? card.face?.line?.text ?? null : null,
    card.status ?? null,
    card.figure === null && card.rows.length === 0 ? null : card.reason ?? null,
  ].filter((x): x is string => x != null && x !== '')
}

/**
 * ORDER-UI-HOVER (DL, 13 Nov; Codex PL-851): the hover's Value line, in core's words only, in this order:
 *  1. core's figure words, with that figure's own attribution: Olumi's mark where core marks the figure Olumi's estimate on a card that is not
 *     Olumi's (as the face draws it, `estimate`), else the card's author line, which on a quantity says whose the figure is;
 *  2. else core's BOUND words (a goal's "at most 2 months") with that bound's own Olumi mark; with no bound-specific attribution the source is
 *     absent: never the goal's or card's author, which says whose the AIM is (a colleague can set a target on someone else's aim);
 *  3. else, for a quantity core sends with an empty figure, core's own state line for it ("Olumi's question, not yet sized");
 *  4. else null: no Value row (never "Not on record", which core never says).
 */
export function coreHoverValueOf(card: ViewCard): { text: string; source: string | null } | null {
  const fig = card.figure?.text ?? ''
  if (fig !== '') {
    const olumisFigure = card.family === 'quantity' && card.olumi !== null && card.author?.by !== 'olumi'
    return { text: fig, source: olumisFigure ? card.olumi!.title : card.author?.text ?? null }
  }
  const bound = card.bound?.text ?? ''
  if (bound !== '') return { text: bound, source: card.bound?.olumi?.title ?? null }
  const state = card.figure != null ? card.author?.text ?? '' : ''
  return state === '' ? null : { text: state, source: null }
}

/** The one line beneath the name when zoomed out, and the body's lead line: core's own words for this card, the first it sends of these. */
export function leadLineOf(card: ViewCard): string | null {
  if (card.family === 'option') {
    // RULING 7: the chance of meeting the goal, core's words. Where core withholds it, core's own first line saying so, never a blank and
    // never a figure of the UI's.
    if (card.headline != null) return card.headline.text
    const first = card.rows[0]
    return first !== undefined && first.kind === 'none' ? first.text : null
  }
  const perOption = (card.values?.length ?? 0) > 1
  if (card.figure !== null && card.figure.text !== '' && !perOption) return card.figure.text
  if (card.bound != null) return card.bound.text
  if (perOption) return null
  return card.face?.line?.text ?? null
}

/** The one line beneath the name on the zoomed-out face: the lead line, or for a figure worked out per option core's own line of them all
 *  (the reduced face shows less of it, and the notice says so). */
export function farLineOf(card: ViewCard): string | null {
  const chance = farChanceOf(card)
  if (chance !== null) return chance
  return leadLineOf(card) ?? (card.figure !== null && card.figure.text !== '' ? card.figure.text : null)
}

/**
 * DL-424 (13 Nov, 1128 whole board): on the one-line far face a chance is never cut mid-word ("about 3% chance, on Ol…"). Core makes the chance
 * line in one place (core src/view/run-lines.ts chanceFace: `${bare} chance` then its clauses, each after ", "): the far line is core's chance
 * words up to the first of those clauses, whole; what it rests on is the far mark beside it (`farMarkOf`) and core's full sentence is on the
 * hover and the opened card. A line that is not in that shape is drawn as core sent it. No words of the UI's own.
 */
export function farChanceOf(card: ViewCard): string | null {
  if (card.family !== 'option' || card.headline?.state !== 'chance') return null
  const t = card.headline.text, cut = t.indexOf(', ')
  return cut > 0 && t.slice(0, cut).endsWith(' chance') ? t.slice(0, cut) : null
}

/** The far face's Olumi mark for a chance resting on Olumi's assumption (DL-424): core's own glyph for Olumi's figure it rests on (that card's
 *  `olumi.glyph`), titled with core's full sentence for the chance. Null where the line is whole or nothing of Olumi's is rested on. */
export function farMarkOf(card: ViewCard, cards: readonly ViewCard[]): { glyph: string; title: string } | null {
  if (farChanceOf(card) === null || card.headline == null) return null
  const glyph = (card.rests_on ?? []).filter((r) => r.whose === 'olumi').map((r) => cards.find((c) => c.id === r.id)?.olumi?.glyph).find((g) => g != null && g !== '')
  return glyph === undefined ? null : { glyph, title: card.headline.title }
}

/** The hover that goes with `leadLineOf`: core's own title for the same thing (the goal, conditions and precision behind a chance; the bound's and
 *  the figure's own), verbatim. Null where core sends none. */
export function leadTitleOf(card: ViewCard): string | null {
  if (card.family === 'option') return card.headline != null && card.headline.title !== '' ? card.headline.title : null
  const perOption = (card.values?.length ?? 0) > 1
  if (card.figure !== null && card.figure.text !== '' && !perOption) return card.figure.title !== '' ? card.figure.title : null
  if (card.bound != null) return card.bound.title !== '' ? card.bound.title : null
  return null
}


/** The family the board's skin draws in the card's border and mark (olumiLook.css): an option, a figure, an aim or limit, or other. */
export function familyOf(card: ViewCard): 'option' | 'factor' | 'aim' | 'other' {
  if (card.family === 'option') return 'option'
  if (card.bound != null || card.family === 'goal' || card.family === 'limit') return 'aim'
  if (card.family === 'quantity') return 'factor'
  return 'other'
}

function CoreCardImpl(props: NodeProps): JSX.Element {
  const id = props.id
  const model = useViewStore((s) => s.view?.model ?? null)
  // The card is the one the node carries (canvas.ts drawViewCanvas: core's own card, never a copy), else the View's: one snapshot with the node.
  const carried = (props.data as { card?: ViewCard }).card
  const card = id === QUESTION ? null : carried ?? model?.cards.find((c) => c.id === id) ?? null
  // On the lane's own canvas the node carries core's card or question (canvas.ts drawViewCanvas), no kind: the kind is the one the board
  // draws it as (layout.ts drawKindOf), the name core's heading or question, and the width the one the lane's layout placed it at.
  const hosted = (props.data as { kind?: string }).kind === undefined
  const kind = ((props.data as { kind?: string }).kind ?? (id === QUESTION ? 'decision' : card !== null && model !== null ? drawKindOf(card, model) : 'factor')) as NodeType
  const width = (props.data as { width?: number }).width
  const label = id === QUESTION ? model?.question.text ?? '' : card?.heading ?? ''
  // Core's face title (FL1: the person's words, Olumi's caption, or the name), as the retired card drew it; the heading stays the card's
  // accessible name and its quick actions' label (`label`). Where core sends none, or the same words, the heading.
  const faceTitle = card?.face?.title?.text ?? ''
  const titleOverride = faceTitle !== '' && faceTitle !== label ? faceTitle : undefined
  const question = id === QUESTION ? model?.question ?? null : null
  const coreValue = card === null ? null : coreHoverValueOf(card)
  const data = useMemo(() => (hosted ? { ...props.data, label, kind, type: kind, core: true, coreValue } : props.data), [hosted, props.data, label, kind, coreValue?.text, coreValue?.source])
  const headingOf = (option: string): string => model?.cards.find((c) => c.id === option)?.heading ?? ''
  const lead = card === null ? null : leadLineOf(card)
  const farMark = card === null ? null : farMarkOf(card, model?.cards ?? [])
  const olumi = card?.author?.by === 'olumi'
  // The frame says three things, each on its own channel, as the retired cards did: dashes only where core doubts it; Olumi's blue where
  // Olumi proposes it (the card, or the question); core's orange where it is challenged (RULING 6's link rule, on the card).
  const proposed = card?.change != null || question?.proposed === true
  // DL ruling (12 Nov, A13d): one meaning everywhere: dashed = provisional (core doubts it, or Olumi proposes it and it is not yet the
  // person's), solid = settled or the person's own. The card's words already say which ("Proposed by Olumi", "not yet sized").
  const doubt = card?.doubt === true || (card?.change != null && card.author?.by === 'olumi'), challenged = card?.challenged === true
  const frame = doubt || proposed || challenged
    ? `${challenged ? 'border-[var(--olumi-mark-orange)]' : proposed ? 'border-info' : (nodeColors[kind as keyof typeof nodeColors] ?? nodeColors.factor).frame} ${doubt ? 'border-dashed' : ''}`
    : undefined
  // The lenses mark the cards they are about (RULING 5): the Rests on number, in Olumi's blue where core marks the figure Olumi's; the
  // ring of What would change. Both are core's (lens.ts); null off those lenses.
  const restsOn = useRestsOnItem(id), driverOf = useDriverOf(id)
  // If it failed (K5): the cards Olumi's stories rest on stand in front, the rest recede; What if (TM-27): the figure tried, on its card.
  const preMortem = usePreMortemOf(id), tried = useTriedOn(id)
  const tryOn = useTryOn(card)
  const versionN = useViewStore((s) => s.view?.version?.n ?? null)
  const viewNow = useViewStore((s) => s.view)
  // The figure's own edit (R25, as the lane's card): wherever core offers one, the ✎ is on the figure's line, and core takes the figure
  // through its own route as the person's. While a proposal is held core offers none; the ✎ then offers to set the proposal aside first.
  const keptEdit = useOpenFigureEdits((o) => o.open.get(id) ?? null)
  const estimate = card?.family === 'quantity' && card.olumi !== null && card.figure !== null
  // The reading of this aim over its window (R19, DL P1 10 Nov: said once, on the aim's own card), and the core marks on the face.
  const reading = card === null || model === null ? null : readingOf(model, id)
  const edit = card === null || card.figure === null ? null : card.figure.edit ?? keptEdit
  const restsInk = restsOn === null ? '' : restsOn.olumi ? 'border-info text-info' : 'border-text-light text-text-body'
  // G3 (Paul's "do now", 11 Nov): zoomed out the body is blanked and only the far line shows, so the Rests on number is also drawn beside the
  // far line (BaseNode `lodMark`), at the line's own counter-scaled size; the lens then marks its cards on the whole-board first open too.
  // Core's badge: the records it folded behind this card or the question ("Show 6 notes behind this"), its face words verbatim; pressing
  // it opens them (Badge.tsx). The retired ViewCardNode and ViewQuestionNode drew it; this card did not, so on the lane every fold was
  // unseen (Paul's A11 board, 12 Nov: the question held his "1.3 million", the 12-month runway and two challenges, none on the board).
  const badge = id === QUESTION ? model?.question.badge ?? null : card?.badge ?? null
  // Core's change mark (+ added, ↻ changed), its words for the change on hover: at the end of a line the card already draws (Olumi's
  // author line, else the lead line, else the badge's), never a row of its own (DL, A13d: on a pending first model every card is an
  // addition, and its "+" took a row on all of them).
  const changeMark = card?.change == null ? null : <>{' '}<Glyph at={`${id}.change`} mark={card.change} className="text-info" /></>
  const changeOn = changeMark === null ? null : olumi ? 'author' : lead !== null ? 'lead' : badge !== null ? 'badge' : 'band'
  const badgeLine = badge === null ? null
    : <p className="ok-count" data-core-badge={id}><Badge cardId={id} badge={badge} at={id === QUESTION ? 'question' : id} />{changeOn === 'badge' ? changeMark : null}</p>
  // The question's date (core's `decide_by`): its words, core's hover, Olumi's blue where Olumi set it.
  const decideBy = question?.decide_by == null ? null
    : <p className={`${typography.nodeLabel} ${question.decide_by.olumi ? 'text-info' : 'text-text-body'}`} title={question.decide_by.title} data-olumi={question.decide_by.olumi || undefined} data-view="question.decide_by.text">{question.decide_by.text}</p>
  // The figure's ✎ (R25): on the figure's own line, as the retired card drew it. A figure with no value yet (Olumi's question, not yet
  // sized) has no line of its own, so the ✎ sits at the end of Olumi's author line; only where neither exists does it take a row (DL-183:
  // "a stray pencil glyph on a row of its own").
  const editCue = card === null || card.figure === null ? null : edit !== null
    ? <span className="nodrag inline-flex align-middle" data-figure-edit-wrap=""><FigureEdit id={id} edit={edit} glyph="✎" label={estimate ? 'Give yours' : 'Change figure'} words={false} /></span>
    : card.change?.kind !== 'added' && kind !== 'outcome'
      ? <span className="nodrag inline-flex align-middle" data-figure-edit-wrap=""><HeldEditOffer id={id} label={estimate ? 'Give yours' : 'Change figure'} /></span> : null
  const cueOnLead = editCue !== null && card !== null && lead !== null && lead === card.figure?.text
  const cueOnAuthor = editCue !== null && !cueOnLead && olumi
  // The figure tried on a copy, as the person typed it, on the card's corner (out of flow, no card moves), where it is not drawn in place.
  const triedMark = tried === null || tryOn?.kind === 'tried' ? null
    : <span className={`max-w-[180px] truncate rounded border border-info bg-panel px-2 py-0.5 text-text-header ${typography.nodeLabel}`} title={tried} data-whatif-mark={id}>{WHAT_IF_COPY.whatIf}: {tried}</span>
  const restsFar = restsOn === null ? null
    : <span className={`inline-flex flex-none items-center justify-center rounded-full border bg-panel px-1 !leading-tight tabular-nums ${typography.nodeLabel} ${restsInk}`} title={restsOn.olumi && card?.olumi ? card.olumi.title : undefined} data-rests-on={restsOn.n} data-rests-on-far="">{restsOn.n}</span>
  // THE FACE (DL-529, the component sheet's nine faces), core's words verbatim; nothing formatted, rounded or worked out here.
  //  - an option: its headline as the View serves it: a chance (core's words up to its own first clause as the one headline, the clause
  //    under it), a fixed result said as fixed, or no chance yet (core's words as a quiet pill, "Why not" opening core's reason, and core's
  //    ONE next step, `headline.add`, in the next-step slot);
  //  - a figure: Olumi's estimate underlined in Olumi's blue, the person's solid, ✎ on its line; each option's value as quiet status lines;
  //  - an aim or limit: its target with core's mark; whose the target and the aim are, on the foot;
  //  - anything else: core's line, three lines at most, whole on hover.
  // DL-529 slice (3): an option's LIMITS, drawn in the same structure as its aim's headline, from core's rows for every aim but the one the
  // headline is about (rows[].aim_id): a worked-out value (core's row value, its marks, its title on hover); not worked out (core's reason
  // behind "Why not", and core's question for the figure it waits on as the one next step). Core sends a limit no short state words of its
  // own (the aim's "No chance yet"), so none are made up here; named in the channel with DL-525's unification.
  const limitsOf = (): JSX.Element | null => {
    if (card === null || card.family !== 'option') return null
    const aim = card.headline?.aim_id ?? null
    const rows = card.rows.map((r, i) => ({ r: r as { kind: string; aim_id?: string | null; aim?: string; value?: string | null; title?: string; text?: string | null; question?: string | null; olumi?: { glyph: string; title: string } | null }, i }))
      .filter(({ r }) => r.aim_id != null && r.aim_id !== aim)
    if (rows.length === 0) return null
    const nameOf = (aid: string) => model?.cards.find((c) => c.id === aid)?.heading ?? aid
    return (
      <div className="ok-limits" data-view={`${id}.limits`}>
        {rows.map(({ r, i }) => r.kind === 'none' ? (
          <div key={i} className="ok-limit" data-view={`${id}.rows.${i}`} data-ok-limit={r.aim_id!} title={r.title}>
            <span className="ok-limit-name">{nameOf(r.aim_id!)}</span>
            {r.text == null || r.text === '' ? null : <details className="ok-why nodrag" data-view={`${id}.rows.${i}.why`}><summary>Why not</summary><p>{r.text}</p></details>}
            {r.question == null || r.question === '' ? null : <p className="ok-next" title={r.question} data-view={`${id}.rows.${i}.question`}>{r.question}</p>}
          </div>
        ) : (
          <p key={i} className="ok-limit" data-view={`${id}.rows.${i}`} data-ok-limit={r.aim_id!} title={r.title}>
            <span className="ok-limit-name">{r.aim ?? nameOf(r.aim_id!)}</span>{' '}<b data-view={`${id}.rows.${i}.value`}>{r.value}</b>
            {r.olumi == null ? null : <Glyph at={`${id}.rows.${i}.olumi`} mark={r.olumi} className="ok-mark" />}
          </p>
        ))}
      </div>
    )
  }
  const faceOf = (): JSX.Element | null => {
    if (card === null || lead === null) return null
    const hover = [lead, leadTitleOf(card), estimate && lead === card.figure?.text ? card.olumi!.title : null].filter((x) => x != null && x !== '').join(' · ') || undefined
    const trail = <>{changeOn === 'lead' ? changeMark : null}{cueOnLead ? <>{' '}{editCue}</> : null}</>
    const h = card.family === 'option' ? card.headline ?? null : null
    if (h !== null && h.state === 'chance') {
      const head = farChanceOf(card), qual = head === null ? null : h.text.slice(head.length + 2)
      const row = card.rows.find((r) => r.kind === 'chance' && r.aim_id === h.aim_id) as { likely?: { glyph: string; title: string } | null; olumi?: { glyph: string; title: string } | null; chance?: number | null } | undefined
      const at = typeof row?.chance === 'number' && row.chance >= 0 && row.chance <= 1 ? row.chance : null
      return (
        <div data-core-lead={id} data-ok-face="chance" title={hover}>
          <p className="ok-chance line-clamp-3"><span data-core-lead-clamp={id}>{head ?? h.text}</span>
            {row?.likely == null ? null : <Glyph at={`${id}.likely`} mark={row.likely} className="ok-mark" />}
            {row?.olumi == null ? null : <Glyph at={`${id}.row.olumi`} mark={row.olumi} className="ok-mark" />}{trail}</p>
          {at === null ? null : <span className="ok-track" aria-hidden="true" data-view={`${id}.chance.track`}><span style={{ width: `${at * 100}%` }} /></span>}
          {qual === null || qual === '' ? null : <p className="ok-qual" title={qual} data-view={`${id}.headline.qualifier`}>{qual}</p>}
          {h.add == null ? null : <p className="ok-next ok-next-card" title={h.add} data-view={`${id}.headline.add`}>{h.add}</p>}
        </div>
      )
    }
    if (h !== null && h.state === 'fixed') return (
      <div data-core-lead={id} data-ok-face="fixed" title={hover}><p className="ok-fixed line-clamp-3"><span data-core-lead-clamp={id}>{h.text}</span>{trail}</p></div>
    )
    if (h !== null && h.state === 'none') return (
      <div data-core-lead={id} data-ok-face="none" title={hover} className="flex flex-col gap-1">
        <div className="ok-row">
          <span className="ok-pill" title={h.title}><span className="line-clamp-3" data-core-lead-clamp={id}>{h.text}</span>{trail}</span>
          {h.why == null || h.why === '' ? null : <details className="ok-why nodrag nowheel" data-view={`${id}.headline.why`}><summary>Why not</summary><p>{h.why}</p></details>}
        </div>
        {h.add == null || h.add === '' ? null : <p className="ok-next ok-next-card" title={h.add} data-view={`${id}.headline.add`}>{h.add}</p>}
      </div>
    )
    // A figure worked out from others (a relation link into it) is a result or a wait, never the card's own headline figure: a quiet status
    // line, core's words (the sheet's "worked out but waiting"); the person's and Olumi's own figures keep the headline figure.
    if (card.figure !== null && lead === card.figure.text && viewNow !== null && isWorkedOut(viewNow, id)) return (
      <div data-core-lead={id} data-ok-face="worked" title={hover}>
        <p className="ok-status line-clamp-3"><span data-core-lead-clamp={id}>{lead}</span>{trail}</p>
      </div>
    )
    if (card.figure !== null && lead === card.figure.text) return (
      <div data-core-lead={id} data-ok-face="figure" title={hover}>
        <p className="line-clamp-3"><span className={`ok-fig ${estimate || olumi ? 'ok-fig-olumi' : ''}`} data-core-lead-clamp={id}>{lead}</span>
          {estimate && !olumi ? <Glyph at={`${id}.olumi`} mark={card.olumi} className="ok-mark" /> : null}{trail}</p>
      </div>
    )
    if (card.bound != null && lead === card.bound.text) {
      // DL 06:57Z (1): the aim's question ("What target would you set …?", core's bound) opens its target figure's own editor, found by
      // core's `target` line (targets.ts), the same editor and the same write as the target card's ✎; nothing where core offers no edit.
      const target = model === null || model.edit_base === null ? null : targetCardOf(model, card)
      const words = <span data-core-lead-clamp={id}>{lead}</span>
      return (
        <div data-core-lead={id} data-ok-face="target" title={hover} className={target === null ? undefined : 'relative'}>
          {target === null
            ? <p className="ok-target line-clamp-3">{words}{' '}<Glyph at={`${id}.bound.olumi`} mark={card.bound.olumi} className="ok-mark" />{trail}</p>
            : <div className="ok-target line-clamp-3"><FigureEdit id={target.id} edit={target.figure!.edit ?? null} place="view-aim" opener={words} />{' '}<Glyph at={`${id}.bound.olumi`} mark={card.bound.olumi} className="ok-mark" />{trail}</div>}
        </div>
      )
    }
    return (
      <div data-core-lead={id} data-ok-face="line" title={hover} className="ok-by">
        <span className="line-clamp-3" data-core-lead-clamp={id}>{lead}</span>{trail}
      </div>
    )
  }
  return (
    // The wrapper takes no box (`contents`) unless the If it failed lens recedes this card: no card moves, its handles and ring unchanged.
    <div className={preMortem === 'other' ? 'opacity-40 transition-opacity' : 'contents'} data-premortem={preMortem ?? undefined}>
    <BaseNode {...props} data={data} maxWidth={hosted ? (id === QUESTION ? width : width ?? CARD_WIDTH) : undefined} nodeType={kind} icon={NODE_REGISTRY[kind].icon} incompleteStatedOnCard lodMetric={card === null ? null : farLineOf(card)} cornerSlot={card !== null && card.driver != null ? <ViewDriverBadge card={card} /> : triedMark ?? undefined}
      lodMark={farMark === null ? restsFar : <>{restsFar}<Glyph at={`${id}.far.olumi`} mark={farMark} className={`${typography.nodeLabel} !leading-tight text-info shrink-0`} /></>}
      titleOverride={titleOverride} borderClassOverride={frame}>
      {card === null ? <div className="ok-face" data-ok-family="question">{decideBy}{badgeLine}</div> : (
        <div className={`ok-face ${driverOf !== null ? 'rounded ring-2 ring-text-header ring-offset-4' : ''}`} data-core-card={id} data-ok-family={familyOf(card)} title={driverOf !== null ? driverOf.map((o) => o.driver!.title).join('\n') : [card.figure !== null && card.figure.text === '' && card.figure.title !== '' ? `${card.figure.title} · ${card.detail}` : card.detail, ...openedWordsOf(card)].join('\n')} data-driver-of={driverOf === null ? undefined : ''}>
          {restsOn === null ? null : <span className={`inline-flex h-[18px] min-w-[18px] items-center justify-center self-start rounded-full border bg-panel px-1 tabular-nums ${typography.nodeLabel} ${restsInk}`} title={restsOn.olumi && card.olumi ? card.olumi.title : undefined} data-rests-on={restsOn.n}>{restsOn.n}</span>}
          {faceOf()}
          {limitsOf()}
          {reading === null ? null : <p className={`ok-qual ${reading.source === 'proposal' ? 'ok-by-olumi' : ''}`} title={reading.text} data-reading={reading.source} data-view={`${id}.reading`}>{reading.text}</p>}
          {(card.values?.length ?? 0) > 1 ? <>
            <StatedFigure id={id} card={card} />
            {card.values!.map((v, i) => (
              <p key={v.option} className="ok-status" data-core-value={`${id}.${v.option}`}>
                <span>{headingOf(v.option)}</span> <b data-view={`${id}.values.${i}.text`}>{v.text}</b>
                {v.if_approved == null ? null : <>{' '}<Glyph at={`${id}.values.${i}.if_approved`} mark={v.if_approved} /></>}
              </p>
            ))}
          </> : null}
          {/* Core's honesty line (card.unused): a figure Olumi's analysis does not use yet says so, once, under it, in core's words. */}
          {card.unused == null || card.unused === '' ? null : <p className="ok-qual" data-view={`${id}.unused`}>{card.unused}</p>}
          {tryOn?.kind !== 'tried' ? null : (
            // TM-27: the figure tried, as the person typed it, in place on its card (core's words for the edit on hover); core's own sentence
            // when the copy could not run; and the way back, which drops the try (nothing was saved). The person's act: ink, never Olumi's blue.
            <div className="nodrag grid gap-1 rounded-lg bg-panel-hover px-2 py-1.5" data-card-try={id}>
              <p className={`${typography.nodeValue} font-semibold text-text-header`} title={tryOn.words}>{WHAT_IF_COPY.trying(tryOn.typed)}</p>
              {tryOn.said === null ? null : <p className={`${typography.nodeLabel} text-text-body`} data-card-try-said={id}>{tryOn.said}</p>}
              <button type="button" onClick={clearWhatIf} data-testid={`card-try-back-${id}`}
                className={`${typography.nodeLabel} inline-flex min-h-[24px] w-fit cursor-pointer items-center text-text-body underline underline-offset-2 hover:text-text-header`}>{WHAT_IF_COPY.back(versionN)}</button>
            </div>
          )}
          {tryOn?.kind !== 'option' ? null : (
            // TM-27: the try's chance for this option under its saved one, in core's row words; core's words for the edit and the row on hover.
            <p className={`${typography.nodeLabel} text-text-body`} title={`${tryOn.words}\n${tryOn.row.title}`} data-option-try={id}>
              {WHAT_IF_COPY.whatIf}: <span className="font-semibold text-text-header" data-view={`whatif.${id}.chance`}>{tryOn.row.value}</span>
            </p>
          )}
          {card.family === 'option' ? <OptionMarkLine card={id} /> : <ViewValuesBand card={card} />}
          {/* The team's revealed views, its evidence and core's strategy mark on the card they are about (./RevealMarks, ./strategy). */}
          <span className="flex flex-wrap items-center gap-1 empty:hidden">
            {/* Core's change mark, here only where no other line can carry it (changeOn, above). */}
            {changeOn === 'band' ? changeMark : null}
            {card.committed == null ? null : <span className={`${typography.nodeLabel} text-text-light`} title={`Committed by: ${card.committed.by} · ${card.committed.at}`} data-committed={id}>Committed by: <span data-view={`${id}.committed.by`}>{card.committed.by}</span></span>}
            {/* K5 If it failed: one mark per Olumi failure story resting on this card, core's number with Olumi's glyph, the story on hover; on an
                option, the story most within the team's control, in core's words. All Olumi's (../k5.ts). */}
            {failedOf(card).map((f, j) => (
              <span key={`f${f.n}`} className={`${typography.nodeLabel} text-info`} title={`${f.olumi.title} · ${f.title}`} aria-label={`${f.olumi.title} · ${f.title}`} data-failed={`${id}.${f.n}`}>
                <span data-view={`${id}.failed.${j}.olumi.glyph`}>{f.olumi.glyph}</span>{f.n}
              </span>
            ))}
            {(() => { const r = failedReasonOf(card); return r === null ? null : (
              <span className={`${typography.nodeLabel} text-info`} title={`${r.olumi.title} · ${r.title}`} aria-label={`${r.olumi.title} · ${r.text} · ${r.title}`} data-failed-reason={id}>
                <span data-view={`${id}.failed_reason.olumi.glyph`}>{r.olumi.glyph}</span> <span data-view={`${id}.failed_reason.text`}>{r.text}</span>
              </span>
            ) })()}
            <CardViewInitials card={id} /><CardEvidenceMarks card={id} /><CardViewChips card={id} /><StrategyChips card={id} /></span>
          {/* A figure with no value takes no row (DL 10 Nov, as ViewCardNode: core's words for it are `figure.title` and `detail`, the hover). */}
          {editCue === null || cueOnLead || cueOnAuthor ? null : <span className="self-start">{editCue}</span>}
          {/* Whose it is, at the card's foot (the sheet): first-class marks, never hover-only. A target Olumi proposed says so on the face, the
              figure Olumi estimated says so, and the card's own author line (Olumi's in its blue, the person's in body ink); then the count. */}
          <div className="ok-foot">

            <div className="ok-row">
              {card.bound?.olumi == null ? null : <p className="ok-by ok-by-olumi" data-view={`${id}.bound.olumi.title`}><Glyph at={`${id}.bound.foot`} mark={card.bound.olumi} /> {card.bound.olumi.title}</p>}
              {olumi ? <div className="ok-by ok-by-olumi" data-core-author={id}><span title={card.author!.title}>{card.olumi?.glyph ? `${card.olumi.glyph} ` : ''}{card.author!.text}</span>{changeOn === 'author' ? changeMark : null}{cueOnAuthor ? <>{' '}{editCue}</> : null}</div>
              : card.author != null && card.author.text !== '' ? <p className="ok-by" data-core-author={id} title={card.author.title || undefined}>{card.author.text}</p> : null}
              {badgeLine}{viewNow === null ? null : <WorkedSteps view={viewNow} id={id} />}</div>
          </div>
        </div>
      )}
    </BaseNode>
    </div>
  )
}
export const CoreCard = memo(CoreCardImpl)
