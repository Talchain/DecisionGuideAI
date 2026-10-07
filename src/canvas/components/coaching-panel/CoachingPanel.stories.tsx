/**
 * Coaching panel — Storybook stories (CSF3).
 *
 * Render-only Phase 0 surface, exercised against local fixtures. The a11y addon
 * runs automatically against each story. Rows expand on click (one open at a
 * time); use "Show all" to reveal beyond the default set.
 */
import React from 'react'
import { CoachingPanel } from './CoachingPanel'
import {
  typicalPanel,
  emptySignals,
  noSummary,
  minimalSignal,
  withAllFuture,
  veryLongStrings,
  bySource,
  byMove,
  unknownTargetKind,
  forbiddenTermInLabel,
} from './__fixtures__/coaching.fixtures'
import type { Coaching } from './types'

export default {
  title: 'Canvas/Coaching Panel',
  parameters: {
    layout: 'padded',
    backgrounds: { default: 'panel' },
  },
}

/** Mimics the dock panel width and background. */
function PanelWrapper({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        width: 380,
        maxHeight: '90vh',
        overflow: 'auto',
        background: 'var(--bg-panel, #FEFEFE)',
        borderRadius: 16,
        padding: 16,
        fontFamily: 'Inter, system-ui, sans-serif',
      }}
    >
      {children}
    </div>
  )
}

/** CSF story function with an optional display name (this repo's story style). */
type Story = (() => React.ReactElement) & { storyName?: string }

const story =
  (coaching: Coaching | null, showStaleBanner = false): Story =>
  () => (
    <PanelWrapper>
      <CoachingPanel coaching={coaching} showStaleBanner={showStaleBanner} />
    </PanelWrapper>
  )

export const Default = story(typicalPanel)
Default.storyName = 'Default (summary + reveal)'

export const Empty = story(emptySignals)

export const NoSummary = story(noSummary)
NoSummary.storyName = 'No summary line'

export const SingleSignal = story(minimalSignal)
SingleSignal.storyName = 'Single minimal signal'

export const AllFutureFields = story(withAllFuture)
AllFutureFields.storyName = 'All future fields (expand the row)'

export const StaleBanner = story(typicalPanel, true)
StaleBanner.storyName = 'Stale banner (fixture-only)'

export const LongStrings = story(veryLongStrings)
LongStrings.storyName = 'Long strings (clamp + wrap)'

export const Sources = story(bySource)
Sources.storyName = 'One per source (+ unknown)'

export const Moves = story(byMove)
Moves.storyName = 'One per move (+ unknown)'

export const UnknownEntity = story(unknownTargetKind)
UnknownEntity.storyName = 'Unknown target kind (neutral marker)'

export const ForbiddenTermData = story(forbiddenTermInLabel)
ForbiddenTermData.storyName = 'Forbidden-term model data (verbatim)'
