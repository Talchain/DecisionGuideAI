/**
 * The V12 card marks, shared by the Simple and Detailed faces (previous/CoreCard.tsx, v12/SimpleFace.tsx). Shapes and marks only: every
 * sentence here is core's, passed in. The fixed UI chrome (decided 16 Nov) is the notation's own: the option letter, "baseline",
 * "assumption" and the name of Olumi's question mark. Look: look/olumiLook.css (.ok-*).
 */
import { useState } from 'react'
import { User } from 'lucide-react'
import type { ViewCard } from '../../client'
import { OlumiAiIcon } from '../../../components/results/analysisNew/OlumiAiIcon'
import { ICONS, OkIcon, type IconId } from '../../look/icons'

/** A mark with words is an image named by them (its hover too); one with none is decoration. */
const named = (words: string | null | undefined) => (words == null || words === ''
  ? { 'aria-hidden': true as const }
  : { role: 'img' as const, 'aria-label': words, title: words })

type MarkProps = { readonly words?: string | null; readonly size?: number }

/** Olumi's mark: the product's own, never a sparkle, a speech bubble or a text glyph. */
export const OlumiMark = ({ words, size = 12 }: MarkProps): JSX.Element => (
  <span className="ok-am ok-am-olumi" data-olumi-mark="" {...named(words)}><OlumiAiIcon size={size} strokeWidth={1.75} /></span>
)
/** A person's mark. */
export const PersonMark = ({ words, size = 14 }: MarkProps): JSX.Element => (
  <span className="ok-am ok-am-person" data-person-mark="" {...named(words)}><User aria-hidden="true" width={size} height={size} strokeWidth={1.75} /></span>
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
export function AuthorMark({ card, simple = false, size }: { card: ViewCard; simple?: boolean; size?: number }): JSX.Element | null {
  const whose = whoseOf(card)
  if (whose === null) return null
  return (
    <span className="ok-author" data-author-mark={whose} {...(simple ? { 'data-simple-author': whose } : {})} {...named(authorWordsOf(card))}>
      {whose === 'person' ? null : <OlumiMark size={size} />}
      {whose === 'olumi' ? null : <PersonMark size={size} />}
    </span>
  )
}

/** The option's letter as a chip (for a row that names an option; on the option's own card the chip is drawn before its title by the look). */
export const LetterChip = ({ letter, words }: { letter: string; words?: string | null }): JSX.Element => (
  <span className="ok-letter" data-letter-chip={letter} title={words ?? undefined}>{letter}</span>
)

/** "baseline": the option the person already has, only where core marks it (contract.ts isBaseline). */
export const BaselinePill = ({ id }: { id: string }): JSX.Element => <span className="ok-pill ok-baseline" data-option-baseline={id}>baseline</span>

/** A kind's tag on the card ("assumption"). */
export const KindTag = ({ id, tag }: { id: string; tag: string }): JSX.Element => <span className="ok-tag" data-kind-tag={tag} data-kind-tag-of={id}>{tag}</span>
/** What a limit is, said on its card's tag (DL from Paul's test, 17 Nov: three turns asking why a limit looked like a goal). Page chrome. */
export const LIMIT_MEANS = 'A line to stay within, not a goal to reach'
/** A limit's tag: the key's own word for a limit (core's `model.key` item `limit`, else "limit"), its meaning the hover. */
export const LimitTag = ({ id, model }: { id: string; model: { key?: readonly { id: string; text: string }[] } | null }): JSX.Element => {
  const word = model?.key?.find((k) => k.id === 'limit')?.text ?? 'limit'
  return <span className="ok-tag" data-kind-tag="limit" data-kind-tag-of={id} title={LIMIT_MEANS}>{word}</span>
}

/** A dashed, empty track: nothing to place yet (Detailed only; Simple draws a quiet line, R6). Named by core's words for the gap where it sends them. */
export const EmptyTrack = ({ testid, words }: { testid: string; words?: string | null }): JSX.Element => (
  <span className="ok-empty" data-testid={testid} {...named(words)} />
)

/** A figure with no value yet (Detailed): a dashed empty bar and core's own words for the gap, one line and whole on hover. Simple draws the words alone, once,
 *  as the card's quiet line (SimpleFace, R6 and D2): no empty track at rest. */
export function UnsizedFigure({ id, words }: { id: string; words: string | null }): JSX.Element {
  return (
    <div className="ok-unsized" data-unsized={id} title={words ?? undefined}>
      <EmptyTrack testid={`${id}-empty-bar`} />
      {words === null ? null : <p className="ok-caption" data-unsized-words={id}>{words}</p>}
    </div>
  )
}

/** Fixed UI chrome: the name of Olumi's question mark where core sends no label for its next step. */
export const OLUMI_ASKS = 'Olumi has a question about this: see the chat'
/** "Olumi has a question about this": a ring holding Olumi's mark, named by core's own label for the step where it sends one. */
export const OlumiAsksMark = ({ id, words }: { id: string; words?: string | null }): JSX.Element => {
  const name = words != null && words !== '' ? words : OLUMI_ASKS
  return <span className="ok-asks" role="img" aria-label={name} title={name} data-olumi-asks={id} data-simple-note={id}><OlumiAiIcon size={12} strokeWidth={1.75} /></span>
}

/**
 * A CARD'S STATE MARKS (Paul, 17 Nov about 20:30Z: "You can cap at three, but there should be some sort of mechanism to show more").
 * One list, in one fixed priority, from fields core serves: each mark is a registry icon (look/icons.tsx) whose hover is core's own sentence.
 * The list is whole: the Simple foot caps it (CardMarks); a face with room draws all of it.
 *
 * A mark is made only for what the card does not already say at rest. So there is none for: a figure that waits (its quiet line says "waits
 * on: …" in core's words), a provisional card (its dashed frame), a worked-out figure (its kind's shape), the baseline (its word) or an
 * option's driver (the corner badge, which takes one of the three places). Olumi's own observations (core's `worth_checking`) take the
 * place after "challenged": one mark however many there are, so a card is not crowded by its own caveats; none is made up here.
 */
export type CardMark = { readonly id: 'set-aside' | 'challenged' | 'worth-checking' | 'unused'; readonly icon: IconId; readonly words: string }

/** One of Olumi's own provisional observations about a card: core's short title and its sentence. */
export type WorthChecking = { readonly code: string; readonly title: string; readonly text: string }
/**
 * Core's `worth_checking` on a card (core candidate 6, `src/view/schema.ts`: `{ code, title, text, rests_on, olumi: true }[]`, present only
 * when there is at least one): where the model's own structure shows its reasoning may be weak (every aim resting on one figure of Olumi's, an
 * estimate held as a single number, evidence that only supports). This is the one place the page reads it. Only a well-formed item that core
 * marks as Olumi's is kept; nothing is worked out or worded here.
 */
export function worthCheckingOf(card: ViewCard): readonly WorthChecking[] {
  const raw = (card as unknown as { worth_checking?: unknown }).worth_checking
  if (!Array.isArray(raw)) return []
  return raw.flatMap((f: unknown) => {
    const x = f as { code?: unknown; title?: unknown; text?: unknown; olumi?: unknown } | null
    return x !== null && typeof x === 'object' && x.olumi === true && typeof x.code === 'string' && typeof x.title === 'string' && x.title !== '' && typeof x.text === 'string' && x.text !== ''
      ? [{ code: x.code, title: x.title, text: x.text }] : []
  })
}

export function cardMarksOf(card: ViewCard): readonly CardMark[] {
  const marks: CardMark[] = []
  // Core's own word for a card that is no longer live (`status`, e.g. "ruled out"; null while it is live).
  if (card.status != null && card.status !== '') marks.push({ id: 'set-aside', icon: 'set-aside', words: card.status })
  if (card.challenged) marks.push({ id: 'challenged', icon: 'challenged', words: card.reason != null && card.reason !== '' ? card.reason : ICONS.challenged.hover })
  // Olumi's observations on this card: ONE mark, in Olumi's blue, named by every observation in core's order (its title, then its sentence).
  const worth = worthCheckingOf(card)
  if (worth.length > 0) marks.push({ id: 'worth-checking', icon: 'worth-checking', words: worth.map((w) => `${w.title}\n${w.text}`).join('\n\n') })
  if (card.unused != null && card.unused !== '') marks.push({ id: 'unused', icon: 'feeds-no-result', words: card.unused })
  return marks
}

/** At most this many marks beside the author mark at rest. */
export const MARK_CAP = 3
/** Fixed UI chrome: the name of the control that holds the marks past the cap. */
export const MORE_MARKS = { lead: 'Also on this card', fewer: 'Show fewer' } as const

/**
 * The Simple foot's marks: the first `MARK_CAP - taken` of the card's list, then "+N" for the rest. `taken` is what the card already draws
 * elsewhere that counts toward the three (the corner driver badge). "+N" names the hidden marks on hover and to a screen reader, and a press
 * (or Enter / Space) draws them in the row; it never selects or drags the card.
 */
export function CardMarks({ card, taken = 0 }: { card: ViewCard; taken?: number }): JSX.Element | null {
  const [open, setOpen] = useState(false)
  const all = cardMarksOf(card)
  if (all.length === 0) return null
  const over = all.slice(Math.max(0, MARK_CAP - taken)), words = over.map((m) => m.words)
  const shown = open ? all : all.slice(0, all.length - over.length)
  return (
    <>
      {shown.map((m) => (
        <span key={m.id} className="ok-am ok-mark" data-card-mark={m.id} {...(m.id === 'challenged' ? { 'data-simple-challenged': card.id } : {})}>
          <OkIcon id={m.icon} size={12} words={m.words} decorative={false} />
        </span>
      ))}
      {over.length === 0 ? null : (
        <button type="button" className="ok-more nodrag nopan" aria-expanded={open} data-card-more={over.length}
          aria-label={open ? MORE_MARKS.fewer : `${MORE_MARKS.lead}: ${words.join('; ')}`} title={open ? MORE_MARKS.fewer : [`${MORE_MARKS.lead}:`, ...words].join('\n')}
          onClick={(e) => { e.stopPropagation(); setOpen((o) => !o) }}>
          {open ? '−' : `+${over.length}`}
        </button>
      )}
    </>
  )
}
