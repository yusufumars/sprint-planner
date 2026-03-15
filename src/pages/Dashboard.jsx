import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { calcWorkingDays, snapToFibonacci } from '../lib/utils'
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
  const adjustedSP = snapToFibonacci(rawAdjusted)
  const targetSP = snapToFibonacci(adjustedSP * focusFactor / 100)
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

const SPRINT_STATUS_STYLES = {
  OPTIMAL:      { ring: 'border-emerald-400', text: 'text-emerald-600', border: 'border-emerald-200', bg: 'bg-emerald-50' },
  OVERCOMMITTED:{ ring: 'border-red-400',     text: 'text-red-600',     border: 'border-red-200',     bg: 'bg-red-50'     },
  UNDERUTILIZED:{ ring: 'border-amber-400',   text: 'text-amber-600',   border: 'border-amber-200',   bg: 'bg-amber-50'   },
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

  // { [memberId]: { id?, assigned_points } }
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

  // ── Assigned SP handlers (snap to Fibonacci on save) ──────────────

  function handleAssignedChange(memberId, value) {
    setSprintAvailability((prev) => ({
      ...prev,
      [memberId]: { ...prev[memberId], assigned_points: value },
    }))
  }

  async function handleAssignedBlur(memberId, rawValue) {
    const snapped = rawValue > 0 ? snapToFibonacci(rawValue) : 0
    // Update display to snapped value
    handleAssignedChange(memberId, snapped)
    const existing = sprintAvailability[memberId]
    if (existing?.id) {
      await supabase.from('sprint_availability').update({ assigned_points: snapped }).eq('id', existing.id)
    } else {
      const { data } = await supabase.from('sprint_availability').insert({
        sprint_id: activeSprint.id,
        member_id: memberId,
        assigned_points: snapped,
        availability_percentage: 100,
        leave_days: 0,
      }).select().single()
      if (data) {
        setSprintAvailability((prev) => ({
          ...prev,
          [memberId]: { id: data.id, assigned_points: snapped },
        }))
      }
    }
  }

  // ── Allocation % handler (saves immediately) ───────────────────────

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
  const publicHolidayDays = publicHolidays.reduce((sum, h) => sum + (h.working_days || 0), 0)

  const assignedPoints = Object.fromEntries(
    Object.entries(sprintAvailability).map(([mid, av]) => [mid, av.assigned_points || 0])
  )

  const memberCapacities = {}
  members.forEach((m) => {
    const individualLeaveDays = leaveEntries
      .filter((l) => l.member_id === m.id)
      .reduce((sum, l) => sum + (l.working_days || 0), 0)
    memberCapacities[m.id] = getMemberCapacity(
      basePoints, sprintWorkingDays, focusFactor,
      individualLeaveDays, publicHolidayDays,
      assignedPoints[m.id] || 0,
      m.allocation_percentage || 100
    )
  })

  const totalBaseCapacity = Math.round(members.length * basePoints)
  const totalAdjustedSP = members.reduce((sum, m) => sum + (memberCapacities[m.id]?.adjustedSP || 0), 0)
  const effectiveCapacity = snapToFibonacci(totalAdjustedSP * focusFactor / 100)
  const totalAssigned = members.reduce((sum, m) => sum + (assignedPoints[m.id] || 0), 0)
  const remainingCapacity = Math.round(effectiveCapacity - totalAssigned)
  const avgAllocation = members.length > 0
    ? Math.round(members.reduce((sum, m) => sum + (m.allocation_percentage || 100), 0) / members.length)
    : 100

  const sprintUtilPct = effectiveCapacity > 0 ? Math.round((totalAssigned / effectiveCapacity) * 100) : 0
  const sprintStatus = getSprintStatus(totalAssigned, effectiveCapacity)
  const ss = SPRINT_STATUS_STYLES[sprintStatus]

  const formWorkingDays = (form.start_date && form.end_date)
    ? calcWorkingDays(form.start_date, form.end_date)
    : null

  if (!team) return <div className="text-center py-20 text-slate-400">Loading team…</div>

  return (
    <div className="space-y-6">

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-slate-500 text-sm mt-1">Sprint capacity planning for {team.name}</p>
        </div>
        <SprintSelector sprints={sprints} activeSprint={activeSprint} onSelect={setActiveSprint} onNew={() => setShowForm(true)} />
      </div>

      {/* ── Sprint creation form ── */}
      {showForm && (
        <div className="bg-white rounded-xl shadow-sm border border-blue-200 p-6">
          <h2 className="font-semibold text-slate-800 mb-4">Create New Sprint</h2>
          <form onSubmit={handleCreateSprint} className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Sprint Name *</label>
              <input required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g. Sprint 12" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Sprint Goal</label>
              <input value={form.goal} onChange={(e) => setForm((f) => ({ ...f, goal: e.target.value }))}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g. Launch user auth module" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Start Date</label>
              <input type="date" value={form.start_date} onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                End Date
                {formWorkingDays !== null && (
                  <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                    {formWorkingDays} working day{formWorkingDays !== 1 ? 's' : ''}
                  </span>
                )}
              </label>
              <input type="date" value={form.end_date} min={form.start_date || undefined}
                onChange={(e) => setForm((f) => ({ ...f, end_date: e.target.value }))}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Story Points / Member</label>
              <input type="number" min="1" value={form.story_points_per_member}
                onChange={(e) => setForm((f) => ({ ...f, story_points_per_member: e.target.value }))}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Focus Factor %</label>
              <input type="number" min="1" max="100" value={form.focus_factor}
                onChange={(e) => setForm((f) => ({ ...f, focus_factor: e.target.value }))}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="col-span-2 flex gap-2">
              <button type="submit" disabled={saving}
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white px-6 py-2 rounded-lg text-sm font-medium transition-colors">
                {saving ? 'Creating…' : 'Create Sprint'}
              </button>
              <button type="button" onClick={() => setShowForm(false)}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-6 py-2 rounded-lg text-sm font-medium transition-colors">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Empty state ── */}
      {!activeSprint && !showForm && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center">
          <p className="text-slate-400 text-lg mb-4">No sprints yet</p>
          <button onClick={() => setShowForm(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg font-medium text-sm">
            Create Your First Sprint
          </button>
        </div>
      )}

      {activeSprint && (
        <>
          {/* ── Sprint info panel ── */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
            <div className="flex items-center gap-3 mb-2">
              <h2 className="text-lg font-bold text-slate-900">{activeSprint.name}</h2>
              {activeSprint.is_active && (
                <span className="bg-emerald-100 text-emerald-700 text-xs font-medium px-2 py-0.5 rounded-full">Active</span>
              )}
            </div>
            {activeSprint.goal && <p className="text-slate-600 text-sm mb-3">{activeSprint.goal}</p>}
            <div className="flex flex-wrap gap-5 text-sm text-slate-500">
              {activeSprint.start_date && <span>Start: <strong className="text-slate-700">{activeSprint.start_date}</strong></span>}
              {activeSprint.end_date && <span>End: <strong className="text-slate-700">{activeSprint.end_date}</strong></span>}
              <span>
                Sprint Working Days: <strong className="text-slate-700">{sprintWorkingDays}</strong>
                {!activeSprint.start_date && (
                  <span className="text-amber-500 text-xs ml-1">(using default — set sprint dates for accuracy)</span>
                )}
              </span>
              <span>SP/Member: <strong className="text-slate-700">{activeSprint.story_points_per_member}</strong></span>
              <span>Focus: <strong className="text-slate-700">{activeSprint.focus_factor}%</strong></span>
              {publicHolidayDays > 0 && (
                <span>Public Holidays: <strong className="text-amber-600">{publicHolidayDays} day{publicHolidayDays !== 1 ? 's' : ''}</strong></span>
              )}
            </div>
          </div>

          {/* ── Sprint Health Card ── */}
          <div className={`rounded-xl shadow-sm border p-6 ${ss.bg} ${ss.border}`}>
            <div className="flex items-center justify-between gap-6">
              <div className="flex-1">
                <p className="text-xs font-medium uppercase tracking-widest text-slate-500 mb-1">Sprint Health</p>
                <p className={`text-4xl font-bold ${ss.text}`}>{sprintStatus}</p>
                <p className="text-slate-600 text-sm mt-2">
                  <strong>{totalAssigned}</strong> of <strong>{effectiveCapacity}</strong> effective capacity points assigned
                </p>
                {sprintStatus === 'UNDERUTILIZED' && effectiveCapacity > 0 && (
                  <p className={`text-sm mt-1 ${ss.text}`}>
                    {remainingCapacity} points of capacity available — consider adding more scope
                  </p>
                )}
                {sprintStatus === 'OVERCOMMITTED' && (
                  <p className={`text-sm mt-1 ${ss.text}`}>
                    {Math.abs(remainingCapacity)} points over capacity — reduce scope or adjust leave
                  </p>
                )}
                {sprintStatus === 'OPTIMAL' && (
                  <p className={`text-sm mt-1 ${ss.text}`}>Sprint is optimally loaded</p>
                )}
              </div>
              <div className={`w-36 h-36 rounded-full border-8 ${ss.ring} flex flex-col items-center justify-center flex-shrink-0`}>
                <span className={`text-3xl font-bold ${ss.text}`}>{sprintUtilPct}%</span>
                <span className="text-xs text-slate-500 mt-0.5">utilization</span>
              </div>
            </div>
          </div>

          {/* ── Capacity metric cards ── */}
          <div className="grid grid-cols-3 lg:grid-cols-6 gap-4">
            <CapacityCard label="Total SP Capacity" value={totalBaseCapacity} sub="raw" color="slate" />
            <CapacityCard label="Adjusted Capacity" value={totalAdjustedSP} sub="after leave & allocation" color="purple" />
            <CapacityCard label="Effective Capacity" value={effectiveCapacity} sub={`at ${focusFactor}% focus`} color="blue" />
            <CapacityCard label="Total Assigned" value={totalAssigned} color={sprintStatus === 'OVERCOMMITTED' ? 'red' : 'green'} />
            <CapacityCard label="Remaining" value={remainingCapacity} color={remainingCapacity < 0 ? 'red' : 'green'} />
            <CapacityCard label="Avg Allocation" value={`${avgAllocation}%`} sub="across team" color="blue" />
          </div>

          {/* ── Team Capacity Table ── */}
          {loading ? (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-10 text-center text-slate-400">
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
            />
          )}
        </>
      )}
    </div>
  )
}
