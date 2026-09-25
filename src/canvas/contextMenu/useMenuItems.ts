/**
 * useMenuItems — builds the context menu item list based on target.
 *
 * Implements spec §3.1–3.4 menu content with conditional visibility
 * per node kind, edge type, canvas, and multi-selection.
 */

import { useMemo } from 'react'
import {
  Sparkles, Zap, Crosshair, SlidersHorizontal, ArrowUpToLine, ArrowDownToLine,
  RotateCcw, Pencil, Plus, Flag, Scissors, CopyPlus,
  Trash2, MessageSquare, Layers, TrendingUp, AlertTriangle, ArrowLeftRight, Eye,
  Undo2, Redo2, LayoutGrid, PanelRight, MousePointer2, Hand,
} from 'lucide-react'
import type { ComponentType } from 'react'
import { useCanvasStore, selectResultsStatus, selectReport } from '../store'
import { handleLayoutWithRecovery } from '../layout/handleLayoutWithRecovery'
import { isGraphLensEnabled } from '../../flags'
import { isEdgeFragile as isEdgeFragileFn } from '../utils/fragileEdgeMatch'
import type { ContextTarget, MenuEntry } from './types'
import { isDivider } from './types'
import type { NodeType } from '../domain/nodes'
import {
  CANONICAL_EDIT_AUTHORITY,
  hasServerGraphAuthority,
  CANVAS_STRUCTURAL_EDIT_NOTICE,
  CANVAS_STRUCTURAL_EDIT_SHORT_REASON,
} from '../mutations/mutationAuthority'
import { WIRE_ADDABLE_NODE_KINDS } from '../mutations/structuralAdd'
import { canvasUndoUnavailableNotice } from '../useKeyboardShortcuts'
import {
  deleteAction,
  addNodeAction,
  addConnectedFactorAction,
  addConnectedOutcomeAction,
  addConnectedRiskAction,
  reverseEdgeAction,
  insertFactorBetweenAction,
  selectPathToGoalAction,
  markAsAssumption,
  traceToGoal,
  askAI,
  cutAction,
  duplicateAction,
  setValueBestCase,
  setValueWorstCase,
  setValueReset,
  CHALLENGE_KINDS,
  buildChallengeTooltip,
} from './actions'
import { DECISION_NODE_LABEL } from '../domain/vocabulary'
import { openNodeInspector } from '../nodes/shared/openNodeInspector'

type ShowToastFn = (message: string, type: 'error' | 'info' | 'success' | 'warning') => void

// ---------------------------------------------------------------------------
// Node shape glyphs for Add node submenu (DS v4 entity colours)
// ---------------------------------------------------------------------------

const NODE_TYPE_ITEMS: { type: NodeType; label: string; glyph?: string; icon?: ComponentType<{ className?: string; size?: number }>; color: string; tooltip: string }[] = [
  { type: 'factor', label: 'Factor', glyph: '\u25CF', color: 'text-factor', tooltip: 'Causal variable that can be measured or influenced' },
  { type: 'risk', label: 'Risk', glyph: '\u25BC', color: 'text-danger', tooltip: 'Potential negative outcome' },
  { type: 'outcome', label: 'Outcome', glyph: '\u25B2', color: 'text-success', tooltip: 'Observable result or measurement' },
  { type: 'option', label: 'Option', glyph: '\u25A0', color: 'text-option', tooltip: 'Alternative choice under a decision' },
  { type: 'goal', label: 'Goal', glyph: '\u25C6', color: 'text-goal', tooltip: 'Target outcome for optimisation' },
  { type: 'decision', label: DECISION_NODE_LABEL, glyph: '\u2B22', color: 'text-info', tooltip: 'What you are working out — the options answer it' },
]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getNodeRange(node: any): { min: number; max: number } | null {
  const os = node?.data?.observedState
  if (os?.range_min != null && os?.range_max != null) return { min: os.range_min, max: os.range_max }
  const prior = node?.data?.prior
  if (prior?.range_min != null && prior?.range_max != null) return { min: prior.range_min, max: prior.range_max }
  const ss = node?.data?.state_space
  if (ss?.range?.min != null && ss?.range?.max != null) return { min: ss.range.min, max: ss.range.max }
  return null
}

const DIV: MenuEntry = { type: 'divider' }

/**
 * ⭐⭐ THE PANE NODE-ADD IS JUDGED BY ITS OWN CARRIER, AND THAT IS WHY IT IS NOT
 * IN THE SET BELOW (2026-09-13).
 *
 * `add-node` sat in `LOCAL_SEMANTIC_CONTEXT_MENU_IDS` until the durable writer
 * landed, and nobody moved it afterwards. The result was the estate's chronic
 * failure #1 in its purest form: `store.addNode` names itself "THE CHOKEPOINT
 * FOR EVERY GESTURE THAT REACHES `addNode`: the pane context menu, the six
 * Command Palette 'Add …' commands, the pre-analysis AddRow and the hero goal
 * field" — three of those four reach a user, and the pane context menu's item
 * was stripped before it ever rendered. The pre-analysis `AddRow` is live on
 * exactly this carrier (`preAnalysisV3StructuralAdd`, flipped for the same
 * reason), and the Command Palette has no opener at all
 * (`setShowCommandPalette` is never called true — pinned in
 * `help/__tests__/KeyboardLegend.dom.spec.tsx`). So the canvas was the only
 * reachable door left, and one stale set entry held it shut.
 *
 * ⚠⚠ THIS IS CLAUDE.md TRAP 21 — TWO KEYS FOR ONE CONCEPT. The authority table
 * ALREADY says this gesture is `server_graph`, in a key whose own comment names
 * this surface: `canvasNodeAddWithServerHash` — "the canvas/palette/context-menu
 * node add … a receipt-bearing GraphV3 carrier (`structural_add`), a
 * server-side write to `scenarios.graph`, and a committed `edit_graph` fact".
 * Meanwhile the menu consulted `canvasSemanticMutations`, which is `'disabled'`.
 * Both keys were correct answers to DIFFERENT questions, and the fix is to name
 * them apart rather than to align the defaults: each menu id is now judged by
 * the authority of the carrier IT uses.
 *
 * ⚠⚠ THE PARAGRAPH THAT STOOD HERE HELD THE SAME DOOR SHUT ONE LEVEL DOWN,
 * AND IT EXPIRED ON 13 Sep 2026 (corrected 18 Sep). It read: "`add-connected-*`
 * and `insert-factor-between` route through `store.addNodeWithEdge`, and
 * `duplicate`/`paste` through `duplicateSelected`/`pasteClipboard` — all three
 * capture NOTHING, deliberately, because `structural_add_edge` is
 * `'reader_only_refusal'` in CEE." **That premise is false.** CEE #1443 shipped
 * the writer and promoted the kind to `'mutating'` (`dispatch.ts:373`), and the
 * authority table re-derived it the same day — `canvasEdgeAddWithServerHash` is
 * `'server_graph'`. The prose outlived its cause by five days, and it is why
 * nobody reopened the question.
 *
 * ⭐ SO `add-connected-*` HAS MOVED TO `CONNECTED_NODE_ADD_MENU_IDS` BELOW,
 * judged by the two carriers it actually uses. The rest of the set stays, and
 * their reasons are NOT the same reason:
 *   · `duplicate` / `paste` — `duplicateSelected` / `pasteClipboard` still
 *     capture nothing, and the edge writer did not unblock them: their live
 *     blockers are node DATA the wire cannot express (value, prior,
 *     `observedState`) and the absence of a BATCHED carrier, so N nodes is N
 *     sequential turns. Both recorded on `pendingStructuralAdds` in `store.ts`.
 *   · `insert-factor-between` — has a SECOND WRITER. Its `localApply` installs
 *     by bare `setState` rather than through a store action
 *     (`contextMenu/actions.ts`), so capturing at the chokepoint would cover
 *     neither branch. It needs both writers fenced, which is its own change.
 *   · `set-value`, `mark-assumption`, `reverse-edge`, `cut`, `undo`, `redo` —
 *     unchanged, carrierless.
 */
/**
 * ⛔⛔ KINDS THE PRODUCT READS WITH `.find()` — A SECOND ONE PERSISTS AND IS
 * THEN IGNORED, WHICH IS WORSE THAN A DOOR THAT REFUSES (13 Sep 2026).
 *
 * Found by an independent review seat on #1538, applying this PR's own standard
 * to this PR: *"a door that works for five kinds and quietly fails for the
 * sixth is worse than five doors."* It was four and two.
 *
 * ⚠ WIRE-PERSISTABILITY WAS THE RIGHT QUESTION FOR `option` AND IS NOT THE
 * WHOLE QUESTION HERE. A second goal persists perfectly well. It simply does
 * nothing — because every production consumer takes the FIRST match and a new
 * node is APPENDED:
 *
 *   goal      `adapters/islRequestAdapter.ts:498` — THE ANALYSIS REQUEST ·
 *             `conversation/utils/applyPatch.ts:544` ·
 *             `nodes/OptionNode.tsx:1147` · `nodes/OutcomeNode.tsx:51` ·
 *             `nodes/RiskNode.tsx:59`
 *   decision  `components/FloatingOlumiPanel.tsx:638` ·
 *             `hooks/useAddBaseline.ts:68` · `utils/generateScenarios.ts:87`
 *
 * ⭐ THE CONTRAST IS WHAT MAKES THIS A DERIVATION RATHER THAN A JUDGEMENT, and
 * it was run in the same sweep: `factor` and `option` are read with `.filter()`
 * (`islRequestAdapter.ts:343`, `ReactFlowGraph.tsx:771`, `FactorNode.tsx:77`,
 * `OptionPanel.tsx:111`, `GoalPanel.tsx:249`). **The codebase already says
 * which kinds may be plural, in the verb it chose.** This set reads that answer
 * rather than re-deciding it.
 *
 * So the user would add a Goal, watch it persist, watch it render — and the
 * analysis would go on optimising the other one, with nothing refusing it and
 * nothing saying so. That is the silent-loss class this whole PR exists to
 * close, which is why four durable kinds shipping is the win and six is not.
 *
 * ⚠ NOT A PERMANENT RULING. The honest alternative is to offer these kinds only
 * when NONE exists yet, which is a real capability for a graph that has no goal.
 * It needs its own review and its own emptiness derivation, so it is a row
 * rather than a widening smuggled into this PR.
 */
const SINGULAR_NODE_KINDS: ReadonlySet<string> = new Set<string>(['goal', 'decision'])

/**
 * The kinds this door may offer: wire-persistable AND safe to have more than
 * one of. ⭐ ONE list, consumed by BOTH the submenu and the authority set below
 * — the first cut had the same filter written twice, which is the
 * hand-maintained mirror this estate keeps paying for (CLAUDE.md trap 12).
 * Build the door and judge the door from one derivation, or they drift apart
 * silently and the drift reads as green.
 */
const ADDABLE_NODE_TYPE_ITEMS = NODE_TYPE_ITEMS.filter(
  (nt) => WIRE_ADDABLE_NODE_KINDS.has(nt.type) && !SINGULAR_NODE_KINDS.has(nt.type),
)

const DURABLE_NODE_ADD_MENU_IDS: ReadonlySet<string> = new Set<string>([
  'add-node',
  ...ADDABLE_NODE_TYPE_ITEMS.map((nt) => `add-node-${nt.type}`),
])

/**
 * ⭐⭐ "ADD CONNECTED …" — ONE GESTURE, TWO CARRIERS, JUDGED BY BOTH.
 *
 * These three items create a node AND a link in a single action
 * (`store.addNodeWithEdge`, via `commitValidatedMutation`'s `localApply`), so
 * the question "may this row present itself as a shared-model edit?" has two
 * halves and the honest gate is their CONJUNCTION, not either one:
 *   · the NODE rides `structural_add`      → `canvasNodeAddWithServerHash`
 *   · the LINK rides `structural_add_edge`  → `canvasEdgeAddWithServerHash`
 *
 * ⚠ IT IS A SIBLING OF `DURABLE_NODE_ADD_MENU_IDS`, NOT A MEMBER OF IT, and
 * that is CLAUDE.md trap 21 applied deliberately rather than discovered later.
 * `add-node` uses ONE carrier; folding these in beside it would make the pane
 * add's authority answer a question it was never asked, and the day either key
 * moves the two sets must be able to disagree.
 *
 * ⚠⚠ AND IT IS NOT A PROMISE THAT THE LINK IS SAVED. `USER_EDGE_DEFAULTS`
 * carries no `weightSource`, so the edge capture stands down at
 * `strength_not_stated` and RECORDS that on the edge; `EdgePanel` reads the
 * receipt and offers the control that states a strength, which re-runs the
 * capture. The node is durable immediately; the link is durable once somebody
 * says how strong it is, and the product says so rather than implying either.
 */
const CONNECTED_NODE_ADD_MENU_IDS: ReadonlySet<string> = new Set<string>([
  'add-connected-factor',
  'add-connected-outcome',
  'add-connected-risk',
])

/**
 * Local React-Flow mutations that look like shared-model edits. Delete is not
 * in this set: it has its own server-hash/CAS authority gate in the store.
 * Layout, selection, lenses and AI questions are presentation/read-only
 * actions and remain available.
 *
 * A20 — `paste` LEFT THIS SET (25 Sep 2026): the row it judged is gone, not
 * merely re-judged. It was always `enabled: false` whenever `connected` was
 * false (the observed default), and `Copy` — the row's own producer — writes
 * only to an in-memory clipboard `store.ts` never gives Paste a durable way to
 * consume, so both were hidden from every menu that showed them rather than
 * left present and inert. See `useMenuItems.A20.noDeadClipboard.spec.ts`.
 */
export const LOCAL_SEMANTIC_CONTEXT_MENU_IDS = new Set([
  'undo',
  'redo',
  'set-value',
  // ⚠ `add-connected-factor` / `-outcome` / `-risk` LEFT THIS SET ON 18 Sep 2026.
  // They are judged by `CONNECTED_NODE_ADD_MENU_IDS` above, against the two
  // carriers they use, rather than by the blanket `canvasSemanticMutations`.
  'mark-assumption',
  'cut',
  'duplicate',
  'reverse-edge',
  'insert-factor-between',
])

function compactDividers(entries: MenuEntry[]): MenuEntry[] {
  const compacted: MenuEntry[] = []
  for (const entry of entries) {
    if (isDivider(entry) && (compacted.length === 0 || isDivider(compacted.at(-1)!))) continue
    compacted.push(entry)
  }
  if (compacted.length > 0 && isDivider(compacted.at(-1)!)) compacted.pop()
  return compacted
}

/**
 * One menu id, judged by the authority of the carrier IT uses.
 *
 * ⚠ An id in NEITHER set is authorised: this filter subtracts, it does not
 * admit. Layout, selection, lens and "Ask AI" items reach a user because
 * nothing here claims them, which is why adding a genuinely local mutation
 * needs an entry in `LOCAL_SEMANTIC_CONTEXT_MENU_IDS` rather than silence.
 */
function menuIdIsAuthorised(id: string, connected: boolean): boolean {
  if (DURABLE_NODE_ADD_MENU_IDS.has(id)) {
    return hasServerGraphAuthority(CANONICAL_EDIT_AUTHORITY.canvasNodeAddWithServerHash)
  }
  if (CONNECTED_NODE_ADD_MENU_IDS.has(id)) {
    // BOTH, never either — see the set's header. A node saved with its link
    // dropped is the silent half-loss this conjunction exists to refuse.
    return (
      hasServerGraphAuthority(CANONICAL_EDIT_AUTHORITY.canvasNodeAddWithServerHash) &&
      hasServerGraphAuthority(CANONICAL_EDIT_AUTHORITY.canvasEdgeAddWithServerHash)
    )
  }
  if (LOCAL_SEMANTIC_CONTEXT_MENU_IDS.has(id)) {
    // ⭐ THE INJECTED VALUE DRIVES THE PER-ID JUDGEMENT, and that is the whole
    // point of threading it. It defaults to the same expression this line used
    // to read directly, so today's behaviour is unchanged — what changes is that
    // a caller passing `connected` can no longer bypass the per-carrier split.
    return connected
  }
  return true
}

/**
 * ⭐⭐ BOTH FIXES KEPT — #1538 decides WHAT is unauthorised, #1304 decides HOW to
 * show it. Rebased 13 Sep 2026; neither side taken wholesale.
 *
 * #1538 replaced a single global authority check with PER-ID judgement, because
 * `add-node` is judged by `canvasNodeAddWithServerHash` and the rest by
 * `canvasSemanticMutations` — two questions under one name, and collapsing them
 * is what kept the add door shut. #1304 replaced REMOVAL with an honest
 * disabled row. They compose: the per-id test below chooses the unauthorised
 * set, and #1304's rendering decides what the user sees of it.
 *
 * ⛔ CORRECTED 13 Sep 2026. This comment previously read "#1304's global
 * `if (connected) return entries` early-return is DELIBERATELY NOT reinstated
 * INSIDE THE WALK". That was literally true and materially misleading: the
 * early-return was RELOCATED, not removed — it sat above the walk and bypassed
 * the whole split whenever `connected` was true. I wrote a narrow sentence and
 * it was read, reasonably, as "removed", including by me when I reported it.
 * ⭐ It is now genuinely GONE: `connected` is threaded into
 * `menuIdIsAuthorised` so the injected value drives per-id judgement.
 */

/**
 * The gestures a user can ALSO reach by keyboard, so the menu row and the key
 * must answer identically.
 *
 * ⭐ WHY THIS SUBSET AND NOT ALL THIRTEEN — THE DENSITY MEASUREMENT.
 * Rendering every removed id as a disabled row turns the factor-node menu into
 * 11 rows with 7 greyed out (64%), which is its own defect: a wall of grey
 * teaches the user to stop reading the menu. Hiding all thirteen — the
 * behaviour this replaces — is the defect being fixed. The split shipped here
 * is measured in `menuSaysWhyUnavailable.spec.ts` §"menu density", which builds
 * both policies from the SAME pristine entry list.
 *
 * The line is drawn at KEYBOARD REACHABILITY because that is where silence
 * actually hurts: a user who presses ⌘V gets nothing and no explanation, so the
 * row must exist to say why before they press it, and to agree with the toast
 * when they do. The remaining eight are menu-only — a user cannot invoke them
 * without seeing the menu first — so one note serves them all without eight
 * rows of grey.
 */
export const KEYBOARD_REACHABLE_SEMANTIC_IDS = new Set([
  'undo',
  'redo',
  'cut',
  // ⛔ `duplicate` REMOVED 13 Sep 2026 — it FAILED BOTH CLAUSES of this set's own
  // stated criterion, and the contradiction was already written down fifteen
  // lines into a sibling module before this set was authored.
  //
  //   · ⌘D does NOT reach duplicate. `useKeyboardShortcuts.ts:457` gates
  //     `duplicateSelected()` on `canMutateSharedModel`, which is false; and
  //     `hooks/useCanvasKeyboardShortcuts.ts:201` ALSO binds ⌘D, UNGATED, to
  //     `onToggleDocuments` — wired live at `ReactFlowGraph.tsx:1587`. Pressing
  //     ⌘D opens the Documents drawer.
  //   · `isClipboardMutationGesture` admits only `x` and `v`
  //     (`useKeyboardShortcuts.ts:337`), so ⌘D raises no toast for a row to
  //     agree with.
  //
  // ⭐ AND THE RULING ALREADY EXISTED. `isClipboardMutationGesture`'s own header
  // excludes ⌘D for precisely this reason: "Announcing 'duplicate is
  // unavailable' over a keystroke that just opened a drawer is one gesture
  // answered two ways by two handlers, which is a WORSE DEFECT THAN THE
  // SILENCE." A disabled row here would have re-committed the defect that
  // predicate was written to refuse.
  //
  // ⇒ `duplicate` is therefore MENU-ONLY: hidden, and folded into the grouped
  // note like its carrierless siblings. That is not a downgrade — it is the
  // only answer that does not make the menu and the keyboard disagree.
])

/** Stable id for the grouped note. ID-addressed, never label-derived. */
export const STRUCTURAL_EDITS_NOTE_ID = 'structural-edits-note'

/**
 * Which sentence is TRUE for this row.
 *
 * ⚠ UNDO/REDO ARE NOT STRUCTURAL EDITS AND MUST NOT CLAIM THE STRUCTURAL
 * SENTENCE. ⌘Z is already answered by `canvasUndoUnavailableNotice()`, which
 * names Version history. If this row said "ask Olumi" the key and the menu
 * would answer one question two different ways — the estate's signature defect.
 * Reading the same function the key reads is what keeps them from disagreeing.
 */
function unavailableReason(id: string): { tooltip: string; disabledReason: string } {
  if (id === 'undo' || id === 'redo') {
    return { tooltip: canvasUndoUnavailableNotice(), disabledReason: 'not available here' }
  }
  return {
    tooltip: CANVAS_STRUCTURAL_EDIT_NOTICE,
    disabledReason: CANVAS_STRUCTURAL_EDIT_SHORT_REASON,
  }
}

/**
 * Applies the presentation authority to a built menu.
 *
 * ⭐ THIS IS A PRESENTATION AUTHORITY (see `mutationAuthority.ts`): its job is
 * to decide what to RENDER, and "render it disabled with an honest reason" is
 * the option it was written for. Nothing here gates a write — every surfaced
 * row is `enabled: false`, so no gesture becomes actionable that was not
 * actionable before. Flipping the authority literal is explicitly NOT what this
 * does; the constraint is made legible, not absent.
 */
export function applyContextMenuMutationAuthority(
  entries: MenuEntry[],
  opts?: { connected?: boolean },
): MenuEntry[] {
  const connected = opts?.connected
    ?? hasServerGraphAuthority(CANONICAL_EDIT_AUTHORITY.canvasSemanticMutations)
  // ⛔⛔ NO GLOBAL EARLY-RETURN. `if (connected) return entries` stood here until
  // 13 Sep 2026 and it DEFEATED THE PER-CARRIER SPLIT: `menuIdIsAuthorised` reads
  // the constants itself and never saw this value, so the only thing the injected
  // parameter could do was return the whole menu UNFILTERED. Two consequences,
  // both found by the reviewing seat on this PR:
  //   · every spec passing `connected: true` exercised the wholesale path and
  //     could not discriminate per-id behaviour in the connected state AT ALL —
  //     a seam with one possible answer;
  //   · the day `canvasSemanticMutations` moves toward `server_graph`, FIVE
  //     CARRIERLESS IDS would have opened silently (paste, undo, redo, cut,
  //     duplicate) along with add-connected-*, insert-factor-between,
  //     mark-assumption and reverse-edge.
  // That is precisely the conflation the per-id split exists to remove, retained
  // as the sole function of the injected parameter. `connected` is now threaded
  // into the judgement instead, so the seam survives and becomes assertable.

  let hidMenuOnlyGesture = false

  const walk = (list: MenuEntry[]): MenuEntry[] => list.flatMap<MenuEntry>((entry) => {
    if (isDivider(entry)) return [entry]
    if (!menuIdIsAuthorised(entry.id, connected)) {
      if (!KEYBOARD_REACHABLE_SEMANTIC_IDS.has(entry.id)) {
        hidMenuOnlyGesture = true
        return []
      }
      // Surfaced, never actionable: the reason replaces the disappearance.
      const { tooltip, disabledReason } = unavailableReason(entry.id)
      const { submenuItems: _drop, hasSubmenu: _drop2, ...rest } = entry
      return [{ ...rest, enabled: false, tooltip, disabledReason }]
    }
    const submenuItems = entry.submenuItems ? walk(entry.submenuItems) : undefined
    if (entry.hasSubmenu && submenuItems?.length === 0) return []
    return [{ ...entry, ...(submenuItems ? { submenuItems } : {}) }]
  })

  const filtered = compactDividers(walk(entries))
  if (!hidMenuOnlyGesture) return filtered

  // One grouped line for everything that stayed hidden, rather than eight rows
  // of grey. Self-retiring: it is appended only when something was actually
  // hidden on THIS menu, so the multi-select menu (whose only removals are
  // surfaced above) never grows one.
  return [
    ...filtered,
    DIV,
    {
      id: STRUCTURAL_EDITS_NOTE_ID,
      label: 'Other model edits: ask Olumi',
      // No icon on purpose: every other row's icon marks something you can DO,
      // and this row is a sentence, not an action.
      tooltip: CANVAS_STRUCTURAL_EDIT_NOTICE,
      enabled: false,
      action: () => {},
    },
  ]
}

// ---------------------------------------------------------------------------
// Builder
// ---------------------------------------------------------------------------

export interface UseMenuItemsOptions {
  target: ContextTarget
  showToast: ShowToastFn
  screenToFlowPosition: (pos: { x: number; y: number }) => { x: number; y: number }
  onClose: () => void
  /** Callback to open the Set value custom popover */
  onOpenCustomValue?: (nodeId: string) => void
  /**
   * The mode the canvas is ACTUALLY in — `effectiveMode`, not the raw stored
   * value. The toolbar learned this the hard way (see the A-1 note at its
   * `onSelectClick`): a control that displays one value and toggles off
   * another is a click with no visible result during a spacebar hold.
   */
  interactionMode?: 'select' | 'hand'
  /** Omitted by hosts that have no mode to switch; the item is then absent. */
  onSetInteractionMode?: (mode: 'select' | 'hand') => void
}

export function useMenuItems({
  target,
  showToast,
  screenToFlowPosition,
  onClose,
  onOpenCustomValue,
  interactionMode,
  onSetInteractionMode,
}: UseMenuItemsOptions): MenuEntry[] {
  return useMemo(() => {
    const wrap = (action: () => void | Promise<void>) => () => { void action(); onClose() }

    if (target.kind === 'pane') {
      return applyContextMenuMutationAuthority(
        buildPaneMenu(target, showToast, screenToFlowPosition, wrap, interactionMode, onSetInteractionMode),
      )
    }
    if (target.kind === 'node') {
      return applyContextMenuMutationAuthority(
        buildNodeMenu(target, showToast, wrap, onOpenCustomValue),
      )
    }
    if (target.kind === 'edge') {
      return applyContextMenuMutationAuthority(buildEdgeMenu(target, showToast, wrap))
    }
    if (target.kind === 'multi') {
      return applyContextMenuMutationAuthority(buildMultiMenu(target, showToast, wrap))
    }
    return []
  }, [target, showToast, screenToFlowPosition, onClose, onOpenCustomValue])
}

// ---------------------------------------------------------------------------
// Pane menu (empty canvas)
// ---------------------------------------------------------------------------

function buildPaneMenu(
  target: Extract<ContextTarget, { kind: 'pane' }>,
  showToast: ShowToastFn,
  screenToFlowPosition: (pos: { x: number; y: number }) => { x: number; y: number },
  wrap: (action: () => void | Promise<void>) => () => void,
  interactionMode: 'select' | 'hand' | undefined,
  onSetInteractionMode: ((mode: 'select' | 'hand') => void) | undefined,
): MenuEntry[] {
  const flowPos = screenToFlowPosition(target.screenPos)

  /**
   * ⭐ THE POINTER MODE IS REACHABLE FROM THE CANVAS ITSELF, not only from the
   * toolbar — because the keyboard route is inert exactly when people reach
   * for it.
   *
   * Measured 21 Sep 2026 in a real browser: with focus in the Olumi composer,
   * `H` and `V` do nothing, and Escape does NOT restore them (contrary to the
   * note at `useKeyboardShortcuts.ts:83` — Escape left focus on the textarea).
   * Only a click on the graph pane releases focus and revives the keys. So a
   * user working in the panel who wants to pan has no working keyboard route
   * and must travel to the toolbar. Right-click is already where they are.
   *
   * ⚠ TOGGLES OFF THE MODE IT DISPLAYS. `interactionMode` here is the caller's
   * `effectiveMode`, so during a spacebar hold the label and the action agree —
   * the same rule the toolbar's A-1 note records, applied at the second
   * control rather than rediscovered at it.
   *
   * Absent, not disabled, when the host passes no setter: a menu row that
   * cannot act is worse than no row.
   */
  const modeEntries: MenuEntry[] =
    interactionMode && onSetInteractionMode
      ? [
          {
            id: 'interaction-mode',
            label: interactionMode === 'select' ? 'Hand (pan) mode' : 'Select mode',
            icon: interactionMode === 'select' ? Hand : MousePointer2,
            shortcut: interactionMode === 'select' ? 'H' : 'V',
            tooltip:
              interactionMode === 'select'
                ? 'Drag the canvas to move around'
                : 'Click and drag to select nodes',
            enabled: true,
            action: wrap(() => onSetInteractionMode(interactionMode === 'select' ? 'hand' : 'select')),
          },
          DIV,
        ]
      : []

  // ⚠ ONE DERIVATION, SHARED WITH THE AUTHORITY SET — see
  // `ADDABLE_NODE_TYPE_ITEMS`.
  const addNodeSubmenu: MenuEntry[] = ADDABLE_NODE_TYPE_ITEMS.map((nt) => ({
    id: `add-node-${nt.type}`,
    label: nt.label,
    ...(nt.glyph ? { glyph: nt.glyph } : {}),
    ...(nt.icon ? { icon: nt.icon } : {}),
    glyphColor: nt.color,
    tooltip: nt.tooltip,
    enabled: true,
    action: wrap(() => addNodeAction(nt.type, flowPos, showToast)),
  }))

  const store = useCanvasStore.getState()

  return [
    ...modeEntries,
    {
      id: 'add-node',
      label: 'Add node',
      icon: Plus,
      tooltip: 'Create a new element on the canvas',
      enabled: true,
      hasSubmenu: true,
      submenuItems: addNodeSubmenu,
      action: () => {},
    },
    {
      id: 'ask-ai-pane',
      label: 'Ask AI',
      icon: Sparkles,
      tooltip: 'Ask AI about the model',
      enabled: true,
      hasSubmenu: true,
      submenuItems: [
        {
          id: 'ask-ai-missing',
          label: "What's missing from this model?",
          icon: Sparkles,
          tooltip: 'AI reviews the graph for structural gaps',
          enabled: true,
          action: wrap(() => askAI(target, 'review_model_gaps', showToast)),
        },
      ],
      action: () => {},
    },
    DIV,
    {
      id: 'undo',
      label: 'Undo',
      icon: Undo2,
      shortcut: '\u2318Z',
      tooltip: 'Undo last action',
      enabled: store.canUndo(),
      disabledReason: store.canUndo() ? undefined : 'Nothing to undo',
      action: wrap(() => useCanvasStore.getState().undo()),
    },
    {
      id: 'redo',
      label: 'Redo',
      icon: Redo2,
      shortcut: '\u2318\u21E7Z',
      tooltip: 'Redo last undone action',
      enabled: store.canRedo(),
      disabledReason: store.canRedo() ? undefined : 'Nothing to redo',
      action: wrap(() => useCanvasStore.getState().redo()),
    },
    DIV,
    {
      id: 'auto-arrange',
      label: 'Auto-arrange',
      icon: LayoutGrid,
      shortcut: '\u21E7A',
      tooltip: 'Automatically arrange all nodes',
      enabled: store.nodes.length > 0,
      disabledReason: store.nodes.length > 0 ? undefined : 'No nodes to arrange',
      action: wrap(() => {
        const s = useCanvasStore.getState()
        if (s.nodes.length === 0) return
        handleLayoutWithRecovery(() => s.applyLayout(), {
          onSuccess: () => showToast('Auto-arranged layout.', 'success'),
        })
      }),
    },
    {
      id: 'toggle-view-mode',
      label: store.viewMode === 'expert' ? 'Switch to Standard' : 'Switch to Detailed',
      icon: Eye,
      tooltip: 'Toggle between Standard and Detailed canvas view',
      enabled: true,
      action: wrap(() => {
        const s = useCanvasStore.getState()
        s.setViewMode(s.viewMode === 'expert' ? 'standard' : 'expert')
      }),
    },
  ]
}

// ---------------------------------------------------------------------------
// Node menu
// ---------------------------------------------------------------------------

/** Full menu node kinds: factor, risk, outcome */
const FULL_MENU_KINDS = new Set(['factor', 'risk', 'outcome'])
/** Organisational node kinds: decision, option, constraint */
const ORG_KINDS = new Set(['decision', 'option', 'constraint'])

function buildNodeMenu(
  target: Extract<ContextTarget, { kind: 'node' }>,
  showToast: ShowToastFn,
  wrap: (action: () => void | Promise<void>) => () => void,
  onOpenCustomValue?: (nodeId: string) => void,
): MenuEntry[] {
  const items: MenuEntry[] = []
  const kind = target.nodeType as string
  const isFull = FULL_MENU_KINDS.has(kind)
  const isGoal = kind === 'goal'
  const node = target.node

  // The quick-action row has three slots. Details stays keyboard-reachable
  // through More as well as the existing node-click inspector route.
  items.push({
    id: 'open-details',
    label: 'Open details',
    icon: PanelRight,
    tooltip: 'Open the inspector for this element',
    enabled: true,
    action: wrap(() => { openNodeInspector(target.nodeId) }),
  })

  // --- Ask AI submenu ---
  const askAIItems: MenuEntry[] = [
    {
      id: 'ask-ai-explain',
      label: 'Explain this',
      icon: Sparkles,
      tooltip: "Plain-English summary of this element's role in the model",
      enabled: true,
      action: wrap(() => askAI(target, 'explain_element', showToast)),
    },
  ]
  // ⭐ CHALLENGE IS GATED ON ITS OWN SET, NOT ON `isFull || isGoal`.
  //
  // Until 8 Sep 2026 this read `isFull || isGoal`, which withheld "Challenge
  // this" from decision and option — the question a team is answering and the
  // choices on the table, the two nodes it most wants to contest. Widening
  // `FULL_MENU_KINDS` to reach them would also have widened Explore, Set value
  // and Mark as assumption onto kinds with no range (see `CHALLENGE_KINDS`), so
  // the concept that was really being asked for got its own name.
  //
  // The tooltip comes from the same producer as the prompt, so the label on the
  // door and what is behind it cannot be edited apart.
  if (CHALLENGE_KINDS.has(kind as NodeType)) {
    askAIItems.push({
      id: 'ask-ai-challenge',
      label: 'Challenge this',
      icon: Zap,
      tooltip: buildChallengeTooltip(kind as NodeType),
      enabled: true,
      action: wrap(() => askAI(target, 'challenge_element', showToast)),
    })
  }
  items.push({
    id: 'ask-ai',
    label: 'Ask AI',
    icon: Sparkles,
    tooltip: 'AI-powered analysis',
    enabled: true,
    hasSubmenu: true,
    submenuItems: askAIItems,
    action: () => {},
  })

  // --- Explore submenu (factor, risk, outcome only) ---
  if (isFull) {
    items.push({
      id: 'explore',
      label: 'Explore',
      icon: Crosshair,
      tooltip: 'Explore relationships',
      enabled: true,
      hasSubmenu: true,
      submenuItems: [
        {
          id: 'trace-to-goal',
          label: 'Trace to goal',
          icon: Crosshair,
          tooltip: "Highlight how this element's influence reaches the goal",
          enabled: true,
          action: wrap(() => traceToGoal(target.nodeId, showToast)),
        },
        {
          id: 'select-path-to-goal',
          label: 'Select path to goal',
          icon: Layers,
          tooltip: 'Select all nodes and edges on the path from here to the goal',
          enabled: true,
          action: wrap(() => selectPathToGoalAction(target.nodeId, showToast)),
        },
      ],
      action: () => {},
    })
  }

  // --- Set value submenu (factor, risk, outcome only) ---
  if (isFull) {
    const range = getNodeRange(node)
    const hasRange = range !== null
    const hasBaseline = node.data?._baseline_snapshot != null

    const setValueItems: MenuEntry[] = [
      {
        id: 'set-value-best',
        label: 'Best case',
        icon: ArrowUpToLine,
        tooltip: "Set to the upper bound of this factor's range",
        enabled: hasRange,
        disabledReason: hasRange ? undefined : 'Set a range first',
        action: wrap(() => setValueBestCase(target.nodeId, showToast)),
      },
      {
        id: 'set-value-worst',
        label: 'Worst case',
        icon: ArrowDownToLine,
        tooltip: "Set to the lower bound of this factor's range",
        enabled: hasRange,
        disabledReason: hasRange ? undefined : 'Set a range first',
        action: wrap(() => setValueWorstCase(target.nodeId, showToast)),
      },
      DIV,
      {
        id: 'set-value-reset',
        label: 'Reset to observed',
        icon: RotateCcw,
        tooltip: 'Restore the original observed value',
        enabled: hasBaseline,
        disabledReason: hasBaseline ? undefined : 'No baseline to restore',
        action: wrap(() => setValueReset(target.nodeId, showToast)),
      },
      {
        id: 'set-value-custom',
        label: 'Custom\u2026',
        icon: Pencil,
        tooltip: 'Enter a specific value',
        enabled: true,
        action: () => { onOpenCustomValue?.(target.nodeId) },
      },
    ]

    items.push({
      id: 'set-value',
      label: 'Set value',
      icon: SlidersHorizontal,
      tooltip: 'Change this factor\'s observed value',
      enabled: true,
      hasSubmenu: true,
      submenuItems: setValueItems,
      action: () => {},
    })
  }

  items.push(DIV)

  // --- Add connected nodes (not on constraint) ---
  if (kind !== 'constraint') {
    items.push({
      id: 'add-connected-factor',
      label: 'Add connected factor',
      icon: Plus,
      tooltip: 'Create a new factor linked to this node',
      enabled: true,
      action: wrap(() => addConnectedFactorAction(target, showToast)),
    })
    // Graph Editing Experience Task 3a: Add outcome/risk from node
    items.push({
      id: 'add-connected-outcome',
      label: 'Add outcome from this',
      icon: TrendingUp,
      tooltip: 'Create an outcome caused by this node',
      enabled: true,
      action: wrap(() => addConnectedOutcomeAction(target, showToast)),
    })
    items.push({
      id: 'add-connected-risk',
      label: 'Add risk from this',
      icon: AlertTriangle,
      tooltip: 'Create a risk caused by this node',
      enabled: true,
      action: wrap(() => addConnectedRiskAction(target, showToast)),
    })
  }

  // --- Mark as assumption (factor, risk, outcome, goal only — not org nodes) ---
  if (isFull || isGoal) {
    const isFlagged = node.data?.flagged_as_assumption === true
    items.push({
      id: 'mark-assumption',
      label: isFlagged ? 'Remove assumption flag' : 'Mark as assumption',
      icon: Flag,
      tooltip: isFlagged ? 'Remove the assumption flag' : 'Flag for validation (visual indicator persists)',
      enabled: true,
      action: wrap(() => markAsAssumption(target.nodeId, 'node', showToast)),
    })
  }

  // --- Graph Lens items (post-analysis only) ---
  if (isGraphLensEnabled()) {
    const state = useCanvasStore.getState()
    const resultsComplete = selectResultsStatus(state) === 'complete'

    if (resultsComplete && kind === 'option') {
      items.push({
        id: 'lens-isolate-option',
        label: "Isolate this option's paths",
        icon: Layers,
        tooltip: 'Show only the causal paths for this option',
        enabled: true,
        action: wrap(() => state.setLens('option', target.nodeId)),
      })
    }

    if (resultsComplete && kind === 'factor') {
      const report = selectReport(state) as Record<string, unknown> | null | undefined
      const factorSensitivity = report?.factor_sensitivity as Array<{ node_id: string }> | undefined
      const hasSensitivity = factorSensitivity?.some(f => f.node_id === target.nodeId)

      if (hasSensitivity) {
        items.push({
          id: 'lens-sensitivity',
          label: 'Show sensitivity view',
          icon: Layers,
          tooltip: 'Highlight edges by sensitivity weight',
          enabled: true,
          action: wrap(() => state.setLens('sensitivity')),
        })
      }
    }
  }

  items.push(DIV)

  // --- Standard clipboard + delete ---
  items.push(
    {
      id: 'cut',
      label: 'Cut',
      icon: Scissors,
      shortcut: '\u2318X',
      tooltip: 'Cut selected elements',
      enabled: true,
      action: wrap(() => cutAction(showToast)),
    },
    {
      id: 'duplicate',
      label: 'Duplicate',
      icon: CopyPlus,
      shortcut: '\u2318D',
      tooltip: 'Duplicate selected elements',
      enabled: true,
      action: wrap(() => duplicateAction(showToast)),
    },
    {
      id: 'delete',
      label: 'Delete',
      icon: Trash2,
      shortcut: 'Del',
      tooltip: 'Delete this element',
      enabled: true,
      destructive: true,
      action: wrap(() => deleteAction(target, showToast)),
    },
  )

  return items
}

// ---------------------------------------------------------------------------
// Edge menus
// ---------------------------------------------------------------------------

function buildEdgeMenu(
  target: Extract<ContextTarget, { kind: 'edge' }>,
  showToast: ShowToastFn,
  wrap: (action: () => void | Promise<void>) => () => void,
): MenuEntry[] {
  const items: MenuEntry[] = []

  // Ask AI submenu
  const askAIItems: MenuEntry[] = [
    {
      id: 'ask-ai-explain',
      label: 'Explain this',
      icon: Sparkles,
      tooltip: target.isStructural
        ? 'What this structural connection means'
        : 'Why this relationship exists and how strong it is',
      enabled: true,
      action: wrap(() => askAI(target, 'explain_element', showToast)),
    },
  ]
  if (!target.isStructural) {
    askAIItems.push({
      id: 'ask-ai-challenge',
      label: 'Challenge this',
      icon: Zap,
      tooltip: 'Ask AI to argue this link is wrong or overweighted',
      enabled: true,
      action: wrap(() => askAI(target, 'challenge_element', showToast)),
    })
  }
  items.push({
    id: 'ask-ai',
    label: 'Ask AI',
    icon: Sparkles,
    tooltip: 'AI-powered analysis',
    enabled: true,
    hasSubmenu: true,
    submenuItems: askAIItems,
    action: () => {},
  })

  items.push(DIV)

  // Mark as assumption (causal edges only)
  if (!target.isStructural) {
    const isFlagged = target.edge.data?.flagged_as_assumption === true
    items.push({
      id: 'mark-assumption',
      label: isFlagged ? 'Remove assumption flag' : 'Mark as assumption',
      icon: Flag,
      tooltip: isFlagged ? 'Remove the assumption flag' : 'Flag for validation',
      enabled: true,
      action: wrap(() => markAsAssumption(target.edgeId, 'edge', showToast)),
    })
  }

  // --- Graph Lens: fragile edge item (post-analysis only) ---
  if (isGraphLensEnabled()) {
    const state = useCanvasStore.getState()
    const resultsComplete = selectResultsStatus(state) === 'complete'

    if (resultsComplete) {
      const report = selectReport(state) as Record<string, unknown> | null | undefined
      const robustness = report?.robustness as { fragile_edges?: Array<Record<string, unknown>> } | undefined
      const fragileEdges = robustness?.fragile_edges ?? []
      const isFragile = isEdgeFragileFn(target.edgeId, target.edge.source, target.edge.target, fragileEdges)

      if (isFragile) {
        items.push({
          id: 'lens-fragile',
          label: 'Show all fragile edges',
          icon: Layers,
          tooltip: 'Highlight all edges that could flip the result',
          enabled: true,
          action: wrap(() => state.setLens('fragile')),
        })
      }
    }
  }

  // Graph Editing Experience Task 3b: Edge manipulation actions
  if (!target.isStructural) {
    items.push(DIV)
    items.push({
      id: 'reverse-edge',
      label: 'Reverse direction',
      icon: ArrowLeftRight,
      tooltip: 'Swap source and target of this relationship',
      enabled: true,
      action: wrap(() => reverseEdgeAction(target.edgeId, showToast)),
    })
    items.push({
      id: 'insert-factor-between',
      label: 'Insert factor between',
      icon: Plus,
      tooltip: 'Create a new factor on this edge, splitting it into two',
      enabled: true,
      action: wrap(() => insertFactorBetweenAction(target.edgeId, showToast)),
    })
  }

  items.push(DIV)

  // Delete
  items.push({
    id: 'delete',
    label: 'Delete',
    icon: Trash2,
    shortcut: 'Del',
    tooltip: 'Delete this connector',
    enabled: true,
    destructive: true,
    action: wrap(() => deleteAction(target, showToast)),
  })

  return items
}

// ---------------------------------------------------------------------------
// Multi-select menu
// ---------------------------------------------------------------------------

function buildMultiMenu(
  target: Extract<ContextTarget, { kind: 'multi' }>,
  showToast: ShowToastFn,
  wrap: (action: () => void | Promise<void>) => () => void,
): MenuEntry[] {
  return [
    {
      id: 'ask-ai',
      label: 'Ask AI',
      icon: Sparkles,
      tooltip: 'AI-powered analysis',
      enabled: true,
      hasSubmenu: true,
      submenuItems: [
        {
          id: 'ask-ai-explain',
          label: 'Explain this',
          icon: MessageSquare,
          tooltip: 'Explain the relationship between these selected elements',
          enabled: true,
          action: wrap(() => askAI(target, 'explain_subgraph', showToast)),
        },
      ],
      action: () => {},
    },
    DIV,
    {
      id: 'cut',
      label: 'Cut',
      icon: Scissors,
      shortcut: '\u2318X',
      tooltip: 'Cut selected elements',
      enabled: true,
      action: wrap(() => cutAction(showToast)),
    },
    {
      id: 'duplicate',
      label: 'Duplicate',
      icon: CopyPlus,
      shortcut: '\u2318D',
      tooltip: 'Duplicate selected elements',
      enabled: true,
      action: wrap(() => duplicateAction(showToast)),
    },
    {
      id: 'delete',
      label: 'Delete',
      icon: Trash2,
      shortcut: 'Del',
      tooltip: 'Delete selected elements',
      enabled: true,
      destructive: true,
      action: wrap(() => deleteAction(target, showToast)),
    },
  ]
}

// Re-export for testing
export { NODE_TYPE_ITEMS, FULL_MENU_KINDS, ORG_KINDS, getNodeRange }
