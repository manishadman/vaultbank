import { test, expect } from '@playwright/test';

test('landing page identifies the simulator', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /practice everyday money/i })).toBeVisible();
  await expect(page.getByText(/simulated Canadian dollars/i)).toBeVisible();
});
