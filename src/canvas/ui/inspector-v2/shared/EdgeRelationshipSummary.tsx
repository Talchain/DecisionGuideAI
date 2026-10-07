/**
 * EdgeRelationshipSummary — the edge inspector's opening section and its three
 * detail rows (canvas visual contract v3.1, DESIGN-GAP-v31 row 12).
 *
 * v3.1: "Edge tooltip is one line; the edge inspector has Direction / Stroke
 * width / Existence rows. No percentages." The hover lost its popover (the
 * strength, the confidence percentage, the bold direction row), so the
 * inspector — one click away — is where a person reads what the LINE they
 * hovered is saying. The prototype's `edgeInspector()` opens with this section
 * and keeps "the existing relationship inspector" below it; so does this.
 *
 * ⛔ EVERY VALUE IS THE STROKE'S OWN RESOLVER, CALLED, NEVER RESTATED
 * (CLAUDE.md trap 12). A row that derived "Positive" from a raw `direction`
 * field would say "Positive" beside a grey, glyph-less line whose direction
 * nobody stated — the exact two-verdicts-one-edge defect the canvas already
 * paid for:
 *   · Direction   — `readContestedState` (the amber sign dispute) first, then
 *                   `resolveEdgeDirectionDisplay` (the glyph and polarity hue);
 *   · Stroke width — `resolveEdgeSignedStrengthDisplay` (what the width
 *                   encodes; an unset strength draws the fixed unset width);
 *   · Existence   — `resolveExistenceDash` over `resolveEdgeValueDisplay(…,
 *                   'beliefExists')` (the dash). ⭐ ONLY WHEN A DOUBT IS STATED
 *                   (gate 5 item 3b, DL 0df0e1, 5 Oct 2026): the row used to say
 *                   "No dashed exception shown" on every link, a legend line
 *                   about something not drawn. With no stated doubt there is no
 *                   dash to explain, so there is no row.
 * No row states a figure: the figures, their provenance and their controls are
 * the panel's own sections below.
 */
import { useRouteOnceHeld } from '../../../hooks/useRouteOnceHeld'
import { useMemo } from 'react'
import { readContestedState } from '../../../edges/edgePresentation'
import {
  resolveEdgeDirectionDisplay,
  resolveEdgeSignedStrengthDisplay,
  resolveEdgeValueDisplay,
} from '../../../domain/edgeValueProvenance'
import { resolveExistenceDash } from '../../../utils/graphDisplayCalculations'
import { METRIC_UNSET } from '../../../nodes/shared/metricVocabulary'
import { typography } from '../../../../styles/typography'
import { inspectorDetailRow, inspectorSectionHighlight } from '../inspectorStyle'

/** The contract's words (prototype `edgeInspector()`), one home. */
export const EDGE_RELATIONSHIP_COPY = {
  heading: 'Modelled relationship',
  body: 'The direction and magnitude describe a causal belief recorded in this model, not established real-world causality.',
  directionLabel: 'Direction',
  strokeWidthLabel: 'Stroke width',
  existenceLabel: 'Existence',
  positive: 'Positive (+)',
  negative: 'Negative (−)',
  disputed: 'AI review disagrees',
  directionUnset: METRIC_UNSET.standalone,
  strokeWidthMeaning: 'Modelled strength magnitude',
  strokeWidthUnset: `Strength ${METRIC_UNSET.standalone.toLowerCase()}`,
  existenceDoubt: 'A stated doubt',
} as const

export function EdgeRelationshipSummary({ data, edgeId = '' }: { data: Record<string, unknown> | undefined; edgeId?: string }) {
  const routeOnceHeld = useRouteOnceHeld(edgeId)
  const values = useMemo(() => {
    const disputed = readContestedState(data?.validation).directionDisputed
    const direction = resolveEdgeDirectionDisplay(data)
    const strength = resolveEdgeSignedStrengthDisplay(data)
    const dash = resolveExistenceDash(resolveEdgeValueDisplay(data, 'beliefExists', { routeOnceHeld }))
    return {
      direction: disputed
        ? EDGE_RELATIONSHIP_COPY.disputed
        : direction.show
          ? direction.direction === 'positive' ? EDGE_RELATIONSHIP_COPY.positive : EDGE_RELATIONSHIP_COPY.negative
          : EDGE_RELATIONSHIP_COPY.directionUnset,
      strokeWidth: strength.show
        ? EDGE_RELATIONSHIP_COPY.strokeWidthMeaning
        : EDGE_RELATIONSHIP_COPY.strokeWidthUnset,
      existence: dash.kind === 'stated' && dash.dash !== undefined ? EDGE_RELATIONSHIP_COPY.existenceDoubt : null,
    }
  }, [data, routeOnceHeld])

  const rows: Array<[string, string, string]> = [
    ['direction', EDGE_RELATIONSHIP_COPY.directionLabel, values.direction],
    ['stroke-width', EDGE_RELATIONSHIP_COPY.strokeWidthLabel, values.strokeWidth],
    ...(values.existence !== null ? [['existence', EDGE_RELATIONSHIP_COPY.existenceLabel, values.existence] as [string, string, string]] : []),
  ]

  return (
    <>
      <section data-testid="edge-relationship-summary" className={inspectorSectionHighlight}>
        <h4 className={`${typography.buttonSmall} !leading-4 text-text-header mb-1`}>{EDGE_RELATIONSHIP_COPY.heading}</h4>
        <p className={`${typography.panelBody} !leading-[1.45] text-text-body m-0`}>{EDGE_RELATIONSHIP_COPY.body}</p>
      </section>
      <div data-testid="edge-detail-rows">
        {rows.map(([id, label, value]) => (
          <div key={id} data-testid={`edge-detail-${id}`} className={inspectorDetailRow}>
            <span className="text-text-light">{label}</span>
            <span className="text-text-body text-right">{value}</span>
          </div>
        ))}
      </div>
    </>
  )
}
