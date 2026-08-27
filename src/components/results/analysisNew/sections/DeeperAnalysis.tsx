/**
 * Analysis (New) — "Deeper analysis and evidence" (level 3).
 *
 * ONE collapsed region, never a fifth top-level IA section (§18). Everything
 * technical lands here: run identity, what the run covered, provenance, and the
 * grounded decision-quality prompts.
 *
 * ⚠ THE COVERAGE GROUP IS THE ONE MOST LIKELY TO BE MISREAD, AND THE ADAPTER
 * ALREADY GUARDS IT: those rows describe what this run did and did not cover.
 * They are NOT a readiness verdict. `RunAdmission` remains the sole authority
 * on whether analysis may run, and nothing on this surface reads it or speaks
 * for it. Uneven coverage is provenance; it does not make a result invalid, and
 * it is never offered as the cause of an ordering.
 */

import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { typography } from '../../../../styles/typography'
import { ANALYSIS_NEW_COPY as COPY } from '../analysisNewCopy'
import type { DeeperAnalysisSection } from '../analysisNewTypes'

export interface DeeperAnalysisProps {
  deeper: DeeperAnalysisSection
  testId?: string
}

export function DeeperAnalysis({ deeper, testId = 'analysis-new-deeper' }: DeeperAnalysisProps) {
  const [open, setOpen] = useState(false)

  // Nothing to inspect renders nothing at all — an empty expander is an
  // affordance that lies about having content behind it.
  if (deeper.groups.length === 0) return null

  return (
    <section data-testid={testId}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={open ? `${testId}-region` : undefined}
        className={`${typography.panelBody} text-text-light flex items-center gap-1.5 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-info`}
        data-testid={`${testId}-toggle`}
      >
        {open ? (
          <ChevronDown className="w-3.5 h-3.5" aria-hidden="true" />
        ) : (
          <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
        )}
        {COPY.sections.deeper}
      </button>

      {open ? (
        <div id={`${testId}-region`} className="mt-2 space-y-3 pl-5">
          {deeper.groups.map((group) => (
            <div key={group.title} data-testid={`${testId}-group`}>
              <h4 className={`${typography.panelMeta} text-text-header`}>{group.title}</h4>
              <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
                {group.rows.map((r) => (
                  <div key={r.label} className="contents">
                    <dt className={`${typography.panelMeta} text-text-light`}>{r.label}</dt>
                    <dd className={`${typography.panelMeta} text-text-body break-words`}>{r.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  )
}
