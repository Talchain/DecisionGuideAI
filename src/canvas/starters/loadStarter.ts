/**
 * Starter scenarios — pre-drafted CEE graphs for the first-run screen.
 *
 * WHY PRE-DRAFTED (ruling D-73, evidence
 * `parallel-briefs/STARTER-BRIEF-VALIDATION-2026-07-24.md`): enterprise-shaped
 * briefs draft LIVE at 12/21 = 57.1%, and the three shapes a design partner
 * expects — vendor selection · market entry · build-vs-buy — at 5/14 = 35.7%
 * (market entry 1/5). The content is good; the single-request delivery is not.
 * Shipping the captured graphs removes that wall from the demo path. The brief
 * that produced each graph ships alongside it (`StarterSummary.brief`) so the
 * user can re-draft it live — the escape hatch, not the default.
 *
 * PROVENANCE IS NOT OPTIONAL. A starter graph is a SAVED EXAMPLE, not a live
 * computation, and the UI must never imply otherwise. Every node carries
 * `data.starterId`, which is what
 *   (a) drives the "saved example" disclosure on the canvas, and
 *   (b) keeps the analysis gate honest — see canRunAnalysis.ts.
 */

import { applyDraftResult } from '../utils/applyDraftResult'
import { useCanvasStore } from '../store'
import { saveAutosave } from '../store/scenarios'
import { autosaveSourceFromStore, projectAutosaveData } from '../store/autosaveProjection'
import manifest from './starters.manifest.json'

export interface StarterProvenance {
  source: string
  ceeBuild: string
  capturedAt: string
  requestId: string | null
  model: string | null
  promptVersion: string | null
  coachingStatus: string | null
  captureFile: string
  captureSha256: string
  note: string
}

export interface StarterSummary {
  id: string
  /** The graph's own `decision` node label, verbatim. Never authored copy. */
  title: string
  /** The graph's own `goal` node label, verbatim. Never authored copy. */
  summary: string
  /** The exact brief string that produced this graph. Re-sent by the redraft. */
  brief: string
  nodeCount: number
  edgeCount: number
  optionCount: number
  provenance: StarterProvenance
}

/**
 * The starter list, read from the GENERATED manifest.
 *
 * Deliberately not a hand-written array: `scripts/build-starter-fixtures.mjs`
 * derives every field here from the committed source capture, and its
 * `--check` mode fails CI when the manifest and the fixtures disagree. A card
 * therefore cannot describe a graph it does not open.
 */
export const STARTERS: readonly StarterSummary[] = manifest.starters as StarterSummary[]

export function getStarter(id: string): StarterSummary | undefined {
  return STARTERS.find((s) => s.id === id)
}

/**
 * THE predicate for "is this canvas a starter graph", and which starter.
 *
 * Scans EVERY node, deliberately. `analysisHeldOn` (canRunAnalysis)
 * refuses the run when ANY node carries the stamp, so a disclosure that read
 * only `nodes[0]` disagreed with the gate the moment an unstamped node sat
 * first — the run stayed refused while the banner explaining the refusal
 * vanished. One question, one shape.
 *
 * Derived from the graph itself, never from a separate "which starter is
 * loaded" store slot: the stamp lives on the nodes, so it disappears exactly
 * when the starter graph does.
 */
export function resolveStarterId(
  nodes: ReadonlyArray<{ data?: Record<string, unknown> | undefined }>,
): string | null {
  for (const node of nodes) {
    const id = node.data?.starterId
    if (typeof id === 'string' && id.length > 0) return id
  }
  return null
}

/**
 * Dynamic-import map for the fixture payloads.
 *
 * Explicit literal keys (not a template-literal glob) so Vite emits one lazy
 * chunk per starter and NONE of them lands in the entry bundle — the five
 * fixtures total ~217 KB of JSON and must never be paid for by a user who
 * doesn't click a card. An unknown id resolves to undefined rather than
 * throwing an opaque module error.
 */
const FIXTURE_LOADERS: Record<string, () => Promise<{ default: unknown }>> = {
  'vendor-selection': () => import('./data/vendor-selection.draft.json'),
  'market-entry': () => import('./data/market-entry.draft.json'),
  'build-vs-buy': () => import('./data/build-vs-buy.draft.json'),
  'headcount-allocation': () => import('./data/headcount-allocation.draft.json'),
  'pricing-model': () => import('./data/pricing-model.draft.json'),
}

/**
 * DRIFT PIN (fail-loud, not assume-good).
 *
 * The loader map is hand-written — Vite cannot code-split a computed import —
 * so it is exactly the hand-maintained mirror this repo keeps getting bitten
 * by. This module-load assertion makes the mirror self-checking: a starter
 * added to the manifest without a loader (or vice versa) throws at import,
 * loudly, instead of rendering a card that dead-clicks.
 */
const manifestIds = STARTERS.map((s) => s.id).sort()
const loaderIds = Object.keys(FIXTURE_LOADERS).sort()
if (manifestIds.join('|') !== loaderIds.join('|')) {
  throw new Error(
    `[starters] manifest/loader drift — manifest has [${manifestIds.join(', ')}] ` +
      `but FIXTURE_LOADERS has [${loaderIds.join(', ')}]. ` +
      `Add the missing dynamic import in loadStarter.ts.`,
  )
}

export async function loadStarterPayload(id: string): Promise<unknown> {
  const loader = FIXTURE_LOADERS[id]
  if (!loader) throw new Error(`[starters] unknown starter id "${id}"`)
  const mod = await loader()
  return (mod as { default: unknown }).default ?? mod
}

/**
 * Stamp starter provenance onto every node of the graph currently on the canvas.
 *
 * Runs AFTER `applyDraftResult` rather than mutating the payload, so the graph
 * that reaches the store is byte-for-byte what CEE returned — the stamp is a
 * canvas-side annotation, not a change to the captured model.
 *
 * `starterId` is load-bearing in two places (canRunAnalysis's honesty gate and
 * the canvas disclosure), so it is applied to EVERY node: a partial stamp
 * would let a single unstamped node silently satisfy an `every()` check.
 *
 * ⚠ RUNNING AFTER THE INGESTION IS ONLY SAFE IF NOTHING PERSISTS IN BETWEEN.
 * It did not use to be: `applyDraftResult` writes the autosave itself, so the
 * copy that reached `localStorage` — the copy the boot arbiter restores from —
 * was the UNSTAMPED graph. The stamp lived in memory and died at the page
 * boundary. See `applyStarter` below for the measured consequence.
 */
function stampStarterProvenance(id: string, title: string): void {
  const state = useCanvasStore.getState()
  useCanvasStore.setState({
    nodes: state.nodes.map((n) => ({
      ...n,
      data: { ...n.data, starterId: id, starterTitle: title },
    })),
  })
}

export interface ApplyStarterResult {
  nodeCount: number
  edgeCount: number
}

/**
 * Load a starter and apply it to the canvas.
 *
 * Routes through `applyDraftResult` — the SAME function the live V5
 * conversation calls when CEE returns a drafted graph
 * (`useConversation.ts:3546/3632`). Only the transport differs: a lazy import
 * instead of a fetch. That is the whole point of shipping the verbatim
 * response body — a starter lands through the draft path, not through a
 * second, drift-prone loader of its own.
 *
 * Throws on unknown id or a failed chunk fetch; callers own the user-facing
 * failure copy.
 */
export async function applyStarter(id: string): Promise<ApplyStarterResult> {
  const meta = getStarter(id)
  if (!meta) throw new Error(`[starters] unknown starter id "${id}"`)
  const payload = await loadStarterPayload(id)
  // ⚠ `skipAutosave` IS THE FIX, NOT AN OPTIMISATION — W-1, measured live on
  // the deployed staging build `6524caed` (2026-08-18) with storage cleared
  // from `/version.json` so no SPA unload write could re-seed it.
  //
  // `applyDraftResult` persists the autosave from its own body, BEFORE this
  // function has stamped anything. So a guest who opened the "Customer Data
  // Platform Selection" card and reloaded got back an autosave holding 19
  // nodes and `nodes.filter(n => n.data.starterId).length === 0` — and with
  // the stamp went every honesty mechanism it carries. The reloaded canvas
  // showed no "Saved example" disclosure, the run gate stopped refusing on
  // starter grounds, and the boot arbiter announced Olumi's own bundled demo
  // as "Recovered unsaved changes from your last session."
  //
  // Ingest without persisting, stamp, then persist the STAMPED graph once.
  const result = applyDraftResult(payload as never, { skipAutosave: true })
  if (result.nodeCount === 0) {
    throw new Error(`[starters] "${id}" applied zero nodes — fixture is not a usable graph`)
  }
  stampStarterProvenance(id, meta.title)
  // Same projection every other writer uses (autosaveProjection.ts's single
  // constructor invariant, pinned by tests/ci-guards).
  //
  // Fail-soft in the SAFE direction, deliberately. If this write throws
  // (quota, private mode) the canvas keeps the example and no autosave is
  // written at all — the next load starts clean. That is strictly better than
  // the behaviour this replaced, where a failure to stamp still left an
  // unstamped record behind for the boot arbiter to misattribute.
  try {
    saveAutosave(projectAutosaveData(autosaveSourceFromStore(useCanvasStore.getState())))
  } catch {
    // Non-critical — the example is on the canvas either way.
  }
  return result
}
