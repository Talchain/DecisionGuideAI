/**
 * Fixture isolation — the acceleration-plan safeguards, all in one place:
 *
 *   1. buildHeroModel is the ONLY producer of 'live' models — every model
 *      it returns (chart AND status) is branded 'live', and the live
 *      adapter NEVER populates the fixture-only slots (trust/status/named
 *      action, stability rows, ghost previous values, watch/trade-off).
 *   2. Fixture-branded models always render the visible internal-preview
 *      banner; live models never do — fixture data cannot masquerade as
 *      real analysis output even if a fixture model escaped its route.
 *   3. The fixture models module is importable ONLY from the internal
 *      gallery route and this module's own tests — no normal product route
 *      can pull fixture data (filesystem import scan, same mechanism as
 *      the proven inertness guard).
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, resolve, sep } from 'node:path'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { AnalysisHeroPanel } from '../AnalysisHeroPanel'
import { buildHeroModel } from '../buildHeroModel'
import { GALLERY_ENTRIES } from '../fixtures/galleryModels'
import HeroGallery from '../../../../routes/HeroGallery'
import { makeHeroData } from '../__fixtures__/hero.fixtures'
import type { HeroChartModel } from '../heroTypes'

const SRC = resolve(process.cwd(), 'src')
const MODULE_DIR = join(SRC, 'components', 'results', 'analysis-hero')
const GALLERY_ROUTE = join(SRC, 'routes', 'HeroGallery.tsx')

function walk(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === 'dist') continue
    const full = join(dir, name)
    if (statSync(full).isDirectory()) walk(full, acc)
    else if (/\.(ts|tsx)$/.test(name)) acc.push(full)
  }
  return acc
}

describe('fixture isolation — live adapter purity', () => {
  it('buildHeroModel brands every chart model live and leaves fixture-only slots empty', () => {
    const m = buildHeroModel(makeHeroData()) as HeroChartModel
    expect(m.kind).toBe('chart')
    expect(m.provenance).toBe('live')
    expect(m.trustLine).toBeNull()
    expect(m.statusChip).toBeNull()
    expect(m.focusAction).toBeNull()
    for (const row of m.rows) {
      expect(row.stability).toBeUndefined()
      expect(row.changeReadout).toBeUndefined()
      expect(row.outcome.previous).toBeUndefined()
      expect(row.detail.watch).toBeUndefined()
      expect(row.detail.tradeOff).toBeUndefined()
    }
    // Stability / What changed are never data-bearing live.
    expect(m.lenses).not.toContain('stability')
    expect(m.lenses).not.toContain('whatChanged')
  })

  it('buildHeroModel brands status models live too', () => {
    const m = buildHeroModel(
      makeHeroData({ recommendation: { analysisStatus: 'blocked' } }),
    )
    expect(m).toMatchObject({ kind: 'status', provenance: 'live' })
  })
})

describe('fixture isolation — banner travels with the brand', () => {
  const noop = () => {}
  const panelProps = {
    isStale: false,
    onRerun: noop,
    rerunDisabled: false,
    focusPanelMounted: false,
  }

  it('a live model never renders the fixture banner', () => {
    const live = buildHeroModel(makeHeroData()) as HeroChartModel
    render(<AnalysisHeroPanel model={live} {...panelProps} />)
    expect(screen.queryByTestId('hero-fixture-banner')).toBeNull()
  })

  describe('gallery route (flag-gated)', () => {
    beforeEach(() => localStorage.setItem('feature.heroFixtureGallery', '1'))
    afterEach(() => localStorage.removeItem('feature.heroFixtureGallery'))

    it('every gallery entry renders the internal-preview banner (chart and status states)', () => {
      render(
        <MemoryRouter>
          <HeroGallery />
        </MemoryRouter>,
      )
      expect(screen.getByTestId('hero-fixture-gallery')).toBeInTheDocument()
      const banners = screen.getAllByTestId('hero-fixture-banner')
      expect(banners.length).toBe(GALLERY_ENTRIES.length)
      for (const banner of banners) {
        expect(banner).toHaveTextContent('Internal preview: example data, not analysis output.')
      }
    })

    it('renders nothing when the flag is off (blocked from normal routes)', () => {
      // Explicit OFF override — deterministic regardless of any env-file
      // value the runner happens to load ('0' beats env in flagFactory).
      localStorage.setItem('feature.heroFixtureGallery', '0')
      render(
        <MemoryRouter>
          <HeroGallery />
        </MemoryRouter>,
      )
      expect(screen.queryByTestId('hero-fixture-gallery')).toBeNull()
    })
  })

  it('the full-prototype fixture lights every slot the live adapter cannot (visual completeness)', () => {
    const full = GALLERY_ENTRIES.find((e) => e.id === 'full-prototype')!
    render(<AnalysisHeroPanel model={full.model} {...panelProps} />)
    expect(screen.getByTestId('hero-status-chip')).toBeInTheDocument()
    expect(screen.getByTestId('hero-trust-line')).toBeInTheDocument()
    expect(screen.getByTestId('hero-focus-action')).toBeInTheDocument()
    // All four tabs data-bearing in the fixture.
    for (const lens of ['goal', 'outcome', 'stability', 'whatChanged']) {
      expect(screen.getByTestId(`hero-lens-tab-${lens}`)).toHaveAttribute(
        'data-available',
        'true',
      )
    }
  })

  it('every fixture model is branded fixture (the type-level contract holds at runtime)', () => {
    for (const entry of GALLERY_ENTRIES) {
      expect(entry.model.provenance, entry.id).toBe('fixture')
    }
  })
})

describe('fixture isolation — import boundary (machine-enforced, fails CI)', () => {
  it('fixture models are imported ONLY by the gallery route and module tests', () => {
    const offenders: string[] = []
    for (const file of walk(SRC)) {
      // The module's own tests (this file) and the fixtures dir itself may reference it.
      if (file.startsWith(join(MODULE_DIR, '__tests__') + sep)) continue
      if (file.startsWith(join(MODULE_DIR, 'fixtures') + sep)) continue
      if (file === GALLERY_ROUTE) continue
      const content = readFileSync(file, 'utf8')
      // Aliased/absolute form (any importer) plus the relative forms only
      // module-internal files could use — both are offences.
      const internal = file.startsWith(MODULE_DIR + sep)
      if (
        /analysis-hero\/fixtures/.test(content) ||
        (internal && /['"`]\.{1,2}\/fixtures/.test(content))
      ) {
        offenders.push(file.slice(SRC.length - 3))
      }
    }
    expect(
      offenders,
      `Fixture hero data may only be imported by the internal gallery route:\n${offenders.join('\n')}`,
    ).toEqual([])
  })

  it('the live adapter (buildHeroModel) imports no fixture code at all', () => {
    // Import/require specifiers only — comments may legitimately DESCRIBE
    // the fixture contract, but no fixture module may be loaded.
    const content = readFileSync(join(MODULE_DIR, 'buildHeroModel.ts'), 'utf8')
    expect(content).not.toMatch(/(?:from|import|require)\s*\(?\s*['"`][^'"`\n]*fixtures/)
  })

  it('positive control: the gallery route itself does import the fixtures', () => {
    expect(/analysis-hero\/fixtures/.test(readFileSync(GALLERY_ROUTE, 'utf8'))).toBe(true)
  })
})

describe('fixture isolation — deploy flag matrix (netlify.toml)', () => {
  const toml = readFileSync(resolve(process.cwd(), 'netlify.toml'), 'utf8')

  /**
   * Lines of one [context...] / [build.environment] section (up to the
   * next header). Anchored to line-start so a COMMENT mentioning the
   * section name can never satisfy the lookup.
   */
  function section(header: string): string {
    const re = new RegExp(`^\\[${header.replace(/\./g, '\\.')}\\]`, 'm')
    const match = re.exec(toml)
    if (!match) return ''
    const rest = toml.slice(match.index + match[0].length)
    const next = rest.search(/^\[/m)
    return next === -1 ? rest : rest.slice(0, next)
  }

  it('gallery flag is ON for staging only', () => {
    expect(section('context.staging.environment')).toMatch(
      /VITE_FEATURE_HERO_FIXTURE_GALLERY\s*=\s*"1"/,
    )
  })

  it('gallery flag is NEVER set for production or deploy previews', () => {
    // Production build env and deploy-preview context must not carry the
    // flag at all (flag default is off) — one appearance repo-wide, inside
    // the staging context.
    expect(section('build.environment')).not.toMatch(/HERO_FIXTURE_GALLERY/)
    expect(section('context.deploy-preview.environment')).not.toMatch(/HERO_FIXTURE_GALLERY/)
    expect(section('context.production.environment')).not.toMatch(/HERO_FIXTURE_GALLERY/)
    const occurrences = toml.match(/VITE_FEATURE_HERO_FIXTURE_GALLERY/g) ?? []
    expect(occurrences.length).toBe(1)
  })
})
