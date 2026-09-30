import { expect, test } from '@playwright/test';

test('root redirects by Accept-Language', async ({ browser }) => {
  const ru = await browser.newContext({
    locale: 'ru-RU',
    extraHTTPHeaders: { 'accept-language': 'ru-RU,ru;q=0.9' },
  });
  const page = await ru.newPage();
  await page.goto('/');
  await expect(page).toHaveURL(/\/ru$/);
  await ru.close();
  const en = await browser.newPage();
  await en.goto('/');
  await expect(en).toHaveURL(/\/en$/);
  await en.close();
});

test('/en shows a pick with a reason line and Another idea keeps a valid pick', async ({
  page,
}) => {
  await page.goto('/en');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/^\d{2}:\d{2}$/);
  const name = page.getByTestId('pick-name');
  await expect(name).not.toBeEmpty();
  await expect(page.getByTestId('reason-line')).toContainText('Why this one');
  await expect(page.getByTestId('reason-line')).toContainText('.');
  const before = await name.textContent();
  await page.getByRole('button', { name: 'Another idea' }).click();
  await expect(name).not.toBeEmpty();
  const after = await name.textContent();
  expect(after).toBeTruthy();
  expect(after).not.toBe(before);
  await expect(page.getByRole('link', { name: 'Open recipe' })).toHaveAttribute(
    'href',
    /^\/en\/recipes\/[a-z-]+$/,
  );
});

test('/ru/recipes/negroni is Russian with a Recipe JSON-LD', async ({ page }) => {
  await page.goto('/ru/recipes/negroni');
  await expect(page.locator('html')).toHaveAttribute('lang', 'ru');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Негрони');
  const raw = await page.locator('script[type="application/ld+json"]').textContent();
  const ld = JSON.parse(raw ?? '{}');
  expect(ld['@type']).toBe('Recipe');
  expect(ld.name).toBe('Негрони');
  expect(ld.inLanguage).toBe('ru');
  await expect(page.locator('link[rel="alternate"][hreflang="en"]')).toHaveAttribute(
    'href',
    /\/en\/recipes\/negroni$/,
  );
});

test('recipe page unit toggle and servings scale amounts', async ({ page }) => {
  await page.goto('/en/recipes/negroni');
  await expect(page.getByText('30 ml').first()).toBeVisible();
  await page.getByRole('button', { name: '+' }).click();
  await expect(page.getByText('60 ml').first()).toBeVisible();
  await page.getByRole('button', { name: 'oz', exact: true }).click();
  await expect(page.getByText('2 oz').first()).toBeVisible();
});

test('unknown recipe returns 404', async ({ page }) => {
  const res = await page.goto('/en/recipes/does-not-exist');
  expect(res?.status()).toBe(404);
  await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
});

test('unknown localized path renders the localized 404', async ({ page }) => {
  const res = await page.goto('/ru/nope');
  expect(res?.status()).toBe(404);
  await expect(page.getByRole('heading', { name: 'Страница не найдена' })).toBeVisible();
});

test('recipes index lists 50 cards and the alcohol-free filter reduces it', async ({ page }) => {
  await page.goto('/en/recipes');
  const cards = page.getByTestId('recipe-card');
  await expect(cards).toHaveCount(50);
  await page.getByRole('button', { name: 'Alcohol-free' }).click();
  const n = await cards.count();
  expect(n).toBeGreaterThan(0);
  expect(n).toBeLessThan(50);
  await page.getByRole('button', { name: 'Date' }).click();
  expect(await cards.count()).toBeLessThanOrEqual(n);
});

test('sign-in page validates the email before asking for a code', async ({ page }) => {
  await page.goto('/en/sign-in');
  await expect(page.getByRole('heading', { level: 1, name: 'Sign in' })).toBeVisible();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
  await page.getByLabel('Email').fill('not-an-email');
  await page.getByRole('button', { name: 'Send code' }).click();
  await expect(page.locator('form [role="alert"]')).toHaveText('Enter a valid email address.');
  // The header offers the same page to guests; the session request may fail without an API.
  await expect(page.getByRole('navigation', { name: 'Main' })).toBeVisible();
});

test('password mode renders the right fields and the show/hide toggle works', async ({ page }) => {
  await page.goto('/en/sign-in');
  await page.getByRole('button', { name: 'Use password' }).click();
  await expect(page.getByLabel('Email')).toHaveAttribute('autocomplete', 'username');
  const password = page.getByLabel('Password', { exact: true });
  await expect(password).toHaveAttribute('type', 'password');
  await expect(password).toHaveAttribute('autocomplete', 'current-password');
  await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Forgot password?' })).toBeVisible();
  await page.getByRole('button', { name: 'Show password' }).click();
  await expect(password).toHaveAttribute('type', 'text');
  await page.getByRole('button', { name: 'Hide password' }).click();
  await expect(password).toHaveAttribute('type', 'password');
  await page.getByRole('button', { name: 'Use a code instead' }).click();
  await expect(page.getByRole('button', { name: 'Send code' })).toBeVisible();
});

test('create account shows the hint and blocks a short password client-side', async ({ page }) => {
  const requests: string[] = [];
  page.on('request', (r) => {
    // The header's session check is expected; anything else would be a sign-up request.
    if (r.url().includes('/api/auth/') && !r.url().endsWith('/get-session')) requests.push(r.url());
  });
  await page.goto('/en/sign-in');
  await page.getByRole('button', { name: 'Use password' }).click();
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByText('At least 8 characters')).toBeVisible();
  const password = page.getByLabel('Password', { exact: true });
  await expect(password).toHaveAttribute('autocomplete', 'new-password');
  await page.getByLabel('Email').fill('user@example.com');
  await password.fill('short');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.locator('form [role="alert"]')).toHaveText('Use at least 8 characters.');
  expect(requests).toEqual([]);
});

test('Russian sign-in page is localized', async ({ page }) => {
  await page.goto('/ru/sign-in');
  await expect(page.getByRole('heading', { level: 1, name: 'Вход' })).toBeVisible();
  await page.getByRole('button', { name: 'Получить код' }).click();
  await expect(page.locator('form [role="alert"]')).toHaveText('Введите корректный адрес почты.');
});

test('guests can save a recipe; it persists in localStorage across reloads', async ({ page }) => {
  await page.goto('/en/recipes/negroni');
  const save = page.getByRole('button', { name: 'Save', exact: true });
  await expect(save).toHaveAttribute('aria-pressed', 'false');
  await save.click();
  await expect(page.getByRole('button', { name: 'Saved' })).toHaveAttribute('aria-pressed', 'true');
  expect(await page.evaluate(() => localStorage.getItem('sipclock.favorites'))).toBe('["negroni"]');
  await page.reload();
  await expect(page.getByRole('button', { name: 'Saved' })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Saved' }).click();
  await expect(page.getByRole('button', { name: 'Save', exact: true })).toHaveAttribute(
    'aria-pressed',
    'false',
  );
});

test('guests are asked to sign in when logging a drink', async ({ page }) => {
  await page.goto('/en/recipes/negroni');
  await page.getByRole('button', { name: 'I made it' }).click();
  const link = page.getByRole('link', { name: 'Sign in' }).last();
  await expect(link).toHaveAttribute('href', /\/en\/sign-in\?next=%2Fen%2Frecipes%2Fnegroni$/);
  expect(await page.evaluate(() => localStorage.getItem('sipclock.history'))).toBeNull();
});

test('guest bar on Today is stored in localStorage', async ({ page }) => {
  await page.goto('/en');
  await page.getByText('My bar').click();
  await page.getByRole('button', { name: 'Gin', exact: true }).click();
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem('sipclock.bar')))
    .toContain('gin');
});

test('the API proxy refuses paths it does not map', async ({ request }) => {
  const res = await request.get('/api/health');
  expect(res.status()).toBe(404);
  expect(res.headers()['content-type']).toContain('application/problem+json');
});
