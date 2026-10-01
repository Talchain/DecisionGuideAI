/**
 * ⭐ E2 — A LINK IS EDITED WHERE IT IS CLICKED (Paul 29 Sep: "an anchored edge mini-editor"; inspector = "More detail").
 *
 * A click on a link opens this small card at the pointer instead of the full inspector. It offers the ONE edit people
 * make on a link, its strength, through the inspector's own control (`StrengthBandButtons`) and writer
 * (`useEdgeMutations.setStrength`, `preserveDirection` — the same call `EdgePanel`'s band makes, carried as
 * `edge_strength_edit` with its `expected` CAS). "More detail" opens the full inspector, which keeps every other edit.
 *
 * The word under the bands is settled on the send (`valueCommitSettlementWord`, shared with the cards): "Saving…",
 * then "Saved" only when the store holds the new strength after the reply, or the estate's "Not saved" sentence.
 * A link with no stated strength says so rather than showing a band it does not have.
 *
 * Direction ("Increases" / "Decreases") goes through the DIRECTION-ONLY writer, `setDirection` (its own
 * `direction_intent`), never a signed strength: a zero magnitude cannot carry a sign (−0 reads as positive), PR Review
 * 5897803345. The pressed button is the PROVENANCE-GATED direction (`resolveEdgeDirectionDisplay`): a defaulted
 * `positive` nobody stated, or a producer's explicit `unknown`, presses neither.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { create } from 'zustand'
import { useCanvasStore } from '../store'
import { useEdgeMutations } from '../ui/inspector-v2/useInspectorMutations'
import { StrengthBandButtons } from '../ui/inspector-v2/shared/StrengthBandButtons'
import { resolveEdgeDirectionDisplay, resolveEdgeSignedStrengthDisplay } from '../domain/edgeValueProvenance'
import { resolveElementLabel } from '../domain/elementLabel'
import { isStructuralEdge } from '../domain/edgeUtils'
import { isStrengthDefinitional, STRENGTH_HOLDS_BY_DEFINITION } from '../domain/strengthDefinitional'
import {
  VALUE_COMMIT_SETTLEMENT_COPY,
  valueCommitSettlementWord,
  type ValueCommitSettlementWord,
} from '../conversation/valueCommitSettlement'
import { typography } from '../../styles/typography'

export interface LinkQuickEditorProps {
  edgeId: string
  /** Viewport (client) coordinates of the click. */
  x: number
  y: number
  onClose: () => void
  onMoreDetail: () => void
}

/** The STATED direction as ±1, or null when no one stated it (provenance-gated, the read-side contract). */
function storedDirectionSign(edgeId: string): 1 | -1 | null {
  const d = useCanvasStore.getState().edges.find((e) => e.id === edgeId)?.data as Record<string, unknown> | undefined
  const shown = resolveEdgeDirectionDisplay(d)
  return shown.show ? (shown.direction === 'negative' ? -1 : 1) : null
}

function storedSigned(edgeId: string): number | null {
  const d = useCanvasStore.getState().edges.find((e) => e.id === edgeId)?.data as Record<string, unknown> | undefined
  const w = typeof d?.weight === 'number' ? d.weight : null
  if (w === null) return null
  return d?.direction === 'negative' ? -Math.abs(w) : Math.abs(w)
}

export function LinkQuickEditor({ edgeId, x, y, onClose, onMoreDetail }: LinkQuickEditorProps) {
  const edge = useCanvasStore((s) => s.edges.find((e) => e.id === edgeId))
  const fromLabel = useCanvasStore((s) => resolveElementLabel(s.nodes.find((n) => n.id === edge?.source)?.data))
  const toLabel = useCanvasStore((s) => resolveElementLabel(s.nodes.find((n) => n.id === edge?.target)?.data))
  const mutations = useEdgeMutations(edgeId)
  const display = resolveEdgeSignedStrengthDisplay(edge?.data as Record<string, unknown> | undefined)
  const [local, setLocal] = useState<number>(() => storedSigned(edgeId) ?? 0)
  const [word, setWord] = useState<ValueCommitSettlementWord | 'saved' | null>(null)
  const seq = useRef(0)
  const ref = useRef<HTMLDivElement | null>(null)

  // Escape or a press outside closes it, as every other popover on the canvas does.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    const onDown = (e: PointerEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose() }
    window.addEventListener('keydown', onKey)
    window.addEventListener('pointerdown', onDown, true)
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('pointerdown', onDown, true) }
  }, [onClose])

  const commit = useCallback((v: number, preserveDirection: boolean) => {
    const mine = ++seq.current
    const before = storedSigned(edgeId)
    setLocal(v)
    setWord('saving')
    const outcome = mutations.setStrength(v, {
      preserveDirection,
      onSendSettled: (settlement) => {
        if (mine !== seq.current) return
        const w = valueCommitSettlementWord(settlement, before, v, () => storedSigned(edgeId))
        if (w === 'not_applied' || w === 'unconfirmed') setLocal(storedSigned(edgeId) ?? v)
        setWord(w ?? 'saved')
      },
    })
    if (outcome !== 'dispatched') setWord('local_only')
  }, [edgeId, mutations])
  const onChange = useCallback((v: number) => commit(v, true), [commit])
  const onDirection = useCallback((dir: 'positive' | 'negative') => {
    const mine = ++seq.current
    const before = storedDirectionSign(edgeId)
    const to = dir === 'negative' ? -1 : 1
    setWord('saving')
    const outcome = mutations.setDirection(dir, {
      onSendSettled: (settlement) => {
        if (mine !== seq.current) return
        setWord(valueCommitSettlementWord(settlement, before, to, () => storedDirectionSign(edgeId)) ?? 'saved')
        setLocal(storedSigned(edgeId) ?? 0)
      },
    })
    if (outcome !== 'dispatched') setWord('local_only')
  }, [edgeId, mutations])
  const statedDirection = resolveEdgeDirectionDisplay(edge?.data as Record<string, unknown> | undefined)
  // ⛔ A STRUCTURAL LINK HAS NO STRENGTH OR DIRECTION TO SET (served 29 Sep, MRR `823bc028`: the editor offered bands
  // on "decision → Carry on as now", and a witness wrote a strength to one). The SAME predicate the inspector asks.
  // Returns the SOURCE's kind so the words say what the link is: an option → factor link carries the value the option
  // sets (served cut-costs `09af9019` called it "decision to an option").
  const structural = useCanvasStore((s) => {
    const e = s.edges.find((x) => x.id === edgeId)
    if (!e) return null
    const kindOf = (id: string) => {
      const n = s.nodes.find((nn) => nn.id === id)
      return ((n?.data as Record<string, unknown> | undefined)?.kind as string | undefined) ?? n?.type
    }
    if (!isStructuralEdge(e as never, kindOf)) return null
    const from = kindOf(e.source)
    return from === 'decision' || from === 'option' ? from : 'other'
  })

  // ⛔ A LINK THAT HOLDS BY DEFINITION HAS NO STRENGTH OR DIRECTION TO SET (MG ruling, 1 Oct 2026): CEE refuses both on
  // it. The card says what the link is, in the inspector's own sentence. A strength the person set is not definitional.
  const definitional = isStrengthDefinitional(edge?.data as Record<string, unknown> | undefined)

  if (!edge) return null
  const left = Math.min(x + 8, (typeof window !== 'undefined' ? window.innerWidth : 1440) - 280)
  const top = Math.min(y + 8, (typeof window !== 'undefined' ? window.innerHeight : 900) - 200)
  const copy = word && word !== 'saved' ? VALUE_COMMIT_SETTLEMENT_COPY[word] : null

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label={`Link from ${fromLabel} to ${toLabel}`}
      data-testid="link-quick-editor"
      className="fixed z-50 w-[264px] rounded-lg border border-panel-border bg-panel p-3 shadow-lg nodrag nopan"
      style={{ left, top }}
    >
      <p className={`${typography.panelMeta} text-text-light m-0`}>Link</p>
      <p className={`${typography.panelBody} text-text-body m-0 mb-2 break-words`}>
        {fromLabel} → {toLabel}
      </p>
      {structural ? (
        <p className={`${typography.panelMeta} text-text-light m-0`} data-testid="link-quick-editor-structural">
          {structural === 'decision'
            ? 'This link connects the decision to an option. It has no strength to set.'
            : structural === 'option'
              ? `${fromLabel} sets ${toLabel}. Change the value on the option card; this link has no strength to set.`
              : 'This link is part of the model’s structure. It has no strength to set.'}
        </p>
      ) : definitional ? (
        <p className={`${typography.panelMeta} text-text-light m-0`} data-testid="link-quick-editor-definitional">
          {STRENGTH_HOLDS_BY_DEFINITION}
        </p>
      ) : display.show ? (
        <>
          <div role="group" aria-label="Direction" className="mb-2 flex gap-1" data-testid="link-quick-editor-direction">
            {(['positive', 'negative'] as const).map((dir) => {
              const pressed = statedDirection.show && statedDirection.direction === dir
              return (
                <button
                  key={dir}
                  type="button"
                  aria-pressed={pressed}
                  data-testid={`link-quick-editor-direction-${dir}`}
                  className={`${typography.panelMeta} rounded border px-2 py-0.5 ${pressed ? 'border-text-body bg-panel-hover text-text-body' : 'border-panel-border text-text-light hover:bg-panel-hover'}`}
                  onClick={() => { if (!pressed) onDirection(dir) }}
                >
                  {dir === 'positive' ? 'Increases' : 'Decreases'}
                </button>
              )
            })}
          </div>
          <StrengthBandButtons value={local} onChange={onChange} />
        </>
      ) : (
        <p className={`${typography.panelMeta} text-text-light m-0`} data-testid="link-quick-editor-no-strength">
          No strength on record for this link yet. Open more detail to set one.
        </p>
      )}
      {word === 'saved' && (
        <p role="status" className={`${typography.panelMeta} text-text-light m-0 mt-1`} data-testid="link-quick-editor-saved">Saved</p>
      )}
      {copy && (
        <p role={copy.role} className={`${typography.panelMeta} text-text-body m-0 mt-1`} data-testid="link-quick-editor-settlement">
          {copy.message}
        </p>
      )}
      <button
        type="button"
        className={`${typography.panelMeta} text-info underline mt-2`}
        data-testid="link-quick-editor-more"
        onClick={() => { onMoreDetail(); onClose() }}
      >
        More detail
      </button>
    </div>
  )
}

/**
 * Which link's mini-editor is open, and where. A tiny store rather than state in `ReactFlowGraph`: that component
 * carries a rules-of-hooks exception for its existing hooks and must not gain one (`lint:hooks-ratchet`). Its click
 * handlers call `getState()`, which is not a hook.
 */
export const useLinkQuickEditStore = create<{
  open: { edgeId: string; x: number; y: number } | null
  show: (edgeId: string, x: number, y: number) => void
  close: () => void
}>((set) => ({
  open: null,
  show: (edgeId, x, y) => set({ open: { edgeId, x, y } }),
  close: () => set({ open: null }),
}))

/** Mounted once by the canvas; renders the open link's mini-editor, if any. */
export function LinkQuickEditorHost({ onMoreDetail }: { onMoreDetail: () => void }) {
  const open = useLinkQuickEditStore((s) => s.open)
  const close = useLinkQuickEditStore((s) => s.close)
  if (!open) return null
  return <LinkQuickEditor key={open.edgeId} edgeId={open.edgeId} x={open.x} y={open.y} onClose={close} onMoreDetail={onMoreDetail} />
}

/**
 * ⛔ THE MINI-EDITOR EDITS THE LINK THE PERSON POINTED AT (PR Review on #2322, 5897003679).
 *
 * `intendedId` is `retargetEdgeClick`'s RETURN — the line nearest the pointer — never "the first selected edge": with a
 * Meta/Control multi-selection, an earlier link stays selected, and reading the selection named and wrote THAT link.
 * A multi-selection click is a selection gesture (it may be a toggle-OFF), so it opens no editor and keeps its
 * existing meaning; only a plain click opens one. Returns whether it opened.
 */
export function openLinkQuickEditForClick(
  event: { clientX: number; clientY: number } | undefined,
  intendedId: string | null,
  multiSelectionActive: boolean,
): boolean {
  if (!event || !intendedId || multiSelectionActive) {
    useLinkQuickEditStore.getState().close()
    return false
  }
  useLinkQuickEditStore.getState().show(intendedId, event.clientX, event.clientY)
  return true
}
