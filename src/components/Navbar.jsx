import { Link, useParams, useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Navbar() {
  const { teamCode } = useParams()
  const location = useLocation()
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
  const links = [
    { label: 'Dashboard', to: base },
    { label: 'Team', to: `${base}/team` },
    { label: 'Velocity', to: `${base}/velocity` },
    { label: 'Settings', to: `${base}/settings`, id: 'onboarding-settings-link' },
  ]

  const isActive = (to) => {
    if (to === base) return location.pathname === base
    return location.pathname.startsWith(to)
  }

  return (
    <nav className="bg-slate-900 shadow-lg">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <Link to={base} className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">SI</span>
            </div>
            <span className="text-white font-bold text-xl">SprintIQ</span>
          </Link>

          <div className="flex items-center gap-1">
            {links.map(({ label, to, id }) => (
              <Link
                key={to}
                to={to}
                id={id}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  isActive(to)
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-300 hover:bg-slate-700 hover:text-white'
                }`}
              >
                {label}
              </Link>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-400 rounded-full"></div>
            <span className="text-slate-300 text-sm font-medium">{teamName || teamCode}</span>
          </div>
        </div>
      </div>
    </nav>
  )
}
