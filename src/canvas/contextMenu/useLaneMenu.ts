/**
 * The lane's menu items, from the stores the lane reads (the View, the page's person, the layout-undo stack). The legacy `useMenuItems` is
 * left exactly as it was for the legacy canvas; `CanvasContextMenu` asks this one on the olumi-core lane (`isOlumiCoreLane`).
 */
import { requestAsk } from '../ui/inspector-v2/askSemantic'
import { useCallback, useMemo } from 'react'
import { useMe } from '../../olumiCore/me'
import { isOlumiCoreLane } from '../../olumiCore/lane'
import { placeViewCards } from '../../olumiView/canvas'
import { QUESTION } from '../../olumiView/layout'
import { useViewStore } from '../../olumiView/store'
import { askProposalReview, askVersionReview } from '../../olumiView/v12/chat/proposalAsk'
import { versionReviewOf } from '../../olumiView/v12/chat/versionReview'
import { toggleSimple, useLevel } from '../../olumiView/v12/simpleStore'
import { editGateNow } from '../../olumiView/v12/edit/editGate'
import { openLaneForm, openLinkRemoval } from '../../olumiView/v12/edit/structuralEdits'
import { type EditSpec } from '../../olumiView/v12/edit/EditForm'
import { openRenameCard } from '../../olumiView/v12/edit/renameCard'
import { useLaneInspector } from '../../olumiView/v12/edit/inspectorStore'
import { clearLayoutUndo, pressUndo, useUndoChoices } from '../../olumiView/v12/edit/undo'
import { askAI } from './actions'
import { buildLaneMenu, type LaneMenuCtx } from './laneMenu'
import type { ContextTarget, MenuEntry } from './types'
import type { MenuItemsHook } from './CanvasContextMenu'

type Toast = (message: string, type: 'error' | 'info' | 'success' | 'warning') => void

type CtxOptions = {
  showToast: Toast; onClose: () => void; openForm: (spec: EditSpec) => void
  openRemove?: LaneMenuCtx['act']['openRemove']
  interactionMode?: 'select' | 'hand'; onSetInteractionMode?: (mode: 'select' | 'hand') => void
}
export function useLaneCtx(o: CtxOptions): LaneMenuCtx {
  const { showToast, onClose, openForm, openRemove, interactionMode, onSetInteractionMode } = o
  const view = useViewStore((s) => s.view), at = useViewStore((s) => s.at), stale = useViewStore((s) => s.stale), error = useViewStore((s) => s.error), sid = useViewStore((s) => s.sid)
  const me = useMe((s) => s.me)
  const level = useLevel()
  const undo = useUndoChoices()
  return useMemo((): LaneMenuCtx => ({
    gate: editGateNow(), model: view?.model ?? null, undo, level, mode: interactionMode, questionId: QUESTION,
    reviewVersion: versionReviewOf(view)?.version.id ?? null,
    act: {
      open: openForm,
      openRemove,
      openDetails: (t) => { useLaneInspector.getState().open(t); onClose() },
      // Surfaces step 5: on the lane a figure is changed in the details' Value row, whichever control asked. The older look keeps its small form.
      openRename: isOlumiCoreLane() ? (id) => { if (openRenameCard(id)) onClose() } : undefined,
      openFigure: isOlumiCoreLane() ? (t) => { useLaneInspector.getState().openFigure(t); onClose() } : undefined,
      review: isOlumiCoreLane() ? () => { askProposalReview(); onClose() } : undefined,
      reviewVersion: (id) => { askVersionReview(id); onClose() },
      ask: (t, intent) => { askAI(t, intent, showToast); onClose() },
      prefill: (text, label, targetId) => { if (requestAsk({ text, label, targetId, source: 'node-coaching-icon' }) === 'none') showToast('The conversation is not open yet. Try again in a moment.', 'warning'); onClose() },
      pressUndo: (dir) => { void pressUndo(dir).then((r) => { if (!r.ok) showToast(r.words, 'error'); else if (r.kind === 'saved' && r.warning !== undefined) showToast(r.warning, 'warning') }); onClose() },
      autoArrange: () => { const m = useViewStore.getState().view?.model; if (m) { clearLayoutUndo(); void placeViewCards(m) } onClose() },
      toggleLevel: () => { toggleSimple(); onClose() },
      setMode: onSetInteractionMode === undefined ? undefined : (m) => { onSetInteractionMode(m); onClose() },
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [view, at, stale, error, sid, me, level, undo, interactionMode, onSetInteractionMode, openForm, openRemove, onClose, showToast])
}

export function useLaneMenu(o: CtxOptions & { target: ContextTarget }): MenuEntry[] {
  const ctx = useLaneCtx(o)
  return useMemo(() => buildLaneMenu(o.target, ctx), [o.target, ctx])
}

/**
 * The shared menu's items hook on the lane: the rows. A row that needs the one small edit form shows it through the one surface store, where it takes
 * the menu's place (one thing open at a time); LaneEditingLayer draws it, so the menu itself has no overlay.
 */
export const useLaneItems: MenuItemsHook = (o) => {
  const { x, y } = o.target.screenPos
  const openForm = useCallback((spec: EditSpec) => { openLaneForm(spec, { x, y }, undefined, o.target.opener) }, [x, y, o.target.opener])
  const openRemove = useCallback((link: Parameters<typeof openLinkRemoval>[0]) => {
    openLinkRemoval(link, o.target.opener)
  }, [o.target.opener])
  const items = useLaneMenu({ target: o.target, showToast: o.showToast, onClose: o.onClose, openForm, openRemove, interactionMode: o.interactionMode, onSetInteractionMode: o.onSetInteractionMode })
  return { items, overlay: null }
}
