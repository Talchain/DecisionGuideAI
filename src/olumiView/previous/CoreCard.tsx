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
import { History } from 'lucide-react'
import { earlierResultsOf } from '../v12/contract'
import { FindingLine } from '../FindingLine'
import { memo, useMemo, type CSSProperties } from 'react'
import { isForThisPage, useMe } from '../../olumiCore/me'
import type { NodeProps } from '@xyflow/react'
import { BaseNode } from '../../canvas/nodes/BaseNode'
import { NODE_REGISTRY, type NodeType } from '../../canvas/domain/nodes'
import { typography } from '../../styles/typography'
import type { ViewCard } from '../client'
import { CARD_WIDTH, chatQuestionsOf, drawKindOf, QUESTION, readingOf } from '../layout'
import { useViewStore } from '../store'
import { useDriverOf, usePreMortemOf, useRestsOnItem, useTriedOn, useTryOn } from '../lens'
import { failedOf, failedReasonOf } from '../k5'
import { clearWhatIf } from '../whatif'
import { ChanceBand, RestsShareFill } from '../ResultBand'
import { WHAT_IF_COPY } from '../../canvas/artefacts/whatIfCopy'
import { ViewDriverBadge } from '../v10'
import { CardEvidenceMarks, CardViewChips, CardViewInitials, OptionMarkLine } from '../RevealMarks'
import { AimResults, AimRows, BadgeCount, DecideBy, hasSpread, RowWords, SaidOnce, UnusedMark } from '../v12/detailed/marks'
import { Rail, Strips } from '../v12/detailed/charts'
import { saidOnceOf, saysNoChanceOnce, sharedRowStates } from '../v12/detailed/said'
import { StrategyChips } from '../strategy/StrategyChips'
import { FigureEdit, HeldEditOffer, useOpenFigureEdits } from '../FigureEdit'
import { Badge } from '../Badge'
import { StatedFigure } from '../StatedFigure'
import { nodeColors } from '../../canvas/nodes/colors'
import { isWorkedOut, WorkedSteps } from '../look/WorkedSteps'
import { targetCardOf } from '../model/targets'
import { SimpleFace } from '../v12/SimpleFace'
import { CardDisputeMark } from '../../olumiCore/team/CardDispute'
import { CommittedMark } from '../v12/team/CommittedMark'
import { RestsOn } from '../v12/cards/RestsOn'
import { notesOpenOn } from '../v12/qualitativeNotes'
import { useLevel } from '../v12/simpleStore'
import { nextNoteOf } from '../note'
import { isBaseline, limitLeadOf } from '../v12/contract'
import { cardKind, cardTitle, firstDraft as firstDraftOf, type CardKindName } from '../v12/fields/fields'
import { cardKindOf, dsKindOf, isAssumptionShape, type DsKind } from '../v12/cards/kind'
import { optionLetters } from '../v12/cards/letters'
import { ConditionalBar, RangeBar } from '../v12/scale'
import { NotSavedTag } from '../v12/inspect/NotSaved'
import { AuthorMark, BaselinePill, KindTag, LimitTag, OlumiAsksMark, OlumiMark } from '../v12/cards/marks'
import { chanceParts, noChanceLineOf, onceWords, unsizedWords, withheldField, withheldWords } from '../v12/cards/words'

// Which of core's fields says why a chance is withheld, and its words: v12/cards/words.ts (one source for both faces); named here as before.
export { withheldField, withheldWords }

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
    // Contract 3 (ONE-PLAN, 15 Nov: "a card with no result shows the outcome's blocker in plain words, never 'No chance yet'"): where core
    // withholds the chance (`headline.state` none), core's own sentence for why: its `why` (this option's own reason), else its `title` (the
    // reason every option shares, whole); the bare `text` only where core sends neither. Picked by field; no word is the UI's.
    if (card.headline != null) return withheldWords(card.headline) ?? card.headline.text
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
  const parts = chanceParts(card.headline.text)
  return parts.qualifier === null ? null : parts.head
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

/**
 * UI-BRIEF-20261115 step 3 (Paul, 15 Nov: "visualising it as much as it can"): the number of Olumi's question about THIS card in the panel's
 * numbered list of Olumi's questions (layout.ts chatQuestionsOf, the same list and order ViewChat draws; it is numbered only with two or
 * more), with the question's words. Bound by core's id (`trial_questions[].id`); a question core gives no id (coaching_questions) marks no
 * card, and none is guessed from its words.
 */
export function questionRingOf(model: Parameters<typeof chatQuestionsOf>[0], id: string): { n: number; text: string } | null {
  const qs = chatQuestionsOf(model)
  if (qs.length < 2) return null
  const i = qs.findIndex((q) => q.id === id)
  return i < 0 ? null : { n: i + 1, text: qs[i]!.text }
}

/** Core's card kind (fields.ts) in the design system's kinds, which draw the frame's hue and the marker (olumiLook.css `data-ok-kind`). A note and another
 *  person's position have no shape of their own in the design system: they keep the factor's, as today's rule draws them. */
const DS_OF_KIND: Readonly<Record<CardKindName, DsKind>> = { option: 'option', driver: 'factor', result: 'outcome', risk: 'risk', aim: 'goal', position: 'factor', note: 'factor' }

function CoreCardImpl(props: NodeProps): JSX.Element {
  const id = props.id
  const model = useViewStore((s) => s.view?.model ?? null)
  // V12: Simple draws the card as visuals (v12/SimpleFace.tsx); Detailed draws today's full face. The note's card wears Olumi's badge.
  const simple = useLevel() === 'simple'
  const me = useMe((s) => s.me)
  // Core's own label for the step that sits beside this card (`next.label`), the name of Olumi's question mark; null where the step is not here.
  const notedLabel = useViewStore((s) => {
    if (s.view === null || !simple || !isForThisPage(s.view, me)) return null
    const next = nextNoteOf(s.view)
    return next !== null && next.at === id ? next.note.title ?? '' : null
  })
  const noted = notedLabel !== null
  // The card is the one the node carries (canvas.ts drawViewCanvas: core's own card, never a copy), else the View's: one snapshot with the node.
  const carried = (props.data as { card?: ViewCard }).card
  const card = id === QUESTION ? null : carried ?? model?.cards.find((c) => c.id === id) ?? null
  // On the lane's own canvas the node carries core's card or question (canvas.ts drawViewCanvas), no kind: the kind is the one the board
  // draws it as (layout.ts drawKindOf), the name core's heading or question, and the width the one the lane's layout placed it at.
  const hosted = (props.data as { kind?: string }).kind === undefined
  const viewNow = useViewStore((s) => s.view)
  // V12 (canvas rule 5): the card's shape by kind and, for a calculated card, its state: read from the View's structure (v12/cards/kind.ts),
  // drawn by the look (olumiLook.css, `data-ok-shape` / `data-ok-state`). The option's letter is core's option card order (cards/letters.ts).
  const shape = useMemo(() => (card === null ? null : cardKindOf(card, model, viewNow)), [card, model, viewNow])
  // The design system's kind (shape says what a thing is) feeds the face's shape badge and border hue only (data-ok-kind, olumiLook.css). The
  // BaseNode keeps the board's own kind: its behaviour (anchor card, far title, missing-threshold overlay) is keyed on it and does not change.
  const drawKind = id === QUESTION ? 'decision' : card !== null && model !== null ? drawKindOf(card, model) : 'factor'
  const kind = ((props.data as { kind?: string }).kind ?? drawKind) as NodeType
  // D4: the kind is core's (`card.kind`, fields.ts cardKind; today's rule where an older core sends none), drawn in the design system's kinds.
  // A limit (core's `card.aim` 'limit', else its family: fields.ts aimOf) is a line to stay within, never a goal: its own mark and frame (DL, 17 Nov).
  const coreKind = card === null ? null : cardKind(card, model, viewNow)
  const dsKind = coreKind === null ? dsKindOf(null, drawKind) : coreKind.kind === 'aim' && coreKind.aim === 'limit' ? 'constraint' : DS_OF_KIND[coreKind.kind]
  const width = (props.data as { width?: number }).width
  const label = id === QUESTION ? model?.question.text ?? '' : card?.heading ?? ''
  // Core's face title (FL1: the person's words, Olumi's caption, or the name), as the retired card drew it; the heading stays the card's
  // accessible name and its quick actions' label (`label`). Where core sends none, or the same words, the heading.
  const faceTitle = card?.face?.title?.text ?? ''
  // D2 (the lead, 17 Nov): on Simple the title is core's short title where it sends one, else the heading (fields.ts cardTitle), two lines at most
  // (olumiLook.css), the whole heading the hover; Detailed keeps the face title.
  const shortTitle = simple && card !== null ? cardTitle(card).title : null
  const titleOverride = shortTitle !== null ? (shortTitle !== label ? shortTitle : undefined) : faceTitle !== '' && faceTitle !== label ? faceTitle : undefined
  const question = id === QUESTION ? model?.question ?? null : null
  const coreValue = card === null ? null : coreHoverValueOf(card)
  // Surfaces step 1 (18 Nov; Paul's screenshot: a grey browser box over the card): what the whole face's browser tip said (core's detail, a
  // driver's title, the author, an option's line, status, reason: core's words, verbatim) is said in the card's one hover pop-up instead.
  const driverOfNow = useDriverOf(id)
  const coreAbout = card === null ? null : (driverOfNow !== null ? driverOfNow.map((o) => o.driver!.title)
    : [card.figure !== null && card.figure.text === '' && card.figure.title !== '' ? `${card.figure.title} · ${card.detail}` : card.detail, ...openedWordsOf({ ...card, status: simple ? card.status : null, author: coreValue !== null ? null : card.author })]).filter((x) => x !== '')
  // (The author line is left out where the Value row speaks: that row carries the value's OWN attribution, Codex PL-851.)
  // V12: Simple draws a compact card (BaseNode `compact`: two title lines, 6 px padding, the quick actions below the card, never in a reserved band).
  const data = useMemo(() => (hosted ? { ...props.data, label, kind, type: kind, core: true, coreValue, coreAbout, glyphKind: dsKind, glyphDashed: isAssumptionShape(shape?.shape), ...(simple ? { compact: true } : {}) } : props.data), [hosted, props.data, label, kind, coreValue?.text, coreValue?.source, coreAbout?.join('\n'), simple, dsKind, shape?.shape])
  const lead = card === null ? null : leadLineOf(card)
  const farMark = card === null ? null : farMarkOf(card, model?.cards ?? [])
  const olumi = card?.author?.by === 'olumi'
  // The frame says three things, each on its own channel, as the retired cards did: dashes only where core doubts it; Olumi's blue where
  // Olumi proposes it (the card, or the question); core's orange where it is challenged (RULING 6's link rule, on the card).
  // R3 (Paul, 16 Nov): on a FIRST DRAFT (a proposal and no approved version) everything is proposed, so a card is not marked for being new: its
  // frame is its kind's own and solid, and the panel's approval card says "proposed" once. Inside an approved model a card Olumi proposes keeps
  // its dashed blue frame, and a doubted card stays dashed.
  const firstDraft = viewNow !== null && firstDraftOf(viewNow).firstDraft === true
  const proposed = !firstDraft && (card?.change != null || question?.proposed === true)
  // DL ruling (12 Nov, A13d): one meaning everywhere: dashed = provisional (core doubts it, or Olumi proposes it and it is not yet the
  // person's), solid = settled or the person's own. The card's words already say which ("Proposed by Olumi", "not yet sized").
  // On a first draft core sets `doubt` on every card Olumi proposed (it is unapproved): that is the proposal itself, not a doubt of its own, so it is no
  // dash (R3: a first draft is not drawn all dashed). A figure that waits on an input is provisional in its own right and stays dashed, as does a doubt
  // on a card nobody proposed. Read from structure (`change`, `author`, `figure.state`), never from words. UNVERIFIED by the engine: it should say which
  // (needs_from_engine).
  const proposedByOlumi = card?.change != null && card.author?.by === 'olumi'
  const doubt = card?.doubt === true ? !(firstDraft && proposedByOlumi && card.figure?.state !== 'waits') : !firstDraft && proposedByOlumi
  const challenged = card?.challenged === true
  const frame = doubt || proposed || challenged
    ? `${challenged ? 'border-[var(--olumi-mark-orange)]' : proposed ? 'border-info' : (nodeColors[kind as keyof typeof nodeColors] ?? nodeColors.factor).frame} ${doubt ? 'border-dashed' : ''}`
    : undefined
  // The lenses mark the cards they are about (RULING 5): the Rests on number, in Olumi's blue where core marks the figure Olumi's; the
  // ring of What would change. Both are core's (lens.ts); null off those lenses.
  const restsOn = useRestsOnItem(id), driverOf = driverOfNow
  // If it failed (K5): the cards Olumi's stories rest on stand in front, the rest recede; What if (TM-27): the figure tried, on its card.
  const preMortem = usePreMortemOf(id), tried = useTriedOn(id)
  const tryOn = useTryOn(card)
  const versionN = useViewStore((s) => s.view?.version?.n ?? null)
  const letters = useMemo(() => optionLetters(model), [model]), letter = card?.family === 'option' ? letters.get(id) ?? null : null
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
  // Detailed (17 Nov): an added card's "+" repeats its proposed frame, so only a change the frame does not say is marked, at the card's foot.
  const changeMark = card?.change == null || (!simple && card.change.kind === 'added') ? null : <>{' '}<Glyph at={`${id}.change`} mark={card.change} className="text-info" /></>
  const changeOn = changeMark === null ? null : !simple ? 'foot' : olumi ? 'author' : lead !== null ? 'lead' : badge !== null ? 'badge' : 'band'
  // Results saved by an earlier engine (core's `model.run.earlier`): said once, on the question card above the results, at both levels, in the quiet status
  // tone; the numbers are left as they are (DL and Codex, 17 Nov).
  const earlier = id === QUESTION ? earlierResultsOf(model) : null
  // v10 review item 2: a small "Saved results" pill (the same on every board), core's sentence its hover (title); Detailed too since 17 Nov (Paul: a
  // sentence that can be a mark is a mark).
  const earlierLine = earlier === null ? null
    : <p className="ok-pill ok-saved" data-view="run.earlier" data-saved-results={id} title={simple ? earlier.title : `${earlier.text}\n${earlier.title}`} tabIndex={0} aria-label={`Saved results: ${earlier.text}`}><History size={12} strokeWidth={1.75} aria-hidden="true" className="mr-1 flex-none" />Saved results</p>
  // The one finding line (core's `run.finding`), under the question text: nothing where core sends none (FindingLine).
  const findingLine = id === QUESTION ? <FindingLine model={model} at="question" /> : null
  const badgeLine = badge === null ? null
    // Content, not an action: what core folded behind this card is always shown (my 16:02 rule hid it until hover, so a qualitative brief's
    // purposes and tensions read as an empty board: Codex H07, 17:12Z).
    : <p className="ok-count" data-core-badge={id}><Badge cardId={id} badge={badge} at={id === QUESTION ? 'question' : id} />{changeOn === 'badge' ? changeMark : null}</p>
  // The figure's ✎ (R25): on the figure's own line, as the retired card drew it. A figure with no value yet (Olumi's question, not yet
  // sized) has no line of its own, so the ✎ sits at the end of Olumi's author line; only where neither exists does it take a row (DL-183:
  // "a stray pencil glyph on a row of its own").
  const editCue = card === null || card.figure === null ? null : edit !== null
    ? <span className="nodrag inline-flex align-middle" data-figure-edit-wrap="" data-card-action=""><FigureEdit id={id} edit={edit} glyph label={estimate ? 'Give yours' : 'Change figure'} words={false} /></span>
    : card.change?.kind !== 'added' && kind !== 'outcome'
      ? <span className="nodrag inline-flex align-middle" data-figure-edit-wrap="" data-card-action=""><HeldEditOffer id={id} label={estimate ? 'Give yours' : 'Change figure'} /></span> : null
  const cueOnLead = editCue !== null && card !== null && lead !== null && lead === card.figure?.text
  const cueOnAuthor = editCue !== null && !cueOnLead && olumi
  // Olumi's question about this card, by its number in the panel's list (questionRingOf): on the card's corner where nothing else holds it.
  const ring = card === null ? null : questionRingOf(model, id)
  // Detailed (Paul's 17 Nov capture: numbered circles sat on the figures): Olumi's mark in its ring, the question's words its name; Simple keeps the number.
  const ringMark = ring === null ? null : !simple ? <span data-question-ring={id}><OlumiAsksMark id={id} words={ring.text} /></span>
    : <span role="img" className={`inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full border border-info bg-panel px-1 !leading-tight tabular-nums text-info ${typography.viewLabel}`} title={ring.text} aria-label={ring.text} data-question-ring={id} data-question-n={ring.n}>{ring.n}</span>
  // The figure tried on a copy, as the person typed it, on the card's corner (out of flow, no card moves), where it is not drawn in place.
  const triedMark = tried === null || tryOn?.kind === 'tried' ? null
    : <span className={`max-w-[180px] break-words rounded-sm border border-panel-border bg-panel px-2 py-0.5 text-text-header ${typography.viewLabel}`} title={tried} data-whatif-mark={id}>{WHAT_IF_COPY.whatIf}: {tried}</span>
  const restsFar = restsOn === null ? null
    : <span className={`inline-flex flex-none items-center justify-center rounded-full border bg-panel px-1 !leading-tight tabular-nums ${typography.viewLabel} ${restsInk}`} title={restsOn.olumi && card?.olumi ? card.olumi.title : undefined} data-rests-on={restsOn.n} data-rests-on-far="">{restsOn.n}</span>
  // THE DETAILED FACE (DL-529's nine faces, redrawn 17 Nov for Paul's "not overwhelming but truly valuable with rich data"), core's words
  // verbatim; nothing formatted, rounded or worked out here. Each fact is said once on the board (v12/detailed/said.ts), whose it is is a
  // mark, and what a sentence used to say is a visual where the View gives one:
  //  - an option: its headline as the View serves it: a chance (core's words up to its first clause, 18 px, over its gauge; the clause under
  //    it unless every option says the same one, which the question's rail says once), a fixed result said as fixed, or no chance yet (core's line only, no empty track: R6's line, said once where every option says it);
  //    its other aims are compact marker rows (v12/detailed/marks.tsx AimRows);
  //  - a figure: Olumi's estimate underlined in Olumi's blue with Olumi's mark, the person's solid, ✎ on its line; the options' values as
  //    letter strips (v12/detailed/charts.tsx Strips);
  //  - an aim or limit: its target with Olumi's mark where Olumi proposed it;
  //  - anything else: core's line, whole.
  const said = useMemo(() => saidOnceOf(model), [model])
  // Core's status word for a card it no longer holds as live ("ruled out"): on Detailed it is said in ONE place, the line bound to `<id>.status`,
  // drawn whether or not the card has any other face; it is not repeated in the card's hover.
  const setAside = card !== null && card.status != null && card.status !== ''
  const setAsideChance = card !== null && setAside && card.family === 'option' && card.headline?.state === 'chance' ? card.headline : null
  const sharedRows = useMemo(() => sharedRowStates(model), [model])
  const faceOf = (): JSX.Element | null => {
    if (card === null || lead === null) return null
    // An option core sends no headline for (its rows only): each aim's card says its rows by letter (AimResults). Only where nothing can be worked
    // out on any aim and the first row is about no aim is the option's own face core's words, with no empty track; a row with a result is never drawn as "no chance".
    // A row about no aim (core's own line for the option, such as its setting question) is the option's own: drawn whole, or one press away when long.
    if (card.family === 'option' && card.headline == null) return card.rows.length > 0 && card.rows.every((r) => r.kind === 'none') && card.rows[0]!.aim_id == null ? (
      <div data-core-lead={id} data-ok-face="none" title={lead}><p className="ok-quiet" data-view={`${id}.rows.0.text`}><RowWords words={lead} at={`${id}.rows.0`} /></p></div>
    ) : null
    const hover = [lead, leadTitleOf(card), estimate && lead === card.figure?.text ? card.olumi!.title : null].filter((x) => x != null && x !== '').join(' · ') || undefined
    const trail = cueOnLead ? <>{' '}{editCue}</> : null
    const h = card.family === 'option' ? card.headline ?? null : null
    // An option core no longer holds as live (`status`, e.g. "ruled out") draws no chance headline: its state is the status line's to say, once,
    // and a live number and gauge beside "ruled out" would read as still compared. Core's chance words stay one hover away, on that line.
    if (h !== null && h.state === 'chance' && setAside) return null
    if (h !== null && h.state === 'chance') {
      const head = farChanceOf(card), qual = head === null ? null : h.text.slice(head.length + 2)
      const row = card.rows.find((r) => r.kind === 'chance' && r.aim_id === h.aim_id) as { likely?: { glyph: string; title: string } | null; olumi?: { glyph: string; title: string } | null; chance?: number | null } | undefined
      // The qualifier is its own line, core's words after the number, with Olumi's mark where the chance rests on Olumi's figures; where every
      // option carries the same qualifier the question's rail says it once (said.ts sharedQualifier) and the card keeps the mark beside the number.
      const qualified = qual !== null && qual !== '' && said.qualifier === null
      return (
        <div data-core-lead={id} data-ok-face="chance" title={hover}>
          <p className="ok-chance"><span data-core-lead-clamp={id}>{head ?? h.text}</span>
            {row?.likely == null ? null : <Glyph at={`${id}.likely`} mark={row.likely} className="ok-mark" />}
            {row?.olumi == null || qualified ? null : <span className="ok-dt-num-mark" data-view={`${id}.row.olumi`}><OlumiMark words={row.olumi.title} size={12} /></span>}{trail}</p>
          <ChanceBand card={card} />
          {qualified ? <p className="ok-qual" title={qual!} data-view={`${id}.headline.qualifier`}>{row?.olumi == null ? null : <OlumiMark words={row.olumi.title} size={12} />}{qual}</p> : null}
          <RestsShareFill card={card} />
        </div>
      )
    }
    if (h !== null && h.state === 'fixed') return (
      <div data-core-lead={id} data-ok-face="fixed" title={hover}><p className="ok-fixed"><span data-core-lead-clamp={id}>{h.text}</span>{trail}</p></div>
    )
    // DL 16 Nov: an option with a result on a limit and no goal-type aim leads with that limit (AimRows draws it); no "No chance…" line too.
    if (h !== null && h.state === 'none' && limitLeadOf(card) !== null) return null
    if (h !== null && h.state === 'none') {
      const { line, hover: why } = noChanceLineOf(h)
      // Said once on the aim (said.ts) only where that line says exactly this option's own line and hover; an option whose reason differs keeps its own.
      const once = saysNoChanceOnce(said.none, h)
      return (
        <div data-core-lead={id} data-ok-face="none" data-said-once={once || undefined} title={[why, hover].filter((x) => x != null && x !== '').join('\n')}>
          {once ? null : <p className="ok-quiet" title={why} data-view={`${id}.headline.${h.add != null && h.add !== '' ? 'add' : 'text'}`}>{line}</p>}
          {trail === null ? null : <div className="ok-row">{trail}</div>}
        </div>
      )
    }
    // A figure worked out from others (a relation link into it) is a result or a wait, never the card's own headline figure: a quiet status
    // line, core's words; one that waits on an input (`figure.state` waits) is pending: core's "waits on …" words alone, as the Simple face
    // says them (Paul's standing default, 16 Nov, figures too: no empty track at rest).
    const pending = card.figure?.state === 'waits'
    if (card.figure !== null && lead === card.figure.text && (pending || (viewNow !== null && isWorkedOut(viewNow, id)))) return (
      <div data-core-lead={id} data-ok-face="worked" data-ok-pending={pending ? '' : undefined} title={hover}>
        <p className="ok-status"><span data-core-lead-clamp={id}>{lead}</span>{trail}</p>
      </div>
    )
    if (card.figure !== null && lead === card.figure.text) return (
      <div data-core-lead={id} data-ok-face="figure" title={hover}>
        <p><span className={`ok-fig ${estimate || olumi ? 'ok-fig-olumi' : ''}`} data-core-lead-clamp={id}>{lead}</span>
          {estimate && !olumi && card.olumi != null ? <span className="ok-dt-num-mark" data-view={`${id}.olumi`}><OlumiMark words={card.olumi.title} size={12} /></span> : null}{trail}</p>
      </div>
    )
    if (card.bound != null && lead === card.bound.text) {
      // DL 06:57Z (1): the aim's question opens its target figure's own editor, found by core's `target` line (targets.ts); nothing where core
      // offers no edit. Where Olumi proposed the target, Olumi's mark beside it, core's words its name.
      const target = model === null || model.edit_base === null ? null : targetCardOf(model, card)
      const words = <span data-core-lead-clamp={id}>{lead}</span>
      const mark = card.bound.olumi == null ? null : <span className="ok-dt-num-mark" data-view={`${id}.bound.olumi`}><OlumiMark words={card.bound.olumi.title} size={12} /></span>
      return (
        <div data-core-lead={id} data-ok-face="target" title={hover} className={target === null ? undefined : 'relative'}>
          {target === null
            ? <p className="ok-target">{words}{mark}{trail}</p>
            : <div className="ok-target"><FigureEdit id={target.id} edit={target.figure!.edit ?? null} place="view-aim" opener={words} />{mark}{trail}</div>}
        </div>
      )
    }
    return (
      <div data-core-lead={id} data-ok-face="line" title={hover} className="ok-by">
        <span data-core-lead-clamp={id}>{lead}</span>{trail}
      </div>
    )
  }
  return (
    // The wrapper takes no box (`contents`) unless the If it failed lens recedes this card: no card moves, its handles and ring unchanged.
    // V12: an option's letter is drawn before its title by the look (olumiLook.css reads `--ok-letter`; the title is the frame's own element).
    <div className={preMortem === 'other' ? 'opacity-40 transition-opacity' : 'contents'} data-premortem={preMortem ?? undefined}
      // `--ok-slot`: the width the lane's layout placed this card at, so the Detailed face's floor (olumiLook.css) never draws it wider than its
      // slot and over its neighbour (1232 and 1128: the floor beat a narrower slot by 6 to 26 px).
      style={letter === null && !(hosted && width !== undefined) ? undefined : ({ ...(letter === null ? {} : { '--ok-letter': `"${letter}"` }), ...(hosted && width !== undefined ? { '--ok-slot': `${width}px` } : {}) } as CSSProperties)}>
    <BaseNode {...props} data={data} maxWidth={hosted ? (id === QUESTION ? width : width ?? CARD_WIDTH) : undefined} nodeType={kind} icon={NODE_REGISTRY[kind].icon} incompleteStatedOnCard lodMetric={card === null ? null : farLineOf(card)} cornerSlot={card !== null && card.driver != null ? <ViewDriverBadge card={card} /> : triedMark ?? ringMark ?? undefined}
      lodMark={farMark === null ? restsFar : <>{restsFar}<Glyph at={`${id}.far.olumi`} mark={farMark} className={`${typography.viewLabel} !leading-tight text-info shrink-0`} /></>}
      titleOverride={titleOverride} borderClassOverride={frame}>
      {card === null ? (simple
        // V12 Simple: the question as a slim pill with what core folded behind it (its notes, one line, pressed to open them on the canvas); its
        // date and the chance sentence are the panel's, the date also its hover.
        ? <div className="ok-face" data-ok-family="question" title={question?.decide_by?.text}>{findingLine}{badgeLine}{earlierLine}</div>
        // Detailed (17 Nov): the options' chances on one rail by letter (each option's name is said on its own card), what every option says alike
        // said once, and the date, the folded notes and the saved results as marks on one row.
        : <div className="ok-face" data-ok-family="question" data-ok-detailed="">
            {findingLine}
            <Rail qualifier={said.qualifier} />
            <SaidOnce lines={said.question} at="question" />
            <div className="ok-dt-foot">{question?.decide_by == null ? null : <DecideBy d={question.decide_by} />}{badge === null ? null : <BadgeCount cardId={id} badge={badge} at="question" />}{earlierLine}</div>
          </div>) : (
        <div className={`ok-face ${driverOf !== null ? 'rounded-sm ring-2 ring-text-header ring-offset-4' : ''}`} data-core-card={id} data-ok-family={familyOf(card)} data-ok-detailed={simple ? undefined : ''} data-detailed-set-aside={!simple && setAside ? '' : undefined}
          data-ok-shape={shape?.shape} data-ok-kind={dsKind} data-ok-assumption={isAssumptionShape(shape?.shape) ? '' : undefined} data-ok-state={shape?.state ?? undefined} data-option-letter={letter ?? undefined} data-driver-of={driverOf === null ? undefined : ''}>
          {restsOn === null ? null : <span className={`inline-flex h-[18px] min-w-[18px] items-center justify-center self-start rounded-full border bg-panel px-1 tabular-nums ${typography.viewLabel} ${restsInk}`} title={restsOn.olumi && card.olumi ? card.olumi.title : undefined} data-rests-on={restsOn.n}>{restsOn.n}</span>}
          {simple ? <SimpleFace card={card} model={model} noted={noted} notedWords={notedLabel} kind={shape ?? undefined} scale={card.family === 'option' ? null : <RangeBar card={card} view={{ model }} />} extra={<>{editCue}{badgeLine}<CardDisputeMark card={id} /></>} below={notesOpenOn(model) ? <RestsOn card={card} open /> : null}
            trying={tryOn?.kind !== 'tried' ? undefined : (
              // What if, in Simple: the figure tried, as typed, and the saved figure named beside it (Codex 006); nothing is saved.
              <div className="nodrag grid min-w-0 flex-1 gap-0.5" data-card-try={id} data-simple-try={id}>
                <p className={`${typography.viewValue} break-words text-text-header`} title={tryOn.words}>{WHAT_IF_COPY.trying(tryOn.typed)}</p>
                {card.figure == null || card.figure.text === '' ? null
                  : <p className={`${typography.viewLabel} break-words text-text-light`} title={card.figure.title !== '' ? card.figure.title : card.figure.text} data-simple-saved={id}>{WHAT_IF_COPY.saved}: {card.figure.text}<NotSavedTag id={id} /></p>}
                {tryOn.said === null ? null : <p className={`${typography.viewLabel} break-words text-text-body`} data-card-try-said={id}>{tryOn.said}</p>}
              </div>
            )} /> : <>
          {/* A card core no longer holds as live (`status`, e.g. "ruled out"): core's word, once, where the card's state is said; its name goes light (olumiLook.css).
              Where that withholds a chance headline from the face, core's own chance words and their title are this line's hover. */}
          {setAside ? <p className="ok-quiet" data-view={`${id}.status`} title={setAsideChance === null ? undefined : [setAsideChance.text, setAsideChance.title].filter((x) => x !== '').join('\n')}>{card.status}</p> : null}
          {faceOf()}
          {/* An input not sized yet: core's own words for the gap ("not sized yet · …"), once (words.ts onceWords), whole on hover, as the Simple face
              says them; no empty bar at rest (Paul, 16 Nov), and nothing at all where core sends no words for the gap. */}
          {(() => { const gap = unsizedWords(card); return gap === null ? null : <p className="ok-quiet" data-unsized={id} data-unsized-words={id} title={gap}>{onceWords(gap)}</p> })()}
          {/* A range bar only where the range has a spread (Paul's 17 Nov capture: a 0 to 2 months bar for a fixed deadline encoded nothing). */}
          {card.family === 'option' || !hasSpread(card) || (card.values?.length ?? 0) > 0 ? null : <RangeBar card={card} view={{ model }} />}
          {card.family === 'option' ? <AimRows card={card} model={model} shared={sharedRows} /> : <AimResults aim={card} model={model} shared={sharedRows} />}
          <SaidOnce lines={said.aims.get(id) ?? []} at={id} />
          {reading === null ? null : <p className={`ok-qual ${reading.source === 'proposal' ? 'ok-by-olumi' : ''}`} title={reading.text} data-reading={reading.source} data-view={`${id}.reading`}>{reading.text}</p>}
          {(card.values?.length ?? 0) > 1 ? <StatedFigure id={id} card={card} /> : null}
          {/* Each option's worked-out value, by its letter on one shared axis (v12/detailed/charts.tsx); an option core could not calculate is its
              letter, an outlined lane and core's real reason. Not while the figure waits: its face says so once. */}
          {card.family === 'option' || card.figure?.state === 'waits' ? null : <Strips card={card} model={model} />}
          {tryOn?.kind !== 'tried' ? null : (
            // TM-27: the figure tried, as the person typed it, in place on its card (core's words for the edit on hover); core's own sentence
            // when the copy could not run; and the way back, which drops the try (nothing was saved). The person's act: ink, never Olumi's blue.
            <div className="nodrag grid gap-1 rounded-md border border-panel-border bg-panel px-3 py-2" data-card-try={id}>
              <p className={`${typography.viewValue} text-text-header`} title={tryOn.words}>{WHAT_IF_COPY.trying(tryOn.typed)}<NotSavedTag id={id} /></p>
              {tryOn.said === null ? null : <p className={`${typography.viewLabel} text-text-body`} data-card-try-said={id}>{tryOn.said}</p>}
              <button type="button" onClick={clearWhatIf} data-testid={`card-try-back-${id}`}
                className={`${typography.viewLabel} inline-flex min-h-[24px] w-fit cursor-pointer items-center text-text-body underline underline-offset-2 hover:text-text-header`}>{WHAT_IF_COPY.back(versionN)}</button>
            </div>
          )}
          {tryOn?.kind !== 'option' ? null : (
            // TM-27: the try's chance for this option under its saved one, in core's row words; core's words for the edit and the row on hover.
            <p className={`${typography.viewLabel} text-text-body`} title={`${tryOn.words}\n${tryOn.row.title}`} data-option-try={id}>
              {WHAT_IF_COPY.whatIf}: <span className="font-medium text-text-header" data-view={`whatif.${id}.chance`}>{tryOn.row.value}</span>
            </p>
          )}
          {card.family === 'option' ? <><OptionMarkLine card={id} />{setAside ? null : <ConditionalBar card={card} />}</> : null}
          {/* The team's revealed views, its evidence and core's strategy mark on the card they are about (./RevealMarks, ./strategy). */}
          <span className="flex flex-wrap items-center gap-1 empty:hidden">
            {card.committed == null ? null : <span className={`${typography.viewLabel} text-text-light`} title={`Committed by: ${card.committed.by} · ${card.committed.at}`} data-committed={id}>Committed by: <span data-view={`${id}.committed.by`}>{card.committed.by}</span></span>}
            {/* K5 If it failed: one mark per Olumi failure story resting on this card, core's number with Olumi's glyph, the story on hover; on an
                option, the story most within the team's control, in core's words. All Olumi's (../k5.ts). */}
            {failedOf(card).map((f, j) => (
              <span key={`f${f.n}`} className={`${typography.viewLabel} text-info`} title={`${f.olumi.title} · ${f.title}`} aria-label={`${f.olumi.title} · ${f.title}`} data-failed={`${id}.${f.n}`}>
                <span data-view={`${id}.failed.${j}.olumi.glyph`}>{f.olumi.glyph}</span>{f.n}
              </span>
            ))}
            {(() => { const r = failedReasonOf(card); return r === null ? null : (
              <span className={`${typography.viewLabel} text-info`} title={`${r.olumi.title} · ${r.title}`} aria-label={`${r.olumi.title} · ${r.text} · ${r.title}`} data-failed-reason={id}>
                <span data-view={`${id}.failed_reason.olumi.glyph`}>{r.olumi.glyph}</span> <span data-view={`${id}.failed_reason.text`}>{r.text}</span>
              </span>
            ) })()}
            <CardViewInitials card={id} /><CardEvidenceMarks card={id} /><CardDisputeMark card={id} /><CommittedMark card={id} /><CardViewChips card={id} /><StrategyChips card={id} /></span>
          {/* The figure's ✎ takes a row of its own only where no line can carry it (DL-183). */}
          {editCue === null || cueOnLead || cueOnAuthor ? null : <span className="self-start">{editCue}</span>}
          {/* THE FOOT, ONE ROW OF MARKS (Detailed, 17 Nov; Paul: provenance as marks and colour, not sentences; text as icons with a hover): the
              notation's tags ("baseline", "assumption", the limit's word), core's honesty mark, the working, what core folded behind the card as a
              count, a change the frame does not say; whose it is at the right (Olumi's mark or a person's, both
              where mixed), core's author words its hover and name. */}
          <div className="ok-dt-foot">
            {card.family === 'option' && isBaseline(card) ? <BaselinePill id={id} /> : null}
            {shape?.shape === 'assumption' ? <KindTag id={id} tag="assumption" /> : null}
            {dsKind === 'constraint' ? <LimitTag id={id} model={model} /> : null}
            {card.unused == null || card.unused === '' ? null : <UnusedMark id={id} words={card.unused} />}
            {viewNow === null ? null : <WorkedSteps view={viewNow} id={id} />}
            {badge === null ? null : <BadgeCount cardId={id} badge={badge} at={id} />}
            {changeOn === 'foot' ? changeMark : null}
            {cueOnAuthor ? editCue : null}
            <span className="ok-dt-whose" data-core-author={id}><AuthorMark card={card} size={14} /></span>
          </div>
          </>}
        </div>
      )}
    </BaseNode>
    </div>
  )
}
export const CoreCard = memo(CoreCardImpl)
