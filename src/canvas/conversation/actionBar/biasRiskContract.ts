import { z } from 'zod'

import type { ActionOffer } from './actionBarContract'

const CLAIM_ID = /^DSK-B-\d{3}$/

export const BiasRiskItemSchema = z.object({
  claim_id: z.string().regex(CLAIM_ID),
  name: z.string().min(1),
  why: z.string().min(1),
  action_id: z.string().min(1),
  press_id: z.string().min(1),
  offer_key: z.string().min(1),
  science: z.object({
    claim_id: z.string().min(1),
    claim_title: z.string().min(1),
    evidence_strength: z.string().min(1),
    protocol_id: z.string().min(1).optional(),
  }).optional(),
})

export const BiasRiskEnvelopeSchema = z.object({
  v: z.literal(1),
  items: z.array(z.unknown()).min(1),
})

export interface BiasRiskItemView {
  readonly claim_id: string
  readonly name: string
  readonly why: string
  readonly science?: z.infer<typeof BiasRiskItemSchema>['science']
  readonly offer: ActionOffer
}

export interface BiasRiskView {
  readonly items: readonly BiasRiskItemView[]
}

export function parseBiasRisk(raw: unknown, offers: readonly ActionOffer[]): BiasRiskView | undefined {
  const envelope = BiasRiskEnvelopeSchema.safeParse(raw)
  if (!envelope.success) return undefined

  const items = envelope.data.items.slice(0, 2).flatMap((rawItem): BiasRiskItemView[] => {
    const parsed = BiasRiskItemSchema.safeParse(rawItem)
    if (!parsed.success) return []
    const { claim_id, name, why, science, offer_key, press_id } = parsed.data
    const offer = offers.find((candidate) =>
      candidate.offer_key === offer_key && candidate.press_id === press_id && candidate.enabled,
    )
    return offer ? [{ claim_id, name, why, ...(science ? { science } : {}), offer }] : []
  })

  return items.length > 0 ? { items } : undefined
}
