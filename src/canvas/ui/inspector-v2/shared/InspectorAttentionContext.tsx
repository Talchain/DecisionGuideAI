/**
 * InspectorAttentionContext — why this element is "Worth reviewing", said at
 * the TOP of its inspector, directly above "Ask Olumi".
 *
 * Paul 23 Sep contract feedback point 11: "Attention → inspector/AI should have
 * an obvious route back to the conversation/context."
 *
 * The canvas "Worth reviewing" marker opens this inspector
 * (`NodeAttentionMarker` → `openNodeInspector`), and its sentence already tells
 * the reader that elements without a marker keep their reasons "in each
 * element's details". Until now the inspector showed none of them, so a reader
 * who followed the marker arrived with the reason gone. This block restores it
 * and sits on top of the quick-action row, so the route from the reason to the
 * conversation is one click.
 *
 * ⚠ IT INVENTS NOTHING. The reasons are the SAME objects the card's marker
 * reads — `useNodeAttention` → `deriveAttentionPlan` — rendered verbatim. No
 * count, no rank, no reason the plan did not already hold, and nothing at all
 * when the plan holds none (the ordinary case).
 *
 * Styling follows Paul point 9: attention = Info, never warning or danger. The
 * ring glyph is the canvas marker's own shape, and the visible heading carries
 * the meaning, so it is never colour alone (point 12).
 */
import type { AttentionReason } from '../../../nodes/shared/nodeAttention'
import { typography } from '../../../../styles/typography'
import { inspectorSectionHighlight } from '../inspectorStyle'

export const INSPECTOR_ATTENTION_HEADING = 'Worth reviewing'

/** The context line an ask from this inspector carries, or '' when there is none. */
export function attentionAskContext(reasons: readonly AttentionReason[]): string {
  if (reasons.length === 0) return ''
  return `${INSPECTOR_ATTENTION_HEADING}: ${reasons.map((r) => r.label).join(' ')}`
}

export function InspectorAttentionContext({ reasons }: { reasons: readonly AttentionReason[] }) {
  if (reasons.length === 0) return null
  return (
    <section
      data-testid="inspector-attention-context"
      aria-label={INSPECTOR_ATTENTION_HEADING}
      /* v3.1: the contract's `.section-highlight` ("Why look here?"), not a
         bordered box — one flat vocabulary across the inspector. */
      className={`${inspectorSectionHighlight} !mt-3 !mb-0`}
    >
      <div className={`flex items-center gap-1.5 ${typography.panelMeta} text-text-body`}>
        <span
          aria-hidden="true"
          className="inline-block h-2.5 w-2.5 shrink-0 rounded-full border-2 border-info"
        />
        <span>{INSPECTOR_ATTENTION_HEADING}</span>
      </div>
      <ul className={`mt-1 space-y-1 ${typography.panelBody} text-text-body`}>
        {reasons.map((r) => (
          <li key={r.kind}>{r.label}</li>
        ))}
      </ul>
    </section>
  )
}
