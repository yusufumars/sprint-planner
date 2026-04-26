import { test, expect } from '@playwright/test'
import { setupTeamMocks, TEAM_CODE, mockSprint, mockCompletedSprint } from './helpers/mock.js'

const VELOCITY_URL = `/team/${TEAM_CODE}/velocity`

test.describe('Velocity', () => {
  test('shows page title', async ({ page }) => {
    await setupTeamMocks(page)
    await page.goto(VELOCITY_URL)

    await expect(page.getByRole('heading', { name: 'Velocity' })).toBeVisible()
    await expect(page.getByText('Track sprint performance over time')).toBeVisible()
  })

  test('shows three metric cards', async ({ page }) => {
    await setupTeamMocks(page)
    await page.goto(VELOCITY_URL)

    // Use exact: true — "Avg Velocity" is also a substring of "Based on avg velocity"
    await expect(page.getByText('Avg Velocity', { exact: true })).toBeVisible()
    await expect(page.getByText('Current Sprint', { exact: true })).toBeVisible()
    await expect(page.getByText('Suggested Next', { exact: true })).toBeVisible()
  })

  test('shows current sprint name in the highlighted card', async ({ page }) => {
    await setupTeamMocks(page)
    await page.goto(VELOCITY_URL)

    // The centre card has the lime yellow background; sprint name appears multiple
    // times on this page — first() targets the card at the top
    await expect(page.getByText(mockSprint.name, { exact: true }).first()).toBeVisible()
  })

  test('shows "—" when there are no completed sprints', async ({ page }) => {
    await setupTeamMocks(page)
    await page.goto(VELOCITY_URL)

    // No completed sprints → Avg Velocity shows "—"
    await expect(page.getByText('—').first()).toBeVisible()
  })

  test('shows velocity chart with bar columns', async ({ page }) => {
    await setupTeamMocks(page)
    await page.goto(VELOCITY_URL)

    // VelocityChart is div-based (not SVG); check for its heading text
    await expect(page.getByText('Committed vs Completed — Last 5 Sprints')).toBeVisible()
  })

  test('shows "All Sprints" table heading', async ({ page }) => {
    await setupTeamMocks(page)
    await page.goto(VELOCITY_URL)

    await expect(page.getByText('All Sprints')).toBeVisible()
  })

  test('shows "No sprints yet" when team has no sprints', async ({ page }) => {
    await setupTeamMocks(page, { sprints: [] })
    await page.goto(VELOCITY_URL)

    await expect(page.getByText('No sprints yet.')).toBeVisible()
  })

  test('shows sprint rows in the table', async ({ page }) => {
    await setupTeamMocks(page)
    await page.goto(VELOCITY_URL)

    // Scope to the table to avoid ambiguity with the chart and metric card
    await expect(page.getByRole('table').getByText(mockSprint.name)).toBeVisible()
    await expect(page.getByRole('table').getByText(mockSprint.goal)).toBeVisible()
  })

  test('shows Active badge for active sprints', async ({ page }) => {
    await setupTeamMocks(page)
    await page.goto(VELOCITY_URL)

    // Active badge is in the status column of the table
    await expect(page.getByRole('table').getByText('Active')).toBeVisible()
  })

  test('shows "Mark Complete" action for active sprints', async ({ page }) => {
    await setupTeamMocks(page)
    await page.goto(VELOCITY_URL)

    await expect(page.getByText('Mark Complete')).toBeVisible()
  })

  test('Mark Complete opens an input for entering completed points', async ({ page }) => {
    await setupTeamMocks(page)
    await page.goto(VELOCITY_URL)

    await page.getByText('Mark Complete').click()

    await expect(page.getByRole('button', { name: 'Save' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Cancel' })).toBeVisible()
  })

  test('cancelling Mark Complete restores the button', async ({ page }) => {
    await setupTeamMocks(page)
    await page.goto(VELOCITY_URL)

    await page.getByText('Mark Complete').click()
    await page.getByRole('button', { name: 'Cancel' }).click()

    await expect(page.getByText('Mark Complete')).toBeVisible()
  })

  test('completing a sprint updates its row status', async ({ page }) => {
    await setupTeamMocks(page)
    await page.goto(VELOCITY_URL)

    await page.getByText('Mark Complete').click()
    await page.locator('input[type="number"][placeholder="0"]').fill('25')
    await page.getByRole('button', { name: 'Save' }).click()

    // Status badge in the table body changes to "Completed"
    await expect(page.locator('tbody').getByText('Completed')).toBeVisible()
  })

  test('shows completed sprint in the table', async ({ page }) => {
    await setupTeamMocks(page, {
      sprints: [mockCompletedSprint],
      sprintAvailability: [
        { sprint_id: 'sprint-uuid-2', member_id: 'member-uuid-1', assigned_points: 15 },
        { sprint_id: 'sprint-uuid-2', member_id: 'member-uuid-2', assigned_points: 20 },
      ],
    })
    await page.goto(VELOCITY_URL)

    await expect(page.locator('tbody').getByText('Completed')).toBeVisible()
    await expect(page.getByRole('table').getByText('Sprint 2')).toBeVisible()
  })
})
