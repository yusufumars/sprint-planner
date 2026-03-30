-- ============================================================
-- SprintIQ schema migrations — run these in Supabase SQL editor
-- ============================================================

-- 1. Add role to team_members
ALTER TABLE team_members
  ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'Software Engineer Lead';

-- 2. Add assigned_points to sprint_availability
ALTER TABLE sprint_availability
  ADD COLUMN IF NOT EXISTS assigned_points NUMERIC DEFAULT 0;

-- 3. Individual leave entries (multiple per member per sprint)
CREATE TABLE IF NOT EXISTS member_leave (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  sprint_id    UUID REFERENCES sprints(id)       ON DELETE CASCADE NOT NULL,
  member_id    UUID REFERENCES team_members(id)  ON DELETE CASCADE NOT NULL,
  leave_type   TEXT NOT NULL DEFAULT 'Annual Leave',
  start_date   DATE NOT NULL,
  end_date     DATE NOT NULL,
  working_days INTEGER NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE member_leave ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public access" ON member_leave FOR ALL USING (true) WITH CHECK (true);

-- 4. Public holidays (shared across all team members per sprint)
CREATE TABLE IF NOT EXISTS public_holidays (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id      UUID REFERENCES teams(id)    ON DELETE CASCADE NOT NULL,
  sprint_id    UUID REFERENCES sprints(id)  ON DELETE CASCADE NOT NULL,
  name         TEXT NOT NULL,
  start_date   DATE NOT NULL,
  end_date     DATE NOT NULL,
  working_days INTEGER NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public_holidays ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public access" ON public_holidays FOR ALL USING (true) WITH CHECK (true);

-- 5. Allocation percentage per team member (default 100%)
ALTER TABLE team_members
  ADD COLUMN IF NOT EXISTS allocation_percentage INTEGER DEFAULT 100;

-- 6. Track onboarding completion per team
ALTER TABLE teams
  ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT false;

-- 7. Store completed story points when a sprint is marked done
ALTER TABLE sprints
  ADD COLUMN IF NOT EXISTS completed_points INTEGER;
