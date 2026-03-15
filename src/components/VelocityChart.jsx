export default function VelocityChart({ sprints }) {
  if (!sprints || sprints.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <h3 className="font-semibold text-slate-800 mb-4">Velocity Chart</h3>
        <div className="text-center py-10 text-slate-400">No sprint data to display.</div>
      </div>
    )
  }

  const last5 = sprints.slice(-5)
  const maxVal = Math.max(...last5.flatMap((s) => [s.committed || 0, s.completed || 0]), 1)
  const chartHeight = 200

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
      <h3 className="font-semibold text-slate-800 mb-6">Velocity Chart (Last 5 Sprints)</h3>
      <div className="flex items-end gap-6 justify-center" style={{ height: chartHeight + 40 }}>
        {last5.map((s) => {
          const committedH = Math.round(((s.committed || 0) / maxVal) * chartHeight)
          const completedH = Math.round(((s.completed || 0) / maxVal) * chartHeight)
          return (
            <div key={s.id} className="flex flex-col items-center gap-2">
              <div className="flex items-end gap-1" style={{ height: chartHeight }}>
                <div className="flex flex-col justify-end">
                  <span className="text-xs text-slate-500 text-center mb-1">{s.committed || 0}</span>
                  <div
                    className="w-10 bg-blue-500 rounded-t"
                    style={{ height: committedH }}
                    title={`Committed: ${s.committed || 0}`}
                  />
                </div>
                <div className="flex flex-col justify-end">
                  <span className="text-xs text-slate-500 text-center mb-1">{s.completed || 0}</span>
                  <div
                    className="w-10 bg-emerald-500 rounded-t"
                    style={{ height: completedH }}
                    title={`Completed: ${s.completed || 0}`}
                  />
                </div>
              </div>
              <p className="text-xs text-slate-500 text-center max-w-[80px] truncate">{s.name}</p>
            </div>
          )
        })}
      </div>
      <div className="flex items-center gap-6 mt-4 justify-center">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-blue-500 rounded-sm"></div>
          <span className="text-xs text-slate-500">Committed</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-emerald-500 rounded-sm"></div>
          <span className="text-xs text-slate-500">Completed</span>
        </div>
      </div>
    </div>
  )
}
