/**
 * Shared mock data and Supabase API interceptors for Playwright tests.
 *
 * SprintIQ talks to Supabase over REST (PostgREST). Every test that visits
 * a /team/:code route must call setupTeamMocks() before navigating so the
 * app never hits the real database.
 */

export const TEAM_CODE = 'test-abc-1234'

export const mockTeam = {
  id: 'team-uuid-test',
  team_code: TEAM_CODE,
  name: 'Test Team Alpha',
  default_story_points: 15,
  default_focus_factor: 80,
  default_sprint_length: 14,
  onboarding_completed: true,
  created_at: '2024-01-01T00:00:00.000Z',
}

export const mockMembers = [
  {
    id: 'member-uuid-1',
    team_id: 'team-uuid-test',
    name: 'Alice Smith',
    role: 'Software Engineer Lead',
    allocation_percentage: 100,
    created_at: '2024-01-01T00:00:00.000Z',
  },
  {
    id: 'member-uuid-2',
    team_id: 'team-uuid-test',
    name: 'Bob Jones',
    role: 'Senior Software Engineer',
    allocation_percentage: 100,
    created_at: '2024-01-02T00:00:00.000Z',
  },
]

export const mockSprint = {
  id: 'sprint-uuid-1',
  team_id: 'team-uuid-test',
  name: 'Sprint 1',
  goal: 'Launch auth module',
  start_date: '2024-01-08',
  end_date: '2024-01-19',
  story_points_per_member: 15,
  focus_factor: 80,
  is_active: true,
  completed_points: null,
  created_at: '2024-01-01T00:00:00.000Z',
}

export const mockCompletedSprint = {
  ...mockSprint,
  id: 'sprint-uuid-2',
  name: 'Sprint 2',
  is_active: false,
  completed_points: 28,
}

export const mockSwimLanes = [
  { id: 'lane-uuid-1', team_id: 'team-uuid-test', name: 'To Do',        remaining_percentage: 100, description: 'Work not yet started',                    is_default: true,  is_active: true, sort_order: 1 },
  { id: 'lane-uuid-2', team_id: 'team-uuid-test', name: 'In Progress',  remaining_percentage: 65,  description: 'Actively being worked on',                is_default: true,  is_active: true, sort_order: 2 },
  { id: 'lane-uuid-3', team_id: 'team-uuid-test', name: 'Code Review',  remaining_percentage: 25,  description: 'Awaiting or in code review',              is_default: true,  is_active: true, sort_order: 3 },
  { id: 'lane-uuid-4', team_id: 'team-uuid-test', name: 'QA',           remaining_percentage: 15,  description: 'In quality assurance testing',            is_default: true,  is_active: true, sort_order: 4 },
  { id: 'lane-uuid-5', team_id: 'team-uuid-test', name: 'UAT',          remaining_percentage: 10,  description: 'In user acceptance testing',              is_default: true,  is_active: true, sort_order: 5 },
  { id: 'lane-uuid-6', team_id: 'team-uuid-test', name: 'Blocked',      remaining_percentage: 1,   description: 'Blocked — tracked separately from carry', is_default: true,  is_active: true, sort_order: 6 },
]

export const mockCustomSwimLane = {
  id: 'lane-uuid-7', team_id: 'team-uuid-test', name: 'Design Review', remaining_percentage: 40,
  description: 'Design sign-off pending', is_default: false, is_active: true, sort_order: 7,
}

// sprint_carryover rows: Alice has 5 SP in In Progress + 3 SP blocked; Bob has 4 SP in Code Review
export const mockSprintCarryover = [
  { id: 'carry-uuid-1', sprint_id: 'sprint-uuid-1', member_id: 'member-uuid-1', swim_lane_id: 'lane-uuid-2', entered_sp: 5, remaining_sp: 3, is_blocked: false },
  { id: 'carry-uuid-2', sprint_id: 'sprint-uuid-1', member_id: 'member-uuid-1', swim_lane_id: 'lane-uuid-6', entered_sp: 3, remaining_sp: 0, is_blocked: true  },
  { id: 'carry-uuid-3', sprint_id: 'sprint-uuid-1', member_id: 'member-uuid-2', swim_lane_id: 'lane-uuid-3', entered_sp: 4, remaining_sp: 1, is_blocked: false },
]

// sprint_availability with carry_sp already confirmed
export const mockSprintAvailabilityWithCarry = [
  { id: 'av-uuid-1', sprint_id: 'sprint-uuid-1', member_id: 'member-uuid-1', assigned_points: 8, carry_sp: 3, availability_percentage: 100, leave_days: 0 },
  { id: 'av-uuid-2', sprint_id: 'sprint-uuid-1', member_id: 'member-uuid-2', assigned_points: 6, carry_sp: 1, availability_percentage: 100, leave_days: 0 },
]

/**
 * Returns a 200/201 response for a GET or write against a Supabase table.
 * Handles single-object requests (Accept: application/vnd.pgrst.object+json)
 * and array requests correctly.
 */
function fulfill(route, { rows = [], single = null, status = 200 } = {}) {
  const accept = route.request().headers()['accept'] || ''
  const wantsSingle = accept.includes('vnd.pgrst.object')

  if (wantsSingle) {
    return route.fulfill({
      status: single ? 200 : 406,
      contentType: 'application/vnd.pgrst.object+json',
      body: JSON.stringify(
        single ?? { message: 'JSON object requested, multiple (or no) rows returned', code: 'PGRST116' }
      ),
    })
  }

  return route.fulfill({
    status,
    contentType: 'application/json',
    headers: { 'Content-Range': rows.length ? `0-${rows.length - 1}/${rows.length}` : '*/*' },
    body: JSON.stringify(rows),
  })
}

/**
 * Set up all Supabase REST mocks needed for a team page (Dashboard / Team /
 * Velocity / Settings). Call this inside test.beforeEach or at the top of
 * a test, before page.goto().
 */
export async function setupTeamMocks(page, {
  team = mockTeam,
  members = mockMembers,
  sprints = [mockSprint],
  sprintAvailability = [],
  leaveEntries = [],
  publicHolidays = [],
  swimLanes = mockSwimLanes,
  sprintCarryover = [],
} = {}) {
  // ── teams ────────────────────────────────────────────────────────────────
  await page.route('**/rest/v1/teams**', async (route) => {
    const method = route.request().method()
    if (method === 'GET') {
      return fulfill(route, { rows: [team], single: team })
    }
    if (method === 'PATCH' || method === 'POST') {
      return route.fulfill({ status: 204, body: '' })
    }
    return route.continue()
  })

  // ── team_members ─────────────────────────────────────────────────────────
  await page.route('**/rest/v1/team_members**', async (route) => {
    const method = route.request().method()
    if (method === 'GET') {
      return fulfill(route, { rows: members })
    }
    if (method === 'POST') {
      let body = {}
      try { body = JSON.parse(route.request().postData() || '{}') } catch { /* ignore */ }
      const created = {
        id: 'member-uuid-new',
        team_id: team.id,
        name: body.name || 'New Member',
        role: body.role || 'Software Engineer Lead',
        allocation_percentage: 100,
        created_at: new Date().toISOString(),
      }
      return fulfill(route, { rows: [created], single: created, status: 201 })
    }
    if (method === 'PATCH' || method === 'DELETE') {
      return route.fulfill({ status: 204, body: '' })
    }
    return route.continue()
  })

  // ── sprints ───────────────────────────────────────────────────────────────
  await page.route('**/rest/v1/sprints**', async (route) => {
    const method = route.request().method()
    if (method === 'GET') {
      return fulfill(route, { rows: sprints })
    }
    if (method === 'POST') {
      let body = {}
      try { body = JSON.parse(route.request().postData() || '{}') } catch { /* ignore */ }
      const created = {
        ...mockSprint,
        id: 'sprint-uuid-new',
        name: body.name || 'New Sprint',
        goal: body.goal || '',
      }
      return fulfill(route, { rows: [created], single: created, status: 201 })
    }
    if (method === 'PATCH') {
      return route.fulfill({ status: 204, body: '' })
    }
    return route.continue()
  })

  // ── sprint_availability ───────────────────────────────────────────────────
  await page.route('**/rest/v1/sprint_availability**', async (route) => {
    const method = route.request().method()
    if (method === 'GET') {
      return fulfill(route, { rows: sprintAvailability })
    }
    if (method === 'POST' || method === 'PATCH') {
      return route.fulfill({ status: 204, body: '' })
    }
    return route.continue()
  })

  // ── member_leave ──────────────────────────────────────────────────────────
  await page.route('**/rest/v1/member_leave**', async (route) => {
    const method = route.request().method()
    if (method === 'GET') {
      return fulfill(route, { rows: leaveEntries })
    }
    if (method === 'POST' || method === 'DELETE') {
      return route.fulfill({ status: 204, body: '' })
    }
    return route.continue()
  })

  // ── public_holidays ───────────────────────────────────────────────────────
  await page.route('**/rest/v1/public_holidays**', async (route) => {
    const method = route.request().method()
    if (method === 'GET') {
      return fulfill(route, { rows: publicHolidays })
    }
    if (method === 'POST' || method === 'DELETE') {
      return route.fulfill({ status: 204, body: '' })
    }
    return route.continue()
  })

  // ── swim_lanes ────────────────────────────────────────────────────────────
  await page.route('**/rest/v1/swim_lanes**', async (route) => {
    const method = route.request().method()
    if (method === 'GET') {
      return fulfill(route, { rows: swimLanes })
    }
    if (method === 'POST' || method === 'PATCH' || method === 'DELETE') {
      return route.fulfill({ status: 204, body: '' })
    }
    return route.continue()
  })

  // ── sprint_carryover ──────────────────────────────────────────────────────
  await page.route('**/rest/v1/sprint_carryover**', async (route) => {
    const method = route.request().method()
    if (method === 'GET') {
      return fulfill(route, { rows: sprintCarryover })
    }
    if (method === 'POST' || method === 'DELETE') {
      return route.fulfill({ status: 204, body: '' })
    }
    return route.continue()
  })
}

/**
 * Mock just the teams table for the Welcome page (create/join flows).
 */
export async function setupWelcomeMocks(page, {
  createSuccess = true,
  joinTeam = null,   // null → "not found"; pass a team object to simulate a found team
} = {}) {
  await page.route('**/rest/v1/teams**', async (route) => {
    const method = route.request().method()

    if (method === 'POST') {
      if (createSuccess) {
        return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify([]) })
      }
      return route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ message: 'Internal error' }) })
    }

    if (method === 'GET') {
      return fulfill(route, {
        rows: joinTeam ? [joinTeam] : [],
        single: joinTeam ?? null,
      })
    }

    return route.continue()
  })
}
