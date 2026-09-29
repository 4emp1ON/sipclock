import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AbvBadge } from './abv-badge';

describe('AbvBadge', () => {
  it('shows 0% Free for alcohol-free drinks', () => {
    const { container } = render(<AbvBadge abv={0} />);
    expect(container.textContent).toBe('0%Free');
  });

  it('shows the ABV with Alc. label', () => {
    render(<AbvBadge abv={9} />);
    expect(screen.getByText('9%')).toBeTruthy();
    expect(screen.getByText('Alc.')).toBeTruthy();
  });
});
