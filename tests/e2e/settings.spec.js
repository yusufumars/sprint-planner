import { test, expect } from '@playwright/test'
import { setupTeamMocks, TEAM_CODE, mockTeam } from './helpers/mock.js'

const SETTINGS_URL = `/team/${TEAM_CODE}/settings`

test.describe('Settings', () => {
  test.beforeEach(async ({ page }) => {
    await setupTeamMocks(page)
    await page.goto(SETTINGS_URL)
  })

  test('shows page title', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible()
    await expect(page.getByText('Configure your team workspace')).toBeVisible()
  })

  // ── Team Information ──────────────────────────────────────────────────────

  test('shows Team Information section', async ({ page }) => {
    await expect(page.getByText('Team Information')).toBeVisible()
  })

  test('team name input is pre-filled with the current team name', async ({ page }) => {
    // First writable textbox on the page is the team name field
    await expect(page.getByRole('textbox').first()).toHaveValue(mockTeam.name)
  })

  test('team code field is read-only and shows the code', async ({ page }) => {
    const codeInput = page.locator(`input[value="${TEAM_CODE}"][readonly]`)
    await expect(codeInput).toBeVisible()
  })

  test('Save Name button is visible', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Save Name' })).toBeVisible()
  })

  test('saving team name shows a ✓ Saved confirmation', async ({ page }) => {
    await page.getByRole('button', { name: 'Save Name' }).click()
    await expect(page.getByRole('button', { name: '✓ Saved' })).toBeVisible()
  })

  // ── Sprint Defaults ───────────────────────────────────────────────────────

  test('shows Sprint Defaults section', async ({ page }) => {
    await expect(page.getByText('Sprint Defaults')).toBeVisible()
  })

  test('sprint defaults are pre-filled from team config', async ({ page }) => {
    const numberInputs = page.locator('input[type="number"]')
    await expect(numberInputs.nth(0)).toHaveValue('15') // SP / Member
    await expect(numberInputs.nth(1)).toHaveValue('80') // Focus Factor %
  })

  test('Save Defaults button is visible', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Save Defaults' })).toBeVisible()
  })

  test('saving defaults shows a ✓ Saved confirmation', async ({ page }) => {
    await page.getByRole('button', { name: 'Save Defaults' }).click()
    await expect(page.getByRole('button', { name: '✓ Saved' })).toBeVisible()
  })

  // ── Team Members ──────────────────────────────────────────────────────────

  test('shows Team Members section', async ({ page }) => {
    await expect(page.getByText('Team Members')).toBeVisible()
  })

  test('shows existing members', async ({ page }) => {
    await expect(page.getByText('Alice Smith')).toBeVisible()
    await expect(page.getByText('Bob Jones')).toBeVisible()
  })

  test('can add a member via the Settings form', async ({ page }) => {
    await page.getByPlaceholder('Member name').fill('Dana Lee')
    await page.getByRole('button', { name: 'Add' }).click()
    await expect(page.getByText('Dana Lee')).toBeVisible()
  })

  // ── Share Your Team ───────────────────────────────────────────────────────

  test('shows Share Your Team section', async ({ page }) => {
    await expect(page.getByText('Share Your Team')).toBeVisible()
  })

  test('share URL input is visible next to Copy Link button', async ({ page }) => {
    // Scope to the Copy Link button's parent to find the adjacent URL input
    const shareInput = page.getByRole('button', { name: 'Copy Link' }).locator('..').locator('input')
    await expect(shareInput).toBeVisible()
  })

  test('Copy Link button is present', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Copy Link' })).toBeVisible()
  })

  // ── Setup Guide ───────────────────────────────────────────────────────────

  test('shows Setup Guide section with trigger button', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Show Setup Guide' })).toBeVisible()
  })

  // ── Danger Zone ───────────────────────────────────────────────────────────

  test('shows Danger Zone section', async ({ page }) => {
    await expect(page.getByText('Danger Zone')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Delete All Sprint Data' })).toBeVisible()
  })

  test('Delete All Sprint Data requires confirmation', async ({ page }) => {
    await page.getByRole('button', { name: 'Delete All Sprint Data' }).click()

    await expect(page.getByRole('button', { name: 'Yes, Delete All' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Cancel' })).toBeVisible()
  })

  test('cancelling the delete confirmation hides the prompt', async ({ page }) => {
    await page.getByRole('button', { name: 'Delete All Sprint Data' }).click()
    await page.getByRole('button', { name: 'Cancel' }).click()

    await expect(page.getByRole('button', { name: 'Delete All Sprint Data' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Yes, Delete All' })).not.toBeVisible()
  })
})
