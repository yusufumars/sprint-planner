import { test, expect } from '@playwright/test'
import { setupWelcomeMocks, mockTeam, TEAM_CODE } from './helpers/mock.js'

test.describe('Welcome page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('renders the SprintIQ logo and tagline', async ({ page }) => {
    await expect(page.getByText('SPRINTIQ')).toBeVisible()
    await expect(page.getByText('Smart sprint planning for agile teams')).toBeVisible()
  })

  test('renders both Create and Join team cards', async ({ page }) => {
    await expect(page.getByText('Create New Team')).toBeVisible()
    await expect(page.getByText('Join Existing Team')).toBeVisible()
  })

  test('create team form has a team name input and submit button', async ({ page }) => {
    await expect(page.getByPlaceholder('e.g. Alpha Squad')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Create Team' })).toBeVisible()
  })

  test('join team form has a team code input and submit button', async ({ page }) => {
    await expect(page.getByPlaceholder('e.g. eha-x7k2')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Join My Team' })).toBeVisible()
  })

  test('create team navigates to /team/:code on success', async ({ page }) => {
    await setupWelcomeMocks(page, { createSuccess: true })

    await page.getByPlaceholder('e.g. Alpha Squad').fill('My Squad')
    await page.getByRole('button', { name: 'Create Team' }).click()

    // After a successful create the app navigates to /team/<generated-code>
    await expect(page).toHaveURL(/\/team\/[a-z0-9]+-[a-z0-9]+/)
  })

  test('create team shows error when API returns failure', async ({ page }) => {
    await setupWelcomeMocks(page, { createSuccess: false })

    await page.getByPlaceholder('e.g. Alpha Squad').fill('My Squad')
    await page.getByRole('button', { name: 'Create Team' }).click()

    await expect(page.getByText('Failed to create team. Please try again.')).toBeVisible()
  })

  test('join team navigates to /team/:code when team is found', async ({ page }) => {
    await setupWelcomeMocks(page, { joinTeam: mockTeam })

    await page.getByPlaceholder('e.g. eha-x7k2').fill(TEAM_CODE)
    await page.getByRole('button', { name: 'Join My Team' }).click()

    await expect(page).toHaveURL(`/team/${TEAM_CODE}`)
  })

  test('join team shows error when team code is not found', async ({ page }) => {
    await setupWelcomeMocks(page, { joinTeam: null })

    await page.getByPlaceholder('e.g. eha-x7k2').fill('bad-code')
    await page.getByRole('button', { name: 'Join My Team' }).click()

    await expect(page.getByText('Team not found. Check the code and try again.')).toBeVisible()
  })

  test('create team button is disabled while request is in flight', async ({ page }) => {
    // Delay the response so we can catch the loading state
    await page.route('**/rest/v1/teams**', async (route) => {
      await new Promise((r) => setTimeout(r, 300))
      await route.fulfill({ status: 201, contentType: 'application/json', body: '[]' })
    })

    await page.getByPlaceholder('e.g. Alpha Squad').fill('Slow Team')
    await page.getByRole('button', { name: 'Create Team' }).click()

    await expect(page.getByRole('button', { name: 'Creating…' })).toBeDisabled()
  })

  test('create form requires a non-empty team name (HTML validation)', async ({ page }) => {
    // Click submit with empty input — the browser's required attribute should
    // prevent submission and there should be no navigation
    await page.getByRole('button', { name: 'Create Team' }).click()
    await expect(page).toHaveURL('/')
  })
})
