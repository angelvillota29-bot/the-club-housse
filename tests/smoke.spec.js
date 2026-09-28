import { test, expect } from '@playwright/test';

// Pruebas de humo básicas -- confirman que el sitio carga y que el flujo de
// navegación principal (Home -> Menú) funciona después de un despliegue.
// Se pueden ampliar con un flujo de checkout real cuando haga falta.

test('la página de inicio carga', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('¿Hoy qué')).toBeVisible();
});

test('el logo del navbar lleva al menú', async ({ page }) => {
  await page.goto('/');
  await page.getByText('The Club Housse').first().click();
  await expect(page).toHaveURL(/\/menu$/);
  await expect(page.getByText('Menú de Hoy')).toBeVisible();
});
