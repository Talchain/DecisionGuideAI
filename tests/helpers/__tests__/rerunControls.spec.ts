/**
 * rerunControls helper — pins the control-semantics filter on the testid
 * branch of collectRerunControls.
 *
 * Why this exists: the mutation pass (rule 11) found the filter GREEN under
 * revert — no consuming spec renders a non-control element whose testid
 * matches RERUN_TESTID_RE, so the hardening was real but unpinned. This unit
 * test IS that missing consumer: a status banner (`analysis-running-banner`
 * substring-matches /re-?run|…/i via its 'run') must never be counted as a
 * rerun CONTROL, or every whole-tree single-owner sweep would fail on
 * narration rather than a real control the moment one mounts alongside the
 * strip.
 */
import { describe, it, expect } from 'vitest'

import { collectRerunControls } from '../rerunControls'

function scene(html: string): HTMLElement {
  const root = document.createElement('div')
  root.innerHTML = html
  document.body.appendChild(root)
  return root
}

describe('collectRerunControls — testid branch requires control semantics', () => {
  it('excludes a status banner whose testid substring-matches the rerun pattern', () => {
    const root = scene(`
      <div data-testid="analysis-running-banner">Analysis is running…</div>
      <button type="button">Rerun</button>
    `)
    const controls = collectRerunControls(root)
    // Positive control first: the real button IS collected (the filter
    // narrows, it must not blind the sweep).
    expect(controls.size).toBe(1)
    const only = [...controls][0]
    expect(only.tagName).toBe('BUTTON')
    // The banner div is NOT in the set.
    const banner = root.querySelector('[data-testid="analysis-running-banner"]')!
    expect(controls.has(banner)).toBe(false)
  })

  it('keeps control-semantic testid matches: button, link, role=button, input[type=submit]', () => {
    const root = scene(`
      <button data-testid="rerun-analysis">Go</button>
      <a href="#" data-testid="run-analysis-link">Go</a>
      <div role="button" data-testid="analysis-run-div">Go</div>
      <input type="submit" data-testid="rerun-submit" value="Go" />
      <input type="text" data-testid="rerun-input-field" />
    `)
    const controls = collectRerunControls(root)
    // button + a + role=button + input[type=submit] = 4; the text input is
    // testid-matched but not a control → excluded.
    expect(controls.size).toBe(4)
    const textInput = root.querySelector('[data-testid="rerun-input-field"]')!
    expect(controls.has(textInput)).toBe(false)
  })
})
