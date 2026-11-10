/**
 * External research on core (olumi-core `src/app/research.ts`, branch wip/research): Olumi searches the web for ONE card or link and
 * PROPOSES evidence; nothing in the model changes until a member chooses. Every word and figure here is core's: this page draws them.
 *  · POST /api/scenarios/:s/research { record, op }        → 201 { research, status: 'searching' } (the search runs after the answer)
 *  · GET  /api/scenarios/:s/research                       → { research: ResearchItem[] }, newest first
 *  · POST /api/scenarios/:s/research/:id/choice { proposal, choice: accept|reject|set_range, base?, op } → 201 { choice, evidence, version }
 * Accept attaches the proposal as the team's evidence on that record (core's own evidence row, so it is in View.evidence and can be
 * considered by the existing "Ask Olumi to consider" route); set_range also sets the figure as the member's own edit.
 */
import { call, NOT_FOR_THIS_PAGE, READ_FAILED, TeamApiError } from '../../olumiCore/team/api'
import { useMe } from '../../olumiCore/me'

export type ResearchChoice = 'accept' | 'reject' | 'set_range'
export type ResearchProposal = {
  k: number; title: string; url: string; published: string | null; quote: string
  /** A figure's range as core READ it from the passage in the card's unit, or `none` (core's plain words why there is no range). */
  implies: { kind: 'range'; low: number; high: number; unit: string | null; words: string } | { kind: 'none'; words: string } | { kind: 'direction'; direction: 'up' | 'down' | 'none'; words: string } | { kind: 'bears'; bears: 'supports' | 'challenges'; words: string }
  relevance: string; strength: 'strong' | 'moderate' | 'weak' | null; strength_why: string
  settable: boolean; why_not: string | null; by: 'olumi'; provisional: true; mark: string
  stance: 'supports' | 'challenges' | 'unclear'
  choice: { choice: ResearchChoice; by: string; at: string; evidence: number | null; version: number | null } | null
  /** Every sentence the page shows for this proposal, written by core against the model now: drawn verbatim, never composed here. */
  lines: { passage: string; badge: string; where: string; suggests: string; relevance: string | null; strength: string | null; stance: string | null; cannot_set: string | null; choice: string | null }
}
export type ResearchItem = {
  id: number; record: string; about: string; heading: string; intro: string; kind: 'figure' | 'link' | 'assumption'; at: string; by: string; by_id: string; version: number; in_model: boolean
  status: 'searching' | 'stopped' | 'failed' | 'none' | 'found'; said: string | null; look_for: string[]; proposals: ResearchProposal[]
}

const path = (sid: string) => `/api/scenarios/${encodeURIComponent(sid)}/research`
export const research = {
  start: (sid: string, record: string, op: string) => call<{ research: number; status: 'searching' }>('POST', path(sid), { record, op }),
  /**
   * The list is drawn only for the person the page was opened for (PL-37): core names whose list it is (`you_id`, the cookie's person when
   * it answered), and a list for anyone else is refused in the person's words (NOT_FOR_THIS_PAGE), never drawn. Until the page knows whose
   * it is, nothing is read; a list that does not say whose it is cannot be checked, so it is not drawn either.
   */
  list: async (sid: string, person: string | null = useMe.getState().me?.id ?? null) => {
    if (person === null) throw new TeamApiError(0, READ_FAILED)
    const r = await call<{ you_id?: unknown; research: ResearchItem[] }>('GET', path(sid))
    if (typeof r?.you_id !== 'string') throw new TeamApiError(0, READ_FAILED)
    if (r.you_id !== person) throw new TeamApiError(409, NOT_FOR_THIS_PAGE)
    return r
  },
  choose: (sid: string, id: number, proposal: number, choice: ResearchChoice, base: number | null, op: string) =>
    call<{ choice: ResearchChoice; evidence: number | null; version: number | null }>('POST', `${path(sid)}/${id}/choice`, { proposal, choice, base, op }),
}
