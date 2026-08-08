/**
 * CritiqueWarningStrip — compact honest-disclosure strip for WARNING-severity
 * engine critiques on the Analysis tab (Lane 3 Car 1 residual; ROADMAP 2.358
 * closure — the render hop #585's mapper leg stopped one short of).
 *
 * Contract:
 *   - Input is `confidence.humanisedCritiques` (useResultsSectionData:2936):
 *     already WARNING-filtered (the uncertainties filter at :2496 keys on
 *     severity 'WARNING' / semantic_severity 'WARNING'), already
 *     SENSITIVE_ASSUMPTION-excluded, and already routed through
 *     humaniseCritique's CEE-owned copy precedence — so for the 13 S/U-bucket
 *     codes the rendered text is CEE's `user_message` VERBATIM (S-bucket =
 *     the Paul-approved 2026-04-30 copy), never a UI paraphrase. This strip
 *     re-humanises nothing.
 *   - Renders ONLY entries with a non-null, non-empty `displayText` AND a
 *     non-empty `code`. `displayText: null` is humaniseCritique's explicit
 *     "exclude from banner" verdict (unmapped code with contaminated or
 *     absent copy) — honoured here, fail-closed. No fabricated copy from
 *     `code` alone.
 *   - The wire-carried remediation (`suggestion`, from the producer's own
 *     `suggestion` field via mapper `suggested_fix`) rides along when
 *     present; nothing is invented for rows without one.
 *   - Node binding is by IDENTITY and only where the payload provides one:
 *     `factorId` (resolved from `affected_node_ids[0]` upstream) stamps
 *     `data-critique-node-id`. The 2026-08-08 live corpus carries no
 *     affected_node_ids, so the attribute is absent there — an absent field
 *     renders nothing.
 *   - Display-only: never blocks analysis, never mutates state. BLOCKER-
 *     severity rows have their own live surface (ValidationPanel via
 *     OutputsDock:2435) and never reach this list.
 *
 * Visual idiom mirrors InferenceWarningStrip (the strip mounts directly
 * below it in ResultsBody's unconditional current-view group): bg-panel
 * card, border via opacity token, lucide icon, panelBody typography.
 */
import { AlertTriangle } from 'lucide-react'
import { typography } from '@/styles/typography'

export interface CritiqueWarningEntry {
  /** Producer critique code — the entry's identity anchor. */
  code?: string
  /** Humanised display copy; null = humaniseCritique's exclude-from-banner verdict. */
  displayText: string | null
  /** Wire-carried remediation (producer `suggestion`), when present. */
  suggestion?: string
  /** Resolved node identity (affected_node_ids[0]), when the payload provides one. */
  factorId?: string
}

export interface CritiqueWarningStripProps {
  /** `confidence.humanisedCritiques` — pre-filtered, pre-humanised. */
  critiques?: CritiqueWarningEntry[]
  className?: string
}

/** Entries the strip will show: identified by code AND carrying renderable copy. */
export function selectRenderableCritiqueEntries(
  critiques: CritiqueWarningEntry[] | undefined,
): Array<CritiqueWarningEntry & { code: string; displayText: string }> {
  return (critiques ?? []).filter(
    (c): c is CritiqueWarningEntry & { code: string; displayText: string } =>
      typeof c.code === 'string' &&
      c.code.length > 0 &&
      typeof c.displayText === 'string' &&
      c.displayText.trim().length > 0,
  )
}

export function CritiqueWarningStrip({ critiques, className = '' }: CritiqueWarningStripProps) {
  const visible = selectRenderableCritiqueEntries(critiques)
  if (visible.length === 0) return null

  return (
    <div
      data-testid="critique-warning-strip"
      className={`flex flex-col gap-1 ${className}`.trim()}
      aria-label="Model critiques"
    >
      {visible.map((c, i) => (
        <div
          key={`${c.code}-${i}`}
          data-testid="critique-warning-strip-entry"
          data-critique-code={c.code}
          {...(c.factorId ? { 'data-critique-node-id': c.factorId } : {})}
          className="flex items-start gap-2 rounded-md border px-3 py-2 bg-panel border-warning/30"
        >
          <AlertTriangle size={14} className="flex-none mt-0.5 text-warning" aria-hidden="true" />
          <div className="flex flex-col gap-0.5 min-w-0">
            {/* Humanised copy — CEE-owned user_message verbatim for S/U codes;
                never the producer's raw internal `message` (V14.3 guard runs
                upstream in useResultsSectionData/humaniseCritique). */}
            <span className={`${typography.panelBody} text-text-body`}>{c.displayText}</span>
            {c.suggestion && (
              <span className={`${typography.panelMeta} text-text-light`}>{c.suggestion}</span>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

export default CritiqueWarningStrip
