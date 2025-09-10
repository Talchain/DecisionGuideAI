import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ScenarioSandboxMock } from '../ui/ScenarioSandboxMock';

describe('ScenarioSandboxMock - a11y keyboard interactions', () => {
  it('Tab reaches tile; Enter opens panel; Escape closes and returns focus; arrows move tile', async () => {
    const user = userEvent.setup();
    render(<ScenarioSandboxMock />);

    const tile = await screen.findByTestId('scenario-tile');
    // Progressively tab until the tile is focused or a safe cap is reached
    let guard = 0;
    while (document.activeElement !== tile && guard < 20) {
      await user.tab();
      guard++;
    }
    expect(document.activeElement).toBe(tile);

    // Press Enter to open the right panel
    await user.keyboard('{Enter}');
    const panel = await screen.findByTestId('panel');
    expect(panel).toBeInTheDocument();

    // Press Escape to close the panel and return focus to tile
    await user.keyboard('{Escape}');
    // panel should be gone
    expect(screen.queryByTestId('panel')).toBeNull();
    // focus should return to the tile
    expect(document.activeElement).toBe(tile);

    // Record initial transform and move right by 8px
    const before = (tile as HTMLElement).style.transform;
    await user.keyboard('{ArrowRight}');
    const after = (tile as HTMLElement).style.transform;
    expect(after).not.toBe(before);
  });
});
