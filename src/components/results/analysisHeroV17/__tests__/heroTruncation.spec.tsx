/**
 * Hero text-truncation guardrails (V17 power pass, Fix 4 — 2026-05-27).
 *
 * The hero renders multiple text surfaces that consume CEE-emitted strings
 * (user labels, suggestion copy, key-question text). Without `break-words`
 * those surfaces risk mid-word truncation at narrow panel widths.
 *
 * Scope is the hero subtree ONLY — lower-section truncation (e.g. the
 * dominant-factor nudge `truncate min-w-0 flex-1` row) is intentionally
 * NOT touched by this pass. These tests do NOT mount TriageActionCardsBody.
 *
 * ── Testing-environment limitation (acknowledged) ─────────────────────────
 * These assertions check CSS class **presence** + the **absence** of
 * conflicting classes (e.g. `flex-shrink-0` next to `max-w-full`).  jsdom
 * does NOT compute layout — `offsetWidth`, flex shrink/grow, overflow,
 * and `getBoundingClientRect` are all faked. A real "does the CTA actually
 * wrap inside a 240px container?" test requires Playwright or another
 * browser-driven runner (out of scope for this unit-spec).
 *
 * What the class contract DOES guarantee:
 *   - Future edits that drop `max-w-full`, `whitespace-normal`, `text-left`,
 *     or `break-words` from the CTA fail this spec immediately.
 *   - Future edits that re-introduce `flex-shrink-0` to the CTA fail.
 *   - The wrapper's `min-w-0` (which lets the flex container actually
 *     shrink its child) is asserted at the parent element level.
 *
 * What the class contract does NOT guarantee:
 *   - That a sufficiently long CTA label visually wraps without overflow
 *     in a real browser. Visual confirmation lives in the
 *     post-deploy staging walkthrough or a future Playwright e2e.
 */

import '@testing-library/jest-dom/vitest'
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { HeroResultContext } from '../HeroResultContext'
import { HeroKeyQuestion } from '../HeroKeyQuestion'
import { HeroInputRows } from '../HeroInputRows'
import { HeroFooter } from '../HeroFooter'
import type { HeroRow, KeyQuestion, AlsoLink, FooterCta } from '../analysisHeroVM.types'

describe('Hero text truncation — break-words / line-clamp guardrails', () => {
  describe('HeroResultContext', () => {
    it('result line carries break-words to prevent mid-word truncation', () => {
      render(<HeroResultContext resultLine="Tech Lead comes out ahead most often." dependencyLine={null} />)
      const node = screen.getByTestId('hero-v17-result-context').querySelector('p')
      expect(node).not.toBeNull()
      expect(node!.className).toContain('break-words')
    })

    it('dependency line carries break-words when rendered', () => {
      render(
        <HeroResultContext
          resultLine="Tech Lead comes out ahead most often."
          dependencyLine="The result depends most on Technical Leadership."
        />,
      )
      const dep = screen.getByTestId('hero-v17-dependency-line')
      expect(dep.className).toContain('break-words')
    })
  })

  describe('HeroKeyQuestion', () => {
    const KQ: KeyQuestion = {
      text: 'What evidence would change your view?',
      extras: ['Alternative phrasing 1', 'Alternative phrasing 2'],
      chips: ['Yes', 'Probably not', 'Need more data'],
    }

    it('question text carries line-clamp-2 + break-words', () => {
      render(<HeroKeyQuestion keyQuestion={KQ} onPrefillChat={() => {}} chatPrefillAvailable />)
      const node = screen.getByTestId('hero-v17-key-question-text')
      expect(node.className).toContain('line-clamp-2')
      expect(node.className).toContain('break-words')
    })

    it('chip buttons carry break-words', () => {
      render(<HeroKeyQuestion keyQuestion={KQ} onPrefillChat={() => {}} chatPrefillAvailable />)
      const chipStrip = screen.getByTestId('hero-v17-key-question-chips')
      const chips = chipStrip.querySelectorAll('button')
      expect(chips.length).toBeGreaterThan(0)
      for (const chip of Array.from(chips)) {
        expect(chip.className).toContain('break-words')
      }
    })
  })

  describe('HeroInputRows', () => {
    const ROW: HeroRow = {
      key: 'evidence-x',
      title: 'Verify some factor',
      reason: 'Some CEE-emitted reason text that could be quite long and needs to wrap on word boundaries even when the container is narrow.',
      priority: 'High',
      priorityWidth: 100,
      category: 'evidence',
      actions: ['ai', 'discuss'],
      targetNodeId: 'n_x',
      chatPrompt: 'help',
    }

    it('row reason carries line-clamp-2 + break-words', () => {
      render(
        <HeroInputRows
          inputRows={[ROW]}
          hiddenRows={[]}
          dispatchRowAction={() => {}}
          chatPrefillAvailable
        />,
      )
      const reason = screen.getByTestId('hero-v17-row-reason')
      expect(reason.className).toContain('line-clamp-2')
      expect(reason.className).toContain('break-words')
    })

    it('row title (already correct pre-pass) keeps line-clamp-2 + break-words — regression guard', () => {
      render(
        <HeroInputRows
          inputRows={[ROW]}
          hiddenRows={[]}
          dispatchRowAction={() => {}}
          chatPrefillAvailable
        />,
      )
      const title = screen.getByTestId('hero-v17-row-title')
      expect(title.className).toContain('line-clamp-2')
      expect(title.className).toContain('break-words')
    })
  })

  describe('HeroFooter', () => {
    const CTA: FooterCta = {
      label: 'Check top estimate',
      kind: 'check-key-estimate',
      chatPrompt: 'p',
      focusTargetId: 'n_x',
      targetLabel: 'Hiring rate',
    }
    const LINKS: AlsoLink[] = [
      { label: 'Examine top risks', chatPrompt: 'p1' },
      { label: 'Consider an alternative', chatPrompt: 'p2' },
    ]

    it('also-link buttons carry break-words', () => {
      render(
        <HeroFooter
          alsoLinks={LINKS}
          footerCta={CTA}
          onAlsoClick={() => {}}
          onCtaClick={() => {}}
          chatPrefillAvailable
        />,
      )
      const linkBar = screen.getByTestId('hero-v17-also-line')
      const linkButtons = linkBar.querySelectorAll('button')
      expect(linkButtons.length).toBeGreaterThan(0)
      for (const btn of Array.from(linkButtons)) {
        expect(btn.className).toContain('break-words')
      }
    })

    it('footer CTA carries the full wrap contract — max-w-full, whitespace-normal, text-left, break-words; NO flex-shrink-0 (Codex round-3 P1 #1)', () => {
      render(
        <HeroFooter
          alsoLinks={LINKS}
          footerCta={CTA}
          onAlsoClick={() => {}}
          onCtaClick={() => {}}
          chatPrefillAvailable
        />,
      )
      const cta = screen.getByTestId('hero-v17-footer-cta')
      // break-words alone is insufficient: without max-w-full the button
      // keeps its content width, and without whitespace-normal the
      // browser may not insert wrap opportunities at spaces. text-left
      // makes wrapped lines readable. flex-shrink-0 MUST be absent so
      // the parent flex container can actually shrink the child.
      expect(cta.className).toContain('break-words')
      expect(cta.className).toContain('max-w-full')
      expect(cta.className).toContain('whitespace-normal')
      expect(cta.className).toContain('text-left')
      expect(cta.className).not.toContain('flex-shrink-0')
    })

    it('footer CTA wrapper carries min-w-0 so the flex container shrinks long buttons (Codex round-3 P1 #1)', () => {
      render(
        <HeroFooter
          alsoLinks={LINKS}
          footerCta={CTA}
          onAlsoClick={() => {}}
          onCtaClick={() => {}}
          chatPrefillAvailable
        />,
      )
      // The CTA wrapper is the immediate parent of the button.
      const wrapper = screen.getByTestId('hero-v17-footer-cta').parentElement
      expect(wrapper).not.toBeNull()
      expect(wrapper!.className).toContain('min-w-0')
    })
  })
})
