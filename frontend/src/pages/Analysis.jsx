import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line,
} from 'recharts'
import { Activity, Gauge, Timer, TrendingUp } from 'lucide-react'
import LoadingSpinner from '../components/LoadingSpinner'
import ErrorMessage from '../components/ErrorMessage'
import { getAnalysis, getDetectionSessions } from '../api/client'
import { getCongestionColor, getCongestionBg, getCongestionText, CHART_COLORS } from '../utils/helpers'

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-[#1a1a1a] border border-[#333333] rounded-lg px-3 py-2 shadow-xl">
      <p className="text-xs text-[#a3a3a3] mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} className="text-sm font-medium" style={{ color: p.color }}>
          {p.name}: {typeof p.value === 'number' ? p.value.toFixed(1) : p.value}
        </p>
      ))}
    </div>
  )
}

function Analysis() {
  const [searchParams] = useSearchParams()
  const [sessions, setSessions] = useState([])
  const [selectedSession, setSelectedSession] = useState(searchParams.get('session') || '')
  const [analysis, setAnalysis] = useState(null)
  const [loading, setLoading] = useState(false)
  const [sessionsLoading, setSessionsLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const fetchSessions = async () => {
      setSessionsLoading(true)
      try {
        const data = await getDetectionSessions()
        const list = Array.isArray(data?.sessions) ? data.sessions : Array.isArray(data) ? data : []
        setSessions(list)
        if (!selectedSession && list.length > 0) {
          setSelectedSession(String(list[0].id || list[0].session_id))
        }
      } catch {
        /* ignore */
      } finally {
        setSessionsLoading(false)
      }
    }
    fetchSessions()
  }, [])

  useEffect(() => {
    if (!selectedSession) return
    const fetchAnalysis = async () => {
      setLoading(true)
      setError(null)
      try {
        const data = await getAnalysis(selectedSession)
        setAnalysis(data)
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    fetchAnalysis()
  }, [selectedSession])

  const vehicleComposition = analysis
    ? [
        { name: 'Cars', count: analysis.cars || 0 },
        { name: 'Motorcycles', count: analysis.motorcycles || 0 },
        { name: 'Buses', count: analysis.buses || 0 },
        { name: 'Trucks', count: analysis.trucks || 0 },
      ]
    : []

  const densityOverTime = analysis?.density_over_time || []

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-white">Traffic Analysis</h1>
        <p className="text-[#a3a3a3] mt-1">Detailed traffic metrics and visual breakdown</p>
      </div>

      {/* Session Selector */}
      <div className="bg-[#1a1a1a] rounded-xl border border-[#333333] p-6 shadow-lg">
        <h3 className="text-sm font-medium text-[#a3a3a3] mb-3">Select Session</h3>
        {sessionsLoading ? (
          <LoadingSpinner size="sm" message="Loading sessions..." />
        ) : sessions.length === 0 ? (
          <p className="text-sm text-[#737373]">No sessions available. Upload a video first.</p>
        ) : (
          <select
            value={selectedSession}
            onChange={(e) => setSelectedSession(e.target.value)}
            className="w-full max-w-md bg-[#252525] border border-[#333333] text-white rounded-lg px-4 py-2 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500 transition-colors"
          >
            <option value="">Choose a session</option>
            {Array.isArray(sessions) && sessions.map((s) => (
              <option key={s.id || s.session_id} value={s.id || s.session_id}>
                #{s.id || s.session_id} — {s.filename || s.file_name || 'Video'}
              </option>
            ))}
          </select>
        )}
      </div>

      {!selectedSession && !loading && (
        <div className="flex flex-col items-center justify-center py-16">
          <Activity className="h-12 w-12 text-[#737373] mb-3" />
          <p className="text-[#737373]">Select a session to view analysis</p>
        </div>
      )}

      {loading && <LoadingSpinner size="lg" message="Loading analysis..." />}
      {error && <ErrorMessage message={error} onRetry={() => setSelectedSession(selectedSession)} />}

      {analysis && !loading && (
        <>
          {/* Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Traffic Density */}
            <div className="bg-[#1a1a1a] rounded-xl border border-[#333333] p-6 shadow-lg">
              <div className="flex items-center gap-2 mb-3">
                <Gauge className="h-4 w-4 text-orange-400" />
                <span className="text-sm font-medium text-[#a3a3a3]">Traffic Density</span>
              </div>
              <p className="text-3xl font-bold text-white">
                {analysis.density != null ? `${Number(analysis.density).toFixed(1)}%` : 'N/A'}
              </p>
              <div className="w-full h-2 bg-[#252525] rounded-full overflow-hidden mt-3">
                <div
                  className="h-full bg-gradient-to-r from-orange-500 to-orange-400 rounded-full transition-all duration-700"
                  style={{ width: `${Math.min(analysis.density || 0, 100)}%` }}
                />
              </div>
            </div>

            {/* Road Occupancy */}
            <div className="bg-[#1a1a1a] rounded-xl border border-[#333333] p-6 shadow-lg">
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="h-4 w-4 text-orange-400" />
                <span className="text-sm font-medium text-[#a3a3a3]">Road Occupancy</span>
              </div>
              <p className="text-3xl font-bold text-white">
                {analysis.road_occupancy != null
                  ? `${Number(analysis.road_occupancy).toFixed(1)}%`
                  : 'N/A'}
              </p>
              <div className="w-full h-2 bg-[#252525] rounded-full overflow-hidden mt-3">
                <div
                  className="h-full bg-gradient-to-r from-blue-500 to-blue-400 rounded-full transition-all duration-700"
                  style={{ width: `${Math.min(analysis.road_occupancy || 0, 100)}%` }}
                />
              </div>
            </div>

            {/* Avg Speed */}
            <div className="bg-[#1a1a1a] rounded-xl border border-[#333333] p-6 shadow-lg">
              <div className="flex items-center gap-2 mb-3">
                <Timer className="h-4 w-4 text-orange-400" />
                <span className="text-sm font-medium text-[#a3a3a3]">Avg Speed</span>
              </div>
              <p className="text-3xl font-bold text-white">
                {analysis.avg_speed != null
                  ? `${Number(analysis.avg_speed).toFixed(0)}`
                  : 'N/A'}
              </p>
              <p className="text-xs text-[#737373] mt-1">km/h estimated</p>
            </div>

            {/* Congestion */}
            <div className="bg-[#1a1a1a] rounded-xl border border-[#333333] p-6 shadow-lg">
              <div className="flex items-center gap-2 mb-3">
                <Activity className="h-4 w-4 text-orange-400" />
                <span className="text-sm font-medium text-[#a3a3a3]">Congestion Level</span>
              </div>
              <div
                className={`inline-flex items-center px-4 py-2 rounded-lg text-lg font-bold capitalize ${getCongestionBg(analysis.congestion_level)} ${getCongestionText(analysis.congestion_level)}`}
              >
                <div
                  className="w-3 h-3 rounded-full mr-2"
                  style={{ backgroundColor: getCongestionColor(analysis.congestion_level) }}
                />
                {analysis.congestion_level || 'Unknown'}
              </div>
            </div>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Vehicle Composition */}
            <div className="bg-[#1a1a1a] rounded-xl border border-[#333333] p-6 shadow-lg">
              <h3 className="text-sm font-medium text-[#a3a3a3] mb-4">Vehicle Composition</h3>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={vehicleComposition}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333333" />
                  <XAxis dataKey="name" tick={{ fill: '#737373', fontSize: 12 }} stroke="#333333" />
                  <YAxis tick={{ fill: '#737373', fontSize: 12 }} stroke="#333333" />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="count" name="Count" radius={[6, 6, 0, 0]}>
                    {vehicleComposition.map((_, idx) => (
                      <BarChart key={idx}>
                        {null}
                      </BarChart>
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Density Over Time */}
            <div className="bg-[#1a1a1a] rounded-xl border border-[#333333] p-6 shadow-lg">
              <h3 className="text-sm font-medium text-[#a3a3a3] mb-4">Density Over Time</h3>
              {densityOverTime.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={densityOverTime}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#333333" />
                    <XAxis dataKey="time" tick={{ fill: '#737373', fontSize: 12 }} stroke="#333333" />
                    <YAxis tick={{ fill: '#737373', fontSize: 12 }} stroke="#333333" />
                    <Tooltip content={<CustomTooltip />} />
                    <Line
                      type="monotone"
                      dataKey="density"
                      name="Density"
                      stroke="#f97316"
                      strokeWidth={2}
                      dot={{ r: 3, fill: '#f97316' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-64 text-[#737373] text-sm">
                  Density timeline not available for this session
                </div>
              )}
            </div>
          </div>

          {/* Summary */}
          {analysis.summary_text && (
            <div className="bg-[#1a1a1a] rounded-xl border border-[#333333] p-6 shadow-lg">
              <h3 className="text-sm font-medium text-[#a3a3a3] mb-3">Analysis Summary</h3>
              <p className="text-white leading-relaxed">{analysis.summary_text}</p>
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default Analysis
