/**
 * R4 COMPARED LINES, read through the vendored View contract (view.v3.json, core f10b02dd): `model.run.compared` and `compared_headings`
 * (D2, the middle figures; compared with carrying on). Headings: `middle`, `better` and `unresolved` (a D2 line whose status is unresolved).
 * A group core gives no heading for is drawn as nothing. Each line is core's own (`line`, `hover`): drawn verbatim, in core's order; they are
 * never science lines. Which lines are drawn and how they group is picked in layout.ts (`comparedLinesOf`, `comparedGroupsOf`).
 */
import type { ViewRun } from './client'

export type ComparedLine = ViewRun['compared'][number]
export type ComparedKind = ComparedLine['kind']

/** The kinds this page knows how to say; any other kind core adds later is drawn as nothing (picked in layout.ts, `comparedLinesOf`). */
export const COMPARED_KINDS: ReadonlySet<string> = new Set<ComparedKind>(['middle', 'better'])

export type ComparedGroup = keyof ViewRun['compared_headings']
/** The heading group a line is drawn under: a D2 line core could not tell apart from its target is `unresolved`, else its kind. */
export const groupOf = (l: ComparedLine): ComparedGroup => (l.kind === 'middle' && l.status === 'unresolved' ? 'unresolved' : l.kind)

/** Core's heading for a group (`model.run.compared_headings[group]`); null when core gives none. */
export function comparedHeadingOf(run: ViewRun | null, group: ComparedGroup): string | null {
  const h = run?.compared_headings?.[group]
  return typeof h === 'string' && h.trim() !== '' ? h : null
}
