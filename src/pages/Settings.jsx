import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useOnboarding } from '../context/OnboardingContext'

const ROLES = ['Software Engineer Lead', 'Senior Software Engineer', 'Associate Software Engineer']

export default function Settings() {
  const { teamCode } = useParams()
  const { startOnboarding } = useOnboarding()
  const [team, setTeam] = useState(null)
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)

  // Team info
  const [teamName, setTeamName] = useState('')
  const [savingName, setSavingName] = useState(false)
  const [nameSaved, setNameSaved] = useState(false)

  // Defaults
  const [defaults, setDefaults] = useState({ default_story_points: 15, default_focus_factor: 80, default_sprint_length: 14 })
  const [savingDefaults, setSavingDefaults] = useState(false)
  const [defaultsSaved, setDefaultsSaved] = useState(false)

  // Member management
  const [newMemberName, setNewMemberName] = useState('')
  const [newMemberRole, setNewMemberRole] = useState(ROLES[0])
  const [addingMember, setAddingMember] = useState(false)
  const [editMemberId, setEditMemberId] = useState(null)
  const [editMemberName, setEditMemberName] = useState('')
  const [editMemberRole, setEditMemberRole] = useState(ROLES[0])
  const [deleteMemberConfirm, setDeleteMemberConfirm] = useState(null)

  // Danger zone
  const [dangerConfirm, setDangerConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // Copy feedback
  const [copied, setCopied] = useState('')

  useEffect(() => {
    async function load() {
      setLoading(true)
      const { data: teamData } = await supabase.from('teams').select('*').eq('team_code', teamCode).single()
      if (!teamData) { setLoading(false); return }
      setTeam(teamData)
      setTeamName(teamData.name)
      setDefaults({
        default_story_points: teamData.default_story_points || 15,
        default_focus_factor: teamData.default_focus_factor || 80,
        default_sprint_length: teamData.default_sprint_length || 14,
      })
      const { data: membersData } = await supabase.from('team_members').select('*').eq('team_id', teamData.id).order('created_at')
      if (membersData) setMembers(membersData)
      setLoading(false)
    }
    load()
  }, [teamCode])

  async function handleSaveName(e) {
    e.preventDefault()
    if (!teamName.trim() || !team) return
    setSavingName(true)
    await supabase.from('teams').update({ name: teamName.trim() }).eq('id', team.id)
    setTeam((t) => ({ ...t, name: teamName.trim() }))
    setSavingName(false)
    setNameSaved(true)
    setTimeout(() => setNameSaved(false), 2000)
  }

  async function handleSaveDefaults(e) {
    e.preventDefault()
    if (!team) return
    setSavingDefaults(true)
    const newFocusFactor = parseInt(defaults.default_focus_factor, 10)
    const newStoryPoints = parseInt(defaults.default_story_points, 10)
    await supabase.from('teams').update({
      default_story_points: newStoryPoints,
      default_focus_factor: newFocusFactor,
      default_sprint_length: parseInt(defaults.default_sprint_length, 10),
    }).eq('id', team.id)
    // Propagate focus_factor to all active sprints so Dashboard reflects the change immediately
    const { data: activeSprints } = await supabase
      .from('sprints').select('id').eq('team_id', team.id).eq('is_active', true)
    if (activeSprints?.length > 0) {
      await supabase.from('sprints')
        .update({ focus_factor: newFocusFactor })
        .in('id', activeSprints.map((s) => s.id))
    }
    setSavingDefaults(false)
    setDefaultsSaved(true)
    setTimeout(() => setDefaultsSaved(false), 2000)
  }

  async function handleAddMember(e) {
    e.preventDefault()
    if (!newMemberName.trim() || !team) return
    setAddingMember(true)
    const { data } = await supabase.from('team_members')
      .insert({ team_id: team.id, name: newMemberName.trim(), role: newMemberRole })
      .select().single()
    if (data) setMembers((m) => [...m, data])
    setNewMemberName('')
    setNewMemberRole(ROLES[0])
    setAddingMember(false)
  }

  async function handleEditMember(id) {
    if (!editMemberName.trim()) return
    await supabase.from('team_members').update({ name: editMemberName.trim(), role: editMemberRole }).eq('id', id)
    setMembers((m) => m.map((x) => x.id === id ? { ...x, name: editMemberName.trim(), role: editMemberRole } : x))
    setEditMemberId(null)
  }

  async function handleDeleteMember(id) {
    await supabase.from('team_members').delete().eq('id', id)
    setMembers((m) => m.filter((x) => x.id !== id))
    setDeleteMemberConfirm(null)
  }

  async function handleDeleteAllSprints() {
    if (!team) return
    setDeleting(true)
    const { data: sprintsData } = await supabase.from('sprints').select('id').eq('team_id', team.id)
    const ids = sprintsData?.map((s) => s.id) || []
    if (ids.length > 0) {
      await Promise.all([
        supabase.from('sprint_availability').delete().in('sprint_id', ids),
        supabase.from('member_leave').delete().in('sprint_id', ids),
        supabase.from('public_holidays').delete().in('sprint_id', ids),
      ])
      await supabase.from('sprints').delete().eq('team_id', team.id)
    }
    setDeleting(false)
    setDangerConfirm(false)
  }

  function copyToClipboard(text, key) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key)
      setTimeout(() => setCopied(''), 2000)
    })
  }

  const shareableUrl = `${window.location.origin}/team/${teamCode}`

  if (loading) return <div className="text-center py-20 text-slate-400">Loading…</div>
  if (!team) return <div className="text-center py-20 text-slate-400">Team not found.</div>

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
        <p className="text-slate-500 text-sm mt-1">Configure your team workspace</p>
      </div>

      {/* Team Information */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <h2 className="font-semibold text-slate-800 mb-5">Team Information</h2>
        <form onSubmit={handleSaveName} className="mb-5">
          <label className="block text-sm font-medium text-slate-700 mb-1">Team Name</label>
          <div className="flex gap-3">
            <input
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button type="submit" disabled={savingName}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
              {nameSaved ? '✓ Saved' : savingName ? 'Saving…' : 'Save Name'}
            </button>
          </div>
        </form>

        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Team Code</label>
            <div className="flex gap-3">
              <input readOnly value={teamCode}
                className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm bg-slate-50 font-mono text-slate-600" />
              <button type="button" onClick={() => copyToClipboard(teamCode, 'code')}
                className="border border-slate-300 hover:bg-slate-50 text-slate-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors">
                {copied === 'code' ? '✓ Copied' : 'Copy Code'}
              </button>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Shareable Link</label>
            <div className="flex gap-3">
              <input readOnly value={shareableUrl}
                className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm bg-slate-50 text-slate-600" />
              <button type="button" onClick={() => copyToClipboard(shareableUrl, 'url')}
                className="border border-slate-300 hover:bg-slate-50 text-slate-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors">
                {copied === 'url' ? '✓ Copied' : 'Copy Link'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Sprint Defaults */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <h2 className="font-semibold text-slate-800 mb-5">Sprint Defaults</h2>
        <form onSubmit={handleSaveDefaults} className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Story Points / Member</label>
              <input type="number" min="1"
                value={defaults.default_story_points}
                onChange={(e) => setDefaults((d) => ({ ...d, default_story_points: e.target.value }))}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Focus Factor %</label>
              <input type="number" min="1" max="100"
                value={defaults.default_focus_factor}
                onChange={(e) => setDefaults((d) => ({ ...d, default_focus_factor: e.target.value }))}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Sprint Length (days)</label>
              <input type="number" min="1"
                value={defaults.default_sprint_length}
                onChange={(e) => setDefaults((d) => ({ ...d, default_sprint_length: e.target.value }))}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <button type="submit" disabled={savingDefaults}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors">
            {defaultsSaved ? '✓ Saved' : savingDefaults ? 'Saving…' : 'Save Defaults'}
          </button>
        </form>
      </div>

      {/* Team Members */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <h2 className="font-semibold text-slate-800 mb-5">Team Members</h2>
        <form onSubmit={handleAddMember} className="flex gap-3 mb-5">
          <input
            value={newMemberName}
            onChange={(e) => setNewMemberName(e.target.value)}
            placeholder="Member name"
            required
            className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <select
            value={newMemberRole}
            onChange={(e) => setNewMemberRole(e.target.value)}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {ROLES.map((r) => <option key={r}>{r}</option>)}
          </select>
          <button type="submit" disabled={addingMember}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors">
            {addingMember ? 'Adding…' : 'Add Member'}
          </button>
        </form>

        {members.length === 0 ? (
          <p className="text-slate-400 text-sm">No members yet.</p>
        ) : (
          <div className="space-y-2">
            {members.map((m) => (
              <div key={m.id} className="flex items-center justify-between px-4 py-3 bg-slate-50 rounded-lg">
                {editMemberId === m.id ? (
                  <div className="flex items-center gap-2 flex-1">
                    <input
                      value={editMemberName}
                      onChange={(e) => setEditMemberName(e.target.value)}
                      className="border border-blue-400 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 w-36"
                    />
                    <select
                      value={editMemberRole}
                      onChange={(e) => setEditMemberRole(e.target.value)}
                      className="border border-blue-400 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      {ROLES.map((r) => <option key={r}>{r}</option>)}
                    </select>
                    <button onClick={() => handleEditMember(m.id)} className="text-blue-600 text-xs font-medium">Save</button>
                    <button onClick={() => setEditMemberId(null)} className="text-slate-400 text-xs">Cancel</button>
                  </div>
                ) : (
                  <div>
                    <span className="font-medium text-slate-700 text-sm">{m.name}</span>
                    {m.role && <span className="text-slate-400 text-xs ml-2">({m.role})</span>}
                  </div>
                )}
                {editMemberId !== m.id && (
                  <div className="flex items-center gap-3">
                    <button onClick={() => { setEditMemberId(m.id); setEditMemberName(m.name); setEditMemberRole(m.role || ROLES[0]) }}
                      className="text-blue-500 hover:text-blue-700 text-xs font-medium">Edit</button>
                    {deleteMemberConfirm === m.id ? (
                      <div className="flex gap-2">
                        <button onClick={() => handleDeleteMember(m.id)} className="text-red-600 text-xs font-medium">Confirm</button>
                        <button onClick={() => setDeleteMemberConfirm(null)} className="text-slate-400 text-xs">Cancel</button>
                      </div>
                    ) : (
                      <button onClick={() => setDeleteMemberConfirm(m.id)} className="text-red-400 hover:text-red-600 text-xs font-medium">Remove</button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Setup Guide */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <h2 className="font-semibold text-slate-800 mb-2">Setup Guide</h2>
        <p className="text-slate-500 text-sm mb-4">Re-run the onboarding walkthrough to see the key features highlighted.</p>
        <button
          onClick={startOnboarding}
          className="border border-blue-300 text-blue-600 hover:bg-blue-50 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          Show Setup Guide
        </button>
      </div>

      {/* Danger Zone */}
      <div className="bg-white rounded-xl shadow-sm border border-red-200 p-6">
        <h2 className="font-semibold text-red-700 mb-2">Danger Zone</h2>
        <p className="text-slate-500 text-sm mb-4">These actions are irreversible. Please be certain.</p>
        {dangerConfirm ? (
          <div className="flex items-center gap-3 p-4 bg-red-50 rounded-lg border border-red-200">
            <p className="text-red-700 text-sm flex-1">This will permanently delete all sprints, leave entries, and availability data for this team. Are you sure?</p>
            <button onClick={handleDeleteAllSprints} disabled={deleting}
              className="bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
              {deleting ? 'Deleting…' : 'Yes, Delete All'}
            </button>
            <button onClick={() => setDangerConfirm(false)} className="text-slate-500 text-sm">Cancel</button>
          </div>
        ) : (
          <button onClick={() => setDangerConfirm(true)}
            className="border border-red-300 text-red-600 hover:bg-red-50 px-4 py-2 rounded-lg text-sm font-medium transition-colors">
            Delete All Sprint Data
          </button>
        )}
      </div>
    </div>
  )
}
