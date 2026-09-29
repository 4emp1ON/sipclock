import { expect, test } from '@playwright/test';

test('home shows the time heading', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('19:00');
});

test('recipe page has a Recipe JSON-LD', async ({ page }) => {
  await page.goto('/recipes/gin-and-tonic');
  const raw = await page.locator('script[type="application/ld+json"]').textContent();
  const ld = JSON.parse(raw ?? '{}');
  expect(ld['@type']).toBe('Recipe');
  expect(ld.name).toBe('Gin & Tonic');
  expect(ld.totalTime).toBe('PT2M');
});

test('unknown recipe returns 404', async ({ page }) => {
  const res = await page.goto('/recipes/does-not-exist');
  expect(res?.status()).toBe(404);
  await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
});
