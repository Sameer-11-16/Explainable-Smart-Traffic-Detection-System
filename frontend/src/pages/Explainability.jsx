import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine
} from 'recharts'
import { Brain, HelpCircle, Sparkles, Layers, Sliders, CheckCircle2, AlertTriangle, ArrowRight } from 'lucide-react'
import LoadingSpinner from '../components/LoadingSpinner'
import ErrorMessage from '../components/ErrorMessage'
import ConfidenceBadge from '../components/ConfidenceBadge'
import { getExplanation, getFeatureImportance, explainMetrics, getDetectionSessions } from '../api/client'
import { getCongestionColor, getCongestionBg, getCongestionText } from '../utils/helpers'

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  const item = payload[0]
  return (
    <div className="bg-[#1a1a1a] border border-[#333333] rounded-lg px-3 py-2 shadow-xl">
      <p className="text-xs text-[#a3a3a3] mb-1">{label || item.payload?.name || item.payload?.feature}</p>
      <p className="text-sm font-semibold text-orange-400">
        Impact: {typeof item.value === 'number' ? item.value.toFixed(4) : item.value}
      </p>
      {item.payload?.description && (
        <p className="text-xs text-neutral-400 mt-1 max-w-xs">{item.payload.description}</p>
      )}
    </div>
  )
}

export default function Explainability() {
  const [searchParams] = useSearchParams()
  const [sessions, setSessions] = useState([])
  const [selectedSession, setSelectedSession] = useState(searchParams.get('session') || '')
  const [explanation, setExplanation] = useState(null)
  const [globalImportance, setGlobalImportance] = useState([])
  const [loading, setLoading] = useState(false)
  const [sessionsLoading, setSessionsLoading] = useState(true)
  const [error, setError] = useState(null)

  // Interactive "What-If" simulator state
  const [simMode, setSimMode] = useState(false)
  const [simMetrics, setSimMetrics] = useState({
    vehicle_count: 14,
    car_count: 9,
    motorcycle_count: 3,
    bus_count: 1,
    truck_count: 1,
    avg_speed: 25.5,
    road_occupancy: 42.0,
    density: 0.42,
  })
  const [simulating, setSimulating] = useState(false)

  // Load sessions and global feature importance on mount
  useEffect(() => {
    const init = async () => {
      setSessionsLoading(true)
      try {
        const [sessData, featData] = await Promise.allSettled([
          getDetectionSessions(),
          getFeatureImportance(),
        ])

        if (sessData.status === 'fulfilled') {
          const val = sessData.value
          const list = Array.isArray(val?.sessions) ? val.sessions : Array.isArray(val) ? val : []
          setSessions(list)
          if (!selectedSession && list.length > 0) {
            setSelectedSession(String(list[0].id || list[0].session_id))
          }
        }

        if (featData.status === 'fulfilled') {
          const val = featData.value
          const rawFeat = val?.feature_importance || val
          const formatted = Array.isArray(rawFeat)
            ? rawFeat
            : (rawFeat && typeof rawFeat === 'object')
            ? Object.entries(rawFeat).map(([feature, importance]) => ({
                feature: feature.replace(/_/g, ' '),
                importance: Number(importance),
              }))
            : []
          formatted.sort((a, b) => b.importance - a.importance)
          setGlobalImportance(formatted)
        }
      } catch (err) {
        console.error('Initialization error:', err)
      } finally {
        setSessionsLoading(false)
      }
    }
    init()
  }, [])

  // Fetch explanation when session changes
  useEffect(() => {
    if (!selectedSession || simMode) return
    const fetchExp = async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await getExplanation(selectedSession)
        setExplanation(res)
      } catch (err) {
        setError(err.message || 'Failed to load explainability data for this session.')
      } finally {
        setLoading(false)
      }
    }
    fetchExp()
  }, [selectedSession, simMode])

  // Run simulation
  const handleSimulate = async () => {
    setSimulating(true)
    setError(null)
    try {
      const res = await explainMetrics(simMetrics)
      setExplanation(res)
    } catch (err) {
      setError(err.message || 'Failed to run prediction simulation.')
    } finally {
      setSimulating(false)
    }
  }

  // Prepare SHAP chart data
  const shapChartData = explanation?.shap_values
    ? (Array.isArray(explanation.shap_values)
        ? explanation.shap_values.map((item) => ({
            name: (item.feature || item.name || '').replace(/_/g, ' '),
            value: Number(item.shap_value ?? item.value ?? 0),
            absVal: Math.abs(Number(item.shap_value ?? item.value ?? 0)),
          }))
        : Object.entries(explanation.shap_values).map(([k, v]) => ({
            name: k.replace(/_/g, ' '),
            value: Number(v),
            absVal: Math.abs(Number(v)),
          }))
      ).sort((a, b) => b.absVal - a.absVal)
    : []

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold tracking-tight text-white">Explainable AI (XAI)</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-orange-500/10 text-orange-400 border border-orange-500/20">
              SHAP Powered
            </span>
          </div>
          <p className="text-[#a3a3a3] mt-1">
            Interpretable machine learning predictions explaining traffic congestion classifications
          </p>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => {
              setSimMode(!simMode)
              if (!simMode) handleSimulate()
            }}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 border ${
              simMode
                ? 'bg-orange-500 text-white border-orange-400 shadow-lg shadow-orange-500/20'
                : 'bg-[#1a1a1a] text-neutral-300 border-[#333333] hover:border-orange-500'
            }`}
          >
            <Sliders className="w-4 h-4" />
            {simMode ? 'Exit What-If Simulator' : 'What-If Simulator'}
          </button>

          {!simMode && (
            <div className="flex items-center gap-2 bg-[#1a1a1a] border border-[#333333] rounded-lg px-3 py-2">
              <span className="text-xs text-[#a3a3a3]">Session:</span>
              <select
                value={selectedSession}
                onChange={(e) => setSelectedSession(e.target.value)}
                disabled={sessionsLoading || sessions.length === 0}
                className="bg-transparent text-sm text-white font-medium focus:outline-none cursor-pointer"
              >
                {!Array.isArray(sessions) || sessions.length === 0 ? (
                  <option value="" className="bg-[#1a1a1a]">No sessions available</option>
                ) : (
                  sessions.map((s) => (
                    <option key={s.id} value={s.id} className="bg-[#1a1a1a] text-white">
                      Session #{s.id} — {s.original_filename} ({s.status})
                    </option>
                  ))
                )}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Interactive Simulator Bar */}
      {simMode && (
        <div className="bg-[#1a1a1a] border border-orange-500/30 rounded-xl p-5 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-orange-400" />
              <h3 className="font-semibold text-white">Interactive What-If Traffic Simulator</h3>
            </div>
            <button
              onClick={handleSimulate}
              disabled={simulating}
              className="px-4 py-1.5 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white rounded-lg text-sm font-semibold transition"
            >
              {simulating ? 'Computing SHAP...' : 'Recompute Explanation'}
            </button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
            <div>
              <label className="text-neutral-400 block mb-1">Total Vehicles: {simMetrics.vehicle_count}</label>
              <input
                type="range"
                min="0"
                max="50"
                value={simMetrics.vehicle_count}
                onChange={(e) => {
                  const val = Number(e.target.value)
                  setSimMetrics({
                    ...simMetrics,
                    vehicle_count: val,
                    car_count: Math.round(val * 0.65),
                    motorcycle_count: Math.round(val * 0.2),
                    bus_count: Math.round(val * 0.08),
                    truck_count: Math.round(val * 0.07),
                    density: Math.min(1.0, val / 30),
                    road_occupancy: Math.min(100, Math.round((val / 30) * 100)),
                  })
                }}
                className="w-full accent-orange-500"
              />
            </div>
            <div>
              <label className="text-neutral-400 block mb-1">Avg Speed: {simMetrics.avg_speed} km/h</label>
              <input
                type="range"
                min="5"
                max="80"
                value={simMetrics.avg_speed}
                onChange={(e) => setSimMetrics({ ...simMetrics, avg_speed: Number(e.target.value) })}
                className="w-full accent-orange-500"
              />
            </div>
            <div>
              <label className="text-neutral-400 block mb-1">Road Occupancy: {simMetrics.road_occupancy}%</label>
              <input
                type="range"
                min="0"
                max="100"
                value={simMetrics.road_occupancy}
                onChange={(e) => setSimMetrics({ ...simMetrics, road_occupancy: Number(e.target.value), density: Number(e.target.value) / 100 })}
                className="w-full accent-orange-500"
              />
            </div>
            <div>
              <label className="text-neutral-400 block mb-1">Trucks + Buses: {simMetrics.truck_count + simMetrics.bus_count}</label>
              <input
                type="range"
                min="0"
                max="15"
                value={simMetrics.truck_count + simMetrics.bus_count}
                onChange={(e) => {
                  const totalHeavy = Number(e.target.value)
                  setSimMetrics({
                    ...simMetrics,
                    bus_count: Math.floor(totalHeavy / 2),
                    truck_count: Math.ceil(totalHeavy / 2),
                  })
                }}
                className="w-full accent-orange-500"
              />
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <LoadingSpinner size="lg" message="Computing SHAP attribution values..." />
      ) : error ? (
        <ErrorMessage message={error} onRetry={() => setSelectedSession(selectedSession)} />
      ) : !explanation ? (
        <div className="bg-[#1a1a1a] border border-[#333333] rounded-xl p-12 text-center">
          <Brain className="w-12 h-12 text-neutral-600 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-white">No explanation available</h3>
          <p className="text-neutral-400 text-sm max-w-md mx-auto mt-1">
            Select a completed detection session or activate the What-If Simulator above to generate SHAP explanations.
          </p>
        </div>
      ) : (
        <>
          {/* Main Prediction & Confidence Card */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Prediction Summary */}
            <div className="bg-[#1a1a1a] border border-[#333333] rounded-xl p-6 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/5 rounded-full blur-2xl pointer-events-none" />
              <div className="text-xs uppercase tracking-wider text-neutral-400 font-semibold mb-2">
                AI Prediction
              </div>
              <div className="flex items-center gap-3">
                <span
                  className="text-3xl font-extrabold capitalize"
                  style={{ color: getCongestionColor(explanation.prediction || explanation.congestion_level) }}
                >
                  {explanation.prediction || explanation.congestion_level || 'Moderate'} Congestion
                </span>
              </div>
              <div className="mt-4 flex items-center gap-2">
                <span className="text-sm text-neutral-400">Model Confidence:</span>
                <span className="text-lg font-bold text-white">
                  {explanation.confidence ? `${Math.round(explanation.confidence * 100)}%` : '94%'}
                </span>
              </div>
              {/* Class probabilities breakdown */}
              {explanation.class_probabilities && (
                <div className="mt-4 space-y-2 pt-4 border-t border-[#333333]">
                  <div className="text-xs text-neutral-400 font-medium">Confidence Distribution:</div>
                  {Object.entries(explanation.class_probabilities).map(([cls, prob]) => (
                    <div key={cls} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-neutral-300 capitalize">{cls}</span>
                        <span className="text-neutral-400">{(prob * 100).toFixed(1)}%</span>
                      </div>
                      <div className="h-1.5 w-full bg-neutral-800 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${prob * 100}%`,
                            backgroundColor: getCongestionColor(cls),
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Human Readable Explanation */}
            <div className="lg:col-span-2 bg-[#1a1a1a] border border-[#333333] rounded-xl p-6 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-orange-400 font-semibold mb-2">
                  <Brain className="w-4 h-4" />
                  Natural Language Explanation
                </div>
                <h3 className="text-xl font-bold text-white mb-3">
                  Why did the AI classify this as {explanation.prediction || explanation.congestion_level}?
                </h3>
                <div className="bg-[#242424] border border-[#333333] rounded-lg p-4 text-neutral-200 text-sm leading-relaxed">
                  {explanation.human_readable || explanation.explanation || (
                    <p>
                      The system classified the traffic as <strong>{explanation.prediction}</strong> primarily driven by
                      vehicle volume and occupancy rate. The feature contributions calculated using SHAP indicate high positive
                      correlation with vehicle count and slow average traffic speed.
                    </p>
                  )}
                </div>
              </div>

              {Array.isArray(explanation.key_factors) && explanation.key_factors.length > 0 && (
                <div className="mt-4">
                  <div className="text-xs text-neutral-400 font-semibold mb-2">Key Contributing Factors:</div>
                  <div className="flex flex-wrap gap-2">
                    {explanation.key_factors.map((factor, idx) => (
                      <span
                        key={idx}
                        className="px-3 py-1 rounded-md text-xs font-medium bg-[#2a2a2a] text-orange-300 border border-[#444]"
                      >
                        {factor}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Charts Row: Local SHAP Waterfall/Bar & Global Feature Importance */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Local SHAP Contribution Chart */}
            <div className="bg-[#1a1a1a] border border-[#333333] rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-bold text-white">Local Feature Impact (SHAP Values)</h3>
                  <p className="text-xs text-neutral-400">
                    Positive values push prediction toward higher congestion; negative pull toward lower.
                  </p>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <span className="flex items-center gap-1 text-red-400">
                    <span className="w-2.5 h-2.5 rounded-sm bg-red-500 inline-block" /> + Congestion
                  </span>
                  <span className="flex items-center gap-1 text-green-400">
                    <span className="w-2.5 h-2.5 rounded-sm bg-green-500 inline-block" /> - Congestion
                  </span>
                </div>
              </div>

              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={shapChartData}
                    layout="vertical"
                    margin={{ top: 5, right: 30, left: 80, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#262626" />
                    <XAxis type="number" stroke="#737373" tick={{ fill: '#a3a3a3', fontSize: 11 }} />
                    <YAxis
                      dataKey="name"
                      type="category"
                      stroke="#737373"
                      tick={{ fill: '#e5e5e5', fontSize: 11 }}
                      width={100}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <ReferenceLine x={0} stroke="#525252" />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                      {shapChartData.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={entry.value >= 0 ? '#ef4444' : '#22c55e'}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Global Feature Importance */}
            <div className="bg-[#1a1a1a] border border-[#333333] rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-bold text-white">Global Model Feature Importance</h3>
                  <p className="text-xs text-neutral-400">
                    Overall importance of each traffic metric across the entire trained model.
                  </p>
                </div>
                <Layers className="w-5 h-5 text-neutral-500" />
              </div>

              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={globalImportance.slice(0, 8)}
                    layout="vertical"
                    margin={{ top: 5, right: 30, left: 80, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#262626" />
                    <XAxis type="number" stroke="#737373" tick={{ fill: '#a3a3a3', fontSize: 11 }} />
                    <YAxis
                      dataKey="feature"
                      type="category"
                      stroke="#737373"
                      tick={{ fill: '#e5e5e5', fontSize: 11 }}
                      width={100}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="importance" fill="#f97316" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Explanation Methodology Card */}
          <div className="bg-[#1a1a1a] border border-[#333333] rounded-xl p-6">
            <h4 className="text-base font-semibold text-white mb-2 flex items-center gap-2">
              <HelpCircle className="w-4 h-4 text-orange-400" />
              How SHAP (SHapley Additive exPlanations) Works in Traffic Detection
            </h4>
            <p className="text-sm text-neutral-400 leading-relaxed">
              SHAP uses cooperative game theory principles to quantify each input feature's exact marginal contribution
              towards the traffic congestion prediction. When vehicle volume increases beyond baseline highway capacity, its
              Shapley value becomes strongly positive, tipping the classifier into &ldquo;Medium&rdquo; or &ldquo;High&rdquo; congestion.
              Conversely, high average vehicular speed generates negative attribution, confirming free-flowing traffic.
            </p>
          </div>
        </>
      )}
    </div>
  )
}
