import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import StarterTemplates from '../components/StarterTemplates';

describe('StarterTemplates', () => {
  const mockOnTemplateSelect = vi.fn();

  beforeEach(() => {
    localStorage.clear();
    mockOnTemplateSelect.mockClear();
  });

  it('renders three starter templates', () => {
    render(<StarterTemplates onTemplateSelect={mockOnTemplateSelect} />);

    expect(screen.getByText('Pricing Change')).toBeTruthy();
    expect(screen.getByText('Feature Launch')).toBeTruthy();
    expect(screen.getByText('Build vs Buy')).toBeTruthy();
  });

  it('calls onTemplateSelect when a template is clicked', () => {
    render(<StarterTemplates onTemplateSelect={mockOnTemplateSelect} />);

    const pricingTemplates = screen.getAllByText('Pricing Change');
    const pricingTemplate = pricingTemplates[0].closest('button');
    fireEvent.click(pricingTemplate!);

    expect(mockOnTemplateSelect).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'pricing-change',
        name: 'Pricing Change',
        seed: 42
      })
    );
  });
});