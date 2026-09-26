/**
 * InspectorShell — the one shell every inspector pane renders in.
 *
 * ⭐ CANVAS VISUAL CONTRACT v3.1 (DESIGN-GAP-v31 rows 7, 8). The contract's
 * `.inspector` is 330px, a 1px `#B8D5CF` border, radius 12px; its head holds a
 * 10px MUTED kind label, a 14px/600 title and Close — nothing else.
 *
 *  · THE KIND LABEL IS MUTED, NEVER THE KIND COLOUR. The served label was set
 *    in the kind colour at 11px: Goal `#F5C433` measured 1.62:1 on the panel,
 *    Factor 2.34:1, Risk 2.80:1 (v3.1 point 12 fails). The kind still reads —
 *    in words — and the card on the canvas carries the colour.
 *  · THE TITLE IS NEVER CLIPPED. It wraps (`EditableLabel wrap`), so a long
 *    name is read in full here, which is v3.1's "keep full labels accessible
 *    through focus/click as well as hover".
 *  · "Back to results" and the `</>` toggle LEFT THE HEAD. The route back is
 *    now "Back to the conversation" (v3.1 point 11), a body button beside
 *    "Explore with Olumi" (see `InspectorQuickActions`). The technical-detail
 *    toggle is NOT deleted, because it is also a REACHABILITY route: an option
 *    target whose unit the entry frame cannot convert is changed under it
 *    (`OPTION_TARGET_EDIT_ROUTE_NOTE`), and the risk/outcome advanced editors
 *    open under it. It moved to the foot of the body, keeping its accessible
 *    name, so every sentence that names it stays true.
 *  · The confidence-coded border and the header confidence badge are gone:
 *    one border colour for every pane (the body keeps any stated figure).
 *
 * Header is the drag surface when dragHandlers are provided.
 */

import { memo, useState, useCallback, useEffect, type KeyboardEvent } from 'react'
import { X, HelpCircle } from 'lucide-react'
import { typography } from '../../../styles/typography'
import { useCanvasStore } from '../../store'
import type { InspectorShellProps } from './types'
import { EditableLabel } from './shared/EditableLabel'
import { NODE_LABEL_MAX_LENGTH } from './useInspectorMutations'
import { useRenameIntentStore, clearNodeRename } from './renameIntent'
import {
  INSPECTOR_SHELL_STYLE,
  INSPECTOR_WIDTH_PX,
  INSPECTOR_RULE,
  inspectorIconButton,
} from './inspectorStyle'

export const InspectorShell = memo(function InspectorShell({
  nodeId,
  label,
  onLabelChange,
  typePill,
  techMode,
  onTechToggleChange,
  onClose,
  dragHandlers,
  quickActions,
  footerNote,
  children,
}: InspectorShellProps) {
  const rationale = useCanvasStore((s) => nodeId ? s.nodeRationales?.[nodeId] : undefined)
  const [showRationale, setShowRationale] = useState(false)

  // L-04 — a pending rename intent for THIS element opens the title in editing
  // state, then is consumed.
  //
  // ⚠ THIS WAS A BOOLEAN AND IT LEAKED (adversarial review D1). The live
  // inspector does NOT remount per selection: `InspectorModal` keeps ONE shell
  // mounted and changes `nodeId`. A boolean `autoEdit` therefore stayed true
  // across a retarget, so selecting node B after arming node A opened B's
  // editor — holding A's text, because the editor's own draft also survived —
  // and the blur-save wrote "Option A" onto node B. A silent, wrong, persisted
  // rename, and every test in the first round rendered FRESH, which is exactly
  // why none of them could see it.
  //
  // The intent is now carried AS AN ID at every hop and is only honoured when
  // it matches the node the shell is currently mounted for. Consumption clears
  // it, so returning to A does not reopen the editor under a user who has
  // moved on.
  const renameNodeId = useRenameIntentStore((s) => s.renameNodeId)
  const [armedForNodeId, setArmedForNodeId] = useState<string | null>(null)
  useEffect(() => {
    if (nodeId && renameNodeId === nodeId) {
      setArmedForNodeId(nodeId)
      clearNodeRename()
    }
  }, [nodeId, renameNodeId])
  // The comparison — not a boolean — is what makes a retarget disarm.
  const autoEditLabel = armedForNodeId !== null && armedForNodeId === nodeId
  // One-shot: once the editor has opened, the intent is spent.
  const handleAutoEditConsumed = useCallback(() => setArmedForNodeId(null), [])

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
    }
  }, [onClose])

  const isDragging = dragHandlers?.isDragging ?? false

  return (
    <div
      className="bg-panel overflow-hidden font-sans flex flex-col"
      style={INSPECTOR_SHELL_STYLE}
      data-inspector-width={String(INSPECTOR_WIDTH_PX)}
      role="region"
      aria-label="Inspector panel"
      onKeyDown={handleKeyDown}
    >
      {/* Head — `.inspector-head`: kind, title, Close. The drag surface. */}
      <div
        data-testid="inspector-header"
        className={`relative flex items-start gap-2 px-3.5 py-[13px] border-b ${INSPECTOR_RULE.head} bg-white select-none shrink-0 ${
          dragHandlers ? (isDragging ? 'cursor-grabbing' : 'cursor-grab') : ''
        }`}
        {...(dragHandlers ? {
          onPointerDown: dragHandlers.onPointerDown,
          onPointerMove: dragHandlers.onPointerMove,
          onPointerUp: dragHandlers.onPointerUp,
          onPointerCancel: dragHandlers.onPointerCancel,
        } : {})}
      >
        <div className="flex-1 min-w-0">
          {/* The KIND, in words, muted — never the kind colour (v3.1 point 12). */}
          <div
            data-testid="inspector-kind-label"
            className="text-[10px] leading-snug text-text-light mb-1"
          >
            {typePill}
          </div>
          <div className="flex items-start gap-1">
            {/* `key` is load-bearing, not cosmetic (D1): it remounts the
                editor whenever the shell is retargeted, so an open editor
                and a half-typed draft CANNOT survive onto the next element.
                Without it a retarget mid-rename carries the previous
                element's text into this one's save. An abandoned edit is
                discarded, which is the honest outcome — the user navigated
                away from it.
                ⭐ `wrap` ALWAYS: v3.1's title is never clipped. It used to wrap
                on options only, so every other long name ended in "…". */}
            <EditableLabel
              key={nodeId ?? 'inspector-label'}
              value={label}
              wrap
              onSave={onLabelChange}
              maxLength={NODE_LABEL_MAX_LENGTH}
              autoEdit={autoEditLabel}
              onAutoEditConsumed={handleAutoEditConsumed}
              className="text-sm font-semibold leading-[1.4] text-text-header"
            />
            {rationale && (
              <button
                onClick={() => setShowRationale(v => !v)}
                title="Why this element was included"
                aria-label="Why this element was included"
                aria-expanded={showRationale}
                className="p-0.5 mt-0.5 rounded hover:bg-panel-hover transition-colors shrink-0"
              >
                <HelpCircle size={14} className="text-text-light" />
              </button>
            )}
          </div>
          {showRationale && rationale && (
            <p className={`${typography.panelMeta} text-text-light mt-1`}>{rationale}</p>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close inspector"
          title="Close inspector"
          className={inspectorIconButton}
        >
          <X size={15} aria-hidden="true" />
        </button>
      </div>

      {/* Body — `.inspector-body`, the one scrolling region.
          R5 (Paul, 16 Aug): the conversation routes sit at the TOP of the body,
          above every group, so they are never buried behind a scroll. v3.1's
          quiet note closes the body; the technical-detail toggle sits just above
          it (see the header note for why it is kept). */}
      <div data-testid="inspector-body" className="px-3.5 pb-3.5 overflow-y-auto min-h-0 flex-1">
        {quickActions}
        {children}
        <div className="mt-3 flex justify-start">
          <button
            type="button"
            data-testid="inspector-tech-toggle"
            onClick={() => onTechToggleChange(!techMode)}
            title={techMode ? 'Hide technical detail' : 'Show technical detail'}
            aria-label={techMode ? 'Hide technical detail' : 'Show technical detail'}
            // Paul 23 Sep contract feedback point 12: the toggle's state is
            // announced, not carried by the glyph's colour alone.
            aria-pressed={techMode}
            className={`inline-flex items-center gap-1 text-[10px] leading-snug rounded px-1 -mx-1 py-0.5 transition-colors hover:text-info focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-info ${
              techMode ? 'text-info' : 'text-text-light'
            }`}
          >
            <span aria-hidden="true">{'</>'}</span>
            <span aria-hidden="true">Technical detail</span>
          </button>
        </div>
        {footerNote}
      </div>
    </div>
  )
})
