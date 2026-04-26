import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'
import Welcome from './pages/Welcome'
import Dashboard from './pages/Dashboard'
import Team from './pages/Team'
import Velocity from './pages/Velocity'
import Settings from './pages/Settings'
import Navbar from './components/Navbar'
import Onboarding from './components/Onboarding'
import { OnboardingProvider } from './context/OnboardingContext'
import { capture } from './lib/analytics'

const PAGE_NAMES = {
  '/': 'Welcome',
  '': 'Dashboard',
  'team': 'Team',
  'velocity': 'Velocity',
  'settings': 'Settings',
}

function PageViewTracker() {
  const location = useLocation()
  useEffect(() => {
    const segments = location.pathname.split('/').filter(Boolean)
    const lastSegment = segments[segments.length - 1]
    const isTeamCode = lastSegment && /^[a-z0-9]+-[a-z0-9]+$/.test(lastSegment)
    const pageKey = location.pathname === '/' ? '/' : (isTeamCode ? '' : lastSegment)
    const page = PAGE_NAMES[pageKey] ?? lastSegment
    capture('page_viewed', { page })
  }, [location.pathname])
  return null
}

function TeamLayout({ children }) {
  return (
    <div className="min-h-screen bg-black flex font-sans">
      <Navbar />
      <main className="flex-1 overflow-auto px-10 py-8">
        {children}
      </main>
      <Onboarding />
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <OnboardingProvider>
        <PageViewTracker />
        <Routes>
          <Route path="/" element={<Welcome />} />
          <Route path="/team/:teamCode" element={<TeamLayout><Dashboard /></TeamLayout>} />
          <Route path="/team/:teamCode/team" element={<TeamLayout><Team /></TeamLayout>} />
          <Route path="/team/:teamCode/velocity" element={<TeamLayout><Velocity /></TeamLayout>} />
          <Route path="/team/:teamCode/settings" element={<TeamLayout><Settings /></TeamLayout>} />
        </Routes>
      </OnboardingProvider>
    </BrowserRouter>
  )
}
