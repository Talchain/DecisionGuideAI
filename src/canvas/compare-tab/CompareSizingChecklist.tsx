/**
 * Compare's "not shown" state as the user's next step (Paul's 8 Oct test: a 'Monthly churn' limit edit led to a panel
 * that said nothing he could act on; DL 58e392 GO "A"). When a Run withholds its shares because the comparison turns on
 * links whose strengths nobody has set (CEE `goal_path_unsized`), each link the reason NAMES becomes one row: the link,
 * whether its strength is set now, and one press to its inspector. When every row is set, the list says to re-run.
 *
 * ⛔ ONE PRODUCER FOR THE LIST. The rows are exactly the links CEE's reason names (`withheldReasonSegments`, from the
 *   same Run's GOAL_FIGURES_PLACEHOLDER_PATH links), bound by their from/to ids. Never derived from the canvas graph, so
 *   chat and Compare cannot list different links. A link the sentence only counts ("and 2 other links") gets no row,
 *   but it is still counted, by its ids in the same warning: "All set" is said only when every link CEE listed is set.
 * ⛔ THE TICK IS STORED PROVENANCE, NEVER A VALUE, AND IT IS CEE'S GOAL RULE (`olumiGuessedGoalLink`: sized only by
 *   Olumi and not accepted). Ticked: the user's own weight (`weightSource: 'user'`, which a wire `user_specified` also
 *   stamps), a size from the user's stated figure (`isStrengthStated`), or Olumi's estimate the user accepted
 *   (`isStrengthAccepted`, CEE `olumi_accepted`; it still reads as Olumi's, never "you set"). Olumi's unaccepted estimate
 *   and its placeholder stay unset: CEE still counts both as guesses. The canvas is read only for the tick, by the ids.
 */
import { Check, Link2 } from 'lucide-react'
import { typography } from '../../styles/typography'
import { icon } from '../../components/results/analysisNew/panelSurfaces'
import { GraphLink } from '../../components/results/GraphLink'
import { edgeValueSource } from '../domain/edgeValueProvenance'
import { isStrengthStated } from '../domain/strengthStated'
import { isStrengthAccepted } from '../domain/strengthAccepted'
import type { ReasonSegment } from './withheldReasonSegments'

export const COMPARE_SIZING_TESTID = 'compare-sizing'
export const SIZING_SET_TEXT = 'You set this strength'
/** Compare's own words for the class elsewhere (`runDeltaLinkWords`): accepted, and still Olumi's estimate. */
export const SIZING_ACCEPTED_TEXT = 'You accepted Olumi’s estimate'
export const SIZING_NOT_SET_TEXT = 'Strength not set'
export const SIZING_OFF_CANVAS_TEXT = 'Not on the canvas now.'
export const SIZING_SET_ACTION = 'Set strength'
export const SIZING_CHANGE_ACTION = 'Change'
export const SIZING_ALL_SET_TEXT = 'All set. Re-run to see the comparison.'
/** The sentence counted links it could not name ("and 1 more"): those are still unset, and the next Run names them. */
export const SIZING_NEXT_TEXT = 'Re-run to see the next links to set.'

export type SizingLink = { readonly text: string; readonly fromId: string; readonly toId: string }
export type LinkSizingState = 'set' | 'accepted' | 'not_set' | 'off_canvas'
export type LinkSizingStateOf = (fromId: string, toId: string) => LinkSizingState

/** The links the reason names, in its order, once each by identity. Plain segments (counts, connectives) give none. */
export function sizingLinksOf(segments: ReadonlyArray<ReasonSegment> | null | undefined): SizingLink[] {
  const seen = new Set<string>()
  const links: SizingLink[] = []
  for (const s of segments ?? []) {
    if (!s.link) continue
    const key = `${s.link.fromId}\u0000${s.link.toId}`
    if (seen.has(key)) continue
    seen.add(key)
    links.push({ text: s.text, fromId: s.link.fromId, toId: s.link.toId })
  }
  return links
}

/** The named link's sizing on the canvas now, by its two ends: the user's own, accepted, not set, or no such link. */
export function linkSizingStateOf(
  edges: ReadonlyArray<{ source: string; target: string; data?: unknown }> | null | undefined,
  fromId: string,
  toId: string,
): LinkSizingState {
  const edge = (edges ?? []).find((e) => e.source === fromId && e.target === toId)
  if (!edge) return 'off_canvas'
  const data = edge.data as Record<string, unknown> | undefined
  if (edgeValueSource(data, 'weight') === 'user' || isStrengthStated(data)) return 'set'
  return isStrengthAccepted(data) ? 'accepted' : 'not_set'
}

/** Sized for CEE's goal licence: the user's own, or Olumi's estimate the user accepted. */
function isSized(state: LinkSizingState): boolean {
  return state === 'set' || state === 'accepted'
}

/** The sentence's own phrase ("from ‘A’ to ‘B’"), as a row name: first letter up, nothing else changed. */
const rowName = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1)

export function CompareSizingChecklist({ links, listed, stateOf }: {
  links: readonly SizingLink[]
  /** Every link the same warning lists (`unsizedLinksOf`), named or only counted; the rows are its named subset. */
  listed: ReadonlyArray<{ from: string; to: string }>
  stateOf: LinkSizingStateOf
}): JSX.Element | null {
  if (links.length === 0) return null
  const rows = links.map((link) => ({ link, state: stateOf(link.fromId, link.toId) }))
  const named = new Set(links.map((l) => `${l.fromId}\u0000${l.toId}`))
  const counted = listed.filter((l) => !named.has(`${l.from}\u0000${l.to}`)).map((l) => stateOf(l.from, l.to))
  const states = [...rows.map((r) => r.state), ...counted]
  const set = states.filter(isSized).length
  const allSet = set === states.length
  const namedAllSet = rows.every((r) => isSized(r.state))
  return (
    <div className="mt-3" data-testid={COMPARE_SIZING_TESTID} data-set={set} data-total={states.length}>
      <p className={`${typography.panelMeta} text-text-light m-0`} data-testid={`${COMPARE_SIZING_TESTID}-count`}>
        {`${set} of ${states.length} set`}
      </p>
      <ul className="list-none p-0 m-0">
        {rows.map(({ link, state }) => (
          <li key={`${link.fromId}\u0000${link.toId}`} className="py-2 border-t border-panel-border first:border-t-0"
            data-testid={`${COMPARE_SIZING_TESTID}-row`} data-from={link.fromId} data-to={link.toId} data-state={state}>
            <div className="flex items-start gap-2">
              <Link2 className={`${icon('row')} text-text-light flex-shrink-0 mt-0.5`} aria-hidden="true" />
              <div className="flex-1 min-w-0">
                <p className={`${typography.panelBody} text-text-header m-0 break-words`}>{rowName(link.text)}</p>
                <p className={`${typography.panelMeta} text-text-light m-0 flex items-center gap-1`} data-testid={`${COMPARE_SIZING_TESTID}-state`}>
                  {isSized(state) ? <Check className={`${icon('inline')} text-success flex-shrink-0`} aria-hidden="true" /> : null}
                  {state === 'set' ? SIZING_SET_TEXT : state === 'accepted' ? SIZING_ACCEPTED_TEXT : state === 'not_set' ? SIZING_NOT_SET_TEXT : SIZING_OFF_CANVAS_TEXT}
                </p>
              </div>
              {state === 'off_canvas' ? null : (
                <GraphLink edgeRef={{ fromId: link.fromId, toId: link.toId }} opensInspector
                  className={`${typography.panelMeta} whitespace-nowrap flex-shrink-0 px-1 min-h-[24px]`}>
                  {isSized(state) ? SIZING_CHANGE_ACTION : SIZING_SET_ACTION}
                  <span className="sr-only">{`: ${link.text}`}</span>
                </GraphLink>
              )}
            </div>
          </li>
        ))}
      </ul>
      {allSet ? (
        <p className={`${typography.panelBody} text-text-body mt-1 mb-0`} data-testid={`${COMPARE_SIZING_TESTID}-all-set`}>{SIZING_ALL_SET_TEXT}</p>
      ) : namedAllSet ? (
        <p className={`${typography.panelBody} text-text-body mt-1 mb-0`} data-testid={`${COMPARE_SIZING_TESTID}-next`}>{SIZING_NEXT_TEXT}</p>
      ) : null}
    </div>
  )
}
