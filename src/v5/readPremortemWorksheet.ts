/** Local copy of the CEE v2 envelope (CEE #2773). No shared-schema or CEE runtime import. */
import { z } from 'zod'
import { ADDITIVE_EXTENSIONS_KEY } from './responseParser'
import { belongsToThisIdentity, readIdentityEpoch } from '../canvas/store/scenarios'

export const PREMORTEM_COPY = {
  title: 'Imagine it failed: plausible ways',
  warning: 'Early warning',
  outside: 'not in the model yet',
  provenance: 'Olumi hypothesis: for you to challenge',
  serverBuilt: 'Olumi’s starting point: for you to challenge',
  mitigate: 'Mitigate',
  onMap: 'Already on your map',
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
/**
 * v2 (CEE #2773): a story about a risk already in the model names it (`on_map`: Inspect, never Add); only a new risk
 * carries `risk_request` (Add); `source` says who wrote the story; numbered rows always carry Mitigate.
 */
const PremortemWorksheetWireSchema = z.object({
  kind: z.literal('premortem'), version: z.union([z.literal(1), z.literal(2)]), scenario_id: id, turn_id: id,
  run: runSchema, binding: bindingSchema,
  rows: z.array(z.object({
    row_id: id, option_id: id, option_label: text,
    failure_way: text, early_warning: text, mitigation: text.optional(),
    grounding: groundingSchema, provenance: z.literal('olumi_hypothesis'),
    // v2 only; a v1 row (served CEE before #2773) is read as Olumi-drafted below.
    source: z.enum(['olumi_drafted', 'server_built']).optional(),
    risk_request: riskRequestSchema.optional(),
    on_map: z.object({ node_id: id, label: text }).strict().optional(),
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
      { value: row.risk_request?.message, path: ['risk_request', 'message'] },
    ];
    for (const field of fields) {
      if (field.value !== undefined && authoredBan.test(field.value.replace(labelPattern, ' '))) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'unlicensed wording', path: ['rows', index, ...field.path] });
      }
    }
  }
  // DL r5 review: the blindspot question is shown too, so it gets the same masked ban.
  if (authoredBan.test(w.blindspot_question.replace(labelPattern, ' '))) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'unlicensed wording', path: ['blindspot_question'] });
  }
  const issue = () => ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'invalid worksheet binding' });
  if (w.binding.scenario_id !== w.scenario_id || w.binding.graph_revision !== w.run.graph_hash_at_run) issue();
  if (new Set(w.rows.map(r => r.row_id)).size !== w.rows.length || new Set(w.coverage.map(c => c.option_id)).size !== w.coverage.length) issue();
  for (const r of w.rows) {
    const ids = r.grounding.kind === 'not_in_model' ? [] : r.grounding.ids;
    if (new Set(ids).size !== ids.length || (r.risk_request !== undefined && JSON.stringify(ids) !== JSON.stringify(r.risk_request.grounding_ids))) issue();
    if (r.risk_request !== undefined && (r.on_map !== undefined || r.source === 'server_built')) issue();
    if (w.version === 1 && (r.risk_request === undefined || r.on_map !== undefined || r.source === 'server_built')) issue();
    if (w.version === 2 && (r.source === undefined || (r.mitigation === undefined && r.grounding.kind !== 'not_in_model'))) issue();
    if (!w.coverage.some(c => c.option_id === r.option_id && c.option_label === r.option_label && c.status === 'stress_tested')) issue();
  }
  for (const c of w.coverage) if ((c.status === 'stress_tested') !== w.rows.some(r => r.option_id === c.option_id)) issue();
});
/** Both served versions, read as ONE shape: a v1 row is an Olumi-drafted row with its Add (DL 7 Oct: accept v1 AND v2). */
export const PremortemWorksheetV1Schema = PremortemWorksheetWireSchema.transform(w => ({
  ...w, rows: w.rows.map(r => ({ ...r, source: r.source ?? 'olumi_drafted' as const })),
}))
export type PremortemWorksheetV1 = z.output<typeof PremortemWorksheetV1Schema>;

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

/**
 * ⭐ P02: THE WORKSHEET SURVIVES A RELOAD. CEE stores no worksheet with its turn row, so this browser keeps the last
 * available worksheet per scenario. It is restored only for the SAME Run (scenario, graph hash at run, computed_at),
 * re-parsed by the schema above, and never sent anywhere. A fresh browser has none (UNVERIFIED there by design).
 * ⛔ ONE IDENTITY (CHAT-STABLE Codex P1 on #2634, 8 Oct): the entry carries the identity epoch it was written under and
 * is read back only if `belongsToThisIdentity` (the CAN-F2w rule autosave uses); an unreadable epoch writes nothing, an
 * unstamped entry never restores, and the prefix is in the identity boundary's sweep (`USER_SCOPED_STORAGE_PREFIXES`).
 */
const STORAGE_PREFIX = 'olumi-premortem-worksheet:v2:'
/**
 * The identity this tab booted under. A response that lands after an identity boundary (another tab signed in or out)
 * was requested under the OLD identity, so it is never cached under the new one (Codex r1 P1 on #2652). An in-tab
 * boundary also stops the copy until the next reload: the worksheet simply does not survive that reload (fails closed).
 * Replace with `epochThisTabMayWriteUnder()` once CHAT-STABLE's #2646 fence is on staging.
 */
const TAB_IDENTITY_EPOCH = readIdentityEpoch()
export function storePremortemWorksheet(worksheet: PremortemWorksheetV1): void {
  const identityEpoch = readIdentityEpoch()
  if (identityEpoch === undefined || identityEpoch !== TAB_IDENTITY_EPOCH) return
  try { globalThis.localStorage?.setItem(STORAGE_PREFIX + worksheet.scenario_id, JSON.stringify({ identityEpoch, worksheet })) } catch { /* storage unavailable */ }
}
export function loadPremortemWorksheet(run: PremortemRunStamp): PremortemWorksheetV1 | null {
  try {
    const raw = globalThis.localStorage?.getItem(STORAGE_PREFIX + run.scenarioId)
    if (!raw) return null
    const entry = JSON.parse(raw) as { identityEpoch?: unknown; worksheet?: unknown } | null
    if (entry === null || typeof entry !== 'object' || !('identityEpoch' in entry)) return null
    if (!belongsToThisIdentity(entry.identityEpoch)) return null
    const parsed = PremortemWorksheetV1Schema.safeParse(entry.worksheet)
    if (!parsed.success) return null
    const w = parsed.data
    return samePremortemRun(run, { scenarioId: w.scenario_id, graphHashAtRun: w.run.graph_hash_at_run, computedAt: w.run.computed_at }) ? w : null
  } catch {
    return null
  }
}
