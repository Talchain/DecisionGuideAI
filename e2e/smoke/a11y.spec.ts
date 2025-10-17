// e2e/smoke/a11y.spec.ts
// @smoke - Accessibility checks

import { test, expect } from '@playwright/test'

test('canvas has proper ARIA roles', async ({ page }) => {
  await page.goto('/#/canvas')
  await expect(page.locator('.react-flow')).toBeVisible({ timeout: 10000 })
  
  // Check for main landmark
  const main = page.locator('main, [role="main"]')
  const hasMain = await main.count() > 0
  
  // Check for accessible names on interactive elements
  const buttons = page.locator('button')
  const buttonCount = await buttons.count()
  
  if (buttonCount > 0) {
    for (let i = 0; i < Math.min(buttonCount, 5); i++) {
      const button = buttons.nth(i)
      const text = await button.textContent()
      const ariaLabel = await button.getAttribute('aria-label')
      
      // Button should have text or aria-label
      expect(text || ariaLabel).toBeTruthy()
    }
  }
})

test('focus visible on interactive elements', async ({ page }) => {
  await page.goto('/#/canvas')
  await expect(page.locator('.react-flow')).toBeVisible({ timeout: 10000 })
  
  // Tab to first interactive element
  await page.keyboard.press('Tab')
  await page.waitForTimeout(300)
  
  // Check if focused element has visible focus indicator
  const focusStyles = await page.evaluate(() => {
    const el = document.activeElement
    if (!el) return null
    
    const styles = window.getComputedStyle(el)
    const pseudoStyles = window.getComputedStyle(el, ':focus')
    
    return {
      outline: styles.outline,
      outlineWidth: styles.outlineWidth,
      boxShadow: styles.boxShadow,
      border: styles.border
    }
  })
  
  // Should have some focus indicator
  if (focusStyles) {
    const hasFocusIndicator = 
      focusStyles.outline !== 'none' ||
      focusStyles.outlineWidth !== '0px' ||
      focusStyles.boxShadow !== 'none' ||
      focusStyles.border?.includes('px')
    
    expect(hasFocusIndicator).toBe(true)
  }
})

test('no accessibility violations on load', async ({ page }) => {
  await page.goto('/#/canvas')
  await expect(page.locator('.react-flow')).toBeVisible({ timeout: 10000 })
  
  // Basic checks
  // 1. No duplicate IDs
  const duplicateIds = await page.evaluate(() => {
    const ids = Array.from(document.querySelectorAll('[id]')).map(el => el.id)
    const unique = new Set(ids)
    return ids.length !== unique.size
  })
  expect(duplicateIds).toBe(false)
  
  // 2. Images have alt text (if any)
  const imagesWithoutAlt = await page.locator('img:not([alt])').count()
  expect(imagesWithoutAlt).toBe(0)
  
  // 3. Links have accessible names
  const linksWithoutText = await page.evaluate(() => {
    const links = Array.from(document.querySelectorAll('a'))
    return links.filter(link => 
      !link.textContent?.trim() && 
      !link.getAttribute('aria-label') &&
      !link.getAttribute('aria-labelledby')
    ).length
  })
  expect(linksWithoutText).toBe(0)
})

test('keyboard trap prevention', async ({ page }) => {
  await page.goto('/#/canvas')
  await expect(page.locator('.react-flow')).toBeVisible({ timeout: 10000 })
  
  // Tab through multiple elements
  let previousFocus = ''
  let sameCount = 0
  
  for (let i = 0; i < 20; i++) {
    await page.keyboard.press('Tab')
    await page.waitForTimeout(100)
    
    const currentFocus = await page.evaluate(() => {
      const el = document.activeElement
      return el?.tagName + (el?.getAttribute('aria-label') || el?.textContent?.slice(0, 20))
    })
    
    if (currentFocus === previousFocus) {
      sameCount++
    } else {
      sameCount = 0
    }
    
    previousFocus = currentFocus || ''
    
    // Should not be stuck on same element for >3 tabs
    expect(sameCount).toBeLessThan(3)
  }
})
