import { test, expect } from '@playwright/test'
import { setupTeamMocks, TEAM_CODE, mockSprint, mockMembers } from './helpers/mock.js'

const TEAM_URL = `/team/${TEAM_CODE}`

test.describe('Dashboard', () => {
  test('shows page title and team info', async ({ page }) => {
    await setupTeamMocks(page)
    await page.goto(TEAM_URL)

    await expect(page.getByRole('heading', { name: 'Sprint Dashboard' })).toBeVisible()
    await expect(page.getByText(`Test Team Alpha · ${TEAM_CODE}`)).toBeVisible()
  })

  test('shows empty state when team has no sprints', async ({ page }) => {
    await setupTeamMocks(page, { sprints: [] })
    await page.goto(TEAM_URL)

    // Scope to the main content area to avoid matching the SprintSelector <option>
    await expect(page.locator('main p').filter({ hasText: 'No sprints yet' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Create Your First Sprint' })).toBeVisible()
  })

  test('opens sprint creation form when clicking New Sprint', async ({ page }) => {
    await setupTeamMocks(page)
    await page.goto(TEAM_URL)

    // SprintSelector renders a "+ New Sprint" button
    await page.getByRole('button', { name: /New Sprint/i }).click()

    await expect(page.getByText('Create New Sprint')).toBeVisible()
    await expect(page.getByPlaceholder('e.g. Sprint 12')).toBeVisible()
  })

  test('sprint creation form has all required fields', async ({ page }) => {
    await setupTeamMocks(page)
    await page.goto(TEAM_URL)

    await page.getByRole('button', { name: /New Sprint/i }).click()

    await expect(page.getByPlaceholder('e.g. Sprint 12')).toBeVisible()
    await expect(page.getByPlaceholder('e.g. Launch user auth module')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Create Sprint' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Cancel' })).toBeVisible()
  })

  test('cancel button hides the sprint creation form', async ({ page }) => {
    await setupTeamMocks(page)
    await page.goto(TEAM_URL)

    await page.getByRole('button', { name: /New Sprint/i }).click()
    await expect(page.getByText('Create New Sprint')).toBeVisible()

    await page.getByRole('button', { name: 'Cancel' }).click()
    await expect(page.getByText('Create New Sprint')).not.toBeVisible()
  })

  test('creates a sprint and closes the form on success', async ({ page }) => {
    await setupTeamMocks(page, { sprints: [] })
    await page.goto(TEAM_URL)

    await page.getByRole('button', { name: 'Create Your First Sprint' }).click()
    await page.getByPlaceholder('e.g. Sprint 12').fill('Sprint 42')
    await page.getByRole('button', { name: 'Create Sprint' }).click()

    // Form disappears after a successful creation
    await expect(page.getByText('Create New Sprint')).not.toBeVisible()
  })

  test('shows sprint info panel when a sprint is active', async ({ page }) => {
    await setupTeamMocks(page)
    await page.goto(TEAM_URL)

    // The sprint name is rendered as an h2 inside the info panel
    await expect(page.getByRole('heading', { name: mockSprint.name, level: 2 })).toBeVisible()
    // Active badge — use exact to avoid matching the "(Active)" text in the selector option
    await expect(page.getByText('Active', { exact: true })).toBeVisible()
    // Sprint dates
    await expect(page.getByText('2024-01-08')).toBeVisible()
    await expect(page.getByText('2024-01-19')).toBeVisible()
  })

  test('shows five capacity metric cards', async ({ page }) => {
    await setupTeamMocks(page)
    await page.goto(TEAM_URL)

    await expect(page.getByText('Total Capacity')).toBeVisible()
    await expect(page.getByText('Adjusted Capacity')).toBeVisible()
    await expect(page.getByText('Target Capacity')).toBeVisible()
    await expect(page.getByText('Assigned SP', { exact: true }).first()).toBeVisible()
    await expect(page.getByText('Available for New Work')).toBeVisible()
  })

  test('capacity cards show correct totals', async ({ page }) => {
    // 2 members × 15 SP = 30 total capacity
    await setupTeamMocks(page)
    await page.goto(TEAM_URL)

    await expect(page.getByText('2 members × 15 SP')).toBeVisible()
  })

  test('shows team capacity table with member rows', async ({ page }) => {
    await setupTeamMocks(page)
    await page.goto(TEAM_URL)

    for (const m of mockMembers) {
      await expect(page.getByText(m.name)).toBeVisible()
    }
  })

  test('sprint creation form requires a sprint name', async ({ page }) => {
    await setupTeamMocks(page, { sprints: [] })
    await page.goto(TEAM_URL)

    await page.getByRole('button', { name: 'Create Your First Sprint' }).click()
    // Submit without filling in the name — browser required attr blocks submission
    await page.getByRole('button', { name: 'Create Sprint' }).click()

    // Form stays open
    await expect(page.getByPlaceholder('e.g. Sprint 12')).toBeVisible()
  })

  test('working days are shown after setting start and end dates', async ({ page }) => {
    await setupTeamMocks(page, { sprints: [] })
    await page.goto(TEAM_URL)

    await page.getByRole('button', { name: 'Create Your First Sprint' }).click()
    await page.locator('input[type="date"]').first().fill('2024-01-08')
    await page.locator('input[type="date"]').nth(1).fill('2024-01-19')

    // calcWorkingDays(2024-01-08, 2024-01-19) = 10 working days
    await expect(page.getByText(/10 working day/)).toBeVisible()
  })
})
