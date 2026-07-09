/**
 * Claim-integrity check (ROADMAP 1.51b) — src/styles/brand.css:71's comment
 * previously claimed --info (#52A3C8) was "Updated ... for WCAG AA 3:1"
 * contrast on white. That claim is false: #52A3C8 on white computes to a
 * 2.83:1 contrast ratio (WCAG relative-luminance formula), which FAILS the
 * 3:1 UI-component threshold. This test asserts the comment states the
 * truth instead of the false compliance claim. The colour itself is
 * deliberately NOT changed here — that's a product colour decision
 * (tracked separately in ROADMAP 1.51) — only the comment's claim.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

describe('brand.css --info comment claim integrity (1.51b)', () => {
  const css = readFileSync(join(__dirname, '../brand.css'), 'utf-8')

  it('does NOT claim #52A3C8 meets WCAG AA 3:1', () => {
    // The false claim asserted compliance ("Updated ... for WCAG AA 3:1").
    // Any comment near --info must not repeat that pass/compliance claim.
    expect(css).not.toMatch(/Updated to #52A3C8 for WCAG AA 3:1/)
  })

  it('states the true contrast ratio (2.83:1) and that it fails the 3:1 threshold', () => {
    const infoCommentMatch = css.match(/\/\*\s*Info[\s\S]{0,400}?\*\//)
    expect(infoCommentMatch).not.toBeNull()
    const infoComment = infoCommentMatch![0]
    expect(infoComment).toMatch(/fails WCAG AA 3:1/i)
    expect(infoComment).toContain('2.83:1')
    expect(infoComment).toMatch(/ROADMAP 1\.51/)
  })
})
