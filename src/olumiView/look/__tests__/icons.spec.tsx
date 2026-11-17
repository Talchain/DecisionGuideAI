/**
 * The icon registry (Paul, 17 Nov): colours only from brand.css, one Lucide icon per meaning, every icon-only entry has hover words, and
 * the press is labelled and titled with them.
 */
import { describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { render, screen, fireEvent } from '@testing-library/react'
import { Check, Plus, Trash2 } from 'lucide-react'
import { ICONS, OkIcon, OkIconButton, duplicateIconIds, type IconEntry, type IconId } from '../icons'

const brand = readFileSync(path.resolve('src/styles/brand.css'), 'utf8')
const defined = new Set([...brand.matchAll(/(--[a-z0-9-]+)\s*:/gi)].map((m) => m[1]!))
const entries = Object.entries(ICONS) as [IconId, IconEntry][]

describe('the icon registry', () => {
  it('has entries', () => {
    expect(entries.length).toBeGreaterThan(90)
  })

  it('names only colour tokens that exist in brand.css (no new colours)', () => {
    const named = entries.flatMap(([id, e]) => [e.colour, e.activeColour, e.hoverColour, e.fill].filter(Boolean).map((t) => [id, t as string] as const))
    expect(named.length).toBeGreaterThan(entries.length)
    expect(named.filter(([, t]) => !/^--[a-z0-9-]+$/.test(t) || !defined.has(t))).toEqual([])
  })

  it('draws no icon for two meanings: no Lucide icon is used by two ids (or twice in one)', () => {
    expect(duplicateIconIds(ICONS)).toEqual([])
  })

  it('the duplicate check fails when two ids share an icon (local example)', () => {
    expect(duplicateIconIds({ a: { Icon: Check }, b: { Icon: Check } })).toEqual(['a', 'b'])
    expect(duplicateIconIds({ a: { Icon: Plus }, b: { Icon: Trash2, alt: Plus } })).toEqual(['a', 'b'])
    expect(duplicateIconIds({ a: { Icon: Plus }, b: { Icon: Trash2 } })).toEqual([])
  })

  it('every entry has hover words, and an icon-only entry has non-empty ones', () => {
    for (const [id, e] of entries) {
      expect(e.hover.trim().length, id).toBeGreaterThan(0)
      expect(['icon-only', 'icon-plus-word'], id).toContain(e.mode)
    }
    expect(entries.filter(([, e]) => e.mode === 'icon-only').length).toBeGreaterThan(40)
  })

  it('keeps core words visible where the design flagged them', () => {
    for (const id of ['info-more', 'olumi-mark', 'goal', 'olumi-contributes', 'risk-if-failed', 'lenses', 'move-tap'] as IconId[]) {
      expect(ICONS[id].keepWords, id).toBeTruthy()
    }
    expect(ICONS.goal.mode).toBe('icon-plus-word')
  })

  it("the person's filled actions are green (--success family) with an --text-header label, and blue is not on the person's acts", () => {
    for (const id of ['send', 'approve', 'review-changes', 'move-tap'] as IconId[]) {
      expect(ICONS[id].fill, id).toBe('--success')
      expect(ICONS[id].colour, id).toBe('--text-header')
    }
    for (const [id, e] of entries.filter(([, x]) => x.group === 'person-action')) {
      expect([e.colour, e.fill, e.hoverColour].filter((t) => t === '--info' || t === '--info-ink'), id).toEqual([])
    }
  })
})

describe('icons carry no hue (Paul, 17 Nov: "so far, we\'ve only had non-coloured icons. If we keep them non-coloured, that\'s one less thing that\'s busy")', () => {
  const GREYS = new Set(['--text-light', '--text-body', '--text-header', '--border-default'])
  // Colour stays only where it is the meaning: Olumi's own mark, a failure or warning, a kind's own shape, and a filled person's act.
  const HUED = new Set(['olumi-mark', 'delete', 'went-wrong', 'save-failed', 'unsaved', 'stale-analysis', 'limit-tag', 'band-kind-shapes'])
  it('N1 every unfilled icon draws a grey at rest and when active; CONTRAST: the named exceptions keep their token', () => {
    const hued = entries.filter(([id, e]) => !e.fill && (!GREYS.has(e.colour) || (e.activeColour !== undefined && !GREYS.has(e.activeColour))) && !HUED.has(id)).map(([id]) => id)
    expect(hued).toEqual([])
    expect([ICONS.delete.colour, ICONS['olumi-mark'].colour, ICONS.unsaved.colour]).toEqual(['--danger', '--info', '--warning'])
    expect([ICONS.goal.colour, ICONS['method-challenge'].colour, ICONS['idea-keep'].colour]).toEqual(['--text-light', '--text-light', '--text-light'])
  })
})

describe('OkIcon and OkIconButton', () => {
  it('an icon-only OkIcon is an image labelled and titled with the hover words, in its token colour', () => {
    render(<OkIcon id="delete" />)
    const img = screen.getByRole('img', { name: ICONS.delete.hover })
    expect(img.getAttribute('title')).toBe(ICONS.delete.hover)
    expect(img.style.color).toBe('var(--danger)')
  })

  it("core's own words win over the registry's hover", () => {
    render(<OkIcon id="olumi-mark" words="Olumi, from core" />)
    expect(screen.getByRole('img', { name: 'Olumi, from core' }).getAttribute('title')).toBe('Olumi, from core')
  })

  it('beside words an icon is hidden from assistive tech', () => {
    const { container } = render(<OkIcon id="approve" />)
    expect(screen.queryByRole('img')).toBeNull()
    expect(container.querySelector('[aria-hidden="true"]')).not.toBeNull()
  })

  it('OkIconButton renders aria-label and title with the hover words, a 44 px hit area, and presses', () => {
    const onClick = vi.fn()
    render(<OkIconButton id="set-aside" onClick={onClick} testid="aside" />)
    const btn = screen.getByTestId('aside')
    expect(btn.getAttribute('aria-label')).toBe(ICONS['set-aside'].hover)
    expect(btn.getAttribute('title')).toBe(ICONS['set-aside'].hover)
    expect(btn.className).toContain('after:h-11')
    fireEvent.click(btn)
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('OkIconButton takes core\'s words as its label and title, and a disabled press does not fire', () => {
    const onClick = vi.fn()
    render(<OkIconButton id="send" onClick={onClick} words="Send it" disabled />)
    const btn = screen.getByRole('button', { name: 'Send it' })
    expect(btn.getAttribute('title')).toBe('Send it')
    fireEvent.click(btn)
    expect(onClick).not.toHaveBeenCalled()
  })
})
