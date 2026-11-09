import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Detection from './pages/Detection'
import Analysis from './pages/Analysis'
import Explainability from './pages/Explainability'
import Reports from './pages/Reports'
import Settings from './pages/Settings'

function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/detection" element={<Detection />} />
        <Route path="/analysis" element={<Analysis />} />
        <Route path="/explainability" element={<Explainability />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/settings" element={<Settings />} />
      </Route>
    </Routes>
  )
}

export default App
