/**
 * CalibrateDrillIn — inline numeric calibration for one estimate.
 *
 * Mirrors the canonical pre-analysis save paths exactly:
 * - Save value:    observedState { raw_value, value: raw/cap (when cap>0),
 *                  source: 'user_override' }  — the legacy inline-edit handler.
 * - Confirm as is: observedState { source: 'user_confirmed',
 *                  extractionType: 'explicit' } — the legacy confirm handler.
 *
 * Value-scale guard: rows with canEditValue=false render confirm-only (no
 * numeric input) because only a normalised model-scale value exists.
 */

import { memo, useState } from 'react'
import { Check } from 'lucide-react'
import Tooltip from '../../../../components/Tooltip'
import { typography, typo } from '../../../../styles/typography'
import { FIELD_FEEDBACK_COPY } from '../constants'
import { useCanvasStore } from '../../../store'
import { normaliseRawFactorValue, withObservedStateUpdate } from '../../../utils/observedStateHelpers'
import { PanelIconButton } from '../ui/PanelIconButton'
import { parseSuccessTarget } from '../hero/parseSuccessTarget'
import type { EstimateRowModel } from '../types'

interface CalibrateDrillInProps {
  row: EstimateRowModel
  onDone: () => void
}

function commitValue(nodeId: string, rawValue: number, cap: number | null): void {
  const { nodes, updateNode } = useCanvasStore.getState()
  const node = nodes.find(n => n.id === nodeId)
  if (!node) return
  const normalised = normaliseRawFactorValue(rawValue, cap)
  updateNode(nodeId, {
    data: withObservedStateUpdate(node.data, {
      raw_value: rawValue,
      value: normalised,
      source: 'user_override',
    }),
  })
}

function commitConfirm(nodeId: string): void {
  const { nodes, updateNode } = useCanvasStore.getState()
  const node = nodes.find(n => n.id === nodeId)
  if (!node) return
  updateNode(nodeId, {
    data: withObservedStateUpdate(node.data, {
      source: 'user_confirmed',
      extractionType: 'explicit',
    }),
  })
}

export const CalibrateDrillIn = memo(function CalibrateDrillIn({ row, onDone }: CalibrateDrillInProps) {
  const [draft, setDraft] = useState(row.rawPrefill != null ? String(row.rawPrefill) : '')
  const [hint, setHint] = useState<string | null>(null)

  const save = () => {
    // Shares the hero field's parser (#396). The digit-strip this replaced
    // (`replace(/[^0-9.,-]/g,'').replace(/,/g,'')`) was byte-identical to the
    // `parseDisplayNumber` deleted from HeroSection: it dropped magnitude
    // suffixes and FUSED unrelated numbers, so "£500k" committed 500 and
    // "£500k within 12 months" committed 50012. This field writes through
    // commitValue into node observedState, so those fabrications reached the
    // ANALYSIS, not just a label.
    //
    // parseSuccessTarget fails CLOSED on ambiguity (returns null), which is the
    // behaviour this call site wants: an unresolvable estimate must hint rather
    // than guess, exactly as the old unparseable branch did.
    //
    // `unit` is deliberately ignored — the drill-in's scale comes from
    // `row.cap` (see commitValue), so consuming the parser's unit here would
    // add a second, conflicting scale authority.
    const parsed = parseSuccessTarget(draft)
    if (parsed === null) {
      setHint(FIELD_FEEDBACK_COPY.numberHint)
      return
    }
    commitValue(row.nodeId, parsed.value, row.cap)
    onDone()
  }

  return (
    <div className="mb-2 ml-6 flex items-center gap-2" data-testid="pre-analysis-v3-drill">
      {row.canEditValue && (
        <>
          <input
            aria-label={`Your estimate for ${row.label}`}
            inputMode="decimal"
            className={`${typography.panelBody} h-7 w-28 rounded-lg border border-panel-border bg-panel px-2 text-text-header outline-none placeholder:text-text-light focus:border-info focus:ring-2 focus:ring-info/20`}
            placeholder="Set value"
            aria-invalid={hint ? true : undefined}
            value={draft}
            onChange={e => {
              setDraft(e.target.value)
              if (hint) setHint(null)
            }}
            onKeyDown={e => {
              if (e.key === 'Enter') save()
              if (e.key === 'Escape') onDone()
            }}
          />
          <Tooltip content="Save your estimate" delay={300}>
            <PanelIconButton variant="go" aria-label={`Save estimate for ${row.label}`} onClick={save}>
              <Check className="h-3.5 w-3.5" aria-hidden />
            </PanelIconButton>
          </Tooltip>
        </>
      )}
      {!row.needsValue && (
        <button
          type="button"
          onClick={() => {
            commitConfirm(row.nodeId)
            onDone()
          }}
          className={typo(
            'panelMeta',
            'rounded-full border border-panel-border bg-transparent px-2.5 py-1 text-text-body outline-none transition-colors hover:bg-panel-hover focus-visible:bg-panel-hover focus-visible:ring-2 focus-visible:ring-info/40',
          )}
          data-testid="pre-analysis-v3-confirm-as-is"
        >
          Confirm as is
        </button>
      )}
      {hint && (
        <span className={`${typography.panelMeta} text-warning`} role="status">
          {hint}
        </span>
      )}
    </div>
  )
})
