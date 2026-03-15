import { useEffect, useState, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { useOnboarding } from '../context/OnboardingContext'
import { supabase } from '../lib/supabase'

const PAD = 12

const STEPS = [
  {
    title: 'Welcome to SprintIQ!',
    body: 'This 2-minute guide walks you through setting up your team for accurate sprint capacity planning.',
    targetId: null,
    route: null,
    buttonLabel: "Let's start",
  },
  {
    title: 'Configure your team',
    body: 'Head to Settings to set your team name, sprint defaults, and manage members.',
    targetId: 'onboarding-settings-link',
    route: null,
    buttonLabel: 'Next',
  },
  {
    title: 'Add team members',
    body: 'Add each engineer with their name and role. This powers the capacity breakdown on the Dashboard.',
    targetId: 'onboarding-add-member-form',
    route: '/team/:teamCode/team',
    buttonLabel: 'Next',
  },
  {
    title: 'Create your first sprint',
    body: "Click '+ New Sprint' to set up a sprint with a name, dates, and story points per member.",
    targetId: 'onboarding-new-sprint-btn',
    route: '/team/:teamCode',
    buttonLabel: 'Next',
  },
  {
    title: 'Log leave & holidays',
    body: "Add annual leave or public holidays here. SprintIQ automatically deducts them from each member's available capacity.",
    targetId: 'onboarding-leave-tab',
    route: '/team/:teamCode/team',
    buttonLabel: 'Next',
  },
  {
    title: 'Assign story points',
    body: "Enter the story points assigned to each engineer in Jira. Utilization status updates in real time.",
    targetId: 'onboarding-assigned-sp-col',
    route: '/team/:teamCode',
    buttonLabel: 'Done!',
  },
]

function StepDots({ current, total }) {
  return (
    <div className="flex gap-1.5">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={`rounded-full transition-all ${i === current ? 'w-5 h-2 bg-blue-600' : 'w-2 h-2 bg-slate-300'}`}
        />
      ))}
    </div>
  )
}

export default function Onboarding() {
  const { teamCode } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { isActive, currentStep, nextStep, stopOnboarding } = useOnboarding()
  const [targetRect, setTargetRect] = useState(null)
  const findAttempts = useRef(0)

  const step = STEPS[currentStep]

  // Navigate to the step's route if needed
  useEffect(() => {
    if (!isActive || !step.route) return
    const targetPath = step.route.replace(':teamCode', teamCode)
    if (location.pathname !== targetPath) {
      navigate(targetPath)
    }
  }, [currentStep, isActive]) // eslint-disable-line react-hooks/exhaustive-deps

  // Find the target element after step change / navigation
  useEffect(() => {
    if (!isActive) return
    setTargetRect(null)
    if (!step.targetId) return

    findAttempts.current = 0
    const find = () => {
      const el = document.getElementById(step.targetId)
      if (el) {
        el.scrollIntoView({ block: 'center', behavior: 'smooth' })
        setTimeout(() => {
          const r = el.getBoundingClientRect()
          setTargetRect({ top: r.top, left: r.left, width: r.width, height: r.height })
        }, 300)
      } else if (findAttempts.current < 15) {
        findAttempts.current++
        setTimeout(find, 150)
      }
    }
    setTimeout(find, 400)
  }, [currentStep, isActive, location.pathname]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleFinish() {
    await supabase.from('teams').update({ onboarding_completed: true }).eq('team_code', teamCode)
    stopOnboarding()
  }

  function handleNext() {
    if (currentStep + 1 >= STEPS.length) {
      handleFinish()
    } else {
      nextStep(STEPS.length)
    }
  }

  if (!isActive) return null

  const spotTop = targetRect ? targetRect.top - PAD : 0
  const spotLeft = targetRect ? targetRect.left - PAD : 0
  const spotWidth = targetRect ? targetRect.width + PAD * 2 : 0
  const spotHeight = targetRect ? targetRect.height + PAD * 2 : 0
  const spotBottom = spotTop + spotHeight

  // Position tooltip below target, clamped to viewport width
  const tooltipLeft = targetRect
    ? Math.max(16, Math.min(spotLeft, (typeof window !== 'undefined' ? window.innerWidth : 800) - 316))
    : 0
  const tooltipTop = spotBottom + 16

  // Step 0 — no target, centered welcome card
  if (!step.targetId) {
    return createPortal(
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <div className="absolute inset-0 bg-slate-900/60" onClick={(e) => e.stopPropagation()} />
        <div className="relative z-10 bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full mx-4">
          <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center mb-4">
            <span className="text-white font-bold text-lg">SI</span>
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">{step.title}</h2>
          <p className="text-slate-600 text-sm leading-relaxed mb-6">{step.body}</p>
          <div className="flex items-center justify-between">
            <StepDots current={currentStep} total={STEPS.length} />
            <div className="flex items-center gap-3">
              <button onClick={handleFinish} className="text-slate-400 text-sm hover:text-slate-600 transition-colors">
                Skip
              </button>
              <button
                onClick={handleNext}
                className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                {step.buttonLabel}
              </button>
            </div>
          </div>
        </div>
      </div>,
      document.body
    )
  }

  // Steps with a spotlight target
  return createPortal(
    <div className="fixed inset-0 z-50 pointer-events-none">
      {/* 4-panel overlay */}
      {targetRect && (
        <>
          <div className="absolute bg-slate-900/60 pointer-events-auto" style={{ top: 0, left: 0, right: 0, height: spotTop }} />
          <div className="absolute bg-slate-900/60 pointer-events-auto" style={{ top: spotBottom, left: 0, right: 0, bottom: 0 }} />
          <div className="absolute bg-slate-900/60 pointer-events-auto" style={{ top: spotTop, left: 0, width: spotLeft, height: spotHeight }} />
          <div className="absolute bg-slate-900/60 pointer-events-auto" style={{ top: spotTop, left: spotLeft + spotWidth, right: 0, height: spotHeight }} />
          {/* Spotlight ring */}
          <div
            className="absolute rounded-xl border-2 border-blue-400 shadow-[0_0_0_4px_rgba(59,130,246,0.2)]"
            style={{ top: spotTop, left: spotLeft, width: spotWidth, height: spotHeight }}
          />
        </>
      )}

      {/* Tooltip card */}
      {targetRect && (
        <div className="absolute pointer-events-auto" style={{ top: tooltipTop, left: tooltipLeft, width: 300 }}>
          {/* Arrow */}
          <div className="absolute -top-2 left-6 w-4 h-4 bg-white border-l border-t border-slate-200 rotate-45 z-10" />
          <div className="bg-white rounded-xl shadow-2xl p-5 border border-slate-200">
            <h3 className="font-bold text-slate-900 mb-1.5">{step.title}</h3>
            <p className="text-slate-600 text-sm leading-relaxed mb-4">{step.body}</p>
            <div className="flex items-center justify-between">
              <StepDots current={currentStep} total={STEPS.length} />
              <div className="flex items-center gap-3">
                <button onClick={handleFinish} className="text-slate-400 text-xs hover:text-slate-600 transition-colors">
                  Skip
                </button>
                <button
                  onClick={handleNext}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-1.5 rounded-lg text-sm font-medium transition-colors"
                >
                  {step.buttonLabel}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>,
    document.body
  )
}
