/**
 * The V12 card marks, shared by the Simple and Detailed faces (previous/CoreCard.tsx, v12/SimpleFace.tsx). Shapes and marks only: every
 * sentence here is core's, passed in. The fixed UI chrome (decided 16 Nov) is the notation's own: the option letter, "baseline",
 * "assumption" and the name of Olumi's question mark. Look: look/olumiLook.css (.ok-*).
 */
import { User } from 'lucide-react'
import type { ViewCard } from '../../client'
import { OlumiAiIcon } from '../../../components/results/analysisNew/OlumiAiIcon'

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

/** A dashed, empty track: nothing to place yet. Named by core's words for the gap where it sends them. */
export const EmptyTrack = ({ testid, words }: { testid: string; words?: string | null }): JSX.Element => (
  <span className="ok-empty" data-testid={testid} {...named(words)} />
)

/** A figure with no value yet: a dashed empty bar and core's own words for the gap, one line and whole on hover. */
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
