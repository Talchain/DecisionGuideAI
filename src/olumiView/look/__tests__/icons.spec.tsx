/**
 * The icon registry (Paul, 17 Nov): colours only from brand.css, one Lucide icon per meaning, every icon-only entry has hover words, and
 * the press is labelled and titled with them.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { act, cleanup, createEvent, render, screen, fireEvent } from '@testing-library/react'
import { Check, Plus, Trash2 } from 'lucide-react'
import { TIP_DELAY } from '../Tip'
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
  const HUED = new Set(['olumi-mark', 'delete', 'went-wrong', 'save-failed', 'unsaved', 'stale-analysis', 'challenged', 'worth-checking', 'limit-tag', 'band-kind-shapes'])
  it('N1 every unfilled icon draws a grey at rest and when active; CONTRAST: the named exceptions keep their token', () => {
    const hued = entries.filter(([id, e]) => !e.fill && (!GREYS.has(e.colour) || (e.activeColour !== undefined && !GREYS.has(e.activeColour))) && !HUED.has(id)).map(([id]) => id)
    expect(hued).toEqual([])
    expect([ICONS.delete.colour, ICONS['olumi-mark'].colour, ICONS.unsaved.colour]).toEqual(['--danger', '--info', '--warning'])
    expect([ICONS.goal.colour, ICONS['method-challenge'].colour, ICONS['idea-keep'].colour]).toEqual(['--text-light', '--text-light', '--text-light'])
    // A card's challenge keeps the board's challenge colour and Olumi's own observation Olumi's blue; a plain state mark beside them stays grey.
    expect([ICONS.challenged.colour, ICONS['worth-checking'].colour, ICONS['feeds-no-result'].colour, ICONS['set-aside'].colour]).toEqual(['--olumi-mark-orange', '--info', '--text-light', '--text-light'])
  })
})

afterEach(() => { cleanup(); vi.useRealTimers() })

describe('OkIcon and OkIconButton', () => {
  it('a button\'s words open the one Tip on REAL keyboard focus after 150 ms, close on Escape, and a press closes it', () => {
    vi.useFakeTimers()
    render(<OkIconButton id="set-aside" testid="kb" onClick={() => {}} />)
    const btn = screen.getByTestId('kb')
    act(() => { btn.focus() })
    expect(document.activeElement).toBe(btn)
    act(() => { vi.advanceTimersByTime(TIP_DELAY - 1) })
    expect(screen.queryByRole('tooltip'), 'not before 150 ms').toBeNull()
    act(() => { vi.advanceTimersByTime(1) })
    expect(screen.getByRole('tooltip').textContent).toBe(ICONS['set-aside'].hover)
    fireEvent.keyDown(btn, { key: 'Escape' })
    expect(screen.queryByRole('tooltip')).toBeNull()
    act(() => { btn.blur(); btn.focus() })
    act(() => { vi.advanceTimersByTime(TIP_DELAY) })
    expect(screen.getByRole('tooltip')).not.toBeNull()
    fireEvent.click(btn)
    expect(screen.queryByRole('tooltip')).toBeNull()
  })

  it('pointer and focus are tracked apart: leaving while focused keeps the tip, blurring while hovered keeps it, and it closes when neither is left', () => {
    vi.useFakeTimers()
    render(<OkIconButton id="set-aside" testid="both" onClick={() => {}} />)
    const btn = screen.getByTestId('both')
    fireEvent.pointerEnter(btn)
    act(() => { btn.focus() })
    act(() => { vi.advanceTimersByTime(TIP_DELAY) })
    expect(screen.getByRole('tooltip')).not.toBeNull()
    fireEvent.pointerLeave(btn)
    expect(screen.queryByRole('tooltip'), 'focus still holds it').not.toBeNull()
    act(() => { btn.blur() })
    expect(screen.queryByRole('tooltip'), 'neither left: gone').toBeNull()
    fireEvent.pointerEnter(btn)
    act(() => { btn.focus(); vi.advanceTimersByTime(TIP_DELAY) })
    act(() => { btn.blur() })
    expect(screen.queryByRole('tooltip'), 'the pointer still holds it').not.toBeNull()
    fireEvent.pointerLeave(btn)
    expect(screen.queryByRole('tooltip')).toBeNull()
  })

  it('an open tip is dismissed by a scroll or a resize (its anchor moved), and a touch pointer opens none', () => {
    vi.useFakeTimers()
    render(<OkIconButton id="set-aside" testid="sc" onClick={() => {}} />)
    const btn = screen.getByTestId('sc')
    for (const fire of [() => window.dispatchEvent(new Event('scroll')), () => window.dispatchEvent(new Event('resize'))]) {
      fireEvent.pointerEnter(btn)
      act(() => { vi.advanceTimersByTime(TIP_DELAY) })
      expect(screen.getByRole('tooltip')).not.toBeNull()
      act(() => { fire() })
      expect(screen.queryByRole('tooltip')).toBeNull()
      fireEvent.pointerLeave(btn)
    }
    // jsdom drops pointerType from the init dict, so set it on the event itself.
    const touch = createEvent.pointerEnter(btn)
    Object.defineProperty(touch, 'pointerType', { value: 'touch' })
    fireEvent(btn, touch)
    act(() => { vi.advanceTimersByTime(TIP_DELAY) })
    expect(screen.queryByRole('tooltip')).toBeNull()
  })

  it('a hover that differs from the name is the tip and its description; the name stays the aria-label', () => {
    vi.useFakeTimers()
    render(<OkIconButton id="popout" words="Open Olumi" hover="Open in floating window" testid="d" onClick={() => {}} />)
    const btn = screen.getByTestId('d')
    expect([btn.getAttribute('aria-label'), btn.getAttribute('title'), btn.getAttribute('aria-describedby')]).toEqual(['Open Olumi', null, null])
    fireEvent.pointerEnter(btn)
    act(() => { vi.advanceTimersByTime(TIP_DELAY) })
    const tip = screen.getByRole('tooltip')
    expect([tip.textContent, btn.getAttribute('aria-describedby')]).toEqual(['Open in floating window', tip.id])
  })

  it('a held button is aria-disabled, stays a keyboard stop, shows its reason, and a press does nothing', () => {
    vi.useFakeTimers()
    const onClick = vi.fn()
    render(<OkIconButton id="approve" words="Approve these changes" hover="Waiting for Olumi to finish" disabled testid="h" onClick={onClick} />)
    const btn = screen.getByTestId('h')
    expect([btn.getAttribute('aria-disabled'), btn.hasAttribute('disabled')]).toEqual(['true', false])
    act(() => { btn.focus() })
    expect(document.activeElement).toBe(btn)
    act(() => { vi.advanceTimersByTime(TIP_DELAY) })
    expect(screen.getByRole('tooltip').textContent).toBe('Waiting for Olumi to finish')
    fireEvent.click(btn)
    expect(onClick).not.toHaveBeenCalled()
  })

  it('a standalone icon is a keyboard stop that shows its words on focus; inside a control it is not (no nested focus targets), and focusable={false} drops it', () => {
    vi.useFakeTimers()
    const { container } = render(<><OkIcon id="delete" testid="solo" /><button type="button"><OkIcon id="delete" testid="inside" /></button><OkIcon id="delete" focusable={false} testid="off" /></>)
    const get = (t: string) => container.querySelector<HTMLElement>(`[data-testid="${t}"]`)!
    expect([get('solo').getAttribute('tabindex'), get('inside').getAttribute('tabindex'), get('off').getAttribute('tabindex')]).toEqual(['0', null, null])
    act(() => { get('solo').focus() })
    expect(document.activeElement).toBe(get('solo'))
    act(() => { vi.advanceTimersByTime(TIP_DELAY) })
    const tip = screen.getByRole('tooltip')
    expect([tip.textContent, get('solo').getAttribute('aria-describedby')]).toEqual([ICONS.delete.hover, tip.id])
  })

  it('an icon-only OkIcon is an image named by the hover words (aria-label, no native title), in its token colour; its words show through the one Tip', () => {
    vi.useFakeTimers()
    render(<OkIcon id="delete" />)
    const img = screen.getByRole('img', { name: ICONS.delete.hover })
    expect(img.getAttribute('title')).toBeNull()
    expect(screen.queryByRole('tooltip')).toBeNull()
    fireEvent.pointerEnter(img)
    act(() => { vi.advanceTimersByTime(TIP_DELAY - 1) })
    expect(screen.queryByRole('tooltip'), 'not before 150 ms').toBeNull()
    act(() => { vi.advanceTimersByTime(1) })
    expect(screen.getByRole('tooltip').textContent).toBe(ICONS.delete.hover)
    fireEvent.pointerLeave(img)
    expect(screen.queryByRole('tooltip'), 'gone at once on leave').toBeNull()
    vi.useRealTimers()
    expect(img.className.split(/\s+/)).toContain('text-danger')
  })

  it("core's own words win over the registry's hover", () => {
    render(<OkIcon id="olumi-mark" words="Olumi, from core" />)
    expect(screen.getByRole('img', { name: 'Olumi, from core' }).getAttribute('title')).toBeNull()
  })

  it('beside words an icon is hidden from assistive tech', () => {
    const { container } = render(<OkIcon id="approve" />)
    expect(screen.queryByRole('img')).toBeNull()
    expect(container.querySelector('[aria-hidden="true"]')).not.toBeNull()
  })

  it('Set aside and Open in floating window are two different pictures, each with an accessible name (Olumi tab panel rank 6)', () => {
    const { container } = render(<><OkIconButton id="set-aside" testid="a" onClick={() => {}} /><OkIconButton id="popout" testid="p" onClick={() => {}} /></>)
    const glyph = (t: string) => container.querySelector(`[data-testid="${t}"] svg`)!.getAttribute('class')!.split(/\s+/).find((c) => c.startsWith('lucide-') && c !== 'lucide')
    expect([glyph('a'), glyph('p')]).toEqual(['lucide-ban', 'lucide-panel-top-open'])
    expect([screen.getByTestId('a').getAttribute('aria-label'), screen.getByTestId('p').getAttribute('aria-label')]).toEqual(['Set aside', 'Open in floating window'])
    // CONTRAST: neither glyph is the other's alternative, so no state of one can draw the other.
    expect([ICONS['set-aside'].alt, ICONS.popout.alt === ICONS['set-aside'].Icon]).toEqual([undefined, false])
  })

  it('OkIconButton renders its hover words as aria-label (no native title), a 44 px hit area, shows them through the Tip on keyboard focus, and presses', () => {
    const onClick = vi.fn()
    render(<OkIconButton id="set-aside" onClick={onClick} testid="aside" />)
    const btn = screen.getByTestId('aside')
    expect(btn.getAttribute('aria-label')).toBe(ICONS['set-aside'].hover)
    expect(btn.getAttribute('title')).toBeNull()
    expect(btn.className).toContain('after:h-11')
    fireEvent.click(btn)
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('a disabled ghost icon button looks disabled: the disabled colour is a class that wins, and no colour is inline (18 Nov)', () => {
    for (const tone of ['ghost', undefined] as const) {
      const { container, unmount } = render(<OkIconButton id="cancel-close" tone={tone} words="Set aside" onClick={() => undefined} disabled testid="d" />)
      const btn = container.querySelector<HTMLButtonElement>('[data-testid="d"]')!
      expect(btn.getAttribute('aria-disabled')).toBe('true')
      expect(btn.className.split(/\s+/), `tone ${String(tone)}`).toContain('disabled:text-text-light')
      expect(btn.getAttribute('style'), 'no inline colour').toBeNull()
      unmount()
    }
  })

  it('every registry icon draws its colour as a class, never inline (identity: challenged is the orange, set-aside the grey)', () => {
    for (const [id] of entries) {
      const { container, unmount } = render(<OkIcon id={id} />)
      const el = container.firstElementChild as HTMLElement
      expect(el.getAttribute('style'), id).toBeNull()
      expect(el.className, id).toMatch(/(^|\s)text-/)
      unmount()
    }
    const challenged = render(<OkIcon id="challenged" />).container.firstElementChild as HTMLElement
    expect(challenged.className).toContain('--olumi-mark-orange')
    const aside = render(<OkIcon id="set-aside" />).container.firstElementChild as HTMLElement
    expect(aside.className.split(/\s+/)).toContain('text-text-light')
  })

  it('OkIconButton takes core\'s words as its label and title, and a disabled press does not fire', () => {
    const onClick = vi.fn()
    render(<OkIconButton id="send" onClick={onClick} words="Send it" disabled />)
    const btn = screen.getByRole('button', { name: 'Send it' })
    expect(btn.getAttribute('title')).toBeNull()
    fireEvent.click(btn)
    expect(onClick).not.toHaveBeenCalled()
  })
})
