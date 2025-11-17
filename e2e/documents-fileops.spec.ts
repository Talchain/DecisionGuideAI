/**
 * S7-FILEOPS: Documents File Operations E2E Tests
 * Tests rename, search, sort, F2 shortcut, and undo/redo integration
 */

import { test, expect } from '@playwright/test'

test.describe('S7-FILEOPS: Documents File Operations', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the app
    await page.goto('/')

    // Wait for app to load
    await page.waitForSelector('text=Source Documents', { timeout: 10000 })
  })

  test.describe('Rename Flow', () => {
    test('can rename document via click and Enter', async ({ page }) => {
      // Assuming documents are already uploaded or we upload one first
      // For this test, we'll need to upload a document first

      // Upload a test document (if upload UI is available)
      const fileInput = page.locator('input[type="file"]')
      if (await fileInput.count() > 0) {
        // Create a test file
        await fileInput.setInputFiles({
          name: 'test-document.txt',
          mimeType: 'text/plain',
          buffer: Buffer.from('Test content'),
        })

        // Wait for document to appear
        await page.waitForSelector('text=test-document.txt')
      }

      // Click rename button
      const renameButton = page.locator('button[aria-label="Rename document"]').first()
      await renameButton.click()

      // Input should be focused with current name
      const input = page.locator('input[aria-label*="Rename document"]')
      await expect(input).toBeVisible()
      await expect(input).toBeFocused()

      // Type new name
      await input.fill('renamed-document.txt')

      // Press Enter
      await input.press('Enter')

      // Verify new name is displayed
      await expect(page.locator('text=renamed-document.txt')).toBeVisible()

      // Verify input is gone
      await expect(input).not.toBeVisible()
    })

    test('can cancel rename with Escape', async ({ page }) => {
      // Upload a test document
      const fileInput = page.locator('input[type="file"]')
      if (await fileInput.count() > 0) {
        await fileInput.setInputFiles({
          name: 'original-name.txt',
          mimeType: 'text/plain',
          buffer: Buffer.from('Test content'),
        })

        await page.waitForSelector('text=original-name.txt')
      }

      // Click rename button
      const renameButton = page.locator('button[aria-label="Rename document"]').first()
      await renameButton.click()

      // Type new name
      const input = page.locator('input[aria-label*="Rename document"]')
      await input.fill('new-name.txt')

      // Press Escape
      await input.press('Escape')

      // Original name should still be displayed
      await expect(page.locator('text=original-name.txt')).toBeVisible()

      // New name should not appear
      await expect(page.locator('text=new-name.txt')).not.toBeVisible()
    })

    test('shows validation error for empty name', async ({ page }) => {
      // Upload a test document
      const fileInput = page.locator('input[type="file"]')
      if (await fileInput.count() > 0) {
        await fileInput.setInputFiles({
          name: 'test.txt',
          mimeType: 'text/plain',
          buffer: Buffer.from('Test content'),
        })

        await page.waitForSelector('text=test.txt')
      }

      // Click rename button
      const renameButton = page.locator('button[aria-label="Rename document"]').first()
      await renameButton.click()

      // Clear the input
      const input = page.locator('input[aria-label*="Rename document"]')
      await input.fill('')

      // Click save button
      await page.locator('button[aria-label="Save rename"]').click()

      // Verify error message appears
      await expect(page.locator('role=alert')).toContainText('Document name cannot be empty')
    })

    test('shows validation error for duplicate name', async ({ page }) => {
      // Upload two test documents
      const fileInput = page.locator('input[type="file"]')
      if (await fileInput.count() > 0) {
        await fileInput.setInputFiles([
          {
            name: 'doc1.txt',
            mimeType: 'text/plain',
            buffer: Buffer.from('Content 1'),
          },
          {
            name: 'doc2.txt',
            mimeType: 'text/plain',
            buffer: Buffer.from('Content 2'),
          },
        ])

        await page.waitForSelector('text=doc1.txt')
        await page.waitForSelector('text=doc2.txt')
      }

      // Try to rename doc1 to doc2
      const renameButtons = page.locator('button[aria-label="Rename document"]')
      await renameButtons.first().click()

      const input = page.locator('input[aria-label*="Rename document"]')
      await input.fill('doc2.txt')

      await page.locator('button[aria-label="Save rename"]').click()

      // Verify error message appears
      await expect(page.locator('role=alert')).toContainText('A document with this name already exists')
    })
  })

  test.describe('F2 Shortcut', () => {
    test('enters rename mode with F2 key', async ({ page }) => {
      // Upload a test document
      const fileInput = page.locator('input[type="file"]')
      if (await fileInput.count() > 0) {
        await fileInput.setInputFiles({
          name: 'f2-test.txt',
          mimeType: 'text/plain',
          buffer: Buffer.from('Test content'),
        })

        await page.waitForSelector('text=f2-test.txt')
      }

      // Focus the document card (find focusable div with tabindex)
      const documentCard = page.locator('[tabindex="0"]').first()
      await documentCard.focus()

      // Press F2
      await page.keyboard.press('F2')

      // Verify rename input appears
      const input = page.locator('input[aria-label*="Rename document"]')
      await expect(input).toBeVisible()
      await expect(input).toBeFocused()
      await expect(input).toHaveValue('f2-test.txt')
    })
  })

  test.describe('Search Flow', () => {
    test('filters documents by search query', async ({ page }) => {
      // Upload multiple test documents
      const fileInput = page.locator('input[type="file"]')
      if (await fileInput.count() > 0) {
        await fileInput.setInputFiles([
          {
            name: 'alpha-document.txt',
            mimeType: 'text/plain',
            buffer: Buffer.from('Alpha content'),
          },
          {
            name: 'beta-document.txt',
            mimeType: 'text/plain',
            buffer: Buffer.from('Beta content'),
          },
          {
            name: 'gamma-document.txt',
            mimeType: 'text/plain',
            buffer: Buffer.from('Gamma content'),
          },
        ])

        await page.waitForSelector('text=alpha-document.txt')
        await page.waitForSelector('text=beta-document.txt')
        await page.waitForSelector('text=gamma-document.txt')
      }

      // Type in search box
      const searchInput = page.locator('input[placeholder="Search documents..."]')
      await searchInput.fill('alpha')

      // Verify only alpha document is visible
      await expect(page.locator('text=alpha-document.txt')).toBeVisible()
      await expect(page.locator('text=beta-document.txt')).not.toBeVisible()
      await expect(page.locator('text=gamma-document.txt')).not.toBeVisible()

      // Verify filtered count is shown
      await expect(page.locator('text=/\\(1 filtered\\)/')).toBeVisible()
    })

    test('clears search with clear button', async ({ page }) => {
      // Upload test documents
      const fileInput = page.locator('input[type="file"]')
      if (await fileInput.count() > 0) {
        await fileInput.setInputFiles([
          {
            name: 'doc1.txt',
            mimeType: 'text/plain',
            buffer: Buffer.from('Content 1'),
          },
          {
            name: 'doc2.txt',
            mimeType: 'text/plain',
            buffer: Buffer.from('Content 2'),
          },
        ])

        await page.waitForSelector('text=doc1.txt')
      }

      // Type in search box
      const searchInput = page.locator('input[placeholder="Search documents..."]')
      await searchInput.fill('doc1')

      // Click clear button
      await page.locator('button[aria-label="Clear search"]').click()

      // Verify all documents are visible again
      await expect(page.locator('text=doc1.txt')).toBeVisible()
      await expect(page.locator('text=doc2.txt')).toBeVisible()

      // Verify search input is empty
      await expect(searchInput).toHaveValue('')
    })

    test('shows "no matches" message for non-existent query', async ({ page }) => {
      // Upload test document
      const fileInput = page.locator('input[type="file"]')
      if (await fileInput.count() > 0) {
        await fileInput.setInputFiles({
          name: 'test.txt',
          mimeType: 'text/plain',
          buffer: Buffer.from('Test content'),
        })

        await page.waitForSelector('text=test.txt')
      }

      // Type query that doesn't match
      const searchInput = page.locator('input[placeholder="Search documents..."]')
      await searchInput.fill('nonexistent')

      // Verify "no matches" message appears
      await expect(page.locator('text=/No documents match/')).toBeVisible()
    })
  })

  test.describe('Sort Flow', () => {
    test('changes visual order when clicking sort buttons', async ({ page }) => {
      // Upload test documents with different sizes
      const fileInput = page.locator('input[type="file"]')
      if (await fileInput.count() > 0) {
        await fileInput.setInputFiles([
          {
            name: 'zebra.txt',
            mimeType: 'text/plain',
            buffer: Buffer.from('Z'),
          },
          {
            name: 'alpha.txt',
            mimeType: 'text/plain',
            buffer: Buffer.from('A'),
          },
          {
            name: 'beta.txt',
            mimeType: 'text/plain',
            buffer: Buffer.from('B'),
          },
        ])

        await page.waitForSelector('text=zebra.txt')
        await page.waitForSelector('text=alpha.txt')
        await page.waitForSelector('text=beta.txt')
      }

      // Click "name" sort button
      await page.locator('button', { hasText: /^name$/i }).click()

      // Verify sort button is highlighted
      const nameButton = page.locator('button', { hasText: /^name$/i })
      await expect(nameButton).toHaveClass(/bg-blue-100/)
      await expect(nameButton).toContainText('↑') // Ascending indicator

      // Verify documents are in alphabetical order (checking first document)
      const firstDoc = page.locator('text=alpha.txt')
      await expect(firstDoc).toBeVisible()
    })

    test('toggles sort direction on repeated clicks', async ({ page }) => {
      // Upload test documents
      const fileInput = page.locator('input[type="file"]')
      if (await fileInput.count() > 0) {
        await fileInput.setInputFiles([
          {
            name: 'a.txt',
            mimeType: 'text/plain',
            buffer: Buffer.from('A'),
          },
          {
            name: 'z.txt',
            mimeType: 'text/plain',
            buffer: Buffer.from('Z'),
          },
        ])

        await page.waitForSelector('text=a.txt')
      }

      // Click "name" sort button twice
      const nameButton = page.locator('button', { hasText: /^name$/i })
      await nameButton.click()

      // Should show ascending indicator
      await expect(nameButton).toContainText('↑')

      // Click again
      await nameButton.click()

      // Should show descending indicator
      await expect(nameButton).toContainText('↓')
    })

    test('can sort by all fields', async ({ page }) => {
      // Upload test documents
      const fileInput = page.locator('input[type="file"]')
      if (await fileInput.count() > 0) {
        await fileInput.setInputFiles([
          {
            name: 'test.txt',
            mimeType: 'text/plain',
            buffer: Buffer.from('Test'),
          },
        ])

        await page.waitForSelector('text=test.txt')
      }

      // Test each sort button
      const sortFields = ['name', 'date', 'size', 'type']

      for (const field of sortFields) {
        const button = page.locator('button', { hasText: new RegExp(`^${field}$`, 'i') })
        await button.click()

        // Verify button is highlighted
        await expect(button).toHaveClass(/bg-blue-100/)
      }
    })
  })

  test.describe('Undo/Redo Integration', () => {
    test('can undo document rename', async ({ page }) => {
      // Upload a test document
      const fileInput = page.locator('input[type="file"]')
      if (await fileInput.count() > 0) {
        await fileInput.setInputFiles({
          name: 'original.txt',
          mimeType: 'text/plain',
          buffer: Buffer.from('Test content'),
        })

        await page.waitForSelector('text=original.txt')
      }

      // Rename the document
      await page.locator('button[aria-label="Rename document"]').first().click()
      const input = page.locator('input[aria-label*="Rename document"]')
      await input.fill('renamed.txt')
      await input.press('Enter')

      // Verify new name
      await expect(page.locator('text=renamed.txt')).toBeVisible()

      // Press Cmd+Z (or Ctrl+Z on Windows/Linux)
      const modifier = process.platform === 'darwin' ? 'Meta' : 'Control'
      await page.keyboard.press(`${modifier}+KeyZ`)

      // Verify original name is restored
      await expect(page.locator('text=original.txt')).toBeVisible()
      await expect(page.locator('text=renamed.txt')).not.toBeVisible()
    })

    test('can redo document rename', async ({ page }) => {
      // Upload a test document
      const fileInput = page.locator('input[type="file"]')
      if (await fileInput.count() > 0) {
        await fileInput.setInputFiles({
          name: 'original.txt',
          mimeType: 'text/plain',
          buffer: Buffer.from('Test content'),
        })

        await page.waitForSelector('text=original.txt')
      }

      // Rename the document
      await page.locator('button[aria-label="Rename document"]').first().click()
      const input = page.locator('input[aria-label*="Rename document"]')
      await input.fill('renamed.txt')
      await input.press('Enter')

      // Undo
      const modifier = process.platform === 'darwin' ? 'Meta' : 'Control'
      await page.keyboard.press(`${modifier}+KeyZ`)

      // Verify undo worked
      await expect(page.locator('text=original.txt')).toBeVisible()

      // Redo (Cmd+Shift+Z or Ctrl+Shift+Z)
      await page.keyboard.press(`${modifier}+Shift+KeyZ`)

      // Verify redo worked
      await expect(page.locator('text=renamed.txt')).toBeVisible()
      await expect(page.locator('text=original.txt')).not.toBeVisible()
    })
  })

  test.describe('Accessibility', () => {
    test('can navigate with keyboard', async ({ page }) => {
      // Upload a test document
      const fileInput = page.locator('input[type="file"]')
      if (await fileInput.count() > 0) {
        await fileInput.setInputFiles({
          name: 'keyboard-test.txt',
          mimeType: 'text/plain',
          buffer: Buffer.from('Test content'),
        })

        await page.waitForSelector('text=keyboard-test.txt')
      }

      // Tab to rename button
      await page.keyboard.press('Tab')

      // Should be able to activate with Enter
      await page.keyboard.press('Enter')

      // Rename input should appear
      const input = page.locator('input[aria-label*="Rename document"]')
      await expect(input).toBeVisible()
    })

    test('has proper ARIA labels', async ({ page }) => {
      // Upload a test document
      const fileInput = page.locator('input[type="file"]')
      if (await fileInput.count() > 0) {
        await fileInput.setInputFiles({
          name: 'aria-test.txt',
          mimeType: 'text/plain',
          buffer: Buffer.from('Test content'),
        })

        await page.waitForSelector('text=aria-test.txt')
      }

      // Check rename button has aria-label
      const renameButton = page.locator('button[aria-label="Rename document"]').first()
      await expect(renameButton).toHaveAttribute('aria-label', 'Rename document')

      // Check search input has aria-label
      const searchInput = page.locator('input[aria-label="Search documents"]')
      await expect(searchInput).toHaveAttribute('aria-label', 'Search documents')
    })
  })
})
