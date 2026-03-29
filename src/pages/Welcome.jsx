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
    <div className="min-h-screen bg-black flex flex-col items-center justify-center px-4 font-sans">
      {/* Logo + tagline */}
      <div className="text-center mb-12">
        <div className="flex items-center justify-center gap-3 mb-4">
          <div className="w-9 h-9 bg-[#BFFF00] rounded flex items-center justify-center">
            <span className="text-black font-bold text-sm font-mono">SI</span>
          </div>
          <span className="text-white font-semibold text-base tracking-[3px] font-mono uppercase">SPRINTIQ</span>
        </div>
        <p className="text-[#6e6e6e] text-sm">Smart sprint planning for agile teams</p>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-2xl">
        {/* Create Team */}
        <div className="bg-[#111111] border border-[#1A1A1A] rounded-lg p-8 flex flex-col gap-5">
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 bg-[#BFFF00] rounded-sm flex items-center justify-center shrink-0">
              <svg className="w-3.5 h-3.5 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
            </div>
            <h2 className="text-white font-semibold text-base">Create New Team</h2>
          </div>
          <p className="text-[#6e6e6e] text-sm">Start fresh with a new team workspace</p>
          <form onSubmit={handleCreate} className="flex flex-col gap-4">
            <div>
              <label className="block font-mono text-xs text-[#6e6e6e] tracking-[2px] uppercase mb-2">Team Name</label>
              <input
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                placeholder="e.g. Alpha Squad"
                required
                className="w-full bg-black border border-[#1A1A1A] rounded px-3 h-10 text-sm text-white placeholder-[#404040] focus:outline-none focus:border-[#BFFF00]"
              />
            </div>
            {createError && <p className="text-red-400 text-xs font-mono">{createError}</p>}
            <button
              type="submit"
              disabled={creating}
              className="w-full bg-[#BFFF00] hover:opacity-90 disabled:opacity-50 text-black font-mono font-semibold text-sm h-11 rounded transition-opacity"
            >
              {creating ? 'Creating…' : 'Create Team'}
            </button>
          </form>
        </div>

        {/* Join Team */}
        <div className="bg-[#111111] border border-[#1A1A1A] rounded-lg p-8 flex flex-col gap-5">
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 border border-[#404040] rounded-sm flex items-center justify-center shrink-0">
              <svg className="w-3.5 h-3.5 text-[#6e6e6e]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <h2 className="text-white font-semibold text-base">Join Existing Team</h2>
          </div>
          <p className="text-[#6e6e6e] text-sm">Enter your team code to access your workspace</p>
          <form onSubmit={handleJoin} className="flex flex-col gap-4">
            <div>
              <label className="block font-mono text-xs text-[#6e6e6e] tracking-[2px] uppercase mb-2">Team Code</label>
              <input
                value={teamCode}
                onChange={(e) => setTeamCode(e.target.value)}
                placeholder="e.g. eha-x7k2"
                required
                className="w-full bg-black border border-[#1A1A1A] rounded px-3 h-10 text-sm text-white placeholder-[#404040] font-mono focus:outline-none focus:border-[#BFFF00]"
              />
            </div>
            {joinError && <p className="text-red-400 text-xs font-mono">{joinError}</p>}
            <button
              type="submit"
              disabled={joining}
              className="w-full bg-black border border-[#BFFF00] hover:bg-[#111111] disabled:opacity-50 text-white font-mono font-semibold text-sm h-11 rounded transition-colors"
            >
              {joining ? 'Finding…' : 'Join My Team'}
            </button>
          </form>
        </div>
      </div>

      <p className="text-[#6e6e6e] text-xs font-mono mt-10">
        Each team gets a unique URL — bookmark it to always return to your workspace.
      </p>
    </div>
  )
}
