/**
 * ⭐⭐ THE BLACK-BOX RECORDER WAS NEVER WIRED TO THE BLACK-BOX RETRIEVAL.
 *
 * THE INCIDENT THIS EXISTS FOR. "Layout failed. Try again." has been an open
 * defect since 26 Aug 2026 (`layoutFailureIsSurvivable.spec.ts`, #860). Two
 * theories were raised and both were REFUTED by execution — bad graph input,
 * then a timing race. It stayed open for one mundane reason, recorded in
 * `canvasBreadcrumb.ts`: the rejection was logged under `import.meta.env.DEV`
 * only, and the incident happens on staging, which is a production build. So
 * the one artefact that could name the cause was discarded every single time.
 *
 * #1479 fixed the RECORDING on 11 Sep: `logCanvasBreadcrumb` writes to
 * `window.__SAFE_DEBUG__.logs`, a ring the page keeps, which survives the build
 * because it is an array push and not a `console.*` call.
 *
 * ⛔⛔ AND NOTHING READ IT BACK. Measured at `f22e15fd`: **33 write sites across
 * `src/`, and ZERO reads inside `src/components/debug/`.** The founder hit the
 * defect on 19 Sep, exported the bundle, and the cause was not in it — because
 * the only channel that had it was never connected to the only artefact a user
 * can hand over.
 *
 * ⚠⚠ WORSE, A COMMENT ASSERTED THE WIRE EXISTED. `main.tsx` said the ring is
 * *"re-read by the error boundary, the diagnostic bundle and the sandbox
 * banner"*. Two of those three are true. That sentence is why nobody checked —
 * the hand-maintained mirror at the top of CLAUDE.md, in the one place that
 * decides whether an incident is diagnosable. It is corrected in the same
 * commit as this file.
 *
 * ⛔ WHY THIS IS NOT `console_logs`, WHICH IS A DIFFERENT AND UNFIXABLE THING.
 * `console_logs_capture.unavailable_reason` is correct and stays: `console.*()`
 * call sites are stripped at BUILD time by two strippers in `vite.config.ts`,
 * one of them unconditional, and `ci:no-console` FAILS the build if any
 * survive. No interceptor can recover them. **This ring is not affected by any
 * of that**, which is precisely why #1479 chose it — and precisely why an empty
 * `console_logs` must never again be read as "no diagnostics available".
 */
import { redactPayload, scrubSecretsInString, DEBUG_BUNDLE_REDACTION_OPTIONS } from '../../../utils/payloadRedaction'

/** One ring entry, as `logCanvasBreadcrumb` and `main.tsx` both write it. */
export interface BreadcrumbEntry {
  /** `Date.now()` at the moment of the write. */
  t: number
  /** The message, e.g. `canvas:trace:layout:failed`. */
  m: string
  /** Structured detail. Redacted before it leaves the page. */
  data?: unknown
}

export interface CanvasBreadcrumbCapture {
  /**
   * Did the ring exist on `window` at export time?
   *
   * ⚠ SCOPE, stated because a boolean invites a wider reading than it earns:
   * `false` means no ring was found — the page had not booted far enough, or
   * this is a non-browser context. It does NOT mean "nothing went wrong".
   * `true` with `entries: []` means the ring existed and was empty, which is
   * the ordinary healthy state and is a DIFFERENT fact. The two were
   * indistinguishable in `console_logs` for months; they are not here.
   */
  available: boolean
  /** Entries in the ring before any selection. */
  total_in_ring: number
  /** Entries carried in this bundle. */
  entry_count: number
  /** True when selection dropped entries — so a gap is never silent. */
  truncated: boolean
  /**
   * How many of the carried entries matched {@link FAILURE_PATTERN}.
   *
   * ⭐ Reported so a reader can see at a glance whether this bundle contains a
   * failure at all, without scanning. Zero is a real and useful answer.
   */
  failure_count: number
  entries: BreadcrumbEntry[]
  /** Present only when `available` is false. */
  unavailable_reason?: string
}

/**
 * The entries that must survive selection whatever else is dropped.
 *
 * ⚠ DELIBERATELY BROAD, and the direction of the error is the point: a ring
 * dominated by `canvas:render` spam must not push the one `layout:failed`
 * entry out of the bundle. Over-keeping costs bytes; under-keeping costs
 * another month of an open incident.
 */
const FAILURE_PATTERN = /fail|error|throw|reject|declin|abort|crash|boot:|fatal|unhandled/i

/** Recent entries kept regardless of kind, so context around a failure survives. */
const RECENT_BUDGET = 150
/** Hard ceiling on carried entries, failures included. */
const MAX_ENTRIES = 400


/**
 * ⛔⛔ STRUCTURAL REDACTION IS NOT ENOUGH FOR THIS CARRIER, AND INDEPENDENT
 * REVIEW CAUGHT IT BEFORE IT SHIPPED.
 *
 * `redactPayload` masks values under SENSITIVE KEYS and truncates long strings.
 * It does not scrub secret-shaped content sitting INSIDE an ordinary string
 * value — and that is exactly what this ring carries. Real producers put
 * `Error.message` and `Error.stack` into plain `error` / `stack` keys
 * (`canvas/ErrorBoundary.tsx:134-139`, and `main.tsx`'s unhandled-rejection
 * path), and `boot:start` captures `location.href`. A captured error containing
 * `authorization=Bearer <token>` would therefore have left the page verbatim.
 *
 * ⚠ THE KEY IS THE WRONG THING TO MATCH ON HERE. `payloadRedaction`'s own note
 * already says so about the bundle's captured message text: *"it must scrub it
 * by VALUE — there is no key to match on."* A diagnostic carrier is the same
 * case, and a new export boundary is precisely where that distinction must be
 * applied rather than assumed.
 *
 * ⭐ IT REUSES `scrubSecretsInString` RATHER THAN ADDING A POLICY. That module
 * states the rule for its own existence — *"two scrubbers would drift, and the
 * weaker one would be the one that shipped."* This is the third consumer and it
 * introduces no redaction policy, no framework, and no new pattern list.
 *
 * ⚠ MEANINGFUL FAILURE EVIDENCE SURVIVES. The scrubber replaces only the
 * matched secret, so `TypeError: Failed to fetch dynamically imported module …`
 * is untouched and still names the cause. That is the whole point: a redaction
 * that destroyed the diagnostic would defeat the carrier it protects.
 */
function scrubStrings(value: unknown, seen: WeakSet<object> = new WeakSet()): unknown {
  if (typeof value === 'string') return scrubSecretsInString(value)
  if (value === null || typeof value !== 'object') return value
  // ⛔⛔ A DEPTH BOUND HERE RETURNED THE VALUE UNINSPECTED, AND THAT LET THE
  // SAME SECRET THROUGH. Independent review traced it: this walk was bounded at
  // depth 8, but `DEBUG_BUNDLE_REDACTION_OPTIONS.neverRedactKeys` includes
  // `observed_state`, `goal_constraints` and `constraint_analysis`, and
  // `redactValue` RESETS DEPTH at those keys — so the structural pass admits
  // content at absolute depth 9 and beyond. Its witness:
  //   {a:{b:{c:{d:{e:{f:{g:{observed_state:{error:"authorization=Bearer …"}}}}}}}}}
  // reached `error` at depth 9 and was returned with the bearer bytes intact.
  //
  // ⭐ THE RULE THAT REPLACES IT: scrub every string the structural pass
  // ADMITS, and never hand back a value this pass declined to inspect. Cycles
  // are handled by identity rather than by depth, so there is no bound left to
  // be wrong about — a revisited object returns `undefined`, which drops the
  // loop rather than smuggling it past the scrubber.
  if (seen.has(value as object)) return undefined
  seen.add(value as object)
  if (Array.isArray(value)) return value.map(v => scrubStrings(v, seen))
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    out[k] = scrubStrings(v, seen)
  }
  return out
}

/**
 * Read the ring, keep what a diagnostician needs, and never throw.
 *
 * ⛔ IT MUST NEVER THROW — the same rule `canvasBreadcrumb.ts` states for the
 * writer, for the same reason: a diagnostic that breaks the export it belongs
 * to is worse than none. A user chasing a defect would lose the whole bundle.
 */
export function collectCanvasBreadcrumbs(): CanvasBreadcrumbCapture {
  try {
    const win = typeof window === 'undefined' ? undefined : (window as unknown as {
      __SAFE_DEBUG__?: { logs?: unknown[] }
    })
    const raw = win?.__SAFE_DEBUG__?.logs
    if (!Array.isArray(raw)) {
      return {
        available: false,
        total_in_ring: 0,
        entry_count: 0,
        truncated: false,
        failure_count: 0,
        entries: [],
        unavailable_reason:
          'no_ring_on_window: window.__SAFE_DEBUG__.logs was absent or not an array at export time. '
          + 'The ring is created by the first statement of boot in main.tsx, so this means the page did not '
          + 'reach that point, or this export ran outside a browser. It does NOT mean no diagnostics occurred.',
      }
    }

    const entries = raw.filter(
      (e): e is BreadcrumbEntry =>
        typeof e === 'object' && e !== null && typeof (e as BreadcrumbEntry).m === 'string',
    )

    // Keep every failure, plus the most recent window for context around it.
    const failures = entries.filter(e => FAILURE_PATTERN.test(e.m))
    const recent = entries.slice(-RECENT_BUDGET)
    const keptSet = new Set<BreadcrumbEntry>([...failures, ...recent])
    // Chronological, and capped from the END so the newest survive a full ring.
    const kept = entries.filter(e => keptSet.has(e)).slice(-MAX_ENTRIES)

    return {
      available: true,
      total_in_ring: raw.length,
      entry_count: kept.length,
      truncated: kept.length < entries.length,
      failure_count: kept.filter(e => FAILURE_PATTERN.test(e.m)).length,
      // The ring carries `location.href` and store snapshots, so it goes through
      // the SAME redactor as every other payload in this bundle rather than a
      // second policy that could drift from it.
      entries: kept.map(e => ({
        t: typeof e.t === 'number' ? e.t : 0,
        m: scrubSecretsInString(e.m),
        ...(e.data === undefined
          ? {}
          : { data: scrubStrings(redactPayload(e.data, DEBUG_BUNDLE_REDACTION_OPTIONS)) }),
      })),
    }
  } catch (err) {
    return {
      available: false,
      total_in_ring: 0,
      entry_count: 0,
      truncated: false,
      failure_count: 0,
      entries: [],
      unavailable_reason: `collector_threw: ${String(err)}`,
    }
  }
}
