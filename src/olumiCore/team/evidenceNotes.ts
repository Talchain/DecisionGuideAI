/**
 * THE LANE'S EVIDENCE ADAPTER INTO THE CARD NOTES (design plan step 7a). What the team brought (`evidence[]` on the scenario view) never
 * enters the saved graph's canonical model, which is what `noteRecordsOf` reads, so a card could not count it. This builds the same
 * records the canonical `evidence` family would hold and lets `noteRecordsOf` anchor them by its own rules (the first concern that is a
 * visible card, else the question card), so a card counts team evidence exactly as it counts any other note, and nothing is said twice.
 *
 * The words are the member's own, kept as stored; a source is added the way `noteRecordsOf` adds one ("Source: ..."). Evidence is shared
 * with every member by core, so nothing private passes through here.
 */
import { noteRecordsOf, type NoteRecord } from '../../canvas/domain/noteRecordsModel'
import type { TeamEvidenceRow } from './types'

type CanvasNode = Parameters<typeof noteRecordsOf>[1][number]

/**
 * The team's evidence has an identity space of its own, apart from the saved model's record ids: a canonical record called `evidence_11`
 * and the team's eleventh row are two notes, never one. (The prefix holds a character no record id of core's uses.)
 */
export const evidenceNoteId = (id: number): string => `team-evidence:${id}`

export function teamEvidenceNotes(evidence: readonly TeamEvidenceRow[] | undefined, nodes: readonly CanvasNode[]): ReadonlyMap<string, NoteRecord> {
  if (!evidence || evidence.length === 0) return new Map()
  const rows = evidence.map((e) => ({ id: evidenceNoteId(e.id), text: e.text, source: e.source, bears: e.stance, concerns: [...e.concerns], author: 'person', party: e.by }))
  return noteRecordsOf({ living_model: { canonical: { evidence: rows } } }, nodes)
}

/** The notes the saved graph gives, then the team's evidence beside them. The two identity spaces cannot meet, but a team note still never replaces a graph note of the same id. */
export function withTeamEvidence(base: ReadonlyMap<string, NoteRecord>, evidence: readonly TeamEvidenceRow[] | undefined, nodes: readonly CanvasNode[]): ReadonlyMap<string, NoteRecord> {
  const team = teamEvidenceNotes(evidence, nodes)
  if (team.size === 0) return base
  const out = new Map(base)
  for (const [id, n] of team) if (!out.has(id)) out.set(id, n)
  return out
}
