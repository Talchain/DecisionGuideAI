/**
 * HeroFooter — also-line + footer check glyphs + state-dependent CTA.
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
 *   - Moderate CTA stays visible with a softer label "Focus key
 *     estimate" because its focus side-effect is still useful without
 *     chat — onFocusNode runs even when prefill no-ops.
 */

import { Check, X } from 'lucide-react'
import { typography } from '@/styles/typography'
import type { AlsoLink, FooterCheck, FooterCta } from './analysisHeroVM.types'
import { FOOTER_CHECK_CLASS } from './tokens'

interface Props {
  alsoLinks: AlsoLink[]
  footerChecks: FooterCheck[]
  footerHint: string
  footerCta: FooterCta
  onAlsoClick: (link: AlsoLink) => void
  onCtaClick: () => void
  /** When false, prefill-dependent surfaces hide. */
  chatPrefillAvailable: boolean
}

export function HeroFooter({ alsoLinks, footerChecks, footerHint, footerCta, onAlsoClick, onCtaClick, chatPrefillAvailable }: Props) {
  // Also-line visibility: minimum-items rule (Fix 7) AND chat
  // availability (Fix 6). Need both ≥ 2 safe items AND chat open.
  const showAlsoLine = chatPrefillAvailable && alsoLinks.length >= 2

  // CTA visibility (Fix 6):
  //   - moderate (check-key-estimate): always visible; focus side-effect
  //     remains useful without chat. Label flips to "Focus key estimate"
  //     when chat is closed.
  //   - all other states: prefill-only — hide when chat is closed.
  const showCta = chatPrefillAvailable || footerCta.kind === 'check-key-estimate'
  const ctaLabel = !chatPrefillAvailable && footerCta.kind === 'check-key-estimate'
    ? 'Focus key estimate'
    : footerCta.label

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
                className="text-text-body hover:text-info focus-visible:outline-none focus-visible:underline cursor-pointer"
              >
                {link.label}
              </button>
              {i < alsoLinks.length - 1 && <span aria-hidden="true">·</span>}
            </span>
          ))}
        </div>
      )}
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-col gap-0.5 min-w-0">
          <div className={`flex items-center gap-2 flex-wrap ${typography.panelMeta}`}>
            {footerChecks.map(c => (
              <span key={c.label} className={`inline-flex items-center gap-1 ${FOOTER_CHECK_CLASS[c.tone]}`}>
                {c.tone === 'ok'
                  ? <Check size={11} aria-hidden="true" />
                  : c.tone === 'reflect'
                    ? <span className="text-[10px]" aria-hidden="true">◌</span>
                    : <X size={11} aria-hidden="true" />}
                {c.label}
              </span>
            ))}
          </div>
          <p className={`${typography.panelMeta} text-text-light`}>{footerHint}</p>
        </div>
        {showCta && (
          <button
            type="button"
            onClick={onCtaClick}
            className={`px-3 py-1.5 rounded-full bg-primary text-text-on-color border border-primary hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info ${typography.panelMeta} font-medium flex-shrink-0`}
            data-testid="hero-v17-footer-cta"
          >
            {ctaLabel}
          </button>
        )}
      </div>
    </section>
  )
}
