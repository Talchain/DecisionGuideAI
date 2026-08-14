/**
 * Paul's ruling, 14 Aug 2026 — the top bar showed TWO controls both reading
 * "Untitled decision". This pins the end state:
 *
 *   1. ONE name control, not two. The left plain title is GONE.
 *   2. The surviving control (the scenario switcher) is the SINGLE NAME
 *      AUTHORITY: it displays the name CanvasMVP derives (`scenarioTitle`) and
 *      commits through `onTitleChange` — the writer that reaches BOTH the
 *      framing title (Supabase `scenarios.framing`) and the localStorage
 *      scenario name. Before this change the switcher read localStorage ONLY,
 *      so on the authenticated path (`loadSupabaseScenario` never writes a
 *      localStorage row) it displayed "Untitled decision" permanently and its
 *      Rename was a silent no-op — a control that lied.
 *   3. Rename is INLINE and obvious: one click on the name. Enter commits,
 *      Escape cancels, an empty name is refused and keeps the previous one.
 *   4. Copy: "Untitled decision" -> "Untitled model" on this surface.
 *
 * DEPLOYED-MOUNT BINDING (trap 3b): `<TopBar>` is rendered unconditionally at
 * `CanvasMVP.tsx:264` — no flag gates it, and there is no alternate top bar.
 * These specs therefore bind to the surface the deployed build mounts.
 *
 * IDENTITY BINDING (trap 19): every assertion binds by data-testid or by exact
 * accessible name, never by "the only textbox on screen" — the bar contains
 * other buttons and the kebab menu can mount further inputs.
 *
 * jsdom proves wiring, never pixels (trap 3). The browser walk is in the lane
 * report / evidence dir.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { TopBar } from '../TopBar'
import { ToastProvider } from '../../../canvas/ToastContext'

const MODEL_NAME = 'Pricing model 2025'

function renderTopBar(overrides: Partial<React.ComponentProps<typeof TopBar>> = {}) {
  const onTitleChange = vi.fn()
  const utils = render(
    <MemoryRouter>
      <ToastProvider>
        <TopBar
          scenarioTitle={MODEL_NAME}
          onTitleChange={onTitleChange}
          onSave={vi.fn()}
          onShare={vi.fn()}
          {...overrides}
        />
      </ToastProvider>
    </MemoryRouter>,
  )
  return { ...utils, onTitleChange }
}

describe('TopBar — single model-name control (Paul, 14 Aug 2026)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // --- 1. the left control is gone, and only ONE control names the model ----

  it('no longer renders the left plain-title control', () => {
    renderTopBar()
    // The removed control's two accessible names, both exact-matched.
    expect(screen.queryByRole('button', { name: /edit decision title/i })).toBeNull()
    expect(screen.queryByRole('textbox', { name: /edit decision title/i })).toBeNull()
  })

  it('shows exactly ONE name-bearing control in the bar', () => {
    // ⚠ This test was first written as `getAllByText(MODEL_NAME)` and PASSED at
    // pristine — a guard agreeing with itself (trap 13b). It could not see the
    // defect, because the two controls displayed DIFFERENT strings: the left
    // rendered the prop, the right rendered its localStorage fallback
    // ("Untitled decision"). Counting one string therefore found one match
    // while two name controls sat side by side on screen.
    //
    // Rendered in the exact state Paul screenshotted — the fallback name — and
    // counting name-BEARING CONTROLS instead of string occurrences. Both old
    // controls are sibling <button>s (never ancestors of one another), so the
    // count is stable. Pristine = 2, fixed = 1.
    renderTopBar({ scenarioTitle: 'Untitled model' })
    const banner = screen.getByRole('banner')
    const nameBearing = within(banner)
      .getAllByRole('button')
      .filter(b => /untitled (model|decision)/i.test(b.textContent ?? ''))
    expect(nameBearing).toHaveLength(1)
  })

  it('renders that one place as the scenario-switcher name control', () => {
    renderTopBar()
    const nameControl = screen.getByTestId('scenario-name-button')
    expect(nameControl).toHaveTextContent(MODEL_NAME)
    // ...and it lives inside the top bar's banner landmark, not elsewhere.
    expect(within(screen.getByRole('banner')).getByTestId('scenario-name-button')).toBe(nameControl)
  })

  it('binds the name to the DERIVED scenarioTitle prop, not to localStorage', () => {
    // The whole point of the rewire: the authenticated path has no localStorage
    // scenario row, so a switcher reading `getScenario()` would show the
    // fallback here. It must show what CanvasMVP derived.
    renderTopBar({ scenarioTitle: 'Q3 pricing rethink' })
    expect(screen.getByTestId('scenario-name-button')).toHaveTextContent('Q3 pricing rethink')
  })

  // --- 2. inline rename: one click, Enter commits ---------------------------

  it('opens an inline editor on ONE click of the name', () => {
    renderTopBar()
    expect(screen.queryByTestId('scenario-name-input')).toBeNull()
    fireEvent.click(screen.getByTestId('scenario-name-button'))
    const input = screen.getByTestId('scenario-name-input') as HTMLInputElement
    expect(input).toHaveFocus()
    expect(input.value).toBe(MODEL_NAME)
  })

  it('commits the rename on Enter, through onTitleChange', () => {
    const { onTitleChange } = renderTopBar()
    fireEvent.click(screen.getByTestId('scenario-name-button'))
    const input = screen.getByTestId('scenario-name-input')
    fireEvent.change(input, { target: { value: 'Opex reduction model' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(onTitleChange).toHaveBeenCalledTimes(1)
    expect(onTitleChange).toHaveBeenCalledWith('Opex reduction model')
    // editor closes
    expect(screen.queryByTestId('scenario-name-input')).toBeNull()
  })

  it('commits the rename on blur', () => {
    const { onTitleChange } = renderTopBar()
    fireEvent.click(screen.getByTestId('scenario-name-button'))
    const input = screen.getByTestId('scenario-name-input')
    fireEvent.change(input, { target: { value: 'Blur-committed model' } })
    fireEvent.blur(input)
    expect(onTitleChange).toHaveBeenCalledWith('Blur-committed model')
  })

  // --- 3. Escape cancels, empty refused ------------------------------------

  it('cancels on Escape — no write, previous name kept', () => {
    const { onTitleChange } = renderTopBar()
    fireEvent.click(screen.getByTestId('scenario-name-button'))
    const input = screen.getByTestId('scenario-name-input')
    fireEvent.change(input, { target: { value: 'Discarded name' } })
    fireEvent.keyDown(input, { key: 'Escape' })

    expect(onTitleChange).not.toHaveBeenCalled()
    expect(screen.queryByTestId('scenario-name-input')).toBeNull()
    expect(screen.getByTestId('scenario-name-button')).toHaveTextContent(MODEL_NAME)
  })

  it('refuses an empty name — no write, previous name kept', () => {
    const { onTitleChange } = renderTopBar()
    fireEvent.click(screen.getByTestId('scenario-name-button'))
    const input = screen.getByTestId('scenario-name-input')
    fireEvent.change(input, { target: { value: '   ' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(onTitleChange).not.toHaveBeenCalled()
    expect(screen.getByTestId('scenario-name-button')).toHaveTextContent(MODEL_NAME)
  })

  it('does not write when the name is unchanged', () => {
    const { onTitleChange } = renderTopBar()
    fireEvent.click(screen.getByTestId('scenario-name-button'))
    fireEvent.keyDown(screen.getByTestId('scenario-name-input'), { key: 'Enter' })
    expect(onTitleChange).not.toHaveBeenCalled()
  })

  // --- 4. the dropdown still opens, and is a SEPARATE control ---------------

  it('keeps the scenario dropdown reachable from its own trigger', () => {
    renderTopBar()
    expect(screen.queryByTestId('scenario-switcher-menu')).toBeNull()
    fireEvent.click(screen.getByTestId('scenario-switcher-trigger'))
    expect(screen.getByTestId('scenario-switcher-menu')).toBeInTheDocument()
  })

  it('editing the name does NOT open the dropdown', () => {
    renderTopBar()
    fireEvent.click(screen.getByTestId('scenario-name-button'))
    expect(screen.queryByTestId('scenario-switcher-menu')).toBeNull()
  })

  // --- 5. the kebab Rename still reaches the surviving control --------------

  it('kebab "Rename" opens the inline editor on the surviving control', () => {
    renderTopBar()
    fireEvent.click(screen.getByRole('button', { name: 'More options' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Rename' }))
    expect(screen.getByTestId('scenario-name-input')).toBeInTheDocument()
  })

  // --- 6. copy: model, not decision ----------------------------------------

  it('falls back to "Untitled model", never "Untitled decision"', () => {
    renderTopBar({ scenarioTitle: 'Untitled model' })
    expect(screen.getByTestId('scenario-name-button')).toHaveTextContent('Untitled model')
    expect(screen.queryByText(/untitled decision/i)).toBeNull()
  })

  it('carries no "decision" wording on the naming surface', () => {
    renderTopBar()
    // The name control and its rename affordances only — scoped, not a
    // product-wide sweep (Paul: top-bar naming surface only).
    const nameControl = screen.getByTestId('scenario-name-button')
    expect(nameControl.getAttribute('aria-label') ?? '').not.toMatch(/decision/i)
    expect(nameControl.getAttribute('title') ?? '').not.toMatch(/decision/i)

    fireEvent.click(screen.getByRole('button', { name: 'More options' }))
    // The kebab group label that heads "Rename".
    expect(screen.queryByText('Decision')).toBeNull()
    expect(screen.getByText('Model')).toBeInTheDocument()
  })
})
