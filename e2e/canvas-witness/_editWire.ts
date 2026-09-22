/**
 * ⛔⛔⛔ AN EDIT WITNESS THAT READS ONLY THE RELOADED VALUE IS MEASURING A
 * COMPONENT, NOT THE SYSTEM. Shared by `persistAuthorship` and
 * `renamePersistence`, 22 Sep 2026.
 *
 * What it cost not to have this: a four-hour diagnosis on 22 Sep 2026.
 *  · `renamePersistence` printed PASS while the served backend REFUSED the
 *    rename — the Agent route answered `unsupported_kind`, and the label
 *    survived the reload only because the UI posted its whole local graph to
 *    `/bff/cee/scenarios/{id}/graph/register` in the same millisecond.
 *  · A value-edit FAIL was blamed on CEE's `dispatchFactorValueEdit`; the
 *    748-byte response it was blamed on carried an `_agent` key, which only the
 *    Agent route emits. The component named was never on the path.
 *  · After the route was restored, a whole-graph `register` sent in the same
 *    millisecond as the edit turn moved the stored graph under it: CEE's CAS
 *    rolled the edit back (500 `system_event_commit_failed`), but the register
 *    had already stored the user's number under Olumi's authorship.
 * Evidence: output/canvas-review-20260922/EVIDENCE-edits-refused-on-served-staging.md
 *
 * So every edit leg now records, FROM THE WIRE, four things, and prints one
 * line per clause:
 *   1. ROUTE        — which backend route answered (an `_agent` key ⇒ the Agent
 *                     route ⇒ the Canvas edit protocol was not measured).
 *   2. RECEIPT      — the HTTP status and what the response says it did.
 *   3. SIDE-CHANNEL — every `graph/register` sent from the edit gesture until
 *                     5 s after the turn's response, timed against the turn,
 *                     and whether it carried the edited value UNCONFIRMED.
 *   4. SETTLEMENT   — the store after settlement and after a reload (in the
 *                     spec, because what "settled" means differs per edit).
 *
 * ⚠ TWO CLOCKS, BOTH PRINTED, AND ONLY ONE DECIDES. "Before the response" is
 *   judged on the BROWSER's clock (`request.timing()`: the register's start vs
 *   the turn's last response byte) — one clock for both, so no skew. Offsets
 *   from the turn's REQUEST are printed twice: from the browser's `startTime`
 *   and from the order the page EMITTED them (`seq`, plus a Node timestamp at
 *   the event). Read `seq` for "which was sent first": on 22 Sep the
 *   cross-origin turn was emitted at +86 ms but its `startTime` read +403 ms
 *   (likely its CORS preflight — UNVERIFIED), so a register emitted 5 ms AFTER
 *   the turn read 314 ms BEFORE it on `startTime`.
 * ⚠ SCOPE IS ORDERING, NOT A CLOCK. A register is "in the window" if the
 *   browser emitted it after the edit gesture's mark (event order, no skew) and
 *   it started no later than 5 s after the turn's response ended.
 */
import type { Page, Request, Response } from '@playwright/test'

export type Verdict = 'PASS' | 'FAIL' | 'NOT-MEASURED'

export interface ClauseResult {
  verdict: Verdict
  detail: string
  /**
   * A NOT-MEASURED that VOIDS the whole run: the backend answered from the
   * wrong route, or never answered (transport / gateway). Distinct from "no
   * edit turn was ever sent", which is itself a fact about the Canvas — there,
   * the other clauses still stand and a FAIL among them is the verdict.
   */
  voids?: boolean
}

/** `/proxy/v5/turn` and its streamed twin. Path-anchored so `/turning` cannot pass. */
const TURN_PATH = /\/proxy\/v5\/turn(?:\/stream)?$/
/** The side-channel. Same literal the product builds (`registerScenarioGraph.ts`). */
const REGISTER_PATH = /\/bff\/cee\/scenarios\/[^/]+\/graph\/register$/
/**
 * CONTRAST FAMILY for the listener: the same `/bff/cee/scenarios/` edge the
 * register lives on (the reload's graph READ travels it). A listener that saw
 * none of this family cannot support "no register was sent".
 */
const BFF_SCENARIO_FAMILY = /\/bff\/cee\/scenarios\//

export interface WireCall {
  seq: number
  url: string
  path: string
  /** Node epoch ms when the page EMITTED the request event — event order, preflight-independent. */
  seenMs: number
  /** Browser wall-clock epoch ms at request start (`request.timing().startTime`), else Node's. */
  startMs: number
  /** Which clock `startMs`/`endMs` came from. A `node` fallback is printed, never hidden. */
  timingSrc: 'browser' | 'node'
  /** Browser wall-clock epoch ms at the last response byte, else Node's at finish. */
  endMs: number | null
  status: number | null
  failure: string | null
  reqBody: unknown
  resText: string | null
  resJson: unknown
  done: boolean
}

function pathOf(url: string): string {
  try { return new URL(url).pathname } catch { return url }
}
function parse(text: string | null): unknown {
  if (text == null) return null
  try { return JSON.parse(text) } catch { return null }
}
/** An SSE body: the last `data:` line that parses as an object carrying `blocks` or `assistant_text`. */
function parseMaybeSse(text: string | null): unknown {
  const direct = parse(text)
  if (direct !== null) return direct
  if (text == null || !/^data:/m.test(text)) return null
  let found: unknown = null
  for (const line of text.split('\n')) {
    if (!line.startsWith('data:')) continue
    const j = parse(line.slice(5).trim()) as Record<string, unknown> | null
    if (j && typeof j === 'object' && ('blocks' in j || 'assistant_text' in j)) found = j
  }
  return found
}

export interface EditWire {
  turns: WireCall[]
  registers: WireCall[]
  /** Every POST path the page emitted, in order — the listener's own contrast control. */
  allPosts: Array<{ seq: number; seenMs: number; path: string }>
  bffFamilySeen: () => number
  /** Snapshot the event order BEFORE the gesture. */
  mark: () => { turns: number; registers: number }
  /** Wait for the first turn after `mark` whose request body satisfies `match`, to a complete response. */
  waitForTurn: (
    mark: { turns: number },
    match: (body: Record<string, unknown>) => boolean,
    timeoutMs: number,
  ) => Promise<WireCall | null>
  /** Registers emitted after `mark` that started no later than 5 s after `turn` ended. */
  registersInWindow: (mark: { registers: number }, turn: WireCall | null) => WireCall[]
  /** Let in-flight body reads finish (a reload aborts them otherwise). */
  drain: () => Promise<void>
}

export function captureEditWire(page: Page): EditWire {
  const turns: WireCall[] = []
  const registers: WireCall[] = []
  const byRequest = new Map<Request, WireCall>()
  const pending: Array<Promise<void>> = []
  const allPosts: Array<{ seq: number; seenMs: number; path: string }> = []
  let seq = 0
  let bff = 0

  const finish = (req: Request, call: WireCall, fallbackEnd: number) => {
    const t = req.timing()
    const browser = t.startTime > 0 && t.responseEnd >= 0
    if (t.startTime > 0) call.startMs = t.startTime
    call.endMs = browser ? t.startTime + t.responseEnd : fallbackEnd
    call.timingSrc = browser ? 'browser' : 'node'
  }

  page.on('request', (req) => {
    if (req.method() !== 'POST') return
    const path = pathOf(req.url())
    if (BFF_SCENARIO_FAMILY.test(path)) bff += 1
    const isTurn = TURN_PATH.test(path)
    const isRegister = REGISTER_PATH.test(path)
    allPosts.push({ seq: ++seq, seenMs: Date.now(), path })
    if (!isTurn && !isRegister) return
    const call: WireCall = {
      seq, url: req.url(), path, seenMs: Date.now(), startMs: Date.now(), timingSrc: 'node',
      endMs: null, status: null, failure: null, reqBody: parse(req.postData()), resText: null,
      resJson: null, done: false,
    }
    byRequest.set(req, call)
    ;(isTurn ? turns : registers).push(call)
  })

  page.on('requestfinished', (req) => {
    const call = byRequest.get(req)
    if (!call) return
    const p = (async () => {
      const res: Response | null = await req.response().catch(() => null)
      call.status = res?.status() ?? null
      if (res && TURN_PATH.test(call.path)) {
        call.resText = await res.text().catch(() => null)
        call.resJson = parseMaybeSse(call.resText)
      }
      finish(req, call, Date.now())
      call.done = true
    })()
    pending.push(p)
  })

  page.on('requestfailed', (req) => {
    const call = byRequest.get(req)
    if (!call) return
    call.failure = req.failure()?.errorText ?? 'failed'
    finish(req, call, Date.now())
    call.done = true
  })

  return {
    turns,
    registers,
    allPosts,
    bffFamilySeen: () => bff,
    mark: () => ({ turns: turns.length, registers: registers.length }),
    waitForTurn: async (mark, match, timeoutMs) => {
      const deadline = Date.now() + timeoutMs
      while (Date.now() < deadline) {
        const hit = turns.slice(mark.turns).find((t) => {
          const b = t.reqBody as Record<string, unknown> | null
          return b != null && typeof b === 'object' && match(b)
        })
        if (hit?.done) return hit
        await page.waitForTimeout(250)
      }
      return turns.slice(mark.turns).find((t) => {
        const b = t.reqBody as Record<string, unknown> | null
        return b != null && typeof b === 'object' && match(b)
      }) ?? null
    },
    registersInWindow: (mark, turn) => {
      const after = registers.slice(mark.registers)
      if (!turn || turn.endMs == null) return after
      const until = turn.endMs + 5_000 // browser clock, same as r.startMs
      return after.filter((r) => r.startMs <= until)
    },
    drain: async () => { await Promise.allSettled(pending) },
  }
}

// ── CLAUSE 1 — ROUTE ────────────────────────────────────────────────────────

/**
 * The orchestrator answers without `_agent`; `/agent/v1/turn` always adds it.
 * An `_agent` key is NOT-MEASURED for the Canvas — the edit went to a route
 * that is not the Canvas edit protocol — and never a FAIL of the Canvas.
 * CONTROL: the response must parse and carry at least one known top-level key,
 * or the absence of `_agent` proves nothing.
 */
export function routeClause(turn: WireCall | null): ClauseResult {
  if (!turn) return { verdict: 'NOT-MEASURED', detail: 'no edit turn reached the wire — there is no route to name (the Canvas never sent the edit; the other clauses still stand)' }
  if (turn.failure) return { verdict: 'NOT-MEASURED', voids: true, detail: `edit turn failed in transport (${turn.failure})` }
  const j = turn.resJson as Record<string, unknown> | null
  if (!j || typeof j !== 'object') {
    return { verdict: 'NOT-MEASURED', voids: true, detail: `response body unreadable as JSON (HTTP ${turn.status}, ${turn.resText?.length ?? 0} bytes): ${JSON.stringify((turn.resText ?? '').slice(0, 160))}` }
  }
  const keys = Object.keys(j)
  const known = keys.filter((k) => ['assistant_text', 'blocks', 'error', 'code', 'turn_id', 'draft_graph', 'graph_hash'].includes(k))
  if (known.length === 0) return { verdict: 'NOT-MEASURED', voids: true, detail: `CONTROL did not fire — no known top-level key in ${JSON.stringify(keys)}` }
  if ('_agent' in j) {
    return { verdict: 'NOT-MEASURED', voids: true, detail: `SERVED BY THE AGENT ROUTE (/agent/v1/turn): _agent=${JSON.stringify(j._agent)} — the Canvas edit protocol was not measured; this is not a Canvas FAIL` }
  }
  return { verdict: 'PASS', detail: `not the Agent route — ${turn.path} HTTP ${turn.status}, no _agent among top-level keys ${JSON.stringify(keys)}` }
}

// ── CLAUSE 2 — RECEIPT (helpers; the verdict rule lives in each spec) ───────

export function isGatewayStatus(status: number | null): boolean {
  return status === 502 || status === 503 || status === 504
}

export function errorCodeOf(turn: WireCall): string {
  const j = turn.resJson as Record<string, unknown> | null
  const e = (j?.error ?? null) as Record<string, unknown> | string | null
  const code = (typeof e === 'object' && e ? (e.code ?? e.type) : e) ?? j?.code ?? null
  return code == null ? JSON.stringify((turn.resText ?? '').slice(0, 200)) : String(code)
}

export function blocksOf(turn: WireCall | null): Array<Record<string, unknown>> {
  const b = (turn?.resJson as Record<string, unknown> | null)?.blocks
  return Array.isArray(b) ? (b as Array<Record<string, unknown>>) : []
}

// ── CLAUSE 3 — SIDE-CHANNEL ─────────────────────────────────────────────────

export interface RegisterRow {
  seq: number
  /** Emitted after the turn (by page event order)? */
  emittedAfterTurn: boolean | null
  relToTurnEventMs: number | null
  relToTurnStartMs: number | null
  relToTurnEndMs: number | null
  status: number | null
  failure: string | null
  nodePresent: boolean
  node: { value?: unknown; source?: unknown; label?: unknown } | null
  carriesEdited: boolean
  beforeResponse: boolean
  unconfirmed: boolean
}

function nodeInRegister(body: unknown, nodeId: string): Record<string, unknown> | null {
  const nodes = ((body as { graph?: { nodes?: unknown } } | null)?.graph?.nodes)
  if (!Array.isArray(nodes)) return null
  return (nodes as Array<Record<string, unknown>>).find((n) => n?.id === nodeId) ?? null
}

/**
 * ⛔ THE RULE: a register may carry the edited value only AFTER the backend
 * confirmed it. Sent before the turn's response ended, or after a response
 * that did not confirm, a register carrying the edited value is a second
 * writer storing a number the edit protocol has not accepted — under whatever
 * authorship the local node holds.
 */
export function sideChannelRows(
  regs: WireCall[],
  turn: WireCall | null,
  nodeId: string,
  carries: (node: Record<string, unknown>) => boolean,
  confirmed: boolean,
): RegisterRow[] {
  return regs.map((r) => {
    const n = nodeInRegister(r.reqBody, nodeId)
    const obs = (n?.observed_state ?? null) as Record<string, unknown> | null
    const carriesEdited = n != null && carries(n)
    const beforeResponse = turn?.endMs == null ? true : r.startMs < turn.endMs
    return {
      seq: r.seq,
      emittedAfterTurn: turn ? r.seq > turn.seq : null,
      relToTurnEventMs: turn ? Math.round(r.seenMs - turn.seenMs) : null,
      relToTurnStartMs: turn ? Math.round(r.startMs - turn.startMs) : null,
      relToTurnEndMs: turn?.endMs != null ? Math.round(r.startMs - turn.endMs) : null,
      status: r.status,
      failure: r.failure,
      nodePresent: n != null,
      node: n ? { value: obs?.value, source: obs?.source, label: n.label } : null,
      carriesEdited,
      beforeResponse,
      unconfirmed: carriesEdited && (beforeResponse || !confirmed),
    }
  })
}

export function sideChannelClause(rows: RegisterRow[], bffFamilySeen: number): ClauseResult {
  const bad = rows.filter((r) => r.unconfirmed)
  if (bad.length > 0) {
    const why = bad.map((r) => `#${r.seq} ${r.emittedAfterTurn === null ? 'with NO edit turn ever sent' : `${r.beforeResponse ? 'BEFORE the turn response' : 'after a NON-CONFIRMING response'} (${r.emittedAfterTurn ? 'emitted after' : 'emitted BEFORE'} the turn request; ${r.relToTurnEndMs}ms from its response end)`} value=${JSON.stringify(r.node?.value)} source=${JSON.stringify(r.node?.source)} label=${JSON.stringify(r.node?.label)} → HTTP ${r.status ?? r.failure}`).join('; ')
    return { verdict: 'FAIL', detail: `${bad.length} of ${rows.length} register(s) carried the UNCONFIRMED edited value: ${why}` }
  }
  const unreadable = rows.filter((r) => !r.nodePresent)
  if (rows.length > 0 && unreadable.length === rows.length) {
    return { verdict: 'NOT-MEASURED', voids: true, detail: `CONTROL did not fire — ${rows.length} register(s) fired but none carried the edited node id, so their payload could not be judged` }
  }
  if (rows.length === 0 && bffFamilySeen === 0) {
    return { verdict: 'NOT-MEASURED', voids: true, detail: 'CONTROL did not fire — no register in the window AND the listener saw no /bff/cee/scenarios/ request all session, so "none sent" is unfalsified' }
  }
  return { verdict: 'PASS', detail: `${rows.length} register(s) in the window, none carrying an unconfirmed edited value (listener contrast: ${bffFamilySeen} /bff/cee/scenarios/ POSTs seen this session)` }
}

export function printRegisterRows(tag: string, rows: RegisterRow[]): void {
  if (rows.length === 0) { console.log(`${tag} SIDE-CHANNEL registersInWindow=0`); return }
  for (const r of rows) {
    console.log(`${tag} SIDE-CHANNEL register#${r.seq} emittedAfterTurn=${r.emittedAfterTurn} t=${r.relToTurnEventMs}ms from turn request event, ${r.relToTurnStartMs}ms from turn startTime, ${r.relToTurnEndMs}ms from turn response end; HTTP ${r.status ?? r.failure}; node=${JSON.stringify(r.node)} carriesEdited=${r.carriesEdited} beforeResponse=${r.beforeResponse} UNCONFIRMED=${r.unconfirmed}`)
  }
}

/** Every captured turn and register, in emission order, timed against `zero` (the gesture). */
export function printWireLog(tag: string, wire: EditWire, zeroMs: number): void {
  const postsAfter = wire.allPosts.filter((p) => p.seenMs >= zeroMs)
  console.log(`${tag} WIRE postsSinceGesture=${postsAfter.length} ${JSON.stringify(postsAfter.map((p) => `#${p.seq} +${p.seenMs - zeroMs}ms ${p.path}`))}`)
  const all = [...wire.turns.map((c) => ({ k: 'turn', c })), ...wire.registers.map((c) => ({ k: 'register', c }))]
    .sort((a, b) => a.c.seq - b.c.seq)
  for (const { k, c } of all) {
    console.log(`${tag} WIRE #${c.seq} ${k.padEnd(8)} event=${c.seenMs - zeroMs}ms start=${Math.round(c.startMs - zeroMs)}ms end=${c.endMs == null ? 'n/a' : `${Math.round(c.endMs - zeroMs)}ms`} (${c.timingSrc} clock) HTTP ${c.status ?? c.failure ?? 'in-flight'} ${c.path}`)
  }
}

// ── ROLL-UP ─────────────────────────────────────────────────────────────────

/**
 * 1. Any VOIDING NOT-MEASURED (Agent route, transport, gateway, a control that
 *    did not fire) ⇒ NOT-MEASURED: the run says nothing about the Canvas.
 * 2. Else any FAIL ⇒ FAIL, naming the clause(s).
 * 3. Else any other NOT-MEASURED (e.g. no edit turn was ever sent) ⇒ NOT-MEASURED.
 * 4. Else PASS.
 */
export function rollUp(clauses: Record<string, ClauseResult>): { verdict: Verdict; why: string } {
  const voiding = Object.keys(clauses).filter((k) => clauses[k].verdict === 'NOT-MEASURED' && clauses[k].voids)
  if (voiding.length > 0) return { verdict: 'NOT-MEASURED', why: `voided by: ${voiding.join(', ')}` }
  const failing = Object.keys(clauses).filter((k) => clauses[k].verdict === 'FAIL')
  if (failing.length > 0) return { verdict: 'FAIL', why: `failing clause(s): ${failing.join(', ')}` }
  const other = Object.keys(clauses).filter((k) => clauses[k].verdict === 'NOT-MEASURED')
  if (other.length > 0) return { verdict: 'NOT-MEASURED', why: `not measured: ${other.join(', ')}` }
  return { verdict: 'PASS', why: 'every clause PASS' }
}

export function printClauses(tag: string, clauses: Record<string, ClauseResult>): void {
  for (const [k, c] of Object.entries(clauses)) console.log(`${tag} CLAUSE ${k.padEnd(12)} ${c.verdict} — ${c.detail}`)
}
