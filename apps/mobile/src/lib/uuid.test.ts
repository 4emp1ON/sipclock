import { uuidV4 } from './uuid';

describe('uuidV4', () => {
  const V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

  it('uses crypto.randomUUID when present', () => {
    expect(uuidV4({ randomUUID: () => 'native' })).toBe('native');
  });

  it('builds a v4 UUID from getRandomValues', () => {
    const id = uuidV4({
      getRandomValues: <T extends ArrayBufferView>(a: T) => {
        (a as unknown as Uint8Array).fill(0xff);
        return a;
      },
    });
    expect(id).toBe('ffffffff-ffff-4fff-bfff-ffffffffffff');
  });

  it('falls back to Math.random without Web Crypto', () => {
    const ids = new Set(Array.from({ length: 200 }, () => uuidV4({})));
    expect(ids.size).toBe(200);
    for (const id of ids) expect(id).toMatch(V4);
    expect(uuidV4(undefined)).toMatch(V4);
  });
});
