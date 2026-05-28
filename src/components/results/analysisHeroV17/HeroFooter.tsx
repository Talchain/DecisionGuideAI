/**
 * HeroFooter — also-line + state-dependent CTA.
 *
 * No auto-send paths after Fix 9 — every state's CTA is prefill-only.
 * The caller (`AnalysisHeroV17.handleCtaClick`) dispatches through
 * `prefillChat`; this component just renders.
 *
 * (Fix 7) Also-line minimum-items rule: the "Also:" lede only renders
 * with 2+ safe links. With 0 or 1, the whole row is hidden — a single-
 * item "Also: X" reads awkwardly and adds visual clutter.
 *
 * (Fix 6) When chat-prefill is unavailable the prefill-dependent
 * surfaces hide:
 *   - Also-line is hidden entirely (every link is prefill)
 *   - Footer CTA is hidden for weak / reflect / strong states
 *   - Moderate CTA stays visible because its focus side-effect is still
 *     useful without chat — onFocusNode runs even when prefill no-ops.
 *
 * 2026-05-21 correction pass:
 *   - Footer-checks block (Result clear / Sensitive assumption /
 *     Evidence gaps / Framing OK) REMOVED — duplicated the readiness
 *     strip above and added cognitive load.
 *   - Hint line ("Check the highest-priority input") REMOVED — duplicated
 *     Row 1.
 *   - Chat-closed CTA label flip now mirrors the CTA's `targetLabel`
 *     ("Focus {target}" / "Focus top estimate") so closed/open copy is
 *     consistent and there's no per-mode rename.
 *   - The `footerChecks` and `footerHint` props are no longer consumed by
 *     this component; the VM fields are retained with `@deprecated` JSDoc
 *     (data-layer surgery is out of scope for this pass).
 */

import { typography } from '@/styles/typography'
import type { AlsoLink, FooterCta } from './analysisHeroVM.types'

interface Props {
  alsoLinks: AlsoLink[]
  footerCta: FooterCta
  onAlsoClick: (link: AlsoLink) => void
  onCtaClick: () => void
  /** When false, prefill-dependent surfaces hide. */
  chatPrefillAvailable: boolean
}

export function HeroFooter({ alsoLinks, footerCta, onAlsoClick, onCtaClick, chatPrefillAvailable }: Props) {
  // Also-line visibility: minimum-items rule AND chat availability.
  const showAlsoLine = chatPrefillAvailable && alsoLinks.length >= 2

  // CTA visibility:
  //   - moderate (check-key-estimate): always visible; focus side-effect
  //     remains useful without chat. Label flips to a "Focus" variant
  //     when chat is closed.
  //   - all other states: prefill-only — hide when chat is closed.
  const showCta = chatPrefillAvailable || footerCta.kind === 'check-key-estimate'

  // Chat-closed label flip — mirrors the cleaned target derived in
  // buildFooterCta. `targetLabel` is `null` for non-mirroring states or
  // when Row 1's underlying label was unsafe / non-Verify; in that case
  // we fall back to "Focus top estimate" (parallel to "Check top
  // estimate" in chat-open mode).
  const ctaLabel = !chatPrefillAvailable && footerCta.kind === 'check-key-estimate'
    ? (footerCta.targetLabel ? `Focus ${footerCta.targetLabel}` : 'Focus top estimate')
    : footerCta.label

  // Skip the whole section when neither child would render. Without
  // this guard, weak / reflect / strong states with chat closed (CTA
  // hidden, also-line hidden) would still emit the `pt-2 border-t`
  // wrapper — a stray horizontal divider line with no content.
  if (!showAlsoLine && !showCta) return null

  return (
    <section className="flex flex-col gap-2 pt-2 border-t border-panel-border" data-testid="hero-v17-footer">
      {showAlsoLine && (
        <div className={`flex items-center gap-1.5 flex-wrap ${typography.panelMeta} text-text-light`} data-testid="hero-v17-also-line">
          <strong className="text-text-header font-semibold">Also:</strong>
          {alsoLinks.map((link, i) => (
            <span key={link.label} className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => onAlsoClick(link)}
                className="text-text-body hover:text-info focus-visible:outline-none focus-visible:underline cursor-pointer break-words text-left"
              >
                {link.label}
              </button>
              {i < alsoLinks.length - 1 && <span aria-hidden="true">·</span>}
            </span>
          ))}
        </div>
      )}
      {showCta && (
        <div className="flex items-center justify-end">
          <button
            type="button"
            onClick={onCtaClick}
            className={`px-3 py-1.5 rounded-full bg-primary text-text-on-color border border-primary hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info ${typography.panelMeta} font-medium flex-shrink-0 break-words`}
            data-testid="hero-v17-footer-cta"
          >
            {ctaLabel}
          </button>
        </div>
      )}
    </section>
  )
}
