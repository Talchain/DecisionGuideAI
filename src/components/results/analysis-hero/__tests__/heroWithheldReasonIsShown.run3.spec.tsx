/**
 * ⭐ Run-3 judge C5 (live/runs/2026-10-12T153555Z; UI a9a5c26f, CEE 3fdf0f38): when CEE serves a specific reason an
 * option's chance is withheld, the Results hero says it, verbatim, where the chance would be — never only "Chance not
 * shown yet" with the reason folded under "Why?", and never the UI's own "Not shown. Olumi can't give each option's
 * figures…" or "Set a success target to unlock Goal fit." in its place. Label, don't hide.
 *   - capacity step 3: each option's withheld cell carries its own why (the baseline no longer matches today's level;
 *     the unsized links); the hero rows showed "Chance not shown yet / Why?".
 *   - marketing step 7: both options share one why (two unsized links, and today's level is needed first, "What is
 *     it, in %?"); CEE's warning words lack the "Not shown." prefix, so the reader fell back to its own sentence.
 * The fixtures are the served read bodies the journey took after those Runs (conversation turns dropped).
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react'
import capacity from './fixtures/run3-capacity-step3-served-read.json'
import marketing from './fixtures/run3-marketing-step7-served-read.json'
import { applyRealRead } from './helpers/realScenarioRead'
import { useResultsSectionData } from '../../useResultsSectionData'
import { buildHeroModel } from '../buildHeroModel'
import { AnalysisHeroPanel } from '../AnalysisHeroPanel'
import { useCanonicalAnalysisViewStore } from '../../../../canvas/stores/canonicalAnalysisViewStore'
import { GOAL_IDENTITY_WITHHELD_FALLBACK } from '../../utils/goalIdentityWithheld'
import { HERO_COPY } from '../heroCopy'

afterEach(() => { cleanup(); vi.unstubAllGlobals(); useCanonicalAnalysisViewStore.setState({ scenarioId: null, view: null }) })

type Cell = { option_id: string; cell: { kind: string; face?: string; why?: string } }
const servedWhys = (read: { canonical_analysis_view: { options: Cell[] } }) =>
  read.canonical_analysis_view.options.filter(o => o.cell.kind === 'withheld' && o.cell.why).map(o => ({ id: o.option_id, why: o.cell.why! }))

async function mountHero(read: unknown) {
  await applyRealRead({ j: read })
  const data = renderHook(() => useResultsSectionData()).result.current
  const model = buildHeroModel(data)
  if (model.kind !== 'chart') throw new Error(`Expected the chart hero, got ${model.kind}`)
  return { model, view: render(<AnalysisHeroPanel model={model} rerunDisabled={false} />) }
}

describe('C5: the hero says CEE\'s specific withheld reason, verbatim, and folds nothing', () => {
  it('capacity step 3: each withheld option\'s own why is on the screen without opening anything', async () => {
    const whys = servedWhys(capacity as never)
    // CONTROL: the served read holds two different specific reasons.
    expect(whys).toHaveLength(2)
    expect(new Set(whys.map(w => w.why)).size).toBe(2)
    const { model, view } = await mountHero(capacity)
    for (const { id, why } of whys) {
      const row = model.rows.find(r => r.id === id)!
      const rowEl = screen.getByTestId(`hero-option-row-${row.index}`)
      expect(rowEl.textContent, `${id}'s reason is said in its row`).toContain(why)
    }
    expect(screen.queryByRole('button', { name: 'Why?' })).toBeNull()
    expect(view.container.textContent).not.toContain(GOAL_IDENTITY_WITHHELD_FALLBACK)
  })

  it('marketing step 7: the one shared why replaces the UI\'s fallback on both lenses, said once', async () => {
    const whys = servedWhys(marketing as never)
    // CONTROL: both options carry the same served why.
    expect(whys).toHaveLength(2)
    const why = whys[0].why
    expect(whys.every(w => w.why === why)).toBe(true)
    const { view } = await mountHero(marketing)
    const said = () => view.container.textContent ?? ''
    expect(said()).toContain(why)
    expect(said()).not.toContain(GOAL_IDENTITY_WITHHELD_FALLBACK)
    // The goal lens too: CEE's prerequisite, not the UI's "Set a success target".
    const goalTab = screen.queryByTestId('hero-lens-tab-goal')
    if (goalTab) {
      act(() => { fireEvent.click(goalTab) })
      expect(said()).toContain(why)
      expect(said()).not.toContain(HERO_COPY.lensUnavailable.goalNoTarget)
    }
    // Said once on the screen, not once per option.
    expect(said().split(why).length - 1).toBe(1)
  })

  it('rows that share one served reason say it once beneath them, not once per row', async () => {
    const { model } = await mountHero(capacity)
    cleanup()
    const shared = servedWhys(capacity as never)[0].why
    const sharedModel = { ...model, rows: model.rows.map(row => (row.goal.why ? { ...row, goal: { ...row.goal, why: shared } } : row)) }
    const { container } = render(<AnalysisHeroPanel model={sharedModel} rerunDisabled={false} />)
    expect(screen.getByTestId('hero-option-why-shared').textContent).toBe(shared)
    expect((container.textContent ?? '').split(shared).length - 1).toBe(1)
  })
})
