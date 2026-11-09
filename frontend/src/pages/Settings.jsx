import { useState, useEffect } from 'react'
import {
  Settings as SettingsIcon, Sliders, Video, LayoutDashboard,
  Save, RotateCcw, CheckCircle, AlertTriangle, Cpu, ShieldCheck
} from 'lucide-react'
import LoadingSpinner from '../components/LoadingSpinner'
import ErrorMessage from '../components/ErrorMessage'
import { getSettings, updateSettings } from '../api/client'

const DEFAULT_SETTINGS = {
  confidence_threshold: 0.5,
  frame_skip: 3,
  max_video_duration: 300,
  refresh_interval: 5,
  show_bounding_boxes: true,
  enable_tracking_hud: true,
}

export default function Settings() {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [toast, setToast] = useState(null)

  useEffect(() => {
    const fetchCurrent = async () => {
      setLoading(true)
      setError(null)
      try {
        const data = await getSettings()
        if (data) {
          setSettings((prev) => ({
            ...prev,
            confidence_threshold: data.confidence_threshold !== undefined ? Number(data.confidence_threshold) : prev.confidence_threshold,
            frame_skip: data.frame_skip !== undefined ? Number(data.frame_skip) : prev.frame_skip,
            max_video_duration: data.max_video_duration !== undefined ? Number(data.max_video_duration) : prev.max_video_duration,
          }))
        }
      } catch (err) {
        setError(err.message || 'Failed to fetch settings from backend.')
      } finally {
        setLoading(false)
      }
    }
    fetchCurrent()
  }, [])

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      await updateSettings({
        confidence_threshold: settings.confidence_threshold,
        frame_skip: settings.frame_skip,
        max_video_duration: settings.max_video_duration,
      })
      // Save local preferences
      localStorage.setItem('stds_prefs', JSON.stringify({
        refresh_interval: settings.refresh_interval,
        show_bounding_boxes: settings.show_bounding_boxes,
        enable_tracking_hud: settings.enable_tracking_hud,
      }))
      setToast('Settings saved successfully!')
      setTimeout(() => setToast(null), 3500)
    } catch (err) {
      setError(err.message || 'Failed to update settings.')
    } finally {
      setSaving(false)
    }
  }

  const handleReset = () => {
    if (window.confirm('Reset all settings to default values?')) {
      setSettings(DEFAULT_SETTINGS)
    }
  }

  if (loading) return <LoadingSpinner size="lg" message="Loading system settings..." />

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-2">
          <SettingsIcon className="w-8 h-8 text-orange-400" />
          System Settings & Tuning
        </h1>
        <p className="text-[#a3a3a3] mt-1">
          Configure computer vision thresholds, inference hardware parameters, and dashboard preferences
        </p>
      </div>

      {/* Success Notification Toast */}
      {toast && (
        <div className="flex items-center gap-2 bg-green-500/10 border border-green-500/30 text-green-400 px-4 py-3 rounded-xl transition animate-fade-in">
          <CheckCircle className="w-5 h-5 shrink-0" />
          <span className="text-sm font-medium">{toast}</span>
        </div>
      )}

      {error && <ErrorMessage message={error} />}

      <form onSubmit={handleSave} className="space-y-6">
        {/* Section 1: AI & Detection Settings */}
        <div className="bg-[#1a1a1a] border border-[#333333] rounded-xl p-6 shadow-lg space-y-6">
          <div className="flex items-center gap-2 border-b border-[#2e2e2e] pb-3">
            <Cpu className="w-5 h-5 text-orange-400" />
            <h2 className="text-lg font-bold text-white">YOLO Detection Engine</h2>
          </div>

          {/* Confidence Slider */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label className="text-sm font-semibold text-neutral-200">
                Detection Confidence Threshold
              </label>
              <span className="px-2.5 py-0.5 rounded bg-orange-500/20 text-orange-400 font-mono text-xs font-bold">
                {(settings.confidence_threshold * 100).toFixed(0)}%
              </span>
            </div>
            <p className="text-xs text-neutral-400">
              Minimum confidence score required for an object to be recognized as a vehicle (Car, Motorcycle, Bus, Truck).
            </p>
            <input
              type="range"
              min="0.1"
              max="0.95"
              step="0.05"
              value={settings.confidence_threshold}
              onChange={(e) =>
                setSettings({ ...settings, confidence_threshold: parseFloat(e.target.value) })
              }
              className="w-full accent-orange-500 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-neutral-500 font-mono">
              <span>0.1 (High Recall)</span>
              <span>0.5 (Balanced)</span>
              <span>0.95 (High Precision)</span>
            </div>
          </div>

          {/* Frame Skip */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label className="text-sm font-semibold text-neutral-200">
                Frame Skip Interval (Performance Optimization)
              </label>
              <span className="px-2.5 py-0.5 rounded bg-orange-500/20 text-orange-400 font-mono text-xs font-bold">
                Every {settings.frame_skip} frames
              </span>
            </div>
            <p className="text-xs text-neutral-400">
              Processes every Nth video frame through the neural network. Higher values drastically speed up processing on normal laptops with minimal tracking impact.
            </p>
            <input
              type="number"
              min="1"
              max="15"
              value={settings.frame_skip}
              onChange={(e) =>
                setSettings({ ...settings, frame_skip: Math.max(1, parseInt(e.target.value) || 1) })
              }
              className="w-full sm:w-48 bg-[#252525] border border-[#333333] text-white rounded-lg px-3 py-2 text-sm focus:border-orange-500 focus:outline-none"
            />
          </div>
        </div>

        {/* Section 2: Video Ingestion & Hardware */}
        <div className="bg-[#1a1a1a] border border-[#333333] rounded-xl p-6 shadow-lg space-y-6">
          <div className="flex items-center gap-2 border-b border-[#2e2e2e] pb-3">
            <Video className="w-5 h-5 text-orange-400" />
            <h2 className="text-lg font-bold text-white">Video Processing & Hardware Limits</h2>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label className="text-sm font-semibold text-neutral-200">
                Maximum Video Duration (seconds)
              </label>
              <span className="px-2.5 py-0.5 rounded bg-neutral-800 text-neutral-300 font-mono text-xs">
                {settings.max_video_duration}s ({Math.floor(settings.max_video_duration / 60)}m)
              </span>
            </div>
            <p className="text-xs text-neutral-400">
              Maximum allowable duration for uploaded CCTV and drone video clips.
            </p>
            <input
              type="number"
              min="10"
              max="1800"
              step="30"
              value={settings.max_video_duration}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  max_video_duration: Math.max(10, parseInt(e.target.value) || 300),
                })
              }
              className="w-full sm:w-48 bg-[#252525] border border-[#333333] text-white rounded-lg px-3 py-2 text-sm focus:border-orange-500 focus:outline-none"
            />
          </div>
        </div>

        {/* Section 3: Dashboard & Visualization Preferences */}
        <div className="bg-[#1a1a1a] border border-[#333333] rounded-xl p-6 shadow-lg space-y-6">
          <div className="flex items-center gap-2 border-b border-[#2e2e2e] pb-3">
            <LayoutDashboard className="w-5 h-5 text-orange-400" />
            <h2 className="text-lg font-bold text-white">Dashboard & Visual HUD</h2>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-white">Display Bounding Box Overlays</div>
                <div className="text-xs text-neutral-400">Render detection bounding boxes and vehicle class labels on processed video</div>
              </div>
              <input
                type="checkbox"
                checked={settings.show_bounding_boxes}
                onChange={(e) =>
                  setSettings({ ...settings, show_bounding_boxes: e.target.checked })
                }
                className="w-4 h-4 accent-orange-500 cursor-pointer"
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-white">Telemetry & Congestion HUD</div>
                <div className="text-xs text-neutral-400">Burn real-time telemetry stats (counts, density, level) into output MP4</div>
              </div>
              <input
                type="checkbox"
                checked={settings.enable_tracking_hud}
                onChange={(e) =>
                  setSettings({ ...settings, enable_tracking_hud: e.target.checked })
                }
                className="w-4 h-4 accent-orange-500 cursor-pointer"
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-white">Chart Polling Frequency</div>
                <div className="text-xs text-neutral-400">Frequency (in seconds) to check for updated traffic statistics</div>
              </div>
              <select
                value={settings.refresh_interval}
                onChange={(e) =>
                  setSettings({ ...settings, refresh_interval: Number(e.target.value) })
                }
                className="bg-[#252525] border border-[#333333] text-white text-xs rounded-lg px-3 py-1.5 focus:outline-none"
              >
                <option value="3">3 seconds</option>
                <option value="5">5 seconds</option>
                <option value="10">10 seconds</option>
                <option value="30">30 seconds</option>
              </select>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={handleReset}
            className="flex items-center gap-2 px-4 py-2 bg-[#252525] hover:bg-[#303030] border border-[#333333] text-neutral-300 rounded-lg text-sm font-medium transition"
          >
            <RotateCcw className="w-4 h-4" />
            Reset Defaults
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 px-6 py-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white rounded-lg text-sm font-semibold transition shadow-lg shadow-orange-500/20"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </form>
    </div>
  )
}

