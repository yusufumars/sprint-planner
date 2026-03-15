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
  const [committedPoints, setCommittedPoints] = useState({}) // { sprintId: totalAssignedPoints }

  useEffect(() => {
    async function load() {
      setLoading(true)
      const { data: teamData } = await supabase.from('teams').select('*').eq('team_code', teamCode).single()
      if (!teamData) { setLoading(false); return }
      setTeam(teamData)

      const { data: sprintsData } = await supabase.from('sprints').select('*').eq('team_id', teamData.id).order('created_at')
      if (!sprintsData) { setLoading(false); return }
      setSprints(sprintsData)

      // Load committed points from sprint_availability (manually entered assigned SP)
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
  const worst = completedSprints.reduce((worst, s) => (!worst || (s.completed_points || 0) < (worst.completed_points || 0)) ? s : worst, null)

  // Build chart data using assigned SP as committed
  const chartData = sprints.map((s) => ({
    ...s,
    committed: committedPoints[s.id] || 0,
    completed: s.completed_points || 0,
  }))

  if (loading) return <div className="text-center py-20 text-slate-400">Loading…</div>
  if (!team) return <div className="text-center py-20 text-slate-400">Team not found.</div>

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Velocity</h1>
        <p className="text-slate-500 text-sm mt-1">Track sprint performance over time</p>
      </div>

      {/* Metrics cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <p className="text-slate-500 text-xs uppercase tracking-wide">Avg Velocity (Last 3)</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{avgVelocity !== null ? `${avgVelocity} pts` : '—'}</p>
          {last3.length < 3 && <p className="text-slate-400 text-xs mt-1">Need {3 - last3.length} more completed sprint{3 - last3.length !== 1 ? 's' : ''}</p>}
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <p className="text-slate-500 text-xs uppercase tracking-wide">Suggested Commitment</p>
          <p className="text-2xl font-bold text-blue-600 mt-1">{avgVelocity !== null ? `${avgVelocity} pts` : 'Not enough data'}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <p className="text-slate-500 text-xs uppercase tracking-wide">Best Sprint</p>
          <p className="text-2xl font-bold text-emerald-600 mt-1">{best ? `${best.completed_points} pts` : '—'}</p>
          {best && <p className="text-slate-400 text-xs mt-1 truncate">{best.name}</p>}
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <p className="text-slate-500 text-xs uppercase tracking-wide">Lowest Sprint</p>
          <p className="text-2xl font-bold text-amber-600 mt-1">{worst ? `${worst.completed_points} pts` : '—'}</p>
          {worst && <p className="text-slate-400 text-xs mt-1 truncate">{worst.name}</p>}
        </div>
      </div>

      {/* Velocity Chart */}
      <VelocityChart sprints={chartData} />

      {/* Sprint Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-800">All Sprints</h2>
        </div>
        {sprints.length === 0 ? (
          <div className="text-center py-12 text-slate-400">No sprints yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
                <th className="text-left px-6 py-3">Sprint</th>
                <th className="text-right px-4 py-3">Committed</th>
                <th className="text-right px-4 py-3">Completed</th>
                <th className="text-right px-4 py-3">Velocity</th>
                <th className="text-center px-4 py-3">Status</th>
                <th className="text-right px-6 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sprints.map((s) => {
                const committed = committedPoints[s.id] || 0
                const completed = s.completed_points
                const velocityPct = committed > 0 && completed != null
                  ? Math.round((completed / committed) * 100)
                  : null

                return (
                  <tr key={s.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4">
                      <p className="font-medium text-slate-800">{s.name}</p>
                      {s.goal && <p className="text-slate-400 text-xs">{s.goal}</p>}
                    </td>
                    <td className="px-4 py-4 text-right text-slate-700">{committed}</td>
                    <td className="px-4 py-4 text-right">
                      {completingId === s.id ? (
                        <input
                          type="number" min="0"
                          value={completedPoints}
                          onChange={(e) => setCompletedPoints(e.target.value)}
                          placeholder="0"
                          className="w-20 text-right border border-slate-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      ) : (
                        <span className="text-slate-700">{completed != null ? completed : <span className="text-slate-300">—</span>}</span>
                      )}
                    </td>
                    <td className="px-4 py-4 text-right">
                      {velocityPct !== null ? (
                        <span className={`font-medium ${velocityPct >= 90 ? 'text-emerald-600' : velocityPct >= 70 ? 'text-amber-600' : 'text-red-500'}`}>
                          {velocityPct}%
                        </span>
                      ) : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-4 py-4 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${s.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                        {s.is_active ? 'Active' : 'Completed'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      {s.is_active && (
                        completingId === s.id ? (
                          <div className="flex items-center justify-end gap-2">
                            <button onClick={() => handleComplete(s.id)} disabled={saving}
                              className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white px-3 py-1 rounded text-xs font-medium transition-colors">
                              {saving ? '…' : 'Save'}
                            </button>
                            <button onClick={() => setCompletingId(null)} className="text-slate-400 text-xs">Cancel</button>
                          </div>
                        ) : (
                          <button
                            onClick={() => { setCompletingId(s.id); setCompletedPoints(s.completed_points || '') }}
                            className="text-blue-600 hover:text-blue-800 text-xs font-medium"
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
