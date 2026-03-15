import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Welcome from './pages/Welcome'
import Dashboard from './pages/Dashboard'
import Team from './pages/Team'
import Velocity from './pages/Velocity'
import Settings from './pages/Settings'
import Navbar from './components/Navbar'
import Onboarding from './components/Onboarding'
import { OnboardingProvider } from './context/OnboardingContext'

function TeamLayout({ children }) {
  return (
    <div className="min-h-screen bg-slate-100">
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 py-6">
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
