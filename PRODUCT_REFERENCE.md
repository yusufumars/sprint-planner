# SprintIQ — Product Reference Document

**Version:** v1.1  
**Date:** 2026-04-26  
**Branch:** feature/sprint-carryover  
**Last commit:** `6fbe230` — fix: tooltip rendering behind table body rows

---

## 1. Product Overview

**SprintIQ** is a smart sprint planning web app for agile teams. It is not a full project management tool — it is focused specifically on **capacity planning**: helping teams figure out how many story points they can realistically commit to in a sprint, accounting for leave, public holidays, focus factor, and individual allocation.

Core value props:
- Calculate per-member and total sprint capacity automatically
- Track sprint velocity over time
- Manage team leave and public holidays with working-day accuracy
- Manage sprint carryover — track unfinished work per swim lane and carry it forward into the next sprint
- No login required — teams share access via a short team code

---

## 2. Tech Stack

| Layer | Technology |
|---|---|
| UI | React 19.2.4, Vite 8.0.0, Tailwind CSS 3.4.19 |
| Routing | React Router DOM 7.13.1 |
| Backend | Supabase (PostgreSQL + RLS, no Auth) |
| Analytics | PostHog 1.364.5 |
| Testing | Playwright 1.58.2 |

**Access model:** No Supabase Auth. Teams are identified by a `team_code` (e.g. `abc-1234`) stored in the URL. All tables have RLS enabled with public access policies.

**Environment variables required:**
```
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
VITE_POSTHOG_KEY
```

---

## 3. Project Structure

```
sprint-planner/
├── src/
│   ├── App.jsx                     # Router setup, layout, analytics page tracking
│   ├── main.jsx                    # React entry point
│   ├── index.css                   # Global styles
│   ├── pages/
│   │   ├── Welcome.jsx             # Create/join team
│   │   ├── Dashboard.jsx           # Sprint capacity planning (core page)
│   │   ├── Team.jsx                # Team member management + leave + carryover tabs
│   │   ├── Velocity.jsx            # Sprint velocity history
│   │   ├── Settings.jsx            # Team settings + swim lane config + danger zone
│   │   └── Stories.jsx             # Story management (implemented, not in nav)
│   ├── components/
│   │   ├── Navbar.jsx              # Fixed left sidebar nav
│   │   ├── SprintSelector.jsx      # Sprint dropdown
│   │   ├── CapacityCard.jsx        # Metric card (label/value/sub/valueColor)
│   │   ├── TeamCapacityTable.jsx   # Per-member capacity breakdown table
│   │   ├── LeaveManagement.jsx     # Leave & holiday CRUD UI
│   │   ├── CarryoverReview.jsx     # Per-member per-lane carryover SP entry table
│   │   ├── SwimLaneConfig.jsx      # Swim lane CRUD (default lanes + custom lanes)
│   │   ├── VelocityChart.jsx       # Custom bar chart (committed vs completed)
│   │   ├── Onboarding.jsx          # 6-step interactive guided tour
│   │   └── StoryForm.jsx           # Story create/edit form
│   ├── context/
│   │   └── OnboardingContext.jsx   # Global onboarding state (isActive, currentStep)
│   └── lib/
│       ├── supabase.js             # Supabase client init
│       ├── analytics.js            # PostHog event tracking
│       └── utils.js                # calcWorkingDays, calcOverlapDays
├── supabase-migrations.sql         # Full DB schema
├── package.json
├── vite.config.js
├── tailwind.config.js
└── tests/                          # Playwright E2E tests
```

---

## 4. Routing

```
/                        → Welcome.jsx        (create or join team)
/team/:teamCode          → Dashboard.jsx      (sprint capacity planning)
/team/:teamCode/team     → Team.jsx           (members + leave)
/team/:teamCode/velocity → Velocity.jsx       (sprint velocity history)
/team/:teamCode/settings → Settings.jsx       (team config + danger zone)
```

After creating or joining a team, all routes include the `teamCode` segment. "Sign Out" returns to `/`.

---

## 5. Database Schema

### `teams`
| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `name` | TEXT | |
| `team_code` | TEXT UNIQUE | e.g. `abc-1234`, used for URL access |
| `default_story_points` | INTEGER | Default: 15 |
| `default_focus_factor` | INTEGER | Default: 80 (%) |
| `default_sprint_length` | INTEGER | Default: 14 (days) |
| `onboarding_completed` | BOOLEAN | Default: false |

### `team_members`
| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `team_id` | UUID FK → teams | |
| `name` | TEXT | |
| `role` | TEXT | Default: 'Software Engineer Lead' |
| `allocation_percentage` | INTEGER | Default: 100 |

### `sprints`
| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `team_id` | UUID FK → teams | |
| `name` | TEXT | |
| `goal` | TEXT | Optional |
| `start_date` | DATE | Optional |
| `end_date` | DATE | Optional |
| `story_points_per_member` | INTEGER | Base SP per person |
| `focus_factor` | INTEGER | % of capacity to target (typically 80) |
| `is_active` | BOOLEAN | |
| `completed_points` | INTEGER | Set when sprint marked complete |

### `sprint_availability`
| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `sprint_id` | UUID FK → sprints | |
| `member_id` | UUID FK → team_members | |
| `assigned_points` | NUMERIC | Story points assigned to this member for new Sprint B tickets |
| `carry_sp` | INTEGER | Carryover SP from previous sprint (set via Carryover Review) |
| `availability_percentage` | INTEGER | |
| `leave_days` | INTEGER | |

### `swim_lanes`
| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `team_id` | UUID FK → teams | |
| `name` | TEXT | Unique per team (case-insensitive) |
| `remaining_percentage` | INTEGER | 1–100; % of original SP still needed when a ticket is in this lane |
| `description` | TEXT | Optional |
| `is_default` | BOOLEAN | Default lanes cannot be deleted |
| `is_active` | BOOLEAN | Inactive lanes hidden from Carryover Review |
| `sort_order` | INTEGER | Display order |

Default lanes seeded on team creation: To Do (100%), In Progress (65%), Code Review (25%), QA (15%), UAT (10%), Blocked (1%)

### `sprint_carryover`
| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `sprint_id` | UUID FK → sprints | |
| `member_id` | UUID FK → team_members | |
| `swim_lane_id` | UUID FK → swim_lanes | |
| `entered_sp` | INTEGER | Raw SP the member has in this lane |
| `remaining_sp` | INTEGER | `entered_sp × remaining_percentage / 100` |
| `is_blocked` | BOOLEAN | Blocked lane rows excluded from carry total |

### `member_leave`
| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `sprint_id` | UUID FK → sprints | |
| `member_id` | UUID FK → team_members | |
| `leave_type` | TEXT | 'Annual Leave', 'Maternity Leave', 'Sick Leave', 'Study Leave' |
| `start_date` | DATE | |
| `end_date` | DATE | |
| `working_days` | INTEGER | Pre-calculated on save |

### `public_holidays`
| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `team_id` | UUID FK → teams | |
| `sprint_id` | UUID FK → sprints | |
| `name` | TEXT | |
| `start_date` | DATE | |
| `end_date` | DATE | |
| `working_days` | INTEGER | Pre-calculated on save |

### `stories` (implemented, not in main nav)
| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `sprint_id` | UUID FK → sprints | |
| `title` | TEXT | |
| `description` | TEXT | |
| `story_points` | INTEGER | |
| `assigned_member_id` | UUID FK → team_members, nullable | |
| `status` | TEXT | 'To Do', 'In Progress', 'Done' |

---

## 6. Core Capacity Calculation

All capacity logic lives in `Dashboard.jsx → getMemberCapacity()`.

```
// Inputs
basePoints          = sprint.story_points_per_member
sprintWorkingDays   = calcWorkingDays(start, end) OR team.default_sprint_length
focusFactor         = sprint.focus_factor  (e.g. 80)
individualLeaveDays = sum of member leave overlapping sprint (working days)
publicHolidayDays   = sum of public holidays overlapping sprint (working days)
allocationPct       = member.allocation_percentage  (e.g. 100)
carrySP             = sprint_availability.carry_sp (set via Carryover Review)

// Calculation
totalLeaveDays = individualLeaveDays + publicHolidayDays
adjustedSP     = basePoints × ((sprintWorkingDays - totalLeaveDays) / sprintWorkingDays) × (allocationPct / 100)
targetSP       = adjustedSP × focusFactor / 100
netTargetSP    = targetSP − carrySP          ← SP available for new Sprint B tickets
totalCommitted = assignedSP + carrySP
utilizationPct = (totalCommitted / adjustedSP) × 100

// Per-member status
OVERUTILIZED  → totalCommitted > adjustedSP
GOOD          → totalCommitted >= targetSP × 0.95
UNDERUTILIZED → otherwise
```

**Sprint-level metrics (capacity cards on Dashboard):**
```
effectiveCapacity  = sum(adjustedSP for all members) × focusFactor / 100
totalAssigned      = sum(assignedSP for all members)
totalCarry         = sum(carrySP for all members)
sprintUtilPct      = (totalAssigned / effectiveCapacity) × 100
totalAvailForNew   = sum(max(0, netTargetSP) for all members)

Sprint Status:
  OPTIMAL       → 95% ≤ sprintUtilPct ≤ 100%
  OVERCOMMITTED → sprintUtilPct > 100%
  UNDERUTILIZED → sprintUtilPct < 95%
```

**Carryover SP calculation (CarryoverReview.jsx):**
```
remainingSP (per lane) = round(enteredSP × lane.remaining_percentage / 100)
carrySP (per member)   = sum of remainingSP for all non-Blocked lanes
```
Blocked lane entries are tracked separately (shown in red) and excluded from the carry total.

---

## 7. Pages — Summary

### Welcome.jsx
- Create team (generates `xxx-xxxx` code, inserts into `teams`)
- Join team (looks up by code, navigates to `/team/:teamCode`)
- Dark theme with lime accent

### Dashboard.jsx (most complex)
- Sprint selector at top (SprintSelector component)
- 5 capacity metric cards: Total Capacity, Adjusted Capacity, Target Capacity, Assigned SP, Available for New Work
  - "Available for New Work" = sum of each member's `netTargetSP` (negatives treated as 0); turns red when `<= 0` with sub-text "Team is over capacity from carryover"
- Create sprint form (name, goal, dates, SP/member, focus factor)
  - On sprint creation: previous sprint's `carry_sp` values are automatically seeded into the new sprint's availability rows
- TeamCapacityTable: 8-column per-member breakdown — Member | Alloc | Leave | Adjusted SP | Carry SP | Target SP | Assigned SP | Utilization
  - **Target SP** is the hero column: `netTargetSP = targetSP − carrySP`, color-coded lime/amber/red
  - InfoTooltips on Carry SP, Target SP, and Assigned SP column headers
- All data re-fetched when sprint changes

### Team.jsx
- Tab 1 — **Members**: add/edit/delete members, set role and allocation %
- Tab 2 — **Leave & Holidays**: delegates entirely to LeaveManagement component
- Tab 3 — **Carryover Review**: delegates to CarryoverReview component
- Roles: 'Software Engineer Lead', 'Senior Software Engineer', 'Associate Software Engineer'

### Velocity.jsx
- Metrics: avg velocity, last sprint %, suggested next capacity
- VelocityChart: last 5 sprints, committed vs completed bars
- All sprints table: shows committed, completed, velocity % with color coding
- "Mark Complete" flow: click button → enter completed SP → save (sets `is_active=false`, `completed_points`)

### Settings.jsx
- Tab 1 — **General**: team name, sprint defaults, members list, share link, setup guide, danger zone
- Tab 2 — **Swim Lane Config**: delegates to SwimLaneConfig component

---

## 8. Component Summary

| Component | Purpose |
|---|---|
| `Navbar.jsx` | Fixed left sidebar, nav links, team name/code at bottom, sign out |
| `SprintSelector.jsx` | Controlled dropdown, "+ New Sprint" button |
| `CapacityCard.jsx` | Props: `label`, `value`, `sub`, `accent` (boolean), `valueColor` (optional hex) |
| `TeamCapacityTable.jsx` | Per-member table: allocation %, leave days, adjusted SP, carry SP, target SP (net), assigned SP (editable), utilization bar + status badge; InfoTooltips on 3 columns |
| `LeaveManagement.jsx` | Individual leave CRUD + public holiday CRUD for selected sprint |
| `CarryoverReview.jsx` | Per-member × per-lane SP input table; calculates remainingSP per lane and carrySP per member; Confirm saves to `sprint_carryover` and updates `sprint_availability.carry_sp` |
| `SwimLaneConfig.jsx` | Full CRUD for swim lanes; default lanes locked (no delete); custom lanes deletable with confirmation modal; active toggle saves immediately; Save Configuration batch-upserts all changes |
| `VelocityChart.jsx` | Custom bar chart — two bars per sprint (committed gray, completed lime) |
| `Onboarding.jsx` | 6-step tour with DOM spotlight overlay; portal rendering |
| `StoryForm.jsx` | Form for story create/edit |

---

## 9. Analytics Events (PostHog)

| Event | When |
|---|---|
| `team_created` | New team created on Welcome page |
| `member_added` | Team member added on Team page |
| `sprint_created` | Sprint created with name, SP/member, focus |
| `sprint_completed` | Sprint marked complete with committed/completed points |
| `assigned_sp_entered` | Assigned SP value entered on Dashboard |
| `leave_added` | Leave entry saved |
| `public_holiday_added` | Holiday saved |
| `page_viewed` | Every route change |

---

## 10. Onboarding Flow

6 steps, driven by `OnboardingContext` + `Onboarding.jsx`:
1. Welcome modal (centered overlay)
2. Navigate to Settings — set team defaults
3. Add team members
4. Create a sprint on Dashboard
5. Add leave on Team > Leave & Holidays
6. Assign story points on Dashboard

- Spotlight: 4-panel dark overlay + ring + tooltip on target DOM element
- Auto-navigates to required pages between steps
- Marks `onboarding_completed = true` on `teams` record when finished
- Can be re-triggered from Settings page

---

## 11. Visual Design

**Color palette:**
- Background: `#000000` (main), `#111111` (cards), `#0a0a0a` (overlay)
- Border: `#1A1A1A`
- Accent / success: `#BFFF00` (lime green)
- Warning: `#F59E0B` (amber)
- Danger: red
- Muted text: `#6e6e6e`, `#404040`

**Layout:**
- Fixed left sidebar nav (~240px) + scrollable main content area
- All dark theme — no light mode
- Responsive grid for capacity cards (2–5 columns)

---

## 12. Key Workflows

**Create team:** Welcome → enter name → code generated → navigate to Dashboard

**Create sprint:** Dashboard → "+ New Sprint" → fill form (name, dates, SP/member, focus factor) → submit → capacity cards populate; previous sprint's carry_sp values are automatically seeded into the new sprint

**Add leave:** Team > Leave & Holidays tab → "+ Add Leave" → select member, type, dates → working days auto-calculated → save → Dashboard capacity updates

**Assign story points:** Dashboard → capacity table → Assigned SP column → type value → blur → upserts `sprint_availability` record

**Mark sprint complete:** Velocity → sprint row → "Mark Complete" → enter completed SP → save

**Share team:** Settings → copy share link (includes team code in URL)

**Carryover review (end of sprint):**
1. Team > Carryover Review tab
2. For each member, enter how many SP they have in each swim lane (e.g. 5 SP In Progress, 3 SP blocked)
3. The app calculates remaining effort per lane using the configured `remaining_percentage`
4. Click "Confirm Carryover" → saves to `sprint_carryover`, updates each member's `carry_sp` in `sprint_availability`
5. Dashboard immediately reflects: Carry SP column populates, Target SP reduces, "Available for New Work" card updates

**Configure swim lanes:** Settings > Swim Lane Config tab → edit remaining % per lane → toggle active/inactive → add custom lanes → Save Configuration

---

## 13. Known / Intentional Gaps

- **Stories.jsx** is fully implemented (CRUD, status, assignment) but not linked in the main navbar — it is dormant code
- No real-time updates (Supabase realtime not enabled) — data refreshes on page load or action
- No user authentication — anyone with the team code has full access
- No caching layer — every page load hits Supabase directly
- No error boundary or global error logging — errors shown inline only
- **InfoTooltip clipping** — tooltips on the Team Capacity Breakdown table column headers still render behind table rows in some browsers despite `z-50` and `thead z-10` fixes; requires a portal-based solution (deferred)

---

## 14. Running the Project

```bash
npm install
npm run dev       # Start dev server
npm run build     # Production build
npm run preview   # Preview production build
npm run test      # Playwright E2E tests
npm run test:ui   # Interactive Playwright UI
```

---

*End of SprintIQ Product Reference v1.0*
