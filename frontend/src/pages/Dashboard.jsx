import { useState, useEffect } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts'
import { Car, Bike, Bus, Truck, Activity, AlertCircle } from 'lucide-react'
import StatCard from '../components/StatCard'
import LoadingSpinner from '../components/LoadingSpinner'
import ErrorMessage from '../components/ErrorMessage'
import { getDashboardStats, getDashboardHistory, getRecentSessions } from '../api/client'
import { formatNumber, formatDate, getCongestionColor, getCongestionBg, getCongestionText, CHART_COLORS } from '../utils/helpers'

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-[#1a1a1a] border border-[#333333] rounded-lg px-3 py-2 shadow-xl">
      <p className="text-xs text-[#a3a3a3] mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} className="text-sm font-medium" style={{ color: p.color }}>
          {p.name}: {p.value}
        </p>
      ))}
    </div>
  )
}

function Dashboard() {
  const [stats, setStats] = useState(null)
  const [history, setHistory] = useState([])
  const [recent, setRecent] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchData = async () => {
    setLoading(true)
    setError(null)
    try {
      const [statsRes, historyRes, recentRes] = await Promise.allSettled([
        getDashboardStats(),
        getDashboardHistory(),
        getRecentSessions(),
      ])
      if (statsRes.status === 'fulfilled' && statsRes.value && typeof statsRes.value === 'object') {
        setStats(statsRes.value)
      }
      if (historyRes.status === 'fulfilled') {
        const val = historyRes.value
        const rawHistory = Array.isArray(val?.history) ? val.history : Array.isArray(val) ? val : []
        const normalizedHistory = rawHistory.map((h, idx) => ({
          ...h,
          session: h.session || `#${h.session_id || h.id || idx + 1}`,
          total: h.total ?? h.total_vehicles ?? h.vehicle_count ?? 0,
          cars: h.cars ?? 0,
          motorcycles: h.motorcycles ?? 0,
          buses: h.buses ?? 0,
          trucks: h.trucks ?? 0,
        }))
        setHistory(normalizedHistory)
      }
      if (recentRes.status === 'fulfilled') {
        const val = recentRes.value
        const rawRecent = Array.isArray(val?.sessions) ? val.sessions : Array.isArray(val) ? val : []
        const normalizedRecent = rawRecent.map((s, idx) => ({
          ...s,
          filename: s.filename || s.original_filename || s.file_name || `Session #${s.id || idx + 1}`,
          created_at: s.created_at || s.upload_time || s.date,
          congestion_level: s.congestion_level || 'Low',
          total_vehicles: s.total_vehicles ?? s.vehicle_count ?? 0,
        }))
        setRecent(normalizedRecent)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  if (loading) return <LoadingSpinner size="lg" message="Loading dashboard..." />
  if (error) return <ErrorMessage message={error} onRetry={fetchData} />

  const totalVehicles = stats?.total_vehicles ?? stats?.vehicle_count ?? 0
  const cars = stats?.cars ?? stats?.total_cars ?? 0
  const motorcycles = stats?.motorcycles ?? stats?.total_motorcycles ?? 0
  const buses = stats?.buses ?? stats?.total_buses ?? 0
  const trucks = stats?.trucks ?? stats?.total_trucks ?? 0
  const congestionLevel = stats?.congestion_level || stats?.current_congestion || (recent.length > 0 ? recent[0].congestion_level : 'Low')
  const rawDensity = stats?.density ?? stats?.current_density ?? (recent.length > 0 ? recent[0].density : 0)
  const densityPercent = rawDensity <= 1.0 && rawDensity > 0 ? (rawDensity * 100).toFixed(1) : Number(rawDensity || 0).toFixed(1)

  const hasData = (stats && (totalVehicles > 0 || (stats.completed_sessions || 0) > 0)) || (Array.isArray(recent) && recent.length > 0)

  const vehiclePieData = [
    { name: 'Cars', value: cars },
    { name: 'Motorcycles', value: motorcycles },
    { name: 'Buses', value: buses },
    { name: 'Trucks', value: trucks },
  ].filter((d) => d.value > 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-white">Traffic Dashboard</h1>
        <p className="text-[#a3a3a3] mt-1">
          Real-time overview of vehicle detection and traffic analysis
        </p>
      </div>

      {!hasData ? (
        <div className="flex flex-col items-center justify-center py-20 px-4">
          <div className="w-16 h-16 rounded-full bg-orange-500/10 flex items-center justify-center mb-4">
            <Activity className="h-8 w-8 text-orange-400" />
          </div>
          <h2 className="text-xl font-semibold text-white mb-2">No data yet</h2>
          <p className="text-[#a3a3a3] text-center max-w-md">
            Upload a video to get started with vehicle detection and traffic analysis.
          </p>
        </div>
      ) : (
        <>
          {/* Stat Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              icon={Car}
              label="Total Vehicles"
              value={formatNumber(totalVehicles)}
              subtitle="All detected vehicles"
              gradient
            />
            <StatCard
              icon={Car}
              label="Cars"
              value={formatNumber(cars)}
              subtitle="Sedans & hatchbacks"
            />
            <StatCard
              icon={Bike}
              label="Motorcycles"
              value={formatNumber(motorcycles)}
              subtitle="Two-wheelers"
            />
            <StatCard
              icon={Bus}
              label="Buses & Trucks"
              value={formatNumber(buses + trucks)}
              subtitle="Heavy vehicles"
            />
          </div>

          {/* Congestion & Density */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Congestion Status */}
            <div className="bg-[#1a1a1a] rounded-xl border border-[#333333] p-6 shadow-lg">
              <h3 className="text-sm font-medium text-[#a3a3a3] mb-4">Congestion Status</h3>
              <div className="flex items-center gap-4">
                <div
                  className={`flex items-center justify-center w-16 h-16 rounded-xl ${getCongestionBg(congestionLevel)}`}
                >
                  <AlertCircle
                    className="h-8 w-8"
                    style={{ color: getCongestionColor(congestionLevel) }}
                  />
                </div>
                <div>
                  <p
                    className={`text-2xl font-bold capitalize ${getCongestionText(congestionLevel)}`}
                  >
                    {congestionLevel || 'Unknown'}
                  </p>
                  <p className="text-sm text-[#737373]">Current traffic condition</p>
                </div>
              </div>
            </div>

            {/* Traffic Density */}
            <div className="bg-[#1a1a1a] rounded-xl border border-[#333333] p-6 shadow-lg">
              <h3 className="text-sm font-medium text-[#a3a3a3] mb-4">Traffic Density</h3>
              <div className="space-y-3">
                <div className="flex justify-between items-end">
                  <span className="text-3xl font-bold text-white">
                    {`${densityPercent}%`}
                  </span>
                  <span className="text-sm text-[#737373]">vehicles / area</span>
                </div>
                <div className="w-full h-3 bg-[#252525] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-orange-500 to-orange-400 transition-all duration-700"
                    style={{ width: `${Math.min(Math.max(Number(densityPercent) || 0, 0), 100)}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Historical Chart */}
            <div className="lg:col-span-2 bg-[#1a1a1a] rounded-xl border border-[#333333] p-6 shadow-lg">
              <h3 className="text-sm font-medium text-[#a3a3a3] mb-4">
                Vehicle Count History
              </h3>
              {history.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={history}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#333333" />
                    <XAxis dataKey="session" tick={{ fill: '#737373', fontSize: 12 }} stroke="#333333" />
                    <YAxis tick={{ fill: '#737373', fontSize: 12 }} stroke="#333333" />
                    <Tooltip content={<CustomTooltip />} />
                    <Line
                      type="monotone"
                      dataKey="total"
                      name="Total"
                      stroke="#f97316"
                      strokeWidth={2}
                      dot={{ r: 4, fill: '#f97316' }}
                      activeDot={{ r: 6 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="cars"
                      name="Cars"
                      stroke="#fb923c"
                      strokeWidth={1.5}
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="motorcycles"
                      name="Motorcycles"
                      stroke="#ea580c"
                      strokeWidth={1.5}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-64 text-[#737373] text-sm">
                  No history data available
                </div>
              )}
            </div>

            {/* Pie Chart */}
            <div className="bg-[#1a1a1a] rounded-xl border border-[#333333] p-6 shadow-lg">
              <h3 className="text-sm font-medium text-[#a3a3a3] mb-4">
                Vehicle Distribution
              </h3>
              {vehiclePieData.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie
                      data={vehiclePieData}
                      cx="50%"
                      cy="45%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {vehiclePieData.map((_, idx) => (
                        <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Legend
                      verticalAlign="bottom"
                      iconType="circle"
                      iconSize={8}
                      formatter={(v) => <span className="text-xs text-[#a3a3a3]">{v}</span>}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#1a1a1a',
                        border: '1px solid #333333',
                        borderRadius: '8px',
                        color: '#fff',
                        fontSize: '12px',
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-64 text-[#737373] text-sm">
                  No data
                </div>
              )}
            </div>
          </div>

          {/* Recent Sessions */}
          <div className="bg-[#1a1a1a] rounded-xl border border-[#333333] p-6 shadow-lg">
            <h3 className="text-sm font-medium text-[#a3a3a3] mb-4">Recent Detection Sessions</h3>
            {Array.isArray(recent) && recent.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#333333]">
                      <th className="text-left py-3 px-4 text-[#737373] font-medium">Session</th>
                      <th className="text-left py-3 px-4 text-[#737373] font-medium">File</th>
                      <th className="text-left py-3 px-4 text-[#737373] font-medium">Vehicles</th>
                      <th className="text-left py-3 px-4 text-[#737373] font-medium">Congestion</th>
                      <th className="text-left py-3 px-4 text-[#737373] font-medium">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recent.map((s, i) => (
                      <tr
                        key={s.id || i}
                        className="border-b border-[#333333]/50 hover:bg-[#252525] transition-colors"
                      >
                        <td className="py-3 px-4 text-white font-mono text-xs">
                          #{s.id || i + 1}
                        </td>
                        <td className="py-3 px-4 text-white">
                          {s.filename || s.file_name || 'N/A'}
                        </td>
                        <td className="py-3 px-4 text-orange-400 font-semibold">
                          {s.total_vehicles ?? '—'}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${getCongestionBg(s.congestion_level)} ${getCongestionText(s.congestion_level)}`}
                          >
                            {s.congestion_level || 'N/A'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-[#a3a3a3]">
                          {formatDate(s.created_at || s.date)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-[#737373] py-4 text-center">No recent sessions</p>
            )}
          </div>
        </>
      )}
    </div>
  )
}

export default Dashboard
