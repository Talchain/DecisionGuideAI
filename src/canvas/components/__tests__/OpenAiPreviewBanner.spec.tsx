/**
 * The banner renders exactly when the transport is redirected — never on its
 * own judgement. Full reasoning in `../OpenAiPreviewBanner.tsx`.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render } from '@testing-library/react'
import { OpenAiPreviewBanner, OPENAI_PREVIEW_BANNER_TESTID } from '../OpenAiPreviewBanner'
import {
  OPENAI_PREVIEW_STORAGE_KEY,
  OPENAI_PREVIEW_ENDPOINT_STORAGE_KEY,
  OPENAI_PREVIEW_BANNER,
} from '../../../v5/openAiPreview'

const AGENT = 'https://agent.example.test/agent/v1/turn'
const clear = () => {
  localStorage.removeItem(OPENAI_PREVIEW_STORAGE_KEY)
  localStorage.removeItem(OPENAI_PREVIEW_ENDPOINT_STORAGE_KEY)
}

describe('OpenAiPreviewBanner', () => {
  beforeEach(clear)
  afterEach(clear)

  it('renders NOTHING in the ordinary product', () => {
    const { container } = render(<OpenAiPreviewBanner />)
    expect(container.querySelector(`[data-testid="${OPENAI_PREVIEW_BANNER_TESTID}"]`)).toBeNull()
    expect(container.textContent).toBe('')
  })

  it('renders nothing on a half-flipped flag', () => {
    localStorage.setItem(OPENAI_PREVIEW_STORAGE_KEY, '1')
    const { container } = render(<OpenAiPreviewBanner />)
    expect(container.textContent).toBe('')
  })

  it('CONTRAST CONTROL — states the fact when the preview is live', () => {
    localStorage.setItem(OPENAI_PREVIEW_STORAGE_KEY, '1')
    localStorage.setItem(OPENAI_PREVIEW_ENDPOINT_STORAGE_KEY, AGENT)
    const { container } = render(<OpenAiPreviewBanner />)
    const el = container.querySelector(`[data-testid="${OPENAI_PREVIEW_BANNER_TESTID}"]`)
    expect(el).not.toBeNull()
    expect(el?.textContent).toBe(OPENAI_PREVIEW_BANNER)
  })

  it('⛔ offers NO affordance — not even a dismiss', () => {
    // "no UI affordance should imply edits will persist", and a dismissible
    // banner is not persistent. Bound structurally so a future "×" REDs.
    localStorage.setItem(OPENAI_PREVIEW_STORAGE_KEY, '1')
    localStorage.setItem(OPENAI_PREVIEW_ENDPOINT_STORAGE_KEY, AGENT)
    const { container } = render(<OpenAiPreviewBanner />)
    const el = container.querySelector(`[data-testid="${OPENAI_PREVIEW_BANNER_TESTID}"]`)!
    expect(el.querySelectorAll('button,a,input,[role="button"]').length).toBe(0)
  })

  it('announces itself to assistive tech without stealing focus', () => {
    localStorage.setItem(OPENAI_PREVIEW_STORAGE_KEY, '1')
    localStorage.setItem(OPENAI_PREVIEW_ENDPOINT_STORAGE_KEY, AGENT)
    const { container } = render(<OpenAiPreviewBanner />)
    expect(
      container.querySelector(`[data-testid="${OPENAI_PREVIEW_BANNER_TESTID}"]`)?.getAttribute('role'),
    ).toBe('status')
  })
})
