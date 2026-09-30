import { PRODUCTION_ENDPOINTS, resolveEndpoints } from './endpoints';

describe('resolveEndpoints', () => {
  it('uses the dev machine in development', () => {
    expect(resolveEndpoints({}, 'android', true)).toEqual({
      api: 'http://10.0.2.2:8787',
      powersync: 'http://10.0.2.2:8080',
    });
    expect(resolveEndpoints({}, 'ios', true)).toEqual({
      api: 'http://localhost:8787',
      powersync: 'http://localhost:8080',
    });
  });

  it('uses production in release builds', () => {
    expect(resolveEndpoints({}, 'android', false)).toEqual(PRODUCTION_ENDPOINTS);
    expect(PRODUCTION_ENDPOINTS.powersync).toBe(`${PRODUCTION_ENDPOINTS.api}/powersync`);
  });

  it('prefers explicit values and strips trailing slashes', () => {
    expect(
      resolveEndpoints(
        { apiUrl: 'https://x.test/sipclock/', powersyncUrl: ' https://x.test/ps// ' },
        'ios',
        false,
      ),
    ).toEqual({ api: 'https://x.test/sipclock', powersync: 'https://x.test/ps' });
    expect(resolveEndpoints({ apiUrl: '  ' }, 'ios', true).api).toBe('http://localhost:8787');
  });
});
