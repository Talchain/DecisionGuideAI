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

/** What the person has opened: badges (card id → the records it holds) and every figure on or off. */
export interface Opened { readonly open: ReadonlyMap<string, readonly string[]>; readonly all: boolean }
export const NOTHING_OPENED: Opened = { open: new Map(), all: false }

export const VIEW_SCHEMA = 'olumi.view/2'
/** Core answered in a shape this page was not built for (a newer or older View): said, never drawn as if it were this one. */
export const VIEW_SHAPE_CHANGED = 'Olumi has been updated since this page loaded. Reload the page to continue.'

export function viewPath(sid: string, opened: Opened = NOTHING_OPENED): string {
  const q = new URLSearchParams()
  if (opened.open.size > 0) q.set('open', JSON.stringify(Object.fromEntries(opened.open)))
  if (opened.all) q.set('all', '1')
  const s = q.toString()
  return `/api/scenarios/${encodeURIComponent(sid)}/view${s ? `?${s}` : ''}`
}

export async function readView(sid: string, opened: Opened = NOTHING_OPENED): Promise<View> {
  const v = await call<{ schema?: unknown }>('GET', viewPath(sid, opened))
  if (v === null || typeof v !== 'object' || v.schema !== VIEW_SCHEMA) throw new TeamApiError(0, VIEW_SHAPE_CHANGED)
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
  approve: (proposal: number, base: number | null) => call<unknown>('POST', `/api/proposals/${proposal}/approve`, { base }),
  discard: (proposal: number) => call<unknown>('POST', `/api/proposals/${proposal}/discard`, {}),
}
