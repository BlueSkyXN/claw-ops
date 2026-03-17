import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Agents from './pages/Agents'
import Sessions from './pages/Sessions'
import Channels from './pages/Channels'
import CronJobs from './pages/CronJobs'
import Usage from './pages/Usage'
import Orchestration from './pages/Orchestration'
import Logs from './pages/Logs'
import Setup from './pages/Setup'

export default function App() {
  return (
    <Routes>
      {/* Setup wizard — standalone page, no sidebar */}
      <Route path="/setup" element={<Setup />} />
      <Route element={<Layout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/agents" element={<Agents />} />
        <Route path="/sessions" element={<Sessions />} />
        <Route path="/channels" element={<Channels />} />
        <Route path="/cron" element={<CronJobs />} />
        <Route path="/usage" element={<Usage />} />
        <Route path="/orchestration/*" element={<Orchestration />} />
        <Route path="/topology" element={<Navigate to="/orchestration/topology" replace />} />
        <Route path="/logs" element={<Logs />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
