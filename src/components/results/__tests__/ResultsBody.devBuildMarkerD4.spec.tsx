/**
 * ResultsBody — Brief 5.8B D4 polish: orphan-SHA gating regression guard.
 *
 * Pre-D4-polish, the build marker rendered for every dev/staging deploy and
 * surfaced as an orphan hash (e.g. "45fbb4a") near the footer in
 * screenshots. The polish gates it on `import.meta.env.DEV && expertMode`
 * so debug users still see it but it stays suppressed by default.
 *
 * The gate logic is extracted into `DevBuildMarker` so the
 * production-vs-expert combination can be unit-tested without depending on
 * Vite's pre-baked `import.meta.env.DEV` constant.
 */

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DevBuildMarker } from '../ResultsBody'

describe('DevBuildMarker — Brief 5.8B D4 polish gate', () => {
  it('renders the SHA only when both isDev AND expertMode are true', () => {
    render(<DevBuildMarker isDev={true} expertMode={true} sha="45fbb4a" />)
    const marker = screen.getByTestId('dev-build-marker')
    expect(marker).toBeInTheDocument()
    expect(marker).toHaveTextContent('45fbb4a')
  })

  it('suppresses the marker when isDev is true but expertMode is false (production user on a dev deploy)', () => {
    render(<DevBuildMarker isDev={true} expertMode={false} sha="45fbb4a" />)
    expect(screen.queryByTestId('dev-build-marker')).not.toBeInTheDocument()
  })

  it('suppresses the marker when expertMode is true but isDev is false (expert user in production build)', () => {
    render(<DevBuildMarker isDev={false} expertMode={true} sha="45fbb4a" />)
    expect(screen.queryByTestId('dev-build-marker')).not.toBeInTheDocument()
  })

  it('suppresses the marker when both gates are false', () => {
    render(<DevBuildMarker isDev={false} expertMode={false} sha="45fbb4a" />)
    expect(screen.queryByTestId('dev-build-marker')).not.toBeInTheDocument()
  })
})
