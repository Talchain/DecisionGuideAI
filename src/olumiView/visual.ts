import { z } from 'zod'
import type { View, ViewCard, ViewModel } from './client'
import { optionLetters } from './v12/cards/letters'

const id = z.string().min(1)
const number = z.number().finite()
const author = z.object({
  by: z.enum(['person', 'brief', 'olumi', 'mixed']),
  text: z.string(),
  title: z.string(),
})
const provenance = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('theirs'), author: author.nullable() }),
  z.object({ kind: z.literal('olumi'), basis: z.string().nullable() }),
])
const option = z.object({ option: id, letter: id, label: z.string() })
const value = option.extend({
  state: z.literal('value'),
  p10: number,
  p50: number.nullable(),
  p90: number,
  text: z.string(),
  title: z.string().optional(),
  if_absent: z.array(id),
  if_approved: z.object({ glyph: z.string(), title: z.string() }).nullable(),
  provenance,
})
const withheld = option.extend({
  state: z.literal('withheld'),
  cause: z.enum(['invalid_domain', 'not_covered', 'unknown']),
  reason: z.string(),
})
const visualV3 = z.object({
  kind: z.literal('visual'),
  chart: z.literal('CH-bands'),
  quantity: id,
  run: z.union([id, number]).nullable(),
  binding: z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('version'), id: number, label: id }),
    z.object({ kind: z.literal('proposal'), id: number.nullable() }),
  ]),
  unit: z.string().nullable(),
  lanes: z.array(z.discriminatedUnion('state', [value, withheld])).min(1),
}).refine(({ lanes }) => new Set(lanes.map((lane) => lane.option)).size === lanes.length)

/** The projected reply payload. Core owns visibility, the wording and the binding. */
export type VisualV3 = z.infer<typeof visualV3>

export function visualOfAnswer(answer: unknown): VisualV3 | null {
  const visual = typeof answer === 'object' && answer !== null ? (answer as { visual?: unknown }).visual : undefined
  if (visual == null) return null
  const parsed = visualV3.safeParse(visual)
  return parsed.success ? parsed.data : null
}

export function visualIdentity(model: ViewModel, view: Pick<View, 'version' | 'proposal'> | null): Pick<VisualV3, 'run' | 'binding'> {
  // Older Views have no separate Run id. Keep their served version/proposal binding.
  const run = (model.run as { id?: unknown } | null)?.id
  const proposal = model.edit_base === null ? view?.proposal : null
  const version = proposal == null ? view?.version : null
  return {
    run: (typeof run === 'string' && run !== '') || (typeof run === 'number' && Number.isFinite(run)) ? run : null,
    binding: version == null
      ? { kind: 'proposal', id: proposal?.id ?? null }
      : { kind: 'version', id: version.id, label: version.label },
  }
}

export function visualOfCard(model: ViewModel | null, card: ViewCard, view: Pick<View, 'version' | 'proposal'> | null): VisualV3 | null {
  if (model === null || card.family !== 'quantity' || card.figure?.state === 'waits') return null
  if (!card.values?.length && !card.values_withheld?.length) return null
  const values = new Map(card.values?.map((v) => [v.option, v]))
  const held = new Map(card.values_withheld?.map((v) => [v.option, v]))
  const letters = optionLetters(model)
  const lanes = model.cards.flatMap<VisualV3['lanes'][number]>((c) => {
    const letter = letters.get(c.id)
    if (letter === undefined) return []
    const lane = { option: c.id, letter, label: c.heading }
    const withheld = held.get(c.id)
    if (withheld !== undefined) return [{ ...lane, state: 'withheld', cause: withheld.cause ?? 'unknown', reason: withheld.text }]
    const value = values.get(c.id)
    if (value === undefined || !Number.isFinite(value.p10) || !Number.isFinite(value.p90) ||
      (value.p50 !== null && !Number.isFinite(value.p50))) return []
    const { p10, p50, p90, text } = value
    return [{
      ...lane, state: 'value', p10, p50, p90, text, if_absent: value.if_absent ?? [], if_approved: value.if_approved ?? null,
      provenance: value.olumi
        ? { kind: 'olumi', basis: card.olumi?.title ?? card.author?.title ?? null }
        : { kind: 'theirs', author: card.author?.by === 'olumi' ? null : card.author ?? null },
    }]
  })
  const ownUnit = (card as { unit?: unknown }).unit
  const unit = (typeof ownUnit === 'string' ? ownUnit : null)
    ?? card.figure?.range?.unit
    ?? (model.aim?.quantity === card.id ? model.aim.unit : null)
  return lanes.length === 0 ? null : { kind: 'visual', chart: 'CH-bands', quantity: card.id, ...visualIdentity(model, view), unit, lanes }
}
