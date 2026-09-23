/**
 * ⭐ THE FACTOR'S TINY RELATIVE DRIVER VISUAL (locked spec §3 "Tiny driver visual
 * — restore"; ED 02:31Z D1a; ED 11:52Z point 3).
 *
 *   `Driver 1 of 4 in this model  ▬▬▬▬`         a determined rank (1..3)
 *   `Structural influence          ▬▬`           unranked — the quantity's own noun
 *
 * ── WHAT IT REFUSES ─────────────────────────────────────────────────────────
 *
 *   · No `% influence` on the face (ED 11:52Z). The percentage moves into the
 *     tooltip and the accessible name, beside the words that say what it is
 *     relative to — moved, not deleted.
 *   · No `#` (ED 02:31Z: "`Driver N of M`, not `Driver #N of M`").
 *   · No second vocabulary for the rank: the reduced line and the "Worth
 *     reviewing" reason read the same `DRIVER_LINE_COPY.rank`, and the corner
 *     "Key driver" badge is retired (ED 02:31Z).
 *   · No bar without a noun — an unranked bar carries its quantity's own noun
 *     (`influenceQuantity`), never a bare fill (purpose audit, #1899 finding 3).
 *
 * ── WHEN IT SHOWS ───────────────────────────────────────────────────────────
 *
 * The CALLER decides. Design integration (23 Sep 2026) applies #1891's rule
 * (Paul's Ruling 3, ROADMAP 2.651: "labelled, not withheld"; ED 02:31Z Q2;
 * visual contract v3 "Last run · Driver N of M"):
 *   · current run → the line, unlabelled;
 *   · model KNOWN to have changed since the run (`useModelChangedSinceRun`) →
 *     the line, with `fromLastRun` set: caption AND accessible name open with
 *     `LAST_RUN_PREFIX`, so the visible string stays a prefix of the name;
 *   · never-run / cannot-confirm → no line (no past analysis is invented).
 *
 * ── WHAT THE TOOLTIP SAYS ───────────────────────────────────────────────────
 *
 * Basis-aware: the rank is ordered by how strongly the comparison RESPONDS to
 * each factor; the bar shows the displayed quantity — structural influence or
 * outcome sensitivity — and on the structural basis `influenceScaleCopy`
 * (#1221) forbids attributing it to "this analysis", so the spec's
 * "in this analysis" becomes "in this model". The spec's "not an absolute causal
 * percentage" is kept word for word.
 */
import Tooltip from '../../../components/Tooltip'
import { typography } from '../../../styles/typography'
import {
  influenceBasisNoun,
  influenceQuantity,
  influenceStructuralBasisNote,
} from '../../../components/results/influenceScaleCopy'
import type { DriverDisplayProvenance } from '../../../components/results/driverDisplayModel'
import { DRIVER_LINE_COPY, LAST_RUN_PREFIX } from './metricVocabulary'
import { NODE_TOOLTIP_DELAY_MS } from './nodeTooltip'
import { openNodeInspector } from './openNodeInspector'

export interface FactorDriverLineProps {
  nodeId: string
  /** A determined rank and its set size, or null for an unranked factor. */
  rank: { rank: number; setSize: number } | null
  /** The displayed relative quantity, 0..1 (1 = the strongest factor). */
  value: number
  provenance: DriverDisplayProvenance
  importanceBasis: string | null
  /**
   * The model is KNOWN to have changed since the run this line reads (the
   * card's `useModelChangedSinceRun()`). Labels the caption and the accessible
   * name `Last run · `; it never decides whether the line shows.
   */
  fromLastRun?: boolean
  testId?: string
}

export function driverLineCaption(
  rank: FactorDriverLineProps['rank'],
  provenance: DriverDisplayProvenance,
): string {
  if (rank) return DRIVER_LINE_COPY.rank(rank.rank, rank.setSize)
  return influenceQuantity(provenance)?.noun ?? influenceBasisNoun(provenance)
}

export function driverLineExplanation({
  rank,
  value,
  provenance,
  importanceBasis,
}: Pick<FactorDriverLineProps, 'rank' | 'value' | 'provenance' | 'importanceBasis'>): string {
  const pct = Math.max(0, Math.min(100, Math.round(value * 100)))
  const quantity = influenceQuantity(provenance)
  const noun = quantity?.noun ?? influenceBasisNoun(provenance)
  const parts: string[] = []
  if (rank) parts.push(`${DRIVER_LINE_COPY.rank(rank.rank, rank.setSize)}. ${DRIVER_LINE_COPY.rankBasis}`)
  parts.push(`Bar: ${noun.toLowerCase()}, ${pct}% of the strongest factor. ${DRIVER_LINE_COPY.relativeDisclosure}`)
  if (quantity) parts.push(quantity.gloss)
  const note = influenceStructuralBasisNote(provenance, importanceBasis)
  if (note) parts.push(note)
  parts.push(DRIVER_LINE_COPY.question)
  return parts.join(' ')
}

export function FactorDriverLine({
  nodeId,
  rank,
  value,
  provenance,
  importanceBasis,
  fromLastRun = false,
  testId = 'factor-driver-line',
}: FactorDriverLineProps) {
  const pct = Math.max(0, Math.min(100, Math.round(value * 100)))
  const lastRun = fromLastRun ? LAST_RUN_PREFIX : ''
  const caption = `${lastRun}${driverLineCaption(rank, provenance)}`
  const explanation = `${lastRun}${driverLineExplanation({ rank, value, provenance, importanceBasis })}`
  return (
    <Tooltip asChild delay={NODE_TOOLTIP_DELAY_MS} content={explanation}>
      <button
        type="button"
        data-testid={testId}
        data-node-tooltip="true"
        aria-label={explanation}
        className="nodrag nopan mt-1 flex w-full items-center justify-between gap-2 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-info rounded"
        onClick={(e) => {
          e.stopPropagation()
          openNodeInspector(nodeId)
        }}
        onPointerDown={(e) => e.stopPropagation()}
        onDoubleClick={(e) => e.stopPropagation()}
      >
        <span
          data-testid={`${testId}-caption`}
          className={`${typography.edgeLabel} min-w-0 ${rank ? 'font-medium text-text-body' : 'text-text-light'}`}
        >
          {caption}
        </span>
        <span
          aria-hidden="true"
          data-testid={`${testId}-bar`}
          className="h-1 w-[54px] shrink-0 overflow-hidden rounded-full bg-panel-border"
        >
          <span
            className="block h-full rounded-full bg-info"
            style={{ width: pct > 0 ? `max(4px, ${pct}%)` : '0%' }}
          />
        </span>
      </button>
    </Tooltip>
  )
}
