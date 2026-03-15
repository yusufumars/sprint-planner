import { createContext, useContext, useState } from 'react'

const OnboardingContext = createContext(null)

export function OnboardingProvider({ children }) {
  const [isActive, setIsActive] = useState(false)
  const [currentStep, setCurrentStep] = useState(0)

  function startOnboarding() {
    setCurrentStep(0)
    setIsActive(true)
  }

  function stopOnboarding() {
    setIsActive(false)
  }

  function nextStep(totalSteps) {
    if (currentStep + 1 >= totalSteps) {
      stopOnboarding()
    } else {
      setCurrentStep((s) => s + 1)
    }
  }

  return (
    <OnboardingContext.Provider value={{ isActive, currentStep, startOnboarding, stopOnboarding, nextStep }}>
      {children}
    </OnboardingContext.Provider>
  )
}

export function useOnboarding() {
  return useContext(OnboardingContext)
}
