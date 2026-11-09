import { useState, useEffect } from 'react'
import {
  FileText, Download, Trash2, Calendar, Clock, Car, Bike, Bus, Truck,
  ChevronDown, ChevronUp, Search, Filter, AlertCircle, CheckCircle, BarChart3
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from 'recharts'
import LoadingSpinner from '../components/LoadingSpinner'
import ErrorMessage from '../components/ErrorMessage'
import { getReports, deleteSession, exportCSV, exportAllCSV } from '../api/client'
import { formatDate, formatDuration, getCongestionColor, getCongestionBg, getCongestionText, CHART_COLORS } from '../utils/helpers'

export default function Reports() {
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [expandedId, setExpandedId] = useState(null)
  const [deletingId, setDeletingId] = useState(null)

  const fetchReportData = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await getReports()
      const list = Array.isArray(data?.reports) ? data.reports : Array.isArray(data?.sessions) ? data.sessions : Array.isArray(data) ? data : []
      setReports(list)
    } catch (err) {
      setError(err.message || 'Failed to fetch reports')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchReportData()
  }, [])

  const handleDelete = async (id, e) => {
    e.stopPropagation()
    if (!window.confirm(`Are you sure you want to delete session #${id}?`)) return
    setDeletingId(id)
    try {
      await deleteSession(id)
      setReports((prev) => prev.filter((r) => r.id !== id))
      if (expandedId === id) setExpandedId(null)
    } catch (err) {
      alert(`Failed to delete: ${err.message}`)
    } finally {
      setDeletingId(null)
    }
  }

  const toggleExpand = (id) => {
    setExpandedId(expandedId === id ? null : id)
  }

  // Filtered reports
  const safeReports = Array.isArray(reports) ? reports : []
  const filtered = safeReports.filter((r) => {
    const filename = r.original_filename || r.filename || ''
    const matchesSearch = filename.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesFilter =
      statusFilter === 'all' ||
      (statusFilter === 'completed' && r.status === 'completed') ||
      (statusFilter === 'failed' && r.status === 'failed') ||
      (statusFilter === 'processing' && r.status === 'processing')
    return matchesSearch && matchesFilter
  })

  // Aggregate stats across all filtered reports
  const totalVehicles = filtered.reduce((acc, r) => acc + (r.total_vehicles || 0), 0)
  const totalCars = filtered.reduce((acc, r) => acc + (r.cars || 0), 0)
  const totalBikes = filtered.reduce((acc, r) => acc + (r.motorcycles || 0), 0)
  const totalBuses = filtered.reduce((acc, r) => acc + (r.buses || 0), 0)
  const totalTrucks = filtered.reduce((acc, r) => acc + (r.trucks || 0), 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Traffic Reports & Audits</h1>
          <p className="text-[#a3a3a3] mt-1">
            Historical detection logs, aggregate analytics, and data export
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => exportAllCSV()}
            disabled={reports.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white rounded-lg text-sm font-semibold transition shadow-lg shadow-orange-500/20"
          >
            <Download className="w-4 h-4" />
            Export All to CSV
          </button>
        </div>
      </div>

      {/* Aggregate Mini-Banner */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 bg-[#1a1a1a] border border-[#333333] rounded-xl p-4 text-center">
        <div>
          <div className="text-xs text-neutral-400">Total Logged</div>
          <div className="text-xl font-bold text-white mt-0.5">{totalVehicles}</div>
        </div>
        <div>
          <div className="text-xs text-neutral-400">Cars</div>
          <div className="text-xl font-bold text-orange-400 mt-0.5">{totalCars}</div>
        </div>
        <div>
          <div className="text-xs text-neutral-400">Motorcycles</div>
          <div className="text-xl font-bold text-amber-400 mt-0.5">{totalBikes}</div>
        </div>
        <div>
          <div className="text-xs text-neutral-400">Buses</div>
          <div className="text-xl font-bold text-blue-400 mt-0.5">{totalBuses}</div>
        </div>
        <div>
          <div className="text-xs text-neutral-400">Trucks</div>
          <div className="text-xl font-bold text-emerald-400 mt-0.5">{totalTrucks}</div>
        </div>
      </div>

      {/* Filter / Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input
            type="text"
            placeholder="Search report by video name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#1a1a1a] border border-[#333333] rounded-lg pl-9 pr-4 py-2 text-sm text-white focus:border-orange-500 focus:outline-none"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-neutral-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-[#1a1a1a] border border-[#333333] rounded-lg px-3 py-2 text-sm text-white focus:outline-none"
          >
            <option value="all">All Statuses</option>
            <option value="completed">Completed Only</option>
            <option value="processing">Processing</option>
            <option value="failed">Failed</option>
          </select>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <LoadingSpinner size="lg" message="Loading reports..." />
      ) : error ? (
        <ErrorMessage message={error} onRetry={fetchReportData} />
      ) : filtered.length === 0 ? (
        <div className="bg-[#1a1a1a] border border-[#333333] rounded-xl p-12 text-center">
          <FileText className="w-12 h-12 text-neutral-600 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-white">No Reports Found</h3>
          <p className="text-neutral-400 text-sm mt-1">
            {searchQuery ? 'No reports matched your search criteria.' : 'Process video files in Vehicle Detection to generate reports.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((item) => {
            const isExpanded = expandedId === item.id
            const breakdown = [
              { name: 'Cars', count: item.cars || 0, color: '#f97316' },
              { name: 'Motorcycles', count: item.motorcycles || 0, color: '#fbbf24' },
              { name: 'Buses', count: item.buses || 0, color: '#38bdf8' },
              { name: 'Trucks', count: item.trucks || 0, color: '#34d399' },
            ]

            return (
              <div
                key={item.id}
                className="bg-[#1a1a1a] border border-[#333333] hover:border-[#444444] rounded-xl transition overflow-hidden shadow-lg"
              >
                {/* Header Row */}
                <div
                  onClick={() => toggleExpand(item.id)}
                  className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer select-none"
                >
                  <div className="flex items-start md:items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-orange-500/10 border border-orange-500/20 flex items-center justify-center shrink-0">
                      <FileText className="w-5 h-5 text-orange-400" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-white text-base">
                          {item.original_filename || `Session #${item.id}`}
                        </h3>
                        <span
                          className={`px-2 py-0.5 rounded text-xs font-semibold ${
                            item.status === 'completed'
                              ? 'bg-green-500/20 text-green-400'
                              : item.status === 'processing'
                              ? 'bg-yellow-500/20 text-yellow-400'
                              : 'bg-red-500/20 text-red-400'
                          }`}
                        >
                          {item.status}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-4 text-xs text-neutral-400 mt-1">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5" />
                          {formatDate(item.upload_time || item.created_at)}
                        </span>
                        {item.processing_time && (
                          <span className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" />
                            Processed in {formatDuration(item.processing_time)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-6 justify-between md:justify-end">
                    <div className="text-right">
                      <div className="text-xs text-neutral-400">Total Tracked</div>
                      <div className="text-lg font-bold text-white">
                        {item.total_vehicles || 0}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          exportCSV(item.id)
                        }}
                        title="Download CSV"
                        className="p-2 bg-[#252525] hover:bg-[#333333] text-neutral-300 hover:text-white rounded-lg transition"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => handleDelete(item.id, e)}
                        disabled={deletingId === item.id}
                        title="Delete session"
                        className="p-2 bg-[#252525] hover:bg-red-500/20 text-neutral-400 hover:text-red-400 rounded-lg transition"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      <div className="p-1 text-neutral-400">
                        {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="px-5 pb-5 pt-2 border-t border-[#2c2c2c] bg-[#161616]">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-3">
                      {/* Vehicle Breakdown */}
                      <div>
                        <h4 className="text-xs uppercase tracking-wider text-neutral-400 font-semibold mb-3">
                          Vehicle Classification Breakdown
                        </h4>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                          <div className="bg-[#1f1f1f] p-3 rounded-lg border border-[#333]">
                            <div className="flex items-center gap-1.5 text-xs text-neutral-400">
                              <Car className="w-3.5 h-3.5 text-orange-400" /> Cars
                            </div>
                            <div className="text-lg font-bold text-white mt-1">{item.cars || 0}</div>
                          </div>
                          <div className="bg-[#1f1f1f] p-3 rounded-lg border border-[#333]">
                            <div className="flex items-center gap-1.5 text-xs text-neutral-400">
                              <Bike className="w-3.5 h-3.5 text-amber-400" /> Bikes
                            </div>
                            <div className="text-lg font-bold text-white mt-1">{item.motorcycles || 0}</div>
                          </div>
                          <div className="bg-[#1f1f1f] p-3 rounded-lg border border-[#333]">
                            <div className="flex items-center gap-1.5 text-xs text-neutral-400">
                              <Bus className="w-3.5 h-3.5 text-blue-400" /> Buses
                            </div>
                            <div className="text-lg font-bold text-white mt-1">{item.buses || 0}</div>
                          </div>
                          <div className="bg-[#1f1f1f] p-3 rounded-lg border border-[#333]">
                            <div className="flex items-center gap-1.5 text-xs text-neutral-400">
                              <Truck className="w-3.5 h-3.5 text-emerald-400" /> Trucks
                            </div>
                            <div className="text-lg font-bold text-white mt-1">{item.trucks || 0}</div>
                          </div>
                        </div>

                        {/* Quick links to Analysis and XAI */}
                        <div className="mt-4 flex gap-3">
                          <a
                            href={`/analysis?session=${item.id}`}
                            className="text-xs font-semibold text-orange-400 hover:text-orange-300 underline"
                          >
                            Open Detailed Analysis &rarr;
                          </a>
                          <a
                            href={`/explainability?session=${item.id}`}
                            className="text-xs font-semibold text-orange-400 hover:text-orange-300 underline"
                          >
                            Open SHAP Explanations &rarr;
                          </a>
                        </div>
                      </div>

                      {/* Mini Bar Chart */}
                      <div className="h-36">
                        <h4 className="text-xs uppercase tracking-wider text-neutral-400 font-semibold mb-2">
                          Distribution
                        </h4>
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={breakdown} margin={{ top: 0, right: 10, left: -20, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#262626" />
                            <XAxis dataKey="name" stroke="#666" tick={{ fill: '#888', fontSize: 11 }} />
                            <YAxis stroke="#666" tick={{ fill: '#888', fontSize: 11 }} />
                            <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                              {breakdown.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

