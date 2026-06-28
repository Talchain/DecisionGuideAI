/**
 * Focus Now — Storybook stories (CSF3).
 *
 * Render-only surface, exercised with explicit props (no store). The a11y addon
 * runs against each story. Rows expand on click (one open at a time). The summary
 * stories carry SERVER prose (uncertified) only to exercise verbatim render +
 * tolerance — the live container gates real `coaching_summary` display off.
 */
import React from 'react'
import { FocusNowPanel } from './FocusNowPanel'
import { buildFocusRows } from './buildFocusRows'
import {
  serverRow,
  forbiddenSummary,
  longSummary,
} from './__fixtures__/focus.fixtures'
import type { FocusNowProps } from './focusTypes'

export default {
  title: 'Canvas/Focus Now',
  parameters: {
    layout: 'padded',
    backgrounds: { default: 'canvas' },
  },
}

/** Mimics the dock panel width + warm canvas behind the card. */
function PanelWrapper({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        width: 380,
        maxHeight: '90vh',
        overflow: 'auto',
        background: 'var(--bg-canvas, #F4F0EA)',
        padding: 16,
        fontFamily: 'Inter, system-ui, sans-serif',
      }}
    >
      {children}
    </div>
  )
}

const staticRows = buildFocusRows({}).rows
const noop = () => {}
const base: FocusNowProps = {
  summary: null,
  rows: staticRows,
  banner: { kind: 'none' },
  onPrefill: noop,
  onRerun: noop,
  rerunDisabled: false,
}

type Story = (() => React.ReactElement) & { storyName?: string }

const story =
  (overrides: Partial<FocusNowProps>): Story =>
  () => (
    <PanelWrapper>
      <FocusNowPanel {...base} {...overrides} />
    </PanelWrapper>
  )

export const StaticOnly = story({})
StaticOnly.storyName = 'Static hygiene rows'

export const StaticPlusSummary = story({ summary: 'Here is where things stand on this decision so far.' })
StaticPlusSummary.storyName = 'Static rows + summary line'

export const StaleBanner = story({ banner: { kind: 'stale', canRerun: true } })
StaleBanner.storyName = 'Stale banner (+ re-run)'

export const CannotConfirm = story({ banner: { kind: 'cannot_confirm' } })
CannotConfirm.storyName = 'Cannot-confirm banner (neutral)'

export const ServerRow = story({ rows: [serverRow, ...staticRows] })
ServerRow.storyName = 'Server row above static (expand it)'

export const ShowMore = story({ rows: [serverRow, ...staticRows] })
ShowMore.storyName = 'Show more / fewer (7 rows)'

export const Empty = story({ rows: [] })
Empty.storyName = 'Honest empty state'

export const LongStrings = story({ summary: longSummary, rows: [serverRow, ...staticRows] })
LongStrings.storyName = 'Long strings (clamp + wrap)'

export const ForbiddenTermData = story({ summary: forbiddenSummary })
ForbiddenTermData.storyName = 'Forbidden-term server prose (verbatim)'
