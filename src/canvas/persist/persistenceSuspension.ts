/**
 * ⭐⭐ A NON-PERSISTING SESSION, ENFORCED WHERE NO CALL SITE CAN ROUTE AROUND IT.
 *
 * WHY THIS EXISTS, and why the obvious cheaper fixes were rejected.
 *
 * The seeded canvas route (`CanvasFixture`) mounts the ORDINARY live canvas on a
 * captured graph. Its first version claimed *"it never writes — `skipAutosave`
 * and `skipHistory` are set, so a fixture can never reach a real scenario's
 * persisted state… closed by construction, not by convention."* **That claim was
 * false**, and an independent review (#1767, 2026-09-20) was right to refuse it:
 *
 *  - `skipAutosave` is an argument to `applyDraftResult` ALONE. It suppresses one
 *    immediate write. `ReactFlowGraph:1293` then mounts `useAutosave()` — with no
 *    arguments — whose 30-second timer and `pagehide`/`beforeunload` flush never
 *    see it, and which stamps the payload with `currentScenarioId`.
 *  - `CanvasFixture` never cleared that id, so a user who opened a real board and
 *    then navigated here could have the fixture graph written into the ordinary
 *    crash-recovery slot UNDER THEIR OWN SCENARIO ID — losing their work.
 *
 * ⛔ WHY NOT GATE THE WRITERS. Measured at this tip: `saveAutosave` alone has 15
 * call sites across 10 files, and **72 files in `src/` write to storage**. Every
 * one of those is a place a future change can add a 16th call site that nobody
 * remembers to gate. That is this estate's dominant defect — the hand-maintained
 * mirror (CLAUDE.md trap 12) — and a list of gated writers is exactly one.
 *
 * ⭐ SO THE SUSPENSION IS INSTALLED ON `Storage.prototype`. While it holds,
 * `setItem`/`removeItem`/`clear` are no-ops — on BOTH Web Storage areas at once,
 * since `localStorage` and `sessionStorage` share that prototype. Reads pass
 * through untouched: the fixture still needs flags and UI preferences. A writer
 * added tomorrow is covered on the day it is written, because it cannot reach
 * storage without calling one of those three methods.
 *
 * ⚠ AND THE INSTANCE IS THE WRONG PLACE — MEASURED, NOT ASSUMED. The first
 * version of this module assigned the stubs onto `localStorage` itself. That is
 * silently swallowed: a `Storage` object's named-property setter turns
 * `localStorage.setItem = fn` into a STORAGE WRITE under the key `"setItem"`
 * (Web Storage spec behaviour, not a jsdom quirk), so no stub is installed, the
 * write still lands, and every absence assertion passes by testing nothing. It
 * was caught by the positive control in the accompanying spec and by nothing
 * else — inspection agreed with the broken version. `Storage.prototype`'s
 * methods are plain writable, configurable properties and take the patch.
 *
 * ⚠ THE RESIDUAL HOLE, STATED: the named-property form (`localStorage.FOO = 1`)
 * bypasses `setItem` and is NOT refused. Swept at this tip: zero production call
 * sites use it — the only occurrence in `src/` is documentation text in
 * `PlcLab.tsx:60` telling a human to type it into a console. If that ever
 * changes, this guard does not cover it.
 *
 * ⭐ AND IT FAILS LOUD RATHER THAN SILENT. Every refused write is counted and its
 * key recorded (`refusals()`), so the surface can SHOW that isolation is doing
 * something. A guard that silently succeeds is indistinguishable from a guard
 * that was never installed — the instrument failure this estate keeps paying for
 * (trap 13). The fixture banner renders the count for exactly that reason.
 *
 * ⚠ SCOPE, STATED NARROWLY. This isolates WEB STORAGE. It is not a network fence
 * and not an IndexedDB fence. `CanvasFixture` closes the network path separately
 * and by a different mechanism — it clears `currentScenarioId`, which is the
 * condition `useServerGraphHydration` early-returns on (`:58`) — and that is a
 * different claim with a different proof. Named apart deliberately (trap 21); do
 * not read this module as a general sandbox.
 */

type MutatingMethod = 'setItem' | 'removeItem' | 'clear'
const MUTATORS: readonly MutatingMethod[] = ['setItem', 'removeItem', 'clear'] as const

export interface PersistenceRefusal {
  readonly method: MutatingMethod
  readonly key: string | null
}

interface ActiveSuspension {
  readonly reason: string
  readonly restore: Array<() => void>
  readonly refusals: PersistenceRefusal[]
}

let active: ActiveSuspension | null = null

function storagePrototype(): Storage | null {
  try {
    const ctor = (globalThis as { Storage?: { prototype?: Storage } }).Storage
    const proto = ctor?.prototype
    if (!proto || typeof proto.setItem !== 'function') return null
    return proto
  } catch {
    return null
  }
}

export function suspendPersistence(reason: string): () => void {
  if (active !== null) {
    if (active.reason !== reason) {
      throw new Error(
        `persistence is already suspended for "${active.reason}"; refusing a nested suspension for "${reason}"`,
      )
    }
    return () => {}
  }

  const suspension: ActiveSuspension = { reason, restore: [], refusals: [] }
  const proto = storagePrototype()

  if (proto) {
    for (const method of MUTATORS) {
      const previous = Object.getOwnPropertyDescriptor(proto, method)
      if (!previous || previous.configurable !== true) continue
      Object.defineProperty(proto, method, {
        ...previous,
        value: function refused(this: unknown, ...args: unknown[]) {
          suspension.refusals.push({
            method,
            key: method === 'clear' ? null : String(args[0] ?? ''),
          })
          return undefined
        },
      })
      // Restore the ORIGINAL descriptor, never a re-read of the patched one —
      // a restore that reads the polluted value re-pollutes silently
      // (CLAUDE.md trap 9h).
      suspension.restore.push(() => Object.defineProperty(proto, method, previous))
    }
  }

  active = suspension

  let released = false
  return () => {
    if (released) return
    released = true
    for (const undo of suspension.restore.slice().reverse()) undo()
    if (active === suspension) active = null
  }
}

/** Whether writes are currently being refused. */
export function isPersistenceSuspended(): boolean {
  return active !== null
}

/** The reason given by the holder, or `null`. */
export function persistenceSuspensionReason(): string | null {
  return active?.reason ?? null
}

/**
 * Every write refused so far under the CURRENT suspension.
 *
 * Read this to prove the guard is doing something: a fixture session that shows
 * zero refusals after the autosave timer has fired is reporting that it is not
 * installed, not that the canvas is quiet.
 */
export function persistenceRefusals(): readonly PersistenceRefusal[] {
  return active ? active.refusals.slice() : []
}
