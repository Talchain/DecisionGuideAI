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
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { useCanvasStore } from '../store'
import { useEdgeMutations } from '../ui/inspector-v2/useInspectorMutations'
import { StrengthBandButtons } from '../ui/inspector-v2/shared/StrengthBandButtons'
import { resolveEdgeSignedStrengthDisplay } from '../domain/edgeValueProvenance'
import { resolveElementLabel } from '../domain/elementLabel'
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

  const onChange = useCallback((v: number) => {
    const mine = ++seq.current
    const before = storedSigned(edgeId)
    setLocal(v)
    setWord('saving')
    const outcome = mutations.setStrength(v, {
      preserveDirection: true,
      onSendSettled: (settlement) => {
        if (mine !== seq.current) return
        const w = valueCommitSettlementWord(settlement, before, v, () => storedSigned(edgeId))
        if (w === 'not_applied' || w === 'unconfirmed') setLocal(storedSigned(edgeId) ?? v)
        setWord(w ?? 'saved')
      },
    })
    if (outcome !== 'dispatched') setWord('local_only')
  }, [edgeId, mutations])

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
      {display.show ? (
        <StrengthBandButtons value={local} onChange={onChange} />
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
