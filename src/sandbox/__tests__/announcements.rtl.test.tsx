import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ScenarioSandboxMock } from '../ui/ScenarioSandboxMock';

describe('ScenarioSandboxMock - live status announcements', () => {
  it('announces Generating… then Complete after clicking Generate', async () => {
    const user = userEvent.setup();
    render(<ScenarioSandboxMock />);

    const announcer = screen.getByTestId('status-announcer');
    expect(announcer.textContent?.trim()).toBe('');

    const generateBtn = screen.getByRole('button', { name: 'Generate' });
    await user.click(generateBtn);

    // Should announce Generating… quickly
    await waitFor(() => {
      expect(screen.getByTestId('status-announcer').textContent).toMatch(/Generating/i);
    });

    // Eventually announces Complete
    await waitFor(
      () => {
        expect(screen.getByTestId('status-announcer').textContent).toMatch(/Complete/i);
      },
      { timeout: 2500 }
    );
  });
});
