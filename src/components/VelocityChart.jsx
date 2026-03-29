export default function VelocityChart({ sprints }) {
  if (!sprints || sprints.length === 0) {
    return (
      <div className="bg-[#111111] rounded-lg border border-[#1A1A1A] p-6">
        <p className="font-mono text-xs text-[#6e6e6e] tracking-[2px] uppercase mb-8">Committed vs Completed — Last 5 Sprints</p>
        <div className="text-center py-10 text-[#6e6e6e] font-mono text-sm">No sprint data to display.</div>
      </div>
    )
  }

  const last5 = sprints.slice(-5)
  const maxVal = Math.max(...last5.flatMap((s) => [s.committed || 0, s.completed || 0]), 1)
  const chartHeight = 180

  const yLabels = [maxVal, Math.round(maxVal * 0.75), Math.round(maxVal * 0.5), Math.round(maxVal * 0.25), 0]

  return (
    <div className="bg-[#111111] rounded-lg border border-[#1A1A1A] p-6">
      <p className="font-mono text-xs font-medium text-[#6e6e6e] tracking-[2px] uppercase mb-7">
        Committed vs Completed — Last 5 Sprints
      </p>

      <div className="flex gap-4">
        {/* Y-axis */}
        <div className="flex flex-col justify-between text-right pb-7" style={{ height: chartHeight }}>
          {yLabels.map((v) => (
            <span key={v} className="font-mono text-[9px] text-[#404040]">{v}</span>
          ))}
        </div>

        {/* Bars */}
        <div className="flex-1 flex items-end gap-4 justify-around" style={{ height: chartHeight + 28 }}>
          {last5.map((s, idx) => {
            const committedH = Math.round(((s.committed || 0) / maxVal) * chartHeight)
            const completedH = Math.round(((s.completed || 0) / maxVal) * chartHeight)
            const isLatest = idx === last5.length - 1
            return (
              <div key={s.id} className="flex flex-col items-center gap-2">
                <div className="flex items-end gap-1" style={{ height: chartHeight }}>
                  <div className="flex flex-col justify-end">
                    <div
                      className="w-8 bg-[#2A2A2A] rounded-t"
                      style={{ height: Math.max(committedH, 2) }}
                      title={`Committed: ${s.committed || 0}`}
                    />
                  </div>
                  <div className="flex flex-col justify-end">
                    <div
                      className="w-8 bg-[#BFFF00] rounded-t"
                      style={{ height: Math.max(completedH, 2) }}
                      title={`Completed: ${s.completed || 0}`}
                    />
                  </div>
                </div>
                <p className={`font-mono text-[10px] text-center max-w-[72px] truncate ${isLatest ? 'text-[#BFFF00]' : 'text-[#404040]'}`}>
                  {isLatest && <span className="mr-0.5">●</span>}{s.name}
                </p>
              </div>
            )
          })}
        </div>
      </div>

      <div className="flex items-center gap-6 mt-4">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-[#2A2A2A] rounded-sm"></div>
          <span className="font-mono text-xs text-[#6e6e6e]">Committed</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-[#BFFF00] rounded-sm"></div>
          <span className="font-mono text-xs text-[#6e6e6e]">Completed</span>
        </div>
      </div>
    </div>
  )
}
