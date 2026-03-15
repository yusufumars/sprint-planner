export default function CapacityCard({ label, value, sub, color }) {
  const colorMap = {
    blue: 'bg-blue-600',
    green: 'bg-emerald-500',
    yellow: 'bg-amber-500',
    red: 'bg-red-500',
    purple: 'bg-purple-600',
    slate: 'bg-slate-600',
  }
  const bar = colorMap[color] || colorMap.blue

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
      <div className={`inline-block w-2 h-2 rounded-full mb-3 ${bar}`}></div>
      <p className="text-slate-500 text-xs font-medium uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-bold text-slate-900 mt-1">{value}</p>
      {sub && <p className="text-slate-400 text-xs mt-1">{sub}</p>}
    </div>
  )
}
