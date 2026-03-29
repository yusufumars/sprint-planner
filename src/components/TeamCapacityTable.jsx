const ROLE_SHORT = {
  'Software Engineer Lead': 'SE Lead',
  'Senior Software Engineer': 'Senior SE',
  'Associate Software Engineer': 'Associate SE',
}

const STATUS_STYLES = {
  GOOD:         'bg-[#BFFF00] text-black',
  OVERUTILIZED: 'bg-[#1A1A1A] border border-red-500 text-red-400',
  UNDERUTILIZED:'bg-[#1A1A1A] border border-[#F59E0B] text-[#F59E0B]',
}

const BAR_COLOR = {
  GOOD:         'bg-[#BFFF00]',
  OVERUTILIZED: 'bg-red-500',
  UNDERUTILIZED:'bg-[#F59E0B]',
}

const ALLOCATION_OPTIONS = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100]

function StatusBadge({ status }) {
  return (
    <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold ${STATUS_STYLES[status] || STATUS_STYLES.UNDERUTILIZED}`}>
      {status}
    </span>
  )
}

function getInitials(name) {
  if (!name) return '?'
  return name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()
}

const AVATAR_COLORS = ['#0D6E6E', '#F59E0B', '#3B82F6', '#E07B54', '#8B5CF6', '#EF4444']

export default function TeamCapacityTable({
  members,
  memberCapacities,
  assignedPoints,
  basePoints,
  focusFactor,
  onAssignedChange,
  onAssignedBlur,
  onAllocationChange,
  sprintStatus,
  sprintUtilPct,
}) {
  if (members.length === 0) {
    return (
      <div className="bg-[#111111] rounded-lg border border-[#1A1A1A] p-12 text-center text-[#6e6e6e] font-mono text-sm">
        No team members yet. Add members on the Team page.
      </div>
    )
  }

  const statusLabel = sprintStatus === 'OPTIMAL' ? 'Optimal' : sprintStatus === 'OVERCOMMITTED' ? 'Overcommitted' : 'Underutilized'

  return (
    <div className="bg-[#111111] rounded-lg border border-[#1A1A1A] overflow-hidden">
      <div className="px-6 py-4 border-b border-[#1A1A1A] flex items-center justify-between">
        <h3 className="text-white font-semibold text-sm">Team Capacity Breakdown</h3>
        {sprintStatus && (
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-[#BFFF00]"></div>
            <span className="font-mono text-[10px] text-[#6e6e6e] tracking-[1px]">
              {statusLabel} {sprintUtilPct}% Loaded
            </span>
          </div>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-black text-[#404040] font-mono text-[10px] tracking-[1px] uppercase">
              <th className="text-left px-6 py-3">Member</th>
              <th className="text-center px-4 py-3">Alloc</th>
              <th className="text-right px-4 py-3">Leave</th>
              <th className="text-right px-4 py-3">Adjusted</th>
              <th className="text-right px-4 py-3 text-[#BFFF00]">Target SP</th>
              <th className="text-center px-4 py-3" id="onboarding-assigned-sp-col">Assigned</th>
              <th className="text-right px-4 py-3 min-w-[180px]">Utilization</th>
            </tr>
          </thead>
          <tbody>
            {members.map((m, idx) => {
              const cap = memberCapacities[m.id] || {
                adjustedSP: 0, targetSP: 0, totalLeaveDays: 0,
                utilizationPct: 0, status: 'UNDERUTILIZED',
              }
              const assigned = assignedPoints[m.id] ?? 0
              const alloc = m.allocation_percentage || 100
              const avatarColor = AVATAR_COLORS[idx % AVATAR_COLORS.length]

              return (
                <tr key={m.id} className="border-t border-[#1A1A1A] hover:bg-[#0a0a0a]">
                  {/* Member */}
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
                        style={{ backgroundColor: '#1A1A1A' }}
                      >
                        <span className="font-mono text-xs font-semibold" style={{ color: avatarColor }}>
                          {getInitials(m.name)}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium text-white text-sm">{m.name}</p>
                        {m.role && (
                          <p className="text-[#6e6e6e] text-xs font-mono mt-0.5">{ROLE_SHORT[m.role] || m.role}</p>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* Allocation % */}
                  <td className="px-4 py-4 text-center">
                    <select
                      value={alloc}
                      onChange={(e) => onAllocationChange(m.id, parseInt(e.target.value, 10))}
                      className="bg-[#1A1A1A] border border-[#2A2A2A] rounded px-2 py-1 text-xs text-white font-mono focus:outline-none focus:border-[#BFFF00]"
                    >
                      {ALLOCATION_OPTIONS.map((v) => (
                        <option key={v} value={v}>{v}%</option>
                      ))}
                    </select>
                  </td>

                  {/* Leave Days */}
                  <td className="px-4 py-4 text-right font-mono text-sm">
                    <span className={cap.totalLeaveDays > 0 ? 'text-[#F59E0B]' : 'text-[#6e6e6e]'}>
                      {cap.totalLeaveDays}d
                    </span>
                  </td>

                  {/* Adjusted SP */}
                  <td className="px-4 py-4 text-right font-mono text-sm text-white">{cap.adjustedSP}</td>

                  {/* Target SP */}
                  <td className="px-4 py-4 text-right">
                    <span className="font-mono text-sm font-semibold text-[#BFFF00]">{cap.targetSP}</span>
                  </td>

                  {/* Assigned SP */}
                  <td className="px-4 py-4 text-center">
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={assigned === 0 && !assignedPoints[m.id] ? '' : assigned}
                      placeholder="0"
                      onChange={(e) => onAssignedChange(m.id, parseFloat(e.target.value) || 0)}
                      onBlur={(e) => onAssignedBlur(m.id, parseFloat(e.target.value) || 0)}
                      className="w-16 text-center bg-[#1A1A1A] border border-[#2A2A2A] rounded px-2 py-1.5 text-sm font-mono text-white focus:outline-none focus:border-[#BFFF00]"
                    />
                  </td>

                  {/* Utilization */}
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-2 justify-end">
                      <div className="w-20 bg-[#2A2A2A] rounded-full h-1.5">
                        <div
                          className={`h-1.5 rounded-full transition-all ${BAR_COLOR[cap.status] || BAR_COLOR.UNDERUTILIZED}`}
                          style={{ width: `${Math.min(cap.utilizationPct, 100)}%` }}
                        />
                      </div>
                      <span className="text-[#999999] font-mono text-xs w-8 text-right">{cap.utilizationPct}%</span>
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
