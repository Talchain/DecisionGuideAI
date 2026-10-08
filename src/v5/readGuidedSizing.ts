/**
 * ⭐ GOAL-REACH guided path (P02; CEE CHAT-STABLE build; contract LOCKED 8 Oct 05:0xZ). When the goal chance is "Not shown
 * yet" because links on the way to the goal have no size, CEE sends the list to size, in its order, each with its own
 * press. DGAI never builds a press, never reorders, never words the progress itself, and never shows a list made for
 * another model revision (`graph_hash`). Malformed → no guided path (the reply's own words still say why).
 */
import { z } from 'zod'
import { ADDITIVE_EXTENSIONS_KEY } from './responseParser'

const text = z.string().trim().min(1)
const GuidedLinkSchema = z.object({
  id: text.optional(),
  from: text,
  to: text,
  from_label: text,
  to_label: text,
  order: z.number().int().min(1),
  press: z.object({ id: text, parameters: z.record(z.unknown()) }).strict(),
}).strict()

const GuidedSizingWireSchema = z.object({
  v: z.literal(1),
  total: z.number().int().min(1),
  graph_hash: text,
  run_key: text,
  links: z.array(GuidedLinkSchema).min(1),
  remaining: z.number().int().min(0).optional(),
  progress_line: text.optional(),
}).strict().refine((g) => new Set(g.links.map((l) => l.order)).size === g.links.length, { message: 'duplicate order' })

export interface GuidedSizingLink {
  readonly id?: string
  readonly from: string
  readonly to: string
  readonly fromLabel: string
  readonly toLabel: string
  readonly order: number
  readonly press: { readonly id: string; readonly parameters: Readonly<Record<string, unknown>> }
}

export interface GuidedSizing {
  readonly total: number
  readonly graphHash: string
  readonly runKey: string
  /** CEE's order, ascending. */
  readonly links: readonly GuidedSizingLink[]
  readonly remaining?: number
  /** CEE's own progress words; DGAI shows them verbatim or not at all. */
  readonly progressLine?: string
}

function guidedSizingValue(response: unknown): unknown {
  if (response === null || typeof response !== 'object') return undefined
  const root = response as Record<string, unknown>
  const sidecar = root[ADDITIVE_EXTENSIONS_KEY] as Record<string, unknown> | undefined
  return root.guided_sizing !== undefined ? root.guided_sizing : sidecar?.guided_sizing
}

export function readGuidedSizing(response: unknown): GuidedSizing | null {
  try {
    const parsed = GuidedSizingWireSchema.safeParse(guidedSizingValue(response))
    if (!parsed.success) return null
    const g = parsed.data
    return {
      total: g.total, graphHash: g.graph_hash, runKey: g.run_key,
      links: [...g.links].sort((a, b) => a.order - b.order).map((l) => ({
        ...(l.id !== undefined ? { id: l.id } : {}),
        from: l.from, to: l.to, fromLabel: l.from_label, toLabel: l.to_label, order: l.order, press: l.press,
      })),
      ...(g.remaining !== undefined ? { remaining: g.remaining } : {}),
      ...(g.progress_line !== undefined ? { progressLine: g.progress_line } : {}),
    }
  } catch {
    return null
  }
}

/** The list only for the model it was made for: a different (or unknown) current graph hash shows nothing. */
export function guidedSizingForModel(g: GuidedSizing | null, currentGraphHash: string | null | undefined): GuidedSizing | null {
  return g !== null && typeof currentGraphHash === 'string' && currentGraphHash === g.graphHash ? g : null
}
