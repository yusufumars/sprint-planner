import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { calcWorkingDays } from '../lib/utils'

const LEAVE_TYPES = ['Annual Leave', 'Maternity Leave', 'Sick Leave', 'Study Leave']

const emptyLeaveForm = { member_id: '', leave_type: 'Annual Leave', start_date: '', end_date: '' }
const emptyHolidayForm = { name: '', start_date: '', end_date: '' }

function WorkingDaysTag({ start, end }) {
  const days = calcWorkingDays(start, end)
  if (!start || !end) return null
  return (
    <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
      {days} working day{days !== 1 ? 's' : ''}
    </span>
  )
}

/**
 * Props:
 *  team            – { id }
 *  sprint          – { id, start_date, end_date }
 *  members         – array of { id, name, role }
 *  leaveEntries    – array from member_leave table
 *  publicHolidays  – array from public_holidays table
 *  onLeaveChange   – () => void  (notify parent to refetch)
 */
export default function LeaveManagement({ team, sprint, members, leaveEntries, publicHolidays, onLeaveChange }) {
  const [showLeaveForm, setShowLeaveForm] = useState(false)
  const [leaveForm, setLeaveForm] = useState(emptyLeaveForm)
  const [savingLeave, setSavingLeave] = useState(false)
  const [leaveError, setLeaveError] = useState('')
  const [deleteLeaveId, setDeleteLeaveId] = useState(null)

  const [showHolidayForm, setShowHolidayForm] = useState(false)
  const [holidayForm, setHolidayForm] = useState(emptyHolidayForm)
  const [savingHoliday, setSavingHoliday] = useState(false)
  const [holidayError, setHolidayError] = useState('')
  const [deleteHolidayId, setDeleteHolidayId] = useState(null)

  const totalPublicDays = publicHolidays.reduce((sum, h) => sum + (h.working_days || 0), 0)

  // ── Individual Leave ────────────────────────────────────────────────

  async function handleAddLeave(e) {
    e.preventDefault()
    if (!sprint || !leaveForm.member_id) return
    setSavingLeave(true)
    setLeaveError('')
    const wdays = calcWorkingDays(leaveForm.start_date, leaveForm.end_date)
    console.log('[LeaveManagement] Inserting leave for sprint_id:', sprint.id, 'member_id:', leaveForm.member_id)
    const { error } = await supabase.from('member_leave').insert({
      sprint_id: sprint.id,
      member_id: leaveForm.member_id,
      leave_type: leaveForm.leave_type,
      start_date: leaveForm.start_date,
      end_date: leaveForm.end_date,
      working_days: wdays,
    })
    setSavingLeave(false)
    if (error) {
      console.error('[LeaveManagement] Leave insert error:', error)
      setLeaveError(`Failed to save: ${error.message}. Make sure the member_leave table exists (run migrations).`)
    } else {
      setLeaveForm(emptyLeaveForm)
      setShowLeaveForm(false)
      onLeaveChange()
    }
  }

  async function handleDeleteLeave(id) {
    await supabase.from('member_leave').delete().eq('id', id)
    setDeleteLeaveId(null)
    onLeaveChange()
  }

  // ── Public Holidays ─────────────────────────────────────────────────

  async function handleAddHoliday(e) {
    e.preventDefault()
    if (!sprint || !team) return
    setSavingHoliday(true)
    setHolidayError('')
    const wdays = calcWorkingDays(holidayForm.start_date, holidayForm.end_date)
    console.log('[LeaveManagement] Inserting holiday for sprint_id:', sprint.id, 'team_id:', team.id)
    const { error } = await supabase.from('public_holidays').insert({
      team_id: team.id,
      sprint_id: sprint.id,
      name: holidayForm.name,
      start_date: holidayForm.start_date,
      end_date: holidayForm.end_date,
      working_days: wdays,
    })
    setSavingHoliday(false)
    if (error) {
      console.error('[LeaveManagement] Holiday insert error:', error)
      setHolidayError(`Failed to save: ${error.message}. Make sure the public_holidays table exists (run migrations).`)
    } else {
      setHolidayForm(emptyHolidayForm)
      setShowHolidayForm(false)
      onLeaveChange()
    }
  }

  async function handleDeleteHoliday(id) {
    await supabase.from('public_holidays').delete().eq('id', id)
    setDeleteHolidayId(null)
    onLeaveChange()
  }

  const memberName = (id) => members.find((m) => m.id === id)?.name || '—'

  if (!sprint) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-10 text-center text-slate-400">
        No active sprint. Create a sprint on the Dashboard to manage leave.
      </div>
    )
  }

  return (
    <div id="onboarding-leave-section" className="space-y-6">
      {/* ── Section A: Individual Leave ── */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-slate-800">Individual Leave</h2>
            <p className="text-slate-400 text-xs mt-0.5">Sprint: {sprint.name || sprint.id}</p>
          </div>
          {!showLeaveForm && (
            <button
              onClick={() => setShowLeaveForm(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              + Add Leave
            </button>
          )}
        </div>

        {showLeaveForm && (
          <form onSubmit={handleAddLeave} className="px-6 py-5 bg-blue-50 border-b border-blue-100 space-y-4">
            <p className="text-sm font-medium text-slate-700">New Leave Entry</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Team Member *</label>
                <select
                  required
                  value={leaveForm.member_id}
                  onChange={(e) => setLeaveForm((f) => ({ ...f, member_id: e.target.value }))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select member…</option>
                  {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Leave Type *</label>
                <select
                  value={leaveForm.leave_type}
                  onChange={(e) => setLeaveForm((f) => ({ ...f, leave_type: e.target.value }))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {LEAVE_TYPES.map((t) => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Start Date *</label>
                <input
                  required
                  type="date"
                  value={leaveForm.start_date}
                  onChange={(e) => setLeaveForm((f) => ({ ...f, start_date: e.target.value }))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">End Date *</label>
                <div className="flex items-center gap-2">
                  <input
                    required
                    type="date"
                    value={leaveForm.end_date}
                    min={leaveForm.start_date || undefined}
                    onChange={(e) => setLeaveForm((f) => ({ ...f, end_date: e.target.value }))}
                    className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <WorkingDaysTag start={leaveForm.start_date} end={leaveForm.end_date} />
                </div>
              </div>
            </div>
            {leaveError && (
              <p className="text-red-600 text-xs bg-red-50 border border-red-200 rounded-lg px-3 py-2">{leaveError}</p>
            )}
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={savingLeave}
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                {savingLeave ? 'Saving…' : 'Save Leave'}
              </button>
              <button
                type="button"
                onClick={() => { setShowLeaveForm(false); setLeaveForm(emptyLeaveForm); setLeaveError('') }}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-5 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {leaveEntries.length === 0 ? (
          <div className="text-center py-8 text-slate-400 text-sm">No leave entries for this sprint.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
                <th className="text-left px-6 py-3">Member</th>
                <th className="text-left px-4 py-3">Leave Type</th>
                <th className="text-center px-4 py-3">Start Date</th>
                <th className="text-center px-4 py-3">End Date</th>
                <th className="text-center px-4 py-3">Working Days</th>
                <th className="px-6 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {leaveEntries.map((l) => (
                <tr key={l.id} className="hover:bg-slate-50">
                  <td className="px-6 py-3 font-medium text-slate-800">{memberName(l.member_id)}</td>
                  <td className="px-4 py-3 text-slate-600">{l.leave_type}</td>
                  <td className="px-4 py-3 text-center text-slate-600">{l.start_date}</td>
                  <td className="px-4 py-3 text-center text-slate-600">{l.end_date}</td>
                  <td className="px-4 py-3 text-center">
                    <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full text-xs font-medium">
                      {l.working_days} day{l.working_days !== 1 ? 's' : ''}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-right">
                    {deleteLeaveId === l.id ? (
                      <div className="flex justify-end gap-2">
                        <button onClick={() => handleDeleteLeave(l.id)} className="text-red-600 text-xs font-medium">Confirm</button>
                        <button onClick={() => setDeleteLeaveId(null)} className="text-slate-400 text-xs">Cancel</button>
                      </div>
                    ) : (
                      <button onClick={() => setDeleteLeaveId(l.id)} className="text-red-400 hover:text-red-600 text-xs font-medium">
                        Delete
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Section B: Public Holidays ── */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-slate-800">Public Holidays</h2>
            <p className="text-slate-400 text-xs mt-0.5">
              Deducts from all {members.length} team member{members.length !== 1 ? 's' : ''} equally
              {totalPublicDays > 0 && (
                <span className="ml-2 text-amber-600 font-medium">— {totalPublicDays} day{totalPublicDays !== 1 ? 's' : ''} total</span>
              )}
            </p>
          </div>
          {!showHolidayForm && (
            <button
              onClick={() => setShowHolidayForm(true)}
              className="bg-slate-700 hover:bg-slate-800 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              + Add Holiday
            </button>
          )}
        </div>

        {showHolidayForm && (
          <form onSubmit={handleAddHoliday} className="px-6 py-5 bg-slate-50 border-b border-slate-100 space-y-4">
            <p className="text-sm font-medium text-slate-700">New Public Holiday</p>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Holiday Name *</label>
                <input
                  required
                  value={holidayForm.name}
                  onChange={(e) => setHolidayForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Independence Day"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Start Date *</label>
                <input
                  required
                  type="date"
                  value={holidayForm.start_date}
                  onChange={(e) => setHolidayForm((f) => ({ ...f, start_date: e.target.value }))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">End Date *</label>
                <div className="flex items-center gap-2">
                  <input
                    required
                    type="date"
                    value={holidayForm.end_date}
                    min={holidayForm.start_date || undefined}
                    onChange={(e) => setHolidayForm((f) => ({ ...f, end_date: e.target.value }))}
                    className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <WorkingDaysTag start={holidayForm.start_date} end={holidayForm.end_date} />
                </div>
              </div>
            </div>
            {holidayError && (
              <p className="text-red-600 text-xs bg-red-50 border border-red-200 rounded-lg px-3 py-2">{holidayError}</p>
            )}
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={savingHoliday}
                className="bg-slate-700 hover:bg-slate-800 disabled:opacity-60 text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                {savingHoliday ? 'Saving…' : 'Save Holiday'}
              </button>
              <button
                type="button"
                onClick={() => { setShowHolidayForm(false); setHolidayForm(emptyHolidayForm); setHolidayError('') }}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-5 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {publicHolidays.length === 0 ? (
          <div className="text-center py-8 text-slate-400 text-sm">No public holidays added for this sprint.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
                <th className="text-left px-6 py-3">Holiday</th>
                <th className="text-center px-4 py-3">Start Date</th>
                <th className="text-center px-4 py-3">End Date</th>
                <th className="text-center px-4 py-3">Working Days</th>
                <th className="text-left px-4 py-3">Impact</th>
                <th className="px-6 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {publicHolidays.map((h) => (
                <tr key={h.id} className="hover:bg-slate-50">
                  <td className="px-6 py-3 font-medium text-slate-800">{h.name}</td>
                  <td className="px-4 py-3 text-center text-slate-600">{h.start_date}</td>
                  <td className="px-4 py-3 text-center text-slate-600">{h.end_date}</td>
                  <td className="px-4 py-3 text-center">
                    <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full text-xs font-medium">
                      {h.working_days} day{h.working_days !== 1 ? 's' : ''}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-500 text-xs">
                    Deducts {h.working_days} day{h.working_days !== 1 ? 's' : ''} from all {members.length} members
                  </td>
                  <td className="px-6 py-3 text-right">
                    {deleteHolidayId === h.id ? (
                      <div className="flex justify-end gap-2">
                        <button onClick={() => handleDeleteHoliday(h.id)} className="text-red-600 text-xs font-medium">Confirm</button>
                        <button onClick={() => setDeleteHolidayId(null)} className="text-slate-400 text-xs">Cancel</button>
                      </div>
                    ) : (
                      <button onClick={() => setDeleteHolidayId(h.id)} className="text-red-400 hover:text-red-600 text-xs font-medium">
                        Delete
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
