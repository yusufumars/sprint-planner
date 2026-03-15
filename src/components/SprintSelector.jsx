export default function SprintSelector({ sprints, activeSprint, onSelect, onNew }) {
  return (
    <div className="flex items-center gap-3">
      <select
        value={activeSprint?.id || ''}
        onChange={(e) => {
          const s = sprints.find((sp) => sp.id === e.target.value)
          if (s) onSelect(s)
        }}
        className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[200px]"
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
        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
      >
        + New Sprint
      </button>
    </div>
  )
}
