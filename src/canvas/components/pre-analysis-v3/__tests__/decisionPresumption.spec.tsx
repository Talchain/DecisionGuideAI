/**
 * THE PANEL MUST NOT ASSERT A DECISION THE MODEL DOES NOT CONTAIN.
 *
 * Two surfaces in this panel rendered decision-shaped chrome UNCONDITIONALLY,
 * neither of them reading whether a decision node exists:
 *   1. HeroSection — a decision hexagon (`NodeShapeIndicator nodeKind="decision"`)
 *      plus `HERO_COPY.decisionFallback` ("Your decision") as the h1 fallback.
 *   2. YourDecisionSection — `PANEL_COPY.yourDecisionTitle` ("Your decision")
 *      as its disclosure title.
 *
 * That was LATENT, not harmless: CEE hard-422s a graph with no decision, so no
 * decision-free model could reach the UI. Once that block is removed, a user who
 * explicitly asked to MAP A SITUATION rather than pick an answer is shown a
 * hexagon labelled "Your decision" pointing at nothing.
 *
 * WHY THIS BINDING IS THE DEPLOYED ONE (trap 3b — a test bound to a component
 * the deployed flags do not mount proves nothing). Derived at the DEPLOYED
 * BUNDLE, not from netlify.toml (trap 18), on 2026-08-28:
 *   - staging /version.json commit e825249658be805530aec635af6de1cae91a71b9
 *   - 81 chunks crawled from the entry asset, 0 fetch failures
 *   - `VITE_FEATURE_PRE_ANALYSIS_V3:"1"` baked in AppPoC-CjnIDNQ3.js
 *     (positive contrast in the SAME sweep: `VITE_FEATURE_GRAPH_BADGES:"true"`
 *     present; negative contrast: a fabricated key returns 0 files — so the
 *     probe both sees and discriminates)
 *   - BOTH defect strings shipped in ReactFlowGraph-D-mFcgqf.js:
 *     `decisionFallback:"Your decision"` and `yourDecisionTitle:"Your decision"`
 * The mount-path guard below re-derives the flag half from source so this
 * binding FAILS LOUD if a flag moves, rather than going quietly vacuous.
 *
 * Scope (trap 3): PRESENCE and TEXT in jsdom. Not layout, not visibility.
 */

import { describe, it, expect } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import fs from 'node:fs'
import path from 'node:path'
import { HeroSection, HERO_DECISION_SHAPE_TESTID } from '../hero/HeroSection'
import { YourDecisionSection } from '../model/YourDecisionSection'
import { HERO_COPY, PANEL_COPY } from '../constants'

const repoFile = (rel: string) =>
  fs.readFileSync(path.resolve(__dirname, '../../../../..', rel), 'utf8')

describe('MOUNT PATH — this spec is bound to the surface the deployed flags mount', () => {
  it('staging bakes VITE_FEATURE_PRE_ANALYSIS_V3="1" (the flag that mounts this panel)', () => {
    const toml = repoFile('netlify.toml')
    expect(toml).toMatch(/VITE_FEATURE_PRE_ANALYSIS_V3\s*=\s*"1"/)
  })

  it('OutputsDock gates the v3 panel on THAT flag — if this moves, re-derive the posture', () => {
    const dock = repoFile('src/canvas/components/OutputsDock.tsx')
    expect(dock).toContain('isPreAnalysisV3Enabled()')
    expect(dock).toContain('outputs-pre-run-v3')
    expect(dock).toContain("lazy(() => import('./pre-analysis-v3'))")
    const flags = repoFile('src/flags.ts')
    expect(flags).toMatch(/preAnalysisV3:\s*\{[^}]*VITE_FEATURE_PRE_ANALYSIS_V3/)
  })
})

// --- fixtures -------------------------------------------------------------
// `hasDecision` is the ONE fact both surfaces consume, so a fixture cannot make
// them disagree — which is the point of it existing.

const heroFixture = (hasDecision: boolean, decisionTitle: string | null = null) => ({
  decisionTitle,
  hasDecision,
  goal: null,
  success: { displayText: null, isSet: false, attribution: null },
  goalNodeId: null,
  coaching: null,
})

const renderHero = (hasDecision: boolean, decisionTitle: string | null = null) =>
  render(
    <HeroSection
      hero={heroFixture(hasDecision, decisionTitle) as never}
      ladder={'draft' as never}
      onSendPrompt={() => {}}
      onLadderAct={() => {}}
    />,
  )

const modelFixture = (hasDecision: boolean) => ({
  hero: heroFixture(hasDecision),
  options: [],
  risks: [],
  estimates: { rows: [], rankingSource: 'heuristic', checkedCount: 0, checkableCount: 0, needsValueCount: 0 },
})

const renderSection = (hasDecision: boolean) =>
  render(
    <YourDecisionSection
      model={modelFixture(hasDecision) as never}
      onSendPrompt={() => {}}
      estimateFocus={null}
    />,
  )

describe('HeroSection — the hexagon and the heading are claims, so they are conditional', () => {
  it('NO decision node: renders NO decision hexagon and never says "Your decision"', () => {
    renderHero(false)
    expect(screen.queryByTestId(HERO_DECISION_SHAPE_TESTID)).not.toBeInTheDocument()
    expect(screen.queryByText(HERO_COPY.decisionFallback)).not.toBeInTheDocument()
  })

  it('NO decision node: names the model honestly instead of leaving an empty slot', () => {
    renderHero(false)
    // The absence assertions above are vacuous without this — a hero that
    // rendered nothing at all would satisfy them.
    expect(screen.getByText(HERO_COPY.situationFallback)).toBeInTheDocument()
  })

  it("NO decision node: the user's OWN brief text still shows, unhexagoned", () => {
    // The brief text is the user's own words about their situation — honest with
    // or without a decision node. Only the FALLBACK named a thing that was not
    // there, so the fix must not have swallowed the real title.
    renderHero(false, 'Whether to expand into the Nordics')
    expect(screen.getByText('Whether to expand into the Nordics')).toBeInTheDocument()
    expect(screen.queryByTestId(HERO_DECISION_SHAPE_TESTID)).not.toBeInTheDocument()
  })

  it('DISCRIMINATING TWIN — a real decision node still gets the hexagon AND the heading', () => {
    // Without this, deleting the header outright would pass every test above.
    renderHero(true)
    expect(screen.getByTestId(HERO_DECISION_SHAPE_TESTID)).toBeInTheDocument()
    expect(screen.getByText(HERO_COPY.decisionFallback)).toBeInTheDocument()
    expect(screen.queryByText(HERO_COPY.situationFallback)).not.toBeInTheDocument()
  })
})

describe('YourDecisionSection — the same claim, one section down', () => {
  it('NO decision node: the section is titled for the model, not for a decision', () => {
    renderSection(false)
    const section = screen.getByTestId('pre-analysis-v3-your-decision')
    expect(section).toHaveTextContent(PANEL_COPY.yourModelTitle)
    expect(section).not.toHaveTextContent(PANEL_COPY.yourDecisionTitle)
  })

  it('DISCRIMINATING TWIN — a real decision node keeps the decision title', () => {
    renderSection(true)
    const section = screen.getByTestId('pre-analysis-v3-your-decision')
    expect(section).toHaveTextContent(PANEL_COPY.yourDecisionTitle)
  })

  it('the two surfaces read ONE fact, so they cannot contradict each other on screen', () => {
    // trap 21: two authorities answering near-identical questions under similar
    // names is how a fix in one place gets reopened by its neighbour.
    const hookSource = repoFile('src/canvas/components/pre-analysis-v3/hooks/usePreAnalysisModel.ts')
    expect(hookSource).toContain('hasDecision: facts.decisionNode != null')
    const hero = repoFile('src/canvas/components/pre-analysis-v3/hero/HeroSection.tsx')
    const section = repoFile('src/canvas/components/pre-analysis-v3/model/YourDecisionSection.tsx')
    expect(hero).toContain('hero.hasDecision')
    expect(section).toContain('model.hero.hasDecision')
    // Neither surface re-derives the fact from the graph behind the model's back.
    expect(hero).not.toContain('computeGraphFacts')
    expect(section).not.toContain('computeGraphFacts')
  })
})
