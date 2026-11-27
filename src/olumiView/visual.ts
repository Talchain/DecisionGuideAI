import { z } from 'zod/v4'
import type { View, ViewCard, ViewModel } from './client'
import { optionLetters } from './v12/cards/letters'

const str = z.string(), id = z.string(), num = z.number()

// olumi-core wip/o-v2m:src/view/schema.ts:528–540.
const VisualOptionV3 = z.object({ option: id, letter: str, label: str, text: str }).strict()
const VisualBandsV3 = z.object({ kind: z.literal('visual'), chart: z.literal('CH-bands'),
  quantity: id, aim: id.optional(), run: id, unit: str, label: str,
  options: z.array(z.union([
    VisualOptionV3.extend({ p10: num, p50: num, p90: num }).strict(),
    VisualOptionV3.extend({ withheld: z.literal(true) }).strict(),
  ])),
}).strict()
const visualV3 = z.union([
  VisualBandsV3.extend({ version: num, proposal: num.optional() }).strict(),
  VisualBandsV3.extend({ proposal: num }).strict(),
])

export type VisualV3 = z.infer<typeof visualV3>

export function visualOfAnswer(answer: unknown): VisualV3 | null {
  const visual = typeof answer === 'object' && answer !== null ? (answer as { visual?: unknown }).visual : undefined
  const parsed = visualV3.safeParse(visual)
  return parsed.success ? parsed.data : null
}

const author = z.object({ by: z.enum(['person', 'brief', 'olumi', 'mixed']), title: str })
const mark = z.object({ glyph: str, title: str })

type CardBandOption = z.infer<typeof VisualOptionV3> & (
  { withheld: true } |
  { p10: number; p50: number | null; p90: number; olumi: boolean; hover: string; approvalMark: z.infer<typeof mark> | null }
)

export type CardBands = { quantity: string; versionLabel: string | null; options: CardBandOption[] }

export function visualOfCard(model: ViewModel | null, card: ViewCard, view: Pick<View, 'version' | 'proposal'> | null): CardBands | null {
  if (model === null || card.family !== 'quantity' || card.figure?.state === 'waits') return null
  if (!card.values?.length && !card.values_withheld?.length) return null
  const values = new Map(card.values?.map((v) => [v.option, v]))
  const held = new Map(card.values_withheld?.map((v) => [v.option, v]))
  const letters = optionLetters(model)
  const options = model.cards.flatMap<CardBandOption>((c) => {
    const letter = letters.get(c.id)
    if (letter === undefined) return []
    const option = { option: c.id, letter, label: c.heading }
    const withheld = held.get(c.id)
    if (withheld !== undefined) return [{ ...option, withheld: true, text: withheld.text }]
    const value = values.get(c.id)
    if (value === undefined || !Number.isFinite(value.p10) || !Number.isFinite(value.p90) ||
      (value.p50 !== null && !Number.isFinite(value.p50))) return []
    // Lane authorship is additive on the wire. Older values carry only the boolean.
    const source = value as { author?: unknown; olumi?: unknown }
    const servedAuthor = author.safeParse(source.author)
    const servedMark = mark.safeParse(source.olumi)
    const ownAuthor = servedAuthor.success ? servedAuthor.data : null
    const ownMark = servedMark.success ? servedMark.data : null
    const olumi = ownMark !== null || (ownAuthor !== null ? ownAuthor.by === 'olumi'
      : value.olumi === true || (source.olumi === undefined && (card.olumi != null || card.author?.by === 'olumi')))
    const hover = olumi
      ? ownMark?.title ?? ownAuthor?.title ?? card.olumi?.title
        ?? (card.author?.by === 'olumi' ? card.author.title : null) ?? card.figure?.title ?? c.heading
      : ownAuthor?.title ?? (card.author?.by === 'olumi' ? null : card.author?.title) ?? c.heading
    const { p10, p50, p90, text } = value
    return [{ ...option, p10, p50, p90, text, olumi, hover, approvalMark: value.if_approved ?? null }]
  })
  const proposal = model.edit_base === null ? view?.proposal : null
  return options.length === 0 ? null : { quantity: card.id, versionLabel: proposal == null ? view?.version?.label ?? null : null, options }
}
