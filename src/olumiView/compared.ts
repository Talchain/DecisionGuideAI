/**
 * R4 COMPARED LINES (was R3; DL 4 Nov: ships with R4), AHEAD OF THE VENDORED VIEW (DL 4 Nov): core's `model.run.compared` and `compared_headings` as olumi-core
 * wip/science-unresolved 5b8cc6f60 serves them (D2, the middle figures; CHANGE 8, compared with carrying on; on D2 e469ec168), read here
 * until DGAI vendors olumi.view/3 at that core. Then this file
 * goes: vendor view.v3.json, regenerate types.ts, and read the field straight. A View without the field draws nothing.
 *
 * Headings: `model.run.compared_headings`, one per group in core's words (science-coaching's decision, 4 Nov; served at 5b8cc6f60): `middle`,
 * `better` and `unresolved` (a D2 line whose status is unresolved, "can't be told apart from …"). A group core gives no heading for is
 * drawn as nothing.
 *
 * Each line is core's own (`line`, the §5.3/§5.10 label: value template, option names as core labels them; `hover`, the Run's text): drawn
 * verbatim, in core's order. They are never science lines, so "Worth checking first" never draws one (`worthLinesOf` reads `science`).
 * Which lines are drawn and how they group is picked in layout.ts (`comparedLinesOf`, `comparedGroupsOf`), the one module that picks.
 */
import type { ViewRun } from './client'

export type ComparedKind = 'middle' | 'better'
export type ComparedLine = {
  id: string; kind: ComparedKind; line: string; hover: string; aim: string; option: string; versus: string | null
  status: 'met' | 'missed' | 'unresolved' | null; olumi: { glyph: string; title: string } | null
}

/** The kinds this page knows how to say; any other kind core adds later is drawn as nothing (picked in layout.ts, `comparedLinesOf`). */
export const COMPARED_KINDS: ReadonlySet<string> = new Set<ComparedKind>(['middle', 'better'])

export type ComparedGroup = 'middle' | 'better' | 'unresolved'
/** The heading group a line is drawn under: a D2 line core could not tell apart from its target is `unresolved`, else its kind. */
export const groupOf = (l: ComparedLine): ComparedGroup => (l.kind === 'middle' && l.status === 'unresolved' ? 'unresolved' : l.kind)

/** Core's heading for a group (`model.run.compared_headings[group]`); null when core gives none. */
export function comparedHeadingOf(run: ViewRun | null, group: ComparedGroup): string | null {
  const h = (run as { compared_headings?: Partial<Record<ComparedGroup, unknown>> | null } | null)?.compared_headings?.[group]
  return typeof h === 'string' && h.trim() !== '' ? h : null
}
