/**
 * heroEvidenceView — the shared "render the disclosure, open it, switch view"
 * scaffolding.
 *
 * ⭐ THIS IS `src/test/helpers/resolveNextView.tsx`, RE-POINTED AND RENAMED.
 * The original rendered `V7EvidenceDisclosure` and typed its argument as
 * `V7EvidenceModel`; both are deleted. The surviving host is
 * `HeroEvidenceDisclosure`, so the helper follows it — and it loses the
 * `resolveNext` in its name, which described only one of the four views it
 * has always been parameterised over.
 *
 * ⚠ IT LIVES INSIDE THE HERO MODULE for the same forced reason as the fixture
 * beside it: `__tests__/inertness.spec.ts` permits exactly two importers of
 * `analysis-hero/**` repo-wide, and files under the module directory are
 * exempt. A helper at `src/test/helpers/` that rendered this component would
 * add an offender to that guard.
 *
 * ⚠ IT IS NOT A SPEC FILE and must never become one: vitest's include glob
 * collects only basenames ending in `.test.*` or `.spec.*` under a `__tests__`
 * directory, and this basename deliberately ends in neither.
 */

import { render, screen, fireEvent } from '@testing-library/react'
import { HeroEvidenceDisclosure } from '../../HeroEvidenceDisclosure'
import type { HeroEvidenceModel } from '../../heroTypes'

/** The four views this disclosure can be switched to. */
export type EvidenceViewKey = 'drivers' | 'flipRisks' | 'tradeOffs' | 'resolveNext'

/**
 * Click the disclosure header. Also the CLOSE half — the control is a toggle,
 * and the projection's clear-on-close behaviour is asserted by clicking it
 * twice.
 *
 * ⚠ `fireEvent`, NOT `node.click()`. The raw DOM call escapes React's `act()`,
 * so the disclosure never re-renders and every assertion afterwards reads a
 * COLLAPSED section — a false green that looks exactly like a real one. The
 * rationale is attached to the click itself so a site that only needs this half
 * cannot leave it behind.
 *
 * The accessible name is matched case-insensitively against the heading rather
 * than pinned as a literal: this host's heading has no comma
 * ('Why and what could change it') where the retired host's did, and a helper
 * that hard-codes copy breaks on a reword that changed nothing behavioural.
 */
export function openDisclosureHeader(): void {
  fireEvent.click(screen.getByRole('button', { name: /why and what could change it/i }))
}

/**
 * Switch to one view. Assumes the disclosure is already open.
 *
 * Binds by TESTID, never by the chip's label: a test that reaches a view by its
 * copy binds to copy (CLAUDE.md trap 19 — assertions bind to their object by
 * identity, never by something another object could satisfy).
 */
export function switchEvidenceView(view: EvidenceViewKey): void {
  fireEvent.click(screen.getByTestId(`hero-evidence-tab-${view}`))
}

/**
 * Render the disclosure, open it, and switch to one view.
 *
 * PARAMETERISED OVER THE VIEW, as the original was: a helper narrower than the
 * duplication sitting next to it cannot absorb it.
 */
export function openEvidence(
  evidence: HeroEvidenceModel,
  view: EvidenceViewKey,
  onFocusTarget?: (id: string) => void,
) {
  const utils = render(
    <HeroEvidenceDisclosure evidence={evidence} onFocusTarget={onFocusTarget} />,
  )
  openDisclosureHeader()
  switchEvidenceView(view)
  return utils
}
