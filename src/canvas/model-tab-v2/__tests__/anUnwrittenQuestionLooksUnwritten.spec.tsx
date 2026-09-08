/**
 * A node still carrying its type's default name is presented as a prompt, not
 * as a name somebody chose.
 *
 * ── THE WITNESSED DEFECT (Paul, deployed `a9c2e050`, 5 Sep 2026) ───────────
 * The Goal group held a row reading **Question** beside what looked like an
 * empty checkbox. Both halves are real and neither is a bug on its own:
 *   · `Question` is `DECISION_NODE_LABEL` (`domain/vocabulary.ts:41`), and that
 *     constant's own doc argues it "reads honestly when empty: a node labelled
 *     'Question' invites the user to write theirs".
 *   · The "checkbox" is `'□'`, the decision KIND GLYPH (`rowPresentation.ts`).
 *
 * The defect is the PRESENTATION. The word is rendered in `text-text-body`,
 * in the identity column, in exactly the treatment every user-authored label
 * gets — so nothing distinguishes "you have not written this yet" from "someone
 * named this node Question". The invitation the constant relies on is invisible
 * because the row does not draw it as an invitation.
 *
 * ── SO THE FIX IS NOT A RENAME ─────────────────────────────────────────────
 * The vocabulary decision is ratified and argued at length; changing the word
 * would reopen it for no reason. What changes is that a placeholder is drawn
 * like one — muted, and named as unwritten for assistive tech — which is what
 * the constant already claims happens.
 *
 * The estate has this exact guard elsewhere and it is not on this path:
 * `utils/ghostTiers.ts:302` refuses a label equal to the unnamed fallback,
 * because "'Untitled' is not a name a user typed".
 */
import '@testing-library/jest-dom/vitest'
import { describe, expect, it, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { ModelRowView } from '../ModelRowView'
import { DECISION_NODE_LABEL } from '../../domain/vocabulary'
import type { ModelRow } from '../types'

const ROW: ModelRow = {
  id: 'd1',
  kind: 'decision',
  group: 'goal',
  label: DECISION_NODE_LABEL,
  primaryValue: null,
  attention: [],
  editable: false,
}

function renderRow(over: Partial<ModelRow> = {}) {
  cleanup()
  render(
    <ul>
      <ModelRowView tier="plain" row={{ ...ROW, ...over }} onSelect={vi.fn()} onFocusOnCanvas={vi.fn()} />
    </ul>,
  )
  return screen.getByTestId('model-row-v2-d1-label')
}

describe('an unwritten question looks unwritten', () => {
  it('CONTROL: a real label renders in the ordinary body colour', () => {
    // Without this the assertions below could pass by every label being muted,
    // which would be a worse defect than the one being fixed.
    const label = renderRow({ label: 'Replace the CDP within budget' })
    expect(label.className).toContain('text-text-body')
    expect(label.className).not.toContain('text-text-light')
  })

  it('the default name is muted, not drawn as an authored one', () => {
    const label = renderRow()
    expect(label.className, 'a placeholder styled as a name').toContain('text-text-light')
    expect(label.className).not.toContain('text-text-body')
  })

  it('the word itself is unchanged — this is not a rename', () => {
    // The vocabulary decision is ratified and argued in `vocabulary.ts:20-40`.
    // Changing the string would reopen it; this only changes how it is drawn.
    expect(renderRow()).toHaveTextContent(DECISION_NODE_LABEL)
  })

  it('assistive tech is told it is unwritten, not just shown grey', () => {
    // Colour is one channel and it is the one a screen reader cannot use.
    const label = renderRow()
    expect(label.getAttribute('title') ?? '').toMatch(/not written|yet/i)
  })

  it('DISCRIMINATOR: a decision node the user HAS named is left alone', () => {
    // The load-bearing case. Muting by KIND rather than by the placeholder
    // value would grey out every named question on the surface.
    const label = renderRow({ label: 'Which CDP do we move to?' })
    expect(label.className).toContain('text-text-body')
    expect(label.getAttribute('title')).toBe('Which CDP do we move to?')
  })
})
