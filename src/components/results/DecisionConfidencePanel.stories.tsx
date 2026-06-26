/**
 * DecisionConfidencePanel — Storybook stories (the LIVE legacy Analysis hero).
 *
 * Default flags render this panel (aiPanelV2 ON, analysisHeroV17 OFF). Until now
 * it had zero stories; this file covers the visible hero states for demo / manual
 * golden-journey QA:
 *   - freshness: fresh · changed/stale · cannot-confirm (via the CEE slice + the
 *     AnalysisFreshnessNotice that sits above the hero in ResultsBody)
 *   - robustness unknown (the certified default: no display-safe verdict → neutral
 *     "Robustness unknown" glyph in the checks footer)
 *   - data variants: close-call · rich · minimal-degraded
 *   - a narrow panel, to show the checks-footer counter no longer orphans
 *
 * Freshness is driven by the real canvas store (the hero's HeroQualifier reads it);
 * AnalysisFreshnessNotice is given the same verdict via its prop override so the
 * notice + hero stay in sync. NO trust logic is touched — these are display props.
 */

import React, { useLayoutEffect } from 'react'
import { DecisionConfidencePanel } from './DecisionConfidencePanel'
import { AnalysisFreshnessNotice } from './AnalysisFreshnessNotice'
import { useCanvasStore } from '@/canvas/store'
import type { AnalysisFreshnessState } from '@/canvas/store/analysisFreshness'
import { normalisedFixture } from '../../__fixtures__/resultsPanelV7.normalised.hook'
import { sensitiveFixture } from '../../__fixtures__/resultsPanelV7.sensitive.hook'
import { richFixture } from '../../__fixtures__/resultsPanelV7.rich.hook'
import { minimalFixture } from '../../__fixtures__/resultsPanelV7.minimal.hook'
import type { ResultsSectionDataReturn } from './useResultsSectionData'

export default {
  title: 'Results Panel v7/Decision Confidence (live hero)',
  parameters: {
    layout: 'padded',
    backgrounds: { default: 'panel' },
  },
}

const noopFocus = (_nodeId: string) => {}

// Stable per-state verdicts (stable refs keep the store-effect deps clean).
const FRESH: AnalysisFreshnessState = { freshness: 'fresh', freshnessReason: 'graph_hash_match' }
const STALE: AnalysisFreshnessState = { freshness: 'stale', freshnessReason: 'graph_changed' }

/** Sets the CEE freshness slice the hero reads, and resets it on unmount. */
function FreshnessSetter({
  state,
  dirty = false,
  children,
}: {
  state: AnalysisFreshnessState | null
  dirty?: boolean
  children: React.ReactNode
}) {
  useLayoutEffect(() => {
    useCanvasStore.setState({ analysisFreshness: state, analysisFreshnessDirty: dirty })
    return () => useCanvasStore.setState({ analysisFreshness: null, analysisFreshnessDirty: false })
  }, [state, dirty])
  return <>{children}</>
}

function PanelWrapper({ width = 380, children }: { width?: number; children: React.ReactNode }) {
  return (
    <div
      style={{
        width,
        maxHeight: '90vh',
        overflow: 'auto',
        background: 'var(--bg-panel, #FFFDF7)',
        borderRadius: 16,
        padding: 16,
        fontFamily: 'Inter, system-ui, sans-serif',
      }}
    >
      {children}
    </div>
  )
}

/** Mirrors the live ResultsBody slice: freshness notice above the hero. */
function HeroStory({
  data,
  freshness = null,
  dirty = false,
  width = 380,
}: {
  data: ResultsSectionDataReturn
  freshness?: AnalysisFreshnessState | null
  dirty?: boolean
  width?: number
}) {
  return (
    <FreshnessSetter state={freshness} dirty={dirty}>
      <PanelWrapper width={width}>
        <div className="space-y-3">
          <AnalysisFreshnessNotice state={freshness} dirty={dirty} />
          <DecisionConfidencePanel data={data} onFocusNode={noopFocus} />
        </div>
      </PanelWrapper>
    </FreshnessSetter>
  )
}

// ── Freshness states ──────────────────────────────────────────────────────

export const Fresh = () => <HeroStory data={normalisedFixture} freshness={FRESH} />
Fresh.storyName = 'Fresh (analysis reflects current model)'

export const ChangedStale = () => <HeroStory data={normalisedFixture} freshness={STALE} />
ChangedStale.storyName = 'Changed / stale (re-run to update)'

export const CannotConfirm = () => <HeroStory data={normalisedFixture} freshness={FRESH} dirty />
CannotConfirm.storyName = 'Cannot-confirm (fresh verdict, edited since)'

// ── Robustness unknown (certified default) ────────────────────────────────

export const RobustnessUnknown = () => <HeroStory data={normalisedFixture} freshness={FRESH} />
RobustnessUnknown.storyName = 'Robustness unknown (neutral checks glyph)'

// ── Data variants ─────────────────────────────────────────────────────────

export const CloseCall = () => <HeroStory data={sensitiveFixture} freshness={FRESH} />
CloseCall.storyName = 'Close call (near-tie)'

export const Rich = () => <HeroStory data={richFixture} freshness={FRESH} />
Rich.storyName = 'Rich (3 options, 5 factors)'

export const MinimalDegraded = () => <HeroStory data={minimalFixture} freshness={FRESH} />
MinimalDegraded.storyName = 'Minimal / degraded (no drivers)'

// ── Narrow panel (checks-footer counter no longer orphans) ────────────────

export const NarrowPanel = () => <HeroStory data={normalisedFixture} freshness={STALE} width={300} />
NarrowPanel.storyName = 'Narrow panel (300px — checks footer wraps cleanly)'
