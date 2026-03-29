export default function SprintSelector({ sprints, activeSprint, onSelect, onNew }) {
  return (
    <div className="flex items-center gap-3">
      <select
        value={activeSprint?.id || ''}
        onChange={(e) => {
          const s = sprints.find((sp) => sp.id === e.target.value)
          if (s) onSelect(s)
        }}
        className="bg-[#111111] border border-[#1A1A1A] rounded px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-[#BFFF00] min-w-[180px]"
      >
        {sprints.length === 0 && <option value="">No sprints yet</option>}
        {sprints.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name} {s.is_active ? '(Active)' : ''}
          </option>
        ))}
      </select>
      <button
        id="onboarding-new-sprint-btn"
        onClick={onNew}
        className="bg-[#BFFF00] hover:opacity-90 text-black font-mono font-semibold text-xs px-4 py-2.5 rounded transition-opacity"
      >
        + New Sprint
      </button>
    </div>
  )
}
