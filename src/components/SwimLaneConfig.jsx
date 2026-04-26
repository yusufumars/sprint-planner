import { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'

const DEFAULT_LANES = [
  { name: 'To Do',        remaining_percentage: 100, description: 'Work not yet started',                    is_default: true, is_active: true, sort_order: 1 },
  { name: 'In Progress',  remaining_percentage: 65,  description: 'Actively being worked on',                is_default: true, is_active: true, sort_order: 2 },
  { name: 'Code Review',  remaining_percentage: 25,  description: 'Awaiting or in code review',              is_default: true, is_active: true, sort_order: 3 },
  { name: 'QA',           remaining_percentage: 15,  description: 'In quality assurance testing',            is_default: true, is_active: true, sort_order: 4 },
  { name: 'UAT',          remaining_percentage: 10,  description: 'In user acceptance testing',              is_default: true, is_active: true, sort_order: 5 },
  { name: 'Blocked',      remaining_percentage: 1,   description: 'Blocked — tracked separately from carry', is_default: true, is_active: true, sort_order: 6 },
]

function LockIcon() {
  return (
    <svg className="w-3.5 h-3.5 text-[#404040]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
    </svg>
  )
}

function DeleteConfirmModal({ lane, onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="bg-[#111111] border border-[#1A1A1A] rounded-lg p-6 w-full max-w-sm mx-4">
        <h3 className="text-white font-semibold text-sm mb-1">Delete Swim Lane</h3>
        <p className="text-[#6e6e6e] text-xs font-mono mb-4">This action cannot be undone.</p>
        <div className="bg-black border border-[#2A2A2A] rounded p-3 mb-4">
          <p className="text-white text-sm font-medium">{lane.name}</p>
          <p className="text-[#6e6e6e] text-xs font-mono mt-0.5">{lane.remaining_percentage}% remaining effort</p>
          {lane.description && <p className="text-[#404040] text-xs font-mono mt-0.5">{lane.description}</p>}
        </div>
        <p className="text-[#F59E0B] text-xs font-mono mb-5">
          ⚠ Removing this lane will also delete any carryover data recorded for it.
        </p>
        <div className="flex gap-3">
          <button
            onClick={onConfirm}
            className="flex-1 bg-red-500 hover:bg-red-600 text-white font-mono font-semibold text-xs py-2.5 rounded transition-colors"
          >
            Yes, Delete
          </button>
          <button
            onClick={onCancel}
            className="flex-1 border border-[#2A2A2A] text-[#6e6e6e] hover:text-white font-mono text-xs py-2.5 rounded transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

export default function SwimLaneConfig({ teamId }) {
  const [lanes, setLanes] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [newLanes, setNewLanes] = useState([])
  const [validationErrors, setValidationErrors] = useState({})
  const newLaneNameRefs = useRef({})

  useEffect(() => {
    if (!teamId) return
    loadLanes()
  }, [teamId])

  async function loadLanes() {
    setLoading(true)
    const { data } = await supabase
      .from('swim_lanes')
      .select('*')
      .eq('team_id', teamId)
      .order('sort_order')
    setLanes(data || [])
    setLoading(false)
  }

  // ── Toggle active state (saves immediately) ──────────────────────────────
  async function handleToggle(lane) {
    const updated = !lane.is_active
    setLanes((prev) => prev.map((l) => l.id === lane.id ? { ...l, is_active: updated } : l))
    await supabase.from('swim_lanes').update({ is_active: updated }).eq('id', lane.id)
  }

  // ── Edit existing lane fields ─────────────────────────────────────────────
  function handleLaneChange(id, field, value) {
    setLanes((prev) => prev.map((l) => l.id === id ? { ...l, [field]: value } : l))
    setValidationErrors((e) => ({ ...e, [`${id}_${field}`]: undefined }))
  }

  // ── Add custom lane ───────────────────────────────────────────────────────
  function handleAddLane() {
    const tempId = `new_${Date.now()}`
    setNewLanes((prev) => [...prev, { tempId, name: '', remaining_percentage: '', description: '' }])
    // Focus the name field after render
    setTimeout(() => newLaneNameRefs.current[tempId]?.focus(), 50)
  }

  function handleNewLaneChange(tempId, field, value) {
    setNewLanes((prev) => prev.map((l) => l.tempId === tempId ? { ...l, [field]: value } : l))
    setValidationErrors((e) => ({ ...e, [`${tempId}_${field}`]: undefined }))
  }

  function handleNewLaneBlur(tempId, field, value) {
    const error = validateField(tempId, field, value, true)
    if (error) {
      setValidationErrors((e) => ({ ...e, [`${tempId}_${field}`]: error }))
    }
  }

  // ── Validation ────────────────────────────────────────────────────────────
  function validateField(id, field, value, isNew = false) {
    if (field === 'name') {
      if (!value.trim()) return 'Lane name is required'
      if (value.trim().length > 30) return 'Maximum 30 characters'
      const allNames = [
        ...lanes.filter((l) => l.id !== id).map((l) => l.name.toLowerCase()),
        ...(isNew
          ? newLanes.filter((l) => l.tempId !== id).map((l) => l.name.toLowerCase())
          : newLanes.map((l) => l.name.toLowerCase())),
      ]
      if (allNames.includes(value.trim().toLowerCase())) return '⚠ Name already exists'
    }
    if (field === 'remaining_percentage') {
      const n = parseInt(value, 10)
      if (isNaN(n) || n < 1 || n > 100) return 'Must be between 1 and 100'
    }
    return null
  }

  function validateAll() {
    const errors = {}
    newLanes.forEach((l) => {
      const nameErr = validateField(l.tempId, 'name', l.name, true)
      const pctErr = validateField(l.tempId, 'remaining_percentage', l.remaining_percentage, true)
      if (nameErr) errors[`${l.tempId}_name`] = nameErr
      if (pctErr) errors[`${l.tempId}_remaining_percentage`] = pctErr
    })
    return errors
  }

  // ── Save configuration ────────────────────────────────────────────────────
  async function handleSave() {
    const errors = validateAll()
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors)
      return
    }

    setSaving(true)

    // Upsert existing lanes (% and active state already in local state)
    const existingUpdates = lanes.map((l) =>
      supabase.from('swim_lanes').update({
        remaining_percentage: parseInt(l.remaining_percentage, 10),
        is_active: l.is_active,
        description: l.description || null,
      }).eq('id', l.id)
    )

    // Insert new custom lanes
    const inserts = newLanes.length > 0
      ? supabase.from('swim_lanes').insert(
          newLanes.map((l, i) => ({
            team_id: teamId,
            name: l.name.trim(),
            remaining_percentage: parseInt(l.remaining_percentage, 10),
            description: l.description?.trim() || null,
            is_default: false,
            is_active: true,
            sort_order: lanes.length + i + 1,
          }))
        )
      : Promise.resolve()

    await Promise.all([...existingUpdates, inserts])
    setNewLanes([])
    await loadLanes()
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  // ── Reset defaults ────────────────────────────────────────────────────────
  async function handleResetDefaults() {
    setSaving(true)
    const updates = lanes
      .filter((l) => l.is_default)
      .map((l) => {
        const def = DEFAULT_LANES.find((d) => d.name === l.name)
        if (!def) return Promise.resolve()
        return supabase.from('swim_lanes').update({ remaining_percentage: def.remaining_percentage }).eq('id', l.id)
      })
    await Promise.all(updates)
    await loadLanes()
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  // ── Delete custom lane ────────────────────────────────────────────────────
  async function handleDelete(lane) {
    await supabase.from('swim_lanes').delete().eq('id', lane.id)
    setDeleteTarget(null)
    setLanes((prev) => prev.filter((l) => l.id !== lane.id))
  }

  function removeNewLane(tempId) {
    setNewLanes((prev) => prev.filter((l) => l.tempId !== tempId))
    setValidationErrors((e) => {
      const next = { ...e }
      delete next[`${tempId}_name`]
      delete next[`${tempId}_remaining_percentage`]
      return next
    })
  }

  const hasValidationErrors = Object.values(validationErrors).some(Boolean)

  if (loading) return <div className="text-[#6e6e6e] font-mono text-sm py-8 text-center">Loading swim lanes…</div>

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-white text-sm font-medium">Swim Lane Configuration</p>
          <p className="text-[#6e6e6e] text-xs font-mono mt-0.5">
            Set remaining effort % per lane. Used to calculate sprint carryover.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleResetDefaults}
            disabled={saving}
            className="border border-[#2A2A2A] text-[#6e6e6e] hover:text-white font-mono text-xs px-4 py-2 rounded transition-colors disabled:opacity-50"
          >
            Reset to Defaults
          </button>
          <button
            onClick={handleSave}
            disabled={saving || hasValidationErrors}
            className="bg-[#BFFF00] hover:opacity-90 disabled:opacity-50 text-black font-mono font-semibold text-xs px-5 py-2 rounded transition-opacity"
          >
            {saved ? '✓ Saved' : saving ? 'Saving…' : 'Save Configuration'}
          </button>
        </div>
      </div>

      {/* Lane table */}
      <div className="bg-black border border-[#1A1A1A] rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#1A1A1A] text-[#404040] font-mono text-[10px] tracking-[1px] uppercase">
              <th className="text-left px-5 py-3">Lane</th>
              <th className="text-left px-4 py-3">Description</th>
              <th className="text-center px-4 py-3 w-32">Remaining %</th>
              <th className="text-center px-4 py-3 w-20">Active</th>
              <th className="px-4 py-3 w-12"></th>
            </tr>
          </thead>
          <tbody>
            {lanes.map((lane) => (
              <tr key={lane.id} className="border-t border-[#1A1A1A] hover:bg-[#0a0a0a]">
                {/* Name */}
                <td className="px-5 py-3">
                  <div className="flex items-center gap-2">
                    {lane.is_default && <LockIcon />}
                    <span className={`font-medium text-sm ${lane.is_active ? 'text-white' : 'text-[#404040]'}`}>
                      {lane.name}
                    </span>
                  </div>
                </td>

                {/* Description */}
                <td className="px-4 py-3">
                  <input
                    value={lane.description || ''}
                    onChange={(e) => handleLaneChange(lane.id, 'description', e.target.value)}
                    placeholder="Optional description"
                    className="w-full bg-transparent border-b border-[#2A2A2A] focus:border-[#BFFF00] text-xs text-[#6e6e6e] font-mono py-1 focus:outline-none placeholder-[#2A2A2A] focus:text-white transition-colors"
                  />
                </td>

                {/* Remaining % */}
                <td className="px-4 py-3 text-center">
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={lane.remaining_percentage}
                    onChange={(e) => handleLaneChange(lane.id, 'remaining_percentage', e.target.value)}
                    className="w-16 text-center bg-[#1A1A1A] border border-[#2A2A2A] rounded px-2 py-1 text-xs font-mono text-white focus:outline-none focus:border-[#BFFF00]"
                  />
                </td>

                {/* Active toggle */}
                <td className="px-4 py-3 text-center">
                  <button
                    onClick={() => handleToggle(lane)}
                    className={`w-10 h-5 rounded-full transition-colors relative ${lane.is_active ? 'bg-[#BFFF00]' : 'bg-[#2A2A2A]'}`}
                  >
                    <span
                      className={`absolute top-0.5 w-4 h-4 rounded-full bg-black transition-transform ${lane.is_active ? 'translate-x-5' : 'translate-x-0.5'}`}
                    />
                  </button>
                </td>

                {/* Delete (custom only) */}
                <td className="px-4 py-3 text-center">
                  {!lane.is_default && (
                    <button
                      onClick={() => setDeleteTarget(lane)}
                      className="text-red-500 hover:text-red-400 font-mono text-xs"
                    >
                      Delete
                    </button>
                  )}
                </td>
              </tr>
            ))}

            {/* New custom lanes being added */}
            {newLanes.map((nl) => (
              <tr key={nl.tempId} className="border-t border-[#BFFF00]/20 bg-[#0a0a0a]">
                {/* Name */}
                <td className="px-5 py-3">
                  <div>
                    <input
                      ref={(el) => (newLaneNameRefs.current[nl.tempId] = el)}
                      value={nl.name}
                      onChange={(e) => handleNewLaneChange(nl.tempId, 'name', e.target.value)}
                      onBlur={(e) => handleNewLaneBlur(nl.tempId, 'name', e.target.value)}
                      placeholder="Lane name"
                      maxLength={31}
                      className={`w-full bg-black border rounded px-2 py-1 text-xs font-mono text-white focus:outline-none placeholder-[#404040] ${
                        validationErrors[`${nl.tempId}_name`]
                          ? 'border-red-500 focus:border-red-500'
                          : 'border-[#2A2A2A] focus:border-[#BFFF00]'
                      }`}
                    />
                    {validationErrors[`${nl.tempId}_name`] && (
                      <p className="text-red-400 text-[10px] font-mono mt-1">{validationErrors[`${nl.tempId}_name`]}</p>
                    )}
                  </div>
                </td>

                {/* Description */}
                <td className="px-4 py-3">
                  <input
                    value={nl.description}
                    onChange={(e) => handleNewLaneChange(nl.tempId, 'description', e.target.value)}
                    placeholder="Optional description"
                    className="w-full bg-transparent border-b border-[#2A2A2A] focus:border-[#BFFF00] text-xs text-[#6e6e6e] font-mono py-1 focus:outline-none placeholder-[#2A2A2A] focus:text-white transition-colors"
                  />
                </td>

                {/* Remaining % */}
                <td className="px-4 py-3 text-center">
                  <div>
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={nl.remaining_percentage}
                      onChange={(e) => handleNewLaneChange(nl.tempId, 'remaining_percentage', e.target.value)}
                      onBlur={(e) => handleNewLaneBlur(nl.tempId, 'remaining_percentage', e.target.value)}
                      placeholder="1–100"
                      className={`w-16 text-center bg-[#1A1A1A] border rounded px-2 py-1 text-xs font-mono text-white focus:outline-none ${
                        validationErrors[`${nl.tempId}_remaining_percentage`]
                          ? 'border-red-500 focus:border-red-500'
                          : 'border-[#2A2A2A] focus:border-[#BFFF00]'
                      }`}
                    />
                    {validationErrors[`${nl.tempId}_remaining_percentage`] && (
                      <p className="text-red-400 text-[10px] font-mono mt-1 w-20">
                        {validationErrors[`${nl.tempId}_remaining_percentage`]}
                      </p>
                    )}
                  </div>
                </td>

                {/* Active placeholder */}
                <td className="px-4 py-3 text-center">
                  <span className="text-[#404040] text-xs font-mono">ON</span>
                </td>

                {/* Remove new lane */}
                <td className="px-4 py-3 text-center">
                  <button
                    onClick={() => removeNewLane(nl.tempId)}
                    className="text-[#6e6e6e] hover:text-white font-mono text-xs"
                  >
                    ✕
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add custom lane button */}
      <button
        onClick={handleAddLane}
        className="flex items-center gap-2 text-[#BFFF00] hover:opacity-70 font-mono text-xs transition-opacity"
      >
        <span className="text-base leading-none">+</span> Add Custom Swim Lane
      </button>

      {/* Help text */}
      <div className="bg-[#0a0a0a] border border-[#1A1A1A] rounded p-4 text-xs font-mono text-[#6e6e6e] space-y-1">
        <p className="text-[#404040] uppercase tracking-[1px] text-[10px] mb-2">How this works</p>
        <p>Remaining % represents the estimated effort still needed relative to the original estimate.</p>
        <p>Example: a ticket <span className="text-white">In Progress</span> at 65% means ~65% of its original SP still needs to be done.</p>
        <p>These percentages are used in the <span className="text-white">Carryover Review</span> screen to calculate each member's carry load.</p>
      </div>

      {/* Delete modal */}
      {deleteTarget && (
        <DeleteConfirmModal
          lane={deleteTarget}
          onConfirm={() => handleDelete(deleteTarget)}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  )
}
