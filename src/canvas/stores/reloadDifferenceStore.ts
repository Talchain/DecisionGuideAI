/**
 * Reload-Difference Store — what a reload took off the canvas, for one line.
 *
 * On reload the saved model wins (`mergeServerGraph.ts`, "RELOAD SHOWS THE SAVED
 * MODEL"): an accepted boot read takes off every canvas element CEE's saved
 * model lacks. Removing the user's visible work without a word would be its own
 * defect, so the hydration path records WHAT was taken off here, and the
 * conversation (`useConversation`) turns it into ONE lasting synthetic assistant
 * line. It holds nothing else.
 *
 * ── WHY A STORE RATHER THAN A PROP ─────────────────────────────────────────
 * Same reason as `serverGraphRetryStore` and `contextIntegrityStore`: the read
 * happens in a boot hook at the route, the line is appended by the conversation
 * host, and zustand is the house pattern for that gap.
 *
 * ── ⚠ KEYED BY SCENARIO, AND THAT IS LOAD-BEARING ──────────────────────────
 * `contextIntegrityStore`'s header records a P0 caused by an unkeyed value that
 * survived a scenario change and rendered a PREVIOUS DECISION'S content. So the
 * notice carries the scenario it describes, and the conversation refuses to
 * append it unless that id matches the live `currentScenarioId`.
 *
 * ── ⚠ `delivered` IS WHAT MAKES "NEVER TWICE" HOLD ACROSS A REMOUNT ────────
 * The conversation host can remount within one page load; a per-instance ref
 * would forget it had appended the line and append it again. The flag lives with
 * the notice, and a NEW notice (a new `id`) starts undelivered.
 *
 * ── ⚠ WHAT THE LINE MAY NEVER SAY ──────────────────────────────────────────
 * The UI cannot tell "removed in another tab" from "never finished saving" — a
 * reload has no record of which saved graph the local copy came from. The copy
 * says both are possible and blames nobody. It never says "sync" or "conflict".
 */
import { create } from 'zustand'

/**
 * ⚠ PROPOSED COPY — for Experience Design sign-off. British English, first
 * person (the same voice as `STRUCTURAL_DELETE_NOTICE`), honest about what the
 * UI cannot know, and names what was taken off so the user can add it back.
 */
export const RELOAD_DIFFERENCE_COPY = {
  /** `{label}` — the one element taken off. */
  one:
    "The saved model doesn't include {label}, so I've taken it off this canvas. " +
    'It may have been removed in another tab, or it may never have finished saving. ' +
    'Add it back if you still want it.',
  /** `{labels}` — "A and B", or "A, B and n more". */
  several:
    "The saved model doesn't include {labels}, so I've taken them off this canvas. " +
    'They may have been removed in another tab, or may never have finished saving. ' +
    'Add back any you still want.',
} as const

/**
 * ⭐ WHEN THE UI KNOWS WHY, IT SAYS WHY (canvas audit edit-structure/F3, 27 Sep
 * 2026). A link drawn with no strength stood down and was NEVER SENT, and the
 * canvas recorded that on it (`utils/canvasOnlyLink.ts`). The generic line above
 * ("removed in another tab, or never finished saving") was a guess the UI did
 * not need to make for those, and it blamed the wrong thing. This names the real
 * cause and the move that keeps the link: draw it and state its strength.
 *
 * `{Label}` / `{Labels}` start a sentence, so their first letter is raised
 * ("the link from A to B" → "The link from A to B").
 */
export const RELOAD_CANVAS_ONLY_LINK_COPY = {
  one:
    '{Label} was on this canvas only. It had no strength, so it was never sent to the model, ' +
    "and I've taken it off. Draw it again and set its strength to keep it.",
  several:
    '{Labels} were on this canvas only. They had no strength, so they were never sent to the model, ' +
    "and I've taken them off. Draw them again and set their strength to keep them.",
} as const

function nameList(labels: ReadonlyArray<string>): string {
  return labels.length === 2
    ? `${labels[0]} and ${labels[1]}`
    : `${labels[0]}, ${labels[1]} and ${labels.length - 2} more`
}

function sentenceStart(text: string): string {
  return text.length > 0 ? text[0].toUpperCase() + text.slice(1) : text
}

/**
 * The chat line for what a reload took off: the generic removals (at least one,
 * unless every removal was a canvas-only link) and the canvas-only links.
 */
export function formatReloadDifferenceNotice(
  removedLabels: ReadonlyArray<string>,
  canvasOnlyLinkLabels: ReadonlyArray<string> = [],
): string {
  const labels = removedLabels.filter((l) => typeof l === 'string' && l.length > 0)
  const onlyLinks = canvasOnlyLinkLabels.filter((l) => typeof l === 'string' && l.length > 0)
  const parts: string[] = []
  if (labels.length > 0 || onlyLinks.length === 0) {
    parts.push(
      labels.length <= 1
        ? RELOAD_DIFFERENCE_COPY.one.replace('{label}', labels[0] ?? 'an element')
        : RELOAD_DIFFERENCE_COPY.several.replace('{labels}', nameList(labels)),
    )
  }
  if (onlyLinks.length > 0) {
    parts.push(
      onlyLinks.length === 1
        ? RELOAD_CANVAS_ONLY_LINK_COPY.one.replace('{Label}', sentenceStart(onlyLinks[0]))
        : RELOAD_CANVAS_ONLY_LINK_COPY.several.replace('{Labels}', sentenceStart(nameList(onlyLinks))),
    )
  }
  return parts.join(' ')
}

export interface ReloadDifferenceState {
  /** The scenario whose canvas lost these elements. `null` when there is nothing to say. */
  scenarioId: string | null
  /** One id per removal notice; the conversation appends one line per id. */
  id: string | null
  /** Node labels (falling back to id) and edge descriptions, in canvas order. */
  removedLabels: string[]
  /** Links taken off that were never sent (canvas-only), named apart — see `RELOAD_CANVAS_ONLY_LINK_COPY`. */
  canvasOnlyLinkLabels: string[]
  /** Whether the conversation has already appended this notice's line. */
  delivered: boolean
  /**
   * `scenarioId` is REQUIRED, deliberately — a notice this store cannot attribute
   * to a decision is one the conversation must never show.
   */
  recordRemoval: (input: {
    scenarioId: string
    removedLabels: ReadonlyArray<string>
    canvasOnlyLinkLabels?: ReadonlyArray<string>
  }) => void
  markDelivered: (id: string) => void
  clear: () => void
}

const EMPTY = {
  scenarioId: null,
  id: null,
  removedLabels: [] as string[],
  canvasOnlyLinkLabels: [] as string[],
  delivered: false,
}

function mintId(): string {
  try {
    return crypto.randomUUID()
  } catch {
    return `reload-difference-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
  }
}

export const useReloadDifferenceStore = create<ReloadDifferenceState>((set) => ({
  ...EMPTY,
  recordRemoval: ({ scenarioId, removedLabels, canvasOnlyLinkLabels = [] }) =>
    set({
      scenarioId,
      id: mintId(),
      removedLabels: [...removedLabels],
      canvasOnlyLinkLabels: [...canvasOnlyLinkLabels],
      delivered: false,
    }),
  markDelivered: (id) => set((s) => (s.id === id ? { delivered: true } : s)),
  clear: () => set({ ...EMPTY, removedLabels: [], canvasOnlyLinkLabels: [] }),
}))
