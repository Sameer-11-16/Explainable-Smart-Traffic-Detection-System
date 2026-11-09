import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Upload, FileVideo, CheckCircle, Clock, AlertCircle, Play, Trash2, X } from 'lucide-react'
import LoadingSpinner from '../components/LoadingSpinner'
import ErrorMessage from '../components/ErrorMessage'
import VideoPlayer from '../components/VideoPlayer'
import ConfidenceBadge from '../components/ConfidenceBadge'
import StatCard from '../components/StatCard'
import { Car, Bike, Bus, Truck } from 'lucide-react'
import {
  uploadVideo,
  getProcessingStatus,
  getDetectionResults,
  getDetectionSessions,
  deleteSession,
  runDemoVideo,
} from '../api/client'
import { validateVideoFile, formatFileSize, formatDate, truncateFilename } from '../utils/helpers'

function Detection() {
  const navigate = useNavigate()
  const fileInputRef = useRef(null)
  const pollRef = useRef(null)

  const [dragOver, setDragOver] = useState(false)
  const [selectedFile, setSelectedFile] = useState(null)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploading, setUploading] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [processingStatus, setProcessingStatus] = useState('')
  const [sessionId, setSessionId] = useState(null)
  const [results, setResults] = useState(null)
  const [sessions, setSessions] = useState([])
  const [sessionsLoading, setSessionsLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchSessions = useCallback(async () => {
    setSessionsLoading(true)
    try {
      const data = await getDetectionSessions()
      setSessions(data.sessions || data || [])
    } catch {
      /* ignore */
    } finally {
      setSessionsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchSessions()
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [fetchSessions])

  const handleFileSelect = (file) => {
    setError(null)
    const validation = validateVideoFile(file)
    if (!validation.valid) {
      setError(validation.error)
      return
    }
    setSelectedFile(file)
    setResults(null)
    setSessionId(null)
    setProcessingStatus('')
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFileSelect(file)
  }

  const handleDragOver = (e) => {
    e.preventDefault()
    setDragOver(true)
  }

  const handleDragLeave = () => setDragOver(false)

  const handleInputChange = (e) => {
    const file = e.target.files[0]
    if (file) handleFileSelect(file)
  }

  const pollProcessing = (id) => {
    setProcessing(true)
    pollRef.current = setInterval(async () => {
      try {
        const data = await getProcessingStatus(id)
        setProcessingStatus(data.status || data.message || 'Processing...')
        if (
          data.status === 'complete' ||
          data.status === 'completed' ||
          data.status === 'done'
        ) {
          clearInterval(pollRef.current)
          pollRef.current = null
          setProcessing(false)
          const resultData = await getDetectionResults(id)
          setResults(resultData)
          fetchSessions()
        } else if (data.status === 'error' || data.status === 'failed') {
          clearInterval(pollRef.current)
          pollRef.current = null
          setProcessing(false)
          setError(data.error || 'Processing failed')
        }
      } catch (err) {
        clearInterval(pollRef.current)
        pollRef.current = null
        setProcessing(false)
        setError(err.message)
      }
    }, 2000)
  }

  const handleUpload = async () => {
    if (!selectedFile) return
    setError(null)
    setUploading(true)
    setUploadProgress(0)
    setResults(null)
    try {
      const formData = new FormData()
      formData.append('video', selectedFile)
      const data = await uploadVideo(formData, setUploadProgress)
      const id = data.session_id || data.id
      setSessionId(id)
      setUploading(false)
      setProcessingStatus('Processing started...')
      pollProcessing(id)
    } catch (err) {
      setUploading(false)
      setError(err.message)
    }
  }

  const handleRunDemo = async () => {
    setError(null)
    setUploading(false)
    setResults(null)
    setProcessing(true)
    setProcessingStatus('Loading sample CCTV traffic video...')
    try {
      const data = await runDemoVideo()
      const id = data.session_id || data.id
      setSessionId(id)
      setProcessingStatus('Real YOLO inference started on sample video...')
      pollProcessing(id)
    } catch (err) {
      setProcessing(false)
      setError(err.message)
    }
  }

  const handleDeleteSession = async (id) => {
    try {
      await deleteSession(id)
      setSessions((prev) => prev.filter((s) => (s.id || s.session_id) !== id))
    } catch (err) {
      setError(err.message)
    }
  }

  const clearSelection = () => {
    setSelectedFile(null)
    setResults(null)
    setSessionId(null)
    setProcessingStatus('')
    setError(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-white">Vehicle Detection</h1>
        <p className="text-[#a3a3a3] mt-1">Upload a traffic video to detect and count vehicles</p>
      </div>

      {/* Upload Zone */}
      <div className="bg-[#1a1a1a] rounded-xl border border-[#333333] p-6 shadow-lg">
        <h3 className="text-sm font-medium text-[#a3a3a3] mb-4">Upload Video</h3>

        {!selectedFile ? (
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => fileInputRef.current?.click()}
            className={`flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-12 cursor-pointer transition-all ${
              dragOver
                ? 'border-orange-500 bg-orange-500/5'
                : 'border-[#333333] hover:border-orange-500/50 hover:bg-[#252525]'
            }`}
          >
            <Upload className="h-12 w-12 text-orange-400 mb-4" />
            <p className="text-white font-medium mb-1">
              Drop your video here or click to browse
            </p>
            <p className="text-sm text-[#737373]">MP4, AVI, MOV — Max 500MB</p>
            <input
              ref={fileInputRef}
              type="file"
              accept="video/mp4,video/avi,video/quicktime,.mp4,.avi,.mov"
              onChange={handleInputChange}
              className="hidden"
            />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between bg-[#252525] rounded-lg p-4">
              <div className="flex items-center gap-3">
                <FileVideo className="h-8 w-8 text-orange-400" />
                <div>
                  <p className="text-white font-medium text-sm">
                    {truncateFilename(selectedFile.name, 40)}
                  </p>
                  <p className="text-xs text-[#737373]">{formatFileSize(selectedFile.size)}</p>
                </div>
              </div>
              <button onClick={clearSelection} className="text-[#737373] hover:text-red-400 transition-colors cursor-pointer">
                <X className="h-5 w-5" />
              </button>
            </div>

            {!uploading && !processing && !results && (
              <button
                onClick={handleUpload}
                className="w-full bg-orange-500 hover:bg-orange-600 text-white rounded-lg px-4 py-3 transition-all font-medium flex items-center justify-center gap-2 cursor-pointer"
              >
                <Upload className="h-4 w-4" />
                Start Detection
              </button>
            )}

            {/* Upload Progress */}
            {uploading && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-[#a3a3a3]">Uploading...</span>
                  <span className="text-orange-400">{uploadProgress}%</span>
                </div>
                <div className="w-full h-2 bg-[#252525] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-orange-500 rounded-full transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            )}

            {/* Processing Status */}
            {processing && (
              <div className="flex items-center gap-3 bg-orange-500/5 border border-orange-500/20 rounded-lg p-4">
                <div className="h-5 w-5 border-2 border-orange-500/30 border-t-orange-500 rounded-full animate-spin" />
                <div>
                  <p className="text-orange-400 font-medium text-sm">Processing Video</p>
                  <p className="text-xs text-[#a3a3a3] capitalize">{processingStatus}</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Demo Mode Action Bar */}
        <div className="mt-6 pt-4 border-t border-[#2e2e2e] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-neutral-400">
          <span>Need a sample video for testing? Run real YOLO detection on our pre-generated CCTV traffic clip:</span>
          <button
            type="button"
            onClick={handleRunDemo}
            disabled={processing || uploading}
            className="px-4 py-2 bg-[#252525] hover:bg-orange-500/10 hover:border-orange-500 border border-[#383838] text-orange-400 font-semibold rounded-lg transition shrink-0 cursor-pointer flex items-center gap-2 disabled:opacity-50"
          >
            <Play className="w-3.5 h-3.5 fill-orange-400" />
            Run Demo Video (Real YOLO)
          </button>
        </div>

        {error && (
          <div className="mt-4 flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-lg p-3">
            <AlertCircle className="h-4 w-4 text-red-400 shrink-0" />
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}
      </div>

      {/* Results */}
      {results && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-400" />
            Detection Complete
          </h3>

          {/* Result Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              icon={Car}
              label="Total Vehicles"
              value={results.total_vehicles ?? results.summary?.total_vehicles ?? 0}
              gradient
            />
            <StatCard
              icon={Car}
              label="Cars"
              value={results.cars ?? results.summary?.cars ?? 0}
            />
            <StatCard
              icon={Bike}
              label="Motorcycles"
              value={results.motorcycles ?? results.summary?.motorcycles ?? 0}
            />
            <StatCard
              icon={Bus}
              label="Buses & Trucks"
              value={
                (results.buses ?? results.summary?.buses ?? 0) +
                (results.trucks ?? results.summary?.trucks ?? 0)
              }
            />
          </div>

          {/* Confidence */}
          {(results.confidence || results.avg_confidence) && (
            <div className="bg-[#1a1a1a] rounded-xl border border-[#333333] p-6 shadow-lg">
              <h4 className="text-sm font-medium text-[#a3a3a3] mb-3">Detection Confidence</h4>
              <ConfidenceBadge confidence={results.confidence || results.avg_confidence} label="Average" />
            </div>
          )}

          {/* Video */}
          {(results.video_url || results.processed_video) && (
            <div className="bg-[#1a1a1a] rounded-xl border border-[#333333] p-6 shadow-lg">
              <VideoPlayer
                src={results.video_url || results.processed_video}
                title="Processed Video"
              />
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="flex gap-3">
            <button
              onClick={() => navigate(`/analysis?session=${sessionId}`)}
              className="bg-[#252525] hover:bg-[#333333] text-white rounded-lg px-4 py-2 transition-all text-sm font-medium cursor-pointer"
            >
              View Analysis →
            </button>
            <button
              onClick={() => navigate(`/explainability?session=${sessionId}`)}
              className="bg-[#252525] hover:bg-[#333333] text-white rounded-lg px-4 py-2 transition-all text-sm font-medium cursor-pointer"
            >
              View Explanations →
            </button>
          </div>
        </div>
      )}

      {/* Past Sessions */}
      <div className="bg-[#1a1a1a] rounded-xl border border-[#333333] p-6 shadow-lg">
        <h3 className="text-sm font-medium text-[#a3a3a3] mb-4">Past Sessions</h3>
        {sessionsLoading ? (
          <LoadingSpinner size="sm" message="Loading sessions..." />
        ) : sessions.length > 0 ? (
          <div className="space-y-2">
            {sessions.map((s, i) => (
              <div
                key={s.id || s.session_id || i}
                className="flex items-center justify-between bg-[#252525] rounded-lg px-4 py-3 hover:bg-[#333333] transition-colors"
              >
                <div className="flex items-center gap-3">
                  <FileVideo className="h-5 w-5 text-orange-400" />
                  <div>
                    <p className="text-white text-sm font-medium">
                      {truncateFilename(s.filename || s.file_name || 'Video', 35)}
                    </p>
                    <p className="text-xs text-[#737373]">
                      {formatDate(s.created_at || s.date)} · {s.total_vehicles ?? '—'} vehicles
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setSessionId(s.id || s.session_id)
                      getDetectionResults(s.id || s.session_id).then(setResults).catch(() => {})
                    }}
                    className="text-[#a3a3a3] hover:text-orange-400 transition-colors cursor-pointer"
                    title="View results"
                  >
                    <Play className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteSession(s.id || s.session_id)}
                    className="text-[#a3a3a3] hover:text-red-400 transition-colors cursor-pointer"
                    title="Delete session"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-[#737373] py-4 text-center">
            No past sessions — upload a video to get started
          </p>
        )}
      </div>
    </div>
  )
}

export default Detection
