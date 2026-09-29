import type { Availability } from '@sipclock/domain';

import { availabilityLabel } from './availability-label';

const name = (id: string) => id.toUpperCase();

describe('availabilityLabel', () => {
  it('ready', () => {
    expect(availabilityLabel({ status: 'ready' }, 'en', name)).toBe('All in your bar');
  });

  it('swap pluralizes', () => {
    const one: Availability = { status: 'swap', swaps: [{ need: 'a', use: 'b' }] };
    const two: Availability = {
      status: 'swap',
      swaps: [
        { need: 'a', use: 'b' },
        { need: 'c', use: 'd' },
      ],
    };
    expect(availabilityLabel(one, 'en', name)).toBe('Ready · 1 swap');
    expect(availabilityLabel(two, 'en', name)).toBe('Ready · 2 swaps');
    expect(availabilityLabel(two, 'ru', name)).toBe('Готово · 2 замены');
  });

  it('missing lists names', () => {
    expect(
      availabilityLabel({ status: 'missing', missing: ['gin', 'lime'], swaps: [] }, 'en', name),
    ).toBe('Missing: GIN, LIME');
    expect(availabilityLabel({ status: 'missing', missing: ['gin'], swaps: [] }, 'ru', name)).toBe(
      'Не хватает: GIN',
    );
  });

  it('unknown has no pill', () => {
    expect(availabilityLabel({ status: 'unknown' }, 'en', name)).toBeNull();
  });
});
