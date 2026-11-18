/**
 * The lane's menu items, from the stores the lane reads (the View, the page's person, the layout-undo stack). The legacy `useMenuItems` is
 * left exactly as it was for the legacy canvas; `CanvasContextMenu` asks this one on the olumi-core lane (`isOlumiCoreLane`).
 */
import { requestAsk } from '../ui/inspector-v2/askSemantic'
import { useCallback, useMemo } from 'react'
import { useMe } from '../../olumiCore/me'
import { placeViewCards } from '../../olumiView/canvas'
import { QUESTION } from '../../olumiView/layout'
import { useViewStore } from '../../olumiView/store'
import { toggleSimple, useLevel } from '../../olumiView/v12/simpleStore'
import { editGateNow } from '../../olumiView/v12/edit/editGate'
import { writeKeyOf, type EditSpec } from '../../olumiView/v12/edit/EditForm'
import { useLaneInspector } from '../../olumiView/v12/edit/inspectorStore'
import { clearLayoutUndo, pressUndo, useUndoChoices } from '../../olumiView/v12/edit/undo'
import { askAI } from './actions'
import { buildLaneMenu, type LaneMenuCtx } from './laneMenu'
import type { ContextTarget, MenuEntry } from './types'
import type { MenuItemsHook } from './CanvasContextMenu'

type Toast = (message: string, type: 'error' | 'info' | 'success' | 'warning') => void

type CtxOptions = {
  showToast: Toast; onClose: () => void; openForm: (spec: EditSpec) => void
  interactionMode?: 'select' | 'hand'; onSetInteractionMode?: (mode: 'select' | 'hand') => void
}
export function useLaneCtx(o: CtxOptions): LaneMenuCtx {
  const { showToast, onClose, openForm, interactionMode, onSetInteractionMode } = o
  const view = useViewStore((s) => s.view), at = useViewStore((s) => s.at), stale = useViewStore((s) => s.stale), error = useViewStore((s) => s.error), sid = useViewStore((s) => s.sid)
  const me = useMe((s) => s.me)
  const level = useLevel()
  const undo = useUndoChoices()
  return useMemo((): LaneMenuCtx => ({
    gate: editGateNow(), model: view?.model ?? null, undo, level, mode: interactionMode, questionId: QUESTION,
    act: {
      open: openForm,
      openDetails: (t) => { useLaneInspector.getState().open(t); onClose() },
      ask: (t, intent) => { askAI(t, intent, showToast); onClose() },
      prefill: (text, label, targetId) => { if (requestAsk({ text, label, targetId, source: 'node-coaching-icon' }) === 'none') showToast('The conversation is not open yet. Try again in a moment.', 'warning'); onClose() },
      pressUndo: (dir) => { void pressUndo(dir).then((r) => { if (!r.ok) showToast(r.words, 'error'); else if (r.kind === 'saved' && r.warning !== undefined) showToast(r.warning, 'warning') }); onClose() },
      autoArrange: () => { const m = useViewStore.getState().view?.model; if (m) { clearLayoutUndo(); void placeViewCards(m) } onClose() },
      toggleLevel: () => { toggleSimple(); onClose() },
      setMode: onSetInteractionMode === undefined ? undefined : (m) => { onSetInteractionMode(m); onClose() },
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [view, at, stale, error, sid, me, level, undo, interactionMode, onSetInteractionMode, openForm, onClose, showToast])
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
  const openForm = useCallback((spec: EditSpec) => { useLaneInspector.getState().show({ kind: 'form', spec, anchor: { x, y }, busyKey: writeKeyOf(spec) }) }, [x, y])
  const items = useLaneMenu({ target: o.target, showToast: o.showToast, onClose: o.onClose, openForm, interactionMode: o.interactionMode, onSetInteractionMode: o.onSetInteractionMode })
  return { items, overlay: null }
}
