/**
 * ⭐ THE TWO ASK REGISTERS ARE A MIRROR, SO THE MIRROR IS MADE TO FAIL LOUD.
 *
 * `ASK_TEMPLATES` (pronoun) and `ASK_TEMPLATES_NAMED` (spells the element) are
 * two hand-written tables of the same keys — CLAUDE.md trap 12's dominant defect
 * shape. Every assertion below DERIVES its expectation from the objects
 * themselves rather than restating a key list, so a key added to one table alone
 * REDs here instead of reaching a user as a silently missing affordance (the
 * resolver returns null for an unknown key, and the caller hides the button).
 *
 * ⚠ These check AGREEMENT between the copies. They cannot check that the key set
 * is COMPLETE — that is the register's second face, and it belongs to the panel
 * types themselves, not here.
 */

import { describe, it, expect } from 'vitest'
import { ASK_TEMPLATES, ASK_TEMPLATES_NAMED, resolveAskTemplate } from '../inspectorStrings'

/** The one key whose two registers are deliberately identical. */
const LABELLESS_KEY = 'edge'

describe('ask registers · the pronoun and named tables stay a matched pair', () => {
  it('carries exactly the same keys in both registers', () => {
    expect(Object.keys(ASK_TEMPLATES_NAMED).sort()).toEqual(Object.keys(ASK_TEMPLATES).sort())
  })

  it('every named template except the labelless one spells {label}', () => {
    const missing = Object.entries(ASK_TEMPLATES_NAMED)
      .filter(([key]) => key !== LABELLESS_KEY)
      .filter(([, template]) => !template.includes('{label}'))
      .map(([key]) => key)
    expect(missing).toEqual([])
    // Positive control: the probe can see a template that lacks {label}, so the
    // empty result above is a real absence rather than a blind query.
    expect(ASK_TEMPLATES_NAMED[LABELLESS_KEY]).not.toContain('{label}')
  })

  it('no pronoun template spells {label}', () => {
    const naming = Object.entries(ASK_TEMPLATES)
      .filter(([, template]) => template.includes('{label}'))
      .map(([key]) => key)
    expect(naming).toEqual([])
  })

  it('the labelless key is byte-identical in both registers', () => {
    // An edge has no name of its own, so there is nothing to switch — and if
    // one copy is ever edited alone, the two ask affordances would describe the
    // same relationship differently.
    expect(ASK_TEMPLATES_NAMED[LABELLESS_KEY]).toBe(ASK_TEMPLATES[LABELLESS_KEY])
  })

  it('the resolver reads the register the caller asks for, key by key', () => {
    const context = { label: 'Marketing Budget', sourceLabel: 'A', targetLabel: 'B' }
    for (const key of Object.keys(ASK_TEMPLATES)) {
      expect(resolveAskTemplate(key, context, { nameElement: false })).toBe(
        resolveAskTemplate(key, context, { nameElement: false }),
      )
      const pronoun = resolveAskTemplate(key, context, { nameElement: false })
      const named = resolveAskTemplate(key, context, { nameElement: true })
      expect(pronoun).not.toBeNull()
      expect(named).not.toBeNull()
      if (key === LABELLESS_KEY) {
        expect(named).toBe(pronoun)
      } else {
        expect(named).toContain(context.label)
        expect(pronoun).not.toContain(context.label)
      }
    }
  })

  it('defaults to NAMING the element when the caller says nothing', () => {
    // Fail closed: a caller that has not considered the on-screen referent gets
    // the verbose form, never an unresolved pronoun.
    expect(resolveAskTemplate('outcome', { label: 'Churn' })).toContain('Churn')
  })
})
