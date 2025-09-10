import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ScenarioSandboxMock } from '../ui/ScenarioSandboxMock';

describe('ScenarioSandboxMock - probabilities a11y semantics', () => {
  it('marks invalid when out of range and clears when valid again', async () => {
    const user = userEvent.setup();
    render(<ScenarioSandboxMock />);

    // Find first probability number input (spinbutton)
    const spins = await screen.findAllByRole('spinbutton');
    const probInput = spins[0] as HTMLInputElement;

    // Set to an invalid value 1.2
    await user.clear(probInput);
    await user.type(probInput, '1.2');

    expect(probInput).toHaveAttribute('aria-invalid', 'true');
    const desc = probInput.getAttribute('aria-describedby');
    expect(desc).toBeTruthy();
    if (desc) {
      const hint = document.getElementById(desc);
      expect(hint).toBeTruthy();
      expect(hint?.textContent).toMatch(/Enter 0–1/);
    }

    // Back to valid 0.3
    await user.clear(probInput);
    await user.type(probInput, '0.3');

    expect(probInput).not.toHaveAttribute('aria-invalid');
    expect(probInput).not.toHaveAttribute('aria-describedby');
  });
});
