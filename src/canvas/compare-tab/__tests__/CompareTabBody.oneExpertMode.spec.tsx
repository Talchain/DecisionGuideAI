/**
 * ROADMAP 2.581 — THE PRODUCT HAS EXACTLY ONE EXPERT MODE.
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

describe('2.581 — one expert mode, one storage key', () => {
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

  it('exactly ONE expert-mode storage key exists across all non-test source', () => {
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
  })
})
