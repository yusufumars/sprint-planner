export default function CapacityCard({ label, value, sub, accent = false }) {
  return (
    <div className={`rounded-lg border p-5 flex flex-col gap-2 ${
      accent
        ? 'bg-[#BFFF00] border-[#BFFF00]'
        : 'bg-[#111111] border-[#1A1A1A]'
    }`}>
      <p className={`font-mono text-[10px] font-semibold tracking-[2px] uppercase ${
        accent ? 'text-black' : 'text-[#6e6e6e]'
      }`}>{label}</p>
      <p className={`font-sans text-3xl font-semibold leading-none ${
        accent ? 'text-black' : 'text-white'
      }`}>{value}</p>
      {sub && (
        <p className={`text-xs font-mono ${accent ? 'text-black' : 'text-[#999999]'}`}>{sub}</p>
      )}
    </div>
  )
}
