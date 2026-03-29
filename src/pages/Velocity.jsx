import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import VelocityChart from '../components/VelocityChart'

export default function Velocity() {
  const { teamCode } = useParams()
  const [team, setTeam] = useState(null)
  const [sprints, setSprints] = useState([])
  const [loading, setLoading] = useState(true)
  const [completingId, setCompletingId] = useState(null)
  const [completedPoints, setCompletedPoints] = useState('')
  const [saving, setSaving] = useState(false)
  const [committedPoints, setCommittedPoints] = useState({})

  useEffect(() => {
    async function load() {
      setLoading(true)
      const { data: teamData } = await supabase.from('teams').select('*').eq('team_code', teamCode).single()
      if (!teamData) { setLoading(false); return }
      setTeam(teamData)

      const { data: sprintsData } = await supabase.from('sprints').select('*').eq('team_id', teamData.id).order('created_at')
      if (!sprintsData) { setLoading(false); return }
      setSprints(sprintsData)

      const ids = sprintsData.map((s) => s.id)
      if (ids.length > 0) {
        const { data: avData } = await supabase
          .from('sprint_availability')
          .select('sprint_id, assigned_points')
          .in('sprint_id', ids)
        const pts = {}
        avData?.forEach((a) => { pts[a.sprint_id] = (pts[a.sprint_id] || 0) + (Number(a.assigned_points) || 0) })
        setCommittedPoints(pts)
      }
      setLoading(false)
    }
    load()
  }, [teamCode])

  async function handleComplete(sprintId) {
    setSaving(true)
    const pts = parseInt(completedPoints, 10) || 0
    const { data } = await supabase
      .from('sprints')
      .update({ is_active: false, completed_points: pts })
      .eq('id', sprintId)
      .select()
      .single()
    if (data) setSprints((s) => s.map((x) => x.id === sprintId ? data : x))
    setCompletingId(null)
    setCompletedPoints('')
    setSaving(false)
  }

  const completedSprints = sprints.filter((s) => !s.is_active && s.completed_points != null)
  const last3 = completedSprints.slice(-3)
  const avgVelocity = last3.length >= 1
    ? Math.round(last3.reduce((sum, s) => sum + (s.completed_points || 0), 0) / last3.length)
    : null

  const best = completedSprints.reduce((best, s) => (!best || (s.completed_points || 0) > (best.completed_points || 0)) ? s : best, null)

  const chartData = sprints.map((s) => ({
    ...s,
    committed: committedPoints[s.id] || 0,
    completed: s.completed_points || 0,
  }))

  if (loading) return <div className="text-center py-20 text-[#6e6e6e] font-mono">Loading…</div>
  if (!team) return <div className="text-center py-20 text-[#6e6e6e] font-mono">Team not found.</div>

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Velocity</h1>
        <p className="text-[#6e6e6e] text-sm font-mono mt-1">Track sprint performance over time</p>
      </div>

      {/* Metrics cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-[#111111] rounded-lg border border-[#1A1A1A] p-5 flex flex-col gap-2">
          <p className="font-mono text-[10px] text-[#6e6e6e] tracking-[2px] uppercase">Avg Velocity</p>
          <p className="text-3xl font-semibold text-white font-sans">{avgVelocity !== null ? avgVelocity : '—'}</p>
          <p className="font-mono text-xs text-[#999999]">
            {last3.length < 3 ? `Need ${3 - last3.length} more sprint${3 - last3.length !== 1 ? 's' : ''}` : 'Last 3 sprints avg'}
          </p>
        </div>

        <div className="bg-[#BFFF00] rounded-lg border border-[#BFFF00] p-5 flex flex-col gap-2">
          <p className="font-mono text-[10px] text-black tracking-[2px] uppercase">Current Sprint</p>
          <p className="text-3xl font-semibold text-black font-sans">
            {sprints.find((s) => s.is_active)?.name || '—'}
          </p>
          <p className="font-mono text-xs text-black">
            {best ? `Best: ${best.completed_points} pts — ${best.name}` : 'No completed sprints yet'}
          </p>
        </div>

        <div className="bg-[#111111] rounded-lg border border-[#1A1A1A] p-5 flex flex-col gap-2">
          <p className="font-mono text-[10px] text-[#6e6e6e] tracking-[2px] uppercase">Suggested Next</p>
          <p className="text-3xl font-semibold text-white font-sans">{avgVelocity !== null ? avgVelocity : '—'}</p>
          <p className="font-mono text-xs text-[#999999]">Based on avg velocity</p>
        </div>
      </div>

      {/* Velocity Chart */}
      <VelocityChart sprints={chartData} />

      {/* Sprint Table */}
      <div className="bg-[#111111] rounded-lg border border-[#1A1A1A] overflow-hidden">
        <div className="px-6 py-4 border-b border-[#1A1A1A]">
          <h2 className="text-white font-semibold text-sm">All Sprints</h2>
        </div>
        {sprints.length === 0 ? (
          <div className="text-center py-12 text-[#6e6e6e] font-mono text-sm">No sprints yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-black text-[#404040] font-mono text-[10px] tracking-[1px] uppercase">
                <th className="text-left px-6 py-3">Sprint</th>
                <th className="text-right px-4 py-3">Committed</th>
                <th className="text-right px-4 py-3">Completed</th>
                <th className="text-right px-4 py-3">Velocity</th>
                <th className="text-center px-4 py-3">Status</th>
                <th className="text-right px-6 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sprints.map((s) => {
                const committed = committedPoints[s.id] || 0
                const completed = s.completed_points
                const velocityPct = committed > 0 && completed != null
                  ? Math.round((completed / committed) * 100)
                  : null

                return (
                  <tr key={s.id} className="border-t border-[#1A1A1A] hover:bg-[#0a0a0a]">
                    <td className="px-6 py-4">
                      <p className="font-medium text-white">{s.name}</p>
                      {s.goal && <p className="text-[#6e6e6e] text-xs font-mono mt-0.5">{s.goal}</p>}
                    </td>
                    <td className="px-4 py-4 text-right font-mono text-sm text-[#999999]">{committed}</td>
                    <td className="px-4 py-4 text-right">
                      {completingId === s.id ? (
                        <input
                          type="number" min="0"
                          value={completedPoints}
                          onChange={(e) => setCompletedPoints(e.target.value)}
                          placeholder="0"
                          className="w-20 text-right bg-black border border-[#BFFF00] rounded px-2 py-1 text-sm font-mono text-white focus:outline-none"
                        />
                      ) : (
                        <span className="font-mono text-sm text-[#999999]">
                          {completed != null ? completed : <span className="text-[#404040]">—</span>}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-4 text-right font-mono text-sm">
                      {velocityPct !== null ? (
                        <span className={velocityPct >= 90 ? 'text-[#BFFF00] font-semibold' : velocityPct >= 70 ? 'text-[#F59E0B]' : 'text-red-400'}>
                          {velocityPct}%
                        </span>
                      ) : <span className="text-[#404040]">—</span>}
                    </td>
                    <td className="px-4 py-4 text-center">
                      <span className={`font-mono text-[10px] font-semibold px-2 py-0.5 rounded ${
                        s.is_active ? 'bg-[#BFFF00] text-black' : 'text-[#6e6e6e]'
                      }`}>
                        {s.is_active ? 'Active' : 'Completed'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      {s.is_active && (
                        completingId === s.id ? (
                          <div className="flex items-center justify-end gap-2">
                            <button onClick={() => handleComplete(s.id)} disabled={saving}
                              className="bg-[#BFFF00] hover:opacity-90 disabled:opacity-50 text-black font-mono font-semibold text-xs px-3 py-1.5 rounded transition-opacity">
                              {saving ? '…' : 'Save'}
                            </button>
                            <button onClick={() => setCompletingId(null)}
                              className="text-[#6e6e6e] hover:text-white text-xs font-mono">Cancel</button>
                          </div>
                        ) : (
                          <button
                            onClick={() => { setCompletingId(s.id); setCompletedPoints(s.completed_points || '') }}
                            className="text-[#BFFF00] hover:opacity-70 text-xs font-mono font-medium"
                          >
                            Mark Complete
                          </button>
                        )
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
