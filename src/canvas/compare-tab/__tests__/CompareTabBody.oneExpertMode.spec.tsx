/**
 * ROADMAP 2.581 — THE RESULTS SURFACE HAS EXACTLY ONE EXPERT MODE, AND THE
 * PRODUCT HAS EXACTLY TWO.
 *
 * ⚠ AN EARLIER VERSION OF THIS FILE CLAIMED "THE PRODUCT HAS EXACTLY ONE
 * EXPERT MODE", AND ITS LAST TEST CLAIMED "exactly ONE expert-mode storage key
 * exists across all non-test source". **Both were false as written**, and the
 * test passed only because its sweep matched on the WORD "expert" in a key
 * NAME. There is a third mode — the second surviving one — which the sweep was
 * structurally unable to see:
 *
 *   · `canvasStore.viewMode`, persisted at `sessionStorage['canvas.viewMode']`,
 *     typed `'standard' | 'expert'` (`canvas/store.ts:669`, read at `:1709`,
 *     written at `:4992`). Its controls are labelled **"Detailed"/"Standard"**
 *     — the LeftSidebar eye toggle (`components/layout/LeftSidebar.tsx:158`,
 *     accessible name "Detailed view"/"Standard view") and the canvas context
 *     menu item "Switch to Detailed"/"Switch to Standard"
 *     (`canvas/contextMenu/useMenuItems.ts:222`). It gates canvas NODE detail
 *     (`nodes/*.tsx`'s `isDetailed`), post-analysis node filtering
 *     (`ReactFlowGraph.tsx:340`) and edge-label visibility — **it does not gate
 *     the downside tail, the range bar or the tail caveat.**
 *
 * The key is named for its VALUES, not for the word, so a name-based sweep is
 * blind to it. This file now sweeps BOTH ways (see the last two tests), and
 * the claim it makes is the true one: **two expert-bearing persisted modes
 * exist; exactly one of them reaches the Results option cards.** That the
 * canvas mode does not reach them is pinned behaviourally, on the real mount
 * path, in `components/results/__tests__/ResultsBody.downsideTailMountPath.spec.tsx`.
 *
 * This correction matters for the row's own thesis: 2.581 was reported because
 * a reader pressed a control that says "Expert" and got a different mode. A
 * document that then under-counts the modes is the same defect in the record.
 *
 * ## The measured failure this exists to make impossible
 *
 * The 2.581 report — "the downside tail renders in one expert session and not
 * in another, on the same builds" — was not a producer defect. The failing
 * session's own `/proxy/v5/turn` payload carried the complete
 * `downside{cvar_10, p05, expected_regret}` block for all five options
 * (`expert-session-2026-08-05-raw/run5/wire.json`, entry 14). What differed
 * was which "Expert" control had been pressed.
 *
 * Until this change the product shipped TWO unrelated expert states:
 *
 *   · `OutputsDock` — `olumi.expertMode`, `'true'`/`'false'`. This is the one
 *     that gates the Results option cards' range bar, downside tail and tail
 *     caveat. Its control is an unlabelled `</>` glyph (its accessible name is
 *     "Enable expert mode"; its VISIBLE text is `</>`).
 *   · `CompareTabBody` — a local `useState` behind `feature.compareExpert`,
 *     `'1'`/`'0'`, scoped to the Refinement-journey tab. Its control was the
 *     ONLY thing in the product whose visible text read "Expert".
 *
 * `run5/driver.log`: Compare clicked 16:02:54 → the button matching
 * `/^Expert$/i` clicked 16:02:57 → Analysis tab 16:02:59. `</>` never touched.
 * A reader who goes looking for expert mode finds the word, presses it, and
 * gets a different mode from the one they were looking for — with nothing on
 * screen to say so.
 *
 * ## Why the fix is a DELETION and not a synchronisation
 *
 * Two states kept in step is a hand-maintained mirror, and a mirror drifts
 * silently (trap 12). So the second state is gone: `CompareTabBody` is now a
 * controlled consumer of the single `OutputsDock` state, and the
 * `feature.compareExpert` key no longer exists. The tests below pin BOTH the
 * controlled-ness (behaviour) and the absence of a second key (a derived
 * drift alarm that fails loud rather than assuming good).
 */
import { describe, it, expect, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { TabHeader } from '../TabHeader'

const ROOT = path.resolve(__dirname, '../../../..')

/**
 * Every non-test source file, enumerated from disk so the sweep cannot go
 * stale as files are added — the completeness problem a hand-listed manifest
 * has and a derived one does not.
 */
function sourceFiles(): string[] {
  const out: string[] = []
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        if (entry.name === '__tests__' || entry.name === 'node_modules') continue
        walk(p)
      } else if (/\.tsx?$/.test(entry.name) && !/\.spec\.tsx?$/.test(entry.name)) {
        out.push(p)
      }
    }
  }
  walk(path.join(ROOT, 'src'))
  return out
}

/**
 * Every persisted key in non-test source, with the character offset of each
 * occurrence — so a caller can ask a question about a key's NEIGHBOURHOOD
 * rather than only about its name.
 */
function persistedKeyOccurrences(): Array<{ key: string; file: string; code: string; at: number }> {
  const out: Array<{ key: string; file: string; code: string; at: number }> = []
  for (const file of sourceFiles()) {
    const code = fs
      .readFileSync(file, 'utf-8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '')
    for (const m of code.matchAll(
      /(?:local|session)Storage\.(?:get|set|remove)Item\(\s*['"`]([A-Za-z0-9_.:-]+)['"`]/g,
    )) {
      out.push({ key: m[1], file, code, at: m.index ?? 0 })
    }
  }
  return out
}

describe('2.581 — the expert modes, counted both ways', () => {
  it('the Compare pill is CONTROLLED: pressing it reports up and changes nothing on its own', () => {
    const onToggleExpert = vi.fn()
    const { rerender } = render(
      <TabHeader showExpert={false} onToggleExpert={onToggleExpert} />,
    )

    const pill = screen.getByRole('button', { name: /expert/i })
    // Identity: this is the control whose visible text is the word a reader
    // searches for. If that text moves, this suite must be re-pointed rather
    // than silently start testing a different button.
    expect(pill.textContent).toContain('Expert')

    pill.click()
    expect(onToggleExpert).toHaveBeenCalledTimes(1)
    expect(onToggleExpert).toHaveBeenCalledWith(true)

    // The owner did not update, so the pill must NOT have flipped itself.
    // A component that re-grew its own state would show the pressed styling
    // here without anyone having granted it.
    expect(pill.className).not.toMatch(/bg-info\/10/)

    // And when the owner DOES grant it, the pressed styling appears — the
    // positive control that proves the assertion above can see the difference.
    rerender(<TabHeader showExpert onToggleExpert={onToggleExpert} />)
    expect(screen.getByRole('button', { name: /expert/i }).className).toMatch(/bg-info\/10/)
  })

  it('CompareTabBody owns no expert state and no storage key of its own', () => {
    const source = fs.readFileSync(
      path.join(ROOT, 'src/canvas/compare-tab/CompareTabBody.tsx'),
      'utf-8',
    )
    // Required props, not optional-with-a-default: a default would silently
    // reintroduce a second behaviour at any call site that forgot to pass it.
    expect(source).toMatch(/expertMode:\s*boolean/)
    expect(source).toMatch(/onToggleExpert:\s*\(value:\s*boolean\)\s*=>\s*void/)
    // The deleted key stays deleted. Comments are stripped first so the
    // historical account of the defect, which necessarily names the key,
    // cannot satisfy or defeat this assertion.
    const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
    expect(code).not.toContain('feature.compareExpert')
    expect(code).not.toMatch(/useState[^\n]*[Ss]howExpert/)
  })

  it('OutputsDock passes its single expert state down to the Compare tab', () => {
    const source = fs.readFileSync(
      path.join(ROOT, 'src/canvas/components/OutputsDock.tsx'),
      'utf-8',
    )
    expect(source).toMatch(
      /<CompareTabBodyV2[\s\S]{0,300}?expertMode=\{expertMode\}[\s\S]{0,300}?onToggleExpert=\{setExpertMode\}/,
    )
  })

  it('exactly ONE storage key is NAMED for expert mode — sweeping by name', () => {
    const keys = new Set<string>()
    for (const file of sourceFiles()) {
      const text = fs.readFileSync(file, 'utf-8')
      // Strip comments before scanning: this file's own prose, and
      // CompareTabBody's, name the retired key on purpose.
      const code = text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
      for (const m of code.matchAll(/['"`]([A-Za-z0-9_.-]*[Ee]xpert[A-Za-z0-9_.-]*)['"`]/g)) {
        // Only string literals that look like a persisted key (dotted
        // namespace), not copy, class names or aria labels.
        if (m[1].includes('.')) keys.add(m[1])
      }
    }
    // POSITIVE CONTROL: the sweep must be able to SEE the key that does exist,
    // or "exactly one" would be satisfied by a scan that found nothing.
    expect(keys, 'the sweep must see the real key').toContain('olumi.expertMode')
    expect([...keys].sort()).toEqual(['olumi.expertMode'])
    // ⚠ AND THIS IS THE WHOLE CLAIM — no more. `canvas.viewMode` stores the
    // VALUE 'expert' and is invisible here by construction. The next test is
    // what notices it; deleting either leaves a whole class unobserved.
  })

  it('exactly TWO persisted modes can hold the VALUE "expert" — sweeping by value, which is what the name sweep cannot see', () => {
    // A key is expert-BEARING if the literal 'expert' appears in its immediate
    // neighbourhood — i.e. it is written from, compared against, or typed as a
    // union containing that value. Naming-independent, so it catches a mode
    // that never spells the word in its key.
    //
    // WINDOW, and why this number: measured across all 34 persisted keys in
    // non-test source at 120 / 200 / 400 characters, every window returns the
    // SAME single key. 200 is therefore not a tuned threshold sitting on a
    // cliff edge — it is the middle of a plateau, and the two `canvas.viewMode`
    // sites (`store.ts:1709` reading inside a `(): 'standard' | 'expert' =>`
    // initialiser, `:4992` writing `mode`) are both inside it.
    const WINDOW = 200
    const valueBorne = new Set<string>()
    for (const { key, code, at } of persistedKeyOccurrences()) {
      const near = code.slice(Math.max(0, at - WINDOW), at + WINDOW)
      if (/['"`]expert['"`]/.test(near)) valueBorne.add(key)
    }

    // POSITIVE CONTROL, and the correction of this file's original claim: the
    // sweep must SEE the mode the name sweep is blind to, or "exactly two"
    // would be satisfied by a scan that found nothing.
    expect(
      valueBorne,
      'the value sweep must see canvas.viewMode — if this fails the sweep is broken, not the product',
    ).toContain('canvas.viewMode')

    // The full manifest of expert-bearing persisted modes: the name sweep's
    // one key, unioned with the value sweep's one key. HAND-PINNED, because a
    // derived guard proves the copies agree and can never notice the list is
    // short (trap 12d) — this line is what a reviewer reads to learn how many
    // expert modes the product has.
    const allExpertModes = new Set<string>([...valueBorne, 'olumi.expertMode'])
    expect([...allExpertModes].sort()).toEqual(['canvas.viewMode', 'olumi.expertMode'])
  })

  it('the second mode is a CANVAS-DETAIL mode: the Results option cards never read it', () => {
    // Scope, stated by consumer. `canvas.viewMode` is read by canvas node
    // renderers, the post-analysis node filter and edge-label visibility. It
    // is NOT read anywhere under `src/components/results`, which is where the
    // range bar, the downside tail and the tail caveat live — so pressing
    // "Detailed" can never reveal or hide them. (The behavioural proof, on the
    // real mount path, is in ResultsBody.downsideTailMountPath.spec.tsx; this
    // is the structural one that fails the moment a results file starts
    // reading it.)
    const offenders = sourceFiles()
      .filter((f) => f.includes(`${path.sep}components${path.sep}results${path.sep}`))
      .filter((f) => {
        const code = fs
          .readFileSync(f, 'utf-8')
          .replace(/\/\*[\s\S]*?\*\//g, '')
          .replace(/^\s*\/\/.*$/gm, '')
        return /\bviewMode\b/.test(code) || code.includes('canvas.viewMode')
      })
      .map((f) => path.relative(ROOT, f))

    // POSITIVE CONTROL: the sweep must actually be looking at files. A filter
    // that matched nothing would make the emptiness above meaningless.
    expect(
      sourceFiles().filter((f) => f.includes(`${path.sep}components${path.sep}results${path.sep}`))
        .length,
      'the results-surface file sweep must find files to look at',
    ).toBeGreaterThan(20)
    expect(offenders).toEqual([])
  })
})
