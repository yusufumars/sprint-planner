import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { calcWorkingDays } from '../lib/utils'

const LEAVE_TYPES = ['Annual Leave', 'Maternity Leave', 'Sick Leave', 'Study Leave']

const LEAVE_TYPE_COLORS = {
  'Annual Leave': '#3B82F6',
  'Maternity Leave': '#8B5CF6',
  'Sick Leave': '#EF4444',
  'Study Leave': '#F59E0B',
}

const emptyLeaveForm = { member_id: '', leave_type: 'Annual Leave', start_date: '', end_date: '' }
const emptyHolidayForm = { name: '', start_date: '', end_date: '' }

const inputClass = "w-full bg-black border border-[#1A1A1A] rounded px-3 py-2 text-sm text-white font-mono placeholder-[#404040] focus:outline-none focus:border-[#BFFF00]"
const selectClass = "w-full bg-black border border-[#1A1A1A] rounded px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-[#BFFF00]"

function WorkingDaysTag({ start, end }) {
  const days = calcWorkingDays(start, end)
  if (!start || !end) return null
  return (
    <span className="ml-2 font-mono text-[10px] text-[#BFFF00] font-semibold">
      {days} day{days !== 1 ? 's' : ''}
    </span>
  )
}

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

  async function handleAddLeave(e) {
    e.preventDefault()
    if (!sprint || !leaveForm.member_id) return
    setSavingLeave(true)
    setLeaveError('')
    const wdays = calcWorkingDays(leaveForm.start_date, leaveForm.end_date)
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
      setLeaveError(`Failed to save: ${error.message}`)
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

  async function handleAddHoliday(e) {
    e.preventDefault()
    if (!sprint || !team) return
    setSavingHoliday(true)
    setHolidayError('')
    const wdays = calcWorkingDays(holidayForm.start_date, holidayForm.end_date)
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
      setHolidayError(`Failed to save: ${error.message}`)
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
      <div className="bg-[#111111] rounded-lg border border-[#1A1A1A] p-10 text-center text-[#6e6e6e] font-mono text-sm">
        No active sprint. Create a sprint on the Dashboard to manage leave.
      </div>
    )
  }

  return (
    <div id="onboarding-leave-section" className="space-y-5">

      {/* ── Individual Leave ── */}
      <div className="bg-[#111111] rounded-lg border border-[#1A1A1A] overflow-hidden">
        <div className="px-6 py-4 border-b border-[#1A1A1A] flex items-center justify-between">
          <div>
            <p className="font-mono text-xs text-[#6e6e6e] tracking-[2px] uppercase">Individual Leave</p>
            <p className="text-[#404040] text-xs font-mono mt-0.5">Sprint: {sprint.name || sprint.id}</p>
          </div>
          {!showLeaveForm && (
            <button
              onClick={() => setShowLeaveForm(true)}
              className="border border-[#BFFF00] text-white hover:bg-[#1A1A1A] font-mono text-xs px-4 py-2 rounded transition-colors"
            >
              + Add Leave
            </button>
          )}
        </div>

        {showLeaveForm && (
          <form onSubmit={handleAddLeave} className="px-6 py-5 bg-[#0a0a0a] border-b border-[#1A1A1A] space-y-4">
            <p className="font-mono text-xs text-[#6e6e6e] tracking-[1px] uppercase">New Leave Entry</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-mono text-[10px] text-[#404040] tracking-[1px] uppercase mb-1.5">Team Member *</label>
                <select required value={leaveForm.member_id}
                  onChange={(e) => setLeaveForm((f) => ({ ...f, member_id: e.target.value }))}
                  className={selectClass}>
                  <option value="">Select member…</option>
                  {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block font-mono text-[10px] text-[#404040] tracking-[1px] uppercase mb-1.5">Leave Type *</label>
                <select value={leaveForm.leave_type}
                  onChange={(e) => setLeaveForm((f) => ({ ...f, leave_type: e.target.value }))}
                  className={selectClass}>
                  {LEAVE_TYPES.map((t) => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="block font-mono text-[10px] text-[#404040] tracking-[1px] uppercase mb-1.5">Start Date *</label>
                <input required type="date" value={leaveForm.start_date}
                  onChange={(e) => setLeaveForm((f) => ({ ...f, start_date: e.target.value }))}
                  className={inputClass} />
              </div>
              <div>
                <label className="block font-mono text-[10px] text-[#404040] tracking-[1px] uppercase mb-1.5">
                  End Date *
                  <WorkingDaysTag start={leaveForm.start_date} end={leaveForm.end_date} />
                </label>
                <input required type="date" value={leaveForm.end_date}
                  min={leaveForm.start_date || undefined}
                  onChange={(e) => setLeaveForm((f) => ({ ...f, end_date: e.target.value }))}
                  className={inputClass} />
              </div>
            </div>
            {leaveError && (
              <p className="text-red-400 text-xs font-mono bg-[#0D0000] border border-red-900 rounded px-3 py-2">{leaveError}</p>
            )}
            <div className="flex gap-3">
              <button type="submit" disabled={savingLeave}
                className="bg-[#BFFF00] hover:opacity-90 disabled:opacity-50 text-black font-mono font-semibold text-xs px-5 py-2 rounded transition-opacity">
                {savingLeave ? 'Saving…' : 'Save Leave'}
              </button>
              <button type="button"
                onClick={() => { setShowLeaveForm(false); setLeaveForm(emptyLeaveForm); setLeaveError('') }}
                className="bg-[#1A1A1A] hover:bg-[#2A2A2A] text-[#6e6e6e] font-mono text-xs px-5 py-2 rounded transition-colors">
                Cancel
              </button>
            </div>
          </form>
        )}

        {leaveEntries.length === 0 ? (
          <div className="text-center py-8 text-[#6e6e6e] font-mono text-sm">No leave entries for this sprint.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-black text-[#404040] font-mono text-[10px] tracking-[1px] uppercase">
                <th className="text-left px-6 py-3">Member</th>
                <th className="text-left px-4 py-3">Leave Type</th>
                <th className="text-center px-4 py-3">Start Date</th>
                <th className="text-center px-4 py-3">End Date</th>
                <th className="text-center px-4 py-3">Working Days</th>
                <th className="px-6 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {leaveEntries.map((l) => {
                const typeColor = LEAVE_TYPE_COLORS[l.leave_type] || '#6e6e6e'
                return (
                  <tr key={l.id} className="border-t border-[#1A1A1A] hover:bg-[#0a0a0a]">
                    <td className="px-6 py-3 font-medium text-white">{memberName(l.member_id)}</td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-[10px] font-semibold px-2 py-0.5 rounded" style={{ backgroundColor: `${typeColor}22`, color: typeColor }}>
                        {l.leave_type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center font-mono text-xs text-[#999999]">{l.start_date}</td>
                    <td className="px-4 py-3 text-center font-mono text-xs text-[#999999]">{l.end_date}</td>
                    <td className="px-4 py-3 text-center">
                      <span className="font-mono text-xs text-[#BFFF00] font-semibold">
                        {l.working_days} day{l.working_days !== 1 ? 's' : ''}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-right">
                      {deleteLeaveId === l.id ? (
                        <div className="flex justify-end gap-2">
                          <button onClick={() => handleDeleteLeave(l.id)} className="text-red-400 hover:text-red-300 text-xs font-mono font-medium">Confirm</button>
                          <button onClick={() => setDeleteLeaveId(null)} className="text-[#6e6e6e] text-xs font-mono">Cancel</button>
                        </div>
                      ) : (
                        <button onClick={() => setDeleteLeaveId(l.id)} className="text-red-500 hover:text-red-400 text-xs font-mono">
                          Delete
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Public Holidays ── */}
      <div className="bg-[#111111] rounded-lg border border-[#1A1A1A] overflow-hidden">
        <div className="px-6 py-4 border-b border-[#1A1A1A] flex items-center justify-between">
          <div>
            <p className="font-mono text-xs text-[#6e6e6e] tracking-[2px] uppercase">Public Holidays</p>
            <p className="text-[#404040] text-xs font-mono mt-0.5">
              Affects all {members.length} member{members.length !== 1 ? 's' : ''}
              {totalPublicDays > 0 && (
                <span className="ml-2 text-[#F59E0B]">— {totalPublicDays} day{totalPublicDays !== 1 ? 's' : ''} total</span>
              )}
            </p>
          </div>
          {!showHolidayForm && (
            <button
              onClick={() => setShowHolidayForm(true)}
              className="border border-[#BFFF00] text-white hover:bg-[#1A1A1A] font-mono text-xs px-4 py-2 rounded transition-colors"
            >
              + Add Holiday
            </button>
          )}
        </div>

        {showHolidayForm && (
          <form onSubmit={handleAddHoliday} className="px-6 py-5 bg-[#0a0a0a] border-b border-[#1A1A1A] space-y-4">
            <p className="font-mono text-xs text-[#6e6e6e] tracking-[1px] uppercase">New Public Holiday</p>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block font-mono text-[10px] text-[#404040] tracking-[1px] uppercase mb-1.5">Holiday Name *</label>
                <input required value={holidayForm.name}
                  onChange={(e) => setHolidayForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Independence Day"
                  className={inputClass} />
              </div>
              <div>
                <label className="block font-mono text-[10px] text-[#404040] tracking-[1px] uppercase mb-1.5">Start Date *</label>
                <input required type="date" value={holidayForm.start_date}
                  onChange={(e) => setHolidayForm((f) => ({ ...f, start_date: e.target.value }))}
                  className={inputClass} />
              </div>
              <div>
                <label className="block font-mono text-[10px] text-[#404040] tracking-[1px] uppercase mb-1.5">
                  End Date *
                  <WorkingDaysTag start={holidayForm.start_date} end={holidayForm.end_date} />
                </label>
                <input required type="date" value={holidayForm.end_date}
                  min={holidayForm.start_date || undefined}
                  onChange={(e) => setHolidayForm((f) => ({ ...f, end_date: e.target.value }))}
                  className={inputClass} />
              </div>
            </div>
            {holidayError && (
              <p className="text-red-400 text-xs font-mono bg-[#0D0000] border border-red-900 rounded px-3 py-2">{holidayError}</p>
            )}
            <div className="flex gap-3">
              <button type="submit" disabled={savingHoliday}
                className="bg-[#BFFF00] hover:opacity-90 disabled:opacity-50 text-black font-mono font-semibold text-xs px-5 py-2 rounded transition-opacity">
                {savingHoliday ? 'Saving…' : 'Save Holiday'}
              </button>
              <button type="button"
                onClick={() => { setShowHolidayForm(false); setHolidayForm(emptyHolidayForm); setHolidayError('') }}
                className="bg-[#1A1A1A] hover:bg-[#2A2A2A] text-[#6e6e6e] font-mono text-xs px-5 py-2 rounded transition-colors">
                Cancel
              </button>
            </div>
          </form>
        )}

        {publicHolidays.length === 0 ? (
          <div className="text-center py-8 text-[#6e6e6e] font-mono text-sm">No public holidays added for this sprint.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-black text-[#404040] font-mono text-[10px] tracking-[1px] uppercase">
                <th className="text-left px-6 py-3">Holiday</th>
                <th className="text-center px-4 py-3">Start Date</th>
                <th className="text-center px-4 py-3">End Date</th>
                <th className="text-center px-4 py-3">Working Days</th>
                <th className="text-left px-4 py-3">Impact</th>
                <th className="px-6 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {publicHolidays.map((h) => (
                <tr key={h.id} className="border-t border-[#1A1A1A] hover:bg-[#0a0a0a]">
                  <td className="px-6 py-3 font-medium text-white">{h.name}</td>
                  <td className="px-4 py-3 text-center font-mono text-xs text-[#999999]">{h.start_date}</td>
                  <td className="px-4 py-3 text-center font-mono text-xs text-[#999999]">{h.end_date}</td>
                  <td className="px-4 py-3 text-center">
                    <span className="font-mono text-xs text-[#F59E0B] font-semibold">
                      {h.working_days} day{h.working_days !== 1 ? 's' : ''}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[#6e6e6e] font-mono text-xs">
                    Affects all {members.length} members
                  </td>
                  <td className="px-6 py-3 text-right">
                    {deleteHolidayId === h.id ? (
                      <div className="flex justify-end gap-2">
                        <button onClick={() => handleDeleteHoliday(h.id)} className="text-red-400 hover:text-red-300 text-xs font-mono font-medium">Confirm</button>
                        <button onClick={() => setDeleteHolidayId(null)} className="text-[#6e6e6e] text-xs font-mono">Cancel</button>
                      </div>
                    ) : (
                      <button onClick={() => setDeleteHolidayId(h.id)} className="text-red-500 hover:text-red-400 text-xs font-mono">
                        Delete
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="px-6 py-3 font-mono text-[10px] text-[#404040] border-t border-[#1A1A1A]">
          Public holidays are automatically deducted from all team members equally.
        </p>
      </div>
    </div>
  )
}
