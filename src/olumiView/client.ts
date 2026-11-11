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
export type ViewReading = ViewRun['readings'][number]
export type ViewTiming = ViewRun['timing'][number]
export type ViewPreMortem = NonNullable<View['session']['pre_mortem']>

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

/** The blind entry core serves for "Let us give our figure first" (API.md, `GET …/figure-first`): every word core's, no figure of Olumi's. */
export type FigureFirstEntry = {
  quantity: string; label: string; unit: string; version: number; heading: string; question: string; ask: string; note: string
  feeds: { id: string; label: string; kind: 'figure' | 'aim' | 'limit' }[]; feeds_text: string | null; show: string
}
/** What "Show me Olumi's figure instead" answers (API.md, `POST …/figure-first/show`): Olumi's figure in its card's words, and its basis. */
export type FigureFirstShown = {
  quantity: string; label: string
  olumi: { text: string; title: string; basis: string; version: number; low: number; high: number; likely: number | null; unit: string }
}

/**
 * The writes, straight to core's v1 routes on this origin (View API design §2: no adapter). Each carries an op id where core takes one,
 * so a write re-sent after a dropped connection is saved once. After any of them the caller reads the View again.
 */
const scenarioPath = (sid: string) => `/api/scenarios/${encodeURIComponent(sid)}`
/** A first draft as core runs it (core API v1.26, AI jobs): accepted at once, then drafted in the server. `words` are core's, drawn verbatim. */
export type DraftJob = { id: number; kind: 'draft'; scenario: string; status: 'running' | 'done' | 'failed' | 'lost' | 'stopped'; stage: 'reading' | 'building' | 'analysing' | null
  words: string | null; reason: string | null; proposal: number | null; started: string; at: string }
/** What accepting a brief answers: `202` while its job runs, `200` when the same op replays a job that has ended (core API v1.26). */
export type DraftAccepted = { scenario: string; job: DraftJob | null; proposal: number | null; status_url: string | null }
/** A turn (core API v1.28: a message, a move, a challenge, a method question): accepted at once (`202`) and answered in core; the View's
 *  `turn` says where it stands, and the answer arrives as the conversation's newest turn. `200` when the same op replays an answered one. */
export type TurnAccepted = { scenario: string; job: { id: number; kind: 'turn'; status: 'running' | 'done' | 'failed' | 'lost'; words: string | null } | null; proposal: number | null; discussion: boolean | null; status_url: string | null }
export const writes = {
  create: (brief: string, op: string) => call<DraftAccepted>('POST', '/api/scenarios', { brief, op }),
  /** Try again (core API v1.26 `POST …/draft`): a new attempt on the scenario's saved brief, under a NEW op, after its draft failed or was lost. */
  redraft: (sid: string, op: string) => call<DraftAccepted>('POST', `${scenarioPath(sid)}/draft`, { op }),
  /** Stop (core API v1.34 `POST …/jobs/:id/stop`, body {}): the first draft's author stops it; answered as it stands if already ended. No AI call. */
  stopDraft: (sid: string, job: number) => call<DraftJob>('POST', `${scenarioPath(sid)}/jobs/${job}/stop`, {}),
  message: (sid: string, text: string, op: string) => call<TurnAccepted>('POST', `${scenarioPath(sid)}/messages`, { text, op }),
  challenge: (sid: string, kind: string, record: string, op: string) => call<TurnAccepted>('POST', `${scenarioPath(sid)}/challenge`, { kind, record, op }),
  /** What the team came for (core API `POST …/goal`, canon wave step 1): one of the View's `session.goals[].id`, or null to clear. No AI call. */
  goal: (sid: string, goal: string | null, op: string) => call<{ goal: number }>('POST', `${scenarioPath(sid)}/goal`, { goal, op }),
  /** "Let us give our figure first" (core API `GET …/figure-first`, wave step 4): the blind entry for the figure offered to this person, in
   *  core's words. It never carries Olumi's figure or its basis; reading it writes nothing. */
  figureFirstEntry: (sid: string) => call<FigureFirstEntry>('GET', `${scenarioPath(sid)}/figure-first`),
  /** Their figure, as typed, with their words (`POST …/figure-first`): stored as their own private view of that quantity; no model change. The
   *  body is exactly the route's (no op: core reads these fields only; a repeat after it was saved is core's 409, and the View then shows it). */
  figureFirstGive: (sid: string, quantity: string, version: number, text: string, typed: string) => call<{ contribution: number }>('POST', `${scenarioPath(sid)}/figure-first`, { quantity, version, text, typed }),
  /** "Show me Olumi's figure instead" (`POST …/figure-first/show`): Olumi's figure and basis for the offered quantity; the entry is not offered again. */
  figureFirstShow: (sid: string, quantity: string, version: number) => call<FigureFirstShown>('POST', `${scenarioPath(sid)}/figure-first/show`, { quantity, version }),
  /** "Write mine first" (core API `POST …/pre-mortem`, R19): their own reasons it could fail, 1 to `max_reasons` sentences; opens Olumi's stories for them alone. No AI call. */
  preMortem: (sid: string, reasons: string[]) => call<{ pre_mortem: number; state: 'wrote' }>('POST', `${scenarioPath(sid)}/pre-mortem`, { reasons }),
  /** "Show me Olumi's now" (`POST …/pre-mortem/show`): a logged choice that opens Olumi's stories for them alone; writes no reasons. No AI call. */
  preMortemShow: (sid: string) => call<{ state: 'chose' | 'wrote' }>('POST', `${scenarioPath(sid)}/pre-mortem/show`, {}),
  /** One plain question from the View's `session.methods` (core API `POST …/method`): a discussion-only turn, never a change to the model. */
  method: (sid: string, method: string, op: string, option?: string) => call<{ proposal: number | null; discussion?: boolean }>('POST', `${scenarioPath(sid)}/method`, option === undefined ? { method, op } : { method, op, option }),
  /**
   * The coach's next move, taken in one tap: a structured choice, never words (DL 16:36Z, option b). Core's route (API v1.12, "Taking the
   * offered coaching move by one tap", 400b672, in the View vendored at d1fe5e2): `{ move, at, op? }` with no `text`; the person's turn is
   * recorded as core's label for the move (`chat[].said`, with `choice: { move, label }`), and a move no longer the newest is `409`.
   */
  move: (sid: string, move: string, at: string | null, op: string) => call<{ proposal: number | null; discussion?: boolean }>('POST', `${scenarioPath(sid)}/messages`, { move, at, op }),
  /** The whole proposal, or (API v1.4/v1.8 "confirm selected") exactly the ticked lines: record ids in `only`, top-level fields in `only_top`.
   *  `only_readings`: the readings of Olumi's the person chose to use (the proposal's `marks[].reading.id`). Core reads a missing `only` or
   *  `only_top` as empty once `only_readings` is present, so a caller that sends readings always sends both lists with them (the type holds it). */
  approve: (proposal: number, base: number | null, pick?: { only: string[]; only_top: string[]; only_readings?: string[] }) =>
    call<unknown>('POST', `/api/proposals/${proposal}/approve`, pick === undefined ? { base } : { base, ...pick }),
  discard: (proposal: number) => call<unknown>('POST', `/api/proposals/${proposal}/discard`, {}),
  /** The person's own figure for one quantity, as they typed it (API v1.9 `typed`): core reads it as its page does, or refuses in the card's own ask. */
  edit: (sid: string, base: number, quantity: string, typed: string, op: string) => call<{ version: number; n: number; receipt: string }>('POST', `${scenarioPath(sid)}/edit`, { base, quantity, typed, op }),
  /**
   * PLACEHOLDER (INT-6 not posted yet): a person's "Yes" to a no-change reference wait row (`run.waits_on.items[].reference`): this option
   * uses the existing trends in this comparison. The route and body below are a guess at core's existing keyed-write shape (`base`,
   * the option's id, an `op`); the integrator's `### INT-6` names the real ones. ONLY THIS FUNCTION changes when it does. Until then the
   * route is unserved and the person is told in core's error words (nothing is saved).
   */
  confirmReference: (sid: string, base: number, option: string, op: string) => call<{ version: number; n: number; receipt: string }>('POST', `${scenarioPath(sid)}/reference`, { base, option, op }),
  /** R25: their own name for a card (DL contract 02:14Z): saved at once as a person-authored version, only the name changes. */
  rename: (sid: string, base: number, record: string, label: string, op: string) => call<{ version: number; n: number; receipt: string }>('POST', `${scenarioPath(sid)}/rename`, { base, record, label, op }),
  /** R25: one link taken off (core API, R25 7 Nov): the relation record core names on the line (`links[].remove.record`), saved at once. */
  /** R25 (core c63693bc, DL 7 Nov): the View's `links[].remove` object posted verbatim, `{ record, part }` (`part` null: the whole record;
   *  a part: that one added part of a sum). Core says in the version's own words what the removal leaves without effect. */
  removeLink: (sid: string, base: number, remove: { readonly record: string; readonly part?: string | null }, op: string) =>
    call<{ version: number; n: number; receipt: string }>('POST', `${scenarioPath(sid)}/links/remove`, { base, ...remove, op }),
  /** R25: a figure card in the person's own words (core API, R25 7 Nov): saved at once as their version; `record` is the new card's id. */
  addFigure: (sid: string, base: number, label: string, typed: string, unit: string | null, op: string) =>
    call<{ version: number; n: number; receipt: string; record: string }>('POST', `${scenarioPath(sid)}/figures`, unit === null ? { base, label, typed, op } : { base, label, typed, unit, op }),
}
