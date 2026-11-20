/**
 * The V12 card marks, shared by the Simple and Detailed faces (previous/CoreCard.tsx, v12/SimpleFace.tsx). Shapes and marks only: every
 * sentence here is core's, passed in. The fixed UI chrome (decided 16 Nov) is the notation's own: the option letter and the name of Olumi's
 * question mark; since 20 Nov "baseline", "assumption", "limit" and "condition" are registry icons (C2, C5), core's words on their hover. Look: look/olumiLook.css (.ok-*).
 */
import { useEffect, useId, useState, type ReactNode } from 'react'
import type { ViewCard } from '../../client'
import { ICONS, LabelledIcon, OkIcon, type IconId } from '../../look/icons'
import { useAnchoredTip } from '../../look/Tip'

/** A mark with words is an image named by them whose hover is the one Tip (150 ms, keyboard focus too; never a native `title`), the registry's own LabelledIcon (look/icons.tsx: inside a focusable card the card is the one tab stop and its focus opens the tip); one with none is decoration. */
function Named({ words, className, attrs, children }: { words: string | null | undefined; className: string; attrs?: Readonly<Record<string, string | undefined>>; children: ReactNode }): JSX.Element {
  return words == null || words === ''
    ? <span className={className} {...attrs} aria-hidden>{children}</span>
    : <LabelledIcon label={words} cls={className} attrs={attrs}>{children}</LabelledIcon>
}

type MarkProps = { readonly words?: string | null }

/** The one size of a mark beside text (the lane's two icon sizes are 16 in a control and 14 beside text). */
const MARK = 14

/** Olumi's mark: the product's own, never a sparkle, a speech bubble or a text glyph. */
export const OlumiMark = ({ words }: MarkProps): JSX.Element => (
  <Named words={words} className="ok-am ok-am-olumi" attrs={{ 'data-olumi-mark': '' }}><OkIcon id="olumi-mark" size={MARK} decorative inherit /></Named>
)
/** A person's mark. */
export const PersonMark = ({ words }: MarkProps): JSX.Element => (
  <Named words={words} className="ok-am ok-am-person" attrs={{ 'data-person-mark': '' }}><OkIcon id="person-mark" size={MARK} decorative inherit /></Named>
)

export type Whose = 'olumi' | 'person' | 'mixed'
/** Whose a card is, from core's `author.by` (`brief` is the person's own words); a card with no author line is Olumi's only where core marks
 *  it so. Null where core says neither: no mark is made up. */
export function whoseOf(card: ViewCard): Whose | null {
  const by = card.author?.by
  if (by === 'olumi' || (by == null && card.olumi != null)) return 'olumi'
  if (by === 'mixed') return 'mixed'
  return by == null ? null : 'person'
}
/** Core's author words for the hover: its line, then its title (the quote, or Olumi's reason). */
export const authorWordsOf = (card: ViewCard): string | null =>
  [card.author?.text, card.author?.title].filter((x): x is string => x != null && x !== '').join(' · ') || card.olumi?.title || null

/** The authorship mark on a card: Olumi's mark or a person's, both where core says the card is mixed; core's author words on hover. */
export function AuthorMark({ card, simple = false }: { card: ViewCard; simple?: boolean }): JSX.Element | null {
  const whose = whoseOf(card)
  if (whose === null) return null
  return (
    <Named words={authorWordsOf(card)} className="ok-author" attrs={{ 'data-author-mark': whose, ...(simple ? { 'data-simple-author': whose } : {}) }}>
      {whose === 'person' ? null : <OlumiMark />}
      {whose === 'olumi' ? null : <PersonMark />}
    </Named>
  )
}

/** A card's change glyph (core's `change.glyph`, "+" and the like), named by core's `change.title` on the one Tip; the caller decides where a change is not already said by the frame. */
export const ChangeGlyph = ({ card }: { card: ViewCard }): JSX.Element | null => card.change == null ? null
  : <Named words={card.change.title} className="text-info" attrs={{ 'data-view': `${card.id}.change.glyph` }}>{card.change.glyph}</Named>

/** The option's letter as a chip (for a row that names an option; on the option's own card the chip is drawn before its title by the look). */
export const LetterChip = ({ letter, words }: { letter: string; words?: string | null }): JSX.Element => words == null || words === ''
  ? <span className="ok-letter" data-letter-chip={letter}>{letter}</span>
  : <Named words={words} className="ok-letter" attrs={{ 'data-letter-chip': letter }}>{letter}</Named>

/** The typed-state marks beside a card's name (C2, 20 Nov: text that just sits there becomes an icon with its words on hover). Registry icons, grey; the
 *  data marks the card's readers bind by are kept on the wrapper. */
const KindMark = ({ attrs, children }: { attrs: Readonly<Record<string, string>>; children: JSX.Element }): JSX.Element => <span className="ok-am ok-kind-mark" {...attrs}>{children}</span>

/** "baseline": the option the person already has, only where core marks it (contract.ts isBaseline). Registry flag; its words the hover and the name. */
export const BaselinePill = ({ id }: { id: string }): JSX.Element => <KindMark attrs={{ 'data-option-baseline': id }}><OkIcon id="baseline-tag" size={MARK} decorative={false} /></KindMark>

/** A card's assumption mark (core's `assumption` family: a premise taken as given); its words are the key's own word for it (core's `model.key` item `assumption`), else the registry's. */
export const KindTag = ({ id, model }: { id: string; model: { key?: readonly { id: string; text: string }[] } | null }): JSX.Element => {
  const word = model?.key?.find((k) => k.id === 'assumption')?.text
  return <KindMark attrs={{ 'data-kind-tag': 'assumption', 'data-kind-tag-of': id }}><OkIcon id="assumption-tag" size={MARK} words={word} decorative={false} /></KindMark>
}

/** A condition card's own mark (C5): neutral, the registry's, drawn for the `condition` family only. */
export const ConditionTag = ({ id }: { id: string }): JSX.Element => <KindMark attrs={{ 'data-kind-tag': 'condition', 'data-kind-tag-of': id }}><OkIcon id="condition-tag" size={MARK} decorative={false} /></KindMark>

/** What a limit is, said on its mark's hover (DL from Paul's test, 17 Nov: three turns asking why a limit looked like a goal). Page chrome. */
export const LIMIT_MEANS = 'A line to stay within, not a goal to reach'
/** A limit's mark: the registry's limit shape; its words are the key's own word for a limit (core's `model.key` item `limit`, else "limit"), then what a limit means. */
export const LimitTag = ({ id, model }: { id: string; model: { key?: readonly { id: string; text: string }[] } | null }): JSX.Element => {
  const word = model?.key?.find((k) => k.id === 'limit')?.text ?? 'limit'
  return <KindMark attrs={{ 'data-kind-tag': 'limit', 'data-kind-tag-of': id }}><OkIcon id="limit-tag" size={MARK} words={`${word}\n${LIMIT_MEANS}`} decorative={false} /></KindMark>
}

/** Fixed UI chrome: the name of Olumi's question mark where core sends no label for its next step. */
export const OLUMI_ASKS = 'Olumi has a question about this: see the chat'
/** "Olumi has a question about this": a ring holding Olumi's mark, named by core's own label for the step where it sends one. */
export const OlumiAsksMark = ({ id, words }: { id: string; words?: string | null }): JSX.Element => {
  const name = words != null && words !== '' ? words : OLUMI_ASKS
  return <Named words={name} className="ok-asks" attrs={{ 'data-olumi-asks': id, 'data-simple-note': id }}><OkIcon id="olumi-mark" size={MARK} decorative inherit /></Named>
}

/** A listed question's number on the card it is about (C4, restored 20 Nov): the number the question has in the panel's list (layout.ts chatQuestionsOf), the question's words its
 *  name and hover. A plain numbered circle in the quiet ink, never Olumi's blue ring: the ring is the next step's alone, so a card can wear both and tell them apart. */
export const QuestionMark = ({ id, n, words }: { id: string; n: number; words: string }): JSX.Element => (
  <Named words={words} className="ok-qn" attrs={{ 'data-question-ring': id, 'data-question-n': String(n) }}>{n}</Named>
)

/**
 * A CARD'S STATE MARKS (Paul, 17 Nov about 20:30Z: "You can cap at three, but there should be some sort of mechanism to show more").
 * One list, in one fixed priority, from fields core serves: each mark is a registry icon (look/icons.tsx) whose hover is core's own sentence.
 * The list is whole: the Simple foot caps it (CardMarks); a face with room draws all of it.
 *
 * A mark is made only for what the card does not already say at rest. So there is none for: a figure that waits (its quiet line says "waits
 * on: …" in core's words), a provisional card (its dashed frame), a worked-out figure (its kind's shape), the baseline (its word) or an
 * option's driver (the corner badge, which takes one of the three places). Olumi's own observations (core's `worth_checking`) take the
 * place after "challenged": ONE MARK PER DISTINCT CODE (C3, 20 Nov), each its own neutral registry icon, core's title and sentence its hover, so a card
 * with two different observations shows two different marks and not one that says both; none is made up here.
 */
export type CardMark = { readonly id: 'set-aside' | 'challenged' | 'worth-checking' | 'unused'; readonly icon: IconId; readonly words: string; /** Core's own code, on a worth-checking mark. */ readonly code?: string }

/** One of Olumi's own provisional observations about a card: core's short title and its sentence. */
export type WorthChecking = { readonly code: string; readonly title: string; readonly text: string }
/**
 * Core's `worth_checking` on a card (core candidate 6, `src/view/schema.ts`: `{ code, title, text, rests_on, olumi: true }[]`, present only
 * when there is at least one): where the model's own structure shows its reasoning may be weak (every aim resting on one figure of Olumi's, an
 * estimate held as a single number, evidence that only supports). This is the one place the page reads it. Only a well-formed item that core
 * marks as Olumi's is kept; nothing is worked out or worded here.
 */
export function worthCheckingOf(card: ViewCard): readonly WorthChecking[] {
  const raw = card.worth_checking
  // Typed since core's schema carries the key; still guarded as a list (a View from outside the contract is not drawn from).
  if (!Array.isArray(raw)) return []
  return raw.flatMap((x) => (x.olumi === true && x.title !== '' && x.text !== '' ? [{ code: x.code, title: x.title, text: x.text }] : []))
}

/**
 * Core's nine `worth_checking` codes (olumi-core src/view/schema.ts, the schema's enum) and the neutral registry icon each draws. The icons name no family
 * ("bias", "evidence", "range" ...) core does not give: they are shapes, and the mark's name is core's own title and sentence. A code this page does not know
 * (a newer core) falls back to the one generic mark, so no observation is dropped.
 */
export const WORTH_ICON: Readonly<Record<string, IconId>> = {
  olumi_estimate_under_every_aim: 'check-estimate-under-aims',
  result_rests_on_olumi_range: 'check-result-rests-on-range',
  estimate_held_as_one_figure: 'check-one-figure',
  only_supporting_evidence: 'check-only-supporting',
  one_evidence_for_several_figures: 'check-shared-evidence',
  narrow_range: 'check-narrow-range',
  view_without_evidence: 'check-no-evidence',
  assumption_without_test: 'check-untested-assumption',
  olumi_range_turns: 'check-range-turns',
}

/** Olumi's observations on this card as marks: one per distinct code, in core's order of first appearance; two items with one code share a mark, named by both. */
export function worthMarksOf(card: ViewCard): readonly CardMark[] {
  const byCode = new Map<string, WorthChecking[]>()
  for (const w of worthCheckingOf(card)) byCode.set(w.code, [...(byCode.get(w.code) ?? []), w])
  return [...byCode].map(([code, items]) => ({ id: 'worth-checking' as const, code, icon: WORTH_ICON[code] ?? 'worth-checking', words: items.map((w) => `${w.title}\n${w.text}`).join('\n\n') }))
}

export function cardMarksOf(card: ViewCard): readonly CardMark[] {
  const marks: CardMark[] = []
  // Core's own word for a card that is no longer live (`status`, e.g. "ruled out"; null while it is live).
  if (card.status != null && card.status !== '') marks.push({ id: 'set-aside', icon: 'set-aside', words: card.status })
  // Named by its kind, then core's reason: a reason alone ("Two sources disagree…") does not say it is a challenge (line review, 18 Nov).
  if (card.challenged) marks.push({ id: 'challenged', icon: 'challenged', words: card.reason != null && card.reason !== '' ? `${ICONS.challenged.hover}: ${card.reason}` : ICONS.challenged.hover })
  marks.push(...worthMarksOf(card))
  if (card.unused != null && card.unused !== '') marks.push({ id: 'unused', icon: 'feeds-no-result', words: card.unused })
  return marks
}

/** One state mark: the registry icon named by core's words, on the data marks its readers bind by (`data-card-mark` is the kind of mark, `data-worth-code` core's code). */
export const StateMark = ({ m, card, size = MARK }: { m: CardMark; card: ViewCard; size?: number }): JSX.Element => (
  <span className="ok-am ok-state-mark" data-card-mark={m.id} {...(m.id === 'unused' ? { 'data-view': `${card.id}.unused`, 'data-unused': card.id } : m.id === 'worth-checking' ? { 'data-view': `${card.id}.worth_checking` } : {})} {...(m.code === undefined ? {} : { 'data-worth-code': m.code })} {...(m.id === 'challenged' ? { 'data-simple-challenged': card.id } : {})}>
    <OkIcon id={m.icon} size={size} words={m.words} decorative={false} />
  </span>
)

/** At most this many marks beside the author mark at rest. */
export const MARK_CAP = 3
/** Fixed UI chrome: the name of the control that holds the marks past the cap. */
export const MORE_MARKS = { lead: 'Also on this card', fewer: 'Show fewer' } as const

/**
 * The Simple foot's marks: the first `MARK_CAP - taken` of the card's list, then "+N" for the rest. `taken` is what the card already draws
 * elsewhere that counts toward the three (the corner driver badge). "+N" names the hidden marks on hover and to a screen reader, and a press
 * (or Enter / Space) draws them in the row; it never selects or drags the card.
 */
export function CardMarks({ card, taken = 0, omit = [] }: { card: ViewCard; taken?: number; /** Marks this face says elsewhere, once (Detailed's status line says "set aside"). */ omit?: readonly CardMark['id'][] }): JSX.Element | null {
  const [open, setOpen] = useState(false)
  const panel = useId()
  const all = cardMarksOf(card).filter((m) => !omit.includes(m.id))
  const over = all.slice(Math.max(0, MARK_CAP - taken)), words = over.map((m) => m.words)
  // Once nothing is past the cap the control is gone, so its open state goes with it: marks that return later start folded (line review, 18 Nov).
  const none = over.length === 0
  useEffect(() => { if (none) setOpen(false) }, [none])
  // The "+N" hover is the one Tip: the folded marks' words, one per line (aria-label keeps them whole for a screen reader).
  const moreTip = useAnchoredTip(open ? MORE_MARKS.fewer : [`${MORE_MARKS.lead}:`, ...words].join('\n'))
  if (all.length === 0) return null
  const shown = all.slice(0, all.length - over.length)
  const markOf = (m: CardMark) => <StateMark key={`${m.id}${m.code ?? ''}`} m={m} card={card} />
  return (
    <>
      {shown.map(markOf)}
      {open && over.length > 0 ? <span id={panel} className="contents">{over.map(markOf)}</span> : null}
      {over.length === 0 ? null : (
        <>
          <button type="button" className="ok-more nodrag nopan" aria-expanded={open} aria-controls={open ? panel : undefined} data-card-more={over.length} aria-describedby={moreTip.describedBy} {...moreTip.handlers}
            aria-label={open ? MORE_MARKS.fewer : `${MORE_MARKS.lead}: ${words.join('; ')}`}
            onClick={(e) => { e.stopPropagation(); moreTip.dismiss(); setOpen((o) => !o) }}>
            {open ? '−' : `+${over.length}`}
          </button>
          {moreTip.tip}
        </>
      )}
    </>
  )
}
