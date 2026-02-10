/**
 * Results Panel v7 — Storybook Stories (CSF3)
 *
 * Four scenarios mounting the full ResultsBody component tree:
 *   1. Normalised — 2 options, normalised scores, stability 0.75, 6 fragile edges
 *   2. CloseCall — 2 options, near-tie, stability 0.48, currency units
 *   3. Rich — 3 options, 5 factors, stability 0.82, denormalised currency
 *   4. Minimal — 2 options, no drivers/fragile edges, graceful degradation
 *
 * Canvas store is NOT required — ResultsBody accepts all data via props.
 */

import React from 'react'
import { ResultsBody } from './ResultsBody'
import { normalisedFixture, normalisedTornadoData } from '../../__fixtures__/resultsPanelV7.normalised.hook'
import { sensitiveFixture, sensitiveTornadoData } from '../../__fixtures__/resultsPanelV7.sensitive.hook'
import { richFixture, richTornadoData } from '../../__fixtures__/resultsPanelV7.rich.hook'
import { minimalFixture, minimalTornadoData } from '../../__fixtures__/resultsPanelV7.minimal.hook'

// ---------------------------------------------------------------------------
// Storybook Meta + Stories (CSF3)
// ---------------------------------------------------------------------------

export default {
  title: 'Results Panel v7',
  parameters: {
    layout: 'padded',
    backgrounds: { default: 'panel' },
  },
}

/** Wrapper that mimics the dock panel width and background */
function PanelWrapper({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        width: 380,
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

const noopFocus = (nodeId: string) => {
  console.log('[Storybook] onFocusNode:', nodeId)
}

// ── Story 1: Normalised ──────────────────────────────────────────────────

export const Normalised = () => (
  <PanelWrapper>
    <ResultsBody
      resultsSectionData={normalisedFixture}
      tornadoData={normalisedTornadoData}
      onFocusNode={noopFocus}
    />
  </PanelWrapper>
)

Normalised.storyName = 'Normalised (2 options, fair confidence)'

// ── Story 2: Close Call ──────────────────────────────────────────────────

export const CloseCall = () => (
  <PanelWrapper>
    <ResultsBody
      resultsSectionData={sensitiveFixture}
      tornadoData={sensitiveTornadoData}
      onFocusNode={noopFocus}
    />
  </PanelWrapper>
)

CloseCall.storyName = 'Close call (near-tie, needs work)'

// ── Story 3: Rich ────────────────────────────────────────────────────────

export const Rich = () => (
  <PanelWrapper>
    <ResultsBody
      resultsSectionData={richFixture}
      tornadoData={richTornadoData}
      onFocusNode={noopFocus}
    />
  </PanelWrapper>
)

Rich.storyName = 'Rich (3 options, 5 factors, strong)'

// ── Story 4: Minimal ─────────────────────────────────────────────────────

export const Minimal = () => (
  <PanelWrapper>
    <ResultsBody
      resultsSectionData={minimalFixture}
      tornadoData={minimalTornadoData}
      onFocusNode={noopFocus}
    />
  </PanelWrapper>
)

Minimal.storyName = 'Minimal (no drivers, graceful degradation)'
