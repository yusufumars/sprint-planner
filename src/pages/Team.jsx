import { useEffect, useState, useCallback } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import LeaveManagement from '../components/LeaveManagement'

const ROLES = ['Software Engineer Lead', 'Senior Software Engineer', 'Associate Software Engineer']
const ALLOCATION_OPTIONS = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100]

export default function Team() {
  const { teamCode } = useParams()
  const [searchParams] = useSearchParams()
  const [team, setTeam] = useState(null)
  const [members, setMembers] = useState([])
  const [activeSprint, setActiveSprint] = useState(null)
  const [leaveEntries, setLeaveEntries] = useState([])
  const [publicHolidays, setPublicHolidays] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('members') // 'members' | 'leave'

  // Member form
  const [newName, setNewName] = useState('')
  const [newRole, setNewRole] = useState(ROLES[0])
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState('')
  const [editId, setEditId] = useState(null)
  const [editName, setEditName] = useState('')
  const [editRole, setEditRole] = useState(ROLES[0])
  const [editError, setEditError] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState(null)

  // Sync tab from URL param (used by onboarding to deep-link to leave tab)
  useEffect(() => {
    const tab = searchParams.get('tab')
    if (tab === 'leave') setActiveTab('leave')
  }, [searchParams])

  const loadLeaveData = useCallback(async (sprintId) => {
    if (!sprintId) return
    console.log('[Team] Loading leave data for sprint_id:', sprintId)
    const [{ data: leaveData, error: leaveErr }, { data: holidayData, error: holidayErr }] = await Promise.all([
      supabase.from('member_leave').select('*').eq('sprint_id', sprintId).order('created_at'),
      supabase.from('public_holidays').select('*').eq('sprint_id', sprintId).order('created_at'),
    ])
    if (leaveErr) console.error('[Team] member_leave fetch error:', leaveErr)
    if (holidayErr) console.error('[Team] public_holidays fetch error:', holidayErr)
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
        supabase.from('sprints').select('*').eq('team_id', teamData.id).eq('is_active', true).limit(1),
      ])
      if (membersData) setMembers(membersData)
      const sprint = sprintsData?.[0] || null
      setActiveSprint(sprint)
      if (sprint) await loadLeaveData(sprint.id)
      setLoading(false)
    }
    load()
  }, [teamCode, loadLeaveData])

  // ── Member actions ─────────────────────────────────────────────────

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
      console.error('[Team] Add member error:', error)
      setAddError(`Failed to add member: ${error.message}. Make sure migrations have been run (role column required).`)
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
    const { error } = await supabase
      .from('team_members')
      .update({ name: editName.trim(), role: editRole })
      .eq('id', id)
    if (error) {
      console.error('[Team] Edit member error:', error)
      setEditError(`Failed to save: ${error.message}`)
      return
    }
    setMembers((m) => m.map((x) => x.id === id ? { ...x, name: editName.trim(), role: editRole } : x))
    setEditId(null)
  }

  function startEdit(m) {
    setEditId(m.id)
    setEditName(m.name)
    setEditRole(m.role || ROLES[0])
    setEditError('')
  }

  // ── Render ─────────────────────────────────────────────────────────

  if (loading) return <div className="text-center py-20 text-slate-400">Loading…</div>
  if (!team) return <div className="text-center py-20 text-slate-400">Team not found.</div>

  const tabs = [
    { key: 'members', label: `Members (${members.length})` },
    { key: 'leave', label: 'Leave & Holidays', id: 'onboarding-leave-tab' },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Team</h1>
        <p className="text-slate-500 text-sm mt-1">Manage team members and sprint leave</p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200">
        {tabs.map((t) => (
          <button
            key={t.key}
            id={t.id}
            onClick={() => setActiveTab(t.key)}
            className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === t.key
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
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
          <div id="onboarding-add-member-form" className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h2 className="font-semibold text-slate-800 mb-4">Add Team Member</h2>
            <form onSubmit={handleAdd} className="flex gap-3">
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Member name"
                required
                className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <select
                value={newRole}
                onChange={(e) => setNewRole(e.target.value)}
                className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {ROLES.map((r) => <option key={r}>{r}</option>)}
              </select>
              <button type="submit" disabled={adding}
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors">
                {adding ? 'Adding…' : 'Add Member'}
              </button>
            </form>
            {addError && (
              <p className="mt-3 text-red-600 text-xs bg-red-50 border border-red-200 rounded-lg px-3 py-2">{addError}</p>
            )}
          </div>

          {/* Members list */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100">
              <h2 className="font-semibold text-slate-800">Team Members</h2>
            </div>

            {members.length === 0 ? (
              <div className="text-center py-12 text-slate-400">No members yet. Add your first team member above.</div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
                    <th className="text-left px-6 py-3">Name</th>
                    <th className="text-left px-4 py-3">Role</th>
                    <th className="text-center px-4 py-3">Allocation %</th>
                    <th className="text-right px-6 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {members.map((m) => (
                    <tr key={m.id} className="hover:bg-slate-50">
                      <td className="px-6 py-4">
                        {editId === m.id ? (
                          <input
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="border border-blue-400 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 w-48"
                          />
                        ) : (
                          <span className="font-medium text-slate-800">{m.name}</span>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        {editId === m.id ? (
                          <>
                            <select
                              value={editRole}
                              onChange={(e) => setEditRole(e.target.value)}
                              className="border border-blue-400 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                            >
                              {ROLES.map((r) => <option key={r}>{r}</option>)}
                            </select>
                            {editError && <p className="text-red-600 text-xs mt-1">{editError}</p>}
                          </>
                        ) : (
                          <span className="text-slate-500 text-xs">{m.role || '—'}</span>
                        )}
                      </td>
                      <td className="px-4 py-4 text-center">
                        <select
                          value={m.allocation_percentage || 100}
                          onChange={(e) => handleAllocationChange(m.id, parseInt(e.target.value, 10))}
                          className="border border-slate-300 rounded px-2 py-1 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
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
                                className="text-blue-600 hover:text-blue-800 text-xs font-medium">Save</button>
                              <button onClick={() => setEditId(null)}
                                className="text-slate-400 hover:text-slate-600 text-xs">Cancel</button>
                            </>
                          ) : (
                            <button onClick={() => startEdit(m)}
                              className="text-blue-500 hover:text-blue-700 text-xs font-medium">Edit</button>
                          )}
                          {deleteConfirm === m.id ? (
                            <>
                              <button onClick={() => handleDelete(m.id)}
                                className="text-red-600 hover:text-red-800 text-xs font-medium">Confirm</button>
                              <button onClick={() => setDeleteConfirm(null)}
                                className="text-slate-400 text-xs">Cancel</button>
                            </>
                          ) : (
                            <button onClick={() => setDeleteConfirm(m.id)}
                              className="text-red-400 hover:text-red-600 text-xs font-medium">Remove</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
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
