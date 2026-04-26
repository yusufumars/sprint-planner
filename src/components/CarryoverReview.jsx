import { useEffect, useState, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function CarryoverReview({ team, members }) {
  const { teamCode } = useParams()
  const navigate = useNavigate()

  const [activeSprint, setActiveSprint] = useState(null)
  const [lanes, setLanes] = useState([])
  const [entries, setEntries] = useState({}) // entries[memberId][laneId] = enteredSP
  const [loading, setLoading] = useState(true)
  const [confirming, setConfirming] = useState(false)
  const [confirmed, setConfirmed] = useState(false)

  const loadData = useCallback(async () => {
    if (!team) return
    setLoading(true)

    const [{ data: sprintData }, { data: laneData }] = await Promise.all([
      supabase
        .from('sprints')
        .select('*')
        .eq('team_id', team.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1),
      supabase
        .from('swim_lanes')
        .select('*')
        .eq('team_id', team.id)
        .eq('is_active', true)
        .order('sort_order'),
    ])

    const sprint = sprintData?.[0] || null
    setActiveSprint(sprint)
    setLanes(laneData || [])

    if (sprint && laneData?.length > 0) {
      const { data: existing } = await supabase
        .from('sprint_carryover')
        .select('*')
        .eq('sprint_id', sprint.id)

      const map = {}
      members.forEach((m) => {
        map[m.id] = {}
        laneData.forEach((l) => { map[m.id][l.id] = 0 })
      })
      existing?.forEach((row) => {
        if (map[row.member_id]) map[row.member_id][row.swim_lane_id] = row.entered_sp
      })
      setEntries(map)
    }

    setLoading(false)
  }, [team, members])

  useEffect(() => { loadData() }, [loadData])

  // ── Calculations ──────────────────────────────────────────────────────────
  function getRemainingSP(memberId, lane) {
    const entered = entries[memberId]?.[lane.id] || 0
    return Math.round(entered * lane.remaining_percentage / 100)
  }

  function getCarrySP(memberId) {
    return lanes
      .filter((l) => !isBlocked(l))
      .reduce((sum, l) => sum + getRemainingSP(memberId, l), 0)
  }

  function isBlocked(lane) {
    return lane.name.toLowerCase() === 'blocked'
  }

  function getTotalTeamCarry() {
    return members.reduce((sum, m) => sum + getCarrySP(m.id), 0)
  }

  function getTotalBlocked() {
    const blockedLane = lanes.find((l) => isBlocked(l))
    if (!blockedLane) return 0
    return members.reduce((sum, m) => sum + getRemainingSP(m.id, blockedLane), 0)
  }

  function handleEntryChange(memberId, laneId, value) {
    const val = Math.max(0, parseInt(value, 10) || 0)
    setEntries((prev) => ({
      ...prev,
      [memberId]: { ...prev[memberId], [laneId]: val },
    }))
  }

  // ── Confirm carryover ─────────────────────────────────────────────────────
  async function handleConfirm() {
    if (!activeSprint) return
    setConfirming(true)

    const rows = []
    members.forEach((m) => {
      lanes.forEach((l) => {
        const entered = entries[m.id]?.[l.id] || 0
        const remaining = getRemainingSP(m.id, l)
        rows.push({
          sprint_id: activeSprint.id,
          member_id: m.id,
          swim_lane_id: l.id,
          entered_sp: entered,
          remaining_sp: remaining,
          is_blocked: isBlocked(l),
        })
      })
    })

    // Delete existing rows for this sprint then insert fresh
    await supabase.from('sprint_carryover').delete().eq('sprint_id', activeSprint.id)
    await supabase.from('sprint_carryover').insert(rows)

    // Update carry_sp in sprint_availability — check existing rows first
    const { data: existingAvail } = await supabase
      .from('sprint_availability')
      .select('id, member_id')
      .eq('sprint_id', activeSprint.id)

    await Promise.all(
      members.map((m) => {
        const carrySP = getCarrySP(m.id)
        const existing = existingAvail?.find((a) => a.member_id === m.id)
        if (existing) {
          return supabase
            .from('sprint_availability')
            .update({ carry_sp: carrySP })
            .eq('id', existing.id)
        } else {
          return supabase
            .from('sprint_availability')
            .insert({
              sprint_id: activeSprint.id,
              member_id: m.id,
              carry_sp: carrySP,
              assigned_points: 0,
              availability_percentage: 100,
              leave_days: 0,
            })
        }
      })
    )

    setConfirming(false)
    setConfirmed(true)
    setTimeout(() => navigate(`/team/${teamCode}`), 800)
  }

  // ── Empty states ──────────────────────────────────────────────────────────
  if (loading) return <div className="text-[#6e6e6e] font-mono text-sm py-12 text-center">Loading carryover data…</div>

  if (!activeSprint) {
    return (
      <div className="bg-[#111111] rounded-lg border border-[#1A1A1A] p-12 text-center">
        <p className="text-[#6e6e6e] font-mono text-sm">No active sprint found.</p>
        <p className="text-[#404040] font-mono text-xs mt-2">Create a sprint first on the Dashboard.</p>
      </div>
    )
  }

  if (members.length === 0) {
    return (
      <div className="bg-[#111111] rounded-lg border border-[#1A1A1A] p-12 text-center">
        <p className="text-[#6e6e6e] font-mono text-sm">No team members added yet.</p>
        <p className="text-[#404040] font-mono text-xs mt-2">Add team members in the Members tab.</p>
      </div>
    )
  }

  if (lanes.length === 0) {
    return (
      <div className="bg-[#111111] rounded-lg border border-[#1A1A1A] p-12 text-center">
        <p className="text-[#6e6e6e] font-mono text-sm">No swim lanes configured.</p>
        <p className="text-[#404040] font-mono text-xs mt-2">Configure swim lanes in Settings → Swim Lane Config.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-white text-sm font-medium">Carryover Review</p>
          <p className="text-[#6e6e6e] text-xs font-mono mt-0.5">
            Sprint: <span className="text-white">{activeSprint.name}</span> — Enter SP per lane per member
          </p>
        </div>
        <button
          onClick={handleConfirm}
          disabled={confirming || confirmed}
          className="bg-[#BFFF00] hover:opacity-90 disabled:opacity-50 text-black font-mono font-semibold text-xs px-5 py-2.5 rounded transition-opacity"
        >
          {confirmed ? '✓ Confirmed' : confirming ? 'Saving…' : 'Confirm Carryover'}
        </button>
      </div>

      {/* Table */}
      <div className="bg-[#111111] rounded-lg border border-[#1A1A1A] overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#1A1A1A] text-[#404040] font-mono text-[10px] tracking-[1px] uppercase">
              <th className="text-left px-5 py-3 min-w-[140px]">Member</th>
              {lanes.map((lane) => (
                <th
                  key={lane.id}
                  className={`text-center px-3 py-3 min-w-[110px] ${isBlocked(lane) ? 'text-red-500' : ''}`}
                >
                  {lane.name}
                  <span className="block text-[9px] normal-case tracking-normal text-[#404040] mt-0.5">
                    {lane.remaining_percentage}% rem
                  </span>
                </th>
              ))}
              <th className="text-center px-4 py-3 min-w-[90px] text-[#BFFF00]">Carry SP</th>
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.id} className="border-t border-[#1A1A1A] hover:bg-[#0a0a0a]">
                <td className="px-5 py-3">
                  <span className="font-medium text-white text-sm">{m.name}</span>
                </td>
                {lanes.map((lane) => {
                  const entered = entries[m.id]?.[lane.id] || 0
                  const remaining = getRemainingSP(m.id, lane)
                  const blocked = isBlocked(lane)
                  return (
                    <td key={lane.id} className="px-3 py-3 text-center">
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={entered || ''}
                        placeholder="0"
                        onChange={(e) => handleEntryChange(m.id, lane.id, e.target.value)}
                        className={`w-14 text-center rounded px-2 py-1.5 text-xs font-mono text-white focus:outline-none ${
                          blocked
                            ? 'bg-[#1A0000] border border-red-800 focus:border-red-500'
                            : 'bg-[#1A1A1A] border border-[#2A2A2A] focus:border-[#BFFF00]'
                        }`}
                      />
                      {entered > 0 && (
                        <p className={`text-[10px] font-mono mt-1 ${blocked ? 'text-red-400' : 'text-[#6e6e6e]'}`}>
                          →{remaining} SP
                        </p>
                      )}
                    </td>
                  )
                })}
                <td className="px-4 py-3 text-center">
                  <span className="font-mono text-sm font-semibold text-[#BFFF00]">{getCarrySP(m.id)}</span>
                </td>
              </tr>
            ))}
          </tbody>
          {/* Footer */}
          <tfoot>
            <tr className="border-t border-[#2A2A2A] bg-black">
              <td className="px-5 py-3">
                <span className="text-[#6e6e6e] font-mono text-xs uppercase tracking-[1px]">Team Total</span>
              </td>
              {lanes.map((lane) => {
                const blocked = isBlocked(lane)
                const total = members.reduce((sum, m) => sum + getRemainingSP(m.id, lane), 0)
                return (
                  <td key={lane.id} className="px-3 py-3 text-center">
                    <span className={`font-mono text-xs font-semibold ${blocked ? 'text-red-400' : 'text-[#6e6e6e]'}`}>
                      {total > 0 ? `${total} SP` : '—'}
                    </span>
                  </td>
                )
              })}
              <td className="px-4 py-3 text-center">
                <span className="font-mono text-sm font-semibold text-[#BFFF00]">{getTotalTeamCarry()}</span>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Summary bar */}
      <div className="flex gap-4">
        <div className="bg-[#111111] border border-[#1A1A1A] rounded px-4 py-3 flex-1">
          <p className="text-[#6e6e6e] font-mono text-[10px] uppercase tracking-[1px]">Total Carry SP</p>
          <p className="text-[#BFFF00] font-mono text-xl font-semibold mt-1">{getTotalTeamCarry()}</p>
        </div>
        <div className="bg-[#111111] border border-red-900 rounded px-4 py-3 flex-1">
          <p className="text-red-500 font-mono text-[10px] uppercase tracking-[1px]">Total Blocked SP</p>
          <p className="text-red-400 font-mono text-xl font-semibold mt-1">{getTotalBlocked()}</p>
          <p className="text-[#404040] font-mono text-[10px] mt-0.5">Not counted in carry</p>
        </div>
      </div>
    </div>
  )
}
