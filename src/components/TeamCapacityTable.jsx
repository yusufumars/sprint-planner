const ROLE_SHORT = {
  'Software Engineer Lead': 'SE Lead',
  'Senior Software Engineer': 'Senior SE',
  'Associate Software Engineer': 'Associate SE',
}

const STATUS_STYLES = {
  GOOD: 'bg-emerald-100 text-emerald-700',
  OVERUTILIZED: 'bg-red-100 text-red-700',
  UNDERUTILIZED: 'bg-amber-100 text-amber-700',
}

const BAR_COLOR = {
  GOOD: 'bg-emerald-500',
  OVERUTILIZED: 'bg-red-500',
  UNDERUTILIZED: 'bg-amber-400',
}

const ALLOCATION_OPTIONS = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100]

function StatusBadge({ status }) {
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_STYLES[status] || STATUS_STYLES.UNDERUTILIZED}`}>
      {status}
    </span>
  )
}

/**
 * Props:
 *  members            – array of team member objects (with .role, .allocation_percentage)
 *  memberCapacities   – { [memberId]: { adjustedSP, targetSP, totalLeaveDays, utilizationPct, status } }
 *  assignedPoints     – { [memberId]: number }  (controlled)
 *  basePoints         – number
 *  focusFactor        – number (e.g. 80)
 *  onAssignedChange   – (memberId, value: number) => void  (real-time UI update)
 *  onAssignedBlur     – (memberId, value: number) => void  (snap + save to Supabase)
 *  onAllocationChange – (memberId, value: number) => void  (save immediately)
 */
export default function TeamCapacityTable({
  members,
  memberCapacities,
  assignedPoints,
  basePoints,
  focusFactor,
  onAssignedChange,
  onAssignedBlur,
  onAllocationChange,
}) {
  if (members.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center text-slate-400">
        No team members yet. Add members on the Team page.
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-100">
        <h3 className="font-semibold text-slate-800">Team Capacity Breakdown</h3>
        <p className="text-slate-400 text-xs mt-0.5">
          Target SP = Adjusted SP × {focusFactor}% — the story points each member should be assigned
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
              <th className="text-left px-6 py-3">Member</th>
              <th className="text-center px-4 py-3">Allocation %</th>
              <th className="text-right px-4 py-3">Base SP</th>
              <th className="text-right px-4 py-3">Leave Days</th>
              <th className="text-right px-4 py-3">Adjusted SP</th>
              <th className="text-center px-4 py-3 bg-blue-50 text-blue-700 font-bold">Target SP</th>
              <th id="onboarding-assigned-sp-col" className="text-center px-4 py-3">Assigned SP</th>
              <th className="text-right px-4 py-3 min-w-[200px]">Utilization</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {members.map((m) => {
              const cap = memberCapacities[m.id] || {
                adjustedSP: 0, targetSP: 0, totalLeaveDays: 0,
                utilizationPct: 0, status: 'UNDERUTILIZED',
              }
              const assigned = assignedPoints[m.id] ?? 0
              const alloc = m.allocation_percentage || 100

              return (
                <tr key={m.id} className="hover:bg-slate-50">
                  {/* Member */}
                  <td className="px-6 py-3">
                    <p className="font-medium text-slate-800">{m.name}</p>
                    {m.role && (
                      <p className="text-slate-400 text-xs mt-0.5">{ROLE_SHORT[m.role] || m.role}</p>
                    )}
                  </td>

                  {/* Allocation % — inline dropdown */}
                  <td className="px-4 py-3 text-center">
                    <select
                      value={alloc}
                      onChange={(e) => onAllocationChange(m.id, parseInt(e.target.value, 10))}
                      className="border border-slate-300 rounded px-2 py-1 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                    >
                      {ALLOCATION_OPTIONS.map((v) => (
                        <option key={v} value={v}>{v}%</option>
                      ))}
                    </select>
                  </td>

                  {/* Base SP */}
                  <td className="px-4 py-3 text-right text-slate-600">{basePoints}</td>

                  {/* Leave Days */}
                  <td className="px-4 py-3 text-right text-slate-600">{cap.totalLeaveDays}</td>

                  {/* Adjusted SP */}
                  <td className="px-4 py-3 text-right font-medium text-slate-700">{cap.adjustedSP}</td>

                  {/* Target SP — highlighted as the key metric */}
                  <td className="px-3 py-2">
                    <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-center">
                      <span className="text-blue-800 font-bold text-base">{cap.targetSP}</span>
                      <div className="text-blue-400 text-xs mt-0.5">Target</div>
                    </div>
                  </td>

                  {/* Assigned SP — input */}
                  <td className="px-4 py-3 text-center">
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={assigned === 0 && !assignedPoints[m.id] ? '' : assigned}
                      placeholder="0"
                      onChange={(e) => onAssignedChange(m.id, parseFloat(e.target.value) || 0)}
                      onBlur={(e) => onAssignedBlur(m.id, parseFloat(e.target.value) || 0)}
                      className="w-20 text-center border border-slate-300 rounded-lg px-2 py-1.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </td>

                  {/* Utilization bar + % + status */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 max-w-[80px] bg-slate-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full transition-all ${BAR_COLOR[cap.status] || BAR_COLOR.UNDERUTILIZED}`}
                          style={{ width: `${Math.min(cap.utilizationPct, 100)}%` }}
                        />
                      </div>
                      <span className="text-slate-700 font-medium text-xs w-9 text-right">
                        {cap.utilizationPct}%
                      </span>
                      <StatusBadge status={cap.status} />
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
