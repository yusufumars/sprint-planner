import { useEffect, useState, useCallback } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import LeaveManagement from '../components/LeaveManagement'

const ROLES = ['Software Engineer Lead', 'Senior Software Engineer', 'Associate Software Engineer']
const ALLOCATION_OPTIONS = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100]

const AVATAR_COLORS = ['#0D6E6E', '#F59E0B', '#3B82F6', '#E07B54', '#8B5CF6', '#EF4444']

function getInitials(name) {
  if (!name) return '?'
  return name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()
}

const inputClass = "w-full bg-black border border-[#1A1A1A] rounded px-3 py-2 text-sm text-white font-mono placeholder-[#404040] focus:outline-none focus:border-[#BFFF00]"
const selectClass = "bg-black border border-[#1A1A1A] rounded px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-[#BFFF00]"

export default function Team() {
  const { teamCode } = useParams()
  const [searchParams] = useSearchParams()
  const [team, setTeam] = useState(null)
  const [members, setMembers] = useState([])
  const [activeSprint, setActiveSprint] = useState(null)
  const [leaveEntries, setLeaveEntries] = useState([])
  const [publicHolidays, setPublicHolidays] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('members')

  const [newName, setNewName] = useState('')
  const [newRole, setNewRole] = useState(ROLES[0])
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState('')
  const [editId, setEditId] = useState(null)
  const [editName, setEditName] = useState('')
  const [editRole, setEditRole] = useState(ROLES[0])
  const [editError, setEditError] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState(null)

  useEffect(() => {
    const tab = searchParams.get('tab')
    if (tab === 'leave') setActiveTab('leave')
  }, [searchParams])

  const loadLeaveData = useCallback(async (sprintId) => {
    if (!sprintId) return
    const [{ data: leaveData }, { data: holidayData }] = await Promise.all([
      supabase.from('member_leave').select('*').eq('sprint_id', sprintId).order('created_at'),
      supabase.from('public_holidays').select('*').eq('sprint_id', sprintId).order('created_at'),
    ])
    setLeaveEntries(leaveData || [])
    setPublicHolidays(holidayData || [])
  }, [])

  useEffect(() => {
    async function load() {
      setLoading(true)
      const { data: teamData } = await supabase.from('teams').select('*').eq('team_code', teamCode).single()
      if (!teamData) { setLoading(false); return }
      setTeam(teamData)

      const [{ data: membersData }, { data: sprintsData }] = await Promise.all([
        supabase.from('team_members').select('*').eq('team_id', teamData.id).order('created_at'),
        supabase.from('sprints').select('*').eq('team_id', teamData.id).eq('is_active', true).order('created_at', { ascending: false }).limit(1),
      ])
      if (membersData) setMembers(membersData)
      const sprint = sprintsData?.[0] || null
      setActiveSprint(sprint)
      if (sprint) await loadLeaveData(sprint.id)
      setLoading(false)
    }
    load()
  }, [teamCode, loadLeaveData])

  async function handleAdd(e) {
    e.preventDefault()
    if (!newName.trim() || !team) return
    setAdding(true)
    setAddError('')
    const { data, error } = await supabase
      .from('team_members')
      .insert({ team_id: team.id, name: newName.trim(), role: newRole })
      .select()
      .single()
    if (error) {
      setAddError(`Failed to add member: ${error.message}`)
    } else if (data) {
      setMembers((m) => [...m, data])
      setNewName('')
      setNewRole(ROLES[0])
    }
    setAdding(false)
  }

  async function handleAllocationChange(memberId, value) {
    setMembers((prev) => prev.map((m) => m.id === memberId ? { ...m, allocation_percentage: value } : m))
    await supabase.from('team_members').update({ allocation_percentage: value }).eq('id', memberId)
  }

  async function handleDelete(id) {
    await supabase.from('team_members').delete().eq('id', id)
    setMembers((m) => m.filter((x) => x.id !== id))
    setDeleteConfirm(null)
  }

  async function handleEditSave(id) {
    if (!editName.trim()) return
    setEditError('')
    const { error } = await supabase.from('team_members').update({ name: editName.trim(), role: editRole }).eq('id', id)
    if (error) { setEditError(`Failed to save: ${error.message}`); return }
    setMembers((m) => m.map((x) => x.id === id ? { ...x, name: editName.trim(), role: editRole } : x))
    setEditId(null)
  }

  function startEdit(m) {
    setEditId(m.id)
    setEditName(m.name)
    setEditRole(m.role || ROLES[0])
    setEditError('')
  }

  if (loading) return <div className="text-center py-20 text-[#6e6e6e] font-mono">Loading…</div>
  if (!team) return <div className="text-center py-20 text-[#6e6e6e] font-mono">Team not found.</div>

  const tabs = [
    { key: 'members', label: `Members` },
    { key: 'leave', label: 'Leave & Holidays', id: 'onboarding-leave-tab' },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">Team Management</h1>
          <p className="text-[#6e6e6e] text-sm font-mono mt-1">Manage team members and sprint leave</p>
        </div>
        {activeTab === 'members' && (
          <button
            onClick={() => document.getElementById('add-member-name')?.focus()}
            className="bg-[#BFFF00] hover:opacity-90 text-black font-mono font-semibold text-xs px-4 py-2.5 rounded transition-opacity"
          >
            + Add Member
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex bg-[#111111] border border-[#1A1A1A] rounded p-1 gap-1 w-fit">
        {tabs.map((t) => (
          <button
            key={t.key}
            id={t.id}
            onClick={() => setActiveTab(t.key)}
            className={`px-4 py-2 text-xs font-mono rounded transition-colors ${
              activeTab === t.key
                ? 'bg-[#BFFF00] text-black font-semibold'
                : 'text-[#6e6e6e] hover:text-white'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Tab: Members ── */}
      {activeTab === 'members' && (
        <>
          {/* Add member form */}
          <div id="onboarding-add-member-form" className="bg-[#111111] rounded-lg border border-[#1A1A1A] p-6">
            <h2 className="text-white font-semibold text-sm mb-4">Add Team Member</h2>
            <form onSubmit={handleAdd} className="flex gap-3">
              <input
                id="add-member-name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Member name"
                required
                className="flex-1 bg-black border border-[#1A1A1A] rounded px-3 py-2 text-sm text-white font-mono placeholder-[#404040] focus:outline-none focus:border-[#BFFF00]"
              />
              <select
                value={newRole}
                onChange={(e) => setNewRole(e.target.value)}
                className={selectClass}
              >
                {ROLES.map((r) => <option key={r}>{r}</option>)}
              </select>
              <button type="submit" disabled={adding}
                className="bg-[#BFFF00] hover:opacity-90 disabled:opacity-50 text-black font-mono font-semibold text-xs px-5 py-2 rounded transition-opacity">
                {adding ? 'Adding…' : 'Add Member'}
              </button>
            </form>
            {addError && (
              <p className="mt-3 text-red-400 text-xs font-mono bg-[#0D0000] border border-red-900 rounded px-3 py-2">{addError}</p>
            )}
          </div>

          {/* Members list */}
          <div className="bg-[#111111] rounded-lg border border-[#1A1A1A] overflow-hidden">
            <div className="px-6 py-4 border-b border-[#1A1A1A]">
              <h2 className="text-white font-semibold text-sm">Team Members ({members.length})</h2>
            </div>

            {members.length === 0 ? (
              <div className="text-center py-12 text-[#6e6e6e] font-mono text-sm">No members yet. Add your first team member above.</div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-black text-[#404040] font-mono text-[10px] tracking-[1px] uppercase">
                    <th className="text-left px-6 py-3">Name</th>
                    <th className="text-left px-4 py-3">Role</th>
                    <th className="text-center px-4 py-3">Allocation %</th>
                    <th className="text-right px-6 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {members.map((m, idx) => {
                    const avatarColor = AVATAR_COLORS[idx % AVATAR_COLORS.length]
                    return (
                      <tr key={m.id} className="border-t border-[#1A1A1A] hover:bg-[#0a0a0a]">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-[#1A1A1A] flex items-center justify-center shrink-0">
                              <span className="font-mono text-xs font-semibold" style={{ color: avatarColor }}>{getInitials(m.name)}</span>
                            </div>
                            {editId === m.id ? (
                              <input
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                className="bg-black border border-[#BFFF00] rounded px-2 py-1 text-sm text-white font-mono focus:outline-none w-40"
                              />
                            ) : (
                              <span className="font-medium text-white">{m.name}</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          {editId === m.id ? (
                            <>
                              <select
                                value={editRole}
                                onChange={(e) => setEditRole(e.target.value)}
                                className="bg-black border border-[#BFFF00] rounded px-2 py-1 text-xs text-white font-mono focus:outline-none"
                              >
                                {ROLES.map((r) => <option key={r}>{r}</option>)}
                              </select>
                              {editError && <p className="text-red-400 text-xs font-mono mt-1">{editError}</p>}
                            </>
                          ) : (
                            <span className="text-[#6e6e6e] text-xs font-mono">{m.role || '—'}</span>
                          )}
                        </td>
                        <td className="px-4 py-4 text-center">
                          <select
                            value={m.allocation_percentage || 100}
                            onChange={(e) => handleAllocationChange(m.id, parseInt(e.target.value, 10))}
                            className="bg-[#1A1A1A] border border-[#2A2A2A] rounded px-2 py-1 text-xs text-white font-mono focus:outline-none focus:border-[#BFFF00]"
                          >
                            {ALLOCATION_OPTIONS.map((v) => (
                              <option key={v} value={v}>{v}%</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-3">
                            {editId === m.id ? (
                              <>
                                <button onClick={() => handleEditSave(m.id)}
                                  className="text-[#BFFF00] hover:opacity-70 text-xs font-mono font-medium">Save</button>
                                <button onClick={() => setEditId(null)}
                                  className="text-[#6e6e6e] hover:text-white text-xs font-mono">Cancel</button>
                              </>
                            ) : (
                              <button onClick={() => startEdit(m)}
                                className="text-[#6e6e6e] hover:text-white text-xs font-mono">Edit</button>
                            )}
                            {deleteConfirm === m.id ? (
                              <>
                                <button onClick={() => handleDelete(m.id)}
                                  className="text-red-400 hover:text-red-300 text-xs font-mono font-medium">Confirm</button>
                                <button onClick={() => setDeleteConfirm(null)}
                                  className="text-[#6e6e6e] text-xs font-mono">Cancel</button>
                              </>
                            ) : (
                              <button onClick={() => setDeleteConfirm(m.id)}
                                className="text-red-500 hover:text-red-400 text-xs font-mono">Remove</button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {/* ── Tab: Leave & Holidays ── */}
      {activeTab === 'leave' && (
        <LeaveManagement
          team={team}
          sprint={activeSprint}
          members={members}
          leaveEntries={leaveEntries}
          publicHolidays={publicHolidays}
          onLeaveChange={() => activeSprint && loadLeaveData(activeSprint.id)}
        />
      )}
    </div>
  )
}
