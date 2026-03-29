import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { calcWorkingDays, calcOverlapDays } from '../lib/utils'
import SprintSelector from '../components/SprintSelector'
import CapacityCard from '../components/CapacityCard'
import TeamCapacityTable from '../components/TeamCapacityTable'
import { useOnboarding } from '../context/OnboardingContext'

// ── Capacity helpers ──────────────────────────────────────────────────────────

function getMemberCapacity(basePoints, sprintWorkingDays, focusFactor, individualLeaveDays, publicHolidayDays, assignedSP, allocationPct) {
  const totalLeaveDays = individualLeaveDays + publicHolidayDays
  const safeDays = Math.max(sprintWorkingDays, 1)
  const alloc = (allocationPct || 100) / 100
  const rawAdjusted = Math.max(0, basePoints * ((safeDays - totalLeaveDays) / safeDays) * alloc)
  const adjustedSP = Math.round(rawAdjusted)
  const targetSP = Math.round(adjustedSP * focusFactor / 100)
  const utilizationPct = adjustedSP > 0 ? Math.round((assignedSP / adjustedSP) * 100) : 0

  let status
  if (assignedSP > adjustedSP) status = 'OVERUTILIZED'
  else if (assignedSP >= targetSP * 0.95) status = 'GOOD'
  else status = 'UNDERUTILIZED'

  return { totalLeaveDays, adjustedSP, targetSP, utilizationPct, status }
}

function getSprintStatus(totalAssigned, effectiveCapacity) {
  if (effectiveCapacity <= 0) return 'UNDERUTILIZED'
  if (totalAssigned > effectiveCapacity) return 'OVERCOMMITTED'
  if (totalAssigned >= effectiveCapacity * 0.95) return 'OPTIMAL'
  return 'UNDERUTILIZED'
}

const defaultForm = { name: '', goal: '', start_date: '', end_date: '', story_points_per_member: 15, focus_factor: 80 }

// ── Component ─────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const { teamCode } = useParams()
  const { startOnboarding } = useOnboarding()
  const onboardingTriggered = useRef(false)

  const [team, setTeam] = useState(null)
  const [sprints, setSprints] = useState([])
  const [activeSprint, setActiveSprint] = useState(null)
  const [members, setMembers] = useState([])

  const [sprintAvailability, setSprintAvailability] = useState({})
  const [leaveEntries, setLeaveEntries] = useState([])
  const [publicHolidays, setPublicHolidays] = useState([])

  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(defaultForm)
  const [saving, setSaving] = useState(false)

  // ── Data loading ────────────────────────────────────────────────────

  useEffect(() => {
    supabase.from('teams').select('*').eq('team_code', teamCode).single()
      .then(({ data }) => {
        if (data) {
          setTeam(data)
          if (data.onboarding_completed === false && !onboardingTriggered.current) {
            onboardingTriggered.current = true
            setTimeout(() => startOnboarding(), 600)
          }
        }
      })
  }, [teamCode]) // eslint-disable-line react-hooks/exhaustive-deps

  const loadSprints = useCallback(async (teamId) => {
    const { data } = await supabase.from('sprints').select('*').eq('team_id', teamId).order('created_at')
    if (data) {
      setSprints(data)
      setActiveSprint((prev) => {
        if (prev) return data.find((s) => s.id === prev.id) || data[data.length - 1] || null
        return data.find((s) => s.is_active) || data[data.length - 1] || null
      })
    }
  }, [])

  useEffect(() => {
    if (!team) return
    loadSprints(team.id)
    supabase.from('team_members').select('*').eq('team_id', team.id).order('created_at')
      .then(({ data }) => { if (data) setMembers(data) })
    setForm((f) => ({
      ...f,
      story_points_per_member: team.default_story_points || 15,
      focus_factor: team.default_focus_factor || 80,
    }))
  }, [team, loadSprints])

  const loadSprintData = useCallback(async (sprint, memberList) => {
    if (!sprint || memberList.length === 0) {
      setSprintAvailability({})
      setLeaveEntries([])
      setPublicHolidays([])
      setLoading(false)
      return
    }
    setLoading(true)
    const [{ data: avData }, { data: leaveData }, { data: holidayData }] = await Promise.all([
      supabase.from('sprint_availability').select('*').eq('sprint_id', sprint.id),
      supabase.from('member_leave').select('*').eq('sprint_id', sprint.id),
      supabase.from('public_holidays').select('*').eq('sprint_id', sprint.id),
    ])
    const avMap = {}
    memberList.forEach((m) => { avMap[m.id] = { assigned_points: 0 } })
    avData?.forEach((a) => { avMap[a.member_id] = { id: a.id, assigned_points: Number(a.assigned_points) || 0 } })
    setSprintAvailability(avMap)
    setLeaveEntries(leaveData || [])
    setPublicHolidays(holidayData || [])
    setLoading(false)
  }, [])

  useEffect(() => {
    loadSprintData(activeSprint, members)
  }, [activeSprint, members, loadSprintData])

  // ── Assigned SP handlers ───────────────────────────────────────────

  function handleAssignedChange(memberId, value) {
    setSprintAvailability((prev) => ({
      ...prev,
      [memberId]: { ...prev[memberId], assigned_points: value },
    }))
  }

  async function handleAssignedBlur(memberId, rawValue) {
    const value = Math.round(rawValue) || 0
    handleAssignedChange(memberId, value)
    const existing = sprintAvailability[memberId]
    if (existing?.id) {
      await supabase.from('sprint_availability').update({ assigned_points: value }).eq('id', existing.id)
    } else {
      const { data } = await supabase.from('sprint_availability').insert({
        sprint_id: activeSprint.id,
        member_id: memberId,
        assigned_points: value,
        availability_percentage: 100,
        leave_days: 0,
      }).select().single()
      if (data) {
        setSprintAvailability((prev) => ({
          ...prev,
          [memberId]: { id: data.id, assigned_points: value },
        }))
      }
    }
  }

  async function handleAllocationChange(memberId, value) {
    setMembers((prev) => prev.map((m) => m.id === memberId ? { ...m, allocation_percentage: value } : m))
    await supabase.from('team_members').update({ allocation_percentage: value }).eq('id', memberId)
  }

  // ── Sprint creation ────────────────────────────────────────────────

  async function handleCreateSprint(e) {
    e.preventDefault()
    if (!team) return
    setSaving(true)
    const { error } = await supabase.from('sprints').insert({
      team_id: team.id,
      name: form.name,
      goal: form.goal,
      start_date: form.start_date || null,
      end_date: form.end_date || null,
      story_points_per_member: parseInt(form.story_points_per_member, 10),
      focus_factor: parseInt(form.focus_factor, 10),
      is_active: true,
    })
    setSaving(false)
    if (!error) {
      setShowForm(false)
      setForm({ ...defaultForm, story_points_per_member: team.default_story_points || 15, focus_factor: team.default_focus_factor || 80 })
      loadSprints(team.id)
    }
  }

  // ── Derived calculations ───────────────────────────────────────────

  const sprintWorkingDays = (activeSprint?.start_date && activeSprint?.end_date)
    ? calcWorkingDays(activeSprint.start_date, activeSprint.end_date)
    : (team?.default_sprint_length || 14)

  const basePoints = activeSprint?.story_points_per_member || 0
  const focusFactor = activeSprint?.focus_factor || 80
  const sprintStart = activeSprint?.start_date || null
  const sprintEnd   = activeSprint?.end_date   || null
  const publicHolidayDays = publicHolidays.reduce(
    (sum, h) => sum + calcOverlapDays(h.start_date, h.end_date, sprintStart, sprintEnd),
    0
  )

  const assignedPoints = Object.fromEntries(
    Object.entries(sprintAvailability).map(([mid, av]) => [mid, av.assigned_points || 0])
  )

  const memberCapacities = {}
  members.forEach((m) => {
    const individualLeaveDays = leaveEntries
      .filter((l) => l.member_id === m.id)
      .reduce((sum, l) => sum + calcOverlapDays(l.start_date, l.end_date, sprintStart, sprintEnd), 0)
    memberCapacities[m.id] = getMemberCapacity(
      basePoints, sprintWorkingDays, focusFactor,
      individualLeaveDays, publicHolidayDays,
      assignedPoints[m.id] || 0,
      m.allocation_percentage || 100
    )
  })

  const totalBaseCapacity = Math.round(members.length * basePoints)
  const totalAdjustedSP = members.reduce((sum, m) => sum + (memberCapacities[m.id]?.adjustedSP || 0), 0)
  const effectiveCapacity = Math.round(totalAdjustedSP * focusFactor / 100)
  const totalAssigned = members.reduce((sum, m) => sum + (assignedPoints[m.id] || 0), 0)
  const remainingCapacity = Math.round(effectiveCapacity - totalAssigned)

  const sprintUtilPct = effectiveCapacity > 0 ? Math.round((totalAssigned / effectiveCapacity) * 100) : 0
  const sprintStatus = getSprintStatus(totalAssigned, effectiveCapacity)

  const formWorkingDays = (form.start_date && form.end_date)
    ? calcWorkingDays(form.start_date, form.end_date)
    : null

  const inputClass = "w-full bg-black border border-[#1A1A1A] rounded px-3 py-2 text-sm text-white font-mono placeholder-[#404040] focus:outline-none focus:border-[#BFFF00]"

  if (!team) return <div className="text-center py-20 text-[#6e6e6e] font-mono">Loading team…</div>

  return (
    <div className="space-y-6">

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">Sprint Dashboard</h1>
          <p className="text-[#6e6e6e] text-sm font-mono mt-1">{team.name} · {teamCode}</p>
        </div>
        <SprintSelector sprints={sprints} activeSprint={activeSprint} onSelect={setActiveSprint} onNew={() => setShowForm(true)} />
      </div>

      {/* ── Sprint creation form ── */}
      {showForm && (
        <div className="bg-[#111111] rounded-lg border border-[#BFFF00] p-6">
          <h2 className="text-white font-semibold text-sm mb-4">Create New Sprint</h2>
          <form onSubmit={handleCreateSprint} className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-mono text-[10px] text-[#6e6e6e] tracking-[1px] uppercase mb-1.5">Sprint Name *</label>
              <input required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className={inputClass} placeholder="e.g. Sprint 12" />
            </div>
            <div>
              <label className="block font-mono text-[10px] text-[#6e6e6e] tracking-[1px] uppercase mb-1.5">Sprint Goal</label>
              <input value={form.goal} onChange={(e) => setForm((f) => ({ ...f, goal: e.target.value }))}
                className={inputClass} placeholder="e.g. Launch user auth module" />
            </div>
            <div>
              <label className="block font-mono text-[10px] text-[#6e6e6e] tracking-[1px] uppercase mb-1.5">Start Date</label>
              <input type="date" value={form.start_date} onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))}
                className={inputClass} />
            </div>
            <div>
              <label className="block font-mono text-[10px] text-[#6e6e6e] tracking-[1px] uppercase mb-1.5">
                End Date
                {formWorkingDays !== null && (
                  <span className="ml-2 text-[#BFFF00]">{formWorkingDays} working day{formWorkingDays !== 1 ? 's' : ''}</span>
                )}
              </label>
              <input type="date" value={form.end_date} min={form.start_date || undefined}
                onChange={(e) => setForm((f) => ({ ...f, end_date: e.target.value }))}
                className={inputClass} />
            </div>
            <div>
              <label className="block font-mono text-[10px] text-[#6e6e6e] tracking-[1px] uppercase mb-1.5">Story Points / Member</label>
              <input type="number" min="1" value={form.story_points_per_member}
                onChange={(e) => setForm((f) => ({ ...f, story_points_per_member: e.target.value }))}
                className={inputClass} />
            </div>
            <div>
              <label className="block font-mono text-[10px] text-[#6e6e6e] tracking-[1px] uppercase mb-1.5">Focus Factor %</label>
              <input type="number" min="1" max="100" value={form.focus_factor}
                onChange={(e) => setForm((f) => ({ ...f, focus_factor: e.target.value }))}
                className={inputClass} />
            </div>
            <div className="col-span-2 flex gap-3">
              <button type="submit" disabled={saving}
                className="bg-[#BFFF00] hover:opacity-90 disabled:opacity-50 text-black font-mono font-semibold text-xs px-6 py-2.5 rounded transition-opacity">
                {saving ? 'Creating…' : 'Create Sprint'}
              </button>
              <button type="button" onClick={() => setShowForm(false)}
                className="bg-[#1A1A1A] hover:bg-[#2A2A2A] text-[#6e6e6e] font-mono text-xs px-6 py-2.5 rounded transition-colors">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Empty state ── */}
      {!activeSprint && !showForm && (
        <div className="bg-[#111111] rounded-lg border border-[#1A1A1A] p-12 text-center">
          <p className="text-[#6e6e6e] font-mono text-sm mb-4">No sprints yet</p>
          <button onClick={() => setShowForm(true)}
            className="bg-[#BFFF00] hover:opacity-90 text-black font-mono font-semibold text-xs px-6 py-2.5 rounded transition-opacity">
            Create Your First Sprint
          </button>
        </div>
      )}

      {activeSprint && (
        <>
          {/* ── Sprint info panel ── */}
          <div className="bg-[#111111] rounded-lg border border-[#1A1A1A] px-5 py-4">
            <div className="flex items-center gap-3 mb-2">
              <h2 className="text-white font-semibold">{activeSprint.name}</h2>
              {activeSprint.is_active && (
                <span className="bg-[#BFFF00] text-black font-mono text-[10px] font-semibold px-2 py-0.5 rounded">Active</span>
              )}
            </div>
            {activeSprint.goal && <p className="text-[#6e6e6e] text-sm mb-3 font-mono">{activeSprint.goal}</p>}
            <div className="flex flex-wrap gap-5 text-xs text-[#6e6e6e] font-mono">
              {activeSprint.start_date && <span>Start: <strong className="text-white">{activeSprint.start_date}</strong></span>}
              {activeSprint.end_date && <span>End: <strong className="text-white">{activeSprint.end_date}</strong></span>}
              <span>
                Working Days: <strong className="text-white">{sprintWorkingDays}</strong>
                {!activeSprint.start_date && (
                  <span className="text-[#F59E0B] ml-1">(using default)</span>
                )}
              </span>
              <span>SP/Member: <strong className="text-white">{activeSprint.story_points_per_member}</strong></span>
              <span>Focus: <strong className="text-white">{activeSprint.focus_factor}%</strong></span>
              {publicHolidayDays > 0 && (
                <span>Public Holidays: <strong className="text-[#F59E0B]">{publicHolidayDays} day{publicHolidayDays !== 1 ? 's' : ''}</strong></span>
              )}
            </div>
          </div>

          {/* ── Capacity metric cards ── */}
          <div className="grid grid-cols-5 gap-3">
            <CapacityCard
              label="Total Capacity"
              value={totalBaseCapacity}
              sub={`${members.length} members × ${basePoints} SP`}
            />
            <CapacityCard
              label="Adjusted Capacity"
              value={totalAdjustedSP}
              sub="After leave deductions"
            />
            <CapacityCard
              label="Target Capacity"
              value={effectiveCapacity}
              sub={`${focusFactor}% focus factor`}
              accent
            />
            <CapacityCard
              label="Assigned SP"
              value={totalAssigned}
              sub={`${sprintUtilPct}% utilized`}
            />
            <CapacityCard
              label="Remaining SP"
              value={remainingCapacity}
              sub="Available capacity"
            />
          </div>

          {/* ── Team Capacity Table ── */}
          {loading ? (
            <div className="bg-[#111111] rounded-lg border border-[#1A1A1A] p-10 text-center text-[#6e6e6e] font-mono text-sm">
              Loading capacity data…
            </div>
          ) : (
            <TeamCapacityTable
              members={members}
              memberCapacities={memberCapacities}
              assignedPoints={assignedPoints}
              basePoints={basePoints}
              focusFactor={focusFactor}
              onAssignedChange={handleAssignedChange}
              onAssignedBlur={handleAssignedBlur}
              onAllocationChange={handleAllocationChange}
              sprintStatus={sprintStatus}
              sprintUtilPct={sprintUtilPct}
            />
          )}
        </>
      )}
    </div>
  )
}
