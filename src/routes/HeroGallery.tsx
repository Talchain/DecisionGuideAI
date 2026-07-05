/**
 * HeroGallery — INTERNAL fixture gallery for the analysis hero panel.
 *
 * Renders every prototype hero state from typed fixture models (provenance
 * 'fixture' — each panel instance carries the visible internal-preview
 * banner) so the full UI surface can be reviewed before the producer fields
 * that feed it exist. Flag-gated (`heroFixtureGallery`: staging-on,
 * production-off), unlinked from all navigation, and the ONLY module
 * allowed to import the fixture models (enforced by
 * analysis-hero/__tests__/fixtureIsolation.spec.ts). Nothing here touches
 * live analysis data: buildHeroModel remains the sole producer of 'live'
 * models and is not imported.
 */
import { Navigate } from 'react-router-dom'
import { typography } from '@/styles/typography'
import { isHeroFixtureGalleryEnabled } from '@/flags'
import { AnalysisHeroPanel } from '../components/results/analysis-hero/AnalysisHeroPanel'
import { GALLERY_ENTRIES } from '../components/results/analysis-hero/fixtures/galleryModels'

export function HeroGallery() {
  if (!isHeroFixtureGalleryEnabled()) return <Navigate to="/" replace />
  return (
    <div className="mx-auto max-w-2xl space-y-8 py-6" data-testid="hero-fixture-gallery">
      <header className="space-y-1">
        <h1 className={`${typography.panelHeader} text-text-header`}>
          Analysis hero — internal fixture gallery
        </h1>
        <p className={`${typography.panelBody} text-text-light`}>
          Example data only. Every state below is a typed fixture, never analysis output;
          the banner on each panel travels with the data.
        </p>
      </header>

      {GALLERY_ENTRIES.map((entry) => (
        <section key={entry.id} className="space-y-2" data-testid={`gallery-${entry.id}`}>
          <h2 className={`${typography.panelBody} text-text-header`}>{entry.title}</h2>
          <p className={`${typography.panelMeta} text-text-light`}>{entry.description}</p>
          <AnalysisHeroPanel
            model={entry.model}
            isStale={entry.isStale ?? false}
            onRerun={() => {}}
            rerunDisabled={false}
            focusPanelMounted={false}
            onApplyTarget={entry.withApplyTarget ? () => {} : undefined}
          />
        </section>
      ))}
    </div>
  )
}

export default HeroGallery
