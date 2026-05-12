/**
 * HeroFooter — also-line + footer check glyphs + state-dependent CTA.
 *
 * Only the reflect-state CTA auto-sends (handled by the caller via
 * `onCtaClick`). All other CTAs prefill. See investigation §11.4 for the
 * full state→handler map and brief §3 step 6 for moderate-state focus-
 * then-prefill sequencing.
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
}

export function HeroFooter({ alsoLinks, footerChecks, footerHint, footerCta, onAlsoClick, onCtaClick }: Props) {
  return (
    <section className="flex flex-col gap-2 pt-2 border-t border-panel-border" data-testid="hero-v17-footer">
      {alsoLinks.length > 0 && (
        <div className={`flex items-center gap-1.5 flex-wrap ${typography.panelMeta} text-text-light`}>
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
        <button
          type="button"
          onClick={onCtaClick}
          className={`px-3 py-1.5 rounded-full bg-primary text-text-on-color border border-primary hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info ${typography.panelMeta} font-medium flex-shrink-0`}
          data-testid="hero-v17-footer-cta"
        >
          {footerCta.label}
        </button>
      </div>
    </section>
  )
}
