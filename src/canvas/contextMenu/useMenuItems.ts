/**
 * useMenuItems — builds the context menu item list based on target.
 *
 * Implements spec §3.1–3.4 menu content with conditional visibility
 * per node kind, edge type, canvas, and multi-selection.
 */

import { useMemo } from 'react'
import {
  Sparkles, Zap, Crosshair, SlidersHorizontal, ArrowUpToLine, ArrowDownToLine,
  RotateCcw, Pencil, Plus, Flag, Scissors, Copy, ClipboardPaste, CopyPlus,
  Trash2, MessageSquare, Layers, TrendingUp, AlertTriangle, ArrowLeftRight, Eye,
  Undo2, Redo2, LayoutGrid,
} from 'lucide-react'
import type { ComponentType } from 'react'
import { useCanvasStore, selectResultsStatus, selectReport } from '../store'
import { useLayoutProgressStore } from '../layoutProgressStore'
import { isGraphLensEnabled } from '../../flags'
import { isEdgeFragile as isEdgeFragileFn } from '../utils/fragileEdgeMatch'
import type { ContextTarget, MenuEntry, MenuItemDef } from './types'
import type { NodeType } from '../domain/nodes'
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
  copyAction,
  cutAction,
  pasteAction,
  duplicateAction,
  setValueBestCase,
  setValueWorstCase,
  setValueReset,
} from './actions'

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
  { type: 'decision', label: 'Decision', glyph: '\u2B22', color: 'text-info', tooltip: 'Choice point between options' },
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
}

export function useMenuItems({
  target,
  showToast,
  screenToFlowPosition,
  onClose,
  onOpenCustomValue,
}: UseMenuItemsOptions): MenuEntry[] {
  const clipboard = useCanvasStore((s) => s.clipboard)
  const hasClipboard = clipboard !== null && clipboard.nodes.length > 0

  return useMemo(() => {
    const wrap = (action: () => void | Promise<void>) => () => { void action(); onClose() }

    if (target.kind === 'pane') {
      return buildPaneMenu(target, showToast, screenToFlowPosition, hasClipboard, wrap)
    }
    if (target.kind === 'node') {
      return buildNodeMenu(target, showToast, wrap, onOpenCustomValue)
    }
    if (target.kind === 'edge') {
      return buildEdgeMenu(target, showToast, wrap)
    }
    if (target.kind === 'multi') {
      return buildMultiMenu(target, showToast, hasClipboard, wrap)
    }
    return []
  }, [target, showToast, screenToFlowPosition, hasClipboard, onClose, onOpenCustomValue])
}

// ---------------------------------------------------------------------------
// Pane menu (empty canvas)
// ---------------------------------------------------------------------------

function buildPaneMenu(
  target: Extract<ContextTarget, { kind: 'pane' }>,
  showToast: ShowToastFn,
  screenToFlowPosition: (pos: { x: number; y: number }) => { x: number; y: number },
  hasClipboard: boolean,
  wrap: (action: () => void | Promise<void>) => () => void,
): MenuEntry[] {
  const flowPos = screenToFlowPosition(target.screenPos)

  const addNodeSubmenu: MenuEntry[] = NODE_TYPE_ITEMS.map((nt) => ({
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
    {
      id: 'paste',
      label: 'Paste',
      icon: ClipboardPaste,
      shortcut: '\u2318V',
      tooltip: 'Paste copied elements',
      enabled: hasClipboard,
      disabledReason: hasClipboard ? undefined : 'Nothing to paste',
      action: wrap(() => pasteAction(flowPos, showToast)),
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
        const runLayout = (): Promise<void> =>
          s.applyLayout()
            .then(() => {
              useLayoutProgressStore.getState().succeed()
              showToast('Auto-arranged layout.', 'success')
            })
            .catch((err) => {
              if (import.meta.env.DEV) {
                console.warn('[useMenuItems] Auto-arrange layout failed:', err)
              }
              useLayoutProgressStore.getState().fail('Layout failed. Try again.', () => {
                void runLayout()
              })
            })
        void runLayout()
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
  const isOrg = ORG_KINDS.has(kind)
  const isGoal = kind === 'goal'
  const node = target.node

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
  if (isFull || isGoal) {
    askAIItems.push({
      id: 'ask-ai-challenge',
      label: 'Challenge this',
      icon: Zap,
      tooltip: "Ask AI to argue against this element's current setup",
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
      id: 'copy',
      label: 'Copy',
      icon: Copy,
      shortcut: '\u2318C',
      tooltip: 'Copy selected elements',
      enabled: true,
      action: wrap(() => copyAction()),
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
  _hasClipboard: boolean,
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
      id: 'copy',
      label: 'Copy',
      icon: Copy,
      shortcut: '\u2318C',
      tooltip: 'Copy selected elements',
      enabled: true,
      action: wrap(() => copyAction()),
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
