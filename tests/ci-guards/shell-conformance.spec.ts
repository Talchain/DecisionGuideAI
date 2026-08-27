/**
 * THE WORKSPACE-SHELL CONFORMANCE GUARD
 *
 * Fails loud when a file in shell scope re-declares something the shell owns:
 * its own dock width, its own spacing scale, raw typography, a bottom-anchored
 * sticky inside the dock body, or a viewport breakpoint.
 *
 * ── WHY IT IS DERIVED AND WHAT THAT DOES AND DOES NOT BUY ─────────────────
 * Every rule's VOCABULARY comes from `shellContract.ts`'s exported tokens —
 * the width constants, `SHELL_SPACING_SCALE_PX`, `SHELL_TYPOGRAPHY_KEYS`. Add a
 * step to the spacing scale and the guard admits it in the same commit; change
 * `DOCK_RESPONSIVE_MAX_WIDTH` and the guard hunts the new number. There is no
 * second copy of any token to keep in sync.
 *
 * ⚠ And the limit of that, stated because the estate has been burned by
 * over-claiming it: DERIVATION PROVES AGREEMENT, NEVER COMPLETENESS. It cannot
 * tell you the scale is missing a step, only that nothing disagrees with the
 * steps it has. The hand-written fixtures in `describe('the guard can see')`
 * are the other half and are NOT redundant with it.
 *
 * ── NO SUPPRESSION. THIS IS THE POINT OF THE FILE. ────────────────────────
 * A previous guard in this repo was not blind — it was SUPPRESSED: the drifting
 * pair was written into a `KNOWN_FALLBACK_DRIFT` allowlist and the alarm went
 * quiet while the defect stayed. There is no per-token allowlist here and none
 * may be added.
 *
 * Two tiers, and the difference matters:
 *
 *   ZERO TOLERANCE — `src/canvas/components/workspaceShell/**`. The shell's own
 *   module. Every rule, no exceptions, count must be 0.
 *
 *   BURN-DOWN PIN — `OutputsDock.tsx`. 3,200 lines of pre-existing debt that
 *   this lane did not create and will not silently bless. Each rule's count is
 *   pinned and asserted for EXACT EQUALITY, so it REDs if it grows AND if it
 *   shrinks. That is not an allowlist: an allowlist names tokens and then stops
 *   looking at them, and reads green while the world moves. An exact count
 *   cannot read green while anything moves in either direction — a lane that
 *   fixes three violations must lower the number, and the diff is the evidence
 *   its PR actually burned them down.
 */

import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { stripComments } from '../../tools/ci-guards/lib/ds-token-context.mjs'
import {
  SHELL_SPACING_SCALE_PX,
  SHELL_SPACING_STEPS,
  SHELL_TYPOGRAPHY_KEYS,
  WORKSPACE_SURFACES,
  WORKSPACE_SURFACE_ORDER,
  SHELL_CONTAINER_NAME,
  surfaceFor,
  MAX_PRESENTED_SURFACES,
  presentedSurfaces,
  shellBodyClassName,
  shellContentBudget,
  SHELL_RADIUS_PX,
} from '../../src/canvas/components/workspaceShell/shellContract'
import {
  DOCK_MIN_WIDTH,
  DOCK_RESPONSIVE_MAX_WIDTH,
} from '../../src/canvas/components/dockWidth'

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const SHELL_DIR = 'src/canvas/components/workspaceShell'
const SHELL_HOST = 'src/canvas/components/OutputsDock.tsx'
/** The only module allowed to compute a dock width. */
const WIDTH_AUTHORITY = 'src/canvas/components/dockWidth.ts'

// ───────────────────────────────────────────────────────────────────────────
// Scope, derived from the filesystem rather than listed
// ───────────────────────────────────────────────────────────────────────────

function shellModuleFiles(): string[] {
  const dir = path.join(REPO, SHELL_DIR)
  return readdirSync(dir)
    .filter(f => /\.tsx?$/.test(f))
    .map(f => `${SHELL_DIR}/${f}`)
    .sort()
}

/**
 * The dock's TRANSITIVE IMPORT CLOSURE, crawled from `OutputsDock.tsx`.
 *
 * Home-directory globs were rejected for this: a rule scoped to
 * `canvas/components/model-tab/**` cannot see `canvas/shared/AnalysisFooter.tsx`
 * even though the shell mounts it, and cannot see a violation one import deeper
 * than a surface's entry module — which is exactly where the confirmed overlap
 * lived (`ReanalyseBar`, imported BY `ModelTabBody`, not part of it). A glob is
 * also as driftable as any hand-listed set: a new panel directory is out of
 * scope by default and silently unguarded.
 *
 * The crawl follows RELATIVE imports only. Package imports are deliberately not
 * followed — we do not own `node_modules`, and following them would make the
 * scope unbounded without adding a single file we can fix.
 */
function dockImportClosure(): string[] {
  const seen = new Set<string>()
  const stack = [path.join(REPO, SHELL_HOST)]
  const resolve = (from: string, spec: string): string | null => {
    if (!spec.startsWith('.')) return null
    const base = path.resolve(path.dirname(from), spec)
    for (const c of [`${base}.tsx`, `${base}.ts`, `${base}/index.tsx`, `${base}/index.ts`, base]) {
      if (existsSync(c)) {
        try {
          if (readFileSync(c) && /\.tsx?$/.test(c)) return c
        } catch {
          /* a directory, not a file */
        }
      }
    }
    return null
  }
  while (stack.length) {
    const file = stack.pop()!
    if (seen.has(file)) continue
    seen.add(file)
    let text: string
    try {
      text = readFileSync(file, 'utf8')
    } catch {
      continue
    }
    for (const m of text.matchAll(/from\s+['"](\.[^'"]+)['"]/g)) {
      const r = resolve(file, m[1])
      if (r && !seen.has(r)) stack.push(r)
    }
  }
  return [...seen]
    .map(f => path.relative(REPO, f).split(path.sep).join('/'))
    .filter(f => /\.tsx?$/.test(f) && !/(\.spec\.|\.test\.|__tests__\/)/.test(f))
    .sort()
}

/**
 * Code with comments blanked, one entry per source line.
 *
 * Load-bearing: this file's own prose deliberately spells `p-2.5`, `sm:` and
 * `font-semibold` as examples of what is banned. Scanning raw text would make
 * the shell contract's documentation a violation of the shell contract.
 */
function codeLines(rel: string): string[] {
  const text = readFileSync(path.join(REPO, rel), 'utf8')
  const stripped = stripComments(text)
  const raw = text.split('\n')
  expect(
    stripped.length,
    `stripComments changed the line count for ${rel} — line offsets would be wrong`,
  ).toBe(raw.length)
  return stripped
}

// ───────────────────────────────────────────────────────────────────────────
// The rules. Each one's vocabulary is DERIVED from the shell contract.
// ───────────────────────────────────────────────────────────────────────────

interface Finding {
  readonly file: string
  readonly line: number
  readonly token: string
  readonly sample: string
}

type Rule = {
  readonly id: string
  readonly what: string
  readonly tokensOnLine: (code: string) => string[]
}

/**
 * R1 — a dock width spelled anywhere but the width authority.
 *
 * The numbers are READ FROM `dockWidth.ts`, so this rule tracks the real
 * constants. 480 is the drag ceiling and is derived the same way the module
 * derives it, from `dockWidthBounds`' `Math.min(480, …)`.
 */
const DOCK_WIDTH_NUMBERS: readonly number[] = [DOCK_MIN_WIDTH, DOCK_RESPONSIVE_MAX_WIDTH, 480]

const ruleDockWidthLiteral: Rule = {
  id: 'dock-width-literal',
  what: `a dock width (${DOCK_WIDTH_NUMBERS.join('/')}) spelled outside ${WIDTH_AUTHORITY}`,
  tokensOnLine: code => {
    const out: string[] = []
    for (const n of DOCK_WIDTH_NUMBERS) {
      // A width, not any occurrence of the digits: `w-[416px]`, `width: 416`,
      // `minWidth: 280`, `416px`. `zIndex: 480` is not a width and must not
      // flag — hence the property/unit context rather than a bare number.
      const re = new RegExp(
        String.raw`(?:\b(?:w|min-w|max-w)-\[${n}px\]|\b(?:width|minWidth|maxWidth)\s*:\s*['"\`]?${n}\b|\b${n}px\b)`,
      )
      if (re.test(code)) out.push(String(n))
    }
    return out
  },
}

/**
 * R2 — a spacing utility off the DS scale.
 *
 * DERIVED: the legal steps are `SHELL_SPACING_STEPS`, computed from
 * `SHELL_SPACING_SCALE_PX`. Anything else in `padding`/`margin`/`gap`/`space`
 * is off-scale.
 *
 * ⚠ Deliberately NOT covering `w-`/`h-`/`size-`/`inset-`. In Tailwind 3 those
 * derive from `theme('spacing')` too, and treating them as spacing is the trap
 * one level down: the product's standard icon is `w-3.5` (14px, 179 uses) and a
 * rule that banned it would either be ignored or would delete the icons. DS
 * §4.1 governs rhythm, not icon geometry.
 */
const ruleOffScaleSpacing: Rule = {
  id: 'off-scale-spacing',
  what: `a padding/margin/gap/space step outside the DS scale (${SHELL_SPACING_SCALE_PX.join('·')}px)`,
  tokensOnLine: code => {
    const out: string[] = []
    const named = /\b(?:p|m)[xytrbl]?-(\d+(?:\.\d+)?)\b|\bgap(?:-[xy])?-(\d+(?:\.\d+)?)\b|\bspace-[xy]-(\d+(?:\.\d+)?)\b/g
    let m: RegExpExecArray | null
    while ((m = named.exec(code)) !== null) {
      const step = m[1] ?? m[2] ?? m[3]
      // `p-0`/`m-0` are "no spacing", always legal — the scale starts at 4px.
      if (step === '0') continue
      if (!SHELL_SPACING_STEPS.includes(step)) out.push(m[0])
    }
    // Arbitrary-bracket spacing bypasses the scale entirely and so survives
    // every config-level fix. Banned outright.
    const arbitrary = /\b(?:p|m)[xytrbl]?-\[[^\]]+\]|\bgap(?:-[xy])?-\[[^\]]+\]|\bspace-[xy]-\[[^\]]+\]/g
    while ((m = arbitrary.exec(code)) !== null) out.push(m[0])
    return out
  },
}

/**
 * R3 — raw typography.
 *
 * DS §2.4 is stricter than it is usually quoted: raw SIZES and raw WEIGHTS are
 * both banned, as are arbitrary sizes and inline `fontSize`/`fontWeight` — the
 * last of which is invisible to every class-based regex, and is exactly how the
 * verify badge shipped an 11px/600 declaration nothing could see.
 *
 * The legal vocabulary is `SHELL_TYPOGRAPHY_KEYS`, so this rule and the DS's
 * three-size rule cannot disagree.
 */
const RAW_TYPO = /\b(?:text-(?:xs|sm|base|lg|xl|2xl|3xl|4xl|5xl)|font-(?:thin|light|normal|medium|semibold|bold|extrabold|black))\b/g
const ARBITRARY_SIZE = /\btext-\[\d+(?:\.\d+)?px\]/g
const INLINE_FONT = /\bfont(?:Size|Weight)\s*:/g

const ruleRawTypography: Rule = {
  id: 'raw-typography',
  what: `a raw font size/weight — panel scope uses only ${SHELL_TYPOGRAPHY_KEYS.join('/')}`,
  tokensOnLine: code =>
    [
      ...(code.match(RAW_TYPO) || []),
      ...(code.match(ARBITRARY_SIZE) || []),
      ...(code.match(INLINE_FONT) || []),
    ],
}

/**
 * R4 — bottom-anchored sticky inside the dock body.
 *
 * The full-bleed occluding shape. The shell reserves footer space as a flex
 * SIBLING of the scrolling body; a child that pins itself to the bottom of the
 * shell's scroller covers whatever the shell put below it. This is the
 * `ReanalyseBar` defect, which hid `ModelFooter` completely.
 *
 * ⚠ `sticky top-*` is NOT banned and a blanket ban would be wrong: a sticky
 * HEADER is legitimate inside a surface that owns its own scroll, and
 * `AnalysisFreshnessNotice` is a live, correct instance. The rule discriminates
 * by anchor, not by the word `sticky`.
 */
const ruleStickyBottom: Rule = {
  id: 'sticky-bottom-in-body',
  what: 'a bottom-anchored `sticky` inside the dock body — use the shell footer region',
  tokensOnLine: code => code.match(/\bsticky\b[^"'`]*\bbottom-(?:0|\[[^\]]*\])/g) || [],
}

/**
 * R5 — a viewport breakpoint prefix.
 *
 * `sm:`/`md:`/… describe the WINDOW. The panel is 416px at 1280px wide and
 * 416px at 3840px wide, and 280px on a drag at either, so a viewport prefix in
 * panel scope is always answering a question nobody asked. Use
 * `usePanelWidth()` or `--panel-width`.
 */
const ruleViewportBreakpoint: Rule = {
  id: 'viewport-breakpoint',
  what: 'a viewport breakpoint prefix — the panel responds to its OWN width',
  tokensOnLine: code => code.match(/\b(?:sm|md|lg|xl|2xl):[a-z[]/g) || [],
}

const RULES: readonly Rule[] = [
  ruleDockWidthLiteral,
  ruleOffScaleSpacing,
  ruleRawTypography,
  ruleStickyBottom,
  ruleViewportBreakpoint,
]

function scan(files: readonly string[], rule: Rule): Finding[] {
  const found: Finding[] = []
  for (const file of files) {
    if (file === WIDTH_AUTHORITY && rule.id === ruleDockWidthLiteral.id) continue
    const lines = codeLines(file)
    lines.forEach((code, i) => {
      for (const token of rule.tokensOnLine(code)) {
        found.push({ file, line: i + 1, token, sample: code.trim().slice(0, 110) })
      }
    })
  }
  return found
}

const fmt = (f: Finding[]) => f.map(x => `  ${x.file}:${x.line}  ${x.token}   ${x.sample}`).join('\n')

// ═══════════════════════════════════════════════════════════════════════════

describe('workspace shell — the shell module is zero-tolerance', () => {
  const files = shellModuleFiles()

  it('the scope is non-empty and contains the contract itself (positive control on the scope)', () => {
    // Without this, every assertion below passes by scanning nothing — the
    // vacuity that makes an absence claim worthless.
    expect(files.length).toBeGreaterThanOrEqual(3)
    expect(files).toContain(`${SHELL_DIR}/shellContract.ts`)
    expect(files).toContain(`${SHELL_DIR}/WorkspaceShellTabStrip.tsx`)
    expect(files.every(f => existsSync(path.join(REPO, f)))).toBe(true)
  })

  for (const rule of RULES) {
    it(`has no ${rule.id}: ${rule.what}`, () => {
      const findings = scan(files, rule)
      expect(findings, `\n${rule.id} — ${rule.what}\n${fmt(findings)}\n`).toEqual([])
    })
  }
})

describe('workspace shell — OutputsDock burn-down pins (exact, both directions)', () => {
  /**
   * Pre-existing debt in the shell HOST, measured at `ed98cbd3` after this
   * lane's changes. Not an allowlist: no token is named and nothing stops being
   * looked at. Exact equality, so it REDs on growth AND on an unrecorded fix.
   *
   * A lane that burns one of these down edits the number here in the same PR,
   * and the diff is the proof it happened. Target for all five is 0.
   */
  const PINNED: Record<string, number> = {
    'dock-width-literal': 0,
    'off-scale-spacing': 6,
    'raw-typography': 6,
    'sticky-bottom-in-body': 0,
    'viewport-breakpoint': 0,
  }

  for (const rule of RULES) {
    it(`${rule.id} is exactly ${PINNED[rule.id]} in ${path.basename(SHELL_HOST)}`, () => {
      const findings = scan([SHELL_HOST], rule)
      expect(
        findings.length,
        findings.length > PINNED[rule.id]
          ? `\nNEW ${rule.id} in the shell host — ${rule.what}\n${fmt(findings)}\n`
          : `\n${rule.id} burned down from ${PINNED[rule.id]} to ${findings.length} — lower the pin in this PR ` +
            `so the ratchet holds at the new level.\n`,
      ).toBe(PINNED[rule.id])
    })
  }
})

describe('workspace shell — no NEW occluding sticky across the whole dock closure', () => {
  /**
   * The one rule scoped to the FULL closure, because it is the one whose harm
   * was witnessed: an opaque bottom-anchored bar pinning itself to the bottom
   * of the shell's scroller and covering whatever the shell rendered below it.
   *
   * ⚠ Only this rule runs at closure scope, and the reason is measured. At
   * closure scope `dock-width-literal` produces two hits that are NOT dock
   * widths — `ComposerTools.tsx:141 minWidth: 280` and
   * `EmptyState.tsx:132 maxWidth: 480` merely share the digits. A guard that
   * flags those gets switched off within a week, so that rule stays where it
   * can be precise (`shellContract` scope) rather than being loud and wrong
   * over 650 files.
   *
   * The residual set is PINNED BY NAME with its reason, and asserted for exact
   * equality. A gap recorded in the suite is honest; a gap invisible to it is
   * how the same defect oscillates back in.
   */
  const KNOWN_STICKY_BOTTOM: Record<string, string> = {
    'src/canvas/shared/AnalysisFooter.tsx':
      'Mounted by the shell as a flex SIBLING of the scroller, in the footer region, so its ' +
      'sticky is redundant rather than occluding. Dies with the footer consolidation.',
    'src/canvas/journey/JourneyTabBody.tsx':
      'Journey is `presentedAsTab: false` — unreachable, so nothing is occluded today. It must ' +
      'be fixed before the surface is ever lit.',
  }

  const closure = dockImportClosure()

  it('the closure is real and reaches PAST the surface entry modules', () => {
    // Positive control on the scope, and the load-bearing half of it. A crawl
    // that silently stopped at depth 1 would return a plausible list and score
    // zero violations for the best possible reason — that it looked nowhere.
    // `ReanalyseBar` is two hops in (OutputsDock → ModelTabBody → ReanalyseBar)
    // and is the exact file whose overlap this rule exists for, so its presence
    // proves the depth the claim depends on.
    expect(closure.length).toBeGreaterThan(300)
    expect(closure).toContain(SHELL_HOST)
    expect(closure).toContain('src/canvas/components/model-tab/ReanalyseBar.tsx')
    expect(closure).toContain('src/canvas/shared/AnalysisFooter.tsx')
  })

  it('every bottom-anchored sticky in the dock closure is a KNOWN, reasoned entry', () => {
    const files = [...new Set(scan(closure, ruleStickyBottom).map(f => f.file))].sort()
    const known = Object.keys(KNOWN_STICKY_BOTTOM).sort()
    expect(
      files,
      files.length > known.length
        ? '\nA NEW bottom-anchored sticky appeared inside the dock. The shell owns the footer ' +
          'region — render into it instead of pinning to the scroller.\n' +
          fmt(scan(closure, ruleStickyBottom)) +
          '\n'
        : '\nOne of the known occluding stickies is gone — remove it from KNOWN_STICKY_BOTTOM in ' +
          'this PR so the set keeps meaning what it says.\n',
    ).toEqual(known)
  })

  it('ReanalyseBar specifically is no longer sticky (the witnessed overlap)', () => {
    // Bound by IDENTITY to the file whose bar covered `ModelFooter`, not to
    // "the set is small" — which a different file leaving the set would also
    // satisfy.
    const bar = 'src/canvas/components/model-tab/ReanalyseBar.tsx'
    expect(closure).toContain(bar)
    expect(scan([bar], ruleStickyBottom)).toEqual([])
    // …and prove the file still renders the bar at all, so this is not passing
    // because the component was deleted.
    expect(readFileSync(path.join(REPO, bar), 'utf8')).toContain('data-testid="reanalyse-bar"')
  })
})

describe('workspace shell — child surfaces: raw typography, pinned per file', () => {
  /**
   * ⚠ THIS BLOCK EXISTS BECAUSE THE FIRST VERSION OF THIS GUARD DID NOT GUARD
   * CHILDREN, WHILE THE CONTRACT READ AS IF IT DID.
   *
   * Proven by a reviewer injecting six real violations into `ReanalyseBar.tsx`
   * — a genuine closure file two hops from the shell: **39/39 GREEN**, and the
   * pre-existing DS ratchet byte-identical, because its scope is
   * `components/results` + `canvas/panels` + one file. `model-tab/`,
   * `compare-tab/`, `pre-analysis/` and `conversation/` are in NEITHER guard's
   * scope — and those are the four child surfaces.
   *
   * DS §2.4 is the rule with the most leverage of the three that were
   * unguarded, so it is the one widened to the full dock import closure.
   * Measured at this tip: **45 files, 164 occurrences** (independently derived
   * here and matching the review's figure).
   *
   * ⚠ WHAT IS AND IS NOT COVERED, stated so nobody reads more into it.
   * Off-scale spacing (**572** closure-wide) and non-DS radius (**400**,
   * with no rule anywhere) are NOT gated. Pinning 572 today would freeze a
   * number nobody can burn down this week and would be pure ceremony. They are
   * **review-only**, and the child briefs must say so rather than implying a
   * mechanism exists.
   *
   * PER-FILE, not a total. A total lets a new violation in a clean file hide
   * behind a fix elsewhere — the exact currency error the DS ratchet was
   * rebuilt to avoid. Exact equality in both directions: a lane that burns
   * some down lowers its number here, and the diff is the proof.
   */
  // ⭐ BURNED DOWN TO ZERO, 18 Aug 2026 (B2 Analysis convergence): all EIGHT
  // `src/components/results/**` entries are gone from this map because the
  // measured count for each is now 0 — 30 occurrences retired in one pass
  // (AskOlumiDrawer 10, StrengthenPanel 7, DriversSection 4, and 2 each in
  // AnalysisHeroPanel / HeroEvidenceDisclosure / ActionsMenu /
  // DecisionOverviewCard, 1 in TriageActionCardsBody). The whole results tree
  // now measures ZERO under this rule AND under the DS ratchet's narrower one.
  //
  // How, so the next lane does not re-introduce them: block titles took
  // `panelHeader` (the sanctioned 14px semibold step) instead of a body token
  // plus a raw weight; buttons took `panelBody` per the DS's panel-button rule;
  // inline emphasis inside body/meta text took `<strong>`, the pattern already
  // in TriageActionCardsBody, which carries the emphasis semantically rather
  // than through a banned utility; StrengthenPanel's three `font-normal` badge
  // RESETS disappeared once the badges stopped being nested inside a bolded
  // title; and DriversSection's inline `fontSize`/`fontWeight` — the class the
  // header rightly calls invisible to every class-based regex — became
  // `panelMeta`, dropping a selected-state weight bump that duplicated the
  // border/background channel.
  // ⭐ BURNED DOWN TO ZERO, 18 Aug 2026 (B4 Model/Inspector convergence): all
  // SEVEN `src/canvas/components/model-tab/**` entries are gone from this map
  // because the measured count for each is now 0 — 21 occurrences retired
  // (ContestedEdgeCard 5, FactorsSection 7, RelationshipsSection 4,
  // OptionsSection 2, and 1 each in GoalSection / ReanalyseBar /
  // SourceProvenancePill). The model-tab child surface now measures ZERO under
  // this rule.
  //
  // How, so the next lane does not re-introduce them: every one was a redundant
  // WEIGHT stacked on a panel token (`${typography.panelMeta} font-medium`),
  // which §2.4 bans outright — "each token defines its own weight". The token
  // stayed and the raw utility went; where the weight was carrying a selected
  // or emphasised STATE, that state was already signalled by colour and border,
  // so dropping it also removed a duplicated visual channel (DS §1).
  //
  // ⚠ THIS GUARD IS WIDER THAN THE DS RATCHET AND CAUGHT WHAT THE RATCHET COULD
  // NOT. The same PR widened `check-ds-compliance.mjs`'s `panel-typography-scoped`
  // scope to include `model-tab/`, `inspector-v2/` and `model-tab-v2/` — but the
  // ratchet's regex cannot see arbitrary sizes (`text-[10px]`) or inline
  // `fontSize`/`fontWeight`, and its scope is still narrower than the dock
  // closure. Two guards over one rule, neither redundant: this one measures the
  // closure a user actually loads, that one gates the ratchet. Keep both.
  const RAW_TYPOGRAPHY_BY_FILE: Record<string, number> = {
    'src/canvas/compare-tab/CompareFooter.tsx': 2,
    'src/canvas/compare-tab/DotProgression.tsx': 2,
    'src/canvas/compare-tab/EmptyState.tsx': 1,
    'src/canvas/compare-tab/TrajectorySection.tsx': 3,
    'src/canvas/components/DegeneracyWarning.tsx': 6,
    'src/canvas/components/EvidenceCoverage.tsx': 2,
    'src/canvas/components/GraphTextView.tsx': 8,
    'src/canvas/components/IdentifiabilityBadge.tsx': 1,
    'src/canvas/components/OutputsDock.tsx': 6,
    'src/canvas/components/SectionErrorBoundary.tsx': 7,
    'src/canvas/components/ValidationPanel.tsx': 4,
    'src/canvas/components/WarningBanner.tsx': 1,
    'src/canvas/components/WhatChangedChip.tsx': 1,
    'src/canvas/components/pre-analysis/PreAnalysisPanel.tsx': 4,
    'src/canvas/components/pre-analysis/SharpenYourThinking.tsx': 2,
    'src/canvas/conversation/InlineBlocks.tsx': 1,
    'src/canvas/conversation/ModelReceiptBlock.tsx': 1,
    'src/canvas/conversation/zones/BriefGuidanceStrip.tsx': 1,
    'src/canvas/conversation/zones/BriefReadinessPill.tsx': 1,
    'src/canvas/conversation/zones/ChatComposer.tsx': 1,
    'src/canvas/conversation/zones/ChatThread.tsx': 1,
    'src/canvas/conversation/zones/ComposerTools.tsx': 1,
    'src/canvas/shared/AnalysisFooter.tsx': 1,
    'src/canvas/ui/inspector/StrengthBar.tsx': 1,
    'src/components/Tooltip.tsx': 1,
    'src/styles/typography.ts': 38,
    'src/v5/blocks/V5AnalysisResultBlock.tsx': 4,
    'src/v5/blocks/V5CoachingBlock.tsx': 2,
    'src/v5/blocks/V5ComparisonBlock.tsx': 2,
    'src/v5/blocks/V5FlipAnalysisBlock.tsx': 1,
  }

  const closure = dockImportClosure()

  it('the closure scope reaches the four child surfaces (positive control)', () => {
    // The claim this block makes is about CHILDREN, so the control has to show
    // a child home directory is genuinely in scope — not merely that the
    // closure is long. One file from each of the four surfaces, by name.
    const mustReach = [
      'src/canvas/components/model-tab/ReanalyseBar.tsx',
      'src/canvas/components/ModelTabBody.tsx',
      'src/canvas/compare-tab/CompareFooter.tsx',
      'src/canvas/conversation/zones/ChatThread.tsx',
    ]
    for (const f of mustReach) expect(closure, `${f} must be in the dock closure`).toContain(f)
    // …and a contrast control: a file OUTSIDE the dock's reach must not be.
    expect(closure).not.toContain('src/pages/sandbox-guide/index.tsx')
  })

  it('no file in the dock closure gains raw typography (exact, per file)', () => {
    const measured: Record<string, number> = {}
    for (const f of closure) {
      const n = scan([f], ruleRawTypography).length
      if (n > 0) measured[f] = n
    }
    const grew = Object.entries(measured).filter(([f, n]) => n > (RAW_TYPOGRAPHY_BY_FILE[f] ?? 0))
    const shrank = Object.entries(RAW_TYPOGRAPHY_BY_FILE).filter(
      ([f, n]) => (measured[f] ?? 0) < n,
    )
    expect(
      grew,
      `\nNEW raw typography in the dock closure. DS v5 §2.4: panel scope uses only ` +
        `${SHELL_TYPOGRAPHY_KEYS.join('/')} — raw sizes, raw WEIGHTS, arbitrary sizes and inline ` +
        `fontSize/fontWeight are all banned.\n` +
        grew.map(([f, n]) => `  ${f}: ${RAW_TYPOGRAPHY_BY_FILE[f] ?? 0} -> ${n}`).join('\n') +
        '\n',
    ).toEqual([])
    expect(
      shrank,
      `\nBurned down — lower these in RAW_TYPOGRAPHY_BY_FILE in the same PR so the ratchet holds ` +
        `at the new level:\n` +
        shrank.map(([f, n]) => `  ${f}: ${n} -> ${measured[f] ?? 0}`).join('\n') +
        '\n',
    ).toEqual([])
  })

  it('the pin is a real, non-trivial burn-down target (guards against an empty pin)', () => {
    // An empty or near-empty map would make the assertion above pass by
    // measuring almost nothing, which is how this kind of ratchet dies.
    const files = Object.keys(RAW_TYPOGRAPHY_BY_FILE).length
    const total = Object.values(RAW_TYPOGRAPHY_BY_FILE).reduce((a, b) => a + b, 0)
    // 26 Aug 2026 (AI-panel type scale): 113 -> 107, as six off-scale sizes in
    // four dock-column files became panel tokens. See the census scope widening.
    // 18 Aug 2026 (B4): 37 -> 30 files, 134 -> 113 occurrences, as the seven
    // `model-tab/**` entries above burned to zero. These two numbers are a
    // hand-maintained mirror OF THE MAP and must be lowered in the same PR as
    // any burn-down — which is exactly what caught this lane: removing the
    // entries turned the ratchet green and turned THIS assertion red, so the
    // pair cannot be quietly hollowed out from either end.
    expect(files).toBe(30)
    expect(total).toBe(107)
  })
})

describe('the guard can SEE a violation (positive controls, one per rule)', () => {
  /**
   * A guard that has never been shown detecting anything is an absence claim
   * with no positive control. Each case is a real string in the shape the rule
   * hunts, checked against the rule function directly.
   */
  const POSITIVE: ReadonlyArray<[Rule, string]> = [
    [ruleDockWidthLiteral, `<div className="w-[${DOCK_RESPONSIVE_MAX_WIDTH}px]" />`],
    [ruleDockWidthLiteral, `const s = { minWidth: ${DOCK_MIN_WIDTH} }`],
    [ruleOffScaleSpacing, `<div className="p-2.5 gap-1.5" />`],
    [ruleOffScaleSpacing, `<div className="px-[10px]" />`],
    [ruleRawTypography, `<span className="text-xs font-semibold" />`],
    [ruleRawTypography, `<span style={{ fontSize: 11, fontWeight: 600 }} />`],
    [ruleRawTypography, `<span className="text-[13px]" />`],
    [ruleStickyBottom, `<div className="sticky bottom-0 bg-panel" />`],
    [ruleViewportBreakpoint, `<div className="sm:grid-cols-2 md:hidden" />`],
  ]

  for (const [rule, line] of POSITIVE) {
    it(`${rule.id} flags: ${line}`, () => {
      expect(rule.tokensOnLine(line).length).toBeGreaterThan(0)
    })
  }

  /**
   * The DISCRIMINATING half. A rule that flags everything is as useless as one
   * that flags nothing, and these are the specific false positives that would
   * make each rule get switched off.
   */
  const NEGATIVE: ReadonlyArray<[Rule, string]> = [
    // `zIndex: 480` shares digits with the drag ceiling and is not a width.
    [ruleDockWidthLiteral, `const s = { zIndex: ${480} }`],
    // On-scale steps: 3 → 12px, 4 → 16px, 6 → 24px.
    [ruleOffScaleSpacing, `<div className="p-3 gap-4 mx-6" />`],
    // Sizing derives from theme('spacing') but is NOT rhythm — `w-3.5` is the
    // product's 14px icon, 179 uses. Flagging it is the trap, not the fix.
    [ruleOffScaleSpacing, `<Icon className="w-3.5 h-3.5" />`],
    // The DS panel tokens themselves must never be flagged.
    [ruleRawTypography, `<span className={typography.panelHeader} />`],
    // A sticky HEADER in a self-scrolling surface is legitimate and live.
    [ruleStickyBottom, `<div className="sticky top-0 z-10 bg-panel" />`],
    // `bottom-2` floating affordance is not the full-bleed occluding shape…
    [ruleStickyBottom, `<div className="sticky bottom-2 self-center" />`],
    // …and a bare CSS `lg:` inside a word is not a breakpoint prefix.
    [ruleViewportBreakpoint, `const summary = 'md: see notes'`],
  ]

  for (const [rule, line] of NEGATIVE) {
    it(`${rule.id} does NOT flag: ${line}`, () => {
      expect(rule.tokensOnLine(line)).toEqual([])
    })
  }

  it('comment prose is not code — the contract may document what it bans', () => {
    // This file and `shellContract.ts` both spell banned tokens in prose. If
    // the stripper regressed, the zero-tolerance block above would red on the
    // documentation, someone would add an allowlist, and the suppression
    // pattern this guard exists to refuse would be back within a week.
    const contract = codeLines(`${SHELL_DIR}/shellContract.ts`)
    const bannedInProse = contract.filter(l => ruleOffScaleSpacing.tokensOnLine(l).length > 0)
    expect(bannedInProse).toEqual([])
    // …and prove the stripper is not simply blanking the whole file.
    expect(contract.some(l => l.includes('SHELL_RADIUS_PX'))).toBe(true)
  })
})

describe('the shell contract itself holds together', () => {
  it('every surface declares scroll and padding, and Record covers the tab union', () => {
    // The type system already enforces this at compile time; the runtime
    // assertion is what catches an `as` cast or a JSON-sourced descriptor.
    for (const [id, s] of Object.entries(WORKSPACE_SURFACES)) {
      expect(s.id, `${id} row's id must match its key`).toBe(id)
      expect(['shell', 'self']).toContain(s.scroll)
      expect(['shell', 'self']).toContain(s.padding)
      expect(typeof s.presentedAsTab).toBe('boolean')
    }
  })

  it('Journey is hidden by contract and carries its reason', () => {
    // Bound by IDENTITY to the journey row, not by "some surface is hidden" —
    // which any future hidden surface would satisfy.
    expect(WORKSPACE_SURFACES.journey.presentedAsTab).toBe(false)
    expect(WORKSPACE_SURFACES.journey.hiddenReason.length).toBeGreaterThan(0)
    expect(presentedSurfaces().map(s => s.id)).not.toContain('journey')
  })

  it('a hidden surface must say why (no silent removals)', () => {
    for (const s of Object.values(WORKSPACE_SURFACES)) {
      if (!s.presentedAsTab) expect(s.hiddenReason.trim().length).toBeGreaterThan(0)
      else expect(s.hiddenReason).toBe('')
    }
  })

  it('ORDER and the Record agree — no hand-maintained membership mirror', () => {
    // ⚠ THE MIRROR THIS FILE EXISTS TO ABOLISH, FOUND INSIDE THE CONTRACT.
    // `WORKSPACE_SURFACE_ORDER` was a plain array that `presentedSurfaces()`
    // mapped over, so it was the de-facto membership list. Mutant: a surface
    // `presentedAsTab: true` in the Record but omitted from ORDER rendered
    // NOWHERE — tsc clean, whole suite green, and MAX_PRESENTED_SURFACES
    // defeated because the count came from the array.
    // Membership now comes from the Record and ORDER only sorts it, so the
    // failure is cosmetic rather than invisible; this keeps it from happening
    // at all.
    expect(new Set(WORKSPACE_SURFACE_ORDER)).toEqual(new Set(Object.keys(WORKSPACE_SURFACES)))
    expect(WORKSPACE_SURFACE_ORDER.length).toBe(Object.keys(WORKSPACE_SURFACES).length)
  })

  it('membership comes from the Record, not from ORDER (the mutant that was invisible)', () => {
    // The structural claim, not just the agreement: every PRESENTED surface in
    // the Record appears in presentedSurfaces(), whatever ORDER says. Binding
    // by identity to the derived id set.
    const fromRecord = (Object.keys(WORKSPACE_SURFACES) as Array<keyof typeof WORKSPACE_SURFACES>)
      .filter(id => WORKSPACE_SURFACES[id].presentedAsTab)
      .sort()
    expect(presentedSurfaces().map(s => s.id).sort()).toEqual(fromRecord)
  })

  it('an unknown tab id degrades to Analysis instead of throwing', () => {
    // The old ternary degraded; a bare Record index THROWS, and a render-time
    // throw in the shell takes the whole dock down. No reachable path supplies
    // an unknown id today — this removes the class rather than arguing it.
    expect(surfaceFor('not-a-tab').id).toBe('results')
    expect(surfaceFor('diagnostics').id).toBe('diagnostics')
    expect(() => shellBodyClassName(surfaceFor('not-a-tab'))).not.toThrow()
  })

  it('the Model surface asks the SHELL to host its re-run bar', () => {
    // B1: de-stickying `ReanalyseBar` fixed the occlusion and put the Model
    // tab's ONLY stale warning and ONLY re-run control ~3,300px below the fold
    // — `AnalysisFooter`, the other Rerun owner, mounts on `results` only. It
    // is now declared into the shell's reserved footer region.
    expect(WORKSPACE_SURFACES.diagnostics.footerBar).toBe('reanalyse')
    // Bound by identity to the surface that has its own always-visible footer,
    // so "some surface declares none" cannot satisfy this.
    expect(WORKSPACE_SURFACES.results.footerBar).toBe('none')
  })

  it('the Olumi surface asks the SHELL to carry the readiness statement', () => {
    // The blocked Analysis footer says "Ask in the chat what they need"; acting
    // on it fronts Olumi, and `{effectiveActiveTab === 'results' && …}` unmounts
    // the sentence and the Analyse control. Declared into the shell's footer
    // region so the surface the user is SENT TO carries the fact they were sent
    // to ask about. Bound by identity to `olumi`, so "some surface declares
    // readiness" cannot satisfy it.
    expect(WORKSPACE_SURFACES.olumi.footerBar).toBe('readiness')
    // …and the surface is genuinely presented, so this is not a declaration on
    // a tab no user can reach (Journey/Compare are the live counter-examples).
    expect(WORKSPACE_SURFACES.olumi.presentedAsTab).toBe(true)
  })

  it('every declared footerBar value has a render arm in the shell host', () => {
    // The declaration is only worth what the host does with it. A value added
    // to the union and rendered nowhere is the invisible mutant this contract
    // was built to abolish — declared, type-clean, and dark.
    const dock = readFileSync(path.join(REPO, SHELL_HOST), 'utf8')
    const declared = new Set(
      (Object.keys(WORKSPACE_SURFACES) as Array<keyof typeof WORKSPACE_SURFACES>)
        .map(id => WORKSPACE_SURFACES[id].footerBar)
        .filter(v => v !== 'none'),
    )
    expect(declared.size).toBeGreaterThan(1)
    for (const value of declared) {
      expect(dock, `no render arm for footerBar '${value}'`).toContain(`case '${value}':`)
    }
  })

  it('every PRESENTED surface has a body render arm in the shell host', () => {
    // ⭐ THE MISSING HALF OF THE FOOTER GUARD ABOVE, AND THE MORE IMPORTANT ONE.
    // A surface can be declared `presentedAsTab: true`, type-check cleanly, get
    // its tab painted in the strip — and render an EMPTY BODY, because nothing
    // ties the declaration to a `effectiveActiveTab === '<id>'` arm in the host.
    // That is the Journey defect exactly: a tab that opens onto nothing, the
    // product advertising an action that terminates in nothing. It was
    // unguarded until 27 Aug 2026, when adding a fourth presented surface made
    // the omission cheap to close.
    //
    // Deliberately a SOURCE-TEXT scan of the host, not a render: this asserts
    // the ARM EXISTS for every presented id, which no mounted test can do
    // without driving every surface.
    const dock = readFileSync(path.join(REPO, SHELL_HOST), 'utf8')
    const presented = presentedSurfaces().map(s => s.id)
    // Positive control: the scan must be able to SEE an arm it is looking for,
    // or every assertion below passes on a file it failed to read (trap 13).
    expect(dock.length, 'the shell host read as empty').toBeGreaterThan(1000)
    expect(presented.length).toBeGreaterThan(1)
    for (const id of presented) {
      expect(
        dock,
        `surface '${id}' is presented as a tab but the shell host has no ` +
          `\`effectiveActiveTab === '${id}'\` body arm — it would open onto nothing`,
      ).toContain(`effectiveActiveTab === '${id}'`)
    }
  })

  it('the shell renders the footer bar OUTSIDE the flag-gated stack', () => {
    // Hosting it inside the aiPanelV2 block would make the Model tab's only
    // re-run control vanish on rollback — a worse defect than the one fixed.
    const dock = readFileSync(path.join(REPO, SHELL_HOST), 'utf8')
    expect(dock).toContain('data-testid="shell-surface-footer-bar"')
    // ⚠ THE GATE READS THE DESCRIPTOR, NOT A TAB ID — and it is now a lookup
    // over the whole union rather than an equality against one value, because a
    // second surface declares a bar. The equality was pinned here verbatim
    // until 20 Aug 2026; it is SUPERSEDED rather than joined by a second
    // assertion, so there is exactly one statement of what the gate is.
    expect(dock).toContain("surfaceFor(effectiveActiveTab).footerBar !== 'none'")
    expect(dock).not.toContain("effectiveActiveTab === 'olumi' && surfaceFor")
    const barAt = dock.indexOf('data-testid="shell-surface-footer-bar"')
    const stackAt = dock.indexOf('data-testid="ai-panel-footer-stack"')
    expect(barAt).toBeGreaterThan(0)
    expect(stackAt).toBeGreaterThan(0)
    expect(barAt, 'the surface footer bar must precede the flag-gated stack').toBeLessThan(stackAt)
  })

  it('ModelTabBody no longer mounts the bar inside the scroller', () => {
    const body = readFileSync(path.join(REPO, 'src/canvas/components/ModelTabBody.tsx'), 'utf8')
    const code = stripComments(body).join('\n')
    expect(code).not.toContain('<ReanalyseBar')
    // …and prove the file is still the Model surface, so this is not passing
    // because the component was renamed out from under the assertion.
    expect(code).toContain('ModelFooter')
  })

  it('the shell is a size container so `@container` can match (A1)', () => {
    // Shipped ABSENT on a reason that was false: `container-type` was believed
    // to imply `contain: layout`. Measured in Chromium — it does not, and only
    // explicit `contain: layout` collapses a fixed descendant. The browser
    // half of this assertion lives in e2e/visual/shellLayout.visual.spec.ts.
    const dock = readFileSync(path.join(REPO, SHELL_HOST), 'utf8')
    const code = stripComments(dock).join('\n')
    expect(code).toContain("containerType: 'inline-size'")
    expect(code).toContain('containerName: SHELL_CONTAINER_NAME')
    // …and the token resolves to the name children will write in their rules.
    expect(SHELL_CONTAINER_NAME).toBe('workspace-shell')
    // The one thing that WOULD break the fixed descendants must stay absent.
    expect(code).not.toMatch(/contain:\s*['"`]layout/)
  })

  it('the strip never has to lay out more than the recorded maximum', () => {
    // A sixth presented surface REDs here rather than silently overflowing the
    // row at the drag floor, where there is least room to absorb it.
    expect(presentedSurfaces().length).toBe(MAX_PRESENTED_SURFACES)
  })

  it('the body class list is derived from the declaration, not from tab id', () => {
    // A `self` surface gets space and nothing else; a `shell` surface gets the
    // scroller and the gutter. Bound to the two surfaces by name.
    const olumi = shellBodyClassName(WORKSPACE_SURFACES.olumi)
    expect(olumi).toContain('overflow-hidden')
    expect(olumi).not.toContain('overflow-y-auto')
    expect(olumi).not.toContain('px-3')

    const model = shellBodyClassName(WORKSPACE_SURFACES.diagnostics)
    expect(model).toContain('overflow-y-auto')
    expect(model).toContain('px-3')
    expect(model).not.toContain('overflow-hidden')
  })

  it('the content budget is derived from the width authority, not restated', () => {
    expect(shellContentBudget(DOCK_RESPONSIVE_MAX_WIDTH)).toBe(390)
    expect(shellContentBudget(DOCK_MIN_WIDTH)).toBe(254)
  })

  it('the radius scale is the DS scale, with the panel override intact', () => {
    // DS v5 §6.2: cards inside panels 12px, standalone surfaces 20px. The
    // distinction is the clause children keep losing.
    expect(SHELL_RADIUS_PX.panelCard).toBe(12)
    expect(SHELL_RADIUS_PX.standalone).toBe(20)
    expect(SHELL_RADIUS_PX.panelCard).toBeLessThan(SHELL_RADIUS_PX.standalone)
  })

  it('the spacing steps are DERIVED from the px scale (no second copy)', () => {
    expect(SHELL_SPACING_STEPS).toEqual(SHELL_SPACING_SCALE_PX.map(px => String(px / 4)))
    // …and the derivation is not vacuous: the DS scale really does exclude the
    // half-steps Tailwind's default admits.
    expect(SHELL_SPACING_STEPS).not.toContain('2.5')
    expect(SHELL_SPACING_STEPS).not.toContain('0.5')
    expect(SHELL_SPACING_STEPS).toContain('3')
  })
})
