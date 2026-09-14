/**
 * ⭐⭐ THE TOP OF THE CHAIN — `OutputsDock` must hand the Model tab BOTH halves
 * of the one expert preference.
 *
 * The convergence is a three-link chain:
 *
 *   OutputsDock.tsx:1150   `olumi.expertMode` + `setExpertMode`   (owner)
 *        ↓  <ModelTabBody expertMode=… onToggleExpert=… />        ← THIS FILE
 *   ModelTabBody.tsx       forwards both                          ← threadsExpertMode.spec
 *        ↓  <ModelTabV2Panel expertMode=… onToggleExpert=… />
 *   ModelTabV2Panel        derives `tier` from them               ← oneExpertSwitch.spec
 *
 * The lower two links are pinned by behavioural specs. THE TOP LINK WAS NOT,
 * and it is the one whose loss is completely silent: `onToggleExpert` is
 * optional at every hop, so deleting it here leaves the panel falling back to
 * its private `useState` — the tab quietly returns to two switches, the outline
 * goes back to forgetting the user's choice on every tab switch, and every
 * behavioural spec in this directory stays green because they all pass the prop
 * themselves.
 *
 * WHY A SOURCE SCAN. `OutputsDock` is a ~3,900-line component with a live store,
 * SSE and a dozen tab branches; mounting it to assert one prop would test the
 * harness more than the wiring. The estate's own precedent for this shape is
 * `modelTabNoRawStoreWrites.sourceScan.spec.ts`. The claim here is narrow and
 * structural — a PRESENCE claim about one JSX element — not a behavioural one.
 *
 * ⚠ SCOPE, STATED PRECISELY (trap 20: a row minted from a scan must restate the
 * scan's exact scope, never its generalisation). This asserts that the
 * `<ModelTabBody …>` element in `OutputsDock.tsx` carries both prop names. It
 * does NOT assert that the values are correct, that the tab is reachable, or
 * that anything renders. Those are the other two specs' jobs.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const OUTPUTS_DOCK = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  'components',
  'OutputsDock.tsx',
)

/**
 * The `<ModelTabBody …/>` JSX element, from its opening tag to the first `/>`.
 *
 * Returns `''` when the element is not found, so a caller that forgets to check
 * cannot mistake "extracted nothing" for "extracted something with no match" —
 * the zsh/`diff` failure mode where two empty results agree perfectly.
 */
function modelTabBodyElement(source: string): string {
  const open = source.indexOf('<ModelTabBody')
  if (open === -1) return ''
  const close = source.indexOf('/>', open)
  if (close === -1) return ''
  return source.slice(open, close + 2)
}

describe('OutputsDock hands the Model tab the ONE expert preference', () => {
  const source = readFileSync(OUTPUTS_DOCK, 'utf8')
  const element = modelTabBodyElement(source)

  it('POSITIVE CONTROL: the extraction found a real, non-empty element', () => {
    // Without this every assertion below would pass vacuously against `''` if
    // the component were ever renamed or reformatted onto a different closing
    // shape. An absence probe must first prove it can see a presence (trap 13).
    expect(element.length).toBeGreaterThan(0)
    expect(element).toContain('<ModelTabBody')
    // A prop that has been threaded here since long before this change — proof
    // the slice really spans the element's body and not just its tag name.
    expect(element).toContain('nodes={nodes}')
  })

  it('threads the VALUE, so the outline can read the preference', () => {
    expect(element).toContain('expertMode={expertMode}')
  })

  it('⭐ threads the SETTER, so the in-tab control can write it', () => {
    // The half that is easy to drop and impossible to notice: without it the
    // panel is uncontrolled and the second switch silently returns.
    expect(element).toContain('onToggleExpert={setExpertMode}')
  })

  it('CONTRAST CONTROL: the matcher REDs on an element missing the setter', () => {
    // Proves the three assertions above are discriminating rather than matching
    // something incidental in a 3,900-line file. A guard that cannot fail is
    // not evidence.
    const withoutSetter = '<ModelTabBody nodes={nodes} expertMode={expertMode} />'
    expect(modelTabBodyElement(withoutSetter)).toContain('expertMode={expertMode}')
    expect(modelTabBodyElement(withoutSetter)).not.toContain('onToggleExpert={setExpertMode}')
  })
})
