import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useOnboarding } from '../context/OnboardingContext'

const ROLES = ['Software Engineer Lead', 'Senior Software Engineer', 'Associate Software Engineer']

const AVATAR_COLORS = ['#0D6E6E', '#F59E0B', '#3B82F6', '#E07B54', '#8B5CF6', '#EF4444']

function getInitials(name) {
  if (!name) return '?'
  return name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()
}

const inputClass = "w-full bg-black border border-[#1A1A1A] rounded px-3 h-10 text-sm text-white font-mono placeholder-[#404040] focus:outline-none focus:border-[#BFFF00]"

export default function Settings() {
  const { teamCode } = useParams()
  const { startOnboarding } = useOnboarding()
  const [team, setTeam] = useState(null)
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)

  const [teamName, setTeamName] = useState('')
  const [savingName, setSavingName] = useState(false)
  const [nameSaved, setNameSaved] = useState(false)

  const [defaults, setDefaults] = useState({ default_story_points: 15, default_focus_factor: 80, default_sprint_length: 14 })
  const [savingDefaults, setSavingDefaults] = useState(false)
  const [defaultsSaved, setDefaultsSaved] = useState(false)

  const [newMemberName, setNewMemberName] = useState('')
  const [newMemberRole, setNewMemberRole] = useState(ROLES[0])
  const [addingMember, setAddingMember] = useState(false)
  const [editMemberId, setEditMemberId] = useState(null)
  const [editMemberName, setEditMemberName] = useState('')
  const [editMemberRole, setEditMemberRole] = useState(ROLES[0])
  const [deleteMemberConfirm, setDeleteMemberConfirm] = useState(null)

  const [dangerConfirm, setDangerConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)

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

  if (loading) return <div className="text-center py-20 text-[#6e6e6e] font-mono">Loading…</div>
  if (!team) return <div className="text-center py-20 text-[#6e6e6e] font-mono">Team not found.</div>

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Settings</h1>
        <p className="text-[#6e6e6e] text-sm font-mono mt-1">Configure your team workspace</p>
      </div>

      <div className="flex gap-5 items-start">
        {/* ── Left column ── */}
        <div className="flex-1 flex flex-col gap-5 min-w-0">

          {/* Team Information */}
          <div className="bg-[#111111] rounded-lg border border-[#1A1A1A] p-6">
            <p className="font-mono text-xs text-[#6e6e6e] tracking-[2px] uppercase mb-4">Team Information</p>
            <form onSubmit={handleSaveName} className="mb-5">
              <label className="block font-mono text-[10px] text-[#404040] tracking-[1px] uppercase mb-1.5">Team Name</label>
              <div className="flex gap-3">
                <input value={teamName} onChange={(e) => setTeamName(e.target.value)} className={inputClass} />
                <button type="submit" disabled={savingName}
                  className="bg-[#BFFF00] hover:opacity-90 disabled:opacity-50 text-black font-mono font-semibold text-xs px-4 py-2 rounded transition-opacity whitespace-nowrap">
                  {nameSaved ? '✓ Saved' : savingName ? 'Saving…' : 'Save Name'}
                </button>
              </div>
            </form>
            <div>
              <label className="block font-mono text-[10px] text-[#404040] tracking-[1px] uppercase mb-1.5">Team Code</label>
              <div className="flex gap-3 items-center">
                <input readOnly value={teamCode} className={`${inputClass} text-[#999999] cursor-default`} />
              </div>
            </div>
          </div>

          {/* Sprint Defaults */}
          <div className="bg-[#111111] rounded-lg border border-[#1A1A1A] p-6">
            <p className="font-mono text-xs text-[#6e6e6e] tracking-[2px] uppercase mb-4">Sprint Defaults</p>
            <form onSubmit={handleSaveDefaults} className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block font-mono text-[10px] text-[#404040] tracking-[1px] uppercase mb-1.5">SP / Member</label>
                  <input type="number" min="1"
                    value={defaults.default_story_points}
                    onChange={(e) => setDefaults((d) => ({ ...d, default_story_points: e.target.value }))}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block font-mono text-[10px] text-[#404040] tracking-[1px] uppercase mb-1.5">Focus Factor %</label>
                  <input type="number" min="1" max="100"
                    value={defaults.default_focus_factor}
                    onChange={(e) => setDefaults((d) => ({ ...d, default_focus_factor: e.target.value }))}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block font-mono text-[10px] text-[#404040] tracking-[1px] uppercase mb-1.5">Sprint Length (days)</label>
                  <input type="number" min="1"
                    value={defaults.default_sprint_length}
                    onChange={(e) => setDefaults((d) => ({ ...d, default_sprint_length: e.target.value }))}
                    className={inputClass}
                  />
                </div>
              </div>
              <button type="submit" disabled={savingDefaults}
                className="bg-[#BFFF00] hover:opacity-90 disabled:opacity-50 text-black font-mono font-semibold text-xs px-5 py-2.5 rounded transition-opacity">
                {defaultsSaved ? '✓ Saved' : savingDefaults ? 'Saving…' : 'Save Defaults'}
              </button>
            </form>
          </div>

          {/* Team Members */}
          <div className="bg-[#111111] rounded-lg border border-[#1A1A1A] p-6">
            <p className="font-mono text-xs text-[#6e6e6e] tracking-[2px] uppercase mb-4">Team Members</p>
            <form onSubmit={handleAddMember} className="flex gap-3 mb-5">
              <input
                value={newMemberName}
                onChange={(e) => setNewMemberName(e.target.value)}
                placeholder="Member name"
                required
                className="flex-1 bg-black border border-[#1A1A1A] rounded px-3 h-10 text-sm text-white font-mono placeholder-[#404040] focus:outline-none focus:border-[#BFFF00]"
              />
              <select
                value={newMemberRole}
                onChange={(e) => setNewMemberRole(e.target.value)}
                className="bg-black border border-[#1A1A1A] rounded px-3 h-10 text-sm text-white font-mono focus:outline-none focus:border-[#BFFF00]"
              >
                {ROLES.map((r) => <option key={r}>{r}</option>)}
              </select>
              <button type="submit" disabled={addingMember}
                className="bg-[#BFFF00] hover:opacity-90 disabled:opacity-50 text-black font-mono font-semibold text-xs px-5 py-2 rounded transition-opacity whitespace-nowrap">
                {addingMember ? 'Adding…' : 'Add'}
              </button>
            </form>

            {members.length === 0 ? (
              <p className="text-[#6e6e6e] font-mono text-sm">No members yet.</p>
            ) : (
              <div className="flex flex-col">
                {members.map((m, idx) => {
                  const avatarColor = AVATAR_COLORS[idx % AVATAR_COLORS.length]
                  return (
                    <div key={m.id} className="flex items-center justify-between py-3 border-t border-[#1A1A1A] first:border-t-0">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-[#1A1A1A] flex items-center justify-center shrink-0">
                          <span className="font-mono text-xs font-semibold" style={{ color: avatarColor }}>{getInitials(m.name)}</span>
                        </div>
                        {editMemberId === m.id ? (
                          <div className="flex items-center gap-2">
                            <input
                              value={editMemberName}
                              onChange={(e) => setEditMemberName(e.target.value)}
                              className="bg-black border border-[#BFFF00] rounded px-2 py-1 text-sm text-white font-mono focus:outline-none w-36"
                            />
                            <select
                              value={editMemberRole}
                              onChange={(e) => setEditMemberRole(e.target.value)}
                              className="bg-black border border-[#BFFF00] rounded px-2 py-1 text-xs text-white font-mono focus:outline-none"
                            >
                              {ROLES.map((r) => <option key={r}>{r}</option>)}
                            </select>
                          </div>
                        ) : (
                          <div>
                            <span className="font-medium text-white text-sm">{m.name}</span>
                            {m.role && <span className="text-[#6e6e6e] text-xs font-mono ml-2">({m.role})</span>}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        {editMemberId === m.id ? (
                          <>
                            <button onClick={() => handleEditMember(m.id)} className="text-[#BFFF00] hover:opacity-70 text-xs font-mono font-medium">Save</button>
                            <button onClick={() => setEditMemberId(null)} className="text-[#6e6e6e] hover:text-white text-xs font-mono">Cancel</button>
                          </>
                        ) : (
                          <button onClick={() => { setEditMemberId(m.id); setEditMemberName(m.name); setEditMemberRole(m.role || ROLES[0]) }}
                            className="text-[#6e6e6e] hover:text-white text-xs font-mono">Edit</button>
                        )}
                        {deleteMemberConfirm === m.id ? (
                          <div className="flex gap-2">
                            <button onClick={() => handleDeleteMember(m.id)} className="text-red-400 hover:text-red-300 text-xs font-mono font-medium">Confirm</button>
                            <button onClick={() => setDeleteMemberConfirm(null)} className="text-[#6e6e6e] text-xs font-mono">Cancel</button>
                          </div>
                        ) : (
                          <button onClick={() => setDeleteMemberConfirm(m.id)} className="text-red-500 hover:text-red-400 text-xs font-mono">Remove</button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* ── Right column ── */}
        <div className="w-72 shrink-0 flex flex-col gap-5">

          {/* Share link */}
          <div className="bg-[#111111] rounded-lg border border-[#1A1A1A] p-6">
            <p className="font-mono text-xs text-[#6e6e6e] tracking-[2px] uppercase mb-4">Share Your Team</p>
            <div className="flex gap-2">
              <input readOnly value={shareableUrl}
                className="flex-1 bg-black border border-[#1A1A1A] rounded px-3 h-10 text-xs text-[#999999] font-mono focus:outline-none truncate" />
              <button type="button" onClick={() => copyToClipboard(shareableUrl, 'url')}
                className="bg-[#BFFF00] hover:opacity-90 text-black font-mono font-semibold text-xs px-3 py-2 rounded transition-opacity whitespace-nowrap">
                {copied === 'url' ? '✓ Copied' : 'Copy Link'}
              </button>
            </div>
            <p className="text-[#404040] text-xs font-mono mt-3">Share this link with your team to give them access.</p>
          </div>

          {/* Setup Guide */}
          <div className="bg-[#111111] rounded-lg border border-[#1A1A1A] p-6">
            <p className="font-mono text-xs text-[#6e6e6e] tracking-[2px] uppercase mb-3">Setup Guide</p>
            <button
              onClick={startOnboarding}
              className="w-full border border-[#BFFF00] text-white hover:bg-[#1A1A1A] font-mono text-xs py-2.5 rounded transition-colors"
            >
              Show Setup Guide
            </button>
            <p className="text-[#404040] text-xs font-mono mt-3">Re-run the onboarding walkthrough.</p>
          </div>

          {/* Danger Zone */}
          <div className="bg-[#0D0000] rounded-lg border border-red-900 p-6">
            <p className="font-mono text-xs text-red-500 tracking-[2px] uppercase mb-3">Danger Zone</p>
            <p className="text-[#999999] text-sm font-sans mb-4">These actions are irreversible. Please be certain before proceeding.</p>
            {dangerConfirm ? (
              <div className="space-y-3">
                <p className="text-red-400 text-xs font-mono">This will permanently delete all sprints and data for this team.</p>
                <div className="flex gap-2">
                  <button onClick={handleDeleteAllSprints} disabled={deleting}
                    className="bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white font-mono font-semibold text-xs px-4 py-2 rounded transition-colors">
                    {deleting ? 'Deleting…' : 'Yes, Delete All'}
                  </button>
                  <button onClick={() => setDangerConfirm(false)}
                    className="text-[#6e6e6e] hover:text-white text-xs font-mono py-2">Cancel</button>
                </div>
              </div>
            ) : (
              <button onClick={() => setDangerConfirm(true)}
                className="w-full bg-red-500 hover:bg-red-600 text-white font-mono font-semibold text-xs py-2.5 rounded transition-colors">
                Delete All Sprint Data
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
