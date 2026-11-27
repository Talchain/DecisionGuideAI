import { z } from 'zod/v4'

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
