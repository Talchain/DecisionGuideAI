/**
 * ⭐ WHAT THE MODEL IMPLIES WHEN THE AIM HAS NO TARGET (CEE #3660; DL 22 Oct: "make the new result visible"). Beside CEE's
 * invitation to give the goal a target (`GoalChanceInvite`): for the sized quantity nearest the aim, each option's range
 * from the same Run, in CEE's words and unit, labelled "as the model stands". Model-relative, never a chance, a target or a
 * ranking: the options keep the Run's own order. Withheld, or a Run that is no longer current, shows nothing.
 */
import { useCanvasStore } from '../../../canvas/store'
import {
  IMPLIED_QUANTITY_COPY as COPY,
  impliedFigure,
  impliedQuantityHeading,
  useImpliedQuantity,
} from '../../../canvas/state/storedImpliedQuantity'
import { typography } from '@/styles/typography'

export const IMPLIED_QUANTITY_TEST_ID = 'implied-quantity'

export function ImpliedQuantity() {
  const implied = useImpliedQuantity()
  const nodes = useCanvasStore((s) => s.nodes)
  if (implied === null || implied.status !== 'computed') return null
  const labelOf = (id: string): string | null => {
    const label = (nodes.find((n) => n.id === id)?.data as { label?: unknown } | undefined)?.label
    return typeof label === 'string' && label.trim() !== '' ? label.trim() : null
  }
  const rows = implied.byOption.map(([id, r]) => ({ id, label: labelOf(id), r }))
  // Every option is named, or nothing is said: a row the reader cannot place would misstate the comparison.
  if (rows.some((row) => row.label === null)) return null
  return (
    <div data-testid={IMPLIED_QUANTITY_TEST_ID} className={`flex flex-col gap-1 py-2 ${typography.panelBody}`}>
      <p data-testid="implied-quantity-heading">{impliedQuantityHeading(implied)}</p>
      <ul className="flex flex-col gap-0.5">
        {rows.map(({ id, label, r }) => (
          <li key={id} data-testid={`implied-quantity-option-${id}`}>
            {label}: {COPY.range(impliedFigure(r.p10), impliedFigure(r.p90), impliedFigure(r.p50), implied.unit)}
          </li>
        ))}
      </ul>
      {implied.restsOnOlumiEstimates && (
        <p data-testid="implied-quantity-olumi" className="text-text-light">{COPY.restsOnOlumi}</p>
      )}
    </div>
  )
}
