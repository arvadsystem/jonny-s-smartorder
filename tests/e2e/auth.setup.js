import fs from 'node:fs';
import path from 'node:path';
import { test, expect } from '@playwright/test';

const authFile = path.resolve(process.cwd(), 'tests/e2e/.auth/admin.json');

const requiredEnv = (name) => {
  const value = String(process.env[name] || '').trim();
  if (!value) {
    throw new Error(`Falta configurar ${name} para E2E de Caja.`);
  }
  return value;
};

test('autentica usuario QA de Caja', async ({ page }) => {
  const username = requiredEnv('E2E_USERNAME');
  const password = requiredEnv('E2E_PASSWORD');
  const identifierInput = page.getByTestId('login-identifier').or(page.locator('#login-identifier')).first();
  const passwordInput = page.getByTestId('login-password').or(page.locator('#login-password')).first();
  const submitButton = page.getByTestId('login-submit').or(page.getByRole('button', { name: /iniciar sesion|iniciar sesión/i })).first();

  await page.goto('/auth/login');
  await expect(identifierInput).toBeVisible();
  await identifierInput.fill(username);
  await passwordInput.fill(password);
  await submitButton.click();

  await page.waitForURL(/\/dashboard(\/|$|\?)/, { timeout: 30_000 });
  await expect(page).toHaveURL(/\/dashboard/);

  fs.mkdirSync(path.dirname(authFile), { recursive: true });
  await page.context().storageState({ path: authFile });
});
