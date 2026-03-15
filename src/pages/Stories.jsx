import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import StoryForm from '../components/StoryForm'

const STATUS_COLORS = {
  'To Do': 'bg-slate-100 text-slate-600',
  'In Progress': 'bg-blue-100 text-blue-700',
  'Done': 'bg-emerald-100 text-emerald-700',
}

export default function Stories() {
  const { teamCode } = useParams()
  const [team, setTeam] = useState(null)
  const [activeSprint, setActiveSprint] = useState(null)
  const [members, setMembers] = useState([])
  const [stories, setStories] = useState([])
  const [availability, setAvailability] = useState({})
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editStory, setEditStory] = useState(null)
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const [warning, setWarning] = useState('')

  useEffect(() => {
    async function load() {
      setLoading(true)
      const { data: teamData } = await supabase.from('teams').select('*').eq('team_code', teamCode).single()
      if (!teamData) { setLoading(false); return }
      setTeam(teamData)

      const [{ data: membersData }, { data: sprintsData }] = await Promise.all([
        supabase.from('team_members').select('*').eq('team_id', teamData.id).order('created_at'),
        supabase.from('sprints').select('*').eq('team_id', teamData.id).eq('is_active', true).limit(1),
      ])
      if (membersData) setMembers(membersData)
      const sprint = sprintsData?.[0] || null
      setActiveSprint(sprint)

      if (sprint) {
        const [{ data: storiesData }, { data: avData }] = await Promise.all([
          supabase.from('stories').select('*').eq('sprint_id', sprint.id).order('created_at'),
          supabase.from('sprint_availability').select('*').eq('sprint_id', sprint.id),
        ])
        if (storiesData) setStories(storiesData)
        const avMap = {}
        membersData?.forEach((m) => { avMap[m.id] = { leave_days: 0, availability_percentage: 100 } })
        avData?.forEach((a) => { avMap[a.member_id] = { id: a.id, leave_days: a.leave_days, availability_percentage: a.availability_percentage } })
        setAvailability(avMap)
      }
      setLoading(false)
    }
    load()
  }, [teamCode])

  function calcAdjCapacity(memberId) {
    const av = availability[memberId] || {}
    const basePoints = activeSprint?.story_points_per_member || 0
    const sprintLength = team?.default_sprint_length || 14
    const leave = av.leave_days || 0
    return parseFloat((basePoints * ((sprintLength - leave) / sprintLength)).toFixed(2))
  }

  function memberAssignedPoints(memberId, excludeStoryId = null) {
    return stories
      .filter((s) => s.assigned_member_id === memberId && s.id !== excludeStoryId)
      .reduce((sum, s) => sum + (s.story_points || 0), 0)
  }

  async function handleSave(formData) {
    if (!activeSprint) return
    setWarning('')

    // Check over-allocation
    if (formData.assigned_member_id) {
      const adj = calcAdjCapacity(formData.assigned_member_id)
      const alreadyAssigned = memberAssignedPoints(formData.assigned_member_id, editStory?.id)
      if (alreadyAssigned + formData.story_points > adj) {
        setWarning(`Warning: This assignment puts ${members.find(m => m.id === formData.assigned_member_id)?.name} over capacity (${adj} pts).`)
      }
    }

    if (editStory) {
      const { data } = await supabase.from('stories').update(formData).eq('id', editStory.id).select().single()
      if (data) setStories((s) => s.map((x) => x.id === editStory.id ? data : x))
      setEditStory(null)
    } else {
      const { data } = await supabase.from('stories').insert({ ...formData, sprint_id: activeSprint.id }).select().single()
      if (data) setStories((s) => [...s, data])
    }
    setShowForm(false)
  }

  async function handleDelete(id) {
    await supabase.from('stories').delete().eq('id', id)
    setStories((s) => s.filter((x) => x.id !== id))
    setDeleteConfirm(null)
  }

  const totalCommitted = stories.reduce((sum, s) => sum + (s.story_points || 0), 0)
  const sprintLength = team?.default_sprint_length || 14
  let totalAdjCapacity = 0
  members.forEach((m) => {
    totalAdjCapacity += calcAdjCapacity(m.id)
  })
  const effectiveCapacity = parseFloat((totalAdjCapacity * (activeSprint?.focus_factor || 80) / 100).toFixed(2))
  const remaining = parseFloat((effectiveCapacity - totalCommitted).toFixed(2))
  const utilPct = effectiveCapacity > 0 ? Math.round((totalCommitted / effectiveCapacity) * 100) : 0

  if (loading) return <div className="text-center py-20 text-slate-400">Loading…</div>
  if (!team) return <div className="text-center py-20 text-slate-400">Team not found.</div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Stories</h1>
          <p className="text-slate-500 text-sm mt-1">
            {activeSprint ? `Managing stories for: ${activeSprint.name}` : 'No active sprint'}
          </p>
        </div>
        {activeSprint && !showForm && !editStory && (
          <button onClick={() => setShowForm(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
            + Add Story
          </button>
        )}
      </div>

      {/* Summary bar */}
      {activeSprint && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
          <div className="flex items-center gap-8">
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wide">Committed</p>
              <p className="text-xl font-bold text-slate-900">{totalCommitted} pts</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wide">Effective Capacity</p>
              <p className="text-xl font-bold text-slate-900">{effectiveCapacity} pts</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wide">Remaining</p>
              <p className={`text-xl font-bold ${remaining < 0 ? 'text-red-600' : 'text-emerald-600'}`}>{remaining} pts</p>
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-3">
                <div className="flex-1 bg-slate-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all ${utilPct >= 90 ? 'bg-red-500' : utilPct >= 70 ? 'bg-amber-400' : 'bg-emerald-500'}`}
                    style={{ width: `${Math.min(utilPct, 100)}%` }}
                  />
                </div>
                <span className={`font-bold text-sm ${utilPct >= 90 ? 'text-red-600' : utilPct >= 70 ? 'text-amber-600' : 'text-emerald-600'}`}>
                  {utilPct}%
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {warning && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-amber-800 text-sm flex items-center gap-2">
          <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M12 3l9 16H3L12 3z" />
          </svg>
          {warning}
        </div>
      )}

      {/* Add/Edit form */}
      {(showForm || editStory) && (
        <div className="bg-white rounded-xl shadow-sm border border-blue-200 p-6">
          <h2 className="font-semibold text-slate-800 mb-4">{editStory ? 'Edit Story' : 'Add Story'}</h2>
          <StoryForm
            members={members}
            initial={editStory}
            onSave={handleSave}
            onCancel={() => { setShowForm(false); setEditStory(null) }}
          />
        </div>
      )}

      {!activeSprint && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center text-slate-400">
          No active sprint. Create a sprint on the Dashboard first.
        </div>
      )}

      {activeSprint && stories.length === 0 && !showForm && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center text-slate-400">
          No stories yet. Add your first story above.
        </div>
      )}

      {/* Stories list */}
      {stories.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
                <th className="text-left px-6 py-3">Story</th>
                <th className="text-center px-4 py-3">Points</th>
                <th className="text-left px-4 py-3">Assigned</th>
                <th className="text-center px-4 py-3">Status</th>
                <th className="text-right px-6 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {stories.map((s) => {
                const assignedMember = members.find((m) => m.id === s.assigned_member_id)
                return (
                  <tr key={s.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4">
                      <p className="font-medium text-slate-800">{s.title}</p>
                      {s.description && <p className="text-slate-400 text-xs mt-0.5">{s.description}</p>}
                    </td>
                    <td className="px-4 py-4 text-center">
                      <span className="bg-blue-100 text-blue-700 font-semibold px-2 py-0.5 rounded text-xs">{s.story_points}</span>
                    </td>
                    <td className="px-4 py-4 text-slate-600">{assignedMember?.name || <span className="text-slate-300">Unassigned</span>}</td>
                    <td className="px-4 py-4 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[s.status] || STATUS_COLORS['To Do']}`}>
                        {s.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-3">
                        <button onClick={() => { setEditStory(s); setShowForm(false) }}
                          className="text-blue-500 hover:text-blue-700 text-xs font-medium">Edit</button>
                        {deleteConfirm === s.id ? (
                          <div className="flex gap-2">
                            <button onClick={() => handleDelete(s.id)} className="text-red-600 hover:text-red-800 text-xs font-medium">Confirm</button>
                            <button onClick={() => setDeleteConfirm(null)} className="text-slate-400 text-xs">Cancel</button>
                          </div>
                        ) : (
                          <button onClick={() => setDeleteConfirm(s.id)} className="text-red-400 hover:text-red-600 text-xs font-medium">Delete</button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
