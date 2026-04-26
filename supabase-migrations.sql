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

-- 8. Enable RLS on core tables (resolves Supabase rls_disabled_in_public warning)
--    App uses team_code for access control rather than Supabase Auth,
--    so policies allow public access (same pattern as member_leave and public_holidays).
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public access" ON teams FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public access" ON team_members FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE sprints ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public access" ON sprints FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE sprint_availability ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public access" ON sprint_availability FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- Sprint Carryover Management — v2.0 migrations
-- ============================================================

-- 9. Swim lane configuration per team
CREATE TABLE IF NOT EXISTS swim_lanes (
  id                   UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id              UUID REFERENCES teams(id) ON DELETE CASCADE NOT NULL,
  name                 TEXT NOT NULL,
  remaining_percentage INTEGER NOT NULL CHECK (remaining_percentage BETWEEN 1 AND 100),
  description          TEXT,
  is_default           BOOLEAN DEFAULT false,
  is_active            BOOLEAN DEFAULT true,
  sort_order           INTEGER DEFAULT 0,
  created_at           TIMESTAMPTZ DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS swim_lanes_team_name_unique
  ON swim_lanes (team_id, lower(name));
ALTER TABLE swim_lanes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public access" ON swim_lanes FOR ALL USING (true) WITH CHECK (true);

-- 10. Sprint carryover entries (SP per member per lane per sprint)
CREATE TABLE IF NOT EXISTS sprint_carryover (
  id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  sprint_id      UUID REFERENCES sprints(id)       ON DELETE CASCADE NOT NULL,
  member_id      UUID REFERENCES team_members(id)  ON DELETE CASCADE NOT NULL,
  swim_lane_id   UUID REFERENCES swim_lanes(id)    ON DELETE CASCADE NOT NULL,
  entered_sp     INTEGER DEFAULT 0,
  remaining_sp   INTEGER DEFAULT 0,
  is_blocked     BOOLEAN DEFAULT false,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE sprint_carryover ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public access" ON sprint_carryover FOR ALL USING (true) WITH CHECK (true);

-- 11. Add carry_sp and new_sp columns to sprint_availability
ALTER TABLE sprint_availability
  ADD COLUMN IF NOT EXISTS carry_sp INTEGER DEFAULT 0;
ALTER TABLE sprint_availability
  ADD COLUMN IF NOT EXISTS new_sp INTEGER DEFAULT 0;

-- 12. Seed default swim lanes when a new team is created
CREATE OR REPLACE FUNCTION seed_default_swim_lanes()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO swim_lanes (team_id, name, remaining_percentage, description, is_default, is_active, sort_order)
  VALUES
    (NEW.id, 'To Do',        100, 'Work not yet started',                    true, true, 1),
    (NEW.id, 'In Progress',   65, 'Actively being worked on',                true, true, 2),
    (NEW.id, 'Code Review',   25, 'Awaiting or in code review',              true, true, 3),
    (NEW.id, 'QA',            15, 'In quality assurance testing',            true, true, 4),
    (NEW.id, 'UAT',           10, 'In user acceptance testing',              true, true, 5),
    (NEW.id, 'Blocked',        1, 'Blocked — tracked separately from carry', true, true, 6);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_team_created_seed_swim_lanes ON teams;
CREATE TRIGGER on_team_created_seed_swim_lanes
  AFTER INSERT ON teams
  FOR EACH ROW EXECUTE FUNCTION seed_default_swim_lanes();
