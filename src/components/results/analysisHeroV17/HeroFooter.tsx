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
  /** When false, the CTA + Also: links render as disabled (they all prefill chat). */
  chatPrefillAvailable: boolean
}

export function HeroFooter({ alsoLinks, footerChecks, footerHint, footerCta, onAlsoClick, onCtaClick, chatPrefillAvailable }: Props) {
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
                disabled={!chatPrefillAvailable}
                title={chatPrefillAvailable ? undefined : 'Open the chat panel to use Also: links'}
                className="text-text-body hover:text-info focus-visible:outline-none focus-visible:underline cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:text-text-body"
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
          // The reflect-state CTA uses _sendMessage (auto-send), all
          // other states use _prefillChat. Disable only when the relevant
          // wire is unavailable. _sendMessage availability is reported
          // separately via the same flag pattern; for simplicity here we
          // treat chatPrefillAvailable as the proxy because the chat
          // panel registers both wires on mount.
          disabled={!chatPrefillAvailable}
          title={chatPrefillAvailable ? undefined : 'Open the chat panel to use this action'}
          className={`px-3 py-1.5 rounded-full bg-primary text-text-on-color border border-primary hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info ${typography.panelMeta} font-medium flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-primary`}
          data-testid="hero-v17-footer-cta"
        >
          {footerCta.label}
        </button>
      </div>
    </section>
  )
}
