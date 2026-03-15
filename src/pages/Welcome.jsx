import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

function generateTeamCode() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  const part = (len) => Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
  return `${part(3)}-${part(4)}`
}

export default function Welcome() {
  const navigate = useNavigate()
  const [teamName, setTeamName] = useState('')
  const [teamCode, setTeamCode] = useState('')
  const [creating, setCreating] = useState(false)
  const [joining, setJoining] = useState(false)
  const [createError, setCreateError] = useState('')
  const [joinError, setJoinError] = useState('')

  async function handleCreate(e) {
    e.preventDefault()
    if (!teamName.trim()) return
    setCreating(true)
    setCreateError('')
    const code = generateTeamCode()
    const { error } = await supabase.from('teams').insert({
      name: teamName.trim(),
      team_code: code,
      default_story_points: 15,
      default_focus_factor: 80,
      default_sprint_length: 14,
    })
    if (error) {
      setCreateError('Failed to create team. Please try again.')
      setCreating(false)
      return
    }
    navigate(`/team/${code}`)
  }

  async function handleJoin(e) {
    e.preventDefault()
    if (!teamCode.trim()) return
    setJoining(true)
    setJoinError('')
    const { data, error } = await supabase
      .from('teams')
      .select('team_code')
      .eq('team_code', teamCode.trim().toLowerCase())
      .single()
    if (error || !data) {
      setJoinError('Team not found. Check the code and try again.')
      setJoining(false)
      return
    }
    navigate(`/team/${data.team_code}`)
  }

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center px-4">
      <div className="text-center mb-12">
        <div className="flex items-center justify-center gap-3 mb-4">
          <div className="w-12 h-12 bg-blue-500 rounded-xl flex items-center justify-center shadow-lg">
            <span className="text-white font-bold text-xl">SI</span>
          </div>
          <h1 className="text-5xl font-bold text-white">SprintIQ</h1>
        </div>
        <p className="text-slate-400 text-xl">Smart sprint planning for agile teams</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-2xl">
        {/* Create Team */}
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
            <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-1">Create New Team</h2>
          <p className="text-slate-500 text-sm mb-6">Start fresh with a new team workspace</p>
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Team Name</label>
              <input
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                placeholder="e.g. Alpha Squad"
                required
                className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            {createError && <p className="text-red-500 text-sm">{createError}</p>}
            <button
              type="submit"
              disabled={creating}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white py-2.5 rounded-lg font-medium text-sm transition-colors"
            >
              {creating ? 'Creating…' : 'Create Team'}
            </button>
          </form>
        </div>

        {/* Join Team */}
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center mb-4">
            <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-1">Join Existing Team</h2>
          <p className="text-slate-500 text-sm mb-6">Enter your team code to access your workspace</p>
          <form onSubmit={handleJoin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Team Code</label>
              <input
                value={teamCode}
                onChange={(e) => setTeamCode(e.target.value)}
                placeholder="e.g. eha-x7k2"
                required
                className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
              />
            </div>
            {joinError && <p className="text-red-500 text-sm">{joinError}</p>}
            <button
              type="submit"
              disabled={joining}
              className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white py-2.5 rounded-lg font-medium text-sm transition-colors"
            >
              {joining ? 'Finding…' : 'Go to My Team'}
            </button>
          </form>
        </div>
      </div>

      <p className="text-slate-600 text-sm mt-10">
        Each team gets a unique URL — bookmark it to always return to your workspace.
      </p>
    </div>
  )
}
