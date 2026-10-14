/**
 * P05b r3: unlike the stored-read replays, this supplies the missing flex
 * geometry. A +N in the row compresses the marks enough to change overflow.
 * The original layout effect alternates +N / no +N until React's depth limit.
 */
import { Profiler } from 'react'
import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BottomCardMark, BottomMarksBand, BottomMarksProvider } from '../CardMark'

const labels = ['From your brief', 'Unfinished — not included in analysis.', 'Likelihood and impact not set yet', 'Needs review', 'Key driver', 'Working assumption']
let bandWidth = 64
let moreWidth = 24
let borderline = false
const resizeObservers: { callback: ResizeObserverCallback; targets: Set<Element> }[] = []
const mutationObservers: { callback: MutationCallback; targets: Set<Node> }[] = []

beforeEach(() => {
  bandWidth = 64
  moreWidth = 24
  borderline = false
  resizeObservers.length = 0
  mutationObservers.length = 0
  vi.stubGlobal('ResizeObserver', class {
    targets = new Set<Element>()
    constructor(callback: ResizeObserverCallback) { resizeObservers.push({ callback, targets: this.targets }) }
    observe(target: Element) { this.targets.add(target) }
    unobserve(target: Element) { this.targets.delete(target) }
    disconnect() { this.targets.clear() }
  })
  vi.stubGlobal('MutationObserver', class {
    targets = new Set<Node>()
    constructor(callback: MutationCallback) { mutationObservers.push({ callback, targets: this.targets }) }
    observe(target: Node) { this.targets.add(target) }
    disconnect() { this.targets.clear() }
    takeRecords() { return [] }
  })
  vi.spyOn(window, 'getComputedStyle').mockImplementation(() => ({
    columnGap: '4px',
    getPropertyValue: (property: string) => property === 'column-gap' ? '4px' : '',
  }) as CSSStyleDeclaration)
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(function (this: HTMLElement) {
    return this.hasAttribute('data-card-bottom-band') ? bandWidth : 0
  })
  // The probe is absolute, and a temporarily hidden +N has no flex effect.
  const compressed = (mark: HTMLElement) => borderline && Array.from(mark.parentElement?.children ?? []).some(child =>
    child instanceof HTMLElement && child.getAttribute('data-card-mark') === 'more' &&
    child.style.position !== 'absolute' && child.style.display !== 'none')
  vi.spyOn(HTMLElement.prototype, 'offsetLeft', 'get').mockImplementation(function (this: HTMLElement) {
    const index = this.getAttribute('data-band-test-index')
    return index === null ? 0 : Number(index) * (compressed(this) ? 20 : 24)
  })
  vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockImplementation(function (this: HTMLElement) {
    if (this.getAttribute('data-card-mark') === 'more' || this.hasAttribute('data-band-more-measure')) return moreWidth
    return this.hasAttribute('data-band-test-index') ? (compressed(this) ? 16 : 20) : 0
  })
})

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals() })

function observe(band: HTMLElement, kind: 'resize' | 'mutation', addedNodes: Node[] = [], removedNodes: Node[] = []) {
  act(() => {
    if (kind === 'resize') {
      for (const observer of [...resizeObservers]) {
        if (observer.targets.has(band)) observer.callback([], {} as ResizeObserver)
      }
    } else {
      const record = { type: 'childList', target: band, addedNodes, removedNodes } as unknown as MutationRecord
      for (const observer of [...mutationObservers]) {
        if (observer.targets.has(band)) observer.callback([record], {} as MutationObserver)
      }
    }
  })
}

function mountBand(count: number, onCommit: () => void = () => {}) {
  const view = render(<Profiler id="bottom-marks" onRender={onCommit}>
    <BottomMarksProvider>
      <BottomMarksBand nodeId="borderline" nodeType="risk" />
      {labels.slice(0, count).map((label, index) => <BottomCardMark key={label}>
        <span data-testid={`natural-mark-${index}`} data-band-test-index={index} aria-label={index % 2 === 0 ? label : undefined}>
          <span aria-label={label} />
        </span>
      </BottomCardMark>)}
    </BottomMarksProvider>
  </Profiler>)
  const band = screen.getByTestId('risk-bottom-marks-borderline')
  // Deliver the portal child-list change explicitly, as jsdom has no layout.
  observe(band, 'mutation', Array.from(band.querySelectorAll('[data-band-test-index]')))
  return { ...view, band }
}

function expectLabels(firstHidden: number, count: number) {
  for (let index = 0; index < count; index++) {
    expect(screen.getByTestId(`natural-mark-${index}`).hasAttribute('data-band-overflow')).toBe(index >= firstHidden)
  }
  const more = screen.getByTestId('risk-bottom-marks-more-borderline')
  expect(more).toHaveTextContent(`+${count - firstHidden}`)
  expect(more).toHaveAttribute('aria-label', `${count - firstHidden} more: ${labels.slice(firstHidden, count).join('; ')}`)
  return more
}

describe('BottomMarksBand #185 fixed point', () => {
  it('ROW 1: borderline flex geometry converges in <=6 commits and mounts +N once', () => {
    borderline = true
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {})
    let commits = 0
    const elements = new Set<Element>()
    const presence: boolean[] = []
    const onCommit = () => {
      commits += 1
      const more = document.querySelector('[data-testid="risk-bottom-marks-more-borderline"]')
      presence.push(more !== null)
      if (more) elements.add(more)
    }
    try {
      const { band } = mountBand(3, onCommit)
      const more = expectLabels(1, 3)
      const settledCommits = commits
      expect(settledCommits).toBeLessThanOrEqual(6)
      // External deliveries must still see the same natural mark layout;
      // merely deleting the effect dependency would not pass these checks.
      for (let pass = 0; pass < 12; pass++) {
        observe(band, 'resize')
        observe(band, 'mutation', [screen.getByTestId('natural-mark-2')])
        observe(band, 'mutation', [more])
        expect(expectLabels(1, 3)).toBe(more)
      }
      expect(commits - settledCommits).toBeLessThanOrEqual(1)
      expect(elements.size).toBe(1)
      expect(presence.slice(presence.indexOf(true)).every(Boolean)).toBe(true)
      expect(errors.mock.calls.filter(args => /Maximum update depth|#185/.test(args.map(String).join(' ')))).toEqual([])
    } finally {
      const flips = presence.slice(1).filter((present, index) => present !== presence[index]).length
      console.info(`[crash185c] borderline: commits=${commits}; moreMounts=${elements.size}; presenceFlips=${flips}`)
    }
  })

  it('ROW 2: non-borderline overflow retains the same four labels with a measured 32px +N', () => {
    bandWidth = 100
    moreWidth = 32
    const { band } = mountBand(6)
    const more = expectLabels(2, 6)
    observe(band, 'resize')
    expect(expectLabels(2, 6)).toBe(more)
    console.info(`[crash185c] non-borderline: ${more.getAttribute('aria-label')}`)
  })

  it('ROW 3: no overflow shows no +N, including after widening an overflowing band', () => {
    bandWidth = 100
    const first = mountBand(3)
    expect(first.band.querySelector('[data-band-overflow]')).toBeNull()
    expect(screen.queryByTestId('risk-bottom-marks-more-borderline')).toBeNull()
    first.unmount()
    const { band } = mountBand(6)
    expectLabels(3, 6)
    bandWidth = 200
    observe(band, 'resize')
    expect(band.querySelector('[data-band-overflow]')).toBeNull()
    expect(screen.queryByTestId('risk-bottom-marks-more-borderline')).toBeNull()
    console.info('[crash185c] no overflow: all marks visible; +N absent')
  })
})
