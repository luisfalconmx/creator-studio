import { expect, test } from '@playwright/test'

test.describe('Creator Studio shell', () => {
  test('switches between the three sections from the rail', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveTitle('Creator Studio')
    const rail = page.getByRole('navigation', { name: 'Secciones' })

    // Videos is the default section
    await expect(rail.getByRole('button', { name: 'Videos' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    await expect(page.getByRole('region', { name: 'Videos' })).toBeVisible()

    await rail.getByRole('button', { name: 'Descargas' }).click()
    await expect(page.getByRole('region', { name: 'Descargas' })).toBeVisible()
    await expect(page.getByRole('region', { name: 'Videos' })).toBeHidden()
    await expect(page.getByRole('tab', { name: /Nueva descarga/ })).toBeVisible()

    await rail.getByRole('button', { name: 'Imágenes' }).click()
    await expect(page.getByRole('heading', { name: 'Optimizador de imágenes' })).toBeVisible()

    // The last section is restored after a reload
    await page.reload()
    await expect(rail.getByRole('button', { name: 'Imágenes' })).toHaveAttribute(
      'aria-current',
      'page',
    )
  })
})
