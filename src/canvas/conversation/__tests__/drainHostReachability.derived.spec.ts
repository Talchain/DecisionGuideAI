/**
 * DRAIN-HOST REACHABILITY — DERIVED, not hand-listed.
 *
 * ⚠ WHY THIS FILE EXISTS ALONGSIDE `panelApplyReachability.production.spec.tsx`.
 * That spec pins two drains' mounts by hand-written `expect(source).toContain(…)`
 * greps — one `it` per drain, added the day each defect was found. It is exactly
 * the hand-maintained mirror CLAUDE.md trap 12 is about: it can only ever prove
 * that the drains SOMEONE REMEMBERED TO LIST are hosted, and it reads green for
 * a drain nobody thought to add. DraftChat hosts FOUR conversation drains; that
 * spec covers TWO, and the two it does not cover are both DARK on the deployed
 * flag posture.
 *
 * So this file derives the list instead:
 *
 *   1. THE DRAIN SET comes from `DraftChat.tsx`'s own imports — every
 *      `use*Events` / `use*Drain` it pulls from `../conversation/`. Add a fifth
 *      drain to DraftChat and it appears here on the next run, with no edit.
 *   2. THE FLAG-ON HOST SET is walked, not asserted: the `aiPanelV2` branch of
 *      `MaybeConversationProvider` in `ReactFlowGraph.tsx` is sliced out, every
 *      component it mounts is resolved to its file through ReactFlowGraph's own
 *      imports, and each of those files is read for drain CALLS.
 *   3. DARK = (1) minus (2), and it must equal `KNOWN_DARK_DRAINS` EXACTLY.
 *
 * ⚠ EXACTLY, IN BOTH DIRECTIONS, AND THE SHRINK MATTERS AS MUCH AS THE GROWTH.
 * A GROWN set means a drain has gone dark — the defect
 * `StructuralDeleteDrainHost` was written to close, recurring. A SHRUNK set
 * means someone has re-hosted a known-dark drain, which is a BEHAVIOUR CHANGE
 * (see the two assessments recorded beneath `KNOWN_DARK_DRAINS`), not a tidy-up
 * — it must be a conscious edit to this set, with those costs re-read, rather
 * than something that lands silently under a green suite.
 *
 * ⚠ THIS FILE MAKES NO CLAIM THAT A DARK DRAIN SHOULD BE RE-HOSTED. It records
 * which are dark and what that costs. Re-hosting is its own decision.
 *
 * The flag posture that makes "flag-ON" the real one: `aiPanelV2`
 * `defaultValue: true` (`flags.ts`), and `ReactFlowGraph.tsx` renders DraftChat
 * only under `{!isAiPanelV2Enabled() && <DraftChat />}` — so for every fresh
 * user DraftChat is not mounted and its drains run only in the rollback posture.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

const DRAFT_CHAT = 'src/canvas/components/DraftChat.tsx'
const CANVAS_ROOT = 'src/canvas/ReactFlowGraph.tsx'

/**
 * A conversation drain: a hook whose job is to put queued canvas state on the
 * wire.
 *
 * ⚠ `Events?`, NOT `Events`. The brief that commissioned this spec described the
 * family as `use*Events` / `use*Drain` and put the count at four. Both halves of
 * the plural matter: `useAnalysisCompleteEvent` and `useSessionResumeEvent` are
 * SINGULAR, so a `Events`-only pattern silently enumerates three of five —
 * including one it was written to pin. The count is five, and it is derived
 * here rather than stated, which is the entire point of the file.
 */
const DRAIN_NAME = /^use[A-Z][A-Za-z0-9]*(?:Events?|Drain)$/

function read(repoRelative: string): string {
  return readFileSync(resolve(process.cwd(), repoRelative), 'utf8')
}

/** Every `import { … } from '…'` in a source file, as (specifiers, module). */
function imports(source: string): Array<{ names: string[]; module: string }> {
  const out: Array<{ names: string[]; module: string }> = []
  const re = /import\s*\{([^}]*)\}\s*from\s*'([^']+)'/g
  for (const m of source.matchAll(re)) {
    const names = m[1]
      .split(',')
      .map((n) => n.trim().split(/\s+as\s+/).pop()!.trim())
      .filter((n) => n.length > 0)
    out.push({ names, module: m[2] })
  }
  return out
}

/** Resolve a relative import to a repo-relative `.tsx`/`.ts` path, or null. */
function resolveLocal(fromRepoRelative: string, module: string): string | null {
  if (!module.startsWith('.')) return null
  const base = resolve(process.cwd(), dirname(fromRepoRelative), module)
  for (const ext of ['.tsx', '.ts']) {
    try {
      readFileSync(base + ext, 'utf8')
      return base + ext
    } catch {
      /* try the next extension */
    }
  }
  return null
}

function callsHook(source: string, hookName: string): boolean {
  return new RegExp(`\\b${hookName}\\s*\\(`).test(source)
}

// ── 1. THE DRAIN SET, from DraftChat's own imports ─────────────────────────
function enumerateDrains(): string[] {
  const source = read(DRAFT_CHAT)
  const names = new Set<string>()
  for (const { names: specifiers, module } of imports(source)) {
    if (!module.startsWith('../conversation/')) continue
    for (const n of specifiers) if (DRAIN_NAME.test(n)) names.add(n)
  }
  return [...names].sort()
}

// ── 2. THE FLAG-ON HOST SET, walked from the canvas root ───────────────────
function flagOnProviderBlock(): string {
  const source = read(CANVAS_ROOT)
  const open = source.indexOf('<ConversationProvider>')
  const close = source.indexOf('</ConversationProvider>')
  // A structural precondition, asserted rather than assumed: if the provider is
  // renamed or restructured, this returns an empty string and EVERY drain reads
  // dark — an instrument failure that would otherwise look like a finding
  // (trap 20: uniformity is evidence about the probe).
  if (open === -1 || close === -1 || close <= open) return ''
  return source.slice(open, close)
}

/** Repo-relative paths of the components mounted inside the flag-ON provider. */
function flagOnHostFiles(): string[] {
  const block = flagOnProviderBlock()
  const rootSource = read(CANVAS_ROOT)
  const mounted = new Set<string>()
  for (const m of block.matchAll(/<([A-Z][A-Za-z0-9]*)\s*\/>/g)) mounted.add(m[1])

  const files = new Set<string>()
  for (const { names, module } of imports(rootSource)) {
    if (!names.some((n) => mounted.has(n))) continue
    const path = resolveLocal(CANVAS_ROOT, module)
    if (path !== null) files.add(path)
  }
  return [...files].sort()
}

function flagOnHostedDrains(drains: string[]): string[] {
  const sources = flagOnHostFiles().map((f) => readFileSync(f, 'utf8'))
  return drains.filter((d) => sources.some((s) => callsHook(s, d))).sort()
}

/**
 * ⭐ THE DRAINS WITH NO FLAG-ON HOST, AND WHAT EACH ONE COSTS.
 *
 * Both run ONLY inside DraftChat, which the deployed posture does not mount.
 * Both are recorded here rather than fixed: re-hosting either changes product
 * behaviour and is its own decision.
 *
 * `useGraphEditEvents` — the sole emitter of `direct_graph_edit`, and the sole
 *   production caller of `clearGuidanceItems()` (complete manifest:
 *   `useGraphEditEvents.ts:293`; nothing else in `src/` calls it outside tests).
 *   Dark, a flag-ON user loses:
 *     (a) CEE never hears about a local canvas edit between turns. The turn
 *         itself writes no graph server-side by design, so no persisted state is
 *         lost — what is lost is CEE's awareness that the model moved.
 *     (b) STALE COACHING SURVIVES A LOCAL STRUCTURAL EDIT. `clearGuidanceItems()`
 *         is what drops every guidance item the moment the user changes the
 *         model; with no host it never runs, so guidance minted against the old
 *         model stands until the next assistant turn replaces the whole list
 *         (`useConversation.ts:3911` / `:5078`). This is the user-visible half.
 *     (c) Journey `direct_edit` scenario events — no loss: that limb is gated on
 *         `isJourneyTabEnabled()` and Journey is retired by contract
 *         (`shellContract.ts`, `presentedAsTab: false`).
 *
 * `useAnalysisCompleteEvent` — the only post-run guidance evictor
 *   (`evictStaleItems` on results `preparing|connecting|streaming` → `complete`).
 *   Dark, a flag-ON user loses NOTHING MEASURABLE TODAY, and that is a corpus
 *   fact rather than a structural one:
 *     · its `graph_hash` limb needs `graphChanged: true`, which this call site
 *       never passes (`guidanceStore.ts:666-687`), so that limb cannot fire even
 *       when hosted;
 *     · its `analysis_hash` limb WOULD fire, but CEE emits no `analysis_hash` on
 *       a coaching block — zero occurrences in the wire corpus against 37 for
 *       `graph_hash_at_generation` (`v5/blocks/coachingCurrency.ts:109-114`).
 *   ⚠ SO IT IS A TRIPWIRE, NOT A DEAD LOSS: the day CEE starts emitting
 *   `analysis_hash`, this hook becomes load-bearing and its absence becomes a
 *   real defect — silently. That is the reason it is recorded here rather than
 *   dismissed.
 *
 * `useSessionResumeEvent` — sends `session_resume` when the user returns to a
 *   scenario that already has a graph. Dark, a flag-ON user loses NOTHING, and
 *   this one is structural rather than corpus-dependent: `session_resume` is not
 *   in `WIRE_SYSTEM_EVENT_TYPES` (`conversation/types.ts:926`), so
 *   `serializeSystemEvent` returns `null` for it and `sendSystemEvent`
 *   short-circuits to `SEND_BLOCKED` before any network call
 *   (`systemEvents.ts:34` states the intent outright — *"session_resume and
 *   undo_draft are internal UI events only"*). Hosting it flag-ON would emit
 *   nothing. ⚠ Same tripwire shape as above: adding `session_resume` to the wire
 *   vocabulary would make this hook load-bearing, and its absence a real defect,
 *   with nothing else to notice.
 */
const KNOWN_DARK_DRAINS = [
  'useAnalysisCompleteEvent',
  'useGraphEditEvents',
  'useSessionResumeEvent',
] as const

describe('conversation drains — every DraftChat drain needs a flag-ON host', () => {
  it('CONTROL: the derivation sees a plausible number of drains, and each is actually called', () => {
    const drains = enumerateDrains()
    const draftChat = read(DRAFT_CHAT)

    // Positive control (trap 13/13e): a probe that enumerated nothing would make
    // every downstream assertion vacuously true.
    expect(drains.length).toBeGreaterThanOrEqual(5)
    // A stale import is a false drain. Fail loudly rather than counting it.
    for (const d of drains) {
      expect(callsHook(draftChat, d), `${d} is imported by DraftChat but never called`).toBe(true)
    }
  })

  it('CONTROL: the flag-ON provider block is found and hosts at least one drain', () => {
    // CONTRAST CONTROL (trap 13e): absence is only evidence when the same probe
    // can see a presence. If this reads zero, "two drains are dark" is a
    // statement about the instrument, not about the product.
    expect(flagOnProviderBlock().length).toBeGreaterThan(0)
    expect(flagOnHostFiles().length).toBeGreaterThan(0)
    expect(flagOnHostedDrains(enumerateDrains()).length).toBeGreaterThan(0)
  })

  it('the set of drains with NO flag-ON host is EXACTLY the known-dark set', () => {
    const drains = enumerateDrains()
    const hosted = new Set(flagOnHostedDrains(drains))
    const dark = drains.filter((d) => !hosted.has(d)).sort()

    // GROWS  → a drain went dark: the StructuralDeleteDrainHost defect recurring.
    // SHRINKS → a known-dark drain was re-hosted: a behaviour change that must be
    //           a conscious edit here, with the costs above re-read.
    expect(dark).toEqual([...KNOWN_DARK_DRAINS].sort())
  })

  it('the known-dark set names only real drains (no entry outlives its hook)', () => {
    const drains = new Set(enumerateDrains())
    for (const d of KNOWN_DARK_DRAINS) {
      expect(drains.has(d), `${d} is in KNOWN_DARK_DRAINS but DraftChat no longer imports it`).toBe(
        true,
      )
    }
  })
})
