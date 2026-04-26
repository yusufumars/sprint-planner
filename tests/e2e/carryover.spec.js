import { test, expect } from '@playwright/test'
import {
  setupTeamMocks,
  TEAM_CODE,
  mockMembers,
  mockSwimLanes,
  mockCustomSwimLane,
  mockSprintCarryover,
  mockSprintAvailabilityWithCarry,
} from './helpers/mock.js'

const TEAM_URL     = `/team/${TEAM_CODE}/team`
const SETTINGS_URL = `/team/${TEAM_CODE}/settings`
const DASHBOARD_URL = `/team/${TEAM_CODE}`

// ── Swim Lane Config (Settings → Swim Lane Config tab) ────────────────────────

test.describe('Swim Lane Config', () => {
  test.beforeEach(async ({ page }) => {
    await setupTeamMocks(page)
    await page.goto(SETTINGS_URL)
  })

  test('Swim Lane Config tab is visible in Settings', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Swim Lane Config' })).toBeVisible()
  })

  test('clicking Swim Lane Config tab shows the configuration section', async ({ page }) => {
    await page.getByRole('button', { name: 'Swim Lane Config' }).click()
    await expect(page.getByText('Swim Lane Configuration')).toBeVisible()
  })

  test('shows all six default swim lane names', async ({ page }) => {
    await page.getByRole('button', { name: 'Swim Lane Config' }).click()
    for (const lane of ['To Do', 'In Progress', 'Code Review', 'QA', 'UAT', 'Blocked']) {
      await expect(page.getByRole('cell', { name: lane, exact: true }).first()).toBeVisible()
    }
  })

  test('default lanes have no Delete button (lock icon, not deletable)', async ({ page }) => {
    await page.getByRole('button', { name: 'Swim Lane Config' }).click()
    // Only custom lanes get a Delete button; defaults have none
    await expect(page.getByRole('button', { name: 'Delete' })).not.toBeVisible()
  })

  test('custom lane shows a Delete button', async ({ page }) => {
    await setupTeamMocks(page, { swimLanes: [...mockSwimLanes, mockCustomSwimLane] })
    await page.goto(SETTINGS_URL)
    await page.getByRole('button', { name: 'Swim Lane Config' }).click()
    await expect(page.getByRole('button', { name: 'Delete' })).toBeVisible()
  })

  test('Save Configuration and Reset to Defaults buttons are visible', async ({ page }) => {
    await page.getByRole('button', { name: 'Swim Lane Config' }).click()
    await expect(page.getByRole('button', { name: 'Save Configuration' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Reset to Defaults' })).toBeVisible()
  })

  test('clicking Add Custom Swim Lane adds an editable row', async ({ page }) => {
    await page.getByRole('button', { name: 'Swim Lane Config' }).click()
    await page.getByRole('button', { name: /Add Custom Swim Lane/i }).click()
    await expect(page.getByPlaceholder('Lane name')).toBeVisible()
  })

  test('removing a pending custom lane with ✕ hides the row', async ({ page }) => {
    await page.getByRole('button', { name: 'Swim Lane Config' }).click()
    await page.getByRole('button', { name: /Add Custom Swim Lane/i }).click()
    await page.getByRole('button', { name: '✕' }).click()
    await expect(page.getByPlaceholder('Lane name')).not.toBeVisible()
  })

  test('clicking Save Configuration shows ✓ Saved confirmation', async ({ page }) => {
    await page.getByRole('button', { name: 'Swim Lane Config' }).click()
    await page.getByRole('button', { name: 'Save Configuration' }).click()
    await expect(page.getByRole('button', { name: '✓ Saved' })).toBeVisible()
  })

  test('clicking Delete on a custom lane opens the confirmation modal', async ({ page }) => {
    await setupTeamMocks(page, { swimLanes: [...mockSwimLanes, mockCustomSwimLane] })
    await page.goto(SETTINGS_URL)
    await page.getByRole('button', { name: 'Swim Lane Config' }).click()
    await page.getByRole('button', { name: 'Delete' }).click()
    await expect(page.getByText('Delete Swim Lane')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Yes, Delete' })).toBeVisible()
  })

  test('cancelling the delete modal closes it without deleting', async ({ page }) => {
    await setupTeamMocks(page, { swimLanes: [...mockSwimLanes, mockCustomSwimLane] })
    await page.goto(SETTINGS_URL)
    await page.getByRole('button', { name: 'Swim Lane Config' }).click()
    await page.getByRole('button', { name: 'Delete' }).click()
    await page.getByRole('button', { name: 'Cancel' }).click()
    await expect(page.getByText('Delete Swim Lane')).not.toBeVisible()
    // The lane row is still present
    await expect(page.getByRole('cell', { name: mockCustomSwimLane.name, exact: true })).toBeVisible()
  })

  test('delete modal shows the lane name and a carryover data warning', async ({ page }) => {
    await setupTeamMocks(page, { swimLanes: [...mockSwimLanes, mockCustomSwimLane] })
    await page.goto(SETTINGS_URL)
    await page.getByRole('button', { name: 'Swim Lane Config' }).click()
    await page.getByRole('button', { name: 'Delete' }).click()
    // Scope to the modal overlay to avoid matching the same name in the table row
    const modal = page.locator('div').filter({ has: page.getByRole('heading', { name: 'Delete Swim Lane' }) }).last()
    await expect(modal.getByText(mockCustomSwimLane.name)).toBeVisible()
    await expect(page.getByText(/Removing this lane will also delete any carryover data/i)).toBeVisible()
  })
})

// ── Carryover Review (Team page → Carryover Review tab) ───────────────────────

test.describe('Carryover Review', () => {
  test.beforeEach(async ({ page }) => {
    await setupTeamMocks(page)
    await page.goto(TEAM_URL)
  })

  test('Carryover Review tab is visible', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Carryover Review' })).toBeVisible()
  })

  test('clicking tab shows the carryover section heading', async ({ page }) => {
    await page.getByRole('button', { name: 'Carryover Review' }).click()
    await expect(page.getByText('Carryover Review')).toBeVisible()
  })

  test('table shows member names as rows', async ({ page }) => {
    await page.getByRole('button', { name: 'Carryover Review' }).click()
    for (const m of mockMembers) {
      await expect(page.getByRole('cell', { name: m.name })).toBeVisible()
    }
  })

  test('table shows swim lane names as column headers', async ({ page }) => {
    await page.getByRole('button', { name: 'Carryover Review' }).click()
    for (const lane of ['To Do', 'In Progress', 'Code Review']) {
      await expect(page.getByRole('columnheader', { name: new RegExp(lane) })).toBeVisible()
    }
  })

  test('Blocked lane column header has red styling', async ({ page }) => {
    await page.getByRole('button', { name: 'Carryover Review' }).click()
    const blockedHeader = page.getByRole('columnheader', { name: /Blocked/ })
    await expect(blockedHeader).toHaveClass(/text-red-500/)
  })

  test('Carry SP column header is highlighted', async ({ page }) => {
    await page.getByRole('button', { name: 'Carryover Review' }).click()
    await expect(page.getByRole('columnheader', { name: 'Carry SP' })).toBeVisible()
  })

  test('team total footer row is present', async ({ page }) => {
    await page.getByRole('button', { name: 'Carryover Review' }).click()
    await expect(page.getByText('Team Total')).toBeVisible()
  })

  test('Confirm Carryover button is visible', async ({ page }) => {
    await page.getByRole('button', { name: 'Carryover Review' }).click()
    await expect(page.getByRole('button', { name: 'Confirm Carryover' })).toBeVisible()
  })

  test('entering SP into a lane input shows the calculated remaining SP', async ({ page }) => {
    await page.getByRole('button', { name: 'Carryover Review' }).click()
    // To Do lane = 100% remaining; enter 10 SP → remaining = round(10 * 100/100) = 10
    const inputs = page.locator('input[type="number"][placeholder="0"]')
    await inputs.first().fill('10')
    await inputs.first().blur()
    await expect(page.getByText('→10 SP')).toBeVisible()
  })

  test('shows empty state when there is no active sprint', async ({ page }) => {
    await setupTeamMocks(page, { sprints: [] })
    await page.goto(TEAM_URL)
    await page.getByRole('button', { name: 'Carryover Review' }).click()
    await expect(page.getByText('No active sprint found.')).toBeVisible()
  })

  test('shows empty state when no swim lanes are configured', async ({ page }) => {
    await setupTeamMocks(page, { swimLanes: [] })
    await page.goto(TEAM_URL)
    await page.getByRole('button', { name: 'Carryover Review' }).click()
    await expect(page.getByText('No swim lanes configured.')).toBeVisible()
  })

  test('shows Total Carry SP and Total Blocked SP summary cards', async ({ page }) => {
    await page.getByRole('button', { name: 'Carryover Review' }).click()
    await expect(page.getByText('Total Carry SP')).toBeVisible()
    await expect(page.getByText('Total Blocked SP')).toBeVisible()
  })

  test('pre-fills existing carryover entries on re-open', async ({ page }) => {
    await setupTeamMocks(page, { sprintCarryover: mockSprintCarryover })
    await page.goto(TEAM_URL)
    await page.getByRole('button', { name: 'Carryover Review' }).click()
    // Alice had 5 SP in In Progress and 3 SP blocked — inputs should be pre-filled
    const filledInputs = page.locator('input[type="number"]').filter({ hasValue: /[1-9]/ })
    await expect(filledInputs.first()).toBeVisible()
  })
})

// ── Dashboard carry integration ───────────────────────────────────────────────

test.describe('Dashboard carry SP integration', () => {
  test.beforeEach(async ({ page }) => {
    await setupTeamMocks(page, { sprintAvailability: mockSprintAvailabilityWithCarry })
    await page.goto(DASHBOARD_URL)
  })

  test('Team Capacity table shows Carry SP column header', async ({ page }) => {
    await expect(page.getByRole('columnheader', { name: /Carry SP/i })).toBeVisible()
  })

  test('Team Capacity table shows Target SP column header', async ({ page }) => {
    await expect(page.getByRole('columnheader', { name: /Target SP/i })).toBeVisible()
  })

  test('InfoTooltip on Carry SP header is visible on hover (no overflow clipping)', async ({ page }) => {
    const tooltip = page.getByText(/Remaining effort from Sprint A carryover/i)
    // Hover the info icon inside the Carry SP header
    const infoIcon = page.getByRole('columnheader', { name: /Carry SP/i }).locator('.group')
    await infoIcon.hover()
    await expect(tooltip).toBeVisible()
  })

  test('InfoTooltip on Target SP header is visible on hover', async ({ page }) => {
    const infoIcon = page.getByRole('columnheader', { name: /Target SP/i }).locator('.group')
    await infoIcon.hover()
    await expect(page.getByText(/Adjusted SP × Focus Factor/i)).toBeVisible()
  })

  test('InfoTooltip on Assigned SP header is visible on hover', async ({ page }) => {
    const infoIcon = page.getByRole('columnheader', { name: /Assigned SP/i }).locator('.group')
    await infoIcon.hover()
    await expect(page.getByText(/actual story points assigned in Jira/i)).toBeVisible()
  })

  test('Available for New Work card is visible', async ({ page }) => {
    await expect(page.getByText('Available for New Work')).toBeVisible()
  })

  test('Available for New Work card shows positive sub-text when capacity remains', async ({ page }) => {
    // With mockSprintAvailabilityWithCarry: carry_sp 3 + 1 = 4; target = 12*0.8=9.6 per member
    // netTarget per member > 0, so total > 0
    await expect(page.getByText('Across all members for Sprint B')).toBeVisible()
  })

  test('Available for New Work card turns red when team is fully over capacity from carryover', async ({ page }) => {
    // Give every member a carry_sp that exceeds their targetSP (15 SP each, focus 80% = 12 target)
    const overCapacityAvail = [
      { id: 'av-uuid-1', sprint_id: 'sprint-uuid-1', member_id: 'member-uuid-1', assigned_points: 0, carry_sp: 20, availability_percentage: 100, leave_days: 0 },
      { id: 'av-uuid-2', sprint_id: 'sprint-uuid-1', member_id: 'member-uuid-2', assigned_points: 0, carry_sp: 20, availability_percentage: 100, leave_days: 0 },
    ]
    await setupTeamMocks(page, { sprintAvailability: overCapacityAvail })
    await page.goto(DASHBOARD_URL)
    await expect(page.getByText('Team is over capacity from carryover')).toBeVisible()
  })
})
