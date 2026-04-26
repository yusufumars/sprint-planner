import { test, expect } from '@playwright/test'
import { setupTeamMocks, TEAM_CODE } from './helpers/mock.js'

const TEAM_URL = `/team/${TEAM_CODE}`

test.describe('Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await setupTeamMocks(page)
    await page.goto(TEAM_URL)
  })

  test('renders the SprintIQ logo in the sidebar', async ({ page }) => {
    await expect(page.locator('nav').getByText('SPRINTIQ')).toBeVisible()
  })

  test('navbar shows all four nav links', async ({ page }) => {
    const nav = page.locator('nav')
    await expect(nav.getByText('Dashboard')).toBeVisible()
    // Use exact: true to avoid matching "Test Team Alpha" which contains "Team"
    await expect(nav.getByText('Team', { exact: true })).toBeVisible()
    await expect(nav.getByText('Velocity')).toBeVisible()
    await expect(nav.getByText('Settings')).toBeVisible()
  })

  test('navbar shows the team name and team code', async ({ page }) => {
    await expect(page.locator('nav').getByText('Test Team Alpha')).toBeVisible()
    await expect(page.locator('nav').getByText(TEAM_CODE)).toBeVisible()
  })

  test('Dashboard link is active on the dashboard route', async ({ page }) => {
    const dashLink = page.locator('nav').getByText('Dashboard')
    await expect(dashLink).toHaveClass(/text-\[#BFFF00\]/)
  })

  test('clicking Team navigates to /team/:code/team', async ({ page }) => {
    await page.locator('nav').getByText('Team', { exact: true }).click()
    await expect(page).toHaveURL(`${TEAM_URL}/team`)
  })

  test('clicking Velocity navigates to /team/:code/velocity', async ({ page }) => {
    await page.locator('nav').getByText('Velocity').click()
    await expect(page).toHaveURL(`${TEAM_URL}/velocity`)
  })

  test('clicking Settings navigates to /team/:code/settings', async ({ page }) => {
    await page.locator('nav').getByText('Settings').click()
    await expect(page).toHaveURL(`${TEAM_URL}/settings`)
  })

  test('Sign Out returns to the welcome page', async ({ page }) => {
    await page.locator('nav').getByText('← Sign Out').click()
    await expect(page).toHaveURL('/')
  })

  test('Settings link is active on the settings route', async ({ page }) => {
    await page.goto(`${TEAM_URL}/settings`)
    const settingsLink = page.locator('nav').getByText('Settings')
    await expect(settingsLink).toHaveClass(/text-\[#BFFF00\]/)
  })
})
