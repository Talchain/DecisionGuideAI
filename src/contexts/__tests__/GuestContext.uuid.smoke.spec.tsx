/**
 * F14 (Codex): uuid direct dep raised 9.0.1 → 11.1.1 (GHSA-w5hq-g745-h8pq).
 *
 * The v9→v11 major bump keeps the v4 named-export API, but ESM/interop of the
 * `import { v4 as uuidv4 } from 'uuid'` site can regress silently across a major
 * bundler resolution. This smoke exercises the ONLY import site (GuestContext)
 * end-to-end: rendering the provider generates a guest id and persists it, so a
 * broken `v4` import would fail here in the app's real jsdom/vite resolution.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, cleanup, waitFor } from '@testing-library/react'
import { GuestProvider } from '../GuestContext'

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

beforeEach(() => localStorage.clear())
afterEach(() => {
  cleanup()
  localStorage.clear()
})

describe('uuid import site (GuestContext) after the 9→11 bump', () => {
  it('the v4 named import mints a valid RFC-4122 v4 guest id', async () => {
    render(
      <GuestProvider>
        <div />
      </GuestProvider>,
    )

    await waitFor(() => {
      expect(localStorage.getItem('guestId')).toMatch(UUID_V4)
    })
  })
})
