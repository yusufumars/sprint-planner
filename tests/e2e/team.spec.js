import { test, expect } from '@playwright/test'
import { setupTeamMocks, TEAM_CODE, mockMembers } from './helpers/mock.js'

const TEAM_URL = `/team/${TEAM_CODE}/team`

test.describe('Team Management', () => {
  test.beforeEach(async ({ page }) => {
    await setupTeamMocks(page)
    await page.goto(TEAM_URL)
  })

  test('shows page title', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Team Management' })).toBeVisible()
  })

  test('Members tab is active by default', async ({ page }) => {
    const membersTab = page.getByRole('button', { name: 'Members' })
    await expect(membersTab).toHaveClass(/bg-\[#BFFF00\]/)
  })

  test('shows add member form on the Members tab', async ({ page }) => {
    await expect(page.getByText('Add Team Member')).toBeVisible()
    await expect(page.getByPlaceholder('Member name')).toBeVisible()
    // Use exact: true — the header also has a "+ Add Member" button
    await expect(page.getByRole('button', { name: 'Add Member', exact: true })).toBeVisible()
  })

  test('shows existing team members in the list', async ({ page }) => {
    for (const m of mockMembers) {
      await expect(page.getByText(m.name)).toBeVisible()
    }
  })

  test('shows member count in section header', async ({ page }) => {
    await expect(page.getByText(`Team Members (${mockMembers.length})`)).toBeVisible()
  })

  test('shows member roles', async ({ page }) => {
    // Scope to the table so we don't match hidden <option> elements in the role selects
    await expect(page.getByRole('table').getByText('Software Engineer Lead', { exact: true })).toBeVisible()
    await expect(page.getByRole('table').getByText('Senior Software Engineer', { exact: true })).toBeVisible()
  })

  test('shows allocation dropdowns for each member', async ({ page }) => {
    // Each member row has an allocation % select
    const allocationSelects = page.locator('table select')
    await expect(allocationSelects).toHaveCount(mockMembers.length)
  })

  test('can add a new team member', async ({ page }) => {
    await page.getByPlaceholder('Member name').fill('Carol White')
    await page.getByRole('button', { name: 'Add Member', exact: true }).click()

    // The mock returns a member with the submitted name
    await expect(page.getByText('Carol White')).toBeVisible()
  })

  test('add member form requires a name (HTML validation)', async ({ page }) => {
    await page.getByRole('button', { name: 'Add Member', exact: true }).click()
    // Required attribute blocks submission; page stays the same
    await expect(page).toHaveURL(TEAM_URL)
  })

  test('clicking Edit shows inline edit inputs for a member', async ({ page }) => {
    await page.getByRole('button', { name: 'Edit' }).first().click()

    // Save and Cancel buttons appear in edit mode
    await expect(page.getByRole('button', { name: 'Save' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Cancel' }).first()).toBeVisible()
  })

  test('clicking Cancel in edit mode restores the row', async ({ page }) => {
    await page.getByRole('button', { name: 'Edit' }).first().click()
    await page.getByRole('button', { name: 'Cancel' }).first().click()

    // Back to read mode — Edit button visible again
    await expect(page.getByRole('button', { name: 'Edit' }).first()).toBeVisible()
  })

  test('clicking Remove shows a confirmation prompt', async ({ page }) => {
    await page.getByRole('button', { name: 'Remove' }).first().click()

    await expect(page.getByRole('button', { name: 'Confirm' })).toBeVisible()
  })

  test('cancelling Remove confirmation hides the prompt', async ({ page }) => {
    await page.getByRole('button', { name: 'Remove' }).first().click()
    await page.getByRole('button', { name: 'Cancel' }).first().click()

    // Confirmation gone; Remove button visible again
    await expect(page.getByRole('button', { name: 'Remove' }).first()).toBeVisible()
  })

  test('clicking the Leave & Holidays tab switches the view', async ({ page }) => {
    await page.getByRole('button', { name: 'Leave & Holidays' }).click()

    await expect(page.getByRole('button', { name: 'Leave & Holidays' })).toHaveClass(/bg-\[#BFFF00\]/)
  })

  test('shows empty state when there are no members', async ({ page }) => {
    await setupTeamMocks(page, { members: [] })
    await page.goto(TEAM_URL)

    await expect(page.getByText('No members yet. Add your first team member above.')).toBeVisible()
  })

  test('+ Add Member header button focuses the name input', async ({ page }) => {
    await page.getByRole('button', { name: '+ Add Member' }).click()

    const nameInput = page.getByPlaceholder('Member name')
    await expect(nameInput).toBeFocused()
  })
})
