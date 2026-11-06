/**
 * The one way DGAI reads a scenario's model on olumi-core: the View (API v2, `GET /api/scenarios/:s/view`). Core works out every
 * word, figure, unit, sign, fold, badge and chance line once; this page draws them and adds only geometry and interaction
 * (olumi-core API.md, "View (API v2)"). Nothing here converts the model.
 *
 * Same origin, the browser's own cookie, and the Team tab's error words (`olumiCore/team/api.ts`). What the person has opened is the
 * only input: a badge's card id and the record ids it holds, exactly as the View handed them out, and every figure on or off.
 * Opening something is a new read, never a re-fold here.
 */
import { call, TeamApiError } from '../olumiCore/team/api'
import type { View } from './types'

export type { View }
export type ViewModel = NonNullable<View['model']>
export type ViewCard = ViewModel['cards'][number]
export type ViewLink = ViewModel['links'][number]
export type ViewRow = ViewCard['rows'][number]
export type ViewTurn = View['chat'][number]
export type ViewRun = NonNullable<ViewModel['run']>

/** What the person has opened: badges (card id → the records it holds) and every figure on or off. */
export interface Opened { readonly open: ReadonlyMap<string, readonly string[]>; readonly all: boolean }
export const NOTHING_OPENED: Opened = { open: new Map(), all: false }

/** olumi.view/3: v2 plus the Run's science lines (`model.run.science`), asked for with `?schema=3` (core API.md, "v3"; PL review 4 Nov). */
export const VIEW_SCHEMA = 'olumi.view/3'
/** Core answered in a shape this page was not built for (a newer or older View): said, never drawn as if it were this one. */
export const VIEW_SHAPE_CHANGED = 'Olumi has been updated since this page loaded. Reload the page to continue.'

/** `at`: one approved version's own View, as it was (core API v1.10, `view?at=n`): no proposal, nothing to edit. Null: the latest. */
export function viewPath(sid: string, opened: Opened = NOTHING_OPENED, at: number | null = null): string {
  const q = new URLSearchParams({ schema: '3' })
  if (at !== null) q.set('at', String(at))
  if (opened.open.size > 0) q.set('open', JSON.stringify(Object.fromEntries(opened.open)))
  if (opened.all) q.set('all', '1')
  return `/api/scenarios/${encodeURIComponent(sid)}/view?${q.toString()}`
}

/** A core that answers a version's read with another version (one older than API v1.10 ignores `at`): said, never drawn as that version. */
export const VERSION_NOT_SERVED = 'Olumi cannot show a past version on the canvas yet.'

export async function readView(sid: string, opened: Opened = NOTHING_OPENED, at: number | null = null): Promise<View> {
  const v = await call<{ schema?: unknown; version?: { n?: unknown } | null }>('GET', viewPath(sid, opened, at))
  if (v === null || typeof v !== 'object' || v.schema !== VIEW_SCHEMA) throw new TeamApiError(0, VIEW_SHAPE_CHANGED)
  if (at !== null && v.version?.n !== at) throw new TeamApiError(0, VERSION_NOT_SERVED)
  return v as View
}

/**
 * The writes, straight to core's v1 routes on this origin (View API design §2: no adapter). Each carries an op id where core takes one,
 * so a write re-sent after a dropped connection is saved once. After any of them the caller reads the View again.
 */
const scenarioPath = (sid: string) => `/api/scenarios/${encodeURIComponent(sid)}`
export const writes = {
  create: (brief: string, op: string) => call<{ scenario: string; proposal: number | null }>('POST', '/api/scenarios', { brief, op }),
  message: (sid: string, text: string, op: string) => call<{ proposal: number | null; discussion?: boolean }>('POST', `${scenarioPath(sid)}/messages`, { text, op }),
  challenge: (sid: string, kind: string, record: string, op: string) => call<{ proposal: number | null }>('POST', `${scenarioPath(sid)}/challenge`, { kind, record, op }),
  /** What the team came for (core API `POST …/goal`, canon wave step 1): one of the View's `session.goals[].id`, or null to clear. No AI call. */
  goal: (sid: string, goal: string | null, op: string) => call<{ goal: number }>('POST', `${scenarioPath(sid)}/goal`, { goal, op }),
  /** One plain question from the View's `session.methods` (core API `POST …/method`): a discussion-only turn, never a change to the model. */
  method: (sid: string, method: string, op: string) => call<{ proposal: number | null; discussion?: boolean }>('POST', `${scenarioPath(sid)}/method`, { method, op }),
  /**
   * The coach's next move, taken in one tap: a structured choice, never words (DL 16:36Z, option b). Core's route (API v1.12, "Taking the
   * offered coaching move by one tap", 400b672, in the View vendored at d1fe5e2): `{ move, at, op? }` with no `text`; the person's turn is
   * recorded as core's label for the move (`chat[].said`, with `choice: { move, label }`), and a move no longer the newest is `409`.
   */
  move: (sid: string, move: string, at: string | null, op: string) => call<{ proposal: number | null; discussion?: boolean }>('POST', `${scenarioPath(sid)}/messages`, { move, at, op }),
  /** The whole proposal, or (API v1.4/v1.8 "confirm selected") exactly the ticked lines: record ids in `only`, top-level fields in `only_top`. */
  approve: (proposal: number, base: number | null, pick?: { only: string[]; only_top: string[] }) =>
    call<unknown>('POST', `/api/proposals/${proposal}/approve`, pick === undefined ? { base } : { base, ...pick }),
  discard: (proposal: number) => call<unknown>('POST', `/api/proposals/${proposal}/discard`, {}),
  /** The person's own figure for one quantity, as they typed it (API v1.9 `typed`): core reads it as its page does, or refuses in the card's own ask. */
  edit: (sid: string, base: number, quantity: string, typed: string, op: string) => call<{ version: number; n: number; receipt: string }>('POST', `${scenarioPath(sid)}/edit`, { base, quantity, typed, op }),
}
