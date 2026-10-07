/** Local copy of the CEE v1 envelope. No shared-schema or CEE runtime import. */
import { z } from 'zod'
import { ADDITIVE_EXTENSIONS_KEY } from './responseParser'

export const PREMORTEM_COPY = {
  title: 'Imagine it failed: plausible ways',
  warning: 'Early warning',
  outside: 'not in the model yet',
  provenance: 'Olumi hypothesis: for you to challenge',
} as const;
const text = z.string().min(1).max(1600).refine(s => s.trim().length > 0);
const id = z.string().min(1).max(160);
const direction = z.enum(['positive', 'negative']);
const authoredBan = /%|\b(?:most likely|likely|likelihood|chance|probability|probable|odds|best|winners?|winning|recommend\w*|leads?|ahead|beats?)\b/iu;
const runSchema = z.object({
  graph_hash_at_run: z.string().regex(/^[0-9a-f]{16}$/u),
  computed_at: z.string().refine(s => Number.isFinite(Date.parse(s)) && new Date(s).toISOString() === s),
  run_id: id.optional(),
}).strict();
const dependencySchema = z.object({
  kind: z.enum(['option', 'criterion', 'preference', 'utility', 'constraint', 'analysis', 'source', 'claim', 'fact_verdict', 'model_element', 'map_structure', 'protocol']),
  id,
  fingerprint: z.string().regex(/^[0-9a-f]{64}$/u),
}).strict();
const bindingSchema = z.object({ scenario_id: id, graph_revision: id, dependencies: z.array(dependencySchema).min(2) }).strict();
const groundingSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('factor'), ids: z.array(id).min(1), labels: z.array(text).min(1) }).strict(),
  z.object({ kind: z.literal('link'), ids: z.array(id).min(1), labels: z.array(text).min(2) }).strict(),
  // DL r4 (7 Oct): the method supplies risk items too (CEE SuppliedItem 'risk'); the served T1b story 1 rests on one.
  z.object({ kind: z.literal('risk'), ids: z.array(id).min(1), labels: z.array(text).min(1) }).strict(),
  z.object({ kind: z.literal('not_in_model'), label: z.literal(PREMORTEM_COPY.outside) }).strict(),
]);
const riskRequestSchema = z.object({
  chip_id: z.literal('agent-next-suggest-risks'),
  message: text,
  affected_node_id: id,
  direction,
  grounding_ids: z.array(id),
}).strict();
export const PremortemWorksheetV1Schema = z.object({
  kind: z.literal('premortem'), version: z.literal(1), scenario_id: id, turn_id: id,
  run: runSchema, binding: bindingSchema,
  rows: z.array(z.object({
    row_id: id, option_id: id, option_label: text,
    failure_way: text, early_warning: text, mitigation: text.optional(),
    grounding: groundingSchema, provenance: z.literal('olumi_hypothesis'), risk_request: riskRequestSchema,
  }).strict()).min(1).max(4),
  coverage: z.array(z.object({ option_id: id, option_label: text, status: z.enum(['stress_tested', 'not_stress_tested']) }).strict()),
  blindspot_question: text.refine(s => s.endsWith('?')),
}).strict().superRefine((w, ctx) => {
  // User labels may contain otherwise banned words or percentages. Mask only
  // their literal occurrences for validation, preserving the carrier verbatim.
  const labels = [...new Set([
    ...w.coverage.map(c => c.option_label),
    ...w.rows.flatMap(r => [r.option_label, ...(r.grounding.kind === 'not_in_model' ? [] : r.grounding.labels)]),
  ])].sort((a, b) => b.length - a.length);
  // Whole-label only (DL r3): a one-word label 'Lead' must not mask Olumi's own "leads".
  const labelPattern = new RegExp(`(?<![\\p{L}\\p{N}])(?:${labels.map(label => label.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')).join('|')})(?![\\p{L}\\p{N}])`, 'giu');
  for (const [index, row] of w.rows.entries()) {
    const fields = [
      { value: row.failure_way, path: ['failure_way'] },
      { value: row.early_warning, path: ['early_warning'] },
      { value: row.mitigation, path: ['mitigation'] },
      { value: row.risk_request.message, path: ['risk_request', 'message'] },
    ];
    for (const field of fields) {
      if (field.value !== undefined && authoredBan.test(field.value.replace(labelPattern, ' '))) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'unlicensed wording', path: ['rows', index, ...field.path] });
      }
    }
  }
  const issue = () => ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'invalid worksheet binding' });
  if (w.binding.scenario_id !== w.scenario_id || w.binding.graph_revision !== w.run.graph_hash_at_run) issue();
  if (new Set(w.rows.map(r => r.row_id)).size !== w.rows.length || new Set(w.coverage.map(c => c.option_id)).size !== w.coverage.length) issue();
  for (const r of w.rows) {
    const ids = r.grounding.kind === 'not_in_model' ? [] : r.grounding.ids;
    if (new Set(ids).size !== ids.length || JSON.stringify(ids) !== JSON.stringify(r.risk_request.grounding_ids)) issue();
    if (!w.coverage.some(c => c.option_id === r.option_id && c.option_label === r.option_label && c.status === 'stress_tested')) issue();
  }
  for (const c of w.coverage) if ((c.status === 'stress_tested') !== w.rows.some(r => r.option_id === c.option_id)) issue();
});
export type PremortemWorksheetV1 = z.infer<typeof PremortemWorksheetV1Schema>;

export type PremortemWorksheetRead =
  | { status: 'available'; worksheet: PremortemWorksheetV1 }
  | { status: 'unavailable' }

export function premortemWorksheetValue(response: unknown): unknown {
  if (response === null || typeof response !== 'object') return undefined
  const root = response as Record<string, unknown>
  const sidecar = root[ADDITIVE_EXTENSIONS_KEY] as Record<string, unknown> | undefined
  return root._premortem_worksheet !== undefined ? root._premortem_worksheet : sidecar?._premortem_worksheet
}

export function readPremortemWorksheet(response: unknown): PremortemWorksheetRead {
  try {
    const parsed = PremortemWorksheetV1Schema.safeParse(premortemWorksheetValue(response))
    return parsed.success ? { status: 'available', worksheet: parsed.data } : { status: 'unavailable' }
  } catch {
    return { status: 'unavailable' }
  }
}

export type PremortemRunStamp = { scenarioId: string; graphHashAtRun: string; computedAt: string }
export type PremortemRunMeta = {
  premortemWorksheet?: PremortemWorksheetRead | null
  premortemRun?: PremortemRunStamp | null
}

export function samePremortemRun(a: PremortemRunStamp | null | undefined, b: PremortemRunStamp | null | undefined): boolean {
  return !!a && !!b && a.scenarioId === b.scenarioId && a.graphHashAtRun === b.graphHashAtRun && a.computedAt === b.computedAt
}

/** Replace the options this turn covered, retaining other options only within the same Run. */
export function mergePremortemWorksheets(held: PremortemWorksheetV1, incoming: PremortemWorksheetV1): PremortemWorksheetV1 {
  const touched = new Set(incoming.rows.map(row => row.option_id))
  const rows = [...held.rows.filter(row => !touched.has(row.option_id)), ...incoming.rows]
  const coverage = incoming.coverage.map(option => ({ ...option,
    status: rows.some(row => row.option_id === option.option_id) ? 'stress_tested' as const : 'not_stress_tested' as const,
  }))
  return { ...incoming, rows, coverage }
}
