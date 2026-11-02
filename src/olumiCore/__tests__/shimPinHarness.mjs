// A full-response pin for the shim with every core flag off: the same battery is run against 6fc742e's shim files (extracted with `git archive`, never
// from the tree under test) to make fixtures/pin-shim-flag-off.json, and against the tree under test by shimFlagOff.spec.mjs. Nothing here calls the AI or a
// server: the "core" is a function that answers from a fixed, captured scenario view (./fixtures/view-*.json), none of which carries a science field.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const fx = (n) => JSON.parse(fs.readFileSync(path.join(here, 'fixtures', n), 'utf8'))
const clone = (x) => JSON.parse(JSON.stringify(x))

export const PIN_FIXTURES = ['view-approved', 'view-approved-with-change', 'view-first-pending', 'view-markers-v1', 'view-markers-v2', 'view-rich-approved', 'view-rich-pending']
const CTX = { token: 'tok', aliases: [] }
/** A response as pinned: the one value that differs on every call (the request id) is named, not compared. */
const settled = (r) => JSON.parse(JSON.stringify(r, (k, v) => (k === 'request_id' && typeof v === 'string' ? 'REQUEST-ID' : v)))

/**
 * `libDir`: a directory holding turn.mjs and ids.mjs (a shim's `lib`). Returns every response of the battery by name.
 * For each captured view: the saved-model read (`graphRead`), the "Run analysis" turn (the Run view and the thread, no write), and for a
 * first model waiting on a card: approving it (the write, then the re-read), and setting it aside.
 */
export async function runShimBattery(libDir) {
  const { makeShim } = await import(pathToFileURL(path.join(libDir, 'turn.mjs')).href)
  const { derivedUuidOfSid, propIdOf } = await import(pathToFileURL(path.join(libDir, 'ids.mjs')).href)
  const out = {}
  for (const name of PIN_FIXTURES) {
    const view = fx(`${name}.json`)
    const uuid = derivedUuidOfSid(view.id)
    const shim = makeShim({ core: async () => clone(view) })
    out[`graphRead ${name}`] = settled(await shim.graphRead(CTX, uuid))
    out[`run_analysis ${name}`] = settled(await shim.turn(CTX, { scenario_id: uuid, turn_id: 'turn-pinned', chip: { action_type: 'run_analysis' } }))
  }
  // A first model waiting on its card: "Looks right" saves it (core re-runs it), then the shim re-reads; "Not now" sets it aside.
  const pending = fx('view-first-pending.json'), approved = fx('view-approved.json')
  const sid = pending.id, uuid = derivedUuidOfSid(sid)
  const chipId = propIdOf(sid, pending.pending.id)
  let saved = false
  const core = async (method, p) => {
    if (method === 'POST' && /\/approve$/.test(p)) { saved = true; return { version: approved.version.id, n: approved.version.n, receipt: {} } }
    if (method === 'POST' && /\/discard$/.test(p)) { saved = true; return { receipt: {} } }
    if (/\/versions$/.test(p)) return { versions: [] }
    return clone(saved ? { ...approved, id: sid } : pending)
  }
  out['approve first model'] = settled((await makeShim({ core }).turn(CTX, { scenario_id: uuid, turn_id: 'turn-pinned', chip: { id: `agent-approve-proposal:${chipId}` } })).out)
  saved = false
  out['decline first model'] = settled((await makeShim({ core }).turn(CTX, { scenario_id: uuid, turn_id: 'turn-pinned', chip: { id: `agent-decline-proposal:${chipId}` } })).out)
  return out
}
