import { Link, useParams, useLocation, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const NAV_ITEMS = [
  { label: 'Dashboard', key: 'dashboard', path: '' },
  { label: 'Team', key: 'team', path: '/team' },
  { label: 'Velocity', key: 'velocity', path: '/velocity' },
  { label: 'Settings', key: 'settings', path: '/settings', id: 'onboarding-settings-link' },
]

function getInitials(name) {
  if (!name) return '?'
  return name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()
}

export default function Navbar() {
  const { teamCode } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const [teamName, setTeamName] = useState('')

  useEffect(() => {
    if (!teamCode) return
    supabase
      .from('teams')
      .select('name')
      .eq('team_code', teamCode)
      .single()
      .then(({ data }) => { if (data) setTeamName(data.name) })
  }, [teamCode])

  const base = `/team/${teamCode}`

  const isActive = (path) => {
    const full = path === '' ? base : `${base}${path}`
    if (path === '') return location.pathname === base
    return location.pathname.startsWith(full)
  }

  return (
    <nav className="w-60 min-h-screen bg-black border-r border-[#1A1A1A] flex flex-col p-6 shrink-0">
      {/* Logo */}
      <Link to={base} className="flex items-center gap-3 mb-10">
        <div className="w-7 h-7 bg-[#BFFF00] rounded flex items-center justify-center shrink-0">
          <span className="text-black font-bold text-xs font-mono">SI</span>
        </div>
        <span className="text-white font-semibold text-xs tracking-[3px] font-mono uppercase">SPRINTIQ</span>
      </Link>

      {/* Nav links */}
      <div className="flex flex-col gap-1 flex-1">
        {NAV_ITEMS.map(({ label, key, path, id }) => {
          const active = isActive(path)
          const to = path === '' ? base : `${base}${path}`
          return (
            <Link
              key={key}
              to={to}
              id={id}
              className={`px-3 py-2.5 rounded text-xs font-mono transition-colors ${
                active
                  ? 'bg-[#1A1A1A] text-[#BFFF00] font-medium'
                  : 'text-[#6e6e6e] hover:text-white hover:bg-[#1A1A1A]'
              }`}
            >
              {label}
            </Link>
          )
        })}
      </div>

      {/* Bottom: team info + sign out */}
      <div className="mt-auto pt-6 border-t border-[#1A1A1A]">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 rounded-full bg-[#2A2A2A] flex items-center justify-center shrink-0">
            <span className="text-[#BFFF00] text-xs font-mono font-semibold">{getInitials(teamName)}</span>
          </div>
          <div className="min-w-0">
            <p className="text-white text-xs font-medium truncate">{teamName || teamCode}</p>
            <p className="text-[#6e6e6e] text-xs font-mono truncate">{teamCode}</p>
          </div>
        </div>
        <button
          onClick={() => navigate('/')}
          className="text-[#6e6e6e] text-xs font-mono hover:text-white transition-colors"
        >
          ← Sign Out
        </button>
      </div>
    </nav>
  )
}
