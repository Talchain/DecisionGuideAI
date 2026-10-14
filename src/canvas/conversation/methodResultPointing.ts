/**
 * POINTING INTO THE MODEL (DGAI half; CEE `_method_result` v:1, CEE #2785 / session 4, key ACKed 14 Oct).
 *
 * After "Test without this link" or "What would change this?", Olumi's reply is about particular links and options.
 * The canvas marks them, so the user reads the reply against the model instead of hunting for what it means. The marks
 * last until the next reply (each applied turn replaces them; a turn without a result clears them).
 *
 * Read narrowly: only the fields the canvas uses are validated, and a malformed result marks nothing.
 * - only `test_link` / `what_changes`, and only a `completed` or `measured` outcome;
 * - only rows whose text the reply actually says (CEE's own egress rule);
 * - only `link` and `option` refs (a goal on every row would mark everything).
 */
import { z } from 'zod'
import { create } from 'zustand'
import { ADDITIVE_EXTENSIONS_KEY } from '../../v5/responseParser'

const id = z.string().min(1).max(200)
const ItemRefSchema = z.union([
  z.object({ kind: z.enum(['option', 'factor', 'risk', 'outcome', 'goal']), id }).strict(),
  z.object({ kind: z.literal('link'), from_id: id, to_id: id }).strict(),
])
const MethodResultPointingSchema = z.object({
  v: z.literal(1),
  action_id: id,
  outcome: z.string(),
  scenario_id: id,
  rows: z.array(z.object({ item_refs: z.array(ItemRefSchema).max(12), text: z.string().min(1) }).passthrough()).max(40),
}).passthrough()

export const METHOD_POINTING_ACTIONS = ['test_link', 'what_changes'] as const
export type MethodPointingAction = typeof METHOD_POINTING_ACTIONS[number]
const SHOWN_OUTCOMES: ReadonlySet<string> = new Set(['completed', 'measured'])

export interface MethodPointing {
  readonly scenarioId: string
  readonly actionId: MethodPointingAction
  /** `${from}->${to}` */
  readonly links: ReadonlySet<string>
  readonly optionIds: ReadonlySet<string>
}

export const pointedLinkKey = (fromId: string, toId: string): string => `${fromId}->${toId}`

/** The turn's `_method_result`: top level, then the additive sidecar. */
function methodResultValue(response: unknown): unknown {
  if (response === null || typeof response !== 'object') return undefined
  const root = response as Record<string, unknown>
  if (root._method_result !== undefined) return root._method_result
  return (root[ADDITIVE_EXTENSIONS_KEY] as Record<string, unknown> | undefined)?._method_result
}

/** What this reply points at, or null (absent, another method, not shown, malformed, or rows the reply does not say). */
export function readMethodPointing(response: unknown): MethodPointing | null {
  const parsed = MethodResultPointingSchema.safeParse(methodResultValue(response))
  if (!parsed.success) return null
  const m = parsed.data
  if (!(METHOD_POINTING_ACTIONS as readonly string[]).includes(m.action_id) || !SHOWN_OUTCOMES.has(m.outcome)) return null
  const reply = typeof (response as { assistant_text?: unknown }).assistant_text === 'string'
    ? (response as { assistant_text: string }).assistant_text : ''
  const said = m.rows.filter(row => reply.includes(row.text))
  const links = new Set<string>()
  const optionIds = new Set<string>()
  for (const row of said) for (const ref of row.item_refs) {
    if (ref.kind === 'link') links.add(pointedLinkKey(ref.from_id, ref.to_id))
    else if (ref.kind === 'option') optionIds.add(ref.id)
  }
  if (links.size === 0 && optionIds.size === 0) return null
  return { scenarioId: m.scenario_id, actionId: m.action_id as MethodPointingAction, links, optionIds }
}

export const useMethodPointingStore = create<{ pointing: MethodPointing | null }>(() => ({ pointing: null }))

/** Called once per applied turn: this reply's marks replace the last reply's (none → cleared). */
export function recordMethodPointing(response: unknown): void {
  useMethodPointingStore.setState({ pointing: readMethodPointing(response) })
}

export function useMethodPointedLink(fromId: string, toId: string, scenarioId: string | null): MethodPointingAction | null {
  return useMethodPointingStore(s =>
    s.pointing && s.pointing.scenarioId === scenarioId && s.pointing.links.has(pointedLinkKey(fromId, toId))
      ? s.pointing.actionId : null)
}

export function useMethodPointedOption(optionId: string, scenarioId: string | null): MethodPointingAction | null {
  return useMethodPointingStore(s =>
    s.pointing && s.pointing.scenarioId === scenarioId && s.pointing.optionIds.has(optionId) ? s.pointing.actionId : null)
}
