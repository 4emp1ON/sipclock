import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AbvBadge } from './abv-badge';

describe('AbvBadge', () => {
  it('shows the word, never 0%, for alcohol-free drinks', () => {
    const { container } = render(<AbvBadge abv={0} />);
    expect(container.textContent).toBe('Alcohol-free');
    expect(screen.getByLabelText('Alcohol-free')).toBeTruthy();
  });

  it('shows only the number for alcoholic drinks', () => {
    const { container } = render(<AbvBadge abv={9} />);
    expect(container.textContent).toBe('9%');
    expect(screen.getByLabelText('9 percent alcohol')).toBeTruthy();
  });
});
